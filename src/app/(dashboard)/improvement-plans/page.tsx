import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Progress } from "@/components/ui/Progress"
import { Eye } from "lucide-react"
import Link from "next/link"

export default async function ImprovementPlansPage() {
  const user = await getCurrentUser()
  if (!user || !user.id) redirect("/login")

  const isSuperAdmin = user.role === "SUPER_ADMIN"
  const isQualityAssessor = user.role === "QUALITY_ASSESSOR"

  if (!isSuperAdmin && !isQualityAssessor) {
    redirect("/")
  }

  const dbPlans = isQualityAssessor 
    ? await prisma.improvementPlan.findMany({
        where: { createdById: user.id },
        include: {
          school: { select: { name: true } },
          branch: { select: { name: true } },
          gap: { select: { indicator: { select: { code: true, description: true } } } },
          createdBy: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" }
      })
    : await prisma.improvementPlan.findMany({
        include: {
          school: { select: { name: true } },
          branch: { select: { name: true } },
          gap: { select: { indicator: { select: { code: true, description: true } } } },
          createdBy: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" }
      })

  type PlanData = {
    id: string
    title: string
    status: string
    progress: number
    school: { name: string } | null
    branch: { name: string } | null
    gap: { indicator: { code: string; description: string } | null } | null
    createdBy: { name: string } | null
  }

  const plans = dbPlans as unknown as PlanData[]

  return (
    <div className="space-y-6">
      <PageHeader
        title="خطط التحسين"
        description="إدارة ومتابعة خطط التحسين الخاصة بالتقييمات."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'خطط التحسين' }]}
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-[12px] text-muted-foreground bg-surface-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">عنوان الخطة</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">المؤشر</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">المدرسة / الفرع</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">الإنجاز</th>
                  <th className="px-4 py-3 font-medium text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map((p) => {
                  const indicatorCode = p.gap?.indicator?.code ?? "—"
                  
                  return (
                    <tr key={p.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-medium text-foreground-strong">
                        {p.title}
                        <p className="text-xs text-muted-foreground mt-1">{p.createdBy?.name}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                        {indicatorCode}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {p.school?.name} {p.branch ? `- ${p.branch.name}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === "COMPLETED" ? "success" : p.status === "IN_PROGRESS" ? "warning" : "neutral"}>
                          {p.status === "COMPLETED" ? "مكتملة" : p.status === "IN_PROGRESS" ? "جارية" : "مسودة"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Progress value={p.progress} size="sm" className="w-16" />
                          <span className="text-xs text-muted-foreground">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left">
                        <Link href={`/improvement-plans/${p.id}`}>
                          <Button variant="ghost" size="sm" icon={<Eye className="w-4 h-4" />}>
                            عرض
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      لا توجد خطط تحسين متاحة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}