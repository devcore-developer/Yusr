import * as React from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Crumb {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: Crumb[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" className={cn("flex items-center gap-1 text-[13px]", className)}>
      {items.map((crumb, i) => {
        const isLast = i === items.length - 1
        if (isLast || !crumb.href) {
          return (
            <span key={i} className={cn(isLast ? "text-foreground font-medium" : "text-muted-foreground")}>
              {crumb.label}
            </span>
          )
        }
        return (
          <React.Fragment key={i}>
            <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-smooth">
              {crumb.label}
            </Link>
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground/60" />
          </React.Fragment>
        )
      })}
    </nav>
  )
}