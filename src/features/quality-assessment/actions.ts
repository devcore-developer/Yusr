// ===== FILE: src/features/quality-assessment/actions.ts =====
"use server"

import { prisma } from "@/lib/prisma"
import {
  getCurrentUser,
  checkAssessmentAccess,
  assertAssessmentAccess,
  getStageEditPolicy,
  assertStageCreationAllowed
} from "@/lib/permissions"
import { isValidStage, getStageLabel } from "@/lib/stages"
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
  // (إصلاح التضخم) المتحقق = شواهد مميزة لا صفوف — صف الزيارة الإضافي لنفس شاهد
  // الملاحظة الصفية لا يضاعف الشاهد، فلا تتخطى نسبة التقدم 100% أصلًا
  const verifiedRows = await prisma.evidenceResponse.findMany({
    where: { assessmentId, isVerified: true },
    select: { evidenceId: true },
    distinct: ["evidenceId"],
  })
  
  const progress = totalEvidence > 0 ? Math.round((verifiedRows.length / totalEvidence) * 100) : 0
  
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

  // فحص الاكتمال قبل الإنهاء — بنفس وحدات ومصدر نسبة التقدم المعروضة للمقيّم:
  // إجمالي شواهد النموذج الثابت مقابل الشواهد المتحققة في هذا التقييم
  // (نفس المعادلة المستخدمة في saveEvidenceResponse والتقارير والتحليلات وحلقة
  //  التقدم في الواجهة — كي يتطابق «100% في الشاشة» مع سماح الخادم بالإنهاء).
  // (سابقًا: كان يقارن عدد المؤشرات «مغطى» في كل قاعدة البيانات مع عدد صفوف
  //  الاستجابات لهذا التقييم — وحدتان ونطاقان مختلفان، وقد يستحيل معه الإنهاء
  //  نهائيًا إن وُجد مؤشر «مغطى» بلا شواهد في النموذج الثابت.)
  const totalEvidence = await prisma.fixedEvidence.count()
  // (إصلاح التضخم) نفس عدّاد التقدم المعروض: شواهد مميزة متحققة — لا صفوف زيارات
  const verifiedRows = await prisma.evidenceResponse.findMany({
    where: { assessmentId, isVerified: true },
    select: { evidenceId: true },
    distinct: ["evidenceId"],
  })
  const verifiedEvidence = verifiedRows.length

  if (totalEvidence > 0 && verifiedEvidence < totalEvidence) {
    const remaining = totalEvidence - verifiedEvidence
    const remainingLabel =
      remaining === 1 ? "شاهد واحد" :
      remaining === 2 ? "شاهدان" :
      remaining <= 10 ? `${remaining} شواهد` :
      `${remaining} شاهدًا`
    throw new Error(`لا يمكن الإنهاء: تبقّى ${remainingLabel} لم يتم التحقق منه. أكمل التحقق من جميع الشواهد ثم أعد المحاولة.`)
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

  // الإصلاح: كان هذا الإجراء مفتوحاً لأي مستخدم على أي تقييم — الآن يُفرض فحص الكتابة
  const access = await checkAssessmentAccess(assessmentId, "write")
  if (!access.allowed) {
    throw new Error("Forbidden: You can only modify assessments assigned to you.")
  }

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

  // الإصلاح: كان هذا الإجراء يحذف أي مرفق بأي ID بدون أي فحص — ثغرة حذف جماعي
  const attachment = await prisma.assessmentAttachment.findUnique({
    where: { id: attachmentId }
  })
  if (!attachment || attachment.assessmentId !== assessmentId) {
    throw new Error("Attachment not found")
  }

  const access = await checkAssessmentAccess(assessmentId, "write")
  if (!access.allowed) {
    throw new Error("Forbidden: You can only modify assessments assigned to you.")
  }

  return await prisma.assessmentAttachment.delete({
    where: { id: attachmentId }
  })
}

/**
 * إنشاء تقييم جديد — الآن بإلزامية المرحلة التعليمية وربط العام الدراسي:
 *  1) التحقق من صحة قيمة المرحلة على الخادم (لا ثقة بالعميل).
 *  2) فرض تخويل المرحلة حسب الدور وتعيينات المستخدم (assertStageCreationAllowed).
 *  3) كل تقييم ينتمي لمرحلة واحدة بالضبط — لا دمج مراحل في تقييم واحد.
 *  4) العام الدراسي يُثبَّت وقت الإنشاء من العام النشط للمدرسة (علاقة صريحة
 *     academicYearId) — وإن لم يكن هناك عام نشط يُنشأ بلا عام (NULL يُعرض
 *     «غير محدد» للمراجعة) ولا يُخترع رابط تاريخي أبدًا. تبديل العام النشط
 *     لاحقًا لا يمس هذه الارتباطات المخزّنة.
 * يُستدعى من منتقي المرحلة (NewAssessmentStagePicker) بعد اختيار المستخدم لمرحلته.
 */
export async function createNewAssessment(stage: string) {
  const user = await getCurrentUser()
  if (!user || !user.schoolId) throw new Error("Unauthorized")

  // فحص محلي يضمن صحة القيمة (ويتيح للتايب سكريبت تضييق النوع قبل كتابته في Prisma)
  if (!isValidStage(stage)) {
    throw new Error("المرحلة التعليمية المحددة غير صحيحة.")
  }

  await assertStageCreationAllowed(user, stage)

  // العام الدراسي النشط وقت الإنشاء — يُثبَّت على السجل ولا يتغير لاحقًا
  const activeYear = await prisma.academicYear.findFirst({
    where: { schoolId: user.schoolId, isActive: true },
    select: { id: true }
  })

  const assessment = await prisma.assessment.create({
    data: {
      schoolId: user.schoolId,
      branchId: user.branchId || null,
      assessorId: user.id,
      status: "IN_PROGRESS",
      type: "NORMAL",
      stage,
      academicYearId: activeYear?.id ?? null
    }
  })
  redirect(`/quality-assessor/assessments/${assessment.id}`)
}

/**
 * تعديل مرحلة تقييم قائم — سياسة موحدة عبر getStageEditPolicy:
 *  - الصلاحية حسب الدور (مدير النظام/المدرسة/الملكية) — لا تجاوز للعزل.
 *  - المكتمل ذو المرحلة المحددة مُقفل؛ المكتمل بلا مرحلة (سجل تاريخي) يُعاد تعيينه مرة.
 *  - يحدّث حقل stage فقط — لا يمس أي استجابة أو شاهد أو نتيجة، ولا يدمج التقييم بأي سجل آخر.
 *  - يسجل العملية في سجل النشاط للتدقيق.
 */
export async function updateAssessmentStage(assessmentId: string, stage: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  if (!isValidStage(stage)) {
    throw new Error("المرحلة التعليمية المحددة غير صحيحة.")
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, schoolId: true, branchId: true, assessorId: true, type: true, status: true, stage: true }
  })
  if (!assessment) throw new Error("Assessment not found")

  const policy = await getStageEditPolicy(user, assessment)
  if (!policy.allowed) {
    throw new Error(policy.reason ?? "Forbidden: لا تملك صلاحية تعديل مرحلة هذا التقييم.")
  }

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { stage }
  })

  await prisma.activity.create({
    data: {
      actorId: user.id,
      schoolId: assessment.schoolId,
      branchId: assessment.branchId,
      action: "UPDATE",
      entityType: "ASSESSMENT",
      entityId: assessmentId,
      metadata: { description: `تم تعيين/تحديث المرحلة التعليمية للتقييم إلى: ${getStageLabel(stage)}` }
    }
  })

  revalidatePath(`/quality-assessor/assessments/${assessmentId}`)
  revalidatePath("/quality-assessor")
  revalidatePath("/reports")
}