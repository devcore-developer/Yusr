import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/Card"

interface StatCardProps {
  label: string
  value: number | string
  icon: React.ReactNode
  tone: "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "violet" | "amber"
  context?: string
  status?: { label: string; tone: "success" | "warning" | "danger" | "info" }
  progress?: { value: number }
  className?: string
}

const toneStyles: Record<StatCardProps["tone"], { bg: string; text: string }> = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  secondary: { bg: "bg-secondary/10", text: "text-secondary" },
  success: { bg: "bg-success/10", text: "text-success" },
  warning: { bg: "bg-warning/10", text: "text-warning" },
  danger: { bg: "bg-danger/10", text: "text-danger" },
  info: { bg: "bg-info/10", text: "text-info" },
  violet: { bg: "bg-violet/10", text: "text-violet" },
  amber: { bg: "bg-amber/10", text: "text-amber" },
}

export function StatCard({ label, value, icon, tone, context, status, progress, className }: StatCardProps) {
  const styles = toneStyles[tone]
  
  return (
    <Card className={cn("p-5 flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn("w-11 h-11 rounded-lg flex items-center justify-center shrink-0", styles.bg)}>
          <span className={styles.text}>{icon}</span>
        </div>
        {status && (
          <span className={cn(
            "text-[11px] font-medium px-2 py-1 rounded-full",
            status.tone === "success" && "bg-success/10 text-success",
            status.tone === "warning" && "bg-warning/10 text-warning",
            status.tone === "danger" && "bg-danger/10 text-danger",
            status.tone === "info" && "bg-info/10 text-info"
          )}>
            {status.label}
          </span>
        )}
      </div>
      
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground-strong numeric">{value}</p>
        {context && <p className="text-[12px] text-muted-foreground/80 numeric">{context}</p>}
      </div>

      {progress && (
        <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all", styles.text.replace('text', 'bg'))} 
            style={{ width: `${progress.value}%` }} 
          />
        </div>
      )}
    </Card>
  )
}