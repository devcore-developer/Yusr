import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { StatCard } from "@/components/dashboard/StatCard"
import { FileText, Download, ClipboardCheck, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react"
import { formatDate } from "@/lib/utils"

export default async function ReportsPage() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  const [assessments, gaps, plans, branches] = await Promise.all([
    prisma.assessment.count({ where: { schoolId: user.schoolId } }),
    prisma.gap.count({ where: { schoolId: user.schoolId } }),
    prisma.improvementPlan.count({ where: { schoolId: user.schoolId } }),
    prisma.branch.count({ where: { schoolId: user.schoolId } }),
  ])

  const reports = [
    {
      title: "تقرير الجودة الشامل",
      desc: "نظرة شاملة على أداء المدرسة في جميع المجالات والفروع",
      icon: <FileText className="w-5 h-5" />,
      available: assessments > 0,
      tone: "info" as const,
    },
    {
      title: "ملخص التقييمات",
      desc: `حالة ${assessments} تقييم — المكتملة والجارية`,
      icon: <ClipboardCheck className="w-5 h-5" />,
      available: assessments > 0,
      tone: "amber" as const,
    },
    {
      title: "ملخص الفجوات",
      desc: `${gaps} فجوة مسجلة — المفتوحة والمغلقة`,
      icon: <AlertTriangle className="w-5 h-5" />,
      available: gaps > 0,
      tone: "danger" as const,
    },
    {
      title: "تقدم التحسين",
      desc: `أداء ${plans} خطة تحسين نشطة`,
      icon: <TrendingUp className="w-5 h-5" />,
      available: plans > 0,
      tone: "success" as const,
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقارير"
        description="تقارير تنفيذية حول أداء المدرسة وجودتها"
        breadcrumbs={[{ label: "الرئيسية", href: "/school-manager" }, { label: "التقارير" }]}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="التقييمات" value={assessments} icon={<ClipboardCheck className="w-5 h-5" />} tone="amber" />
        <StatCard label="الفجوات" value={gaps} icon={<AlertTriangle className="w-5 h-5" />} tone="danger" />
        <StatCard label="خطط التحسين" value={plans} icon={<TrendingUp className="w-5 h-5" />} tone="success" />
        <StatCard label="الفروع" value={branches} icon={<CheckCircle className="w-5 h-5" />} tone="info" />
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {reports.map(report => (
          <Card key={report.title} variant="primary" className="shadow-card-hover">
            <CardContent className="p-5 lg:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${report.tone === 'info' ? 'tint-info' : report.tone === 'amber' ? 'tint-amber' : report.tone === 'danger' ? 'tint-danger' : 'tint-success'}`}>
                  {report.icon}
                </div>
                <Badge variant={report.available ? "success" : "neutral"}>
                  {report.available ? "متاح" : "لا توجد بيانات"}
                </Badge>
              </div>
              <h3 className="text-sm font-semibold text-foreground-strong">{report.title}</h3>
              <p className="text-[13px] text-muted-foreground mt-1">{report.desc}</p>
              <div className="mt-4 pt-4 border-t border-border">
                <Button variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" />} disabled={!report.available}>
                  {report.available ? "تحميل التقرير" : "غير متاح"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}