import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge, StatusBadge } from "@/components/ui/Badge"
import { Avatar } from "@/components/ui/Avatar"
import { EmptyState } from "@/components/ui/EmptyState"
import { Mail, Briefcase, Clock, Pencil, Building2, Activity as ActivityIcon } from "lucide-react"
import { formatDate, formatRelativeTime } from "@/lib/utils"

const roleConfig: Record<string, { label: string; variant: "danger" | "info" | "violet" | "amber" | "neutral" }> = {
  SUPER_ADMIN: { label: "مدير النظام", variant: "danger" },
  SCHOOL_MANAGER: { label: "مدير مدرسة", variant: "info" },
  BRANCH_MANAGER: { label: "مدير فرع", variant: "violet" },
  QUALITY_ASSESSOR: { label: "مقيم جودة", variant: "amber" },
}

export default async function UserDetailsPage({ params }: { params: { userId: string } }) {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  const targetUser = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true, name: true, email: true, role: true, status: true, createdAt: true,
      school: { select: { name: true } },
      branch: { select: { id: true, name: true } },
      activities: { take: 5, orderBy: { createdAt: "desc" }, select: { id: true, action: true, entityType: true, createdAt: true } },
    },
  })

  if (!targetUser || targetUser.school?.name === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="text-xl font-semibold text-foreground">المستخدم غير موجود</h1>
      </div>
    )
  }

  const roleCfg = roleConfig[targetUser.role] ?? { label: targetUser.role, variant: "neutral" as const }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={targetUser.name}
        breadcrumbs={[
          { label: "الرئيسية", href: "/school-manager" },
          { label: "المستخدمون", href: "/school-manager/users" },
          { label: targetUser.name },
        ]}
        actions={<Button variant="outline" size="md" icon={<Pencil className="w-4 h-4" />}>تعديل</Button>}
      />

      {/* Profile card */}
      <Card variant="primary">
        <CardContent className="p-5 lg:p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar name={targetUser.name} size="lg" />
            <div>
              <h2 className="text-lg font-bold text-foreground-strong">{targetUser.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={roleCfg.variant}>{roleCfg.label}</Badge>
                <StatusBadge status={targetUser.status} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <InfoRow icon={<Mail className="w-4 h-4" />} label="البريد الإلكتروني" value={targetUser.email} />
            <InfoRow icon={<Briefcase className="w-4 h-4" />} label="الدور" value={roleCfg.label} />
            <InfoRow icon={<Building2 className="w-4 h-4" />} label="الفرع" value={targetUser.branch?.name ?? "كامل المدرسة"} />
            <InfoRow icon={<Clock className="w-4 h-4" />} label="تاريخ التسجيل" value={formatDate(targetUser.createdAt.toISOString())} />
          </div>
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card variant="primary">
        <CardHeader>
          <CardTitle icon={<ActivityIcon className="w-5 h-5" />}>آخر النشاطات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {targetUser.activities.length === 0 ? (
            <EmptyState icon={<ActivityIcon />} title="لا توجد نشاطات" compact />
          ) : (
            <ol className="relative p-4 space-y-4">
              <div className="absolute right-[18px] top-4 bottom-4 w-px bg-border" />
              {targetUser.activities.map(a => (
                <li key={a.id} className="relative flex items-start gap-3">
                  <div className="relative z-10 w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                    <ActivityIcon className="w-4 h-4 text-secondary" />
                  </div>
                  <div className="pt-1">
                    <p className="text-sm text-foreground-strong">{a.action} — {a.entityType}</p>
                    <p className="text-[12px] text-muted-foreground">{formatRelativeTime(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="tint-info w-9 h-9 rounded-lg flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-[12px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground-strong mt-0.5">{value}</p>
      </div>
    </div>
  )
}