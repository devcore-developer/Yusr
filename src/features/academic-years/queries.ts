// ============================================================
// استعلامات العام الدراسي الخادمية — قراءة فقط
// (مفصولة عن ملف الأكشنز حتى تبقى قراءات الصفحات نظيفة وقابلة للمشاركة)
// ============================================================

import { prisma } from "@/lib/prisma"

/** الصف الرقمي الخفيف المستخدم في الشارات وروؤس الصفحات */
export type ActiveAcademicYearRow = {
  id: string
  label: string
  startYear: number
}

/**
 * العام الدراسي النشط لمدرسة معينة — أو null إن لم يُفعِّل المدير أي عام بعد.
 * يُستخدم في: شارات لوحات التحكم، تثبيت عام الإنشاء للتقييمات الجديدة،
 * وطباعة خطط التحسين — دائمًا من العلاقة المخزّنة لا من نص عرض.
 */
export async function getActiveAcademicYearForSchool(
  schoolId: string | null | undefined
): Promise<ActiveAcademicYearRow | null> {
  if (!schoolId) return null
  const year = await prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    select: { id: true, label: true, startYear: true }
  })
  return year ?? null
}