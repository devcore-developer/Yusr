// ===== FILE: src/lib/stages.ts =====
// ============================================================
// المراحل التعليمية — المصدر الموحد للمعرفات والتسميات والتحقق
// (يدخل ضمن ميزة المراحل التعليمية — لا يغير أي منهجية حساب قائمة)
// المعرفات الداخلية ثابتة (أحرف كبيرة) والتسميات العربية هي المستخدمة في الواجهة.
// التسميات الإنجليزية متوفرة جاهزة لو فُعّلت الترجمة لاحقًا (لا توجد طبقة i18n حاليًا).
// ============================================================

export const EDUCATIONAL_STAGES = [
  { id: "KINDERGARTEN", ar: "رياض الأطفال", en: "Kindergarten" },
  { id: "PRIMARY", ar: "ابتدائي", en: "Primary" },
  { id: "INTERMEDIATE", ar: "متوسط", en: "Intermediate" },
  { id: "SECONDARY", ar: "ثانوي", en: "Secondary" },
  { id: "SPECIAL_EDUCATION", ar: "تربية خاصة", en: "Special Education" },
] as const

export type EducationalStageId = (typeof EDUCATIONAL_STAGES)[number]["id"]

export const STAGE_IDS: string[] = EDUCATIONAL_STAGES.map(s => s.id)

// قيمة الفلتر للسجلات التاريخية التي لا مرحلة لها (stage = NULL في قاعدة البيانات)
export const UNSPECIFIED_STAGE = "UNSPECIFIED"

export function isValidStage(value: unknown): value is EducationalStageId {
  return typeof value === "string" && (STAGE_IDS as string[]).includes(value)
}

/** التسمية العربية — السجلات التاريخية بلا مرحلة تظهر "غير محددة" */
export function getStageLabel(id: string | null | undefined): string {
  if (!id) return "غير محددة"
  return EDUCATIONAL_STAGES.find(s => s.id === id)?.ar ?? "غير محددة"
}

/** التسمية الإنجليزية (للاستخدام المستقبلي عند تفعيل الترجمة) */
export function getStageLabelEn(id: string | null | undefined): string {
  if (!id) return "Unspecified"
  return EDUCATIONAL_STAGES.find(s => s.id === id)?.en ?? "Unspecified"
}

/** خيارات جاهزة للقوائم والمنتقيات */
export function getStageOptions(): { id: EducationalStageId; label: string }[] {
  return EDUCATIONAL_STAGES.map(s => ({ id: s.id, label: s.ar }))
}

/**
 * تحويل قيمة فلتر المرحلة من الرابط إلى قيمة Prisma:
 *  - undefined: لا فلتر (كل التقييمات — السلوك الافتراضي)
 *  - null: السجلات التاريخية غير المحددة (stage IS NULL)
 *  - EducationalStageId: مرحلة محددة
 * القيم غير المعروفة تُتجاهل (لا ترمي خطأ) حتى لا يكسر رابطٌ مضروبٌ الصفحة.
 */
export type StageFilterValue = EducationalStageId | null

export function resolveStageFilter(
  raw: string | string[] | undefined | null
): StageFilterValue | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== "string") return undefined
  const v = value.trim()
  if (!v) return undefined
  if (v === UNSPECIFIED_STAGE) return null
  return isValidStage(v) ? v : undefined
}

/** قيمة تُوضع في input hidden لتمرير الفلتر عبر GET forms */
export function stageFilterToParam(f: StageFilterValue | undefined): string | null {
  if (f === undefined) return null
  return f === null ? UNSPECIFIED_STAGE : f
}

/**
 * تطبيع مدخلات المراحل القادمة من نماذج الحسابات (checkbox متعدد) على الخادم:
 * يرمي خطأً واضحًا عند أي قيمة غير صحيحة — لا يثق بالعميل أبدًا.
 */
export function normalizeStageIds(input: unknown): EducationalStageId[] {
  const raw: unknown[] = Array.isArray(input) ? input : typeof input === "string" ? [input] : []
  const out: EducationalStageId[] = []
  for (const item of raw) {
    if (!isValidStage(item)) {
      throw new Error("إحدى المراحل التعليمية المحددة غير صحيحة.")
    }
    if (!out.includes(item)) out.push(item)
  }
  return out
}