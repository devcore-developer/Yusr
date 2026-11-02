// ===== FILE: src/features/survey-integration/__tests__/assessment-link.test.ts =====
// ============================================================
// Automated tests — Assessment-Specific Survey Linking (الوحدات النقية)
// Run:  npx tsx src/features/survey-integration/__tests__/assessment-link.test.ts
// Pure modules under test (zero server imports) — no database needed.
// ============================================================
// تغطية متطلبات المهمة القابلة للاختبار بدون قاعدة بيانات:
//  1) نطاق اختيار التقييم (SA الكل / البقية مدرستهم فقط / بلا مدرسة لا شيء)
//  2) إلزامية الاختيار — الاستبانة بلا تقييم مرفوضة برسالة عربية صريحة
//  3) التجميع بمعرّف البند: عدة استبانات لنفس التقييم تُجمَّع كلها بالترتيب،
//     وبلا رابط صريح لا تدخل الخريطة إطلاقًا
//  4) التسميات: عربية سليمة + أسماء مدارس إنجليزية دون انكسار (RTL/LTR)
//  5) السجل التاريخي: شارة ثابتة — لا ربط مُختلَع
// (اختبارات قاعدة البيانات الفعلية في survey-assessment.integration.test.ts —
//  تعمل عند توفر DATABASE_URL فقط)
// ============================================================
import assert from "node:assert/strict"
import {
  isAssessmentInUserScope,
  requireAssessmentChoice,
  ASSESSMENT_REQUIRED_MESSAGE,
  groupSurveysByIndicator,
  assessmentStatusLabelAr,
  buildAssessmentOption,
  buildAssessmentShortLabel,
  HISTORICAL_SURVEY_ASSESSMENT_LABEL,
  formatAssessmentDateAr,
  type SurveyRowForGrouping,
} from "../assessment-link"

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

console.log("— نطاق اختيار التقييم (نفس نطاق قائمة الاستبانات القائم) —")

test("SUPER_ADMIN يختار تقييمًا من أي مدرسة (نطاقه المنصة كاملة)", () => {
  assert.equal(isAssessmentInUserScope({ role: "SUPER_ADMIN", schoolId: null }, "school-A"), true)
  assert.equal(isAssessmentInUserScope({ role: "SUPER_ADMIN", schoolId: "school-B" }, "school-A"), true)
})

test("SCHOOL_MANAGER يختار تقييم مدرسته فقط — ومدرسة أخرى مرفوضة", () => {
  const manager = { role: "SCHOOL_MANAGER", schoolId: "school-A" }
  assert.equal(isAssessmentInUserScope(manager, "school-A"), true)
  assert.equal(isAssessmentInUserScope(manager, "school-B"), false)
})

test("المنتسب بلا مدرسة (schoolId = null) لا يرى أي تقييم خارج SA", () => {
  assert.equal(isAssessmentInUserScope({ role: "QUALITY_ASSESSOR", schoolId: null }, "school-A"), false)
  assert.equal(isAssessmentInUserScope({ role: "BRANCH_MANAGER", schoolId: null }, "school-A"), false)
})

test("BRANCH_MANAGER بمدرسة مطابقة يختار تقييم مدرسته (نفس نطاق إنشاء الاستبانات القائم)", () => {
  // بوابة الإنشاء = نطاق القائمة القائم (schoolId مطابق)؛ بوابة إعادة الإسناد أشد (SA/مدير فقط) وتُفرض في الأكشن
  assert.equal(isAssessmentInUserScope({ role: "BRANCH_MANAGER", schoolId: "school-A" }, "school-A"), true)
  assert.equal(isAssessmentInUserScope({ role: "BRANCH_MANAGER", schoolId: "school-A" }, "school-B"), false)
})

console.log("— إلزامية الاختيار (لا استبانة بلا تقييم) —")

test("إنشاء بلا تقييم (null/فراغ/مسافات) مرفوض برسالة عربية صريحة", () => {
  for (const bad of [null, undefined, "", "   "]) {
    const res = requireAssessmentChoice(bad as string | null | undefined)
    assert.equal(res.ok, false)
    if (!res.ok) assert.equal(res.reason, ASSESSMENT_REQUIRED_MESSAGE)
  }
  assert.ok(ASSESSMENT_REQUIRED_MESSAGE.includes("مطلوب"))
})

test("معرّف تقييم صالح يُقبل كما هو", () => {
  assert.deepEqual(requireAssessmentChoice("ass-1"), { ok: true })
})

console.log("— التجميع بمعرّف البند (مدخل تقرير التقييم) —")

const rows: SurveyRowForGrouping[] = [
  { id: "s1", type: "استبانة الطلاب", percentage: 88, respondents: 120, include: true, indicatorId: "ind-1" },
  { id: "s2", type: "استبانة المعلمين", percentage: 75, respondents: null, include: false, indicatorId: "ind-1" },
  { id: "s3", type: "استبانة أولياء الأمور", percentage: 92, respondents: 60, include: true, indicatorId: "ind-2" },
  { id: "s4", type: "استبانة الطلاب", percentage: 64, respondents: 30, include: false, indicatorId: null },
]

test("عدة استبانات لنفس التقييم تُجمَّع كلها بنفس البند وبالترتيب (متطلب 5)", () => {
  const map = groupSurveysByIndicator(rows)
  assert.equal(map.get("ind-1")?.length, 2)
  assert.equal(map.get("ind-1")?.[0].id, "s1")
  assert.equal(map.get("ind-1")?.[1].id, "s2")
  assert.equal(map.get("ind-2")?.length, 1)
})

test("الاستبانة بلا رابط صريح بالبند لا تدخل الخريطة إطلاقًا (لا احتساب تخميني)", () => {
  const map = groupSurveysByIndicator(rows)
  assert.equal(map.size, 2)
  assert.equal(map.has("ind-3"), false)
  // لا صف ولدته s4 بلا indicatorId
  const total = [...map.values()].reduce((n, list) => n + list.length, 0)
  assert.equal(total, 3)
})

test("شكل المخرجات مطابق لـ LinkedSurveyInput تمامًا (بلا indicatorId) — يصل لـ buildItemComparison بلا تغيير", () => {
  const map = groupSurveysByIndicator(rows)
  // (الشكل مقفول النوع بلا فهرسة) التحويل عبر unknown أولًا — فحص المفاتيح نفسه يبقى صارمًا بـ Object.keys
  const first = map.get("ind-1")?.[0] as unknown as Record<string, unknown>
  assert.deepEqual(Object.keys(first).sort(), ["id", "include", "percentage", "respondents", "type"])
})

test("خريطة فارغة لاستبانات بلا أي روابط صريحة (تقرير تقييم بلا استبانات مرتبطة)", () => {
  const empty = groupSurveysByIndicator([{ id: "x", type: "استبانة الطلاب", percentage: 50, respondents: null, include: false, indicatorId: null }])
  assert.equal(empty.size, 0)
})

console.log("— التسميات: عربية سليمة + محتوى إنجليزي دون انكسار —")

test("حالات التقييم الثلاث بتسمياتها العربية الرسمية", () => {
  assert.equal(assessmentStatusLabelAr("COMPLETED"), "مكتمل")
  assert.equal(assessmentStatusLabelAr("IN_PROGRESS"), "قيد التنفيذ")
  assert.equal(assessmentStatusLabelAr("NOT_STARTED"), "لم يبدأ")
  assert.equal(assessmentStatusLabelAr("UNKNOWN_FUTURE"), "UNKNOWN_FUTURE")
})

test("سطر الخيار يضم المدرسة والقسم والمرحلة والعام والحالة والتاريخ", () => {
  const opt = buildAssessmentOption({
    id: "ass-1",
    schoolId: "school-A",
    status: "COMPLETED",
    stage: "PRIMARY",
    startedAt: "2026-10-14T00:00:00.000Z",
    schoolName: "مدارس دار الفرسان",
    branchName: "قسم البنين",
    academicYearLabel: "1448–1449 هـ",
  })
  assert.equal(opt.value, "ass-1")
  assert.equal(opt.schoolId, "school-A")
  assert.ok(opt.label.includes("مدارس دار الفرسان — قسم البنين"))
  assert.ok(opt.label.includes("المرحلة: ابتدائي"))
  assert.ok(opt.label.includes("العام الدراسي 1448–1449 هـ"))
  assert.ok(opt.label.includes("مكتمل"))
  assert.ok(opt.label.includes(formatAssessmentDateAr("2026-10-14T00:00:00.000Z")))
})

test("تقييم بلا قسم وبلا عام: لا شرطات زائدة ولا قسم فارغ (التنسيق نظيف)", () => {
  const opt = buildAssessmentOption({
    id: "ass-2",
    schoolId: "school-A",
    status: "IN_PROGRESS",
    stage: null,
    startedAt: "2026-11-01T00:00:00.000Z",
    schoolName: "مدارس دار الفرسان",
    branchName: null,
    academicYearLabel: null,
  })
  assert.ok(opt.label.includes("مدارس دار الفرسان"))
  assert.ok(!opt.label.includes("— —"))
  assert.ok(opt.label.includes("المرحلة: غير محددة")) // سجل بلا مرحلة يظهر بشارة موحدة لا فراغ
  assert.ok(!opt.label.includes("العام الدراسي"))
})

test("اسم مدرسة إنجليزي يعمل دون انكسار (واجهة عربية RTL + محتوى لاتيني)", () => {
  const opt = buildAssessmentOption({
    id: "ass-3",
    schoolId: "school-B",
    status: "NOT_STARTED",
    stage: "SECONDARY",
    startedAt: "2027-01-05T00:00:00.000Z",
    schoolName: "Al-Fursan International Schools",
    branchName: "Boys Section",
    academicYearLabel: "1448–1449 هـ",
  })
  assert.ok(opt.label.includes("Al-Fursan International Schools — Boys Section"))
  assert.ok(opt.label.includes("لم يبدأ"))
  assert.ok(opt.label.includes("المرحلة: ثانوي"))
})

console.log("— السجل التاريخي (استبانات قائمة بلا تقييم) —")

test("شارة السجل التاريخي ثابتة وواضحة — لا ربط مُختلَع", () => {
  assert.equal(HISTORICAL_SURVEY_ASSESSMENT_LABEL, "غير مرتبطة بتقييم (سجل تاريخي)")
  assert.ok(HISTORICAL_SURVEY_ASSESSMENT_LABEL.length > 0)
})

test("الشارة المختصرة للقائمة تضم المرحلة والحالة والتاريخ", () => {
  const short = buildAssessmentShortLabel({ status: "COMPLETED", stage: "PRIMARY", startedAt: "2026-10-14T00:00:00.000Z" })
  assert.ok(short.includes("ابتدائي"))
  assert.ok(short.includes("مكتمل"))
})

// ============================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) process.exit(1)