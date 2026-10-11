import * as React from "react"
import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function SectionHeader({ title, description, action, icon, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 mb-4", className)}>
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-muted-foreground [&>svg]:w-5 [&>svg]:h-5 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-section text-foreground-strong truncate">{title}</h2>
          {description && <p className="text-[13px] text-muted-foreground mt-0.5 truncate">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}