"use server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { SchoolStatus, SubscriptionStatus } from "@prisma/client"

export async function createSchoolAction(formData: FormData) {
  await requireRole(["SUPER_ADMIN"])

  const name = (formData.get("name") as string)?.trim()
  const location = (formData.get("location") as string)?.trim()
  const description = (formData.get("description") as string)?.trim() || null
  const phone = (formData.get("phone") as string)?.trim()
  const email = (formData.get("email") as string)?.trim()
  const plan = (formData.get("plan") as string) || "Pro"

  if (!name || !location || !phone || !email) {
    throw new Error("الحقول المطلوبة ناقصة")
  }

  const school = await prisma.school.create({
    data: {
      name,
      description,
      location,
      phone,
      email,
      status: SchoolStatus.ACTIVE,
      subscriptions: {
        create: {
          plan,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
  })

  revalidatePath("/schools")
  redirect(`/schools/${school.id}`)
}