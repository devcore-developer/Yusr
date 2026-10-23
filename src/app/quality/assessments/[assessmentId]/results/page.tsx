// ===== FILE: src/app/quality/assessments/[assessmentId]/results/page.tsx =====
import { prisma } from "@/lib/prisma"
import { getCurrentUser, assertAssessmentAccess, getStageEditPolicy } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { StatCard } from "@/components/dashboard/StatCard"
import { Badge, StatusBadge, PriorityBadge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { EmptyState } from "@/components/ui/EmptyState"
import { CheckCircle, XCircle, FileText, AlertTriangle, ArrowRight, BarChart2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { formatDate } from "@/lib/utils"
import { getStageLabel } from "@/lib/stages"
import { StageEditor } from "@/features/quality-assessment/components/StageEditor"
import { AcademicYearBadge } from "@/components/academic-years/AcademicYearBadge"
import { SurveyComparisonTable } from "@/components/reports/SurveyComparisonTable"
import { buildItemComparison } from "@/features/quality-reports/services/survey-integration"
import { getSurveyIntegrationConfig, getSchoolLinkedSurveysByIndicator } from "@/features/quality-reports/services/survey-integration.server"

export default async function AssessmentResultsPage({ params }: { params: { assessmentId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.assessmentId },
    include: {
      school: true, 
      branch: true, 
      assessor: true,
      academicYear: true, // العام المخزّن لهذا التقييم — لا يُقرأ من العام النشط الحالي
      gaps: { include: { indicator: { include: { domain: true } } } },
      // (جديد) الاستجابات المتحققة لقسم مقارنة البنود مع الاستبانات — من هذا التقييم فقط
      // (evidenceId يُفعّل تفريد الشواهد في buildItemComparison — زيارات الملاحظة الصفية)
      evidenceResponses: {
        where: { isVerified: true },
        select: { evidenceId: true, evidence: { select: { indicatorId: true } } },
      },
    },
  })
  
  if (!assessment) redirect("/")

  // فحص وصول موحد على الخادم — يغلق ثغرتين:
  // 1) BRANCH_MANAGER كان بلا أي فحص (يمكنه فتح نتائج أي مدرسة)
  // 2) التقييمات الخاصة (PRIVATE_REVIEW) كانت تظهر لالمدير العام
  const allowed = await assertAssessmentAccess(user, assessment, "read")
  if (!allowed) redirect("/")

  // (هذه المهمة) سياسة تعديل مرحلة هذا التقرير — نفس السياسة المفروضة خادميًا
  // في updateAssessmentStage: المكتمل المحدد المرحلة مُقفل، والمكتمل بلا مرحلة
  // (سجل تاريخي) قابل للتعيين مرة واحدة مع تأكيد صريح وتسجيل في سجل النشاط.
  const stagePolicy = await getStageEditPolicy(user, assessment)

  const confirmedGaps = assessment.gaps

  // (جديد) بيانات مقارنة البنود المرتبطة باستبانات — كل الأرقام من الخدمة النقية
  // survey-integration.ts: درجة الأدوات بنفس معادلة جداول المجالات، ونتيجة الاستبانة
  // من الربط الصريح بالمعرّفات لهذه المدرسة فقط، والمدمجة غير رسمية ولا تعود إلا بإعداد معتمد.
  const [officialDomains, surveyConfig, linkedSurveysByIndicator] = await Promise.all([
    prisma.domain.findMany({
      include: { indicators: { include: { fixedEvidence: true } } },
    }),
    getSurveyIntegrationConfig(assessment.schoolId),
    getSchoolLinkedSurveysByIndicator(assessment.schoolId),
  ])
  const comparison = buildItemComparison({
    officialDomains,
    verifiedResponses: assessment.evidenceResponses,
    linkedSurveysByIndicator,
    config: surveyConfig,
  })

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title="نتائج التقييم"
        description={`${assessment.school.name} — ${assessment.branch?.name ?? "كامل المدرسة"}`}
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "التقييمات" },
          { label: "النتائج" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {/* العام الدراسي من العلاقة المخزّنة للتقييم — السجلات التاريخية بلا عام تظهر «غير محدد» */}
            <AcademicYearBadge year={assessment.academicYear} />
            <Badge variant={assessment.stage ? "info" : "neutral"}>{getStageLabel(assessment.stage)}</Badge>
            <StatusBadge status={assessment.status} />
            <span className="text-[13px] text-muted-foreground numeric">{formatDate(assessment.startedAt.toISOString())}</span>
          </div>
        }
      />

      {/* (هذه المهمة) قسم المرحلة التعليمية للتقرير — عرض وتصحيح للمرحلة المحفوظة
          وفق نفس سياسة الصلاحيات القائمة (getStageEditPolicy). المرحلة تُقرأ من
          حقل التقييم المخزن حصرًا — لا تُورث من إعدادات أي حساب ولا تتغير
          صامتًا، والتقييم المكتمل المحدد المرحلة يبقى مقفولًا. */}
      <StageEditor
        assessmentId={assessment.id}
        currentStage={assessment.stage}
        canEdit={stagePolicy.allowed}
        lockHint={stagePolicy.reason}
        isCompleted={assessment.status === "COMPLETED"}
      />

      {/* ===== Executive Summary ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <StatCard
          label="نسبة الإكمال"
          value={`${assessment.progress}%`}
          icon={<FileText className="w-5 h-5" />}
          tone="info"
          progress={{ value: assessment.progress }}
        />
        <StatCard
          label="فجوات مكتشفة"
          value={confirmedGaps.length}
          icon={<XCircle className="w-5 h-5" />}
          tone="danger"
          context="تتطلب تحسيناً"
        />
      </div>

      {/* ===== Confirmed Gaps ===== */}
      <Card variant="primary">
        <CardHeader>
          <CardTitle icon={<AlertTriangle className="w-5 h-5" />}>الفجوات المؤكدة</CardTitle>
          <CardDescription>{confirmedGaps.length} فجوة مسجلة</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {confirmedGaps.length === 0 ? (
            <EmptyState
              icon={<CheckCircle />}
              title="لا توجد فجوات مؤكدة"
              description="جميع المؤشرات المُقيّمة محققة أو لا تنطبق."
              compact
            />
          ) : (
            <ul className="divide-y divide-border">
              {confirmedGaps.map((gap) => (
                <li key={gap.id} className="flex items-start gap-4 p-4 hover:bg-surface-muted transition-smooth">
                  <div className="tint-danger w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[12px] text-secondary">{gap.indicator.code}</span>
                      <PriorityBadge priority={gap.severity} />
                      <StatusBadge status={gap.status} />
                    </div>
                    <p className="text-sm text-foreground-strong">{gap.description}</p>
                    <p className="text-[12px] text-muted-foreground mt-1">{gap.indicator.domain.name}</p>
                  </div>
                  <Link href={`/school-manager/quality/improvement-plans/new?gapId=${gap.id}`}>
                    <Button variant="soft" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                      خطة تحسين
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* (جديد) مقارنة نتائج البنود المرتبطة باستبانات — قسم مكمّل للعرض والمقارنة فقط،
          لا يغيّر نتيجة التقييم الرسمية ولا أوزان المجالات. يظهر فقط عند وجود بنود مرتبطة فعلًا. */}
      {comparison.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle icon={<BarChart2 className="w-5 h-5" />}>مقارنة نتائج البنود مع الاستبانات</CardTitle>
            <CardDescription>
              نتيجة التقييم بالأدوات ونتيجة الاستبانة والنتيجة المدمجة (غير رسمية) لكل بند مرتبط — {comparison.rows.length} بند
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <SurveyComparisonTable rows={comparison.rows} diagnostics={comparison.diagnostics} variant="screen" />
          </CardContent>
        </Card>
      )}
    </div>
  )
}