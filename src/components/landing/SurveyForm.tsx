"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { addSurvey } from "@/features/landing/actions"
import { Loader2, CheckCircle } from "lucide-react"

interface SurveyFormProps {
  evidenceTexts: { tool: string; text: string }[]
}

export function SurveyForm({ evidenceTexts }: SurveyFormProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  // تجميع الشواهد حسب الأداة
  const groupedEvidence = evidenceTexts.reduce((acc, item) => {
    if (!acc[item.tool]) acc[item.tool] = []
    acc[item.tool].push(item.text)
    return acc
  }, {} as Record<string, string[]>)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setSuccess(false)
    
    const formData = new FormData(e.currentTarget)
    try {
      await addSurvey(formData)
      setSuccess(true)
      e.currentTarget.reset()
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error(error)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 p-3 bg-success/10 text-success rounded-lg text-sm">
          <CheckCircle className="w-4 h-4" /> تم إضافة نتيجة الاستبانة بنجاح.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">نوع الاستبانة</label>
          <select name="type" className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm">
            <option value="استبانة الطلاب">استبانة الطلاب</option>
            <option value="استبانة المعلمين">استبانة المعلمين</option>
            <option value="استبانة أولياء الأمور">استبانة أولياء الأمور</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">النسبة المئوية %</label>
          <Input name="percentage" type="number" min="0" max="100" step="0.1" required placeholder="85.5" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">تضمين في التقييم؟</label>
          <select name="include" className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm">
            <option value="false">لا (فقط للعرض)</option>
            <option value="true">نعم (تدخل في النسبة)</option>
          </select>
        </div>
      </div>

      {/* حقل النتيجة العامة للاستبانة */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">النتيجة العامة للاستبانة</label>
        <select name="generalResult" className="w-full h-10 px-3 rounded-md border border-border bg-surface text-sm">
          <option value="">-- اختر النتيجة العامة --</option>
          {Object.entries(groupedEvidence).map(([tool, texts]) => (
            <optgroup key={tool} label={tool}>
              {texts.map((text, idx) => (
                <option key={idx} value={text}>{text}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">ملاحظات</label>
        <Textarea name="note" placeholder="عدد المستجيبين، الفترة، إلخ..." rows={2} />
      </div>
      <Button type="submit" disabled={loading} icon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}>
        {loading ? "جاري الحفظ..." : "حفظ النتيجة"}
      </Button>
    </form>
  )
}