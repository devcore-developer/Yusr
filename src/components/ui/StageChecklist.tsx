// ===== FILE: src/components/ui/StageChecklist.tsx =====
"use client"

// ============================================================
// StageChecklist — قائمة اختيار متعدد للمراحل التعليمية
// تُستخدم في نماذج إنشاء/تعديل الحسابات (مقيّم الجودة، مدير القسم)
// تعمل عبر FormData (name="stages") — التحقق النهائي دائمًا على الخادم
// عبر applyUserStageAssignments / normalizeStageIds.
// هوية زرقاء، RTL، بلا أي مكوّنات خارجية.
// ============================================================

import { EDUCATIONAL_STAGES } from "@/lib/stages"

interface StageChecklistProps {
  /** اسم الحقل في النموذج (افتراضي stages — اقرأه بـ formData.getAll("stages")) */
  name?: string
  /** المراحل المعينة مسبقًا عند تعديل حساب */
  defaultSelected?: string[]
  disabled?: boolean
}

export function StageChecklist({ name = "stages", defaultSelected = [], disabled = false }: StageChecklistProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] font-medium text-foreground-strong">
        المراحل التعليمية المصرح بها
      </label>
      <p className="text-[11px] text-muted-foreground">
        اختر مرحلة أو أكثر — يمكن للمستخدم إنشاء التقييمات ضمن هذه المراحل فقط.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
        {EDUCATIONAL_STAGES.map(stage => {
          const checked = defaultSelected.includes(stage.id)
          return (
            <label
              key={stage.id}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-smooth select-none ${
                disabled
                  ? "opacity-60 cursor-not-allowed border-border bg-surface-muted"
                  : checked
                    ? "border-primary bg-primary/5 cursor-pointer"
                    : "border-border bg-white hover:border-primary/50 cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                name={name}
                value={stage.id}
                defaultChecked={checked}
                disabled={disabled}
                className="w-4 h-4 rounded accent-primary shrink-0"
              />
              <span className="text-foreground-strong">{stage.ar}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}