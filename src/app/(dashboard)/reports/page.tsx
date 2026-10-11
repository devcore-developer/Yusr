import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Progress } from "@/components/ui/Progress"
import { getPerformanceBand } from "@/features/quality-assessment/services/analysis"
import Link from "next/link"
import Image from "next/image"

export default async function ReportsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const isSuperAdmin = user.role === "SUPER_ADMIN"
  const isSchoolManager = user.role === "SCHOOL_MANAGER"
  const isBranchManager = user.role === "BRANCH_MANAGER"

  if (isSuperAdmin) {
    const schools = await prisma.school.findMany({
      include: { _count: { select: { branches: true } }, assessments: { where: { type: { not: "PRIVATE_REVIEW" } } } }
    })

    const schoolStats = schools.map(s => {
      const completed = s.assessments.filter(a => a.status === "COMPLETED").length
      const total = s.assessments.length
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0
      return { ...s, completed, total, pct }
    })

    return (
      <div className="space-y-6">
        <PageHeader
          title="تقارير المنصة الشاملة"
          description="مقارنة أداء المدارس المسجلة ونسب إكمال التقييمات."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        />

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-sm text-right">
              <thead className="text-[12px] text-muted-foreground bg-surface-muted uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium">المدرسة</th>
                  <th className="px-6 py-4 font-medium">الفروع</th>
                  <th className="px-6 py-4 font-medium">التقييمات</th>
                  <th className="px-6 py-4 font-medium">نسبة الإكمال</th>
                  <th className="px-6 py-4 font-medium text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {schoolStats.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-muted/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {s.logoUrl ? (
                          <Image src={s.logoUrl} alt={s.name} width={32} height={32} className="rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">{s.name.charAt(0)}</div>
                        )}
                        <span className="font-medium text-foreground-strong">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground numeric">{s._count.branches}</td>
                    <td className="px-6 py-4 text-muted-foreground numeric">{s.completed}/{s.total}</td>
                    <td className="px-6 py-4 min-w-[150px]">
                      <div className="flex items-center gap-2">
                        <Progress value={s.pct} size="sm" className="w-20" tone={s.pct === 100 ? "success" : "default"} />
                        <span className="text-[12px] font-medium text-muted-foreground numeric">{s.pct}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <Link href={`/reports/print?scope=single&schoolId=${s.id}`}>
                        <Button variant="ghost" size="sm">تقرير المدرسة</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">تصدير تقرير شامل (جميع المدارس)</h3>
          <form action="/reports/print" method="GET">
            <input type="hidden" name="scope" value="all" />
            <Button type="submit" variant="outline">تجهيز التقرير الشامل (PDF)</Button>
          </form>
        </Card>
      </div>
    )
  }

  if (isBranchManager && user.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { id: user.branchId },
      include: { school: { select: { name: true, logoUrl: true, id: true } } }
    })

    if (!branch) return null

    const totalEvidence = await prisma.fixedEvidence.count()
    const verifiedEvidence = await prisma.evidenceResponse.count({ 
      where: { 
        isVerified: true, 
        assessment: { 
          branchId: branch.id,
          type: { not: "PRIVATE_REVIEW" } 
        } 
      } 
    })
    const percentage = totalEvidence > 0 ? Math.round((verifiedEvidence / totalEvidence) * 100) : 0
    const band = getPerformanceBand(percentage)

    return (
      <div className="space-y-6">
        <PageHeader
          title={`تقارير فرع ${branch.name}`}
          description="نتائج تقييم الجودة لفرعك."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        />
        <Card className="p-8 text-center bg-primary text-white shadow-premium">
          <h2 className="text-lg font-bold mb-4 text-white">النسبة الإجمالية لأداء الفرع</h2>
          <div className="text-6xl font-bold mb-2 text-white numeric">{percentage}%</div>
          <Badge variant={percentage >= 90 ? "success" : percentage >= 75 ? "info" : "warning"} className="text-base">{band}</Badge>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">تصدير تقرير الفرع</h3>
          <form action="/reports/print" method="GET">
            <input type="hidden" name="scope" value="single" />
            <input type="hidden" name="schoolId" value={branch.school.id} />
            <input type="hidden" name="branchId" value={branch.id} />
            <Button type="submit">تجهيز تقرير الفرع (PDF)</Button>
          </form>
        </Card>
      </div>
    )
  }

  if (isSchoolManager && user.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      include: { branches: true, assessments: { where: { type: { not: "PRIVATE_REVIEW" } }, include: { assessor: true } } }
    })

    if (!school) return null

    const totalEvidence = await prisma.fixedEvidence.count()
    const verifiedEvidence = await prisma.evidenceResponse.count({ 
      where: { 
        isVerified: true, 
        assessment: { 
          schoolId: school.id,
          type: { not: "PRIVATE_REVIEW" } 
        } 
      } 
    })
    const percentage = totalEvidence > 0 ? Math.round((verifiedEvidence / totalEvidence) * 100) : 0
    const band = getPerformanceBand(percentage)

    return (
      <div className="space-y-6">
        <PageHeader
          title={`تقارير ${school.name}`}
          description="نتائج تقييم الجودة لمدرستك."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'التقارير' }]}
        />

        <Card className="p-8 text-center bg-primary text-white shadow-premium">
          <h2 className="text-lg font-bold mb-4 text-white">النسبة الإجمالية للأداء</h2>
          <div className="text-6xl font-bold mb-2 text-white numeric">{percentage}%</div>
          <Badge variant={percentage >= 90 ? "success" : percentage >= 75 ? "info" : "warning"} className="text-base">{band}</Badge>
          <p className="text-sm text-primary-100/80 mt-4">إجمالي الشواهد المتحققة: {verifiedEvidence} من {totalEvidence}</p>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-bold mb-4">سجل التقييمات</h3>
            <div className="divide-y divide-border">
              {school.assessments.map(a => (
                <div key={a.id} className="py-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-foreground-strong">{a.assessor?.name || "غير محدد"}</p>
                    <p className="text-xs text-muted-foreground">{a.status === "COMPLETED" ? "مكتمل" : "جاري"}</p>
                  </div>
                  <Badge variant={a.status === "COMPLETED" ? "success" : "warning"}>{a.progress}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold mb-4">تصدير تقرير المدرسة</h3>
          <form action="/reports/print" method="GET">
            <input type="hidden" name="scope" value="single" />
            <input type="hidden" name="schoolId" value={school.id} />
            <Button type="submit">تجهيز تقرير المدرسة (PDF)</Button>
          </form>
        </Card>
      </div>
    )
  }

  return null
}