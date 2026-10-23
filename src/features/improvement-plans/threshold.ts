// ===== FILE: src/features/improvement-plans/threshold.ts =====
/**
 * حد إنشاء خطة الاستدامة — مصدر واحد للحقيقة (يُستورد من الخادم والعميل).
 * مطابق لحد فئة «ممتاز» في getPerformanceBand (90/75/50).
 * ملف نقي بلا أي اعتماديات — آمن للاستيراد في مكوّنات العميل
 * (خلاف ذلك لاستيراد queries.ts الذي يجرّ prisma إلى حزمة المتصفح).
 */
export const SUSTAINABILITY_THRESHOLD = 90