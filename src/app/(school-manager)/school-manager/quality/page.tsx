import { getCurrentUser } from "@/lib/permissions"
import { getSchoolAnalytics } from "@/features/quality-reports/services/analytics"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { Badge, StatusBadge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { StatCard } from "@/components/dashboard/StatCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { CheckCircle, AlertTriangle, ClipboardCheck, TrendingUp } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

export default async function SchoolQualityPage() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  const data = await getSchoolAnalytics(user.schoolId)

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="نظرة عامة على الجودة"
        description="تحليلات أداء المدرسة وفروعها"
        breadcrumbs={[{ label: "الرئيسية", href: "/school-manager" }, { label: "الجودة" }]}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <StatCard label="تغطية الاستجابات" value={`${data.responseCoverage}%`} icon={<CheckCircle className="w-5 h-5" />} tone="success" progress={{ value: data.responseCoverage }} />
        <StatCard label="مؤشرات محققة" value={data.presentCount} icon={<CheckCircle className="w-5 h-5" />} tone="info" context={`من ${data.presentCount + data.notPresentCount + data.notApplicableCount} استجابة`} />
        <StatCard label="فجوات مكتشفة" value={data.totalGaps} icon={<AlertTriangle className="w-5 h-5" />} tone="danger" context={`${data.openGaps} مفتوحة`} />
        <StatCard label="تقييمات مكتملة" value={data.completedAssessments} icon={<ClipboardCheck className="w-5 h-5" />} tone="amber" context={`${data.activeAssessments} نشطة`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branch Comparison */}
        <Card variant="primary">
          <CardHeader>
            <CardTitle icon={<TrendingUp className="w-5 h-5" />}>مقارنة الفروع</CardTitle>
            <CardDescription>تغطية الاستجابات لكل فرع</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.branchComparison.length === 0 ? (
              <EmptyState icon={<TrendingUp />} title="لا توجد فروع" compact />
            ) : (
              data.branchComparison.map(b => (
                <div key={b.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-foreground-strong">{b.name}</span>
                    <span className="text-sm font-bold text-foreground-strong numeric">{b.coverage}%</span>
                  </div>
                  <Progress value={b.coverage} size="sm" tone={b.coverage >= 80 ? "success" : b.coverage >= 50 ? "warning" : "danger"} />
                  <p className="text-[12px] text-muted-foreground mt-1 numeric">{b.completed}/{b.assessments} تقييم مكتمل</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Historical Trends */}
        <Card variant="primary">
          <CardHeader>
            <CardTitle icon={<ClipboardCheck className="w-5 h-5" />}>الاتجاه التاريخي</CardTitle>
          </CardHeader>
          <CardContent>
            {data.history.length < 2 ? (
              <EmptyState icon={<ClipboardCheck />} title="لا توجد بيانات تاريخية كافية" description="تحتاج تقييمين مكتملين على الأقل." compact />
            ) : (
              <div className="space-y-3">
                {data.history.map((h, idx) => {
                  const prev = idx > 0 ? data.history[idx - 1] : null
                  const change = prev ? h.progress - prev.progress : 0
                  return (
                    <div key={h.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-foreground-strong numeric">{formatDate(h.date.toISOString())}</p>
                        <p className="text-[12px] text-muted-foreground numeric">{h.gaps} فجوات • {h.responses} استجابة</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground-strong numeric">{h.progress}%</p>
                        {change !== 0 && (
                          <p className={`text-[12px] font-medium ${change > 0 ? "text-success" : "text-danger"}`}>
                            {change > 0 ? `+${change}%` : `${change}%`}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Assessments */}
      <Card variant="primary">
        <CardHeader>
          <CardTitle icon={<ClipboardCheck className="w-5 h-5" />}>أحدث التقييمات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentAssessments.length === 0 ? (
            <EmptyState icon={<ClipboardCheck />} title="لا توجد تقييمات بعد" compact action={{ label: "إنشاء تقييم", href: "/quality-assessor" }} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="text-[12px] text-muted-foreground bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">الفرع</th>
                    <th className="px-4 py-3 font-medium">المقيّم</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">التاريخ</th>
                    <th className="px-4 py-3 font-medium">الحالة</th>
                    <th className="px-4 py-3 font-medium text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recentAssessments.map(a => (
                    <tr key={a.id} className="hover:bg-surface-muted transition-smooth">
                      <td className="px-4 py-3.5 font-medium text-foreground-strong">{a.branch?.name || "كامل المدرسة"}</td>
                      <td className="px-4 py-3.5 text-muted-foreground">{a.assessor.name}</td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground numeric">{formatDate(a.startedAt.toISOString())}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={a.status} /></td>
                      <td className="px-4 py-3.5">
                        <Link href={`/quality/assessments/${a.id}/results`} className="text-secondary hover:underline text-[13px] font-medium">
                          عرض النتائج
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}