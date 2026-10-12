import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { AssessmentEngine } from "@/features/quality-assessment/components/AssessmentEngine"
import { Badge } from "@/components/ui/Badge"

export default async function AssessmentPage({ params }: { params: { assessmentId: string } }) {
  const user = await getCurrentUser()
  
  // 1. السماح للمقيم، السوبر أدمن، مدير المدرسة، ومدير الفرع بالدخول للصفحة
  if (!user || !["QUALITY_ASSESSOR", "SUPER_ADMIN", "SCHOOL_MANAGER", "BRANCH_MANAGER"].includes(user.role)) {
    redirect("/login")
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.assessmentId },
    include: { school: true, branch: true, responses: true },
  })

  if (!assessment) redirect("/quality-assessor")

  // 2. التحقق من الملكية والنطاق (Tenant Isolation)
  if (user.role === "SUPER_ADMIN") {
    // السوبر أدمن يرى كل شيء (للقراءة فقط كما أعددنا سابقاً)
  } else if (user.role === "SCHOOL_MANAGER") {
    // مدير المدرسة يجب أن يكون نفس مدرسة التقييم
    if (assessment.schoolId !== user.schoolId) {
      redirect("/quality-assessor")
    }
  } else if (user.role === "BRANCH_MANAGER") {
    // مدير الفرع يجب أن يكون نفس فرع التقييم
    if (assessment.branchId !== user.branchId) {
      redirect("/quality-assessor")
    }
  } else if (user.role === "QUALITY_ASSESSOR") {
    // المقيم يجب أن يكون هو المسؤول عن التقييم
    if (assessment.assessorId !== user.id) {
      redirect("/quality-assessor")
    }
  }

  const domains = await prisma.domain.findMany({
    include: { 
      axes: { 
        include: { 
          indicators: {
            include: {
              tools: true,
              fixedEvidence: true
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
        initialResponses={JSON.parse(JSON.stringify(assessment.responses))}
        userRole={user.role} // أضف هذا السطر
      />
    </div>
  )
}