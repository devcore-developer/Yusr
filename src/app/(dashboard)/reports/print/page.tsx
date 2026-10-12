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
    <div className="bg-white text-black p-8 md:p-12" dir="rtl">
      <style>{`
        @media print { .no-print { display: none !important; } .page-break { page-break-before: always; } }
        @page { size: A4; margin: 15mm; }
        .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #073B43; padding-bottom: 20px; }
        .section-title { font-size: 18px; font-weight: 700; color: #073B43; margin-top: 32px; margin-bottom: 16px; border-right: 4px solid #2878B8; padding-right: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; }
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
            
            {/* Visual Executive Summary */}
            <div className="report-header">
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#073B43', marginBottom: '8px' }}>{school.name}</h1>
                {branchContext && <p style={{ fontSize: '16px', color: '#2878B8', marginBottom: '8px' }}>الفرع: {branchContext.name}</p>}
                <p style={{ fontSize: '12px', color: '#64748B' }}>تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <SemiCircleGauge percentage={overallPct} size={140} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '30px', marginBottom: '40px' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#073B43', marginBottom: '12px', borderRight: '3px solid #2878B8', paddingRight: '8px' }}>أداء المجالات</h3>
                <div style={{ height: '180px' }}><VerticalBarChart data={domainChartData} /></div>
              </div>
              <div style={{ width: '220px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#073B43', marginBottom: '12px', borderRight: '3px solid #2878B8', paddingRight: '8px' }}>توزيع الأداء</h3>
                <DonutChart data={distributionData} />
              </div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <PerformanceLegend />
            </div>

            {/* Detailed Tables */}
            <h3 className="section-title">تفاصيل المجالات والمؤشرات</h3>
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
            
            {/* Keep other tables (Gaps, Plans, Surveys) here... */}
          </div>
        )
      })}
    </div>
  )
}