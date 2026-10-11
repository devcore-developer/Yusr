import * as React from "react"
import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shape?: 'rect' | 'circle' | 'text'
  lines?: number
}

function Skeleton({ className, shape = 'rect', lines, style, ...props }: SkeletonProps) {
  if (shape === 'text' || lines) {
    return (
      <div className={cn("space-y-2", className)} {...props}>
        {Array.from({ length: lines ?? 3 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-shimmer h-3 rounded"
            style={{ width: i === (lines ?? 3) - 1 ? '60%' : '100%' }}
          />
        ))}
      </div>
    )
  }
  return (
    <div
      className={cn(
        "skeleton-shimmer",
        shape === 'circle' ? "rounded-full" : "rounded-md",
        className
      )}
      style={style}
      {...props}
    />
  )
}

/* ===== Preset skeletons ===== */

function StatCardSkeleton() {
  return (
    <div className="card-primary p-5 lg:p-6 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton shape="circle" className="w-10 h-10" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="card-primary overflow-hidden">
      <div className="border-b border-border p-4">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><div className="card-primary h-80" /></div>
        <div className="card-primary h-80" />
      </div>
    </div>
  )
}

export { Skeleton, StatCardSkeleton, TableSkeleton, DashboardSkeleton }