"use client"

// ============================================================
// إدارة الأعوام الدراسية — واجهة مدير المدرسة (صفحة الإعدادات)
//  - إنشاء عام جديد (بسنة هجرية لبداية العام) + إنشاء سريع للاقتراح.
//  - عرض الأعوام مع عدد السجلات المرتبطة بكل عام.
//  - تنشيط عام (تبديل ذري للنشط القائم) وتأكيد قبل التنفيذ.
//  - حذف معطّل تلقائيًا للسنين المرتبطة بسجلات + رفض خادمي مطابق.
//  - الاقتراح من التقويم الهجري معروض كاقتراح صريح — لا يُفعَّل تلقائيًا.
// كل العمليات تنادي الأكشنز الخادمية التي تفرض نفس القواعد مستقلًا عن هنا.
// ============================================================

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { CalendarDays, CalendarPlus, CheckCircle2, Info, Trash2 } from "lucide-react"
import {
  createAcademicYear,
  activateAcademicYear,
  deleteAcademicYear
} from "@/features/academic-years/actions"
import { formatAcademicYearLabel, MIN_HIJRI_YEAR, MAX_HIJRI_YEAR } from "@/lib/academic-year"

export interface ManagerYearRow {
  id: string
  label: string
  startYear: number
  isActive: boolean
  assessmentCount: number
  planCount: number
}

interface AcademicYearManagerProps {
  schoolId: string
  years: ManagerYearRow[]
  /** اقتراح التقويم الهجري لبداية العام الحالي — عرض فقط، لا يُطبق تلقائيًا */
  suggestedStartYear: number | null
}

export function AcademicYearManager({ schoolId, years, suggestedStartYear }: AcademicYearManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [startYearInput, setStartYearInput] = React.useState("")

  const activeYear = years.find(y => y.isActive) ?? null
  const suggestionExists = suggestedStartYear !== null && years.some(y => y.startYear === suggestedStartYear)

  function runAction(work: () => Promise<string>) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      try {
        const message = await work()
        setNotice(message)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر إتمام العملية — حاول مرة أخرى.")
      }
    })
  }

  function handleCreate(startYear: number) {
    runAction(async () => {
      await createAcademicYear(schoolId, startYear)
      return `تم إنشاء العام الدراسي «${formatAcademicYearLabel(startYear)}» — نشّطه ليصبح عام المدرسة النشط.`
    })
  }

  function handleCreateFromInput() {
    const parsed = Number(startYearInput.trim())
    if (!Number.isInteger(parsed) || parsed < MIN_HIJRI_YEAR || parsed > MAX_HIJRI_YEAR) {
      setError(`أدخل سنة هجرية صحيحة بين ${MIN_HIJRI_YEAR} و${MAX_HIJRI_YEAR} — مثال: 1448 لعام «1448–1449 هـ».`)
      return
    }
    handleCreate(parsed)
    setStartYearInput("")
  }

  function handleActivate(year: ManagerYearRow) {
    const confirmed = window.confirm(
      `تنشيط العام الدراسي «${year.label}» وجعله العام النشط للمدرسة؟\n\n` +
        `لن يُعدَّل أي تقييم أو خطة أو تقرير سابق — كل السجلات تحتفظ بعامها المخزّن.`
    )
    if (!confirmed) return
    runAction(async () => {
      await activateAcademicYear(year.id)
      return `العام الدراسي «${year.label}» الآن هو العام النشط.`
    })
  }

  function handleDelete(year: ManagerYearRow) {
    const confirmed = window.confirm(
      `حذف العام الدراسي «${year.label}»؟\n\nسيُرفض الحذف تلقائيًا إن كان مرتبطًا بأي تقييمات أو خطط تحسين.`
    )
    if (!confirmed) return
    runAction(async () => {
      await deleteAcademicYear(year.id)
      return `تم حذف العام الدراسي «${year.label}».`
    })
  }

  return (
    <div className="space-y-5">
      {/* حالة العام النشط */}
      {activeYear ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">العام النشط حاليًا:</span>
          <Badge variant="success" dot>{activeYear.label}</Badge>
        </div>
      ) : (
        <p className="text-sm text-warning">
          لا يوجد عام دراسي نشط — التقييمات الجديدة ستُنشأ بلا عام دراسي حتى تنشّط عامًا.
        </p>
      )}

      {/* الاقتراح من التقويم الهجري — مميّز بوضوح عن العام المحفوظ */}
      {suggestedStartYear !== null && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-muted/60 border border-border">
          <Info className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground-strong">
              وفق التقويم الهجري، يُرجَّح أن العام الدراسي الحالي هو{" "}
              <span className="font-semibold numeric">{formatAcademicYearLabel(suggestedStartYear)}</span>
              {suggestionExists ? " — وهو مسجل لديك بالفعل." : " (مقترح فقط — لا يُفعَّل تلقائيًا)."}
            </p>
            {!suggestionExists && (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  disabled={isPending}
                  icon={<CalendarPlus className="w-3.5 h-3.5" />}
                  onClick={() => handleCreate(suggestedStartYear)}
                >
                  إنشاء العام المقترح
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* نموذج إنشاء عام دراسي */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="space-y-1.5 flex-1">
          <label className="text-sm font-medium" htmlFor="academic-year-start">
            السنة الهجرية لبداية العام
          </label>
          <Input
            id="academic-year-start"
            name="startYear"
            type="number"
            inputMode="numeric"
            min={MIN_HIJRI_YEAR}
            max={MAX_HIJRI_YEAR}
            placeholder={`مثال: 1448 لعام «1448–1449 هـ»`}
            value={startYearInput}
            onChange={e => setStartYearInput(e.target.value)}
            disabled={isPending}
          />
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={isPending}
          onClick={handleCreateFromInput}
        >
          إنشاء عام دراسي
        </Button>
      </div>

      {/* رسائل النجاح والخطأ */}
      {notice && (
        <p className="flex items-center gap-2 text-sm text-success" role="status">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </p>
      )}
      {error && (
        <p className="text-sm text-[#dc2626]" role="alert">{error}</p>
      )}

      {/* قائمة الأعوام */}
      {years.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          لم يتم إنشاء أي عام دراسي بعد — أنشئ العام الحالي من الأعلى ليبدأ ارتباط التقييمات وخطط التحسين بعام دراسي واضح.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-muted text-muted-foreground">
                <th className="text-right font-medium px-4 py-3">العام الدراسي</th>
                <th className="text-right font-medium px-4 py-3">الحالة</th>
                <th className="text-right font-medium px-4 py-3">سجلات مرتبطة</th>
                <th className="text-right font-medium px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {years.map(year => (
                <tr key={year.id} className={year.isActive ? "bg-secondary/5" : undefined}>
                  <td className="px-4 py-3 font-medium text-foreground-strong numeric">{year.label}</td>
                  <td className="px-4 py-3">
                    {year.isActive ? (
                      <Badge variant="success" dot>نشط</Badge>
                    ) : (
                      <Badge variant="neutral">تاريخي</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground numeric">
                    تقييمات: {year.assessmentCount} • خطط: {year.planCount}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {!year.isActive && (
                        <Button
                          type="button"
                          variant="soft"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleActivate(year)}
                        >
                          تنشيط
                        </Button>
                      )}
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[#dc2626] hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-smooth"
                        disabled={isPending || year.assessmentCount > 0 || year.planCount > 0}
                        title={
                          year.assessmentCount > 0 || year.planCount > 0
                            ? "لا يمكن حذف عام مرتبط بسجلات — يبقى محفوظًا كعام تاريخي"
                            : undefined
                        }
                        onClick={() => handleDelete(year)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ضوابط ثابتة معروضة للمسؤول */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-muted/40 text-[12px] text-muted-foreground">
        <CalendarDays className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          تبديل العام النشط لا يعدّل أي سجل تاريخي: كل تقييم وخطة تحسين يحتفظ بعامه الدراسي المخزّن وقت
          إنشائه، والتقارير تقرأ العام من العلاقة المخزّنة لا من العام النشط. لا يمكن حذف عام مرتبط بسجلات،
          ولا يكون هناك أكثر من عام نشط واحد للمدرسة (مضمون على مستوى قاعدة البيانات).
        </p>
      </div>
    </div>
  )
}