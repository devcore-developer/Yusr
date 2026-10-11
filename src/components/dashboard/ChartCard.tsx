import * as React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card"

interface ChartCardProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function ChartCard({ title, description, icon, action, className, children }: ChartCardProps) {
  return (
    <Card variant="primary" className={cn("shadow-card-hover flex flex-col", className)}>
      <CardHeader divided className="flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground [&>svg]:w-5 [&>svg]:h-5">{icon}</span>}
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  )
}

import { cn } from "@/lib/utils"