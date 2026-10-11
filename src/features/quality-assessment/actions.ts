"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"

export async function saveEvidenceResponse(assessmentId: string, evidenceId: string, isVerified: boolean, visitNumber: number = 0, scoreValue?: number) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, assessorId: true, schoolId: true, branchId: true, type: true }
  })

  if (!assessment) throw new Error("Assessment not found")

  // السماح للسوبر أدمن بالتعديل في التقييمات الخاصة فقط
  if (user.role === "SUPER_ADMIN") {
    if (assessment.type !== "PRIVATE_REVIEW") {
      throw new Error("Forbidden: Super Admin cannot modify operational assessments")
    }
  } else {
    // منع المستخدمين العاديين من تعديل التقييمات الخاصة
    if (assessment.type === "PRIVATE_REVIEW") {
      throw new Error("Forbidden: Cannot modify private review")
    }
    // التحقق من الصلاحيات للملكية أو النطاق
    if (user.role === "SCHOOL_MANAGER" && assessment.schoolId !== user.schoolId) {
      throw new Error("Forbidden: Out of scope")
    }
    if (user.role === "BRANCH_MANAGER" && assessment.branchId !== user.branchId) {
      throw new Error("Forbidden: Out of scope")
    }
    if (user.role === "QUALITY_ASSESSOR" && assessment.assessorId !== user.id) {
      throw new Error("Forbidden: You are not assigned to this assessment")
    }
  }

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

  if (user.role === "SCHOOL_MANAGER") {
    if (assessment.schoolId !== user.schoolId) throw new Error("Forbidden")
  } else if (user.role === "BRANCH_MANAGER") {
    if (assessment.branchId !== user.branchId) throw new Error("Forbidden")
  } else if (assessment.assessorId !== user.id) {
    throw new Error("Forbidden")
  }

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

  // منع توليد الفجوات في التقييمات الخاصة لعدم تأثيرها على النتائج الرسمية
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

    // Log activity for operational assessments
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