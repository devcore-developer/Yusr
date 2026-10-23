// ===== FILE: src/features/improvement-plans/plan-context.ts =====
// (جديد — وحدة نقية بلا أي اعتماديات)

// ============================================================
// plan-context.ts — هوية سياق الخطة من الشواهد (Task 22 — إضافة فقط)
// ============================================================
// وحدة نقية بلا أي اعتماديات (بما فيها prisma) — آمنة للخادم والعميل
// والاختبار الآلي المباشر، بنفس نمط threshold.ts و score.ts.
//
// لماذا هذا الملف؟
//   1) منع التكرار عند إنشاء خطة من سياق الشواهد يجب أن يكون قاعدة ضيقة
//      موثقة: نفس المدرسة + الفرع + التقييم + المؤشر + النوع. أي قاعدة أوسع
//      (مثل مؤشر بلا تقييم، أو نوع مختلف) ستمنع خططًا مشروعة منفصلة
//      (تقييم عام دراسي جديد = خطة جديدة مشروعة، ونوع مختلف = خطة منفصلة مشروعة).
//      بناء شرط التطابق هنا يجعل القاعدة قابلة للاختبار الآلي مباشرة،
//      والخادم (createEvidencePlan) هو من ينفذها فعليًا.
//   2) اختيار الخطة القائمة المعروضة لصف شاهد (زر الحالة الأخضر) يعتمد
//      تصنيف الدرجة الحالي من المصدر الواحد classifyPlanKind — لا مطابقة
//      بعناوين عربية ولا أسماء مؤشرات (المعرفات فقط).

import { classifyPlanKind, type PlanKind } from "./threshold"

/** مرجع الخطة القائمة كما يُعرض في زر الحالة — من قاعدة البيانات حصرًا */
export interface ExistingPlanRef {
  id: string
  /** من عمود kind في قاعدة البيانات (IMPROVEMENT | SUSTAINABILITY) — لا يُخمَّن من العميل */
  kind: string
  /** من عمود status (DRAFT | ACTIVE | COMPLETED ...) — يحدد تلميح «أكمل المسودة» */
  status: string
}

/**
 * سياق الإنشاء القابل للتطبيق — المفاتيح الخمسة الضيقة للمواصفة:
 * مدرسة + فرع + تقييم + مؤشر + نوع.
 * assessmentId إلزامي هنا عمدًا: منع التكرار يُطبق فقط عندما يوجد سياق تقييم
 * موثق (مسار بنك الشواهد يمرره دائمًا). بلا تقييم لا يمكن إثبات «نفس السياق»
 * فلا يُطبق التكرار إطلاقًا (أضيق قاعدة ممكنة — لا حظر لخطط مشروعة).
 */
export interface EvidencePlanContext {
  schoolId: string
  /** null = خطة على مستوى المدرسة — يُطابق صفوف branchId = NULL في القاعدة */
  branchId: string | null
  assessmentId: string
  indicatorId: string
  kind: PlanKind
}

/**
 * نقي: شرط التطابق الضيق لمنع تكرار خطة من سياق الشواهد.
 * يُستخدم في findFirst على الخادم — كائن شرط صريح بالمفاتيح الخمسة حصرًا
 * (branchId: null يطابق صفوف NULL — فالخطة على مستوى المدرسة لا تختلط بفروع).
 * لا يُضمن أي مفتاح آخر (gapId أو غيره) حتى لا تمتد القاعدة لمنع خطط مسارات أخرى.
 */
export function buildEvidencePlanDuplicateWhere(ctx: EvidencePlanContext): {
  schoolId: string
  branchId: string | null
  assessmentId: string
  indicatorId: string
  kind: PlanKind
} {
  return {
    schoolId: ctx.schoolId,
    branchId: ctx.branchId,
    assessmentId: ctx.assessmentId,
    indicatorId: ctx.indicatorId,
    kind: ctx.kind,
  }
}

/**
 * نقي: اختيار الخطة القائمة المعروضة لصف شاهد من بين خطط مؤشره في التقييم المرجعي.
 * القاعدة: الأفضلية لخطة بنفس تصنيف الدرجة الحالي (من classifyPlanKind — المصدر
 * الواحد لحد 90%)، وإن لم توجد تُعاد أولى خطة المؤشر (حالات العبور: مؤشر أنشئت
 * له خطة تحسين ثم تجاوز 90% يظل يفتح خطته القائمة بدل إغراء إنشاء مكرر).
 * pool = خطط هذا المؤشر حصرًا (يجلبها الخادم بمعرفات صريحة — لا مطابقة عناوين).
 * لا خطط → null (يعود زر الإنشاء كما هو).
 */
export function pickExistingPlan(
  pool: ExistingPlanRef[] | undefined | null,
  score: number | null
): ExistingPlanRef | null {
  if (!pool || pool.length === 0) return null
  const wanted: PlanKind = classifyPlanKind(score)
  const matchingKind = pool.find((p) => p.kind === wanted)
  return matchingKind ?? pool[0]
}