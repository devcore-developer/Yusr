// ===== FILE: src/features/survey-integration/assessment-link.ts =====
// ============================================================
// assessment-link.ts — ربط الاستبانات بالتقييم: وحدات نقية بلا أي استيراد خادم
// ------------------------------------------------------------
// المهمة: كل استبانة تخص تقييمًا واحدًا محددًا — علاقة مخزّنة بمعرّف مستقر
// (Survey.assessmentId)، لا مطابقة نصية ولا تواريخ ولا استنتاج بأسماء المدارس.
//
// القواعد الملزمة:
//   1) الاختيار إلزامي لكل استبانة جديدة — تُرفض الاستبانة بلا تقييم (خادميًا وأولًا).
//   2) النطاق: مدير النظام أي مدرسة؛ وبقية الأدوار مدرستهم فقط (نفس نطاق صفحة
//      الاستبانات القائم حيث: SUPER_ADMIN → {} وإلا { schoolId: user.schoolId }).
//   3) الاستبانات التاريخية (assessmentId = null) تنجو كما هي — لا ربط صامت أبدًا.
//   4) التجميع بمعرّف البند يخرج من هذه الوحدة حصريًا (مصدر واحد للحقيقة) وبنفس
//      دلالات الحلقة القائمة في survey-integration.server.ts — لا اختلاف سلوك.
//   5) وحدات نقية فقط هنا — كل استعلام Prisma في assessment-link.server.ts المجاور.
// ============================================================

import type { LinkedSurveyInput } from "@/features/quality-reports/services/survey-integration"
import { getStageLabel } from "@/lib/stages"

// ------------------------------------------------------------
// نطاق اختيار التقييم (إنشاء استبانة) — نفس نطاق صفحة الاستبانات القائم حرفيًا
// ------------------------------------------------------------

export interface SurveyScopeActor {
  role: string
  schoolId: string | null
}

/**
 * هل يحق للمستخدم اختيار هذا التقييم عند إنشاء استبانة؟
 * مدير النظام: أي تقييم (نطاقه المنصة كاملة مثل قائمة الاستبانات لديه).
 * بقية الأدوار: تقييمات مدرستهم فقط — والمنتسب بلا مدرسة لا يرى شيئًا.
 * (ملاحظة: بوابة إدارة إعادة الإسناد في الأكشنات أشد — SA/مدير المدرسة فقط،
 *  كما هي في linkSurveyToIndicator — لا تغيير على الصلاحيات القائمة).
 */
export function isAssessmentInUserScope(actor: SurveyScopeActor, assessmentSchoolId: string): boolean {
  if (actor.role === "SUPER_ADMIN") return true
  return !!actor.schoolId && actor.schoolId === assessmentSchoolId
}

// ------------------------------------------------------------
// الإلزامية — لا استبانة بلا تقييم مرتبط
// ------------------------------------------------------------

export type AssessmentChoiceCheck = { ok: true } | { ok: false; reason: string }

/** رسالة الرفض الموحدة لغياب الاختيار — تُستخدم خادميًا وتُعرض كما هي في الواجهة */
export const ASSESSMENT_REQUIRED_MESSAGE =
  "اختيار التقييم المرتبط مطلوب — لا يمكن حفظ الاستبانة بدون تقييم محدد."

/** التحقق الإلزامي من وجود معرّف التقييم — الفارغ/الفراغات = رفض صريح (ليس تجاهلًا) */
export function requireAssessmentChoice(assessmentId: string | null | undefined): AssessmentChoiceCheck {
  if (!assessmentId || assessmentId.trim() === "") {
    return { ok: false, reason: ASSESSMENT_REQUIRED_MESSAGE }
  }
  return { ok: true }
}

// ------------------------------------------------------------
// التجميع بمعرّف البند — نفس دلالات survey-integration.server.ts القائمة
// ------------------------------------------------------------

/** صف الاستبانة كما يقرأه الخادم — indicatorId غير فارغ يُجمَّع، والفارغ يُتخطى */
export interface SurveyRowForGrouping {
  id: string
  type: string
  percentage: number
  respondents: number | null
  include: boolean
  indicatorId: string | null
}

/**
 * تجميع الاستبانات بمعرّف البند المستقر — مدخل buildItemComparison الوحيد.
 * دلالات مطابقة للحلقة القائمة (نفس الترتيب، لا احتساب، لا تخمين):
 * أي صف بلا indicatorId صريح لا يدخل الخريطة إطلاقًا.
 */
export function groupSurveysByIndicator(rows: readonly SurveyRowForGrouping[]): Map<string, LinkedSurveyInput[]> {
  const map = new Map<string, LinkedSurveyInput[]>()
  for (const s of rows) {
    if (!s.indicatorId) continue // حصانة مطابقة للقائمة — لا يُحتسب أي سجل بلا رابط صريح
    const list = map.get(s.indicatorId) ?? []
    list.push({
      id: s.id,
      type: s.type,
      percentage: s.percentage,
      respondents: s.respondents,
      include: s.include,
    })
    map.set(s.indicatorId, list)
  }
  return map
}

// ------------------------------------------------------------
// التسميات — واجهة عربية RTL (لغة المنصة) مع أسماء قد تكون إنجليزية
// ------------------------------------------------------------

/** تسمية حالة التقييم بالعربية — نفس قيم enum AssessmentStatus */
export function assessmentStatusLabelAr(status: string): string {
  switch (status) {
    case "COMPLETED": return "مكتمل"
    case "IN_PROGRESS": return "قيد التنفيذ"
    case "NOT_STARTED": return "لم يبدأ"
    default: return status
  }
}

/** شارة السجل التاريخي — الاستبانة بلا تقييم مخزّن (لا يُختلع لها رابط) */
export const HISTORICAL_SURVEY_ASSESSMENT_LABEL = "غير مرتبطة بتقييم (سجل تاريخي)"

/** بند منسدل للتقييم داخل نطاق المستخدم — كما تُعرض في صفحة الاستبانات */
export interface AssessmentOptionInput {
  id: string
  schoolId: string
  status: string
  stage: string | null
  startedAt: string | Date
  schoolName: string
  branchName?: string | null
  academicYearLabel?: string | null
}

export interface AssessmentOptionView {
  value: string
  label: string
  /** لتحكم إعادة الإسناد: خيارات كل استبانة تُقيَّد بمدرسة الاستبانة نفسها */
  schoolId: string
}

/** تنسيق التاريخ بنفس اتفاقية صفحة الاستبانات القائمة (ar-EG) */
export function formatAssessmentDateAr(d: string | Date): string {
  return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })
}

/**
 * سطر خيارات التقييم في القائمة المنسدلة — تفاصيل معبّرة كما طلبت المهمة:
 * المدرسة (والقسم إن وجد) • المرحلة • العام الدراسي • الحالة • تاريخ البدء.
 * يعمل مع أسماء مدارس عربية أو إنجليزية (RTL مع محتوى لاتيني دون انكسار).
 */
export function buildAssessmentOption(a: AssessmentOptionInput): AssessmentOptionView {
  const parts = [
    a.branchName ? `${a.schoolName} — ${a.branchName}` : a.schoolName,
    `المرحلة: ${getStageLabel(a.stage)}`,
    a.academicYearLabel ? `العام الدراسي ${a.academicYearLabel}` : null,
    assessmentStatusLabelAr(a.status),
    formatAssessmentDateAr(a.startedAt),
  ].filter((p): p is string => p !== null)
  return { value: a.id, label: parts.join(" • "), schoolId: a.schoolId }
}

/** سطر مختصر لشارة القائمة: المرحلة — الحالة — التاريخ */
export function buildAssessmentShortLabel(a: Pick<AssessmentOptionInput, "status" | "stage" | "startedAt">): string {
  return `${getStageLabel(a.stage)} — ${assessmentStatusLabelAr(a.status)} — ${formatAssessmentDateAr(a.startedAt)}`
}