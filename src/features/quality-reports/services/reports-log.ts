// ===== FILE: src/features/quality-reports/services/reports-log.ts =====
// ============================================================
// reports-log — حسابات ملخص «سجل التقارير» (وحدة نقية بلا prisma)
// ============================================================
// (إعادة تصميم القسم الأول من تقارير مدير النظام)
//
// هذه الوحدة لا تخترع أي معادلة جديدة:
//  - درجة كل تقييم = نفس المعادلة المعتمدة على الصفحة حرفيًا:
//        round(الشواهد المتحققة المميزة / إجمالي بنك الشواهد × 100)
//    (نفس دلالة countDistinctVerifiedEvidence التي تحسب الصفوف المعروضة —
//     هنا تُطبق على أزواج {التقييم، الشاهد} القادمة من groupBy على مستوى
//     قاعدة البيانات لتغطية كل النطاق وليس أول 200 صف فقط).
//  - متوسط النطاق = متوسط درجات التقييمات المكتملة فقط (نفس نمط التجميع
//    المعتمد في calculateSchoolPerformance على الصفحة).
//  - «تحتاج إلى تحسين» = مكتملة درجتها (المقرَّبة المعروضة) أقل من الحد
//    المعتمد SUSTAINABILITY_THRESHOLD من threshold.ts (المصدر الواحد للحد
//    90% في المشروع) — بلا أي حد جديد.
//  - التقييمات الجارية لا تُعتبر نتائج مكتملة: لا تدخل المتوسط ولا عدّاد
//    «تحتاج إلى تحسين» — تُعَدّ فقط في عدادات الحالة.
// ============================================================

import { SUSTAINABILITY_THRESHOLD } from "@/features/improvement-plans/threshold"

/** زوج شاهد متحقق — ناتج groupBy(assessmentId, evidenceId) على مستوى قاعدة البيانات */
export interface VerifiedPairRow {
  assessmentId: string
  evidenceId: string
}

/** صف حالة تقييم — الحد الأدنى اللازم لحساب العدادات (id + status) */
export interface AssessmentStatusRow {
  id: string
  status: string
}

/**
 * عدد الشواهد المتحققة المميزة لكل تقييم — نفس دلالة countDistinctVerifiedEvidence
 * (Set على معرفات الشواهد) لكن على أزواج مجموعة مسبقًا من قاعدة البيانات.
 * التكرار (زيارات الملاحظة الصفية لنفس الشاهد) لا يُعدّ أكثر من مرة.
 */
export function countDistinctVerifiedByAssessment(
  pairs: VerifiedPairRow[]
): Map<string, number> {
  const byAssessment = new Map<string, Set<string>>()
  for (const pair of pairs) {
    let set = byAssessment.get(pair.assessmentId)
    if (!set) {
      set = new Set<string>()
      byAssessment.set(pair.assessmentId, set)
    }
    set.add(pair.evidenceId)
  }
  const counts = new Map<string, number>()
  for (const [assessmentId, set] of byAssessment) {
    counts.set(assessmentId, set.size)
  }
  return counts
}

/**
 * درجة تحقق الشواهد لتقييم واحد — نفس معادلة الصفحة المعتمدة حرفيًا.
 * مقام صفر (بنك فارغ) → 0 كما في الصفحة تمامًا.
 */
export function assessmentVerificationScore(
  verifiedCount: number,
  totalEvidence: number
): number {
  if (totalEvidence <= 0) return 0
  return Math.round((verifiedCount / totalEvidence) * 100)
}

/** نتيجة ملخص سجل التقارير — أرقام تُعرض في بطاقات KPI فوق القائمة */
export interface ReportsLogKpis {
  /** إجمالي التقييمات المطابقة للفلاتر (نطاق القائمة بالضبط بما فيه فلتر الحالة) */
  total: number
  /** المكتمل منها */
  completed: number
  /** الجاري منها (لا تُحسب نتيجة نهائية بأي شكل) */
  inProgress: number
  /**
   * متوسط نسبة التحقق — من التقييمات المكتملة فقط.
   * null = لا يوجد أي تقييم مكتمل في النطاق (لا يُختلق رقم).
   */
  avgVerification: number | null
  /** عدد المكتمل الذي دخلت درجته الحساب (مقام المتوسط — للعرض) */
  scoredCompleted: number
  /** المكتمل التي درجتها المقرَّبة أقل من الحد المعتمد (90%) */
  needsImprovement: number
  /** عدد الخطط المرتبطة بالتقييمات المطابقة (علاقة assessmentId الفعلية) */
  linkedPlans: number
}

export interface ReportsLogKpisInput {
  /** كل التقييمات المطابقة لنطاق القائمة (id + status) */
  statuses: AssessmentStatusRow[]
  /** أزواج الشواهد المتحققة لكل التقييمات المطابقة (من groupBy) */
  verifiedPairs: VerifiedPairRow[]
  /** إجمالي بنك الشواهد الثابت — نفس المقام المعتمد على الصفحة */
  totalEvidence: number
  /** عدد الخطط المرتبطة بالتقييمات المطابقة — يُحسب على الخادم بعلاقة assessmentId */
  linkedPlans: number
  /** الحد المعتمد — يُترك افتراضيًا لـ SUSTAINABILITY_THRESHOLD (لا حد جديد) */
  threshold?: number
}

/**
 * حساب ملخص سجل التقارير من المصدر الواحد — بلا أي معادلة جديدة:
 * نفس درجة الصفحة + نفس نمط متوسطها + الحد المعتمد الوحيد.
 */
export function computeReportsLogKpis(input: ReportsLogKpisInput): ReportsLogKpis {
  const threshold =
    typeof input.threshold === "number" && Number.isFinite(input.threshold)
      ? input.threshold
      : SUSTAINABILITY_THRESHOLD

  let completed = 0
  let inProgress = 0
  for (const row of input.statuses) {
    if (row.status === "COMPLETED") completed++
    else if (row.status === "IN_PROGRESS") inProgress++
  }

  const verifiedByAssessment = countDistinctVerifiedByAssessment(input.verifiedPairs)

  let scoreSum = 0
  let scoredCompleted = 0
  let needsImprovement = 0
  for (const row of input.statuses) {
    // الجارية ليست نتيجة مكتملة — تُستثنى من المتوسط والعدّاد كليًا
    if (row.status !== "COMPLETED") continue
    const verified = verifiedByAssessment.get(row.id) ?? 0
    const score = assessmentVerificationScore(verified, input.totalEvidence)
    scoreSum += score
    scoredCompleted++
    if (score < threshold) needsImprovement++
  }

  const avgVerification =
    scoredCompleted > 0 ? Math.round(scoreSum / scoredCompleted) : null

  return {
    total: input.statuses.length,
    completed,
    inProgress,
    avgVerification,
    scoredCompleted,
    needsImprovement,
    linkedPlans: input.linkedPlans,
  }
}