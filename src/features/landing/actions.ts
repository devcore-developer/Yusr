"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"

export async function submitContactMessage(formData: FormData) {
  const name = formData.get("name") as string
  const institution = formData.get("institution") as string
  const email = formData.get("email") as string
  const phone = formData.get("phone") as string
  const subject = formData.get("subject") as string
  const message = formData.get("message") as string

  if (!name || !email || !subject || !message) {
    return { error: "الرجاء تعبئة الحقول الإلزامية." }
  }

  try {
    await prisma.contactMessage.create({
      data: { name, institution: institution || null, email, phone: phone || null, subject, message },
    })
    return { success: true }
  } catch (error) {
    return { error: "حدث خطأ أثناء إرسال الرسالة. الرجاء المحاولة مرة أخرى." }
  }
}

export async function addSurvey(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const type = formData.get("type") as string
  const percentage = parseFloat(formData.get("percentage") as string)
  const include = formData.get("include") === "true"
  const note = formData.get("note") as string
  const generalResult = formData.get("generalResult") as string

  if (!type || isNaN(percentage)) {
    return { error: "البيانات غير صحيحة" }
  }

  try {
    await prisma.survey.create({
      data: {
        type,
        percentage,
        include,
        note: note || null,
        generalResult: generalResult || null,
        schoolId: user.schoolId || null,
      }
    })
    
    revalidatePath("/surveys")
    return { success: true }
  } catch (error) {
    return { error: "حدث خطأ أثناء حفظ الاستبانة." }
  }
}