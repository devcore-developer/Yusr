"use client"
import * as React from "react"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"

interface AppShellProps {
  children: React.ReactNode
  role: string
  title: string
  user?: { name: string; email: string; image?: string | null }
  schoolContext?: { name: string; logoUrl: string | null } | null
}

export function AppShell({ children, role, title, user, schoolContext }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden lg:block">
        <Sidebar role={role} user={user} />
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative mr-auto h-full animate-in slide-in-from-right duration-200">
            <Sidebar role={role} user={user} />
          </div>
        </div>
      )}

      <div className="lg:pr-[280px] flex flex-col min-h-screen">
        <Header 
          title={title} 
          user={user} 
          onMenuClick={() => setMobileOpen(true)}
          schoolContext={schoolContext}
        />
        <main className="flex-1 px-4 py-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}