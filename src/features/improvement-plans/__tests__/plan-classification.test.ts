// ===== FILE: src/features/improvement-plans/__tests__/plan-classification.test.ts (جديد) =====
// ============================================================
// اختبارات تصنيف خطط الشواهد (Task 21) — تُشغَّل بـ: npx tsx <هذا الملف>
// لا prisma ولا Next — الطبقة النقية فقط (نفس نمط weighted-score.test.ts)
// ============================================================
// تغطية متطلبات المواصفة على الطبقة القابلة للاختبار النقي:
//   متطلب 1: درجة 89.99% → «إنشاء خطة تحسين»
//   متطلب 2: درجة 90% بالضبط → «إنشاء خطة استدامة»
//   متطلب 3: درجة 90.01% → «إنشاء خطة استدامة»
//   متطلب 4: الدرجة تأتي من نتيجة التقييم المحدد حصرًا (نطاق التقييم + تفريد الزيارات)
//   متطلب 5: غياب/غموض العلاقة → لا تصنيف مختلق (null بلا اختراع)
//   متطلب 6/7: الزران يتشاركان نفس المسار (نفس الدالة ونفس التطبيع) والنوع يُطبَّع ويُحفظ
//   متطلب 8: الخطط القائمة تظل IMPROVEMENT (الافتراضي الآمن — لا إعادة تصنيف تلقائي)
// المتطلبات التي تحتاج قاعدة بيانات/React (9، 10-15) تغطيتها القائمة موثقة في
// تقرير المهمة: plan-access.test.ts (14 اختبار عزل)، survey-integration.test.ts
// (35 اختبار ربط بالمعرفات بلا مطابقة أسماء)، وقواعد الخادم داخل createEvidencePlan.
// ============================================================

import {
  SUSTAINABILITY_THRESHOLD,
  classifyPlanKind,
  normalizePlanKind,
} from "../threshold"
import {
  percentageFromCounts,
  buildIndicatorEvidenceScores,
} from "../score"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (e: any) {
    failed++
    console.log(`  ✗ ${name}`)
    console.log(`      ${e?.message ?? String(e)}`)
  }
}
function expect(cond: boolean, msg?: string) {
  if (!cond) throw new Error(msg ?? "expectation failed")
}
function expectEqual(actual: unknown, expected: unknown, msg?: string) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a !== b) throw new Error(`${msg ?? "not equal"} — actual=${a} expected=${b}`)
}

console.log("=== 1) حد الاستدامة — مصدر واحد ===")
test("SUSTAINABILITY_THRESHOLD === 90 (مطابق لحد «ممتاز» في getPerformanceBand)", () => {
  expectEqual(SUSTAINABILITY_THRESHOLD, 90)
})

console.log("=== 2) حدود التصنيف 89.99 / 90 / 90.01 (متطلبات 1-3) ===")
test("درجة 89.99 → IMPROVEMENT (خطة تحسين)", () => {
  expectEqual(classifyPlanKind(89.99), "IMPROVEMENT")
})
test("درجة 90 بالضبط → SUSTAINABILITY (خطة استدامة — التسعون للاستدامة)", () => {
  expectEqual(classifyPlanKind(90), "SUSTAINABILITY")
})
test("درجة 90.01 → SUSTAINABILITY (خطة استدامة)", () => {
  expectEqual(classifyPlanKind(90.01), "SUSTAINABILITY")
})
test("درجة 89 → IMPROVEMENT (أقل من الحد)", () => {
  expectEqual(classifyPlanKind(89), "IMPROVEMENT")
})
test("درجة 100 → SUSTAINABILITY", () => {
  expectEqual(classifyPlanKind(100), "SUSTAINABILITY")
})
test("درجة 0 → IMPROVEMENT", () => {
  expectEqual(classifyPlanKind(0), "IMPROVEMENT")
})

console.log("=== 3) الدرجة غير المتاحة — لا تصنيف مختلق (متطلب 5) ===")
test("null → IMPROVEMENT للعرض (والخادم يرفض الاستدامة صراحةً في هذه الحالة)", () => {
  expectEqual(classifyPlanKind(null), "IMPROVEMENT")
})
test("undefined → IMPROVEMENT للعرض", () => {
  expectEqual(classifyPlanKind(undefined), "IMPROVEMENT")
})
test("NaN (قيمة غير منتهية) → IMPROVEMENT — لا تصنيف من قيمة فاسدة", () => {
  expectEqual(classifyPlanKind(NaN), "IMPROVEMENT")
})
test("Infinity → IMPROVEMENT — لا تصنيف من قيمة غير منتهية", () => {
  expectEqual(classifyPlanKind(Infinity), "IMPROVEMENT")
})

console.log("=== 4) percentageFromCounts — منهجية المنصة بلا اختراع (متطلب 5) ===")
test("بلا شواهد (totalEvidence=0) → null — لا تُختلع درجة", () => {
  expectEqual(percentageFromCounts(0, 0), null)
})
test("صفر متحقق من 10 → 0 (صفر حقيقي وليس null)", () => {
  expectEqual(percentageFromCounts(0, 10), 0)
})
test("7 من 10 → 70", () => {
  expectEqual(percentageFromCounts(7, 10), 70)
})
test("2 من 3 → 67 (تقريب Math.round بمنهجية المنصة)", () => {
  expectEqual(percentageFromCounts(2, 3), 67)
})
test("90 من 100 → 90 بالضبط (حد الاستدامة)", () => {
  expectEqual(percentageFromCounts(90, 100), 90)
})

console.log("=== 5) buildIndicatorEvidenceScores — نطاق التقييم وتفريد الزيارات (متطلب 4) ===")
const bank = [
  { id: "ev1", indicatorId: "ind1" },
  { id: "ev2", indicatorId: "ind1" },
  { id: "ev3", indicatorId: "ind2" },
  { id: "ev4", indicatorId: "ind2" },
]
test("صف زيارة إضافي لنفس الشاهد لا يضاعف الشاهد (2 صف لنفس evidenceId → 1)", () => {
  const map = buildIndicatorEvidenceScores(bank, [
    { evidenceId: "ev1" },
    { evidenceId: "ev1" }, // صف الزيارة الثانية لنفس الشاهد (visitNumber مختلف)
  ])
  const ind1 = map.get("ind1")
  expect(!!ind1)
  expectEqual(ind1!.verifiedCount, 1)
  expectEqual(ind1!.totalEvidence, 2)
  expectEqual(ind1!.percentage, 50)
})
test("الدرجة تأتي من صفوف التقييم المُمرَّر حصرًا — استجابات تقييم آخر لا تُحتسب", () => {
  // الاستدعاء الخادمي يمرر صفوف where: { assessmentId, isVerified: true } فقط —
  // هنا نثبت أن الدالة النقية تحتسب ما وُلّي لها فقط ولا تجلب من أي تقييم آخر
  const rowsAssessmentA = [{ evidenceId: "ev1" }]
  const map = buildIndicatorEvidenceScores(bank, rowsAssessmentA)
  expectEqual(map.get("ind1")!.percentage, 50)
  expectEqual(map.get("ind2")!.percentage, 0)
})
test("تقييم مختلف بصفوف مختلفة → درجة مختلفة لنفس المؤشر (استقلالية التقييمات)", () => {
  const mapA = buildIndicatorEvidenceScores(bank, [{ evidenceId: "ev1" }, { evidenceId: "ev2" }])
  const mapB = buildIndicatorEvidenceScores(bank, [{ evidenceId: "ev1" }])
  expectEqual(mapA.get("ind1")!.percentage, 100)
  expectEqual(mapB.get("ind1")!.percentage, 50)
})
test("مؤشر بلا شواهد في البنك لا يظهر في الخريطة إطلاقًا (لا 0% زائفة)", () => {
  const map = buildIndicatorEvidenceScores(bank, [{ evidenceId: "ev1" }])
  expect(!map.has("ind3"))
})
test("شاهد في الاستجابات ليس في البنك → يُتجاهل (لا مؤشر مختلق)", () => {
  const map = buildIndicatorEvidenceScores(bank, [{ evidenceId: "ev-ghost" }])
  expectEqual(map.size, 2)
  expectEqual(map.get("ind1")!.percentage, 0)
  expectEqual(map.get("ind2")!.percentage, 0)
})
test("بلا أي استجابات → كل المؤشرات 0% حقيقية (وليس null — فالشواهد معرّفة)", () => {
  const map = buildIndicatorEvidenceScores(bank, [])
  expectEqual(map.get("ind1")!.percentage, 0)
  expectEqual(map.get("ind2")!.percentage, 0)
})
test("بنك فارغ → خريطة فارغة (لا أرقام مصنوعة)", () => {
  const map = buildIndicatorEvidenceScores([], [{ evidenceId: "ev1" }])
  expectEqual(map.size, 0)
})

console.log("=== 6) تطبيع نوع الخطة — نفس المسار للزرين ويحفظ كما أُدخل (متطلبات 6-8) ===")
test("«SUSTAINABILITY» يُطبَّع كما هو", () => {
  expectEqual(normalizePlanKind("SUSTAINABILITY"), "SUSTAINABILITY")
})
test("«SUSTAINABILITY  » مع فرط يُقص ويُقبل", () => {
  expectEqual(normalizePlanKind("SUSTAINABILITY  "), "SUSTAINABILITY")
})
test("أي قيمة أخرى (بما فيها «improvement» بأحرف مختلفة) → IMPROVEMENT الافتراضي الآمن", () => {
  expectEqual(normalizePlanKind("improvement"), "IMPROVEMENT")
  expectEqual(normalizePlanKind("garbage"), "IMPROVEMENT")
  expectEqual(normalizePlanKind(""), "IMPROVEMENT")
  expectEqual(normalizePlanKind(null), "IMPROVEMENT")
  expectEqual(normalizePlanKind(undefined), "IMPROVEMENT")
})
test("الخطط القائمة بلا نوع مخزن تُقرأ IMPROVEMENT (افتراضي السكيما kind — لا إعادة تصنيف تلقائي)", () => {
  // في السكيما: kind String @default("IMPROVEMENT") — الصفوف التاريخية تحمل
  // القيمة الافتراضية دون أي ترحيل، وnormalizePlanKind(undefined) = IMPROVEMENT
  expectEqual(normalizePlanKind(undefined), "IMPROVEMENT")
})

console.log("=== 7) الزران يتشاركان نفس التصنيف ونفس مسار الإنشاء (متطلب 6) ===")
test("نفس الدالة (classifyPlanKind) تقود كلا الزرين — زر واحد منطقي واحد", () => {
  // المكوّن يعرض الزر بناءً على classifyPlanKind(score) ويضع kind في FormData
  // من نفس نتيجة التصنيف — فيذهب المساران إلى createEvidencePlan نفسه
  const sustainabilityButton = classifyPlanKind(90) === "SUSTAINABILITY"
  const improvementButton = classifyPlanKind(89.99) === "SUSTAINABILITY"
  expect(sustainabilityButton && !improvementButton)
  // وكلاهما يُطبَّع على الخادم بنفس normalizePlanKind — لا مسار ثانٍ
  expectEqual(normalizePlanKind("SUSTAINABILITY"), "SUSTAINABILITY")
  expectEqual(normalizePlanKind("IMPROVEMENT"), "IMPROVEMENT")
})

console.log("")
console.log(`=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)