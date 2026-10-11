import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { createBranch } from "../actions"
import { Building2 } from "lucide-react"

export default async function AddBranchPage() {
  const user = await getCurrentUser()
  if (!user || (user.role !== "SCHOOL_MANAGER" && user.role !== "SUPER_ADMIN")) redirect("/school-manager")

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        title="إضافة فرع جديد"
        description="أدخل بيانات الفرع وبيانات مديره لإنشاء الحسابات وربطها بمدرستك."
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "الفروع", href: "/school-manager/branches" }, { label: "إضافة فرع" }]}
      />
      
      <Card>
        <CardContent className="p-6">
          <form action={createBranch} className="space-y-8">
            
            {/* القسم الأول: بيانات الفرع */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-foreground-strong border-r-4 border-primary pr-3">بيانات الفرع</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">اسم الفرع <span className="text-danger">*</span></label>
                  <Input name="name" required placeholder="مثال: الفرع الرئيسي (حي النخيل)" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">رقم الهاتف</label>
                  <Input name="phone" placeholder="+9665..." />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium">الموقع / العنوان</label>
                  <Input name="location" placeholder="الرياض - حي النخيل - شارع الملك" />
                </div>
              </div>
            </div>

            {/* القسم الثاني: حساب مدير الفرع */}
            <div className="space-y-4 p-4 bg-surface-muted/30 rounded-lg">
              <h3 className="text-lg font-bold text-foreground-strong border-r-4 border-secondary pr-3">حساب مدير الفرع</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">اسم مدير الفرع <span className="text-danger">*</span></label>
                  <Input name="managerName" required placeholder="أحمد العتيبي" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">بريد الدخول (للمدير) <span className="text-danger">*</span></label>
                  <Input name="managerEmail" type="email" required placeholder="manager@school.com" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium">كلمة المرور <span className="text-danger">*</span></label>
                  <Input name="managerPassword" type="password" required placeholder="******" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" icon={<Building2 className="w-4 h-4" />}>
                حفظ وإنشاء الفرع والمدير
              </Button>
            </div>
            
          </form>
        </CardContent>
      </Card>
    </div>
  )
}