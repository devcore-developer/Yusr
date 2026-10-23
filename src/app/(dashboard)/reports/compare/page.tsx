// ===== FILE: src/app/(dashboard)/reports/compare/page.tsx =====
import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import Link from "next/link"
import { getBranchAnalytics, EvaluatorAnalytics, AssessmentScore } from "@/features/quality-reports/services/analytics"
import { getPerformanceBand } from "@/features/quality-assessment/services/analysis"

export default async function EvaluatorComparisonPage({ searchParams }: { searchParams: { branchId?: string, schoolId?: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  let branchId = searchParams.branchId
  if (!branchId && user.branchId) branchId = user.branchId

  if (!branchId) {
    return <div className="p-6">الرجاء تحديد فرع</div>
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, include: { school: true } })
  if (!branch) return <div>الفرع غير موجود</div>

  // ===== حماية الوصول على الخادم (فحص مستقل عن الواجهة وعن معاملات الرابط) =====
  // هذه الصفحة تعرض أداء "كل" المقيّمين في الفرع — وليست من تقارير مقيّم الجودة نفسه،
  // لذلك مقيّم الجودة وأي دور آخر ممنوع منها كليًا حتى لو مرّر branchId لفرع آخر يدويًا.
  // ملاحظة: getBranchAnalytics تفرض نفس السياسة داخليًا أيضًا (دفاع في العمق).
  let allowed = false
  if (user.role === "SUPER_ADMIN") {
    // مدير النظام: وصول على مستوى المنصة بلا قيود ملكية
    allowed = true
  } else if (user.role === "SCHOOL_MANAGER") {
    // مدير المدرسة: فروع مدرسته فقط — أي branchId لمدرسة أخرى يُرفض
    allowed = !!user.schoolId && user.schoolId === branch.schoolId
  } else if (user.role === "BRANCH_MANAGER") {
    // مدير الفرع: الفروع المصرّح بها فقط (يدعم تعدد الفروع المصرّح بها، مثل سياسة الخدمة نفسها)
    const authorizedBranchIds = await getAuthorizedBranchIds(user)
    allowed = authorizedBranchIds.includes(branchId)
  }
  if (!allowed) redirect("/login")

  const analytics = await getBranchAnalytics(branchId)

  // جلب درجات المجالات لكل مقيّم (استقلالية الحسابات — مطابقة لمنهجية تقرير الطباعة):
  // - المصدر الصحيح للشواهد المتحققة هو evidenceResponses على التقييم نفسه
  //   (EvidenceResponse بفلتر isVerified)، وسلسلة العلاقات evidence.indicator.domainId
  //   هي التي تربط الشاهد بمؤشره ومجاله — وليس Indicator.responses (وهي ملاحظات
  //   المؤشر لكل تقييم: assessmentId/indicatorId/notes فقط — بلا isVerified).
  // - الاستجابات مقيدة بتقييمات هذا الفرع المؤهلة فقط (NORMAL + جاري/مكتمل)، وكل
  //   استجابة تحمل تقييمها — لا يوجد أي استعلام يجلب استجابات من خارج هذا الفرع.
  const branchAssessments = await prisma.assessment.findMany({
    where: { branchId, type: "NORMAL", status: { in: ["IN_PROGRESS", "COMPLETED"] } },
    select: {
      assessorId: true,
      evidenceResponses: {
        where: { isVerified: true },
        // evidenceId ضروري لتفريد الشواهد (زيارات الملاحظة الصفية المتعددة لنفس الشاهد)
        select: { evidenceId: true, evidence: { select: { indicator: { select: { domainId: true } } } } }
      }
    }
  })

  const domains = await prisma.domain.findMany({
    include: { indicators: { include: { fixedEvidence: true } } }
  })

  const evaluatorDomainScores: Record<string, { domain: string, score: number }[]> = {}
  for (const ev of analytics.evaluators) {
    evaluatorDomainScores[ev.id] = []
    for (const d of domains) {
      const required = d.indicators.reduce((sum, ind) => sum + ind.fixedEvidence.length, 0)
      // (إصلاح التضخم) درجة المجال تُحسب لكل تقييم مستقلًا من شواهده المفردة هو فقط،
      // ثم درجة المقيّم = متوسط نسب تقييماته المستقلة — لا جمع لشواهد تقييمات
      // متعددة فوق مقام إطار واحد (كان يعطي حتى 300% مع ثلاثة تقييمات مكتملة)،
      // وصفوف زيارات الملاحظة الصفية لنفس الشاهد لا تُعدّ أكثر من مرة.
      const assessmentPcts: number[] = []
      for (const a of branchAssessments) {
        if (a.assessorId !== ev.id) continue
        const seen = new Set<string>()
        let verified = 0
        for (const r of a.evidenceResponses) {
          // evidenceId عمود قائم في EvidenceResponse — هوية التفريد الوحيدة هنا
          const key = r.evidenceId
          if (key) {
            if (seen.has(key)) continue
            seen.add(key)
          }
          if (r.evidence.indicator.domainId === d.id) verified++
        }
        if (required > 0) assessmentPcts.push(Math.round((verified / required) * 100))
      }
      const score = assessmentPcts.length > 0
        ? Math.round(assessmentPcts.reduce((s, p) => s + p, 0) / assessmentPcts.length)
        : 0
      evaluatorDomainScores[ev.id].push({ domain: d.name, score })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="تقرير مقارنة المقيّمين"
        description={`${branch.school.name} - ${branch.name}`}
        breadcrumbs={[
          { label: 'الرئيسية', href: '/' },
          { label: 'التقارير', href: '/reports' },
          { label: 'مقارنة المقيّمين' }
        ]}
      />

      {/* بطاقات مؤشرات الأداء (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">الأداء الإجمالي للفرع (مؤقت)</p>
          <p className="text-2xl font-bold mt-2">
            {analytics.provisionalPercentage !== null ? `${analytics.provisionalPercentage}%` : "—"}
          </p>
          <Badge variant={analytics.provisionalPercentage === null ? "neutral" : "info"} className="mt-2">
            {analytics.provisionalPercentage !== null ? getPerformanceBand(analytics.provisionalPercentage) : "غير مقيم"}
          </Badge>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">متوسط التقييمات المكتملة</p>
          <p className="text-2xl font-bold mt-2">
            {analytics.finalPercentage !== null ? `${analytics.finalPercentage}%` : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">عدد التقييمات المؤهلة</p>
          <p className="text-2xl font-bold mt-2">{analytics.eligibleAssessments}</p>
          <p className="text-xs text-muted-foreground mt-1">{analytics.completedAssessments} مكتمل / {analytics.inProgressAssessments} جاري</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">عدد المقيّمين</p>
          <p className="text-2xl font-bold mt-2">{analytics.evaluators.length}</p>
        </Card>
      </div>

      {/* رسم بياني لمقارنة أداء المقيّمين */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-bold mb-4">مقارنة أداء المقيّمين</h3>
          <div className="space-y-4">
            {analytics.evaluators.map((ev: EvaluatorAnalytics) => (
              <div key={ev.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{ev.name} ({ev.role})</span>
                  <span className="text-muted-foreground">{ev.provisionalAverage ?? 0}%</span>
                </div>
                <div className="w-full bg-surface-muted rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-primary h-4 rounded-full transition-all"
                    style={{ width: `${ev.provisionalAverage ?? 0}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {analytics.evaluators.length === 0 && (
              <p className="text-muted-foreground text-center py-4">لا يوجد مقيّمون متاحون</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* جدول مقارنة أداء المجالات */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-bold mb-4">مقارنة أداء المجالات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="p-2">المجال</th>
                  {analytics.evaluators.map((ev: EvaluatorAnalytics) => (
                    <th key={ev.id} className="p-2 text-center">{ev.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {domains.map((d, i) => (
                  <tr key={d.id} className="border-b">
                    <td className="p-2 font-medium">{d.name}</td>
                    {analytics.evaluators.map((ev: EvaluatorAnalytics) => {
                      const score = evaluatorDomainScores[ev.id]?.[i]?.score ?? 0
                      return (
                        <td key={ev.id} className="p-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            score >= 90 ? 'bg-success/20 text-success' :
                            score >= 75 ? 'bg-primary/20 text-primary' :
                            score >= 50 ? 'bg-warning/20 text-warning' :
                            'bg-danger/20 text-danger'
                          }`}>
                            {score}%
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* جدول تفاصيل التقييمات */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-bold mb-4">تفاصيل التقييمات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="p-2">المقيّم</th>
                  <th className="p-2">الدور</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2">الشواهد المتحققة</th>
                  <th className="p-2">النسبة</th>
                  <th className="p-2">المستوى</th>
                  <th className="p-2">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {analytics.assessments.map((a: AssessmentScore) => (
                  <tr key={a.id} className="border-b hover:bg-surface-muted/50">
                    <td className="p-2 font-medium">{a.evaluatorName}</td>
                    <td className="p-2 text-muted-foreground">{a.evaluatorRole}</td>
                    <td className="p-2">
                      <Badge variant={a.status === "COMPLETED" ? "success" : "warning"}>
                        {a.status === "COMPLETED" ? "مكتمل" : "جاري"}
                      </Badge>
                    </td>
                    <td className="p-2 text-muted-foreground numeric">{a.verifiedCount}/{a.totalEvidence}</td>
                    <td className="p-2 font-bold numeric">{a.score}%</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        a.score >= 90 ? 'bg-success/20 text-success' :
                        a.score >= 75 ? 'bg-primary/20 text-primary' :
                        a.score >= 50 ? 'bg-warning/20 text-warning' :
                        'bg-danger/20 text-danger'
                      }`}>
                        {getPerformanceBand(a.score)}
                      </span>
                    </td>
                    <td className="p-2">
                      <Link href={`/quality/assessments/${a.id}/results`}>
                        <Button variant="ghost" size="sm">عرض</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* الرؤى والتحليلات */}
      <Card>
        <CardContent className="p-6">
          <h3 className="font-bold mb-4">رؤى وتحليلات</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            {analytics.assessments.length === 0 && <p>لا توجد بيانات كافية لإنشاء رؤى.</p>}
            {analytics.assessments.length > 0 && (
              <>
                <p>• الأداء الإجمالي المؤقت للفرع هو {analytics.provisionalPercentage}% بناءً على {analytics.eligibleAssessments} تقييم مؤهل.</p>
                {analytics.inProgressAssessments > 0 && (
                  <p>• يوجد {analytics.inProgressAssessments} تقييم قيد التنفيذ، وقد تتغير النتائج النهائية عند اكتمالها.</p>
                )}
                {analytics.evaluators.length > 1 && (
                  <p>• تم مقارنة أداء {analytics.evaluators.length} مقيّمين في هذا الفرع.</p>
                )}
                {analytics.finalPercentage !== null && analytics.provisionalPercentage !== null && analytics.finalPercentage !== analytics.provisionalPercentage && (
                  <p>• متوسط التقييمات المكتملة ({analytics.finalPercentage}%) يختلف عن الأداء الإجمالي المؤقت ({analytics.provisionalPercentage}%) بسبب وجود تقييمات جارية.</p>
                )}
                <p>• تم استبعاد {analytics.excludedAssessments} تقييم (مسودات، أو مراجعات خاصة لا تدخل في المعدل).</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}