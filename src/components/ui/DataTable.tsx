import * as React from "react"
import { cn } from "@/lib/utils"
import { EmptyState } from "./EmptyState"
import { Skeleton } from "./Skeleton"

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
  hideOn?: "sm" | "md" | "lg"
  align?: "right" | "left" | "center"
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyState?: { icon?: React.ReactNode; title: string; description?: string; action?: { label: string; href: string } }
  loading?: boolean
  loadingRows?: number
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  className?: string
}

const hideClass = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" }
const alignClass = { right: "text-right", left: "text-left", center: "text-center" }

export function DataTable<T>({
  columns, data, emptyState, loading, loadingRows = 5, rowKey, onRowClick, className,
}: DataTableProps<T>) {
  if (loading) {
    return <Skeleton className="h-10 w-full" />
    // Or return the table skeleton
  }

  if (data.length === 0 && emptyState) {
    return (
      <div className="card-primary">
        <EmptyState icon={emptyState.icon} title={emptyState.title} description={emptyState.description} compact action={emptyState.action ? { label: emptyState.action.label, href: emptyState.action.href } : undefined} />
      </div>
    )
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm text-right">
        <thead className="text-[12px] text-muted-foreground bg-surface-muted">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3.5 font-medium",
                  col.hideOn && hideClass[col.hideOn],
                  col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right"
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn("hover:bg-surface-muted transition-smooth", onRowClick && "cursor-pointer")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-4 py-3.5",
                    col.hideOn && hideClass[col.hideOn],
                    col.align === "left" ? "text-left" : col.align === "center" ? "text-center" : "text-right",
                    col.className
                  )}
                >
                  {col.render ? col.render(row) : (row as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}