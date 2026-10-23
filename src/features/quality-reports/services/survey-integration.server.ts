// ===== FILE: src/features/quality-reports/services/survey-integration.server.ts =====
// ============================================================
// survey-integration.server.ts — تحميل بيانات التكامل على الخادم
// ============================================================
// - الاستبانات المرتبطة = العلاقة الصريحة بالمعرّفات فقط (indicatorId غير فارغ)
//   — المطابقة النصية القائمة (survey-link.ts) تبقى كما هي لقسم العرض القائم.
// - عزل المدرسة يُفرض هنا: كل استعلام مقيَّد بـ schoolId صريح.
// - إعداد الدمج يُقرأ لقطةً كاملة مع اسم المعتمِد (سجل التدقيق الظاهر مع العرض).
// ============================================================

import { prisma } from "@/lib/prisma"
import type { LinkedSurveyInput, SurveyIntegrationConfigSnapshot } from "./survey-integration"

/** استبانات مدرسة مرتبطة صراحةً ببنود — مجمّعة بمعرّف البند (الأرقام تُبنى منها فقط) */
export async function getSchoolLinkedSurveysByIndicator(
  schoolId: string
): Promise<Map<string, LinkedSurveyInput[]>> {
  const surveys = await prisma.survey.findMany({
    where: { schoolId, indicatorId: { not: null } },
    select: {
      id: true,
      type: true,
      percentage: true,
      respondents: true,
      include: true,
      indicatorId: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const map = new Map<string, LinkedSurveyInput[]>()
  for (const s of surveys) {
    if (!s.indicatorId) continue // حصانة إضافية — لا يُحتسب أي سجل بلا رابط صريح
    const list = map.get(s.indicatorId) ?? []
    list.push({
      id: s.id,
      type: s.type,
      percentage: s.percentage,
      respondents: s.respondents,
      include: s.include,
    })
    map.set(s.indicatorId, list)
  }
  return map
}

/** لقطة إعداد الدمج المعتمد للمدرسة — null = غير مُهيَّأ (تُعرض النتيجتان المنفصلتان) */
export async function getSurveyIntegrationConfig(
  schoolId: string
): Promise<SurveyIntegrationConfigSnapshot | null> {
  const config = await prisma.surveyIntegrationConfig.findUnique({
    where: { schoolId },
    include: { approvedBy: { select: { name: true } } },
  })
  if (!config) return null
  return {
    id: config.id,
    schoolId: config.schoolId,
    toolWeight: config.toolWeight,
    surveyWeight: config.surveyWeight,
    method: config.method,
    note: config.note,
    approvedByName: config.approvedBy?.name ?? null,
    updatedAt: config.updatedAt,
  }
}