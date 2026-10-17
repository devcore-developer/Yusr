"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

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
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
      prisma.school.delete({ where: { id: schoolId } })
    ])
    
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

  if (userId === user!.id) return { error: "لا يمكنك حذف حسابك الخاص." }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) return { error: "المستخدم غير موجود" }

  if (user!.role === "SCHOOL_MANAGER") {
    if (targetUser.schoolId !== user!.schoolId) {
      return { error: "غير مصرح لك بحذف مستخدمين خارج مدرستك." }
    }
    if (targetUser.role === "SUPER_ADMIN") {
      return { error: "لا يمكنك حذف حساب مدير النظام." }
    }
  } else if (user!.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح لك." }
  }

  if (targetUser.role === "SUPER_ADMIN") {
    const superAdminCount = await prisma.user.count({ where: { role: "SUPER_ADMIN" } })
    if (superAdminCount <= 1) return { error: "لا يمكن حذف حساب مدير النظام الوحيد المتبقي." }
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
    revalidatePath("/school-manager/users")
    return { success: true }
  } catch (e) {
    return { error: "فشل حذف المستخدم بسبب تبعيات البيانات." }
  }
}

export async function createUser(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || (user.role !== "SCHOOL_MANAGER" && user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN")) {
    return { error: "غير مصرح لك بهذا الإجراء." }
  }

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  let role = formData.get("role") as string

  if (!name || !email || !password) {
    return { error: "الحقول مطلوبة" }
  }

  let branchIdToAssign: string | null = null

  // فرض التسلسل الهرمي للصلاحيات + عزل النطاق (Security Enforcement)
  if (user.role === "SCHOOL_MANAGER") {
    if (role !== "BRANCH_MANAGER" && role !== "QUALITY_ASSESSOR") {
      return { error: "غير مصرح لك بإنشاء هذا الدور" }
    }
    // الإصلاح: التحقق أن الفرع المختار يتبع مدرسة مدير المدرسة فعلاً (كان غائباً)
    const selectedBranchId = formData.get("branchId") as string
    if (!selectedBranchId) {
      return { error: "يجب اختيار فرع" }
    }
    const branch = await prisma.branch.findFirst({
      where: { id: selectedBranchId, schoolId: user.schoolId! }
    })
    if (!branch) {
      return { error: "الفرع غير تابع لمدرستك" }
    }
    branchIdToAssign = selectedBranchId
  } else if (user.role === "BRANCH_MANAGER") {
    // إجبار الدور ليكون مشرف فقط بغض النظر عما تم إرساله من المتصفح
    role = "QUALITY_ASSESSOR"
    branchIdToAssign = user.branchId
    // معالجة الربط المزدوج: لو مدير القسم مرتبط عبر Branch.managerId فقط
    if (!branchIdToAssign) {
      const managed = await prisma.branch.findMany({ where: { managerId: user.id }, select: { id: true } })
      if (managed.length === 1) branchIdToAssign = managed[0].id
    }
  } else {
    // SUPER_ADMIN
    branchIdToAssign = (formData.get("branchId") as string) || null
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return { error: "البريد الإلكتروني مستخدم بالفعل" }
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as any,
        schoolId: user.schoolId,
        branchId: branchIdToAssign,
        status: "ACTIVE"
      }
    })

    await prisma.activity.create({
      data: {
        actorId: user.id,
        schoolId: user.schoolId,
        branchId: branchIdToAssign,
        action: "CREATE",
        entityType: "USER",
        entityId: newUser.id,
        metadata: { name: newUser.name, email: newUser.email, role: newUser.role }
      }
    })

    revalidatePath("/school-manager/users")
    revalidatePath("/users")
    
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: "حدث خطأ غير متوقع أثناء إنشاء الحساب." }
  }
}