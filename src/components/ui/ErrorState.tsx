import * as React from "react"
import { Button } from "./Button"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'حدث خطأ غير متوقع',
  message = 'واجهتنا مشكلة أثناء تحميل البيانات. حاول مرة أخرى.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className ?? ''}`}>
      <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-danger" />
      </div>
      <h3 className="text-base font-semibold text-foreground-strong">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="md" icon={<RefreshCw className="w-4 h-4" />} onClick={onRetry} className="mt-5">
          إعادة المحاولة
        </Button>
      )}
    </div>
  )
}