import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Avatar } from "@/components/ui/Avatar"
import {
  Activity as ActivityIcon, Search, Building2, ClipboardList, FileText,
  CreditCard, UserPlus, Upload, AlertTriangle, FileCheck, Settings, FilterX
} from "lucide-react"
import Link from "next/link"
import { formatRelativeTime, formatDate } from "@/lib/utils"

export const metadata = { title: "النشاطات" }

const entityIcon: Record<string, any> = {
  SCHOOL: Building2,
  ASSESSMENT: ClipboardList,
  REPORT: FileText,
  SUBSCRIPTION: CreditCard,
  USER: UserPlus,
  BRANCH: Building2,
  EVIDENCE: Upload,
  GAP: AlertTriangle,
  IMPROVEMENT_PLAN: FileCheck,
  SETTINGS: Settings,
}

function describeActivity(entry: any): string {
  if (entry.metadata?.description) return entry.metadata.description
  const entityMap: Record<string, string> = {
    SCHOOL: 'مدرسة', ASSESSMENT: 'تقييم', REPORT: 'تقرير', SUBSCRIPTION: 'اشتراك',
    USER: 'مستخدم', BRANCH: 'فرع', EVIDENCE: 'دليل', GAP: 'فجوة',
    IMPROVEMENT_PLAN: 'خطة تحسين', SETTINGS: 'إعدادات',
  }
  const actionMap: Record<string, string> = {
    CREATE: 'تم إنشاء', UPDATE: 'تم تحديث', DELETE: 'تم حذف',
    COMPLETE: 'تم إكمال', ACTIVATE: 'تم تفعيل', SUSPEND: 'تم تعليق',
  }
  const entity = entityMap[entry.entityType] || entry.entityType
  const action = actionMap[entry.action] || entry.action
  return `${action} ${entity}`
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  await requireRole(["SUPER_ADMIN"])

  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined
  const entityType = typeof searchParams.entityType === 'string' ? searchParams.entityType : undefined
  const page = parseInt(typeof searchParams.page === 'string' ? searchParams.page : '1') || 1
  const pageSize = 20

  const where: Record<string, unknown> = {}
  if (q) {
    where.OR = [
      { action: { contains: q, mode: 'insensitive' } },
      { actor: { name: { contains: q, mode: 'insensitive' } } },
    ]
  }
  if (entityType) where.entityType = entityType

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } }, school: { select: { name: true } }, branch: { select: { name: true } } },
    }),
    prisma.activity.count({ where }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const hasFilters = !!(q || entityType)

  const buildPageUrl = (p: number) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (entityType) params.set('entityType', entityType)
    params.set('page', String(p))
    return `/activity?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="سجل النشاطات"
        description="تتبّع جميع العمليات على المنصة — إنشاء، تعديل، حذف، وإكمال."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'النشاطات' }]}
      />

      {/* Filter bar */}
      <form className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-border rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input name="q" defaultValue={q} placeholder="ابحث في النشاطات..." className="pr-10" />
        </div>
        <Select name="entityType" defaultValue={entityType} className="w-auto min-w-[140px]">
          <option value="">كل الأنواع</option>
          <option value="SCHOOL">مدارس</option>
          <option value="ASSESSMENT">تقييمات</option>
          <option value="USER">مستخدمون</option>
          <option value="BRANCH">فروع</option>
          <option value="SUBSCRIPTION">اشتراكات</option>
          <option value="GAP">فجوات</option>
          <option value="IMPROVEMENT_PLAN">خطط تحسين</option>
        </Select>
        <Button type="submit" variant="primary" size="md" icon={<Search className="w-4 h-4" />}>تصفية</Button>
        {hasFilters && (
          <Link href="/activity">
            <Button type="button" variant="ghost" size="md" icon={<FilterX className="w-4 h-4" />}>إلغاء</Button>
          </Link>
        )}
      </form>

      <p className="text-[13px] text-muted-foreground">
        <span className="numeric font-medium text-foreground-strong">{total}</span> نشاط
        {hasFilters && ' مطابق للفلترة'}
      </p>

      {/* Activity timeline */}
      <Card variant="primary">
        <CardContent className="p-0">
          {activities.length === 0 ? (
            <EmptyState
              icon={<ActivityIcon />}
              title={hasFilters ? 'لا توجد نتائج' : 'لا توجد نشاطات'}
              description={hasFilters ? 'لم نجد نشاطات مطابقة للفلترة.' : 'لم يتم تسجيل أي نشاط بعد.'}
              compact
            />
          ) : (
            <ol className="relative p-4 lg:p-6 space-y-5">
              <div className="absolute right-[34px] top-4 bottom-4 w-px bg-border" />
              {activities.map((entry) => {
                const Icon = entityIcon[entry.entityType?.toUpperCase()] || ActivityIcon
                return (
                  <li key={entry.id} className="relative flex items-start gap-3">
                    <div className="relative z-10 w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0 pt-1.5">
                      <p className="text-sm text-foreground-strong">{describeActivity(entry)}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {entry.actor?.name && (
                          <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                            <Avatar name={entry.actor.name} size="sm" className="w-5 h-5 text-[10px]" />
                            {entry.actor.name}
                          </span>
                        )}
                        {entry.school?.name && (
                          <>
                            <span className="text-[12px] text-muted-foreground/40">•</span>
                            <span className="text-[12px] text-muted-foreground truncate">{entry.school.name}</span>
                          </>
                        )}
                        <span className="text-[12px] text-muted-foreground/40">•</span>
                        <span className="text-[12px] text-muted-foreground whitespace-nowrap">{formatRelativeTime(entry.createdAt)}</span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
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
                <Button variant="outline" size="md">التالي</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}