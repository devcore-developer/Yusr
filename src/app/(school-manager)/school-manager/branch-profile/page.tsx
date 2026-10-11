import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { updateBranch } from "./actions"
import { Building2 } from "lucide-react"

export default async function BranchProfilePage() {
  const user = await getCurrentUser()
  if (!user || user.role !== "BRANCH_MANAGER" || !user.branchId) {
    redirect("/school-manager")
  }

  const branch = await prisma.branch.findUnique({
    where: { id: user.branchId },
    include: {
      school: {
        select: { name: true }
      }
    }
  })

  if (!branch) return null

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="بيانات الفرع"
        description="إدارة المعلومات الأساسية لفرعك."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'بيانات الفرع' }]}
      />
      <Card>
        <CardHeader>
          <CardTitle icon={<Building2 className="w-5 h-5" />}>معلومات الفرع</CardTitle>
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
    </div>
  )
}