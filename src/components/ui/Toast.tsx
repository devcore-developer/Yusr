"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react"

type ToastVariant = "success" | "error" | "warning" | "info"

interface ToastItem {
  id: string
  variant: ToastVariant
  title: string
  description?: string
}

interface ToastContextType {
  toast: (t: Omit<ToastItem, "id">) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

const variantConfig: Record<ToastVariant, { icon: React.ReactNode; className: string }> = {
  success: { icon: <CheckCircle className="w-5 h-5 text-success" />, className: "border-success/20" },
  error: { icon: <AlertCircle className="w-5 h-5 text-danger" />, className: "border-danger/20" },
  warning: { icon: <AlertTriangle className="w-5 h-5 text-warning" />, className: "border-warning/20" },
  info: { icon: <Info className="w-5 h-5 text-secondary" />, className: "border-secondary/20" },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { ...t, id }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]">
        {toasts.map(t => {
          const cfg = variantConfig[t.variant]
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-start gap-3 p-4 bg-surface rounded-lg shadow-lg border animate-in slide-in-from-bottom-5 duration-200",
                cfg.className
              )}
            >
              <div className="shrink-0 mt-0.5">{cfg.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground-strong">{t.title}</p>
                {t.description && <p className="text-[13px] text-muted-foreground mt-0.5">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}