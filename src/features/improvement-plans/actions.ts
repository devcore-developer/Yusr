// ===== FILE: src/features/improvement-plans/actions.ts =====
// (معدّل — التغييرات في createEvidencePlan حصرًا: استيراد + نوع النتيجة
//  + منع التكرار + تخزين assessmentId + status؛ كل الدوال الأخرى حرفيًا)

"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { SUSTAINABILITY_THRESHOLD, computeIndicatorEvidenceScore } from "@/features/improvement-plans/queries"
import { normalizePlanKind } from "@/features/improvement-plans/threshold"
import { buildEvidencePlanDuplicateWhere } from "@/features/improvement-plans/plan-context"

export async function savePlan(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized: Only Quality Assessors can create plans")

  const id = formData.get("id") as string
  const title = formData.get("title") as string
  const gapId = formData.get("gapId") as string
  const indicatorId = formData.get("indicatorId") as string
  const startDate = formData.get("startDate") as string
  const targetDate = formData.get("targetDate") as string

  if (!title || !targetDate) throw new Error("العنوان وتاريخ الانتهاء مطلوبان")

  const actions: any[] = []
  const entries = Array.from(formData.entries())
  entries.forEach(([key, value]) => {
    const match = key.match(/actions\[(\d+)\]\[(\w+)\]/)
    if (match) {
      const index = parseInt(match[1])
      const field = match[2]
      if (!actions[index]) actions[index] = {}
      actions[index][field] = value
    }
  })

  let schoolId = user.schoolId
  let branchId = user.branchId || null

  if (gapId) {
    const gap = await prisma.gap.findUnique({ where: { id: gapId }, select: { schoolId: true, branchId: true } })
    if (gap) {
      if (!schoolId) schoolId = gap.schoolId
      if (!branchId) branchId = gap.branchId
    }
  }

  if (!schoolId) throw new Error("لم يتم تحديد المدرسة.")

  const data: any = {
    title,
    description: formData.get("description") as string,
    gapId: gapId || null,
    indicatorId: indicatorId || null,
    startDate: new Date(startDate || Date.now()),
    targetDate: new Date(targetDate),
    status: formData.get("status") as string || "DRAFT",
    priority: formData.get("priority") as string || "MEDIUM",
    objective: formData.get("objective") as string,
    reasons: formData.get("reasons") as string,
    strengths: formData.get("strengths") as string,
    improvements: formData.get("improvements") as string,
    baseline: parseFloat(formData.get("baseline") as string) || null,
    targetPercentage: parseFloat(formData.get("targetPercentage") as string) || null,
    currentMeasured: parseFloat(formData.get("currentMeasured") as string) || null,
    kpiName: formData.get("kpiName") as string,
    successCriteria: formData.get("successCriteria") as string,
    requiredSupport: formData.get("requiredSupport") as string,
    followUpMethod: formData.get("followUpMethod") as string,
    impactNotes: formData.get("impactNotes") as string,
    schoolId,
    branchId,
    createdById: user.id,
  }

  try {
    if (id) {
      await prisma.$transaction(async (tx) => {
        await tx.improvementPlan.update({ where: { id }, data })
        await tx.improvementAction.deleteMany({ where: { planId: id } })
        if (actions.length > 0) {
          await tx.improvementAction.createMany({
            data: actions.map(a => ({
              planId: id,
              title: a.title,
              status: a.status || "PENDING",
              startDate: a.startDate ? new Date(a.startDate) : null,
              dueDate: a.dueDate ? new Date(a.dueDate) : null,
            }))
          })
        }
      })
    } else {
      await prisma.$transaction(async (tx) => {
        const plan = await tx.improvementPlan.create({ data })
        if (actions.length > 0) {
          await tx.improvementAction.createMany({
            data: actions.map(a => ({
              planId: plan.id,
              title: a.title,
              status: a.status || "PENDING",
              startDate: a.startDate ? new Date(a.startDate) : null,
              dueDate: a.dueDate ? new Date(a.dueDate) : null,
            }))
          })
        }
      })
    }

    revalidatePath("/school-manager/quality/improvement-plans")
    revalidatePath("/improvement-plans")
    return { success: true }
  } catch (error) {
    console.error(error)
    throw new Error("حدث خطأ أثناء حفظ الخطة")
  }
}

export async function addAction(planId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized")

  const title = formData.get("title") as string
  if (!title) throw new Error("عنوان الإجراء مطلوب")

  await prisma.improvementAction.create({
    data: {
      planId,
      title,
      status: formData.get("status") as string || "PENDING",
      startDate: formData.get("startDate") ? new Date(formData.get("startDate") as string) : null,
      dueDate: formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null,
    }
  })

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}

// تحديث نسبة تقدم الإجراء (مع التحقق من التزامن بين الحالة والنسبة)
export async function updateActionProgress(actionId: string, status: string, planId: string, progressInput: number = 0) {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized")

  let finalProgress = progressInput;

  // 1. فرض القواعد من جانب الخادم لضمان عدم وجود تضارب
  if (status === "COMPLETED") {
    finalProgress = 100;
  } else if (status === "PENDING") {
    finalProgress = 0;
  } else {
    // للحالات (جارية) و (متعثرة): النسبة يجب أن تكون بين 0 و 99
    finalProgress = Math.max(0, Math.min(99, finalProgress));
    // إذا أدخل المستخدم 100% للحالة جارية، يتم خفضها إلى 99% تلقائيًا
    if (finalProgress === 100) finalProgress = 99;
  }

  // 2. تحديث الإجراء بالحالة والنسبة الجديدة المعتمدة
  await prisma.improvementAction.update({
    where: { id: actionId },
    data: { 
      status,
      progress: finalProgress
    }
  })

  // 3. إعادة حساب النسبة الإجمالية للخطة
  const actions = await prisma.improvementAction.findMany({ where: { planId } })
  
  if (actions.length > 0) {
    const totalProgress = actions.reduce((acc, a) => acc + (a.progress || 0), 0)
    const overallProgress = Math.round(totalProgress / actions.length)
    
    await prisma.improvementPlan.update({
      where: { id: planId },
      data: { progress: overallProgress }
    })
  } else {
    await prisma.improvementPlan.update({
      where: { id: planId },
      data: { progress: 0 }
    })
  }

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}

export async function addFollowUp(planId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const note = formData.get("note") as string
  if (!note) throw new Error("الملاحظة مطلوبة")

  await prisma.improvementFollowUp.create({
    data: { planId, note, progress: parseInt(formData.get("progress") as string) || null, createdById: user.id }
  })

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}

/* ============================================================
   Task 16 — الإضافة الجديدة فقط: إنشاء خطة من سياق الشواهد/المؤشر
   (Evidence Bank actions + Sustainability Plans — حد 90%)

   قواعد الإضافة الصارمة:
   - كل الدوال أعلاه لم تُلمس حرفيًا — سير «خطة جديدة» الحالي (new?gapId=)
     يعمل كما هو تمامًا، والخطط المنشأة منه تحصل على kind=IMPROVEMENT
     من القيمة الافتراضية في قاعدة البيانات تلقائيًا.
   - نفس سلطة savePlan حرفيًا: QUALITY_ASSESSOR فقط — لم يُوسَّ أي دور.
   - الدرجة لا تُقبل من العميل أبدًا: يُعيد الخادم حسابها من استجابات
     الشواهد المتحققة (نفس منهجية analysis.ts) داخل التقييم المحدد.
   - خطة الاستدامة تُرفض على الخادم إذا كانت الدرجة null (غير قابلة للتحديد)
     أو أقل من 90 — مع رسالة توضح السبب بدقة وبدون اختلاق أي درجة.
   - خطة التحسين من هذا المسار مسموحة بلا شرط درجة (نفس سلوك مسار الفجوات القائم).
   ============================================================ */

/**
 * نوع النتيجة صريح حتى يبقى success حرفيًا (true/false) ويشتغل تضييق الاتحاد
 * في مكوّن العميل (res.success → res.planId / res.error) بلا أخطاء 2339.
 * القيم قابلة للتسلسل (serializable) — متوافقة مع Server Actions.
 */
type CreateEvidencePlanResult =
  | { success: true; planId: string; kind: string; status: string; evidenceScore: number | null; alreadyExisted?: boolean }
  | { success: false; error: string }

export async function createEvidencePlan(formData: FormData): Promise<CreateEvidencePlanResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized: Only Quality Assessors can create plans")

  const indicatorId = (formData.get("indicatorId") as string || "").trim()
  const assessmentId = (formData.get("assessmentId") as string || "").trim()
  const gapId = (formData.get("gapId") as string || "").trim()
  const submittedTitle = (formData.get("title") as string || "").trim()
  const kindInput = (formData.get("kind") as string || "").trim()

  // تطبيع النوع عبر normalizePlanKind (threshold.ts — المصدر الواحد المختبر آليًا):
  // أي قيمة غير معروفة ترجع إلى IMPROVEMENT (الافتراضي الآمن) — نفس دلالة
  // السطر السابق حرفيًا، وأصبحت الآن دالة واحدة مختبرة.
  const kind = normalizePlanKind(kindInput)

  if (!indicatorId) throw new Error("لم يتم تحديد المؤشر.")

  const indicator = await prisma.indicator.findUnique({
    where: { id: indicatorId },
    select: { code: true, description: true, targetStatus: true },
  })
  if (!indicator) throw new Error("المؤشر غير موجود.")

  // نفس منطق حل المدرسة/الفرع في savePlan حرفيًا + حراسة عزل إضافية للفجوة (في هذه الدالة الجديدة فقط)
  let schoolId = user.schoolId
  let branchId = user.branchId || null

  if (gapId) {
    const gap = await prisma.gap.findUnique({ where: { id: gapId }, select: { schoolId: true, branchId: true } })
    if (gap) {
      if (schoolId && gap.schoolId !== schoolId) throw new Error("Forbidden: الفجوة لا تنتمي إلى مدرستك.")
      if (!schoolId) schoolId = gap.schoolId
      if (!branchId) branchId = gap.branchId
    }
  }

  if (!schoolId) throw new Error("لم يتم تحديد المدرسة.")

  // التحقق من انتماء التقييم للمدرسة نفسها (عزل المستأجرين) — عند تمرير assessmentId
  if (assessmentId) {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { schoolId: true },
    })
    if (!assessment) throw new Error("التقييم غير موجود.")
    if (assessment.schoolId !== schoolId) throw new Error("Forbidden: التقييم لا ينتمي إلى مدرستك.")
  }

  // الدرجة المرجعية: يحسبها الخادم حصرًا من بيانات الشواهد — null إن تعذر الحساب الموثوق
  let evidenceScore: number | null = null
  if (assessmentId) {
    evidenceScore = await computeIndicatorEvidenceScore(assessmentId, indicatorId)
  }

  // فرض حد 90% على الخادم لخطة الاستدامة — بلا اختلاق درجات.
  // حالات الرفض المتوقعة تُعاد كنتيجة { success: false } برسالة دقيقة
  // (لا تُرمى استثناءً) حتى تعرضها الواجهة بلطف دون كسر الصفحة.
  if (kind === "SUSTAINABILITY") {
    if (evidenceScore === null) {
      return {
        success: false,
        error:
          "لا يمكن إنشاء خطة استدامة: تعذّر حساب درجة المؤشر بشكل موثوق (لا توجد شواهد قابلة للقياس لهذا المؤشر في التقييم المحدد، أو لم يُحدد تقييم مرجعي). لم تُنشأ أي خطة.",
      }
    }
    if (evidenceScore < SUSTAINABILITY_THRESHOLD) {
      return {
        success: false,
        error: `لا يمكن إنشاء خطة استدامة: درجة المؤشر ${evidenceScore}% أقل من حد الاستدامة (${SUSTAINABILITY_THRESHOLD}%). يمكنك إنشاء خطة تحسين بدلًا من ذلك. لم تُنشأ أي خطة.`,
      }
    }
  }

  // (Task 22) منع تكرار إنشاء خطة من سياق الشواهد — القاعدة الضيقة الموثقة في
  // plan-context.ts: نفس المدرسة + الفرع + التقييم + المؤشر + النوع فقط.
  // تقييم مختلف (عام دراسي جديد) أو نوع مختلف = خطة منفصلة مشروعة لا تُمنع،
  // وخطط مسارات أخرى (savePlan/الفجوات بلا assessmentId) لا يدخلها الشرط أصلًا.
  // التكرار يُعالج بأمان: يُعاد معرف الخطة القائمة نفسها (سلوك idempotent)
  // بدل إنشاء نسخة ثانية — والواجهة تفتحها كم هي (إن كانت مسودة تبقى مسودة).
  // بلا assessmentId لا يُطبق التكرار إطلاقًا (لا يمكن إثبات «نفس السياق»).
  if (assessmentId) {
    const duplicate = await prisma.improvementPlan.findFirst({
      where: buildEvidencePlanDuplicateWhere({
        schoolId,
        branchId,
        assessmentId,
        indicatorId,
        kind,
      }),
      select: { id: true, kind: true, status: true, evidenceScore: true },
      orderBy: { createdAt: "desc" },
    })
    if (duplicate) {
      return { success: true, planId: duplicate.id, kind: duplicate.kind, status: duplicate.status, evidenceScore: duplicate.evidenceScore, alreadyExisted: true }
    }
  }

  const title = submittedTitle || (kind === "SUSTAINABILITY" ? `خطة استدامة — مؤشر ${indicator.code}` : `خطة تحسين — مؤشر ${indicator.code}`)

  // الحقول تُملأ من بيانات مخزنة قائمة فقط (كود/وصف/حالة مستهدفة للمؤشر) — لا محتوى مختلق.
  // targetDate: قيمة ابتدائية محايدة (سنة من اليوم) لأنه حقل إلزامي في الموديل،
  //   ويُعدَّل من مسار تعديل الخطة الحالي كما في أي خطة.
  const startDate = new Date()
  const targetDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000)

  const data: any = {
    title,
    description: indicator.description || null,
    gapId: gapId || null,
    indicatorId: indicatorId || null,
    // (Task 22) تخزين رابط التقييم — العمود قائم في السكيما (ImprovementPlan.assessmentId
    // بعلاقة SetNull) وكان يُترك null من هذا المسار؛ تخزينه هو ما يجعل حالة «تم
    // الإنشاء» قابلة للاسترجاع من قاعدة البيانات ومنع التكرار الضيق ممكنًا
    assessmentId: assessmentId || null,
    kind,
    evidenceScore,
    startDate,
    targetDate,
    status: "DRAFT",
    priority: "MEDIUM",
    objective: indicator.targetStatus || null,
    schoolId,
    branchId,
    createdById: user.id,
  }

  try {
    const plan = await prisma.improvementPlan.create({ data })

    revalidatePath("/school-manager/quality/improvement-plans")
    revalidatePath("/improvement-plans")
    return { success: true, planId: plan.id, kind, status: "DRAFT", evidenceScore }
  } catch (error) {
    console.error(error)
    throw new Error("حدث خطأ أثناء حفظ الخطة")
  }
}