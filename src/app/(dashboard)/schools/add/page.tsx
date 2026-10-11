import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { SchoolCreationForm } from "@/components/schools/SchoolCreationForm"

export default async function AddSchoolPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") redirect("/dashboard")

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="إضافة مدرسة جديدة"
        description="أدخل البيانات الرسمية للمدرسة وبيانات مديرها لإنشاء الحسابات."
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "المدارس", href: "/schools" }, { label: "إضافة مدرسة" }]}
      />
      <Card>
        <CardContent className="p-6">
          <SchoolCreationForm />
        </CardContent>
      </Card>
    </div>
  )
}