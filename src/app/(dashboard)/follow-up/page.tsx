import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge, StatusBadge, PriorityBadge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { EmptyState } from "@/components/ui/EmptyState"
import { FileText, Eye, Pencil, Printer } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

export default async function FollowUpPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const where = user.role === "SUPER_ADMIN" ? {} : { schoolId: user.schoolId! }
  const plans = await prisma.improvementPlan.findMany({
    where,
    include: { branch: true, gap: { include: { indicator: true } } },
    orderBy: { createdAt: "desc" },
  })

  const isAssessor = user.role === "QUALITY_ASSESSOR"

  return (
    <div className="space-y-6">
      <PageHeader
        title="المتابعة وقياس الأثر"
        description="متابعة تنفيذ خطط التحسين وقياس أثرها."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'المتابعة والأثر' }]}
      />

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {plans.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-10 h-10 text-muted-foreground" />}
              title="لا توجد خطط تحسين"
              description="لم يتم إنشاء أي خطة بعد."
              compact
              className="py-12"
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm text-right">
                <thead className="text-[12px] text-muted-foreground bg-surface-muted uppercase">
                  <tr>
                    <th className="px-6 py-4 font-medium">عنوان الخطة</th>
                    <th className="px-6 py-4 font-medium">الأولوية</th>
                    <th className="px-6 py-4 font-medium">التقدم</th>
                    <th className="px-6 py-4 font-medium hidden lg:table-cell">تاريخ الإنجاز</th>
                    <th className="px-6 py-4 font-medium">الحالة</th>
                    <th className="px-6 py-4 font-medium text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plans.map(plan => {
                    const isOverdue = new Date() > plan.targetDate && plan.status !== "COMPLETED"
                    return (
                      <tr key={plan.id} className="hover:bg-surface-muted/50 transition-smooth">
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground-strong">{plan.title}</p>
                          {plan.gap?.indicator && <p className="text-[12px] text-muted-foreground mt-1">مرتبط بفجوة: <span className="font-mono text-secondary">{plan.gap.indicator.code}</span></p>}
                        </td>
                        <td className="px-6 py-4"><PriorityBadge priority={plan.priority} /></td>
                        <td className="px-6 py-4 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <Progress value={plan.progress} size="sm" className="w-20" tone={plan.progress === 100 ? "success" : isOverdue ? "danger" : "default"} />
                            <span className="text-[12px] font-medium text-muted-foreground numeric">{plan.progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell text-muted-foreground numeric text-[13px]">
                          <span className={isOverdue ? "text-danger font-medium" : ""}>{formatDate(plan.targetDate.toISOString())}</span>
                        </td>
                        <td className="px-6 py-4">
                          {isOverdue && plan.status !== "COMPLETED" ? <Badge variant="danger" dot>متأخر</Badge> : <StatusBadge status={plan.status === "ACTIVE" ? "IN_PROGRESS" : plan.status} />}
                        </td>
                        <td className="px-6 py-4 text-left">
                          <div className="flex items-center gap-1 justify-end">
                            <Link href={`/school-manager/quality/improvement-plans/${plan.id}`}>
                              <Button variant="ghost" size="icon-sm" aria-label="عرض ومتابعة" icon={<Eye className="w-4 h-4" />} />
                            </Link>
                            {isAssessor && (
                              <Link href={`/school-manager/quality/improvement-plans/${plan.id}/edit`}>
                                <Button variant="ghost" size="icon-sm" aria-label="تعديل" icon={<Pencil className="w-4 h-4" />} />
                              </Link>
                            )}
                            <Link href={`/school-manager/quality/improvement-plans/${plan.id}/print`} target="_blank">
                              <Button variant="ghost" size="icon-sm" aria-label="طباعة" icon={<Printer className="w-4 h-4" />} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}