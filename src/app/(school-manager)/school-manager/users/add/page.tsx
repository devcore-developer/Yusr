import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { createUser } from "../actions"
import { UserPlus } from "lucide-react"

export default async function AddUserPage() {
  const user = await getCurrentUser()
  if (!user || (user.role !== "SCHOOL_MANAGER" && user.role !== "BRANCH_MANAGER" && user.role !== "SUPER_ADMIN")) redirect("/school-manager")

  // جلب الفروع التابعة لمدرسة المدير فقط (لا تظهر لمدير الفرع)
  const branches = user.role === "BRANCH_MANAGER" ? [] : await prisma.branch.findMany({ where: { schoolId: user.schoolId! } })

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="إضافة مستخدم جديد"
        description={user.role === "BRANCH_MANAGER" ? "إنشاء حساب مقيم جودة تابع لفرعك." : "إنشاء حساب لمدير فرع أو مقيم جودة تابع لمدرستك."}
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "المستخدمون", href: "/school-manager/users" }, { label: "إضافة مستخدم" }]}
      />
      <Card>
        <CardContent className="p-6">
          <form action={createUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">الاسم الكامل <span className="text-danger">*</span></label>
                <Input name="name" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">البريد الإلكتروني <span className="text-danger">*</span></label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">كلمة المرور <span className="text-danger">*</span></label>
                <Input name="password" type="password" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">الدور <span className="text-danger">*</span></label>
                <Select name="role" required disabled={user.role === "BRANCH_MANAGER"}>
                  {user.role === "SUPER_ADMIN" && <option value="SCHOOL_MANAGER">مدير مدرسة</option>}
                  {(user.role === "SUPER_ADMIN" || user.role === "SCHOOL_MANAGER") && <option value="BRANCH_MANAGER">مدير فرع</option>}
                  <option value="QUALITY_ASSESSOR">مقيم جودة</option>
                </Select>
                {user.role === "BRANCH_MANAGER" && (
                  <input type="hidden" name="role" value="QUALITY_ASSESSOR" />
                )}
              </div>
              
              {/* لا تظهر قائمة الفروع لمدير الفرع لأنه مرتبط بفرعه تلقائياً */}
              {user.role !== "BRANCH_MANAGER" && (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium">الفرع (اختياري)</label>
                  <Select name="branchId">
                    <option value="">بدون فرع محدد</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </Select>
                </div>
              )}
            </div>
            
            {user.role === "BRANCH_MANAGER" && (
              <p className="text-xs text-muted-foreground bg-surface-muted p-3 rounded-lg">
                سيتم ربط هذا المستخدم (مقيم جودة) بفرعك الحالي تلقائياً.
              </p>
            )}

            <div className="flex justify-end pt-4">
              <Button type="submit" icon={<UserPlus className="w-4 h-4" />}>حفظ وإنشاء الحساب</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}