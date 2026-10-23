"use client"
import * as React from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { resolveContentWidthClass, type ContentWidth } from "./content-width"

interface AppShellProps {
  children: React.ReactNode
  role: string
  title: string
  user?: { name: string; email: string; image?: string | null }
  schoolContext?: { name: string; logoUrl: string | null } | null
  /** (اختياري) تجاوز عرض المحتوى لصفحة معيّنة — الافتراضي يُستنتج من المسار */
  contentWidth?: ContentWidth
}

export function AppShell({ children, role, title, user, schoolContext, contentWidth }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const pathname = usePathname()

  // إغلاق السايدبار تلقائياً عند تغيير المسار (النقر على عنصر)
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // (إطار المحتوى) عرض أقصى متدرّج حسب نوع الصفحة + توسيط بهوامش متوازنة:
  //  - لوحات/تقارير/جداول ← wide، النماذج والإعدادات ← narrow، والباقي default
  //  - تحت حد التمديد (لابتوب/تابلت/موبايل) العرض كامل بلا أي فرق عن السابق
  //  - mx-auto محايدة تمامًا مع اتجاه RTL، وبلا أي overflow جديد
  //    فلا تُقتص القوائم المنسدلة أو نوافذ الحوار أو التلميحات
  const contentWidthClass = resolveContentWidthClass(pathname, contentWidth)

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden">
      <div className="hidden lg:block">
        <Sidebar role={role} user={user} />
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative mr-auto h-full animate-in slide-in-from-right duration-200" onClick={(e) => e.stopPropagation()}>
            <Sidebar role={role} user={user} />
          </div>
        </div>
      )}

      <div className="lg:pr-[280px] flex flex-col min-h-screen min-w-0">
        <Header
          title={title}
          user={user}
          onMenuClick={() => setMobileOpen(true)}
          schoolContext={schoolContext}
        />
        <main className="flex-1 px-4 py-6 lg:px-10 lg:py-8 min-w-0">
          {/* (إطار المحتوى) غلاف موسّط بعرض أقصى متدرّج حسب نوع الصفحة —
              تفاصيل التصنيف والمسارات في content-width.ts المجاور */}
          <div className={`mx-auto w-full ${contentWidthClass}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}