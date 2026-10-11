import { Domain, Indicator } from '@prisma/client'

export type PerformanceLevel = 0 | 1 | 2 | 3 | 4
export type PerformanceBand = 'غير مقيم' | 'التهيئة' | 'الانطلاق' | 'التقدم' | 'التميز'

export interface AnalysisResult {
  totalIndicators: number
  completedResponses: number
  presentCount: number
  notPresentCount: number
  notApplicableCount: number
  completionPercentage: number
  evidenceCoverage: number
  performanceLevel: PerformanceLevel
  performanceBand: PerformanceBand
  domainAnalysis: DomainAnalysis[]
  potentialGaps: PotentialGap[]
}

export interface DomainAnalysis {
  domainId: string
  domainName: string
  totalIndicators: number
  completed: number
  present: number
  notPresent: number
  notApplicable: number
  completionPercentage: number
  performanceBand: PerformanceBand
}

export interface PotentialGap {
  indicatorId: string
  indicatorCode: string
  description: string
  domainName: string
  responseId: string
}

interface ResponseWithEvidence {
  id: string
  indicatorId: string
  value: string
  notes?: string | null
  evidence?: { id: string }[]
}

// دالة تطبيق قواعد الجودة الرسمية
export function getPerformanceBand(percentage: number): PerformanceBand {
  if (percentage === 0) return 'غير مقيم'
  if (percentage < 50) return 'التهيئة'
  if (percentage < 75) return 'الانطلاق'
  if (percentage < 90) return 'التقدم'
  return 'التميز'
}

export function getPerformanceLevel(percentage: number): PerformanceLevel {
  if (percentage === 0) return 0
  if (percentage < 50) return 1
  if (percentage < 75) return 2
  if (percentage < 90) return 3
  return 4
}

export function analyzeAssessment(
  domains: (Domain & { axes: { indicators: Indicator[] }[] })[],
  responses: ResponseWithEvidence[]
): AnalysisResult {
  const responseMap = new Map(responses.map(r => [r.indicatorId, r]))
  
  let totalIndicators = 0
  let completedResponses = 0
  let presentCount = 0
  let notPresentCount = 0
  let notApplicableCount = 0
  let indicatorsWithEvidence = 0

  const domainAnalysis: DomainAnalysis[] = []
  const potentialGaps: PotentialGap[] = []

  for (const domain of domains) {
    let dTotal = 0
    let dCompleted = 0
    let dPresent = 0
    let dNotPresent = 0
    let dNotApplicable = 0

    for (const axis of domain.axes) {
      for (const ind of axis.indicators) {
        totalIndicators++
        dTotal++
        
        const res = responseMap.get(ind.id)
        if (res) {
          completedResponses++
          dCompleted++
          
          if (res.value === 'PRESENT') { presentCount++; dPresent++ }
          if (res.value === 'NOT_PRESENT') { 
            notPresentCount++; dNotPresent++
            potentialGaps.push({
              indicatorId: ind.id,
              indicatorCode: ind.code,
              description: ind.description,
              domainName: domain.name,
              responseId: res.id
            })
          }
          if (res.value === 'NOT_APPLICABLE') { notApplicableCount++; dNotApplicable++ }
          
          if (res.evidence && res.evidence.length > 0) {
            indicatorsWithEvidence++
          }
        }
      }
    }

    const dCompletion = dTotal > 0 ? Math.round((dCompleted / dTotal) * 100) : 0
    domainAnalysis.push({
      domainId: domain.id,
      domainName: domain.name,
      totalIndicators: dTotal,
      completed: dCompleted,
      present: dPresent,
      notPresent: dNotPresent,
      notApplicable: dNotApplicable,
      completionPercentage: dCompletion,
      performanceBand: getPerformanceBand(dCompletion)
    })
  }

  const completionPercentage = totalIndicators > 0 ? Math.round((completedResponses / totalIndicators) * 100) : 0

  return {
    totalIndicators,
    completedResponses,
    presentCount,
    notPresentCount,
    notApplicableCount,
    completionPercentage,
    evidenceCoverage: completedResponses > 0 ? Math.round((indicatorsWithEvidence / completedResponses) * 100) : 0,
    performanceLevel: getPerformanceLevel(completionPercentage),
    performanceBand: getPerformanceBand(completionPercentage),
    domainAnalysis,
    potentialGaps
  }
}