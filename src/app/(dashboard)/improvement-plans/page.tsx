// ===== FILE: src/app/(dashboard)/improvement-plans/page.tsx =====
import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Progress } from "@/components/ui/Progress"
import { Eye, Plus, Printer } from "lucide-react"
import Link from "next/link"
import { getIndicatorLabels } from "@/features/improvement-plans/queries"
import { canViewPlan } from "@/features/improvement-plans/access"

export default async function ImprovementPlansPage() {
  const user = await getCurrentUser()
  if (!user || !user.id) redirect("/login")

  const isSuperAdmin = user.role === "SUPER_ADMIN"
  const isQualityAssessor = user.role === "QUALITY_ASSESSOR"
  const isSchoolManager = user.role === "SCHOOL_MANAGER"
  const isBranchManager = user.role === "BRANCH_MANAGER"

  // (تعديل هذه المهمة) إتاحة العرض لكل الأدوار المصرح لها — الإنشاء يبقى لمقيّم الجودة وحده:
  //   مقيّم الجودة: خططه هو فقط (كما كان) / مدير المدرسة: خطط مدرسته
  //   مدير القسم: خطط فروعه المصرح بها + خطط المدرسة كله / مدير النظام: الكل
  if (!isSuperAdmin && !isQualityAssessor && !isSchoolManager && !isBranchManager) {
    redirect("/")
  }

  // (جديد) فروع مدير القسم — نفس آلية الصلاحيات القائمة في المنصة
  const authorizedBranchIds = isBranchManager ? await getAuthorizedBranchIds(user) : []

  const baseInclude = {
    school: { select: { name: true } },
    branch: { select: { name: true } },
    gap: { select: { indicator: { select: { code: true, description: true } } } },
    createdBy: { select: { name: true } }
  }

  const dbPlans = isQualityAssessor
    ? await prisma.improvementPlan.findMany({
        where: { createdById: user.id },
        include: baseInclude,
        orderBy: { createdAt: "desc" }
      })
    : isSchoolManager
      ? await prisma.improvementPlan.findMany({
          where: { schoolId: user.schoolId ?? "__none__" },
          include: baseInclude,
          orderBy: { createdAt: "desc" }
        })
      : isBranchManager
        ? await prisma.improvementPlan.findMany({
            where: {
              schoolId: user.schoolId ?? "__none__",
              OR: [{ branchId: null }, { branchId: { in: authorizedBranchIds } }]
            },
            include: baseInclude,
            orderBy: { createdAt: "desc" }
          })
        : await prisma.improvementPlan.findMany({
            include: baseInclude,
            orderBy: { createdAt: "desc" }
          })

  type PlanData = {
    id: string
    title: string
    status: string
    progress: number
    schoolId?: string | null
    branchId?: string | null
    createdById?: string | null
    school: { name: string } | null
    branch: { name: string } | null
    gap: { indicator: { code: string; description: string } | null } | null
    createdBy: { name: string } | null
    // Task 16 (إضافة فقط): نوع الخطة + المؤشر المرتبط بلا فجوة
    kind?: string
    indicatorId?: string | null
  }

  const plans = (dbPlans as unknown as PlanData[]).filter(p =>
    canViewPlan(user, { schoolId: p.schoolId ?? null, branchId: p.branchId ?? null, createdById: p.createdById ?? null }, authorizedBranchIds)
  )

  // Task 16 (إضافة فقط): أكواد المؤشرات للخطط المرتبطة بمؤشر بلا فجوة
  const indicatorLabels = await getIndicatorLabels(plans.map(p => p.indicatorId ?? "").filter(Boolean))

  return (
    <div className="space-y-6">
      <PageHeader
        title="خطط التحسين"
        description="إدارة ومتابعة خطط التحسين الخاصة بالتقييمات."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'خطط التحسين' }]}
        actions={
          /* (جديد) إنشاء خطة تحسين — لمقيّم الجودة فقط (الإنشاء صلاحيته حصرية كما هو على الخادم).
              يفتح نفس سير الإنشاء القائم — لا يوجد سير منشئ ثانٍ. */
          isQualityAssessor ? (
            <Link href="/school-manager/quality/improvement-plans/new">
              <Button variant="primary" size="md" icon={<Plus className="w-4 h-4" />}>إنشاء خطة تحسين</Button>
            </Link>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-[12px] text-muted-foreground bg-surface-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">عنوان الخطة</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">المؤشر</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">المدرسة / الفرع</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">الإنجاز</th>
                  <th className="px-4 py-3 font-medium text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map((p) => {
                  const indicatorCode = p.gap?.indicator?.code
                    ?? (p.indicatorId ? indicatorLabels.get(p.indicatorId)?.code ?? "—" : "—")

                  return (
                    <tr key={p.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-medium text-foreground-strong">
                        {p.title}
                        {p.kind === "SUSTAINABILITY" && (
                          <Badge variant="info" className="ms-2">خطة استدامة</Badge>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{p.createdBy?.name}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                        {indicatorCode}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                        {p.school?.name} {p.branch ? `- ${p.branch.name}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === "COMPLETED" ? "success" : p.status === "IN_PROGRESS" ? "warning" : "neutral"}>
                          {p.status === "COMPLETED" ? "مكتملة" : p.status === "IN_PROGRESS" ? "جارية" : "مسودة"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Progress value={p.progress} size="sm" className="w-16" />
                          <span className="text-xs text-muted-foreground">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-left">
                        <div className="flex items-center gap-1 justify-end">
                          <Link href={`/improvement-plans/${p.id}`}>
                            <Button variant="ghost" size="icon-sm" aria-label="عرض" icon={<Eye className="w-4 h-4" />} />
                          </Link>
                          {/* (جديد) طباعة لكل من يُسمح له بالعرض — صفحة الطباعة تفرض النطاق على الخادم */}
                          <Link href={`/improvement-plans/${p.id}/print`} target="_blank">
                            <Button variant="ghost" size="icon-sm" aria-label="طباعة" icon={<Printer className="w-4 h-4" />} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      لا توجد خطط تحسين متاحة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}