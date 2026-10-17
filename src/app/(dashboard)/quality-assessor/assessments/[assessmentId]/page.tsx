import { prisma } from "@/lib/prisma"
import { getCurrentUser, assertAssessmentAccess } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { AssessmentEngine } from "@/features/quality-assessment/components/AssessmentEngine"
import { Badge } from "@/components/ui/Badge"
import { Card, CardContent } from "@/components/ui/Card"

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
        actions={<Badge variant={assessment.status === "COMPLETED" ? "success" : "warning"} dot>{assessment.status === "COMPLETED" ? "مكتمل" : "جاري"}</Badge>}
      />

      <AssessmentEngine
        assessment={JSON.parse(JSON.stringify(assessment))}
        domains={JSON.parse(JSON.stringify(domains))}
        initialEvidenceResponses={JSON.parse(JSON.stringify(assessment.evidenceResponses))}
        initialNotesResponses={JSON.parse(JSON.stringify(assessment.responses))}
        initialAttachments={JSON.parse(JSON.stringify(assessment.attachments))}
        userRole={user.role}
        userId={user.id}
      />
    </div>
  )
}