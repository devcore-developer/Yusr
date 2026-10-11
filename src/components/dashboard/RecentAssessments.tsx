import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { ClipboardCheck, ArrowLeft } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface RecentAssessmentsProps {
  assessments: any[]
}

export function RecentAssessments({ assessments }: RecentAssessmentsProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle icon={<ClipboardCheck className="w-5 h-5" />}>أحدث التقييمات</CardTitle>
          <CardDescription>آخر التقييمات الجارية أو المكتملة</CardDescription>
        </div>
        <Link href="/quality-assessor">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} iconPosition="end">
            عرض الكل
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {assessments.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">لا توجد تقييمات حديثة.</div>
        ) : (
          <div className="divide-y divide-border">
            {assessments.map((a) => (
              <div key={a.id} className="p-4 hover:bg-surface-muted/50 transition-smooth">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground-strong truncate">{a.school?.name || "مدرسة غير محددة"}</p>
                    <p className="text-[12px] text-muted-foreground truncate">
                      {a.branch?.name || "كامل المدرسة"} • {a.assessor?.name || "غير محدد"}
                    </p>
                  </div>
                  <Badge variant={a.status === "COMPLETED" ? "success" : "warning"} dot>
                    {a.status === "COMPLETED" ? "مكتمل" : "جاري"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Progress 
                    value={a.progress} 
                    size="sm" 
                    className="flex-1 h-1.5" 
                    tone={a.progress === 100 ? "success" : "default"} 
                  />
                  <span className="text-[11px] font-medium text-muted-foreground numeric w-10 text-left">
                    {a.progress}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}