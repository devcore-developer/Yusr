import { prisma } from "@/lib/prisma"
import { getCurrentUser, assertAssessmentAccess, getStageEditPolicy } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { AssessmentEngine } from "@/features/quality-assessment/components/AssessmentEngine"
import { StageEditor } from "@/features/quality-assessment/components/StageEditor"
import { Badge } from "@/components/ui/Badge"
import { Card, CardContent } from "@/components/ui/Card"
import { getStageLabel } from "@/lib/stages"

export default async function AssessmentPage({ params }: { params: { assessmentId: string } }) {
  const user = await getCurrentUser()

  if (!user || !["QUALITY_ASSESSOR", "SUPER_ADMIN", "SCHOOL_MANAGER", "BRANCH_MANAGER"].includes(user.role)) {
    redirect("/login")
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.assessmentId },
    include: {
      school: true,
      branch: true,
      evidenceResponses: true,
      responses: true,
      attachments: true
    },
  })

  if (!assessment) redirect("/quality-assessor")

  // فحص وصول موحد على الخادم: ملكية المقيّم + نطاق المدرسة/الفرع + عزل التقييمات الخاصة
  // (سابقاً: المقيّم لم يكن مقيّداً إلا بالملكية — وهذا سليم — لكن الفحص الآن موحد ومركزي)
  const allowed = await assertAssessmentAccess(user, assessment, "read")
  if (!allowed) redirect("/quality-assessor")

  // سياسة تعديل المرحلة التعليمية — نفس السياسة يفرضها الخادم في updateAssessmentStage
  const stagePolicy = await getStageEditPolicy(user, assessment)

  const domains = await prisma.domain.findMany({
    include: {
      axes: {
        include: {
          indicators: {
            include: {
              tools: true,
              fixedEvidence: {
                orderBy: { paragraphNo: 'asc' } // <--- الإصلاح الأول
              }
            }
          }
        }
      }
    },
  })

  // (جديد) عدد الاستبانات المرتبطة صراحةً بكل بند — لهذه المدرسة فقط (عزل كامل)،
  // بالعلاقة الصريحة بالمعرّفات (لا مطابقة نصية). أرقام عرض فقط — لا تدخل في أي حساب.
  const surveyLinkGroups = await prisma.survey.groupBy({
    by: ["indicatorId"],
    where: { schoolId: assessment.schoolId, indicatorId: { not: null } },
    _count: { _all: true },
  })
  const surveyLinkCounts: Record<string, number> = {}
  for (const g of surveyLinkGroups) {
    if (g.indicatorId) surveyLinkCounts[g.indicatorId] = g._count._all
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="مساحة التقييم"
        description={`${assessment.school.name} — ${assessment.branch?.name ?? "كامل المدرسة"}`}
        breadcrumbs={[
          { label: "الرئيسية", href: "/" },
          { label: "التقييمات", href: "/quality-assessor" },
          { label: "مساحة التقييم" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={assessment.stage ? "info" : "neutral"}>{getStageLabel(assessment.stage)}</Badge>
            <Badge variant={assessment.status === "COMPLETED" ? "success" : "warning"} dot>{assessment.status === "COMPLETED" ? "مكتمل" : "جاري"}</Badge>
          </div>
        }
      />

      {/* قسم المرحلة التعليمية — عرض + تعديل وفق الصلاحيات وحالة التقييم */}
      <StageEditor
        assessmentId={assessment.id}
        currentStage={assessment.stage}
        canEdit={stagePolicy.allowed}
        lockHint={stagePolicy.reason}
      />

      <AssessmentEngine
        assessment={JSON.parse(JSON.stringify(assessment))}
        domains={JSON.parse(JSON.stringify(domains))}
        initialEvidenceResponses={JSON.parse(JSON.stringify(assessment.evidenceResponses))}
        initialNotesResponses={JSON.parse(JSON.stringify(assessment.responses))}
        initialAttachments={JSON.parse(JSON.stringify(assessment.attachments))}
        userRole={user.role}
        userId={user.id}
        surveyLinkCounts={surveyLinkCounts}
      />
    </div>
  )
}