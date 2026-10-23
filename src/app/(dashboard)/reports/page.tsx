// ===== FILE: src/app/(dashboard)/reports/page.tsx =====
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
import { formatDate } from "@/lib/utils"
import { EDUCATIONAL_STAGES, getStageLabel, stageFilterToParam, type StageFilterValue } from "@/lib/stages"
import {
  resolveReportFilters,
  buildReportFilterWhere,
  reportFiltersToParams,
  reportFiltersToQueryString,
  type AssessmentStatusFilter,
} from "@/features/quality-reports/services/report-filters"
import { countDistinctVerifiedEvidence } from "@/features/quality-reports/services/weighted-score"
import { ReportFiltersBar } from "@/components/reports/ReportFiltersBar"
import { WeightedEvaluationSection } from "@/components/reports/WeightedEvaluationSection"
import { ReportsLogSection, type ReportsLogRowData } from "@/components/reports/ReportsLogSection"
import { computeReportsLogKpis } from "@/features/quality-reports/services/reports-log"

// ============================================================
// فلتر المرحلة التعليمية (§6):
//  - undefined = كل المراحل (السلوك الافتراضي — لا تغيير على التقرير الحالي)
//  - null = السجلات التاريخية غير المحددة (stage IS NULL)
//  - EducationalStageId = مرحلة واحدة
// الفلتر يُطبق AND على استعلامات الخادم في كل الأقسام — لا يوسع أي نطاق.
// منهجية الحساب لم تتغير إطلاقًا: درجة كل تقييم من استجاباته هو فقط.
// ============================================================

function StageFilterBar({ current }: { current: StageFilterValue | undefined }) {
  const options: { value: string; label: string }[] = [
    { value: "", label: "كل المراحل" },
    ...EDUCATIONAL_STAGES.map(s => ({ value: s.id, label: s.ar })),
    { value: "UNSPECIFIED", label: "غير محددة" },
  ]
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className="text-[13px] font-medium text-muted-foreground">المرحلة التعليمية:</span>
        {options.map(o => {
          const isActive =
            o.value === "" ? current === undefined : o.value === "UNSPECIFIED" ? current === null : current === o.value
          return (
            <Link
              key={o.value || "all"}
              href={o.value ? `/reports?stage=${o.value}` : "/reports"}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-smooth whitespace-nowrap ${
                isActive
                  ? "bg-primary text-white border-primary"
                  : "bg-surface-muted text-muted-foreground border-border hover:border-primary/60"
              }`}
            >
              {o.label}
            </Link>
          )
        })}
      </div>
    </Card>
  )
}

// Shared calculation function for branch performance
async function calculateBranchPerformance(branchId: string, stageFilter?: StageFilterValue) {
  
  const assessments = await prisma.assessment.findMany({
    where: {
      branchId,
      type: { not: "PRIVATE_REVIEW" },
      status: "COMPLETED",
      // فلتر المرحلة (undefined = بلا فلتر / null = غير محددة / قيمة = مرحلة)
      ...(stageFilter !== undefined ? { stage: stageFilter } : {})
    },
    include: {
      assessor: { select: { id: true, name: true, role: true } },
      evidenceResponses: { where: { isVerified: true }, select: { evidenceId: true } }
    }
  })
  const totalEvidence = await prisma.fixedEvidence.count()

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
    // (إصلاح التضخم) المتحقق = شواهد مميزة لا صفوف استجابات — زيارات الملاحظة الصفية
    // لنفس الشاهد لا تُعدّ أكثر من مرة فلا تتخطى نسبة أي تقييم 100% أصلًا
    const verified = countDistinctVerifiedEvidence(a.evidenceResponses)
    return {
      id: a.id,
      assessorId: a.assessor?.id ?? "unknown",
      assessorName: a.assessor?.name ?? "غير محدد",
      assessorRole: a.assessor?.role ?? "غير محدد",
      score: totalEvidence > 0 ? Math.round((verified / totalEvidence) * 100) : 0,
      verifiedCount: verified,
      totalEvidence,
      // (§2) كل مدخل تقييم منفصل يحمل تاريخه الخاص
      startedAt: a.startedAt,
      // (§6) مرحلة هذا التقييم تُعرض مع مدخله — كل تقييم لمرحلة واحدة
      stage: a.stage
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
async function calculateSchoolPerformance(schoolId: string, stageFilter?: StageFilterValue) {
  const assessments = await prisma.assessment.findMany({
    where: {
      schoolId,
      type: { not: "PRIVATE_REVIEW" },
      status: "COMPLETED",
      // فلتر المرحلة — نفس دلالات دالة الفرع
      ...(stageFilter !== undefined ? { stage: stageFilter } : {})
    },
    include: {
      assessor: { select: { id: true, name: true, role: true } },
      branch: { select: { id: true, name: true } },
      evidenceResponses: { where: { isVerified: true }, select: { evidenceId: true } }
    }
  })
  const totalEvidence = await prisma.fixedEvidence.count()

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
    // (إصلاح التضخم) المتحقق = شواهد مميزة لا صفوف استجابات — زيارات الملاحظة الصفية
    // لنفس الشاهد لا تُعدّ أكثر من مرة فلا تتخطى نسبة أي تقييم 100% أصلًا
    const verified = countDistinctVerifiedEvidence(a.evidenceResponses)
    return {
      id: a.id,
      assessorId: a.assessor?.id ?? "unknown",
      assessorName: a.assessor?.name ?? "غير محدد",
      assessorRole: a.assessor?.role ?? "غير محدد",
      score: totalEvidence > 0 ? Math.round((verified / totalEvidence) * 100) : 0,
      verifiedCount: verified,
      totalEvidence,
      // (§2) كل مدخل تقييم منفصل يحمل تاريخه وفرعه الخاصين
      startedAt: a.startedAt,
      branchName: a.branch?.name || "كامل المدرسة",
      // (§6) مرحلة هذا التقييم
      stage: a.stage
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

  // (§3) فلاتر سجل التقارير من الرابط — تُدمج AND على استعلامات القوائم أدناه
  // ولا توسع نطاق الدور إطلاقًا (النطاق يُشتق من المستخدم الموثق في كل قسم)
  const filters = resolveReportFilters(searchParams)
  const stageFilter = filters.stage
  const stageParam = stageFilterToParam(stageFilter)
  const filterParams = reportFiltersToParams(filters)
  const filtersQs = reportFiltersToQueryString(filters)
  const filtersQsSuffix = filtersQs ? `&${filtersQs}` : ""
  const filterHiddenInputs = Object.entries(filterParams).map(([k, v]) => (
    <input key={k} type="hidden" name={k} value={v} />
  ))

  // === 1. Super Admin: School comparison ===
  if (isSuperAdmin) {
    const schools = await prisma.school.findMany({
      include: { 
        _count: { select: { branches: true } },
        assessments: { 
          where: { type: { not: "PRIVATE_REVIEW" }, status: "COMPLETED", ...(stageFilter !== undefined ? { stage: stageFilter } : {}) },
          include: { assessor: true }
        }
      }
    })

    const schoolStats = await Promise.all(schools.map(async s => {
      const perf = await calculateSchoolPerformance(s.id, stageFilter)
      return { 
        ...s, 
        completed: perf.assessmentCount,
        total: s.assessments.length,
        pct: perf.percentage ?? 0,
        band: perf.band,
        percentage: perf.percentage
      }
    }))

    // (§3) قائمة التقارير المطابقة للفلاتر — مدير النظام ينتقي مدرسة/مقيّمًا/مرحلة/عامًا/فترة/حالة
    // ويفتح تقرير التقييم المحدد — كل صف يحمل معرّفاته الكاملة (§2)
    // الحالة: «حسب الافتراضي» (بلا معامل) = COMPLETED كما كان — و«الكل» الصريح يلغي قيد
    // الحالة نهائيًا (listStatus !== "ALL" أدناه) بدل دفنه في COMPLETED — نوع التصفية
    // AssessmentStatusFilter من وحدة الفلاتر نفسها حتى يقبل مقارنة "ALL" ترجمةً ودلالةً.
    const listStatus: AssessmentStatusFilter =
      filters.status === "IN_PROGRESS" || filters.status === "ALL" ? filters.status : "COMPLETED"
    const [saList, saAssessorRows, saYears, saTotalEvidence, saScopeRows] = await Promise.all([
      prisma.assessment.findMany({
        where: {
          type: { not: "PRIVATE_REVIEW" },
          ...buildReportFilterWhere(filters),
          ...(listStatus !== "ALL" ? { status: listStatus } : {}),
        },
        include: {
          school: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          assessor: { select: { id: true, name: true, role: true } },
          academicYear: { select: { id: true, label: true } },
          evidenceResponses: { where: { isVerified: true }, select: { evidenceId: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 200,
      }),
      prisma.assessment.findMany({
        where: { type: { not: "PRIVATE_REVIEW" } },
        select: { assessor: { select: { id: true, name: true } } },
        distinct: ["assessorId"],
      }),
      prisma.academicYear.findMany({ select: { id: true, label: true }, orderBy: { startYear: "desc" } }),
      prisma.fixedEvidence.count(),
      // (إعادة تصميم سجل التقارير) نطاق القائمة الكامل — id + status فقط لكل التقييمات
      // المطابقة (وليس أول 200 صف) كي تُحسب أرقام الملخص من كامل النطاق الفعلي
      prisma.assessment.findMany({
        where: {
          type: { not: "PRIVATE_REVIEW" },
          ...buildReportFilterWhere(filters),
          ...(listStatus !== "ALL" ? { status: listStatus } : {}),
        },
        select: { id: true, status: true },
      }),
    ])
    // (إعادة تصميم سجل التقارير) توقيع صريح للخريطة — نفس التعبير والسلوك حرفيًا،
    // والنوع الصريح يثبت شكل العناصر المستهلكة في سجل التقارير أدناه
    const saAssessors: { id: string; name: string }[] = Array.from(
      new Map<string, string>(saAssessorRows.filter(r => r.assessor?.id).map(r => [r.assessor!.id, r.assessor!.name || "غير محدد"]))
    ).map(([id, name]) => ({ id, name }))

    // (إعادة تصميم سجل التقارير) أزواج الشواهد المتحققة + الخطط المرتبطة —
    // من معرفات النطاق الفعلي كله (تضييق عبر assessmentId — علاقة قائمة فعلًا في المخطط)
    const saScopeIds = saScopeRows.map(r => r.id)
    const [saPairs, saPlans] = await Promise.all([
      // التمييز على مستوى قاعدة البيانات (assessmentId+evidenceId) — نفس دلالة
      // countDistinctVerifiedEvidence المعتمدة: تكرار الزيارة لنفس الشاهد لا يُعدّ مرتين
      prisma.evidenceResponse.groupBy({
        by: ["assessmentId", "evidenceId"],
        where: { isVerified: true, assessmentId: { in: saScopeIds } },
      }),
      prisma.improvementPlan.findMany({
        where: { assessmentId: { in: saScopeIds } },
        select: { id: true, assessmentId: true, status: true, kind: true },
      }),
    ])
    // أرقام الملخص — من الوحدة النقية المختبرة (نفس المعادلات المعتمدة بلا أي معادلة جديدة)
    const saKpis = computeReportsLogKpis({
      statuses: saScopeRows,
      verifiedPairs: saPairs,
      totalEvidence: saTotalEvidence,
      linkedPlans: saPlans.length,
    })

    // صفوف القائمة — نفس بيانات الجدول القديم نفسها (بلا حذف أو اختصار)،
    // ودرجة كل صف بنفس معادلة الصفحة المعتمدة حرفيًا
    const saPlansByAssessment = new Map<string, { id: string; status: string; kind: string }>()
    for (const p of saPlans) {
      if (p.assessmentId) saPlansByAssessment.set(p.assessmentId, { id: p.id, status: p.status, kind: p.kind })
    }
    const saRows: ReportsLogRowData[] = saList.map(a => {
      const verified = countDistinctVerifiedEvidence(a.evidenceResponses)
      const score = saTotalEvidence > 0 ? Math.round((verified / saTotalEvidence) * 100) : 0
      return {
        id: a.id,
        schoolName: a.school.name,
        branchName: a.branch?.name ?? null,
        assessorName: a.assessor?.name ?? null,
        stageLabel: getStageLabel(a.stage),
        hasStage: !!a.stage,
        yearLabel: a.academicYear?.label ?? null,
        dateLabel: formatDate(a.startedAt.toISOString()),
        isCompleted: a.status === "COMPLETED",
        score,
        plan: saPlansByAssessment.get(a.id) ?? null,
      }
    })

    // فلاتر فعّالة (شاملة stage وstatus وq) — تتحكم في إظهار «إعادة تعيين»
    const saHasActiveFilters =
      Object.keys(filterParams).length > 0 || filters.status !== undefined || !!filters.q
    // فلاتر الرابط دون stage — تحفظها شرائح المرحلة في روابطها
    // (إصلاح سلوكي: شرائح المرحلة القديمة كانت تُسقط بقية الفلاتر عند التنقل)
    const qsForChips = new URLSearchParams(filtersQs)
    qsForChips.delete("stage")
    const filtersQsNoStage = qsForChips.toString()

    return (
      <div className="space-y-6">
        <PageHeader
          title="تقارير المنصة الشاملة"
          description="مقارنة أداء المدارس المسجلة ونسب إكمال التقييمات."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        />

        {/* (إعادة تصميم سجل التقارير) القسم الأول: بحث + فلاتر + ملخص أرقام + قائمة متجاوبة
            — نفس البيانات والإجراءات ونفس المعادلات المعتمدة بلا أي تغيير.
            القسم التالي (مقارنة المدارس + التصدير الشامل) يبقى كما هو دون أي تعديل */}
        <ReportsLogSection
          kpis={saKpis}
          totalEvidence={saTotalEvidence}
          rows={saRows}
          stageParam={stageParam}
          filtersQsNoStage={filtersQsNoStage}
          current={{
            schoolId: filters.schoolId,
            assessorId: filters.assessorId,
            yearParam: filterParams.year,
            from: filterParams.from,
            to: filterParams.to,
            status: filters.status,
            q: filters.q,
          }}
          hasActiveFilters={saHasActiveFilters}
          schools={schools.map(s => ({ id: s.id, name: s.name }))}
          assessors={saAssessors}
          years={saYears.map(y => ({ id: y.id, label: y.label }))}
        />

        {/* Desktop Table Layout */}
        <Card className="overflow-hidden hidden md:block">
          <CardContent className="p-0">
            <table className="w-full text-sm text-right min-w-[800px]">
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
                          <Image src={s.logoUrl} alt={s.name} width={32} height={32} className="rounded-full shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{s.name.charAt(0)}</div>
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
                      <Link href={`/reports/print?scope=single&schoolId=${s.id}${filtersQsSuffix}`}>
                        <Button variant="ghost" size="sm">تقرير المدرسة</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Mobile Cards */}
        <div className="grid grid-cols-1 gap-4 md:hidden min-w-0">
          {schoolStats.map((s) => (
            <Card key={s.id} className="p-4 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  {s.logoUrl ? (
                    <Image src={s.logoUrl} alt={s.name} width={36} height={36} className="rounded-full shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">{s.name.charAt(0)}</div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground-strong truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground numeric">{s._count.branches} فرع • {s.completed} تقييم مكتمل</p>
                  </div>
                </div>
                <Badge variant={s.percentage === null ? "neutral" : s.percentage >= 90 ? "success" : s.percentage >= 75 ? "info" : s.percentage >= 50 ? "warning" : "danger"}>
                  {s.band}
                </Badge>
              </div>
              {s.percentage !== null && (
                <div className="flex items-center gap-2 mb-3">
                  <Progress value={s.percentage} size="sm" className="w-full" tone={s.percentage === 100 ? "success" : "default"} />
                  <span className="text-[12px] font-medium numeric">{s.percentage}%</span>
                </div>
              )}
              <Link href={`/reports/print?scope=single&schoolId=${s.id}${filtersQsSuffix}`} className="block">
                <Button variant="outline" size="sm" className="w-full">تقرير المدرسة</Button>
              </Link>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <h3 className="font-bold mb-4">تصدير تقرير شامل (جميع المدارس)</h3>
          <form action="/reports/print" method="GET">
            <input type="hidden" name="scope" value="all" />
            {/* فلاتر السجل تُمرّر للتقرير المطبوع كي يطابق القائمة المفلترة */}
            {filterHiddenInputs}
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

    const perf = await calculateBranchPerformance(branch.id, stageFilter)

    // (§3) فلاتر السجل + خياراتها من بيانات الفرع الفعلية — الاستعلام مقيّد بفرع هذا الدور
    // الحالة: «حسب الافتراضي» (بلا معامل) = COMPLETED كما كان — و«الكل» الصريح يلغي قيد
    // الحالة نهائيًا (listStatus !== "ALL" أدناه) بدل دفنه في COMPLETED — نوع التصفية
    // AssessmentStatusFilter من وحدة الفلاتر نفسها حتى يقبل مقارنة "ALL" ترجمةً ودلالةً.
    const listStatus: AssessmentStatusFilter =
      filters.status === "IN_PROGRESS" || filters.status === "ALL" ? filters.status : "COMPLETED"
    const [bmList, bmAssessorRows, bmYears, bmTotalEvidence] = await Promise.all([
      prisma.assessment.findMany({
        where: {
          branchId: branch.id,
          type: { not: "PRIVATE_REVIEW" },
          ...buildReportFilterWhere(filters),
          ...(listStatus !== "ALL" ? { status: listStatus } : {}),
        },
        include: {
          assessor: { select: { id: true, name: true, role: true } },
          academicYear: { select: { id: true, label: true } },
          evidenceResponses: { where: { isVerified: true }, select: { evidenceId: true } },
        },
        orderBy: { startedAt: "desc" },
      }),
      prisma.assessment.findMany({
        where: { branchId: branch.id, type: { not: "PRIVATE_REVIEW" } },
        select: { assessor: { select: { id: true, name: true } } },
        distinct: ["assessorId"],
      }),
      prisma.academicYear.findMany({ where: { schoolId: branch.school.id }, orderBy: { startYear: "desc" } }),
      prisma.fixedEvidence.count(),
    ])
    const bmAssessors = Array.from(
      new Map(bmAssessorRows.filter(r => r.assessor?.id).map(r => [r.assessor!.id, r.assessor!.name || "غير محدد"]))
    ).map(([id, name]) => ({ id, name }))

    return (
      <div className="space-y-6">
        <PageHeader
          title={`تقارير فرع ${branch.name}`}
          description="نتائج تقييم الجودة لفرعك مع دعم متعدد المقيّمين."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        />

        <StageFilterBar current={stageFilter} />

        {/* (§3) شريط فلاتر السجل — مدير الفرع: مقيّم + عام + فترة + حالة (والمرحلة من شريطها القائم) */}
        <ReportFiltersBar
          assessors={bmAssessors}
          years={bmYears.map(y => ({ id: y.id, label: y.label }))}
          stageParam={stageParam}
          current={{
            assessorId: filters.assessorId,
            yearParam: filterParams.year,
            from: filterParams.from,
            to: filterParams.to,
            status: filters.status,
          }}
        />
        {/* (جديد) بطاقة الأداء العام المرجحة للفرع + لوحات المراحل — إضافة فوق المحتوى القائم دون أي تغيير عليه */}
        <WeightedEvaluationSection
          scope={{ branchId: branch.id }}
          stageFilter={stageFilter}
          printHref={`/reports/print?scope=single&schoolId=${branch.school.id}&branchId=${branch.id}${filtersQsSuffix}`}
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

        {/* Multi-Evaluator Breakdown - Desktop */}
        {perf.evaluators.length > 0 && (
          <Card className="hidden md:block">
            <CardContent className="p-6">
              <h3 className="font-bold mb-4">تقرير المشرفين الفردي</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right min-w-[600px]">
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
                          <Link href={`/reports/print?scope=evaluator&branchId=${branch.id}&evaluatorId=${ev.id}${stageParam ? `&stage=${stageParam}` : ""}`}>
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

        {/* Multi-Evaluator Breakdown - Mobile */}
        {perf.evaluators.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:hidden min-w-0">
            {perf.evaluators.map((ev: any) => (
              <Card key={ev.id} className="p-4 min-w-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-foreground-strong">{ev.name}</span>
                  <Badge variant={ev.averageScore >= 90 ? "success" : ev.averageScore >= 75 ? "info" : ev.averageScore >= 50 ? "warning" : "danger"}>
                    {getPerformanceBand(ev.averageScore)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{ev.role} • {ev.assessmentCount} تقييمات</p>
                <div className="flex items-center gap-2 mb-3">
                  <Progress value={ev.averageScore} size="sm" className="w-full" tone={ev.averageScore === 100 ? "success" : "default"} />
                  <span className="text-[12px] font-medium numeric">{ev.averageScore}%</span>
                </div>
                <Link href={`/reports/print?scope=evaluator&branchId=${branch.id}&evaluatorId=${ev.id}${stageParam ? `&stage=${stageParam}` : ""}`}>
                  <Button variant="outline" size="sm" className="w-full">تقرير فردي</Button>
                </Link>
              </Card>
            ))}
          </div>
        )}

        {/* Individual Assessment Scores — (§2+§3) كل تقييم مدخل منفصل مطابق للفلاتر */}
        {bmList.length > 0 && (
          <Card>
            <CardContent className="p-6 min-w-0">
              <h3 className="font-bold mb-4">تفاصيل التقييمات المطابقة للفلاتر</h3>
              <div className="divide-y divide-border">
                {bmList.map(a => {
                  const verified = countDistinctVerifiedEvidence(a.evidenceResponses)
                  const score = bmTotalEvidence > 0 ? Math.round((verified / bmTotalEvidence) * 100) : 0
                  return (
                    <div key={a.id} className="py-3 flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground-strong truncate">{a.assessor?.name ?? "غير محدد"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.assessor?.role ?? "غير محدد"} • {verified}/{bmTotalEvidence} شاهد متحقق • {a.academicYear?.label ?? "العام: غير محدد"} • {formatDate(a.startedAt.toISOString())}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={a.stage ? "info" : "neutral"}>{getStageLabel(a.stage)}</Badge>
                        <Badge variant={a.status === "COMPLETED" ? "success" : "warning"} dot>{a.status === "COMPLETED" ? "مكتمل" : "جاري"}</Badge>
                        <Badge variant={score >= 90 ? "success" : score >= 75 ? "info" : score >= 50 ? "warning" : "danger"}>
                          {score}%
                        </Badge>
                        <Link href={`/quality/assessments/${a.id}/results`}>
                          <Button variant="ghost" size="sm">عرض</Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
                {bmList.length === 0 && (
                  <p className="py-4 text-center text-muted-foreground">لا توجد تقييمات مطابقة للفلاتر المحددة.</p>
                )}
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
              {filterHiddenInputs}
              <Button type="submit">تقرير الفرع الشامل (PDF)</Button>
            </form>
            <form action="/reports/print" method="GET">
              <input type="hidden" name="scope" value="comprehensive" />
              <input type="hidden" name="branchId" value={branch.id} />
              {filterHiddenInputs}
              <Button type="submit" variant="outline">تقرير مقارنة المشرفين (PDF)</Button>
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
          where: { type: { not: "PRIVATE_REVIEW" }, status: "COMPLETED", ...(stageFilter !== undefined ? { stage: stageFilter } : {}) },
          include: { assessor: true, branch: true }
        }
      }
    })

    if (!school) return null

    const perf = await calculateSchoolPerformance(school.id, stageFilter)

    // (§3) فلاتر السجل + خياراتها من بيانات المدرسة الفعلية — الاستعلام مقيّد بمدرسة هذا الدور
    // الحالة: «حسب الافتراضي» (بلا معامل) = COMPLETED كما كان — و«الكل» الصريح يلغي قيد
    // الحالة نهائيًا (listStatus !== "ALL" أدناه) بدل دفنه في COMPLETED — نوع التصفية
    // AssessmentStatusFilter من وحدة الفلاتر نفسها حتى يقبل مقارنة "ALL" ترجمةً ودلالةً.
    const listStatus: AssessmentStatusFilter =
      filters.status === "IN_PROGRESS" || filters.status === "ALL" ? filters.status : "COMPLETED"
    const [smList, smYears, smTotalEvidence] = await Promise.all([
      prisma.assessment.findMany({
        where: {
          schoolId: school.id,
          type: { not: "PRIVATE_REVIEW" },
          ...buildReportFilterWhere(filters),
          ...(listStatus !== "ALL" ? { status: listStatus } : {}),
        },
        include: {
          assessor: { select: { id: true, name: true, role: true } },
          branch: { select: { id: true, name: true } },
          academicYear: { select: { id: true, label: true } },
          evidenceResponses: { where: { isVerified: true }, select: { evidenceId: true } },
        },
        orderBy: { startedAt: "desc" },
      }),
      prisma.academicYear.findMany({ where: { schoolId: school.id }, orderBy: { startYear: "desc" } }),
      prisma.fixedEvidence.count(),
    ])
    const smAssessors = Array.from(
      new Map(school.assessments.filter(a => a.assessor?.id).map(a => [a.assessor!.id, a.assessor!.name || "غير محدد"]))
    ).map(([id, name]) => ({ id, name }))

    return (
      <div className="space-y-6">
        <PageHeader
          title={`تقارير ${school.name}`}
          description="نتائج تقييم الجودة لمدرستك مع دعم متعدد المقيّمين."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        />

        <StageFilterBar current={stageFilter} />

        {/* (§3) شريط فلاتر السجل — مدير المدرسة: مقيّم + عام + فترة + حالة (والمرحلة من شريطها القائم) */}
        <ReportFiltersBar
          assessors={smAssessors}
          years={smYears.map(y => ({ id: y.id, label: y.label }))}
          stageParam={stageParam}
          current={{
            assessorId: filters.assessorId,
            yearParam: filterParams.year,
            from: filterParams.from,
            to: filterParams.to,
            status: filters.status,
          }}
        />

        {/* (جديد) بطاقة الأداء العام المرجحة + لوحات المراحل — إضافة فوق المحتوى القائم دون أي تغيير عليه
            الحراسة والنطاق مفروضان على الخادم داخل getWeightedCardData */}
        <WeightedEvaluationSection
          scope={{ schoolId: school.id }}
          stageFilter={stageFilter}
          printHref={`/reports/print?scope=single&schoolId=${school.id}${filtersQsSuffix}`}
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

        {/* Multi-Evaluator Breakdown - Desktop */}
        {perf.evaluators.length > 0 && (
          <Card className="hidden md:block">
            <CardContent className="p-6">
              <h3 className="font-bold mb-4">تقرير المشرفين</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right min-w-[500px]">
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

        {/* Multi-Evaluator Breakdown - Mobile */}
        {perf.evaluators.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:hidden min-w-0">
            {perf.evaluators.map((ev: any) => (
              <Card key={ev.id} className="p-4 min-w-0">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-foreground-strong">{ev.name}</span>
                  <Badge variant={ev.averageScore >= 90 ? "success" : ev.averageScore >= 75 ? "info" : ev.averageScore >= 50 ? "warning" : "danger"}>
                    {getPerformanceBand(ev.averageScore)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{ev.role} • {ev.assessmentCount} تقييمات</p>
                <div className="flex items-center gap-2">
                  <Progress value={ev.averageScore} size="sm" className="w-full" />
                  <span className="text-[12px] font-medium numeric">{ev.averageScore}%</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Individual Assessment List — (§2+§3) كل تقييم مدخل منفصل مطابق للفلاتر بنتيجته وتاريخه وفرعه ومقيّمه ومرحلته وعامه */}
        {smList.length > 0 && (
          <Card>
            <CardContent className="p-6 min-w-0">
              <h3 className="font-bold mb-4">سجل التقييمات المطابقة للفلاتر</h3>
              <div className="divide-y divide-border">
                {smList.map(a => {
                  const verified = countDistinctVerifiedEvidence(a.evidenceResponses)
                  const score = smTotalEvidence > 0 ? Math.round((verified / smTotalEvidence) * 100) : 0
                  return (
                    <div key={a.id} className="py-3 flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground-strong truncate">{a.assessor?.name ?? "غير محدد"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {a.assessor?.role ?? "غير محدد"} • {a.branch?.name || "كامل المدرسة"} • {verified}/{smTotalEvidence} شاهد • {a.academicYear?.label ?? "العام: غير محدد"} • {formatDate(a.startedAt.toISOString())}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={a.stage ? "info" : "neutral"}>{getStageLabel(a.stage)}</Badge>
                        <Badge variant={a.status === "COMPLETED" ? "success" : "warning"} dot>{a.status === "COMPLETED" ? "مكتمل" : "جاري"}</Badge>
                        <Badge variant={score >= 90 ? "success" : score >= 75 ? "info" : score >= 50 ? "warning" : "danger"}>{score}%</Badge>
                        <Link href={`/quality/assessments/${a.id}/results`}>
                          <Button variant="outline" size="sm">عرض</Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="p-6">
          <h3 className="font-bold mb-4">تصدير تقرير المدرسة</h3>
          <form action="/reports/print" method="GET">
            <input type="hidden" name="scope" value="single" />
            <input type="hidden" name="schoolId" value={school.id} />
            {filterHiddenInputs}
            <Button type="submit">تجهيز تقرير المدرسة (PDF)</Button>
          </form>
        </Card>
      </div>
    )
  }

  // === 4. Quality Assessor: Own assessments ===
  if (isQualityAssessor && user.schoolId) {
    // (§4) تقييماته هو فقط: assessorId ثابت من المستخدم الموثق — أي assessorId في
    // الرابط يُتجاهل حصرًا هنا، والفلاتر الأخرى تضيّق ولا توسع النطاق
    const qaStatus = filters.status && filters.status !== "ALL" ? { status: filters.status } : {}
    const assessments = await prisma.assessment.findMany({
      where: { 
        assessorId: user.id, 
        type: { not: "PRIVATE_REVIEW" },
        // (§6) فلتر المرحلة/العام/الفترة — تقييمات المقيّم تُعرض حسب مرحلتها
        ...buildReportFilterWhere({ ...filters, assessorId: undefined, schoolId: undefined }),
        ...qaStatus,
      },
      include: { school: true, branch: true, academicYear: { select: { id: true, label: true } } }
    })
    const qaYears = await prisma.academicYear.findMany({ where: { schoolId: user.schoolId }, orderBy: { startYear: "desc" } })

    const completedAssessments = assessments.filter(a => a.status === "COMPLETED")
    const totalEvidence = await prisma.fixedEvidence.count()
    
    const assessmentScores = await Promise.all(
      completedAssessments.map(async (a) => {
        // (إصلاح التضخم) شواهد مميزة متحققة — صف زيارة إضافي لنفس الشاهد لا يضاعفه
        const verifiedRows = await prisma.evidenceResponse.findMany({
          where: { assessmentId: a.id, isVerified: true },
          select: { evidenceId: true },
          distinct: ["evidenceId"],
        })
        return {
          ...a,
          score: totalEvidence > 0 ? Math.round((verifiedRows.length / totalEvidence) * 100) : 0,
          verifiedCount: verifiedRows.length
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

        <StageFilterBar current={stageFilter} />

        {/* (§3) شريط فلاتر السجل للمقيّم — بلا حقل المقيّم (تقييماته هو فقط) */}
        <ReportFiltersBar
          assessors={[]}
          hideAssessor
          years={qaYears.map(y => ({ id: y.id, label: y.label }))}
          stageParam={stageParam}
          current={{
            yearParam: filterParams.year,
            from: filterParams.from,
            to: filterParams.to,
            status: filters.status,
          }}
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
          <CardContent className="p-6 min-w-0">
            <h3 className="font-bold mb-4">سجل تقييماتي</h3>
            <div className="divide-y divide-border">
              {assessmentScores.map(a => (
                <div key={a.id} className="py-3 flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground-strong truncate">{a.school.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {a.branch?.name || "كامل المدرسة"} • {a.verifiedCount}/{totalEvidence} شاهد • {a.academicYear?.label ?? "العام: غير محدد"} • {a.status === "COMPLETED" ? "مكتمل" : "جاري"} • {formatDate(a.startedAt.toISOString())}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={a.stage ? "info" : "neutral"}>{getStageLabel(a.stage)}</Badge>
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