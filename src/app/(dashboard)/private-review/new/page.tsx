"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"

export async function createPrivateReview(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") throw new Error("Unauthorized")

  const schoolId = formData.get("schoolId") as string
  const branchId = formData.get("branchId") as string || null

  const assessment = await prisma.assessment.create({
    data: {
      schoolId,
      branchId,
      assessorId: user.id,
      status: "IN_PROGRESS",
      type: "PRIVATE_REVIEW" // تحديد النوع كتقييم خاص
    }
  })

  redirect(`/quality-assessor/assessments/${assessment.id}`)
}