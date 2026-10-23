// ===== FILE: src/components/surveys/SurveyLinkControl.tsx =====
"use client"

// ============================================================
// SurveyLinkControl — ربط/فك ربط استبانة ببند من قائمة الاستبانات
// عميل فقط (استدعاء أكشن خادمي محمي بالأدوار) — التحقق الحقيقي على الخادم.
// يستخدم المعرّفات المستقرة فقط (لا مطابقة نصية).
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Link2, Loader2, Unlink } from "lucide-react"
import { linkSurveyToIndicator } from "@/features/survey-integration/actions"

export interface SurveyLinkControlProps {
  surveyId: string
  currentIndicatorId: string | null
  /** قائمة بنود الإطار الرسمي (id/code/description) — تُمرر من الصفحة الخادمية */
  indicators: { id: string; code: string; description: string }[]
  /** صلاحية العرض فقط — التحقق الفعلي على الخادم (SA / مدير المدرسة) */
  canManage: boolean
}

export function SurveyLinkControl({ surveyId, currentIndicatorId, indicators, canManage }: SurveyLinkControlProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>(currentIndicatorId ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!canManage) return null

  const save = () => {
    setError(null)
    startTransition(async () => {
      const res = await linkSurveyToIndicator({
        surveyId,
        indicatorId: selected === "" ? null : selected,
      })
      if (!res.success) {
        setError(res.error ?? "تعذر حفظ الربط.")
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setSelected(currentIndicatorId ?? ""); setError(null); setOpen(true) }}
        className="inline-flex items-center gap-1.5 text-[12px] text-secondary hover:underline shrink-0"
      >
        {currentIndicatorId ? <Unlink className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        {currentIndicatorId ? "تعديل الربط / فك الربط" : "ربط بمؤشر"}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={pending}
        className="h-9 px-2 rounded-md border border-border bg-surface text-[12px] min-w-0 max-w-[280px]"
      >
        <option value="">— بدون ربط (استبانة مستقلة) —</option>
        {indicators.map(ind => (
          <option key={ind.id} value={ind.id}>{ind.code} — {ind.description}</option>
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