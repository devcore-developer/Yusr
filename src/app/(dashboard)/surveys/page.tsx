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
import { saveSurveyIntegrationConfig, deleteSurveyIntegrationConfig } from "@/features/survey-integration/actions"
import { SurveyLinkControl } from "@/components/surveys/SurveyLinkControl"
import { BarChart2, Link2, Settings2 } from "lucide-react"
import { weightsLabel } from "@/features/quality-reports/services/survey-integration"

async function handleAddSurvey(formData: FormData) {
  "use server"
  await addSurvey(formData)
}

async function handleSaveConfig(formData: FormData) {
  "use server"
  const schoolId = (formData.get("configSchoolId") as string) || ""
  const toolWeightPercent = parseFloat(formData.get("toolWeightPercent") as string)
  const surveyWeightPercent = parseFloat(formData.get("surveyWeightPercent") as string)
  const note = (formData.get("configNote") as string) || undefined
  if (!schoolId || isNaN(toolWeightPercent) || isNaN(surveyWeightPercent)) return
  await saveSurveyIntegrationConfig({ schoolId, toolWeightPercent, surveyWeightPercent, note })
}

async function handleDeleteConfig(formData: FormData) {
  "use server"
  const schoolId = (formData.get("configSchoolId") as string) || ""
  if (!schoolId) return
  await deleteSurveyIntegrationConfig(schoolId)
}

export default async function SurveysPage({ searchParams }: { searchParams: { indicatorId?: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const where = user.role === "SUPER_ADMIN" ? {} : { schoolId: user.schoolId }
  const surveys = await prisma.survey.findMany({ where, orderBy: { createdAt: "desc" } })

  const evidenceRecords = await prisma.fixedEvidence.findMany({
    select: { text: true, tool: true },
    distinct: ['text'],
    orderBy: { tool: 'asc' }
  })

  // (جديد) بنود الإطار الرسمي — لربط الاستبانة بمعرّفها المستقر (لا مطابقة نصية)
  const indicators = await prisma.indicator.findMany({
    select: { id: true, code: true, description: true },
    orderBy: { code: "asc" },
  })
  const indicatorById = new Map(indicators.map(i => [i.id, i]))

  // (جديد) إعداد الدمج المعتمد للمدرسة — يظهر لمدير النظام/مدير المدرسة فقط
  const canManage = user.role === "SUPER_ADMIN" || user.role === "SCHOOL_MANAGER"
  const configSchoolId = user.role === "SUPER_ADMIN" ? "" : (user.schoolId ?? "")
  const schools = user.role === "SUPER_ADMIN"
    ? await prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : []
  const currentConfig = configSchoolId
    ? await prisma.surveyIntegrationConfig.findUnique({
        where: { schoolId: configSchoolId },
        include: { approvedBy: { select: { name: true } } },
      })
    : null

  // (جديد) فلترة القائمة ببند محدد — /surveys?indicatorId=... (روابط شارات المحرك تفتح هنا)
  const filterIndicatorId = searchParams.indicatorId ?? null
  const filterIndicator = filterIndicatorId ? indicatorById.get(filterIndicatorId) ?? null : null
  const displaySurveys = filterIndicator
    ? surveys.filter(s => s.indicatorId === filterIndicator.id)
    : surveys

  return (
    <div className="space-y-6">
      <PageHeader
        title="نتائج الاستبانات"
        description="إدارة نتائج الاستبانات الخارجية (الطلاب، المعلمين، أولياء الأمور) وربطها ببنود إطار التقويم."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'نتائج الاستبانات' }]}
      />

      {/* (جديد) إعداد النتيجة المدمجة — لمدير النظام/مدير المدرسة فقط، والتحقق الفعلي على الخادم.
          بلا إعداد معتمد تبقى النتيجة المدمجة «غير مُهيَّأة» في كل العروض، والنتيجة الرسمية لا تتأثر إطلاقًا. */}
      {canManage && (
        <Card variant="primary">
          <CardContent className="p-6 min-w-0">
            <h3 className="text-base font-bold mb-1 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              إعداد النتيجة المدمجة (غير رسمية — للعرض والمقارنة)
            </h3>
            <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">
              أوزان اختيارية يحددها المصرح له ويجب أن مجموعها 100% بالضبط — لا توجد نسبة افتراضية معتمدة.
              الإعداد يظهر مع كل نتيجة مدمجة معروضة (الطريقة + تاريخ الاعتماد + المعتمِد) للتدقيق،
              ولا يغيّر النتيجة الرسمية للتقييم ولا أوزان المجالات (20%/30%/40%/10%) إطلاقًا.
              إلغاء الإعداد يعيد كل النتائج المدمجة إلى «غير مُهيَّأة».
            </p>
            <form action={handleSaveConfig} className="space-y-4 min-w-0">
              {user.role === "SUPER_ADMIN" ? (
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground-strong">المدرسة</label>
                  <Select name="configSchoolId" required>
                    <SelectTrigger className="w-full md:w-72">
                      <SelectValue placeholder="اختر المدرسة" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map(sc => (
                        <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <input type="hidden" name="configSchoolId" value={configSchoolId} />
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground-strong">وزن نتيجة التقييم بالأدوات %</label>
                  <Input name="toolWeightPercent" type="number" min="1" max="99" step="0.5" placeholder="مثال: 70" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground-strong">وزن نتيجة الاستبانة %</label>
                  <Input name="surveyWeightPercent" type="number" min="1" max="99" step="0.5" placeholder="مثال: 30" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-foreground-strong">ملاحظة على الإعداد (اختياري)</label>
                  <Input name="configNote" placeholder="قرار اللجنة، رقم المحضر، ..." />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit">حفظ الإعداد</Button>
              </div>
            </form>
            {currentConfig && (
              <div className="mt-4 p-3 rounded-lg bg-surface-muted/60 border border-border text-[12px] leading-relaxed">
                <p className="font-semibold text-foreground-strong mb-1">
                  الإعداد المعتمد حاليًا: {weightsLabel(currentConfig.toolWeight, currentConfig.surveyWeight)}
                </p>
                <p className="text-muted-foreground">
                  طريقة الاحتساب: متوسط مرجّح • آخر تحديث: {new Date(currentConfig.updatedAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}
                  {currentConfig.approvedBy?.name ? ` • بواسطة: ${currentConfig.approvedBy.name}` : ""}
                  {currentConfig.note ? ` • ملاحظة: ${currentConfig.note}` : ""}
                </p>
                {configSchoolId && (
                  <form action={handleDeleteConfig} className="mt-2">
                    <input type="hidden" name="configSchoolId" value={configSchoolId} />
                    <Button type="submit" variant="outline" size="sm">إلغاء الإعداد (تعود النتيجة المدمجة إلى «غير مُهيَّأة»)</Button>
                  </form>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

            {/* (جديد) الربط الصريح بمعرّف البند — اختياري، والتحقق على الخادم */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[13px] font-medium text-foreground-strong flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-secondary" />
                  ربط بمؤشر من إطار التقويم (اختياري — بالمعرّف المستقر)
                </label>
                <Select name="indicatorId">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="بدون ربط — استبانة مستقلة" />
                  </SelectTrigger>
                  <SelectContent>
                    {indicators.map(ind => (
                      <SelectItem key={ind.id} value={ind.id}>
                        {ind.code} — {ind.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground-strong">عدد الاستجابات (اختياري)</label>
                <Input name="respondents" type="number" min="0" step="1" placeholder="مثال: 120" />
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
            <h3 className="text-base font-bold">
              {filterIndicator
                ? `الاستبانات المرتبطة بالبند: ${filterIndicator.code} — ${filterIndicator.description}`
                : "النتائج المسجلة"}
            </h3>
            {filterIndicator && (
              <a href="/surveys" className="text-[12px] text-secondary hover:underline">عرض كل النتائج (إلغاء الفلترة)</a>
            )}
          </div>
          {displaySurveys.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              {filterIndicator ? "لا توجد استبانات مرتبطة بهذا البند بعد." : "لا توجد استبانات مدخلة بعد."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {displaySurveys.map((s) => {
                const linkedIndicator = s.indicatorId ? indicatorById.get(s.indicatorId) ?? null : null
                return (
                  <div key={s.id} className="p-4">
                    <div className="flex items-center justify-between mb-2 gap-2">
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
                    {/* (جديد) حالة الربط الصريح + عدد الاستجابات + تحكم الربط للصلاحيات المصرح لها */}
                    <p className="text-xs mt-1">
                      <span className={linkedIndicator ? "text-secondary font-medium" : "text-muted-foreground"}>
                        {linkedIndicator ? `مرتبطة بمؤشر: ${linkedIndicator.code}` : "غير مرتبطة بمؤشر"}
                      </span>
                      {" • "}
                      <span className="text-muted-foreground">
                        الاستجابات المسجلة: {typeof s.respondents === "number" ? s.respondents : "غير مسجل"}
                      </span>
                    </p>
                    <div className="mt-2">
                      <SurveyLinkControl
                        surveyId={s.id}
                        currentIndicatorId={s.indicatorId}
                        indicators={indicators}
                        canManage={canManage}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}