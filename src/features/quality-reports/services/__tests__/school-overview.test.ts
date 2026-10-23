// ===== FILE: src/features/quality-reports/services/__tests__/school-overview.test.ts =====
// ============================================================
// اختبارات ملخص أداء المدارس (لوحة مدير النظام)
// تُشغَّل بـ: npx tsx src/features/quality-reports/services/__tests__/school-overview.test.ts
// وحدات نقية فقط — بلا قاعدة بيانات ولا Next (نفس نمط platform-aggregation.test.ts)
// ============================================================
// ما تثبت الاختبارات:
//   1. الأوزان الرسمية (20/30/40/10) تُطبَّق مرة واحدة بالضبط
//      (90/80/70/60 → 76 — لا مضاعفة ولا عرض «حصّة المجال المرجحة» كنسبة)
//   2. صفوف زيارات الملاحظة الصفية المتكررة لا تضخّم أي نسبة (تفريد الشواهد)
//   3. التقييمات المستقلة تُتوسط نتائجها المرجحة — لا دمج صفوف عبر التقييمات
//   4. مدرسة بلا تقييم مكتمل → null في كل شيء (لا صفر مصنوع ولا نسبة مختلقة)
//   5. تغطية الشواهد حقل مستقل عن الدرجة المرجحة ومقبول على إجمالي البنك
//      (اتحاد مميز — لا يتخطى 100% مهما تعددت التقييمات أو الزيارات)
//   6. مجال بلا شواهد معرّفة → النتيجة المرجحة null + عدد المستبعد موثق
//   7. ربط كل مدرسة بصفوفها الصحيحة (صحة «شاهد المزيد» على مستوى البيانات)
//   8. الترتيب العربي الثابت + مجموعة اللوحة الابتدائية
// ============================================================

import {
  buildSchoolPerformanceSummary,
  sortSchoolSummaries,
  selectDashboardSubset,
  DASHBOARD_SCHOOL_CARD_LIMIT,
  type SchoolCompletedAssessmentInput,
  type SchoolMetaInput,
} from "@/features/quality-reports/services/school-overview"

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
function assertEq(actual: unknown, expected: unknown, msg: string) {
  if (actual !== expected) throw new Error(`${msg} — المتوقع ${String(expected)} وُجد ${String(actual)}`)
}

// ------------------------------------------------------------
// بنّاؤو بيانات المحاكاة
// ------------------------------------------------------------

const DOMAIN_NAMES = ["الإدارة المدرسية", "التعليم والتعلم", "نواتج التعلم", "البيئة المدرسية"]
const DOMAIN_WEIGHTS = [0.2, 0.3, 0.4, 0.1]

/** إطار رسمي: كل مجال بمؤشر واحد وn شاهد ثابت (ev_<d>_<i>) — أو 0 شواهد لمجال فارغ */
function makeFramework(evidencePerDomain: number[]) {
  const officialDomains = DOMAIN_NAMES.map((name, di) => ({
    id: `dom_${di}`,
    name,
    indicators: [
      {
        id: `ind_${di}`,
        domainId: `dom_${di}`,
        axisId: `axis_${di}`,
        axis: { name: `محور ${di}` },
        fixedEvidence: Array.from({ length: evidencePerDomain[di] }, (_, i) => ({ id: `ev_${di}_${i}` })),
      },
    ],
  }))
  const totalBankEvidence = evidencePerDomain.reduce((a, b) => a + b, 0)
  return { officialDomains, totalBankEvidence }
}

/** صف متحقق موقّع على مجاله/محوره (نفس الشكل الذي يمرره المحمّل الخادمي) */
function row(domainIndex: number, evidenceIndex: number) {
  return {
    evidenceId: `ev_${domainIndex}_${evidenceIndex}`,
    evidence: { indicator: { domainId: `dom_${domainIndex}`, axisId: `axis_${domainIndex}` } },
  }
}

/** تقييم مكتمل يحقق أول k شواهد من كل مجال (n شواهد لكل مجال) */
function makeAssessment(id: string, evidencePerDomain: number[], verifyPerDomain: number[], completedAt: string | null, repeatsPerRow = 1): SchoolCompletedAssessmentInput {
  const evidenceResponses: SchoolCompletedAssessmentInput["evidenceResponses"] = []
  for (let d = 0; d < DOMAIN_NAMES.length; d++) {
    for (let i = 0; i < Math.min(verifyPerDomain[d], evidencePerDomain[d]); i++) {
      for (let r = 0; r < repeatsPerRow; r++) {
        evidenceResponses.push(row(d, i))
      }
    }
  }
  return { id, completedAt, evidenceResponses }
}

function makeSchool(id: string, name: string): SchoolMetaInput {
  return { id, name, nameEn: null, logoUrl: null, status: "ACTIVE" }
}

const FULL_FRAMEWORK = makeFramework([10, 10, 10, 10])

// ------------------------------------------------------------
// 1) الأوزان تُطبَّق مرة واحدة بالضبط
// ------------------------------------------------------------

console.log("— الأوزان الرسمية مرة واحدة —")

test("درجات مجالات 90/80/70/60 → الدرجة الكلية 76 = 0.2×90+0.3×80+0.4×70+0.1×60", () => {
  const summary = buildSchoolPerformanceSummary(
    makeSchool("s1", "مدرسة الوزن"),
    [makeAssessment("a1", [10, 10, 10, 10], [9, 8, 7, 6], "2025-01-01T00:00:00.000Z")],
    0,
    FULL_FRAMEWORK
  )
  assertEq(summary.domains[0].score, 90, "الإدارة المدرسية")
  assertEq(summary.domains[1].score, 80, "التعليم والتعلم")
  assertEq(summary.domains[2].score, 70, "نواتج التعلم")
  assertEq(summary.domains[3].score, 60, "البيئة المدرسية")
  assertEq(summary.overallScore, 76, "النتيجة المرجحة")
  assertEq(summary.domains[0].weight, 0.2, "وزن المجال الأول كما هو")
  assert(summary.hasScore, "hasScore=true عند وجود نتيجة صالحة")
})

test("حصّة المجال المرجحة (score×وزن) لا تظهر أبدًا كنسبة مجال — 90×0.2=18 ≠ 90", () => {
  const summary = buildSchoolPerformanceSummary(
    makeSchool("s1", "مدرسة الفصل"),
    [makeAssessment("a1", [10, 10, 10, 10], [9, 8, 7, 6], null)],
    0,
    FULL_FRAMEWORK
  )
  for (const domain of summary.domains) {
    assert(domain.score !== null && domain.score <= 100 && domain.score >= 0, `نسبة المجال داخل 0-100 وُجد ${domain.score}`)
    if (domain.weight !== null && domain.score !== null) {
      const contribution = domain.score * domain.weight
      assert(Math.abs(contribution - (domain.score as number)) > 1, "المعروض هو درجة المجال لا حصته المرجحة")
    }
  }
})

test("مجال 100% كاملًا مع البقية صفرًا حقيقيًا → الكلية 100×وزنه فقط", () => {
  // بيئة مدرسية كاملة (وزن 0.1) والبقية لا شاهد متحقق → 0.1×100 = 10
  const summary = buildSchoolPerformanceSummary(
    makeSchool("s1", "مدرسة البيئة"),
    [makeAssessment("a1", [10, 10, 10, 10], [0, 0, 0, 10], null)],
    0,
    FULL_FRAMEWORK
  )
  assertEq(summary.overallScore, 10, "الكلية = 10% حصرًا")
  assertEq(summary.domains[3].score, 100, "البيئة المدرسية 100")
  assertEq(summary.domains[0].score, 0, "الإدارة صفر حقيقي (تقييم مكتمل — ليس اختلاقًا)")
})

// ------------------------------------------------------------
// 2) مناعة من تضخم صفوف الزيارات
// ------------------------------------------------------------

console.log("— تفريد صفوف الزيارات —")

test("نفس الشواهد بـ7 صفوف زيارة مكررة → المجال 100% لا 700%", () => {
  const summary = buildSchoolPerformanceSummary(
    makeSchool("s1", "مدرسة الزيارات"),
    [makeAssessment("a1", [10, 10, 10, 10], [10, 10, 10, 10], null, 7)],
    0,
    FULL_FRAMEWORK
  )
  for (const domain of summary.domains) {
    assertEq(domain.score, 100, `${domain.name}`)
  }
  assertEq(summary.overallScore, 100, "الكلية")
})

// ------------------------------------------------------------
// 3) التقييمات المستقلة تُتوسط — لا دمج صفوف عبر التقييمات
// ------------------------------------------------------------

console.log("— استقلال التقييمات —")

test("تقييمان 50% و100% → المدرسة 75% (متوسط مستقل) لا دمج صفوف يعطي 150%", () => {
  const half = makeAssessment("a1", [10, 10, 10, 10], [5, 5, 5, 5], null)
  const full = makeAssessment("a2", [10, 10, 10, 10], [10, 10, 10, 10], null)
  const summary = buildSchoolPerformanceSummary(makeSchool("s1", "مدرسة المتوسط"), [half, full], 0, FULL_FRAMEWORK)
  assertEq(summary.overallScore, 75, "الكلية = متوسط النتيجتين المرجحتين")
  for (const domain of summary.domains) {
    assertEq(domain.score, 75, `${domain.name} = متوسط 50 و100`)
  }
})

// ------------------------------------------------------------
// 4) بلا تقييم مكتمل → null في كل شيء
// ------------------------------------------------------------

console.log("— المدارس بلا تقييم مكتمل —")

test("مدرسة بلا مكتمل (وعندها جارٍ) → null في الدرجة والتغطية والتواريخ، لا أصفار", () => {
  const summary = buildSchoolPerformanceSummary(makeSchool("s1", "مدرسة بادئة"), [], 2, FULL_FRAMEWORK)
  assertEq(summary.hasScore, false, "hasScore=false")
  assertEq(summary.overallScore, null, "الدرجة null")
  assertEq(summary.classification, null, "التصنيف null")
  assertEq(summary.evidenceCoverage, null, "التغطية null (لا صفر مضلل)")
  assertEq(summary.latestCompletedAt, null, "لا تاريخ إتمام")
  assertEq(summary.completedCount, 0, "مكتمل 0 (عدّاد حقيقي لا درجة)")
  assertEq(summary.inProgressCount, 2, "جارٍ 2")
  assertEq(summary.domains.length, 0, "لا أشرطة مجالات بلا تقييمات")
})

// ------------------------------------------------------------
// 5) تغطية الشواهد: مستقلة + اتحاد مميز مقبول على البنك
// ------------------------------------------------------------

console.log("— تغطية الشواهد مقابل الدرجة —")

test("تقييمان يحققان البنك كاملًا → التغطية 100% لا 200% (اتحاد مميز)", () => {
  const rows = makeAssessment("a", [10, 10, 10, 10], [10, 10, 10, 10], null)
  const summary = buildSchoolPerformanceSummary(
    makeSchool("s1", "مدرسة التغطية"),
    [rows, { id: "a2", completedAt: null, evidenceResponses: rows.evidenceResponses }],
    0,
    FULL_FRAMEWORK
  )
  assertEq(summary.evidenceCoverage, 100, "التغطية مقبولة على إجمالي البنك")
  assertEq(summary.overallScore, 100, "الدرجة مستقلة عن التغطية")
})

test("تغطية جزئية 38% مع درجة مرجحة مختلفة — حقلان مستقلان لا يُخلط بينهما", () => {
  // تقييم واحد يحقق 15 شاهدًا مميزًا من أصل 40 في البنك (38%) لكن يتركز في مجالين فقط
  const evidenceResponses: SchoolCompletedAssessmentInput["evidenceResponses"] = []
  for (let i = 0; i < 10; i++) evidenceResponses.push(row(0, i)) // الإدارة كاملة
  for (let i = 0; i < 5; i++) evidenceResponses.push(row(1, i)) // نصف التعليم
  const summary = buildSchoolPerformanceSummary(
    makeSchool("s1", "مدرسة الفصلين"),
    [{ id: "a1", completedAt: null, evidenceResponses }],
    0,
    FULL_FRAMEWORK
  )
  assertEq(summary.evidenceCoverage, 38, "التغطية 15/40")
  // النتيجة المرجحة: التعليم ونواتج والبيئة بلا متحقق → 0.2×100 + 0.3×50 = 35
  assertEq(summary.overallScore, 35, "الدرجة المرجحة ≠ التغطية")
  assert(summary.evidenceCoverage !== summary.overallScore, "القيمتان مختلفتان فعلاً")
})

test("بلا تقييمات مكتملة → التغطية null لا صفر (نفس قاعدة عدم الاختلاق)", () => {
  const summary = buildSchoolPerformanceSummary(makeSchool("s1", "مدرسة بلا مكتمل"), [], 1, FULL_FRAMEWORK)
  assertEq(summary.evidenceCoverage, null, "بلا قياس → null")
})

// ------------------------------------------------------------
// 6) مجال بلا شواهد معرّفة → النتيجة null والمستبعد موثق
// ------------------------------------------------------------

console.log("— مجال ناقص الإطار —")

test("نواتج التعلم بلا شواهد معرّفة → النتيجة المرجحة null + skipped=1 (لا تخمين)", () => {
  const framework = makeFramework([10, 10, 0, 10]) // المجال الثالث فارغ
  const summary = buildSchoolPerformanceSummary(
    makeSchool("s1", "مدرسة الناقص"),
    [makeAssessment("a1", [10, 10, 0, 10], [10, 10, 0, 10], null)],
    0,
    framework
  )
  assertEq(summary.hasScore, false, "لا نتيجة كلية")
  assertEq(summary.overallScore, null, "overall null")
  assertEq(summary.skippedAssessments, 1, "التقييم مستبعد من المتوسط وموثق")
  assertEq(summary.domains[2].score, null, "مجال نواتج التعلم null")
  assertEq(summary.domains[0].score, 100, "بقية المجالات تُحتسب كما هي")
})

// ------------------------------------------------------------
// 7) ربط كل مدرسة بصفوفها (صحة «شاهد المزيد» على مستوى البيانات)
// ------------------------------------------------------------

console.log("— ربط المدارس ببياناتها —")

test("ثلاث مدارس ببيانات مختلفة → كل ملخص يحمل درجة مدرسته حصرًا", () => {
  const framework = FULL_FRAMEWORK
  const bySchool = new Map<string, SchoolCompletedAssessmentInput[]>([
    ["school_A", [makeAssessment("aA", [10, 10, 10, 10], [10, 10, 10, 10], null)]],
    ["school_B", [makeAssessment("aB", [10, 10, 10, 10], [5, 5, 5, 5], null)]],
    ["school_C", []],
  ])
  const a = buildSchoolPerformanceSummary(makeSchool("school_A", "المدارس-أ"), bySchool.get("school_A")!, 0, framework)
  const b = buildSchoolPerformanceSummary(makeSchool("school_B", "المدارس-ب"), bySchool.get("school_B")!, 1, framework)
  const c = buildSchoolPerformanceSummary(makeSchool("school_C", "المدارس-ج"), bySchool.get("school_C")!, 0, framework)
  assertEq(a.schoolId, "school_A", "معرف أ")
  assertEq(a.overallScore, 100, "درجة أ")
  assertEq(b.schoolId, "school_B", "معرف ب")
  assertEq(b.overallScore, 50, "درجة ب")
  assertEq(c.schoolId, "school_C", "معرف ج")
  assertEq(c.overallScore, null, "درجة ج null (لا تقييم)")
  assert(a.overallScore !== b.overallScore && b.overallScore !== c.overallScore, "لا تسرب بين المدارس")
})

// ------------------------------------------------------------
// 8) الترتيب العربي الثابت + مجموعة اللوحة الابتدائية
// ------------------------------------------------------------

console.log("— الترتيب والمجموعة الابتدائية —")

test("sortSchoolSummaries بترتيب عربي ثابت (أ ثم ب ثم ج)", () => {
  const sorted = sortSchoolSummaries([
    { name: "مدرسة ج" },
    { name: "مدرسة أ" },
    { name: "مدرسة ب" },
  ])
  assertEq(sorted[0].name, "مدرسة أ", "الأول أ")
  assertEq(sorted[1].name, "مدرسة ب", "الثاني ب")
  assertEq(sorted[2].name, "مدرسة ج", "الثالث ج")
})

test("selectDashboardSubset يقتطع أول N من المرتب بلا تعديل الأصل", () => {
  const sorted = sortSchoolSummaries([
    { name: "مدرسة د" },
    { name: "مدرسة أ" },
    { name: "مدرسة ب" },
  ])
  assertEq(DASHBOARD_SCHOOL_CARD_LIMIT, 8, "حد اللوحة 8")
  const subset = selectDashboardSubset(sorted, 2)
  assertEq(subset.length, 2, "المجموعة 2")
  assertEq(subset[0].name, "مدرسة أ", "الأول بعد الترتيب")
  assertEq(sorted.length, 3, "الأصل لم يُقص (نسخة)")
})

// ------------------------------------------------------------
// 9) التصنيف + أحدث إتمام
// ------------------------------------------------------------

console.log("— التصنيف وأحدث تاريخ —")

test("الكلية 95 → التميز، و76 → التقدم (تصنيف مستوى الأداء الرسمي)", () => {
  const excellence = buildSchoolPerformanceSummary(
    makeSchool("s1", "مدرسة متميزة"),
    [makeAssessment("a1", [10, 10, 10, 10], [10, 10, 10, 10], null)],
    0,
    FULL_FRAMEWORK
  )
  assert(excellence.classification !== null && excellence.classification.key === "EXCELLENCE", "95 = التميز")
  const progress = buildSchoolPerformanceSummary(
    makeSchool("s2", "مدرسة متقدمة"),
    [makeAssessment("a1", [10, 10, 10, 10], [9, 8, 7, 6], null)],
    0,
    FULL_FRAMEWORK
  )
  assert(progress.classification !== null && progress.classification.key === "PROGRESS", "76 = التقدم")
})

test("أحدث تاريخ إتمام = الأقصى بين التقييمات", () => {
  const summary = buildSchoolPerformanceSummary(
    makeSchool("s1", "مدرسة التواريخ"),
    [
      makeAssessment("a1", [10, 10, 10, 10], [10, 10, 10, 10], "2025-01-01T00:00:00.000Z"),
      makeAssessment("a2", [10, 10, 10, 10], [10, 10, 10, 10], "2025-03-05T00:00:00.000Z"),
    ],
    0,
    FULL_FRAMEWORK
  )
  assertEq(summary.latestCompletedAt, "2025-03-05T00:00:00.000Z", "الأحدث")
  assertEq(summary.completedCount, 2, "عدد المكتمل")
})

// ------------------------------------------------------------
// الخلاصة
// ------------------------------------------------------------

console.log(`\nالنتيجة: ${passed} ناجح / ${failed} فاشل`)
if (failed > 0) process.exit(1)