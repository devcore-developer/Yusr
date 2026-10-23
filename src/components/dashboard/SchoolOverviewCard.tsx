// ===== FILE: src/components/dashboard/SchoolOverviewCard.tsx =====
// ============================================================
// SchoolOverviewCard — بطاقة ملخص أداء مدرسة واحدة في لوحة مدير النظام
// ============================================================
// Server-safe presentational component (بلا state ولا hooks — نفس نمط
// EvaluationCard). لا تحسب أي رقم بنفسها إطلاقًا: كل القيم تصل جاهزة من
// school-overview.ts (المنهجية الرسمية المختبَرة) وتُعرض كما هي.
//
//  - الدرجة الكلية = النتيجة المرجحة الرسمية (الأوزان دخل حسابها مرة واحدة
//    داخل computeWeightedOverall) أو «غير مقيم» — لا صفر مصنوع أبدًا.
//  - أشرطة المجالات = درجات المجالات المستقلة قبل الأوزان (0–100) —
//    «حصّة المجال المرجحة» لا تُعرض كنسبة مجال أبدًا (إصلاح 449%/663%…).
//  - مجال بلا بيانات → مسار فارغ و «—» (لا اختراع).
// ============================================================

import Link from "next/link"
import { ArrowLeft, School } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { formatDate } from "@/lib/utils"
import { classifyPerformance } from "@/features/quality-reports/services/weighted-score"
import type { SchoolPerformanceSummary } from "@/features/quality-reports/services/school-overview"

const NO_DATA_COLOR = "#94a3b8"

function SchoolLogo({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  if (logoUrl) {
    return (
      // <img> عمدًا: logoUrl رابط خارجي غير معرف مسبقًا ولا يمكن ضبطه في
      // next/image remotePatterns من هنا — والبطاقة تظهر داخل RTL ثابت
      // (تحذير lint فقط، بلا تأثير تشغيلي)
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className="h-11 w-11 shrink-0 rounded-lg border border-border bg-white object-cover"
      />
    )
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-muted text-muted-foreground" aria-hidden="true">
      <School className="h-5 w-5" />
    </div>
  )
}

function ClassificationChip({ summary }: { summary: SchoolPerformanceSummary }) {
  if (!summary.hasScore || !summary.classification) {
    return <Badge variant="neutral">غير مقيم</Badge>
  }
  const level = summary.classification
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[11px] font-bold"
      style={{ backgroundColor: `${level.color}1A`, color: level.color }}
    >
      {level.label}
    </span>
  )
}

function NotRatedReason({ summary }: { summary: SchoolPerformanceSummary }) {
  if (summary.completedCount === 0) {
    return "لا يوجد تقييم مكتمل بعد — تُعرض الدرجات أول ما يُكمل مقيّم تقييمًا."
  }
  return "توجد تقييمات مكتملة لكن تعذّر احتساب نتيجة مرجحة (بيانات مجالات ناقصة) — لا يُختلع رقم."
}

function OverallScoreBlock({ summary }: { summary: SchoolPerformanceSummary }) {
  if (!summary.hasScore || summary.overallScore === null) {
    return (
      <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl font-bold text-muted-foreground">—</span>
          <span className="text-[12px] font-medium text-muted-foreground">غير مقيم</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          <NotRatedReason summary={summary} />
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-lg border border-border bg-surface-muted px-4 py-3">
      <div>
        <span className="text-2xl font-bold numeric text-foreground-strong">{summary.overallScore}%</span>
        <span className="mr-2 text-[11px] text-muted-foreground">الدرجة المرجحة الكلية</span>
      </div>
      {summary.skippedAssessments > 0 && (
        <span className="text-[10px] text-muted-foreground numeric">
          استُبعد {summary.skippedAssessments} من متوسط النتيجة
        </span>
      )}
    </div>
  )
}

function DomainMiniBars({ summary }: { summary: SchoolPerformanceSummary }) {
  return (
    <div className="space-y-2" role="img" aria-label="أداء المجالات الأربعة قبل الأوزان">
      {summary.domains.map(domain => {
        const color =
          domain.score !== null
            ? classifyPerformance(domain.score)?.color ?? "#2878B8"
            : NO_DATA_COLOR
        return (
          <div key={domain.name} className="flex items-center gap-2">
            <span className="w-[104px] shrink-0 truncate text-[11px] text-muted-foreground" title={domain.name}>
              {domain.name}
            </span>
            <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-muted">
              {domain.score !== null && (
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, domain.score))}%`, backgroundColor: color }}
                />
              )}
            </div>
            <span className="w-[38px] shrink-0 text-left text-[11px] font-medium numeric text-foreground">
              {domain.score !== null ? `${domain.score}%` : "—"}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function SchoolOverviewCard({ summary }: { summary: SchoolPerformanceSummary }) {
  const latestDate = summary.latestCompletedAt ? formatDate(summary.latestCompletedAt) : null
  const abnormalStatus = summary.schoolStatus && summary.schoolStatus !== "ACTIVE"

  return (
    <Card className="flex min-w-0 flex-col p-5">
      {/* الترويسة: الشعار + الاسم + تصنيف الأداء */}
      <div className="flex items-start gap-3">
        <SchoolLogo logoUrl={summary.logoUrl} name={summary.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 truncate text-[14px] font-bold text-foreground-strong" title={summary.name}>
              {summary.name}
            </h3>
            {abnormalStatus && (
              <Badge variant={summary.schoolStatus === "PENDING" ? "warning" : "danger"}>
                {summary.schoolStatus === "PENDING" ? "قيد التفعيل" : summary.schoolStatus === "SUSPENDED" ? "موقوفة" : "منتهية"}
              </Badge>
            )}
          </div>
          {summary.nameEn && (
            <p className="truncate text-[11px] text-muted-foreground" dir="ltr">{summary.nameEn}</p>
          )}
        </div>
        <ClassificationChip summary={summary} />
      </div>

      {/* الدرجة المرجحة الكلية (أو حالة عدم التقييم بشفافية) */}
      <div className="mt-3">
        <OverallScoreBlock summary={summary} />
      </div>

      {/* أشرطة المجالات الأربعة — درجات مستقلة قبل الأوزان */}
      <div className="mt-4">
        <DomainMiniBars summary={summary} />
      </div>

      {/* التذييل: معلومات التقييم + إجراء التفاصيل */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="min-w-0 text-[11px] leading-relaxed text-muted-foreground numeric">
          <span>مكتمل: {summary.completedCount}</span>
          <span className="mx-1">•</span>
          <span>جارٍ: {summary.inProgressCount}</span>
          {latestDate && (
            <>
              <span className="mx-1">•</span>
              <span>آخر إتمام: {latestDate}</span>
            </>
          )}
        </div>
        <Link
          href={`/dashboard/schools/${summary.schoolId}`}
          className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-secondary hover:underline"
        >
          شاهد المزيد
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  )
}