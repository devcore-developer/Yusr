"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

async function verifyConfirmation(password: string, confirmPhrase: string, actionType: "DELETE_SCHOOL" | "DELETE_USER") {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") {
    await prisma.activity.create({
      data: {
        actorId: user?.id || "unknown",
        action: `${actionType}_FAILED`,
        entityType: "SYSTEM",
        entityId: "AUTH",
        metadata: { reason: "Unauthorized access attempt" }
      }
    }).catch(console.error)
    return { error: "Unauthorized", user: null }
  }
  
  if (confirmPhrase !== "DELETE") {
    await prisma.activity.create({
      data: {
        actorId: user.id,
        action: `${actionType}_FAILED`,
        entityType: "SYSTEM",
        entityId: "CONFIRMATION",
        metadata: { reason: "Invalid confirmation phrase" }
      }
    }).catch(console.error)
    return { error: "Invalid confirmation phrase", user: null }
  }
  
  const admin = await prisma.user.findUnique({ where: { id: user.id } })
  if (!admin || !admin.password) return { error: "Admin account error", user: null }
  
  const isValid = await bcrypt.compare(password, admin.password)
  if (!isValid) {
    await prisma.activity.create({
      data: {
        actorId: user.id,
        action: `${actionType}_FAILED`,
        entityType: "SYSTEM",
        entityId: "PASSWORD",
        metadata: { reason: "Invalid password" }
      }
    }).catch(console.error)
    return { error: "Invalid password", user: null }
  }
  
  return { error: null, user }
}

export async function deleteSchool(schoolId: string, password: string, confirmPhrase: string) {
  const { error, user } = await verifyConfirmation(password, confirmPhrase, "DELETE_SCHOOL")
  if (error) return { error }

  const school = await prisma.school.findUnique({ where: { id: schoolId } })
  if (!school) return { error: "School not found" }

  try {
    // 1. تحديد جميع المستخدمين المرتبطين بالمدرسة حصرياً (باستثناء السوبر أدمن)
    const usersToDelete = await prisma.user.findMany({
      where: {
        OR: [
          { schoolId: schoolId },
          { branch: { schoolId: schoolId } }
        ],
        role: { not: "SUPER_ADMIN" }
      },
      select: { id: true }
    })
    const userIds = usersToDelete.map(u => u.id)

    // 2. تنفيذ الحذف في معاملة واحدة (Transaction)
    await prisma.$transaction([
      prisma.improvementAction.deleteMany({ where: { plan: { schoolId } } }),
      prisma.improvementFollowUp.deleteMany({ where: { plan: { schoolId } } }),
      prisma.improvementPlan.deleteMany({ where: { schoolId } }),
      prisma.gap.deleteMany({ where: { schoolId } }),
      prisma.evidenceResponse.deleteMany({ where: { assessment: { schoolId } } }),
      prisma.assessmentResponse.deleteMany({ where: { assessment: { schoolId } } }),
      prisma.assessmentAttachment.deleteMany({ where: { assessment: { schoolId } } }),
      prisma.evidence.deleteMany({ where: { assessment: { schoolId } } }),
      prisma.assessment.deleteMany({ where: { schoolId } }),
      prisma.survey.deleteMany({ where: { schoolId } }),
      // حذف المستخدمين المرتبطين بالمدرسة
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
      // أخيراً، حذف المدرسة
      prisma.school.delete({ where: { id: schoolId } })
    ])
    
    // 3. تسجيل النشاط (schoolId يكون null لعدم وجود المدرسة بعد الآن)
    await prisma.activity.create({
      data: {
        actorId: user!.id,
        schoolId: null,
        action: "DELETE_SCHOOL",
        entityType: "SCHOOL",
        entityId: schoolId,
        metadata: { name: school.name, deletedUsersCount: userIds.length }
      }
    })
    
    revalidatePath("/schools")
    revalidatePath("/users")
    return { success: true }
  } catch (e) {
    console.error(e)
    return { error: "Failed to delete school due to dependencies." }
  }
}

export async function deleteUser(userId: string, password: string, confirmPhrase: string) {
  const { error, user } = await verifyConfirmation(password, confirmPhrase, "DELETE_USER")
  if (error) return { error }

  if (userId === user!.id) return { error: "You cannot delete your own account." }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) return { error: "User not found" }

  if (targetUser.role === "SUPER_ADMIN") {
    const superAdminCount = await prisma.user.count({ where: { role: "SUPER_ADMIN" } })
    if (superAdminCount <= 1) return { error: "Cannot delete the last Super Admin account." }
  }

  try {
    await prisma.user.delete({ where: { id: userId } })
    
    await prisma.activity.create({
      data: {
        actorId: user!.id,
        action: "DELETE_USER",
        entityType: "USER",
        entityId: userId,
        metadata: { name: targetUser.name, email: targetUser.email, role: targetUser.role }
      }
    })
    
    revalidatePath("/users")
    return { success: true }
  } catch (e) {
    return { error: "Failed to delete user due to dependencies." }
  }
}