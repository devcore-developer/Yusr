// ============================================================
// نظام عرض المحتوى الموحّد لإطار التطبيق (AppShell)
// ------------------------------------------------------------
// الهدف: مساحة عمل مركزية متوازنة بدل تمدد المحتوى حتى أطراف
// الشاشة، مع مرونة كافية لاختلاف أنواع الصفحات:
//   - «wide»    → الصفحات الغنية بالبيانات (جداول/تقارير/لوحات)
//   - «default» → باقي الصفحات
//   - «narrow»  → النماذج والإعدادات وصفحات النتائج/التفاصيل (تدفق مركّز)
// قواعد الثبات:
//   - لا يتغير أي سلوك وظيفي — تصنيف العرض قراءة فقط من pathname
//   - تحت حدود التمديد (لابتوب/تابلت/موبايل) العرض كامل كما كان،
//     فلا يُفرض إطار ضيّق على الشاشات الصغيرة إطلاقًا
//   - mx-auto محايدة تمامًا في RTL و LTR
//   - تجاوز اختياري contentWidth من الصفحة يتفوق على استنتاج المسار
//   - وحدات نقية بلا أي استيراد خادم أو Prisma — قابلة للاختبار مباشرة
// ============================================================

export type ContentWidth = "narrow" | "default" | "wide"

/** أصناف Tailwind الجاهزة لغلاف المحتوى داخل <main> — نقطة الالتقاء مع AppShell */
const CONTENT_WIDTH_CLASSES: Record<ContentWidth, string> = {
  narrow: "max-w-[960px]",
  default: "max-w-[1400px]",
  wide: "max-w-[1600px]",
}

// صفحات غنية بالبيانات: تحتاج أوسع مساحة عرض ممكنة للجداول والتقارير.
// (مسارات القسم المدرسي مشمولة أيضًا لأنها تشارك نفس AppShell)
// ملاحظة Task 30: /quality أُزيلت من هنا بقرار المستخدم — تحليلاتها بطاقات
// ومقاييس وليست جداول عريضة، فتعرض بالعرض الافتراضي المتوازن (1400px).
const WIDE_ROUTE_PREFIXES: readonly string[] = [
  "/dashboard",
  "/reports",
  "/evidence-bank",
  "/users",
  "/surveys",
  "/improvement-plans",
  "/quality-assessor",
  "/school-manager/quality",
  "/school-manager/users",
]

// نماذج وصفحات النتائج/التفاصيل: تدفق مركّز. تُفحص قبل القائمة العريضة —
// /school-manager/users/add نموذج داخل قسم مستخدمين عريض، و/quality/assessments
// مسار نتائج التقييم (شكوى المستخدم Task 30: «عريضة أكثر من اللازم» — بعرض
// 960px يبدأ التوسيط من شاشة ~1320px فما فوق فيظهر الإطار على أي شاشة سطح مكتب).
const NARROW_ROUTE_PREFIXES: readonly string[] = [
  "/settings",
  "/private-review/new",
  "/quality/assessments",
  "/school-manager/settings",
  "/school-manager/users/add",
]

/** مطابقة على حدود المقاطع: /users لا تلحق /usersx ولا /users-archive */
function matchesRoutePrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))
}

/**
 * استنتاج عرض المحتوى من المسار — قراءة فقط، بلا أي أثر على البيانات.
 * الصفحات غير المصنّفة تعرض العرض الافتراضي المتوازن (1400px).
 */
export function resolveContentWidth(pathname?: string | null, override?: ContentWidth): ContentWidth {
  if (override) return override
  if (!pathname) return "default"
  const path = pathname.split(/[?#]/)[0] ?? pathname
  if (matchesRoutePrefix(path, NARROW_ROUTE_PREFIXES)) return "narrow"
  if (matchesRoutePrefix(path, WIDE_ROUTE_PREFIXES)) return "wide"
  return "default"
}

/** صنف Tailwind الجاهز لغلاف المحتوى داخل main في AppShell */
export function resolveContentWidthClass(pathname?: string | null, override?: ContentWidth): string {
  return CONTENT_WIDTH_CLASSES[resolveContentWidth(pathname, override)]
}