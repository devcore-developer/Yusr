// ============================================================
// العام الدراسي الهجري — المصدر الموحد للتنسيق والتحقق والاقتراح
// (يدخل ضمن ميزة العام الدراسي — لا يغيّر أي منهجية حساب قائمة)
//
// قواعد صارمة:
//  - التحويل الهجري عبر Intl (تقويم أم القرى islamic-umalqura) — ممنوع خصم
//    رقم ثابت من السنة الميلادية، وممنوع تثبيت أي عام دراسي في الكود.
//  - الاقتراح مجرد اقتراح للعرض — لا يبدّل العام النشط لأي مدرسة تلقائيًا أبدًا؛
//    التنشيط يجري فقط بفعل صريح من مدير المدرسة عبر الأكشن الخادمي.
//  - التسمية الموحدة: «1448–1449 هـ» (شرطة en-dash + مسافة + هـ).
//  - هذا الملف نقي بلا أي اعتماد على الخادم (لا prisma) لصلاحية استيراده
//    في مكونات العميل — الاستعلامات الخادمية في features/academic-years.
// ============================================================

/** حدود منطقية للسنة الهجرية — تمنع إدخالات خاطئة فاضحة (مثل 99 أو 99999) */
export const MIN_HIJRI_YEAR = 1400
export const MAX_HIJRI_YEAR = 1500

/** التسمية الموحدة للعام الدراسي — 1448 تُعرض «1448–1449 هـ» */
export function formatAcademicYearLabel(startYear: number): string {
  return `${startYear}–${startYear + 1} هـ`
}

export function isValidAcademicStartYear(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_HIJRI_YEAR &&
    value <= MAX_HIJRI_YEAR
  )
}

/**
 * استخراج السنة والشهر الهجريين لتاريخ معيّن عبر تقويم أم القرى.
 * يعيد null إذا لم يتوفر التقويم في بيئة التشغيل (لا تخمين ولا بديل يدوي).
 */
export function hijriPartsFor(date: Date): { year: number; month: number } | null {
  const calendars = ["islamic-umalqura", "islamic"] as const
  for (const calendar of calendars) {
    try {
      const formatter = new Intl.DateTimeFormat(`en-US-u-ca-${calendar}-nu-latn`, {
        year: "numeric",
        month: "numeric",
        timeZone: "Asia/Riyadh"
      })
      const parts = formatter.formatToParts(date)
      const rawYear = parts.find(p => p.type === "year")?.value ?? ""
      const rawMonth = parts.find(p => p.type === "month")?.value ?? ""
      const year = Number(String(rawYear).replace(/\D/g, ""))
      const month = Number(String(rawMonth).replace(/\D/g, ""))
      if (Number.isInteger(year) && Number.isInteger(month) && year > 0 && month >= 1 && month <= 12) {
        return { year, month }
      }
    } catch {
      // التقويم غير متوفر في هذه البيئة — نجرب البديل ثم نعيد null
    }
  }
  return null
}

/**
 * اقتراح العام الدراسي الحالي وفق التقويم الهجري:
 *  - العام الدراسي يبدأ صيفًا (أواخر صفر/ربيع أول تقريبًا) وينتهي صيف السنة التالية.
 *  - إن كنا في محرم (الشهر 1) فنحن في ختام العام السابق → يُقترح (س-1)–س.
 *  - غير ذلك (صفر وما بعده حتى ذي الحجة) → يُقترح س–(س+1).
 * الناتج «اقتراح للعرض فقط»: مدير المدرسة هو من ينشئ وينشّط العام صراحة،
 * ولا يُطبَّق أي شيء تلقائيًا بمجرد تغيّر التاريخ (متطلب صريح في المواصفة).
 */
export function suggestAcademicYearStart(now: Date = new Date()): number | null {
  const parts = hijriPartsFor(now)
  if (!parts) return null
  const start = parts.month <= 1 ? parts.year - 1 : parts.year
  return isValidAcademicStartYear(start) ? start : null
}

// ===== فلتر العام الدراسي في الروابط — نفس نمط المراحل التعليمية =====

/** قيمة الفلتر للسجلات التاريخية التي لا عام دراسي لها (academicYearId = NULL) */
export const UNASSIGNED_YEAR = "UNASSIGNED"

/**
 * تحويل قيمة فلتر العام من الرابط إلى قيمة Prisma:
 *  - undefined: لا فلتر (كل الأعوام — السلوك الافتراضي)
 *  - null: السجلات غير المرتبطة بعام دراسي (للمراجعة)
 *  - نص: معرّف العام الدراسي (علاقة صريحة وليست نص عرض)
 * القيم الفارغة تُتجاهل، وأي نص آخر يُقبل كمعرّف مرشّح — الاستعلام مقيّد
 * دائمًا بنطاق المدرسة/الفرع فالمعرّفات المضروبة تعيد قائمة فارغة فقط.
 */
export type AcademicYearFilterValue = string | null

export function resolveAcademicYearFilter(
  raw: string | string[] | undefined | null
): AcademicYearFilterValue | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== "string") return undefined
  const v = value.trim()
  if (!v) return undefined
  if (v === UNASSIGNED_YEAR) return null
  return v
}

/** قيمة تُوضع في input hidden لتمرير الفلتر عبر GET forms */
export function academicYearFilterToParam(f: AcademicYearFilterValue | undefined): string | null {
  if (f === undefined) return null
  return f === null ? UNASSIGNED_YEAR : f
}