import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Progress } from "@/components/ui/Progress"
import Link from "next/link"
import Image from "next/image"
import { getPerformanceBand } from "@/features/quality-assessment/services/analysis"

// Shared calculation function for branch performance
async function calculateBranchPerformance(branchId: string) {
  const totalEvidence = await prisma.fixedEvidence.count()
  
  const assessments = await prisma.assessment.findMany({
    where: {
      branchId,
      type: { not: "PRIVATE_REVIEW" },
      status: "COMPLETED"
    },
    include: {
      assessor: { select: { id: true, name: true, role: true } },
      evidenceResponses: { where: { isVerified: true } }
    }
  })

  if (assessments.length === 0) {
    return {
      percentage: null as number | null,
      band: 'غير مقيم',
      assessmentCount: 0,
      evaluators: [] as any[],
      assessments: [] as any[]
    }
  }

  const assessmentScores = assessments.map(a => {
    const verified = a.evidenceResponses.length
    return {
      id: a.id,
      assessorId: a.assessor.id,
      assessorName: a.assessor.name,
      assessorRole: a.assessor.role,
      score: totalEvidence > 0 ? Math.round((verified / totalEvidence) * 100) : 0,
      verifiedCount: verified,
      totalEvidence
    }
  })

  const avgScore = Math.round(
    assessmentScores.reduce((sum, s) => sum + s.score, 0) / assessmentScores.length
  )

  // Unique evaluators
  const evaluatorMap = new Map()
  for (const s of assessmentScores) {
    if (!evaluatorMap.has(s.assessorId)) {
      evaluatorMap.set(s.assessorId, {
        id: s.assessorId,
        name: s.assessorName,
        role: s.assessorRole,
        assessmentCount: 0,
        scores: [] as number[]
      })
    }
    const ev = evaluatorMap.get(s.assessorId)
    ev.assessmentCount++
    ev.scores.push(s.score)
  }

  const evaluators = Array.from(evaluatorMap.values()).map(ev => ({
    ...ev,
    averageScore: Math.round(ev.scores.reduce((a: number, b: number) => a + b, 0) / ev.scores.length)
  }))

  return {
    percentage: avgScore,
    band: getPerformanceBand(avgScore),
    assessmentCount: assessments.length,
    evaluators,
    assessments: assessmentScores
  }
}

// Shared calculation for school performance
async function calculateSchoolPerformance(schoolId: string) {
  const totalEvidence = await prisma.fixedEvidence.count()
  
  const assessments = await prisma.assessment.findMany({
    where: {
      schoolId,
      type: { not: "PRIVATE_REVIEW" },
      status: "COMPLETED"
    },
    include: {
      assessor: { select: { id: true, name: true, role: true } },
      evidenceResponses: { where: { isVerified: true } }
    }
  })

  if (assessments.length === 0) {
    return {
      percentage: null as number | null,
      band: 'غير مقيم',
      assessmentCount: 0,
      evaluators: [] as any[],
      assessments: [] as any[]
    }
  }

  const assessmentScores = assessments.map(a => {
    const verified = a.evidenceResponses.length
    return {
      id: a.id,
      assessorId: a.assessor.id,
      assessorName: a.assessor.name,
      assessorRole: a.assessor.role,
      score: totalEvidence > 0 ? Math.round((verified / totalEvidence) * 100) : 0,
      verifiedCount: verified,
      totalEvidence
    }
  })

  const avgScore = Math.round(
    assessmentScores.reduce((sum, s) => sum + s.score, 0) / assessmentScores.length
  )

  const evaluatorMap = new Map()
  for (const s of assessmentScores) {
    if (!evaluatorMap.has(s.assessorId)) {
      evaluatorMap.set(s.assessorId, {
        id: s.assessorId,
        name: s.assessorName,
        role: s.assessorRole,
        assessmentCount: 0,
        scores: [] as number[]
      })
    }
    const ev = evaluatorMap.get(s.assessorId)
    ev.assessmentCount++
    ev.scores.push(s.score)
  }

  const evaluators = Array.from(evaluatorMap.values()).map(ev => ({
    ...ev,
    averageScore: Math.round(ev.scores.reduce((a: number, b: number) => a + b, 0) / ev.scores.length)
  }))

  return {
    percentage: avgScore,
    band: getPerformanceBand(avgScore),
    assessmentCount: assessments.length,
    evaluators,
    assessments: assessmentScores
  }
}

export default async function ReportsPage({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const isSuperAdmin = user.role === "SUPER_ADMIN"
  const isSchoolManager = user.role === "SCHOOL_MANAGER"
  const isBranchManager = user.role === "BRANCH_MANAGER"
  const isQualityAssessor = user.role === "QUALITY_ASSESSOR"

  // === 1. Super Admin: School comparison ===
  if (isSuperAdmin) {
    const schools = await prisma.school.findMany({
      include: { 
        _count: { select: { branches: true } },
        assessments: { 
          where: { type: { not: "PRIVATE_REVIEW" }, status: "COMPLETED" },
          include: { assessor: true }
        }
      }
    })

    const schoolStats = await Promise.all(schools.map(async s => {
      const perf = await calculateSchoolPerformance(s.id)
      return { 
        ...s, 
        completed: perf.assessmentCount,
        total: s.assessments.length,
        pct: perf.percentage ?? 0,
        band: perf.band,
        percentage: perf.percentage
      }
    }))

    return (
      <div className="space-y-6">
        <PageHeader
          title="تقارير المنصة الشاملة"
          description="مقارنة أداء المدارس المسجلة ونسب إكمال التقييمات."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        />

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-sm text-right">
              <thead className="text-[12px] text-muted-foreground bg-surface-muted uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium">المدرسة</th>
                  <th className="px-6 py-4 font-medium">الفروع</th>
                  <th className="px-6 py-4 font-medium">التقييمات المكتملة</th>
                  <th className="px-6 py-4 font-medium">الأداء العام</th>
                  <th className="px-6 py-4 font-medium">المستوى</th>
                  <th className="px-6 py-4 font-medium text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schoolStats.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-muted/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {s.logoUrl ? (
                          <Image src={s.logoUrl} alt={s.name} width={32} height={32} className="rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{s.name.charAt(0)}</div>
                        )}
                        <span className="font-medium text-foreground-strong">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground numeric">{s._count.branches}</td>
                    <td className="px-6 py-4 text-muted-foreground numeric">{s.completed}</td>
                    <td className="px-6 py-4 min-w-[150px]">
                      {s.percentage !== null ? (
                        <div className="flex items-center gap-2">
                          <Progress value={s.percentage} size="sm" className="w-20" tone={s.percentage === 100 ? "success" : "default"} />
                          <span className="text-[12px] font-medium text-muted-foreground numeric">{s.percentage}%</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">غير مقيم</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={s.percentage === null ? "neutral" : s.percentage >= 90 ? "success" : s.percentage >= 75 ? "info" : s.percentage >= 50 ? "warning" : "danger"}>
                        {s.band}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <Link href={`/reports/print?scope=single&schoolId=${s.id}`}>
                        <Button variant="ghost" size="sm">تقرير المدرسة</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">تصدير تقرير شامل (جميع المدارس)</h3>
          <form action="/reports/print" method="GET">
            <input type="hidden" name="scope" value="all" />
            <Button type="submit" variant="outline">تجهيز التقرير الشامل (PDF)</Button>
          </form>
        </Card>
      </div>
    )
  }

  // === 2. Branch Manager: Multi-evaluator branch report ===
  if (isBranchManager && user.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: user.branchId },
      include: { school: { select: { name: true, logoUrl: true, id: true } } }
    })

    if (!branch) return null

    const perf = await calculateBranchPerformance(branch.id)

    return (
      <div className="space-y-6">
        <PageHeader
          title={`تقارير فرع ${branch.name}`}
          description="نتائج تقييم الجودة لفرعك مع دعم متعدد المقيّمين."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        />

        {/* Overall Branch Performance */}
        <Card className="p-8 text-center bg-primary text-white shadow-premium">
          <h2 className="text-lg font-bold mb-4 text-white">النسبة الإجمالية لأداء الفرع</h2>
          {perf.percentage !== null ? (
            <>
              <div className="text-6xl font-bold mb-2 text-white numeric">{perf.percentage}%</div>
              <Badge variant={perf.percentage >= 90 ? "success" : perf.percentage >= 75 ? "info" : perf.percentage >= 50 ? "warning" : "danger"} className="text-base">{perf.band}</Badge>
              <p className="text-sm text-primary-100/80 mt-4">
                بناءً على {perf.assessmentCount} تقييم مكتمل • {perf.evaluators.length} مقيّم
              </p>
            </>
          ) : (
            <>
              <div className="text-6xl font-bold mb-2 text-white/60">—</div>
              <Badge variant="neutral" className="text-base">غير مقيم</Badge>
              <p className="text-sm text-primary-100/80 mt-4">لا توجد تقييمات مكتملة لهذا الفرع</p>
            </>
          )}
        </Card>

        {/* Multi-Evaluator Breakdown */}
        {perf.evaluators.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-bold mb-4">تقرير المقيمين الفردي</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="text-[12px] text-muted-foreground bg-surface-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">المقيّم</th>
                      <th className="px-4 py-3 font-medium">الدور</th>
                      <th className="px-4 py-3 font-medium">عدد التقييمات</th>
                      <th className="px-4 py-3 font-medium">متوسط الأداء</th>
                      <th className="px-4 py-3 font-medium">المستوى</th>
                      <th className="px-4 py-3 font-medium text-left">تقرير فردي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {perf.evaluators.map((ev: any) => (
                      <tr key={ev.id} className="hover:bg-surface-muted/50">
                        <td className="px-4 py-3 font-medium text-foreground-strong">{ev.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{ev.role}</td>
                        <td className="px-4 py-3 text-muted-foreground numeric">{ev.assessmentCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Progress value={ev.averageScore} size="sm" className="w-20" tone={ev.averageScore === 100 ? "success" : "default"} />
                            <span className="text-[12px] font-medium numeric">{ev.averageScore}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={ev.averageScore >= 90 ? "success" : ev.averageScore >= 75 ? "info" : ev.averageScore >= 50 ? "warning" : "danger"}>
                            {getPerformanceBand(ev.averageScore)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-left">
                          <Link href={`/reports/print?scope=evaluator&branchId=${branch.id}&evaluatorId=${ev.id}`}>
                            <Button variant="outline" size="sm">تقرير فردي</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Individual Assessment Scores */}
        {perf.assessments.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-bold mb-4">تفاصيل التقييمات المكتملة</h3>
              <div className="divide-y divide-border">
                {perf.assessments.map((a: any) => (
                  <div key={a.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-foreground-strong">{a.assessorName}</p>
                      <p className="text-xs text-muted-foreground">{a.assessorRole} • {a.verifiedCount}/{a.totalEvidence} شاهد متحقق</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={a.score >= 90 ? "success" : a.score >= 75 ? "info" : a.score >= 50 ? "warning" : "danger"}>
                        {a.score}%
                      </Badge>
                      <Link href={`/quality/assessments/${a.id}/results`}>
                        <Button variant="ghost" size="sm">عرض</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="p-6">
          <h3 className="font-bold mb-4">تصدير التقارير</h3>
          <div className="flex flex-wrap gap-3">
            <form action="/reports/print" method="GET">
              <input type="hidden" name="scope" value="single" />
              <input type="hidden" name="schoolId" value={branch.school.id} />
              <input type="hidden" name="branchId" value={branch.id} />
              <Button type="submit">تقرير الفرع الشامل (PDF)</Button>
            </form>
            <form action="/reports/print" method="GET">
              <input type="hidden" name="scope" value="comprehensive" />
              <input type="hidden" name="branchId" value={branch.id} />
              <Button type="submit" variant="outline">تقرير مقارنة المقيمين (PDF)</Button>
            </form>
          </div>
        </Card>
      </div>
    )
  }

  // === 3. School Manager: School-wide report with multi-evaluator ===
  if (isSchoolManager && user.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      include: { 
        branches: true,
        assessments: { 
          where: { type: { not: "PRIVATE_REVIEW" }, status: "COMPLETED" },
          include: { assessor: true, branch: true }
        }
      }
    })

    if (!school) return null

    const perf = await calculateSchoolPerformance(school.id)

    return (
      <div className="space-y-6">
        <PageHeader
          title={`تقارير ${school.name}`}
          description="نتائج تقييم الجودة لمدرستك مع دعم متعدد المقيّمين."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        />

        <Card className="p-8 text-center bg-primary text-white shadow-premium">
          <h2 className="text-lg font-bold mb-4 text-white">النسبة الإجمالية للأداء</h2>
          {perf.percentage !== null ? (
            <>
              <div className="text-6xl font-bold mb-2 text-white numeric">{perf.percentage}%</div>
              <Badge variant={perf.percentage >= 90 ? "success" : perf.percentage >= 75 ? "info" : perf.percentage >= 50 ? "warning" : "danger"} className="text-base">{perf.band}</Badge>
              <p className="text-sm text-primary-100/80 mt-4">
                بناءً على {perf.assessmentCount} تقييم مكتمل • {perf.evaluators.length} مقيّم • {school.branches.length} فرع
              </p>
            </>
          ) : (
            <>
              <div className="text-6xl font-bold mb-2 text-white/60">—</div>
              <Badge variant="neutral" className="text-base">غير مقيم</Badge>
              <p className="text-sm text-primary-100/80 mt-4">لا توجد تقييمات مكتملة</p>
            </>
          )}
        </Card>

        {/* Multi-Evaluator Breakdown */}
        {perf.evaluators.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-bold mb-4">تقرير المقيمين</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="text-[12px] text-muted-foreground bg-surface-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">المقيّم</th>
                      <th className="px-4 py-3 font-medium">الدور</th>
                      <th className="px-4 py-3 font-medium">عدد التقييمات</th>
                      <th className="px-4 py-3 font-medium">متوسط الأداء</th>
                      <th className="px-4 py-3 font-medium">المستوى</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {perf.evaluators.map((ev: any) => (
                      <tr key={ev.id} className="hover:bg-surface-muted/50">
                        <td className="px-4 py-3 font-medium text-foreground-strong">{ev.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{ev.role}</td>
                        <td className="px-4 py-3 text-muted-foreground numeric">{ev.assessmentCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Progress value={ev.averageScore} size="sm" className="w-20" />
                            <span className="text-[12px] font-medium numeric">{ev.averageScore}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={ev.averageScore >= 90 ? "success" : ev.averageScore >= 75 ? "info" : ev.averageScore >= 50 ? "warning" : "danger"}>
                            {getPerformanceBand(ev.averageScore)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Individual Assessment List */}
        {perf.assessments.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h3 className="font-bold mb-4">سجل التقييمات المكتملة</h3>
              <div className="divide-y divide-border">
                {perf.assessments.map((a: any) => (
                  <div key={a.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-foreground-strong">{a.assessorName}</p>
                      <p className="text-xs text-muted-foreground">{a.assessorRole} • {a.verifiedCount}/{a.totalEvidence} شاهد</p>
                    </div>
                    <Badge variant={a.score >= 90 ? "success" : a.score >= 75 ? "info" : a.score >= 50 ? "warning" : "danger"}>{a.score}%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="p-6">
          <h3 className="font-bold mb-4">تصدير تقرير المدرسة</h3>
          <form action="/reports/print" method="GET">
            <input type="hidden" name="scope" value="single" />
            <input type="hidden" name="schoolId" value={school.id} />
            <Button type="submit">تجهيز تقرير المدرسة (PDF)</Button>
          </form>
        </Card>
      </div>
    )
  }

  // === 4. Quality Assessor: Own assessments ===
  if (isQualityAssessor && user.schoolId) {
    const assessments = await prisma.assessment.findMany({
      where: { 
        assessorId: user.id, 
        type: { not: "PRIVATE_REVIEW" } 
      },
      include: { school: true, branch: true }
    })

    const completedAssessments = assessments.filter(a => a.status === "COMPLETED")
    const totalEvidence = await prisma.fixedEvidence.count()
    
    const assessmentScores = await Promise.all(
      completedAssessments.map(async (a) => {
        const verified = await prisma.evidenceResponse.count({
          where: { assessmentId: a.id, isVerified: true }
        })
        return {
          ...a,
          score: totalEvidence > 0 ? Math.round((verified / totalEvidence) * 100) : 0,
          verifiedCount: verified
        }
      })
    )

    const avgScore = assessmentScores.length > 0
      ? Math.round(assessmentScores.reduce((acc, a) => acc + a.score, 0) / assessmentScores.length)
      : null

    const band = getPerformanceBand(avgScore)

    return (
      <div className="space-y-6">
        <PageHeader
          title="تقارير تقييماتي"
          description="نتائج تقييمات الجودة التي قمت بإجرائها."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        />

        <Card className="p-8 text-center bg-primary text-white shadow-premium">
          <h2 className="text-lg font-bold mb-4 text-white">متوسط نسبة تحقق الشواهد</h2>
          {avgScore !== null ? (
            <>
              <div className="text-6xl font-bold mb-2 text-white numeric">{avgScore}%</div>
              <Badge variant={avgScore >= 90 ? "success" : avgScore >= 75 ? "info" : avgScore >= 50 ? "warning" : "danger"} className="text-base">{band}</Badge>
              <p className="text-sm text-primary-100/80 mt-4">
                بناءً على {completedAssessments.length} تقييم مكتمل
              </p>
            </>
          ) : (
            <>
              <div className="text-6xl font-bold mb-2 text-white/60">—</div>
              <Badge variant="neutral" className="text-base">غير مقيم</Badge>
              <p className="text-sm text-primary-100/80 mt-4">لا توجد تقييمات مكتملة</p>
            </>
          )}
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold mb-4">سجل تقييماتي</h3>
            <div className="divide-y divide-border">
              {assessmentScores.map(a => (
                <div key={a.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-foreground-strong">{a.school.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.branch?.name || "كامل المدرسة"} • {a.verifiedCount}/{totalEvidence} شاهد • {a.status === "COMPLETED" ? "مكتمل" : "جاري"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.status === "COMPLETED" ? (
                      <Badge variant={a.score >= 90 ? "success" : a.score >= 75 ? "info" : a.score >= 50 ? "warning" : "danger"}>{a.score}%</Badge>
                    ) : (
                      <Badge variant="warning">جاري</Badge>
                    )}
                    <Link href={`/quality-assessor/assessments/${a.id}`}>
                      <Button variant="outline" size="sm">عرض التقييم</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}