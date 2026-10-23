// ===== FILE: src/features/improvement-plans/score.ts (جديد) =====
// ============================================================
// score.ts — الطبقة النقية لدرجات الشواهد على مستوى المؤشر
// (Task 21 — استخراج إضافي فقط: نفس المنطق الذي كان داخل queries.ts
//  أصبح هنا في وحدة نقية بلا أي اعتماديات — server/client آمنة وقابلة
//  للاختبار الآلي المباشر بلا prisma ولا Next — نفس نمط threshold.ts)
// ============================================================
// المنهجية لم تُلمس: درجة المؤشر = Math.round(المتحقق المميز ÷ شواهد المؤشر × 100)
// وبلا شواهد → null (لا أرقام مصنوعة) — نفس قاعدة جداول المجالات.

/** نتيجة درجة مؤشر واحد داخل تقييم محدد */
export interface IndicatorEvidenceScore {
  indicatorId: string
  /** عدد الشواهد المميزة المتحققة (distinct evidenceId — صف الزيارة الإضافي لنفس الشاهد لا يضاعفه) */
  verifiedCount: number
  /** إجمالي الشواهد الثابتة للمؤشر */
  totalEvidence: number
  /** النسبة 0-100، أو null إذا لم يكن للمؤشر شواهد (لا تُختلع درجة) */
  percentage: number | null
}

/**
 * نقي: النسبة من العدّادات الجاهزة — منهجية المنصة حرفيًا:
 *   Math.round(المتحقق ÷ الإجمالي × 100).
 * لا شواهد (totalEvidence = 0) → null — لا تُختلع درجة (نفس قاعدة جداول
 * المجالات: «بند بلا شواهد معرّفة → null بلا اختراع»).
 */
export function percentageFromCounts(verifiedCount: number, totalEvidence: number): number | null {
  if (totalEvidence === 0) return null
  return Math.round((verifiedCount / totalEvidence) * 100)
}

/**
 * نقي: بناء خريطة درجات المؤشرات من صفوف جاهزة —
 * نفس جسم getIndicatorEvidenceScores حرفيًا (استُخرج ليكون قابلًا للاختبار
 * الآلي مباشرة: تفريد الشواهد + احترام نطاق التقييم الوارد + بلا أرقام مصنوعة).
 * الاستدعاء الخادمي (getIndicatorEvidenceScores في queries.ts) هو من يُمرّر
 * صفوف تقييم محدد حصرًا (where: { assessmentId, isVerified: true }) — فالنطاق
 * يُفرض في استعلام SQL قبل وصول الصفوف هنا، والدالة تحتسب ما وُلّي لها فقط.
 * قراءة فقط — لا تكتب ولا تغير أي بيانات.
 */
export function buildIndicatorEvidenceScores(
  bank: { id: string; indicatorId: string }[],
  verifiedResponses: { evidenceId: string }[]
): Map<string, IndicatorEvidenceScore> {
  const evidenceIndicator = new Map(bank.map((e) => [e.id, e.indicatorId]))

  const totals = new Map<string, number>()
  for (const e of bank) {
    totals.set(e.indicatorId, (totals.get(e.indicatorId) ?? 0) + 1)
  }

  // (إصلاح التضخم) تفريد معرفات الشواهد أولاً — صف زيارة إضافي لنفس الشاهد
  // (visitNumber 1..7) لا يُعدّ شاهدًا جديدًا
  const verifiedEvidenceIds = Array.from(new Set(verifiedResponses.map((r) => r.evidenceId)))

  const verified = new Map<string, number>()
  for (const evidenceId of verifiedEvidenceIds) {
    const indicatorId = evidenceIndicator.get(evidenceId)
    if (indicatorId) {
      verified.set(indicatorId, (verified.get(indicatorId) ?? 0) + 1)
    }
  }

  const result = new Map<string, IndicatorEvidenceScore>()
  // Array.from: التكرار فوق مصفوفة يترجم سليمًا مع target أقدم من ES2015 دون
  // downlevelIteration (تكرار Map مباشرةً يرمي TS2802) — نفس الترتيب والدلالة
  for (const [indicatorId, totalEvidence] of Array.from(totals)) {
    const verifiedCount = verified.get(indicatorId) ?? 0
    result.set(indicatorId, {
      indicatorId,
      verifiedCount,
      totalEvidence,
      percentage: percentageFromCounts(verifiedCount, totalEvidence),
    })
  }

  return result
}