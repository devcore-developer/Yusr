import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { addSurvey } from "@/features/landing/actions"
import { BarChart2 } from "lucide-react"

async function handleAddSurvey(formData: FormData) {
  "use server"
  await addSurvey(formData)
}

export default async function SurveysPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const where = user.role === "SUPER_ADMIN" ? {} : { schoolId: user.schoolId }
  const surveys = await prisma.survey.findMany({ where, orderBy: { createdAt: "desc" } })

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
        <CardContent className="p-6 min-w-0">
          <h3 className="text-base font-bold mb-4">إضافة نتيجة استبانة</h3>
          <form action={handleAddSurvey} className="space-y-4 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground-strong">نوع الاستبانة</label>
                <Select name="type">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر نوع الاستبانة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="استبانة الطلاب">استبانة الطلاب</SelectItem>
                    <SelectItem value="استبانة المعلمين">استبانة المعلمين</SelectItem>
                    <SelectItem value="استبانة أولياء الأمور">استبانة أولياء الأمور</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground-strong">النتيجة العامة للاستبانة</label>
                <Select name="generalResult">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="نتيجة عامة للاستبانة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="نتيجة عامة للاستبانة">نتيجة عامة للاستبانة</SelectItem>
                    {evidenceRecords.map((ev, i) => (
                      <SelectItem key={i} value={ev.text}>
                        {ev.text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground-strong">النسبة المئوية %</label>
                <Input
                  name="percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="النسبة المئوية %"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground-strong">ملاحظات</label>
              <Input name="note" placeholder="مصدر النتيجة، عدد المستجيبين، الفترة، أو أي ملاحظة..." />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" name="include" id="include" className="w-4 h-4" />
              <label htmlFor="include" className="text-[13px] font-medium text-foreground-strong">تضمين النسبة في تجميع المؤشر عند ربطها بمؤشر</label>
            </div>

            <Button type="submit">إضافة النتيجة</Button>
          </form>
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