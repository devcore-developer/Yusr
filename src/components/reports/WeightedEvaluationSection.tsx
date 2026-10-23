// ===== FILE: src/components/reports/WeightedEvaluationSection.tsx =====
// ============================================================
// WeightedEvaluationSection — additive on-screen evaluation card
// ============================================================
// Async server component inserted ABOVE the existing report content in the
// School Manager and Branch Manager views of /reports. It renders:
//   1. The evaluation card (الأداء العام للمدرسة) — weighted overall,
//      gauge, classification, domain comparison + weights, levels legend.
//   2. Stage panels — one card per educational stage that actually exists
//      in scope (no empty panels, no averaging across stages, historical
//      records without a stage are shown transparently as «غير محددة»).
//   3. A link to the full print report (بطاقة التقويم المدرسي).
// ALL existing page content below this section is untouched.
// The loader enforces tenant isolation server-side; it returns null for
// unauthorized callers and the section renders nothing (existing layout kept).
// ============================================================

import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { SemiCircleGauge } from "@/components/charts/AnalyticsCharts"
import { EvaluationCard } from "@/components/reports/EvaluationCard"
import { getWeightedCardData, type WeightedCardScope } from "@/features/quality-reports/services/weighted-report.server"
import type { StageFilterValue } from "@/lib/stages"

function buildNotRatedReason(diagnostics: {
  unmatchedConfigs: string[]
  missingDataDomains: string[]
  extraDomains: string[]
}): string | null {
  if (diagnostics.unmatchedConfigs.length > 0) {
    return "تعذّرت مطابقة أسماء بعض المجالات المخزّنة مع المجالات الرسمية للأوزان، لذلك لم تُحتسب نتيجة مرجحة (لا تخمين)."
  }
  if (diagnostics.missingDataDomains.length > 0) {
    return "لا توجد شواهد معرّفة لبعض المجالات في إطار التقويم الرسمي، لذلك لم تُحتسب نتيجة مرجحة."
  }
  return null
}

export async function WeightedEvaluationSection({
  scope,
  stageFilter,
  printHref,
}: {
  scope: WeightedCardScope
  stageFilter?: StageFilterValue
  printHref?: string
}) {
  const data = await getWeightedCardData(scope, stageFilter)
  if (!data) return null

  return (
    <div className="space-y-6">
      <EvaluationCard
        overall={data.overall}
        classification={data.classification}
        domainResults={data.domains}
        notRatedReason={buildNotRatedReason(data.diagnostics)}
      />

      {/* Stage panels — only stages that exist in scope (§5: dynamic, no empty panels) */}
      {data.stagePanels.length > 0 && (
        <section>
          <h3 className="mb-3 text-[15px] font-bold text-foreground-strong">الأداء حسب المرحلة التعليمية</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 min-w-0">
            {data.stagePanels.map(panel => (
              <Card key={panel.stageLabel} className="p-5 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-foreground-strong">{panel.stageLabel}</p>
                    <p className="text-[11px] text-muted-foreground numeric">
                      بناءً على {panel.assessments} تقييم مكتمل
                      {panel.skipped > 0 ? ` • ${panel.skipped} بلا نتيجة مرجحة` : ""}
                    </p>
                  </div>
                  {panel.overall !== null ? (
                    <SemiCircleGauge percentage={panel.overall} size={80} />
                  ) : (
                    <div className="flex h-[54px] w-[80px] items-center justify-center text-2xl font-bold text-muted-foreground">—</div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xl font-bold numeric">{panel.overall !== null ? `${panel.overall}%` : "غير مقيم"}</span>
                  {panel.classification ? (
                    <span
                      className="rounded-full px-3 py-1 text-[12px] font-bold"
                      style={{ backgroundColor: `${panel.classification.color}1A`, color: panel.classification.color }}
                    >
                      {panel.classification.label}
                    </span>
                  ) : (
                    <Badge variant="neutral">غير مقيم</Badge>
                  )}
                </div>
                {panel.classification && (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{panel.classification.description}</p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {printHref && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-bold">بطاقة التقويم المدرسي الكاملة</h3>
              <p className="text-[12px] text-muted-foreground">
                التقرير الرسمي المفصل: الأداء العام، الرسوم حسب المعايير، والجداول التفصيلية القابلة للطباعة.
              </p>
            </div>
            <Link href={printHref}>
              <Button variant="outline" size="sm">
                فتح بطاقة التقويم المدرسي
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}