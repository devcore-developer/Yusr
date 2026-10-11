"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

export async function createSchoolWithManager(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") throw new Error("Unauthorized")

  const name = formData.get("name") as string
  const managerEmail = formData.get("managerEmail") as string
  const managerPassword = formData.get("managerPassword") as string
  const managerName = formData.get("managerName") as string

  if (!name || !managerEmail || !managerPassword || !managerName) {
    throw new Error("الحقول الأساسية للمدرسة والمدير مطلوبة")
  }

  // التحقق من عدم وجود مستخدم بنفس البريد مسبقاً
  const existingUser = await prisma.user.findUnique({ where: { email: managerEmail } })
  if (existingUser) {
    throw new Error("البريد الإلكتروني للمدير مستخدم بالفعل")
  }

  let logoUrl: string | null = null
  const logoFile = formData.get("logo") as File | null

  if (logoFile && logoFile.size > 0) {
    const imgbbKey = process.env.IMGBB_API_KEY
    if (!imgbbKey) throw new Error("ImageBB API Key is not configured")

    if (logoFile.size > 5 * 1024 * 1024) throw new Error("حجم الشعار يتجاوز 5 ميجابايت")
    
    const arrayBuffer = await logoFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Image = buffer.toString("base64")

    const imgbbFormData = new FormData()
    imgbbFormData.append("image", base64Image)

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
      method: "POST",
      body: imgbbFormData
    })

    const data = await res.json()
    if (data.success) {
      logoUrl = data.data.url
    } else {
      throw new Error("Failed to upload logo")
    }
  }

  const hashedPassword = await bcrypt.hash(managerPassword, 10)

  try {
    // استخدام المعاملات (Transactions) لضمان إنشاء المدرسة والمدير معاً
    const newSchool = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name,
          nameEn: formData.get("nameEn") as string || null,
          schoolCode: (formData.get("schoolCode") as string) || null,
          schoolType: formData.get("schoolType") as string || null,
          educationalStage: formData.get("educationalStage") as string || null,
          description: formData.get("description") as string || null,
          logoUrl,
          websiteUrl: formData.get("websiteUrl") as string || null,
          officialEmail: formData.get("officialEmail") as string || null,
          phone: formData.get("phone") as string || "غير محدد",
          alternativePhone: formData.get("alternativePhone") as string || null,
          location: formData.get("address") as string || "غير محدد",
          country: formData.get("country") as string || "مصر",
          governorate: formData.get("governorate") as string || null,
          city: formData.get("city") as string || null,
          address: formData.get("address") as string || null,
          academicYear: formData.get("academicYear") as string || null,
          status: "ACTIVE"
        }
      })

      const manager = await tx.user.create({
        data: {
          name: managerName,
          email: managerEmail,
          password: hashedPassword,
          role: "SCHOOL_MANAGER",
          schoolId: school.id,
          status: "ACTIVE"
        }
      })

      return { school, manager }
    })

    revalidatePath("/schools")
    revalidatePath("/dashboard")
    
    // إرجاع البيانات لعرضها في شاشة النجاح
    return { 
      success: true, 
      schoolName: newSchool.school.name,
      schoolCode: newSchool.school.schoolCode || "غير محدد",
      managerEmail: newSchool.manager.email,
      managerPassword: managerPassword // إرجاع كلمة المرور النصية مرة واحدة فقط للعرض
    }
  } catch (error) {
    console.error(error)
    throw new Error("حدث خطأ أثناء إنشاء المدرسة والمدير")
  }
}