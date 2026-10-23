import { prisma } from "@/lib/prisma"

/**
 * خدمة الربط الموحدة بين الاستبانات ومؤشرات التقييم — المرجع الوحيد لهذا المنطق،
 * تُستخدم في صفحة نتائج التقييم وفي تقرير الطباعة حتى لا يتكرر منطق الحل ولا يزداد العد.
 *
 * قواعد الربط (بلا افتراضات):
 * 1) EXPLICIT   : الاستبانة مخزّن عليها indicatorId صريح (السجلات الجديدة منذ تفعيل الربط) والمؤشر موجود فعلاً.
 * 2) TEXT_MATCH : السجلات القديمة — نص الشاهد المختار (generalResult) يطابق شاهدًا/شواهد تنتمي كلها لمؤشر واحد.
 * 3) AMBIGUOUS  : النص يطابق شواهد تنتمي لأكثر من مؤشر — لا يُفترض أي ربط، وتُعرض بحالتها الصادقة.
 * 4) UNLINKED   : لا يوجد تطابق (نص فارغ، عنصر نائب مثل "نتيجة عامة للاستبانة"، أو مؤشر محذوف).
 *
 * أمان وثبات:
 * - القراءة معزولة بالمدرسة (schoolId) — لا تُعاد إلا استبانات المدرسة نفسها.
 * - خدمة عرض فقط: لا تُدخل نتائج الاستبانات في أي صيغة حساب للتقييم ولا تغيّر النسب القائمة
 *   (لا عدّ مزدوج بطبيعتها — الاستبانات تُعرض ولا تُجمع).
 * - الحقل include يُعرض كحالة كما هو؛ لا توجد قاعدة حساب معرفة في النظام لتجميعه، ولن يُختلع وزن.
 */

export type SurveyLinkageStatus = "EXPLICIT" | "TEXT_MATCH" | "AMBIGUOUS" | "UNLINKED"

export interface LinkedSurvey {
  id: string
  type: string
  percentage: number
  include: boolean
  note: string | null
  generalResult: string | null
  createdAt: Date
  linkageStatus: SurveyLinkageStatus
  indicatorId: string | null
  indicatorCode: string | null
  indicatorDescription: string | null
}

export interface SchoolSurveyLinks {
  /** المؤشرات المرتبطة باستباناتها المحسومة (مرتبة حسب كود المؤشر) */
  byIndicator: {
    indicatorId: string
    indicatorCode: string
    indicatorDescription: string
    surveys: LinkedSurvey[]
  }[]
  /** استبانات غير مرتبطة بمؤشر محدد (UNLINKED أو AMBIGUOUS) */
  unlinked: LinkedSurvey[]
  total: number
}

export async function getSchoolSurveyLinks(schoolId: string | null): Promise<SchoolSurveyLinks> {
  if (!schoolId) return { byIndicator: [], unlinked: [], total: 0 }

  // (0) استبانات المدرسة فقط — عزل tenant صريح على الخادم
  const surveys = await prisma.survey.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
  })
  if (surveys.length === 0) return { byIndicator: [], unlinked: [], total: 0 }

  // (1) الروابط الصريحة المخزنة — تُقبل فقط إن كان المؤشر موجودًا فعلاً في قاعدة البيانات
  const explicitIds = Array.from(
    new Set(surveys.map(s => s.indicatorId).filter((id): id is string => !!id))
  )
  const explicitRows = explicitIds.length
    ? await prisma.indicator.findMany({
        where: { id: { in: explicitIds } },
        select: { id: true, code: true, description: true },
      })
    : []
  const explicitMap = new Map(explicitRows.map(i => [i.id, i]))

  // (2) الحل النصي للسجلات القديمة: نص الشاهد → مجموعة معرفات المؤشرات الممكنة
  const texts = Array.from(
    new Set(surveys.map(s => s.generalResult).filter((t): t is string => !!t && t.trim() !== ""))
  )
  const evidenceRows = texts.length
    ? await prisma.fixedEvidence.findMany({
        where: { text: { in: texts } },
        select: { text: true, indicatorId: true },
      })
    : []
  const textToIndicatorIds = new Map<string, Set<string>>()
  for (const ev of evidenceRows) {
    if (!textToIndicatorIds.has(ev.text)) textToIndicatorIds.set(ev.text, new Set())
    textToIndicatorIds.get(ev.text)!.add(ev.indicatorId)
  }

  // (3) حل كل استبانة: مؤشر واحد محسوم أو حالة صادقة (بلا تخمين)
  const drafts: LinkedSurvey[] = surveys.map(s => {
    const base = {
      id: s.id,
      type: s.type,
      percentage: s.percentage,
      include: s.include,
      note: s.note,
      generalResult: s.generalResult,
      createdAt: s.createdAt,
    }
    if (s.indicatorId && explicitMap.has(s.indicatorId)) {
      const ind = explicitMap.get(s.indicatorId)!
      return {
        ...base,
        linkageStatus: "EXPLICIT" as const,
        indicatorId: ind.id,
        indicatorCode: ind.code,
        indicatorDescription: ind.description,
      }
    }
    if (s.generalResult) {
      const ids = textToIndicatorIds.get(s.generalResult)
      if (ids && ids.size === 1) {
        return {
          ...base,
          linkageStatus: "TEXT_MATCH" as const,
          indicatorId: Array.from(ids)[0],
          indicatorCode: null,
          indicatorDescription: null,
        }
      }
      if (ids && ids.size > 1) {
        return {
          ...base,
          linkageStatus: "AMBIGUOUS" as const,
          indicatorId: null,
          indicatorCode: null,
          indicatorDescription: null,
        }
      }
    }
    return {
      ...base,
      linkageStatus: "UNLINKED" as const,
      indicatorId: null,
      indicatorCode: null,
      indicatorDescription: null,
    }
  })

  // (4) إكمال بيانات المؤشرات للحل النصي (الصريح جاهز أعلاه)
  const textMatchedIds = Array.from(
    new Set(
      drafts.filter(d => d.linkageStatus === "TEXT_MATCH" && d.indicatorId).map(d => d.indicatorId!)
    )
  )
  const textRows = textMatchedIds.length
    ? await prisma.indicator.findMany({
        where: { id: { in: textMatchedIds } },
        select: { id: true, code: true, description: true },
      })
    : []
  const textMap = new Map(textRows.map(i => [i.id, i]))

  // (5) التجميع حسب المؤشر + فصل غير المرتبط
  const byIndicatorMap = new Map<
    string,
    { indicatorId: string; indicatorCode: string; indicatorDescription: string; surveys: LinkedSurvey[] }
  >()
  const unlinked: LinkedSurvey[] = []

  for (const d of drafts) {
    if (d.indicatorId) {
      const ind =
        d.linkageStatus === "EXPLICIT" ? explicitMap.get(d.indicatorId) : textMap.get(d.indicatorId)
      if (!ind) {
        // معرف يشير لمؤشر لم يعد موجودًا → حالة صادقة بلا ربط (لا تخمين)
        unlinked.push({
          ...d,
          linkageStatus: "UNLINKED",
          indicatorId: null,
          indicatorCode: null,
          indicatorDescription: null,
        })
        continue
      }
      d.indicatorCode = ind.code
      d.indicatorDescription = ind.description
      if (!byIndicatorMap.has(d.indicatorId)) {
        byIndicatorMap.set(d.indicatorId, {
          indicatorId: d.indicatorId,
          indicatorCode: ind.code,
          indicatorDescription: ind.description,
          surveys: [],
        })
      }
      byIndicatorMap.get(d.indicatorId)!.surveys.push(d)
    } else {
      unlinked.push(d)
    }
  }

  const byIndicator = Array.from(byIndicatorMap.values()).sort((a, b) =>
    a.indicatorCode.localeCompare(b.indicatorCode, "ar")
  )

  return { byIndicator, unlinked, total: surveys.length }
}