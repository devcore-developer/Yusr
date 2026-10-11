import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { TrendingUp } from "lucide-react"

export default async function FollowUpPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const where = user.role === "SCHOOL_MANAGER" ? { schoolId: user.schoolId! } : {}
  const plans = await prisma.improvementPlan.findMany({ where, include: { gap: true } })

  return (
    <div className="space-y-6">
      <PageHeader
        title="المتابعة وقياس الأثر"
        description="متابعة تنفيذ خطط التحسين وقياس أثرها."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'المتابعة والأثر' }]}
      />
      <Card>
        <CardContent className="p-0">
          {plans.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
              لا توجد خطط تحسين لمتابعتها حالياً.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {plans.map(p => (
                <div key={p.id} className="p-4">
                  <h3 className="font-bold text-foreground-strong">{p.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">التقدم: {p.progress}%</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}