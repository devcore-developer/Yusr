"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabItem {
  value: string
  label: string
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
}

export function Tabs({ items, value, onChange }: TabsProps) {
  return (
    <div className="border-b border-border">
      <nav className="flex gap-4 overflow-x-auto scrollbar-thin">
        {items.map((item) => (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              "py-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              value === item.value
                ? "border-secondary text-secondary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}