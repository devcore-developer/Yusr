// ===== FILE: src/app/(dashboard)/settings/actions.ts =====
"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { normalizeStageIds } from "@/lib/stages"

export async function updateProfile(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const name = formData.get("name") as string
  const email = formData.get("email") as string

  if (!name || !email) throw new Error("الحقول مطلوبة")

  const existingUser = await prisma.user.findFirst({
    where: { email, NOT: { id: user.id } }
  })

  if (existingUser) throw new Error("البريد الإلكتروني مستخدم بالفعل من قبل حساب آخر")

  await prisma.user.update({
    where: { id: user.id },
    data: { name, email }
  })

  revalidatePath("/", "layout")
  revalidatePath("/settings")
}

export async function updatePassword(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const newPassword = formData.get("newPassword") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!newPassword || newPassword.length < 6) throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل")
  if (newPassword !== confirmPassword) throw new Error("كلمتا المرور غير متطابقتين")

  const hashedPassword = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword }
  })

  revalidatePath("/settings")
  revalidatePath("/school-manager/settings")
}

export async function createBackup() {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") throw new Error("Unauthorized")

  try {
    const [schools, branches, users, assessments, domains, indicators] = await Promise.all([
      prisma.school.findMany(),
      prisma.branch.findMany(),
      prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, status: true } }),
      prisma.assessment.findMany(),
      prisma.domain.findMany(),
      prisma.indicator.findMany()
    ])

    const backupData = JSON.stringify({
      metadata: { exportedAt: new Date().toISOString(), platform: "YUSR Quality Management", version: "1.0" },
      data: { schools, branches, users, assessments, domains, indicators }
    }, null, 2)

    const fileSize = Buffer.byteLength(backupData, 'utf-8')

    await prisma.backupHistory.create({ data: { type: "Manual JSON Export", status: "SUCCESS", fileSize } })
    return { success: true, data: backupData, filename: `yusr-backup-${new Date().toISOString().split('T')[0]}.json` }
  } catch (error) {
    await prisma.backupHistory.create({ data: { type: "Manual JSON Export", status: "FAILED", fileSize: 0 } })
    throw new Error("Failed to create backup")
  }
}

/* ============================================================
   (جديد — هذه المهمة) تحديث المراحل التعليمية لحساب مقيّم الجودة من صفحة
   إعداداته هو — لمعالجة الحسابات القائمة التي بلا تعيين مراحل دون إعادة إنشائها.

   قواعد الأمان:
   - QUALITY_ASSESSOR على حسابه هو حصرًا (لا يقبل userId من العميل إطلاقًا).
   - القيم تُطبَّع وتُتحقق على الخادم عبر normalizeStageIds (المراحل الخمس فقط —
     أي قيمة أخرى تُرفض برسالة واضحة) — لا ثقة بالعميل أبدًا.
   - نطاق مقيّم الجودة صارم دائمًا (getUserStageGrant): اختيار المراحل من حسابه
     لا يمنحه أي صلاحية إضافية — يحدد فقط المراحل التي يُسمح له بإنشاء تقييماتها.
   - لا يلمس كلمة المرور ولا الدور ولا المدرسة/الفرع ولا أي بيانات أخرى.
   - التحديث يُسجل في سجل النشاط (Activity) قابلًا للتدقيق.
   ============================================================ */
export async function updateMyStages(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")
  if (user.role !== "QUALITY_ASSESSOR") {
    throw new Error("Forbidden: تحديث المراحل التعليمية من الإعدادات متاح لحسابات مقيّم الجودة فقط.")
  }

  const stages = normalizeStageIds(formData.getAll("stages"))

  await prisma.user.update({
    where: { id: user.id },
    data: { stages }
  })

  await prisma.activity.create({
    data: {
      actorId: user.id,
      schoolId: user.schoolId,
      branchId: user.branchId,
      action: "UPDATE",
      entityType: "USER",
      entityId: user.id,
      metadata: { description: "تحديث المراحل التعليمية من صفحة الإعدادات", stages }
    }
  })

  revalidatePath("/settings")
  revalidatePath("/", "layout")
}