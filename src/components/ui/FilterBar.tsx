import * as React from "react"
import { Button } from "./Button"
import { Search, FilterX } from "lucide-react"
import Link from "next/link"

interface FilterBarProps {
  children: React.ReactNode
  hasFilters: boolean
  resetHref: string
  className?: string
}

export function FilterBar({ children, hasFilters, resetHref, className }: FilterBarProps) {
  return (
    <form className={`flex flex-wrap items-center gap-3 p-4 bg-surface border border-border rounded-lg ${className ?? ""}`}>
      {children}
      <Button type="submit" variant="primary" size="md" icon={<Search className="w-4 h-4" />}>تصفية</Button>
      {hasFilters && (
        <Link href={resetHref}>
          <Button type="button" variant="ghost" size="md" icon={<FilterX className="w-4 h-4" />}>إلغاء</Button>
        </Link>
      )}
    </form>
  )
}

/** Search input for FilterBar */
export function FilterSearch({ defaultValue, placeholder }: { defaultValue?: string; placeholder?: string }) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder ?? "ابحث..."}
        className="flex h-10 w-full rounded-md border border-border bg-surface-muted px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary/50 focus:bg-surface transition-smooth"
      />
    </div>
  )
}