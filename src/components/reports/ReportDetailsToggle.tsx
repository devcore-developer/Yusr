// ===== FILE: src/components/reports/ReportDetailsToggle.tsx =====
"use client"

// ============================================================
// Report Details Toggle — «عرض التفاصيل / إخفاء التفاصيل»
// ============================================================
// Purely additive wrapper around the EXISTING detailed tables:
//  - Default collapsed on screen → the visual report summary shows first.
//  - Expanded state reveals the existing tables unchanged (children pass-through).
//  - PRINT: the tables are always included in printed/exported output even when
//    collapsed on screen (CSS forces display in @media print), so no information
//    is lost because of the collapsed UI.
//  - The toggle button itself is hidden in print output (.no-print behavior).
//  - Accessible: native <button> (keyboard operable) + aria-expanded state.
// The component holds NO data and NO logic — it only controls visibility.
// ============================================================

import { useState, type ReactNode } from "react"

export function ReportDetailsToggle({
  children,
  summaryLabel = "عرض التفاصيل",
  hideLabel = "إخفاء التفاصيل",
  description,
}: {
  children: ReactNode
  summaryLabel?: string
  hideLabel?: string
  description?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <style>{`
        .report-details-collapsed { display: none; }
        @media print {
          .report-details-toggle-btn { display: none !important; }
          .report-details-collapsed { display: block !important; }
        }
      `}</style>

      <div className="flex flex-wrap items-center gap-3 py-3">
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          className="report-details-toggle-btn inline-flex items-center gap-2 rounded-lg border border-[#2878B8] bg-white px-4 py-2 text-[13px] font-semibold text-[#2878B8] transition-colors hover:bg-[#2878B8]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2878B8]/40"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
          {open ? hideLabel : summaryLabel}
        </button>
        {description && !open && (
          <span className="text-[12px] text-[#64748B]">{description}</span>
        )}
      </div>

      {/* الحفاظ الكامل على الجداول القائمة: نفس المحتوى ونفس الأعمدة — التحكم بالظهور فقط */}
      <div className={open ? "report-details-open" : "report-details-collapsed"}>{children}</div>
    </div>
  )
}