import * as React from "react"
import { cn } from "@/lib/utils"

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet' | 'amber'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  dot?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-success/10 text-success border-success/15",
  warning: "bg-warning/10 text-warning border-warning/15",
  danger:  "bg-danger/10 text-danger border-danger/15",
  info:    "bg-secondary/10 text-secondary border-secondary/15",
  violet:  "bg-violet/10 text-violet border-violet/15",
  amber:   "bg-amber/10 text-amber border-amber/15",
  neutral: "bg-surface-muted text-muted-foreground border-border",
}

const dotColor: Record<BadgeVariant, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger:  "bg-danger",
  info:    "bg-secondary",
  violet:  "bg-violet",
  amber:   "bg-amber",
  neutral: "bg-muted-foreground",
}

function Badge({ className, variant = 'neutral', dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full", dotColor[variant])} />}
      {children}
    </span>
  )
}

/* ===== Preset badges (Brief #48) ===== */

const statusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  ACTIVE:         { label: 'نشط',          variant: 'success' },
  IN_PROGRESS:    { label: 'قيد التنفيذ',  variant: 'info' },
  COMPLETED:      { label: 'مكتمل',         variant: 'success' },
  SUSPENDED:      { label: 'موقوف',         variant: 'danger' },
  EXPIRED:        { label: 'منتهي',         variant: 'warning' },
  EXPIRING_SOON:  { label: 'ينتهي قريبًا',  variant: 'warning' },
  PENDING:        { label: 'قيد الانتظار',  variant: 'neutral' },
  NOT_STARTED:    { label: 'لم يبدأ',       variant: 'neutral' },
  INVITED:        { label: 'مدعو',          variant: 'info' },
  ON_TRACK:       { label: 'على المسار',    variant: 'success' },
  AT_RISK:        { label: 'في خطر',        variant: 'warning' },
  DELAYED:        { label: 'متأخر',         variant: 'danger' },
  DRAFT:          { label: 'مسودة',        variant: 'neutral' },
}

function StatusBadge({ status, ...props }: { status: string } & Omit<BadgeProps, 'variant' | 'children'>) {
  const cfg = statusMap[status] ?? { label: status, variant: 'neutral' as BadgeVariant }
  return <Badge variant={cfg.variant} {...props}>{cfg.label}</Badge>
}

const priorityMap: Record<string, { label: string; variant: BadgeVariant }> = {
  HIGH:   { label: 'عالية',   variant: 'danger' },
  MEDIUM: { label: 'متوسطة', variant: 'warning' },
  LOW:    { label: 'منخفضة', variant: 'info' },
}

function PriorityBadge({ priority, ...props }: { priority: string } & Omit<BadgeProps, 'variant' | 'children'>) {
  const cfg = priorityMap[priority] ?? { label: priority, variant: 'neutral' as BadgeVariant }
  return <Badge variant={cfg.variant} {...props}>{cfg.label}</Badge>
}

export { Badge, StatusBadge, PriorityBadge }