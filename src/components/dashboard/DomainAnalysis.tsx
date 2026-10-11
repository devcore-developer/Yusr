import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { Layers } from "lucide-react"

export interface DomainStat {
  id: string
  name: string
  present: number
  notPresent: number
  notApplicable: number
  total: number
  score: number
  completionPercentage?: number
}

interface DomainAnalysisProps {
  domains: DomainStat[]
}

export function DomainAnalysis({ domains }: DomainAnalysisProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle icon={<Layers className="w-5 h-5" />}>تحليل مجالات الجودة</CardTitle>
        <CardDescription>نسبة تحقق الشواهد في كل مجال</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <div className="divide-y divide-border">
          {domains.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">لا توجد بيانات كافية لعرض التحليل.</div>
          ) : (
            domains.map((d) => {
              const score = d.score || 0
              const remaining = d.total - d.present
              
              return (
                <div key={d.id} className="p-4 hover:bg-surface-muted/30 transition-smooth">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <p className="text-sm font-medium text-foreground-strong truncate">{d.name}</p>
                    <Badge variant={score >= 90 ? "success" : score >= 75 ? "info" : "warning"} className="numeric shrink-0">
                      {score}%
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-1">
                    <Progress value={score} size="sm" className="h-2 flex-1" tone={score === 100 ? "success" : "default"} />
                  </div>
                  
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground numeric mt-1.5">
                    <span>متحقق: {d.present}</span>
                    <span>متبقي: {remaining}</span>
                    <span>الإجمالي: {d.total}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}