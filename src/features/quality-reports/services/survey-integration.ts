// ===== FILE: src/features/quality-reports/services/survey-integration.ts =====
// ============================================================
// survey-integration.ts — خدمة نقية بلا اعتماديات (server/client آمنة)
// تكامل الاستبانات مع أدوات التقييم: النتيجتان المنفصلتان + النتيجة المدمجة
// ============================================================
// المبادئ الملزمة (من مواصفة المهمة):
// 1) مصدر واحد للحقيقة: كل رقم في الجدول/البطاقة/التقرير يخرج من هذا الملف حصرًا.
// 2) الربط المعتمد للأرقام = العلاقة الصريحة بالمعرّفات (Survey.indicatorId) فقط —
//    لا مطابقة أسماء عربية ولا نصوص في أي احتساب (المطابقة النصية القائمة في
//    survey-link.ts تبقى كما هي لعرض القسم المدرسي القائم — لم تُمس).
// 3) الدرجة الرسمية بالأدوات تُحسب بنفس معادلة جداول المجالات القائمة حرفيًا
//    (Math.round(المتحقق ÷ المطلوب × 100)) — لا صيغة جديدة ولا تغيير للرسمية.
// 4) النتيجة المدمجة = عرض مقارن غير رسمي إطلاقًا: لا تُغذّي درجة المدرسة
//    ولا أوزان المجالات (20/30/40/10) ولا أي حساب رسمي قائم.
// 5) لا أرقام مصنوعة: لا استبانة صالحة → null مع سبب ظاهر.
// 6) كل استبانة تُحتسب مرة واحدة بالضبط لكل بند (لا ازدواج) — والاستبانة تملك
//    مؤشرًا واحدًا صريحًا بحكم البنية فلا يمكن ظهورها لبندَين في نفس المقارنة.
// ============================================================

// ---------- الأنواع ----------

export type SurveyIntegrationCombinedStatus =
  | "CONFIGURED" // إعداد معتمد صالح — النتيجة المدمجة محسوبة
  | "NOT_CONFIGURED" // لا يوجد إعداد معتمد — النتيجتان المنفصلتان هما المرجع
  | "NO_SURVEY_DATA" // لا توجد استبانة صالحة للاحتساب لهذا البند
  | "NO_TOOL_DATA" // لا شواهد معرّفة للبند — درجة الأدوات غير معرّفة
  | "INVALID_CONFIG" // إعداد مخزن لا يجتاز التحقق — يُتجاهل بشفافية

/** استبانة مرتبطة صراحةً ببند (من العلاقة بالمعرّفات — تصفية خادمية قبل الوصول هنا) */
export interface LinkedSurveyInput {
  id: string
  type: string
  /** النسبة المسجلة كما أُدخلت (0..100 صالحة للاحتساب — غير ذلك تُستبعد بشفافية) */
  percentage: number
  /** عدد المستجيبين المسجل يدويًا — null = غير مسجل (لا يُختلع) */
  respondents: number | null
  /** علم المنصة القائم: «تضمين النسبة في تجميع المؤشر عند ربطها بمؤشر» — أول مستهلك له هو النتيجة المدمجة */
  include: boolean
}

/** لقطة إعداد الدمج المعتمد (تُسجَّل مع كل عرض لتكون النتيجة قابلة للتدقيق) */
export interface SurveyIntegrationConfigSnapshot {
  id: string
  schoolId: string
  /** وزن نتيجة التقييم بالأدوات — كسر 0..1 */
  toolWeight: number
  /** وزن نتيجة الاستبانة — كسر 0..1 */
  surveyWeight: number
  /** طريقة الاحتساب المسجلة — «WEIGHTED_AVERAGE» = متوسط مرجّح */
  method: string
  note: string | null
  approvedByName: string | null
  updatedAt: string | Date
}

/** حالة الاستبانة داخل مقارنة بند — شفافية كاملة: مستخدمة أم مستبعدة ولماذا */
export interface SurveyUsage {
  id: string
  type: string
  percentage: number
  respondents: number | null
  include: boolean
  used: boolean
  /** سبب الاستبعاد (عربي) — null عند الاستخدام */
  reason: string | null
}

export interface ItemComparisonRow {
  indicatorId: string
  indicatorCode: string
  indicatorDescription: string
  domainName: string | null
  /** عدد الشواهد المطلوبة للبند (كما في جداول المجالات: fixedEvidence.length) */
  requiredEvidence: number
  /** عدد الاستجابات المتحققة المسجلة للبند في هذا التقييم (نفس عدّاد جداول المجالات) */
  verifiedResponsesCount: number
  /** نتيجة التقييم بالأدوات — نفس معادلة جداول المجالات حرفيًا؛ null = لا شواهد معرّفة */
  directScore: number | null
  /** كل الاستبانات المرتبطة صراحةً بالبند — بحالتها ومسببات استبعادها */
  surveys: SurveyUsage[]
  usableSurveyCount: number
  /** نتيجة الاستبانة = متوسط نسب الاستبانات القابلة للاحتساب (Math.round — منهجية المنصة) */
  surveyScore: number | null
  /** مجموع المستجيبين المسجلين (غير الصفري/null) — null = لم يُسجَّل أي عدد */
  totalRespondents: number | null
  respondentsPartial: boolean
  /** النتيجة المدمجة — عرض مقارن غير رسمي؛ null في كل الحالات الأخرى */
  combined: number | null
  combinedStatus: SurveyIntegrationCombinedStatus
  /** «أدوات التقييم 70% • الاستبانة 30%» — تظهر مع كل نتيجة مدمجة معروضة */
  weightsLabel: string | null
  /** سجل التدقيق: الطريقة + تاريخ الاعتماد + المعتمِد */
  auditNote: string | null
}

export interface ItemComparisonDiagnostics {
  /** يوجد إعداد مخزن لكنه لا يجتاز التحقق — تُعرض النتيجتان المنفصلتان فقط */
  invalidConfig: boolean
  /** عدد بنود المقارنة (للعرض الشرطي) */
  rowCount: number
}

// ---------- التحقق من الأوزان ----------

/**
 * الأوزان يجب أن تكون أرقامًا منتهية، كلٌّ منها ضمن (0،1) حصريًا، ومجموعهما 1.
 * لا يوجد وزن افتراضي مُقرَّر — أي نسبة (50/50 أو 70/30 أو غيرهما) اختيار صريح معتمد.
 */
export function validateWeights(
  toolWeight: number,
  surveyWeight: number
): { valid: boolean; reason: string | null } {
  if (!Number.isFinite(toolWeight) || !Number.isFinite(surveyWeight)) {
    return { valid: false, reason: "الأوزان يجب أن تكون أرقامًا صحيحة." }
  }
  if (toolWeight <= 0 || toolWeight >= 1) {
    return { valid: false, reason: "وزن الأدوات يجب أن يكون أكبر من 0 وأصغر من 100%." }
  }
  if (surveyWeight <= 0 || surveyWeight >= 1) {
    return { valid: false, reason: "وزن الاستبانة يجب أن يكون أكبر من 0 وأصغر من 100%." }
  }
  if (Math.abs(toolWeight + surveyWeight - 1) > 1e-9) {
    return { valid: false, reason: "مجموع الوزنين يجب أن يساوي 100% بالضبط." }
  }
  return { valid: true, reason: null }
}

/** «أدوات التقييم 70% • الاستبانة 30%» — من الكسور المخزنة */
export function weightsLabel(toolWeight: number, surveyWeight: number): string {
  return `أدوات التقييم ${Math.round(toolWeight * 100)}% • الاستبانة ${Math.round(surveyWeight * 100)}%`
}

// ---------- النتيجة المدمجة ----------

/**
 * متوسط مرجّح واحد: (درجة الأدوات × وزنها) + (درجة الاستبانة × وزنها) — التقريب مرة واحدة.
 * يُطبَّق الوزن مرة واحدة بالضبط (لا إعادة وزن فوق نتيجة مرجحة سابقة).
 * يعيد null إذا لم تكن كلتا الدرجهتين رقمين صالحين (لا اختراع).
 */
export function computeCombinedScore(
  toolScore: number | null,
  surveyScore: number | null,
  toolWeight: number,
  surveyWeight: number
): number | null {
  if (toolScore === null || surveyScore === null) return null
  if (!Number.isFinite(toolScore) || !Number.isFinite(surveyScore)) return null
  const check = validateWeights(toolWeight, surveyWeight)
  if (!check.valid) return null
  return Math.round(toolScore * toolWeight + surveyScore * surveyWeight)
}

// ---------- تلخيص استبانات بند واحد ----------

const isPercentageInRange = (p: number): boolean =>
  Number.isFinite(p) && p >= 0 && p <= 100

/**
 * قواعد الاحتساب الموثقة (بلا استثناءات صامتة):
 * - تُحتسب فقط الاستبانات المرتبطة صراحةً بالبند (وصلت هنا بعد تصفية العلاقة بالمعرّفات).
 * - يجب أن يكون علم «تضمين النسبة في تجميع المؤشر» مفعّلًا (الدلالة القائمة للعلم في المنصة).
 * - النسبة يجب أن تكون ضمن 0..100 — القيم التاريخية خارج النطاق تُستبعد وتظهر بسببها.
 * - كل استبانة تُحتسب مرة واحدة (تحصين إضافي: إزالة التكرار بالمعرف دفاعًا عن أي تمرير مزدوج).
 * - النتيجة = Math.round(متوسط النسب القابلة للاحتساب) — نفس منهجية المتوسط في المنصة.
 * - عدد المستجيبين: مجموع المسجَّل فقط؛ إن لم يُسجَّل لأي استبانة → null (لا 0 زائف).
 */
export function summarizeSurveysForIndicator(surveys: LinkedSurveyInput[]): {
  usable: LinkedSurveyInput[]
  surveyScore: number | null
  usages: SurveyUsage[]
  totalRespondents: number | null
  respondentsPartial: boolean
} {
  const seen = new Set<string>()
  const usable: LinkedSurveyInput[] = []
  const usages: SurveyUsage[] = []

  for (const s of surveys) {
    if (seen.has(s.id)) {
      usages.push({ id: s.id, type: s.type, percentage: s.percentage, respondents: s.respondents, include: s.include, used: false, reason: "سجل مكرر (نفس المعرف) — حُسب مرة واحدة." })
      continue
    }
    seen.add(s.id)

    if (!s.include) {
      usages.push({ id: s.id, type: s.type, percentage: s.percentage, respondents: s.respondents, include: false, used: false, reason: "خيار «تضمين النسبة في تجميع المؤشر» معطّل لهذه الاستبانة." })
      continue
    }
    if (!isPercentageInRange(s.percentage)) {
      usages.push({ id: s.id, type: s.type, percentage: s.percentage, respondents: s.respondents, include: s.include, used: false, reason: "النسبة المسجلة خارج النطاق 0–100 — لا تُحتسب (قيمة تاريخية كما هي، لا تُعدَّل)." })
      continue
    }
    usable.push(s)
    usages.push({ id: s.id, type: s.type, percentage: s.percentage, respondents: s.respondents, include: s.include, used: true, reason: null })
  }

  const surveyScore = usable.length > 0
    ? Math.round(usable.reduce((sum, s) => sum + s.percentage, 0) / usable.length)
    : null

  const withRespondents = usable.filter(s => typeof s.respondents === "number" && s.respondents !== null)
  const totalRespondents = withRespondents.length > 0
    ? withRespondents.reduce((sum, s) => sum + (s.respondents as number), 0)
    : null
  const respondentsPartial = usable.length > 0 && withRespondents.length > 0 && withRespondents.length < usable.length

  return { usable, surveyScore, usages, totalRespondents, respondentsPartial }
}

// ---------- مقارنة البنود ----------

/** الشكل الأدنى المطلوب من الإطار الرسمي (domains → indicators → fixedEvidence) كما تُحمَّل في التقارير */
export interface ComparisonDomainInput {
  id: string
  name: string
  indicators: {
    id: string
    code: string
    description: string
    fixedEvidence: unknown[]
  }[]
}

/** الاستجابات المتحققة كما تُحمَّل في التقرير (isVerified: true) — يُستخدم منها indicatorId فقط.
 *  evidenceId اختياري: وجوده يُفعّل تفريد الشواهد (صف زيارة إضافي لنفس الشاهد لا يُعدّ مرة أخرى)،
 *  وغيابه = العدّ كما هو (توافق خلفي مع مستهلكين/اختبارات لا تمرر المعرف). */
export interface ComparisonResponseInput {
  evidenceId?: string
  evidence: { indicatorId: string }
}

/**
 * يبني صفوف مقارنة للبنود التي لديها استبانة واحدة على الأقل مرتبطة صراحةً بمعرّفها.
 * درجة الأدوات لكل بند = نفس معادلة جداول المجالات القائمة حرفيًا:
 *   المطلوب = fixedEvidence.length ، المتحقق = عدد الاستجابات المتحققة للبند ،
 *   النسبة = Math.round((المتحقق ÷ المطلوب) × 100) — والبند بلا شواهد → null بلا اختراع.
 * النتيجة المدمجة لا تُحسب إلا بوجود إعداد معتمد صالح + درجتَين معرَّفتَين.
 */
export function buildItemComparison(input: {
  officialDomains: ComparisonDomainInput[]
  verifiedResponses: ComparisonResponseInput[]
  /** مؤشر الاستبانات المرتبطة صراحةً — المفتاح = معرّف البند (من الخادم، عزل مدرسة مضمون فيه) */
  linkedSurveysByIndicator: Map<string, LinkedSurveyInput[]>
  config: SurveyIntegrationConfigSnapshot | null
}): { rows: ItemComparisonRow[]; diagnostics: ItemComparisonDiagnostics } {
  const { officialDomains, verifiedResponses, linkedSurveysByIndicator, config } = input

  // تحقق الإعداد مرة واحدة — الإعداد المخزن غير الصالح يُتجاهل بشفافية (لا رقم من إعداد فاسد)
  let configValid = false
  if (config) {
    configValid = validateWeights(config.toolWeight, config.surveyWeight).valid
  }

  // عدّاد الشواهد المميزة المتحققة لكل بند — نفس عدّاد جداول المجالات بعد إصلاح التضخم:
  // (إصلاح التضخم) صف زيارة إضافي لنفس الشاهد (visitNumber 1..7 في قيد الفريدة)
  // لا يُعدّ شاهدًا جديدًا؛ الصفوف بلا هوية شاهد تُعد كما هي (توافق خلفي)
  const verifiedCountByIndicator = new Map<string, number>()
  const seenEvidenceByIndicator = new Map<string, Set<string>>()
  for (const r of verifiedResponses) {
    const indId = r?.evidence?.indicatorId
    if (!indId) continue
    const key = r.evidenceId ?? (r.evidence as { id?: string } | undefined)?.id ?? null
    if (key === null) {
      verifiedCountByIndicator.set(indId, (verifiedCountByIndicator.get(indId) ?? 0) + 1)
      continue
    }
    let seen = seenEvidenceByIndicator.get(indId)
    if (!seen) {
      seen = new Set<string>()
      seenEvidenceByIndicator.set(indId, seen)
    }
    if (seen.has(key)) continue
    seen.add(key)
    verifiedCountByIndicator.set(indId, (verifiedCountByIndicator.get(indId) ?? 0) + 1)
  }

  const rows: ItemComparisonRow[] = []

  for (const domain of officialDomains) {
    for (const indicator of domain.indicators ?? []) {
      const linked = linkedSurveysByIndicator.get(indicator.id)
      if (!linked || linked.length === 0) continue // المقارنة للبنود المرتبطة فعلًا فقط

      const requiredEvidence = Array.isArray(indicator.fixedEvidence) ? indicator.fixedEvidence.length : 0
      const verifiedResponsesCount = verifiedCountByIndicator.get(indicator.id) ?? 0
      const directScore = requiredEvidence > 0
        ? Math.round((verifiedResponsesCount / requiredEvidence) * 100)
        : null

      const summary = summarizeSurveysForIndicator(linked)

      let combined: number | null = null
      let combinedStatus: SurveyIntegrationCombinedStatus
      let weights: string | null = null
      let audit: string | null = null

      if (!config) {
        combinedStatus = "NOT_CONFIGURED"
      } else if (!configValid) {
        combinedStatus = "INVALID_CONFIG"
      } else if (directScore === null) {
        combinedStatus = "NO_TOOL_DATA"
      } else if (summary.surveyScore === null) {
        combinedStatus = "NO_SURVEY_DATA"
      } else {
        combined = computeCombinedScore(directScore, summary.surveyScore, config.toolWeight, config.surveyWeight)
        combinedStatus = "CONFIGURED"
        weights = weightsLabel(config.toolWeight, config.surveyWeight)
        const updated = typeof config.updatedAt === "string" ? config.updatedAt : config.updatedAt.toISOString()
        const approvedAt = new Date(updated).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })
        audit = `طريقة الاحتساب: متوسط مرجّح بأوزان معتمدة • الإعداد المعتمد: ${approvedAt}${config.approvedByName ? ` بواسطة ${config.approvedByName}` : ""}`
      }

      rows.push({
        indicatorId: indicator.id,
        indicatorCode: indicator.code,
        indicatorDescription: indicator.description,
        domainName: domain.name,
        requiredEvidence,
        verifiedResponsesCount,
        directScore,
        surveys: summary.usages,
        usableSurveyCount: summary.usable.length,
        surveyScore: summary.surveyScore,
        totalRespondents: summary.totalRespondents,
        respondentsPartial: summary.respondentsPartial,
        combined,
        combinedStatus,
        weightsLabel: weights,
        auditNote: audit,
      })
    }
  }

  return {
    rows,
    diagnostics: {
      invalidConfig: config !== null && !configValid,
      rowCount: rows.length,
    },
  }
}

// ---------- نصوص الحالة الموحدة (مصدر واحد للشاشة والطباعة) ----------

export function combinedStatusLabel(status: SurveyIntegrationCombinedStatus): string {
  switch (status) {
    case "CONFIGURED":
      return "مدمجة (معتمدة للعرض والمقارنة)"
    case "NOT_CONFIGURED":
      return "غير مُهيَّأة — لم يُعتمد إعداد دمج لهذه المدرسة"
    case "NO_SURVEY_DATA":
      return "— لا توجد استبانة صالحة للاحتساب لهذا البند"
    case "NO_TOOL_DATA":
      return "— لا شواهد معرّفة لهذا البند في الإطار الرسمي"
    case "INVALID_CONFIG":
      return "إعداد الدمج المخزن غير صالح — تُعرض النتيجتان المنفصلتان فقط"
    default:
      return "—"
  }
}

export const SURVEY_INTEGRATION_METHOD_LABEL: Record<string, string> = {
  WEIGHTED_AVERAGE: "متوسط مرجّح بأوزان معتمدة",
}