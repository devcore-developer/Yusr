export const dynamic = 'force-dynamic'
import { AppShell } from "@/components/layout/AppShell"
import { SuperAdminProvider } from "@/features/super-admin/context/SuperAdminContext"
import { getCurrentUser } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  let schoolContext: { name: string; logoUrl: string | null } | null = null

  if (user && (user.role === "QUALITY_ASSESSOR" || user.role === "BRANCH_MANAGER")) {
    if (user.schoolId) {
      const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, logoUrl: true } })
      if (school) schoolContext = school
    } else if (user.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: user.branchId }, include: { school: { select: { name: true, logoUrl: true } } } })
      if (branch?.school) schoolContext = branch.school
    }
  }

  return (
    <SuperAdminProvider>
      <AppShell 
        role={user?.role || "GUEST"} 
        title="منصة يُسر للتقويم المدرسي الداخلي" 
        user={user ? { name: user.name!, email: user.email!, image: (user as any).image } : undefined}
        schoolContext={schoolContext}
      >
        {children}
      </AppShell>
    </SuperAdminProvider>
  )
}