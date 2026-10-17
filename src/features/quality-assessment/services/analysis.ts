import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"

export interface AssessmentScore {
  id: string
  status: string
  score: number
  evaluatorId: string
  evaluatorName: string
  evaluatorRole: string
  verifiedCount: number
  totalEvidence: number
  branchId?: string | null
  branchName?: string
}

export interface EvaluatorAnalytics {
  id: string
  name: string
  role: string
  assessments: AssessmentScore[]
  provisionalAverage: number | null
  finalAverage: number | null
}

export interface BranchAnalytics {
  provisionalPercentage: number | null
  finalPercentage: number | null
  eligibleAssessments: number
  completedAssessments: number
  inProgressAssessments: number
  excludedAssessments: number
  evaluators: EvaluatorAnalytics[]
  assessments: AssessmentScore[]
}

export async function getPlatformAnalytics() {
  // الإصلاح: إحصائيات المنصة الشاملة لمدير النظام فقط
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden")
  }

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

export async function getSchoolAnalytics(schoolId: string): Promise<BranchAnalytics> {
  // الإصلاح: تحليلات المدرسة (تتضمن أسماء المقيّمين ونتائجهم) لمدير المدرسة أو مدير النظام فقط
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")
  if (user.role !== "SUPER_ADMIN" && !(user.role === "SCHOOL_MANAGER" && user.schoolId === schoolId)) {
    throw new Error("Forbidden")
  }

  const totalEvidence = await prisma.fixedEvidence.count()
  const assessments = await prisma.assessment.findMany({
    where: { schoolId, type: "NORMAL", status: { in: ["IN_PROGRESS", "COMPLETED"] } },
    include: {
      assessor: { select: { id: true, name: true, role: true } },
      branch: { select: { id: true, name: true } },
      evidenceResponses: { where: { isVerified: true } }
    }
  })

  const excludedAssessments = await prisma.assessment.count({
    where: { schoolId, OR: [ { type: "PRIVATE_REVIEW" }, { status: "NOT_STARTED" } ] }
  })

  if (assessments.length === 0) {
    return {
      provisionalPercentage: null,
      finalPercentage: null,
      eligibleAssessments: 0,
      completedAssessments: 0,
      inProgressAssessments: 0,
      excludedAssessments,
      evaluators: [],
      assessments: []
    }
  }

  const mapped: AssessmentScore[] = assessments.map(a => ({
    id: a.id,
    status: a.status,
    score: totalEvidence > 0 ? Math.round((a.evidenceResponses.length / totalEvidence) * 100) : 0,
    evaluatorId: a.assessor?.id ?? "unknown",
    evaluatorName: a.assessor?.name ?? "غير محدد",
    evaluatorRole: a.assessor?.role ?? "غير محدد",
    verifiedCount: a.evidenceResponses.length,
    totalEvidence,
    branchId: a.branchId,
    branchName: a.branch?.name || "كامل المدرسة"
  }))

  const provisionalPercentage = mapped.length > 0
    ? Math.round((mapped.reduce((sum, a) => sum + a.score, 0) / mapped.length) * 10) / 10
    : null

  const completed = mapped.filter(a => a.status === "COMPLETED")
  const finalPercentage = completed.length > 0
    ? Math.round((completed.reduce((sum, a) => sum + a.score, 0) / completed.length) * 10) / 10
    : null

  const evaluatorMap = new Map<string, EvaluatorAnalytics>()
  for (const a of mapped) {
    if (!evaluatorMap.has(a.evaluatorId)) {
      evaluatorMap.set(a.evaluatorId, {
        id: a.evaluatorId,
        name: a.evaluatorName,
        role: a.evaluatorRole,
        assessments: [],
        provisionalAverage: 0,
        finalAverage: null
      })
    }
    evaluatorMap.get(a.evaluatorId)!.assessments.push(a)
  }

  const evaluators: EvaluatorAnalytics[] = Array.from(evaluatorMap.values()).map(ev => {
    const evCompleted = ev.assessments.filter(a => a.status === "COMPLETED")
    ev.provisionalAverage = ev.assessments.length > 0
      ? Math.round((ev.assessments.reduce((sum, a) => sum + a.score, 0) / ev.assessments.length) * 10) / 10
      : null
    ev.finalAverage = evCompleted.length > 0
      ? Math.round((evCompleted.reduce((sum, a) => sum + a.score, 0) / evCompleted.length) * 10) / 10
      : null
    return ev
  })

  return {
    provisionalPercentage,
    finalPercentage,
    eligibleAssessments: mapped.length,
    completedAssessments: completed.length,
    inProgressAssessments: mapped.length - completed.length,
    excludedAssessments,
    evaluators,
    assessments: mapped
  }
}

export async function getBranchAnalytics(branchId: string): Promise<BranchAnalytics> {
  // الإصلاح: تحليلات الفرع لمدير القسم (فرعه) أو مدير المدرسة (فروع مدرسته) أو مدير النظام فقط
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  if (user.role !== "SUPER_ADMIN") {
    if (user.role === "SCHOOL_MANAGER") {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { schoolId: true }
      })
      if (!branch || branch.schoolId !== user.schoolId) throw new Error("Forbidden")
    } else if (user.role === "BRANCH_MANAGER") {
      const authorizedBranchIds = await getAuthorizedBranchIds(user)
      if (!authorizedBranchIds.includes(branchId)) throw new Error("Forbidden")
    } else {
      // QUALITY_ASSESSOR وأي دور آخر: تحليلات الفرع تتضمن أداء باقي المقيّمين — ممنوعة
      throw new Error("Forbidden")
    }
  }

  const totalEvidence = await prisma.fixedEvidence.count()
  const assessments = await prisma.assessment.findMany({
    where: { branchId, type: "NORMAL", status: { in: ["IN_PROGRESS", "COMPLETED"] } },
    include: {
      assessor: { select: { id: true, name: true, role: true } },
      evidenceResponses: { where: { isVerified: true } }
    }
  })

  const excludedAssessments = await prisma.assessment.count({
    where: { branchId, OR: [ { type: "PRIVATE_REVIEW" }, { status: "NOT_STARTED" } ] }
  })

  if (assessments.length === 0) {
    return {
      provisionalPercentage: null,
      finalPercentage: null,
      eligibleAssessments: 0,
      completedAssessments: 0,
      inProgressAssessments: 0,
      excludedAssessments,
      evaluators: [],
      assessments: []
    }
  }

  const mapped: AssessmentScore[] = assessments.map(a => ({
    id: a.id,
    status: a.status,
    score: totalEvidence > 0 ? Math.round((a.evidenceResponses.length / totalEvidence) * 100) : 0,
    evaluatorId: a.assessor?.id ?? "unknown",
    evaluatorName: a.assessor?.name ?? "غير محدد",
    evaluatorRole: a.assessor?.role ?? "غير محدد",
    verifiedCount: a.evidenceResponses.length,
    totalEvidence
  }))

  const provisionalPercentage = mapped.length > 0
    ? Math.round((mapped.reduce((sum, a) => sum + a.score, 0) / mapped.length) * 10) / 10
    : null

  const completed = mapped.filter(a => a.status === "COMPLETED")
  const finalPercentage = completed.length > 0
    ? Math.round((completed.reduce((sum, a) => sum + a.score, 0) / completed.length) * 10) / 10
    : null

  const evaluatorMap = new Map<string, EvaluatorAnalytics>()
  for (const a of mapped) {
    if (!evaluatorMap.has(a.evaluatorId)) {
      evaluatorMap.set(a.evaluatorId, {
        id: a.evaluatorId,
        name: a.evaluatorName,
        role: a.evaluatorRole,
        assessments: [],
        provisionalAverage: 0,
        finalAverage: null
      })
    }
    evaluatorMap.get(a.evaluatorId)!.assessments.push(a)
  }

  const evaluators: EvaluatorAnalytics[] = Array.from(evaluatorMap.values()).map(ev => {
    const evCompleted = ev.assessments.filter(a => a.status === "COMPLETED")
    ev.provisionalAverage = ev.assessments.length > 0
      ? Math.round((ev.assessments.reduce((sum, a) => sum + a.score, 0) / ev.assessments.length) * 10) / 10
      : null
    ev.finalAverage = evCompleted.length > 0
      ? Math.round((evCompleted.reduce((sum, a) => sum + a.score, 0) / evCompleted.length) * 10) / 10
      : null
    return ev
  })

  return {
    provisionalPercentage,
    finalPercentage,
    eligibleAssessments: mapped.length,
    completedAssessments: completed.length,
    inProgressAssessments: mapped.length - completed.length,
    excludedAssessments,
    evaluators,
    assessments: mapped
  }
}
// فئات الأداء المعتمدة — مطابقة لحدود الشارات المستخدمة في صفحات التقارير (90 / 75 / 50)
export function getPerformanceBand(score: number | null): string {
  if (score === null || Number.isNaN(score)) return "غير مقيم"
  if (score >= 90) return "ممتاز"
  if (score >= 75) return "جيد جدًا"
  if (score >= 50) return "مقبول"
  return "ضعيف"
}