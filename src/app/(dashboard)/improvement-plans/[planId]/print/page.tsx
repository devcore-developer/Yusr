// ===== FILE: src/app/(dashboard)/improvement-plans/[planId]/print/page.tsx =====
import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PrintButton } from "@/components/reports/PrintButton"
import { getIndicatorLabels } from "@/features/improvement-plans/queries"
import { canViewPlan } from "@/features/improvement-plans/access"
import { getStageLabel } from "@/lib/stages"

// ============================================================
// طباعة خطة التحسين — صفحة واحدة لكل الأدوار المصرح لها بالعرض
// (مقيّم الجودة صاحب الخطة / مدير المدرسة / مدير القسم ضمن فروعه /
//  مدير النظام) — نفس قاعدة الوصول الموحدة في features/improvement-plans/access.ts
// وتُفرض هنا على الخادم من بيانات الخطة المخزنة، فتغيير الرابط لا يكشف شيئًا.
//
// مبادئ الطباعة (نفس نمط تقارير الطباعة القائمة):
// - تُطبع البيانات المحفوظة فقط — لا بيانات مختلقة ولا حساب جديد.
// - شعار المدرسة واسمها والعام الدراسي من العلاقات المخزنة إن وُجدت.
// - RTL + A4 + إخفاء التنقل وأزرار التفاعل عند الطباعة.
// ============================================================

export default async function ImprovementPlanPrintPage({ params }: { params: { planId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const plan = await prisma.improvementPlan.findUnique({
    where: { id: params.planId },
    include: {
      school: { select: { name: true, logoUrl: true, governorate: true, city: true } },
      branch: { select: { name: true } },
      assessment: { select: { id: true, cycle: true, stage: true } },
      academicYear: { select: { label: true } },
      gap: { include: { indicator: { select: { code: true, description: true } } } },
      actions: { orderBy: { createdAt: "asc" }, include: { responsible: { select: { name: true } } } },
      followUps: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } } } },
      createdBy: { select: { name: true } },
    },
  })

  // فحص الوصول الموحد — يمنع عرض/طباعة خطة مدرسة أو فرع غير مصرح به بتغيير المعرف
  const authorizedBranchIds = user.role === "BRANCH_MANAGER" ? await getAuthorizedBranchIds(user) : []
  const allowed = plan
    ? canViewPlan(
        user,
        { schoolId: plan.schoolId, branchId: plan.branchId, createdById: plan.createdById },
        authorizedBranchIds
      )
    : false
  if (!plan || !allowed) redirect("/improvement-plans")

  // المؤشر المرتبط بلا فجوة (العمود القائم indicatorId — نفس نمط صفحات العرض)
  const linkedIndicator = !plan.gap?.indicator && plan.indicatorId
    ? (await getIndicatorLabels([plan.indicatorId])).get(plan.indicatorId)
    : undefined
  const indicatorCode = plan.gap?.indicator?.code || linkedIndicator?.code || null
  const indicatorDescription = plan.gap?.indicator?.description || linkedIndicator?.description || null
  const planKindLabel = plan.kind === "SUSTAINABILITY" ? "خطة استدامة" : "خطة تحسين"
  const statusLabel =
    plan.status === "COMPLETED" ? "مكتملة" : plan.status === "IN_PROGRESS" || plan.status === "ACTIVE" ? "قيد التنفيذ" : "مسودة"
  const priorityLabel = plan.priority === "HIGH" ? "عالية" : plan.priority === "LOW" ? "منخفضة" : "متوسطة"

  const fmt = (d: Date | null | undefined) =>
    d ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "long" }).format(new Date(d)) : "—"

  return (
    <div className="bg-white text-black p-4 md:p-8 lg:p-12 min-w-0" dir="rtl">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          /* إخفاء تنقل التطبيق وعناصر التفاعل عند الطباعة */
          nav, aside, header, footer { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }

        .plan-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #073B43; padding-bottom: 16px; margin-bottom: 20px; }
        .plan-title { font-size: 20px; font-weight: 700; color: #073B43; }
        .section-title { font-size: 15px; font-weight: 700; color: #073B43; margin-top: 24px; margin-bottom: 12px; border-right: 4px solid #2878B8; padding-right: 10px; page-break-after: avoid; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; table-layout: fixed; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; vertical-align: top; }
        th { background-color: #f4f6fb; color: #172B36; }

        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }
        .info-grid .label { color: #64748B; font-size: 11px; }
        .card-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; page-break-inside: avoid; }
        .avoid-break { page-break-inside: avoid; }
      `}</style>

      <div className="no-print mb-8 flex items-center justify-between">
        <PrintButton />
        <a href={`/improvement-plans/${plan.id}`} className="text-sm text-slate-500 hover:underline">← العودة إلى صفحة الخطة</a>
      </div>

      {/* الترويسة — اسم المدرسة وشعارها والعام الدراسي كما هو مخزن */}
      <div className="plan-header">
        <div className="flex items-start gap-3 min-w-0">
          {plan.school.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={plan.school.logoUrl} alt="شعار المدرسة" className="w-16 h-16 object-contain shrink-0" />
          )}
          <div className="min-w-0">
            <div className="plan-title">{plan.title}</div>
            <div className="text-[13px] text-slate-600 mt-1">
              {planKindLabel} — {plan.school.name}{plan.branch ? ` (${plan.branch.name})` : ""}
            </div>
            {(plan.school.governorate || plan.school.city) && (
              <div className="text-[12px] text-slate-500">
                {[plan.school.governorate, plan.school.city].filter(Boolean).join(" — ")}
              </div>
            )}
          </div>
        </div>
        <div className="text-left shrink-0 text-[12px] text-slate-600">
          <div><span className="font-semibold">العام الدراسي:</span> {plan.academicYear?.label ?? "غير محدد"}</div>
          {plan.assessment?.cycle && <div><span className="font-semibold">الدورة:</span> {plan.assessment.cycle}</div>}
          <div><span className="font-semibold">حالة الخطة:</span> {statusLabel}</div>
          <div><span className="font-semibold">الأولوية:</span> {priorityLabel}</div>
          <div><span className="font-semibold">تاريخ الطباعة:</span> {fmt(new Date())}</div>
        </div>
      </div>

      {/* بطاقة الملخص — كل الحقول المحفوظة فقط */}
      <div className="card-box avoid-break">
        <div className="info-grid">
          <div><div className="label">المؤشر المرتبط</div><div>{indicatorCode ?? "غير محدد"}{indicatorDescription ? ` — ${indicatorDescription}` : ""}</div></div>
          <div><div className="label">المقيّم / منشئ الخطة</div><div>{plan.createdBy?.name ?? "غير محدد"}</div></div>
          <div><div className="label">تاريخ البدء المستهدف</div><div>{fmt(plan.startDate)}</div></div>
          <div><div className="label">تاريخ الإنجاز المستهدف</div><div>{fmt(plan.targetDate)}</div></div>
          {plan.assessment && <div><div className="label">مرحلة التقييم المرتبط</div><div>{getStageLabel(plan.assessment.stage)}</div></div>}
          {plan.evidenceScore !== null && plan.evidenceScore !== undefined && (
            <div><div className="label">الدرجة المرجعية عند الإنشاء</div><div>{plan.evidenceScore}%</div></div>
          )}
          <div><div className="label">نسبة الإنجاز</div><div>{plan.progress}%</div></div>
          {plan.kpiName && <div><div className="label">مؤشر الأداء (KPI)</div><div>{plan.kpiName}</div></div>}
          {plan.baseline !== null && plan.baseline !== undefined && <div><div className="label">النسبة الأساسية</div><div>{plan.baseline}%</div></div>}
          {plan.targetPercentage !== null && plan.targetPercentage !== undefined && <div><div className="label">النسبة المستهدفة</div><div>{plan.targetPercentage}%</div></div>}
          {plan.currentMeasured !== null && plan.currentMeasured !== undefined && <div><div className="label">النسبة المقاسة حالياً</div><div>{plan.currentMeasured}%</div></div>}
        </div>
        {plan.description && <p className="text-[13px] leading-7 mt-3">{plan.description}</p>}
      </div>

      {plan.objective && (
        <>
          <div className="section-title">الهدف</div>
          <p className="text-[13px] leading-7 whitespace-pre-line">{plan.objective}</p>
        </>
      )}

      {plan.successCriteria && (
        <>
          <div className="section-title">معايير النجاح</div>
          <p className="text-[13px] leading-7 whitespace-pre-line">{plan.successCriteria}</p>
        </>
      )}

      {(plan.reasons || plan.strengths || plan.improvements) && (
        <>
          <div className="section-title">تحليل الأداء الحالي</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 avoid-break">
            {plan.reasons && <div className="card-box"><div className="label text-[11px] text-slate-500 mb-1">الأسباب</div><p className="text-[12px] leading-6">{plan.reasons}</p></div>}
            {plan.strengths && <div className="card-box"><div className="label text-[11px] text-slate-500 mb-1">نقاط القوة</div><p className="text-[12px] leading-6">{plan.strengths}</p></div>}
            {plan.improvements && <div className="card-box"><div className="label text-[11px] text-slate-500 mb-1">جوانب التحسين</div><p className="text-[12px] leading-6">{plan.improvements}</p></div>}
          </div>
        </>
      )}

      {/* إجراءات الخطة — المسؤول والتواريخ والحالة كما حُفظت */}
      <div className="section-title">إجراءات الخطة</div>
      {plan.actions.length === 0 ? (
        <p className="text-[12px] text-slate-500">لا توجد إجراءات مسجلة.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: "30%" }}>الإجراء</th>
              <th style={{ width: "20%" }}>المسؤول</th>
              <th style={{ width: "14%" }}>تاريخ البدء</th>
              <th style={{ width: "14%" }}>تاريخ الاستحقاق</th>
              <th style={{ width: "12%" }}>الحالة</th>
              <th style={{ width: "10%" }}>الإنجاز</th>
            </tr>
          </thead>
          <tbody>
            {plan.actions.map(a => (
              <tr key={a.id}>
                <td>{a.title}{a.description ? <div className="text-[11px] text-slate-500 mt-1">{a.description}</div> : null}</td>
                <td>{a.responsible?.name ?? "—"}</td>
                <td>{a.startDate ? fmt(a.startDate) : "—"}</td>
                <td>{a.dueDate ? fmt(a.dueDate) : "—"}</td>
                <td>{a.status === "COMPLETED" ? "مكتمل" : a.status === "IN_PROGRESS" ? "جارٍ" : a.status === "BLOCKED" ? "متعثر" : "معلق"}</td>
                <td>{a.progress}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* سجل المتابعة وقياس الأثر */}
      <div className="section-title">سجل المتابعة وقياس الأثر</div>
      {plan.followUps.length === 0 ? (
        <p className="text-[12px] text-slate-500">لا توجد متابعات مسجلة.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: "18%" }}>التاريخ</th>
              <th style={{ width: "20%" }}>بواسطة</th>
              <th>ملاحظة المتابعة</th>
              <th style={{ width: "12%" }}>التقدم</th>
            </tr>
          </thead>
          <tbody>
            {plan.followUps.map(fu => (
              <tr key={fu.id}>
                <td>{fmt(fu.createdAt)}</td>
                <td>{fu.createdBy?.name ?? "—"}</td>
                <td>{fu.note}</td>
                <td>{fu.progress !== null && fu.progress !== undefined ? `${fu.progress}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(plan.requiredSupport || plan.followUpMethod || plan.impactNotes) && (
        <>
          <div className="section-title">الدعم المطلوب وآلية المتابعة والأثر</div>
          <div className="card-box avoid-break text-[12px] leading-6">
            {plan.requiredSupport && <p><span className="font-semibold">الدعم المطلوب:</span> {plan.requiredSupport}</p>}
            {plan.followUpMethod && <p><span className="font-semibold">آلية المتابعة:</span> {plan.followUpMethod}</p>}
            {plan.impactNotes && <p><span className="font-semibold">ملاحظات الأثر:</span> {plan.impactNotes}</p>}
          </div>
        </>
      )}
    </div>
  )
}