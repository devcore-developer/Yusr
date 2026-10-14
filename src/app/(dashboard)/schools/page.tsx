import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge, StatusBadge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { EmptyState } from "@/components/ui/EmptyState"
import {
  School as SchoolIcon, Search, Plus, MapPin, Building2, Users,
  ChevronRight, FilterX, Eye
} from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"
import { SchoolDeleteButton } from "@/components/admin/SchoolDeleteButton"

export const metadata = { title: "المدارس" }

export default async function SchoolsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  await requireRole(["SUPER_ADMIN"])

  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined
  const status = typeof searchParams.status === 'string' ? searchParams.status : undefined
  const page = parseInt(typeof searchParams.page === 'string' ? searchParams.page : '1') || 1
  const pageSize = 10

  const where: Record<string, unknown> = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (status) where.status = status

  const [schools, total] = await Promise.all([
    prisma.school.findMany({
      where,
      include: { _count: { select: { branches: true, users: true } }, subscriptions: { take: 1, orderBy: { createdAt: 'desc' } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.school.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = !!(q || status)

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    params.set('page', String(p))
    return `/schools?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="المدارس"
        description="إدارة جميع المدارس المسجلة على المنصة، فروعها، ومستخدميها."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'المدارس' }]}
        actions={
          <Link href="/schools/add">
            <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
              إضافة مدرسة
            </Button>
          </Link>
        }
      />

      <form className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-border rounded-lg min-w-0">
        <div className="relative flex-1 min-w-[200px] min-w-0">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input name="q" defaultValue={q} placeholder="ابحث باسم المدرسة أو الموقع..." className="pr-10 w-full" />
        </div>
        <Select name="status" defaultValue={status}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[120px]">
            <SelectValue placeholder="كل الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">نشط</SelectItem>
            <SelectItem value="SUSPENDED">موقوف</SelectItem>
            <SelectItem value="EXPIRED">منتهي</SelectItem>
            <SelectItem value="PENDING">قيد الانتظار</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="primary" size="md" icon={<Search className="w-4 h-4" />}>تصفية</Button>
        {hasFilters && (
          <Link href="/schools">
            <Button type="button" variant="ghost" size="md" icon={<FilterX className="w-4 h-4" />}>إلغاء</Button>
          </Link>
        )}
      </form>

      <p className="text-[13px] text-muted-foreground min-w-0">
        <span className="numeric font-medium text-foreground-strong">{total}</span> مدرسة
        {hasFilters && ' مطابقة للفلترة'}
      </p>

      <Card variant="primary">
        <CardContent className="p-0 min-w-0">
          {schools.length === 0 ? (
            <EmptyState
              icon={<SchoolIcon />}
              title={hasFilters ? 'لا توجد نتائج' : 'لا توجد مدارس'}
              description={hasFilters ? 'لم نجد مدارس مطابقة للفلترة.' : 'لم يتم تسجيل أي مدرسة بعد.'}
              compact
              action={hasFilters ? undefined : { label: 'إضافة مدرسة', href: '/schools/add' }}
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm text-right min-w-[600px]">
                <thead className="text-[12px] text-muted-foreground bg-surface-muted uppercase">
                  <tr>
                    <th className="px-4 py-3.5 font-medium">المدرسة</th>
                    <th className="px-4 py-3.5 font-medium">الحالة</th>
                    <th className="px-4 py-3.5 font-medium hidden md:table-cell">الفروع</th>
                    <th className="px-4 py-3.5 font-medium hidden md:table-cell">المستخدمون</th>
                    <th className="px-4 py-3.5 font-medium hidden lg:table-cell">الباقة</th>
                    <th className="px-4 py-3.5 font-medium hidden lg:table-cell">تاريخ التسجيل</th>
                    <th className="px-4 py-3.5 font-medium text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {schools.map((school) => {
                    const sub = school.subscriptions[0]
                    return (
                      <tr key={school.id} className="hover:bg-surface-muted/50 transition-smooth">
                        <td className="px-4 py-3.5">
                          <Link href={`/schools/${school.id}`} className="flex items-center gap-3 group">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                              {school.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground-strong truncate group-hover:text-secondary transition-smooth">{school.name}</p>
                              <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {school.location}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={school.status} /></td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Building2 className="w-3.5 h-3.5" />
                            <span className="numeric">{school._count.branches}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span className="numeric">{school._count.users}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          {sub ? (
                            <Badge variant={sub.plan === 'Enterprise' ? 'violet' : sub.plan === 'Pro' ? 'info' : 'neutral'}>
                              {sub.plan === 'Enterprise' ? 'مؤسسات' : sub.plan === 'Pro' ? 'احترافية' : 'أساسية'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[12px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell text-muted-foreground numeric">{formatDate(school.createdAt.toISOString())}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1 justify-end">
                            <Link href={`/schools/${school.id}`}>
                              <Button variant="ghost" size="icon-sm" aria-label="عرض" icon={<Eye className="w-4 h-4" />} />
                            </Link>
                            <SchoolDeleteButton schoolId={school.id} schoolName={school.name} />
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
                <Button variant="outline" size="md">السابق</Button>
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildPageUrl(page + 1)}>
                <Button variant="outline" size="md" iconPosition="end" icon={<ChevronRight className="w-4 h-4" />}>التالي</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}