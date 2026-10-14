import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user) return null
  
  // جلب أحدث بيانات من قاعدة البيانات لضمان ظهور التحديثات فوراً (مثل تغيير الاسم)
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  return dbUser
}

export async function requireRole(roles: string[]) {
  const user = await getCurrentUser()
  if (!user || !roles.includes(user.role)) {
    redirect("/login")
  }
  return user
}

export async function requireSchoolAccess(schoolId: string) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  if (user.role === "SUPER_ADMIN") return true
  
  if (user.schoolId !== schoolId) {
    throw new Error("Unauthorized: Tenant isolation violation")
  }
  return true
}

export async function requireBranchAccess(branchId: string) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  if (user.role === "SUPER_ADMIN" || user.role === "SCHOOL_MANAGER") {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } })
    if (!branch || branch.schoolId !== user.schoolId) throw new Error("Unauthorized")
    return true
  }

  if (user.role === "BRANCH_MANAGER" && user.branchId !== branchId) {
    throw new Error("Unauthorized: Branch isolation violation")
  }
  return true
}