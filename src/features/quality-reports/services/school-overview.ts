// ===== FILE: src/features/quality-reports/services/school-overview.ts =====
// ============================================================
// school-overview.ts — الطبقة النقية لملخص أداء المدارس (لوحة مدير النظام)
// ============================================================
// PURE module (بلا أي اعتماديات خادمية — قابلة للاختبار المباشر بلا prisma
// ولا Next — نفس نمط weighted-score.ts و score.ts).
//
// الغرض: مصدر واحد لحساب ملخص كل مدرسة في لوحة مدير النظام، مبني حصريًا فوق
// المنهجية الرسمية المُختبَرة في weighted-score.ts:
//   - درجة كل تقييم = computeAssessmentWeightedResult (تفريد الشواهد داخليًا
//     عبر distinctVerifiedEvidenceRows — صفوف زيارات الملاحظة الصفية المتعددة
//     لنفس الشاهد لا تُعدّ أكثر من مرة — إصلاح التضخم حتى 700%).
//   - درجة المدرسة = متوسط النتائج المرجحة للتقييمات المستقلة
//     (averageWeightedOveralls) — لا دمج صفوف عبر التقييمات إطلاقًا.
//   - درجات المجالات = aggregateDomainScores (متوسط درجات كل مجال المستقلة
//     0–100 قبل الأوزان) — الأوزان الرسمية (20/30/40/10) تُطبَّق مرة واحدة
//     داخل computeWeightedOverall فقط، ولا يُعرض «حصّة المجال المرجحة»
//     كنسبة المجال أبدًا (العيب الذي كان يولّد 449%/663%/511%/425%:
//     عرض score×0.2 … score×0.1 كأنها نسب المجالات).
//   - تغطية الشواهد (اتحاد المميز المتحقق ÷ إجمالي البنك) حقل مستقل مفصول
//     تمامًا عن الدرجة المرجحة الرسمية — لا يُخلط ولا يُستبدل بها.
//
// قواعد عدم الاختلاق (نفس قواعد المنصة):
//   - مدرسة بلا تقييم مكتمل → overallScore = null و evidenceCoverage = null
//     (لا صفر مصنوع، ولا نسبة مختلقة) — الواجهة تعرض «غير مقيم».
//   - مجال بلا شواهد معرّفة → درجته null داخل القائمة.
//   - تقييم مكتمل تعذّرت نتيجته المرجحة (مجال ناقص) → يُستبعد من المتوسط
//     ويُوثَّق عدد المستبعد (skipped) بشفافية.
// ============================================================

import {
  aggregateDomainScores,
  averageWeightedOveralls,
  classifyPerformance,
  computeAssessmentWeightedResult,
  countDistinctVerifiedEvidence,
  type EvidenceRowInput,
  type OfficialDomainInput,
  type PerformanceLevel,
} from "./weighted-score"
import { percentageFromCounts } from "@/features/improvement-plans/score"

// ------------------------------------------------------------
// مدخلات هيكلية دنيا (مطابقة لأشكال استعلامات prisma القائمة — لا إعادة تعريف)
// ------------------------------------------------------------

/** بيانات المدرسة الظاهرة على البطاقة (من جدول School) */
export interface SchoolMetaInput {
  id: string
  name: string
  nameEn?: string | null
  logoUrl?: string | null
  status?: string | null
}

/** تقييم مكتمل داخل نطاق المدرسة — صفوفه المتحققة فقط كما يمررها المحمّل الخادمي */
export interface SchoolCompletedAssessmentInput {
  id: string
  /** ISO string أو null — أحدث تاريخ إتمام هو من يُعرض */
  completedAt: string | null
  /** صفوف EvidenceResponse المتحققة لهذا التقييم حصرًا (النطاق يُفرض في SQL) */
  evidenceResponses: EvidenceRowInput[]
}

/** إطار التقويم الرسمي + حجم البنك (مصدر واحد لكل المدارس — يُقرأ مرة واحدة) */
export interface SchoolFrameworkInput {
  officialDomains: OfficialDomainInput[]
  /** إجمالي الشواهد الثابتة في البنك (prisma.fixedEvidence.count()) */
  totalBankEvidence: number
}

// ------------------------------------------------------------
// نتيجة الملخص
// ------------------------------------------------------------

export interface SchoolDomainScore {
  name: string
  /** الوزن الرسمي 0–1 أو null لمجال خارج الأوزان الرسمية */
  weight: number | null
  /** درجة المجال المستقلة 0–100 (قبل الأوزان) أو null إن لم تُحتسب */
  score: number | null
}

export interface SchoolPerformanceSummary {
  schoolId: string
  name: string
  nameEn: string | null
  logoUrl: string | null
  schoolStatus: string | null
  /** true فقط عندما وُجدت نتيجة مرجحة صالحة — لا تُعرض درجة غير ذلك */
  hasScore: boolean
  /** الدرجة المرجحة الرسمية 0–100 (متوسط التقييمات المستقلة) أو null */
  overallScore: number | null
  classification: PerformanceLevel | null
  /** درجات المجالات المستقلة 0–100 قبل الأوزان (أو null لكل مجال بلا بيانات) */
  domains: SchoolDomainScore[]
  /**
   * تغطية الشواهد المميزة المتحققة عبر التقييمات المكتملة ÷ إجمالي البنك (0–100)
   * — مؤشر اعتماد أدلة مستقل لا يُخلط بالدرجة المرجحة. null بلا تقييم مكتمل
   * أو بلا بنك شواهد.
   */
  evidenceCoverage: number | null
  completedCount: number
  inProgressCount: number
  /** تقييمات مكتملة استُبعدت من المتوسط لعدم إمكان احتساب نتيجتها المرجحة */
  skippedAssessments: number
  /** أحدث تاريخ إتمام (ISO) أو null */
  latestCompletedAt: string | null
}

// ------------------------------------------------------------
// الحساب — مصدر واحد لبطاقات اللوحة وصفحة «عرض جميع المدارس» وصفحة التفاصيل
// ------------------------------------------------------------

export function buildSchoolPerformanceSummary(
  school: SchoolMetaInput,
  completedAssessments: SchoolCompletedAssessmentInput[],
  inProgressCount: number,
  framework: SchoolFrameworkInput
): SchoolPerformanceSummary {
  // درجة كل تقييم مستقلة (تفريد الشواهد داخليًا — لا تضخيم من صفوف الزيارات)
  const results = completedAssessments.map(a =>
    computeAssessmentWeightedResult(framework.officialDomains, a.evidenceResponses)
  )

  // متوسط النتائج المرجحة المستقلة — منهجية المنصة نفسها (لا دمج صفوف)
  const overallAgg = averageWeightedOveralls(results)
  const domains = aggregateDomainScores(results)
  const classification = classifyPerformance(overallAgg.average)

  // تغطية الشواهد: اتحاد المميز عبر كل التقييمات المكتملة ÷ إجمالي البنك
  // (الاتحاد المميز لا يجمع الصفوف — بنيويًا لا يتخطى 100%)
  // بلا تقييمات مكتملة → null (لا صفر مضلل — قاعدة عدم الاختلاق نفسها للدرجة)
  const allRows = completedAssessments.reduce<EvidenceRowInput[]>(
    (acc, a) => acc.concat(a.evidenceResponses),
    []
  )
  const distinctVerified = countDistinctVerifiedEvidence(allRows)
  const evidenceCoverage =
    completedAssessments.length === 0
      ? null
      : percentageFromCounts(distinctVerified, framework.totalBankEvidence)

  // أحدث إتمام — مقارنة نصية سليمة لأن القيم ISO 8601 موحدة التنسيق
  let latestCompletedAt: string | null = null
  for (const a of completedAssessments) {
    if (a.completedAt && (latestCompletedAt === null || a.completedAt > latestCompletedAt)) {
      latestCompletedAt = a.completedAt
    }
  }

  return {
    schoolId: school.id,
    name: school.name,
    nameEn: school.nameEn ?? null,
    logoUrl: school.logoUrl ?? null,
    schoolStatus: school.status ?? null,
    hasScore: overallAgg.average !== null,
    overallScore: overallAgg.average,
    classification,
    domains,
    evidenceCoverage,
    completedCount: completedAssessments.length,
    inProgressCount,
    skippedAssessments: overallAgg.skipped,
    latestCompletedAt,
  }
}

/**
 * ترتيب عربي ثابت (localeCompare «ar») — نفس الترتيب في اللوحة المختصرة
 * وصفحة «عرض جميع المدارس» حتى لا تقفز البطاقات بين الصفحتين.
 */
export function sortSchoolSummaries<T extends { name: string }>(summaries: T[]): T[] {
  return [...summaries].sort((a, b) => a.name.localeCompare(b.name, "ar"))
}

/** عدد بطاقات المدارس المعروض في اللوحة الرئيسية قبل زر «عرض جميع المدارس» */
export const DASHBOARD_SCHOOL_CARD_LIMIT = 8

/** أول N مدرسة بعد الترتيب — المجموعة الابتدائية للوحة الرئيسية */
export function selectDashboardSubset<T>(sorted: T[], limit: number = DASHBOARD_SCHOOL_CARD_LIMIT): T[] {
  return sorted.slice(0, Math.max(0, limit))
}