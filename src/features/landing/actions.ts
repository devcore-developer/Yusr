// ===== FILE: src/features/landing/actions.ts =====
"use server"

// ============================================================
// landing/actions.ts — نفس الدوال القائمة + إضافات تكامل الاستبانات فقط
// ============================================================
// حفظ الأول: سلوك addSurvey القائم محفوظ حرفيًا (نفس الحقول ونفس شكل الاستجابة
// {success}/{error} ونفس ربط schoolId بالمستخدم). الإضافات اختيارية بحتة:
//   - indicatorId (اختياري): ربط صريح بمعرّف البند — يُتحقق من وجوده، لا تخمين.
//   - respondents (اختياري): عدد الاستجابات كما يُدخله المستخدم — null = غير مسجل.
//   - تحقق خادمي 0..100 للنسبة (رفض القيم غير الصالحة بدل قبولها بصمت).
//   - إصلاح قراءة علم include: checkbox صفحة الاستبانات يرسل "on" بينما الكود القائم
//     يقارن بـ "true" فقط → كان يُخزَّن دائمًا false مهما اختار المستخدم.
//     القراءة الجديدة تقبل الاثنين ("true" من نموذج الهبوط القائم + "on" من checkbox)
//     فتعبّر القيمة المخزنة عن اختيار المستخدم الفعلي — لا تغيير لأي سلوك آخر.
// ============================================================
// (ربط الاستبانات بالتقييم — هذه المهمة) assessmentId أصبح إلزاميًا:
//   - كل استبانة جديدة تخص تقييمًا واحدًا محددًا — يُخزَّن معرّفه في Survey.assessmentId
//     (علاقة FK حقيقية) وتُقرأ منه كل نتائج/تحليلات الاستبانات في تقارير ذلك التقييم.
//   - تحقق خادمي مزدوج: الإلزامية (requireAssessmentChoice) ثم الوجود والنطاق
//     (assertAssessmentForSurvey) — لا يُعتمد على معرّف العميل دون فحص،
//     ولا يُقبل تقييم خارج نطاق المدرسة/المستأجر.
//   - سلوك كل ما عداه كما هو حرفيًا (type/percentage/include/note/indicatorId/respondents).
// ============================================================

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { requireAssessmentChoice } from "@/features/survey-integration/assessment-link"
import { assertAssessmentForSurvey } from "@/features/survey-integration/assessment-link.server"

export async function submitContactMessage(formData: FormData) {
  const name = formData.get("name") as string
  const institution = formData.get("institution") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const subject = formData.get("subject") as string
  const message = formData.get("message") as string

  if (!name || !email || !subject || !message) {
    return { error: "الرجاء تعبئة الحقول الإلزامية." }
  }

  try {
    await prisma.contactMessage.create({
      data: { name, institution: institution || null, email, phone: phone || null, subject, message },
    })
    return { success: true }
  } catch (error) {
    return { error: "حدث خطأ أثناء إرسال الرسالة. الرجاء المحاولة مرة أخرى." }
  }
}

export async function addSurvey(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const type = formData.get("type") as string
  const percentageRaw = formData.get("percentage") as string
  const include = formData.get("include") === "true" || formData.get("include") === "on" // إصلاح قراءة checkbox — انظر الترويسة
  const note = formData.get("note") as string
  const generalResult = formData.get("generalResult") as string

  // (جديد، اختياري) ربط صريح بمعرّف البند — فارغ = استبانة مستقلة تُحفظ كما هي
  const indicatorIdRaw = formData.get("indicatorId") as string | null
  const indicatorId = indicatorIdRaw && indicatorIdRaw.trim() !== "" ? indicatorIdRaw.trim() : null

  // (ربط الاستبانات بالتقييم — هذه المهمة) التقييم المرتبط: حقل إلزامي في كل الاتجاهات
  const assessmentIdRaw = formData.get("assessmentId") as string | null
  const requiredCheck = requireAssessmentChoice(assessmentIdRaw)
  if (!requiredCheck.ok) {
    return { error: requiredCheck.reason }
  }
  const assessmentId = (assessmentIdRaw as string).trim()
  // تحقق خادمي: التقييم موجود وداخل نطاق المستخدم (المدرسة/المستأجر) —
  // لا يُعتمد على معرّف العميل إطلاقًا قبل هذا الفحص
  const guard = await assertAssessmentForSurvey(assessmentId, { role: user.role, schoolId: user.schoolId ?? null })
  if (!guard.ok) {
    return { error: guard.error }
  }

  // (جديد، اختياري) عدد الاستجابات المسجل يدويًا
  const respondentsRaw = formData.get("respondents") as string | null
  let respondents: number | null = null
  if (respondentsRaw && respondentsRaw.trim() !== "") {
    const parsed = Number(respondentsRaw)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      return { error: "عدد الاستجابات يجب أن يكون عددًا صحيحًا غير سالب." }
    }
    respondents = parsed
  }

  if (!type || isNaN(parseFloat(percentageRaw))) {
    return { error: "البيانات غير صحيحة" }
  }

  // تحقق خادمي من النطاق — القيم خارج 0..100 تُرفض بدل تخزينها (السجلات التاريخية كما هي)
  const percentage = parseFloat(percentageRaw)
  if (percentage < 0 || percentage > 100) {
    return { error: "النسبة المئوية يجب أن تكون بين 0 و 100." }
  }

  // الربط الصريح: البند يجب أن يوجد فعلًا — لا ربط بقيمة تخمينية
  if (indicatorId !== null) {
    const indicator = await prisma.indicator.findUnique({
      where: { id: indicatorId },
      select: { id: true },
    })
    if (!indicator) {
      return { error: "المؤشر المحدد غير موجود في إطار التقويم." }
    }
  }

  try {
    await prisma.survey.create({
      data: {
        type,
        percentage,
        include,
        note: note || null,
        generalResult: generalResult || null,
        schoolId: user.schoolId || null,
        assessmentId: guard.assessment.id, // (ربط الاستبانات بالتقييم) علاقة مخزّنة بمعرّف مستقر — مُتحقق منه خادميًا
        indicatorId, // (جديد، اختياري) — null = غير مرتبطة (تنجو كالسابق)
        respondents, // (جديد، اختياري) — null = غير مسجل
      }
    })

    revalidatePath("/surveys")
    return { success: true }
  } catch (error) {
    return { error: "حدث خطأ أثناء حفظ الاستبانة." }
  }
}