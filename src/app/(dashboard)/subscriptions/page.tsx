import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge, StatusBadge } from "@/components/ui/Badge"
import { Avatar } from "@/components/ui/Avatar"
import { EmptyState } from "@/components/ui/EmptyState"
import { CreditCard, Plus, RefreshCw, Calendar, Building2, Users, TrendingUp } from "lucide-react"
import { formatDate } from "@/lib/utils"

export const metadata = { title: "الاشتراكات" }

export default async function SubscriptionsPage() {
  await requireRole(["SUPER_ADMIN"])

  const [subscriptions, stats] = await Promise.all([
    prisma.subscription.findMany({
      include: { school: { select: { id: true, name: true, location: true, _count: { select: { branches: true, users: true } } } } },
      orderBy: { endDate: "asc" },
    }),
    Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "EXPIRING_SOON" } }),
      prisma.subscription.count({ where: { status: "EXPIRED" } }),
    ]).then(([total, active, expiring, expired]) => ({ total, active, expiring, expired })),
  ])

  const planCount = subscriptions.reduce((acc, s) => {
    acc[s.plan] = (acc[s.plan] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة الاشتراكات"
        description="متابعة اشتراكات المدارس، حالات التجديد، والباقات النشطة."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'الاشتراكات' }]}
        actions={
          <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
            اشتراك جديد
          </Button>
        }
      />

      {/* Plan distribution cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="primary" className="shadow-card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="tint-info w-10 h-10 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">إجمالي الاشتراكات</p>
              <p className="text-xl font-bold text-foreground-strong numeric">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="primary" className="shadow-card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="tint-success w-10 h-10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">نشط</p>
              <p className="text-xl font-bold text-foreground-strong numeric">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="primary" className="shadow-card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="tint-amber w-10 h-10 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">ينتهي قريباً</p>
              <p className="text-xl font-bold text-foreground-strong numeric">{stats.expiring}</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="primary" className="shadow-card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="tint-danger w-10 h-10 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[12px] text-muted-foreground">منتهي</p>
              <p className="text-xl font-bold text-foreground-strong numeric">{stats.expired}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions table */}
      <Card variant="primary">
        <CardHeader>
          <CardTitle icon={<CreditCard className="w-5 h-5" />}>جميع الاشتراكات</CardTitle>
          <CardDescription>{subscriptions.length} اشتراك مسجل</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {subscriptions.length === 0 ? (
            <EmptyState
              icon={<CreditCard />}
              title="لا توجد اشتراكات"
              description="لم يتم تسجيل أي اشتراك بعد."
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="text-[12px] text-muted-foreground bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3.5 font-medium">المدرسة</th>
                    <th className="px-4 py-3.5 font-medium">الباقة</th>
                    <th className="px-4 py-3.5 font-medium">الحالة</th>
                    <th className="px-4 py-3.5 font-medium hidden md:table-cell">تاريخ البدء</th>
                    <th className="px-4 py-3.5 font-medium hidden md:table-cell">تاريخ الانتهاء</th>
                    <th className="px-4 py-3.5 font-medium">الأيام المتبقية</th>
                    <th className="px-4 py-3.5 font-medium hidden lg:table-cell">الفروع</th>
                    <th className="px-4 py-3.5 font-medium hidden lg:table-cell">المستخدمون</th>
                    <th className="px-4 py-3.5 font-medium text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subscriptions.map((sub) => {
                    const daysRemaining = Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    return (
                      <tr key={sub.id} className="hover:bg-surface-muted transition-smooth">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                              {sub.school.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground-strong truncate">{sub.school.name}</p>
                              <p className="text-[12px] text-muted-foreground truncate">{sub.school.location}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={sub.plan === 'Enterprise' ? 'violet' : sub.plan === 'Pro' ? 'info' : 'neutral'}>
                            {sub.plan === 'Enterprise' ? 'مؤسسات' : sub.plan === 'Pro' ? 'احترافية' : 'أساسية'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={sub.status} />
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground numeric">{formatDate(sub.startDate.toISOString())}</td>
                        <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground numeric">{formatDate(sub.endDate.toISOString())}</td>
                        <td className="px-4 py-3.5">
                          <span className={`font-bold numeric ${daysRemaining <= 0 ? 'text-danger' : daysRemaining <= 7 ? 'text-warning' : 'text-success'}`}>
                            {daysRemaining > 0 ? `${daysRemaining} يوم` : 'منتهي'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell numeric text-muted-foreground">{sub.school._count.branches}</td>
                        <td className="px-4 py-3.5 hidden lg:table-cell numeric text-muted-foreground">{sub.school._count.users}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon-sm" aria-label="تجديد" icon={<RefreshCw className="w-4 h-4" />} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}