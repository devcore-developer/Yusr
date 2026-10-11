import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge, StatusBadge, PriorityBadge } from "@/components/ui/Badge"
import { StatCard } from "@/components/dashboard/StatCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { Avatar } from "@/components/ui/Avatar"
import { Users, Building2, MapPin, Phone, AlertTriangle, ClipboardCheck, Pencil } from "lucide-react"
import { formatDate, formatRelativeTime } from "@/lib/utils"

export default async function BranchDetailsPage({ params }: { params: { branchId: string } }) {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  const branch = await prisma.branch.findUnique({
    where: { id: params.branchId },
    include: {
      manager: { select: { id: true, name: true, email: true } },
      users: { select: { id: true, name: true, email: true, role: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { users: true, assessments: true, gaps: true } },
    },
  })

  if (!branch || branch.schoolId !== user.schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="text-xl font-semibold text-foreground">الفرع غير موجود</h1>
      </div>
    )
  }

  const branchGaps = await prisma.gap.findMany({
    where: { branchId: branch.id, status: "OPEN" },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { indicator: { select: { code: true, description: true, domain: { select: { name: true } } } } },
  })

  const recentAssessments = await prisma.assessment.findMany({
    where: { branchId: branch.id },
    take: 5,
    orderBy: { startedAt: "desc" },
    include: { assessor: { select: { name: true } } },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={branch.name}
        description={branch.location}
        breadcrumbs={[
          { label: "الرئيسية", href: "/school-manager" },
          { label: "الفروع", href: "/school-manager/branches" },
          { label: branch.name },
        ]}
        actions={
          <Button variant="outline" size="md" icon={<Pencil className="w-4 h-4" />}>تعديل</Button>
        }
      />

      {/* Branch info */}
      <Card variant="primary">
        <CardContent className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="tint-info w-10 h-10 rounded-lg flex items-center justify-center"><MapPin className="w-5 h-5" /></div>
            <div><p className="text-[12px] text-muted-foreground">الموقع</p><p className="text-sm font-medium text-foreground-strong">{branch.location}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="tint-violet w-10 h-10 rounded-lg flex items-center justify-center"><Users className="w-5 h-5" /></div>
            <div><p className="text-[12px] text-muted-foreground">المدير</p><p className="text-sm font-medium text-foreground-strong">{branch.manager?.name ?? "غير محدد"}</p></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="tint-success w-10 h-10 rounded-lg flex items-center justify-center"><Building2 className="w-5 h-5" /></div>
            <div><p className="text-[12px] text-muted-foreground">الحالة</p><div className="mt-1"><StatusBadge status={branch.status} /></div></div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="المستخدمون" value={branch._count.users} icon={<Users className="w-5 h-5" />} tone="violet" />
        <StatCard label="التقييمات" value={branch._count.assessments} icon={<ClipboardCheck className="w-5 h-5" />} tone="amber" />
        <StatCard label="الفجوات المفتوحة" value={branch._count.gaps} icon={<AlertTriangle className="w-5 h-5" />} tone="danger" />
        <StatCard label="الهاتف" value={branch.phone ?? "—"} icon={<Phone className="w-5 h-5" />} tone="info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users */}
        <Card variant="primary">
          <CardHeader>
            <CardTitle icon={<Users className="w-5 h-5" />}>مستخدمو الفرع</CardTitle>
            <CardDescription>{branch.users.length} مستخدم</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {branch.users.length === 0 ? (
              <EmptyState icon={<Users />} title="لا يوجد مستخدمون" compact />
            ) : (
              <ul className="divide-y divide-border">
                {branch.users.map(u => (
                  <li key={u.id} className="flex items-center gap-3 p-3 hover:bg-surface-muted transition-smooth">
                    <Avatar name={u.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground-strong truncate">{u.name}</p>
                      <p className="text-[12px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant={u.role === "BRANCH_MANAGER" ? "violet" : u.role === "QUALITY_ASSESSOR" ? "amber" : "neutral"}>
                      {u.role === "BRANCH_MANAGER" ? "مدير فرع" : u.role === "QUALITY_ASSESSOR" ? "مقيم" : "مستخدم"}
                    </Badge>
                    <StatusBadge status={u.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Gaps */}
        <Card variant="primary">
          <CardHeader>
            <CardTitle icon={<AlertTriangle className="w-5 h-5" />}>فجوات الفرع</CardTitle>
            <CardDescription>{branchGaps.length} فجوة مفتوحة</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {branchGaps.length === 0 ? (
              <EmptyState icon={<AlertTriangle />} title="لا توجد فجوات" compact />
            ) : (
              <ul className="divide-y divide-border">
                {branchGaps.map(gap => (
                  <li key={gap.id} className="flex items-start gap-3 p-3 hover:bg-surface-muted transition-smooth">
                    <div className="tint-danger w-8 h-8 rounded-lg flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground-strong">{gap.indicator.code}</p>
                      <p className="text-[12px] text-muted-foreground truncate">{gap.description}</p>
                    </div>
                    <PriorityBadge priority={gap.severity} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}