import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { InitiativeForm } from "@/features/initiatives/components/InitiativeForm"

export default async function InitiativePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  // جلب خطط التحسين المتاحة للمدرسة لربطها بالمبادرة
  const plans = await prisma.improvementPlan.findMany({
    where: { schoolId: user.schoolId || undefined },
    select: { id: true, title: true }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="إنشاء مبادرة"
        description="نموذج مبادرة إلكتروني قابل للحفظ والطباعة بصيغة PDF أو Word."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'إنشاء مبادرة' }]}
      />
      
      <Card>
        <CardContent className="p-6">
          <InitiativeForm plans={plans} />
        </CardContent>
      </Card>
    </div>
  )
}