"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Avatar } from "@/components/ui/Avatar"
import { Breadcrumb, Crumb } from "@/components/ui/Breadcrumb"
import { NotificationPanel } from "@/components/ui/NotificationPanel"
import { GlobalSearch } from "./GlobalSearch"

interface HeaderProps {
  title: string
  breadcrumbs?: Crumb[]
  user?: { name: string; email: string; image?: string | null }
  onMenuClick?: () => void
  schoolContext?: { name: string; logoUrl: string | null } | null
}

const ROUTE_LABELS: Record<string, string> = {
  '': 'الرئيسية',
  schools: 'المدارس',
  users: 'المستخدمون',
  subscriptions: 'الاشتراكات',
  activity: 'النشاطات',
  settings: 'الإعدادات',
  quality: 'الجودة',
  'quality-assessor': 'مقيم الجودة',
  'ai-assistant': 'المساعد الذكي',
  assessments: 'التقييمات',
  gaps: 'الفجوات',
  'improvement-plans': 'خطط التحسين',
  reports: 'التقارير',
  branches: 'الفروع',
  'school-manager': 'إدارة المدرسة',
  results: 'النتائج',
  add: 'إضافة',
  new: 'جديد',
  evidence: 'بنك الشواهد', // تمت الإضافة
  surveys: 'نتائج الاستبانات', // تمت الإضافة
  initiative: 'إنشاء مبادرة', // تمت الإضافة
  'follow-up': 'المتابعة والأثر', // تمت الإضافة
  'branch-profile': 'بيانات الفرع', // تمت الإضافة
  print: 'طباعة التقرير', // تمت الإضافة
}
function isIdSegment(seg: string): boolean {
  return seg.length > 15 && /^[a-zA-Z0-9_-]+$/.test(seg);
}

export function Header({ title, breadcrumbs, user, onMenuClick, schoolContext }: HeaderProps) {
  const pathname = usePathname()

  const crumbs: Crumb[] = breadcrumbs ?? React.useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    const result: Crumb[] = [{ label: 'الرئيسية', href: '/' }]
    let acc = ''
    
    segments.forEach((seg, i) => {
      acc += `/${seg}`
      const isLast = i === segments.length - 1
      
      let label = ROUTE_LABELS[seg];
      
      if (!label) {
        if (isIdSegment(seg)) {
          const prevSeg = segments[i-1];
          if (prevSeg === 'assessments') label = 'مساحة التقييم';
          else if (prevSeg === 'schools') label = 'ملف المدرسة';
          else if (prevSeg === 'branches') label = 'تفاصيل الفرع';
          else if (prevSeg === 'users') label = 'ملف المستخدم';
          else if (prevSeg === 'improvement-plans' || seg === 'new') label = 'خطة التحسين';
          else label = 'التفاصيل';
        } else {
          label = decodeURIComponent(seg);
        }
      }

      result.push({
        label: label,
        href: isLast ? undefined : acc,
      })
    })
    return result
  }, [pathname, breadcrumbs])

  const userName = user?.name ?? 'م'

  return (
    <header className="h-header bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between gap-4 px-4 lg:px-8 sticky top-0 z-30">
      {/* ===== Right side (Title & Breadcrumb) ===== */}
      <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={onMenuClick} aria-label="فتح القائمة">
          <Menu className="w-5 h-5" />
        </Button>
        
        {/* School Branding in Header */}
        {schoolContext && (
          <div className="hidden md:flex items-center gap-2 border-l border-border pl-3 shrink-0">
            {schoolContext.logoUrl ? (
              <img src={schoolContext.logoUrl} alt={schoolContext.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                {schoolContext.name.charAt(0)}
              </div>
            )}
            <span className="text-sm font-medium text-foreground-strong truncate max-w-[120px] whitespace-nowrap">
              {schoolContext.name}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {/* عنوان الصفحة - مساحة كافية لمنع اختفاء الحروف */}
          <h1 className="text-sm lg:text-base font-bold text-foreground-strong tracking-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">
            {title}
          </h1>
          {/* مسار التنقل - منع التفاف النص */}
          <div className="hidden sm:flex items-center min-w-0 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
            <Breadcrumb items={crumbs} />
          </div>
        </div>
      </div>

      {/* ===== Left side (Actions) ===== */}
      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        <GlobalSearch />
        <NotificationPanel notifications={[]} />
        <button
          className="flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-surface-muted transition-smooth"
          aria-label="حساب المستخدم"
        >
          <Avatar name={userName} src={user?.image} size="sm" className="shrink-0" />
          <span className="hidden lg:inline text-sm font-semibold text-foreground-strong max-w-[100px] truncate whitespace-nowrap">
            {userName}
          </span>
        </button>
      </div>
    </header>
  )
}