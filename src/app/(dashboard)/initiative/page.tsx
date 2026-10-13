import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { InitiativeForm } from "@/features/initiatives/components/InitiativeForm"

export default async function InitiativePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  if (!["SUPER_ADMIN", "QUALITY_ASSESSOR"].includes(user.role)) {
    redirect("/dashboard")
  }

  const plans = await prisma.improvementPlan.findMany({
    where: { schoolId: user.schoolId || undefined },
    select: { id: true, title: true }
  })

  const isAssessor = user.role === "QUALITY_ASSESSOR"

  return (
    <div className="space-y-6">
      <PageHeader
        title="إنشاء مبادرة"
        description="نموذج مبادرة إلكتروني قابل للحفظ والطباعة."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'إنشاء مبادرة' }]}
      />
      
      <Card>
        <CardContent className="p-6">
          {isAssessor ? (
            <InitiativeForm plans={plans} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium text-foreground-strong mb-1">صلاحية للقراءة فقط</p>
              <p className="text-sm">يسمح لمقيمي الجودة فقط بإنشاء المبادرات.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}