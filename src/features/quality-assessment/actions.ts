"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function saveEvidenceResponse(assessmentId: string, evidenceId: string, isVerified: boolean, visitNumber: number = 0, scoreValue?: number) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, assessorId: true, schoolId: true, branchId: true, type: true, status: true }
  })

  if (!assessment) throw new Error("Assessment not found")

  // 1. التحقق من الملكية الصارمة لعزل التقييمات
  if (user.role === "SUPER_ADMIN") {
    if (assessment.type !== "PRIVATE_REVIEW") {
      throw new Error("Forbidden: Super Admin cannot modify operational assessments")
    }
    if (assessment.assessorId !== user.id) {
      throw new Error("Forbidden: You can only edit your own private reviews.")
    }
  } else {
    if (assessment.type === "PRIVATE_REVIEW") {
      throw new Error("Forbidden: Cannot modify private review")
    }
    // منع أي مستخدم من تعديل تقييم يخص مستخدماً آخر
    if (assessment.assessorId !== user.id) {
      throw new Error("Forbidden: You can only modify assessments assigned to you.")
    }
    // فحوصات النطاق الإضافية للأمان
    if (user.role === "SCHOOL_MANAGER" && assessment.schoolId !== user.schoolId) throw new Error("Forbidden: Out of scope")
    if (user.role === "BRANCH_MANAGER" && assessment.branchId !== user.branchId) throw new Error("Forbidden: Out of scope")
  }

  if (isVerified) {
    await prisma.evidenceResponse.upsert({
      where: {
        assessmentId_evidenceId_visitNumber: {
          assessmentId,
          evidenceId,
          visitNumber
        }
      },
      update: { isVerified, scoreValue: scoreValue || null },
      create: {
        assessmentId,
        evidenceId,
        isVerified,
        visitNumber,
        scoreValue: scoreValue || null
      }
    })
  } else {
    await prisma.evidenceResponse.deleteMany({
      where: { assessmentId, evidenceId, visitNumber }
    })
  }

  const totalEvidence = await prisma.fixedEvidence.count()
  const verifiedEvidence = await prisma.evidenceResponse.count({
    where: { assessmentId, isVerified: true }
  })
  
  const progress = totalEvidence > 0 ? Math.round((verifiedEvidence / totalEvidence) * 100) : 0
  
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { progress, status: "IN_PROGRESS" }
  })
}

export async function finishAssessment(assessmentId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  if (user.role === "SUPER_ADMIN") {
    throw new Error("Forbidden: Super Admin cannot finish assessments through this action. Use the private review workflow if applicable.")
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { assessorId: true, schoolId: true, branchId: true, type: true }
  })

  if (!assessment) throw new Error("Assessment not found")

  // التحقق من الملكية الصارمة
  if (assessment.assessorId !== user.id) {
    throw new Error("Forbidden: You can only finish your own assessments.")
  }

  if (user.role === "SCHOOL_MANAGER" && assessment.schoolId !== user.schoolId) throw new Error("Forbidden")
  if (user.role === "BRANCH_MANAGER" && assessment.branchId !== user.branchId) throw new Error("Forbidden")

  const totalIndicators = await prisma.indicator.count({ where: { coverage: "مغطى" } })
  const answeredIndicators = await prisma.evidenceResponse.count({ 
    where: { assessmentId, isVerified: true } 
  })

  if (answeredIndicators < totalIndicators) {
    throw new Error("Cannot finish: There are uncovered indicators remaining.")
  }

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { 
      status: "COMPLETED", 
      completedAt: new Date(),
      submittedAt: new Date()
    },
  })

  if (assessment.type !== "PRIVATE_REVIEW") {
    const unverifiedEvidence = await prisma.fixedEvidence.findMany({
      where: {
        NOT: {
          responses: {
            some: {
              assessmentId,
              isVerified: true
            }
          }
        }
      },
      include: { indicator: true }
    })

    for (const ev of unverifiedEvidence) {
      const existingGap = await prisma.gap.findFirst({
        where: { assessmentId, indicatorId: ev.indicatorId }
      })

      if (!existingGap) {
        await prisma.gap.create({
          data: {
            schoolId: assessment.schoolId,
            branchId: assessment.branchId,
            assessmentId,
            indicatorId: ev.indicatorId,
            description: `مؤشر لم يثبت تحققه: ${ev.indicator.description}`,
            severity: "HIGH",
            status: "OPEN"
          }
        })
      }
    }

    await prisma.activity.create({
      data: {
        actorId: user.id,
        schoolId: assessment.schoolId,
        branchId: assessment.branchId,
        action: "SUBMIT",
        entityType: "ASSESSMENT",
        entityId: assessmentId,
        metadata: { description: `تم تسليم تقييم بواسطة ${user.name}` }
      }
    })
  }

  revalidatePath("/quality-assessor")
  revalidatePath(`/quality-assessor/assessments/${assessmentId}`)
}

export async function uploadAttachment(assessmentId: string, evidenceId: string, file: { name: string, type: string, size: number, data: string }) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) throw new Error("نوع الملف غير مدعوم")
  if (file.size > 2 * 1024 * 1024) throw new Error("حجم الملف يتجاوز 2 ميجابايت")

  return await prisma.assessmentAttachment.create({
    data: {
      assessmentId,
      evidenceId,
      uploadedById: user.id,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fileData: file.data
    }
  })
}

export async function deleteAttachment(attachmentId: string, assessmentId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  await prisma.assessmentAttachment.delete({
    where: { id: attachmentId }
  })
}
export async function createNewAssessment() {
  const user = await getCurrentUser()
  if (!user || !user.schoolId) throw new Error("Unauthorized")

  const assessment = await prisma.assessment.create({
    data: {
      schoolId: user.schoolId,
      branchId: user.branchId || null,
      assessorId: user.id,
      status: "IN_PROGRESS",
      type: "NORMAL"
    }
  })
  redirect(`/quality-assessor/assessments/${assessment.id}`)
}