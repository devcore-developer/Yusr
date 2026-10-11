import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  indicatorClassName?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const toneStyles = {
  default: 'bg-secondary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
  info:    'bg-info',
}

const sizeStyles = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-2.5',
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, max = 100, indicatorClassName, tone = 'default', showValue, size = 'md', label, ...props }, ref) => {
    const pct = Math.min(100, Math.max(0, (value / max) * 100))
    return (
      <div className={cn("w-full", className)} ref={ref} {...props}>
        {(showValue || label) && (
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13px] font-medium text-foreground">{label}</span>
            {showValue && (
              <span className="text-[13px] font-semibold text-foreground-strong numeric">
                {Math.round(pct)}%
              </span>
            )}
          </div>
        )}
        <div className={cn("w-full rounded-full bg-surface-muted overflow-hidden", sizeStyles[size])}>
          <div
            className={cn("h-full transition-all duration-500 ease-smooth rounded-full", toneStyles[tone], indicatorClassName)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }