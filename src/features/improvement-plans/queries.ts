// ===== FILE: src/features/improvement-plans/queries.ts =====
import { prisma } from "@/lib/prisma"
import { SUSTAINABILITY_THRESHOLD as _SUSTAINABILITY_THRESHOLD } from "./threshold"
import { percentageFromCounts, buildIndicatorEvidenceScores, type IndicatorEvidenceScore } from "./score"

/**
 * حد إنشاء خطة الاستدامة — معرّف في ./threshold (مصدر واحد) ويُعاد تصديره هنا
 * لمستهلكي الخادم. لا تعدّل القيمة إلا في threshold.ts.
 */
export const SUSTAINABILITY_THRESHOLD = _SUSTAINABILITY_THRESHOLD

/**
 * (Task 21) الطبقة النقية لدرجات الشواهد تُعرَّف في ./score (نقية بلا prisma —
 * قابلة للاختبار الآلي مباشرة) وتُعاد تصديرها هنا ليبقى مسار الاستيراد القائم
 * (queries) صالحًا لأي مستهلك دون أي تغيير.
 */
export { percentageFromCounts, buildIndicatorEvidenceScores } from "./score"
export type { IndicatorEvidenceScore } from "./score"

/**
 * ============================================================
 * Task 16 — درجات الشواهد على مستوى المؤشر + حد الاستدامة
 * ============================================================
 *
 * مصدر الدرجة الموثوق في المنصة (لم يُلمس ولم يُغيّر):
 *   درجة التقييم = عدد استجابات الشواهد المتحققة (isVerified=true) ÷ إجمالي الشواهد الثابتة،
 *   بالتقريب Math.round — كما في quality-assessment/services/analysis.ts وتقارير المقارنة.
 *
 * هذه الوحدة تشتق من نفس المنهجية درجةً على مستوى المؤشر الواحد داخل تقييم محدد
 * (المتأثر ÷ شواهد ذلك المؤشر). لم يكن للمنصة أي درجة على مستوى المؤشر قبل ذلك،
 * لذلك هذه إضافة جديدة لا تستبدل أي صيغة قائمة ولا تغير أي حساب قائم.
 *
 * قاعدة الحد 90%: مطابقة لحد «ممتاز» في getPerformanceBand (90/75/50) —
 * مصدر واحد للحقيقة هنا حتى لا تتفرق القيمة بين الصفحات والإجراءات.
 */

/**
 * درجة مؤشر واحد داخل تقييم واحد — يُستدعى من الخادم حصرًا (إجراء الإنشاء).
 * تُعيد null عندما يتعذر الحساب الموثوق (لا شواهد للمؤشر) — والقاعدة:
 * بلا درجة موثوقة لا تُنشأ خطة استدامة، ولا تُختلع أي قيمة.
 */
export async function computeIndicatorEvidenceScore(
  assessmentId: string,
  indicatorId: string
): Promise<number | null> {
  const totalEvidence = await prisma.fixedEvidence.count({ where: { indicatorId } })
  if (totalEvidence === 0) return null

  // (إصلاح التضخم) شواهد مميزة متحققة — صف زيارة إضافي لنفس الشاهد لا يضاعفه
  // (قيود visitNumber تجعل للشاهد صفًا لكل زيارة 1..7) — فتبقى الدرجة ضمن 0-100
  const verifiedRows = await prisma.evidenceResponse.findMany({
    where: {
      assessmentId,
      isVerified: true,
      evidence: { indicatorId },
    },
    select: { evidenceId: true },
    distinct: ["evidenceId"],
  })
  const verifiedCount = verifiedRows.length

  return percentageFromCounts(verifiedCount, totalEvidence)
}

/**
 * خريطة درجات كل المؤشرات التي لها شواهد داخل تقييم واحد — لصفحات العرض.
 * المؤشرات بلا شواهد ثابتة لا تظهر في الخريطة (درجتها غير قابلة للتحديد → null لدى المستهلك).
 * قراءة فقط — لا تكتب ولا تغير أي بيانات.
 */
export async function getIndicatorEvidenceScores(
  assessmentId: string
): Promise<Map<string, IndicatorEvidenceScore>> {
  const [bank, verifiedResponses] = await Promise.all([
    prisma.fixedEvidence.findMany({ select: { id: true, indicatorId: true } }),
    prisma.evidenceResponse.findMany({
      where: { assessmentId, isVerified: true },
      select: { evidenceId: true },
    }),
  ])

  return buildIndicatorEvidenceScores(bank, verifiedResponses)
}

/**
 * أكواد/أوصاف مؤشرات بقائمة معرفات — لعرض «مرتبط بمؤشر …» في صفحات الخطط
 * عندما لا يكون للخطة فجوة (ImprovementPlan.indicatorId عمود قائم بلا علاقة Prisma).
 * قراءة فقط.
 */
export async function getIndicatorLabels(indicatorIds: string[]): Promise<Map<string, { code: string; description: string }>> {
  const ids = Array.from(new Set(indicatorIds.filter(Boolean)))
  if (ids.length === 0) return new Map()

  const indicators = await prisma.indicator.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, description: true },
  })

  return new Map(indicators.map((i) => [i.id, { code: i.code, description: i.description }]))
}