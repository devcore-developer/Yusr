"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"

export async function updateBranch(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "BRANCH_MANAGER" || !user.branchId) throw new Error("Unauthorized")

  const name = formData.get("name") as string
  const phone = formData.get("phone") as string
  const location = formData.get("location") as string

  if (!name) throw new Error("اسم الفرع مطلوب")

  await prisma.branch.update({
    where: { id: user.branchId },
    data: { name, phone, location }
  })

  revalidatePath("/school-manager/branch-profile")
}