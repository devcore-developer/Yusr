import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { DonutChart, VerticalBarChart, HorizontalBarChart, PerformanceLegend } from "@/components/charts/AnalyticsCharts"
import { getPerformanceLevel } from "@/lib/performance"
import { School, Building2, Users, ClipboardCheck, AlertTriangle, FileCheck, RefreshCw, ArrowLeft } from "lucide-react"

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.role === "SCHOOL_MANAGER" || user.role === "BRANCH_MANAGER") redirect("/school-manager")
  if (user.role === "QUALITY_ASSESSOR") redirect("/quality-assessor")
  if (user.role !== "SUPER_ADMIN") redirect("/login")

  const [
    schoolsCount, branchesCount, usersCount, assessmentsCount, activeGaps, plansCount,
    schools, domains, verifiedEvidence, topGaps
  ] = await Promise.all([
    prisma.school.count(),
    prisma.branch.count(),
    prisma.user.count(),
    prisma.assessment.count({ where: { type: { not: "PRIVATE_REVIEW" } } }),
    prisma.gap.count({ where: { status: "OPEN", assessment: { type: { not: "PRIVATE_REVIEW" } } } }),
    prisma.improvementPlan.count(),
    prisma.school.findMany({ include: { _count: { select: { branches: true } }, assessments: { where: { type: { not: "PRIVATE_REVIEW" } } } } }),
    prisma.domain.findMany({ include: { indicators: { include: { fixedEvidence: true } } } }),
    // الإصلاح هنا: جلب الشواهد من التقييمات الجارية والمكتملة معاً
    prisma.evidenceResponse.findMany({
      where: { 
        isVerified: true, 
        assessment: { 
          type: { not: "PRIVATE_REVIEW" }, 
          status: { in: ["IN_PROGRESS", "COMPLETED"] } 
        } 
      },
      include: { evidence: { include: { indicator: { include: { domain: true } } } } }
    }),
    prisma.gap.findMany({
      where: { status: "OPEN", assessment: { type: { not: "PRIVATE_REVIEW" } } },
      take: 5,
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      include: { indicator: { include: { domain: true } }, school: { select: { name: true } } }
    })
  ])

  const domainPerformance = domains.map(d => {
    const req = d.indicators.reduce((acc, i) => acc + i.fixedEvidence.length, 0)
    const ver = verifiedEvidence.filter(v => v.evidence.indicator.domain.id === d.id).length
    return { name: d.name, percentage: req > 0 ? Math.round((ver / req) * 100) : null }
  })

  const distributionData = [
    { label: 'التميز', value: 0, color: '#16A34A' },
    { label: 'التقدم', value: 0, color: '#2878B8' },
    { label: 'الانطلاق', value: 0, color: '#E9A34A' },
    { label: 'التهيئة', value: 0, color: '#C62828' },
    { label: 'غير مقيم', value: 0, color: '#858B95' },
  ]
  domains.forEach(d => d.indicators.forEach(ind => {
    const req = ind.fixedEvidence.length
    const ver = verifiedEvidence.filter(v => v.evidence.indicatorId === ind.id).length
    const pct = req > 0 ? Math.round((ver / req) * 100) : null
    const level = getPerformanceLevel(pct)
    const distItem = distributionData.find(item => item.label === level.label)
    if (distItem) distItem.value++
  }))

  const schoolComparison = schools.map(s => {
    const progress = s.assessments.length > 0 ? Math.round(s.assessments.reduce((acc, a) => acc + a.progress, 0) / s.assessments.length) : 0
    return { name: s.name, percentage: progress > 0 ? progress : null }
  }).sort((a, b) => (b.percentage || 0) - (a.percentage || 0)).slice(0, 5)

  const kpis = [
    { label: "المدارس", value: schoolsCount, icon: School, color: "text-cyan-600 bg-cyan-50" },
    { label: "الفروع", value: branchesCount, icon: Building2, color: "text-blue-600 bg-blue-50" },
    { label: "المستخدمون", value: usersCount, icon: Users, color: "text-violet-600 bg-violet-50" },
    { label: "التقييمات", value: assessmentsCount, icon: ClipboardCheck, color: "text-amber-600 bg-amber-50" },
    { label: "الفجوات المفتوحة", value: activeGaps, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
    { label: "خطط التحسين", value: plansCount, icon: FileCheck, color: "text-green-600 bg-green-50" },
  ]

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="تحليلات الجودة الشاملة"
        description="نظرة تنفيذية على أداء المدارس والتقييمات والفجوات وخطط التحسين."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'لوحة التحكم' }]}
        actions={<Button variant="outline" size="md" icon={<RefreshCw className="w-4 h-4" />}>تحديث</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${kpi.color}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            <p className="text-xs text-slate-500 mt-1">{kpi.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>أداء المجالات الأربعة</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <VerticalBarChart data={domainPerformance} />
          </CardContent>
        </Card>
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>توزيع مستويات الأداء</CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex justify-center">
            <DonutChart data={distributionData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>مقارنة أداء المدارس (أعلى 5)</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <HorizontalBarChart data={schoolComparison} />
          </CardContent>
        </Card>
        
        <Card className="p-6 flex flex-col">
          <CardHeader className="px-0 pt-0 flex-row items-center justify-between">
            <CardTitle>أبرز الفجوات</CardTitle>
            <Link href="/gaps" className="text-xs text-cyan-600 hover:underline flex items-center gap-1">
              عرض الكل <ArrowLeft className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 flex-1 overflow-hidden">
            {topGaps.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center py-4">
                لا توجد فجوات مفتوحة حالياً.
              </div>
            ) : (
              <div className="space-y-3">
                {topGaps.map(gap => (
                  <Link href={`/quality-assessor/assessments/${gap.assessmentId}`} key={gap.id} className="block p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${gap.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <span className="text-xs font-mono text-slate-500">{gap.indicator.code}</span>
                      <span className="text-xs text-slate-400 truncate">- {gap.school.name}</span>
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-2 pr-4">{gap.description}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card className="p-4">
        <PerformanceLegend />
      </Card>

    </div>
  )
}