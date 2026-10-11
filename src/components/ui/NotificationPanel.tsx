"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { Bell, CheckCircle, AlertTriangle, Info, X } from "lucide-react"

interface Notification {
  id: string
  title: string
  description?: string
  type: "success" | "warning" | "info"
  timestamp: string
  read: boolean
}

interface NotificationPanelProps {
  notifications: Notification[]
}

const notifIcon = {
  success: <CheckCircle className="w-4 h-4 text-success" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning" />,
  info: <Info className="w-4 h-4 text-secondary" />,
}

export function NotificationPanel({ notifications }: NotificationPanelProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const unreadCount = notifications.filter(n => !n.read).length

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-surface-muted text-muted-foreground transition-smooth"
        aria-label="الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-danger rounded-full ring-2 ring-surface" />
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-80 bg-surface border border-border rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto scrollbar-thin">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground-strong">الإشعارات</h3>
            {unreadCount > 0 && <span className="text-[12px] text-muted-foreground numeric">{unreadCount} غير مقروء</span>}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map(n => (
                <li key={n.id} className={cn("flex items-start gap-3 p-3 hover:bg-surface-muted transition-smooth", !n.read && "bg-secondary/5")}>
                  <div className="shrink-0 mt-0.5">{notifIcon[n.type]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground-strong">{n.title}</p>
                    {n.description && <p className="text-[12px] text-muted-foreground mt-0.5 truncate">{n.description}</p>}
                    <p className="text-[11px] text-muted-foreground/70 mt-1">{n.timestamp}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-secondary shrink-0 mt-2" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}