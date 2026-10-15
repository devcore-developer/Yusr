import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Database, Search, Building2, ChevronLeft, AlertTriangle, Target, CalendarDays, ChevronDown } from "lucide-react"
import Link from "next/link"

export default async function GapsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined
  const schoolId = typeof searchParams.schoolId === 'string' ? searchParams.schoolId : undefined

  // === 1. واجهة السوبر أدمن: تنظيم الفجوات حسب المدرسة ===
  if (user.role === "SUPER_ADMIN") {
    // جلب كل المدارس مع إحصائيات الفجوات والتقييمات
    const schools = await prisma.school.findMany({
      include: {
        gaps: {
          where: { status: "OPEN", assessment: { type: "NORMAL" } },
          select: { id: true, indicatorId: true }
        },
        assessments: {
          where: { type: "NORMAL", status: "COMPLETED" },
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { id: true, completedAt: true, progress: true }
        }
      }
    })

    // بناء استعلام الفجوات
    const gapsWhere: any = {
      status: "OPEN",
      assessment: { type: "NORMAL" }
    }

    if (schoolId) {
      gapsWhere.schoolId = schoolId
    }

    if (q) {
      gapsWhere.OR = [
        { indicator: { code: { contains: q, mode: 'insensitive' } } },
        { indicator: { description: { contains: q, mode: 'insensitive' } } },
        { school: { name: { contains: q, mode: 'insensitive' } } },
        { branch: { name: { contains: q, mode: 'insensitive' } } },
        { description: { contains: q, mode: 'insensitive' } }
      ]
    }

    const gaps = await prisma.gap.findMany({
      where: gapsWhere,
      include: {
        school: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        indicator: { include: { domain: true, axis: true } },
        assessment: { select: { id: true, cycle: true, status: true, assessor: { select: { name: true } } } },
        plans: { select: { id: true, title: true, status: true, progress: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    // تجميع الفجوات حسب المدرسة (لعرض الكل)
    const groupedGaps = gaps.reduce((acc, gap) => {
      const sId = gap.school?.id || "unknown"
      if (!acc[sId]) {
        acc[sId] = {
          schoolName: gap.school?.name || "غير محدد",
          gaps: []
        }
      }
      acc[sId].gaps.push(gap)
      return acc
    }, {} as Record<string, { schoolName: string, gaps: any[] }>)

    return (
      <div className="space-y-6">
        <PageHeader
          title="تحليل الفجوات (إدارة المنصة)"
          description="عرض شامل للفجوات المصنفة حسب المدارس والفروع التابعة لها."
          breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'الفجوات' }]}
        />

        {/* أدوات الفلترة والبحث */}
        <form className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-border rounded-lg">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input name="q" defaultValue={q} placeholder="ابحث برمز المؤشر، الوصف، المدرسة، أو الفرع..." className="pr-10" />
          </div>
          <select 
            name="schoolId" 
            defaultValue={schoolId || ""}
            className="h-10 px-3 rounded-md border border-border bg-surface text-sm min-w-[200px]"
          >
            <option value="">كل المدارس</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <Button type="submit" variant="primary" size="md" icon={<Search className="w-4 h-4" />}>تصفية</Button>
          {schoolId && (
            <Link href="/gaps">
              <Button type="button" variant="outline" size="md">إلغاء فلتر المدرسة</Button>
            </Link>
          )}
        </form>

        {/* لوحة نظرة عامة على المدارس (تظهر فقط إذا لم يتم اختيار مدرسة محددة) */}
        {!schoolId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schools.map((s) => {
              const indicatorCount = new Set(s.gaps.map(g => g.indicatorId)).size
              const latestAssessment = s.assessments[0]
              return (
                <Card key={s.id} className="p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground-strong">{s.name}</h3>
                        <p className="text-xs text-muted-foreground">إجمالي الفجوات: {s.gaps.length}</p>
                      </div>
                    </div>
                    <Badge variant={s.gaps.length > 0 ? "danger" : "success"}>{s.gaps.length} مفتوحة</Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex flex-col p-2 bg-surface-muted rounded-md">
                      <span className="text-xs text-muted-foreground">مؤشرات تحتاج تحسين</span>
                      <span className="font-bold text-foreground-strong">{indicatorCount}</span>
                    </div>
                    <div className="flex flex-col p-2 bg-surface-muted rounded-md">
                      <span className="text-xs text-muted-foreground">آخر تقييم مكتمل</span>
                      <span className="font-bold text-foreground-strong">
                        {latestAssessment ? new Date(latestAssessment.completedAt as Date).toLocaleDateString('ar-SA') : "لا يوجد"}
                      </span>
                    </div>
                  </div>

                  <Link href={`/gaps?schoolId=${s.id}`} className="mt-auto">
                    <Button variant="outline" className="w-full" size="sm">عرض فجوات المدرسة</Button>
                  </Link>
                </Card>
              )
            })}
          </div>
        )}

        {/* عرض الفجوات التفصيلي */}
        <div className="space-y-6">
          {gaps.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground">
              لا توجد فجوات مفتوحة مطابقة لمعايير البحث الحالية.
            </Card>
          ) : schoolId ? (
            // عرض قائمة بسيطة إذا تم اختيار مدرسة محددة
            <div className="space-y-4">
              <h2 className="text-lg font-bold">فجوات {schools.find(s => s.id === schoolId)?.name || "المدرسة"}</h2>
              {gaps.map((gap) => <GapCard key={gap.id} gap={gap} />)}
            </div>
          ) : (
            // عرض مجموعات منسدلة لكل مدرسة (عرض الكل)
            Object.values(groupedGaps).map((group) => (
              <Card key={group.schoolName} className="overflow-hidden">
                <details className="group" open>
                  <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-muted/50 transition-colors list-none">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-primary" />
                      <h3 className="font-bold text-foreground-strong">{group.schoolName}</h3>
                      <Badge variant="neutral">{group.gaps.length} فجوة</Badge>
                    </div>
                    <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <CardContent className="p-4 border-t border-border space-y-4">
                    {group.gaps.map((gap) => <GapCard key={gap.id} gap={gap} />)}
                  </CardContent>
                </details>
              </Card>
            ))
          )}
        </div>
      </div>
    )
  }

  // === 2. واجهة المدير العام / مدير قسم / المشرف ===
  // (يرون فقط الفجوات ضمن نطاق صلاحياتهم دون الحاجة لاختيار المدرسة)
  const scopeWhere: any = {
    status: "OPEN",
    assessment: { type: "NORMAL" }
  }

  if (user.role === "SCHOOL_MANAGER" && user.schoolId) {
    scopeWhere.schoolId = user.schoolId
  } else if (user.role === "BRANCH_MANAGER" && user.branchId) {
    scopeWhere.branchId = user.branchId
  } else if (user.role === "QUALITY_ASSESSOR" && user.id) {
    scopeWhere.assessment = { assessorId: user.id, type: "NORMAL" }
  } else {
    redirect("/login")
  }

  if (q) {
    scopeWhere.OR = [
      { indicator: { code: { contains: q, mode: 'insensitive' } } },
      { indicator: { description: { contains: q, mode: 'insensitive' } } },
      { description: { contains: q, mode: 'insensitive' } }
    ]
  }

  const scopedGaps = await prisma.gap.findMany({
    where: scopeWhere,
    include: {
      school: { select: { name: true } },
      branch: { select: { name: true } },
      indicator: { include: { domain: true, axis: true } },
      assessment: { select: { id: true, cycle: true, assessor: { select: { name: true } } } },
      plans: { select: { id: true, title: true, status: true, progress: true } }
    },
    orderBy: { createdAt: "desc" }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="تحليل الفجوات"
        description="عرض الفجوات المكتشفة بناءً على نتائج التقييمات ضمن نطاقك."
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'الفجوات' }]}
      />

      <form method="GET" className="flex flex-wrap items-center gap-3 p-4 bg-surface border border-border rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input name="q" defaultValue={q} placeholder="ابحث برمز المؤشر أو الوصف..." className="pr-10" />
        </div>
        <Button type="submit" variant="primary" size="md" icon={<Search className="w-4 h-4" />}>تصفية</Button>
      </form>

      <div className="space-y-4">
        {scopedGaps.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            لا توجد فجوات مفتوحة حالياً في نطاقك.
          </Card>
        ) : (
          scopedGaps.map((gap) => <GapCard key={gap.id} gap={gap} showSchool={false} />)
        )}
      </div>
    </div>
  )
}

// مكون موحد لعرض بطاقة الفجوة
function GapCard({ gap, showSchool = true }: { gap: any, showSchool?: boolean }) {
  return (
    <div className="border border-border rounded-lg p-4 hover:bg-surface-muted/30 transition-colors">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="neutral" className="font-mono">{gap.indicator?.code}</Badge>
            <Badge variant={gap.severity === "HIGH" ? "danger" : "warning"}>
              {gap.severity === "HIGH" ? "أولوية عالية" : "أولوية متوسطة"}
            </Badge>
            {gap.assessment?.cycle && (
              <Badge variant="info">دورة {gap.assessment.cycle}</Badge>
            )}
          </div>
          
          <p className="text-sm font-medium text-foreground-strong leading-relaxed">
            {gap.indicator?.description}
          </p>
          
          <p className="text-xs text-muted-foreground">
            الوصف: {gap.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2">
            {showSchool && gap.school && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {gap.school.name}
              </span>
            )}
            {gap.branch && (
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" /> فرع: {gap.branch.name}
              </span>
            )}
            {gap.indicator?.domain && (
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" /> {gap.indicator.domain.name}
              </span>
            )}
            {gap.indicator?.axis && (
              <span>محور: {gap.indicator.axis.name}</span>
            )}
            {gap.assessment?.assessor && (
              <span>المقيّم: {gap.assessment.assessor.name}</span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {gap.plans && gap.plans.length > 0 ? (
            <Badge variant="success">يوجد خطة تحسين ({gap.plans[0].progress}%)</Badge>
          ) : (
            <Badge variant="neutral">لا توجد خطة</Badge>
          )}
          
          <Link href={`/quality-assessor/assessments/${gap.assessmentId}`}>
            <Button variant="outline" size="sm" icon={<ChevronLeft className="w-4 h-4" />}>
              عرض التقييم
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}