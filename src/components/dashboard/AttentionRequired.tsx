import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { AlertTriangle, AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

export interface AlertItem {
  id: string
  type: 'EXPIRING_SUBSCRIPTION' | 'DELAYED_PLAN' | 'SUSPENDED_SCHOOL' | 'HIGH_GAP'
  severity: 'warning' | 'danger'
  message: string
  context: string
  href: string
}

interface AttentionRequiredProps {
  alerts: AlertItem[]
}

export function AttentionRequired({ alerts }: AttentionRequiredProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle icon={<AlertCircle className="w-5 h-5" />}>يتطلب انتباهك</CardTitle>
        <CardDescription>تنبيهات هامة تتدخل إدارية</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {alerts.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success">
              ✓
            </div>
            لا توجد تنبيهات حرجة حالياً.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((alert) => (
              <li key={alert.id}>
                <Link href={alert.href} className="flex items-start gap-3 p-4 hover:bg-surface-muted/50 transition-smooth">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    alert.severity === 'danger' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'
                  }`}>
                    {alert.severity === 'danger' ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground-strong">{alert.message}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{alert.context}</p>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}