"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"

export async function saveInitiative(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized: Only Quality Assessors can create initiatives")

  const name = formData.get("name") as string
  if (!name) throw new Error("اسم المبادرة مطلوب")

  const indicatorsStr = formData.get("indicators") as string
  const programsStr = formData.get("programs") as string

  await prisma.initiative.create({
    data: {
      name,
      entity: formData.get("entity") as string,
      targetGroup: formData.get("targetGroup") as string,
      linkedPlanId: formData.get("linkedPlanId") as string || null,
      idea: formData.get("idea") as string,
      generalGoals: formData.get("generalGoals") as string,
      specialGoals: formData.get("specialGoals") as string,
      indicators: indicatorsStr ? JSON.parse(indicatorsStr) : [],
      programs: programsStr ? JSON.parse(programsStr) : [],
      followUp: formData.get("followUp") as string,
      duration: formData.get("duration") as string,
      evidenceText: formData.get("evidenceText") as string,
      evidenceUrl: formData.get("evidenceUrl") as string,
      impact: formData.get("impact") as string,
      sustainability: formData.get("sustainability") as string,
      improvementPlan: formData.get("improvementPlan") as string,
      schoolId: user.schoolId,
      createdById: user.id
    }
  })

  revalidatePath("/initiative")
}