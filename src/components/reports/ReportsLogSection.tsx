// ===== FILE: src/components/reports/ReportsLogSection.tsx =====
// ============================================================
// ReportsLogSection — القسم الأول من تقارير مدير النظام: «سجل التقارير»
// ============================================================
// (إعادة تصميم — إضافة جديدة) يستبدل شريط الفلاتر القديم + الجدول المزدحم
// في فرع مدير النظام فقط، بهوية بصرية موحدة ومتجاوبة:
//   1) رأس القسم بعنوان «سجل التقارير» وعدّاد النتائج.
//   2) بطاقات ملخص (KPI) محسوبة على الخادم من المصدر الحقيقي نفسه
//      الذي يغذي القائمة (نفس المعادلات المعتمدة — بلا أي معادلة جديدة).
//   3) Toolbar متجاوب: بحث نصي + الفلاتر الفعلية القائمة (مدرسة/مقيّم/عام/
//      فترة/حالة) + إعادة تعيين + شرائح المرحلة التي تحفظ بقية الفلاتر
//      في روابطها (إصلاح: كانت شرائح المرحلة القديمة تُسقط الفلاتر الأخرى).
//   4) قائمة نتائج متجاوبة (صفوف بطاقات على كل المقاسات — بلا تمرير أفقي)
//      تحفظ كل بيانات الصفوف القديمة وأزرارها، وتُظهر شارة الخطة المرتبطة
//      إن وُجدت بدل أي إجراء مضلل.
//
// قواعد صارمة:
//  - مكوّن خادمي عرضٌ فقط: كل الأرقام والصفوف تُمرَّر إليه جاهزة من الصفحة
//    (نفس استعلامات المصدر الواحد) — لا حساب ولا جلب هنا.
//  - أسماء حقول النموذج وخياراته مطابقة للشريط القائم حرفيًا
//    (schoolId/assessorId/year/from/to/status + stage المخفي) — سلوك
//    الفلاتر نفسه بلا تغيير، والإضافة الوحيدة حقل البحث q.
//  - لا يُضاف أي إجراء إنشاء خطط: إنشاء الخطط يبقى لمقيّم الجودة حصرًا —
//    هنا شارة عرض فقط للخطة القائمة المرتبطة بالتقييم (علاقة حقيقية).
//  - القسم الثاني من الصفحة (تقارير المدارس الشاملة) لا علاقة له بهذا
//    المكوّن إطلاقًا.
// ============================================================

import Link from "next/link"
import {
  Search,
  RotateCcw,
  ClipboardList,
  FileText,
  CheckCircle2,
  Gauge,
  TrendingDown,
  Link2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Progress } from "@/components/ui/Progress"
import { EDUCATIONAL_STAGES } from "@/lib/stages"
import type { ReportsLogKpis } from "@/features/quality-reports/services/reports-log"

/** الخطة القائمة المرتبطة بتقييم — من قاعدة البيانات حصرًا (بمعرفها الفعلي) */
export interface ReportsLogPlanRef {
  id: string
  status: string
  kind: string
}

/** صف جاهز للعرض في سجل التقارير — تُبني من الصفحة (نفس بيانات الصفوف القديمة) */
export interface ReportsLogRowData {
  id: string
  schoolName: string
  branchName: string | null
  assessorName: string | null
  /** تسمية المرحلة (تُبنى من getStageLabel في الصفحة) */
  stageLabel: string
  hasStage: boolean
  yearLabel: string | null
  dateLabel: string
  isCompleted: boolean
  /** نسبة تحقق الشواهد لهذا التقييم وحده — نفس معادلة الصفحة المعتمدة */
  score: number
  plan: ReportsLogPlanRef | null
}

export interface ReportsLogSectionProps {
  kpis: ReportsLogKpis
  /** إجمالي بنك الشواهد — يظهر في وصف القسم ليكون أساس النسب مبيّنًا ذاتيًا */
  totalEvidence: number
  rows: ReportsLogRowData[]
  /** قيمة فلتر المرحلة الحالية (stageParam) لحفظها عبر إرسال النموذج */
  stageParam?: string | null
  /** فلاتر الرابط الحالية دون stage — تحفظها شرائح المرحلة في روابطها */
  filtersQsNoStage: string
  current: {
    schoolId?: string
    assessorId?: string
    yearParam?: string
    from?: string
    to?: string
    status?: string
    q?: string
  }
  /** هل أي فلتر فعّال (شاملة stage وq)؟ يظهر معه زر إعادة التعيين */
  hasActiveFilters: boolean
  schools: { id: string; name: string }[]
  assessors: { id: string; name: string }[]
  years: { id: string; label: string }[]
}

const inputClass =
  "px-3 py-1.5 rounded-lg border border-border bg-surface text-[13px] text-foreground-strong min-w-0"

const fieldLabelClass = "text-[11px] font-medium text-muted-foreground"

/** تسمية حالة الخطة — نفس تسميات صفحة الخطط القائمة حرفيًا */
function planStatusLabel(status: string): { label: string; active: boolean } {
  if (status === "COMPLETED") return { label: "مكتملة", active: true }
  if (status === "IN_PROGRESS") return { label: "جارية", active: true }
  return { label: "مسودة", active: false }
}

/** بطاقة KPI مضغوطة — ألوان الهوية الزرقاء فقط، بلا ألوان دخيلة */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 transition-smooth hover:border-primary/40">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="inline-flex w-8 h-8 rounded-lg bg-primary/10 text-primary items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-[12px] font-medium text-muted-foreground leading-snug">{label}</span>
      </div>
      <p className="mt-2.5 text-2xl font-bold text-foreground-strong numeric">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{sub}</p>
    </div>
  )
}

export function ReportsLogSection({
  kpis,
  totalEvidence,
  rows,
  stageParam,
  filtersQsNoStage,
  current,
  hasActiveFilters,
  schools,
  assessors,
  years,
}: ReportsLogSectionProps) {
  // شرائح المرحلة — نفس خيارات الشريط القائم، لكن روابطها تحفظ بقية الفلاتر
  const stageOptions: { value: string; label: string }[] = [
    { value: "", label: "كل المراحل" },
    ...EDUCATIONAL_STAGES.map(s => ({ value: s.id, label: s.ar })),
    { value: "UNSPECIFIED", label: "غير محددة" },
  ]
  const stageHref = (value: string) => {
    const suffix = filtersQsNoStage ? `&${filtersQsNoStage}` : ""
    return value ? `/reports?stage=${value}${suffix}` : `/reports${filtersQsNoStage ? `?${filtersQsNoStage}` : ""}`
  }

  return (
    <section className="space-y-4 min-w-0">
      {/* 1) رأس القسم */}
      <div className="flex flex-wrap items-end justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground-strong flex items-center gap-2">
            <span className="inline-flex w-8 h-8 rounded-lg bg-primary/10 text-primary items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </span>
            سجل التقارير
          </h2>
          <p className="text-[13px] text-muted-foreground mt-1.5">
            كل صف = تقييم واحد مستقل. النتيجة نسبة تحقق الشواهد لهذا التقييم وحده من إجمالي{" "}
            <span className="numeric font-medium">{totalEvidence}</span> شاهدًا في البنك.
          </p>
        </div>
        <span className="text-[12px] text-muted-foreground whitespace-nowrap">
          معروض <span className="numeric font-medium">{rows.length}</span> من{" "}
          <span className="numeric font-medium">{kpis.total}</span> مطابق
        </span>
      </div>

      {/* 2) بطاقات الملخص — محسوبة من المصدر الحقيقي نفسه الذي يغذي القائمة */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 min-w-0">
        <KpiCard
          icon={FileText}
          label="إجمالي التقارير المطابقة"
          value={String(kpis.total)}
          sub={kpis.inProgress > 0 ? `منها ${kpis.inProgress} جارية` : "بلا تقارير جارية"}
        />
        <KpiCard
          icon={CheckCircle2}
          label="تقارير مكتملة"
          value={String(kpis.completed)}
          sub="نواتج نهائية في النطاق"
        />
        <KpiCard
          icon={Gauge}
          label="متوسط نسبة التحقق"
          value={kpis.avgVerification === null ? "—" : `${kpis.avgVerification}%`}
          sub={
            kpis.avgVerification === null
              ? "لا توجد مكتملة في النطاق"
              : `متوسط ${kpis.scoredCompleted} تقييمًا مكتملًا فقط`
          }
        />
        <KpiCard
          icon={TrendingDown}
          label="تحتاج إلى تحسين"
          value={String(kpis.needsImprovement)}
          sub="مكتملة بأقل من 90% — الحد المعتمد"
        />
        <KpiCard
          icon={Link2}
          label="خطط مرتبطة بالنتائج"
          value={String(kpis.linkedPlans)}
          sub="مرتبطة بتقييمات النطاق"
        />
      </div>

      {/* 3) Toolbar الفلاتر — بحث + الفلاتر الفعلية + إعادة تعيين + شرائح المرحلة */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <form action="/reports" method="get" className="flex flex-wrap items-end gap-3 min-w-0">
            {stageParam && <input type="hidden" name="stage" value={stageParam} />}

            {/* البحث النصي — يطابق اسم المدرسة أو الفرع أو المقيّم (فلتر فعلي على البيانات) */}
            <label className="flex flex-col gap-1 flex-[2_1_220px] min-w-[200px]">
              <span className={`${fieldLabelClass} flex items-center gap-1`}>
                <Search className="w-3 h-3" />
                بحث
              </span>
              <input
                type="search"
                name="q"
                defaultValue={current.q ?? ""}
                placeholder="اسم المدرسة أو الفرع أو المقيّم"
                className={inputClass}
              />
            </label>

            {schools.length > 0 && (
              <label className="flex flex-col gap-1 flex-1 min-w-[150px]">
                <span className={fieldLabelClass}>المدرسة</span>
                <select name="schoolId" defaultValue={current.schoolId ?? ""} className={inputClass}>
                  <option value="">كل المدارس</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            )}

            {assessors.length > 0 && (
              <label className="flex flex-col gap-1 flex-1 min-w-[150px]">
                <span className={fieldLabelClass}>مقيّم الجودة</span>
                <select name="assessorId" defaultValue={current.assessorId ?? ""} className={inputClass}>
                  <option value="">كل المقيّمين</option>
                  {assessors.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
            )}

            {years.length > 0 && (
              <label className="flex flex-col gap-1 flex-1 min-w-[150px]">
                <span className={fieldLabelClass}>العام الدراسي</span>
                <select name="year" defaultValue={current.yearParam ?? ""} className={inputClass}>
                  <option value="">كل الأعوام</option>
                  {years.map(y => (
                    <option key={y.id} value={y.id}>{y.label}</option>
                  ))}
                  <option value="UNASSIGNED">غير محدد (سجلات قديمة)</option>
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1 flex-1 min-w-[145px]">
              <span className={fieldLabelClass}>من تاريخ</span>
              <input type="date" name="from" defaultValue={current.from ?? ""} className={inputClass} />
            </label>

            <label className="flex flex-col gap-1 flex-1 min-w-[145px]">
              <span className={fieldLabelClass}>إلى تاريخ</span>
              <input type="date" name="to" defaultValue={current.to ?? ""} className={inputClass} />
            </label>

            <label className="flex flex-col gap-1 flex-1 min-w-[140px]">
              <span className={fieldLabelClass}>الحالة</span>
              <select name="status" defaultValue={current.status ?? ""} className={inputClass}>
                <option value="">حسب الافتراضي</option>
                <option value="COMPLETED">مكتمل</option>
                <option value="IN_PROGRESS">جاري</option>
                <option value="ALL">الكل</option>
              </select>
            </label>

            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="md">تطبيق الفلاتر</Button>
              {hasActiveFilters && (
                <Link
                  href="/reports"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted-foreground hover:border-primary/60 hover:text-primary transition-smooth whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  إعادة تعيين
                </Link>
              )}
            </div>
          </form>

          {/* شرائح المرحلة — الإصلاح: الروابط تحفظ بقية الفلاتر بدل إسقاطها */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border min-w-0">
            <span className="text-[12px] font-medium text-muted-foreground">المرحلة التعليمية:</span>
            {stageOptions.map(o => {
              const isActive =
                o.value === "" ? !stageParam : o.value === "UNSPECIFIED" ? stageParam === "UNSPECIFIED" : stageParam === o.value
              return (
                <Link
                  key={o.value || "all"}
                  href={stageHref(o.value)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-smooth whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-white border-primary"
                      : "bg-surface-muted text-muted-foreground border-border hover:border-primary/60"
                  }`}
                >
                  {o.label}
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* 4) قائمة النتائج — صفوف متجاوبة على كل المقاسات (بلا تمرير أفقي) */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="px-5 py-4 flex items-center justify-between gap-2 border-b border-border min-w-0">
            <h3 className="font-bold text-[15px]">النتائج المطابقة</h3>
            <span className="text-[12px] text-muted-foreground whitespace-nowrap">
              <span className="numeric font-medium">{rows.length}</span> /{" "}
              <span className="numeric">{kpis.total}</span>
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <span className="inline-flex w-12 h-12 rounded-full bg-surface-muted text-muted-foreground items-center justify-center">
                <Search className="w-5 h-5" />
              </span>
              <p className="mt-3 text-[14px] font-medium text-foreground-strong">
                لا توجد تقارير مطابقة للفلاتر المحددة.
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                جرّب توسيع الفترة الزمنية أو مسح البحث أو اختيار «الكل» في الحالة.
              </p>
              {hasActiveFilters && (
                <Link
                  href="/reports"
                  className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg border border-border text-[12px] text-muted-foreground hover:border-primary/60 hover:text-primary transition-smooth"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  إعادة تعيين الفلاتر
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map(row => (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 px-5 py-4 transition-smooth hover:bg-surface-muted/50 md:flex-row md:items-center md:gap-4"
                >
                  {/* الهوية: المدرسة ثم الفرع • المقيّم */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {row.schoolName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-foreground-strong truncate">
                        {row.schoolName}
                      </p>
                      <p className="text-[12px] text-muted-foreground truncate">
                        {row.branchName || "كامل المدرسة"} • {row.assessorName || "غير محدد"}
                      </p>
                    </div>
                  </div>

                  {/* البيانات الوصفية: المرحلة + العام + التاريخ */}
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 md:shrink-0">
                    <Badge variant={row.hasStage ? "info" : "neutral"}>{row.stageLabel}</Badge>
                    <span className="text-[11px] text-muted-foreground">{row.yearLabel ?? "عام غير محدد"}</span>
                    <span className="text-[11px] text-muted-foreground numeric">{row.dateLabel}</span>
                  </div>

                  {/* الحالة + النتيجة */}
                  <div className="flex items-center gap-2.5 md:w-[185px] md:shrink-0">
                    <Badge variant={row.isCompleted ? "success" : "warning"} dot>
                      {row.isCompleted ? "مكتمل" : "جاري"}
                    </Badge>
                    <Progress
                      value={row.score}
                      size="sm"
                      className="w-14"
                      tone={row.score === 100 ? "success" : "default"}
                    />
                    <span className="text-[12px] font-medium numeric">{row.score}%</span>
                  </div>

                  {/* الإجراءات: شارة الخطة القائمة إن وُجدت + عرض التقرير */}
                  <div className="flex items-center gap-2 md:shrink-0 md:justify-end">
                    {row.plan && (
                      <Link
                        href={`/improvement-plans/${row.plan.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-[11px] font-medium hover:border-primary/60 transition-smooth whitespace-nowrap"
                      >
                        <Link2 className="w-3 h-3" />
                        {row.plan.kind === "SUSTAINABILITY" ? "خطة استدامة" : "خطة تحسين"} •{" "}
                        {planStatusLabel(row.plan.status).label}
                      </Link>
                    )}
                    <Link href={`/quality/assessments/${row.id}/results`}>
                      <Button variant="outline" size="sm">عرض التقرير</Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {rows.length > 0 && kpis.total > rows.length && (
            <p className="px-5 py-3 text-[12px] text-muted-foreground border-t border-border">
              تُعرض أحدث <span className="numeric">{rows.length}</span> نتيجة من{" "}
              <span className="numeric">{kpis.total}</span> مطابقة — استخدم الفلاتر لتضييق النطاق.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
