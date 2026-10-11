import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Avatar } from "@/components/ui/Avatar"
import {
  Activity as ActivityIcon, Building2, ClipboardList, FileText,
  CreditCard, UserPlus, Upload, AlertTriangle, FileCheck, Settings
} from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

const entityIcon: Record<string, any> = {
  SCHOOL: Building2, ASSESSMENT: ClipboardList, REPORT: FileText,
  SUBSCRIPTION: CreditCard, USER: UserPlus, BRANCH: Building2,
  EVIDENCE: Upload, GAP: AlertTriangle, IMPROVEMENT_PLAN: FileCheck, SETTINGS: Settings,
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
  return `${actionMap[entry.action] || entry.action} ${entityMap[entry.entityType] || entry.entityType}`
}

export default async function ActivityPage() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  const activities = await prisma.activity.findMany({
    where: { schoolId: user.schoolId },
    take: 30,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } }, branch: { select: { name: true } } },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="سجل النشاطات"
        description="آخر العمليات على بيانات المدرسة"
        breadcrumbs={[{ label: "الرئيسية", href: "/school-manager" }, { label: "النشاطات" }]}
      />

      <Card variant="primary">
        <CardContent className="p-0">
          {activities.length === 0 ? (
            <EmptyState icon={<ActivityIcon />} title="لا توجد نشاطات" description="ستظهر النشاطات هنا بمجرد استخدام المنصة." compact />
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
                    <div className="flex-1 pt-1.5">
                      <p className="text-sm text-foreground-strong">{describeActivity(entry)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {entry.actor?.name && (
                          <span className="text-[12px] text-muted-foreground flex items-center gap-1">
                            <Avatar name={entry.actor.name} size="sm" className="w-5 h-5 text-[10px]" />
                            {entry.actor.name}
                          </span>
                        )}
                        {entry.branch?.name && (
                          <>
                            <span className="text-[12px] text-muted-foreground/40">•</span>
                            <span className="text-[12px] text-muted-foreground truncate">{entry.branch.name}</span>
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
    </div>
  )
}