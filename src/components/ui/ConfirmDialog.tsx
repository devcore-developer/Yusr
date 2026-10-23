// ===== FILE: src/components/ui/ConfirmDialog.tsx =====
"use client"

// ============================================================
// ConfirmDialog — نافذة تأكيد داخلية بديلة عن window.confirm الأصلية
// (Task 22-fix — إصلاح شكل رسالة «سيتم إنشاء خطة تحسين» في صفحة الشواهد)
// ============================================================
//
// لماذا؟ نافذة window.confirm الأصلية للمتصفح تُرسم خارج التطبيق (أعلى نافذة
// المتصفح)، لا تحترم اتجاه RTL ولا هوية التصميم، وشكلها رديء — فهي ليست
// جزءًا من واجهة التطبيق إطلاقًا.
//
// هذه النافذة تتبع حرفيًا نمط النوافذ القائم في المشروع
// (NewAssessmentStagePicker): نفس التمركز في وسط الشاشة، ونفس رموز التصميم
// (bg-surface / border-border / text-foreground-strong / transition-smooth)،
// وبلا أي اعتماديات خارجية — تعمل مع أي نسخة.
//
// - النقر على الخلفية أو زر الإغلاق أو Escape = إلغاء (ممنوع أثناء التنفيذ)
// - pending يعطّل كل الأزرار ويمنع الإغلاق حتى تنتهي العملية
// - error يُعرض داخل النافذة وتبقى مفتوحة لإعادة المحاولة (الإجراء لا يضيع)
// - children = جسم الرسالة (فقرات عربية حرة، والرموز الرقمية تعزل بـ dir="ltr" من المستدعي)

import { useEffect } from "react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/Button"
import { X } from "lucide-react"

interface ConfirmDialogProps {
  open: boolean
  /** عنوان النافذة — مثل: «إنشاء خطة تحسين» */
  title: string
  /** أيقونة اختيارية بجوار العنوان (نفس أيقونة الزر المُطلق للنافذة) */
  icon?: ReactNode
  /** جسم الرسالة — فقرات حرة */
  children: ReactNode
  /** نص زر التأكيد — الافتراضي «تأكيد» */
  confirmLabel?: string
  /** نص زر التأكيد أثناء التنفيذ — الافتراضي «جارٍ التنفيذ...» */
  pendingLabel?: string
  /** نص زر الإلغاء — الافتراضي «إلغاء» */
  cancelLabel?: string
  /** العملية جارية — تعطيل الأزرار ومنع الإغلاق */
  pending?: boolean
  /** رسالة خطأ تُعرض داخل النافذة — تبقى النافذة مفتوحة لإعادة المحاولة */
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  icon,
  children,
  confirmLabel = "تأكيد",
  pendingLabel = "جارٍ التنفيذ...",
  cancelLabel = "إلغاء",
  pending = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Escape = إلغاء — ما لم تكن العملية جارية (نفس حماية الخلفية وزر الإغلاق)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, pending, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => { if (!pending) onCancel() }}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface border border-border shadow-lg"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <span className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {icon}
              </span>
            )}
            <h2 className="text-base font-bold text-foreground-strong">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => { if (!pending) onCancel() }}
            className="text-muted-foreground hover:text-foreground-strong transition-smooth"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-sm text-muted-foreground leading-6 space-y-2">{children}</div>

          {error && (
            <p className="text-[12px] text-danger leading-5">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="md" disabled={pending} onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button type="button" variant="primary" size="md" disabled={pending} onClick={onConfirm}>
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

