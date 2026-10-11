"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { GraduationCap, ChevronUp, Settings, LogOut } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { getNavItems, NavItem } from "@/config/navigation"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  navItems?: any[]
  role: string
  user?: { name: string; email: string; image?: string | null }
}

function getActiveHref(pathname: string, items: NavItem[]): string | undefined {
  const matches = items.filter(item => {
    if (pathname === item.href) return true
    if (item.href === "/") return false
    return pathname.startsWith(item.href + "/")
  })
  if (matches.length === 0) return undefined
  return matches.sort((a, b) => b.href.length - a.href.length)[0].href
}

function classifyItem(item: NavItem): string {
  return item.group ?? "main"
}

function getAccountItems(role: string) {
  let settingsHref = "/settings" // الافتراضي للسوبر أدمن والمقيم
  if (role === "SCHOOL_MANAGER" || role === "BRANCH_MANAGER") {
    settingsHref = "/school-manager/settings"
  }
  return [
    { label: "الإعدادات", href: settingsHref, icon: Settings },
  ]
}

export function Sidebar({ role, user }: SidebarProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const items = getNavItems(role)
  const activeHref = getActiveHref(pathname, items)

  const grouped: Record<string, NavItem[]> = {}
  for (const item of items) {
    const g = classifyItem(item)
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(item)
  }

  const userName = user?.name ?? (role === "SUPER_ADMIN" ? "مدير النظام" : "مدير المدرسة")
  const userEmail = user?.email ?? ""
  const accountItems = getAccountItems(role)

  useEffect(() => {
    if (!menuOpen) return
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("mousedown", handleOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [menuOpen])

  const handleLogout = useCallback(async () => {
    setMenuOpen(false)
    await signOut({ callbackUrl: "/login" })
  }, [])

  const groupOrder = ["main", "نظرة عامة", "الرئيسية", "إدارة الجودة", "نتائج الجودة", "النظام", "الإدارة"]
  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    const ia = groupOrder.indexOf(a)
    const ib = groupOrder.indexOf(b)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })

  return (
    <aside className="w-[280px] bg-primary text-primary-foreground flex flex-col h-screen fixed right-0 top-0 z-40">
      {/* Brand Logo (YUSR) */}
      <div className="h-14 flex items-center px-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 shrink-0">
            <Image src="/logo.png" alt="YUSR Logo" fill className="object-contain rounded-lg" priority />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight text-white">يُــــسر</span>
            <span className="text-[10px] text-primary-100/50 mt-0.5">إدارة الجودة</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 scrollbar-thin">
        {sortedGroups.map((key) => {
          const groupItems = grouped[key]
          if (!groupItems || !groupItems.length) return null
          return (
            <div key={key} className="mb-4 last:mb-0">
              <h3 className="px-2.5 mb-1.5 text-[10px] font-semibold text-primary-100/40 uppercase tracking-wider">{key}</h3>
              <ul className="space-y-0.5">
                {groupItems.map((item) => {
                  const isActive = item.href === activeHref
                  const Icon = item.icon
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-smooth",
                          isActive ? "bg-secondary text-white shadow-sm" : "text-primary-100/70 hover:bg-primary-800/40 hover:text-white"
                        )}
                      >
                        <Icon className={cn("w-[18px] h-[18px] shrink-0 transition-smooth", isActive ? "text-white" : "text-primary-100/50 group-hover:text-white")} strokeWidth={isActive ? 2.3 : 2} />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <div ref={menuRef} className="relative border-t border-primary-900/30 shrink-0">
        <button onClick={() => setMenuOpen(!menuOpen)} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 transition-smooth text-right", menuOpen ? "bg-primary-800/40" : "hover:bg-primary-800/30")} aria-expanded={menuOpen} aria-haspopup="menu" aria-label="حساب المستخدم">
          <Avatar name={userName} src={user?.image} size="sm" className="shrink-0" />
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[13px] font-medium text-white truncate">{userName}</p>
            <p className="text-[11px] text-primary-100/50 truncate">{userEmail}</p>
          </div>
          <ChevronUp className={cn("w-4 h-4 text-primary-100/40 transition-transform shrink-0", menuOpen && "rotate-180")} />
        </button>

        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-50" role="menu">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium text-foreground-strong truncate">{userName}</p>
              <p className="text-[12px] text-muted-foreground truncate">{userEmail}</p>
            </div>
            <div className="py-1">
              {accountItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-surface-muted transition-smooth" role="menuitem">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
            <div className="border-t border-border pt-1">
              <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-danger hover:bg-danger/5 transition-smooth text-right" role="menuitem">
                <LogOut className="w-4 h-4" />
                تسجيل الخروج
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}