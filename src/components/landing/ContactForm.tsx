"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { submitContactMessage } from "@/features/landing/actions"
import { Send, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

export function ContactForm() {
  const [state, setState] = useState<{ loading: boolean; success: boolean; error: string | null }>({
    loading: false,
    success: false,
    error: null,
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setState({ loading: true, success: false, error: null })
    
    const formData = new FormData(e.currentTarget)
    const res = await submitContactMessage(formData)

    if (res.error) {
      setState({ loading: false, success: false, error: res.error })
    } else {
      setState({ loading: false, success: true, error: null })
      e.currentTarget.reset()
    }
  }

  // استخراج الأيقونة إلى متغير لتجنب أخطاء الـ JSX Parser
  const buttonIcon = state.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {state.success && (
        <div className="flex items-center gap-2 p-4 bg-success/10 text-success rounded-lg text-sm font-medium border border-success/20">
          <CheckCircle className="w-4 h-4" /> تم إرسال رسالتك بنجاح، سنقوم بالتواصل معك قريباً.
        </div>
      )}
      {state.error && (
        <div className="flex items-center gap-2 p-4 bg-danger/10 text-danger rounded-lg text-sm font-medium border border-danger/20">
          <AlertCircle className="w-4 h-4" /> {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[14px] font-semibold text-foreground-strong">الاسم <span className="text-danger">*</span></label>
          <Input name="name" required placeholder="الاسم الكامل" className="h-11 text-[15px] bg-surface-muted/50 border-border focus:bg-surface" />
        </div>
        <div className="space-y-2">
          <label className="text-[14px] font-semibold text-foreground-strong">اسم المؤسسة (اختياري)</label>
          <Input name="institution" placeholder="اسم المدرسة أو المؤسسة" className="h-11 text-[15px] bg-surface-muted/50 border-border focus:bg-surface" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[14px] font-semibold text-foreground-strong">البريد الإلكتروني <span className="text-danger">*</span></label>
          <Input name="email" type="email" required placeholder="example@domain.com" className="h-11 text-[15px] bg-surface-muted/50 border-border focus:bg-surface" />
        </div>
        <div className="space-y-2">
          <label className="text-[14px] font-semibold text-foreground-strong">رقم التواصل (اختياري)</label>
          <Input name="phone" placeholder="05xxxxxxxx" className="h-11 text-[15px] bg-surface-muted/50 border-border focus:bg-surface" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[14px] font-semibold text-foreground-strong">موضوع الرسالة <span className="text-danger">*</span></label>
        <Input name="subject" required placeholder="موضوع الرسالة" className="h-11 text-[15px] bg-surface-muted/50 border-border focus:bg-surface" />
      </div>

      <div className="space-y-2">
        <label className="text-[14px] font-semibold text-foreground-strong">نص الرسالة <span className="text-danger">*</span></label>
        <Textarea name="message" required rows={5} placeholder="اكتب رسالتك هنا..." className="text-[15px] bg-surface-muted/50 border-border focus:bg-surface p-3" />
      </div>

      <div className="pt-2">
        <Button type="submit" size="lg" disabled={state.loading} icon={buttonIcon} className="w-full md:w-auto">
          {state.loading ? "جاري الإرسال..." : "إرسال الرسالة"}
        </Button>
      </div>
    </form>
  )
}