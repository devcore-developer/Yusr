"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("غير مصرح")

  const name = formData.get("name") as string
  const email = formData.get("email") as string

  if (!name || !email) {
    return { error: "الاسم والبريد الإلكتروني مطلوبان" }
  }

  try {
    // التحقق من أن البريد الإلكتروني لا يوجد لدى مستخدم آخر
    const existingUser = await prisma.user.findFirst({
      where: { 
        email, 
        NOT: { id: user.id } 
      }
    })

    if (existingUser) {
      return { error: "البريد الإلكتروني مستخدم بالفعل من قبل حساب آخر" }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { name, email }
    })

    // تحديث الواجهة فوراً في كل الصفحات ليعكس التغيير في الـ Header والـ Sidebar
    revalidatePath("/settings")
    revalidatePath("/", "layout")
    
    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: "حدث خطأ أثناء تحديث البيانات" }
  }
}

export async function updatePassword(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("غير مصرح")

  const newPassword = formData.get("newPassword") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!newPassword || !confirmPassword) {
    return { error: "يرجى ملء جميع حقول كلمة المرور" }
  }

  if (newPassword !== confirmPassword) {
    return { error: "كلمتا المرور غير متطابقتين" }
  }

  if (newPassword.length < 6) {
    return { error: "يجب أن تكون كلمة المرور 6 أحرف على الأقل" }
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    return { success: true }
  } catch (error) {
    console.error(error)
    return { error: "حدث خطأ أثناء تحديث كلمة المرور" }
  }
}