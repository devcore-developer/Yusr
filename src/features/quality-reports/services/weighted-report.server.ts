// ===== FILE: src/features/quality-reports/services/weighted-report.server.ts =====
// ============================================================
// Weighted report data loader — guarded, server-only
// ============================================================
// Feeds the on-screen evaluation card (reports page) with the SAME
// authoritative weighted results computed by weighted-score.ts that the
// print report uses. One calculation service, two presentations.
//
// Tenant isolation is enforced HERE on the server (§9):
//   - SCHOOL_MANAGER: only own school
//   - BRANCH_MANAGER: only authorized branches
//   - SUPER_ADMIN: platform-wide (existing role design)
//   - QUALITY_ASSESSOR / others: no card (their reports page is unchanged)
// URL/param tampering cannot widen the scope: the scope is derived from the
// authenticated user, not from request parameters.
//
// Assessment independence preserved: each assessment's weighted result is
// computed from ITS verified responses only; aggregation = average of the
// independent results (same methodology as the existing school average).
// ============================================================

import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"
import type { StageFilterValue } from "@/lib/stages"
import { getStageLabel } from "@/lib/stages"
import {
  aggregateDomainScores,
  averageWeightedOveralls,
  classifyPerformance,
  computeAssessmentWeightedResult,
  type PerformanceLevel,
  type WeightedAssessmentResult,
  type WeightedDiagnostics,
} from "./weighted-score"

export interface WeightedStagePanel {
  /** Raw stage enum value; null = historical records without a stage (label says «غير محددة»). */
  stage: string | null
  stageLabel: string
  overall: number | null
  classification: PerformanceLevel | null
  assessments: number
  /** Assessments skipped from the average (no weighted result — e.g. missing domain data). */
  skipped: number
}

export interface WeightedCardData {
  overall: number | null
  classification: PerformanceLevel | null
  domains: { name: string; weight: number | null; score: number | null }[]
  stagePanels: WeightedStagePanel[]
  totalAssessments: number
  countedAssessments: number
  skippedAssessments: number
  diagnostics: WeightedDiagnostics
}

export type WeightedCardScope = { schoolId: string } | { branchId: string }

/**
 * Returns null when the caller is not authorized or there are no completed
 * assessments in scope (the page then simply keeps its existing layout).
 */
export async function getWeightedCardData(
  scope: WeightedCardScope,
  stageFilter?: StageFilterValue
): Promise<WeightedCardData | null> {
  const user = await getCurrentUser()
  if (!user) return null

  // --- role/scope guard (server-enforced, mirrors existing report guards) ---
  if ("schoolId" in scope) {
    const allowed = user.role === "SUPER_ADMIN" || (user.role === "SCHOOL_MANAGER" && user.schoolId === scope.schoolId)
    if (!allowed) return null
  } else {
    const branchId = scope.branchId
    if (user.role === "SUPER_ADMIN") {
      // allowed — platform-wide visibility per existing role design
    } else if (user.role === "SCHOOL_MANAGER") {
      const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { schoolId: true } })
      if (!branch || branch.schoolId !== user.schoolId) return null
    } else if (user.role === "BRANCH_MANAGER") {
      const authorizedBranchIds = await getAuthorizedBranchIds(user)
      if (!authorizedBranchIds.includes(branchId)) return null
    } else {
      return null // QUALITY_ASSESSOR and any other role
    }
  }

  // --- load completed assessments in scope (same filters as the existing report) ---
  const assessments = await prisma.assessment.findMany({
    where: {
      type: { not: "PRIVATE_REVIEW" },
      status: "COMPLETED",
      ...("schoolId" in scope ? { schoolId: scope.schoolId } : { branchId: scope.branchId }),
      ...(stageFilter !== undefined ? { stage: stageFilter } : {}),
    },
    select: {
      id: true,
      stage: true,
      evidenceResponses: {
        where: { isVerified: true },
        // id للشاهد ضروري لتفريد الشواهد (صفوف زيارات الملاحظة الصفية المتعددة
        // لنفس الشاهد لا تُعدّ أكثر من مرة — انظر distinctVerifiedEvidenceRows)
        select: { evidence: { select: { id: true, indicator: { select: { domainId: true, axisId: true } } } } },
      },
    },
  })
  if (assessments.length === 0) return null

  // --- official framework (same source as the print report) ---
  const officialDomains = await prisma.domain.findMany({
    select: {
      id: true,
      name: true,
      indicators: {
        select: {
          id: true,
          domainId: true,
          axisId: true,
          axis: { select: { name: true } },
          fixedEvidence: { select: { id: true } },
        },
      },
    },
  })

  const results = assessments.map(a => computeAssessmentWeightedResult(officialDomains, a.evidenceResponses))

  // --- overall = average of the independent weighted results ---
  const overallAgg = averageWeightedOveralls(results)
  const domains = aggregateDomainScores(results)

  // --- stage panels (dynamic — only stages that actually exist in scope) ---
  const stageGroups = new Map<string, { stage: string | null; results: WeightedAssessmentResult[] }>()
  const zipped = assessments.map((a, index) => ({ stage: a.stage as string | null, result: results[index] }))
  for (const item of zipped) {
    if (!item.result) continue
    const key = item.stage ?? "__UNSPECIFIED__"
    if (!stageGroups.has(key)) stageGroups.set(key, { stage: item.stage, results: [] })
    stageGroups.get(key)!.results.push(item.result)
  }
  const stagePanels: WeightedStagePanel[] = Array.from(stageGroups.values()).map(group => {
    const agg = averageWeightedOveralls(group.results)
    return {
      stage: group.stage,
      stageLabel: getStageLabel(group.stage),
      overall: agg.average,
      classification: classifyPerformance(agg.average),
      assessments: group.results.length,
      skipped: agg.skipped,
    }
  })
  // deterministic order: known stages first (platform order), then unspecified
  const STAGE_ORDER = ["KINDERGARTEN", "PRIMARY", "INTERMEDIATE", "SECONDARY", "SPECIAL_EDUCATION"]
  stagePanels.sort((a, b) => {
    const ia = a.stage ? STAGE_ORDER.indexOf(a.stage) : STAGE_ORDER.length
    const ib = b.stage ? STAGE_ORDER.indexOf(b.stage) : STAGE_ORDER.length
    return (ia === -1 ? STAGE_ORDER.length : ia) - (ib === -1 ? STAGE_ORDER.length : ib)
  })

  const diagnostics: WeightedDiagnostics = {
    unmatchedConfigs: Array.from(new Set(results.flatMap(r => r.diagnostics.unmatchedConfigs))),
    missingDataDomains: Array.from(new Set(results.flatMap(r => r.diagnostics.missingDataDomains))),
    extraDomains: Array.from(new Set(results.flatMap(r => r.diagnostics.extraDomains))),
  }

  return {
    overall: overallAgg.average,
    classification: classifyPerformance(overallAgg.average),
    domains,
    stagePanels,
    totalAssessments: assessments.length,
    countedAssessments: overallAgg.counted,
    skippedAssessments: overallAgg.skipped,
    diagnostics,
  }
}