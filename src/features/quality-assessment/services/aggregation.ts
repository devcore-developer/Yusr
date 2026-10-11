import { prisma } from "@/lib/prisma"
import { getPerformanceBand } from "./analysis"

export interface ComparisonResult {
  indicatorCode: string
  indicatorText: string
  domain: string
  responses: Record<string, { value: string; notes?: string | null } | undefined>
  agreement: boolean
  evaluatedByAll: boolean
}

export interface AggregatedResult {
  totalEvaluations: number
  averageScore: number
  performanceBand: string
  domainAverages: { domain: string; average: number; band: string }[]
  agreementRate: number
  totalIndicators: number
  agreedIndicators: number
  disagreedIndicators: number
}

export async function compareAssessments(assessmentIds: string[]) {
  const assessments = await prisma.assessment.findMany({
    where: { id: { in: assessmentIds } },
    include: {
      assessor: { select: { id: true, name: true, role: true } },
      school: { select: { name: true } },
      branch: { select: { name: true } },
      evidenceResponses: {
        where: { isVerified: true },
        include: {
          evidence: {
            include: {
              indicator: {
                include: { domain: true, axis: true }
              }
            }
          }
        }
      },
      responses: {
        include: {
          indicator: true
        }
      }
    }
  })

  if (assessments.length < 2) {
    throw new Error("يجب اختيار تقييمين على الأقل للمقارنة")
  }

  // Get all official indicators
  const domains = await prisma.domain.findMany({
    include: {
      indicators: {
        include: { fixedEvidence: true, axis: true }
      }
    }
  })

  const allIndicators = domains.flatMap(d => 
    d.indicators.map(i => ({
      code: i.code,
      text: i.description,
      domain: d.name,
      axis: i.axis?.name,
      requiredEvidence: i.fixedEvidence.length
    }))
  )

  // Build comparison matrix
  const comparisons: ComparisonResult[] = allIndicators.map(indicator => {
    const responses: Record<string, { value: string; notes?: string | null } | undefined> = {}
    let allEvaluated = true
    let allAgree = true
    let firstValue: string | null = null

    for (const assessment of assessments) {
      const verifiedCount = assessment.evidenceResponses.filter(
        er => er.evidence.indicator.code === indicator.code
      ).length

      const response = assessment.responses.find(
        r => r.indicator.code === indicator.code
      )

      const status = verifiedCount > 0 
        ? `${verifiedCount}/${indicator.requiredEvidence} متحقق`
        : "لم يُقيّم"

      responses[assessment.assessor.id] = {
        value: status,
        notes: response?.notes
      }

      if (verifiedCount === 0) {
        allEvaluated = false
      }

      if (firstValue === null) {
        firstValue = status
      } else if (status !== firstValue) {
        allAgree = false
      }
    }

    return {
      indicatorCode: indicator.code,
      indicatorText: indicator.text,
      domain: indicator.domain,
      responses,
      agreement: allAgree && allEvaluated,
      evaluatedByAll: allEvaluated
    }
  })

  // Calculate aggregated results
  const totalIndicators = comparisons.length
  const evaluatedIndicators = comparisons.filter(c => c.evaluatedByAll).length
  const agreedIndicators = comparisons.filter(c => c.agreement).length
  const disagreedIndicators = evaluatedIndicators - agreedIndicators

  // Calculate average scores per assessment
  const assessmentScores = await Promise.all(
    assessments.map(async (a) => {
      const totalEvidence = await prisma.fixedEvidence.count()
      const verifiedEvidence = a.evidenceResponses.length
      const score = totalEvidence > 0 ? Math.round((verifiedEvidence / totalEvidence) * 100) : 0
      return { assessorId: a.assessor.id, assessorName: a.assessor.name, score }
    })
  )

  const averageScore = assessmentScores.length > 0
    ? Math.round(assessmentScores.reduce((acc, s) => acc + s.score, 0) / assessmentScores.length)
    : 0

  // Domain averages
  const domainAverages = domains.map(d => {
    const domainIndicators = comparisons.filter(c => c.domain === d.name && c.evaluatedByAll)
    const domainAgreed = domainIndicators.filter(c => c.agreement).length
    const avg = domainIndicators.length > 0
      ? Math.round((domainAgreed / domainIndicators.length) * 100)
      : 0
    return {
      domain: d.name,
      average: avg,
      band: getPerformanceBand(avg)
    }
  })

  const agreementRate = evaluatedIndicators > 0
    ? Math.round((agreedIndicators / evaluatedIndicators) * 100)
    : 0

  const result: AggregatedResult = {
    totalEvaluations: assessments.length,
    averageScore,
    performanceBand: getPerformanceBand(averageScore),
    domainAverages,
    agreementRate,
    totalIndicators,
    agreedIndicators,
    disagreedIndicators
  }

  return {
    assessments: assessments.map(a => ({
      id: a.id,
      assessorName: a.assessor.name,
      assessorRole: a.assessor.role,
      schoolName: a.school?.name || "",
      branchName: a.branch?.name || "",
      status: a.status,
      progress: a.progress,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt
    })),
    comparisons,
    aggregated: result,
    assessmentScores
  }
}