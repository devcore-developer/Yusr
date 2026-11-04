"use client"

// ============================================================
// PlanEvidencePicker — منتقي الشواهد داخل نموذج إنشاء الخطة (التحسين 8)
// ============================================================
// (التحسين 8 — إضافة فقط) مكوّن جديد كليًا — لا يستبدل ولا يعدل أي مكوّن قائم.
//
// ما هو وما هو ليس:
//   - هو: قائمة انتقاء محلية داخل النموذج — تعرض الملفات المختارة (الاسم
//     والنوع والحجم) وتسمح بإزالتها قبل الحفظ، مع فحص فوري (الصيغة/الحجم/
//     التكرار) لتغذية راجعة سريعة.
//   - ليس: رافعًا — لا يرسل ولا بايت للخادم. الملفات تبقى في حالة النموذج
//     في المتصفح، وعند الضغط على «حفظ الخطة» مرة واحدة تُربط بالخطة الجديدة
//     عبر attachPlanEvidenceAfterCreate (إجراء الرفع القائم المرخص).
//
// conventions المشروع المُعاد استخدامها حرفيًا: نفس أزرار/شارات/ألوان/أيقونات
// بطاقة «رفع الشواهد» القائمة (PlanEvidenceUpload) وبلا truncate في الأسماء.
// ============================================================

import { useRef, useState } from "react"
import {
  EVIDENCE_PICKER_ACCEPT,
  filterPendingEvidence,
} from "@/features/improvement-plans/evidence-submit"
import {
  EVIDENCE_TYPE_LABELS,
  formatEvidenceSize,
  getFileExtension,
} from "@/features/improvement-plans/evidence-validation"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Upload, FileText, X, Paperclip, AlertCircle } from "lucide-react"

interface PlanEvidencePickerProps {
  /** الملفات المُنتقاة — مملوكة لنموذج الإنشاء (مصدر الحقيقة الواحد) */
  files: File[]
  onChange: (files: File[]) => void
  /** أثناء الحفظ يُجمَّد المنتقي حتى لا تتغير القائمة أثناء الربط */
  disabled?: boolean
}

export function PlanEvidencePicker({ files, onChange, disabled = false }: PlanEvidencePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = (picked: FileList | null) => {
    if (!picked || picked.length === 0 || disabled) return
    setError(null)

    const { accepted, rejected } = filterPendingEvidence(files, Array.from(picked))
    if (rejected.length > 0) {
      setError(rejected.map((r) => `«${r.fileName}»: ${r.reason}`).join(" — "))
    }
    if (accepted.length > 0) onChange([...files, ...accepted])

    // إعادة ضبط الحقل حتى يُقبل اختيار نفس الملف من جديد بعد إزالته
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleRemove = (index: number) => {
    if (disabled) return
    setError(null)
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-primary" />
          <h3 className="font-bold">رفع الشواهد</h3>
        </div>
        <label className={disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
          {/* نمط الرفع القائم: label يغلف input مخفيًا — هنا multiple لاختيار عدة ملفات */}
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-white transition-smooth hover:opacity-90">
            <Upload className="w-4 h-4" />
            إضافة شواهد
          </span>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept={EVIDENCE_PICKER_ACCEPT}
            disabled={disabled}
            onChange={(e) => {
              handleAdd(e.target.files)
              e.currentTarget.value = ""
            }}
          />
        </label>
      </div>

      <p className="text-xs text-muted-foreground leading-5">
        اختر ملفات الشواهد (PNG، JPG، JPEG، PDF، DOC، DOCX، XLS، XLSX — بحد أقصى 5 ميجابايت للملف).
        تُرفع الشواهد وتُربط بالخطة تلقائيًا عند الضغط على «حفظ الخطة»، ويمكنك إزالة أي ملف قبل الحفظ.
      </p>

      {error && (
        <p className="flex items-start gap-1.5 text-[12px] text-danger leading-5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}

      {files.length > 0 ? (
        <ul className="divide-y divide-border/70 rounded-lg border border-border">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-surface-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                {/* بلا truncate — اسم الملف يلتف طبيعيًا ويظل داخل حدود الصف */}
                <span className="min-w-0 break-words text-sm font-medium">{file.name}</span>
                <Badge variant="neutral">
                  {EVIDENCE_TYPE_LABELS[getFileExtension(file.name)] || file.type || "ملف"}
                </Badge>
                <span className="text-xs text-muted-foreground numeric">{formatEvidenceSize(file.size)}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<X className="w-4 h-4" />}
                onClick={() => handleRemove(index)}
                disabled={disabled}
              >
                إزالة
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">لم يتم اختيار شواهد بعد.</p>
      )}
    </div>
  )
}