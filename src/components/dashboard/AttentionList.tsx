import { mockAlerts } from "@/data/mock-schools"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { AlertTriangle, AlertCircle } from "lucide-react"

export function AttentionList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>يتطلب انتباهاً</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {mockAlerts.map((alert) => (
            <li key={alert.id} className="flex items-center gap-4 p-4 hover:bg-surface-muted transition-colors">
              {alert.severity === 'DANGER' ? (
                <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{alert.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.schoolName}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}