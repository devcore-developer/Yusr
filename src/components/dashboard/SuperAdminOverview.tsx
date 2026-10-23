// ===== FILE: src/components/dashboard/SuperAdminOverview.tsx =====
// ============================================================
// SuperAdminOverview — جسم لوحة مدير النظام الجديدة (نظرة عامة على المدارس)
// ============================================================
// مكوّن خادمي مكتفٍ ذاتيًا يُركَّب داخل صفحة /dashboard الحالية بفرع
// مدير النظام فقط (انظر تعليمات التركيب أسفل رسالة التسليم) — بقية أدوار
// الصفحة الأصلية لا تُلمس إطلاقًا.
//
// ما يعرضه:
//   1) صف مؤشرات مختصرة (مدارس / فروع / تقييمات نشطة / تقييمات مكتملة)
//   2) شبكة بطاقات ملخص المدارس (شعار + الدرجة المرجحة الرسمية + أشرطة
//      المجالات الأربعة قبل الأوزان + حالة التقييم + «شاهد المزيد»)
//   3) زر «عرض جميع المدارس» عند تجاوز العدد مجموعة اللوحة الابتدائية
//
// كل النسب تصل جاهزة من school-overview.server.ts (حساب واحد مُختبَر فوق
// weighted-score.ts) — لا يوجد هنا أي حساب نسب، وأي رقم لا يملك مقامًا
// موثوقًا يُعرض «غير مقيم» لا صفرًا مصنوعًا.
// ============================================================

import { redirect } from "next/navigation"
import Link from "next/link"
import { Building2, CheckCircle, ClipboardCheck, School, Users } from "lucide-react"
import { getCurrentUser } from "@/lib/permissions"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { Button } from "@/components/ui/Button"
import { SchoolOverviewCard } from "@/components/dashboard/SchoolOverviewCard"
import { getSchoolsOverview } from "@/features/quality-reports/services/school-overview.server"
import { selectDashboardSubset } from "@/features/quality-reports/services/school-overview"

export async function SuperAdminOverview() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (user.role !== "SUPER_ADMIN") redirect("/dashboard")

  const data = await getSchoolsOverview()
  if (!data) redirect("/dashboard")

  const { kpis, schools } = data
  const visibleSchools = selectDashboardSubset(schools)
  const hiddenCount = schools.length - visibleSchools.length

  return (
    <div className="space-y-6">
      {/* الترويسة */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">نظرة عامة على المدارس</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ملخص أداء كل مدرسة وفق الدرجة المرجحة الرسمية — أوزان المجالات (20% / 30% / 40% / 10%) مطبقة مرة واحدة،
          وأشرطة المجالات تعرض درجات المجالات المستقلة قبل الأوزان.
        </p>
      </div>

      {/* مؤشرات مختصرة — نفس دلالات المنصة القائمة، بلا بطاقات مكررة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="إجمالي المدارس" value={kpis.totalSchools} icon={<School className="w-4 h-4" />} />
        <MetricCard title="إجمالي الفروع" value={kpis.totalBranches} icon={<Building2 className="w-4 h-4" />} />
        <MetricCard title="تقييمات نشطة" value={kpis.activeAssessments} icon={<ClipboardCheck className="w-4 h-4" />} />
        <MetricCard title="تقييمات مكتملة" value={kpis.completedAssessments} icon={<CheckCircle className="w-4 h-4" />} />
      </div>

      {/* شبكة بطاقات المدارس */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-foreground-strong">أداء المدارس</h2>
          {schools.length > 0 && (
            <span className="text-[12px] text-muted-foreground numeric">
              {schools.length > visibleSchools.length
                ? `يُعرض ${visibleSchools.length} من ${schools.length} مدرسة`
                : `${schools.length} مدرسة`}
            </span>
          )}
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 min-w-0">
              {visibleSchools.map(summary => (
                <SchoolOverviewCard key={summary.schoolId} summary={summary} />
              ))}
            </div>
            {hiddenCount > 0 && (
              <div className="flex justify-center pt-2">
                <Link href="/dashboard/schools">
                  <Button variant="outline" size="sm">
                    عرض جميع المدارس ({schools.length})
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}