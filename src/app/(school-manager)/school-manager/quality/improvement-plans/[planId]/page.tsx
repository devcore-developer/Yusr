import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge, StatusBadge, PriorityBadge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { Button } from "@/components/ui/Button"
import { PlanWorkspace } from "@/features/improvement-plans/components/PlanWorkspace"
import Link from "next/link"
import { formatDate } from "@/lib/utils"
import { Printer, Pencil } from "lucide-react"

export default async function PlanDetailsPage({ params }: { params: { planId: string } }) {
  const user = await getCurrentUser()
  if (!user?.schoolId) redirect("/login")

  // تمت إزالة `indicator: true` من الاستعلام لتجنب خطأ Prisma
  const plan = await prisma.improvementPlan.findUnique({
    where: { id: params.planId },
    include: {
      school: true,
      branch: true,
      gap: { include: { indicator: true } },
      actions: true,
      followUps: { include: { createdBy: true }, orderBy: { createdAt: "desc" } }
    } as any
  })

  if (!plan || plan.schoolId !== user.schoolId) {
    redirect("/school-manager/quality/improvement-plans")
  }

  const planData = plan as any
  // جلب كود المؤشر من علاقة الفجوة (gap) بدلاً من علاقة مباشرة غير موجودة
  const indicatorCode = planData.gap?.indicator?.code || "غير محدد"
  const isOverdue = new Date() > planData.targetDate && planData.status !== "COMPLETED"

  return (
    <div className="space-y-6">
      <PageHeader
        title={planData.title}
        description={`خطة تحسين مرتبطة بالمؤشر: ${indicatorCode}`}
        breadcrumbs={[
          { label: "الرئيسية", href: "/school-manager" },
          { label: "خطط التحسين", href: "/school-manager/quality/improvement-plans" },
          { label: "تفاصيل الخطة" }
        ]}
        actions={
          <div className="flex gap-2">
            <Link href={`/school-manager/quality/improvement-plans/${planData.id}/print`} target="_blank">
              <Button variant="outline" size="md" icon={<Printer className="w-4 h-4" />}>طباعة</Button>
            </Link>
            <Link href={`/school-manager/quality/improvement-plans/${planData.id}/edit`}>
              <Button variant="primary" size="md" icon={<Pencil className="w-4 h-4" />}>تعديل</Button>
            </Link>
          </div>
        }
      />

      {/* Plan Header & KPIs */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>تفاصيل الخطة</CardTitle>
            <div className="flex gap-2">
              <PriorityBadge priority={planData.priority} />
              {isOverdue && planData.status !== "COMPLETED" ? (
                <Badge variant="danger" dot>متأخر</Badge>
              ) : (
                <StatusBadge status={planData.status === "ACTIVE" ? "IN_PROGRESS" : planData.status} />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">المدرسة / الفرع</p>
            <p className="text-sm font-medium">{planData.school.name} - {planData.branch?.name || "كامل المدرسة"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">تاريخ الانتهاء المستهدف</p>
            <p className={`text-sm font-medium ${isOverdue ? "text-danger" : ""}`}>{formatDate(planData.targetDate.toISOString())}</p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-xs text-muted-foreground">نسبة الإنجاز الإجمالية</p>
            <div className="flex items-center gap-3">
              <Progress value={planData.progress} size="sm" className="w-full h-2" tone={planData.progress === 100 ? "success" : isOverdue ? "danger" : "default"} />
              <span className="text-sm font-bold numeric">{planData.progress}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground mb-1">النسبة الأساسية</p>
          <p className="text-2xl font-bold text-foreground-strong numeric">{planData.baseline || 0}%</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground mb-1">النسبة المستهدفة</p>
          <p className="text-2xl font-bold text-secondary numeric">{planData.targetPercentage || 0}%</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground mb-1">النسبة المقاسة حالياً</p>
          <p className="text-2xl font-bold text-success numeric">{planData.currentMeasured || 0}%</p>
        </Card>
      </div>

      {/* Analysis Details */}
      <Card>
        <CardHeader>
          <CardTitle>تحليل الأداء الحالي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">الأسباب</p>
            <p className="text-sm">{planData.reasons || "غير محدد"}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">نقاط القوة</p>
              <p className="text-sm">{planData.strengths || "غير محدد"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">جوانب التحسين</p>
              <p className="text-sm">{planData.improvements || "غير محدد"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace (Actions & Follow-ups) */}
      <Card>
        <CardContent className="p-6">
          <PlanWorkspace plan={planData} />
        </CardContent>
      </Card>
    </div>
  )
}