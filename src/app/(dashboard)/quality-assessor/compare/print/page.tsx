import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { compareAssessments } from "@/features/quality-assessment/services/aggregation"
import { PrintButton } from "@/components/reports/PrintButton"

export default async function PrintComparisonPage({ searchParams }: { searchParams: { ids: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const assessmentIds = searchParams.ids.split(",").filter(Boolean)
  if (assessmentIds.length < 2) {
    redirect("/quality-assessor")
  }

  // Authorization check
  const assessments = await prisma.assessment.findMany({
    where: { id: { in: assessmentIds } },
    select: { schoolId: true, branchId: true }
  })

  if (user.role !== "SUPER_ADMIN") {
    const hasUnauthorized = assessments.some(a => {
      if (user.role === "SCHOOL_MANAGER") return a.schoolId !== user.schoolId
      if (user.role === "BRANCH_MANAGER") return a.branchId !== user.branchId
      return false
    })
    if (hasUnauthorized) redirect("/quality-assessor")
  }

  const result = await compareAssessments(assessmentIds)

  return (
    <div className="bg-white text-black p-8 md:p-12" dir="rtl">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
        @page { size: A4 landscape; margin: 10mm; }
        .report-header { border-bottom: 3px solid #0C3740; padding-bottom: 16px; margin-bottom: 24px; }
        .section-title { font-size: 16px; font-weight: 700; color: #0C3740; margin-top: 24px; margin-bottom: 12px; border-right: 4px solid #079FDF; padding-right: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; }
        th { background-color: #f4f6fb; color: #172B36; font-weight: 600; }
        .text-success { color: #087a4d; font-weight: 600; }
        .text-danger { color: #b42318; font-weight: 600; }
        .text-warning { color: #9a6700; font-weight: 600; }
        .text-muted { color: #667085; }
        .metric-box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: 700; margin: 4px 0; }
        .metric-label { font-size: 11px; color: #667085; }
      `}</style>

      <div className="no-print mb-8">
        <PrintButton />
      </div>

      {/* Report Header */}
      <div className="report-header">
        <h1 className="text-2xl font-bold text-[#0C3740]">تقرير مقارنة التقييمات</h1>
        <p className="text-sm text-gray-600 mt-1">
          تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')} | 
          عدد التقييمات: {result.assessments.length}
        </p>
      </div>

      {/* Evaluators Info */}
      <div className="section-title">المُقيّمون المشمولون</div>
      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>الدور</th>
            <th>المدرسة</th>
            <th>الفرع</th>
            <th>الحالة</th>
            <th>نسبة الإكمال</th>
          </tr>
        </thead>
        <tbody>
          {result.assessments.map(a => (
            <tr key={a.id}>
              <td>{a.assessorName}</td>
              <td>
                {a.assessorRole === "QUALITY_ASSESSOR" ? "مقيم جودة" : 
                 a.assessorRole === "SCHOOL_MANAGER" ? "مدير مدرسة" : 
                 a.assessorRole === "BRANCH_MANAGER" ? "مدير فرع" : a.assessorRole}
              </td>
              <td>{a.schoolName}</td>
              <td>{a.branchName || "كامل المدرسة"}</td>
              <td>{a.status === "COMPLETED" ? "مكتمل" : "جاري"}</td>
              <td>{a.progress}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Aggregated Metrics */}
      <div className="section-title">النتائج المُجمّعة</div>
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="metric-box">
          <div className="metric-label">متوسط الأداء</div>
          <div className="metric-value text-[#079FDF]">{result.aggregated.averageScore}%</div>
          <div className="text-xs text-gray-500">{result.aggregated.performanceBand}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">معدل الاتفاق</div>
          <div className="metric-value text-success">{result.aggregated.agreementRate}%</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">مؤشرات متفق عليها</div>
          <div className="metric-value text-success">{result.aggregated.agreedIndicators}</div>
        </div>
        <div className="metric-box">
          <div className="metric-label">مؤشرات مختلف عليها</div>
          <div className="metric-value text-danger">{result.aggregated.disagreedIndicators}</div>
        </div>
      </div>

      {/* Domain Averages */}
      <div className="section-title">متوسطات المجالات</div>
      <table>
        <thead>
          <tr>
            <th>المجال</th>
            <th>نسبة الاتفاق</th>
            <th>المستوى</th>
          </tr>
        </thead>
        <tbody>
          {result.aggregated.domainAverages.map(d => (
            <tr key={d.domain}>
              <td>{d.domain}</td>
              <td>{d.average}%</td>
              <td>{d.band}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Detailed Comparison */}
      <div className="section-title">المقارنة التفصيلية حسب المؤشر</div>
      <table>
        <thead>
          <tr>
            <th style={{ width: '8%' }}>الكود</th>
            <th style={{ width: '30%' }}>المؤشر</th>
            {result.assessments.map(a => (
              <th key={a.id} style={{ width: `${60 / result.assessments.length}%` }}>
                {a.assessorName}
              </th>
            ))}
            <th style={{ width: '8%' }}>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {result.comparisons.map(c => (
            <tr key={c.indicatorCode}>
              <td className="font-mono text-[#079FDF]">{c.indicatorCode}</td>
              <td className="text-xs">{c.indicatorText}</td>
              {result.assessments.map(a => {
                const resp = c.responses[a.id]
                return (
                  <td key={a.id} className="text-xs">
                    {resp ? (
                      <span className={resp.value === "لم يُقيّم" ? "text-muted" : ""}>
                        {resp.value}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                )
              })}
              <td className="text-center">
                {!c.evaluatedByAll ? (
                  <span className="text-warning">⚠</span>
                ) : c.agreement ? (
                  <span className="text-success">✓</span>
                ) : (
                  <span className="text-danger">✗</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-6 text-xs text-gray-500">
        <p><span className="text-success">✓</span> متفق عليها &nbsp;|&nbsp; 
           <span className="text-danger">✗</span> مختلف عليها &nbsp;|&nbsp; 
           <span className="text-warning">⚠</span> لم يُقيّم من الجميع</p>
      </div>
    </div>
  )
}