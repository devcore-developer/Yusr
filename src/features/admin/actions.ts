"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { UserRole } from "@prisma/client"

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
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: "غير مصرح لك بهذا الإجراء." }

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const role = formData.get("role") as string
  const branchId = formData.get("branchId") as string

  if (!name || !email || !password || !role) {
    return { error: "جميع الحقول مطلوبة" }
  }

  if (password.length < 6) {
    return { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return { error: "البريد الإلكتروني مستخدم بالفعل" }
  }

  let finalSchoolId: string | null = null
  let finalBranchId: string | null = null
  let finalRole: UserRole = role as UserRole

  if (currentUser.role === "BRANCH_MANAGER") {
    finalRole = "QUALITY_ASSESSOR"
    finalSchoolId = currentUser.schoolId
    finalBranchId = currentUser.branchId
    // معالجة الربط المزدوج: لو مدير الفرع مرتبط عبر Branch.managerId فقط
    if (!finalBranchId) {
      const managedBranches = await prisma.branch.findMany({
        where: { managerId: currentUser.id },
        select: { id: true }
      })
      if (managedBranches.length === 1) finalBranchId = managedBranches[0].id
    }
  } else if (currentUser.role === "SCHOOL_MANAGER") {
    if (finalRole !== "BRANCH_MANAGER" && finalRole !== "QUALITY_ASSESSOR") {
      return { error: "غير مصرح لك بإنشاء هذا الدور" }
    }
    if (!branchId) return { error: "يجب اختيار فرع" }
    const branch = await prisma.branch.findFirst({ where: { id: branchId, schoolId: currentUser.schoolId! } })
    if (!branch) return { error: "الفرع غير تابع لمدرستك" }
    finalSchoolId = currentUser.schoolId
    finalBranchId = branchId
  } else if (currentUser.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح لك بإنشاء مستخدمين" }
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: finalRole, schoolId: finalSchoolId, branchId: finalBranchId, status: "ACTIVE" }
    })
    await prisma.activity.create({
      data: { actorId: currentUser.id, schoolId: finalSchoolId, branchId: finalBranchId, action: "CREATE", entityType: "USER", entityId: newUser.id, metadata: { name, email, role: finalRole } }
    })
    revalidatePath("/school-manager/users")
    revalidatePath("/users")
    return { success: true }
  } catch (error) {
    return { error: "حدث خطأ غير متوقع أثناء إنشاء الحساب." }
  }
}

export async function updateSchool(schoolId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: "غير مصرح" }

  if (user.role !== "SUPER_ADMIN" && !(user.role === "SCHOOL_MANAGER" && user.schoolId === schoolId)) {
    return { error: "غير مصرح لك بتعديل بيانات هذه المدرسة" }
  }

  const name = formData.get("name") as string
  const location = formData.get("location") as string
  const phone = formData.get("phone") as string
  const logoUrl = formData.get("logoUrl") as string

  try {
    await prisma.school.update({ where: { id: schoolId }, data: { name, location, phone, logoUrl: logoUrl || undefined } })
    await prisma.activity.create({ data: { actorId: user.id, schoolId, action: "UPDATE", entityType: "SCHOOL", entityId: schoolId, metadata: { name } } })
    revalidatePath("/schools")
    revalidatePath("/school-manager")
    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    return { error: "حدث خطأ أثناء تحديث بيانات المدرسة" }
  }
}

export async function updateBranch(branchId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) return { error: "غير مصرح" }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } })
  if (!branch) return { error: "الفرع غير موجود" }

  if (user.role === "SCHOOL_MANAGER" && branch.schoolId !== user.schoolId) return { error: "غير مصرح لك بتعديل فروع خارج مدرستك" }
  if (user.role === "BRANCH_MANAGER") {
    // يدعم الربط المزدوج: branchId مباشرة أو إدارة الفرع عبر Branch.managerId
    const authorizedBranchIds = await getAuthorizedBranchIds(user)
    if (!authorizedBranchIds.includes(branchId)) return { error: "غير مصرح لك بتعديل فروع أخرى" }
  }
  if (user.role !== "SUPER_ADMIN" && user.role !== "SCHOOL_MANAGER" && user.role !== "BRANCH_MANAGER") return { error: "غير مصرح" }

  const name = formData.get("name") as string
  const location = formData.get("location") as string
  const phone = formData.get("phone") as string

  try {
    await prisma.branch.update({ where: { id: branchId }, data: { name, location, phone } })
    await prisma.activity.create({ data: { actorId: user.id, schoolId: branch.schoolId, branchId, action: "UPDATE", entityType: "BRANCH", entityId: branchId, metadata: { name } } })
    revalidatePath("/school-manager/branches")
    revalidatePath("/school-manager")
    return { success: true }
  } catch (error) {
    return { error: "حدث خطأ أثناء تحديث بيانات الفرع" }
  }
}

export async function adminUpdateUser(userId: string, formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: "غير مصرح" }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) return { error: "المستخدم غير موجود" }

  // ملاحظة جوهرية (سبب الخطأ الأصلي): حقل الدور قد يكون غائباً تماماً من FormData
  // لأن قائمة الدور تُعرض disabled لغير مدير النظام، والعناصر المعطلة لا تُرسل قيمها.
  // لذلك نتعامل معه كقيمة اختيارية ولا نمرر null إلى Prisma أبداً.
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const submittedRole = formData.get("role") as string | null

  if (!name || !email) {
    return { error: "الاسم والبريد الإلكتروني مطلوبان" }
  }

  if (submittedRole && !["SUPER_ADMIN", "SCHOOL_MANAGER", "BRANCH_MANAGER", "QUALITY_ASSESSOR"].includes(submittedRole)) {
    return { error: "الدور المحدد غير صالح" }
  }

  // === فحص النطاق والصلاحيات حسب دور المستخدم الحالي (على الخادم) ===
  if (currentUser.role === "SUPER_ADMIN") {
    // مدير النظام يعدّل الجميع — مع منع إزالة آخر مدير نظام في المنصة
    if (targetUser.role === "SUPER_ADMIN" && submittedRole && submittedRole !== "SUPER_ADMIN") {
      const superAdminCount = await prisma.user.count({ where: { role: "SUPER_ADMIN" } })
      if (superAdminCount <= 1) {
        return { error: "لا يمكن تغيير دور مدير النظام الوحيد المتبقي" }
      }
    }
  } else if (currentUser.role === "SCHOOL_MANAGER") {
    if (!currentUser.schoolId || targetUser.schoolId !== currentUser.schoolId) {
      return { error: "غير مصرح لك بتعديل مستخدمين خارج مدرستك" }
    }
    if (targetUser.role === "SUPER_ADMIN") {
      return { error: "لا يمكنك تعديل حساب مدير النظام" }
    }
    if (submittedRole === "SUPER_ADMIN") {
      return { error: "لا يمكنك إنشاء أو تعديل حساب ليكون مدير نظام" }
    }
    if (submittedRole && submittedRole !== "BRANCH_MANAGER" && submittedRole !== "QUALITY_ASSESSOR") {
      return { error: "غير مصرح لك بتعيين هذا الدور" }
    }
  } else if (currentUser.role === "BRANCH_MANAGER") {
    // مدير الفرع: تعديل بيانات المشرفين (QUALITY_ASSESSOR) التابعين لفرعه فقط
    if (!currentUser.schoolId || targetUser.schoolId !== currentUser.schoolId) {
      return { error: "غير مصرح لك بتعديل مقيّمين خارج فرعك" }
    }
    if (targetUser.role !== "QUALITY_ASSESSOR") {
      return { error: "يمكنك تعديل حسابات المشرفين فقط" }
    }
    const authorizedBranchIds = await getAuthorizedBranchIds(currentUser)
    if (!targetUser.branchId || !authorizedBranchIds.includes(targetUser.branchId)) {
      return { error: "غير مصرح لك بتعديل مقيّمين خارج فرعك" }
    }
    // لا يحق لمدير الفرع تغيير الأدوار — يتم تجاهل أي دور مُرسل من الطرف الآخر
  } else {
    return { error: "غير مصرح" }
  }

  const emailExists = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } })
  if (emailExists) return { error: "البريد الإلكتروني مستخدم بالفعل" }

  const data: { name: string; email: string; role?: UserRole } = { name, email }
  // يُحدَّث الدور فقط إذا أُرسل فعلاً وكان لمرسله حق تغييره
  if (submittedRole && currentUser.role !== "BRANCH_MANAGER") {
    data.role = submittedRole as UserRole
  }

  try {
    await prisma.user.update({ where: { id: userId }, data })
    await prisma.activity.create({ data: { actorId: currentUser.id, schoolId: targetUser.schoolId, action: "UPDATE", entityType: "USER", entityId: userId, metadata: { name, email, role: data.role ?? targetUser.role } } })
    revalidatePath("/users")
    revalidatePath("/school-manager/users")
    return { success: true }
  } catch (error) {
    return { error: "حدث خطأ أثناء تحديث بيانات المستخدم" }
  }
}

export async function adminResetPassword(userId: string, newPassword: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser || currentUser.role !== "SUPER_ADMIN") return { error: "غير مصرح" }

  if (newPassword.length < 6) return { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } })
    await prisma.activity.create({ data: { actorId: currentUser.id, action: "PASSWORD_RESET", entityType: "USER", entityId: userId, metadata: { info: "Admin reset password" } } })
    return { success: true }
  } catch (error) {
    return { error: "حدث خطأ أثناء إعادة تعيين كلمة المرور" }
  }
}