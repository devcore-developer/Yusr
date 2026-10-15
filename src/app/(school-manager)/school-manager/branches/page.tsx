import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { StatusBadge } from "@/components/ui/Badge"
import { Building2, Plus, MapPin, Phone } from "lucide-react"
import Link from "next/link"
import { EditBranchModal } from "@/components/admin/EditBranchModal"

export default async function BranchesPage() {
  const user = await getCurrentUser()
  if (!user || !user.schoolId) redirect("/login")

  // جلب الفروع التابعة لمدرسة المدير فقط
  const branches = await prisma.branch.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { createdAt: "desc" }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة الفروع"
        description="قائمة بجميع الفروع التابعة لمدرستك."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'الفروع' }]}
        actions={
          <Link href="/school-manager/branches/add">
            <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>
              إضافة فرع
            </Button>
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {branches.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-foreground-strong mb-1">لا توجد فروع مضافة بعد</p>
              <p className="text-sm mb-4">ابدأ بإضافة فرع جديد لمدرستك.</p>
              <Link href="/school-manager/branches/add">
                <Button variant="outline" size="sm" icon={<Plus className="w-4 h-4" />}>إضافة فرع</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm text-right min-w-[600px]">
                <thead className="text-[12px] text-muted-foreground bg-surface-muted uppercase">
                  <tr>
                    <th className="px-6 py-4 font-medium">اسم الفرع</th>
                    <th className="px-6 py-4 font-medium hidden md:table-cell">الموقع</th>
                    <th className="px-6 py-4 font-medium hidden lg:table-cell">الهاتف</th>
                    <th className="px-6 py-4 font-medium">الحالة</th>
                    <th className="px-6 py-4 font-medium text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {branches.map((branch) => (
                    <tr key={branch.id} className="hover:bg-surface-muted/50 transition-smooth">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {branch.name.charAt(0)}
                          </div>
                          <span className="font-medium text-foreground-strong">{branch.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" /> {branch.location || "غير محدد"}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" /> {branch.phone || "غير محدد"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={branch.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <EditBranchModal branch={branch} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}