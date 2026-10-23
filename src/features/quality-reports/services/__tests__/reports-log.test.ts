// ===== FILE: src/features/quality-reports/services/__tests__/reports-log.test.ts =====
// ============================================================
// Automated tests — Reports Log (إعادة تصميم سجل التقارير)
// Run:  npx tsx src/features/quality-reports/services/__tests__/reports-log.test.ts
// Pure modules under test (zero server imports) — no database needed.
// ============================================================
// يغطي:
//  1) عدّاد الشواهد المميزة لكل تقييم — نفس دلالة countDistinctVerifiedEvidence
//     (تكرار الزيارة لنفس الشاهد لا يُعدّ مرتين + عزل التقييمات عن بعضها)
//  2) درجة التقييم — نفس معادلة الصفحة المعتمدة حرفيًا (بما فيها تقريب round)
//  3) أرقام الملخص — الجارية لا تُعتبر نتائج مكتملة (لا تدخل المتوسط ولا
//     عدّاد «تحتاج إلى تحسين»)، والحد المعتمد 90 من threshold.ts بلا حد جديد
//  4) البحث النصي q — تحليل آمن + شرط OR على المدرسة/الفرع/المقيّم + تمريره
//     في معاملات الرابط + بلا أي مفتاح إضافي حين لا يوجد (لا كسر للقائم)
// ============================================================
import assert from "node:assert/strict"
import {
  countDistinctVerifiedByAssessment,
  assessmentVerificationScore,
  computeReportsLogKpis,
  type VerifiedPairRow,
  type AssessmentStatusRow,
} from "../reports-log"
import { SUSTAINABILITY_THRESHOLD } from "@/features/improvement-plans/threshold"
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
    console.error(err)
  }
}

console.log("\n=== 1) Distinct verified evidence per assessment (same semantics as the approved counter) ===")

test("repeated visits to the same evidence count once — duplicates collapse", () => {
  const pairs: VerifiedPairRow[] = [
    { assessmentId: "a1", evidenceId: "e1" },
    { assessmentId: "a1", evidenceId: "e1" },
    { assessmentId: "a1", evidenceId: "e1" },
    { assessmentId: "a1", evidenceId: "e2" },
  ]
  const counts = countDistinctVerifiedByAssessment(pairs)
  assert.equal(counts.get("a1"), 2)
})

test("assessments stay isolated — no cross-assessment counting", () => {
  const pairs: VerifiedPairRow[] = [
    { assessmentId: "a1", evidenceId: "e1" },
    { assessmentId: "a2", evidenceId: "e1" },
    { assessmentId: "a2", evidenceId: "e2" },
  ]
  const counts = countDistinctVerifiedByAssessment(pairs)
  assert.equal(counts.get("a1"), 1)
  assert.equal(counts.get("a2"), 2)
})

test("empty pairs → empty map (no fabricated counts)", () => {
  assert.equal(countDistinctVerifiedByAssessment([]).size, 0)
})

console.log("\n=== 2) Per-assessment score — the page's exact approved formula ===")

test("score = round(verified / total * 100) — identical to the page", () => {
  assert.equal(assessmentVerificationScore(90, 100), 90)
  assert.equal(assessmentVerificationScore(9, 10), 90)
  // التقريب نفسه: 89.4 → 89 و 89.9 → 90 (الرقم المعروض هو نفسه المُحكَم عليه)
  assert.equal(assessmentVerificationScore(894, 1000), 89)
  assert.equal(assessmentVerificationScore(899, 1000), 90)
})

test("zero-total evidence bank → 0 (same as the page, no division by zero)", () => {
  assert.equal(assessmentVerificationScore(0, 0), 0)
  assert.equal(assessmentVerificationScore(10, 0), 0)
})

console.log("\n=== 3) Reports log KPIs — in-progress is never a completed result ===")

test("mixed statuses: only completed enter the average and the needs-improvement counter", () => {
  const statuses: AssessmentStatusRow[] = [
    { id: "done-high", status: "COMPLETED" }, // 899/1000 → 90 (على الحد — ليس أقل منه)
    { id: "done-low", status: "COMPLETED" },  // 894/1000 → 89 (أقل من الحد)
    { id: "running", status: "IN_PROGRESS" }, // شواهد كثيرة لكن لا تُحتسب نتيجة
  ]
  // أزواج شواهد مميزة فعّالة بعدد النسب المطلوبة (e0..e898 / e0..e893)
  const pairs: VerifiedPairRow[] = [
    ...Array.from({ length: 899 }, (_, i) => ({ assessmentId: "done-high", evidenceId: `e${i}` })),
    ...Array.from({ length: 894 }, (_, i) => ({ assessmentId: "done-low", evidenceId: `e${i}` })),
    { assessmentId: "running", evidenceId: "e1" },
    { assessmentId: "running", evidenceId: "e2" },
    { assessmentId: "running", evidenceId: "e3" },
  ]
  const kpis = computeReportsLogKpis({
    statuses,
    verifiedPairs: pairs,
    totalEvidence: 1000,
    linkedPlans: 2,
  })
  assert.equal(kpis.total, 3)
  assert.equal(kpis.completed, 2)
  assert.equal(kpis.inProgress, 1)
  assert.equal(kpis.scoredCompleted, 2)
  assert.equal(kpis.avgVerification, Math.round((90 + 89) / 2)) // 90
  assert.equal(kpis.needsImprovement, 1) // المكتملة أقل من الحد فقط
  assert.equal(kpis.linkedPlans, 2)
})

test("threshold comes from the single approved source (90) — boundary is exclusive", () => {
  assert.equal(SUSTAINABILITY_THRESHOLD, 90)
  const statuses: AssessmentStatusRow[] = [
    { id: "at", status: "COMPLETED" },    // 9/10 → 90 بالضبط → ليس «تحتاج تحسين»
    { id: "below", status: "COMPLETED" }, // 8/10 → 80 → تحتاج تحسين
  ]
  const pairs: VerifiedPairRow[] = [
    ...Array.from({ length: 9 }, (_, i) => ({ assessmentId: "at", evidenceId: `e${i}` })),
    ...Array.from({ length: 8 }, (_, i) => ({ assessmentId: "below", evidenceId: `e${i}` })),
  ]
  const kpis = computeReportsLogKpis({
    statuses,
    verifiedPairs: pairs,
    totalEvidence: 10,
    linkedPlans: 0,
  })
  assert.equal(kpis.needsImprovement, 1)
})

test("no completed assessments → avg null (never fabricated) and needs-improvement 0", () => {
  const kpis = computeReportsLogKpis({
    statuses: [{ id: "running", status: "IN_PROGRESS" }],
    verifiedPairs: [{ assessmentId: "running", evidenceId: "e1" }],
    totalEvidence: 50,
    linkedPlans: 0,
  })
  assert.equal(kpis.avgVerification, null)
  assert.equal(kpis.needsImprovement, 0)
  assert.equal(kpis.scoredCompleted, 0)
  assert.equal(kpis.inProgress, 1)
})

test("in-progress assessments with many verified evidence still score nothing in KPIs", () => {
  const kpis = computeReportsLogKpis({
    statuses: [
      { id: "running", status: "IN_PROGRESS" },
      { id: "done", status: "COMPLETED" },
    ],
    verifiedPairs: [
      ...Array.from({ length: 40 }, (_, i) => ({ assessmentId: "running", evidenceId: `e${i}` })),
      { assessmentId: "done", evidenceId: "e0" },
    ],
    totalEvidence: 50,
    linkedPlans: 0,
  })
  // الجارية 80% شواهد لكنها ليست نتيجة مكتملة — لا تدخل المتوسط إطلاقًا
  assert.equal(kpis.inProgress, 1)
  assert.equal(kpis.scoredCompleted, 1)
  assert.equal(kpis.avgVerification, 2) // المكتملة وحدها: 1/50 → 2%
  assert.equal(kpis.needsImprovement, 1)
})

test("empty scope → all zeros with null average (no invented numbers)", () => {
  const kpis = computeReportsLogKpis({
    statuses: [],
    verifiedPairs: [],
    totalEvidence: 100,
    linkedPlans: 0,
  })
  assert.deepEqual(kpis, {
    total: 0,
    completed: 0,
    inProgress: 0,
    avgVerification: null,
    scoredCompleted: 0,
    needsImprovement: 0,
    linkedPlans: 0,
  })
})

console.log("\n=== 4) Free-text search (q) — narrowing only, same contract as other filters ===")

test("q parses trimmed and is ignored when empty/tampered", () => {
  assert.equal(resolveReportFilters({ q: "  النور  " }).q, "النور")
  assert.equal(resolveReportFilters({ q: "   " }).q, undefined)
  assert.equal(resolveReportFilters({}).q, undefined)
})

test("q builds an OR over school/branch/assessor names AND-composed with the other filters", () => {
  const filters = resolveReportFilters({ q: "النور", schoolId: "school-1", status: "ALL" })
  const w = buildReportFilterWhere(filters)
  assert.equal(w.schoolId, "school-1")
  assert.equal(w.OR?.length, 3)
  assert.deepEqual(w.OR?.[0], { school: { name: { contains: "النور", mode: "insensitive" } } })
  assert.deepEqual(w.OR?.[1], { branch: { name: { contains: "النور", mode: "insensitive" } } })
  assert.deepEqual(w.OR?.[2], { assessor: { name: { contains: "النور", mode: "insensitive" } } })
})

test("no q → the where keeps its previous exact shape (no extra keys — existing tests unchanged)", () => {
  const w = buildReportFilterWhere(resolveReportFilters({ schoolId: "school-1" }))
  assert.deepEqual(w, { schoolId: "school-1" })
  assert.deepEqual(buildReportFilterWhere(resolveReportFilters({})), {})
})

test("q travels through link params and query string (print/export stay consistent with the list)", () => {
  const filters = resolveReportFilters({ q: "النور", from: "2025-01-15" })
  const params = reportFiltersToParams(filters)
  assert.equal(params.q, "النور")
  assert.equal(params.from, "2025-01-15")
  const qs = reportFiltersToQueryString(filters)
  assert.ok(qs.includes("q="))
  const back = resolveReportFilters(Object.fromEntries(new URLSearchParams(qs)))
  assert.equal(back.q, "النور")
  assert.equal(back.from?.toISOString(), "2025-01-15T00:00:00.000Z")
})

// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)