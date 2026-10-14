import { LayoutDashboard, ClipboardCheck, Database, BarChart2, AlertTriangle, FileCheck, Lightbulb, TrendingUp, Sparkles, FileBarChart, Settings, Building2, Users, Activity, PlusCircle, ShieldCheck } from "lucide-react"
export interface NavItem {
  title: string
  href: string
  icon: any
  group?: string
}

export function getNavItems(role: string): NavItem[] {
  // === قائمة السوبر أدمن ===
  if (role === "SUPER_ADMIN") {
    return [
      { title: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard, group: "نظرة عامة" },
      { title: "المدارس", href: "/schools", icon: Building2, group: "نظرة عامة" },
      { title: "إنشاء مدرسة", href: "/schools/add", icon: PlusCircle, group: "نظرة عامة" },
      { title: "سجل النشاطات", href: "/activity", icon: Activity, group: "نظرة عامة" },
      
      { title: "نتائج التقييمات", href: "/quality-assessor", icon: ClipboardCheck, group: "نتائج الجودة" },
      { title: "بنك الشواهد", href: "/evidence", icon: Database, group: "نتائج الجودة" },
      { title: "نتائج الاستبانات", href: "/surveys", icon: BarChart2, group: "نتائج الجودة" },
      { title: "الفجوات", href: "/gaps", icon: AlertTriangle, group: "نتائج الجودة" },
      { title: "خطط التحسين", href: "/improvement-plans", icon: FileCheck, group: "نتائج الجودة" },
      { title: "المتابعة والأثر", href: "/follow-up", icon: TrendingUp, group: "نتائج الجودة" },
      { title: "التقارير", href: "/reports", icon: FileBarChart, group: "نتائج الجودة" },
      
      { title: "المستخدمون", href: "/users", icon: Users, group: "الإدارة" },
      { title: "الإعدادات", href: "/settings", icon: Settings, group: "الإدارة" },
      { title: "التقييم الخاص لكبير المراجعين", href: "/private-review", icon: ShieldCheck, group: "نظرة عامة" },
    ]
  }

  // === قائمة مشرف ===
  if (role === "QUALITY_ASSESSOR") {
    return [
      { title: "لوحة التحكم", href: "/quality-assessor", icon: LayoutDashboard, group: "الرئيسية" },
      
      { title: "التقييم بالأدوات", href: "/quality-assessor", icon: ClipboardCheck, group: "إدارة الجودة" },
      { title: "بنك الشواهد", href: "/evidence", icon: Database, group: "إدارة الجودة" },
      { title: "نتائج الاستبانات", href: "/surveys", icon: BarChart2, group: "إدارة الجودة" },
      { title: "الفجوات", href: "/gaps", icon: AlertTriangle, group: "إدارة الجودة" },
      { title: "خطط التحسين", href: "/improvement-plans", icon: FileCheck, group: "إدارة الجودة" },
      { title: "إنشاء مبادرة", href: `/initiative`, icon: Lightbulb, group: "إدارة الجودة" },
      { title: "المتابعة والأثر", href: `/follow-up`, icon: TrendingUp, group: "إدارة الجودة" },
      { title: "المساعد الذكي", href: `/ai-assistant`, icon: Sparkles, group: "إدارة الجودة" },
      { title: "التقارير", href: `/reports`, icon: FileBarChart, group: "إدارة الجودة" },
      
      // تمت إضافة الإعدادات هنا
      { title: "الإعدادات", href: "/settings", icon: Settings, group: "الإدارة" },
    ]
  }

  // === قائمة المدير العام ومدير قسم ===
  const items: NavItem[] = [
    { title: "لوحة التحكم", href: "/school-manager", icon: LayoutDashboard, group: "الرئيسية" },
    { title: "التقييم بالأدوات", href: "/quality-assessor", icon: ClipboardCheck, group: "إدارة الجودة" },
    { title: "بنك الشواهد", href: "/evidence", icon: Database, group: "إدارة الجودة" },
    { title: "نتائج الاستبانات", href: "/surveys", icon: BarChart2, group: "إدارة الجودة" },
    { title: "الفجوات", href: "/school-manager/quality/gaps", icon: AlertTriangle, group: "إدارة الجودة" },
    { title: "خطط التحسين", href: "/school-manager/quality/improvement-plans", icon: FileCheck, group: "إدارة الجودة" },
    { title: "إنشاء مبادرة", href: `/initiative`, icon: Lightbulb, group: "إدارة الجودة" },
    { title: "المتابعة والأثر", href: `/follow-up`, icon: TrendingUp, group: "إدارة الجودة" },
    { title: "المساعد الذكي", href: `/ai-assistant`, icon: Sparkles, group: "إدارة الجودة" },
    { title: "التقارير", href: `/reports`, icon: FileBarChart, group: "إدارة الجودة" },
  ]

  if (role === "SCHOOL_MANAGER") {
    items.push(
      { title: "الفروع", href: "/school-manager/branches", icon: Building2, group: "الإدارة" },
      { title: "المستخدمون", href: "/school-manager/users", icon: Users, group: "الإدارة" },
      { title: "الإعدادات", href: "/school-manager/settings", icon: Settings, group: "الإدارة" },
    )
  } else if (role === "BRANCH_MANAGER") {
    items.push(
      { title: "المستخدمون", href: "/school-manager/users", icon: Users, group: "الإدارة" },
      { title: "بيانات الفرع", href: "/school-manager/branch-profile", icon: Building2, group: "الإدارة" },
      { title: "الإعدادات", href: "/school-manager/settings", icon: Settings, group: "الإدارة" },
    )
  }

  return items
}

export const navItems = getNavItems("SUPER_ADMIN")
export const schoolNavItems = getNavItems("SCHOOL_MANAGER")