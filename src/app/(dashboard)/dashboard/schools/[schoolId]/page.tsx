// ===== FILE: src/app/(dashboard)/dashboard/schools/[schoolId]/page.tsx =====
// ============================================================
// /dashboard/schools/[schoolId] — تفاصيل مدرسة («شاهد المزيد» — مدير النظام)
// ============================================================
// صفحة رقابة قراءة فقط لمدير النظام: بطاقة التقويم الرسمية (الأداء العام
// للمدرسة + لوحات المراحل) فوق المنهجية الرسمية المختبَرة نفسها المستخدمة
// في تقارير المدرسة (WeightedEvaluationSection ← getWeightedCardData)،
// وشريط تغطية الشواهد مفصول بوضوح عن الدرجة المرجحة، وقائمة أحدث
// التقييمات. لا يوجد هنا أي تعديل أو كتابة.
//
// الفصل المحاسبي المعلن على الصفحة:
//   - الدرجة المرجحة الرسمية = بطاقة التقويم (الأوزان 20/30/40/10 مرة واحدة)
//   - تغطية الشواهد = اتحاد المميز المتحقق ÷ إجمالي البنك — مؤشر اعتماد
//     أدلة مستقل لا يدخل في الدرجة ولا يُستبدل بها.
// ============================================================

import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Building2, ClipboardCheck, MapPin, School } from "lucide-react"
import { getCurrentUser } from "@/lib/permissions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { WeightedEvaluationSection } from "@/components/reports/WeightedEvaluationSection"
import { getSuperAdminSchoolDetail } from "@/features/quality-reports/services/school-overview.server"
import { getStageLabel } from "@/lib/stages"
import { formatDate } from "@/lib/utils"

function schoolStatusBadge(status: string) {
  if (status === "ACTIVE") return <Badge variant="success" dot>نشطة</Badge>
  if (status === "PENDING") return <Badge variant="warning">قيد التفعيل</Badge>
  if (status === "SUSPENDED") return <Badge variant="danger">موقوفة</Badge>
  return <Badge variant="danger">منتهية</Badge>
}

export default async function SchoolDetailPage({ params }: { params: { schoolId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard")

  const detail = await getSuperAdminSchoolDetail(params.schoolId)

  if (!detail) {
    // الحراسة مرّت (مدير النظام) والحمولة فارغة = المدرسة غير موجودة —
    // حالة غير متاحة بهدوء بدل شاشة خطأ (لا اختراع بيانات)
    return (
      <div className="space-y-6">
        <EmptyState
          icon={<School className="w-10 h-10 text-muted-foreground" />}
          title="المدرسة غير متاحة"
          description="لم يتم العثور على المدرسة المطلوبة."
          compact
          className="py-12"
        />
        <div className="flex justify-center">
          <Link href="/dashboard/schools">
            <Button variant="outline" size="sm">العودة إلى جميع المدارس</Button>
          </Link>
        </div>
      </div>
    )
  }

  const { school, summary, assessments } = detail
  const metaChips = [
    { icon: <MapPin className="h-3.5 w-3.5" />, text: [school.city, school.governorate].filter(Boolean).join(" — ") || school.location },
    { icon: <ClipboardCheck className="h-3.5 w-3.5" />, text: getStageLabel(school.educationalStage) },
    { icon: <Building2 className="h-3.5 w-3.5" />, text: `الفروع: ${detail.branchCount}` },
  ].filter(chip => chip.text)

  return (
    <div className="space-y-6">
      {/* الترويسة: الشعار + الاسم + الحالة + رابط العودة */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {school.logoUrl ? (
            // <img> عمدًا — رابط شعار خارجي (نفس قرار بطاقة اللوحة)
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logoUrl} alt={school.name} className="h-14 w-14 shrink-0 rounded-xl border border-border bg-white object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface-muted text-muted-foreground" aria-hidden="true">
              <School className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{school.name}</h1>
              {schoolStatusBadge(school.status)}
            </div>
            {school.nameEn && <p className="truncate text-[12px] text-muted-foreground" dir="ltr">{school.nameEn}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              {metaChips.map((chip, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {chip.icon}
                  {chip.text}
                </span>
              ))}
            </div>
          </div>
        </div>
        <Link
          href="/dashboard/schools"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-secondary hover:underline"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          العودة إلى جميع المدارس
        </Link>
      </div>

      {/* بطاقة التقويم الرسمية + لوحات المراحل — نفس المكوّن المستخدم في تقارير المدرسة */}
      <WeightedEvaluationSection scope={{ schoolId: school.id }} />

      {/* تغطية الشواهد — مؤشر مستقل معلن الفصل عن الدرجة المرجحة */}
      <Card>
        <CardHeader><CardTitle>تغطية الشواهد</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium">الشواهد المميزة المتحققة عبر التقييمات المكتملة</span>
            <span className="text-xl font-bold numeric text-foreground-strong">
              {summary.evidenceCoverage !== null ? `${summary.evidenceCoverage}%` : "—"}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            هذا المؤشر يقيس اعتماد الأدلة (اتحاد الشواهد المميزة المتحققة ÷ إجمالي بنك الشواهد الثابت)
            وهو مستقل عن الدرجة المرجحة الرسمية أعلاه ولا يدخل في حسابها ولا يُستبدل بها.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground numeric">
            <span>تقييمات مكتملة: {summary.completedCount}</span>
            <span>تقييمات جارية: {summary.inProgressCount}</span>
            {summary.skippedAssessments > 0 && <span>استُبعد من المتوسط: {summary.skippedAssessments}</span>}
            {summary.latestCompletedAt && <span>آخر إتمام: {formatDate(summary.latestCompletedAt)}</span>}
          </div>
        </CardContent>
      </Card>

      {/* أحدث التقييمات — قراءة فقط، وروابط نتائج مسموح بها لمدير النظام */}
      <Card>
        <CardHeader><CardTitle>أحدث التقييمات</CardTitle></CardHeader>
        <CardContent className="p-0">
          {assessments.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">لا توجد تقييمات لهذه المدرسة بعد.</div>
          ) : (
            <div className="divide-y divide-border">
              {assessments.map(a => (
                <Link
                  href={`/quality/assessments/${a.id}/results`}
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {a.branchName || "كامل المدرسة"}
                      {a.stage ? <span className="mr-2 text-[11px] text-muted-foreground">({getStageLabel(a.stage)})</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">المقيّم: {a.assessorName || "غير محدد"}</p>
                  </div>
                  <div className="text-left">
                    {/* نفس عارض حالة التقييمات القائم في quality/page.tsx حرفيًا */}
                    <Badge variant={a.status === "COMPLETED" ? "success" : a.status === "IN_PROGRESS" ? "warning" : "neutral"}>
                      {a.status === "COMPLETED" ? "مكتمل" : a.status === "IN_PROGRESS" ? "جارٍ" : "لم يبدأ"}
                    </Badge>
                    <p className="mt-1 text-xs text-muted-foreground numeric">{formatDate(a.startedAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}