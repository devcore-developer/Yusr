// ===== FILE: src/components/reports/SurveyComparisonTable.tsx =====
// ============================================================
// SurveyComparisonTable — جدول «مقارنة نتائج البنود مع الاستبانات»
// مكوّن عرض فقط (Server Component): كل الأرقام والنصوص من survey-integration.ts
// (مصدر واحد للحقيقة) — لا يحسب شيئًا بنفسه ولا يستقبل أرقامًا من العميل.
// نسختان بنفس البيانات والنصوص حرفيًا: screen (تنسيق المنصة) و print (أنماط التقرير).
// ============================================================

import {
  combinedStatusLabel,
  SURVEY_INTEGRATION_METHOD_LABEL,
  type ItemComparisonRow,
  type ItemComparisonDiagnostics,
} from "@/features/quality-reports/services/survey-integration"

export interface SurveyComparisonTableProps {
  rows: ItemComparisonRow[]
  diagnostics: ItemComparisonDiagnostics
  variant: "screen" | "print"
}

const SCORE_UNAVAILABLE = "—"

function respondentsDisplay(row: ItemComparisonRow): string {
  if (row.totalRespondents === null) return "غير مسجل"
  const base = `${row.totalRespondents}`
  return row.respondentsPartial ? `${base} + غير محدد (بعض السجلات بلا عدد)` : base
}

export function SurveyComparisonTable({ rows, diagnostics, variant }: SurveyComparisonTableProps) {
  if (rows.length === 0) return null

  const invalidConfigNotice = diagnostics.invalidConfig
    ? "⚠ إعداد الدمج المخزن لهذه المدرسة لا يجتاز التحقق (المجموع يجب أن يساوي 100%) — تُعرض النتيجتان المنفصلتان فقط حتى يُعتمد إعداد صالح."
    : null

  if (variant === "print") {
    return (
      <div style={{ marginBottom: "28px", breakInside: "avoid" }}>
        <h4 style={{ fontSize: "15px", fontWeight: "bold", color: "#073B43", marginBottom: "6px", borderRight: "3px solid #2878B8", paddingRight: "8px" }}>
          مقارنة نتائج البنود المرتبطة باستبانات مع نتائج التقييم المباشر
        </h4>
        <p style={{ fontSize: "11px", color: "#64748B", marginBottom: "10px", lineHeight: 1.7 }}>
          قسم مكمّل للعرض والمقارنة فقط — لا يغيّر النتائج الرسمية أعلاه ولا يدخل في أوزان المجالات
          (الإدارة 20%، التعليم والتعلم 30%، نواتج التعلم 40%، البيئة المدرسية 10%) ولا في الدرجة النهائية للمدرسة.
          الربط المعتمد للأرقام = الرابط الصريح بمعرّف البند (لا مطابقة نصية).
        </p>
        {invalidConfigNotice && (
          <p style={{ fontSize: "11px", color: "#C62828", marginBottom: "8px", fontWeight: 600 }}>{invalidConfigNotice}</p>
        )}
        <table>
          <thead>
            <tr>
              <th style={{ width: "17%" }}>البند</th>
              <th style={{ width: "13%" }}>نتيجة التقييم بالأدوات</th>
              <th style={{ width: "13%" }}>نتيجة الاستبانة</th>
              <th style={{ width: "13%" }}>عدد الاستجابات المسجل</th>
              <th style={{ width: "18%" }}>النتيجة المدمجة (غير رسمية)</th>
              <th style={{ width: "26%" }}>الأوزان / حالة الإعداد وسجل التدقيق</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.indicatorId}>
                <td>
                  <span style={{ fontFamily: "monospace", color: "#079FDF" }}>{row.indicatorCode}</span>
                  {" — "}
                  {row.indicatorDescription}
                  {row.domainName && <span style={{ fontSize: "10px", color: "#64748B" }}> ({row.domainName})</span>}
                  {row.usableSurveyCount > 0 && (
                    <span style={{ fontSize: "10px", color: "#64748B" }}>
                      {" "}• {row.surveys.length} استبانة مرتبطة، {row.usableSurveyCount} منها تُحتسب
                    </span>
                  )}
                </td>
                <td style={{ textAlign: "center", fontWeight: "bold" }}>
                  {row.directScore !== null ? `${row.directScore}%` : SCORE_UNAVAILABLE}
                </td>
                <td style={{ textAlign: "center", fontWeight: "bold" }}>
                  {row.surveyScore !== null ? `${row.surveyScore}%` : SCORE_UNAVAILABLE}
                </td>
                <td style={{ textAlign: "center" }}>{respondentsDisplay(row)}</td>
                <td style={{ textAlign: "center", fontWeight: "bold" }}>
                  {row.combined !== null ? `${row.combined}%` : SCORE_UNAVAILABLE}
                  <div style={{ fontSize: "10px", fontWeight: "normal", color: "#64748B", marginTop: "2px" }}>
                    {combinedStatusLabel(row.combinedStatus)}
                  </div>
                </td>
                <td style={{ fontSize: "11px" }}>
                  {row.weightsLabel ?? "—"}
                  {row.auditNote && <div style={{ color: "#64748B", marginTop: "2px" }}>{row.auditNote}</div>}
                  {row.surveys.some(s => !s.used) && (
                    <div style={{ color: "#64748B", marginTop: "2px" }}>
                      مستبعدة من الاحتساب: {row.surveys.filter(s => !s.used).map(s => `${s.type} (${s.reason})`).join("؛ ")}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ===== نسخة الشاشة =====
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <h3 className="text-base font-bold text-foreground-strong">مقارنة نتائج البنود مع الاستبانات</h3>
      </div>
      <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">
        قسم مكمّل للعرض والمقارنة فقط — لا يغيّر نتيجة التقييم الرسمية ولا يدخل في أوزان المجالات
        (20%/30%/40%/10%) ولا في الدرجة النهائية. الربط المعتمد للأرقام = الرابط الصريح بمعرّف البند (لا مطابقة نصية)،
        وكل استبانة تُحتسب مرة واحدة لكل بند.
      </p>
      {invalidConfigNotice && (
        <div className="mb-3 p-3 rounded-lg bg-danger/5 border border-danger/20 text-[12px] text-danger font-medium">
          {invalidConfigNotice}
        </div>
      )}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-[13px] border-collapse min-w-[760px]">
          <thead>
            <tr className="text-right text-muted-foreground">
              <th className="p-2 border-b border-border font-medium align-bottom">البند</th>
              <th className="p-2 border-b border-border font-medium align-bottom text-center">نتيجة التقييم بالأدوات</th>
              <th className="p-2 border-b border-border font-medium align-bottom text-center">نتيجة الاستبانة</th>
              <th className="p-2 border-b border-border font-medium align-bottom text-center">عدد الاستجابات المسجل</th>
              <th className="p-2 border-b border-border font-medium align-bottom text-center">النتيجة المدمجة (غير رسمية)</th>
              <th className="p-2 border-b border-border font-medium align-bottom">الأوزان / الإعداد</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.indicatorId} className="align-top hover:bg-surface-muted/40 transition-smooth">
                <td className="p-2 border-b border-border/70 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-[12px] text-secondary numeric">{row.indicatorCode}</span>
                    {row.domainName && <span className="text-[11px] text-muted-foreground">{row.domainName}</span>}
                  </div>
                  <p className="text-foreground-strong leading-relaxed">{row.indicatorDescription}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {row.surveys.length} استبانة مرتبطة، {row.usableSurveyCount} منها تُحتسب
                  </p>
                  {row.surveys.some(s => !s.used) && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      مستبعدة من الاحتساب: {row.surveys.filter(s => !s.used).map(s => `${s.type} (${s.reason})`).join("؛ ")}
                    </p>
                  )}
                </td>
                <td className="p-2 border-b border-border/70 text-center">
                  <span className="font-bold numeric text-foreground-strong">
                    {row.directScore !== null ? `${row.directScore}%` : SCORE_UNAVAILABLE}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {row.directScore !== null ? `${row.verifiedResponsesCount} / ${row.requiredEvidence} شاهد` : "لا شواهد معرّفة"}
                  </p>
                </td>
                <td className="p-2 border-b border-border/70 text-center">
                  <span className="font-bold numeric text-foreground-strong">
                    {row.surveyScore !== null ? `${row.surveyScore}%` : SCORE_UNAVAILABLE}
                  </span>
                </td>
                <td className="p-2 border-b border-border/70 text-center text-muted-foreground">
                  {respondentsDisplay(row)}
                </td>
                <td className="p-2 border-b border-border/70 text-center">
                  <span className="font-bold numeric text-foreground-strong">
                    {row.combined !== null ? `${row.combined}%` : SCORE_UNAVAILABLE}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                    {combinedStatusLabel(row.combinedStatus)}
                  </p>
                </td>
                <td className="p-2 border-b border-border/70 text-[11px] text-muted-foreground min-w-0">
                  <p className="text-foreground-strong">{row.weightsLabel ?? "—"}</p>
                  {row.auditNote && <p className="mt-1 leading-relaxed">{row.auditNote}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}