// ===== FILE: src/features/quality-reports/services/__tests__/survey-integration.test.ts =====
// ============================================================
// اختبارات survey-integration — تُشغَّل بـ: npx tsx <هذا الملف>
// لا prisma ولا Next — الخدمة النقية فقط (نفس نمط weighted-score.test.ts)
// ============================================================

import {
  validateWeights,
  weightsLabel,
  computeCombinedScore,
  summarizeSurveysForIndicator,
  buildItemComparison,
  combinedStatusLabel,
  type LinkedSurveyInput,
  type SurveyIntegrationConfigSnapshot,
  type ComparisonDomainInput,
} from "../survey-integration"

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

console.log("=== 1) التحقق من الأوزان validateWeights ===")
test("أوزان صالحة 50/50", () => {
  expect(validateWeights(0.5, 0.5).valid)
})
test("أوزان صالحة 70/30", () => {
  expect(validateWeights(0.7, 0.3).valid)
})
test("أوزان عشرية مجموعها 1 صالحة", () => {
  expect(validateWeights(0.65, 0.35).valid)
})
test("المجموع ≠ 100% مرفوض", () => {
  const r = validateWeights(0.6, 0.3)
  expect(!r.valid && r.reason !== null)
})
test("وزن 0 مرفوض (لا دمج أحادي)", () => {
  expect(!validateWeights(1, 0).valid)
  expect(!validateWeights(0, 1).valid)
})
test("وزن 100% لطرف واحد مرفوض", () => {
  expect(!validateWeights(1.0, 0.0).valid)
})
test("قيم غير منتهية مرفوضة", () => {
  expect(!validateWeights(NaN, 0.5).valid)
  expect(!validateWeights(0.5, Infinity).valid)
})
test("وزن سالب مرفوض", () => {
  expect(!validateWeights(-0.2, 1.2).valid)
})

console.log("=== 2) نص الأوزان ===")
test("weightsLabel يعرض الوزنين", () => {
  expectEqual(weightsLabel(0.7, 0.3), "أدوات التقييم 70% • الاستبانة 30%")
})

console.log("=== 3) النتيجة المدمجة computeCombinedScore ===")
test("80 و60 بأوزان 50/50 → 70", () => {
  expectEqual(computeCombinedScore(80, 60, 0.5, 0.5), 70)
})
test("80 و60 بأوزان 70/30 → 74", () => {
  expectEqual(computeCombinedScore(80, 60, 0.7, 0.3), 74)
})
test("الوزن يُطبَّق مرة واحدة بالضبط (مثال الحدود)", () => {
  // 100 و0 بأوزان 70/30 → 70 بالضبط (أي إعادة وزن ستعطي رقماً مختلفاً)
  expectEqual(computeCombinedScore(100, 0, 0.7, 0.3), 70)
})
test("التقريب مرة واحدة: 75 و68 بـ 50/50 → 72 (71.5 مقرَّب)", () => {
  expectEqual(computeCombinedScore(75, 68, 0.5, 0.5), 72)
})
test("درجة ناقصة → null بلا اختراع", () => {
  expectEqual(computeCombinedScore(80, null, 0.5, 0.5), null)
  expectEqual(computeCombinedScore(null, 60, 0.5, 0.5), null)
})
test("أوزان غير صالحة → null حتى لو الدرجات موجودة", () => {
  expectEqual(computeCombinedScore(80, 60, 0.9, 0.2), null)
})

console.log("=== 4) تلخيص استبانات بند summarizeSurveysForIndicator ===")
test("استبانة صالحة (include=true ونسبة 0..100) تُحتسب", () => {
  const r = summarizeSurveysForIndicator([
    { id: "s1", type: "استبانة الطلاب", percentage: 80, respondents: 50, include: true },
  ])
  expectEqual(r.surveyScore, 80)
  expectEqual(r.usable.length, 1)
  expectEqual(r.totalRespondents, 50)
})
test("متوسط عدة استبانات صالحة بمنهجية المنصة (Math.round)", () => {
  const r = summarizeSurveysForIndicator([
    { id: "s1", type: "أ", percentage: 80, respondents: null, include: true },
    { id: "s2", type: "ب", percentage: 65, respondents: null, include: true },
  ])
  expectEqual(r.surveyScore, 73) // (80+65)/2 = 72.5 → 73
})
test("استبانة include=false تُستبعد بسبب ظاهر (الدلالة القائمة للعلم)", () => {
  const r = summarizeSurveysForIndicator([
    { id: "s1", type: "أ", percentage: 90, respondents: null, include: false },
  ])
  expectEqual(r.surveyScore, null)
  expectEqual(r.usages[0].used, false)
  expect(r.usages[0].reason !== null)
})
test("نسبة خارج 0..100 تُستبعد ولا تُعدَّل (قيمة تاريخية كما هي)", () => {
  const r = summarizeSurveysForIndicator([
    { id: "s1", type: "أ", percentage: 120, respondents: null, include: true },
    { id: "s2", type: "ب", percentage: -5, respondents: null, include: true },
  ])
  expectEqual(r.surveyScore, null)
  expectEqual(r.usages.filter(u => !u.used).length, 2)
})
test("المستبعد لا يسحب المتوسط لأسفل", () => {
  const r = summarizeSurveysForIndicator([
    { id: "s1", type: "أ", percentage: 90, respondents: null, include: true },
    { id: "s2", type: "ب", percentage: 10, respondents: null, include: false }, // مستبعدة
  ])
  expectEqual(r.surveyScore, 90)
})
test("تكرار المعرف لا يُحتسب مرتين (لا ازدواج)", () => {
  const r = summarizeSurveysForIndicator([
    { id: "s1", type: "أ", percentage: 80, respondents: 10, include: true },
    { id: "s1", type: "أ", percentage: 80, respondents: 10, include: true },
  ])
  expectEqual(r.surveyScore, 80)
  expectEqual(r.totalRespondents, 10) // لو حُسبت مرتين لصارت 20
})
test("قائمة فارغة → null بلا أرقام مصنوعة", () => {
  const r = summarizeSurveysForIndicator([])
  expectEqual(r.surveyScore, null)
  expectEqual(r.totalRespondents, null)
})
test("لا استبانة مسجّل لها عدد → totalRespondents null (لا صفر زائف)", () => {
  const r = summarizeSurveysForIndicator([
    { id: "s1", type: "أ", percentage: 80, respondents: null, include: true },
  ])
  expectEqual(r.totalRespondents, null)
})
test("عدد استجابات جزئي يُعلَّم respondentsPartial", () => {
  const r = summarizeSurveysForIndicator([
    { id: "s1", type: "أ", percentage: 80, respondents: 40, include: true },
    { id: "s2", type: "ب", percentage: 60, respondents: null, include: true },
  ])
  expectEqual(r.totalRespondents, 40)
  expectEqual(r.respondentsPartial, true)
})

console.log("=== 5) بناء مقارنة البنود buildItemComparison ===")

const domains: ComparisonDomainInput[] = [
  {
    id: "d1", name: "نواتج التعلم",
    indicators: [
      { id: "i1", code: "NO-01", description: "بند له استبانة", fixedEvidence: [1, 2, 3, 4] },
      { id: "i2", code: "NO-02", description: "بند بلا استبانات", fixedEvidence: [1, 2] },
      { id: "i3", code: "NO-03", description: "بند مرتبط بلا شواهد معرّفة", fixedEvidence: [] },
    ],
  },
]

const responsesFor = (counts: Record<string, number>) => {
  const out: { evidence: { indicatorId: string } }[] = []
  for (const [indId, n] of Object.entries(counts)) {
    for (let k = 0; k < n; k++) out.push({ evidence: { indicatorId: indId } })
  }
  return out
}

const surveysByIndicator = new Map<string, LinkedSurveyInput[]>([
  ["i1", [
    { id: "s1", type: "استبانة الطلاب", percentage: 80, respondents: 120, include: true },
    { id: "s2", type: "استبانة المعلمين", percentage: 70, respondents: null, include: true },
    { id: "s3", type: "استبانة أولياء الأمور", percentage: 95, respondents: null, include: false },
  ]],
  ["i3", [{ id: "s4", type: "استبانة الطلاب", percentage: 60, respondents: null, include: true }]],
])

test("صف فقط للبنود المرتبطة — البند غير المرتبط لا يظهر", () => {
  const r = buildItemComparison({ officialDomains: domains, verifiedResponses: [], linkedSurveysByIndicator: surveysByIndicator, config: null })
  expectEqual(r.rows.map(x => x.indicatorId), ["i1", "i3"])
})
test("درجة الأدوات بنفس معادلة جداول المجالات حرفيًا (2 من 4 → 50)", () => {
  const r = buildItemComparison({ officialDomains: domains, verifiedResponses: responsesFor({ i1: 2 }), linkedSurveysByIndicator: surveysByIndicator, config: null })
  const row = r.rows.find(x => x.indicatorId === "i1")!
  expectEqual(row.directScore, 50)
  expectEqual(row.requiredEvidence, 4)
  expectEqual(row.verifiedResponsesCount, 2)
})
test("بلا إعداد → المدمجة null وحالتها «غير مُهيَّأة» والنتيجتان ظاهرتان", () => {
  const r = buildItemComparison({ officialDomains: domains, verifiedResponses: responsesFor({ i1: 2 }), linkedSurveysByIndicator: surveysByIndicator, config: null })
  const row = r.rows.find(x => x.indicatorId === "i1")!
  expectEqual(row.directScore, 50)
  expectEqual(row.surveyScore, 75) // (80+70)/2 = 75 — المستبعدة (include=false) لا تدخل
  expectEqual(row.combined, null)
  expectEqual(row.combinedStatus, "NOT_CONFIGURED")
  expectEqual(row.usableSurveyCount, 2)
})
test("بإعداد معتمد 70/30 → المدمجة = round(0.7×50 + 0.3×75) = 58 مع سجل تدقيق", () => {
  const config: SurveyIntegrationConfigSnapshot = {
    id: "cfg1", schoolId: "sc1", toolWeight: 0.7, surveyWeight: 0.3,
    method: "WEIGHTED_AVERAGE", note: null, approvedByName: "مدير المدرسة", updatedAt: "2026-01-15T00:00:00.000Z",
  }
  const r = buildItemComparison({ officialDomains: domains, verifiedResponses: responsesFor({ i1: 2 }), linkedSurveysByIndicator: surveysByIndicator, config })
  const row = r.rows.find(x => x.indicatorId === "i1")!
  expectEqual(row.combined, 58)
  expectEqual(row.combinedStatus, "CONFIGURED")
  expectEqual(row.weightsLabel, "أدوات التقييم 70% • الاستبانة 30%")
  expect(row.auditNote!.includes("متوسط مرجّح"))
  expect(row.auditNote!.includes("مدير المدرسة"))
})
test("إعداد مخزن غير صالح (المجموع ≠ 100%) → INVALID_CONFIG ولا رقم مدمج", () => {
  const bad = { id: "cfg1", schoolId: "sc1", toolWeight: 0.9, surveyWeight: 0.2, method: "WEIGHTED_AVERAGE", note: null, approvedByName: null, updatedAt: "2026-01-15T00:00:00.000Z" } as SurveyIntegrationConfigSnapshot
  const r = buildItemComparison({ officialDomains: domains, verifiedResponses: responsesFor({ i1: 2 }), linkedSurveysByIndicator: surveysByIndicator, config: bad })
  expectEqual(r.diagnostics.invalidConfig, true)
  const row = r.rows.find(x => x.indicatorId === "i1")!
  expectEqual(row.combined, null)
  expectEqual(row.combinedStatus, "INVALID_CONFIG")
  expectEqual(row.directScore, 50) // الرسمية تظل كما هي
})
test("إعداد صالح لكن لا استبانة صالحة → NO_SURVEY_DATA بلا رقم", () => {
  const config: SurveyIntegrationConfigSnapshot = { id: "c", schoolId: "sc", toolWeight: 0.5, surveyWeight: 0.5, method: "WEIGHTED_AVERAGE", note: null, approvedByName: null, updatedAt: "2026-01-01T00:00:00.000Z" }
  const onlyExcluded = new Map<string, LinkedSurveyInput[]>([["i1", [{ id: "s3", type: "أ", percentage: 95, respondents: null, include: false }]]])
  const r = buildItemComparison({ officialDomains: domains, verifiedResponses: responsesFor({ i1: 2 }), linkedSurveysByIndicator: onlyExcluded, config })
  const row = r.rows.find(x => x.indicatorId === "i1")!
  expectEqual(row.combined, null)
  expectEqual(row.combinedStatus, "NO_SURVEY_DATA")
})
test("بند مرتبط بلا شواهد معرّفة → درجة الأدوات null وحالتها NO_TOOL_DATA (لا صفر زائف)", () => {
  const config: SurveyIntegrationConfigSnapshot = { id: "c", schoolId: "sc", toolWeight: 0.5, surveyWeight: 0.5, method: "WEIGHTED_AVERAGE", note: null, approvedByName: null, updatedAt: "2026-01-01T00:00:00.000Z" }
  const r = buildItemComparison({ officialDomains: domains, verifiedResponses: [], linkedSurveysByIndicator: surveysByIndicator, config })
  const row = r.rows.find(x => x.indicatorId === "i3")!
  expectEqual(row.directScore, null)
  expectEqual(row.combined, null)
  expectEqual(row.combinedStatus, "NO_TOOL_DATA")
})
test("عدد الاستجابات يُجمع من المسجل فقط مع تعليم الجزئي", () => {
  const r = buildItemComparison({ officialDomains: domains, verifiedResponses: [], linkedSurveysByIndicator: surveysByIndicator, config: null })
  const row = r.rows.find(x => x.indicatorId === "i1")!
  expectEqual(row.totalRespondents, 120)
  expectEqual(row.respondentsPartial, true) // s2 بلا عدد
})
test("استقلالية التقييمات: نفس البند بنسب أدوات مختلفة في تقييمين مختلفين", () => {
  const config: SurveyIntegrationConfigSnapshot = { id: "c", schoolId: "sc", toolWeight: 0.5, surveyWeight: 0.5, method: "WEIGHTED_AVERAGE", note: null, approvedByName: null, updatedAt: "2026-01-01T00:00:00.000Z" }
  const a = buildItemComparison({ officialDomains: domains, verifiedResponses: responsesFor({ i1: 4 }), linkedSurveysByIndicator: surveysByIndicator, config })
  const b = buildItemComparison({ officialDomains: domains, verifiedResponses: responsesFor({ i1: 1 }), linkedSurveysByIndicator: surveysByIndicator, config })
  expectEqual(a.rows[0].directScore, 100)
  expectEqual(b.rows[0].directScore, 25)
  expectEqual(a.rows[0].combined, 88) // (100+75)/2
  expectEqual(b.rows[0].combined, 50) // (25+75)/2
})
test("نفس الاستبانة لا تُحتسب مرتين في نفس البند والتقييم", () => {
  const dup = new Map<string, LinkedSurveyInput[]>([["i1", [
    { id: "s1", type: "أ", percentage: 80, respondents: 10, include: true },
    { id: "s1", type: "أ", percentage: 80, respondents: 10, include: true },
  ]]])
  const r = buildItemComparison({ officialDomains: domains, verifiedResponses: [], linkedSurveysByIndicator: dup, config: null })
  const row = r.rows[0]
  expectEqual(row.surveyScore, 80)
  expectEqual(row.totalRespondents, 10)
})

console.log("=== 6) نصوص الحالة ===")
test("كل الحالات لها نص عربي", () => {
  for (const s of ["CONFIGURED", "NOT_CONFIGURED", "NO_SURVEY_DATA", "NO_TOOL_DATA", "INVALID_CONFIG"] as const) {
    expect(combinedStatusLabel(s).length > 0)
  }
})

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)