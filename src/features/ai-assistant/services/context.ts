import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"

export async function getDashboardContext() {
  const user = await getCurrentUser()
  if (!user) return { role: "GUEST", scope: "Public", metrics: {} }

  // ملاحظة للخصوصية: يتم إرسال بيانات مجمعة فقط (Aggregate Data) للذكاء الاصطناعي
  // لا يتم تضمين أسماء الطلاب، أو المعلمين، أو البريد الإلكتروني، أو أي بيانات شخصية حساسة هنا.

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
    // جلب اسم المدرسة الفعلي لتمريره للسياق
    const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } })
    
    const [branches, assessments, gaps] = await Promise.all([
      prisma.branch.count({ where: { schoolId: user.schoolId } }),
      prisma.assessment.findMany({ where: { schoolId: user.schoolId }, take: 5, include: { branch: true }, orderBy: { startedAt: "desc" } }),
      prisma.gap.findMany({ where: { schoolId: user.schoolId }, take: 5, include: { indicator: true }, orderBy: { createdAt: "desc" } })
    ])
    return {
      role: "SCHOOL_MANAGER",
      // تمرير اسم المدرسة الفعلي بدلاً من الـ ID
      scope: `School Name: ${school?.name || 'Unknown'}`,
      metrics: {
        totalBranches: branches,
        recentAssessments: assessments.map(a => ({ branch: a.branch?.name, status: a.status, progress: a.progress })),
        recentGaps: gaps.map(g => ({ indicator: g.indicator.code, severity: g.severity, status: g.status }))
      }
    }
  } else if (user.role === "BRANCH_MANAGER" && user.branchId) {
    // جلب اسم المدرسة واسم الفرع
    const branch = await prisma.branch.findUnique({ where: { id: user.branchId }, include: { school: { select: { name: true } } } })
    
    const [assessments, gaps] = await Promise.all([
      prisma.assessment.findMany({ where: { branchId: user.branchId }, take: 5, orderBy: { startedAt: "desc" } }),
      prisma.gap.findMany({ where: { branchId: user.branchId }, take: 5, include: { indicator: true }, orderBy: { createdAt: "desc" } })
    ])
    return {
      role: "BRANCH_MANAGER",
      // تمرير أسماء الفرع والمدرسة الفعلية
      scope: `School Name: ${branch?.school?.name || 'Unknown'}, Branch Name: ${branch?.name || 'Unknown'}`,
      metrics: {
        recentAssessments: assessments.map(a => ({ status: a.status, progress: a.progress })),
        recentGaps: gaps.map(g => ({ indicator: g.indicator.code, severity: g.severity, status: g.status }))
      }
    }
  } else if (user.role === "QUALITY_ASSESSOR" && user.id) {
    const assessments = await prisma.assessment.findMany({ 
      where: { assessorId: user.id }, 
      take: 5, 
      orderBy: { startedAt: "desc" } 
    })
    return {
      role: "QUALITY_ASSESSOR",
      scope: `Assessor ID: ${user.id}`,
      metrics: {
        recentAssessments: assessments.map(a => ({ status: a.status, progress: a.progress }))
      }
    }
  }

  return {
    role: "USER",
    scope: "General",
    metrics: {}
  }
}