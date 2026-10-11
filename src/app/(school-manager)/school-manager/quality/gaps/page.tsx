import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { AlertTriangle, CheckCircle, Plus, FileWarning } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

export default async function GapsPage() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  const gaps = await prisma.gap.findMany({
    where: { schoolId: user.schoolId },
    include: { indicator: { include: { domain: true } }, branch: true },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  })

  const openCount = gaps.filter(g => g.status === "OPEN").length
  const resolvedCount = gaps.filter(g => g.status === "RESOLVED").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="فجوات الجودة"
        description="المؤشرات غير المتحققة التي تحتاج خطط تحسين"
        breadcrumbs={[
          { label: "الرئيسية", href: "/school-manager" }, 
          { label: "الجودة", href: "/school-manager/quality" }, 
          { label: "الفجوات" }
        ]}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-danger/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">إجمالي الفجوات</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{gaps.length}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <FileWarning className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">مفتوحة</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{openCount}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">تم حلها</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{resolvedCount}</p>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {gaps.length === 0 ? (
            <EmptyState 
              icon={<CheckCircle className="w-10 h-10 text-success" />} 
              title="لا توجد فجوات" 
              description="جميع المؤشرات محققة أو لم يتم تسجيل أي فجوات بعد." 
              compact 
              className="py-12"
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm text-right">
                <thead className="text-[12px] text-muted-foreground bg-surface-muted uppercase">
                  <tr>
                    <th className="px-6 py-4 font-medium">المؤشر</th>
                    <th className="px-6 py-4 font-medium hidden md:table-cell">المجال</th>
                    <th className="px-6 py-4 font-medium hidden lg:table-cell">الفرع</th>
                    <th className="px-6 py-4 font-medium">الأولوية</th>
                    <th className="px-6 py-4 font-medium">الحالة</th>
                    <th className="px-6 py-4 font-medium hidden md:table-cell">التاريخ</th>
                    <th className="px-6 py-4 font-medium text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {gaps.map(gap => (
                    <tr key={gap.id} className="hover:bg-surface-muted/50 transition-smooth">
                      <td className="px-6 py-4">
                        <p className="font-mono text-[12px] text-secondary">{gap.indicator.code}</p>
                        <p className="text-[13px] text-foreground-strong truncate max-w-xs mt-0.5">{gap.description}</p>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-muted-foreground text-[13px]">{gap.indicator.domain.name}</td>
                      <td className="px-6 py-4 hidden lg:table-cell text-muted-foreground text-[13px]">{gap.branch?.name ?? "كامل المدرسة"}</td>
                      <td className="px-6 py-4"><PriorityBadge priority={gap.severity} /></td>
                      <td className="px-6 py-4"><StatusBadge status={gap.status} /></td>
                      <td className="px-6 py-4 hidden md:table-cell text-muted-foreground numeric text-[13px]">{formatDate(gap.createdAt.toISOString())}</td>
                      <td className="px-6 py-4 text-left">
                        <Link href={`/school-manager/quality/improvement-plans/new?gapId=${gap.id}`}>
                          <button className="text-secondary hover:bg-secondary/10 px-3 py-1.5 rounded-md text-[13px] font-medium flex items-center gap-1 transition-smooth">
                            <Plus className="w-3.5 h-3.5" /> خطة
                          </button>
                        </Link>
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