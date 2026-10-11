import { prisma } from "@/lib/prisma"

export async function getPlatformAnalytics() {
  const [schools, branches, assessments, gaps, totalEvidence, verifiedEvidence] = await Promise.all([
    prisma.school.count(),
    prisma.branch.count(),
    prisma.assessment.findMany({ include: { school: true, branch: true, _count: { select: { gaps: true } } }, orderBy: { startedAt: "desc" }, take: 10 }),
    prisma.gap.findMany({ include: { school: true, branch: true, indicator: true } }),
    prisma.fixedEvidence.count(),
    prisma.evidenceResponse.count({ where: { isVerified: true } })
  ])

  const responseCoverage = totalEvidence > 0 ? Math.round((verifiedEvidence / totalEvidence) * 100) : 0

  return {
    schools,
    branches,
    activeAssessments: assessments.filter(a => a.status === "IN_PROGRESS").length,
    completedAssessments: assessments.filter(a => a.status === "COMPLETED").length,
    recentAssessments: assessments,
    totalGaps: gaps.length,
    openGaps: gaps.filter(g => g.status === "OPEN").length,
    presentCount: verifiedEvidence,
    notPresentCount: gaps.length,
    responseCoverage
  }
}

export async function getSchoolAnalytics(schoolId: string) {
  const [branches, assessments, gaps, totalEvidence, verifiedEvidence] = await Promise.all([
    prisma.branch.findMany({ where: { schoolId }, include: { _count: { select: { users: true } } } }),
    prisma.assessment.findMany({ where: { schoolId }, include: { branch: true, assessor: true, _count: { select: { gaps: true } } }, orderBy: { startedAt: "desc" } }),
    prisma.gap.findMany({ where: { schoolId }, include: { indicator: true, branch: true } }),
    prisma.fixedEvidence.count(),
    prisma.evidenceResponse.count({ where: { isVerified: true, assessment: { schoolId } } })
  ])

  const responseCoverage = totalEvidence > 0 ? Math.round((verifiedEvidence / totalEvidence) * 100) : 0

  const branchComparison = await Promise.all(branches.map(async (b) => {
    const branchAssessments = assessments.filter(a => a.branchId === b.id)
    const completed = branchAssessments.filter(a => a.status === "COMPLETED").length
    const branchEvidence = await prisma.evidenceResponse.count({ where: { isVerified: true, assessment: { branchId: b.id } } })
    
    return {
      id: b.id,
      name: b.name,
      assessments: branchAssessments.length,
      completed,
      coverage: branchAssessments.length > 0 ? Math.round((branchEvidence / (branchAssessments.length * 50)) * 100) : 0
    }
  }))

  const history = assessments.filter(a => a.status === "COMPLETED").map(a => ({
    id: a.id,
    date: a.completedAt || a.startedAt,
    progress: a.progress,
    gaps: a._count.gaps,
    responses: 0
  }))

  return {
    branches: branches.length,
    totalAssessments: assessments.length,
    activeAssessments: assessments.filter(a => a.status === "IN_PROGRESS").length,
    completedAssessments: assessments.filter(a => a.status === "COMPLETED").length,
    recentAssessments: assessments.slice(0, 5),
    totalGaps: gaps.length,
    openGaps: gaps.filter(g => g.status === "OPEN").length,
    presentCount: verifiedEvidence,
    notPresentCount: gaps.length,
    notApplicableCount: 0,
    responseCoverage,
    branchComparison,
    history
  }
}