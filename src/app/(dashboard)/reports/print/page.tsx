import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PrintButton } from "@/components/reports/PrintButton"
import { getPerformanceBand } from "@/features/quality-assessment/services/analysis"

export default async function PrintReportPage({ searchParams }: { searchParams: { scope: string, schoolId?: string, branchId?: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const isAllSchools = searchParams.scope === "all"
  const branchId = searchParams.branchId
  
  let branchContext: any = null
  if (branchId) {
    branchContext = await prisma.branch.findUnique({ where: { id: branchId } })
  }

  const schools = await prisma.school.findMany({
    where: isAllSchools ? {} : { id: searchParams.schoolId },
    include: {
      branches: true,
      assessments: {
        where: branchId ? { branchId } : undefined,
        include: {
          assessor: true,
          evidenceResponses: {
            where: { isVerified: true },
            include: { evidence: { include: { indicator: { include: { domain: true, axis: true } } } } }
          },
          gaps: { include: { indicator: { include: { domain: true } } } },
          plans: { include: { actions: true, followUps: true } }
        }
      },
      surveys: true
    }
  })

  const officialDomains = await prisma.domain.findMany({
    include: {
      indicators: {
        include: {
          fixedEvidence: true,
          axis: true
        }
      }
    }
  })

  return (
    <div className="bg-white text-black p-8 md:p-12" dir="rtl">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
        @page { size: A4; margin: 15mm; }
        .report-header { border-bottom: 3px solid #0C3740; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
        .section-title { font-size: 20px; font-weight: 700; color: #0C3740; margin-top: 32px; margin-bottom: 16px; border-right: 4px solid #079FDF; padding-right: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: right; }
        th { background-color: #f4f6fb; color: #172B36; font-weight: 600; }
        .badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .badge-success { background: #dff7eb; color: #087a4d; }
        .badge-warning { background: #fff3cc; color: #9a6700; }
        .badge-danger { background: #ffe2e1; color: #b42318; }
      `}</style>
      
      <div className="no-print mb-8">
        <PrintButton />
      </div>

      {schools.map((school: any, index: number) => {
        const totalVerified = school.assessments.reduce((acc: number, a: any) => acc + a.evidenceResponses.length, 0)
        const totalRequired = officialDomains.reduce((acc: number, d: any) => acc + d.indicators.reduce((a: number, i: any) => a + i.fixedEvidence.length, 0), 0)
        const overallPct = totalRequired > 0 ? Math.round((totalVerified / totalRequired) * 100) : 0
        const band = getPerformanceBand(overallPct)
        const allGaps = school.assessments.flatMap((a: any) => a.gaps)
        const allPlans = school.assessments.flatMap((a: any) => a.plans)

        return (
          <div key={school.id} className={index > 0 ? "page-break" : ""}>
            {/* === غلاف التقرير === */}
            <div className="report-header">
              <div>
                <h1 className="text-3xl font-bold text-[#0C3740]">{school.name}</h1>
                {branchContext && (
                  <p className="text-xl font-semibold text-[#079FDF] mt-1">الفرع: {branchContext.name}</p>
                )}
                <p className="text-sm text-gray-600 mt-1">{school.location} | {school.officialEmail || school.email}</p>
                <p className="text-sm text-gray-600">تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</p>
              </div>
              {school.logoUrl ? (
                <img src={school.logoUrl} alt="Logo" className="w-20 h-20 object-contain rounded-lg" />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-2xl font-bold text-gray-400">
                  {school.name.charAt(0)}
                </div>
              )}
            </div>

            <h2 className="text-xl font-bold text-[#079FDF] mb-6">تقرير تقييم الجودة المؤسسية</h2>

            {/* === الملخص التنفيذي === */}
            <h3 className="section-title">الملخص التنفيذي للأداء</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">نسبة الأداء الإجمالي</p>
                <p className="text-2xl font-bold text-[#0C3740]">{overallPct}%</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">مستوى الأداء</p>
                <p className="text-xl font-bold text-[#079FDF]">{band}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">الشواهد المتحققة</p>
                <p className="text-2xl font-bold text-green-600">{totalVerified} / {totalRequired}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-500">إجمالي الفجوات</p>
                <p className="text-2xl font-bold text-red-600">{allGaps.length}</p>
              </div>
            </div>

            {/* === تفاصيل المجالات والمؤشرات === */}
            <h3 className="section-title">تفاصيل المجالات والمؤشرات</h3>
            {officialDomains.map((domain: any) => {
              const domainIndicators = domain.indicators
              const domainVerified = school.assessments.flatMap((a: any) => a.evidenceResponses).filter((r: any) => r.evidence.indicator.domainId === domain.id).length
              const domainRequired = domainIndicators.reduce((acc: number, i: any) => acc + i.fixedEvidence.length, 0)
              const domainPct = domainRequired > 0 ? Math.round((domainVerified / domainRequired) * 100) : 0

              return (
                <div key={domain.id} className="mb-8">
                  <h4 className="text-lg font-bold text-[#172B36] mb-2 bg-gray-100 p-2 rounded">
                    {domain.name} <span className="text-sm font-normal text-gray-500">(النسبة: {domainPct}%)</span>
                  </h4>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '10%' }}>كود المؤشر</th>
                        <th style={{ width: '40%' }}>نص المؤشر</th>
                        <th style={{ width: '10%' }}>الشواهد المطلوبة</th>
                        <th style={{ width: '10%' }}>الشواهد المتحققة</th>
                        <th style={{ width: '10%' }}>نسبة التحقيق</th>
                        <th style={{ width: '20%' }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domainIndicators.map((ind: any) => {
                        const reqEv = ind.fixedEvidence.length
                        const verEv = school.assessments.flatMap((a: any) => a.evidenceResponses).filter((r: any) => r.evidence.indicatorId === ind.id).length
                        const pct = reqEv > 0 ? Math.round((verEv / reqEv) * 100) : 0
                        const indBand = getPerformanceBand(pct)
                        return (
                          <tr key={ind.id}>
                            <td className="font-mono text-[#079FDF]">{ind.code}</td>
                            <td>{ind.description}</td>
                            <td className="text-center">{reqEv}</td>
                            <td className="text-center font-bold text-green-600">{verEv}</td>
                            <td className="text-center font-bold">{pct}%</td>
                            <td className="text-center">
                              <span className={`badge ${pct >= 90 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                                {indBand}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })}

            {/* === الفجوات المكتشفة === */}
            <h3 className="section-title">تحليل الفجوات</h3>
            {allGaps.length === 0 ? (
              <p className="text-gray-500 mb-6">لا توجد فجوات مسجلة.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>كود المؤشر</th>
                    <th>وصف الفجوة</th>
                    <th>المرجع (المجال)</th>
                    <th>الأولوية</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {allGaps.map((gap: any) => (
                    <tr key={gap.id}>
                      <td className="font-mono">{gap.indicator.code}</td>
                      <td>{gap.description}</td>
                      <td>{gap.indicator.domain.name}</td>
                      <td>
                        <span className={`badge ${gap.severity === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>
                          {gap.severity === 'HIGH' ? 'عالية' : 'متوسطة'}
                        </span>
                      </td>
                      <td>{gap.status === 'OPEN' ? 'مفتوحة' : 'تم الحل'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* === خطط التحسين === */}
            <h3 className="section-title">خطط التحسين والمتابعة</h3>
            {allPlans.length === 0 ? (
              <p className="text-gray-500 mb-6">لا توجد خطط تحسين مسجلة.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>عنوان الخطة</th>
                    <th>تاريخ البدء</th>
                    <th>تاريخ الانتهاء المستهدف</th>
                    <th>التقدم</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {allPlans.map((plan: any) => (
                    <tr key={plan.id}>
                      <td className="font-medium">{plan.title}</td>
                      <td>{new Date(plan.startDate).toLocaleDateString('ar-SA')}</td>
                      <td>{new Date(plan.targetDate).toLocaleDateString('ar-SA')}</td>
                      <td className="font-bold">{plan.progress}%</td>
                      <td>{plan.status === 'COMPLETED' ? 'مكتملة' : 'جارية'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* === نتائج الاستبانات === */}
            <h3 className="section-title">نتائج الاستبانات</h3>
            {school.surveys.length === 0 ? (
              <p className="text-gray-500 mb-6">لا توجد استبانات مسجلة.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>نوع الاستبانة</th>
                    <th>النسبة المئوية</th>
                    <th>مضمنة في التقييم؟</th>
                  </tr>
                </thead>
                <tbody>
                  {school.surveys.map((surv: any) => (
                    <tr key={surv.id}>
                      <td>{surv.type}</td>
                      <td className="font-bold">{surv.percentage}%</td>
                      <td>{surv.include ? 'نعم' : 'لا'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>
        )
      })}
    </div>
  )
}