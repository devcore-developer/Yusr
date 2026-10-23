// ===== FILE: src/app/(school-manager)/school-manager/quality/improvement-plans/page.tsx =====
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge, StatusBadge, PriorityBadge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { EmptyState } from "@/components/ui/EmptyState"
import { Plus, FileText, AlertCircle, Eye, Printer } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"
import { getIndicatorLabels } from "@/features/improvement-plans/queries"

export default async function ImprovementPlansPage() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  // (تعديل هذه المهمة) زر «خطة جديدة» لمقيّم الجودة فقط — الإنشاء صلاحيته حصرية على الخادم
  // (savePlan) فإخفاؤه هنا يمنع وصول غير المقيّمين لخطأ غير مصرح عند محاولة الإنشاء،
  // والعرض يبقى متاحًا للجميع عبر قاعدة الوصول الموحدة.
  const canCreatePlans = user.role === "QUALITY_ASSESSOR"

  const plans = await prisma.improvementPlan.findMany({
    where: { schoolId: user.schoolId },
    include: { branch: true, gap: { include: { indicator: true } } },
    orderBy: { createdAt: "desc" },
  })

  // Task 16 (إضافة فقط): أكواد المؤشرات للخطط المرتبطة بمؤشر بلا فجوة — لا يغيّر استعلام الخطط القائم
  const indicatorLabels = await getIndicatorLabels(plans.map(p => p.indicatorId).filter((v): v is string => Boolean(v)))

  const activeCount = plans.filter(p => p.status === "ACTIVE" || p.status === "IN_PROGRESS").length
  const completedCount = plans.filter(p => p.status === "COMPLETED").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="خطط التحسين"
        description="متابعة خطط معالجة الفجوات وتحسين الأداء"
        breadcrumbs={[
          { label: "الرئيسية", href: "/school-manager" }, 
          { label: "الجودة", href: "/school-manager/quality" }, 
          { label: "خطط التحسين" }
        ]}
        actions={
          canCreatePlans ? (
            <Link href="/school-manager/quality/improvement-plans/new">
              <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>خطة جديدة</Button>
            </Link>
          ) : undefined
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">إجمالي الخطط</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{plans.length}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">قيد التنفيذ</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{activeCount}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">مكتملة</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{completedCount}</p>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {plans.length === 0 ? (
            <EmptyState 
              icon={<FileText className="w-10 h-10 text-muted-foreground" />} 
              title="لا توجد خطط تحسين" 
              description="لم يتم إنشاء أي خطة بعد." 
              compact 
              className="py-12"
              action={canCreatePlans ? { label: "إنشاء خطة جديدة", href: "/school-manager/quality/improvement-plans/new" } : undefined}
            />
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm text-right">
                <thead className="text-[12px] text-muted-foreground bg-surface-muted uppercase">
                  <tr>
                    <th className="px-6 py-4 font-medium">عنوان الخطة</th>
                    <th className="px-6 py-4 font-medium hidden md:table-cell">الفرع</th>
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
                    // Task 16 (إضافة فقط): المؤشر المرتبط للخطط بلا فجوة — صفوف الفجوات القائمة كما هي حرفيًا
                    const linkedIndicator = !plan.gap?.indicator && plan.indicatorId ? indicatorLabels.get(plan.indicatorId) : undefined
                    return (
                      <tr key={plan.id} className="hover:bg-surface-muted/50 transition-smooth">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground-strong">{plan.title}</p>
                            {plan.kind === "SUSTAINABILITY" && <Badge variant="info">خطة استدامة</Badge>}
                          </div>
                          {plan.gap?.indicator && (
                            <p className="text-[12px] text-muted-foreground mt-1">مرتبط بفجوة: <span className="font-mono text-secondary">{plan.gap.indicator.code}</span></p>
                          )}
                          {linkedIndicator && (
                            <p className="text-[12px] text-muted-foreground mt-1">مرتبط بمؤشر: <span className="font-mono text-secondary">{linkedIndicator.code}</span></p>
                          )}
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell text-muted-foreground text-[13px]">{plan.branch?.name ?? "كامل المدرسة"}</td>
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
                          {isOverdue && plan.status !== "COMPLETED" ? (
                            <Badge variant="danger" dot>متأخر</Badge>
                          ) : (
                            <StatusBadge status={plan.status === "ACTIVE" ? "IN_PROGRESS" : plan.status} />
                          )}
                        </td>
                        <td className="px-6 py-4 text-left">
                          <div className="flex items-center gap-1 justify-end">
                            <Link href={`/school-manager/quality/improvement-plans/${plan.id}`}>
                              <Button variant="ghost" size="icon-sm" aria-label="عرض" icon={<Eye className="w-4 h-4" />} />
                            </Link>
                            <Link href={`/improvement-plans/${plan.id}/print`} target="_blank">
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