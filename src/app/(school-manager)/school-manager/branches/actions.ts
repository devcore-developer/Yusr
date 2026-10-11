"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

export async function createBranch(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || !user.schoolId || (user.role !== "SCHOOL_MANAGER" && user.role !== "SUPER_ADMIN")) {
    throw new Error("Unauthorized")
  }

  const name = formData.get("name") as string
  const location = formData.get("location") as string
  const phone = formData.get("phone") as string
  
  const managerName = formData.get("managerName") as string
  const managerEmail = formData.get("managerEmail") as string
  const managerPassword = formData.get("managerPassword") as string

  if (!name) throw new Error("اسم الفرع مطلوب")
  if (!managerName || !managerEmail || !managerPassword) {
    throw new Error("بيانات مدير الفرع (الاسم، البريد، كلمة المرور) مطلوبة")
  }

  // التحقق من عدم تكرار بريد المدير
  const existingUser = await prisma.user.findUnique({ where: { email: managerEmail } })
  if (existingUser) {
    throw new Error("البريد الإلكتروني للمدير مستخدم بالفعل في المنصة")
  }

  const hashedPassword = await bcrypt.hash(managerPassword, 10)

  try {
    // استخدام المعاملات (Transactions) لضمان إنشاء الفرع والمدير معاً
    await prisma.$transaction(async (tx) => {
      // 1. إنشاء الفرع
      const branch = await tx.branch.create({
        data: {
          name,
          location: location || "",
          phone: phone || "",
          schoolId: user.schoolId!,
        }
      })

      // 2. إنشاء حساب مدير الفرع وربطه بالفرع والمدرسة
      const manager = await tx.user.create({
        data: {
          name: managerName,
          email: managerEmail,
          password: hashedPassword,
          role: "BRANCH_MANAGER",
          schoolId: user.schoolId!,
          branchId: branch.id,
          status: "ACTIVE"
        }
      })

      // 3. ربط المدير بالفرع كمسؤول عنه
      await tx.branch.update({
        where: { id: branch.id },
        data: { managerId: manager.id }
      })

      return { branch, manager }
    })

    revalidatePath("/school-manager/branches")
  } catch (error) {
    console.error(error)
    throw new Error("حدث خطأ أثناء إنشاء الفرع وحساب المدير")
  }
}