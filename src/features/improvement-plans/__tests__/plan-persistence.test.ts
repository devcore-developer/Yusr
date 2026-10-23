// ===== FILE: src/features/improvement-plans/__tests__/plan-persistence.test.ts =====
// (جديد)

// ============================================================
// اختبارات استدامة حالة الخطة من الشواهد (Task 22) — تُشغَّل بـ: npx tsx <هذا الملف>
// لا prisma ولا Next — الطبقة النقية فقط (نفس نمط plan-classification.test.ts)
// ============================================================
// تغطية متطلبات المواصفة:
//   1) منع التكرار بقاعدة ضيقة موثقة: مدرسة + فرع + تقييم + مؤشر + نوع حصرًا
//      — لا مفتاح أوسع يمنع خططًا مشروعة منفصلة (تقييم جديد / نوع مختلف)
//   2) branchId: null يطابق صفوف NULL (خطة مستوى المدرسة لا تختلط بفروع)
//   3) اختيار الخطة القائمة للعرض من بين خطط المؤشر: الأفضلية لتصنيف الدرجة
//      من المصدر الواحد، مع سقوط آمن للخطة القائمة عند عبور المؤشر 90%
//   4) الفتح بالمعرف الفعلي (هوية الكائن) — لا مفهوم مطابقة عناوين أصلًا

import {
  buildEvidencePlanDuplicateWhere,
  pickExistingPlan,
  type ExistingPlanRef,
} from "../plan-context"

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
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}
function deepEq(a: unknown, b: unknown) {
  assert(JSON.stringify(a) === JSON.stringify(b), `متساويان بنيويًا: ${JSON.stringify(a)} مقابل ${JSON.stringify(b)}`)
}

console.log("— قاعدة منع التكرار الضيقة (buildEvidencePlanDuplicateWhere) —")

test("المفاتيح الخمسة حصرًا: مدرسة + فرع + تقييم + مؤشر + نوع — بلا أي مفتاح إضافي", () => {
  const where = buildEvidencePlanDuplicateWhere({
    schoolId: "school_1",
    branchId: "branch_1",
    assessmentId: "assess_1",
    indicatorId: "ind_1",
    kind: "IMPROVEMENT",
  })
  deepEq(Object.keys(where).sort(), ["assessmentId", "branchId", "indicatorId", "kind", "schoolId"])
  assert(where.schoolId === "school_1", "schoolId")
  assert(where.assessmentId === "assess_1", "assessmentId")
  assert(where.indicatorId === "ind_1", "indicatorId")
  assert(where.kind === "IMPROVEMENT", "kind")
})

test("فرع null يبقى null — خطة مستوى المدرسة تطابق صفوف NULL ولا تختلط بفروع", () => {
  const where = buildEvidencePlanDuplicateWhere({
    schoolId: "school_1",
    branchId: null,
    assessmentId: "assess_1",
    indicatorId: "ind_1",
    kind: "SUSTAINABILITY",
  })
  assert(where.branchId === null, "branchId يجب أن يبقى null حرفيًا (مطابقة صفوف NULL)")
  assert(where.kind === "SUSTAINABILITY", "kind")
})

test("تقييم مختلف = سياق مختلف — خطة العام الدراسي الجديد مشروعة لا يمنعها الشرط", () => {
  const a = buildEvidencePlanDuplicateWhere({ schoolId: "s", branchId: null, assessmentId: "assess_2024", indicatorId: "i", kind: "IMPROVEMENT" })
  const b = buildEvidencePlanDuplicateWhere({ schoolId: "s", branchId: null, assessmentId: "assess_2025", indicatorId: "i", kind: "IMPROVEMENT" })
  assert(JSON.stringify(a) !== JSON.stringify(b), "شرطا التقييمين مختلفان — كل تقييم يُنشئ خطته")
})

test("نوع مختلف = سياق مختلف — تحسين واستدامة لنفس المؤشر خطتان منفصلتان مشروعتان", () => {
  const a = buildEvidencePlanDuplicateWhere({ schoolId: "s", branchId: null, assessmentId: "a1", indicatorId: "i", kind: "IMPROVEMENT" })
  const b = buildEvidencePlanDuplicateWhere({ schoolId: "s", branchId: null, assessmentId: "a1", indicatorId: "i", kind: "SUSTAINABILITY" })
  assert(JSON.stringify(a) !== JSON.stringify(b), "شرطا النوعين مختلفان")
})

console.log("— اختيار الخطة القائمة للعرض (pickExistingPlan) —")

const improvement: ExistingPlanRef = { id: "plan_imp", kind: "IMPROVEMENT", status: "DRAFT" }
const sustainability: ExistingPlanRef = { id: "plan_sus", kind: "SUSTAINABILITY", status: "ACTIVE" }

test("بلا خطط (undefined/null/[]) → null — زر الإنشاء يبقى كما هو", () => {
  assert(pickExistingPlan(undefined, 40) === null, "undefined → null")
  assert(pickExistingPlan(null, 40) === null, "null → null")
  assert(pickExistingPlan([], 40) === null, "[] → null")
})

test("درجة < 90 وخطتا المؤشر متاحتان → خطة التحسين (تصنيف الدرجة من المصدر الواحد)", () => {
  const picked = pickExistingPlan([improvement, sustainability], 40)
  assert(picked?.id === "plan_imp", `المتوقع plan_imp وجد ${picked?.id}`)
})

test("درجة 90 بالضبط وخطتا المؤشر متاحتان → خطة الاستدامة", () => {
  const picked = pickExistingPlan([improvement, sustainability], 90)
  assert(picked?.id === "plan_sus", `المتوقع plan_sus وجد ${picked?.id}`)
})

test("عبور المؤشر 90% بعد إنشاء خطة تحسين → تظل خطة التحسين القائمة هي المعروضة (لا إغراء تكرار)", () => {
  const picked = pickExistingPlan([improvement], 95)
  assert(picked?.id === "plan_imp", "الخطة القائمة أولوية حتى لو غيّر التصنيف الحالي")
})

test("هبوط المؤشر تحت 90% بعد إنشاء خطة استدامة → تظل خطة الاستدامة القائمة هي المعروضة", () => {
  const picked = pickExistingPlan([sustainability], 50)
  assert(picked?.id === "plan_sus", "السقوط الآمن للخطة القائمة أولًا")
})

test("الفتح بالهوية الفعلية: المعاد هو نفس الكائن بمعرفه — لا مطابقة عناوين في التصميم أصلًا", () => {
  const pool: ExistingPlanRef[] = [{ id: "plan_x", kind: "IMPROVEMENT", status: "DRAFT" }]
  const picked = pickExistingPlan(pool, 40)
  assert(picked === pool[0], "نفس مرجع الكائن (الهوية بالمعرف)")
})

test("مسودة تُعاد كما هي: status يُنقل بلا تحوير ليقرر تلميح إكمال المسودة", () => {
  const draft: ExistingPlanRef = { id: "plan_d", kind: "IMPROVEMENT", status: "DRAFT" }
  const picked = pickExistingPlan([draft], 40)
  assert(picked?.status === "DRAFT", "status من قاعدة البيانات بلا تحوير")
})

console.log(`\nالنتائج: ${passed} نجح، ${failed} فشل`)
if (failed > 0) process.exit(1)