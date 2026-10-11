import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { PlanForm } from "@/features/improvement-plans/components/PlanForm"

export default async function NewPlanPage({ searchParams }: { searchParams: { gapId?: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  let gap = null
  if (searchParams.gapId) {
    gap = await prisma.gap.findUnique({
      where: { id: searchParams.gapId },
      include: { indicator: true }
    })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="إنشاء خطة تحسين جديدة"
        description="أدخل تفاصيل الخطة والإجراءات لمعالجة الفجوات."
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "خطط التحسين", href: "/school-manager/quality/improvement-plans" }, { label: "خطة جديدة" }]}
      />
      <Card>
        <CardContent className="p-6">
          <PlanForm gap={gap} />
        </CardContent>
      </Card>
    </div>
  )
}