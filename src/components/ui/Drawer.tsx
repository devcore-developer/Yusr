"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  side?: "right" | "left"
  children: React.ReactNode
  width?: string
}

export function Drawer({ isOpen, onClose, title, description, side = "right", children, width = "320px" }: DrawerProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative h-full bg-surface shadow-xl flex flex-col",
          side === "right" ? "mr-auto" : "ml-auto"
        )}
        style={{ width }}
      >
        {(title || description) && (
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div>
              {title && <h2 className="text-base font-semibold text-foreground-strong">{title}</h2>}
              {description && <p className="text-[13px] text-muted-foreground mt-1">{description}</p>}
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-surface-muted transition-smooth">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">{children}</div>
      </div>
    </div>
  )
}