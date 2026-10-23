// ============================================================
// تعيين المراحل التعليمية للحسابات — مساعد خادمي موحد
// تُستدعى من دوال إنشاء/تعديل الحسابات القائمة (مدير النظام / مدير المدرسة)
// الفرض: الصلاحيات العامة لإنشاء المستخدمين قائمة في المسارات الحالية —
// هذه الوظيفة تفرض مراحل التعيين فقط ولا تمنح أي صلاحية جديدة.
// ============================================================

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { normalizeStageIds, type EducationalStageId } from "@/lib/stages"

/**
 * تطبيق تعيينات المراحل على مستخدم قائم (أو أثناء إنشائه بعد إنشائه فعليًا).
 * - مدير النظام: أي مستخدم في المنصة.
 * - مدير المدرسة: مستخدمي مدرسته فقط (نفس نطاق إدارة المستخدمين الحالي).
 * - أي دور آخر: ممنوع.
 * القيم تُطبع وتُتحقق على الخادم دائمًا (normalizeStageIds يرمي عند أي قيمة غير صحيحة).
 */
export async function applyUserStageAssignments(
  targetUserId: string,
  stagesInput: unknown
): Promise<EducationalStageId[]> {
  const caller = await getCurrentUser()
  if (!caller) throw new Error("Unauthorized")

  if (caller.role !== "SUPER_ADMIN" && caller.role !== "SCHOOL_MANAGER") {
    throw new Error("Forbidden: إدارة تعيين المراحل التعليمية محصورة بمدير النظام ومدير المدرسة.")
  }

  const stages = normalizeStageIds(stagesInput)

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, schoolId: true, role: true }
  })
  if (!target) throw new Error("المستخدم غير موجود.")

  if (caller.role === "SCHOOL_MANAGER") {
    if (!target.schoolId || target.schoolId !== caller.schoolId) {
      throw new Error("Forbidden: يمكنك تعديل مراحل مستخدمي مدرستك فقط.")
    }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: { stages: { set: stages } }
  })

  return stages
}