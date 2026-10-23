// ===== FILE: src/lib/permissions.ts =====
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { isValidStage, getStageLabel } from "@/lib/stages"

export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user) return null

  // جلب أحدث بيانات من قاعدة البيانات لضمان ظهور التحديثات فوراً (مثل تغيير الاسم)
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id }
  })

  return dbUser
}

export async function requireRole(roles: string[]) {
  const user = await getCurrentUser()
  if (!user || !roles.includes(user.role)) {
    redirect("/login")
  }
  return user
}

export async function requireSchoolAccess(schoolId: string) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  if (user.role === "SUPER_ADMIN") return true

  if (user.schoolId !== schoolId) {
    throw new Error("Unauthorized: Tenant isolation violation")
  }
  return true
}

/**
 * كل الفروع التي يُسمح للمستخدم بالعمل عليها:
 * - الفرع المرتبط به مباشرة (User.branchId)
 * - الفروع التي يديرها عبر Branch.managerId (علاقة "BranchManager")
 * هذا يعالج الربط المزدوج في المخطط دون أي تغيير على قاعدة البيانات.
 */
export async function getAuthorizedBranchIds(
  user: { id: string; branchId: string | null }
): Promise<string[]> {
  const ids: string[] = []
  if (user.branchId) ids.push(user.branchId)

  const managed = await prisma.branch.findMany({
    where: { managerId: user.id },
    select: { id: true }
  })
  for (const b of managed) {
    if (!ids.includes(b.id)) ids.push(b.id)
  }
  return ids
}

export async function requireBranchAccess(branchId: string) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  if (user.role === "SUPER_ADMIN") return true

  if (user.role === "SCHOOL_MANAGER") {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } })
    if (!branch || branch.schoolId !== user.schoolId) throw new Error("Unauthorized")
    return true
  }

  // BRANCH_MANAGER و QUALITY_ASSESSOR: مقصورون على فروعهم الفعلية
  // (سابقاً كان QUALITY_ASSESSOR يتجاوز هذا الفحص بالكامل — ثغرة أُغلقت)
  const authorizedBranchIds = await getAuthorizedBranchIds(user)
  if (!authorizedBranchIds.includes(branchId)) {
    throw new Error("Unauthorized: Branch isolation violation")
  }
  return true
}

// ===== عزل التقييمات (المشكلة 3) — القاعدة الموحدة =====

export interface AssessmentScopeRow {
  id: string
  schoolId: string
  branchId: string | null
  assessorId: string | null
  type: string
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

/**
 * القراءة:
 *  - SUPER_ADMIN: كل التقييمات التشغيلية + تقييماته الخاصة فقط.
 *  - SCHOOL_MANAGER: كل تقييمات مدرسته (عدا الخاصة).
 *  - BRANCH_MANAGER: تقييمات فروعه + تقييماته هو (عدا الخاصة).
 *  - QUALITY_ASSESSOR: تقييماته هو فقط.
 *  - PRIVATE_REVIEW: مالكه فقط (وهو مدير النظام دائماً) — قراءةً وكتابةً.
 * الكتابة:
 *  - مدير النظام لا يعدّل التقييمات التشغيلية (قاعدة قائمة في saveEvidenceResponse).
 *  - غيره: يجب أن يكون هو المُقيّم المالك (assessorId) مع احترام نطاق المدرسة/الفرع.
 */
export async function assertAssessmentAccess(
  user: CurrentUser,
  assessment: AssessmentScopeRow,
  mode: "read" | "write" = "read"
): Promise<boolean> {
  const isPrivate = assessment.type === "PRIVATE_REVIEW"

  // التقييم الخاص سري ولا يُشارك مع أي أحد غير مالكه
  if (isPrivate) {
    return user.role === "SUPER_ADMIN" && assessment.assessorId === user.id
  }

  if (user.role === "SUPER_ADMIN") {
    // القراءة مسموحة، والكتابة على التشغيلي ممنوعة (سلوك قائم في النظام)
    return mode === "read"
  }

  if (user.role === "SCHOOL_MANAGER") {
    if (mode === "read") return assessment.schoolId === user.schoolId
    // الكتابة: يجب أن يكون هو المُقيّم + ضمن مدرسته
    return assessment.assessorId === user.id && assessment.schoolId === user.schoolId
  }

  if (user.role === "BRANCH_MANAGER") {
    if (assessment.assessorId === user.id) {
      // تقييمه هو: يقرأه ويكتبه دائماً
      return true
    }
    const authorizedBranchIds = await getAuthorizedBranchIds(user)
    if (mode === "read") {
      return !!assessment.branchId && authorizedBranchIds.includes(assessment.branchId)
    }
    return false
  }

  // QUALITY_ASSESSOR: تقييماته هو فقط — قراءةً وكتابةً
  return assessment.assessorId === user.id
}

/**
 * يجلب التقييم ويفحص الوصول في خطوة واحدة — للاستخدام داخل Server Actions.
 */
export async function checkAssessmentAccess(
  assessmentId: string,
  mode: "read" | "write" = "read"
): Promise<{ allowed: boolean; assessment: AssessmentScopeRow | null }> {
  const user = await getCurrentUser()
  if (!user) return { allowed: false, assessment: null }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, schoolId: true, branchId: true, assessorId: true, type: true }
  })
  if (!assessment) return { allowed: false, assessment: null }

  const allowed = await assertAssessmentAccess(user, assessment, mode)
  return { allowed, assessment }
}

// ============================================================
// المراحل التعليمية — الصلاحيات والفرض على الخادم
// (المرحلة بُعد تصنيف وتخويل إضافي — لا تمس منهجية الحساب إطلاقًا)
// ============================================================

/** قراءة قائمة مراحل المستخدم بأمان (قبل/بعد الترحيل) */
export function stageListOf(user: { stages?: unknown }): string[] {
  return Array.isArray(user.stages)
    ? user.stages.filter((s): s is string => isValidStage(s))
    : []
}

/**
 * صلاحية المستخدم على المراحل عند إنشاء التقييمات:
 *  - SUPER_ADMIN: وصول كامل (يقيّم عبر مسار المراجعة الخاصة — غير مقيّد).
 *  - SCHOOL_MANAGER: كل المراحل (لا توجد آلية تعيين مراحل لمديري المدارس في
 *    التصميم الحالي — سلوكه القائم لا يتغير).
 *  - BRANCH_MANAGER: المراحل المعينة له؛ وإن لم تُعيّن له أي مرحلة يبقى سلوكه
 *    السابق (كل المراحل) تفاديًا لأي تراجع في العمل القائم — قرار موثق.
 *  - QUALITY_ASSESSOR: صارم — المراحل المعينة له فقط، وحسابٌ بلا تعيينات
 *    لا يمكنه إنشاء تقييمات حتى تُعيّن له مراحل (مطلب الميزة الصريح).
 */
export type StageGrant = { mode: "ALL" } | { mode: "LIMITED"; stages: string[] }

export function getUserStageGrant(user: CurrentUser): StageGrant {
  if (user.role === "SUPER_ADMIN" || user.role === "SCHOOL_MANAGER") {
    return { mode: "ALL" }
  }
  const stages = stageListOf(user)
  if (user.role === "BRANCH_MANAGER") {
    return stages.length > 0 ? { mode: "LIMITED", stages } : { mode: "ALL" }
  }
  // QUALITY_ASSESSOR — صارم دائمًا
  return { mode: "LIMITED", stages }
}

export function isStageAllowed(grant: StageGrant, stage: string): boolean {
  if (!isValidStage(stage)) return false
  return grant.mode === "ALL" ? true : grant.stages.includes(stage)
}

/** فرض تخويل المرحلة عند إنشاء تقييم — يُستدعى من createNewAssessment على الخادم */
export async function assertStageCreationAllowed(user: CurrentUser, stage: string): Promise<void> {
  if (!isValidStage(stage)) {
    throw new Error("المرحلة التعليمية المحددة غير صحيحة.")
  }
  const grant = getUserStageGrant(user)
  if (!isStageAllowed(grant, stage)) {
    // ملاحظة TypeScript: استدعاء isStageAllowed دالة وليس type guard — لا يضيّق النوع،
    // لذا نضيّق يدويًا بفحص mode صراحة قبل لمس grant.stages (وإلا رفض المترجم الاتحاد).
    if (grant.mode === "LIMITED") {
      if (grant.stages.length === 0) {
        throw new Error(
          "لم يتم تعيين أي مراحل تعليمية لحسابك. تواصل مع مدير النظام لتعيين المراحل المسموح لك بتقييمها قبل إنشاء تقييم جديد."
        )
      }
      throw new Error(
        `لا يمكنك إنشاء تقييم لمرحلة غير معينة على حسابك. المراحل المسموح بها: ${grant.stages
          .map(s => getStageLabel(s))
          .join("، ")}`
      )
    }
    // دفاعي: منح ALL لا يرفض مرحلة صحيحة أصلًا — لا يُفترض الوصول لهذا الفرع إطلاقًا
    throw new Error("المرحلة التعليمية المحددة غير صحيحة.")
  }
}

// ===== تعديل مرحلة تقييم قائم — سياسة موحدة (صفحة + Action واحد) =====

export interface StageEditTargetRow extends AssessmentScopeRow {
  status: string
  stage: string | null
}

/**
 * من يعدّل مرحلة تقييم قائم؟
 *  - PRIVATE_REVIEW: مالكه فقط (مدير النظام) — كما في قواعد العزل القائمة.
 *  - تشغيلي:
 *      SUPER_ADMIN: مسموح (سلطة معالجة السجلات التاريخية — تعديل تصنيفي فقط
 *                   لا يمس الاستجابات ولا الشواهد ولا الدرجات).
 *      SCHOOL_MANAGER: ضمن مدرسته (سلطة تصحيح مرحلة سجل تاريخي لمدرسته).
 *      BRANCH_MANAGER: مالك التقييم فقط (لا تجاوز للملكية).
 *      QUALITY_ASSESSOR: مالك التقييم فقط.
 *  - قاعدة الحالة: المكتمل الذي مرحلته محددة مُقفل (حفاظًا على التقارير الصادرة).
 *    المكتمل بلا مرحلة (سجل تاريخي) يمكن تعيين مرحلته مرة واحدة — مسار المعالجة الآمنة.
 */
export async function getStageEditPolicy(
  user: CurrentUser,
  assessment: StageEditTargetRow
): Promise<{ allowed: boolean; reason?: string }> {
  if (assessment.type === "PRIVATE_REVIEW") {
    const isOwner = user.role === "SUPER_ADMIN" && assessment.assessorId === user.id
    return isOwner
      ? { allowed: true }
      : { allowed: false, reason: "التقييم الخاص لا يمكن تعديل مرحلته إلا من مالكه." }
  }

  let roleAllowed = false
  if (user.role === "SUPER_ADMIN") {
    roleAllowed = true
  } else if (user.role === "SCHOOL_MANAGER") {
    roleAllowed = !!user.schoolId && assessment.schoolId === user.schoolId
  } else if (user.role === "BRANCH_MANAGER" || user.role === "QUALITY_ASSESSOR") {
    roleAllowed = assessment.assessorId === user.id
  }
  if (!roleAllowed) {
    return { allowed: false, reason: "لا تملك صلاحية تعديل مرحلة هذا التقييم." }
  }

  if (assessment.status === "COMPLETED" && assessment.stage !== null) {
    return {
      allowed: false,
      reason: "التقييم مكتمل ومرحلته محددة — لا يمكن تعديلها حفاظًا على سلامة التقارير الصادرة."
    }
  }

  return { allowed: true }
}