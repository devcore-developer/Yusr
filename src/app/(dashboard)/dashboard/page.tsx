import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { StatCard } from "@/components/dashboard/StatCard"
import { DomainAnalysis, DomainStat } from "@/components/dashboard/DomainAnalysis"
import { ResponseAnalysis } from "@/components/dashboard/ResponseAnalysis"
import { RecentAssessments } from "@/components/dashboard/RecentAssessments"
import { AttentionRequired, AlertItem } from "@/components/dashboard/AttentionRequired"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { RecentSchools } from "@/components/dashboard/RecentSchools"
import { Button } from "@/components/ui/Button"
import { School, Building2, ClipboardCheck, AlertTriangle, RefreshCw } from "lucide-react"

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  if (user.role === "SCHOOL_MANAGER" || user.role === "BRANCH_MANAGER") redirect("/school-manager")
  if (user.role === "QUALITY_ASSESSOR") redirect("/quality-assessor")
  if (user.role !== "SUPER_ADMIN") redirect("/login")

  const [
    schoolsCount, branchesCount, usersCount, gaps, activeAssessments, completedAssessments,
    openGaps, verifiedEvidence, recentActivities, recentSchools, recentAssessmentsRaw,
    expiringSubs, delayedPlans, suspendedSchools, highSeverityGaps
  ] = await Promise.all([
    prisma.school.count(),
    prisma.branch.count(),
    prisma.user.count(),
    prisma.gap.count(),
    prisma.assessment.count({ where: { status: "IN_PROGRESS" } }),
    prisma.assessment.count({ where: { status: "COMPLETED" } }),
    prisma.gap.count({ where: { status: "OPEN" } }),
    prisma.evidenceResponse.findMany({
      where: { isVerified: true },
      select: { evidence: { select: { indicator: { select: { domain: { select: { id: true, name: true } } } } } } },
    }),
    prisma.activity.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } }, school: { select: { name: true } } } }),
    prisma.school.findMany({ take: 4, orderBy: { createdAt: "desc" }, include: { _count: { select: { branches: true, users: true } } } }),
    prisma.assessment.findMany({ take: 5, orderBy: { startedAt: "desc" }, include: { school: { select: { id: true, name: true } }, branch: { select: { name: true } }, assessor: { select: { name: true } } } }),
    prisma.subscription.findMany({ where: { endDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, status: { in: ["ACTIVE", "EXPIRING_SOON"] } }, include: { school: { select: { id: true, name: true } } } }),
    prisma.improvementPlan.findMany({ where: { targetDate: { lt: new Date() }, status: { not: "COMPLETED" } }, take: 4, include: { school: { select: { id: true, name: true } } } }),
    prisma.school.findMany({ where: { status: "SUSPENDED" }, take: 4, select: { id: true, name: true } }),
    prisma.gap.findMany({ where: { severity: "HIGH", status: "OPEN" }, take: 4, include: { school: { select: { id: true, name: true } } } }),
  ])

  const presentCount = verifiedEvidence.length
  const notPresentCount = gaps

  const domainMap: Record<string, { id: string; name: string; present: number; notPresent: number; notApplicable: number; total: number }> = {}
  for (const r of verifiedEvidence) {
    const d = r.evidence.indicator.domain
    if (!domainMap[d.id]) domainMap[d.id] = { id: d.id, name: d.name, present: 0, notPresent: 0, notApplicable: 0, total: 0 }
    domainMap[d.id].present++
    domainMap[d.id].total++
  }
  const domainStats: DomainStat[] = Object.values(domainMap).map(d => ({ ...d, score: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0 }))

  const alerts: AlertItem[] = []
  for (const sub of expiringSubs) alerts.push({ id: `sub-${sub.id}`, type: 'EXPIRING_SUBSCRIPTION', severity: 'warning', message: `اشتراك ينتهي خلال ${Math.ceil((sub.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} يوم`, context: sub.school.name, href: `/subscriptions` })
  for (const plan of delayedPlans) alerts.push({ id: `plan-${plan.id}`, type: 'DELAYED_PLAN', severity: 'warning', message: 'خطة تحسين متأخرة', context: plan.school.name, href: `/schools/${plan.schoolId}` })
  for (const school of suspendedSchools) alerts.push({ id: `school-${school.id}`, type: 'SUSPENDED_SCHOOL', severity: 'danger', message: 'مدرسة موقوفة', context: school.name, href: `/schools/${school.id}` })
  for (const gap of highSeverityGaps) alerts.push({ id: `gap-${gap.id}`, type: 'HIGH_GAP', severity: 'danger', message: 'فجوة عالية الأولوية', context: gap.school.name, href: `/schools/${gap.schoolId}` })
  alerts.sort((a, b) => (a.severity === 'danger' ? -1 : 1) - (b.severity === 'danger' ? -1 : 1))

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="تحليلات الجودة الشاملة"
        description="نظرة تنفيذية على أداء المدارس والتقييمات والفجوات وخطط التحسين."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'لوحة التحكم' }]}
        actions={<Button variant="outline" size="md" icon={<RefreshCw className="w-4 h-4" />} iconPosition="start">تحديث البيانات</Button>}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <StatCard label="إجمالي المدارس" value={schoolsCount} icon={<School className="w-5 h-5" />} tone="success" context={`${schoolsCount} مدرسة مسجلة`} />
        <StatCard label="إجمالي الفروع" value={branchesCount} icon={<Building2 className="w-5 h-5" />} tone="info" context={`${branchesCount} فرع نشط`} />
        <StatCard label="تقييمات نشطة" value={activeAssessments} icon={<ClipboardCheck className="w-5 h-5" />} tone="amber" status={{ label: `${completedAssessments} مكتمل`, tone: 'success' }} />
        <StatCard label="فجوات مفتوحة" value={openGaps} icon={<AlertTriangle className="w-5 h-5" />} tone="danger" context={`${gaps} إجمالي الفجوات`} />
      </div>

      {/* Main Analytics Row - Balanced Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2"><RecentAssessments assessments={recentAssessmentsRaw} /></div>
        <ResponseAnalysis present={presentCount} notPresent={notPresentCount} notApplicable={0} />
      </div>

      <DomainAnalysis domains={domainStats} />

      {/* Activity & Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <AttentionRequired alerts={alerts} />
        <RecentActivity activities={recentActivities} />
      </div>

      <RecentSchools schools={recentSchools} />
    </div>
  )
}