// ===== FILE: src/features/survey-integration/actions.ts =====
"use server"

// ============================================================
// أكشنات الخادم — تكامل الاستبانات مع أدوات التقييم
// ============================================================
// - الصلاحيات تُفرض هنا على الخادم (لا في الواجهة فقط):
//     إعداد الدمج + ربط الاستبانات = SUPER_ADMIN (أي مدرسة) أو SCHOOL_MANAGER (مدرسته فقط)
//     BRANCH_MANAGER / QUALITY_ASSESSOR / غيرهم: رفض صريح.
// - التحقق من الأوزان يستخدم الخدمة النقية نفسها المستخدمة في الاحتساب (مصدر واحد).
// - ربط الاستبانة يعدّل عمودًا واحدًا فقط (indicatorId) — لا يلمس أي حقل آخر،
//   ولا يحذف أي سجل، والاستبانات غير المرتبطة تبقى كما هي (لا ربط قسري).
// ============================================================

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { validateWeights } from "@/features/quality-reports/services/survey-integration"

export interface SaveSurveyIntegrationConfigResult {
  success: boolean
  error?: string
}

export interface LinkSurveyResult {
  success: boolean
  error?: string
}

function canManageSchoolScope(
  role: string,
  userSchoolId: string | null,
  targetSchoolId: string
): boolean {
  if (role === "SUPER_ADMIN") return true
  if (role === "SCHOOL_MANAGER") return !!userSchoolId && userSchoolId === targetSchoolId
  return false
}

/** حفظ/تحديث إعداد النتيجة المدمجة لمدرسة — صف واحد لكل مدرسة (وجوده = معتمد) */
export async function saveSurveyIntegrationConfig(input: {
  schoolId: string
  toolWeightPercent: number
  surveyWeightPercent: number
  note?: string
}): Promise<SaveSurveyIntegrationConfigResult> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "غير مصرح — سجّل الدخول أولًا." }

  const schoolId = input.schoolId
  if (!schoolId) return { success: false, error: "المدرسة مطلوبة." }

  if (!canManageSchoolScope(user.role, user.schoolId, schoolId)) {
    return { success: false, error: "غير مصرح — إعداد الدمج لمدير النظام أو مدير المدرسة لمدرسته فقط." }
  }

  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } })
  if (!school) return { success: false, error: "المدرسة غير موجودة." }

  const toolWeight = Number(input.toolWeightPercent)
  const surveyWeight = Number(input.surveyWeightPercent)
  if (!Number.isFinite(toolWeight) || !Number.isFinite(surveyWeight)) {
    return { success: false, error: "الأوزان يجب أن تكون أرقامًا." }
  }

  // التحقق بنفس دالة الخدمة النقية (كسور 0..1 ومجموع = 1) — نفس القاعدة التي يحتسب بها
  const check = validateWeights(toolWeight / 100, surveyWeight / 100)
  if (!check.valid) {
    return { success: false, error: check.reason ?? "أوزان غير صالحة." }
  }

  try {
    await prisma.surveyIntegrationConfig.upsert({
      where: { schoolId },
      create: {
        schoolId,
        toolWeight: toolWeight / 100,
        surveyWeight: surveyWeight / 100,
        method: "WEIGHTED_AVERAGE",
        note: input.note?.trim() || null,
        approvedById: user.id,
      },
      update: {
        toolWeight: toolWeight / 100,
        surveyWeight: surveyWeight / 100,
        method: "WEIGHTED_AVERAGE",
        note: input.note?.trim() || null,
        approvedById: user.id,
      },
    })
  } catch {
    return { success: false, error: "حدث خطأ أثناء حفظ الإعداد. حاول مرة أخرى." }
  }

  revalidatePath("/surveys")
  revalidatePath("/reports/print")
  return { success: true }
}

/** إلغاء إعداد الدمج — تعود كل النتائج المدمجة إلى «غير مُهيَّأة» فورًا */
export async function deleteSurveyIntegrationConfig(schoolId: string): Promise<SaveSurveyIntegrationConfigResult> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "غير مصرح — سجّل الدخول أولًا." }

  if (!canManageSchoolScope(user.role, user.schoolId, schoolId)) {
    return { success: false, error: "غير مصرح — إلغاء الإعداد لمدير النظام أو مدير المدرسة لمدرسته فقط." }
  }

  try {
    await prisma.surveyIntegrationConfig.deleteMany({ where: { schoolId } })
  } catch {
    return { success: false, error: "حدث خطأ أثناء إلغاء الإعداد. حاول مرة أخرى." }
  }

  revalidatePath("/surveys")
  revalidatePath("/reports/print")
  return { success: true }
}

/**
 * ربط استبانة ببند (أو فك الربط بتمرير indicatorId = null) — بالمعرّفات المستقرة فقط.
 * يعيد الكشف: الاستبانة يجب أن تكون ضمن نطاق المدرسة، والبند يجب أن يوجد فعلًا.
 * يعدّل indicatorId فقط — لا يلمس النسبة ولا النوع ولا أي حقل آخر.
 */
export async function linkSurveyToIndicator(input: {
  surveyId: string
  indicatorId: string | null
}): Promise<LinkSurveyResult> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "غير مصرح — سجّل الدخول أولًا." }

  const survey = await prisma.survey.findUnique({
    where: { id: input.surveyId },
    select: { id: true, schoolId: true },
  })
  if (!survey) return { success: false, error: "الاستبانة غير موجودة." }

  // نطاق المدرسة: مدير النظام أي مدرسة، مدير المدرسة مدرسته فقط — البقية مرفوضون
  if (user.role === "SUPER_ADMIN") {
    // مسموح
  } else if (user.role === "SCHOOL_MANAGER") {
    if (!user.schoolId || survey.schoolId !== user.schoolId) {
      return { success: false, error: "غير مصرح — هذه الاستبانة خارج نطاق مدرستك." }
    }
  } else {
    return { success: false, error: "غير مصرح — الربط لمدير النظام أو مدير المدرسة فقط." }
  }

  if (input.indicatorId !== null) {
    const indicator = await prisma.indicator.findUnique({
      where: { id: input.indicatorId },
      select: { id: true },
    })
    if (!indicator) return { success: false, error: "البند المطلوب غير موجود في إطار التقويم." }
  }

  try {
    await prisma.survey.update({
      where: { id: input.surveyId },
      data: { indicatorId: input.indicatorId }, // فك الربط = null (حقل nullable قائم)
    })
  } catch {
    return { success: false, error: "حدث خطأ أثناء حفظ الربط. حاول مرة أخرى." }
  }

  revalidatePath("/surveys")
  revalidatePath("/reports/print")
  return { success: true }
}

/**
 * (ربط الاستبانات بالتقييم — هذه المهمة) إسناد استبانة قائمة إلى تقييم، أو فك الإسناد
 * بتمرير assessmentId = null (عودة صريحة إلى «سجل تاريخي» — لا ربط صامت ولا حذف).
 *
 * الحمايات (كلها خادمية):
 *   - نفس بوابة إدارة الربط القائمة: SUPER_ADMIN أو SCHOOL_MANAGER لمدرسته فقط.
 *   - العزل الصارم: الاستبانة لا تُسنَد إلا إلى تقييم يتبع نفس مدرسة الاستبانة —
 *     لا إسناد عابر للمدارس/المستأجرين حتى لمدير النظام.
 *   - التقييم يجب أن يوجد فعلًا (FK + فحص صريح قبل الحفظ).
 *   - يعدّل assessmentId فقط — لا يلمس النسبة ولا النوع ولا indicatorId ولا أي حقل آخر،
 *     والاستبانات التاريخية بلا إسناد تبقى كما هي إن لم يتدخل مصرح له صراحةً.
 */
export async function linkSurveyToAssessment(input: {
  surveyId: string
  assessmentId: string | null
}): Promise<LinkSurveyResult> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "غير مصرح — سجّل الدخول أولًا." }

  const survey = await prisma.survey.findUnique({
    where: { id: input.surveyId },
    select: { id: true, schoolId: true },
  })
  if (!survey) return { success: false, error: "الاستبانة غير موجودة." }

  // بوابة الإدارة — مطابقة لبوابة linkSurveyToIndicator القائمة
  if (user.role === "SUPER_ADMIN") {
    // مسموح — مع قيد نفس المدرسة أدناه
  } else if (user.role === "SCHOOL_MANAGER") {
    if (!user.schoolId || survey.schoolId !== user.schoolId) {
      return { success: false, error: "غير مصرح — هذه الاستبانة خارج نطاق مدرستك." }
    }
  } else {
    return { success: false, error: "غير مصرح — إسناد التقييم لمدير النظام أو مدير المدرسة فقط." }
  }

  if (input.assessmentId !== null) {
    const assessment = await prisma.assessment.findUnique({
      where: { id: input.assessmentId },
      select: { id: true, schoolId: true },
    })
    if (!assessment) return { success: false, error: "التقييم المحدد غير موجود." }
    // العزل الصارم: استبانة مدرسة لا تُسنَد إلا إلى تقييم من نفس المدرسة —
    // حتى استبانة بلا مدرسة مخزّنة (schoolId = null) لا تُسنَد لأي تقييم
    // لأن ذلك سيُدخلها بحصانة إلى تقارير مدرسة لم تُنسب إليها أصلًا.
    if (assessment.schoolId !== survey.schoolId) {
      return { success: false, error: "غير مصرح — لا يمكن إسناد الاستبانة إلا إلى تقييم يتبع نفس مدرسة الاستبانة." }
    }
  }

  try {
    await prisma.survey.update({
      where: { id: input.surveyId },
      data: { assessmentId: input.assessmentId }, // فك الإسناد = null (حقل nullable)
    })
  } catch {
    return { success: false, error: "حدث خطأ أثناء حفظ الإسناد. حاول مرة أخرى." }
  }

  revalidatePath("/surveys")
  revalidatePath("/reports/print")
  return { success: true }
}