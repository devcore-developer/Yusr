// ============================================================
// evidence-validation.ts — النواة النقية لميزة «رفع الشواهد» في خطط التحسين
// ============================================================
// (التحسين 7 — إضافة فقط) ملف جديد كليًا: لا يستبدل ولا يعدل أي ملف قائم.
// نمط المشروع الموثق: طبقة نقية بلا prisma ولا next (مثل threshold.ts وscore.ts)
// قابلة للاختبار الآلي مباشرة، وتُستورد من الخادم والواجهة معًا.
//
// قواعد المواصفة المطبقة هنا حرفيًا:
//   1) الصيغ المسموحة فقط: PNG / JPG / JPEG / PDF / DOC / DOCX / XLS / XLSX
//   2) الحد الأقصى 5 ميجابايت للملف الواحد — بلا ضغط أو تحويل أو تعديل صامت
//   3) التحقق ثلاثي الطبقات (الامتداد + نوع MIME + التوقيع الرقمي للمحتوى)
//      — فحص المحتوى الفعلي (magic bytes) هو تنفيذ «Validate ... actual file
//      MIME/content where feasible» وهو ممكن لكل الصيغ الثماني المسموحة
//   4) رسائل رفض عربية واضحة لكل سبب على حدة
//   5) لا حذف ولا مسّ لأي شواهد أو مرفقات قائمة — هذه الدوال تتحقق فقط ولا تلمس البيانات
// ============================================================

/** الحد الأقصى لحجم ملف الشاهد الواحد: 5 ميجابايت (5 × 1024 × 1024 بايت) */
export const MAX_EVIDENCE_SIZE_BYTES = 5 * 1024 * 1024

/** الامتدادات المسموحة — المصدر الواحد للواجهة (accept) والخادم */
export const ALLOWED_EVIDENCE_EXTENSIONS = ["png", "jpg", "jpeg", "pdf", "doc", "docx", "xls", "xlsx"] as const

/** خريطة الامتداد → أنواع MIME الصحيحة له — لكشف عدم تطابق الامتداد مع النوع المعلن */
const EXTENSION_MIME: Record<string, string[]> = {
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
}

/** ملصق عربي مقروء لكل امتداد — يُعرض في قائمة الشواهد ورسائل التحقق */
export const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  png: "صورة PNG",
  jpg: "صورة JPG",
  jpeg: "صورة JPEG",
  pdf: "مستند PDF",
  doc: "مستند Word",
  docx: "مستند Word",
  xls: "جدول Excel",
  xlsx: "جدول Excel",
}

// ------------------------------------------------------------
// التوقيعات الرقمية (magic bytes) — فحص المادة الفعلية للملف لا الاسم المعلن.
// ملاحظة موثقة: DOCX وXLSX (صيغ OOXML الحديثة) كلتاهما حاوية ZIP تبدأ بـ PK\x03\x04
// فلا يمكن تمييزهما من بعضهما بالتوقيع وحده — كلاهما يُقبل بكلا الامتدادين لأن
// المحتوى في الحالتين ملف Office صحيح، والامتداد يحكم العرض فقط.
// بينما DOC وXLS (صيغ OLE2 القديمة) لها توقيعها الخاص المميز.
// ------------------------------------------------------------
const MAGIC_SIGNATURES: { extensions: string[]; bytes: number[] }[] = [
  { extensions: ["png"], bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { extensions: ["jpg", "jpeg"], bytes: [0xff, 0xd8, 0xff] },
  { extensions: ["pdf"], bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { extensions: ["docx", "xlsx"], bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK..
  { extensions: ["doc", "xls"], bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // OLE2
]

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

/**
 * فك أول byteCount بايت من نص base64 — بلا اعتماد على Buffer أو atob
 * (تعمل في الخادم والمتصفح وبيانات الاختبار على حد سواء).
 */
export function decodeBase64Prefix(base64: string, byteCount: number): number[] {
  const out: number[] = []
  let bits = 0
  let value = 0
  for (let i = 0; i < base64.length && out.length < byteCount; i++) {
    const idx = BASE64_ALPHABET.indexOf(base64[i])
    if (idx === -1) break // نهاية Payload أو حرف padding أو محرف غير صالح
    value = (value << 6) | idx
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out.push((value >> bits) & 0xff)
    }
  }
  return out
}

/**
 * حجم المحتوى الفعلي بالبايت المحسوب من طول نص base64 (Data URL أو خام).
 * الخادم لا يثق بحجم العميل المعلن — الحجم الفعلي هو ما يُحاسب عليه.
 */
export function base64ByteLength(data: string): number {
  const payload = data.includes(",") ? data.slice(data.indexOf(",") + 1) : data
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding)
}

/** استخراج امتداد اسم الملف بحروف صغيرة (بلا النقطة) — فارغ إن لم يوجد */
export function getFileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".")
  return idx === -1 ? "" : fileName.slice(idx + 1).toLowerCase()
}

/** حمولة ملف الشاهد كما تصل من الواجهة — نفس شكل رفع المرفقات القائم (FileReader.readAsDataURL) */
export interface EvidenceFileInput {
  name: string
  type: string
  size: number
  /** Data URL كامل «data:<mime>;base64,<payload>» — يُخزن كما هو بلا أي تحويل */
  data: string
}

/** صف شاهد مخزن كما يُعرض في الواجهة — بلا محتوى الملف أبدًا (لا يُرسل للقائمة) */
export interface PlanEvidenceRow {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  /** ISO string قابلة للتسلسل عبر Server Components */
  createdAt: string
}

export type EvidenceValidationResult = { ok: true } | { ok: false; error: string }

function sizeLimitError(): EvidenceValidationResult {
  return { ok: false, error: "حجم الملف يتجاوز الحد الأقصى المسموح (5 ميجابايت). اختر ملفًا أصغر." }
}

/**
 * التحقق الكامل من ملف الشاهد قبل التخزين — يُنفَّذ على الخادم حصريًا (المصدر الفاصل)،
 * وتُعاد نفس قواعده مبسطة على العميل لسرعة التغذية الراجعة فقط دون أي اعتماد أمني عليه.
 */
export function validateEvidenceFile(file: EvidenceFileInput): EvidenceValidationResult {
  // 1) الحجم المعلن من العميل
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: "الملف فارغ أو حجمه غير صالح." }
  }
  if (file.size > MAX_EVIDENCE_SIZE_BYTES) return sizeLimitError()

  // 2) شكل المحتوى: Data URL كما تنتجه واجهة الرفع القائمة — أي شيء آخر يُرفض (لا تخمين)
  if (typeof file.data !== "string" || !file.data.startsWith("data:")) {
    return { ok: false, error: "تعذر قراءة محتوى الملف — الصيغة الداخلية غير متوقعة. أعد رفع الملف." }
  }

  // 3) الحجم الفعلي للمحتوى المحسوب من base64 — الحماية من أرقام حجم مزورة
  if (base64ByteLength(file.data) > MAX_EVIDENCE_SIZE_BYTES) return sizeLimitError()

  // 4) الامتداد من اسم الملف
  const ext = getFileExtension(file.name)
  if (!ext || !(ALLOWED_EVIDENCE_EXTENSIONS as readonly string[]).includes(ext)) {
    return {
      ok: false,
      error: `نوع الملف${ext ? ` «${ext}»` : ""} غير مدعوم. الصيغ المسموحة: PNG، JPG، JPEG، PDF، DOC، DOCX، XLS، XLSX.`,
    }
  }

  // 5) تطابق نوع MIME المعلن مع الامتداد — القيم العامة (octet-stream/فارغة) يحسمها فحص المحتوى التالي
  const mime = (file.type || "").toLowerCase()
  if (mime && mime !== "application/octet-stream" && !EXTENSION_MIME[ext].includes(mime)) {
    return {
      ok: false,
      error: `نوع الملف المعلن (${mime}) لا يطابق امتداد «${ext}». أعد رفع الملف الأصلي بدون تغيير اسمه.`,
    }
  }

  // 6) التوقيع الرقمي للمحتوى — فحص المادة الفعلية للملف
  const signature = MAGIC_SIGNATURES.find(s => s.extensions.includes(ext))
  if (signature) {
    const commaIdx = file.data.indexOf(",")
    const head = decodeBase64Prefix(commaIdx === -1 ? file.data : file.data.slice(commaIdx + 1), signature.bytes.length)
    const matches = head.length === signature.bytes.length && head.every((byte, i) => byte === signature.bytes[i])
    if (!matches) {
      return {
        ok: false,
        error: `محتوى الملف لا يطابق صيغته المعلنة (${EVIDENCE_TYPE_LABELS[ext]}) — قد يكون الملف تالفًا أو مُعاد تسميته من صيغة أخرى. أعد رفع الملف الأصلي.`,
      }
    }
  }

  return { ok: true }
}

/** تنسيق حجم الملف للعرض في القائمة */
export function formatEvidenceSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} ك.ب`
  return `${bytes} بايت`
}