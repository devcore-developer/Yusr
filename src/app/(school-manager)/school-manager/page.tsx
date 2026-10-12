import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/PageHeader"
import { StatCard } from "@/components/dashboard/StatCard"
import { RecentAssessments } from "@/components/dashboard/RecentAssessments"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { Button } from "@/components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { VerticalBarChart, HorizontalBarChart } from "@/components/charts/AnalyticsCharts"
import { Building2, Users, ClipboardCheck, AlertTriangle, RefreshCw, TrendingUp, FileCheck, ArrowLeft } from "lucide-react"

export default async function SchoolManagerDashboard() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  // === لوحة تحكم مدير الفرع ===
  if (user.role === "BRANCH_MANAGER") {
    if (!user.branchId) redirect("/login")

    const [usersCount, activeAssessments, openGaps, assessments, recentAssessmentsRaw, branchGaps, delayedPlans, recentActivities, domains, verifiedEvidence] = await Promise.all([
      prisma.user.count({ where: { branchId: user.branchId } }),
      prisma.assessment.count({ where: { branchId: user.branchId, status: "IN_PROGRESS", type: { not: "PRIVATE_REVIEW" } } }),
      prisma.gap.count({ where: { branchId: user.branchId, status: "OPEN", assessment: { type: { not: "PRIVATE_REVIEW" } } } }),
      prisma.assessment.findMany({ where: { branchId: user.branchId, type: { not: "PRIVATE_REVIEW" } }, select: { progress: true } }),
      prisma.assessment.findMany({
        where: { branchId: user.branchId, type: { not: "PRIVATE_REVIEW" } }, take: 5, orderBy: { startedAt: "desc" },
        include: { school: { select: { name: true } }, assessor: { select: { name: true } } }
      }),
      prisma.gap.findMany({
        where: { branchId: user.branchId, status: "OPEN", assessment: { type: { not: "PRIVATE_REVIEW" } } }, take: 4,
        include: { indicator: true }
      }),
      prisma.improvementPlan.findMany({
        where: { branchId: user.branchId, status: { not: "COMPLETED" } }, take: 4
      }),
      prisma.activity.findMany({
        where: { branchId: user.branchId }, take: 5, orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } }
      }),
      prisma.domain.findMany({ include: { indicators: { include: { fixedEvidence: true } } } }),
      prisma.evidenceResponse.findMany({
        where: { isVerified: true, assessment: { branchId: user.branchId, type: { not: "PRIVATE_REVIEW" } } },
        include: { evidence: { include: { indicator: { include: { domain: true } } } } }
      })
    ])

    const avgProgress = assessments.length > 0 ? Math.round(assessments.reduce((acc, a) => acc + a.progress, 0) / assessments.length) : 0

    // Branch Domain Performance Calculation
    const domainPerformance = domains.map(d => {
      const req = d.indicators.reduce((acc, i) => acc + i.fixedEvidence.length, 0)
      const ver = verifiedEvidence.filter(v => v.evidence.indicator.domain.id === d.id).length
      return { name: d.name, percentage: req > 0 ? Math.round((ver / req) * 100) : null }
    })

    return (
      <div className="space-y-6 lg:space-y-8">
        <PageHeader
          title="لوحة تحكم مدير الفرع"
          description="نظرة عامة على أداء فرعك والمستخدمين التابعين له."
          breadcrumbs={[{ label: 'الرئيسية', href: '/school-manager' }, { label: 'لوحة التحكم' }]}
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          <StatCard label="مستخدمو الفرع" value={usersCount} icon={<Users className="w-5 h-5" />} tone="info" />
          <StatCard label="التقييمات النشطة" value={activeAssessments} icon={<ClipboardCheck className="w-5 h-5" />} tone="amber" />
          <StatCard label="الفجوات المفتوحة" value={openGaps} icon={<AlertTriangle className="w-5 h-5" />} tone="danger" />
          <StatCard label="نسبة إنجاز التقييم" value={`${avgProgress}%`} icon={<TrendingUp className="w-5 h-5" />} tone="success" progress={{ value: avgProgress }} />
        </div>

        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>أداء المجالات في الفرع</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <VerticalBarChart data={domainPerformance} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="lg:col-span-2">
            <RecentAssessments assessments={recentAssessmentsRaw} />
          </div>
          
          {/* Top Gaps for Branch */}
          <Card className="p-6 flex flex-col">
            <CardHeader className="px-0 pt-0 flex-row items-center justify-between">
              <CardTitle>أبرز الفجوات</CardTitle>
              <Link href="/school-manager/quality/gaps" className="text-xs text-cyan-600 hover:underline flex items-center gap-1">
                عرض الكل <ArrowLeft className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="px-0 flex-1 overflow-hidden">
              {branchGaps.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center py-4">
                  لا توجد فجوات مفتوحة حالياً.
                </div>
              ) : (
                <div className="space-y-3">
                  {branchGaps.map(gap => (
                    <Link href={`/quality-assessor/assessments/${gap.assessmentId}`} key={gap.id} className="block p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${gap.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                        <span className="text-xs font-mono text-slate-500">{gap.indicator.code}</span>
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-2 pr-4">{gap.description}</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <Card>
            <CardHeader>
              <CardTitle icon={<FileCheck className="w-5 h-5" />}>خطط التحسين والمتابعة</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {delayedPlans.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">لا توجد خطط تحسين نشطة حالياً.</div>
              ) : (
                <div className="divide-y divide-border">
                  {delayedPlans.map(p => (
                    <div key={p.id} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-foreground-strong text-sm">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">المستهدف: {new Date(p.targetDate).toLocaleDateString('ar-SA')}</p>
                      </div>
                      <Badge variant={p.progress === 100 ? "success" : "warning"}>{p.progress}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <RecentActivity activities={recentActivities} />
        </div>
      </div>
    )
  }

  // === لوحة تحكم مدير المدرسة ===
  const schoolId = user.schoolId

  const [
    school, branchesCount, usersCount, activeAssessments, completedAssessments,
    openGaps, totalGaps, verifiedEvidence, recentAssessmentsRaw, recentActivities,
    delayedPlans, highSeverityGaps, branches, domains, topSchoolGaps
  ] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, status: true } }),
    prisma.branch.count({ where: { schoolId } }),
    prisma.user.count({ where: { schoolId } }),
    prisma.assessment.count({ where: { schoolId, status: "IN_PROGRESS", type: { not: "PRIVATE_REVIEW" } } }),
    prisma.assessment.count({ where: { schoolId, status: "COMPLETED", type: { not: "PRIVATE_REVIEW" } } }),
    prisma.gap.count({ where: { schoolId, status: "OPEN", assessment: { type: { not: "PRIVATE_REVIEW" } } } }),
    prisma.gap.count({ where: { schoolId, assessment: { type: { not: "PRIVATE_REVIEW" } } } }),
    prisma.evidenceResponse.findMany({
      where: { assessment: { schoolId, type: { not: "PRIVATE_REVIEW" } }, isVerified: true },
      select: { evidence: { select: { indicator: { select: { domain: { select: { id: true, name: true } } } } } } },
    }),
    prisma.assessment.findMany({
      where: { schoolId, type: { not: "PRIVATE_REVIEW" } }, take: 6, orderBy: { startedAt: "desc" },
      include: { school: { select: { id: true, name: true } }, branch: { select: { name: true } }, assessor: { select: { name: true } } },
    }),
    prisma.activity.findMany({
      where: { schoolId }, take: 8, orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } }, school: { select: { name: true } } },
    }),
    prisma.improvementPlan.findMany({
      where: { schoolId, targetDate: { lt: new Date() }, status: { not: "COMPLETED" } }, take: 5,
    }),
    prisma.gap.findMany({ where: { schoolId, severity: "HIGH", status: "OPEN", assessment: { type: { not: "PRIVATE_REVIEW" } } }, take: 5 }),
    prisma.branch.findMany({ where: { schoolId }, include: { assessments: { where: { type: { not: "PRIVATE_REVIEW" } } } } }),
    prisma.domain.findMany({ include: { indicators: { include: { fixedEvidence: true } } } }),
    // جلب أبرز الفجوات للمدرسة
    prisma.gap.findMany({
      where: { schoolId, status: "OPEN", assessment: { type: { not: "PRIVATE_REVIEW" } } },
      take: 5,
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      include: { indicator: { include: { domain: true } }, branch: { select: { name: true } } }
    })
  ])

  if (!school) return null

  // 1. School Domain Performance Calculation
  const domainPerformance = domains.map(d => {
    const req = d.indicators.reduce((acc, i) => acc + i.fixedEvidence.length, 0)
    const ver = verifiedEvidence.filter(v => v.evidence.indicator.domain.id === d.id).length
    return { name: d.name, percentage: req > 0 ? Math.round((ver / req) * 100) : null }
  })

  // 2. Branch Comparison Calculation
  const branchComparison = branches.map(b => {
    const progress = b.assessments.length > 0 ? Math.round(b.assessments.reduce((acc, a) => acc + a.progress, 0) / b.assessments.length) : 0
    return { name: b.name, percentage: progress > 0 ? progress : null }
  })

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={school.name}
        description="لوحة تحكم إدارة المدرسة — تابع الفروع والمستخدمين والتقييمات وخطط التحسين."
        breadcrumbs={[{ label: 'الرئيسية', href: '/school-manager' }, { label: 'لوحة التحكم' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="md" icon={<RefreshCw className="w-4 h-4" />}>تحديث</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <StatCard label="الفروع" value={branchesCount} icon={<Building2 className="w-5 h-5" />} tone="info" context={`${branchesCount} فرع نشط`} />
        <StatCard label="المستخدمون" value={usersCount} icon={<Users className="w-5 h-5" />} tone="violet" context={`${usersCount} مستخدم مسجل`} />
        <StatCard label="تقييمات نشطة" value={activeAssessments} icon={<ClipboardCheck className="w-5 h-5" />} tone="amber" status={{ label: `${completedAssessments} مكتمل`, tone: 'success' }} />
        <StatCard label="فجوات مفتوحة" value={openGaps} icon={<AlertTriangle className="w-5 h-5" />} tone="danger" context={`${totalGaps} إجمالي الفجوات`} />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>أداء المجالات</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <VerticalBarChart data={domainPerformance} />
          </CardContent>
        </Card>
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>تقدم التقييم في الفروع</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <HorizontalBarChart data={branchComparison} />
          </CardContent>
        </Card>
      </div>

      {/* Top Gaps & Recent Assessments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2">
          <RecentAssessments assessments={recentAssessmentsRaw} />
        </div>
        
        {/* Top Gaps for School */}
        <Card className="p-6 flex flex-col">
          <CardHeader className="px-0 pt-0 flex-row items-center justify-between">
            <CardTitle>أبرز الفجوات</CardTitle>
            <Link href="/school-manager/quality/gaps" className="text-xs text-cyan-600 hover:underline flex items-center gap-1">
              عرض الكل <ArrowLeft className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 flex-1 overflow-hidden">
            {topSchoolGaps.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center py-4">
                لا توجد فجوات مفتوحة حالياً.
              </div>
            ) : (
              <div className="space-y-3">
                {topSchoolGaps.map(gap => (
                  <Link href={`/quality-assessor/assessments/${gap.assessmentId}`} key={gap.id} className="block p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${gap.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <span className="text-xs font-mono text-slate-500">{gap.indicator.code}</span>
                      {gap.branch && <span className="text-xs text-slate-400 truncate">- {gap.branch.name}</span>}
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-2 pr-4">{gap.description}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <RecentActivity activities={recentActivities} />
        <Card className="p-6 flex items-center justify-center text-muted-foreground text-sm">
          لمزيد من التفاصيل حول خطط التحسين، يرجى زيارة صفحة خطط التحسين.
        </Card>
      </div>
    </div>
  )
}