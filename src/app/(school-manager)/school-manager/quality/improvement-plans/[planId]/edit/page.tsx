import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { PlanForm } from "@/features/improvement-plans/components/PlanForm"

export default async function EditPlanPage({ params }: { params: { planId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const plan = await prisma.improvementPlan.findUnique({
    where: { id: params.planId },
    include: { actions: true }
  })

  // التأكد من أن الخطة موجودة وأن المستخدم يملك صلاحية الوصول إليها
  if (!plan || (plan.schoolId !== user.schoolId && user.role !== "SUPER_ADMIN")) {
    redirect("/school-manager/quality/improvement-plans")
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="تعديل خطة التحسين"
        description="قم بتحديث تفاصيل الخطة والإجراءات."
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "خطط التحسين", href: "/school-manager/quality/improvement-plans" },
          { label: "تعديل الخطة" }
        ]}
      />
      <Card>
        <CardContent className="p-6">
          {/* تمرير بيانات الخطة الحالية إلى النموذج ليتم تعبئتها تلقائياً */}
          <PlanForm plan={plan} />
        </CardContent>
      </Card>
    </div>
  )
}