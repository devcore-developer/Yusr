import { mockActivities } from "@/data/mock-schools"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { FileCheck, PlusCircle, FileText, CreditCard, UserPlus, Building2, Upload } from "lucide-react"

export function ActivityList() {
  const iconMap = {
    NEW_SCHOOL: PlusCircle,
    ASSESSMENT_COMPLETED: FileCheck,
    REPORT_GENERATED: FileText,
    SUBSCRIPTION_RENEWED: CreditCard,
    USER_ADDED: UserPlus,
    BRANCH_CREATED: Building2,
    EVIDENCE_UPLOADED: Upload
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>النشاطات الأخيرة</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {mockActivities.map((activity) => {
            const Icon = iconMap[activity.type]
            const date = new Date(activity.timestamp)
            
            return (
              <li key={activity.id} className="flex items-start gap-4 p-4 hover:bg-surface-muted transition-colors">
                <div className="p-2 bg-surface-muted rounded-md mt-0.5">
                  <Icon className="w-4 h-4 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{activity.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}