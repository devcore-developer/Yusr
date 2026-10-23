// ===== FILE: src/app/(dashboard)/improvement-plans/[planId]/page.tsx =====
import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { ArrowRight, CheckCircle, Printer } from "lucide-react"
import { getIndicatorLabels } from "@/features/improvement-plans/queries"
import { canViewPlan } from "@/features/improvement-plans/access"

export default async function ViewImprovementPlanPage({ params }: { params: { planId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const plan = await prisma.improvementPlan.findUnique({
    where: { id: params.planId },
    include: {
      gap: { include: { indicator: true } },
      actions: true,
      followUps: { include: { createdBy: { select: { name: true } } } },
      school: { select: { name: true } },
      branch: { select: { name: true } },
      assessment: { select: { id: true, cycle: true } },
      createdBy: { select: { name: true } }
    }
  })

  if (!plan) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">لم يتم العثور على الخطة.</p>
        <Link href="/improvement-plans" className="mt-4 inline-block">
          <Button variant="outline">العودة للقائمة</Button>
        </Link>
      </div>
    )
  }

  // (تعديل هذه المهمة) نفس قاعدة الوصول الموحدة للقائمة والطباعة:
  //   مقيّم الجودة: خططه فقط / مدير المدرسة: مدرسته / مدير القسم: فروعه المصرح بها
  //   + خطط المدرسة كله / مدير النظام: الكل — الفحص على الخادم من بيانات الخطة المخزنة.
  const authorizedBranchIds = user.role === "BRANCH_MANAGER" ? await getAuthorizedBranchIds(user) : []
  const allowed = canViewPlan(
    user,
    { schoolId: plan.schoolId, branchId: plan.branchId, createdById: plan.createdById },
    authorizedBranchIds
  )
  if (!allowed) {
    redirect("/improvement-plans")
  }

  const isSuperAdmin = user.role === "SUPER_ADMIN"
  const isOwner = user.role === "QUALITY_ASSESSOR" && plan.createdById === user.id
  // نفس منطق القراءة فقط القائم: الإدارة تقرأ فقط، ومقيّم الجودة (مالك الخطة) يعمل على خطته.
  // مدير المدرسة/القسم يعرضان فقط — لا تُمنح صلاحية تعديل بمجرد فتح العرض.
  const isReadOnly = isSuperAdmin || (!isOwner && user.role !== "QUALITY_ASSESSOR")

  // Task 16 (إضافة فقط): المؤشر المرتبط للخطط بلا فجوة — بالعمود القائم indicatorId
  const linkedIndicator = !plan.gap?.indicator && plan.indicatorId
    ? (await getIndicatorLabels([plan.indicatorId])).get(plan.indicatorId)
    : undefined
  // Task 16 (إضافة فقط): تسمية نوع الخطة — خطط التحسين القائمة بنفس العنوان السابق حرفيًا
  const planKindLabel = plan.kind === "SUSTAINABILITY" ? "خطة استدامة" : "خطة تحسين"

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${planKindLabel}: ${plan.title}`}
        description="عرض تفاصيل خطة التحسين والمتابعة."
        breadcrumbs={[
          { label: 'الرئيسية', href: '/' },
          { label: 'خطط التحسين', href: '/improvement-plans' },
          { label: 'عرض الخطة' }
        ]}
        actions={
          <div className="flex gap-2">
            {/* (جديد) طباعة الخطة — متاحة لكل من يُسمح له بالعرض، وصفحة الطباعة تفرض النطاق على الخادم */}
            <Link href={`/improvement-plans/${plan.id}/print`} target="_blank">
              <Button variant="outline" icon={<Printer className="w-4 h-4" />}>طباعة خطة التحسين</Button>
            </Link>
            <Link href="/improvement-plans">
              <Button variant="outline" icon={<ArrowRight className="w-4 h-4" />}>العودة للقائمة</Button>
            </Link>
          </div>
        }
      />

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start border-b pb-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={plan.status === "COMPLETED" ? "success" : "warning"}>
                  {plan.status === "COMPLETED" ? "مكتملة" : plan.status === "IN_PROGRESS" ? "قيد التنفيذ" : "مسودة"}
                </Badge>
                {plan.assessment?.cycle && <Badge variant="info">دورة {plan.assessment.cycle}</Badge>}
                {plan.kind === "SUSTAINABILITY" && <Badge variant="info">خطة استدامة</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{plan.description || "لا يوجد وصف"}</p>
            </div>
            <div className="text-left">
              <p className="text-sm text-muted-foreground">نسبة الإنجاز</p>
              <p className="text-3xl font-bold text-primary">{plan.progress}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">المؤشر المرتبط</p>
              <p className="text-sm font-medium">
                {plan.gap?.indicator
                  ? `${plan.gap.indicator.code} - ${plan.gap.indicator.description}`
                  : linkedIndicator
                    ? `${linkedIndicator.code} - ${linkedIndicator.description}`
                    : "غير محدد"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">المقيّم / المنشئ</p>
              <p className="text-sm font-medium">{plan.createdBy?.name || "غير محدد"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">المدرسة</p>
              <p className="text-sm font-medium">{plan.school?.name || "غير محدد"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">الفرع</p>
              <p className="text-sm font-medium">{plan.branch?.name || "كامل المدرسة"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">تاريخ البدء المستهدف</p>
              <p className="text-sm font-medium">{new Date(plan.startDate).toLocaleDateString('ar-SA')}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">تاريخ الإنجاز المستهدف</p>
              <p className="text-sm font-medium">{new Date(plan.targetDate).toLocaleDateString('ar-SA')}</p>
            </div>
            {/* Task 16 (إضافة فقط): الدرجة المرجعية لحظة الإنشاء — تظهر فقط عند توفرها */}
            {plan.evidenceScore !== null && plan.evidenceScore !== undefined && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">الدرجة المرجعية عند الإنشاء</p>
                <p className="text-sm font-medium numeric">{plan.evidenceScore}%</p>
              </div>
            )}
          </div>

          {(plan.reasons || plan.strengths || plan.improvements) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-muted p-4 rounded-lg">
              {plan.reasons && <div><p className="text-xs font-bold text-muted-foreground mb-1">الأسباب</p><p className="text-sm">{plan.reasons}</p></div>}
              {plan.strengths && <div><p className="text-xs font-bold text-muted-foreground mb-1">نقاط القوة</p><p className="text-sm">{plan.strengths}</p></div>}
              {plan.improvements && <div><p className="text-xs font-bold text-muted-foreground mb-1">التحسينات المطلوبة</p><p className="text-sm">{plan.improvements}</p></div>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold mb-4">إجراءات الخطة</h3>
            <div className="space-y-4">
              {plan.actions.map((action) => (
                <div key={action.id} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-sm">{action.title}</p>
                    <Badge variant={action.status === "COMPLETED" ? "success" : "neutral"}>{action.status}</Badge>
                  </div>
                  {action.description && <p className="text-xs text-muted-foreground mb-2">{action.description}</p>}
                  <div className="w-full bg-surface-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${action.progress}%` }}></div>
                  </div>
                </div>
              ))}
              {plan.actions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد إجراءات</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold mb-4">سجل المتابعة وقياس الأثر</h3>
            <div className="space-y-4">
              {plan.followUps.map((fu) => (
                <div key={fu.id} className="border-r-4 border-primary pr-3">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-xs font-medium">{fu.createdBy?.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(fu.createdAt).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <p className="text-sm">{fu.note}</p>
                </div>
              ))}
              {plan.followUps.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا يوجد متابعات مسجلة</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {isReadOnly && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex items-center gap-2 text-sm">
          <CheckCircle className="w-5 h-5" />
          <span>
            {isSuperAdmin
              ? "أنت تعرض هذه الخطة في وضع القراءة فقط (Read-Only) بصفتك مدير النظام."
              : "أنت تعرض هذه الخطة في وضع القراءة فقط — إنشاء وتحرير خطط التحسين من صلاحيات مقيّم الجودة."}
          </span>
        </div>
      )}
    </div>
  )
}