"use client"

// ============================================================
// PlanEvidenceUpload — قسم «رفع الشواهد» داخل صفحة الخطة (مكوّن مضاف حصرًا)
// ============================================================
// (التحسين 7 — إضافة فقط) مكوّن جديد كليًا يُدرج داخل بطاقة واحدة في صفحتي
// تفاصيل الخطة القائمتين دون أي تغيير في بقية الصفحتين أو أي مكوّن آخر.
//
// conventions المشروع المُعاد استخدامها حرفيًا:
//   - نمط الرفع القائم في محرك التقييم (AssessmentEngine): label + input file
//     مخفي + FileReader.readAsDataURL → Server Action — نفس المسار والشكل.
//   - نمط عرض الأخطاء المضمن (EvidencePlanActions): فقرة خطأ داخل القسم بدل
//     نوافذ المتصفح، والقسم يبقى صالحًا لإعادة المحاولة.
//   - نفس مكونات التصميم: Button / Badge / أيقونات lucide-react، ونفس
//     رموز الألوان (text-muted-foreground، text-danger، divide-border...).
//   - التحقق السريع على العميل تسهيل فقط — الخادم هو المصدر الفاصل
//     (validateEvidenceFile على الخادم داخل uploadPlanEvidence).
//   - لا truncate في أي اسم ملف — يلتف طبيعيًا داخل حدود الصف (قاعدة المنصة).
// ============================================================

import { useState } from "react"
import { uploadPlanEvidence, getPlanEvidenceFile } from "@/features/improvement-plans/evidence-actions"
import {
  ALLOWED_EVIDENCE_EXTENSIONS,
  EVIDENCE_TYPE_LABELS,
  MAX_EVIDENCE_SIZE_BYTES,
  formatEvidenceSize,
  getFileExtension,
  type PlanEvidenceRow,
} from "@/features/improvement-plans/evidence-validation"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Upload, FileText, Download, Paperclip, AlertCircle } from "lucide-react"

interface PlanEvidenceUploadProps {
  planId: string
  /** الرفع لمقيّم الجودة مالك الخطة فقط — يحدده الخادم والصفحة معًا (نفس بوابة isOwner القائمة) */
  canUpload: boolean
  /** الشواهد المخزنة من قاعدة البيانات — بلا محتوى الملفات (لا يُرسل لمتصفح القائمة) */
  initialEvidence: PlanEvidenceRow[]
}

/** قراءة الملف Data URL — نفس آلية الرفع القائمة في AssessmentEngine حرفيًا */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"))
    reader.readAsDataURL(file)
  })
}

/** ملصق نوع الشاهد للعرض: من الامتداد (المصدر المقروء) ثم MIME المخزن احتياطًا */
function evidenceTypeLabel(row: PlanEvidenceRow): string {
  const ext = getFileExtension(row.fileName)
  return EVIDENCE_TYPE_LABELS[ext] || row.fileType || "ملف"
}

const UPLOAD_ACCEPT = ".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx"

export function PlanEvidenceUpload({ planId, canUpload, initialEvidence }: PlanEvidenceUploadProps) {
  const [items, setItems] = useState<PlanEvidenceRow[]>(initialEvidence)
  const [uploading, setUploading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handlePick = async (file: File) => {
    if (uploading) return
    setError(null)

    // تحقق سريع على العميل لرسالة فورية — الخادم يكرر نفس القواعد ويحسم (أمنيًا)
    const ext = getFileExtension(file.name)
    if (!(ALLOWED_EVIDENCE_EXTENSIONS as readonly string[]).includes(ext)) {
      setError("نوع الملف غير مدعوم. الصيغ المسموحة: PNG، JPG، JPEG، PDF، DOC، DOCX، XLS، XLSX.")
      return
    }
    if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
      setError("حجم الملف يتجاوز الحد الأقصى المسموح (5 ميجابايت). اختر ملفًا أصغر.")
      return
    }

    setUploading(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const res = await uploadPlanEvidence(planId, { name: file.name, type: file.type, size: file.size, data: dataUrl })
      if (res.success) {
        // الأحدث أولًا — نفس ترتيب القائمة القادمة من الخادم
        setItems(prev => [res.evidence, ...prev])
      } else {
        setError(res.error)
      }
    } catch {
      setError("حدث خطأ أثناء رفع الملف. تأكد من اتصالك ثم حاول من جديد.")
    } finally {
      setUploading(false)
    }
  }

  // التنزيل عبر الإجراء الخادمي المرخص (canViewPlan على الخادم) — ثم إنزال بنفس
  // آلية Data URL القائمة في محرك التقييم، والملف يُنزّل باسمه الأصلي كما هو
  const handleDownload = async (item: PlanEvidenceRow) => {
    setError(null)
    setDownloadingId(item.id)
    try {
      const res = await getPlanEvidenceFile(item.id)
      if (!res.success) {
        setError(res.error)
        return
      }
      const link = document.createElement("a")
      link.href = res.dataUrl
      link.download = res.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      setError("تعذر تنزيل الملف. حاول من جديد.")
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-primary" />
          <h3 className="font-bold">رفع الشواهد</h3>
        </div>
        {canUpload && (
          <label className={uploading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}>
            {/* نمط الرفع القائم في محرك التقييم: label يغلف input مخفيًا — بلا زر متداخل */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-white transition-smooth hover:opacity-90">
              <Upload className="w-4 h-4" />
              {uploading ? "جارٍ الرفع..." : "رفع شاهد"}
            </span>
            <input
              type="file"
              className="hidden"
              accept={UPLOAD_ACCEPT}
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handlePick(file)
                // إعادة ضبط الحقل حتى يُقبل نفس الملف من جديد بعد رفضه
                e.currentTarget.value = ""
              }}
            />
          </label>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-5">
        الصيغ المسموحة: PNG، JPG، JPEG، PDF، DOC، DOCX، XLS، XLSX — الحد الأقصى 5 ميجابايت للملف الواحد.
      </p>

      {error && (
        <p className="flex items-start gap-1.5 text-[12px] text-danger leading-5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}

      {items.length > 0 ? (
        <ul className="divide-y divide-border/70 rounded-lg border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 hover:bg-surface-muted/40">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                {/* بلا truncate — اسم الملف يلتف طبيعيًا ويظل داخل حدود الصف */}
                <span className="min-w-0 break-words text-sm font-medium">{item.fileName}</span>
                <Badge variant="neutral">{evidenceTypeLabel(item)}</Badge>
                <span className="text-xs text-muted-foreground numeric">{formatEvidenceSize(item.fileSize)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleDateString("ar-SA")}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={() => handleDownload(item)}
                disabled={downloadingId === item.id}
              >
                {downloadingId === item.id ? "جارٍ التحضير..." : "تحميل"}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">لا توجد شواهد مرفوعة بعد.</p>
      )}
    </div>
  )
}