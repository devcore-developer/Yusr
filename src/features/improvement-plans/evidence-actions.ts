"use server"

// ============================================================
// evidence-actions.ts — إجراءات خادمية لميزة «رفع الشواهد» في خطط التحسين
// ============================================================
// (التحسين 7 — إضافة فقط) ملف جديد كليًا — إجراءات improvement-plans/actions.ts
// القائمة لم تُلمس حرفيًا (savePlan/addAction/updateActionProgress/addFollowUp/
// createEvidencePlan كلها كما هي)؛ الفصل في ملف مستقل هو ضمان عدم المساس.
//
// قواعد الصلاحية (إعادة استخدام البنية القائمة حرفيًا — بلا أي دور جديد):
//   - الرفع: getCurrentUser() + بوابة الدور الحرفية نفسها المستخدمة في savePlan
//     وaddAction (user.role !== "QUALITY_ASSESSOR" → رفض) + قاعدة الوصول الموحدة
//     canViewPlan (مقيّم الجودة: خططه هو فقط عبر createdById — فلا رفع لخطة غيره
//     ولا لمدرسة أخرى أصلًا).
//   - التنزيل: نفس قاعدة العرض الموحدة canViewPlan التي تفرضها صفحات الخطة الثلاث
//     (القائمة/التفاصيل/الطباعة) — من يرى الخطة يرى شواهدها، ولا يمكن لبطاقة
//     معرف تغيير النطاق لأن الفحص على بيانات الخطة المخزنة مقابل هوية الجلسة.
//   - التحقق من الملف: validateEvidenceFile (النواة النقية) — امتداد + MIME +
//     توقيع رقمي للمحتوى + حد 5 ميجابايت محسوب من base64 الفعلي لا من أرقام العميل.
//   - التخزين: يتبع البنية القائمة حرفيًا (AssessmentAttachment.fileData — Data URL
//     base64 داخل قاعدة البيانات) — وهو ما تتطلبه بنية المنصة القائمة (Vercel
//     serverless بلا قرص دائم)، ويُخزن كما هو بلا أي ضغط أو تحويل أو تعديل.
// ============================================================

import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { canViewPlan } from "@/features/improvement-plans/access"
import {
  validateEvidenceFile,
  type EvidenceFileInput,
  type PlanEvidenceRow,
} from "@/features/improvement-plans/evidence-validation"

type UploadEvidenceResult =
  | { success: true; evidence: PlanEvidenceRow }
  | { success: false; error: string }

type GetEvidenceFileResult =
  | { success: true; fileName: string; fileType: string; dataUrl: string }
  | { success: false; error: string }

/**
 * رفع شاهد واحد إلى خطة تحسين قائمة — لمقيّم الجودة مالك الخطة حصريًا.
 * لا تُرمى استثناءات لرسائل التحقق/الصلاحية المتوقعة: تُعاد كنتيجة { success: false }
 * برسالة عربية دقيقة تعرضها الواجهة بلطف (نمط createEvidencePlan القائم).
 */
export async function uploadPlanEvidence(planId: string, file: EvidenceFileInput): Promise<UploadEvidenceResult> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "انتهت الجلسة — سجّل الدخول من جديد." }

  // بوابة الدور الحرفية نفسها في savePlan/addAction — رفع الشواهد لمقيّم الجودة فقط
  if (user.role !== "QUALITY_ASSESSOR") {
    return { success: false, error: "رفع الشواهد من صلاحيات مقيّم الجودة (مشرف الجودة) فقط." }
  }

  const plan = await prisma.improvementPlan.findUnique({
    where: { id: planId },
    select: { schoolId: true, branchId: true, createdById: true },
  })
  if (!plan) return { success: false, error: "لم يتم العثور على الخطة." }

  // قاعدة الوصول الموحدة المختبرة (access.ts) — لمقيّم الجودة تعني: خططه هو فقط.
  // تغيير المعرف في الطلب لا يوسع النطاق: الفحص على بيانات الخطة المخزنة.
  if (!canViewPlan(user, plan)) {
    return { success: false, error: "غير مصرح برفع شواهد لهذه الخطة — كل مقيّم يرفع شواهد خططه هو فقط." }
  }

  // التحقق الكامل من الملف على الخادم (المصدر الفاصل) — الامتداد + MIME + التوقيع الرقمي + 5MB
  const validation = validateEvidenceFile(file)
  if (!validation.ok) return { success: false, error: validation.error }

  try {
    const row = await prisma.improvementPlanEvidence.create({
      data: {
        planId,
        uploadedById: user.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        // يُخزن كما وصل حرفيًا (Data URL) — لا ضغط ولا تحويل ولا تعديل صامت (قاعدة المواصفة)
        fileData: file.data,
      },
      select: { id: true, fileName: true, fileType: true, fileSize: true, createdAt: true },
    })

    // نفس مسارات إعادة التحقق المستخدمة في إجراءات الخطط القائمة
    revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
    revalidatePath(`/improvement-plans/${planId}`)

    return {
      success: true,
      evidence: {
        id: row.id,
        fileName: row.fileName,
        fileType: row.fileType,
        fileSize: row.fileSize,
        createdAt: row.createdAt.toISOString(),
      },
    }
  } catch (error) {
    console.error("uploadPlanEvidence failed:", error)
    return { success: false, error: "حدث خطأ أثناء حفظ الشاهد. حاول من جديد." }
  }
}

/**
 * جلب محتوى شاهد مخزن لفتحه أو تنزيله — بنفس قاعدة العرض الموحدة لصفحات الخطة:
 * مقيّم الجودة: شواهد خططه / مدير المدرسة: مدرسته / مدير القسم: فروعه المصرح بها
 * (وعلى مستوى المدرسة كله) / مدير النظام: الكل — وعزل المدارس مفروض داخل القاعدة.
 */
export async function getPlanEvidenceFile(evidenceId: string): Promise<GetEvidenceFileResult> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "انتهت الجلسة — سجّل الدخول من جديد." }

  const row = await prisma.improvementPlanEvidence.findUnique({
    where: { id: evidenceId },
    select: {
      fileName: true,
      fileType: true,
      fileData: true,
      plan: { select: { schoolId: true, branchId: true, createdById: true } },
    },
  })
  if (!row) return { success: false, error: "لم يتم العثور على الشاهد." }

  // نفس استدعاء قاعدة العرض في صفحات الخطة حرفيًا — فروع مدير القسم تُحل من صلاحياته المخزنة
  const authorizedBranchIds = user.role === "BRANCH_MANAGER" ? await getAuthorizedBranchIds(user) : []
  if (!canViewPlan(user, row.plan, authorizedBranchIds)) {
    return { success: false, error: "غير مصرح لك بالوصول إلى هذا الشاهد." }
  }

  return { success: true, fileName: row.fileName, fileType: row.fileType, dataUrl: row.fileData }
}