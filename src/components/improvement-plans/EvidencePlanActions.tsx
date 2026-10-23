// ===== FILE: src/components/improvement-plans/EvidencePlanActions.tsx =====
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createEvidencePlan } from "@/features/improvement-plans/actions"
import { SUSTAINABILITY_THRESHOLD, classifyPlanKind } from "@/features/improvement-plans/threshold"
import { Button } from "@/components/ui/Button"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { ShieldCheck, TrendingUp, CheckCircle } from "lucide-react"
import type { ExistingPlanRef } from "@/features/improvement-plans/plan-context"

/**
 * ============================================================
 * Task 16 — أزرار الإجراء من سياق بنك الأدلة/المؤشر
 * (Task 21 — تحديث إضافة فقط: التصنيف من المصدر الواحد + حالة «الدرجة غير متاحة»)
 * ============================================================
 *
 * مكوّن مضاف (additive) يُدرج داخل صفحة بنك الأدلة القائمة دون أي حذف أو تغيير
 * في محتواها: يعرض زرًا واحدًا موجَّهًا حسب حد 90%:
 *   - الدرجة ≥ 90  → «خطة استدامة» (تتحقق منها الخدمة الخادمية مجددًا قبل الإنشاء)
 *   - الدرجة < 90 أو غير محددة → «خطة تحسين» (نفس سلوك مسار الفجوات القائم)
 *
 * (Task 21) التوجيه نفسه أصبح عبر classifyPlanKind من threshold.ts — المصدر
 * الواحد المختبر آليًا للحدود (89.99/90/90.01) — نفس دلالة الشرط السابق حرفيًا.
 *
 * (Task 21) الدرجة غير المتاحة (null) لم تعد «تصنيفًا صامتًا»: يظهر بجانب الزر
 * نص صريح بأن الدرجة المرجعية غير متاحة وأن الاستدامة لا تُعتمد بلا درجة موثوقة،
 * والخادم يرفض خطة استدامة بلا درجة رفضًا صريحًا (لا اختلاق درجات).
 *
 * الدرجة المُمررة هنا للتوجيه البصري فقط — الخادم يعيد حساب الدرجة دائمًا من
 * استجابات الشواهد المتحققة (المصدر الموثوق) ولا يقبل أي درجة من العميل.
 *
 * (Task 22-fix) نافذة التأكيد أصبحت داخلية (ConfirmDialog) بدل window.confirm
 * الأصلية للمتصفح التي كانت تظهر أعلى النافذة بشكل رديء خارج هوية التصميم —
 * نفس نص التأكيد حرفيًا لكن داخل نافذة أنيقة بوسط الشاشة بنفس نمط النوافذ
 * القائم في المشروع، والخطأ يُعرض داخلها وتبقى مفتوحة لإعادة المحاولة.
 *
 * (Task 22) حالة «تم الإنشاء» المُستدامة: عندما توجد خطة قائمة لهذا المؤشر في
 * التقييم المرجعي (تُجلب من قاعدة البيانات وتُمرر من الصفحة عبر existingPlan —
 * أو تُعاد للتو من createEvidencePlan) يُستبدل زر الإنشاء بزر حالة أخضر يفتح
 * الخطة نفسها بمعرفها (نفس مسار التوجيه القائم) — إن كانت مسودة تُفتح المسودة
 * نفسها لإكمال بياناتها. الحالة تُقرأ من قاعدة البيانات فتبقى صحيحة بعد
 * التنقل والتحديث وتسجيل الدخول من جديد — لا حالة مؤقتة ولا تخزين محلي.
 *
 * التوجيه للدمج في (dashboard)/evidence/page.tsx أو أي سياق شواهد:
 *   <EvidencePlanActions
 *     indicatorId={indicator.id}
 *     assessmentId={assessmentId}        // إن كان السياق داخل تقييم — احذفه في البنك العام
 *     gapId={gap?.id}                    // إن وُجدت فجوة مرتبطة بالصف
 *     score={indicatorScore ?? null}     // درجة المؤشر إن كانت محسوبة في الصفحة
 *     canCreatePlan={user.role === "QUALITY_ASSESSOR"}
 *   />
 * ضعه مرة واحدة لكل مجموعة مؤشر (وليس لكل صف شاهد متكرر) لتجنب تكرار الأزرار.
 */

interface EvidencePlanActionsProps {
  indicatorId: string
  /** سياق التقييم — يلزم لاحتساب الدرجة المرجعية على الخادم؛ بدونه لن تُقبل خطة استدامة */
  assessmentId?: string
  /** الفجوة المرتبطة إن وُجدت — تُربط بالخطة كما في مسار الفجوات الحالي */
  gapId?: string
  /** درجة المؤشر المعروضة في الصفحة (0-100) — للتوجيه البصري فقط */
  score?: number | null
  /** إنشاء الخطط للمقيّم فقط — نفس سلطة savePlan القائمة بلا أي توسيع أدوار */
  canCreatePlan: boolean
  /** (Task 22) الخطة القائمة لهذا المؤشر في التقييم المرجعي — من قاعدة البيانات حصرًا
   *  (بمعرفها الفعلي — لا مطابقة عناوين). وجودها يحوّل زر الإنشاء إلى زر حالة أخضر */
  existingPlan?: ExistingPlanRef | null
}

export function EvidencePlanActions({ indicatorId, assessmentId, gapId, score = null, canCreatePlan, existingPlan = null }: EvidencePlanActionsProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // (Task 22) الخطة المعادة للتو من الإنشاء — تحديث فوري قبل إعادة الrender الخادمي؛
  // بعد التنقل/التحديث تعود الصفحة بالحالة من قاعدة البيانات عبر existingPlan
  const [created, setCreated] = useState<ExistingPlanRef | null>(null)
  // (Task 22-fix) نافذة التأكيد الداخلية — بديل window.confirm الأصلي
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!canCreatePlan) return null

  // (Task 21) التصنيف من المصدر الواحد — نفس دلالة:
  // score !== null && score >= SUSTAINABILITY_THRESHOLD
  const isSustainability = classifyPlanKind(score) === "SUSTAINABILITY"
  // (Task 21) حالة صريحة للدرجة غير المتاحة — لا تصنيف صامت عند غياب الرابط الموثوق
  const scoreUnavailable = score === null || score === undefined
  // (Task 22) الخطة الفعالة: المعادة للتو تفضّل على المُمررة من الخادم (أحدث)
  const effectivePlan = created ?? existingPlan
  const openPlan = () => {
    if (effectivePlan) router.push(`/school-manager/quality/improvement-plans/${effectivePlan.id}`)
  }

  // (Task 22-fix) فتح نافذة التأكيد الداخلية بدل window.confirm الأصلي
  const openConfirm = () => {
    setError(null)
    setConfirmOpen(true)
  }

  const handleConfirm = async () => {
    const formData = new FormData()
    formData.set("indicatorId", indicatorId)
    if (assessmentId) formData.set("assessmentId", assessmentId)
    if (gapId) formData.set("gapId", gapId)
    formData.set("kind", isSustainability ? "SUSTAINABILITY" : "IMPROVEMENT")

    setSubmitting(true)
    try {
      const res = await createEvidencePlan(formData)
      if (res.success) {
        // (Task 22) الخادم idempotent: عند التكرار يعيد الخطة القائمة نفسها —
        // والفتح دائمًا بالمعرف الفعلي عبر نفس مسار التوجيه القائم
        setCreated({ id: res.planId, kind: res.kind, status: res.status })
        setConfirmOpen(false)
        router.push(`/school-manager/quality/improvement-plans/${res.planId}`)
      } else {
        // الفشل يُعرض داخل النافذة وتبقى مفتوحة — الإجراء والزر لا يضيعان
        setError(res.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ أثناء إنشاء الخطة")
    } finally {
      setSubmitting(false)
    }
  }

  // (Task 22) زر الحالة الأخضر — الخطة القائمة موجودة: الفتح بمعرفها الفعلي،
  // وإن كانت مسودة يظهر تلميح أن نفس المسودة تُفتح لإكمال بياناتها.
  // نوع الزر من عمود kind المخزّن في قاعدة البيانات — لا تصنيف من العميل.
  if (effectivePlan) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button variant="success" size="sm" icon={<CheckCircle className="w-3.5 h-3.5" />} onClick={openPlan}>
          {effectivePlan.kind === "SUSTAINABILITY" ? "تم إنشاء خطة الاستدامة" : "تم إنشاء خطة التحسين"}
        </Button>
        {effectivePlan.status === "DRAFT" && (
          <span className="text-[11px] text-muted-foreground leading-5 max-w-sm">
            المسودة قائمة — افتحها لإكمال التواريخ والإجراءات والمتابعة.
          </span>
        )}
        {score !== null && (
          <span className="text-[12px] text-muted-foreground">
            الدرجة المرجعية: <span dir="ltr" className="numeric">{score}%</span>
          </span>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          {isSustainability ? (
            <Button variant="primary" size="sm" icon={<ShieldCheck className="w-3.5 h-3.5" />} onClick={openConfirm} disabled={submitting}>
              {submitting ? "جارٍ الإنشاء..." : "خطة استدامة"}
            </Button>
          ) : (
            <Button variant="soft" size="sm" icon={<TrendingUp className="w-3.5 h-3.5" />} onClick={openConfirm} disabled={submitting}>
              {submitting ? "جارٍ الإنشاء..." : "خطة تحسين"}
            </Button>
          )}
          {score !== null && (
            <span className="text-[12px] text-muted-foreground">
              {/* (إصلاح Bidi) الرقم + % محصورين في span اتجاهه LTR صريح حتى لا تقفز
                  العلامة إلى أول السطر العربي (تظهر %40 أو قبل الجملة في RTL) —
                  dir="ltr" يجعل «40%» وحدة واحدة ثابتة الترتيب في أي سياق */}
              الدرجة المرجعية: <span dir="ltr" className="numeric">{score}%</span>
            </span>
          )}
        </div>
        {/* (Task 21) حالة «غير مرتبط/غير متاح» الصريحة — متطلب المواصفة: لا تصنيف صامت
            عند تعذر حل الدرجة الموثوقة؛ الاستدامة تبقى مرفوضة على الخادم في هذه الحالة */}
        {scoreUnavailable && (
          <span className="text-[11px] text-muted-foreground leading-5 max-w-sm">
            الدرجة المرجعية غير متاحة في هذا السياق — تُنشأ كخطة تحسين، ولا يمكن اعتماد خطة استدامة بدون درجة موثوقة من تقييم محدد.
          </span>
        )}
        {error && !confirmOpen && (
          <p className="text-[12px] text-danger max-w-sm leading-5">{error}</p>
        )}
      </div>

      {/* (Task 22-fix) نافذة التأكيد الداخلية — بوسط الشاشة بنفس نمط نوافذ المشروع
          بدل نافذة المتصفح الأصلية التي كانت تظهر أعلى الشاشة بشكل رديء.
          نفس نص التأكيد السابق حرفيًا، والخطأ يُعرض داخلها وتبقى مفتوحة لإعادة المحاولة */}
      <ConfirmDialog
        open={confirmOpen}
        title={isSustainability ? "إنشاء خطة استدامة" : "إنشاء خطة تحسين"}
        icon={isSustainability ? <ShieldCheck className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
        confirmLabel="متابعة وإنشاء المسودة"
        pendingLabel="جارٍ الإنشاء..."
        pending={submitting}
        error={error}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmOpen(false); setError(null) }}
      >
        <p>
          سيتم إنشاء مسودة «{isSustainability ? "خطة استدامة" : "خطة تحسين"}» لهذا المؤشر.
        </p>
        <p>
          ستفتح صفحة الخطة لإكمال البيانات (التواريخ والإجراءات والمتابعة) بنفس مسار خطط التحسين الحالي.
        </p>
        {isSustainability && score !== null && score !== undefined && (
          <div className="flex items-center gap-2 text-[12px] bg-surface-muted border border-border rounded-lg px-3 py-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span>
              الدرجة المرجعية: <span dir="ltr" className="numeric font-medium text-foreground-strong">{score}%</span>
              {" — "}
              حد الاستدامة: <span dir="ltr" className="numeric font-medium text-foreground-strong">{SUSTAINABILITY_THRESHOLD}%</span>
            </span>
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}