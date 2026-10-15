import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Avatar } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { updateProfile, updatePassword } from "./actions"
import { BackupSection } from "@/components/settings/BackupSection"
import { User, Shield, Database } from "lucide-react"

export const metadata = { title: "الإعدادات" }

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const isAssessor = user.role === "QUALITY_ASSESSOR"
  const isSuperAdmin = user.role === "SUPER_ADMIN"

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser) redirect("/login")

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

      {!isAssessor && (
        <Card variant="primary">
          <CardHeader>
            <CardTitle icon={<User className="w-5 h-5" />}>الملف الشخصي</CardTitle>
            <CardDescription>معلوماتك الأساسية (قابلة للتعديل)</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex items-center gap-4 md:col-span-2">
                <Avatar name={dbUser.name ?? 'م'} size="lg" />
                <div>
                  <p className="font-semibold text-foreground-strong">{dbUser.name}</p>
                  <p className="text-[13px] text-muted-foreground">{dbUser.email}</p>
                  {isSuperAdmin && <Badge variant="danger" className="mt-1">مدير النظام</Badge>}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground-strong">الاسم الكامل</label>
                <Input name="name" defaultValue={dbUser.name ?? ''} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-foreground-strong">البريد الإلكتروني</label>
                <Input name="email" defaultValue={dbUser.email ?? ''} type="email" required />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <Button type="submit" variant="primary" size="md">حفظ التغييرات</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card variant="primary">
        <CardHeader>
          <CardTitle icon={<Shield className="w-5 h-5" />}>الأمان والصلاحيات</CardTitle>
          <CardDescription>تغيير كلمة المرور وإدارة الوصول</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updatePassword} className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground-strong">كلمة المرور الجديدة</label>
              <Input name="newPassword" type="password" placeholder="******" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground-strong">تأكيد كلمة المرور</label>
              <Input name="confirmPassword" type="password" placeholder="******" required />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="submit" variant="outline" size="md">تحديث كلمة المرور</Button>
            </div>
          </form>
          
          {isSuperAdmin && (
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="text-sm font-bold mb-2">الأدوار والصلاحيات</h4>
              <p className="text-sm text-muted-foreground mb-2">نظام الصلاحيات في يسر يعتمد على 4 أدوار ثابتة:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Badge variant="danger">مدير النظام (Super Admin)</Badge>
                <Badge variant="info">مدير عام (School Manager)</Badge>
                <Badge variant="warning">مدير قسم (Branch Manager)</Badge>
                <Badge variant="success">مشرف (Quality Assessor)</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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