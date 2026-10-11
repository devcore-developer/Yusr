import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"

export async function getDashboardContext() {
  const user = await getCurrentUser()
  if (!user) return null

  if (user.role === "SUPER_ADMIN") {
    const [schools, assessments, gaps] = await Promise.all([
      prisma.school.count(),
      prisma.assessment.findMany({ take: 5, include: { school: true }, orderBy: { startedAt: "desc" } }),
      prisma.gap.findMany({ take: 5, include: { school: true }, orderBy: { createdAt: "desc" } })
    ])
    return {
      role: "SUPER_ADMIN",
      scope: "Platform-wide",
      metrics: {
        totalSchools: schools,
        recentAssessments: assessments.map(a => ({ school: a.school.name, status: a.status, progress: a.progress })),
        recentGaps: gaps.map(g => ({ school: g.school.name, severity: g.severity, status: g.status }))
      }
    }
  } else if (user.role === "SCHOOL_MANAGER" && user.schoolId) {
    const [branches, assessments, gaps] = await Promise.all([
      prisma.branch.count({ where: { schoolId: user.schoolId } }),
      prisma.assessment.findMany({ where: { schoolId: user.schoolId }, take: 5, include: { branch: true }, orderBy: { startedAt: "desc" } }),
      prisma.gap.findMany({ where: { schoolId: user.schoolId }, take: 5, include: { indicator: true }, orderBy: { createdAt: "desc" } })
    ])
    return {
      role: "SCHOOL_MANAGER",
      scope: `School ID: ${user.schoolId}`,
      metrics: {
        totalBranches: branches,
        recentAssessments: assessments.map(a => ({ branch: a.branch?.name, status: a.status, progress: a.progress })),
        recentGaps: gaps.map(g => ({ indicator: g.indicator.code, severity: g.severity, status: g.status }))
      }
    }
  }

  return null
}