import { prisma } from "@/lib/prisma"
import { getCurrentUser, assertAssessmentAccess } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { StatCard } from "@/components/dashboard/StatCard"
import { Badge, StatusBadge, PriorityBadge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { EmptyState } from "@/components/ui/EmptyState"
import { CheckCircle, XCircle, FileText, AlertTriangle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { formatDate } from "@/lib/utils"

export default async function AssessmentResultsPage({ params }: { params: { assessmentId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const assessment = await prisma.assessment.findUnique({
    where: { id: params.assessmentId },
    include: {
      school: true, 
      branch: true, 
      assessor: true,
      gaps: { include: { indicator: { include: { domain: true } } } },
    },
  })
  
  if (!assessment) redirect("/")

  // فحص وصول موحد على الخادم — يغلق ثغرتين:
  // 1) BRANCH_MANAGER كان بلا أي فحص (يمكنه فتح نتائج أي مدرسة)
  // 2) التقييمات الخاصة (PRIVATE_REVIEW) كانت تظهر لالمدير العام
  const allowed = await assertAssessmentAccess(user, assessment, "read")
  if (!allowed) redirect("/")

  const confirmedGaps = assessment.gaps

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
            <StatusBadge status={assessment.status} />
            <span className="text-[13px] text-muted-foreground numeric">{formatDate(assessment.startedAt.toISOString())}</span>
          </div>
        }
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
    </div>
  )
}