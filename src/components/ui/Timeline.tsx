import * as React from "react"
import { cn } from "@/lib/utils"

interface TimelineItem {
  id: string
  icon?: React.ReactNode
  title: React.ReactNode
  metadata?: React.ReactNode
  timestamp?: React.ReactNode
}

interface TimelineProps {
  items: TimelineItem[]
  className?: string
}

export function Timeline({ items, className }: TimelineProps) {
  if (items.length === 0) return null
  return (
    <ol className={cn("relative space-y-4", className)}>
      <div className="absolute right-[18px] top-2 bottom-2 w-px bg-border" />
      {items.map((item) => (
        <li key={item.id} className="relative flex items-start gap-3">
          <div className="relative z-10 w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-secondary">
            {item.icon ?? <span className="w-2 h-2 rounded-full bg-secondary" />}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-sm text-foreground-strong">{item.title}</p>
            {item.metadata && (
              <div className="flex flex-wrap items-center gap-2 mt-1">{item.metadata}</div>
            )}
            {item.timestamp && (
              <span className="text-[12px] text-muted-foreground block mt-1">{item.timestamp}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}