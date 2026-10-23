"use server"

// ============================================================
// إدارة العام الدراسي الهجري — أكشنز خادمية لمدير المدرسة
//
// قواعد صارمة (متطلبات الميزة):
//  - الإنشاء والتنشيط والحذف محصوران: مدير المدرسة لمدرسته فقط.
//    (مدير النظام مسموح لأي مدرسة — سلطة معالجة السجلات القائمة في المنصة)
//  - عام نشط واحد لكل مدرسة: التبديل يتم في معاملة واحدة (إطفاء الكل ثم
//    تفعيل المطلوب) وفوقه فهرس فريد جزئي على مستوى قاعدة البيانات.
//  - تبديل العام النشط لا يعدّل أي سجل تاريخي — التقييمات وخطط التحسين
//    تحتفظ بعامها المخزّن وقت إنشائها مهما تغيّر العام النشط لاحقًا.
//  - لا حذف لعام مرتبط بسجلات (تقييمات/خطط) — يُرفض على الخادم بمسألة واضحة
//    ويعاد للعام كعام تاريخي محفوظ.
//  - كل عملية تُسجَّل في سجل النشاط (Activity) للتدقيق.
//  - لا اعتماد على أي تحقق في العميل — القيم تُتحقق هنا دائمًا.
// ============================================================

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import {
  formatAcademicYearLabel,
  isValidAcademicStartYear
} from "@/lib/academic-year"

/** من يدير أعوام مدرسة معينة؟ مدير المدرسة (مدرسته فقط) أو مدير النظام */
function assertYearManagement(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>, schoolId: string): void {
  if (user.role === "SUPER_ADMIN") return
  if (user.role === "SCHOOL_MANAGER" && user.schoolId && user.schoolId === schoolId) return
  throw new Error("Forbidden: إدارة العام الدراسي محصورة بمدير المدرسة لمدرسته فقط.")
}

async function requireYearForManagement(yearId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const year = await prisma.academicYear.findUnique({
    where: { id: yearId },
    select: { id: true, schoolId: true, startYear: true, label: true, isActive: true }
  })
  if (!year) throw new Error("العام الدراسي المطلوب غير موجود.")

  assertYearManagement(user, year.schoolId)
  return { user, year }
}

/**
 * إنشاء عام دراسي جديد لمدرسة — يُنشأ غير نشط؛ التنشيط بفعل صريح منفصل.
 * startYear: السنة الهجرية التي يبدأ بها العام (1448 تعني «1448–1449 هـ»).
 */
export async function createAcademicYear(
  schoolId: string,
  startYearInput: unknown
): Promise<{ id: string; label: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")
  assertYearManagement(user, schoolId)

  const startYear =
    typeof startYearInput === "string" ? Number(startYearInput.trim()) : startYearInput
  if (!isValidAcademicStartYear(startYear)) {
    throw new Error(
      `أدخل سنة هجرية صحيحة لبداية العام (رقم صحيح بين 1400 و1500). مثال: 1448 لعام «1448–1449 هـ».`
    )
  }

  const label = formatAcademicYearLabel(startYear)

  try {
    const year = await prisma.academicYear.create({
      data: { schoolId, startYear, label, isActive: false }
    })

    await prisma.activity.create({
      data: {
        actorId: user.id,
        schoolId,
        action: "CREATE",
        entityType: "ACADEMIC_YEAR",
        entityId: year.id,
        metadata: { description: `تم إنشاء العام الدراسي «${label}» (غير نشط).` }
      }
    })

    revalidatePath("/school-manager/settings")
    return { id: year.id, label: year.label }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error(`العام الدراسي «${label}» مسجل بالفعل لهذه المدرسة.`)
    }
    throw error
  }
}

/**
 * تنشيط عام دراسي وتبديل النشط القائم في معاملة واحدة ذرية:
 * إطفاء كل أعوام المدرسة ثم تفعيل المطلوب — لا لحظة يكون فيها عامان نشطين،
 * والفهرس الفريد الجزئي على قاعدة البيانات ضامن حتى لو اختل أي مسار مستقبلي.
 * لا يمس أي تقييم أو خطة أو تقرير — السجلات تحتفظ بعامها المخزّن.
 */
export async function activateAcademicYear(yearId: string): Promise<void> {
  const { user, year } = await requireYearForManagement(yearId)

  if (!year.isActive) {
    await prisma.$transaction([
      prisma.academicYear.updateMany({
        where: { schoolId: year.schoolId, isActive: true },
        data: { isActive: false }
      }),
      prisma.academicYear.update({
        where: { id: year.id },
        data: { isActive: true }
      })
    ])

    await prisma.activity.create({
      data: {
        actorId: user.id,
        schoolId: year.schoolId,
        action: "UPDATE",
        entityType: "ACADEMIC_YEAR",
        entityId: year.id,
        metadata: {
          description: `تم تنشيط العام الدراسي «${year.label}» وجعله العام النشط للمدرسة (بدون تعديل أي سجل تاريخي).`
        }
      }
    })
  }

  revalidatePath("/school-manager/settings")
}

/**
 * حذف عام دراسي — مسموح فقط إن كان غير مرتبط بأي تقييمات أو خطط تحسين.
 * العام المرتبط بسجلات يُرفض حذفه دائمًا (حماية البيانات التاريخية) —
 * يبقى محفوظًا كعام تاريخي ولا يمكن لأي رابط أو فلتر أن يفقده.
 */
export async function deleteAcademicYear(yearId: string): Promise<void> {
  const { user, year } = await requireYearForManagement(yearId)

  const [assessmentCount, planCount] = await Promise.all([
    prisma.assessment.count({ where: { academicYearId: year.id } }),
    prisma.improvementPlan.count({ where: { academicYearId: year.id } })
  ])

  if (assessmentCount > 0 || planCount > 0) {
    throw new Error(
      `لا يمكن حذف «${year.label}» لأنه مرتبط بسجلات (${assessmentCount} تقييم، ${planCount} خطة تحسين). ` +
        `الأعوام المرتبطة بسجلات تبقى محفوظة كعام تاريخي.`
    )
  }

  await prisma.academicYear.delete({ where: { id: year.id } })

  await prisma.activity.create({
    data: {
      actorId: user.id,
      schoolId: year.schoolId,
      action: "DELETE",
      entityType: "ACADEMIC_YEAR",
      entityId: year.id,
      metadata: {
        description: `تم حذف العام الدراسي «${year.label}» — كان غير مرتبط بأي سجلات.`
      }
    }
  })

  revalidatePath("/school-manager/settings")
}