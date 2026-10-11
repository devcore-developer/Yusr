"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

export async function createUser(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || (user.role !== "SCHOOL_MANAGER" && user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN")) {
    throw new Error("Unauthorized")
  }

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  let role = formData.get("role") as string

  if (!name || !email || !password) throw new Error("الحقول مطلوبة")

  // فرض التسلسل الهرمي للصلاحيات (Security Enforcement)
  if (user.role === "SCHOOL_MANAGER") {
    if (role !== "BRANCH_MANAGER" && role !== "QUALITY_ASSESSOR") throw new Error("غير مصرح لك بإنشاء هذا الدور")
  } else if (user.role === "BRANCH_MANAGER") {
    // إجبار الدور ليكون مقيم جودة فقط بغض النظر عما تم إرساله من المتصفح
    role = "QUALITY_ASSESSOR"
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) throw new Error("البريد الإلكتروني مستخدم بالفعل")

  const hashedPassword = await bcrypt.hash(password, 10)

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: role as any,
      schoolId: user.schoolId,
      // مدير الفرع يُربط بفرعه تلقائياً، غيره يُربط حسب الاختيار من القائمة
      branchId: user.role === "BRANCH_MANAGER" ? user.branchId : (formData.get("branchId") as string || null),
      status: "ACTIVE"
    }
  })

  revalidatePath("/school-manager/users")
}