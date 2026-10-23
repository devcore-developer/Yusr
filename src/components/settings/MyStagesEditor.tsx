// ===== FILE: src/components/settings/MyStagesEditor.tsx =====
"use client"

// ============================================================
// MyStagesEditor — تعديل المراحل التعليمية لحساب مقيّم الجودة من إعداداته
// (هذه المهمة): يعيد استخدام StageChecklist القائم (name="stages") ويستدعي
// الإجراء الخادمي updateMyStages — التحقق النهائي دائمًا على الخادم.
// حالات: تحميل (pending) / نجاح / خطأ — ولا يغير أي شيء آخر في الحساب.
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateMyStages } from "@/app/(dashboard)/settings/actions"
import { StageChecklist } from "@/components/ui/StageChecklist"
import { Button } from "@/components/ui/Button"
import { CheckCircle, AlertTriangle } from "lucide-react"

interface MyStagesEditorProps {
  defaultSelected: string[]
}

export function MyStagesEditor({ defaultSelected }: MyStagesEditorProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    setSaved(false)
    setError(null)
    startTransition(async () => {
      try {
        await updateMyStages(fd)
        setSaved(true)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر حفظ المراحل التعليمية.")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <StageChecklist defaultSelected={defaultSelected} />
      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "جارٍ الحفظ..." : "حفظ المراحل"}
        </Button>
        {saved && !error && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-success">
            <CheckCircle className="w-3.5 h-3.5" /> تم حفظ المراحل التعليمية بنجاح.
          </span>
        )}
        {error && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[#dc2626]">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </span>
        )}
      </div>
      <p className="text-[12px] text-muted-foreground">
        تحديد المراحل يحدد ما يمكنك إنشاء تقييمات له فقط — لا يمس أي بيانات أو نتائج قائمة.
      </p>
    </form>
  )
}