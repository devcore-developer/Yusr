import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { StatCard } from "@/components/dashboard/StatCard"
import { RecentAssessments } from "@/components/dashboard/RecentAssessments"
import { DomainAnalysis, DomainStat } from "@/components/dashboard/DomainAnalysis"
import { AttentionRequired, AlertItem } from "@/components/dashboard/AttentionRequired"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { Button } from "@/components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Building2, Users, ClipboardCheck, AlertTriangle, Plus, RefreshCw, TrendingUp, FileCheck } from "lucide-react"

export default async function SchoolManagerDashboard() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  // === لوحة تحكم مدير الفرع (4 بطاقات مخصصة + أقسام إضافية) ===
  if (user.role === "BRANCH_MANAGER") {
    if (!user.branchId) redirect("/login")

    const [usersCount, activeAssessments, openGaps, assessments, recentAssessmentsRaw, branchGaps, delayedPlans, recentActivities] = await Promise.all([
      prisma.user.count({ where: { branchId: user.branchId } }),
      prisma.assessment.count({ where: { branchId: user.branchId, status: "IN_PROGRESS" } }),
      prisma.gap.count({ where: { branchId: user.branchId, status: "OPEN" } }),
      prisma.assessment.findMany({ where: { branchId: user.branchId }, select: { progress: true } }),
      prisma.assessment.findMany({
        where: { branchId: user.branchId }, take: 5, orderBy: { startedAt: "desc" },
        include: { school: { select: { name: true } }, assessor: { select: { name: true } } }
      }),
      prisma.gap.findMany({
        where: { branchId: user.branchId, status: "OPEN" }, take: 4,
        include: { indicator: true }
      }),
      prisma.improvementPlan.findMany({
        where: { branchId: user.branchId, status: { not: "COMPLETED" } }, take: 4
      }),
      prisma.activity.findMany({
        where: { branchId: user.branchId }, take: 5, orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } }
      })
    ])

    const avgProgress = assessments.length > 0 ? Math.round(assessments.reduce((acc, a) => acc + a.progress, 0) / assessments.length) : 0

    const alerts: AlertItem[] = branchGaps.map(g => ({
      id: g.id,
      type: 'HIGH_GAP',
      severity: g.severity === 'HIGH' ? 'danger' : 'warning',
      message: `فجوة في مؤشر ${g.indicator.code}`,
      context: g.description || g.indicator.description,
      href: '/school-manager/quality/gaps'
    }))

    return (
      <div className="space-y-6 lg:space-y-8">
        <PageHeader
          title="لوحة تحكم مدير الفرع"
          description="نظرة عامة على أداء فرعك والمستخدمين التابعين له."
          breadcrumbs={[{ label: 'الرئيسية', href: '/school-manager' }, { label: 'لوحة التحكم' }]}
        />
        
        {/* 1. KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          <StatCard label="مستخدمو الفرع" value={usersCount} icon={<Users className="w-5 h-5" />} tone="info" />
          <StatCard label="التقييمات النشطة" value={activeAssessments} icon={<ClipboardCheck className="w-5 h-5" />} tone="amber" />
          <StatCard label="الفجوات المفتوحة" value={openGaps} icon={<AlertTriangle className="w-5 h-5" />} tone="danger" />
          <StatCard label="نسبة إنجاز التقييم" value={`${avgProgress}%`} icon={<TrendingUp className="w-5 h-5" />} tone="success" progress={{ value: avgProgress }} />
        </div>

        {/* 2. Recent Assessments & Gaps */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="lg:col-span-2">
            <RecentAssessments assessments={recentAssessmentsRaw} />
          </div>
          <AttentionRequired alerts={alerts} />
        </div>

        {/* 3. Improvement Plans & Activity */}
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

  // === لوحة تحكم مدير المدرسة (الشاملة) ===
  const schoolId = user.schoolId

  const [
    school, branchesCount, usersCount, activeAssessments, completedAssessments,
    openGaps, totalGaps, verifiedEvidence, recentAssessmentsRaw, recentActivities,
    delayedPlans, highSeverityGaps
  ] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, status: true } }),
    prisma.branch.count({ where: { schoolId } }),
    prisma.user.count({ where: { schoolId } }),
    prisma.assessment.count({ where: { schoolId, status: "IN_PROGRESS" } }),
    prisma.assessment.count({ where: { schoolId, status: "COMPLETED" } }),
    prisma.gap.count({ where: { schoolId, status: "OPEN" } }),
    prisma.gap.count({ where: { schoolId } }),
    prisma.evidenceResponse.findMany({
      where: { assessment: { schoolId }, isVerified: true },
      select: { evidence: { select: { indicator: { select: { domain: { select: { id: true, name: true } } } } } } },
    }),
    prisma.assessment.findMany({
      where: { schoolId }, take: 6, orderBy: { startedAt: "desc" },
      include: { school: { select: { id: true, name: true } }, branch: { select: { name: true } }, assessor: { select: { name: true } } },
    }),
    prisma.activity.findMany({
      where: { schoolId }, take: 8, orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } }, school: { select: { name: true } } },
    }),
    prisma.improvementPlan.findMany({
      where: { schoolId, targetDate: { lt: new Date() }, status: { not: "COMPLETED" } }, take: 5,
    }),
    prisma.gap.findMany({ where: { schoolId, severity: "HIGH", status: "OPEN" }, take: 5 }),
  ])

  if (!school) return null

  const domainMap: Record<string, { id: string; name: string; present: number; notPresent: number; notApplicable: number; total: number }> = {}
  for (const r of verifiedEvidence) {
    const d = r.evidence.indicator.domain
    if (!domainMap[d.id]) domainMap[d.id] = { id: d.id, name: d.name, present: 0, notPresent: 0, notApplicable: 0, total: 0 }
    domainMap[d.id].present++
    domainMap[d.id].total++
  }
  
  const domainStats: DomainStat[] = Object.values(domainMap).map(d => ({
    ...d, score: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
  }))

  const alerts: AlertItem[] = []
  for (const p of delayedPlans) alerts.push({ id: `plan-${p.id}`, type: 'DELAYED_PLAN', severity: 'warning', message: 'خطة تحسين متأخرة', context: p.title, href: `/school-manager/quality/improvement-plans/${p.id}` })
  for (const g of highSeverityGaps) alerts.push({ id: `gap-${g.id}`, type: 'HIGH_GAP', severity: 'danger', message: 'فجوة عالية الأولوية', context: school.name, href: '/school-manager/quality/gaps' })

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={school.name}
        description="لوحة تحكم إدارة المدرسة — تابع الفروع والمستخدمين والتقييمات وخطط التحسين."
        breadcrumbs={[{ label: 'الرئيسية', href: '/school-manager' }, { label: 'لوحة التحكم' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="md" icon={<RefreshCw className="w-4 h-4" />}>تحديث</Button>
            {/* تم إزالة زر إضافة فرع من هنا */}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <StatCard label="الفروع" value={branchesCount} icon={<Building2 className="w-5 h-5" />} tone="info" context={`${branchesCount} فرع نشط`} />
        <StatCard label="المستخدمون" value={usersCount} icon={<Users className="w-5 h-5" />} tone="violet" context={`${usersCount} مستخدم مسجل`} />
        <StatCard label="تقييمات نشطة" value={activeAssessments} icon={<ClipboardCheck className="w-5 h-5" />} tone="amber" status={{ label: `${completedAssessments} مكتمل`, tone: 'success' }} />
        <StatCard label="فجوات مفتوحة" value={openGaps} icon={<AlertTriangle className="w-5 h-5" />} tone="danger" context={`${totalGaps} إجمالي الفجوات`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2"><RecentAssessments assessments={recentAssessmentsRaw} /></div>
        <DomainAnalysis domains={domainStats} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <AttentionRequired alerts={alerts} />
        <RecentActivity activities={recentActivities} />
      </div>
    </div>
  )
}