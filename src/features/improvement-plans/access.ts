// ===== FILE: src/features/improvement-plans/access.ts =====
// ============================================================
// improvement-plans/access.ts — قاعدة الوصول لخطط التحسين (نقية بلا prisma)
// ============================================================
// مصدر واحد لقاعدة «من يرى أي خطة» تفرضها ثلاث صفحات (القائمة/التفاصيل/الطباعة)
// وتُختبر آليًا. القاعدة (عرض فقط — الإنشاء يبقى QUALITY_ASSESSOR حصريًا كما هو):
//   - SUPER_ADMIN: كل الخطط (نموذج الإدارة القائم).
//   - SCHOOL_MANAGER: خطط مدرسته فقط (schoolId مطابق).
//   - BRANCH_MANAGER: خطط مدرسته ضمن فروعه المصرح بها (getAuthorizedBranchIds)
//       + الخطط على مستوى المدرسة كله (branchId = null) لأنها لا تخص فرعًا آخر.
//   - QUALITY_ASSESSOR: خططه هو فقط (createdById) — نفس سلوك قائمته الحالي.
//   - أي دور آخر: ممنوع.
// تغيير المعرف في الرابط لا يوسع النطاق أبدًا: القاعدة تُقيم على بيانات الخطة
// المخزنة مقابل هوية الجلسة من الخادم — لا على أي معامل ظاهر.
// ============================================================

export interface PlanAccessUser {
  id: string
  role: string
  schoolId: string | null
}

export interface PlanAccessRow {
  schoolId: string | null
  branchId: string | null
  createdById: string | null
}

/**
 * هل يُسمح لهذا المستخدم بعرض هذه الخطة (قراءة/طباعة)؟
 * @param authorizedBranchIds فروع مدير القسم المصرح بها (من getAuthorizedBranchIds) — تُمرر فارغة لغيره
 */
export function canViewPlan(
  user: PlanAccessUser,
  plan: PlanAccessRow,
  authorizedBranchIds: string[] = []
): boolean {
  switch (user.role) {
    case "SUPER_ADMIN":
      return true
    case "SCHOOL_MANAGER":
      return !!user.schoolId && plan.schoolId === user.schoolId
    case "BRANCH_MANAGER":
      if (!user.schoolId || plan.schoolId !== user.schoolId) return false
      // خطة على مستوى المدرسة كله (بلا فرع) أو ضمن الفروع المصرح بها فقط
      return plan.branchId === null || authorizedBranchIds.includes(plan.branchId)
    case "QUALITY_ASSESSOR":
      return !!plan.createdById && plan.createdById === user.id
    default:
      return false
  }
}