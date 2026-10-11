import { getCurrentUser } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Building2, ShieldCheck } from "lucide-react"
import { SecurityForm } from "@/components/settings/SecurityForm"
import { updateBranch } from "../branch-profile/actions"

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  const isBranchManager = user.role === "BRANCH_MANAGER"

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="الإعدادات"
        description="إدارة بياناتك الشخصية وبيانات المؤسسة."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'الإعدادات' }]}
      />
      
      {/* 1. بيانات المؤسسة (تتغير حسب الدور) */}
      {isBranchManager ? (
        <BranchSettingsCard branchId={user.branchId!} />
      ) : (
        <SchoolSettingsCard schoolId={user.schoolId} />
      )}

      {/* 2. الأمان وكلمة المرور */}
      <Card>
        <CardHeader>
          <CardTitle icon={<ShieldCheck className="w-5 h-5" />}>الأمان وكلمة المرور</CardTitle>
        </CardHeader>
        <CardContent>
          <SecurityForm />
        </CardContent>
      </Card>
    </div>
  )
}

// مكون بيانات المدرسة (لمدير المدرسة)
async function SchoolSettingsCard({ schoolId }: { schoolId: string }) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, location: true, phone: true, officialEmail: true, description: true, status: true },
  })

  if (!school) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Building2 className="w-5 h-5" />}>بيانات المدرسة</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">اسم المدرسة</label>
            <Input defaultValue={school.name} readOnly className="bg-surface-muted" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">حالة المدرسة</label>
            <div className="pt-2">
              <Badge variant={school.status === "ACTIVE" ? "success" : "danger"}>
                {school.status === "ACTIVE" ? "نشطة" : "موقوفة"}
              </Badge>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">البريد الرسمي</label>
            <Input defaultValue={school.officialEmail || ""} readOnly className="bg-surface-muted" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">الهاتف</label>
            <Input defaultValue={school.phone || ""} readOnly className="bg-surface-muted" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">الموقع</label>
            <Input defaultValue={school.location || ""} readOnly className="bg-surface-muted" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">الوصف</label>
            <Input defaultValue={school.description || ""} readOnly className="bg-surface-muted" />
          </div>
        </div>
        <div className="mt-6 p-4 bg-surface-muted/50 rounded-lg text-sm text-muted-foreground">
          لتعديل البيانات الأساسية للمدرسة (مثل الاسم والشعار)، يرجى التواصل مع إدارة المنصة.
        </div>
      </CardContent>
    </Card>
  )
}

// مكون بيانات الفرع (لمدير الفرع)
async function BranchSettingsCard({ branchId }: { branchId: string }) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { school: { select: { name: true } } }
  })

  if (!branch) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={<Building2 className="w-5 h-5" />}>بيانات الفرع</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={updateBranch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">اسم الفرع</label>
              <Input name="name" defaultValue={branch.name} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">المدرسة التابع لها</label>
              <Input defaultValue={branch.school.name} readOnly className="bg-surface-muted" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الهاتف</label>
              <Input name="phone" defaultValue={branch.phone || ""} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الموقع</label>
              <Input name="location" defaultValue={branch.location || ""} />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit">حفظ التغييرات</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}