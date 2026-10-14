"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { MoreVertical } from "lucide-react"

interface DropdownMenuItem {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  href?: string
  danger?: boolean
  divider?: boolean
}

interface DropdownMenuProps {
  items: DropdownMenuItem[]
  trigger?: React.ReactNode
  align?: "start" | "end"
  className?: string
}

export function DropdownMenu({ items, trigger, align = "end", className }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className={cn("relative inline-block min-w-0", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-md hover:bg-surface-muted text-muted-foreground transition-smooth"
        aria-label="إجراءات"
      >
        {trigger ?? <MoreVertical className="w-4 h-4" />}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-[160px] max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-lg shadow-lg py-1 max-h-[60vh] overflow-y-auto",
            align === "end" ? "left-0" : "right-0"
          )}
        >
          {items.map((item, i) => (
            <React.Fragment key={i}>
              {item.divider && <div className="h-px bg-border my-1" />}
              {item.href ? (
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm transition-smooth hover:bg-surface-muted whitespace-normal break-words",
                    item.danger ? "text-danger" : "text-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </a>
              ) : (
                <button
                  onClick={() => { item.onClick?.(); setOpen(false) }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm transition-smooth hover:bg-surface-muted text-right whitespace-normal break-words",
                    item.danger ? "text-danger" : "text-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}