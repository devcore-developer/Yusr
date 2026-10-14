import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PrintButton } from "@/components/reports/PrintButton"
import { SemiCircleGauge, VerticalBarChart, DonutChart, PerformanceLegend } from "@/components/charts/AnalyticsCharts"
import { getPerformanceLevel } from "@/lib/performance"

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
      assessments: {
        where: { type: { not: "PRIVATE_REVIEW" }, ...(branchId ? { branchId } : {}) },
        include: {
          assessor: true,
          evidenceResponses: { where: { isVerified: true }, include: { evidence: { include: { indicator: { include: { domain: true, axis: true } } } } } },
          gaps: { include: { indicator: { include: { domain: true } } } },
          plans: { include: { actions: true } }
        }
      },
      surveys: true
    }
  })

  const officialDomains = await prisma.domain.findMany({ include: { indicators: { include: { fixedEvidence: true } } } })

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

      {schools.map((school: any, index: number) => {
        const totalVerified = school.assessments.reduce((acc: number, a: any) => acc + a.evidenceResponses.length, 0)
        const totalRequired = officialDomains.reduce((acc: number, d: any) => acc + d.indicators.reduce((a: number, i: any) => a + i.fixedEvidence.length, 0), 0)
        const overallPct = totalRequired > 0 ? Math.round((totalVerified / totalRequired) * 100) : 0

        const domainChartData = officialDomains.map(d => {
          const dv = school.assessments.flatMap((a: any) => a.evidenceResponses).filter((r: any) => r.evidence.indicator.domainId === d.id).length
          const dr = d.indicators.reduce((acc: number, i: any) => acc + i.fixedEvidence.length, 0)
          return { name: d.name, percentage: dr > 0 ? Math.round((dv / dr) * 100) : null }
        })

        const distributionData = [
          { label: 'التميز', value: 0, color: '#16A34A' }, { label: 'التقدم', value: 0, color: '#2878B8' },
          { label: 'الانطلاق', value: 0, color: '#E9A34A' }, { label: 'التهيئة', value: 0, color: '#C62828' },
          { label: 'غير مقيم', value: 0, color: '#858B95' }
        ]
        officialDomains.forEach(d => d.indicators.forEach((ind: any) => {
          const req = ind.fixedEvidence.length
          const ver = school.assessments.flatMap((a: any) => a.evidenceResponses).filter((r: any) => r.evidence.indicatorId === ind.id).length
          const pct = req > 0 ? Math.round((ver / req) * 100) : null
          const level = getPerformanceLevel(pct)
          const distItem = distributionData.find(item => item.label === level.label)
          if (distItem) distItem.value++
        }))

        return (
          <div key={school.id} className={index > 0 ? "page-break" : ""}>
            
            {/* Report Header */}
            <div className="report-header">
              <div className="flex-1 min-w-0 flex items-center gap-3">
                {school.logoUrl ? (
                  <img src={school.logoUrl} alt={`${school.name} logo`} style={{ width: '50px', height: '50px', objectFit: 'contain', borderRadius: '8px' }} />
                ) : (
                  <div style={{ width: '50px', height: '50px', borderRadius: '8px', backgroundColor: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#073B43', fontWeight: 'bold', fontSize: '20px', flexShrink: 0 }}>
                    {school.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#073B43', marginBottom: '4px', wordWrap: 'break-word' }}>{school.name}</h1>
                  {branchContext && <p style={{ fontSize: '14px', color: '#2878B8', marginBottom: '4px' }}>الفرع: {branchContext.name}</p>}
                  <p style={{ fontSize: '12px', color: '#64748B' }}>تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</p>
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <SemiCircleGauge percentage={overallPct} size={120} />
              </div>
            </div>

            {/* Charts Section */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '40px' }}>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#073B43', marginBottom: '12px', borderRight: '3px solid #2878B8', paddingRight: '8px' }}>أداء المجالات</h3>
                <div style={{ height: '200px', width: '100%' }}><VerticalBarChart data={domainChartData} /></div>
              </div>
              <div style={{ flex: '0 0 220px', maxWidth: '100%' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#073B43', marginBottom: '12px', borderRight: '3px solid #2878B8', paddingRight: '8px' }}>توزيع الأداء</h3>
                <div style={{ height: '200px', width: '100%' }}><DonutChart data={distributionData} /></div>
              </div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <PerformanceLegend />
            </div>

            <h3 className="section-title">تفاصيل المجالات والمؤشرات</h3>
            
            {/* Desktop Table Layout (Used for Print/PDF) */}
            <div className="hidden md:block">
              {officialDomains.map((domain: any) => {
                const domainIndicators = domain.indicators
                const domainVerified = school.assessments.flatMap((a: any) => a.evidenceResponses).filter((r: any) => r.evidence.indicator.domainId === domain.id).length
                const domainRequired = domainIndicators.reduce((acc: number, i: any) => acc + i.fixedEvidence.length, 0)
                const domainPct = domainRequired > 0 ? Math.round((domainVerified / domainRequired) * 100) : 0

                return (
                  <div key={domain.id} className="mb-6">
                    <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#172B36', marginBottom: '8px', background: '#f4f6fb', padding: '8px' }}>
                      {domain.name} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'gray' }}>(النسبة: {domainPct}%)</span>
                    </h4>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '10%' }}>الكود</th>
                          <th style={{ width: '40%' }}>المؤشر</th>
                          <th style={{ width: '10%' }}>المطلوب</th>
                          <th style={{ width: '10%' }}>المتحقق</th>
                          <th style={{ width: '10%' }}>النسبة</th>
                          <th style={{ width: '20%' }}>المستوى</th>
                        </tr>
                      </thead>
                      <tbody>
                        {domainIndicators.map((ind: any) => {
                          const reqEv = ind.fixedEvidence.length
                          const verEv = school.assessments.flatMap((a: any) => a.evidenceResponses).filter((r: any) => r.evidence.indicatorId === ind.id).length
                          const pct = reqEv > 0 ? Math.round((verEv / reqEv) * 100) : 0
                          const level = getPerformanceLevel(pct)
                          return (
                            <tr key={ind.id}>
                              <td style={{ fontFamily: 'monospace', color: '#079FDF' }}>{ind.code}</td>
                              <td>{ind.description}</td>
                              <td style={{ textAlign: 'center' }}>{reqEv}</td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#16A34A' }}>{verEv}</td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{pct}%</td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '600', backgroundColor: `${level.color}20`, color: level.color }}>{level.label}</span>
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

            {/* Mobile Card Layout (Used for Screen Preview) */}
            <div className="md:hidden">
              {officialDomains.map((domain: any) => {
                const domainIndicators = domain.indicators
                const domainVerified = school.assessments.flatMap((a: any) => a.evidenceResponses).filter((r: any) => r.evidence.indicator.domainId === domain.id).length
                const domainRequired = domainIndicators.reduce((acc: number, i: any) => acc + i.fixedEvidence.length, 0)
                const domainPct = domainRequired > 0 ? Math.round((domainVerified / domainRequired) * 100) : 0

                return (
                  <div key={domain.id} className="mb-6 border border-gray-200 rounded-lg p-3">
                    <h4 style={{ fontSize: '16px', fontWeight: 'bold', color: '#172B36', marginBottom: '12px', background: '#f4f6fb', padding: '8px', borderRadius: '6px' }}>
                      {domain.name} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'gray' }}>(النسبة: {domainPct}%)</span>
                    </h4>
                    <div className="space-y-3">
                      {domainIndicators.map((ind: any) => {
                        const reqEv = ind.fixedEvidence.length
                        const verEv = school.assessments.flatMap((a: any) => a.evidenceResponses).filter((r: any) => r.evidence.indicatorId === ind.id).length
                        const pct = reqEv > 0 ? Math.round((verEv / reqEv) * 100) : 0
                        const level = getPerformanceLevel(pct)
                        return (
                          <div key={ind.id} className="border-b pb-2">
                            <div className="flex justify-between items-start mb-1">
                              <span style={{ fontFamily: 'monospace', color: '#079FDF', fontSize: '12px' }}>{ind.code}</span>
                              <span style={{ padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '600', backgroundColor: `${level.color}20`, color: level.color }}>{level.label}</span>
                            </div>
                            <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#172B36', marginBottom: '4px' }}>{ind.description}</p>
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>المطلوب: {reqEv}</span>
                              <span>المتحقق: {verEv}</span>
                              <span style={{ fontWeight: 'bold' }}>النسبة: {pct}%</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            
          </div>
        )
      })}
    </div>
  )
}