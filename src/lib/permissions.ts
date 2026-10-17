import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

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