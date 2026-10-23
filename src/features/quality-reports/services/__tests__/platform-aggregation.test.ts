// ===== FILE: src/features/quality-reports/services/__tests__/platform-aggregation.test.ts =====
// (جديد)

// ============================================================
// اختبارات تجميع نسب تغطية المنصة (Task 2 من مواصفة النسب فوق 100%)
// تُشغَّل بـ: npx tsx <هذا الملف> — وحدات نقية فقط، بلا قاعدة بيانات
// ============================================================
// الخلفية: تقرير المستخدم عن نسب 400%/500% في لوحة المدير العام. الصيغة
// الخادمية السليمة في getPlatformAnalytics (analytics.ts) تحسب التغطية
// من «اتحاد معرفات الشواهد المتحققة عبر كل التقييمات» فوق إجمالي البنك:
//     coverage = Math.round(|distinct union(evidenceId)| ÷ totalBank × 100)
// وهذه الاختبارات تثبت أن النظير النقي (buildIndicatorEvidenceScores +
// percentageFromCounts — نفس منهجية التفريد) لا يتخطى 100% مهما تعددت
// التقييمات أو تكررت صفوف الزيارات — أي أن الجمع فوق التقييمات أو فوق
// الصفوف هو العيب الوحيد الممكن، ويجب ألا يدخل أي حساب نسبة.
// القاعدة المعاكسة الموثقة أيضًا: درجة كل تقييم تبقى منفصلة بمقامه الخاص
// (لا خلط تغطية الشواهد بالدرجات الموزونة الرسمية 20/30/40/10).

import { buildIndicatorEvidenceScores, percentageFromCounts } from "@/features/improvement-plans/score"

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
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

// بنك محاكى: مؤشر واحد يملك 20 شاهدًا (ev_1..ev_20)
const BANK = Array.from({ length: 20 }, (_, i) => ({ id: `ev_${i + 1}`, indicatorId: "ind_A" }))

// خمسة تقييمات تُحقق نفس الشواهد العشرة الأولى (السيناريو الذي كان يولد 500%)
const FIVE_ASSESSMENTS_SAME_10 = Array.from({ length: 5 }, (_, a) =>
  Array.from({ length: 10 }, (_, i) => ({ evidenceId: `ev_${i + 1}`, assessmentId: `assess_${a + 1}` }))
).flat()

console.log("— تغطية المنصة: اتحاد مميز فوق إجمالي البنك —")

test("5 تقييمات تُحقق نفس الشواهد → التغطية 50% لا 500% (الاتحاد المميز لا الجمع)", () => {
  const map = buildIndicatorEvidenceScores(BANK, FIVE_ASSESSMENTS_SAME_10)
  const a = map.get("ind_A")!
  assert(a.verifiedCount === 10, `المميز المتحقق = 10 (وليس 50 صفًا) — وجد ${a.verifiedCount}`)
  assert(a.percentage === 50, `النسبة 50% — وجد ${a.percentage}%`)
})

test("سقف التغطية 100% حتى لو تحقق البنك كاملًا في كل تقييم", () => {
  const allInEveryAssessment = Array.from({ length: 5 }, () => BANK.map((e) => ({ evidenceId: e.id }))).flat()
  const map = buildIndicatorEvidenceScores(BANK, allInEveryAssessment)
  const pct = map.get("ind_A")!.percentage
  assert(pct === 100, `النسبة 100% كحد أقصى — وجد ${pct}%`)
})

test("تقييمات متعددة بشواهد مختلفة → الاتحاد يجمع حتى إجمالي البنك ولا يتجاوزه", () => {
  // تقييمان: الأول يحقق ev_1..ev_12 والثاني ev_9..ev_20 (تداخل 4) → اتحاد 20
  const a1 = Array.from({ length: 12 }, (_, i) => ({ evidenceId: `ev_${i + 1}` }))
  const a2 = Array.from({ length: 12 }, (_, i) => ({ evidenceId: `ev_${i + 9}` }))
  const map = buildIndicatorEvidenceScores(BANK, [...a1, ...a2])
  const a = map.get("ind_A")!
  assert(a.verifiedCount === 20, `الاتحاد = 20 (12+12−4 تداخل) — وجد ${a.verifiedCount}`)
  assert(a.percentage === 100, `100% عند اكتمال البنك — وجد ${a.percentage}%`)
})

test("صفوف زيارات الملاحظة الصفية (7 زيارات لنفس الشاهد) تُحسب مرة واحدة", () => {
  const visitRows = Array.from({ length: 7 }, (_, v) => ({ evidenceId: "ev_1", visitNumber: v + 1 }))
  const map = buildIndicatorEvidenceScores(BANK, visitRows)
  const a = map.get("ind_A")!
  assert(a.verifiedCount === 1, `شاهد واحد مميز من 7 صفوف — وجد ${a.verifiedCount}`)
  assert(a.percentage === 5, `round(1/20×100) = 5% — وجد ${a.percentage}%`)
})

console.log("— حدود الصيغة النقية (percentageFromCounts) —")

test("الصيغة لا تختلع قيمة بلا شواهد (null بلا اختراع)", () => {
  assert(percentageFromCounts(5, 0) === null, "مقام صفر → null")
})

test("النسبة دائمًا ضمن 0..100 لأي عدادات مميزة صحيحة", () => {
  assert(percentageFromCounts(0, 631) === 0, "صفر متحقق → 0%")
  assert(percentageFromCounts(631, 631) === 100, "بنك 631 كاملًا → 100%")
  assert(percentageFromCounts(64, 631) === 10, "64/631 ≈ 10% (حالة التقييم الحقيقية)")
})

console.log(`\nالنتائج: ${passed} نجح، ${failed} فشل`)
if (failed > 0) process.exit(1)