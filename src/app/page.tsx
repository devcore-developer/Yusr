import { PremiumLanding } from "@/components/landing/PremiumLanding"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"

export const metadata = {
  title: "يُسر | منصة إدارة الجودة التعليمية",
  description: "منصة يُسر لإدارة تقييمات الجودة التعليمية، وتحليل الفجوات، ومتابعة خطط التحسين للمؤسسات التعليمية.",
}

export default async function LandingPage() {
  const user = await getCurrentUser()
  
  // توجيه المستخدمين المسجلين إلى لوحات التحكم الخاصة بهم
  if (user) {
    if (user.role === "SUPER_ADMIN") redirect("/dashboard")
    if (user.role === "SCHOOL_MANAGER" || user.role === "BRANCH_MANAGER") redirect("/school-manager")
    if (user.role === "QUALITY_ASSESSOR") redirect("/quality-assessor")
  }

  return <PremiumLanding />
}