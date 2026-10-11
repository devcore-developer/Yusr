"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"

export async function saveNotes(assessmentId: string, indicatorId: string, notes: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  await prisma.assessmentResponse.upsert({
    where: { assessmentId_indicatorId: { assessmentId, indicatorId } },
    update: { notes },
    create: { assessmentId, indicatorId, notes, value: "NOT_APPLICABLE" }
  })

  // NO revalidatePath — notes autosave is silent
}

export async function addMockEvidence(assessmentId: string, responseId: string, indicatorId: string, name: string, type: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const mockUrl = `/uploads/${Date.now()}-${name}`
  
  await prisma.evidence.create({
    data: {
      responseId,
      assessmentId,
      indicatorId,
      uploadedById: user.id,
      type,
      name,
      url: mockUrl
    }
  })
  
  revalidatePath(`/quality-assessor/assessments/${assessmentId}`)
}

export async function confirmGap(assessmentId: string, responseId: string, indicatorId: string, description: string, severity: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const response = await prisma.assessmentResponse.findUnique({
    where: { id: responseId },
    include: { assessment: true }
  })

  if (!response || (response.assessment.assessorId !== user.id && user.role !== "SUPER_ADMIN")) {
    throw new Error("Forbidden")
  }

  await prisma.gap.create({
    data: {
      schoolId: response.assessment.schoolId,
      branchId: response.assessment.branchId,
      assessmentId,
      responseId,
      indicatorId,
      description,
      severity: severity as any,
      status: "OPEN"
    },
  })

  revalidatePath(`/quality/assessments/${assessmentId}/results`)
}

export async function updateGapStatus(gapId: string, status: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  await prisma.gap.update({
    where: { id: gapId },
    data: { status: status as any },
  })

  revalidatePath("/quality/gaps")
}