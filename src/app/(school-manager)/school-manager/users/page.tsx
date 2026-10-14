import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Badge, StatusBadge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { EmptyState } from "@/components/ui/EmptyState"
import { ChevronLeft, ChevronRight, Search, Users as UsersIcon, Eye } from "lucide-react"
import Link from "next/link"
import { formatRelativeTime } from "@/lib/utils"
import { AddUserModal } from "@/components/admin/AddUserModal"

export const metadata = { title: "المستخدمون" }

const roleConfig: Record<string, { label: string; variant: 'danger' | 'info' | 'violet' | 'amber' | 'neutral' }> = {
  SUPER_ADMIN: { label: 'مدير النظام', variant: 'danger' },
  SCHOOL_MANAGER: { label: 'مدير مدرسة', variant: 'info' },
  BRANCH_MANAGER: { label: 'مدير فرع', variant: 'violet' },
  QUALITY_ASSESSOR: { label: 'مشرف', variant: 'amber' },
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  let branches: any[] = []
  const where: Record<string, unknown> = {}

  if (user.role === "SCHOOL_MANAGER" && user.schoolId) {
    branches = await prisma.branch.findMany({ where: { schoolId: user.schoolId }, select: { id: true, name: true } })
    where.schoolId = user.schoolId
  } else if (user.role === "BRANCH_MANAGER" && user.branchId) {
    branches = await prisma.branch.findMany({ where: { id: user.branchId }, select: { id: true, name: true } })
    where.branchId = user.branchId
  } else {
    redirect("/login")
  }

  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined
  const role = typeof searchParams.role === 'string' ? searchParams.role : undefined
  const status = typeof searchParams.status === 'string' ? searchParams.status : undefined
  const page = parseInt(typeof searchParams.page === 'string' ? searchParams.page : '1') || 1
  const pageSize = 10

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
        id: true, name: true, email: true, role: true, status: true, createdAt: true,
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
    return `/school-manager/users?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمون"
        description="إدارة مستخدمي مدرستك."
        breadcrumbs={[{ label: 'الرئيسية', href: '/school-manager' }, { label: 'المستخدمون' }]}
        actions={<AddUserModal userRole={user.role} branches={branches} />}
      />

      <form className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-border rounded-lg min-w-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input name="q" defaultValue={q} placeholder="ابحث بالاسم أو البريد..." className="pr-10" />
        </div>
        <Select name="role" defaultValue={role}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px]">
            <SelectValue placeholder="كل الأدوار" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SCHOOL_MANAGER">مدير مدرسة</SelectItem>
            <SelectItem value="BRANCH_MANAGER">مدير فرع</SelectItem>
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
        <Button type="submit" variant="primary" size="md" icon={<Search className="w-4 h-4" />}>تصفية</Button>
      </form>

      <Card variant="primary">
        <CardContent className="p-0 min-w-0">
          {users.length === 0 ? (
            <EmptyState icon={<UsersIcon />} title="لا يوجد مستخدمون" description="لم يتم تسجيل أي مستخدمين بعد." compact />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right min-w-[600px]">
                <thead className="text-[12px] text-muted-foreground bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3.5 font-medium">المستخدم</th>
                    <th className="px-4 py-3.5 font-medium">الدور</th>
                    <th className="px-4 py-3.5 font-medium hidden md:table-cell">الفرع</th>
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
                        <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground">
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
                <Button variant="outline" size="md" icon={<ChevronRight className="w-4 h-4" />}>السابق</Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildPageUrl(page + 1)}>
                <Button variant="outline" size="md" iconPosition="end" icon={<ChevronLeft className="w-4 h-4" />}>التالي</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}