"use server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function deleteSchoolAction(schoolId: string) {
  await requireRole(["SUPER_ADMIN"])
  await prisma.school.delete({ where: { id: schoolId } })
  revalidatePath("/schools")
  redirect("/schools")
}

export async function renewSubscriptionAction(subscriptionId: string, schoolId: string) {
  await requireRole(["SUPER_ADMIN"])
  const newEndDate = new Date()
  newEndDate.setFullYear(newEndDate.getFullYear() + 1)
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { endDate: newEndDate, status: "ACTIVE" },
  })
  revalidatePath(`/schools/${schoolId}`)
}

export async function suspendSchoolAction(schoolId: string) {
  await requireRole(["SUPER_ADMIN"])
  await prisma.school.update({
    where: { id: schoolId },
    data: { status: "SUSPENDED" },
  })
  revalidatePath(`/schools/${schoolId}`)
  revalidatePath("/schools")
}

export async function activateSchoolAction(schoolId: string) {
  await requireRole(["SUPER_ADMIN"])
  await prisma.school.update({
    where: { id: schoolId },
    data: { status: "ACTIVE" },
  })
  revalidatePath(`/schools/${schoolId}`)
  revalidatePath("/schools")
}

export async function updateSchoolAction(schoolId: string, formData: FormData) {
  await requireRole(["SUPER_ADMIN"])

  const name = (formData.get("name") as string)?.trim()
  const location = (formData.get("location") as string)?.trim()
  const phone = (formData.get("phone") as string)?.trim()
  const officialEmail = (formData.get("email") as string)?.trim()
  const description = (formData.get("description") as string)?.trim() || null

  if (!name || !location || !phone || !officialEmail) {
    throw new Error("الحقول المطلوبة ناقصة")
  }

  await prisma.school.update({
    where: { id: schoolId },
    data: { name, location, phone, officialEmail, description },
  })

  revalidatePath(`/schools/${schoolId}`)
  revalidatePath("/schools")
}