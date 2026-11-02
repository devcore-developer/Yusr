// ===== FILE: src/features/survey-integration/assessment-link.server.ts =====
// ============================================================
// assessment-link.server.ts — استعلامات ربط الاستبانات بالتقييم (الخادم حصرًا)
// ------------------------------------------------------------
// مبدأ العزل: كل استعلام هنا مقيد بمعرّف صريح (assessmentId أو schoolId من
// التقييم نفسه) — لا اعتماد على معرّف قادم من العميل دون تحقق، ولا مطابقة
// نصية، ولا استنتاج من التواريخ أو الأسماء.
//
// لماذا ملف مستقل؟ survey-integration.server.ts القائم يستهلكه القسم المجمد
// «تقارير المدرسة الشاملة» — تبقى دواله وتواقيعه وسلوكه كما هي حرفيًا،
// وكل ما هو خاص بالربط بالتقييم يعيش هنا (إضافي بحت، صفر مساس بالقسم المجمد).
// ============================================================

import { prisma } from "@/lib/prisma"
import type { LinkedSurveyInput } from "@/features/quality-reports/services/survey-integration"
import {
  groupSurveysByIndicator,
  isAssessmentInUserScope,
  type SurveyScopeActor,
} from "./assessment-link"

// ------------------------------------------------------------
// 1) التقييمات المرشحة للاختيار عند إنشاء استبانة — ضمن نطاق المستخدم فقط
// ------------------------------------------------------------

export interface EligibleAssessmentOption {
  id: string
  schoolId: string
  status: string
  stage: string | null
  startedAt: Date
  schoolName: string
  branchName: string | null
  academicYearLabel: string | null
}

/**
 * تقييمات ضمن نطاق المستخدم (نفس نطاق قائمة الاستبانات القائم حرفيًا:
 * SUPER_ADMIN → كل المدارس، وإلا مدرسته فقط) — لقائمة «التقييم المرتبط» الإلزامية.
 * المنتسب بلا مدرسة يرى قائمة فارغة → الصفحة تمنع الحفظ وتعرض رسالة واضحة.
 */
export async function getEligibleAssessmentsForUser(
  actor: SurveyScopeActor
): Promise<EligibleAssessmentOption[]> {
  // (حارس النطاق) المنتسب بلا مدرسة (schoolId = null) لا نطاق له أصلًا → قائمة
  // فارغة صريحة (السلوك الموثق أعلاه). ولا يُمرَّر null أبدًا إلى Prisma:
  // schoolId عمود مطلوب في Assessment فلا يقبل { schoolId: null } لا نوعيًا
  // (أنواع client الحقيقي ترفضها — AssessmentWhereInput.schoolId: string)
  // ولا تشغيليًا (PrismaClientValidationError).
  if (actor.role !== "SUPER_ADMIN" && actor.schoolId == null) return []

  // بعد الحارس أعلاه: null هنا لا تعني إلا SUPER_ADMIN (نطاق المنصة كاملة)،
  // وإلا فهو نص مدرسته المضمون — تضييق صريح على متغير محلي يرضي أنواع
  // Prisma بلا any ولا تأكيدات قهرية.
  const scopeSchoolId: string | null =
    actor.role === "SUPER_ADMIN" ? null : actor.schoolId

  const assessments = await prisma.assessment.findMany({
    where: scopeSchoolId === null ? {} : { schoolId: scopeSchoolId },
    select: {
      id: true,
      schoolId: true,
      status: true,
      stage: true,
      startedAt: true,
      school: { select: { name: true } },
      branch: { select: { name: true } },
      academicYear: { select: { label: true } },
    },
    orderBy: { startedAt: "desc" },
  })
  return assessments.map((a) => ({
    id: a.id,
    schoolId: a.schoolId,
    status: a.status,
    stage: a.stage,
    startedAt: a.startedAt,
    schoolName: a.school.name,
    branchName: a.branch?.name ?? null,
    academicYearLabel: a.academicYear?.label ?? null,
  }))
}

// ------------------------------------------------------------
// 2) حارس الخادم — التقييم المختار موجود وداخل نطاق المستخدم (قبل إنشاء/إسناد)
// ------------------------------------------------------------

export type AssessmentGuardResult =
  | { ok: true; assessment: { id: string; schoolId: string } }
  | { ok: false; error: string }

/**
 * التحقق الخادمي الوحيد المعتمد: التقييم موجود فعلًا وداخل نطاق المستخدم.
 * لا يُعتمد على معرّف قادم من العميل إطلاقًا إلا بعد هذا الفحص —
 * والرفض صريح برسالة عربية واضحة (تُعرض كما هي في الواجهة).
 */
export async function assertAssessmentForSurvey(
  assessmentId: string,
  actor: SurveyScopeActor
): Promise<AssessmentGuardResult> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, schoolId: true },
  })
  if (!assessment) {
    return { ok: false, error: "التقييم المحدد غير موجود." }
  }
  if (!isAssessmentInUserScope(actor, assessment.schoolId)) {
    return {
      ok: false,
      error: "التقييم المحدد خارج نطاقك المصرح به — لا يمكن ربط استبانة إلا بتقييم ضمن نطاق مدرستك.",
    }
  }
  return { ok: true, assessment: { id: assessment.id, schoolId: assessment.schoolId } }
}

// ------------------------------------------------------------
// 3) استبانات تقييم محدد مجمّعة بمعرّف البند — مدخل تقرير ذلك التقييم حصرًا
// ------------------------------------------------------------

/**
 * استبانات التقييم الواحد (بالعلاقة المخزّنة assessmentId فقط — لا استنتاج)
 * مرتبطة صراحةً ببنود، بنفس شكل خرائط survey-integration.server.ts تمامًا
 * ليدخل النتيجة إلى buildItemComparison دون أي تغيير في الاحتساب أو التنسيق.
 * العزل بالبناء: التقييم ينتمي لمدرسة واحدة، فاستباناته لا تختلط أبدًا
 * باستبانات أي تقييم آخر حتى لو كان لنفس المدرسة.
 */
export async function getAssessmentLinkedSurveysByIndicator(
  assessmentId: string
): Promise<Map<string, LinkedSurveyInput[]>> {
  const surveys = await prisma.survey.findMany({
    where: { assessmentId, indicatorId: { not: null } },
    select: {
      id: true,
      type: true,
      percentage: true,
      respondents: true,
      include: true,
      indicatorId: true,
    },
    orderBy: { createdAt: "asc" },
  })
  return groupSurveysByIndicator(surveys)
}