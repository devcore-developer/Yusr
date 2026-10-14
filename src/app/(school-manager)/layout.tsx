import { AppShell } from "@/components/layout/AppShell"
import { getCurrentUser } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  let schoolContext: { name: string; logoUrl: string | null } | null = null

  if (user?.schoolId) {
    const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true, logoUrl: true } })
    if (school) schoolContext = school
  }

  return (
    <AppShell 
      role={user?.role || "GUEST"} 
      title="منصة يُسر للتقويم المدرسي الداخلي" 
      user={user ? { name: user.name!, email: user.email!, image: (user as any).image } : undefined}
      schoolContext={schoolContext}
    >
      {children}
    </AppShell>
  )
}