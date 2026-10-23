// ===== FILE: src/features/quality-reports/services/weighted-score.ts =====
// ============================================================
// Weighted School Evaluation Scoring — Single Source of Truth
// ============================================================
// PURE module (zero imports — safe for server and client bundles).
//
// Client-mandated domain weights (official specification):
//   الإدارة (القيادة) المدرسية  → 20%
//   التعليم والتعلم             → 30%
//   نواتج التعلم                → 40%
//   البيئة المدرسية             → 10%
//
// Overall = (Leadership × 0.20) + (Teaching&Learning × 0.30)
//         + (LearningOutcomes × 0.40) + (Environment × 0.10)
//
// Methodology preserved EXACTLY as the existing platform:
//   score(unit) = verified evidence responses ÷ required fixed evidence × 100
//   (same authoritative relation used by reports/print DomainTables,
//    quality-assessor comparisons and analysis.ts — nothing redefined).
//
// Design rules enforced here:
//   1. Each domain percentage is computed independently, then weighted ONCE.
//   2. A domain with zero required evidence yields null (never fabricated as 0).
//   3. A domain whose stored name cannot be matched yields null + diagnostics —
//      the weighted overall becomes null instead of a silently wrong number.
//   4. Domain scores are rounded (Math.round) BEFORE weighting so the printed
//      card is arithmetically self-auditable from the displayed percentages
//      (matches the platform's integer-percentage convention).
//   5. Historical/NOT_APPLICABLE handling is untouched: the denominator remains
//      ALL fixed evidence of the indicator (existing official rule) and the
//      numerator remains isVerified responses (existing official rule).
// ============================================================

// ------------------------------------------------------------
// Performance levels — client-supplied reference specification
// (labels & colors mirror the existing report palette in
//  reports/print + AnalyticsCharts — blue brand, no purple).
// ------------------------------------------------------------
export interface PerformanceLevel {
  key: "EXCELLENCE" | "PROGRESS" | "LAUNCH" | "READINESS"
  label: string
  min: number // inclusive lower bound on the 0–100 scale
  color: string
  description: string
}

export const PERFORMANCE_LEVELS: readonly PerformanceLevel[] = [
  {
    key: "EXCELLENCE",
    label: "التميز",
    min: 90,
    color: "#16A34A",
    description: "الأداء مرتفع، بمستوى 90% فأعلى، ويتطلب استدامة التميز والابتكار.",
  },
  {
    key: "PROGRESS",
    label: "التقدم",
    min: 75,
    color: "#2878B8",
    description: "الأداء بين 75% وأقل من 90%، ويحتاج إلى الاستمرار والمتابعة والتحسين والتطوير.",
  },
  {
    key: "LAUNCH",
    label: "الانطلاق",
    min: 50,
    color: "#E9A34A",
    description: "الأداء بين 50% وأقل من 75%، ويحتاج إلى تحسينات كبيرة في بعض المجالات.",
  },
  {
    key: "READINESS",
    label: "التهيئة",
    min: 0,
    color: "#C62828",
    description: "الأداء أقل من 50%، ويحتاج إلى تدخلات جوهرية للتحسين في معظم مجالات التقويم.",
  },
]

/**
 * Classify a 0–100 percentage into the four performance levels.
 * null / undefined / out-of-range → null (never fabricates a level).
 */
export function classifyPerformance(
  percentage: number | null | undefined
): PerformanceLevel | null {
  if (percentage === null || percentage === undefined) return null
  if (!Number.isFinite(percentage)) return null
  if (percentage < 0 || percentage > 100) return null
  // PERFORMANCE_LEVELS are ordered from the highest threshold down.
  for (const level of PERFORMANCE_LEVELS) {
    if (percentage >= level.min) return level
  }
  return null
}

// ------------------------------------------------------------
// Domain weight configuration
// ------------------------------------------------------------
export interface DomainWeightConfig {
  key: "SCHOOL_LEADERSHIP" | "TEACHING_AND_LEARNING" | "LEARNING_OUTCOMES" | "SCHOOL_ENVIRONMENT"
  weight: number
  /** Accepted stored names (canonical first). Normalization strips diacritics/spacing/parentheses. */
  names: string[]
}

export const SCHOOL_EVALUATION_DOMAINS: readonly DomainWeightConfig[] = [
  {
    key: "SCHOOL_LEADERSHIP",
    weight: 0.2,
    // Both spellings appear in the official spec (§3 table vs §4 heading) —
    // both are accepted; normalization also removes parentheses.
    names: ["الإدارة (القيادة) المدرسية", "الإدارة المدرسية", "القيادة المدرسية"],
  },
  { key: "TEACHING_AND_LEARNING", weight: 0.3, names: ["التعليم والتعلم"] },
  { key: "LEARNING_OUTCOMES", weight: 0.4, names: ["نواتج التعلم"] },
  { key: "SCHOOL_ENVIRONMENT", weight: 0.1, names: ["البيئة المدرسية"] },
]

/** Weights must total exactly 100% — validated by tests and usable at runtime. */
export function validateDomainWeights(): { total: number; valid: boolean } {
  const total = SCHOOL_EVALUATION_DOMAINS.reduce((sum, d) => sum + d.weight, 0)
  return { total: Math.round(total * 10000) / 10000, valid: Math.abs(total - 1) < 1e-9 }
}

/** Arabic normalization: strips harakat/tatweel, unifies alef/ya/ta-marbuta, removes non-letter characters. */
export function normalizeArabicName(raw: string): string {
  return raw
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "") // harakat + dagger alif + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "") // invisible/bidi marks
    .replace(/[^\u0600-\u06FF]/g, "") // spaces, punctuation, parentheses, Latin…
}

// alias → config lookup (built once at module load)
const NORMALIZED_ALIAS_MAP: Map<string, DomainWeightConfig> = (() => {
  const map = new Map<string, DomainWeightConfig>()
  for (const config of SCHOOL_EVALUATION_DOMAINS) {
    for (const name of config.names) {
      const normalized = normalizeArabicName(name)
      if (normalized && !map.has(normalized)) map.set(normalized, config)
    }
  }
  return map
})()

/** Match a stored domain name to a weighted-domain config (null = no confident match). */
export function matchDomainConfig(storedName: string): DomainWeightConfig | null {
  const normalized = normalizeArabicName(storedName)
  if (!normalized) return null
  return NORMALIZED_ALIAS_MAP.get(normalized) ?? null
}

// ------------------------------------------------------------
// Structural input types (compatible with the existing query shapes)
// ------------------------------------------------------------
export interface OfficialDomainInput {
  id: string
  name: string
  indicators: {
    id: string
    domainId: string
    axisId: string
    axis?: { name: string } | null
    fixedEvidence: unknown[]
  }[]
}

export interface EvidenceRowInput {
  /**
   * معرف الشاهد — عمود EvidenceResponse.evidenceId (أو evidence.id).
   * ضروري لتفريد الشواهد: قيد الفريدة (assessmentId, evidenceId, visitNumber)
   * يعني أن شاهد الملاحظة الصفية الواحد قد يكون له صف لكل زيارة (1..7) —
   * وبدون التفريد تُعدّ الزيارات المتعددة شواهد جديدة فتتضخم النسب فوق 100%.
   * غيابه = سلوك التوافق الخلفي (عدّ الصفوف كما هي — مستهلكو الاختبارات القديمة).
   */
  evidenceId?: string
  evidence: {
    id?: string
    indicator: {
      domainId: string
      axisId: string
    }
  }
}

/** الحد الأدنى الذي تتطلبه أدوات التفريد — صفوف { evidenceId } من استعلامات select تكفي */
export interface EvidenceIdentityInput {
  evidenceId?: string
  evidence?: { id?: string } | null
}

// ------------------------------------------------------------
// تفريد الشواهد المتحققة — القاعدة المحاسبية الموحدة للمنصة كلها
// ------------------------------------------------------------
// «شاهد متحقق» = شاهد واحد له صف متحقق واحد على الأقل — بغض النظر عن عدد
// الزيارات التي سُجّل فيها. صفوف نفس الشاهد في زيارات مختلفة قياسات
// متكررة لنفس الشاهد ولا يصح عدّها أكثر من مرة.
// صفوف بلا هوية (لا evidenceId ولا evidence.id) تُعدّ كما هي — توافق خلفي
// صريح مع مستهلكين لا يمررون المعرف (اختبارات المنصة القائمة لم تتأثر).
// ------------------------------------------------------------
export function distinctVerifiedEvidenceRows<T extends EvidenceIdentityInput>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const key = row.evidenceId ?? row.evidence?.id
    if (key === undefined || key === null || key === "") {
      out.push(row)
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

/** العدد الموحد للشواهد المتحققة المميزة — مستخدم في كل صفحات التقارير واللوحات.
 *  يقبل الصفوف الدنيا ({ evidenceId } من استعلامات select) أو الصفوف الكاملة. */
export function countDistinctVerifiedEvidence(rows: EvidenceIdentityInput[]): number {
  return distinctVerifiedEvidenceRows(rows).length
}

// ------------------------------------------------------------
// Result types
// ------------------------------------------------------------
export interface CriterionResult {
  axisId: string
  axisName: string
  verified: number
  required: number
  /** null when the criterion has no required evidence (never fabricated). */
  score: number | null
}

export interface DomainResult {
  /** Config key when matched to the official weights, null for extra stored domains. */
  key: string | null
  domainId: string
  name: string
  /** Official weight (0–1) when matched; null for extra stored domains. */
  weight: number | null
  verified: number
  required: number
  score: number | null
  matched: boolean
}

export interface DomainCriteriaGroup {
  domainId: string
  domainName: string
  weight: number | null
  /** Domain score (same value used in the overall section — one source). */
  score: number | null
  criteria: CriterionResult[]
}

export interface WeightedDiagnostics {
  /** Config keys whose stored domain name could not be found. */
  unmatchedConfigs: string[]
  /** Matched domains with zero required evidence (score null). */
  missingDataDomains: string[]
  /** Stored domains not covered by the official weights (excluded from the weighted overall). */
  extraDomains: string[]
}

export interface WeightedAssessmentResult {
  /** null unless every official domain is matched AND has a valid score. */
  overall: number | null
  classification: PerformanceLevel | null
  domains: DomainResult[]
  criteriaGroups: DomainCriteriaGroup[]
  diagnostics: WeightedDiagnostics
}

// ------------------------------------------------------------
// Core percentage (existing official methodology, unchanged)
// ------------------------------------------------------------
export function computePercentage(verified: number, required: number): number | null {
  if (required <= 0) return null
  return Math.round((verified / required) * 100)
}

// ------------------------------------------------------------
// Weighted overall
// ------------------------------------------------------------
export function computeWeightedOverall(
  scoredDomains: { key: string; score: number | null }[]
): { overall: number | null; missing: string[] } {
  const byKey = new Map(scoredDomains.map(d => [d.key, d.score]))
  const missing: string[] = []
  let weighted = 0
  for (const config of SCHOOL_EVALUATION_DOMAINS) {
    const score = byKey.get(config.key)
    if (score === undefined || score === null || !Number.isFinite(score)) {
      missing.push(config.key)
      continue
    }
    weighted += score * config.weight // weight applied exactly once per domain
  }
  if (missing.length > 0) return { overall: null, missing }
  return { overall: Math.round(weighted), missing: [] }
}

// ------------------------------------------------------------
// Orchestrator — one assessment = one independent result
// (reads ONLY the passed-in rows; never aggregates across assessments)
// عدّ المتحقق = شواهد مميزة (distinct evidenceId) — صفوف الزيارات المتعددة
// لنفس الشاهد لا تُعدّ أكثر من مرة (إصلاح التضخم حتى 700% بسلسلة الزيارات)
// ------------------------------------------------------------
export function computeAssessmentWeightedResult(
  officialDomains: OfficialDomainInput[],
  evidenceResponses: EvidenceRowInput[]
): WeightedAssessmentResult {
  const diagnostics: WeightedDiagnostics = {
    unmatchedConfigs: [],
    missingDataDomains: [],
    extraDomains: [],
  }

  // --- تفريد الشواهد قبل أي عدّ (زيارات الملاحظة الصفية لا تضاعف الشاهد) ---
  const distinctResponses = distinctVerifiedEvidenceRows(evidenceResponses)

  // --- count verified evidence per domain / axis (from this assessment only) ---
  const verifiedByDomain = new Map<string, number>()
  const verifiedByAxis = new Map<string, number>()
  for (const row of distinctResponses) {
    const indicator = row?.evidence?.indicator
    if (!indicator) continue
    verifiedByDomain.set(indicator.domainId, (verifiedByDomain.get(indicator.domainId) ?? 0) + 1)
    verifiedByAxis.set(indicator.axisId, (verifiedByAxis.get(indicator.axisId) ?? 0) + 1)
  }

  // --- required evidence per domain / axis (from the official framework) ---
  const requiredByDomain = new Map<string, number>()
  const requiredByAxis = new Map<string, number>()
  for (const domain of officialDomains) {
    for (const indicator of domain.indicators) {
      const count = Array.isArray(indicator.fixedEvidence) ? indicator.fixedEvidence.length : 0
      // Domain attribution follows the indicator's own domainId (existing report behavior).
      requiredByDomain.set(indicator.domainId, (requiredByDomain.get(indicator.domainId) ?? 0) + count)
      requiredByAxis.set(indicator.axisId, (requiredByAxis.get(indicator.axisId) ?? 0) + count)
    }
  }

  const domainById = new Map(officialDomains.map(d => [d.id, d]))
  const scoreOf = (domainId: string): number | null =>
    computePercentage(verifiedByDomain.get(domainId) ?? 0, requiredByDomain.get(domainId) ?? 0)

  // --- match configured (weighted) domains ---
  const configByDomainId = new Map<string, DomainWeightConfig>()
  const matchedConfigKeys = new Set<string>()
  for (const domain of officialDomains) {
    const config = matchDomainConfig(domain.name)
    if (config && !configByDomainId.has(domain.id)) {
      // First matching stored domain wins (Domain.name is unique in the schema).
      configByDomainId.set(domain.id, config)
      matchedConfigKeys.add(config.key)
    }
  }
  for (const config of SCHOOL_EVALUATION_DOMAINS) {
    if (!matchedConfigKeys.has(config.key)) diagnostics.unmatchedConfigs.push(config.key)
  }

  // --- domain results: configured order first, then extra stored domains ---
  const domains: DomainResult[] = []
  for (const config of SCHOOL_EVALUATION_DOMAINS) {
    const stored = officialDomains.find(d => configByDomainId.get(d.id)?.key === config.key)
    if (!stored) continue
    const score = scoreOf(stored.id)
    if (score === null) diagnostics.missingDataDomains.push(stored.name)
    domains.push({
      key: config.key,
      domainId: stored.id,
      name: stored.name,
      weight: config.weight,
      verified: verifiedByDomain.get(stored.id) ?? 0,
      required: requiredByDomain.get(stored.id) ?? 0,
      score,
      matched: true,
    })
  }
  for (const domain of officialDomains) {
    if (configByDomainId.has(domain.id)) continue
    diagnostics.extraDomains.push(domain.name)
    domains.push({
      key: null,
      domainId: domain.id,
      name: domain.name,
      weight: null,
      verified: verifiedByDomain.get(domain.id) ?? 0,
      required: requiredByDomain.get(domain.id) ?? 0,
      score: scoreOf(domain.id),
      matched: false,
    })
  }

  // --- weighted overall (single application of the official formula) ---
  const { overall } = computeWeightedOverall(
    domains.filter(d => d.matched).map(d => ({ key: d.key as string, score: d.score }))
  )

  // --- criterion (axis) results grouped per domain, first-appearance order ---
  const criteriaGroups: DomainCriteriaGroup[] = domains.map(domainResult => {
    const stored = domainById.get(domainResult.domainId)
    const axes: { axisId: string; axisName: string }[] = []
    const seenAxes = new Set<string>()
    for (const indicator of stored?.indicators ?? []) {
      if (!seenAxes.has(indicator.axisId)) {
        seenAxes.add(indicator.axisId)
        axes.push({ axisId: indicator.axisId, axisName: indicator.axis?.name ?? "" })
      }
    }
    const criteria: CriterionResult[] = axes.map(axis => ({
      axisId: axis.axisId,
      axisName: axis.axisName,
      verified: verifiedByAxis.get(axis.axisId) ?? 0,
      required: requiredByAxis.get(axis.axisId) ?? 0,
      score: computePercentage(verifiedByAxis.get(axis.axisId) ?? 0, requiredByAxis.get(axis.axisId) ?? 0),
    }))
    return {
      domainId: domainResult.domainId,
      domainName: domainResult.name,
      weight: domainResult.weight,
      score: domainResult.score,
      criteria,
    }
  })

  return {
    overall,
    classification: classifyPerformance(overall),
    domains,
    criteriaGroups,
    diagnostics,
  }
}

// ------------------------------------------------------------
// Aggregation across independent assessments (stage panels / school cards)
// Methodology = average of independent percentages (same as the existing
// school average in reports/print) — never merging evidence rows.
// ------------------------------------------------------------
export function averageWeightedOveralls(results: WeightedAssessmentResult[]): {
  average: number | null
  counted: number
  skipped: number
} {
  const valid = results.filter(r => r.overall !== null && Number.isFinite(r.overall))
  if (valid.length === 0) return { average: null, counted: 0, skipped: results.length }
  const sum = valid.reduce((acc, r) => acc + (r.overall as number), 0)
  return { average: Math.round(sum / valid.length), counted: valid.length, skipped: results.length - valid.length }
}

export function aggregateDomainScores(results: WeightedAssessmentResult[]): {
  name: string
  weight: number | null
  score: number | null
}[] {
  if (results.length === 0) return []
  // Preserve the domain order of the first result (configured order + extras).
  const order: { key: string | null; name: string; weight: number | null }[] = results[0].domains.map(d => ({
    key: d.key,
    name: d.name,
    weight: d.weight,
  }))
  return order.map(slot => {
    const scores = results
      .map(r => r.domains.find(d => d.key === slot.key && d.name === slot.name)?.score ?? null)
      .filter((s): s is number => s !== null && Number.isFinite(s))
    return {
      name: slot.name,
      weight: slot.weight,
      score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    }
  })
}