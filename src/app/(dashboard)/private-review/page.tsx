import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import Link from "next/link"
import { ShieldCheck, Plus, ArrowLeft } from "lucide-react"
import { formatDate } from "@/lib/utils"

export default async function PrivateReviewPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") redirect("/dashboard")

  const assessments = await prisma.assessment.findMany({
    where: { type: "PRIVATE_REVIEW", assessorId: user.id },
    include: { school: true, branch: true },
    orderBy: { startedAt: "desc" }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقييم الخاص لكبير المراجعين"
        description="مراجعة مستقلة وسرية لجودة المدارس، لا تؤثر على النتائج الرسمية."
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "التقييم الخاص" }]}
        actions={
          <Link href="/private-review/new">
            <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>بدء تقييم خاص</Button>
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {assessments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-foreground-strong mb-1">لا توجد تقييمات خاصة مسجلة</p>
              <p className="text-sm">ابدأ بإنشاء تقييم خاص لمراجعة أداء المدرسة بشكل مستقل.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {assessments.map(a => (
                <div key={a.id} className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet/10 flex items-center justify-center shrink-0 mt-1">
                      <ShieldCheck className="w-5 h-5 text-violet" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground-strong">{a.school.name}</h3>
                      <p className="text-sm text-muted-foreground">{a.branch?.name || "كامل المدرسة"}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant={a.status === "COMPLETED" ? "success" : "warning"} dot>
                          {a.status === "COMPLETED" ? "مكتمل" : "جاري"}
                        </Badge>
                        <span className="text-[12px] text-muted-foreground">بدأ في: {formatDate(a.startedAt.toISOString())}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="w-full md:w-48">
                    <Progress value={a.progress} className="h-2" tone={a.progress === 100 ? "success" : "default"} />
                    <p className="text-[12px] text-muted-foreground mt-1 text-left numeric">{a.progress}% مكتمل</p>
                  </div>
                  
                  <Link href={`/quality-assessor/assessments/${a.id}`}>
                    <Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />}>
                      فتح التقييم
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}