"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"

export async function globalSearch(query: string) {
  const user = await getCurrentUser()
  if (!user || !query || query.length < 2) return []

  const results: any[] = []
  const whereQuery = { contains: query, mode: 'insensitive' as const }

  try {
    if (user.role === "SUPER_ADMIN") {
      const schools = await prisma.school.findMany({ where: { name: whereQuery }, take: 3, select: { id: true, name: true, location: true } })
      results.push(...schools.map(s => ({ type: "مدرسة", label: s.name, sublabel: s.location, href: `/schools/${s.id}` })))

      const users = await prisma.user.findMany({ where: { OR: [{ name: whereQuery }, { email: whereQuery }] }, take: 3, select: { id: true, name: true, email: true, role: true } })
      results.push(...users.map(u => ({ type: "مستخدم", label: u.name, sublabel: u.email, href: `/users` })))

      const gaps = await prisma.gap.findMany({
        where: { description: whereQuery },
        take: 3,
        include: { indicator: true }
      })
      results.push(...gaps.map(g => ({ type: "فجوة", label: g.indicator.code, sublabel: g.description, href: `/gaps` })))
    } else if (user.role === "SCHOOL_MANAGER" && user.schoolId) {
      const branches = await prisma.branch.findMany({ where: { schoolId: user.schoolId, name: whereQuery }, take: 3, select: { id: true, name: true, location: true } })
      results.push(...branches.map(b => ({ type: "فرع", label: b.name, sublabel: b.location, href: `/school-manager/branches` })))

      const users = await prisma.user.findMany({ where: { schoolId: user.schoolId, OR: [{ name: whereQuery }, { email: whereQuery }] }, take: 3, select: { id: true, name: true, email: true } })
      results.push(...users.map(u => ({ type: "مستخدم", label: u.name, sublabel: u.email, href: `/school-manager/users` })))

      const gaps = await prisma.gap.findMany({
        where: { description: whereQuery, schoolId: user.schoolId },
        take: 3,
        include: { indicator: true }
      })
      results.push(...gaps.map(g => ({ type: "فجوة", label: g.indicator.code, sublabel: g.description, href: `/gaps` })))
    } else if (user.role === "BRANCH_MANAGER") {
      // الإصلاح: مدير القسم كان يرى كل مستخدمي وفجوات المدرسة — الآن محصور في فروعه
      const authorizedBranchIds = await getAuthorizedBranchIds(user)

      const branches = await prisma.branch.findMany({ where: { id: { in: authorizedBranchIds }, name: whereQuery }, take: 3, select: { id: true, name: true, location: true } })
      results.push(...branches.map(b => ({ type: "فرع", label: b.name, sublabel: b.location, href: `/school-manager/branches` })))

      const users = await prisma.user.findMany({
        where: { schoolId: user.schoolId ?? undefined, branchId: { in: authorizedBranchIds }, OR: [{ name: whereQuery }, { email: whereQuery }] },
        take: 3,
        select: { id: true, name: true, email: true }
      })
      results.push(...users.map(u => ({ type: "مستخدم", label: u.name, sublabel: u.email, href: `/school-manager/users` })))

      const gaps = await prisma.gap.findMany({
        where: {
          description: whereQuery,
          schoolId: user.schoolId ?? undefined,
          OR: [
            { branchId: { in: authorizedBranchIds } },
            { assessment: { assessorId: user.id } }
          ]
        },
        take: 3,
        include: { indicator: true }
      })
      results.push(...gaps.map(g => ({ type: "فجوة", label: g.indicator.code, sublabel: g.description, href: `/gaps` })))
    } else if (user.role === "QUALITY_ASSESSOR") {
      // الإصلاح: المقيّم كان يرى كل مستخدمي المدرسة وفروعها وفجواتها — الآن فجوات تقييماته هو فقط
      const gaps = await prisma.gap.findMany({
        where: { description: whereQuery, assessment: { assessorId: user.id } },
        take: 3,
        include: { indicator: true }
      })
      results.push(...gaps.map(g => ({ type: "فجوة", label: g.indicator.code, sublabel: g.description, href: `/gaps` })))
    }

    return results
  } catch (error) {
    // في حال كانت قاعدة بيانات Neon نائمة (Sleep) أو يوجد خطأ في الاتصال
    console.error("Search DB error:", error)
    return []
  }
}