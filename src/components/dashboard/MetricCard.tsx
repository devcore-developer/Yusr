import { ArrowUpRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/Card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  iconBg?: string
  trend?: string
  className?: string
}

export function MetricCard({ title, value, icon, iconBg = "bg-secondary/10 text-secondary", trend, className }: MetricCardProps) {
  return (
    <Card className={cn("shadow-card-hover", className)}>
      <CardContent className="p-6 flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <span className="text-3xl font-bold text-foreground mt-2">{value}</span>
          {trend && (
            <div className="flex items-center gap-1 text-xs text-success mt-2">
              <ArrowUpRight className="w-3 h-3" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl shadow-sm", iconBg)}>
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}