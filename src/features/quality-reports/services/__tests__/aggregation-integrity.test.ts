// ===== FILE: src/features/quality-reports/services/__tests__/aggregation-integrity.test.ts =====
// ============================================================
// Automated tests — Aggregation integrity (إصلاح النسب المنفوخة)
// Run:  npx tsx src/features/quality-reports/services/__tests__/aggregation-integrity.test.ts
// Pure modules under test (zero server imports) — no database needed.
// ============================================================
// يغطي متطلبات التحقق §7 من مواصفة الإصلاح:
//  1) تقييم واحد → نسب مجالات ونتيجة إجمالية صحيحة
//  2) تقييمات متعددة لنفس المدرسة تبقى منفصلة
//  3) لا جمع للنسب عبر التقييمات
//  4) التكرار (صفوف زيارات الملاحظة الصفية/joins مضاعفة) لا يضخّم الدرجات
//  5) الأوزان 20/30/40/10 تُطبق مرة واحدة بالضبط
//  6) المثال المعتمد 80/70/75/60 → 73.0
//  7) المؤشرات/المجالات بلا شواهد تتبع قاعدة المقام المعتمدة (null بلا اختلاق)
//  8) الفلاتر تعود بالسجلات الصحيحة فقط (تحليل المعاملات + بناء Where)
//  9) لا تسريب بين مدارس/فروع/مقيّمين/مراحل (بنيوي: Where لا يحمل سوى حقول الفلاتر
//     والنطاق يُدمج AND على الخادم — مغطى باختبارات 8 ووحدة الفلاتر)
// 10) الرسوم تتطابق مع بيانات التقرير (نفس خدمة الحساب الواحدة تُغذّي البطاقة والطباعة)
// ============================================================
import assert from "node:assert/strict"
import {
  computeAssessmentWeightedResult,
  computeWeightedOverall,
  averageWeightedOveralls,
  aggregateDomainScores,
  computePercentage,
  countDistinctVerifiedEvidence,
  distinctVerifiedEvidenceRows,
  type OfficialDomainInput,
  type EvidenceRowInput,
} from "../weighted-score"
import { buildItemComparison } from "../survey-integration"
import {
  resolveReportFilters,
  buildReportFilterWhere,
  reportFiltersToParams,
  reportFiltersToQueryString,
} from "../report-filters"

let passed = 0
let failed = 0
function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${name}`)
    console.error(`    ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ------------------------------------------------------------
// Helpers — fixtures with IDENTIFIED evidence (evidenceId/evidence.id)
// matching the real EvidenceResponse row shape the pages load
// ------------------------------------------------------------
interface AxisSpec { name: string; evidence: number; verified: number }
interface DomainSpec { name: string; axes: AxisSpec[] }

function buildIdentifiedFixtures(specs: DomainSpec[]): {
  domains: OfficialDomainInput[]
  responses: EvidenceRowInput[]
} {
  let evSeq = 0
  const domains: OfficialDomainInput[] = []
  const responses: EvidenceRowInput[] = []
  for (const spec of specs) {
    const domainId = `domain:${spec.name}`
    const indicators: OfficialDomainInput["indicators"] = []
    for (const axis of spec.axes) {
      const axisId = `axis:${spec.name}:${axis.name}`
      const evidenceIds: string[] = []
      for (let i = 0; i < axis.evidence; i++) evidenceIds.push(`ev:${evSeq++}`)
      indicators.push({
        id: `ind:${domainId}:${axisId}`,
        domainId,
        axisId,
        axis: { name: axis.name },
        fixedEvidence: evidenceIds,
      })
      for (let i = 0; i < axis.verified && i < axis.evidence; i++) {
        // صف بمعرّف شاهد — كما تعيده استعلامات المنصة (evidenceId عمود قائم)
        responses.push({ evidenceId: evidenceIds[i], evidence: { id: evidenceIds[i], indicator: { domainId, axisId } } })
      }
    }
    domains.push({ id: domainId, name: spec.name, indicators })
  }
  return { domains, responses }
}

/** يكرر كل صف (محاكاة زيارات الملاحظة الصفية 1..7 لنفس الشاهد) */
function repeatRows(rows: EvidenceRowInput[], times: number): EvidenceRowInput[] {
  const out: EvidenceRowInput[] = []
  for (let v = 0; v < times; v++) out.push(...rows)
  return out
}

console.log("\n=== 1) Single assessment → expected domain & overall percentages ===")

test("single assessment: 80/70/75/60 evidence ratios → domain scores & weighted overall 73", () => {
  const { domains, responses } = buildIdentifiedFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 25, verified: 20 }] }, // 80
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 20, verified: 14 }] }, // 70
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 20, verified: 15 }] }, // 75
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 6 }] }, // 60
  ])
  const r = computeAssessmentWeightedResult(domains, responses)
  const byKey = new Map(r.domains.map(d => [d.key, d]))
  assert.equal(byKey.get("SCHOOL_LEADERSHIP")?.score, 80)
  assert.equal(byKey.get("TEACHING_AND_LEARNING")?.score, 70)
  assert.equal(byKey.get("LEARNING_OUTCOMES")?.score, 75)
  assert.equal(byKey.get("SCHOOL_ENVIRONMENT")?.score, 60)
  assert.equal(r.overall, 73)
  // كل النسب ضمن المدى الصحيح — لا قيمة فوق 100% أصلًا
  for (const d of r.domains) {
    assert.ok(d.score === null || (d.score >= 0 && d.score <= 100), `domain ${d.name} out of range: ${d.score}`)
  }
})

console.log("\n=== 2) Multiple assessments stay separate (no merging) ===")

test("two assessments for the same school computed independently — no cross leakage", () => {
  const a1 = buildIdentifiedFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 10 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 10 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: 10 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 10 }] },
  ])
  const a2 = buildIdentifiedFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 2 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 2 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: 2 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 2 }] },
  ])
  const r1 = computeAssessmentWeightedResult(a1.domains, a1.responses)
  const r2 = computeAssessmentWeightedResult(a2.domains, a2.responses)
  assert.equal(r1.overall, 100)
  assert.equal(r2.overall, 20)
  // نتيجة الأول لن تتأثر باستجابات الثاني مهما تكرر الاستدعاء
  const r1Again = computeAssessmentWeightedResult(a1.domains, a1.responses)
  assert.equal(r1Again.overall, 100)
})

console.log("\n=== 3) Percentages are never summed across assessments ===")

test("aggregation = average of independent overalls (100 + 0 → 50, not 200)", () => {
  const build = (verified: number) => {
    const f = buildIdentifiedFixtures([
      { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified }] },
      { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified }] },
      { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified }] },
      { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified }] },
    ])
    return computeAssessmentWeightedResult(f.domains, f.responses)
  }
  const agg = averageWeightedOveralls([build(10), build(0)])
  assert.equal(agg.average, 50)
  assert.ok(agg.average <= 100, "average must never exceed 100%")
  // متوسط درجات المجال كذلك متوسط لا جمع: (100+0)/2 = 50
  const domAgg = aggregateDomainScores([build(10), build(0)])
  assert.equal(domAgg[0].score, 50)
  assert.ok(domAgg.every(d => d.score === null || d.score <= 100))
})

console.log("\n=== 4) Duplicates (multi-visit rows / duplicate joins) never inflate scores ===")

test("7 visit-rows for the same verified evidence count ONCE (10% not 70%)", () => {
  const base = buildIdentifiedFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 1 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 1 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: 1 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 1 }] },
  ])
  const clean = computeAssessmentWeightedResult(base.domains, base.responses)
  assert.equal(clean.overall, 10)
  // نفس الشاهد بسلسلة زيارات كاملة (7 صفوف لكل شاهد متحقق) — النتيجة يجب أن تبقى 10
  const inflated = computeAssessmentWeightedResult(base.domains, repeatRows(base.responses, 7))
  assert.equal(inflated.overall, 10)
  const byKey = new Map(inflated.domains.map(d => [d.key, d]))
  for (const key of ["SCHOOL_LEADERSHIP", "TEACHING_AND_LEARNING", "LEARNING_OUTCOMES", "SCHOOL_ENVIRONMENT"]) {
    assert.equal(byKey.get(key)?.score, 10, `${key} must stay 10% despite 7 visit rows`)
    assert.equal(byKey.get(key)?.verified, 1, `${key} verified count must stay 1 distinct evidence`)
  }
  // العدّاد الموحد يفرد الشواهد أيضًا
  assert.equal(countDistinctVerifiedEvidence(repeatRows(base.responses, 7)), 4)
  assert.equal(countDistinctVerifiedEvidence(base.responses), 4)
})

test("partial duplicates: 10 evidences, 9 verified once + 1 verified across 7 visits → 100% exactly once", () => {
  const f = buildIdentifiedFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 10 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 0 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: 0 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 0 }] },
  ])
  // الشاهد العاشر (غير محقق في الأصل) نضيف له 7 صفوف زيارة — خطأ شائع من upsert لكل زيارة
  // 10 صفوف أصلية + 7 صفوف زيارة مكررة لنفس الشاهد = 17 صفًا لكن 10 شواهد مميزة فقط
  const extra = f.responses.concat(repeatRows([f.responses[9]], 7))
  assert.equal(extra.length, 17)
  const r = computeAssessmentWeightedResult(f.domains, extra)
  const leadership = r.domains.find(d => d.key === "SCHOOL_LEADERSHIP")
  assert.equal(leadership?.verified, 10) // 10 شواهد مميزة لا 17 صفًا
  assert.equal(leadership?.score, 100)
})

test("rows without identity keep legacy row-counting (backward compatible)", () => {
  const rows: EvidenceRowInput[] = [
    { evidence: { indicator: { domainId: "d1", axisId: "a1" } } },
    { evidence: { indicator: { domainId: "d1", axisId: "a1" } } },
  ]
  assert.equal(countDistinctVerifiedEvidence(rows), 2)
  assert.equal(distinctVerifiedEvidenceRows(rows).length, 2)
})

console.log("\n=== 5+6) Official 20/30/40/10 weights applied exactly once → 73.0 ===")

test("80/70/75/60 with official weights → 73 (not 71 unweighted, not double-weighted)", () => {
  const { overall } = computeWeightedOverall([
    { key: "SCHOOL_LEADERSHIP", score: 80 },
    { key: "TEACHING_AND_LEARNING", score: 70 },
    { key: "LEARNING_OUTCOMES", score: 75 },
    { key: "SCHOOL_ENVIRONMENT", score: 60 },
  ])
  // 80×0.2 + 70×0.3 + 75×0.4 + 60×0.1 = 73.0 بالضبط
  assert.equal(overall, 73)
  assert.notEqual(overall, 71) // متوسط بسيط بلا أوزان
  assert.notEqual(overall, 55) // لو طُبّقت الأوزان مرتين
})

test("full-coverage assessment of every domain → exactly 100 (weights total 100%)", () => {
  const f = buildIdentifiedFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 5, verified: 5 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 5, verified: 5 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 5, verified: 5 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 5, verified: 5 }] },
  ])
  const r = computeAssessmentWeightedResult(f.domains, f.responses)
  assert.equal(r.overall, 100)
})

console.log("\n=== 7) Missing / inapplicable indicators follow the approved denominator rule ===")

test("indicator with zero required evidence → null percentage (never fabricated 0/100)", () => {
  assert.equal(computePercentage(0, 0), null)
  assert.equal(computePercentage(5, 0), null)
  assert.equal(computePercentage(3, 10), 30)
})

test("domain with no defined evidence → overall null + transparent diagnostics (no fabricated score)", () => {
  const f = buildIdentifiedFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 8 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 7 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 0, verified: 0 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 6 }] },
  ])
  const r = computeAssessmentWeightedResult(f.domains, f.responses)
  assert.equal(r.overall, null)
  assert.ok(r.diagnostics.missingDataDomains.includes("نواتج التعلم"))
})

console.log("\n=== 8) Filters parse safely and build a narrow AND-where ===")

test("all filters parsed and composed (stage/school/assessor/year/dates)", () => {
  const filters = resolveReportFilters({
    stage: "PRIMARY",
    schoolId: "school-1",
    assessorId: "user-9",
    year: "year-3",
    from: "2025-01-15",
    to: "2025-02-10",
    status: "IN_PROGRESS",
  })
  const w = buildReportFilterWhere(filters)
  assert.deepEqual(w.stage, "PRIMARY")
  assert.equal(w.schoolId, "school-1")
  assert.equal(w.assessorId, "user-9")
  assert.equal(w.academicYearId, "year-3")
  assert.ok(w.startedAt?.gte)
  // «إلى تاريخ» شامل: أقل من بداية اليوم التالي
  assert.equal(w.startedAt?.gte?.toISOString(), "2025-01-15T00:00:00.000Z")
  assert.equal(w.startedAt?.lt?.toISOString(), "2025-02-11T00:00:00.000Z")
})

test("invalid/tampered values are ignored (no throw, no fabricated filter)", () => {
  const filters = resolveReportFilters({
    stage: "HACKED_STAGE",
    schoolId: "  ",
    year: "   ",
    from: "not-a-date",
    to: "2025-13-99",
    status: "EVERYTHING",
  })
  assert.equal(filters.stage, undefined)
  assert.equal(filters.schoolId, undefined)
  assert.equal(filters.academicYearId, undefined)
  assert.equal(filters.from, undefined)
  assert.equal(filters.to, undefined)
  assert.equal(filters.status, undefined)
  assert.deepEqual(buildReportFilterWhere(filters), {})
})

test("historical records matched only via explicit «غير محدد» filters (stage & year)", () => {
  const filters = resolveReportFilters({ stage: "UNSPECIFIED", year: "UNASSIGNED" })
  assert.equal(filters.stage, null) // stage IS NULL
  assert.equal(filters.academicYearId, null) // academicYearId IS NULL
  const w = buildReportFilterWhere(filters)
  assert.equal(w.stage, null)
  assert.equal(w.academicYearId, null)
})

test("status filter contract: ALL/COMPLETED/IN_PROGRESS survive parsing — undefined stays undefined", () => {
  // «الكل» الصريح يجب أن يصل الصفحة كما هو — دفنه في COMPLETED يجعل خيار «الكل»
  // في شريط الفلاتر يعرض المكتمل فقط (خطأ TS2367 + خطأ دلالي في الدفعة الأولى)
  assert.equal(resolveReportFilters({ status: "ALL" }).status, "ALL")
  assert.equal(resolveReportFilters({ status: "COMPLETED" }).status, "COMPLETED")
  assert.equal(resolveReportFilters({ status: "IN_PROGRESS" }).status, "IN_PROGRESS")
  // بلا معامل = undefined → الصفحة تطبق افتراض الدور (COMPLETED غالبًا) بلا اختلاق
  assert.equal(resolveReportFilters({}).status, undefined)
  assert.equal(resolveReportFilters({ status: "  " }).status, undefined)
})

test("filter params round-trip (links/forms carry the same filters)", () => {
  const filters = resolveReportFilters({
    stage: "SECONDARY", assessorId: "u1", year: "y1", from: "2025-01-01", to: "2025-01-31",
  })
  const params = reportFiltersToParams(filters)
  assert.equal(params.stage, "SECONDARY")
  assert.equal(params.assessorId, "u1")
  assert.equal(params.year, "y1")
  assert.equal(params.from, "2025-01-01")
  assert.equal(params.to, "2025-01-31") // اليوم الشامل كما أدخله المستخدم
  const reparsed = resolveReportFilters(params)
  assert.equal(reparsed.stage, "SECONDARY")
  assert.equal(reparsed.assessorId, "u1")
  assert.equal(reparsed.academicYearId, "y1")
  assert.equal(reparsed.to?.toISOString(), "2025-02-01T00:00:00.000Z")
  assert.equal(reportFiltersToQueryString({}), "")
})

console.log("\n=== 9) No cross-scope leakage in the filter where (structural) ===")

test("where contains ONLY filter fields — role scope is merged AND server-side", () => {
  const w = buildReportFilterWhere(resolveReportFilters({
    stage: "KINDERGARTEN", assessorId: "u2", year: "y2", schoolId: "s2",
    from: "2025-03-01", to: "2025-03-20",
  }))
  assert.deepEqual(Object.keys(w).sort(), ["academicYearId", "assessorId", "schoolId", "stage", "startedAt"])
  // لا حقول متalloثة أخرى (schoolId فقط لأن الفلتر طلبه صراحة — والأدوار الأخرى
  // تُقيّد بمدرستها في الاستعلام نفسه فيبقى AND مُضيّقًا لا موسّعًا)
})

console.log("\n=== 10) Dashboard cards & print share ONE calculation service ===")

test("survey comparison rows do not inflate with duplicated visit rows either", () => {
  const officialDomains = [{
    id: "d1",
    name: "الإدارة المدرسية",
    indicators: [{
      id: "ind1", code: "L1", description: "مؤشر",
      fixedEvidence: ["ev1", "ev2", "ev3", "ev4"],
    }],
  }]
  const verifiedResponses = [
    { evidenceId: "ev1", evidence: { indicatorId: "ind1" } },
    { evidenceId: "ev1", evidence: { indicatorId: "ind1" } },
    { evidenceId: "ev1", evidence: { indicatorId: "ind1" } },
    { evidenceId: "ev2", evidence: { indicatorId: "ind1" } },
  ]
  const linked = new Map([["ind1", [{
    id: "sv1", type: "المعلمون", percentage: 60, respondents: 10, include: true,
  }]]])
  const { rows } = buildItemComparison({
    officialDomains,
    verifiedResponses,
    linkedSurveysByIndicator: linked,
    config: null,
  })
  assert.equal(rows.length, 1)
  // 2 شاهد مميز من 4 مطلوبة = 50% — وليس 4 صفوف من 4 = 100%
  assert.equal(rows[0].verifiedResponsesCount, 2)
  assert.equal(rows[0].directScore, 50)
})

test("the same assessment result feeds card overall and domain chart (single source)", () => {
  const f = buildIdentifiedFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 8 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 7 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: 5 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 6 }] },
  ])
  const r = computeAssessmentWeightedResult(f.domains, f.responses)
  // البطاقة (overall) والرسوم (domains) من نفس الكائن — لا حساب موازٍ
  const weighted = computeWeightedOverall(r.domains.filter(d => d.matched).map(d => ({ key: d.key as string, score: d.score })))
  assert.equal(weighted.overall, r.overall)
})

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)