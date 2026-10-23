import { getPlatformAnalytics } from "@/features/quality-reports/services/analytics"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { School, Building2, ClipboardCheck, AlertTriangle, CheckCircle } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

export default async function SuperAdminQualityPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  // بوابة الدور: تحليلات المنصة الشاملة لمدير النظام فقط —
  // (الخدمة نفسها ترمي Forbidden لغيره؛ هنا نوجّه لطيفًا بدل شاشة الخطأ)
  if (user.role !== "SUPER_ADMIN") {
    redirect("/dashboard")
  }

  const data = await getPlatformAnalytics()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">تحليلات الجودة الشاملة</h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة عامة على أداء المنصة لجميع المدارس</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="إجمالي المدارس" value={data.schools} icon={<School className="w-4 h-4" />} />
        <MetricCard title="إجمالي الفروع" value={data.branches} icon={<Building2 className="w-4 h-4" />} />
        <MetricCard title="تقييمات نشطة" value={data.activeAssessments} icon={<ClipboardCheck className="w-4 h-4" />} />
        <MetricCard title="فجوات مفتوحة" value={data.openGaps} icon={<AlertTriangle className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>تحليل الاستجابات</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">مؤشرات محققة (Present)</span>
                <span className="text-sm font-bold text-success">{data.presentCount}</span>
              </div>
              <Progress value={data.responseCoverage} className="h-2.5" indicatorClassName="bg-success" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">مؤشرات غير محققة (Gaps)</span>
                <span className="text-sm font-bold text-danger">{data.notPresentCount}</span>
              </div>
              <Progress value={data.notPresentCount > 0 ? Math.round((data.notPresentCount / (data.presentCount + data.notPresentCount)) * 100) : 0} className="h-2.5" indicatorClassName="bg-danger" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>أحدث التقييمات</CardTitle></CardHeader>
          <CardContent className="p-0">
            {data.recentAssessments.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">لا توجد تقييمات بعد.</div>
            ) : (
              <div className="divide-y divide-border">
                {data.recentAssessments.map(a => (
                  <Link href={`/quality/assessments/${a.id}/results`} key={a.id} className="flex justify-between items-center p-4 hover:bg-surface-muted">
                    <div>
                      <p className="text-sm font-medium">{a.school.name}</p>
                      <p className="text-xs text-muted-foreground">{a.branch?.name || "كامل المدرسة"}</p>
                    </div>
                    <div className="text-left">
                      <Badge variant={a.status === "COMPLETED" ? "success" : "warning"}>{a.status}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">{formatDate(a.startedAt.toISOString())}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}