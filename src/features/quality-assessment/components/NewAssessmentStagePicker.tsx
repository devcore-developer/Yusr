"use client"

// ============================================================
// NewAssessmentStagePicker — زر «تقييم جديد» مع اختيار المرحلة التعليمية
// يفتح نافذة فيها قائمة المراحل المصرح بها لهذا المستخدم (اختيار واحد —
// كل تقييم ينتمي لمرحلة واحدة بالضبط) ثم ينشئ التقييم عبر الخادم،
// حيث يُتحقق من التخويل مرة أخرى (assertStageCreationAllowed).
// ملاحظة الفرق: هذه قائمة «اختيار واحد» لإنشاء تقييم — أما قائمة الحسابات
// (StageChecklist) فاختيار متعدد لتعيين المراحل للمستخدمين.
// النافذة مضمّنة هنا بلا أي اعتماد على مكون Modal خارجي — تعمل مع أي نسخة.
// ============================================================

import { useState, useTransition } from "react"
import { createNewAssessment } from "@/features/quality-assessment/actions"
import { Button } from "@/components/ui/Button"
import { Plus, X } from "lucide-react"

interface StageOption {
  id: string
  label: string
}

interface NewAssessmentStagePickerProps {
  /** المراحل المسموح بها لهذا المستخدم (محسوبة على الخادم حسب الدور والتعيينات) */
  stages: StageOption[]
  /** عند تعيينها: الحساب محجوب عن الإنشاء (مثلاً مقيّم بلا تعيينات) */
  blockedReason?: string
}

export function NewAssessmentStagePicker({ stages, blockedReason }: NewAssessmentStagePickerProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const blocked = !!blockedReason || stages.length === 0

  const handleCreate = () => {
    if (!selected) return
    // لا نلفّ الاستدعاء بـ try/catch: redirect من الخادم يُعالج تلقائيًا،
    // وأخطاء التخويل تظهر كرسالة واضحة.
    startTransition(async () => {
      await createNewAssessment(selected)
    })
  }

  return (
    <>
      <span title={blocked ? blockedReason || "لا توجد مراحل معينة لحسابك" : undefined}>
        <Button
          type="button"
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          disabled={blocked}
          onClick={() => { setSelected(null); setOpen(true) }}
        >
          تقييم جديد
        </Button>
      </span>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { if (!pending) setOpen(false) }}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface border border-border shadow-lg"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="اختر المرحلة التعليمية"
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
              <div>
                <h2 className="text-base font-bold text-foreground-strong">اختر المرحلة التعليمية</h2>
                <p className="text-[12px] text-muted-foreground mt-1">
                  سيُنشأ التقييم لمرحلة واحدة محددة — لا يمكن دمج عدة مراحل في تقييم واحد.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { if (!pending) setOpen(false) }}
                className="text-muted-foreground hover:text-foreground-strong transition-smooth"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {stages.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد مراحل متاحة لحسابك.</p>
              ) : (
                <div className="space-y-2" role="radiogroup" aria-label="المرحلة التعليمية">
                  {stages.map(stage => {
                    const active = selected === stage.id
                    return (
                      <label
                        key={stage.id}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm cursor-pointer transition-smooth ${
                          active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="assessment-stage"
                          value={stage.id}
                          checked={active}
                          onChange={() => setSelected(stage.id)}
                          className="w-4 h-4 accent-primary shrink-0"
                        />
                        <span className="text-foreground-strong font-medium">{stage.label}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  disabled={!selected || pending}
                  onClick={handleCreate}
                >
                  {pending ? "جارٍ الإنشاء..." : "بدء التقييم"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}