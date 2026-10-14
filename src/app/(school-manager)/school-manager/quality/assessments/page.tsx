import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { StatusBadge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { EmptyState } from "@/components/ui/EmptyState"
import { ClipboardCheck, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

export default async function AssessmentsPage() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  const assessments = await prisma.assessment.findMany({
    where: { schoolId: user.schoolId },
    include: { branch: true, assessor: true, _count: { select: { responses: true, gaps: true } } },
    orderBy: { startedAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="التقييمات"
        description="جميع التقييمات المنفّذة على المدرسة وفروعها"
        breadcrumbs={[{ label: "الرئيسية", href: "/school-manager" }, { label: "الجودة", href: "/school-manager/quality" }, { label: "التقييمات" }]}
      />

      <Card variant="primary">
        <CardContent className="p-0">
          {assessments.length === 0 ? (
            <EmptyState icon={<ClipboardCheck />} title="لا توجد تقييمات" description="لم يتم تنفيذ أي تقييم بعد." compact />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right min-w-[600px]">
                <thead className="text-[12px] text-muted-foreground bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3.5 font-medium">الفرع</th>
                    <th className="px-4 py-3.5 font-medium hidden md:table-cell">المقيّم</th>
                    <th className="px-4 py-3.5 font-medium hidden md:table-cell">التاريخ</th>
                    <th className="px-4 py-3.5 font-medium">الإكمال</th>
                    <th className="px-4 py-3.5 font-medium hidden lg:table-cell">الفجوات</th>
                    <th className="px-4 py-3.5 font-medium">الحالة</th>
                    <th className="px-4 py-3.5 font-medium text-left">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assessments.map(a => (
                    <tr key={a.id} className="hover:bg-surface-muted transition-smooth">
                      <td className="px-4 py-3.5 font-medium text-foreground-strong">{a.branch?.name || "كامل المدرسة"}</td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground">{a.assessor?.name ?? "غير محدد"}</td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground numeric">{formatDate(a.startedAt.toISOString())}</td>
                      <td className="px-4 py-3.5 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Progress value={a.progress} size="sm" className="w-16" tone={a.progress === 100 ? "success" : "default"} />
                          <span className="text-[12px] font-medium text-muted-foreground numeric">{a.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {a._count.gaps > 0 ? (
                          <span className="text-danger font-medium numeric">{a._count.gaps}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={a.status} /></td>
                      <td className="px-4 py-3.5">
                        <Link href={`/quality/assessments/${a.id}/results`}>
                          <button className="text-secondary hover:underline text-[13px] font-medium flex items-center gap-1">
                            عرض <ChevronLeft className="w-3.5 h-3.5" />
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