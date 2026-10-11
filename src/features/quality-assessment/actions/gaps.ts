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
    create: { assessmentId, indicatorId, notes }
  })
}

export async function addMockEvidence(assessmentId: string, indicatorId: string, name: string, type: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const mockUrl = `/uploads/${Date.now()}-${name}`
  
  await prisma.evidence.create({
    data: {
      assessmentId,
      uploadedById: user.id,
      type,
      name,
      url: mockUrl
    }
  })
  
  revalidatePath(`/quality-assessor/assessments/${assessmentId}`)
}

export async function confirmGap(assessmentId: string, indicatorId: string, description: string, severity: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId }
  })

  if (!assessment || (assessment.assessorId !== user.id && user.role !== "SUPER_ADMIN")) {
    throw new Error("Forbidden")
  }

  await prisma.gap.create({
    data: {
      schoolId: assessment.schoolId,
      branchId: assessment.branchId,
      assessmentId,
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
  revalidatePath("/gaps")
}