// ===== FILE: src/features/quality-reports/services/report-filters.ts ===== (★ جديد)
// ============================================================
// فلترات سجل التقارير — وحدة نقية (بلا prisma) قابلة للاختبار آليًا
// ============================================================
// تُستخدم في صفحة /reports وتقرير الطباعة كي تُطابق قائمة التقارير
// المفلترة التقرير المطبوع والبطاقة (§3 + §5 من مواصفة الإصلاح).
//
// قواعد صارمة:
//  - الفلاتر تُدمج AND مع نطاق الدور الذي يُشتق من المستخدم الموثق على
//    الخادم — لا يوسع أي فلتر النطاق أبدًا (§4).
//  - القيم غير المعروفة/التالفة تُتجاهل بصمت (لا ترمي) حتى لا يكسر رابط
//    مضروب الصفحة — نفس فلسفة resolveStageFilter.
//  - لا اختراع قيم: سجل بلا مرحلة/عام يُطابق فقط بفلتر صريح «غير محدد».
// ============================================================

import { resolveStageFilter, stageFilterToParam, type StageFilterValue } from "@/lib/stages"
import {
  resolveAcademicYearFilter,
  academicYearFilterToParam,
  type AcademicYearFilterValue,
} from "@/lib/academic-year"

export type AssessmentStatusFilter = "COMPLETED" | "IN_PROGRESS" | "ALL"

export interface ReportFilterValues {
  /** undefined = كل المراحل / null = السجلات التاريخية غير المحددة / قيمة = مرحلة */
  stage?: StageFilterValue
  /** خيار مدير النظام فقط عمليًا — للأدوار الأخرى يظل النطاق مقيّدًا بمدرستهم (AND لا يوسّع) */
  schoolId?: string
  assessorId?: string
  /** undefined = كل الأعوام / null = سجلات بلا عام (للمراجعة) / نص = معرّف العام */
  academicYearId?: AcademicYearFilterValue
  /** من تاريخ (شامل — بداية اليوم بتوقيت UTC) */
  from?: Date
  /** إلى تاريخ (شامل — يُطبق كـ «أقل من بداية اليوم التالي») */
  to?: Date
  status?: AssessmentStatusFilter
}

function firstParam(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

/** yyyy-mm-dd → بداية اليوم ونهايته الحصرية بتوقيت UTC (متسق مع تخزين startedAt بتوقيت UTC) */
function parseIsoDay(v: string | undefined): { start: Date; next: Date } | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const [y, m, d] = v.split("-").map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const start = new Date(Date.UTC(y, m - 1, d))
  if (isNaN(start.getTime())) return null
  return { start, next: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
}

/** تحليل معاملات الرابط إلى قيم فلاتر آمنة — القيم غير الصالحة تُتجاهل */
export function resolveReportFilters(
  sp: Record<string, string | string[] | undefined>
): ReportFilterValues {
  const filters: ReportFilterValues = {}

  const stage = resolveStageFilter(sp.stage)
  if (stage !== undefined) filters.stage = stage

  const schoolId = firstParam(sp.schoolId)
  if (schoolId) filters.schoolId = schoolId

  const assessorId = firstParam(sp.assessorId)
  if (assessorId) filters.assessorId = assessorId

  const year = resolveAcademicYearFilter(sp.year)
  if (year !== undefined) filters.academicYearId = year

  const from = parseIsoDay(firstParam(sp.from))
  if (from) filters.from = from.start
  const to = parseIsoDay(firstParam(sp.to))
  if (to) filters.to = to.next // شامل يوم «إلى»

  const status = firstParam(sp.status)
  if (status === "COMPLETED" || status === "IN_PROGRESS" || status === "ALL") {
    filters.status = status
  }

  return filters
}

/**
 * جزء Where الخاص بالفلاتر (كائنات عادية بنفس شكل أجزاء Prisma Where —
 * تُنشر داخل استعلام الخادم المقيّد بنطاق الدور). حالة التقييم تُدار
 * بالخارج حسب الافتراض لكل دور (COMPLETED غالبًا) فلا تُولَّد هنا.
 */
export interface ReportFilterWhere {
  stage?: StageFilterValue
  schoolId?: string
  assessorId?: string
  academicYearId?: string | null
  startedAt?: { gte?: Date; lt?: Date }
}

export function buildReportFilterWhere(filters: ReportFilterValues): ReportFilterWhere {
  const where: ReportFilterWhere = {}
  if (filters.stage !== undefined) where.stage = filters.stage
  if (filters.schoolId) where.schoolId = filters.schoolId
  if (filters.assessorId) where.assessorId = filters.assessorId
  if (filters.academicYearId !== undefined) where.academicYearId = filters.academicYearId
  if (filters.from || filters.to) {
    where.startedAt = {}
    if (filters.from) where.startedAt.gte = filters.from
    if (filters.to) where.startedAt.lt = filters.to
  }
  return where
}

/** معاملات الرابط المكافئة — لروابط الطباعة والمشاركة (بدون status: يُدار لكل دور) */
export function reportFiltersToParams(filters: ReportFilterValues): Record<string, string> {
  const out: Record<string, string> = {}
  if (filters.stage !== undefined) {
    const p = stageFilterToParam(filters.stage)
    if (p) out.stage = p
  }
  if (filters.schoolId) out.schoolId = filters.schoolId
  if (filters.assessorId) out.assessorId = filters.assessorId
  if (filters.academicYearId !== undefined) {
    const p = academicYearFilterToParam(filters.academicYearId)
    if (p) out.year = p
  }
  if (filters.from) out.from = filters.from.toISOString().slice(0, 10)
  if (filters.to) out.to = new Date(filters.to.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return out
}

/** سلسلة استعلام جاهزة للإلحاق بروابط الطباعة (فارغة إن لا فلاتر) */
export function reportFiltersToQueryString(filters: ReportFilterValues): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(reportFiltersToParams(filters))) params.set(k, v)
  return params.toString()
}