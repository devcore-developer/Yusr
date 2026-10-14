import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Printer, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { compareAssessments } from "@/features/quality-assessment/services/aggregation"

export default async function ComparePage({ searchParams }: { searchParams: { ids: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const assessmentIds = searchParams.ids.split(",").filter(Boolean)
  if (assessmentIds.length < 2) {
    redirect("/quality-assessor")
  }

  // Authorization check
  const assessments = await prisma.assessment.findMany({
    where: { id: { in: assessmentIds } },
    select: { schoolId: true, branchId: true }
  })

  if (user.role !== "SUPER_ADMIN") {
    const hasUnauthorized = assessments.some(a => {
      if (user.role === "SCHOOL_MANAGER") return a.schoolId !== user.schoolId
      if (user.role === "BRANCH_MANAGER") return a.branchId !== user.branchId
      return false
    })
    if (hasUnauthorized) redirect("/quality-assessor")
  }

  const result = await compareAssessments(assessmentIds)

  return (
    <div className="space-y-6">
      <PageHeader
        title="مقارنة التقييمات"
        description={`مقارنة ${result.assessments.length} تقييمات لنفس النطاق`}
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "التقييمات", href: "/quality-assessor" },
          { label: "مقارنة" }
        ]}
        actions={
          <a href={`/quality-assessor/compare/print?ids=${searchParams.ids}`} target="_blank">
            <Button variant="outline" size="md" icon={<Printer className="w-4 h-4" />}>
              تصدير PDF
            </Button>
          </a>
        }
      />

      {/* Evaluators Summary */}
      <Card>
        <CardHeader>
          <CardTitle>المُقيّمون المشمولون</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.assessments.map(a => (
              <div key={a.id} className="p-4 border border-border rounded-lg">
                <p className="font-medium text-foreground-strong">{a.assessorName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {a.assessorRole === "QUALITY_ASSESSOR" ? "مشرف" : 
                   a.assessorRole === "SCHOOL_MANAGER" ? "مدير عام" : 
                   a.assessorRole === "BRANCH_MANAGER" ? "مدير قسم" : a.assessorRole}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant={a.status === "COMPLETED" ? "success" : "warning"}>
                    {a.status === "COMPLETED" ? "مكتمل" : "جاري"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{a.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Aggregated Results */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">متوسط الأداء</p>
          <p className="text-3xl font-bold text-primary numeric mt-2">{result.aggregated.averageScore}%</p>
          <Badge variant="info" className="mt-2">{result.aggregated.performanceBand}</Badge>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">معدل الاتفاق</p>
          <p className="text-3xl font-bold text-success numeric mt-2">{result.aggregated.agreementRate}%</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">مؤشرات متفق عليها</p>
          <p className="text-3xl font-bold text-success numeric mt-2">{result.aggregated.agreedIndicators}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-muted-foreground">مؤشرات مختلف عليها</p>
          <p className="text-3xl font-bold text-danger numeric mt-2">{result.aggregated.disagreedIndicators}</p>
        </Card>
      </div>

      {/* Domain Averages */}
      <Card>
        <CardHeader>
          <CardTitle>متوسطات المجالات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-xs text-muted-foreground bg-surface-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">المجال</th>
                  <th className="px-4 py-3 font-medium">نسبة الاتفاق</th>
                  <th className="px-4 py-3 font-medium">المستوى</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.aggregated.domainAverages.map(d => (
                  <tr key={d.domain}>
                    <td className="px-4 py-3 font-medium">{d.domain}</td>
                    <td className="px-4 py-3 numeric">{d.average}%</td>
                    <td className="px-4 py-3"><Badge variant="info">{d.band}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>المقارنة التفصيلية حسب المؤشر</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-xs text-muted-foreground bg-surface-muted uppercase sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">الكود</th>
                  <th className="px-4 py-3 font-medium">المؤشر</th>
                  {result.assessments.map(a => (
                    <th key={a.id} className="px-4 py-3 font-medium">{a.assessorName}</th>
                  ))}
                  <th className="px-4 py-3 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.comparisons.map(c => (
                  <tr key={c.indicatorCode} className="hover:bg-surface-muted/30">
                    <td className="px-4 py-3 font-mono text-secondary text-xs">{c.indicatorCode}</td>
                    <td className="px-4 py-3 text-xs max-w-xs">{c.indicatorText}</td>
                    {result.assessments.map(a => {
                      const resp = c.responses[a.id]
                      return (
                        <td key={a.id} className="px-4 py-3 text-xs">
                          {resp ? (
                            <span className={resp.value === "لم يُقيّم" ? "text-muted-foreground" : "text-foreground-strong"}>
                              {resp.value}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3">
                      {!c.evaluatedByAll ? (
                        <AlertCircle className="w-4 h-4 text-warning" />
                      ) : c.agreement ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-danger" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}