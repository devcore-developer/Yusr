// ===== FILE: src/app/(dashboard)/users/page.tsx =====
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Badge, StatusBadge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { EmptyState } from "@/components/ui/EmptyState"
import { ChevronLeft, ChevronRight, Search, Users as UsersIcon, UserPlus, Eye, FilterX } from "lucide-react"
import Link from "next/link"
import { formatRelativeTime } from "@/lib/utils"
import { UserDeleteButton } from "@/components/admin/UserDeleteButton"
import { EditUserModal } from "@/components/admin/EditUserModal"
import { getStageLabel } from "@/lib/stages"

export const metadata = { title: "المستخدمون" }

const roleConfig: Record<string, { label: string; variant: 'danger' | 'info' | 'violet' | 'amber' | 'neutral' }> = {
  SUPER_ADMIN: { label: 'مدير النظام', variant: 'danger' },
  SCHOOL_MANAGER: { label: 'مدير عام', variant: 'info' },
  BRANCH_MANAGER: { label: 'مدير قسم', variant: 'violet' },
  QUALITY_ASSESSOR: { label: 'مشرف', variant: 'amber' },
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const user = await requireRole(["SUPER_ADMIN"])

  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined
  const role = typeof searchParams.role === 'string' ? searchParams.role : undefined
  const status = typeof searchParams.status === 'string' ? searchParams.status : undefined
  const page = parseInt(typeof searchParams.page === 'string' ? searchParams.page : '1') || 1
  const pageSize = 10

  const where: Record<string, unknown> = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (role) where.role = role
  if (status) where.status = status

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        // (هذه المهمة) المراحل المعينة — لعرضها في الجدول وتعديلها في EditUserModal
        stages: true,
        school: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        activities: { take: 1, orderBy: { createdAt: 'desc' }, select: { createdAt: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = !!(q || role || status)

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (role) params.set('role', role)
    if (status) params.set('status', status)
    params.set('page', String(p))
    return `/users?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمون"
        description="إدارة جميع المستخدمين على المنصة — المديرين والمعلمين والمقيّمين."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'المستخدمون' }]}
        actions={
          <Button variant="primary" size="md" icon={<UserPlus className="w-4 h-4" />}>
            إضافة مستخدم
          </Button>
        }
      />

      <form className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-border rounded-lg min-w-0">
        <div className="relative flex-1 min-w-[200px] min-w-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="ابحث بالاسم أو البريد الإلكتروني..."
            className="pr-10"
          />
        </div>
        <Select name="role" defaultValue={role}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]">
            <SelectValue placeholder="كل الأدوار" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SUPER_ADMIN">مدير النظام</SelectItem>
            <SelectItem value="SCHOOL_MANAGER">مدير عام</SelectItem>
            <SelectItem value="BRANCH_MANAGER">مدير قسم</SelectItem>
            <SelectItem value="QUALITY_ASSESSOR">مشرف</SelectItem>
          </SelectContent>
        </Select>
        <Select name="status" defaultValue={status}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[120px]">
            <SelectValue placeholder="كل الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">نشط</SelectItem>
            <SelectItem value="INVITED">مدعو</SelectItem>
            <SelectItem value="SUSPENDED">موقوف</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="primary" size="md" icon={<Search className="w-4 h-4" />}>
          تصفية
        </Button>
        {hasFilters && (
          <Link href="/users">
            <Button type="button" variant="ghost" size="md" icon={<FilterX className="w-4 h-4" />}>
              إلغاء
            </Button>
          </Link>
        )}
      </form>

      <div className="flex items-center justify-between min-w-0">
        <p className="text-[13px] text-muted-foreground">
          <span className="numeric font-medium text-foreground-strong">{total}</span> مستخدم
          {hasFilters && ' مطابق للفلترة'}
        </p>
      </div>

      <Card variant="primary">
        <CardContent className="p-0 min-w-0">
          {users.length === 0 ? (
            <EmptyState
              icon={<UsersIcon />}
              title={hasFilters ? 'لا توجد نتائج' : 'لا يوجد مستخدمون'}
              description={hasFilters ? 'لم نجد مستخدمين مطابقين للفلترة الحالية.' : 'لم يتم تسجيل أي مستخدمين بعد.'}
              compact
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right min-w-[720px]">
                <thead className="text-[12px] text-muted-foreground bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3.5 font-medium">المستخدم</th>
                    <th className="px-4 py-3.5 font-medium">الدور</th>
                    <th className="px-4 py-3.5 font-medium hidden md:table-cell">المراحل التعليمية</th>
                    <th className="px-4 py-3.5 font-medium hidden md:table-cell">المدرسة</th>
                    <th className="px-4 py-3.5 font-medium hidden lg:table-cell">الفرع</th>
                    <th className="px-4 py-3.5 font-medium">الحالة</th>
                    <th className="px-4 py-3.5 font-medium hidden lg:table-cell">آخر نشاط</th>
                    <th className="px-4 py-3.5 font-medium text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((u) => {
                    const roleCfg = roleConfig[u.role] ?? { label: u.role, variant: 'neutral' as const }
                    const lastActivity = u.activities[0]?.createdAt
                    return (
                      <tr key={u.id} className="hover:bg-surface-muted transition-smooth">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={u.name} size="sm" />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground-strong truncate">{u.name}</p>
                              <p className="text-[12px] text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <Badge variant={roleCfg.variant}>{roleCfg.label}</Badge>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          {/* (هذه المهمة) المراحل المعينة للحساب — والحساب بلا مراحل
                              من الأدوار القابلة للتعيين يظهر بوضوح «يحتاج إلى تهيئة» */}
                          {(u.stages?.length ?? 0) > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.stages!.map(s => (
                                <Badge key={s} variant="info">{getStageLabel(s)}</Badge>
                              ))}
                            </div>
                          ) : u.role === "QUALITY_ASSESSOR" || u.role === "BRANCH_MANAGER" ? (
                            <Badge variant="amber">يحتاج إلى تهيئة</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          {u.school ? (
                            <Link href={`/schools/${u.school.id}`} className="text-secondary hover:underline transition-smooth truncate">
                              {u.school.name}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell text-muted-foreground">
                          {u.branch?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={u.status} />
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell text-[13px] text-muted-foreground">
                          {lastActivity ? formatRelativeTime(lastActivity) : 'لا يوجد'}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon-sm" aria-label="عرض">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <EditUserModal user={u} currentUserRole={user.role} />
                            <UserDeleteButton userId={u.id} userName={u.name} />
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between min-w-0">
          <p className="text-[13px] text-muted-foreground">
            صفحة <span className="numeric font-medium text-foreground-strong">{page}</span> من{' '}
            <span className="numeric font-medium text-foreground-strong">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildPageUrl(page - 1)}>
                <Button variant="outline" size="md" icon={<ChevronRight className="w-4 h-4" />}>
                  السابق
                </Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildPageUrl(page + 1)}>
                <Button variant="outline" size="md" iconPosition="end" icon={<ChevronLeft className="w-4 h-4" />}>
                  التالي
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}