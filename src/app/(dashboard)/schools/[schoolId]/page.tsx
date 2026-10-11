import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/permissions"
import { SchoolProfile } from "./SchoolProfile"

export default async function SchoolDetailsPage({ params }: { params: { schoolId: string } }) {
  await requireRole(["SUPER_ADMIN"])

  const [school, branches, users, assessments, subscription, activities, gaps, plans] = await Promise.all([
    prisma.school.findUnique({
      where: { id: params.schoolId },
      include: { _count: { select: { branches: true, users: true } } },
    }),
    prisma.branch.findMany({
      where: { schoolId: params.schoolId },
      include: { _count: { select: { users: true } }, manager: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { schoolId: params.schoolId },
      select: { id: true, name: true, email: true, role: true, status: true, branch: { select: { name: true } }, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.assessment.findMany({
      where: { schoolId: params.schoolId },
      include: { branch: { select: { name: true } }, assessor: { select: { name: true } }, _count: { select: { responses: true, gaps: true } } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.subscription.findFirst({
      where: { schoolId: params.schoolId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activity.findMany({
      where: { schoolId: params.schoolId },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } } },
    }),
    prisma.gap.findMany({
      where: { schoolId: params.schoolId },
      include: { indicator: { select: { code: true, description: true, domain: { select: { name: true } } } }, branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.improvementPlan.findMany({
      where: { schoolId: params.schoolId },
      include: { gap: { select: { indicator: { select: { code: true } } } }, branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ])

  if (!school) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h1 className="text-xl font-semibold text-foreground">المدرسة غير موجودة</h1>
        <p className="text-sm text-muted-foreground mt-2">ربما تم حذفها أو أن المعرف غير صحيح.</p>
      </div>
    )
  }

  return (
    <SchoolProfile
      school={school}
      branches={branches}
      users={users}
      assessments={assessments}
      subscription={subscription}
      activities={activities}
      gaps={gaps}
      plans={plans}
    />
  )
}