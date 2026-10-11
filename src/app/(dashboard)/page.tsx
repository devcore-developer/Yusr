import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/permissions"

export default async function RootDashboardRedirect() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  
  if (user.role === "SUPER_ADMIN") redirect("/dashboard")
  if (user.role === "SCHOOL_MANAGER" || user.role === "BRANCH_MANAGER") redirect("/school-manager")
  if (user.role === "QUALITY_ASSESSOR") redirect("/quality-assessor")
  
  redirect("/login")
}