// ============================================================
// /school-manager dashboard — لوحة مدير المدرسة / مدير القسم
// ============================================================
// (إصلاح تضخم «أداء المجالات» 466%/868%/565%/418%)
// كان الرسم يُحسب محليًا في الصفحة: جمع صفوف EvidenceResponse المتحققة من كل
// التقييمات (جارية + مكتملة، وصفوف زيارات الملاحظة الصفية لنفس الشاهد تُعدّ
// مرات) فوق مقام ثابت = حجم بنك المجال ⇒ النسبة = مجموع نسب التقييمات فوق
// بعضها وتتخطى 100% كلما تعددت التقييمات.
//
// المعالجة: لا حساب محلي للصفحة إطلاقًا — «أداء المجالات» (للقسم وللمدرسة)
// يأتي من المحمّل الرسمي المشترك getWeightedCardData (weighted-report.server.ts
// ← weighted-score.ts المُختبَرة) — نفس المصدر المستخدم في بطاقة التقويم
// الرسمية ولوحة مدير النظام وتقارير الطباعة:
//   - فلاتر النطاق الرسمية: type ≠ PRIVATE_REVIEW + status = COMPLETED
//   - كل تقييم مستقل يُحسب من شواهده المفردة (distinct evidenceId) ثم تُتوسط
//     النتائج المستقلة — لا دمج صفوف عبر التقييمات (بنيويًا ≤ 100%)
//   - درجات المجالات معروضة قبل الأوزان (الأوزان 20/30/40/10 داخل الدرجة
//     المرجحة فقط ولا تُعرض كنسب مجالات)
//   - بلا تقييم مكتمل → null → رسالة صادقة بلا أصفار مصنوعة
// باقي اللوحة (المؤشرات، مقارنة الفروع، الفجوات، النشاطات، خطط التحسين)
// كما هي دون أي مساس — مصادرها القائمة لم تُلمس.
// القراءة فقط: لا أي كتابة أو تعديل بيانات في هذه الصفحة.
// ============================================================

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PageHeader } from "@/components/layout/PageHeader"
import { StatCard } from "@/components/dashboard/StatCard"
import { RecentAssessments } from "@/components/dashboard/RecentAssessments"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { Button } from "@/components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { VerticalBarChart, HorizontalBarChart } from "@/components/charts/AnalyticsCharts"
import { Building2, Users, ClipboardCheck, AlertTriangle, RefreshCw, TrendingUp, FileCheck, ArrowLeft } from "lucide-react"
import { getSchoolAnalytics, getBranchAnalytics } from "@/features/quality-reports/services/analytics"
import { getPerformanceBand } from "@/features/quality-assessment/services/analysis"
// (إصلاح التضخم) المحمّل الرسمي المشترك — مصدر واحد لحساب «أداء المجالات»
// لكل اللوحات: لوحة مدير النظام، بطاقة التقويم، وهذه اللوحة
import { getWeightedCardData } from "@/features/quality-reports/services/weighted-report.server"

export default async function SchoolManagerDashboard() {
  const user = await getCurrentUser()
  if (!user?.schoolId) return null

  // === لوحة تحكم مدير قسم ===
  if (user.role === "BRANCH_MANAGER") {
    if (!user.branchId) redirect("/login")

    // استخدام دالة التجميع الموحدة لحساب الأداء
    const perf = await getBranchAnalytics(user.branchId)

    // (إصلاح التضخم) أداء المجالات من المحمّل الرسمي المشترك — لا حساب محلي ثانٍ.
    // الحراسة داخل المحمّل نفسه (فروع مدير القسم المصرّح بها فقط) والنطاق من
    // الجلسة لا من معاملات الطلب.
    const [branchCard, usersCount, recentAssessmentsRaw, branchGaps, delayedPlans, recentActivities] = await Promise.all([
      getWeightedCardData({ branchId: user.branchId }),
      prisma.user.count({ where: { branchId: user.branchId } }),
      prisma.assessment.findMany({
        where: { branchId: user.branchId, type: "NORMAL" }, take: 5, orderBy: { startedAt: "desc" },
        include: { school: { select: { name: true } }, assessor: { select: { name: true } } }
      }),
      prisma.gap.findMany({
        where: { branchId: user.branchId, status: "OPEN", assessment: { type: "NORMAL" } }, take: 4,
        include: { indicator: true }
      }),
      prisma.improvementPlan.findMany({
        where: { branchId: user.branchId, status: { not: "COMPLETED" } }, take: 4
      }),
      prisma.activity.findMany({
        where: { branchId: user.branchId }, take: 5, orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } }
      }),
    ])

    return (
      <div className="space-y-6 lg:space-y-8">
        <PageHeader
          title="لوحة تحكم مدير قسم"
          description="نظرة عامة على أداء فرعك والمستخدمين التابعين له."
          breadcrumbs={[{ label: 'الرئيسية', href: '/school-manager' }, { label: 'لوحة التحكم' }]}
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          <StatCard label="مستخدمو الفرع" value={usersCount} icon={<Users className="w-5 h-5" />} tone="info" />
          <StatCard label="التقييمات المؤهلة" value={perf.eligibleAssessments} icon={<ClipboardCheck className="w-5 h-5" />} tone="amber" />
          <StatCard label="الفجوات المفتوحة" value={branchGaps.length} icon={<AlertTriangle className="w-5 h-5" />} tone="danger" />
          <StatCard 
            label="الأداء الإجمالي للفرع" 
            value={perf.provisionalPercentage !== null ? `${perf.provisionalPercentage}%` : "—"} 
            icon={<TrendingUp className="w-5 h-5" />} 
            tone="success" 
          />
        </div>

        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>أداء المجالات في الفرع</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {/* (إصلاح التضخم) درجات المجالات المستقلة قبل الأوزان — متوسط النتائج
                المستقلة للتقييمات المكتملة، بنيويًا محصورة 0–100%.
                بلا تقييم مكتمل → رسالة صادقة بلا أصفار مصنوعة */}
            {branchCard && branchCard.domains.length > 0 ? (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  متوسط النتائج المستقلة لـ {branchCard.countedAssessments} تقييم مكتمل — المنهجية الرسمية نفسها المستخدمة في بطاقة التقويم ولوحة مدير النظام.
                </p>
                <VerticalBarChart data={branchCard.domains.map(d => ({ name: d.name, percentage: d.score }))} />
              </>
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                لا توجد تقييمات مكتملة بعد — تُعرض نسب المجالات أول ما يُكتمل تقييم في هذا الفرع.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="lg:col-span-2">
            <RecentAssessments assessments={recentAssessmentsRaw} />
          </div>
          
          <Card className="p-6 flex flex-col">
            <CardHeader className="px-0 pt-0 flex-row items-center justify-between">
              <CardTitle>أبرز الفجوات</CardTitle>
              <Link href="/school-manager/quality/gaps" className="text-xs text-cyan-600 hover:underline flex items-center gap-1">
                عرض الكل <ArrowLeft className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent className="px-0 flex-1 overflow-hidden">
              {branchGaps.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center py-4">
                  لا توجد فجوات مفتوحة حالياً.
                </div>
              ) : (
                <div className="space-y-3">
                  {branchGaps.map(gap => (
                    <Link href={`/quality-assessor/assessments/${gap.assessmentId}`} key={gap.id} className="block p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${gap.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                        <span className="text-xs font-mono text-slate-500">{gap.indicator.code}</span>
                      </div>
                      <p className="text-xs text-slate-700 line-clamp-2 pr-4">{gap.description}</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <Card>
            <CardHeader>
              <CardTitle icon={<FileCheck className="w-5 h-5" />}>خطط التحسين والمتابعة</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {delayedPlans.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">لا توجد خطط تحسين نشطة حالياً.</div>
              ) : (
                <div className="divide-y divide-border">
                  {delayedPlans.map(p => (
                    <div key={p.id} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-foreground-strong text-sm">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">المستهدف: {new Date(p.targetDate).toLocaleDateString('ar-SA')}</p>
                      </div>
                      <Badge variant={p.progress === 100 ? "success" : "warning"}>{p.progress}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <RecentActivity activities={recentActivities} />
        </div>
      </div>
    )
  }

  // === لوحة تحكم المدير العام ===
  const schoolId = user.schoolId

  // استخدام دالة التجميع الموحدة للمدرسة
  const perf = await getSchoolAnalytics(schoolId)

  const [
    schoolCard, school, branchesCount, usersCount, openGaps, totalGaps, recentAssessmentsRaw, recentActivities,
    delayedPlans
  ] = await Promise.all([
    // (إصلاح التضخم) أداء المجالات من المحمّل الرسمي المشترك — نفس الفلاتر
    // الرسمية (type ≠ PRIVATE_REVIEW + COMPLETED) ووحدة الحساب نفسها المستخدمة
    // في لوحة مدير النظام ⇒ الأرقام متطابقة على نفس البيانات
    getWeightedCardData({ schoolId }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, status: true } }),
    prisma.branch.count({ where: { schoolId } }),
    prisma.user.count({ where: { schoolId } }),
    prisma.gap.count({ where: { schoolId, status: "OPEN", assessment: { type: "NORMAL" } } }),
    prisma.gap.count({ where: { schoolId, assessment: { type: "NORMAL" } } }),
    prisma.assessment.findMany({
      where: { schoolId, type: "NORMAL" }, take: 6, orderBy: { startedAt: "desc" },
      include: { school: { select: { id: true, name: true } }, branch: { select: { name: true } }, assessor: { select: { name: true } } },
    }),
    prisma.activity.findMany({
      where: { schoolId }, take: 8, orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true } }, school: { select: { name: true } } },
    }),
    prisma.improvementPlan.findMany({
      where: { schoolId, targetDate: { lt: new Date() }, status: { not: "COMPLETED" } }, take: 5,
    }),
  ])

  if (!school) return null

  // تجميع بيانات مقارنة الفروع بناءً على البيانات الموحدة
  const branchStatsMap = new Map<string, { name: string, assessments: number, score: number }>()
  for (const a of perf.assessments) {
    if (a.branchId) {
      if (!branchStatsMap.has(a.branchId)) {
        branchStatsMap.set(a.branchId, { name: a.branchName || "غير محدد", assessments: 0, score: 0 })
      }
      const stat = branchStatsMap.get(a.branchId)!
      stat.assessments++
      stat.score += a.score
    }
  }
  
  const branchComparisonData = Array.from(branchStatsMap.values()).map(b => {
    return {
      name: b.name,
      percentage: b.assessments > 0 ? Math.round(b.score / b.assessments) : null
    }
  })

  const topSchoolGaps = await prisma.gap.findMany({
    where: { schoolId, status: "OPEN", assessment: { type: "NORMAL" } },
    take: 5,
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    include: { indicator: { include: { domain: true } }, branch: { select: { name: true } } }
  })

  return (
    <div className="space-y-6 lg:space-y-8">
      <PageHeader
        title={school.name}
        description="لوحة تحكم إدارة المدرسة — تابع الفروع والمستخدمين والتقييمات وخطط التحسين."
        breadcrumbs={[{ label: 'الرئيسية', href: '/school-manager' }, { label: 'لوحة التحكم' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="md" icon={<RefreshCw className="w-4 h-4" />}>تحديث</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <StatCard label="الفروع" value={branchesCount} icon={<Building2 className="w-5 h-5" />} tone="info" context={`${branchesCount} فرع نشط`} />
        <StatCard label="المستخدمون" value={usersCount} icon={<Users className="w-5 h-5" />} tone="violet" context={`${usersCount} مستخدم مسجل`} />
        <StatCard label="تقييمات مؤهلة" value={perf.eligibleAssessments} icon={<ClipboardCheck className="w-5 h-5" />} tone="amber" status={{ label: `${perf.completedAssessments} مكتمل`, tone: 'success' }} />
        <StatCard 
          label="الأداء الإجمالي للمدرسة" 
          value={perf.provisionalPercentage !== null ? `${perf.provisionalPercentage}%` : "—"} 
          icon={<TrendingUp className="w-5 h-5" />} 
          tone="success" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>أداء المجالات</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {/* (إصلاح التضخم 466%/868%/565%/418%) درجات المجالات المستقلة قبل
                الأوزان — متوسط النتائج المستقلة للتقييمات المكتملة فقط، من وحدة
                الحساب المشتركة نفسها ⇒ تتطابق مع بطاقة هذه المدرسة في لوحة مدير
                النظام على نفس البيانات، ولا تتخطى 100% بنيويًا مهما تعددت التقييمات */}
            {schoolCard && schoolCard.domains.length > 0 ? (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  متوسط النتائج المستقلة لـ {schoolCard.countedAssessments} تقييم مكتمل — تطابق أرقامها بطاقة التقويم الرسمية ولوحة مدير النظام.
                </p>
                <VerticalBarChart data={schoolCard.domains.map(d => ({ name: d.name, percentage: d.score }))} />
              </>
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                لا توجد تقييمات مكتملة بعد — تُعرض نسب المجالات أول ما يُكتمل تقييم في مدرستك.
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>تقدم التقييم في الفروع</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <HorizontalBarChart data={branchComparisonData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2">
          <RecentAssessments assessments={recentAssessmentsRaw} />
        </div>
        
        <Card className="p-6 flex flex-col">
          <CardHeader className="px-0 pt-0 flex-row items-center justify-between">
            <CardTitle>أبرز الفجوات</CardTitle>
            <Link href="/school-manager/quality/gaps" className="text-xs text-cyan-600 hover:underline flex items-center gap-1">
              عرض الكل <ArrowLeft className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 flex-1 overflow-hidden">
            {topSchoolGaps.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 text-center py-4">
                لا توجد فجوات مفتوحة حالياً.
              </div>
            ) : (
              <div className="space-y-3">
                {topSchoolGaps.map(gap => (
                  <Link href={`/quality-assessor/assessments/${gap.assessmentId}`} key={gap.id} className="block p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${gap.severity === 'HIGH' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <span className="text-xs font-mono text-slate-500">{gap.indicator.code}</span>
                      {gap.branch && <span className="text-xs text-slate-400 truncate">- {gap.branch.name}</span>}
                    </div>
                    <p className="text-xs text-slate-700 line-clamp-2 pr-4">{gap.description}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <RecentActivity activities={recentActivities} />
        <Card className="p-6 flex items-center justify-center text-muted-foreground text-sm">
          لمزيد من التفاصيل حول خطط التحسين، يرجى زيارة صفحة خطط التحسين.
        </Card>
      </div>
    </div>
  )
}