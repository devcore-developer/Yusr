import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { DonutChart } from "./DonutChart"
import { BarChart3 } from "lucide-react"

interface ResponseAnalysisProps {
  present: number
  notPresent: number
  notApplicable: number
}

export function ResponseAnalysis({ present, notPresent, notApplicable }: ResponseAnalysisProps) {
  const total = present + notPresent + notApplicable

  const segments = [
    { label: "متحققة", value: present, color: "hsl(var(--success))" },
    { label: "غير متحققة", value: notPresent, color: "hsl(var(--danger))" },
    { label: "لا ينطبق", value: notApplicable, color: "hsl(var(--muted-foreground))" }
  ]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle icon={<BarChart3 className="w-5 h-5" />}>تحليل الاستجابات</CardTitle>
        <CardDescription>توزيع إجمالي الشواهد</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 p-6">
        {/* Chart Container - Controlled Width */}
        <div className="w-full md:w-1/2 flex justify-center shrink-0">
          <DonutChart 
            centerValue={total} 
            centerLabel="إجمالي" 
            segments={segments} 
          />
        </div>
        
        {/* Legend & Stats - Separate Column */}
        <div className="w-full md:w-1/2 space-y-3">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center justify-between p-2 rounded-md hover:bg-surface-muted/50 transition-smooth">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }}></span>
                <span className="text-sm text-foreground-strong">{seg.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground-strong numeric">{seg.value}</span>
                <span className="text-[11px] text-muted-foreground numeric w-10 text-left">
                  {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}