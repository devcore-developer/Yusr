import { LayoutDashboard, Building2, Users, ClipboardCheck, Activity, Settings, Sparkles } from 'lucide-react';
import { NavItem } from './navigation';

export const schoolNavItems: NavItem[] = [
  // الرئيسية
  { title: 'لوحة التحكم', href: '/school-manager', icon: LayoutDashboard, group: 'main' },
  { title: 'الفروع', href: '/school-manager/branches', icon: Building2, group: 'main' },
  { title: 'المستخدمين', href: '/school-manager/users', icon: Users, group: 'main' },
  // إدارة الجودة
  { title: 'الجودة', href: '/school-manager/quality', icon: ClipboardCheck, group: 'quality' },
  { title: 'المساعد الذكي', href: '/ai-assistant', icon: Sparkles, group: 'quality' },
  // النظام
  { title: 'النشاطات', href: '/school-manager/activity', icon: Activity, group: 'system' },
  { title: 'الإعدادات', href: '/school-manager/settings', icon: Settings, group: 'system' },
];