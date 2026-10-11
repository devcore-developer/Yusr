import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "./Button"

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
    icon?: React.ReactNode
  }
  className?: string
  compact?: boolean
}

export function EmptyState({ icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center",
      compact ? "py-8 px-4" : "py-12 lg:py-16 px-6",
      className
    )}>
      {icon && (
        <div className={cn(
          "rounded-full flex items-center justify-center mb-4 bg-surface-muted text-muted-foreground [&>svg]:w-7 [&>svg]:h-7",
          compact ? "w-12 h-12" : "w-16 h-16"
        )}>
          {icon}
        </div>
      )}
      <h3 className={cn("font-semibold text-foreground-strong", compact ? "text-[15px]" : "text-base")}>{title}</h3>
      {description && (
        <p className={cn("text-muted-foreground mt-1.5 max-w-sm", compact ? "text-[13px]" : "text-sm")}>{description}</p>
      )}
      {action && (
        <div className="mt-5">
            {action.href ? (
            <Button variant="primary" size="md" icon={action.icon} href={action.href}>
                {action.label}
            </Button>
            ) : (
            <Button variant="primary" size="md" icon={action.icon} onClick={action.onClick}>
                {action.label}
            </Button>
            )}
        </div>
      )}
    </div>
  )
}