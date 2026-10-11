import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { updateProfile } from "./actions"
import { SecurityForm } from "@/components/settings/SecurityForm"
import { BackupSection } from "@/components/settings/BackupSection"
import { User, Shield, Database } from "lucide-react"

export const metadata = { title: "الإعدادات" }

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const isAssessor = user.role === "QUALITY_ASSESSOR"
  const isSuperAdmin = user.role === "SUPER_ADMIN"

  // جلب سجل النسخ الاحتياطي للسوبر أدمن فقط
  const backupHistory = isSuperAdmin 
    ? await prisma.backupHistory.findMany({ orderBy: { createdAt: "desc" }, take: 10 }) 
    : []

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="الإعدادات"
        description="إدارة إعدادات حسابك وتفضيلات المنصة."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'الإعدادات' }]}
      />

      {/* 1. Profile Card (يظهر لجميع الأدوار ما عدا المقيم) */}
      {!isAssessor && (
        <Card variant="primary">
          <CardHeader>
            <CardTitle icon={<User className="w-5 h-5" />}>الملف الشخصي</CardTitle>
            <CardDescription>معلوماتك الأساسية (قابلة للتعديل)</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex items-center gap-4 md:col-span-2">
                <Avatar name={user.name ?? 'م'} size="lg" />
                <div>
                  <p className="font-semibold text-foreground-strong">{user.name}</p>
                  <p className="text-[13px] text-muted-foreground">{user.email}</p>
                  {isSuperAdmin && <Badge variant="danger" className="mt-1">مدير النظام</Badge>}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground-strong">الاسم الكامل</label>
                <Input name="name" defaultValue={user.name ?? ''} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground-strong">البريد الإلكتروني</label>
                <Input name="email" defaultValue={user.email ?? ''} type="email" required />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <Button type="submit" variant="primary" size="md">حفظ التغييرات</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 2. Security & Permissions Card (يظهر للجميع) */}
      <Card variant="primary">
        <CardHeader>
          <CardTitle icon={<Shield className="w-5 h-5" />}>الأمان والصلاحيات</CardTitle>
          <CardDescription>تغيير كلمة المرور وإدارة الوصول</CardDescription>
        </CardHeader>
        <CardContent>
          <SecurityForm />
          
          {/* قسم الأدوار يظهر للسوبر أدمن فقط */}
          {isSuperAdmin && (
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="text-sm font-bold mb-2">الأدوار والصلاحيات</h4>
              <p className="text-sm text-muted-foreground mb-2">نظام الصلاحيات في يسر يعتمد على 4 أدوار ثابتة:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Badge variant="danger">مدير النظام (Super Admin)</Badge>
                <Badge variant="info">مدير مدرسة (School Manager)</Badge>
                <Badge variant="warning">مدير فرع (Branch Manager)</Badge>
                <Badge variant="success">مقيم جودة (Quality Assessor)</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Backup & Data Card (يظهر للسوبر أدمن فقط) */}
      {isSuperAdmin && (
        <Card variant="primary">
          <CardHeader>
            <CardTitle icon={<Database className="w-5 h-5" />}>النسخ الاحتياطي والبيانات</CardTitle>
            <CardDescription>تصدير البيانات وإدارة النسخ الاحتياطي</CardDescription>
          </CardHeader>
          <CardContent>
            <BackupSection history={backupHistory} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}