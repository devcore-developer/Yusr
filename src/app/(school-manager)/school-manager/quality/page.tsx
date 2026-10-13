import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { StatCard } from "@/components/dashboard/StatCard"
import { Progress } from "@/components/ui/Progress"
import { CheckCircle, AlertTriangle, ClipboardCheck, TrendingUp } from "lucide-react"
import { getSchoolAnalytics } from "@/features/quality-reports/services/analytics"
import { getPerformanceBand } from "@/features/quality-assessment/services/analysis"

export default async function SchoolQualityPage() {
  const user = await getCurrentUser()
  if (!user || !user.schoolId) redirect("/login")

  const schoolId = user.schoolId
  const perf = await getSchoolAnalytics(schoolId)

  const recentAssessments = await prisma.assessment.findMany({
    where: { schoolId, type: "NORMAL", status: { in: ["IN_PROGRESS", "COMPLETED"] } },
    take: 5,
    orderBy: { startedAt: "desc" },
    include: { assessor: { select: { name: true } }, branch: { select: { name: true } } }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة الجودة المدرسية"
        description="نظرة عامة على أداء المدرسة والتقييمات."
        breadcrumbs={[{ label: 'الرئيسية', href: '/school-manager' }, { label: 'الجودة' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <StatCard 
          label="الأداء الإجمالي (مؤقت)" 
          value={perf.provisionalPercentage !== null ? `${perf.provisionalPercentage}%` : "—"} 
          icon={<TrendingUp className="w-5 h-5" />} 
          tone="success" 
        />
        <StatCard 
          label="متوسط المكتملة" 
          value={perf.finalPercentage !== null ? `${perf.finalPercentage}%` : "—"} 
          icon={<CheckCircle className="w-5 h-5" />} 
          tone="info" 
        />
        <StatCard 
          label="التقييمات المؤهلة" 
          value={perf.eligibleAssessments} 
          icon={<ClipboardCheck className="w-5 h-5" />} 
          tone="amber" 
          context={`${perf.completedAssessments} مكتمل / ${perf.inProgressAssessments} جاري`}
        />
        <StatCard 
          label="عدد المقيّمين" 
          value={perf.evaluators.length} 
          icon={<AlertTriangle className="w-5 h-5" />} 
          tone="violet" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold mb-4">أداء المقيّمين</h3>
            <div className="space-y-4">
              {perf.evaluators.map((ev) => (
                <div key={ev.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{ev.name} ({ev.role})</span>
                    <span className="text-muted-foreground">{ev.provisionalAverage ?? 0}%</span>
                  </div>
                  <div className="w-full bg-surface-muted rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-primary h-4 rounded-full transition-all" 
                      style={{ width: `${ev.provisionalAverage ?? 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
              {perf.evaluators.length === 0 && (
                <p className="text-muted-foreground text-center py-4">لا يوجد مقيّمون متاحون</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold mb-4">التقييمات الأخيرة</h3>
            <div className="divide-y divide-border">
              {recentAssessments.map(a => (
                <div key={a.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-foreground-strong">{a.assessor?.name || "غير محدد"}</p>
                    <p className="text-xs text-muted-foreground">{a.branch?.name || "كامل المدرسة"}</p>
                  </div>
                  <Badge variant={a.status === "COMPLETED" ? "success" : "warning"}>
                    {a.status === "COMPLETED" ? "مكتمل" : "جاري"}
                  </Badge>
                </div>
              ))}
              {recentAssessments.length === 0 && (
                <p className="text-muted-foreground text-center py-4">لا توجد تقييمات</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}