// ===== FILE: src/app/(dashboard)/dashboard/schools/page.tsx =====
// ============================================================
// /dashboard/schools — «عرض جميع المدارس» (مدير النظام فقط)
// ============================================================
// الشبكة الكاملة لبطاقات ملخص المدارس بنفس مصدر الحساب وترتيب اللوحة
// الرئيسية (sortSchoolSummaries «ar») — بلا رسوم منصة ضخمة وبلا تكرار:
// الحساب كله في school-overview.server.ts والعرض في SchoolOverviewCard.
// الحراسة: غير مدير النظام يُحوَّل بهدوء إلى /dashboard (نمط quality/page.tsx).
// ============================================================

import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowRight, Users } from "lucide-react"
import { getCurrentUser } from "@/lib/permissions"
import { EmptyState } from "@/components/ui/EmptyState"
import { SchoolOverviewCard } from "@/components/dashboard/SchoolOverviewCard"
import { getSchoolsOverview } from "@/features/quality-reports/services/school-overview.server"

export default async function AllSchoolsOverviewPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard")

  const data = await getSchoolsOverview()
  if (!data) redirect("/dashboard")

  const { schools } = data

  return (
    <div className="space-y-6">
      {/* الترويسة + رابط العودة إلى اللوحة */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">جميع المدارس</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            الملخص الكامل لكل مدرسة وفق الدرجة المرجحة الرسمية — أوزان المجالات (20% / 30% / 40% / 10%)،
            وأشرطة المجالات قبل الأوزان.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-secondary hover:underline"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          العودة إلى اللوحة
        </Link>
      </div>

      {schools.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10 text-muted-foreground" />}
          title="لا توجد مدارس مسجلة بعد"
          description="ستظهر بطاقات المدارس هنا فور تسجيل أول مدرسة."
          compact
          className="py-12"
        />
      ) : (
        <>
          <p className="text-[12px] text-muted-foreground numeric">
            عدد المدارس: {schools.length}
            {data.kpis.completedAssessments > 0 ? ` • التقييمات المكتملة: ${data.kpis.completedAssessments}` : ""}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 min-w-0">
            {schools.map(summary => (
              <SchoolOverviewCard key={summary.schoolId} summary={summary} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}