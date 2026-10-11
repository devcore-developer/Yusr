import * as React from "react"
import { ChartCard } from "./ChartCard"
import { EmptyState } from "@/components/ui/EmptyState"
import {
  Activity as ActivityIcon, PlusCircle, FileCheck, FileText, CreditCard,
  UserPlus, Building2, Upload, ClipboardList, AlertTriangle, Settings
} from "lucide-react"
import Link from "next/link"
import { formatRelativeTime } from "@/lib/utils"

interface ActivityEntry {
  id: string
  action: string
  entityType: string
  entityId: string
  createdAt: Date | string
  actor?: { name?: string | null } | null
  school?: { name?: string | null } | null
  metadata?: any
}

const entityIcon: Record<string, React.ComponentType<{ className?: string }>> = {
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

function getIcon(entityType: string) {
  return entityIcon[entityType.toUpperCase()] ?? PlusCircle
}

function describeActivity(entry: ActivityEntry): string {
  if (entry.metadata?.description) return entry.metadata.description
  // Build from action + entityType
  const entity = entry.entityType === 'SCHOOL' ? 'مدرسة'
    : entry.entityType === 'ASSESSMENT' ? 'تقييم'
    : entry.entityType === 'REPORT' ? 'تقرير'
    : entry.entityType === 'SUBSCRIPTION' ? 'اشتراك'
    : entry.entityType === 'USER' ? 'مستخدم'
    : entry.entityType === 'BRANCH' ? 'فرع'
    : entry.entityType === 'EVIDENCE' ? 'دليل'
    : entry.entityType === 'GAP' ? 'فجوة'
    : entry.entityType === 'IMPROVEMENT_PLAN' ? 'خطة تحسين'
    : 'عنصر'

  const action = entry.action === 'CREATE' ? 'تم إنشاء'
    : entry.action === 'UPDATE' ? 'تم تحديث'
    : entry.action === 'DELETE' ? 'تم حذف'
    : entry.action === 'COMPLETE' ? 'تم إكمال'
    : entry.action

  return `${action} ${entity}`
}

interface RecentActivityProps {
  activities: ActivityEntry[]
}

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <ChartCard
      title="النشاطات الأخيرة"
      icon={<ActivityIcon />}
      action={
        activities.length > 0 ? (
          <Link href="/activity" className="text-[13px] font-medium text-secondary hover:text-secondary-600 flex items-center gap-1 transition-smooth">
            عرض الكل
          </Link>
        ) : undefined
      }
    >
      {activities.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon />}
          title="لا توجد نشاطات"
          description="ستظهر النشاطات الأخيرة هنا بمجرد بدء استخدام المنصة."
          compact
        />
      ) : (
        <ol className="relative space-y-4 -mx-1">
          {/* Timeline line */}
          <div className="absolute right-[18px] top-2 bottom-2 w-px bg-border" />

          {activities.slice(0, 8).map((entry) => {
            const Icon = getIcon(entry.entityType)
            return (
              <li key={entry.id} className="relative flex items-start gap-3 pr-1">
                <div className="relative z-10 w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-secondary" />
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-sm text-foreground-strong">{describeActivity(entry)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {entry.actor?.name && (
                      <span className="text-[12px] text-muted-foreground">{entry.actor.name}</span>
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
    </ChartCard>
  )
}