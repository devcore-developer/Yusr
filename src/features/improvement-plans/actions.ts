"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"

export async function savePlan(formData: FormData) {
  const user = await getCurrentUser()
  // تقييد الإنشاء والتعديل لمقيم الجودة فقط
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized: Only Quality Assessors can create plans")
  // ... باقي الكود

  const id = formData.get("id") as string
  const title = formData.get("title") as string
  const gapId = formData.get("gapId") as string
  const indicatorId = formData.get("indicatorId") as string
  const startDate = formData.get("startDate") as string
  const targetDate = formData.get("targetDate") as string

  if (!title || !targetDate) throw new Error("العنوان وتاريخ الانتهاء مطلوبان")

  // استخراج الإجراءات الديناميكية
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

  // تحديد المدرسة والفرع: نعتمد على حساب المستخدم، وإذا لم يكن مرتبطاً (مثل السوبر أدمن) نأخذها من الفجوة
  let schoolId = user.schoolId
  let branchId = user.branchId || null

  if (gapId) {
    const gap = await prisma.gap.findUnique({
      where: { id: gapId },
      select: { schoolId: true, branchId: true }
    })
    if (gap) {
      if (!schoolId) schoolId = gap.schoolId
      if (!branchId) branchId = gap.branchId
    }
  }

  if (!schoolId) {
    throw new Error("لم يتم تحديد المدرسة. تأكد من إنشاء الخطة من صفحة الفجوات أو باستخدام حساب مدير مدرسة.")
  }

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
    schoolId: schoolId,
    branchId: branchId,
    createdById: user.id,
  }

  try {
    if (id) {
      // تحديث خطة موجودة
      await prisma.$transaction(async (tx) => {
        await tx.improvementPlan.update({ where: { id }, data })
        // حذف الإجراءات القديمة وإضافة الجديدة
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
      // إنشاء خطة جديدة
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

// إضافة إجراء جديد لخطة موجودة
export async function addAction(planId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const title = formData.get("title") as string
  const status = formData.get("status") as string
  const startDate = formData.get("startDate") as string
  const dueDate = formData.get("dueDate") as string

  if (!title) throw new Error("عنوان الإجراء مطلوب")

  await prisma.improvementAction.create({
    data: {
      planId,
      title,
      status: status || "PENDING",
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
    }
  })

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}

// تحديث نسبة تقدم الإجراء
export async function updateActionProgress(actionId: string, status: string, planId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  await prisma.improvementAction.update({
    where: { id: actionId },
    data: { status }
  })

  // تحديث نسبة تقدم الخطة الإجمالية بناءً على الإجراءات
  const actions = await prisma.improvementAction.findMany({ where: { planId } })
  const completed = actions.filter(a => a.status === "COMPLETED").length
  const progress = actions.length > 0 ? Math.round((completed / actions.length) * 100) : 0

  await prisma.improvementPlan.update({
    where: { id: planId },
    data: { progress }
  })

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}

// إضافة متابعة (Follow-up) لخطة
export async function addFollowUp(planId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const note = formData.get("note") as string
  const progress = parseInt(formData.get("progress") as string)

  if (!note) throw new Error("الملاحظة مطلوبة")

  await prisma.improvementFollowUp.create({
    data: {
      planId,
      note,
      progress: isNaN(progress) ? null : progress,
      createdById: user.id
    }
  })

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}