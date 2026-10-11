"use client"
import * as React from "react"
import { Breadcrumb, Crumb } from "@/components/ui/Breadcrumb"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumbs?: Crumb[]
  context?: React.ReactNode  // last-updated / context info
  className?: string
}

export function PageHeader({ title, description, actions, breadcrumbs, context, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 lg:mb-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="mb-3">
          <Breadcrumb items={breadcrumbs} />
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <h1 className="text-page-title text-foreground-strong tracking-tight">{title}</h1>
          {description && (
            <p className="text-[15px] text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
        {(actions || context) && (
          <div className="flex flex-col md:items-end gap-2 shrink-0">
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            {context && <div className="text-[13px] text-muted-foreground">{context}</div>}
          </div>
        )}
      </div>
    </div>
  )
}