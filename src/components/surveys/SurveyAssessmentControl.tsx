// ===== FILE: src/components/surveys/SurveyAssessmentControl.tsx =====
"use client"

// ============================================================
// SurveyAssessmentControl — إسناد/فك إسناد استبانة قائمة إلى تقييم
// عميل فقط (استدعاء أكشن خادمي محمي بالأدوار) — التحقق الحقيقي على الخادم:
// الوجود + النطاق + قيد «نفس مدرسة الاستبانة» كلها تُفرض في linkSurveyToAssessment.
// الخيارات المعروضة محدودة أصلًا بتقييمات مدرسة الاستبانة نفسها (فلترة هنا للعرض
// فقط — ليست حماية)، والفك الصريح يعيد الاستبانة إلى «سجل تاريخي» كما كانت.
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Link2, Loader2, Unlink } from "lucide-react"
import { linkSurveyToAssessment } from "@/features/survey-integration/actions"
import { HISTORICAL_SURVEY_ASSESSMENT_LABEL } from "@/features/survey-integration/assessment-link"

export interface SurveyAssessmentControlProps {
  surveyId: string
  currentAssessmentId: string | null
  /** مدرسة الاستبانة المخزّنة — تُقيَّد بها الخيارات المعروضة (عرضًا) */
  surveySchoolId: string | null
  /** تقييمات نطاق المستخدم (id/schoolId/label جاهز للعرض) — تُمرر من الصفحة الخادمية */
  assessments: { id: string; schoolId: string; label: string }[]
  /** صلاحية العرض فقط — التحقق الفعلي على الخادم (SA / مدير المدرسة) */
  canManage: boolean
}

export function SurveyAssessmentControl({
  surveyId,
  currentAssessmentId,
  surveySchoolId,
  assessments,
  canManage,
}: SurveyAssessmentControlProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>(currentAssessmentId ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!canManage) return null

  // خيارات الاستبانة الواحدة: تقييمات مدرستها المخزّنة فقط —
  // استبانة بلا مدرسة مخزّنة (schoolId = null) لا يُعرض لها أي خيار إسناد
  const eligibleOptions = surveySchoolId
    ? assessments.filter((a) => a.schoolId === surveySchoolId)
    : []

  const save = () => {
    setError(null)
    // (توافق الأنواع الصارمة) startTransition في أنواع React 18 يقبل دالة متزامنة حصرًا —
    // الـPromise يُطلق fire-and-forget بنفس سلوك React 18 وقت التشغيل، والسلوك كما هو.
    startTransition(() => {
      void (async () => {
        const res = await linkSurveyToAssessment({
          surveyId,
          assessmentId: selected === "" ? null : selected,
        })
        if (!res.success) {
          setError(res.error ?? "تعذر حفظ الإسناد.")
          return
        }
        setOpen(false)
        router.refresh()
      })()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setSelected(currentAssessmentId ?? ""); setError(null); setOpen(true) }}
        className="inline-flex items-center gap-1.5 text-[12px] text-secondary hover:underline shrink-0"
      >
        {currentAssessmentId ? <Unlink className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        {currentAssessmentId ? "تعديل التقييم المرتبط / فك الإسناد" : "إسناد إلى تقييم"}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={pending}
        className="h-9 px-2 rounded-md border border-border bg-surface text-[12px] min-w-0 max-w-[420px]"
      >
        <option value="">— {HISTORICAL_SURVEY_ASSESSMENT_LABEL} —</option>
        {eligibleOptions.map((a) => (
          <option key={a.id} value={a.id}>{a.label}</option>
        ))}
      </select>
      <Button type="button" size="sm" variant="soft" onClick={save} disabled={pending}
        icon={pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}>
        حفظ
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => { setOpen(false); setError(null) }} disabled={pending}>
        إلغاء
      </Button>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  )
}