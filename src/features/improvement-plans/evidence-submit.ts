// ============================================================
// evidence-submit.ts — ربط شواهد الخطة بعد إنشائها (التحسين 8)
// ============================================================
// (التحسين 8 — إضافة فقط) ملف جديد كليًا: لا يستبدل ولا يعدل أي ملف قائم.
//
// الفكرة المعمارية المعتمدة (بديل آمن لجدول شواهد مؤقتة):
//   الملفات المُنتقاة داخل نموذج الإنشاء تبقى في المتصفح حصريًا (ولا بايت واحد
//   يُخزن على الخادم قبل إنشاء الخطة) — فعند إهمال النموذج أو فشل إنشاء الخطة
//   لا يوجد أي «شاهد يتيم» يحتاج تنظيفًا أصلًا. وبعد نجاح الحفظ تُقرأ الملفات
//   وتُرفع تباعًا عبر إجراء الرفع القائم المرخص (uploadPlanEvidence) فترتبط
//   بالـ planId الجديد بنفس التحقق الثلاثي والصلاحية والتخزين القائمين حرفيًا.
//
// لماذا هذا يفي بشروط المواصفة حرفيًا:
//   - «Cleanup if the plan is abandoned»: لا توجد شواهد مؤقتة على الخادم إطلاقًا.
//   - «Prevent wrong plan/school/branch/user association»: الربط يتم عبر
//     uploadPlanEvidence الذي يفرض canViewPlan (خطط مقيّم الجودة هو فقط) —
//     فلا يمكن ربط شاهد بخطة غير خطة صاحبها.
//   - «Partial upload failures»: الفشل الجزئي آمن — الملفات الناجحة تبقى
//     شواهد صحيحة للخطة، والفاشلة تُعاد بأسمائها ورسائلها ليعاد رفعها من
//     صفحة الخطة (بطاقة «رفع الشواهد» القائمة).
//   - «Prevent duplicate associations»: إزالة تكرار دفاعية هنا + منع التكرار
//     في المنتقي — وكل ملف يُرفع مرة واحدة بالتسلسل.
//   - «Validate formats and 5MB on the server»: التحقق الفعلي يجري داخل
//     uploadPlanEvidence على الخادم (الامتداد + MIME + التوقيع الرقمي + الحجم
//     الفعلي من base64) — الفحص هنا تسهيل فوري للعميل فقط.
// ============================================================

import { uploadPlanEvidence } from "@/features/improvement-plans/evidence-actions"
import {
  ALLOWED_EVIDENCE_EXTENSIONS,
  MAX_EVIDENCE_SIZE_BYTES,
  getFileExtension,
  type PlanEvidenceRow,
} from "@/features/improvement-plans/evidence-validation"

type UploadPlanEvidence = typeof uploadPlanEvidence

/** قيمة accept لحقل اختيار الملفات — نفس صيغ بطاقة «رفع الشواهد» القائمة */
export const EVIDENCE_PICKER_ACCEPT = ".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx"

export interface EvidenceAttachFailure {
  fileName: string
  error: string
}

export interface EvidenceAttachOutcome {
  uploaded: PlanEvidenceRow[]
  failed: EvidenceAttachFailure[]
}

/** تبعيات قابلة للحقن للاختبار الآلي بلا شبكة ولا خادم — الافتراضي هو الإنتاج */
export interface EvidenceAttachDeps {
  readFileAsDataUrl?: (file: File) => Promise<string>
  upload?: UploadPlanEvidence
  /** يُستدعى بعد انتهاء كل ملف: (المكتملة، الإجمالي، اسم الملف الحالي) */
  onProgress?: (done: number, total: number, currentName: string) => void
}

/** قراءة الملف Data URL — نفس آلية الرفع القائمة في محرك التقييم وبطاقة الشواهد حرفيًا */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"))
    reader.readAsDataURL(file)
  })
}

/**
 * نفس قواعد الخادم مبسطة للفحص الفوري قبل الحفظ — يعود null إذا كان الملف صالحًا،
 * أو رسالة عربية دقيقة لسبب الرفض. الحسم الأمني يبقى على الخادم عند الرفع الفعلي.
 */
export function validatePendingEvidenceFile(file: File): string | null {
  const ext = getFileExtension(file.name)
  if (!(ALLOWED_EVIDENCE_EXTENSIONS as readonly string[]).includes(ext)) {
    return "نوع ملف غير مدعوم. الصيغ المسموحة: PNG، JPG، JPEG، PDF، DOC، DOCX، XLS، XLSX."
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "الملف فارغ أو حجمه غير صالح."
  }
  if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
    return "حجم الملف يتجاوز الحد الأقصى المسموح (5 ميجابايت)."
  }
  return null
}

/** مفتاح تفرّد الملف داخل قائمة الانتقاء — الاسم والحجم وتاريخ آخر تعديل معًا */
function evidenceKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`
}

/**
 * فلترة الملفات المُنتقاة حديثًا مقابل القائمة القائمة:
 * تقبل الصالحة فقط، وترفض غير المدعوم/الفارغ/ما تجاوز 5MB/المكرر برسائل عربية.
 * (نقية بالكامل — تُختبر آليًا وتُستخدم من المنتقي)
 */
export function filterPendingEvidence(
  existing: File[],
  incoming: File[]
): { accepted: File[]; rejected: { fileName: string; reason: string }[] } {
  const seen = new Set<string>()
  for (const f of existing) seen.add(evidenceKey(f))

  const accepted: File[] = []
  const rejected: { fileName: string; reason: string }[] = []

  for (const file of incoming) {
    const key = evidenceKey(file)
    if (seen.has(key)) {
      rejected.push({ fileName: file.name, reason: "مُضاف مسبقًا إلى القائمة." })
      continue
    }
    const invalidReason = validatePendingEvidenceFile(file)
    if (invalidReason) {
      rejected.push({ fileName: file.name, reason: invalidReason })
      continue
    }
    seen.add(key)
    accepted.push(file)
  }

  return { accepted, rejected }
}

/**
 * ربط الشواهد المُنتقاة بالخطة بعد إنشائها بنجاح — يُنفَّذ من نموذج الإنشاء
 * بعد استلام planId من savePlan. تسلسلي (ملفًا ملفًا)، لا يرمي استثناءات
 * للأخطاء المتوقعة (كل ملف يُحسم بنجاحه أو فشله)، والفشل الجزئي آمن:
 * الناجح مرتبط فعلًا بالخطة، والفاشل يُعاد بأسمائه ليُرفع من صفحة الخطة.
 */
export async function attachPlanEvidenceAfterCreate(
  planId: string,
  files: File[],
  deps: EvidenceAttachDeps = {}
): Promise<EvidenceAttachOutcome> {
  if (!planId) {
    throw new Error("attachPlanEvidenceAfterCreate: planId مطلوب — تُستدعى بعد نجاح إنشاء الخطة فقط.")
  }

  const readFile = deps.readFileAsDataUrl ?? readFileAsDataUrl
  const upload = deps.upload ?? uploadPlanEvidence

  // إزالة تكرار دفاعية (المنتقي يمنع التكرار أصلًا) — «Prevent duplicate associations»
  const seen = new Set<string>()
  const unique = files.filter((f) => {
    const key = evidenceKey(f)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const uploaded: PlanEvidenceRow[] = []
  const failed: EvidenceAttachFailure[] = []
  let done = 0

  for (const file of unique) {
    try {
      const data = await readFile(file)
      const res = await upload(planId, { name: file.name, type: file.type, size: file.size, data })
      if (res.success) {
        uploaded.push(res.evidence)
      } else {
        failed.push({ fileName: file.name, error: res.error })
      }
    } catch {
      failed.push({
        fileName: file.name,
        error: "تعذر رفع الملف. تحقق من اتصالك ثم أعد رفعه من صفحة الخطة (بطاقة «رفع الشواهد»).",
      })
    }
    done += 1
    deps.onProgress?.(done, unique.length, file.name)
  }

  return { uploaded, failed }
}