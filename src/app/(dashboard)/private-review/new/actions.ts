"use server"

// إنشاء مراجعة خاصة — مدير النظام فقط (مسار المراجعة الخاصة القائم)
// الإضافة: تثبيت العام الدراسي النشط للمدرسة وقت الإنشاء — بنفس قاعدة
// createNewAssessment: علاقة صريحة academicYearId، وبلا عام نشط يُنشأ NULL
// (يُعرض «غير محدد») ولا يُخترع ارتباط تاريخي أبدًا.

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"

export async function createPrivateReview(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") throw new Error("Unauthorized")

  const schoolId = formData.get("schoolId") as string
  const branchId = formData.get("branchId") as string || null

  // العام الدراسي النشط وقت الإنشاء — يُثبَّت على السجل ولا يتغير لاحقًا
  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true }
  })

  const assessment = await prisma.assessment.create({
    data: {
      schoolId,
      branchId,
      assessorId: user.id,
      status: "IN_PROGRESS",
      type: "PRIVATE_REVIEW",
      academicYearId: activeYear?.id ?? null
    }
  })

  redirect(`/quality-assessor/assessments/${assessment.id}`)
}