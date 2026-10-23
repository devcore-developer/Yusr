// ===== FILE: src/components/reports/EvaluationCard.tsx =====
// ============================================================
// EvaluationCard — «بطاقة التقويم المدرسي / الأداء العام للمدرسة»
// ============================================================
// Server-safe presentational component (no state, no client hooks).
// Reuses the platform's existing chart components (AnalyticsCharts)
// and renders the CLIENT-SPECIFIED structure:
//   1. Semircular gauge + overall WEIGHTED percentage (one source of truth —
//      the number and the gauge render the same authoritative value).
//   2. Performance classification chip + its official explanatory text.
//   3. Four-domain comparison chart (existing VerticalBarChart).
//   4. Domain percentages WITH their official weights (20/30/40/10) —
//      weights are clearly separated from achieved scores.
//   5. Legend of the four performance levels with thresholds + descriptions.
// All numbers arrive already computed by weighted-score.ts — this component
// never recalculates anything (no independent formulas).
// Used inside the print/export report and the on-screen school report.
// ============================================================

import { SemiCircleGauge, VerticalBarChart } from "@/components/charts/AnalyticsCharts"
import { PERFORMANCE_LEVELS, type PerformanceLevel } from "@/features/quality-reports/services/weighted-score"

export interface EvaluationCardDomain {
  name: string
  /** Official weight (0–1) or null for stored domains outside the official weights. */
  weight: number | null
  /** Achieved domain percentage (0–100) or null when no evidence exists. */
  score: number | null
}

function weightLabel(weight: number | null): string {
  return weight === null ? "غير مشمول بالأوزان" : `الوزن: ${Math.round(weight * 100)}%`
}

function ClassificationChip({ level }: { level: PerformanceLevel }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[13px] font-bold"
      style={{ backgroundColor: `${level.color}1A`, color: level.color }}
    >
      {level.label}
    </span>
  )
}

export function EvaluationCard({
  overall,
  classification,
  domainResults,
  notRatedReason,
  title = "الأداء العام للمدرسة",
  subtitle = "بطاقة التقويم المدرسي — النتيجة المرجحة وفق أوزان المجالات الرسمية (20% / 30% / 40% / 10%)",
  showLegend = true,
}: {
  overall: number | null
  classification: PerformanceLevel | null
  domainResults: EvaluationCardDomain[]
  /** Transparent note shown when the weighted result cannot be computed (no fabrication). */
  notRatedReason?: string | null
  title?: string
  subtitle?: string
  showLegend?: boolean
}) {
  const chartData = domainResults.map(d => ({ name: d.name, percentage: d.score }))

  return (
    <section
      className="rounded-xl border border-[#e5e7eb] bg-white p-5 md:p-6"
      style={{ breakInside: "avoid" }}
      dir="rtl"
    >
      <h3
        className="mb-1 text-[17px] font-bold"
        style={{ color: "#073B43", borderRight: "4px solid #2878B8", paddingRight: "10px" }}
      >
        {title}
      </h3>
      <p className="mb-4 pr-3 text-[12px] text-[#64748B]">{subtitle}</p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Gauge + overall weighted result + classification */}
        <div className="flex flex-col items-center rounded-lg border border-[#eef1f6] bg-[#f8fafc] p-4 text-center">
          {overall !== null ? (
            <>
              <SemiCircleGauge percentage={overall} size={150} />
              <div className="mt-1 text-4xl font-bold numeric" style={{ color: "#073B43" }}>
                {overall}%
              </div>
              <p className="mb-2 text-[11px] text-[#64748B]">النسبة المرجحة الكلية</p>
              {classification && (
                <>
                  <ClassificationChip level={classification} />
                  <p className="mt-2 text-[12px] leading-relaxed text-[#475569]">{classification.description}</p>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex h-[110px] items-center text-5xl font-bold text-[#94a3b8]">—</div>
              <div className="mt-1 mb-2 text-2xl font-bold text-[#94a3b8]">غير مقيم</div>
              <span className="inline-flex items-center rounded-full bg-[#f1f5f9] px-3 py-1 text-[13px] font-bold text-[#64748B]">
                لا توجد نتيجة مرجحة
              </span>
              {notRatedReason && (
                <p className="mt-2 text-[12px] leading-relaxed text-[#64748B]">{notRatedReason}</p>
              )}
            </>
          )}
        </div>

        {/* Domain comparison chart + weights */}
        <div className="min-w-0">
          {domainResults.length > 0 && (
            <div style={{ height: "220px", width: "100%" }}>
              <VerticalBarChart data={chartData} />
            </div>
          )}
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {domainResults.map(d => (
              <li
                key={d.name}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#eef1f6] bg-white px-3 py-2"
              >
                <span className="min-w-0 truncate text-[13px] font-medium text-[#172B36]">{d.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[13px] font-bold numeric" style={{ color: "#073B43" }}>
                    {d.score !== null ? `${d.score}%` : "—"}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={
                      d.weight !== null
                        ? { backgroundColor: "#2878B81A", color: "#2878B8" }
                        : { backgroundColor: "#f1f5f9", color: "#64748B" }
                    }
                  >
                    {weightLabel(d.weight)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Performance levels legend — client-supplied thresholds & descriptions */}
      {showLegend && (
        <div className="mt-5 rounded-lg border border-[#eef1f6] bg-[#f8fafc] p-4">
          <p className="mb-3 text-[13px] font-bold" style={{ color: "#073B43" }}>
            مستويات الأداء
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PERFORMANCE_LEVELS.map(level => (
              <div key={level.key} className="rounded-md bg-white p-3" style={{ borderInlineStart: `3px solid ${level.color}` }}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: level.color }} />
                  <span className="text-[13px] font-bold" style={{ color: level.color }}>
                    {level.label}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-[#475569]">{level.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}