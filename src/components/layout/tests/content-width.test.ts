// ============================================================
// Automated tests — Content Width Resolution (إطار المحتوى في AppShell)
// Run:  npx tsx src/components/layout/__tests__/content-width.test.ts
// Pure module under test (zero server imports) — no database needed.
// ============================================================
// يغطي:
//  1) أولوية التجاوز اليدوي contentWidth على استنتاج المسار
//  2) تصنيف المسارات: عريضة/ضيقة/افتراضية + أولوية الضيقة عند التقاطع
//     (/school-manager/users/add نموذج داخل قسم مستخدمين عريض)
//  3) مطابقة حدود المقاطع — لا إيجابيات خاطئة (/usersx ليست /users)
//  4) pathname الفارغ أو مع استعلام/هاش → تعامل آمن
//  5) أصناف Tailwind الثابتة نفسها (نقطة الالتقاء مع AppShell)
// ============================================================
import assert from "node:assert/strict"
import { resolveContentWidth, resolveContentWidthClass } from "../content-width"

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    passed++
    console.log(`  ✓ ${name}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${name}`)
    console.error(err)
  }
}

console.log("— override (التجاوز اليدوي يتفوق على استنتاج المسار) —")

test("override narrow wins even on a wide route (/reports)", () => {
  assert.equal(resolveContentWidth("/reports", "narrow"), "narrow")
})

test("override wide wins even on a narrow route (/settings)", () => {
  assert.equal(resolveContentWidth("/settings", "wide"), "wide")
})

test("override default forces the balanced width anywhere", () => {
  assert.equal(resolveContentWidth("/dashboard", "default"), "default")
})

test("override flows through resolveContentWidthClass", () => {
  assert.equal(resolveContentWidthClass("/reports", "narrow"), "max-w-[960px]")
})

console.log("— wide routes (الصفحات الغنية بالبيانات) —")

test("/reports and /reports/compare → wide", () => {
  assert.equal(resolveContentWidth("/reports"), "wide")
  assert.equal(resolveContentWidth("/reports/compare"), "wide")
})

test("/dashboard and nested school detail → wide", () => {
  assert.equal(resolveContentWidth("/dashboard"), "wide")
  assert.equal(resolveContentWidth("/dashboard/schools"), "wide")
  assert.equal(resolveContentWidth("/dashboard/schools/school-1"), "wide")
})

test("data-heavy surfaces → wide", () => {
  assert.equal(resolveContentWidth("/evidence-bank"), "wide")
  assert.equal(resolveContentWidth("/users"), "wide")
  assert.equal(resolveContentWidth("/quality"), "wide")
  assert.equal(resolveContentWidth("/surveys"), "wide")
  assert.equal(resolveContentWidth("/improvement-plans"), "wide")
  assert.equal(resolveContentWidth("/improvement-plans/plan-9"), "wide")
  assert.equal(resolveContentWidth("/quality-assessor"), "wide")
})

test("assessment results page (الشكوى الأصلية) → wide", () => {
  assert.equal(resolveContentWidth("/quality/assessments/ass-1/results"), "wide")
})

test("school-manager data sections → wide", () => {
  assert.equal(resolveContentWidth("/school-manager/quality/improvement-plans"), "wide")
  assert.equal(resolveContentWidth("/school-manager/users"), "wide")
})

console.log("— narrow routes (النماذج والإعدادات) —")

test("/settings → narrow", () => {
  assert.equal(resolveContentWidth("/settings"), "narrow")
})

test("/school-manager/settings → narrow", () => {
  assert.equal(resolveContentWidth("/school-manager/settings"), "narrow")
})

test("/school-manager/users/add → narrow (نموذج داخل قسم عريض — الضيقة أولى)", () => {
  assert.equal(resolveContentWidth("/school-manager/users/add"), "narrow")
})

test("/private-review/new → narrow", () => {
  assert.equal(resolveContentWidth("/private-review/new"), "narrow")
})

console.log("— default & safety (المسارات غير المصنّفة والسلامة) —")

test("unknown route → default", () => {
  assert.equal(resolveContentWidth("/some-future-page"), "default")
})

test("empty/missing pathname → default", () => {
  assert.equal(resolveContentWidth(undefined), "default")
  assert.equal(resolveContentWidth(null), "default")
  assert.equal(resolveContentWidth(""), "default")
})

test("segment-boundary matching — no false positives", () => {
  assert.equal(resolveContentWidth("/usersx"), "default")
  assert.equal(resolveContentWidth("/users-archive"), "default")
  assert.equal(resolveContentWidth("/settings-archive"), "default")
  assert.equal(resolveContentWidth("/dashboards"), "default")
  assert.equal(resolveContentWidth("/reportsx"), "default")
})

test("defensive: query/hash fragments do not affect the match", () => {
  assert.equal(resolveContentWidth("/reports?stage=KG1"), "wide")
  assert.equal(resolveContentWidth("/settings#profile"), "narrow")
})

console.log("— tailwind classes (نقطة الالتقاء مع AppShell) —")

test("the three tier classes are the exact agreed values", () => {
  assert.equal(resolveContentWidthClass("/settings"), "max-w-[960px]")
  assert.equal(resolveContentWidthClass("/some-future-page"), "max-w-[1400px]")
  assert.equal(resolveContentWidthClass("/reports"), "max-w-[1600px]")
})

test("composed class is a valid mx-auto wrapper value", () => {
  const cls = resolveContentWidthClass("/dashboard")
  assert.ok(cls.startsWith("max-w-["))
  assert.ok(!cls.includes("mx-auto")) // التوسيط يبقى في AppShell — لا تكرار
})

// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)