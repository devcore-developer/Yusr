import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { PageHeader } from "@/components/layout/PageHeader"
import Link from "next/link"
import { formatDate } from "@/lib/utils"
import { ClipboardCheck, CheckCircle, Clock, ArrowLeft, GitCompare } from "lucide-react"
import { AssessmentComparisonSelector } from "@/features/quality-assessment/components/AssessmentComparisonSelector"

export default async function AssessorDashboard() {
  const user = await getCurrentUser()
  
  if (!user || !["QUALITY_ASSESSOR", "SUPER_ADMIN", "SCHOOL_MANAGER", "BRANCH_MANAGER"].includes(user.role)) {
    return null
  }

  // تحديد النطاق حسب الدور، مع استبعاد التقييمات الخاصة من القائمة العادية
  const assessorWhere = {
    ...(user.role === "SUPER_ADMIN" ? {} : { schoolId: user.schoolId! }),
    type: { not: "PRIVATE_REVIEW" } 
  }

  const assessments = await prisma.assessment.findMany({
    where: assessorWhere,
    include: { school: true, branch: true, assessor: true },
    orderBy: { startedAt: "desc" }
  })

  const active = assessments.filter(a => a.status === "IN_PROGRESS")
  const completed = assessments.filter(a => a.status === "COMPLETED")
  const isSuperAdmin = user.role === "SUPER_ADMIN"

  return (
    <div className="space-y-8">
      <PageHeader
        title={isSuperAdmin ? "نتائج التقييمات" : "لوحة تحكم التقييمات"}
        description={isSuperAdmin ? "استعراض جميع تقييمات الجودة المسجلة في المنصة." : `أهلاً بك، ${user.name}. يمكنك متابعة التقييمات وإكمالها.`}
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقييمات' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">قيد التنفيذ</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{active.length}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">مكتملة</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{completed.length}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">إجمالي التقييمات</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{assessments.length}</p>
          </div>
        </Card>
      </div>

      {assessments.length >= 2 && (
        <AssessmentComparisonSelector assessments={assessments} />
      )}

      <div>
        <h2 className="text-section font-bold text-foreground-strong mb-4">جميع التقييمات</h2>
        {assessments.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">لا توجد تقييمات مسجلة حالياً.</CardContent></Card>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-sm text-right">
                <thead className="text-xs text-muted-foreground bg-surface-muted uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">المدرسة</th>
                    <th className="px-5 py-3 font-medium">الفرع</th>
                    <th className="px-5 py-3 font-medium">المُقيّم</th>
                    <th className="px-5 py-3 font-medium">الدور</th>
                    <th className="px-5 py-3 font-medium">التقدم</th>
                    <th className="px-5 py-3 font-medium">الحالة</th>
                    <th className="px-5 py-3 font-medium hidden lg:table-cell">التاريخ</th>
                    <th className="px-5 py-3 font-medium text-left"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assessments.map(a => (
                    <tr key={a.id} className="hover:bg-surface-muted/50 transition-smooth">
                      <td className="px-5 py-4 font-medium text-foreground-strong">{a.school.name}</td>
                      <td className="px-5 py-4 text-muted-foreground">{a.branch?.name || "-"}</td>
                      <td className="px-5 py-4 text-foreground-strong">{a.assessor?.name || "غير محدد"}</td>
                      <td className="px-5 py-4">
                        <Badge variant={
                          a.assessor?.role === "QUALITY_ASSESSOR" ? "success" :
                          a.assessor?.role === "SCHOOL_MANAGER" ? "info" :
                          a.assessor?.role === "BRANCH_MANAGER" ? "warning" : "neutral"
                        }>
                          {a.assessor?.role === "QUALITY_ASSESSOR" ? "مقيم جودة" :
                           a.assessor?.role === "SCHOOL_MANAGER" ? "مدير مدرسة" :
                           a.assessor?.role === "BRANCH_MANAGER" ? "مدير فرع" : a.assessor?.role}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Progress value={a.progress} size="sm" className="w-16" tone={a.progress === 100 ? "success" : "default"} />
                          <span className="text-[11px] font-medium text-muted-foreground numeric">{a.progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={a.status === "COMPLETED" ? "success" : "warning"} dot>
                          {a.status === "COMPLETED" ? "مكتمل" : "جاري"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell text-muted-foreground text-xs">
                        {formatDate(a.startedAt.toISOString())}
                      </td>
                      <td className="px-5 py-4 text-left">
                        <Link href={`/quality-assessor/assessments/${a.id}`}>
                          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
                            {isSuperAdmin ? "عرض" : "فتح"}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}