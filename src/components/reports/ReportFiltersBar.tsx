// ===== FILE: src/components/reports/ReportFiltersBar.tsx ===== (★ جديد)
// ============================================================
// ReportFiltersBar — شريط فلاتر سجل التقارير (§3 من مواصفة الإصلاح)
// ============================================================
// مكوّن خادمي (نموذج GET — بلا أي JS عميل) يجاور فلتر المرحلة القائم:
//  - المقيّم + العام الدراسي + من/إلى تاريخ + حالة التقييم (+ المدرسة لمدير النظام)
//  - فلتر المرحلة القائم بروابطه يبقى كما هو (حفظ للتنقل الحالي) ويُحفظ
//    داخل حقل مخفي كي تعمل كل الفلاتر معًا في رابط واحد.
//  - الخيارات تُبنى على الخادم من بيانات النطاق الفعلي (لا قيم مصنعة)،
//    والاستعلام مقيّد دائمًا بنطاق الدور — الفلاتر تضيّق ولا توسّع (§4).
// ============================================================

import Link from "next/link"
import { Card } from "@/components/ui/Card"

export interface ReportFiltersBarProps {
  action?: string
  /** خيارات المقيّمين من التقييمات الفعلية في النطاق (id + الاسم) */
  assessors: { id: string; name: string }[]
  /** الأعوام الدراسية المتاحة في النطاق (id + تسمية العرض) */
  years: { id: string; label: string }[]
  /** خيارات المدارس — لمدير النظام فقط */
  schools?: { id: string; name: string }[]
  /** قيمة فلتر المرحلة الحالية (stageParam) لحفظها عبر إرسال النموذج */
  stageParam?: string | null
  current?: {
    schoolId?: string
    assessorId?: string
    /** undefined = بلا فلتر عام / "UNASSIGNED" = سجلات بلا عام / معرّف عام */
    yearParam?: string | null
    from?: string
    to?: string
    status?: string
  }
  /** إخفاء حقل المقيّم (مقيّم الجودة يرى تقييماته فقط) */
  hideAssessor?: boolean
  /** إخفاء حقل الحالة (حيث لا معنى له) */
  hideStatus?: boolean
}

const inputClass =
  "px-3 py-1.5 rounded-lg border border-border bg-surface text-[13px] text-foreground-strong min-w-0"

export function ReportFiltersBar({
  action = "/reports",
  assessors,
  years,
  schools,
  stageParam,
  current,
  hideAssessor,
  hideStatus,
}: ReportFiltersBarProps) {
  const hasActive =
    !!current?.schoolId || !!current?.assessorId || !!current?.yearParam || !!current?.from || !!current?.to || !!current?.status
  return (
    <Card className="p-4">
      <form action={action} method="get" className="flex flex-wrap items-end gap-2 min-w-0">
        {stageParam && <input type="hidden" name="stage" value={stageParam} />}

        {schools && schools.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">المدرسة</span>
            <select name="schoolId" defaultValue={current?.schoolId ?? ""} className={inputClass}>
              <option value="">كل المدارس</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        )}

        {!hideAssessor && assessors.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">مقيّم الجودة</span>
            <select name="assessorId" defaultValue={current?.assessorId ?? ""} className={inputClass}>
              <option value="">كل المقيّمين</option>
              {assessors.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        )}

        {years.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">العام الدراسي</span>
            <select name="year" defaultValue={current?.yearParam ?? ""} className={inputClass}>
              <option value="">كل الأعوام</option>
              {years.map(y => (
                <option key={y.id} value={y.id}>{y.label}</option>
              ))}
              <option value="UNASSIGNED">غير محدد (سجلات قديمة)</option>
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">من تاريخ</span>
          <input type="date" name="from" defaultValue={current?.from ?? ""} className={inputClass} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground">إلى تاريخ</span>
          <input type="date" name="to" defaultValue={current?.to ?? ""} className={inputClass} />
        </label>

        {!hideStatus && (
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground">الحالة</span>
            <select name="status" defaultValue={current?.status ?? ""} className={inputClass}>
              <option value="">حسب الافتراضي</option>
              <option value="COMPLETED">مكتمل</option>
              <option value="IN_PROGRESS">جاري</option>
              <option value="ALL">الكل</option>
            </select>
          </label>
        )}

        <button
          type="submit"
          className="px-4 py-1.5 rounded-lg bg-primary text-white text-[13px] font-medium transition-smooth hover:bg-primary/90"
        >
          تطبيق الفلاتر
        </button>

        {hasActive && (
          <Link
            href={action}
            className="px-3 py-1.5 rounded-lg border border-border text-[12px] text-muted-foreground hover:border-primary/60 transition-smooth"
          >
            مسح
          </Link>
        )}
      </form>
    </Card>
  )
}