// ===== FILE: src/features/quality-reports/services/__tests__/weighted-score.test.ts =====
// ============================================================
// Automated tests — Weighted School Evaluation Scoring
// Run:  npx tsx src/features/quality-reports/services/__tests__/weighted-score.test.ts
// Pure module under test (zero imports) — no database needed.
// ============================================================
import assert from "node:assert/strict"
import {
  SCHOOL_EVALUATION_DOMAINS,
  PERFORMANCE_LEVELS,
  validateDomainWeights,
  classifyPerformance,
  normalizeArabicName,
  matchDomainConfig,
  computePercentage,
  computeWeightedOverall,
  computeAssessmentWeightedResult,
  averageWeightedOveralls,
  aggregateDomainScores,
  type OfficialDomainInput,
  type EvidenceRowInput,
} from "../weighted-score"

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
// Helpers to build framework/assessment fixtures
// ------------------------------------------------------------
interface AxisSpec { name: string; evidence: number; verified: number }
interface DomainSpec { name: string; axes: AxisSpec[] }

function buildFixtures(specs: DomainSpec[]): {
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
      const evidenceIds: unknown[] = []
      for (let i = 0; i < axis.evidence; i++) evidenceIds.push(`ev:${evSeq++}`)
      indicators.push({
        id: `ind:${domainId}:${axisId}`,
        domainId,
        axisId,
        axis: { name: axis.name },
        fixedEvidence: evidenceIds,
      })
      for (let i = 0; i < axis.verified && i < axis.evidence; i++) {
        responses.push({ evidence: { indicator: { domainId, axisId } } })
      }
    }
    domains.push({ id: domainId, name: spec.name, indicators })
  }
  return { domains, responses }
}

console.log("\n=== 1) Weights configuration ===")

test("weights are exactly 20% / 30% / 40% / 10% and total 100%", () => {
  assert.equal(SCHOOL_EVALUATION_DOMAINS.length, 4)
  assert.equal(SCHOOL_EVALUATION_DOMAINS[0].key, "SCHOOL_LEADERSHIP")
  assert.equal(SCHOOL_EVALUATION_DOMAINS[0].weight, 0.2)
  assert.equal(SCHOOL_EVALUATION_DOMAINS[1].weight, 0.3)
  assert.equal(SCHOOL_EVALUATION_DOMAINS[2].weight, 0.4)
  assert.equal(SCHOOL_EVALUATION_DOMAINS[3].weight, 0.1)
  const { total, valid } = validateDomainWeights()
  assert.equal(total, 1)
  assert.equal(valid, true)
})

console.log("\n=== 2) Official worked example (§3.1) ===")

test("80/70/75/60 with official weights → 73.0 (not 71.25 unweighted average)", () => {
  const { overall } = computeWeightedOverall([
    { key: "SCHOOL_LEADERSHIP", score: 80 },
    { key: "TEACHING_AND_LEARNING", score: 70 },
    { key: "LEARNING_OUTCOMES", score: 75 },
    { key: "SCHOOL_ENVIRONMENT", score: 60 },
  ])
  assert.equal(overall, 73)
  // explicit unweighted-average rejection: (80+70+75+60)/4 = 71.25 → 71
  assert.notEqual(overall, 71)
})

test("weights are applied exactly once (no double application)", () => {
  // If weights were applied twice the result would be ≈ 55.3, not 73.
  const { overall } = computeWeightedOverall([
    { key: "SCHOOL_LEADERSHIP", score: 80 },
    { key: "TEACHING_AND_LEARNING", score: 70 },
    { key: "LEARNING_OUTCOMES", score: 75 },
    { key: "SCHOOL_ENVIRONMENT", score: 60 },
  ])
  assert.notEqual(overall, 55)
  assert.equal(overall, 73)
})

test("missing domain score → overall null (no silent fabrication)", () => {
  const { overall, missing } = computeWeightedOverall([
    { key: "SCHOOL_LEADERSHIP", score: 80 },
    { key: "TEACHING_AND_LEARNING", score: 70 },
    { key: "LEARNING_OUTCOMES", score: null },
    { key: "SCHOOL_ENVIRONMENT", score: 60 },
  ])
  assert.equal(overall, null)
  assert.deepEqual(missing, ["LEARNING_OUTCOMES"])
})

console.log("\n=== 3) Performance levels (client-supplied thresholds) ===")

test("level labels and order are التميز / التقدم / الانطلاق / التهيئة", () => {
  assert.deepEqual(
    PERFORMANCE_LEVELS.map(l => l.label),
    ["التميز", "التقدم", "الانطلاق", "التهيئة"]
  )
})

test("threshold boundaries: 90→التميز, 89→التقدم, 75→التقدم, 74→الانطلاق, 50→الانطلاق, 49→التهيئة", () => {
  assert.equal(classifyPerformance(90)?.label, "التميز")
  assert.equal(classifyPerformance(100)?.label, "التميز")
  assert.equal(classifyPerformance(89)?.label, "التقدم")
  assert.equal(classifyPerformance(75)?.label, "التقدم")
  assert.equal(classifyPerformance(74)?.label, "الانطلاق")
  assert.equal(classifyPerformance(50)?.label, "الانطلاق")
  assert.equal(classifyPerformance(49)?.label, "التهيئة")
  assert.equal(classifyPerformance(0)?.label, "التهيئة")
})

test("null / out-of-range → no fabricated classification", () => {
  assert.equal(classifyPerformance(null), null)
  assert.equal(classifyPerformance(undefined), null)
  assert.equal(classifyPerformance(-1), null)
  assert.equal(classifyPerformance(101), null)
})

test("level descriptions match the official specification verbatim", () => {
  assert.equal(
    PERFORMANCE_LEVELS[0].description,
    "الأداء مرتفع، بمستوى 90% فأعلى، ويتطلب استدامة التميز والابتكار."
  )
  assert.equal(
    PERFORMANCE_LEVELS[1].description,
    "الأداء بين 75% وأقل من 90%، ويحتاج إلى الاستمرار والمتابعة والتحسين والتطوير."
  )
  assert.equal(
    PERFORMANCE_LEVELS[2].description,
    "الأداء بين 50% وأقل من 75%، ويحتاج إلى تحسينات كبيرة في بعض المجالات."
  )
  assert.equal(
    PERFORMANCE_LEVELS[3].description,
    "الأداء أقل من 50%، ويحتاج إلى تدخلات جوهرية للتحسين في معظم مجالات التقويم."
  )
})

console.log("\n=== 4) Arabic name normalization & domain matching ===")

test("normalization strips diacritics, tatweel, spaces, parentheses", () => {
  assert.equal(normalizeArabicName("الإدارة (القيادة) المدرسية"), normalizeArabicName("الاداره القياده المدرسيه"))
  assert.equal(normalizeArabicName("التعليم والتعلم"), normalizeArabicName("اَلتَّعْلِيم وَالتَّعَلُّم"))
  assert.equal(normalizeArabicName("الـتـمـيـز"), normalizeArabicName("التميز"))
})

test("both spec spellings of the leadership domain match one config", () => {
  const a = matchDomainConfig("الإدارة (القيادة) المدرسية")
  const b = matchDomainConfig("الإدارة المدرسية")
  assert.equal(a?.key, "SCHOOL_LEADERSHIP")
  assert.equal(b?.key, "SCHOOL_LEADERSHIP")
})

test("all four canonical domain names match", () => {
  assert.equal(matchDomainConfig("التعليم والتعلم")?.key, "TEACHING_AND_LEARNING")
  assert.equal(matchDomainConfig("نواتج التعلم")?.key, "LEARNING_OUTCOMES")
  assert.equal(matchDomainConfig("البيئة المدرسية")?.key, "SCHOOL_ENVIRONMENT")
})

test("unknown domain name → null (no guessing)", () => {
  assert.equal(matchDomainConfig("مجال غير معروف"), null)
  assert.equal(matchDomainConfig(""), null)
})

console.log("\n=== 5) Unit scores — existing methodology preserved ===")

test("verified ÷ required × 100 with platform rounding", () => {
  assert.equal(computePercentage(8, 10), 80)
  assert.equal(computePercentage(1, 3), 33)
  assert.equal(computePercentage(0, 10), 0)
})

test("zero required evidence → null (never fabricated as 0 or 100)", () => {
  assert.equal(computePercentage(0, 0), null)
  assert.equal(computePercentage(5, 0), null)
})

console.log("\n=== 6) Full assessment orchestration ===")

test("official example end-to-end through computeAssessmentWeightedResult → 73", () => {
  const { domains, responses } = buildFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 25, verified: 20 }] }, // 80
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 20, verified: 14 }] }, // 70
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 20, verified: 15 }] }, // 75
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 6 }] }, // 60
  ])
  const result = computeAssessmentWeightedResult(domains, responses)
  assert.equal(result.overall, 73)
  assert.equal(result.classification?.label, "الانطلاق")
  assert.equal(result.diagnostics.unmatchedConfigs.length, 0)
  assert.equal(result.diagnostics.extraDomains.length, 0)
  // domain scores & weights exposed for the card
  const byKey = new Map(result.domains.map(d => [d.key, d]))
  assert.equal(byKey.get("SCHOOL_LEADERSHIP")?.weight, 0.2)
  assert.equal(byKey.get("SCHOOL_LEADERSHIP")?.score, 80)
})

test("criteria (axis) scores computed independently per axis", () => {
  const { domains, responses } = buildFixtures([
    {
      name: "الإدارة المدرسية",
      axes: [
        { name: "التخطيط", evidence: 10, verified: 8 }, // 80
        { name: "المجتمع المدرسي", evidence: 10, verified: 2 }, // 20
      ],
    },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 10 }] }, // 100
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: 5 }] }, // 50
    { name: "البيئة المدرسية", axes: [{ name: "الأمن والسلامة", evidence: 10, verified: 7 }] }, // 70
  ])
  const result = computeAssessmentWeightedResult(domains, responses)
  const leadership = result.criteriaGroups.find(g => g.domainName === "الإدارة المدرسية")
  assert.equal(leadership?.criteria.length, 2)
  assert.deepEqual(
    leadership?.criteria.map(c => c.score),
    [80, 20]
  )
  // domain score aggregates its axes: (8+2)/(10+10) = 50
  assert.equal(leadership?.score, 50)
  // weighted overall from domain scores 50/100/50/70 → 50×.2+100×.3+50×.4+70×.1 = 67
  assert.equal(result.overall, 67)
})

test("domain with zero required evidence → overall null + transparent diagnostics", () => {
  const { domains, responses } = buildFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 8 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 7 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 0, verified: 0 }] }, // no evidence defined
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 6 }] },
  ])
  const result = computeAssessmentWeightedResult(domains, responses)
  assert.equal(result.overall, null)
  assert.equal(result.classification, null)
  assert.ok(result.diagnostics.missingDataDomains.includes("نواتج التعلم"))
})

test("unmatched stored domain name → overall null + unmatchedConfigs diagnostic", () => {
  const { domains, responses } = buildFixtures([
    { name: "مجال منظمات مختلف", axes: [{ name: "محور", evidence: 10, verified: 5 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 7 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: 5 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 6 }] },
  ])
  const result = computeAssessmentWeightedResult(domains, responses)
  assert.equal(result.overall, null)
  assert.ok(result.diagnostics.unmatchedConfigs.includes("SCHOOL_LEADERSHIP"))
})

test("extra stored domain beyond the four → listed transparently, excluded from weighting", () => {
  const { domains, responses } = buildFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 8 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 7 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: 5 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 6 }] },
    { name: "مجال إضافي", axes: [{ name: "محور إضافي", evidence: 10, verified: 0 }] }, // 0% — must not drag overall
  ])
  const result = computeAssessmentWeightedResult(domains, responses)
  assert.ok(result.diagnostics.extraDomains.includes("مجال إضافي"))
  // base domains 80/70/50/60 → 80×.2+70×.3+50×.4+60×.1 = 63 — the extra 0% domain must not drag it
  assert.equal(result.overall, 63)
  const extra = result.domains.find(d => d.name === "مجال إضافي")
  assert.equal(extra?.weight, null)
  assert.equal(extra?.matched, false)
})

test("assessments are computed independently — no cross-assessment aggregation", () => {
  const a1 = buildFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 10 }] }, // 100
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 10 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: 10 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 10 }] },
  ])
  const a2 = buildFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 0 }] }, // 0
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 0 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: 0 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 0 }] },
  ])
  const r1 = computeAssessmentWeightedResult(a1.domains, a1.responses)
  const r2 = computeAssessmentWeightedResult(a2.domains, a2.responses)
  assert.equal(r1.overall, 100)
  assert.equal(r2.overall, 0)
  // responses of assessment 2 must not leak into assessment 1
  assert.equal(r1.domains[0].verified, 10)
  assert.equal(r2.domains[0].verified, 0)
})

console.log("\n=== 7) Aggregation across assessments (stage panels / cards) ===")

test("averageWeightedOveralls averages independent results and reports skips", () => {
  const build = (verifiedRatio: number) => {
    const f = buildFixtures([
      { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: Math.round(10 * verifiedRatio) }] },
      { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: Math.round(10 * verifiedRatio) }] },
      { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: Math.round(10 * verifiedRatio) }] },
      { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: Math.round(10 * verifiedRatio) }] },
    ])
    return computeAssessmentWeightedResult(f.domains, f.responses)
  }
  const missing = buildFixtures([
    { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: 5 }] },
    { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: 5 }] },
    { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 0, verified: 0 }] },
    { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: 5 }] },
  ])
  const results = [build(1), build(0.5), build(0), computeAssessmentWeightedResult(missing.domains, missing.responses)]
  const agg = averageWeightedOveralls(results)
  assert.equal(agg.counted, 3)
  assert.equal(agg.skipped, 1)
  assert.equal(agg.average, Math.round((100 + 50 + 0) / 3)) // 50
})

test("aggregateDomainScores averages per domain across assessments", () => {
  const build = (v: number) => {
    const f = buildFixtures([
      { name: "الإدارة المدرسية", axes: [{ name: "التخطيط", evidence: 10, verified: v }] },
      { name: "التعليم والتعلم", axes: [{ name: "بناء خبرات التعلم", evidence: 10, verified: v }] },
      { name: "نواتج التعلم", axes: [{ name: "التحصيل التعليمي", evidence: 10, verified: v }] },
      { name: "البيئة المدرسية", axes: [{ name: "المبنى المدرسي", evidence: 10, verified: v }] },
    ])
    return computeAssessmentWeightedResult(f.domains, f.responses)
  }
  const agg = aggregateDomainScores([build(8), build(4)])
  assert.equal(agg.length, 4)
  assert.equal(agg[0].score, 60) // (80 + 40) / 2
  assert.equal(agg[0].weight, 0.2)
})

test("aggregateDomainScores with no results → empty array", () => {
  assert.deepEqual(aggregateDomainScores([]), [])
})

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)