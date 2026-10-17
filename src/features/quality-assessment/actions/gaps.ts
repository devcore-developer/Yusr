"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser, checkAssessmentAccess, getAuthorizedBranchIds } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { GapStatus } from "@prisma/client"

const VALID_GAP_STATUSES: string[] = ["OPEN", "IN_PROGRESS", "RESOLVED"]

export async function saveNotes(assessmentId: string, indicatorId: string, notes: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  // الإصلاح: كان هذا الإجراء يكتب ملاحظات في أي تقييم بأي ID بدون فحص — الآن فحص كتابة صارم
  const access = await checkAssessmentAccess(assessmentId, "write")
  if (!access.allowed) throw new Error("Forbidden")

  await prisma.assessmentResponse.upsert({
    where: { assessmentId_indicatorId: { assessmentId, indicatorId } },
    update: { notes },
    create: { assessmentId, indicatorId, notes }
  })
}

export async function addMockEvidence(assessmentId: string, indicatorId: string, name: string, type: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  // الإصلاح: فحص كتابة صارم قبل إدخال الأدلة
  const access = await checkAssessmentAccess(assessmentId, "write")
  if (!access.allowed) throw new Error("Forbidden")

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

  // الإصلاح: فحص كتابة موحد — يمنع مدير النظام من إنشاء فجوات في التقييمات التشغيلية
  // ويمنع أي مستخدم من إنشاء فجوات في تقييم لا يملكه
  const access = await checkAssessmentAccess(assessmentId, "write")
  if (!access.allowed) throw new Error("Forbidden")

  await prisma.gap.create({
    data: {
      schoolId: access.assessment!.schoolId,
      branchId: access.assessment!.branchId,
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

  if (!VALID_GAP_STATUSES.includes(status)) {
    throw new Error("Invalid gap status")
  }

  // الإصلاح: كان هذا الإجراء يحدّث أي فجوة في أي مدرسة بدون فحص — الآن فحص نطاق كامل
  const gap = await prisma.gap.findUnique({
    where: { id: gapId },
    include: {
      assessment: {
        select: { id: true, schoolId: true, branchId: true, assessorId: true, type: true }
      }
    }
  })
  if (!gap || !gap.assessment) throw new Error("Gap not found")

  const assessment = gap.assessment

  if (assessment.type === "PRIVATE_REVIEW") {
    // فجوات التقييم الخاص: مالكها فقط (مدير النظام)
    if (!(user.role === "SUPER_ADMIN" && assessment.assessorId === user.id)) {
      throw new Error("Forbidden")
    }
  } else {
    let allowed = false
    if (user.role === "SUPER_ADMIN") {
      allowed = true
    } else if (user.role === "SCHOOL_MANAGER") {
      allowed = assessment.schoolId === user.schoolId
    } else if (user.role === "BRANCH_MANAGER") {
      if (assessment.assessorId === user.id) {
        allowed = true
      } else if (assessment.branchId) {
        const authorizedBranchIds = await getAuthorizedBranchIds(user)
        allowed = authorizedBranchIds.includes(assessment.branchId)
      }
    } else if (user.role === "QUALITY_ASSESSOR") {
      allowed = assessment.assessorId === user.id
    }
    if (!allowed) throw new Error("Forbidden")
  }

  await prisma.gap.update({
    where: { id: gapId },
    data: { status: status as GapStatus },
  })

  revalidatePath("/quality/gaps")
  revalidatePath("/gaps")
}