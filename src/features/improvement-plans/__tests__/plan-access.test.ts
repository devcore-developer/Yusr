// ===== FILE: src/features/improvement-plans/__tests__/plan-access.test.ts =====
// ============================================================
// اختبارات plan-access — تُشغَّل بـ: npx tsx <هذا الملف>
// لا prisma ولا Next — القاعدة النقية فقط (نفس نمط باقي الاختبارات)
// ============================================================

import { canViewPlan, type PlanAccessUser, type PlanAccessRow } from "../access"

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
function eq(actual: unknown, expected: unknown, msg = "") {
  if (actual !== expected) throw new Error(`${msg} — المتوقع ${String(expected)} والواقع ${String(actual)}`)
}

const plan = (over: Partial<PlanAccessRow> = {}): PlanAccessRow => ({
  schoolId: "school-1",
  branchId: "branch-1",
  createdById: "qa-1",
  ...over,
})

const user = (over: Partial<PlanAccessUser> = {}): PlanAccessUser => ({
  id: "u1",
  role: "QUALITY_ASSESSOR",
  schoolId: "school-1",
  ...over,
})

console.log("=== 1) مدير النظام (SUPER_ADMIN) ===")
test("يرى أي خطة في أي مدرسة", () => {
  eq(canViewPlan(user({ role: "SUPER_ADMIN", schoolId: null }), plan({ schoolId: "school-9" })), true)
})
test("يرى الخطة حتى لو كل حقولها فارغة", () => {
  eq(canViewPlan(user({ role: "SUPER_ADMIN", schoolId: null }), plan({ schoolId: null, branchId: null, createdById: null })), true)
})

console.log("=== 2) مدير المدرسة (SCHOOL_MANAGER) ===")
test("يرى خطط مدرسته (بفرع أو بلا فرع)", () => {
  eq(canViewPlan(user({ role: "SCHOOL_MANAGER" }), plan({ branchId: "branch-2" })), true)
  eq(canViewPlan(user({ role: "SCHOOL_MANAGER" }), plan({ branchId: null })), true)
})
test("لا يرى خطط مدرسة أخرى (تغيير الرابط لا يكشف شيئًا)", () => {
  eq(canViewPlan(user({ role: "SCHOOL_MANAGER" }), plan({ schoolId: "school-2" })), false)
})
test("بلا schoolId في حسابه → ممنوع", () => {
  eq(canViewPlan(user({ role: "SCHOOL_MANAGER", schoolId: null }), plan()), false)
})

console.log("=== 3) مدير القسم (BRANCH_MANAGER) ===")
test("يرى خطط فرعه المصرح به", () => {
  eq(canViewPlan(user({ role: "BRANCH_MANAGER" }), plan({ branchId: "branch-1" }), ["branch-1"]), true)
})
test("يرى الخطط على مستوى المدرسة كله (branchId = null)", () => {
  eq(canViewPlan(user({ role: "BRANCH_MANAGER" }), plan({ branchId: null }), ["branch-1"]), true)
})
test("لا يرى خطة فرع آخر في مدرسته", () => {
  eq(canViewPlan(user({ role: "BRANCH_MANAGER" }), plan({ branchId: "branch-2" }), ["branch-1"]), false)
})
test("لا يرى خطط مدرسة أخرى حتى لو معرّف الفرع متطابق", () => {
  eq(canViewPlan(user({ role: "BRANCH_MANAGER" }), plan({ schoolId: "school-2", branchId: "branch-1" }), ["branch-1"]), false)
})
test("بلا فروع مصرح بها → لا يرى إلا خطط المدرسة كله", () => {
  eq(canViewPlan(user({ role: "BRANCH_MANAGER" }), plan({ branchId: "branch-1" }), []), false)
  eq(canViewPlan(user({ role: "BRANCH_MANAGER" }), plan({ branchId: null }), []), true)
})

console.log("=== 4) مقيّم الجودة (QUALITY_ASSESSOR) ===")
test("يرى خططه هو فقط", () => {
  eq(canViewPlan(user({ id: "qa-1" }), plan({ createdById: "qa-1" })), true)
})
test("لا يرى خطة مقيّم آخر ولو في مدرسته (نفس السلوك القائم)", () => {
  eq(canViewPlan(user({ id: "qa-2" }), plan({ createdById: "qa-1" })), false)
})
test("خطة بلا منشئ → ممنوعة للجميع عدا الإدارة", () => {
  eq(canViewPlan(user({ id: "qa-1" }), plan({ createdById: null })), false)
})

console.log("=== 5) الأدوار الأخرى ===")
test("أي دور غير معروف → ممنوع", () => {
  eq(canViewPlan(user({ role: "TEACHER" }), plan()), false)
  eq(canViewPlan(user({ role: "" }), plan()), false)
})

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)