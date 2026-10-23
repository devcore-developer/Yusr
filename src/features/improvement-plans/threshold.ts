// ===== FILE: src/features/improvement-plans/threshold.ts =====
/**
 * حد إنشاء خطة الاستدامة — مصدر واحد للحقيقة (يُستورد من الخادم والعميل).
 * مطابق لحد فئة «ممتاز» في getPerformanceBand (90/75/50).
 * ملف نقي بلا أي اعتماديات — آمن للاستيراد في مكوّنات العميل
 * (خلاف ذلك لاستيراد queries.ts الذي يجرّ prisma إلى حزمة المتصفح).
 */
export const SUSTAINABILITY_THRESHOLD = 90

// ============================================================
// (Task 21 — إضافة فقط) تصنيف وتطبيع نوع الخطة — دوال نقية بلا اعتماديات
// ============================================================
// لماذا هنا؟ لأن منطق التوجيه (زر خطة استدامة مقابل خطة تحسين) ونطاقه كان
// مكررًا ضمنيًا بين المكوّن والخادم. استخراجه كدوال نقية من مصدر واحد:
//  - يجعل حدود 90% قابلة للاختبار الآلي مباشرة (89.99/90/90.01) كما في المواصفة.
//  - يضمن تطابق قرار العرض مع قرار الخادم حرفيًا (الخادم يبقى الفيصل عند الإنشاء).
// لا تُغيّر أي دلالة قائمة: نفس الشرط الذي كان مكتوبًا داخلًا في الموضعين.

export type PlanKind = "IMPROVEMENT" | "SUSTAINABILITY"

/**
 * تصنيف الدرجة المرجعية إلى نوع الخطة — القاعدة الموثقة:
 *   الدرجة ≥ 90 → SUSTAINABILITY (و90 بالضبط استدامة)، غير ذلك → IMPROVEMENT.
 * الدرجة غير المتاحة (null/undefined/غير رقمية) → IMPROVEMENT للعرض،
 * وهذا ليس «تصنيفًا صامتًا»: المكوّن يعرض حالة «الدرجة غير متاحة» بوضوح،
 * والخادم يرفض خطة استدامة بلا درجة موثوقة رفضًا صريحًا.
 */
export function classifyPlanKind(score: number | null | undefined): PlanKind {
  return score !== null &&
    score !== undefined &&
    Number.isFinite(score) &&
    score >= SUSTAINABILITY_THRESHOLD
    ? "SUSTAINABILITY"
    : "IMPROVEMENT"
}

/**
 * تطبيع نوع الخطة الوارد من العميل — أي قيمة غير «SUSTAINABILITY» حرفيًا
 * (بعد إزالة الفرط) ترجع إلى IMPROVEMENT الافتراضي الآمن.
 * نفس دلالة السطر الذي كان مكتوبًا داخل createEvidencePlan — أصبحت الآن
 * دالة واحدة مختبرة يستخدمها الخادم.
 */
export function normalizePlanKind(input: string | null | undefined): PlanKind {
  return (input ?? "").trim() === "SUSTAINABILITY" ? "SUSTAINABILITY" : "IMPROVEMENT"
}