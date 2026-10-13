"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"

export async function savePlan(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized: Only Quality Assessors can create plans")

  const id = formData.get("id") as string
  const title = formData.get("title") as string
  const gapId = formData.get("gapId") as string
  const indicatorId = formData.get("indicatorId") as string
  const startDate = formData.get("startDate") as string
  const targetDate = formData.get("targetDate") as string

  if (!title || !targetDate) throw new Error("العنوان وتاريخ الانتهاء مطلوبان")

  const actions: any[] = []
  const entries = Array.from(formData.entries())
  entries.forEach(([key, value]) => {
    const match = key.match(/actions\[(\d+)\]\[(\w+)\]/)
    if (match) {
      const index = parseInt(match[1])
      const field = match[2]
      if (!actions[index]) actions[index] = {}
      actions[index][field] = value
    }
  })

  let schoolId = user.schoolId
  let branchId = user.branchId || null

  if (gapId) {
    const gap = await prisma.gap.findUnique({ where: { id: gapId }, select: { schoolId: true, branchId: true } })
    if (gap) {
      if (!schoolId) schoolId = gap.schoolId
      if (!branchId) branchId = gap.branchId
    }
  }

  if (!schoolId) throw new Error("لم يتم تحديد المدرسة.")

  const data: any = {
    title,
    description: formData.get("description") as string,
    gapId: gapId || null,
    indicatorId: indicatorId || null,
    startDate: new Date(startDate || Date.now()),
    targetDate: new Date(targetDate),
    status: formData.get("status") as string || "DRAFT",
    priority: formData.get("priority") as string || "MEDIUM",
    objective: formData.get("objective") as string,
    reasons: formData.get("reasons") as string,
    strengths: formData.get("strengths") as string,
    improvements: formData.get("improvements") as string,
    baseline: parseFloat(formData.get("baseline") as string) || null,
    targetPercentage: parseFloat(formData.get("targetPercentage") as string) || null,
    currentMeasured: parseFloat(formData.get("currentMeasured") as string) || null,
    kpiName: formData.get("kpiName") as string,
    successCriteria: formData.get("successCriteria") as string,
    requiredSupport: formData.get("requiredSupport") as string,
    followUpMethod: formData.get("followUpMethod") as string,
    impactNotes: formData.get("impactNotes") as string,
    schoolId,
    branchId,
    createdById: user.id,
  }

  try {
    if (id) {
      await prisma.$transaction(async (tx) => {
        await tx.improvementPlan.update({ where: { id }, data })
        await tx.improvementAction.deleteMany({ where: { planId: id } })
        if (actions.length > 0) {
          await tx.improvementAction.createMany({
            data: actions.map(a => ({
              planId: id,
              title: a.title,
              status: a.status || "PENDING",
              startDate: a.startDate ? new Date(a.startDate) : null,
              dueDate: a.dueDate ? new Date(a.dueDate) : null,
            }))
          })
        }
      })
    } else {
      await prisma.$transaction(async (tx) => {
        const plan = await tx.improvementPlan.create({ data })
        if (actions.length > 0) {
          await tx.improvementAction.createMany({
            data: actions.map(a => ({
              planId: plan.id,
              title: a.title,
              status: a.status || "PENDING",
              startDate: a.startDate ? new Date(a.startDate) : null,
              dueDate: a.dueDate ? new Date(a.dueDate) : null,
            }))
          })
        }
      })
    }

    revalidatePath("/school-manager/quality/improvement-plans")
    revalidatePath("/improvement-plans")
    return { success: true }
  } catch (error) {
    console.error(error)
    throw new Error("حدث خطأ أثناء حفظ الخطة")
  }
}

export async function addAction(planId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized")

  const title = formData.get("title") as string
  if (!title) throw new Error("عنوان الإجراء مطلوب")

  await prisma.improvementAction.create({
    data: {
      planId,
      title,
      status: formData.get("status") as string || "PENDING",
      startDate: formData.get("startDate") ? new Date(formData.get("startDate") as string) : null,
      dueDate: formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null,
    }
  })

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}

// تحديث نسبة تقدم الإجراء (مع التحقق من التزامن بين الحالة والنسبة)
export async function updateActionProgress(actionId: string, status: string, planId: string, progressInput: number = 0) {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized")

  let finalProgress = progressInput;

  // 1. فرض القواعد من جانب الخادم لضمان عدم وجود تضارب
  if (status === "COMPLETED") {
    finalProgress = 100;
  } else if (status === "PENDING") {
    finalProgress = 0;
  } else {
    // للحالات (جارية) و (متعثرة): النسبة يجب أن تكون بين 0 و 99
    finalProgress = Math.max(0, Math.min(99, finalProgress));
    // إذا أدخل المستخدم 100% للحالة جارية، يتم خفضها إلى 99% تلقائياً
    if (finalProgress === 100) finalProgress = 99;
  }

  // 2. تحديث الإجراء بالحالة والنسبة الجديدة المعتمدة
  await prisma.improvementAction.update({
    where: { id: actionId },
    data: { 
      status,
      progress: finalProgress
    }
  })

  // 3. إعادة حساب النسبة الإجمالية للخطة
  const actions = await prisma.improvementAction.findMany({ where: { planId } })
  
  if (actions.length > 0) {
    const totalProgress = actions.reduce((acc, a) => acc + (a.progress || 0), 0)
    const overallProgress = Math.round(totalProgress / actions.length)
    
    await prisma.improvementPlan.update({
      where: { id: planId },
      data: { progress: overallProgress }
    })
  } else {
    await prisma.improvementPlan.update({
      where: { id: planId },
      data: { progress: 0 }
    })
  }

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}

export async function addFollowUp(planId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const note = formData.get("note") as string
  if (!note) throw new Error("الملاحظة مطلوبة")

  await prisma.improvementFollowUp.create({
    data: { planId, note, progress: parseInt(formData.get("progress") as string) || null, createdById: user.id }
  })

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}