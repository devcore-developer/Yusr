import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge, StatusBadge, PriorityBadge } from "@/components/ui/Badge"
import { AlertTriangle, CheckCircle, Eye } from "lucide-react"
import Link from "next/link"

export default async function GapsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const where = {
    ...(user.role === "SUPER_ADMIN" ? {} : { schoolId: user.schoolId! }),
    assessment: { type: { not: "PRIVATE_REVIEW" } } // استبعاد فجوات التقييم الخاص
  }
  
  const gaps = await prisma.gap.findMany({
    where,
    include: { 
      indicator: { include: { domain: true, axis: true } }, 
      branch: true,
      school: true,
      assessment: true
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  })

  const indicatorIds = [...new Set(gaps.map(g => g.indicatorId))]
  const evidenceCounts = await prisma.fixedEvidence.groupBy({
    by: ['indicatorId'],
    where: { indicatorId: { in: indicatorIds } },
    _count: true
  })

  const assessmentIds = [...new Set(gaps.map(g => g.assessmentId))]
  const verifiedCounts = await prisma.evidenceResponse.groupBy({
    by: ['assessmentId'],
    where: { 
      assessmentId: { in: assessmentIds },
      isVerified: true 
    },
    _count: true
  })

  const openCount = gaps.filter(g => g.status === "OPEN").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="فجوات الجودة"
        description="المؤشرات غير المتحققة التي تحتاج متابعة وخطط تحسين."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'الفجوات' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-danger/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-danger" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">إجمالي الفجوات</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{gaps.length}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">فجوات مفتوحة</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{openCount}</p>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">تم حلها</p>
            <p className="text-2xl font-bold text-foreground-strong numeric">{gaps.filter(g => g.status === "RESOLVED").length}</p>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {gaps.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success/50" />
              <p className="font-medium text-foreground-strong mb-1">لا توجد فجوات مسجلة حاليًا</p>
              <p className="text-sm">ستظهر الفجوات هنا تلقائيًا عند تقييم الشواهد بـ "غير متحقق".</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {gaps.map((gap) => {
                const totalEvidence = evidenceCounts.find(e => e.indicatorId === gap.indicatorId)?._count ?? 0
                const verifiedEvidence = verifiedCounts.find(v => v.assessmentId === gap.assessmentId)?._count ?? 0
                const unverifiedCount = Math.max(0, totalEvidence - verifiedEvidence)

                return (
                  <div key={gap.id} className="p-5 hover:bg-surface-muted/30 transition-smooth">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="neutral" className="font-mono text-[11px]">{gap.indicator.code}</Badge>
                          <PriorityBadge priority={gap.severity} />
                          <StatusBadge status={gap.status} />
                        </div>
                        <p className="text-sm font-medium text-foreground-strong mb-1">{gap.indicator.description}</p>
                        
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
                          <span>المجال: <span className="text-foreground-strong">{gap.indicator.domain.name}</span></span>
                          {gap.indicator.axis && (
                            <span>المحور: <span className="text-foreground-strong">{gap.indicator.axis.name}</span></span>
                          )}
                        </div>

                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-danger/5 border border-danger/10 rounded-md">
                          <AlertTriangle className="w-3.5 h-3.5 text-danger" />
                          <span className="text-sm font-medium text-danger numeric">
                            {unverifiedCount} شواهد غير متحققة
                          </span>
                          <span className="text-xs text-muted-foreground">من أصل {totalEvidence}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link href={`/quality-assessor/assessments/${gap.assessmentId}`}>
                          <Button variant="outline" size="sm" icon={<Eye className="w-4 h-4" />}>
                            مراجعة الشواهد
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}