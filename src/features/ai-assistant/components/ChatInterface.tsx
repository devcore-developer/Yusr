"use client"

import { useState } from "react"
import { Button } from "@/components/ui/Button"
import { Textarea } from "@/components/ui/Textarea"
import { Badge } from "@/components/ui/Badge"
import { useToast } from "@/components/ui/Toast"
import { generateAIResponse } from "../actions"
import {
  Sparkles, Send, Loader2, TrendingUp, AlertTriangle,
  ClipboardCheck, BarChart3
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
}

export function ChatInterface() {
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSend = async (text?: string) => {
    const message = (text || input).trim()
    if (!message || loading) return

    setMessages(prev => [...prev, { role: "user", content: message }])
    setInput("")
    setLoading(true)

    try {
      const aiResponse = await generateAIResponse(message)
      setMessages(prev => [...prev, { role: "assistant", content: aiResponse }])
    } catch {
      toast({ variant: "error", title: "تعذر تشغيل المساعد الذكي", description: "حاول مرة أخرى لاحقاً." })
    }
    setLoading(false)
  }

  const suggestions = [
    { icon: <AlertTriangle className="w-4 h-4" />, text: "ما أهم الفجوات الحالية؟", tone: "danger" as const },
    { icon: <ClipboardCheck className="w-4 h-4" />, text: "لخص أداء التقييمات الأخيرة", tone: "info" as const },
    { icon: <TrendingUp className="w-4 h-4" />, text: "ما المجالات التي تحتاج متابعة؟", tone: "warning" as const },
    { icon: <BarChart3 className="w-4 h-4" />, text: "حلل تقدم خطط التحسين", tone: "violet" as const },
  ]

  return (
    <div className="space-y-4">
      {/* AI context header */}
      <div className="flex items-center gap-3 p-4 bg-violet/5 border border-violet/15 rounded-lg">
        <div className="w-10 h-10 rounded-lg bg-violet/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-violet" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground-strong">المساعد الذكي للجودة</p>
          <p className="text-[12px] text-muted-foreground">يحلل بيانات التقييمات والفجوات وخطط التحسين</p>
        </div>
        <Badge variant="violet" dot>متصل</Badge>
      </div>

      {/* Conversation area */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-premium">
        {/* Messages */}
        <div className="p-4 lg:p-6 space-y-4 min-h-[320px] max-h-[500px] overflow-y-auto scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-violet/10 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-violet" />
              </div>
              <h3 className="text-base font-semibold text-foreground-strong">كيف يمكنني مساعدتك؟</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-5">اختر سؤالاً مقترحاً أو اكتب سؤالك الخاص</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.text}
                    onClick={() => handleSend(s.text)}
                    className="flex items-center gap-2 p-3 text-right rounded-lg border border-border bg-surface hover:bg-surface-muted hover:border-violet/30 transition-smooth group"
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      s.tone === "danger" ? "tint-danger" :
                      s.tone === "info" ? "tint-info" :
                      s.tone === "warning" ? "tint-amber" : "tint-violet"
                    )}>
                      {s.icon}
                    </div>
                    <span className="text-[13px] text-foreground-strong">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] p-3.5 rounded-lg",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tl-none"
                  : "bg-surface-muted border border-border rounded-tr-none"
              )}>
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border">
                    <Sparkles className="w-3.5 h-3.5 text-violet" />
                    <span className="text-[11px] font-medium text-violet">تحليل المساعد</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-muted border border-border p-3.5 rounded-lg rounded-tr-none flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-violet" />
                <span className="text-sm text-muted-foreground">جاري التحليل...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border p-3 lg:p-4 flex gap-2 items-end">
          <Textarea
            placeholder="اكتب سؤالك هنا..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[44px] max-h-[120px] resize-none bg-surface-muted/50"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            icon={<Send className="w-4 h-4" />}
            className="shrink-0"
          />
        </div>
      </div>
    </div>
  )
}