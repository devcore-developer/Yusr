// ===== FILE: src/app/(dashboard)/reports/print/page.tsx =====
import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PrintButton } from "@/components/reports/PrintButton"
import { SemiCircleGauge, VerticalBarChart, DonutChart, PerformanceLegend } from "@/components/charts/AnalyticsCharts"
import { getPerformanceLevel } from "@/lib/performance"
import { getSchoolSurveyLinks } from "@/features/quality-assessment/services/survey-link"
import { formatDate } from "@/lib/utils"
import { getStageLabel, stageFilterToParam } from "@/lib/stages"
import { resolveReportFilters } from "@/features/quality-reports/services/report-filters"
import { EvaluationCard } from "@/components/reports/EvaluationCard"
import { ReportDetailsToggle } from "@/components/reports/ReportDetailsToggle"
import { SurveyComparisonTable } from "@/components/reports/SurveyComparisonTable"
import { buildItemComparison } from "@/features/quality-reports/services/survey-integration"
import { getSurveyIntegrationConfig, getSchoolLinkedSurveysByIndicator } from "@/features/quality-reports/services/survey-integration.server"
import {
  computeAssessmentWeightedResult,
  averageWeightedOveralls,
  classifyPerformance,
  countDistinctVerifiedEvidence,
  distinctVerifiedEvidenceRows,
  type WeightedAssessmentResult,
} from "@/features/quality-reports/services/weighted-score"

// ============================================================
// تقرير الطباعة — إعادة بناء على مبدأ «تقييم واحد = تقرير واحد»:
// 1) كل كتلة في التقرير تمثل تقييمًا واحدًا محددًا وتُحسب من استجاباته هو فقط
//    (لا دمج لاستجابات تقييمات متعددة — ولا يمكن أن تتخطى نسبة التقييم 100%)
// 2) نطاق الدور يُفرض على الخادم: مقيّم الجودة تقييماته فقط، مدير القسم فروعه
//    المصرح بها + تقييماته، مدير المدرسة مدرسته، مدير النظام الجميع.
//    معاملات الرابط (schoolId/branchId/evaluatorId) تُدمج AND مع نطاق الدور
//    فلا يمكنها توسيعه إطلاقًا — وتغيير الرابط لا يكشف أي بيانات.
// 3) متوسط المدرسة المعروض = متوسط نسب التقييمات المستقلة (وليس جمع استجاباتها).
// 4) نتائج الاستبانات تُعرض على مستوى المدرسة كما خُزنت (ولا تدخل في أي حساب).
// ============================================================

export default async function PrintReportPage({ searchParams }: { searchParams: { scope: string, schoolId?: string, branchId?: string, evaluatorId?: string, assessorId?: string, stage?: string, year?: string, from?: string, to?: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const isSuperAdmin = user.role === "SUPER_ADMIN"
  const isSchoolManager = user.role === "SCHOOL_MANAGER"
  const isBranchManager = user.role === "BRANCH_MANAGER"
  const isQualityAssessor = user.role === "QUALITY_ASSESSOR"

  // أي دور آخر لا تقارير له — توجيه بدل أي تسريب
  if (!isSuperAdmin && !isSchoolManager && !isBranchManager && !isQualityAssessor) {
    redirect("/reports")
  }
  if (isSchoolManager && !user.schoolId) redirect("/reports")

  const authorizedBranchIds = isBranchManager ? await getAuthorizedBranchIds(user) : []

  // نطاق الدور على مستوى التقييم — إلزامي مهما كانت معاملات الرابط
  const roleScope: any =
    isSuperAdmin
      ? {}
      : isSchoolManager
        ? { schoolId: user.schoolId }
        : isBranchManager
          ? { OR: [{ branchId: { in: authorizedBranchIds } }, { assessorId: user.id }] }
          : { assessorId: user.id } // QUALITY_ASSESSOR: تقييماته هو فقط

  const paramSchoolId = searchParams.schoolId || null
  const paramBranchId = searchParams.branchId || null
  // معرّف المقيّم: evaluatorId (المعرف القديم) أو assessorId (معامل الفلاتر الموحد)
  const paramEvaluatorId = searchParams.evaluatorId || searchParams.assessorId || null

  // (§6) فلتر المرحلة + (§3) باقي فلاتر السجل (العام/الفترة) — undefined = بلا فلتر،
  // null = السجلات التاريخية غير المحددة، قيمة = محددة. تُدمج AND مع نطاق الدور ولا يوسعه.
  const filters = resolveReportFilters(searchParams)
  const stageFilter = filters.stage
  const stageParam = stageFilterToParam(stageFilter)
  const yearFilter = filters.academicYearId
  const dateFrom = filters.from
  const dateTo = filters.to

  const assessments = await prisma.assessment.findMany({
    where: {
      type: { not: "PRIVATE_REVIEW" },
      status: "COMPLETED",
      AND: [
        roleScope,
        ...(paramSchoolId ? [{ schoolId: paramSchoolId }] : []),
        ...(paramBranchId ? [{ branchId: paramBranchId }] : []),
        ...(paramEvaluatorId ? [{ assessorId: paramEvaluatorId }] : []),
        ...(stageFilter !== undefined ? [{ stage: stageFilter }] : []),
        // (§3) فلتر العام الدراسي (العلاقة المخزنة) — السجلات بلا عام تُطابق بفلتر «غير محدد» فقط
        ...(yearFilter !== undefined ? [{ academicYearId: yearFilter }] : []),
        // (§3) فلتر فترة البدء — حدود يوم شاملة بتوقيت UTC (من resolveReportFilters)
        ...(dateFrom || dateTo
          ? [{ startedAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lt: dateTo } : {}) } }]
          : []),
      ]
    },
    include: {
      school: true,
      branch: true,
      // (جديد) العام الدراسي المخزّن لهذا التقييم (ميزة الأعوام) — عرض فقط،
      // والسجلات التاريخية بلا عام تُعرض «غير محدد» بلا أي اختراع
      academicYear: true,
      assessor: { select: { id: true, name: true, role: true } },
      evidenceResponses: {
        where: { isVerified: true },
        include: { evidence: { include: { indicator: { include: { domain: true, axis: true } } } } }
      }
    },
    orderBy: { startedAt: "asc" }
  })

  const officialDomains = await prisma.domain.findMany({
    // (جديد) axis: true — أسماء المعايير (المحاور) لقسم «أداء المدرسة وفق المعايير»
    include: { indicators: { include: { fixedEvidence: true, axis: true } } }
  })
  const totalRequired = officialDomains.reduce(
    (acc: number, d: any) => acc + d.indicators.reduce((a: number, i: any) => a + i.fixedEvidence.length, 0),
    0
  )

  const branchContext = paramBranchId
    ? await prisma.branch.findUnique({ where: { id: paramBranchId } })
    : null

  // (§5) سياق الفلاتر في ترويسة التقرير — تسمية حقيقية من قاعدة البيانات، لا اختراع
  const filterYearContext = yearFilter !== undefined && yearFilter !== null
    ? await prisma.academicYear.findUnique({ where: { id: yearFilter }, select: { label: true } })
    : null
  const filterAssessorContext = paramEvaluatorId
    ? await prisma.user.findUnique({ where: { id: paramEvaluatorId }, select: { name: true } })
    : null

  // تجميع حسب المدرسة — مع ضمان ظهور المدرسة المطلوبة (scope=single) حتى بلا تقييمات مكتملة
  const schoolIds = Array.from(new Set(assessments.map(a => a.schoolId)))
  if (paramSchoolId && !schoolIds.includes(paramSchoolId)) {
    const withinRole = isSuperAdmin || (isSchoolManager && paramSchoolId === user.schoolId)
    if (withinRole) schoolIds.unshift(paramSchoolId)
  }
  const schools = schoolIds.length > 0
    ? await prisma.school.findMany({ where: { id: { in: schoolIds } } })
    : []

  // استبانات كل مدرسة تُحمّل مرة واحدة وتُعرض كما هي (عرض فقط — بلا أي حساب)
  const surveyBySchool = new Map<string, Awaited<ReturnType<typeof getSchoolSurveyLinks>>>()
  for (const sid of schoolIds) {
    surveyBySchool.set(sid, await getSchoolSurveyLinks(sid))
  }

  // (جديد) بيانات مقارنة البنود المرتبطة باستبانات — لكل مدرسة مرة واحدة:
  // الربط الصريح بالمعرّفات فقط (عزل مدرسة مضمون في الخدمة) + لقطة إعداد الدمج إن وُجد
  const linkedSurveysBySchool = new Map<string, Awaited<ReturnType<typeof getSchoolLinkedSurveysByIndicator>>>()
  const surveyConfigBySchool = new Map<string, Awaited<ReturnType<typeof getSurveyIntegrationConfig>>>()
  for (const sid of schoolIds) {
    linkedSurveysBySchool.set(sid, await getSchoolLinkedSurveysByIndicator(sid))
    surveyConfigBySchool.set(sid, await getSurveyIntegrationConfig(sid))
  }

  return (
    <div className="bg-white text-black p-4 md:p-8 lg:p-12 min-w-0" dir="rtl">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          @page { size: A4; margin: 10mm; }
        }

        .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #073B43; padding-bottom: 20px; gap: 15px; }
        .section-title { font-size: 18px; font-weight: 700; color: #073B43; margin-top: 32px; margin-bottom: 16px; border-right: 4px solid #2878B8; padding-right: 12px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; table-layout: fixed; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; }
        th { background-color: #f4f6fb; color: #172B36; }
      `}</style>

      <div className="no-print mb-8"><PrintButton /></div>

      {schools.length === 0 && (
        <p style={{ textAlign: "center", color: "#64748B", padding: "40px 0" }}>
          لا توجد تقييمات مكتملة ضمن نطاقك لهذا التقرير.
        </p>
      )}

      {schools.map((school: any, index: number) => {
        const schoolAssessments = assessments.filter(a => a.schoolId === school.id)
        // (إصلاح التضخم) المتحقق = شواهد مميزة لا صفوف استجابات — زيارات الملاحظة الصفية
        // لنفس الشاهد لا تُعدّ أكثر من مرة، فلا تتخطى نسبة أي تقييم 100% أصلًا
        const schoolPcts = schoolAssessments.map((a: any) =>
          totalRequired > 0 ? Math.round((countDistinctVerifiedEvidence(a.evidenceResponses) / totalRequired) * 100) : 0
        )
        const schoolAvg = schoolPcts.length > 0
          ? Math.round(schoolPcts.reduce((s: number, p: number) => s + p, 0) / schoolPcts.length)
          : null
        const surveyLinks = surveyBySchool.get(school.id)

        return (
          <div key={school.id} className={index > 0 ? "page-break" : ""}>

            {/* ترويسة المدرسة — المتوسط = متوسط النسب المستقلة للتقييمات (وليس جمع استجاباتها) */}
            <div className="report-header">
              <div className="flex-1 min-w-0 flex items-center gap-3">
                {school.logoUrl ? (
                  <img src={school.logoUrl} alt={`${school.name} logo`} style={{ width: "50px", height: "50px", objectFit: "contain", borderRadius: "8px" }} />
                ) : (
                  <div style={{ width: "50px", height: "50px", borderRadius: "8px", backgroundColor: "#f4f6fb", display: "flex", alignItems: "center", justifyContent: "center", color: "#073B43", fontWeight: "bold", fontSize: "20px", flexShrink: 0 }}>
                    {school.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "#073B43", marginBottom: "4px", wordWrap: "break-word" }}>{school.name}</h1>
                  {/* (جديد) عنوان البطاقة الرسمي — بلا أي بيانات مصنعة */}
                  <p style={{ fontSize: "13px", color: "#2878B8", marginBottom: "4px", fontWeight: 600 }}>بطاقة التقويم المدرسي</p>
                  {(school.governorate || school.city) && (
                    <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>
                      المحافظة/المدينة: {[school.governorate, school.city].filter(Boolean).join(" — ")}
                    </p>
                  )}
                  {branchContext && schoolAssessments.length > 0 && (
                    <p style={{ fontSize: "14px", color: "#2878B8", marginBottom: "4px" }}>الفرع: {branchContext.name}</p>
                  )}
                  {stageFilter !== undefined && (
                    <p style={{ fontSize: "14px", color: "#2878B8", marginBottom: "4px" }}>
                      المرحلة التعليمية: {getStageLabel(stageFilter)}
                    </p>
                  )}
                  {/* (§5) نطاق الفلاتر مطبوع بوضوح كي يطابق التقرير القائمة المفلترة */}
                  {filterYearContext && (
                    <p style={{ fontSize: "14px", color: "#2878B8", marginBottom: "4px" }}>العام الدراسي: {filterYearContext.label}</p>
                  )}
                  {yearFilter === null && (
                    <p style={{ fontSize: "14px", color: "#2878B8", marginBottom: "4px" }}>العام الدراسي: غير محدد (سجلات قديمة)</p>
                  )}
                  {filterAssessorContext && (
                    <p style={{ fontSize: "14px", color: "#2878B8", marginBottom: "4px" }}>المقيّم: {filterAssessorContext.name ?? "غير محدد"}</p>
                  )}
                  <p style={{ fontSize: "12px", color: "#64748B" }}>تاريخ التقرير: {new Date().toLocaleDateString("ar-SA")}</p>
                </div>
              </div>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <SemiCircleGauge percentage={schoolAvg ?? 0} size={120} />
                <p style={{ fontSize: "11px", color: "#64748B", marginTop: "4px" }}>
                  متوسط نسب التقييمات المكتملة{schoolAvg !== null ? ` (${schoolAvg}%)` : ""}
                </p>
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "#172B36", marginBottom: "8px", fontWeight: 600 }}>
              عدد التقييمات المكتملة: {schoolAssessments.length} — كل تقييم محسوب مستقلًا من بياناته هو فقط.
            </p>

            {/* (جديد) لوحات الأداء حسب المرحلة — تظهر فقط للمراحل الموجودة فعلًا في النطاق */}
            {schoolAssessments.length > 0 && (
              <StagePanelsSection assessments={schoolAssessments} officialDomains={officialDomains} />
            )}

            {schoolAssessments.length === 0 ? (
              <p style={{ color: "#64748B", padding: "16px 0" }}>لا توجد تقييمات مكتملة لهذه المدرسة ضمن نطاق التقرير.</p>
            ) : (
              schoolAssessments.map((a: any, i: number) => (
                <AssessmentBlock
                  key={a.id}
                  assessment={a}
                  order={i + 1}
                  officialDomains={officialDomains}
                  totalRequired={totalRequired}
                  linkedSurveysByIndicator={linkedSurveysBySchool.get(school.id) ?? new Map()}
                  surveyConfig={surveyConfigBySchool.get(school.id) ?? null}
                />
              ))
            )}

            {surveyLinks && <SurveysSection links={surveyLinks} />}

          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// كتلة تقييم واحد — كل الأرقام من evidenceResponses الخاصة بهذا التقييم فقط
// ============================================================
function AssessmentBlock({ assessment, order, officialDomains, totalRequired, linkedSurveysByIndicator, surveyConfig }: {
  assessment: any
  order: number
  officialDomains: any[]
  totalRequired: number
  // (جديد) استبانات المدرسة المرتبطة صراحةً بالبنود + لقطة إعداد الدمج إن وُجد
  linkedSurveysByIndicator: Map<string, any[]>
  surveyConfig: any
}) {
  // (إصلاح التضخم) تفريد الشواهد المتحققة مرة واحدة — كل أرقام هذه الكتلة
  // (النسبة، رسوم المجالات، توزيع المستويات، الجداول التفصيلية) من الصفوف المفردة
  // للشواهد فقط: صف زيارة إضافي لنفس الشاهد لا يزيد أي عدّاد
  const verifiedRows = distinctVerifiedEvidenceRows(assessment.evidenceResponses)
  const verified = verifiedRows.length
  const pct = totalRequired > 0 ? Math.round((verified / totalRequired) * 100) : 0

  // (جديد) النتيجة المرجحة الرسمية (20% / 30% / 40% / 10%) — من خدمة الدرجات الموحدة
  // weighted-score.ts نفسها المستخدمة في البطاقة واللوحات والمقارنات — مصدر واحد للحقيقة
  const weighted = computeAssessmentWeightedResult(officialDomains, assessment.evidenceResponses)

  const domainChartData = officialDomains.map((d: any) => {
    const dv = verifiedRows.filter((r: any) => r.evidence.indicator.domainId === d.id).length
    const dr = d.indicators.reduce((acc: number, i: any) => acc + i.fixedEvidence.length, 0)
    return { name: d.name, percentage: dr > 0 ? Math.round((dv / dr) * 100) : null }
  })

  const distributionData = [
    { label: "التميز", value: 0, color: "#16A34A" }, { label: "التقدم", value: 0, color: "#2878B8" },
    { label: "الانطلاق", value: 0, color: "#E9A34A" }, { label: "التهيئة", value: 0, color: "#C62828" },
    { label: "غير مقيم", value: 0, color: "#858B95" }
  ]
  officialDomains.forEach((d: any) => d.indicators.forEach((ind: any) => {
    const req = ind.fixedEvidence.length
    const ver = verifiedRows.filter((r: any) => r.evidence.indicatorId === ind.id).length
    const p = req > 0 ? Math.round((ver / req) * 100) : null
    const level = getPerformanceLevel(p)
    const distItem = distributionData.find(item => item.label === level.label)
    if (distItem) distItem.value++
  }))

  return (
    <div style={{ marginBottom: "40px", borderTop: "2px solid #e5e7eb", paddingTop: "20px" }}>
      {/* ترويسة التقييم الفردي */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "16px" }}>
        <div className="min-w-0">
          <h3 style={{ fontSize: "16px", fontWeight: "bold", color: "#073B43", marginBottom: "4px" }}>
            التقييم #{order} — المُقيّم: {assessment.assessor?.name ?? "غير محدد"}
          </h3>
          <p style={{ fontSize: "12px", color: "#64748B" }}>
            {assessment.assessor?.role ?? "غير محدد"}
            {" • "}الفرع: {assessment.branch?.name || "كامل المدرسة"}
            {" • "}المرحلة: {getStageLabel(assessment.stage)}
            {" • "}العام الدراسي: {assessment.academicYear?.label ?? "غير محدد"}
            {" • "}تاريخ البدء: {formatDate(assessment.startedAt.toISOString())}
            {" • "}الحالة: مكتمل
          </p>
        </div>
        <div style={{ flexShrink: 0 }}>
          <SemiCircleGauge percentage={pct} size={100} />
          <p style={{ fontSize: "11px", color: "#64748B", textAlign: "center", marginTop: "2px" }}>نتيجة هذا التقييم (نسبة تحقق الشواهد)</p>
        </div>
      </div>

      {/* (جديد) بطاقة الأداء العام للمدرسة — النتيجة المرجحة الرسمية مع المقارنة والمستويات
          كل الأرقام من weighted-score.ts (مصدر واحد) — الرسوم القائمة أدناه كما هي دون مساس */}
      <EvaluationCard
        overall={weighted.overall}
        classification={weighted.classification}
        domainResults={weighted.domains.map(d => ({ name: d.name, weight: d.weight, score: d.score }))}
        notRatedReason={buildNotRatedReason(weighted.diagnostics)}
      />
      <div style={{ height: "24px" }} />

      {/* الرسوم البيانية لهذا التقييم */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "24px" }}>
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <h4 style={{ fontSize: "14px", fontWeight: "bold", color: "#073B43", marginBottom: "12px", borderRight: "3px solid #2878B8", paddingRight: "8px" }}>أداء المجالات</h4>
          <div style={{ height: "200px", width: "100%" }}><VerticalBarChart data={domainChartData} /></div>
        </div>
        <div style={{ flex: "0 0 220px", maxWidth: "100%" }}>
          <h4 style={{ fontSize: "14px", fontWeight: "bold", color: "#073B43", marginBottom: "12px", borderRight: "3px solid #2878B8", paddingRight: "8px" }}>توزيع الأداء</h4>
          <div style={{ height: "200px", width: "100%" }}><DonutChart data={distributionData} /></div>
        </div>
      </div>

      <div style={{ marginBottom: "24px" }}><PerformanceLegend /></div>

      {/* (جديد) أداء المدرسة وفق المعايير — نتائج المحاور الفعلية لكل مجال */}
      <CriteriaSection criteriaGroups={weighted.criteriaGroups} />

      {/* (جديد) مقارنة نتائج البنود المرتبطة باستبانات — قسم مكمّل للعرض والمقارنة فقط:
          درجة الأدوات بنفس معادلة جداول المجالات أدناه، نتيجة الاستبانة من الربط الصريح
          بالمعرّفات، والمدمجة غير رسمية ولا تُحسب إلا بإعداد معتمد. لا تدخل في أوزان
          المجالات ولا في الدرجة النهائية — والجداول القائمة أدناه كما هي دون مساس. */}
      {(() => {
        const comparison = buildItemComparison({
          officialDomains,
          verifiedResponses: assessment.evidenceResponses,
          linkedSurveysByIndicator,
          config: surveyConfig,
        })
        if (comparison.rows.length === 0) return null
        return <SurveyComparisonTable rows={comparison.rows} diagnostics={comparison.diagnostics} variant="print" />
      })()}

      {/* الجداول التفصيلية القائمة — نفس البيانات والأعمدة والوظائف حرفيًا،
          خلف زر «عرض التفاصيل» (قابلة للطي على الشاشة، وتُطبع دائمًا حتى مطوية) */}
      <ReportDetailsToggle description="الجداول التفصيلية للمؤشرات والشواهد كما هي — تُدرج في الطباعة دائمًا حتى وهي مطوية.">
        <DomainTables domains={officialDomains} responses={verifiedRows} />
      </ReportDetailsToggle>
    </div>
  )
}

// ============================================================
// (جديد) سبب عدم التقدير — شفافية كاملة بلا أي تخمين أو أرقام مصنعة
// ============================================================
function buildNotRatedReason(diagnostics: WeightedAssessmentResult["diagnostics"]): string | null {
  if (diagnostics.unmatchedConfigs.length > 0) {
    return "تعذّرت مطابقة أسماء بعض المجالات المخزّنة مع المجالات الرسمية للأوزان (الإدارة 20%، التعليم والتعلم 30%، نواتج التعلم 40%، البيئة المدرسية 10%) — لم تُحتسب نتيجة مرجحة بدل عرض رقم مضلل."
  }
  if (diagnostics.missingDataDomains.length > 0) {
    return "لا توجد شواهد معرّفة لبعض المجالات في إطار التقويم الرسمي — لم تُحتسب نتيجة مرجحة."
  }
  return null
}

// ============================================================
// (جديد) أداء المدرسة وفق المعايير — مجموعة لكل مجال برسم محاوره (معاييره) الفعلية
// البيانات من استجابات التقييم نفسه فقط — لا نسب ثابتة ولا مصنعة،
// والرسوم تُصيَّر ديناميكيًا لأي معايير موجودة في التقييم المحدد
// ============================================================
function CriteriaSection({ criteriaGroups }: { criteriaGroups: WeightedAssessmentResult["criteriaGroups"] }) {
  if (criteriaGroups.length === 0) return null
  return (
    <div style={{ marginBottom: "28px" }}>
      <h4 style={{ fontSize: "15px", fontWeight: "bold", color: "#073B43", marginBottom: "14px", borderRight: "3px solid #2878B8", paddingRight: "8px" }}>
        أداء المدرسة وفق المعايير
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "16px" }}>
        {criteriaGroups.map(group => (
          <div key={group.domainId} className="min-w-0" style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", breakInside: "avoid" }}>
            <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: "8px" }}>
              <h5 style={{ fontSize: "13px", fontWeight: "bold", color: "#172B36", margin: 0 }}>{group.domainName}</h5>
              <span className="flex items-center" style={{ gap: "6px" }}>
                {/* تمييز الوزن الرسمي عن النتيجة المتحققة — رقمان مختلفان لا يُخلط بينهما */}
                {group.weight !== null && (
                  <span style={{ fontSize: "10px", fontWeight: 600, backgroundColor: "#2878B81A", color: "#2878B8", borderRadius: "999px", padding: "2px 8px" }}>
                    الوزن: {Math.round(group.weight * 100)}%
                  </span>
                )}
                <span style={{ fontSize: "12px", fontWeight: "bold", color: "#073B43" }}>
                  النتيجة: {group.score !== null ? `${group.score}%` : "—"}
                </span>
              </span>
            </div>
            {group.criteria.length > 0 ? (
              <div style={{ height: "160px", width: "100%" }}>
                <VerticalBarChart data={group.criteria.map(c => ({ name: c.axisName || "محور", percentage: c.score }))} />
              </div>
            ) : (
              <p style={{ fontSize: "12px", color: "#64748B" }}>لا توجد معايير معرّفة لهذا المجال.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// (جديد) لوحات الأداء حسب المرحلة التعليمية — لكل مرحلة موجودة فعلًا لوحة
// النتيجة = متوسط النتائج المرجحة المستقلة لتقييمات تلك المرحلة (لا دمج بين المراحل
// ولا تكرار لتقييم واحد على كل المراحل). السجلات التاريخية بلا مرحلة تظهر لوحة
// «غير محددة» بشفافية — بلا إسناد مرحلة ولا اختراع بيانات.
// ============================================================
function StagePanelsSection({ assessments, officialDomains }: { assessments: any[]; officialDomains: any[] }) {
  const groups = new Map<string, { stage: any; results: WeightedAssessmentResult[] }>()
  for (const a of assessments) {
    const key = a.stage ?? "__UNSPECIFIED__"
    if (!groups.has(key)) groups.set(key, { stage: a.stage, results: [] })
    groups.get(key)!.results.push(computeAssessmentWeightedResult(officialDomains, a.evidenceResponses))
  }
  const panels = Array.from(groups.values()).map(g => {
    const agg = averageWeightedOveralls(g.results)
    return {
      key: g.stage ?? "__UNSPECIFIED__",
      stageLabel: getStageLabel(g.stage),
      overall: agg.average,
      classification: classifyPerformance(agg.average),
      assessments: g.results.length,
      skipped: agg.skipped,
    }
  })
  if (panels.length === 0) return null
  return (
    <div style={{ marginBottom: "28px" }}>
      <h4 style={{ fontSize: "15px", fontWeight: "bold", color: "#073B43", marginBottom: "14px", borderRight: "3px solid #2878B8", paddingRight: "8px" }}>
        الأداء العام حسب المرحلة التعليمية
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ gap: "14px" }}>
        {panels.map(p => (
          <div key={p.key} style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", breakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
              <div>
                <p style={{ fontSize: "13px", fontWeight: "bold", color: "#172B36", margin: 0 }}>{p.stageLabel}</p>
                <p style={{ fontSize: "11px", color: "#64748B", margin: 0 }}>
                  بناءً على {p.assessments} تقييم مكتمل{p.skipped > 0 ? ` • ${p.skipped} بلا نتيجة مرجحة` : ""}
                </p>
              </div>
              {p.overall !== null ? (
                <SemiCircleGauge percentage={p.overall} size={80} />
              ) : (
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "#94a3b8" }}>—</div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginTop: "10px" }}>
              <span style={{ fontSize: "20px", fontWeight: "bold", color: "#073B43" }}>{p.overall !== null ? `${p.overall}%` : "غير مقيم"}</span>
              {p.classification && (
                <span style={{ fontSize: "11px", fontWeight: 600, backgroundColor: `${p.classification.color}1A`, color: p.classification.color, borderRadius: "999px", padding: "3px 10px" }}>
                  {p.classification.label}
                </span>
              )}
            </div>
            {p.classification && (
              <p style={{ fontSize: "11px", color: "#64748B", marginTop: "8px", lineHeight: 1.6 }}>{p.classification.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// جداول المجالات والمؤشرات — من استجابات تقييم واحد فقط
// ============================================================
function DomainTables({ domains, responses }: { domains: any[], responses: any[] }) {
  return (
    <>
      {/* تخطيط سطح المكتب / الطباعة */}
      <div className="hidden md:block">
        {domains.map((domain: any) => {
          const domainVerified = responses.filter((r: any) => r.evidence.indicator.domainId === domain.id).length
          const domainRequired = domain.indicators.reduce((acc: number, i: any) => acc + i.fixedEvidence.length, 0)
          const domainPct = domainRequired > 0 ? Math.round((domainVerified / domainRequired) * 100) : 0

          return (
            <div key={domain.id} className="mb-6">
              <h4 style={{ fontSize: "16px", fontWeight: "bold", color: "#172B36", marginBottom: "8px", background: "#f4f6fb", padding: "8px" }}>
                {domain.name} <span style={{ fontSize: "14px", fontWeight: "normal", color: "gray" }}>(النسبة: {domainPct}%)</span>
              </h4>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "10%" }}>الكود</th>
                    <th style={{ width: "40%" }}>المؤشر</th>
                    <th style={{ width: "10%" }}>المطلوب</th>
                    <th style={{ width: "10%" }}>المتحقق</th>
                    <th style={{ width: "10%" }}>النسبة</th>
                    <th style={{ width: "20%" }}>المستوى</th>
                  </tr>
                </thead>
                <tbody>
                  {domain.indicators.map((ind: any) => {
                    const reqEv = ind.fixedEvidence.length
                    const verEv = responses.filter((r: any) => r.evidence.indicatorId === ind.id).length
                    const p = reqEv > 0 ? Math.round((verEv / reqEv) * 100) : 0
                    const level = getPerformanceLevel(p)
                    return (
                      <tr key={ind.id}>
                        <td style={{ fontFamily: "monospace", color: "#079FDF" }}>{ind.code}</td>
                        <td>{ind.description}</td>
                        <td style={{ textAlign: "center" }}>{reqEv}</td>
                        <td style={{ textAlign: "center", fontWeight: "bold", color: "#16A34A" }}>{verEv}</td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>{p}%</td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{ padding: "2px 6px", borderRadius: "10px", fontSize: "10px", fontWeight: "600", backgroundColor: `${level.color}20`, color: level.color }}>{level.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      {/* تخطيط الجوال (معاينة الشاشة) */}
      <div className="md:hidden">
        {domains.map((domain: any) => {
          const domainVerified = responses.filter((r: any) => r.evidence.indicator.domainId === domain.id).length
          const domainRequired = domain.indicators.reduce((acc: number, i: any) => acc + i.fixedEvidence.length, 0)
          const domainPct = domainRequired > 0 ? Math.round((domainVerified / domainRequired) * 100) : 0

          return (
            <div key={domain.id} className="mb-6 border border-gray-200 rounded-lg p-3">
              <h4 style={{ fontSize: "16px", fontWeight: "bold", color: "#172B36", marginBottom: "12px", background: "#f4f6fb", padding: "8px", borderRadius: "6px" }}>
                {domain.name} <span style={{ fontSize: "14px", fontWeight: "normal", color: "gray" }}>(النسبة: {domainPct}%)</span>
              </h4>
              <div className="space-y-3">
                {domain.indicators.map((ind: any) => {
                  const reqEv = ind.fixedEvidence.length
                  const verEv = responses.filter((r: any) => r.evidence.indicatorId === ind.id).length
                  const p = reqEv > 0 ? Math.round((verEv / reqEv) * 100) : 0
                  const level = getPerformanceLevel(p)
                  return (
                    <div key={ind.id} className="border-b pb-2">
                      <div className="flex justify-between items-start mb-1">
                        <span style={{ fontFamily: "monospace", color: "#079FDF", fontSize: "12px" }}>{ind.code}</span>
                        <span style={{ padding: "2px 6px", borderRadius: "10px", fontSize: "10px", fontWeight: "600", backgroundColor: `${level.color}20`, color: level.color }}>{level.label}</span>
                      </div>
                      <p style={{ fontSize: "14px", fontWeight: "bold", color: "#172B36", marginBottom: "4px" }}>{ind.description}</p>
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>المطلوب: {reqEv}</span>
                        <span>المتحقق: {verEv}</span>
                        <span style={{ fontWeight: "bold" }}>النسبة: {p}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ============================================================
// نتائج الاستبانات — عرض كما خُزنت، على مستوى المدرسة، بلا أي حساب
// ============================================================
const linkageLabels: Record<string, string> = {
  EXPLICIT: "مرتبطة صراحةً بمؤشرها",
  TEXT_MATCH: "مرتبطة بنص الشاهد",
  AMBIGUOUS: "غير محسومة (تطابق متعدد)",
  UNLINKED: "غير مرتبطة بمؤشر"
}

function SurveysSection({ links }: { links: Awaited<ReturnType<typeof getSchoolSurveyLinks>> }) {
  if (links.total === 0) return null

  const surveyRow = (s: any) => (
    <tr key={s.id}>
      <td>{s.type}</td>
      <td style={{ textAlign: "center", fontWeight: "bold" }}>{s.percentage}%</td>
      <td>{s.generalResult || "—"}</td>
      <td style={{ textAlign: "center" }}>{s.include ? "مفعّل" : "معطّل"}</td>
      <td>{linkageLabels[s.linkageStatus] ?? s.linkageStatus}</td>
    </tr>
  )

  const head = (
    <thead>
      <tr>
        <th style={{ width: "25%" }}>نوع الاستبانة</th>
        <th style={{ width: "12%" }}>النسبة</th>
        <th style={{ width: "25%" }}>النتيجة العامة</th>
        <th style={{ width: "13%" }}>الاحتساب</th>
        <th style={{ width: "25%" }}>حالة الربط بالمؤشر</th>
      </tr>
    </thead>
  )

  return (
    <div style={{ marginTop: "32px", pageBreakBefore: "always" }}>
      <h3 className="section-title">نتائج الاستبانات (على مستوى المدرسة — لا تدخل في حساب النسب)</h3>

      {links.byIndicator.map(group => (
        <div key={group.indicatorId} style={{ marginBottom: "16px" }}>
          <p style={{ fontWeight: 700, color: "#172B36", marginBottom: "6px" }}>
            {group.indicatorCode} — {group.indicatorDescription}
          </p>
          <table>
            {head}
            <tbody>{group.surveys.map(surveyRow)}</tbody>
          </table>
        </div>
      ))}

      {links.unlinked.length > 0 && (
        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontWeight: 700, color: "#172B36", marginBottom: "6px" }}>
            استبانات غير مرتبطة بمؤشر محدد (تُعرض بحالتها الصادقة — لا يُفترض لها رابط)
          </p>
          <table>
            {head}
            <tbody>{links.unlinked.map(surveyRow)}</tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: "11px", color: "#64748B", marginTop: "8px" }}>
        ملاحظة: نسب الاستبانات قيم مخزنة كما أُدخلت عند تعبئتها، وتُعرض هنا كدليل نوعي مساند — دون أي دمج أو جمع مع نتائج التقييم المباشر.
      </p>
    </div>
  )
}