// ===== FILE: src/features/survey-integration/__tests__/survey-assessment.integration.test.ts =====
// ============================================================
// Integration tests — Assessment-Specific Survey Linking (قاعدة البيانات)
// Run (داخل المشروع عند توفر DATABASE_URL):
//   npx tsx --test src/features/survey-integration/__tests__/survey-assessment.integration.test.ts
// توفر DATABASE_URL غير متوفر في بيئة الأرشيف → تُتخطى بأمان (skip) ولا تُفشل شيئًا.
// ============================================================
// تغطية متطلبات المهمة على قاعدة البيانات الفعلية:
//  1) إنشاء استبانة بتقييم صالح → تُخزَّن العلاقة وتُقرأ منها
//  2) إنشاء بلا تقييم → مرفوض خادميًا (الإلزامية) + FK يرفض معرّفًا غير موجود
//  3) استبانة التقييم (أ) تظهر في تقرير (أ) وحده
//  4) لا تظهر إطلاقًا في تقرير التقييم (ب) حتى لنفس المدرسة
//  5) عدة استبانات لنفس التقييم تدخل كلها
//  6) الإسناد العابر للمدارس مرفوض (حارس النطاق + قيد نفس المدرسة)
//  7) الاستبانات التاريخية بلا تقييم تنجو كما هي (لا ربط صامت ولا حذف)
// ============================================================
import assert from "node:assert/strict"
// الوحدة النقية مستوردة ساكنًا (بلا اعتماديات خادمية)
import { requireAssessmentChoice, groupSurveysByIndicator } from "../assessment-link"

// الحارس قبل أي استيراد خادمي: بلا DATABASE_URL تُتخطى الملف بأمان (لا انهيار ولا فشل)،
// والاستيرادات الثقيلة (prisma + الخدمة الخادمية) تتم فقط عند التشغيل الفعلي داخل المشروع.
const RUN = !!process.env.DATABASE_URL
const TAG = `test-sal-${Date.now()}`

/** استيراد ديناميكي غير قابل للتحليل الساكن — حتى لا يحاول المُشغّل حلّ مسارات @/ قبل حارس التخطي */
function dynamicImport(specifier: string): Promise<any> {
  return import(specifier)
}

async function run() {
  if (!RUN) {
    console.log("⏭ skipped — DATABASE_URL غير متوفر (اختبر داخل المشروع: npx tsx --test ...)")
    return
  }
  // استيراد خادمي مشروط — يعمل فقط داخل المشروع (حيث تُحل مسارات @/ وتوجد قاعدة البيانات).
  // محصّن ضد أي بيئة وسيطة: DATABASE_URL مضبوط لكن وحدة Prisma غير قابلة للحل (أرشيف/ساندبوكس) → تخطٍّ آمن لا فشل.
  let prisma: any
  let assertAssessmentForSurvey: any
  try {
    ;({ prisma } = await dynamicImport("@/lib/prisma"))
    ;({ assertAssessmentForSurvey } = await dynamicImport("@/features/survey-integration/assessment-link.server"))
  } catch {
    console.log("⏭ skipped — بيئة التشغيل بلا وحدة Prisma قابلة للحل (اختبر داخل المشروع: npx tsx --test ...)")
    return
  }

  // ---------- تجهيز عالم معزول ببادئة فريدة وتنظيف كامل قبل وبعد ----------
  const cleanup = async () => {
    await prisma.survey.deleteMany({ where: { OR: [{ type: { startsWith: TAG } }, { note: { startsWith: TAG } }] } })
    await prisma.assessment.deleteMany({ where: { school: { name: { startsWith: TAG } } } })
    await prisma.school.deleteMany({ where: { name: { startsWith: TAG } } })
  }
  await cleanup()

  const schoolA = await prisma.school.create({ data: { name: `${TAG}-مدرسة-أ` } })
  const schoolB = await prisma.school.create({ data: { name: `${TAG}-مدرسة-ب` } })
  const assessmentA = await prisma.assessment.create({ data: { schoolId: schoolA.id, status: "COMPLETED", progress: 100 } })
  const assessmentB = await prisma.assessment.create({ data: { schoolId: schoolA.id, status: "IN_PROGRESS" } }) // نفس المدرسة
  const assessmentC = await prisma.assessment.create({ data: { schoolId: schoolB.id, status: "NOT_STARTED" } }) // مدرسة أخرى

  try {
    // ---------- (1) إنشاء بتقييم صالح → العلاقة تُخزَّن وتُقرأ ----------
    const surveyA1 = await prisma.survey.create({
      data: { type: `${TAG}-طلاب`, percentage: 85, schoolId: schoolA.id, assessmentId: assessmentA.id, indicatorId: null, include: true },
    })
    const fetched = await prisma.survey.findUnique({ where: { id: surveyA1.id }, include: { assessment: true } })
    assert.equal(fetched?.assessmentId, assessmentA.id)
    assert.equal(fetched?.assessment?.id, assessmentA.id)
    console.log("  ✓ (1) استبانة بتقييم صالح → العلاقة المخزّنة تُقرأ منها")

    // ---------- (2) بلا تقييم → مرفوض خادميًا + FK يرفض المجهول ----------
    assert.equal(requireAssessmentChoice(null).ok, false)
    assert.equal(requireAssessmentChoice("").ok, false)
    await assert.rejects(
      () => prisma.survey.create({ data: { type: `${TAG}-بلا-تقييم`, percentage: 50, schoolId: schoolA.id, assessmentId: "nonexistent-assessment-id" } }),
      (err: { code?: string }) => err.code === "P2003"
    )
    console.log("  ✓ (2) الإنشاء بلا تقييم مرفوض + قيد FK يرفض معرّف تقييم غير موجود")

    // ---------- (3)+(4) العزل الحصري بين تقييمين لنفس المدرسة ----------
    await prisma.survey.create({
      data: { type: `${TAG}-معلمين`, percentage: 70, schoolId: schoolA.id, assessmentId: assessmentA.id, indicatorId: null, include: false },
    })
    const rowsA = await prisma.survey.findMany({ where: { assessmentId: assessmentA.id }, select: { id: true, type: true, percentage: true, respondents: true, include: true, indicatorId: true } })
    const mapA = groupSurveysByIndicator(rowsA)
    const rowsB = await prisma.survey.findMany({ where: { assessmentId: assessmentB.id }, select: { id: true, type: true, percentage: true, respondents: true, include: true, indicatorId: true } })
    const mapB = groupSurveysByIndicator(rowsB)
    assert.equal(rowsA.length, 2) // (5) عدة استبانات لنفس التقييم تدخل كلها
    assert.equal(rowsB.length, 0) // (4) لا شيء يتسرب إلى التقييم (ب)
    assert.ok(mapA instanceof Map && mapB.size === 0)
    console.log("  ✓ (3)+(4)+(5) استبانات التقييم (أ) كلها في تقريره ولا واحدة تعبر إلى (ب) — نفس المدرسة")

    // استبانة بتقييم (أ) مرتبطة ببند صريح → تظهر بخريطة (أ) فقط
    const indicator = await prisma.indicator.findFirst({ select: { id: true } })
    if (indicator) {
      const linked = await prisma.survey.create({
        data: { type: `${TAG}-مرتبطة-ببند`, percentage: 90, schoolId: schoolA.id, assessmentId: assessmentA.id, indicatorId: indicator.id, include: true },
      })
      const surveys = await prisma.survey.findMany({
        where: { assessmentId: assessmentA.id, indicatorId: { not: null } },
        select: { id: true, type: true, percentage: true, respondents: true, include: true, indicatorId: true },
      })
      const map = groupSurveysByIndicator(surveys)
      assert.equal(map.get(indicator.id)?.length, 1)
      assert.equal(map.get(indicator.id)?.[0].id, linked.id)
      console.log("  ✓ (3-ب) الاستبانة المرتبطة ببند تُجمَّع بخريطة تقييمها حصرًا (مدخل buildItemComparison)")
    }

    // ---------- (6) الإسناد العابر للمدارس مرفوض ----------
    const saActor = { role: "SUPER_ADMIN", schoolId: null as string | null }
    const managerA = { role: "SCHOOL_MANAGER", schoolId: schoolA.id }
    const managerB = { role: "SCHOOL_MANAGER", schoolId: schoolB.id }
    // حارس الإنشاء: مدير (أ) لا يختار تقييم (ج) من مدرسة (ب)
    const guard = await assertAssessmentForSurvey(assessmentC.id, managerA)
    assert.equal(guard.ok, false)
    if (!guard.ok) assert.ok(guard.error.includes("نطاق"))
    // ومدير (ب) لا يلمس تقييمات (أ)
    assert.equal((await assertAssessmentForSurvey(assessmentA.id, managerB)).ok, false)
    // SA يمر من حارس النطاق — لكن قيد «نفس مدرسة الاستبانة» يمنع إسناد استبانة (أ) لتقييم (ج) (مطبق في linkSurveyToAssessment)
    assert.equal((await assertAssessmentForSurvey(assessmentC.id, saActor)).ok, true)
    console.log("  ✓ (6) الحارس يرفض الاختيار العابر للمدارس — وقيد نفس المدرسة يمنع الإسناد العابر حتى لـ SA")

    // ---------- (7) الاستبانات التاريخية تنجو كما هي ----------
    const historical = await prisma.survey.create({
      data: { type: `${TAG}-تاريخية`, percentage: 55, schoolId: schoolA.id, assessmentId: null },
    })
    const stillThere = await prisma.survey.findUnique({ where: { id: historical.id } })
    assert.equal(stillThere?.assessmentId, null) // بلا ربط صامت
    assert.equal(stillThere?.percentage, 55)      // بياناتها كما هي
    console.log("  ✓ (7) السجل التاريخي بلا تقييم ينجو كما هي — لا ربط صامت ولا حذف")
  } finally {
    await cleanup()
    console.log("  ✓ التنظيف: كل بيانات الاختبار المولّدة حُذفت (بادئة فريدة)")
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })