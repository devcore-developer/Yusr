import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge, StatusBadge } from "@/components/ui/Badge"
import { Avatar } from "@/components/ui/Avatar"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { EmptyState } from "@/components/ui/EmptyState"
import { Users as UsersIcon, Search, Plus, UserPlus, FilterX, Eye } from "lucide-react"
import Link from "next/link"
import { formatRelativeTime } from "@/lib/utils"

export const metadata = { title: "المستخدمون" }

const roleConfig: Record<string, { label: string; variant: 'info' | 'violet' | 'amber' | 'neutral' }> = {
  SCHOOL_MANAGER: { label: 'مدير مدرسة', variant: 'info' },
  BRANCH_MANAGER: { label: 'مدير فرع', variant: 'violet' },
  QUALITY_ASSESSOR: { label: 'مقيم جودة', variant: 'amber' },
}

export default async function SchoolUsersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined
  const role = typeof searchParams.role === 'string' ? searchParams.role : undefined
  const status = typeof searchParams.status === 'string' ? searchParams.status : undefined

  // تقييد الاستعلام: مدير الفرع يرى مستخدمي فرعه فقط
  const where: Record<string, unknown> = {}
  if (user.role === "BRANCH_MANAGER") {
    where.branchId = user.branchId
  } else {
    where.schoolId = user.schoolId
  }

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
        id: true, name: true, email: true, role: true, status: true,
        branch: { select: { name: true } },
        activities: { take: 1, orderBy: { createdAt: 'desc' }, select: { createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ])

  const hasFilters = !!(q || role || status)
  const isBranchManager = user.role === "BRANCH_MANAGER"

  return (
    <div className="space-y-6">
      <PageHeader
        title="المستخدمون"
        description={isBranchManager ? "إدارة مقيمي الجودة التابعين لفرعك." : "إدارة مستخدمي المدرسة — المديرين والمعلمين والمقيّمين."}
        breadcrumbs={[
          { label: 'الرئيسية', href: '/school-manager' },
          { label: 'المستخدمون' },
        ]}
        actions={
          <Link href="/school-manager/users/add">
            <Button variant="primary" size="md" icon={<UserPlus className="w-4 h-4" />}>
              {isBranchManager ? "إضافة مقيم جودة" : "إضافة مستخدم"}
            </Button>
          </Link>
        }
      />

      {/* Filter bar */}
      <form className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-border rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input name="q" defaultValue={q} placeholder="ابحث بالاسم أو البريد..." className="pr-10" />
        </div>
        <Select name="role" defaultValue={role} className="w-auto min-w-[130px]">
          <option value="">كل الأدوار</option>
          {!isBranchManager && <option value="SCHOOL_MANAGER">مدير مدرسة</option>}
          {!isBranchManager && <option value="BRANCH_MANAGER">مدير فرع</option>}
          <option value="QUALITY_ASSESSOR">مقيم جودة</option>
        </Select>
        <Select name="status" defaultValue={status} className="w-auto min-w-[110px]">
          <option value="">كل الحالات</option>
          <option value="ACTIVE">نشط</option>
          <option value="INVITED">مدعو</option>
          <option value="SUSPENDED">موقوف</option>
        </Select>
        <Button type="submit" variant="primary" size="md" icon={<Search className="w-4 h-4" />}>تصفية</Button>
        {hasFilters && (
          <Link href="/school-manager/users">
            <Button type="button" variant="ghost" size="md" icon={<FilterX className="w-4 h-4" />}>إلغاء</Button>
          </Link>
        )}
      </form>

      <p className="text-[13px] text-muted-foreground">
        <span className="numeric font-medium text-foreground-strong">{total}</span> مستخدم
        {hasFilters && ' مطابق للفلترة'}
      </p>

      {/* Table */}
      <Card variant="primary">
        <CardContent className="p-0">
          {users.length === 0 ? (
            <EmptyState
              icon={<UsersIcon />}
              title={hasFilters ? 'لا توجد نتائج' : 'لا يوجد مستخدمون'}
              description={hasFilters ? 'لم نجد مستخدمين مطابقين.' : 'لم يتم تسجيل أي مستخدم بعد.'}
              compact
              action={!hasFilters ? { 
                label: isBranchManager ? 'إضافة مقيم جودة' : 'إضافة مستخدم', 
                href: '/school-manager/users/add' 
              } : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
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
                        <td className="px-4 py-3.5"><Badge variant={roleCfg.variant}>{roleCfg.label}</Badge></td>
                        <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground">
                          {u.branch?.name ?? 'كامل المدرسة'}
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={u.status} /></td>
                        <td className="px-4 py-3.5 hidden lg:table-cell text-[13px] text-muted-foreground">
                          {lastActivity ? formatRelativeTime(lastActivity) : 'لا يوجد'}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Link href={`/school-manager/users/${u.id}`}>
                              <Button variant="ghost" size="icon-sm" aria-label="عرض" icon={<Eye className="w-4 h-4" />} />
                            </Link>
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