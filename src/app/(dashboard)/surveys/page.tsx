import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { SurveyForm } from "@/components/landing/SurveyForm"
import { BarChart2 } from "lucide-react"

export default async function SurveysPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  // جلب الاستبانات حسب الصلاحيات
  const where = user.role === "SUPER_ADMIN" ? {} : { schoolId: user.schoolId }
  const surveys = await prisma.survey.findMany({ where, orderBy: { createdAt: "desc" } })

  // جلب نصوص الشواهد لاستخدامها في القائمة المنسدلة
  const evidenceRecords = await prisma.fixedEvidence.findMany({
    select: { text: true, tool: true },
    distinct: ['text'],
    orderBy: { tool: 'asc' }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="نتائج الاستبانات"
        description="إدارة نتائج الاستبانات الخارجية (الطلاب، المعلمين، أولياء الأمور)."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'نتائج الاستبانات' }]}
      />

      <Card>
        <CardContent className="p-6">
          <h3 className="text-base font-bold mb-4">إضافة نتيجة استبانة</h3>
          <SurveyForm evidenceTexts={evidenceRecords} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-border">
            <h3 className="text-base font-bold">النتائج المسجلة</h3>
          </div>
          {surveys.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              لا توجد استبانات مدخلة بعد.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {surveys.map((s) => (
                <div key={s.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-foreground-strong">{s.type}</p>
                    <Badge variant={s.percentage >= 90 ? "success" : s.percentage >= 75 ? "info" : "warning"}>
                      {s.percentage}%
                    </Badge>
                  </div>
                  {s.generalResult && (
                    <p className="text-sm text-foreground-strong mb-1 line-clamp-2">
                      <span className="text-muted-foreground">النتيجة العامة:</span> {s.generalResult}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {s.include ? 'مضمنة في التقييم' : 'غير مضمنة'} • {s.note || 'لا توجد ملاحظات'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}