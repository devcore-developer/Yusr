"use server"

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { revalidatePath } from "next/cache"
import { SUSTAINABILITY_THRESHOLD, computeIndicatorEvidenceScore } from "@/features/improvement-plans/queries"
import { normalizePlanKind } from "@/features/improvement-plans/threshold"
import { buildEvidencePlanDuplicateWhere } from "@/features/improvement-plans/plan-context"
import type { Prisma } from "@prisma/client" // (التحسين 8 — إضافة فقط) نوع معاملات Prisma لدالة الربط

export async function savePlan(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized: Only Quality Assessors can create plans")

  const id = formData.get("id") as string
  const title = formData.get("title") as string
  const gapId = formData.get("gapId") as string
  const indicatorId = formData.get("indicatorId") as string
  const startDate = formData.get("startDate") as string
  const targetDate = formData.get("targetDate") as string

  if (!title || !targetDate) throw new Error("العنوان وتاريخ الانتهاء مطلوبان")

  const actions: any[] = []
  const entries = Array.from(formData.entries())
  entries.forEach(([key, value]) => {
    const match = key.match(/actions\[(\d+)\]\[(\w+)\]/)
    if (match) {
      const index = parseInt(match[1])
      const field = match[2]
      if (!actions[index]) actions[index] = {}
      actions[index][field] = value
    }
  })

  let schoolId = user.schoolId
  let branchId = user.branchId || null

  if (gapId) {
    const gap = await prisma.gap.findUnique({ where: { id: gapId }, select: { schoolId: true, branchId: true } })
    if (gap) {
      if (!schoolId) schoolId = gap.schoolId
      if (!branchId) branchId = gap.branchId
    }
  }

  if (!schoolId) throw new Error("لم يتم تحديد المدرسة.")

  const data: any = {
    title,
    description: formData.get("description") as string,
    gapId: gapId || null,
    indicatorId: indicatorId || null,
    startDate: new Date(startDate || Date.now()),
    targetDate: new Date(targetDate),
    status: formData.get("status") as string || "DRAFT",
    priority: formData.get("priority") as string || "MEDIUM",
    objective: formData.get("objective") as string,
    reasons: formData.get("reasons") as string,
    strengths: formData.get("strengths") as string,
    improvements: formData.get("improvements") as string,
    baseline: parseFloat(formData.get("baseline") as string) || null,
    targetPercentage: parseFloat(formData.get("targetPercentage") as string) || null,
    currentMeasured: parseFloat(formData.get("currentMeasured") as string) || null,
    kpiName: formData.get("kpiName") as string,
    successCriteria: formData.get("successCriteria") as string,
    requiredSupport: formData.get("requiredSupport") as string,
    followUpMethod: formData.get("followUpMethod") as string,
    impactNotes: formData.get("impactNotes") as string,
    schoolId,
    branchId,
    createdById: user.id,
  }

  try {
    // (التحسين 8 — إضافة فقط) معرف الخطة المحفوظة يُعاد للواجهة لربط الشواهد المُنتقاة بها
    // إضافة غير مكسّرة: كل المستدعين القائمين يقرؤون success فقط وتبقى سلوك الحفظ كما هو
    let savedPlanId: string | null = null
    if (id) {
      await prisma.$transaction(async (tx) => {
        await tx.improvementPlan.update({ where: { id }, data })
        savedPlanId = id
        await tx.improvementAction.deleteMany({ where: { planId: id } })
        if (actions.length > 0) {
          await tx.improvementAction.createMany({
            data: actions.map(a => ({
              planId: id,
              title: a.title,
              status: a.status || "PENDING",
              startDate: a.startDate ? new Date(a.startDate) : null,
              dueDate: a.dueDate ? new Date(a.dueDate) : null,
            }))
          })
        }
        // (التحسين 8 — إضافة فقط) ربط الشواهد المؤقتة المرفوعة في النموذج داخل نفس
        // المعاملة: إما تُحفظ الخطة وكل شواهدها معًا أو لا يُحفظ شيء.
        // ملاحظة: يعمل فقط إذا وُجدت حقول مخفية باسم pendingEvidenceIds (النموذج المشترك
        // للإنشاء/التعديل) — بدونها لا يحدث شيء إطلاقًا. لقصر الميزة على الإنشاء فقط،
        // احذف هذا الاستدعاء من فرع التعديل وحده.
        await associatePendingEvidenceWithPlan(tx, id, formData.getAll("pendingEvidenceIds"), user.id)
      })
    } else {
      await prisma.$transaction(async (tx) => {
        const plan = await tx.improvementPlan.create({ data })
        savedPlanId = plan.id
        if (actions.length > 0) {
          await tx.improvementAction.createMany({
            data: actions.map(a => ({
              planId: plan.id,
              title: a.title,
              status: a.status || "PENDING",
              startDate: a.startDate ? new Date(a.startDate) : null,
              dueDate: a.dueDate ? new Date(a.dueDate) : null,
            }))
          })
        }
        // (التحسين 8 — إضافة فقط) الربط يعتمد على plan.id الناتج من الإنشاء نفسه —
        // لا يُقبل معرف خطة من العميل أبدًا، فلا يمكن الربط بخطة/مدرسة/فرع خاطئ.
        await associatePendingEvidenceWithPlan(tx, plan.id, formData.getAll("pendingEvidenceIds"), user.id)
      })
    }

    revalidatePath("/school-manager/quality/improvement-plans")
    revalidatePath("/improvement-plans")
    return { success: true, planId: savedPlanId }
  } catch (error) {
    console.error(error)
    throw new Error("حدث خطأ أثناء حفظ الخطة")
  }
}

export async function addAction(planId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized")

  const title = formData.get("title") as string
  if (!title) throw new Error("عنوان الإجراء مطلوب")

  await prisma.improvementAction.create({
    data: {
      planId,
      title,
      status: formData.get("status") as string || "PENDING",
      startDate: formData.get("startDate") ? new Date(formData.get("startDate") as string) : null,
      dueDate: formData.get("dueDate") ? new Date(formData.get("dueDate") as string) : null,
    }
  })

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}

// تحديث نسبة تقدم الإجراء (مع التحقق من التزامن بين الحالة والنسبة)
export async function updateActionProgress(actionId: string, status: string, planId: string, progressInput: number = 0) {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized")

  let finalProgress = progressInput;

  // 1. فرض القواعد من جانب الخادم لضمان عدم وجود تضارب
  if (status === "COMPLETED") {
    finalProgress = 100;
  } else if (status === "PENDING") {
    finalProgress = 0;
  } else {
    // للحالات (جارية) و (متعثرة): النسبة يجب أن تكون بين 0 و 99
    finalProgress = Math.max(0, Math.min(99, finalProgress));
    // إذا أدخل المستخدم 100% للحالة جارية، يتم خفضها إلى 99% تلقائيًا
    if (finalProgress === 100) finalProgress = 99;
  }

  // 2. تحديث الإجراء بالحالة والنسبة الجديدة المعتمدة
  await prisma.improvementAction.update({
    where: { id: actionId },
    data: { 
      status,
      progress: finalProgress
    }
  })

  // 3. إعادة حساب النسبة الإجمالية للخطة
  const actions = await prisma.improvementAction.findMany({ where: { planId } })
  
  if (actions.length > 0) {
    const totalProgress = actions.reduce((acc, a) => acc + (a.progress || 0), 0)
    const overallProgress = Math.round(totalProgress / actions.length)
    
    await prisma.improvementPlan.update({
      where: { id: planId },
      data: { progress: overallProgress }
    })
  } else {
    await prisma.improvementPlan.update({
      where: { id: planId },
      data: { progress: 0 }
    })
  }

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}

export async function addFollowUp(planId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const note = formData.get("note") as string
  if (!note) throw new Error("الملاحظة مطلوبة")

  await prisma.improvementFollowUp.create({
    data: { planId, note, progress: parseInt(formData.get("progress") as string) || null, createdById: user.id }
  })

  revalidatePath(`/school-manager/quality/improvement-plans/${planId}`)
}

/* ============================================================
   Task 16 — الإضافة الجديدة فقط: إنشاء خطة من سياق الشواهد/المؤشر
   (Evidence Bank actions + Sustainability Plans — حد 90%)

   قواعد الإضافة الصارمة:
   - كل الدوال أعلاه لم تُلمس حرفيًا — سير «خطة جديدة» الحالي (new?gapId=)
     يعمل كما هو تمامًا، والخطط المنشأة منه تحصل على kind=IMPROVEMENT
     من القيمة الافتراضية في قاعدة البيانات تلقائيًا.
   - نفس سلطة savePlan حرفيًا: QUALITY_ASSESSOR فقط — لم يُوسَّ أي دور.
   - الدرجة لا تُقبل من العميل أبدًا: يُعيد الخادم حسابها من استجابات
     الشواهد المتحققة (نفس منهجية analysis.ts) داخل التقييم المحدد.
   - خطة الاستدامة تُرفض على الخادم إذا كانت الدرجة null (غير قابلة للتحديد)
     أو أقل من 90 — مع رسالة توضح السبب بدقة وبدون اختلاق أي درجة.
   - خطة التحسين من هذا المسار مسموحة بلا شرط درجة (نفس سلوك مسار الفجوات القائم).
   ============================================================ */

/**
 * نوع النتيجة صريح حتى يبقى success حرفيًا (true/false) ويشتغل تضييق الاتحاد
 * في مكوّن العميل (res.success → res.planId / res.error) بلا أخطاء 2339.
 * القيم قابلة للتسلسل (serializable) — متوافقة مع Server Actions.
 */
type CreateEvidencePlanResult =
  | { success: true; planId: string; kind: string; status: string; evidenceScore: number | null; alreadyExisted?: boolean }
  | { success: false; error: string }

export async function createEvidencePlan(formData: FormData): Promise<CreateEvidencePlanResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized: Only Quality Assessors can create plans")

  const indicatorId = (formData.get("indicatorId") as string || "").trim()
  const assessmentId = (formData.get("assessmentId") as string || "").trim()
  const gapId = (formData.get("gapId") as string || "").trim()
  const submittedTitle = (formData.get("title") as string || "").trim()
  const kindInput = (formData.get("kind") as string || "").trim()

  // تطبيع النوع عبر normalizePlanKind (threshold.ts — المصدر الواحد المختبر آليًا):
  // أي قيمة غير معروفة ترجع إلى IMPROVEMENT (الافتراضي الآمن) — نفس دلالة
  // السطر السابق حرفيًا، وأصبحت الآن دالة واحدة مختبرة.
  const kind = normalizePlanKind(kindInput)

  if (!indicatorId) throw new Error("لم يتم تحديد المؤشر.")

  const indicator = await prisma.indicator.findUnique({
    where: { id: indicatorId },
    select: { code: true, description: true, targetStatus: true },
  })
  if (!indicator) throw new Error("المؤشر غير موجود.")

  // نفس منطق حل المدرسة/الفرع في savePlan حرفيًا + حراسة عزل إضافية للفجوة (في هذه الدالة الجديدة فقط)
  let schoolId = user.schoolId
  let branchId = user.branchId || null

  if (gapId) {
    const gap = await prisma.gap.findUnique({ where: { id: gapId }, select: { schoolId: true, branchId: true } })
    if (gap) {
      if (schoolId && gap.schoolId !== schoolId) throw new Error("Forbidden: الفجوة لا تنتمي إلى مدرستك.")
      if (!schoolId) schoolId = gap.schoolId
      if (!branchId) branchId = gap.branchId
    }
  }

  if (!schoolId) throw new Error("لم يتم تحديد المدرسة.")

  // التحقق من انتماء التقييم للمدرسة نفسها (عزل المستأجرين) — عند تمرير assessmentId
  if (assessmentId) {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { schoolId: true },
    })
    if (!assessment) throw new Error("التقييم غير موجود.")
    if (assessment.schoolId !== schoolId) throw new Error("Forbidden: التقييم لا ينتمي إلى مدرستك.")
  }

  // الدرجة المرجعية: يحسبها الخادم حصرًا من بيانات الشواهد — null إن تعذر الحساب الموثوق
  let evidenceScore: number | null = null
  if (assessmentId) {
    evidenceScore = await computeIndicatorEvidenceScore(assessmentId, indicatorId)
  }

  // فرض حد 90% على الخادم لخطة الاستدامة — بلا اختلاق درجات.
  // حالات الرفض المتوقعة تُعاد كنتيجة { success: false } برسالة دقيقة
  // (لا تُرمى استثناءً) حتى تعرضها الواجهة بلطف دون كسر الصفحة.
  if (kind === "SUSTAINABILITY") {
    if (evidenceScore === null) {
      return {
        success: false,
        error:
          "لا يمكن إنشاء خطة استدامة: تعذّر حساب درجة المؤشر بشكل موثوق (لا توجد شواهد قابلة للقياس لهذا المؤشر في التقييم المحدد، أو لم يُحدد تقييم مرجعي). لم تُنشأ أي خطة.",
      }
    }
    if (evidenceScore < SUSTAINABILITY_THRESHOLD) {
      return {
        success: false,
        error: `لا يمكن إنشاء خطة استدامة: درجة المؤشر ${evidenceScore}% أقل من حد الاستدامة (${SUSTAINABILITY_THRESHOLD}%). يمكنك إنشاء خطة تحسين بدلًا من ذلك. لم تُنشأ أي خطة.`,
      }
    }
  }

  // (Task 22) منع تكرار إنشاء خطة من سياق الشواهد — القاعدة الضيقة الموثقة في
  // plan-context.ts: نفس المدرسة + الفرع + التقييم + المؤشر + النوع فقط.
  // تقييم مختلف (عام دراسي جديد) أو نوع مختلف = خطة منفصلة مشروعة لا تُمنع،
  // وخطط مسارات أخرى (savePlan/الفجوات بلا assessmentId) لا يدخلها الشرط أصلًا.
  // التكرار يُعالج بأمان: يُعاد معرف الخطة القائمة نفسها (سلوك idempotent)
  // بدل إنشاء نسخة ثانية — والواجهة تفتحها كم هي (إن كانت مسودة تبقى مسودة).
  // بلا assessmentId لا يُطبق التكرار إطلاقًا (لا يمكن إثبات «نفس السياق»).
  if (assessmentId) {
    const duplicate = await prisma.improvementPlan.findFirst({
      where: buildEvidencePlanDuplicateWhere({
        schoolId,
        branchId,
        assessmentId,
        indicatorId,
        kind,
      }),
      select: { id: true, kind: true, status: true, evidenceScore: true },
      orderBy: { createdAt: "desc" },
    })
    if (duplicate) {
      return { success: true, planId: duplicate.id, kind: duplicate.kind, status: duplicate.status, evidenceScore: duplicate.evidenceScore, alreadyExisted: true }
    }
  }

  // (التحسين 3) العنوان الافتراضي بلا كود المؤشر — الأكواد لا تُعرض لمستخدمي الخطط،
  // والوصف المخزن هو الهوية المقروءة. العناوين المحفوظة لخطط قائمة تبقى كما هي.
  const title = submittedTitle || (kind === "SUSTAINABILITY" ? `خطة استدامة — ${indicator.description || "مؤشر تقويمي"}` : `خطة تحسين — ${indicator.description || "مؤشر تقويمي"}`)

  // الحقول تُملأ من بيانات مخزنة قائمة فقط (كود/وصف/حالة مستهدفة للمؤشر) — لا محتوى مختلق.
  // targetDate: قيمة ابتدائية محايدة (سنة من اليوم) لأنه حقل إلزامي في الموديل،
  //   ويُعدَّل من مسار تعديل الخطة الحالي كما في أي خطة.
  const startDate = new Date()
  const targetDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000)

  const data: any = {
    title,
    description: indicator.description || null,
    gapId: gapId || null,
    indicatorId: indicatorId || null,
    // (Task 22) تخزين رابط التقييم — العمود قائم في السكيما (ImprovementPlan.assessmentId
    // بعلاقة SetNull) وكان يُترك null من هذا المسار؛ تخزينه هو ما يجعل حالة «تم
    // الإنشاء» قابلة للاسترجاع من قاعدة البيانات ومنع التكرار الضيق ممكنًا
    assessmentId: assessmentId || null,
    kind,
    evidenceScore,
    startDate,
    targetDate,
    status: "DRAFT",
    priority: "MEDIUM",
    objective: indicator.targetStatus || null,
    schoolId,
    branchId,
    createdById: user.id,
  }

  try {
    const plan = await prisma.improvementPlan.create({ data })

    revalidatePath("/school-manager/quality/improvement-plans")
    revalidatePath("/improvement-plans")
    return { success: true, planId: plan.id, kind, status: "DRAFT", evidenceScore }
  } catch (error) {
    console.error(error)
    throw new Error("حدث خطأ أثناء حفظ الخطة")
  }
}

/* ============================================================
   (التحسين 8 — إضافة فقط) رفع الشواهد أثناء إنشاء الخطة
   ------------------------------------------------------------
   الفكرة: الملفات تُرفع فور اختيارها في النموذج إلى جدول مؤقت
   PendingEvidence (مملوك للمستخدم الحالي فقط، ولا تظهر في أي صفحة
   شواهد). عند الضغط على «حفظ» مرة واحدة فقط تُنقل داخل نفس معاملة
   إنشاء الخطة إلى جدول الشواهد النهائي (PlanEvidence من التحسين 7)
   وترتبط بمعرف الخطة الناتج من الإنشاء نفسه.

   الضمانات:
   - QUALITY_ASSESSOR فقط (نفس سلطة savePlan حرفيًا).
   - 5 ميجابايت + الأنواع المسموحة، بتحقق ثلاثي الطبقات:
     الامتداد + نوع MIME + التوقيع البايتي لمحتوى الملف (يرفض الملفات
     المعاد تسميتها مثل exe باسم png).
   - منع الازدواج: الصفوف المؤقتة تُحذف فور نقلها داخل المعاملة،
     فلا يمكن ربطها مرتين ولو أُعيد إرسال النموذج.
   - الأمانة: شواهد التحسين 7 القائمة لا تُمسّ إطلاقًا.
   - النماذج المُهملة: أي صفوف مؤقتة لم تُربط تخطة تُحذف تلقائيًا
     بعد 24 ساعة (تنظيف انتهازي عند كل عملية رفع جديدة — بلا cron).
   - فشل جزئي: ملف يُقبل وملف يُرفض لا يفسد الباقي؛ وفشل إنشاء الخطة
     يُرجع المعاملة كاملة والشواهد المؤقتة تبقى مملوكة للمستخدم فيمكن
     إعادة الحفظ مباشرة.
   ============================================================ */

const PENDING_EVIDENCE_MAX_SIZE = 5 * 1024 * 1024 // 5 ميجابايت
const PENDING_EVIDENCE_TTL_MS = 24 * 60 * 60 * 1000 // 24 ساعة

const PENDING_EVIDENCE_MIME_BY_KIND: Record<string, string[]> = {
  png: ["image/png"],
  jpeg: ["image/jpeg"],
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
}

function detectEvidenceKind(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".")
  if (dot < 0 || dot === fileName.length - 1) return null
  const ext = fileName.slice(dot + 1).toLowerCase()
  if (ext === "png") return "png"
  if (ext === "jpg" || ext === "jpeg") return "jpeg"
  if (ext === "pdf") return "pdf"
  if (ext === "doc") return "doc"
  if (ext === "docx") return "docx"
  if (ext === "xls") return "xls"
  if (ext === "xlsx") return "xlsx"
  return null
}

// الطبقة الثالثة من التحقق: التوقيع البايتي (magic bytes) للمحتوى الفعلي
function hasEvidenceMagicBytes(buf: Buffer, kind: string): boolean {
  const startsWith = (sig: number[]) => sig.every((b, i) => buf[i] === b)
  switch (kind) {
    case "png":
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    case "jpeg":
      return startsWith([0xff, 0xd8, 0xff])
    case "pdf":
      return startsWith([0x25, 0x50, 0x44, 0x46]) // %PDF
    case "docx":
    case "xlsx":
      return startsWith([0x50, 0x4b, 0x03, 0x04]) // حاوية ZIP (Office الحديث)
    case "doc":
    case "xls":
      return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) // OLE2 (Office القديم)
    default:
      return false
  }
}

/**
 * رفع ملف شاهد مؤقت قبل إنشاء الخطة (يُستدعى فور اختيار الملف في النموذج).
 * النتيجة كائن قابل للتسلسل — متوافقة مع Server Actions.
 */
export async function uploadPendingEvidence(
  formData: FormData
): Promise<{ success: true; id: string; fileName: string; fileType: string; fileSize: number } | { success: false; error: string }> {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized: Only Quality Assessors can upload evidence")

  const file = formData.get("file")
  if (!(file instanceof File)) return { success: false, error: "لم يتم إرسال أي ملف." }
  if (file.size === 0) return { success: false, error: "الملف فارغ." }
  if (file.size > PENDING_EVIDENCE_MAX_SIZE) {
    return { success: false, error: "حجم الملف يتجاوز الحد الأقصى (5 ميجابايت)." }
  }

  const fileName = file.name || "ملف بدون اسم"
  const kind = detectEvidenceKind(fileName)
  if (!kind) {
    return { success: false, error: "نوع الملف غير مدعوم. الأنواع المسموحة: PNG, JPG, PDF, DOC, DOCX, XLS, XLSX." }
  }

  // الطبقة الثانية: نوع MIME المعلن (إن وُجد) يجب أن يطابق الامتداد المسموح
  const allowedMimes = PENDING_EVIDENCE_MIME_BY_KIND[kind]
  if (file.type && !allowedMimes.includes(file.type)) {
    return { success: false, error: "نوع الملف المعلن لا يطابق الامتداد المسموح." }
  }

  // الطبقة الثالثة: التحقق من المحتوى الفعلي
  const bytes = Buffer.from(await file.arrayBuffer())
  if (!hasEvidenceMagicBytes(bytes, kind)) {
    return { success: false, error: "محتوى الملف لا يطابق نوعه المعلن — تم رفض الرفع." }
  }

  // تنظيف انتهازي: الشواهد المؤقتة المنتهية الصلاحية (نماذج أُهملت قبل الحفظ)
  await prisma.pendingEvidence.deleteMany({ where: { expiresAt: { lt: new Date() } } })

  const storedMime = file.type || allowedMimes[0]
  const created = await prisma.pendingEvidence.create({
    data: {
      fileName,
      fileType: storedMime,
      fileSize: file.size,
      fileData: `data:${storedMime};base64,${bytes.toString("base64")}`,
      createdById: user.id,
      expiresAt: new Date(Date.now() + PENDING_EVIDENCE_TTL_MS),
    },
    select: { id: true },
  })

  return { success: true, id: created.id, fileName, fileType: storedMime, fileSize: file.size }
}

/**
 * إزالة شاهد مؤقت قبل الحفظ (زر «إزالة» في النموذج).
 * deleteMany بدل delete: لا يفشل إن كان الصف قد نُقل/حُذف — آمن للتكرار.
 */
export async function removePendingEvidence(id: string): Promise<{ success: true }> {
  const user = await getCurrentUser()
  if (!user || user.role !== "QUALITY_ASSESSOR") throw new Error("Unauthorized")

  await prisma.pendingEvidence.deleteMany({ where: { id, createdById: user.id } })
  return { success: true }
}

/**
 * (تُستدعى من داخل معاملة savePlan فقط)
 * تنقل الشواهد المؤقتة المملوكة للمستخدم الحالي إلى جدول الشواهد النهائي
 * وتربطها بالخطة المنشأة في نفس المعاملة، ثم تحذف الصفوف المؤقتة.
 *
 * تنبيه مهم — الموضع الوحيد الذي قد يختلف باسم الحقول عندك: كتلة
 * tx.planEvidence.createMany أدناه. قارنها بموديل PlanEvidence في
 * schema.prisma عندك؛ إن اختلف اسم حقل (مثلًا createdById بدل
 * uploadedById) أو كان اسم الموديل نفسه مختلفًا، عدّل هذه الكتلة فقط —
 * لا شيء غيرها. وإن أردت صفر تخمين: الصق لي موديل PlanEvidence وسأثبت
 * الأسماء لك فورًا.
 */
async function associatePendingEvidenceWithPlan(
  tx: Prisma.TransactionClient,
  planId: string,
  pendingIds: FormDataEntryValue[],
  userId: string
): Promise<void> {
  const ids = pendingIds.map(v => String(v).trim()).filter(Boolean)
  if (ids.length === 0) return

  // ملكية صارمة: لا يُنقل إلا ما رفعه المستخدم الحالي نفسه — فلا يمكن
  // ربط شواهد مستخدم آخر، ولا شواهد نُقلت سلفًا (حُذفت عند نقلها).
  const pendings = await tx.pendingEvidence.findMany({
    where: { id: { in: ids }, createdById: userId },
    select: { id: true, fileName: true, fileType: true, fileSize: true, fileData: true },
  })
  if (pendings.length === 0) return

  // نفس حقول prisma.improvementPlanEvidence.create في evidence-actions.ts حرفيًا
  await tx.improvementPlanEvidence.createMany({
    data: pendings.map(p => ({
      planId,
      uploadedById: userId,
      fileName: p.fileName,
      fileType: p.fileType,
      fileSize: p.fileSize,
      fileData: p.fileData,
    })),
  })

  await tx.pendingEvidence.deleteMany({ where: { id: { in: pendings.map(p => p.id) } } })
}