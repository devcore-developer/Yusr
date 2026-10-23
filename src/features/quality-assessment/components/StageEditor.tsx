// ===== FILE: src/features/quality-assessment/components/StageEditor.tsx =====
"use client"

// ============================================================
// StageEditor — قسم المرحلة التعليمية في واجهة تفاصيل التقييم (§5)
// قسم صغير فوق محرك التقييم: يعرض المرحلة الحالية ويتيح تعديلها
// للصلاحيات المسموحة وفق سياسة getStageEditPolicy (تُفرض على الخادم
// في updateAssessmentStage — الواجهة هنا مجرد انعكاس للسياسة).
// التحديث يغيّر حقل stage فقط — لا يمس أي بيانات أخرى للتقييم.
// القائمة المنسدلة هنا عنصر select أصلي — بلا أي اعتماد على مكون خارجي.
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateAssessmentStage } from "@/features/quality-assessment/actions"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { getStageOptions, getStageLabel } from "@/lib/stages"
import { GraduationCap } from "lucide-react"

interface StageEditorProps {
  assessmentId: string
  /** المرحلة الحالية — null للسجلات التاريخية */
  currentStage: string | null
  /** محسوبة على الخادم عبر getStageEditPolicy */
  canEdit: boolean
  /** سبب المنع (تُعرض بدل عناصر التعديل) */
  lockHint?: string
  /** (هذه المهمة) التقييم مكتمل — تعديل مرحلة سجل مكتمل يحتاج تأكيدًا صريحًا
      (الخادم يسجل العملية في Activity = قابلة للتدقيق) */
  isCompleted?: boolean
}

export function StageEditor({ assessmentId, currentStage, canEdit, lockHint, isCompleted }: StageEditorProps) {
  const router = useRouter()
  const [value, setValue] = useState<string>(currentStage ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const options = getStageOptions()
  const dirty = value !== (currentStage ?? "")

  const handleSave = () => {
    if (!value) return
    // (هذه المهمة) تأكيد صريح قبل تغيير مرحلة تقرير مكتمل — حماية سلامة السجل التاريخي:
    // لا تغيير صامت إطلاقًا، والخادم يسجل التغيير في سجل النشاط (Activity).
    if (isCompleted) {
      const confirmed = window.confirm(
        "أنت على وشك تعديل المرحلة التعليمية لتقرير مكتمل.\n" +
        "سيظهر التقرير ضمن تقارير المرحلة الجديدة وقد يؤثر ذلك على قراءته التاريخية.\n" +
        "سيُسجَّل هذا التعديل في سجل النشاط باسم حسابك. هل تريد المتابعة؟"
      )
      if (!confirmed) return
    }
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await updateAssessmentStage(assessmentId, value)
        setSaved(true)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر حفظ المرحلة التعليمية.")
      }
    })
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground-strong">المرحلة التعليمية</h3>
            <p className="text-[12px] text-muted-foreground">
              تصنيف هذا التقييم — كل تقييم تابع لمرحلة واحدة، ولا يؤثر تغييرها على أي استجابات أو نتائج.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!canEdit && <Badge variant={currentStage ? "info" : "neutral"}>{getStageLabel(currentStage)}</Badge>}
            {canEdit && (
              <>
                <select
                  value={value}
                  onChange={e => { setValue(e.target.value); setSaved(false) }}
                  aria-label="المرحلة التعليمية"
                  className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground-strong focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="" disabled>اختر المرحلة</option>
                  {options.map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!value || !dirty || pending}
                  onClick={handleSave}
                >
                  {pending ? "جارٍ الحفظ..." : "حفظ"}
                </Button>
              </>
            )}
          </div>
        </div>

        {!canEdit && lockHint && (
          <p className="text-[12px] text-muted-foreground mt-3">{lockHint}</p>
        )}
        {canEdit && !currentStage && (
          <p className="text-[12px] mt-3 text-warning">
            سجل تاريخي بلا مرحلة — عيّن المرحلة الصحيحة لتظهر في تقارير المراحل.
          </p>
        )}
        {canEdit && currentStage && isCompleted && (
          <p className="text-[12px] mt-3 text-muted-foreground">
            التقييم مكتمل ومرحلته محفوظة — أي تعديل يتطلب تأكيدًا صريحًا ويُسجل في سجل النشاط.
          </p>
        )}
        {saved && !error && (
          <p className="text-[12px] mt-3 text-success">تم حفظ المرحلة التعليمية بنجاح.</p>
        )}
        {error && <p className="text-[12px] mt-3 text-[#dc2626]">{error}</p>}
      </CardContent>
    </Card>
  )
}