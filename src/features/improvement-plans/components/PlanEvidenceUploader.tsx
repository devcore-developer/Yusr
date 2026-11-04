"use client"

import { useRef, useState } from "react"
// عدّل مسار الاستيراد إلى المسار نفسه الذي تستورد منه savePlan في نموذج الإنشاء الحالي
import { uploadPendingEvidence, removePendingEvidence } from "@/features/improvement-plans/actions"

type PendingItem = {
  localKey: string
  id: string | null // null = الرفع لم يكتمل أو فشل
  fileName: string
  fileType: string
  fileSize: number
  error: string | null
}

const ACCEPT = ".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx"
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_EXT = ["png", "jpg", "jpeg", "pdf", "doc", "docx", "xls", "xlsx"]

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`
  return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`
}

/**
 * (التحسين 8) رفع الشواهد أثناء إنشاء الخطة.
 * يوضع داخل <form> نموذج الإنشاء قبل زر الحفظ. يرفع كل ملف فور اختياره
 * إلى تخزين مؤقت آمن، ويعرض الاسم/النوع/الحجم مع زر إزالة قبل الحفظ.
 * الحقول المخفية pendingEvidenceIds تُرسل تلقائيًا مع الحفظ، ويربطها
 * الخادم بالخطة الجديدة داخل نفس المعاملة — بلا أي تغيير في نموذج الإنشاء.
 */
export default function PlanEvidenceUploader() {
  const [items, setItems] = useState<PendingItem[]>([])
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    if (inputRef.current) inputRef.current.value = "" // يسمح بإعادة اختيار نفس الملف بعد إزالته

    const staged: PendingItem[] = files.map((f, i) => ({
      localKey: `${Date.now()}-${i}-${f.name}`,
      id: null,
      fileName: f.name,
      fileType: f.type || "ملف",
      fileSize: f.size,
      error: null,
    }))
    setItems(prev => [...prev, ...staged])
    setBusy(true)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const key = staged[i].localKey
      const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : ""
      const localProblem =
        file.size === 0 ? "الملف فارغ." :
        file.size > MAX_SIZE ? "حجم الملف يتجاوز 5 ميجابايت." :
        !ALLOWED_EXT.includes(ext) ? "نوع غير مدعوم." : null
      if (localProblem) {
        setItems(prev => prev.map(it => (it.localKey === key ? { ...it, error: localProblem } : it)))
        continue
      }
      try {
        const fd = new FormData()
        fd.append("file", file)
        const res = await uploadPendingEvidence(fd)
        if (res.success) {
          setItems(prev => prev.map(it => (it.localKey === key ? { ...it, id: res.id, fileType: res.fileType, fileSize: res.fileSize } : it)))
        } else {
          setItems(prev => prev.map(it => (it.localKey === key ? { ...it, error: res.error } : it)))
        }
      } catch {
        setItems(prev => prev.map(it => (it.localKey === key ? { ...it, error: "تعذر رفع الملف، حاول مجددًا." } : it)))
      }
    }
    setBusy(false)
  }

  const handleRemove = async (item: PendingItem) => {
    setItems(prev => prev.filter(it => it.localKey !== item.localKey))
    if (item.id) {
      try {
        await removePendingEvidence(item.id)
      } catch {
        /* إن فشل الحذف يُنظَّف تلقائيًا بانتهاء الصلاحية (24 ساعة) */
      }
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id="plan-evidence-input"
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <label
        htmlFor="plan-evidence-input"
        className="inline-block cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
      >
        {busy ? "جارٍ الرفع…" : items.length > 0 ? "إضافة المزيد من الملفات" : "رفع شواهد / مرفقات (اختياري)"}
      </label>
      <p className="text-xs text-gray-500">
        الأنواع المسموحة: PNG، JPG، PDF، DOC، DOCX، XLS، XLSX — بحد أقصى 5 ميجابايت للملف.
        تُربط الملفات بالخطة تلقائيًا عند الضغط على حفظ مرة واحدة.
      </p>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map(it => (
            <li key={it.localKey} className="flex items-center gap-2 rounded border border-gray-200 px-2 py-1 text-sm">
              <span className="flex-1 truncate">{it.fileName}</span>
              <span className="text-xs text-gray-500">{formatSize(it.fileSize)}</span>
              {it.error ? (
                <span className="text-xs text-red-600">{it.error}</span>
              ) : it.id ? null : (
                <span className="text-xs text-gray-500">جارٍ الرفع…</span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(it)}
                className="text-xs text-red-600 hover:underline"
              >
                إزالة
              </button>
              {/* الحقول المخفية للملفات المرفوعة بنجاح فقط — تُرسل مع الحفظ تلقائيًا */}
              {it.id ? <input type="hidden" name="pendingEvidenceIds" value={it.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}