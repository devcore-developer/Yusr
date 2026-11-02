import { prisma } from "@/lib/prisma"
import { getCurrentUser, getAuthorizedBranchIds } from "@/lib/permissions"
import { redirect } from "next/navigation"
import Link from "next/link"
import { PrintButton } from "@/components/reports/PrintButton"
import { getIndicatorLabels } from "@/features/improvement-plans/queries"
import { canViewPlan } from "@/features/improvement-plans/access"
import { getStageLabel } from "@/lib/stages"

// ============================================================
// Enhancement 6 — وثيقة طباعة خطة التحسين الرسمية (صفحة معزولة تمامًا)
// ============================================================
// لماذا مسار جديد أعلى المستوى (app/print/...)؟
//   صفحة الطباعة السابقة كانت داخل مجموعة مسارات (dashboard) فكان هيكل
//   التطبيق (Sidebar/Header/التنقل/الأزرار) يُطبع معها مهما أخفينا بـ CSS،
//   لأن AppShell يرسم الشريط الجانبي والعلوي داخل عناصر div وليس
//   nav/aside/header فلا تلتقطها قواعد الإخفاء الدلالية.
//   هذا المسار خارج كل مجموعات المسارات (dashboard)/(school-manager) —
//   يغلّفه التخطيط الجذري فقط: لا شريط جانبي ولا علوي ولا تبويبات ولا أزرار
//   إلا زر الطباعة المخصص (no-print) — عزل بنيوي لا يعتمد على CSS أصلًا.
//
// الضوابط الملتزم بها:
//   - نفس قاعدة الوصول الموحدة canViewPlan (features/improvement-plans/access.ts)
//     تُفرض على الخادم من بيانات الخطة المخزنة مقابل هوية الجلسة — تغيير الرابط لا يكشف شيئًا.
//   - تُطبع البيانات المحفوظة فقط — لا بيانات مختلقة ولا شعارات مؤقتة:
//     الشعار من School.logoUrl، اسم «طُبعت بواسطة» من هوية الجلسة (getCurrentUser).
//   - إضافة Enhancement 6 الوحيدة: هذه الوثيقة + إعادة توجيه مسارَي الطباعة
//     القديمَين إليها — لا تغيير على إنشاء/تعديل/متابعة الخطط أو الصلاحيات أو قاعدة البيانات.
//   - التواريخ بنمط المنصة القائم (ar-SA) وبتوقيت Africa/Cairo صراحةً حتى لا
//     يتوقف ختم الطباعة على المنطقة الزمنية للخادم (Vercel = UTC).
// ============================================================

const CAIRO_TZ = "Africa/Cairo"

// تنسيق ثابت بين الخادم والمتصفح — نفس نمط صفحات المنصة (ar-SA) + توقيت صريح
function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—"
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "long", timeZone: CAIRO_TZ }).format(new Date(d))
}

function fmtDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: CAIRO_TZ,
  }).format(new Date(d))
}

const planKindLabel = (kind: string | null | undefined) => (kind === "SUSTAINABILITY" ? "خطة استدامة" : "خطة تحسين")

const statusLabel = (status: string | null | undefined) =>
  status === "COMPLETED" ? "مكتملة"
  : status === "IN_PROGRESS" || status === "ACTIVE" ? "قيد التنفيذ"
  : status === "DRAFT" ? "مسودة"
  : (status || "غير محدد")

const priorityLabel = (priority: string | null | undefined) =>
  priority === "HIGH" ? "عالية" : priority === "LOW" ? "منخفضة" : priority === "MEDIUM" ? "متوسطة" : (priority || "غير محدد")

const severityLabel = (severity: string | null | undefined) =>
  severity === "HIGH" ? "مرتفعة" : severity === "LOW" ? "منخفضة" : severity === "MEDIUM" ? "متوسطة" : (severity || "غير محددة")

// حالات الإجراءات كما تُستخدم في المنصة (PENDING/IN_PROGRESS/COMPLETED وDELAYED أو BLOCKED تاريخيًا)
const actionStatusLabel = (status: string | null | undefined) =>
  status === "COMPLETED" ? "مكتمل"
  : status === "IN_PROGRESS" ? "جارٍ"
  : status === "DELAYED" || status === "BLOCKED" ? "متعثر"
  : status === "PENDING" ? "لم يبدأ"
  : (status || "غير محدد")

export default async function ImprovementPlanOfficialPrintPage({ params }: { params: { planId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const plan = await prisma.improvementPlan.findUnique({
    where: { id: params.planId },
    include: {
      school: { select: { name: true, logoUrl: true, governorate: true, city: true, educationalStage: true } },
      branch: { select: { name: true } },
      assessment: { select: { id: true, cycle: true, stage: true } },
      academicYear: { select: { label: true } },
      gap: { include: { indicator: { select: { code: true, description: true } } } },
      actions: { orderBy: { createdAt: "asc" }, include: { responsible: { select: { name: true } } } },
      followUps: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } } } },
      createdBy: { select: { name: true } },
    },
  })

  // فحص الوصول الموحد — نفس قاعدة القائمة/التفاصيل/الطباعة القائمة (access.ts)
  const authorizedBranchIds = user.role === "BRANCH_MANAGER" ? await getAuthorizedBranchIds(user) : []
  const allowed = plan
    ? canViewPlan(
        user,
        { schoolId: plan.schoolId, branchId: plan.branchId, createdById: plan.createdById },
        authorizedBranchIds
      )
    : false
  if (!plan || !allowed) redirect("/improvement-plans")

  // المؤشر المرتبط بلا فجوة (العمود القائم indicatorId — نفس نمط صفحة الطباعة السابقة)
  const linkedIndicator = !plan.gap?.indicator && plan.indicatorId
    ? (await getIndicatorLabels([plan.indicatorId])).get(plan.indicatorId)
    : undefined
  const indicatorCode = plan.gap?.indicator?.code || linkedIndicator?.code || null
  const indicatorDescription = plan.gap?.indicator?.description || linkedIndicator?.description || null

  // المرحلة التعليمية: مرحلة المدرسة المخزنة أولًا وإلا مرحلة التقييم المرتبط
  const stageText = plan.school.educationalStage || getStageLabel(plan.assessment?.stage)

  const printedAt = fmtDateTime(new Date())
  const kindLabel = planKindLabel(plan.kind)

  // ترقيم متسلسل للأقسام — الأقسام المشروطة (التحليل/الدعم) إن غابت بياناتها لا تُرقّم
  // فيقفز الرقم، بل يبقى التسلسل متصلاً كوثيقة رسمية
  const hasAnalysis = !!(plan.reasons || plan.strengths || plan.improvements)
  const hasSupport = !!(plan.requiredSupport || plan.followUpMethod || plan.impactNotes)
  const ORDINALS = ["أولاً", "ثانياً", "ثالثاً", "رابعاً", "خامساً", "سادساً", "سابعاً"] as const
  let ordIdx = 0
  const nextOrdinal = () => ORDINALS[ordIdx++] ?? ""
  const ordData = nextOrdinal()
  const ordGoal = nextOrdinal()
  const ordKpi = nextOrdinal()
  const ordAnalysis = hasAnalysis ? nextOrdinal() : null
  const ordActions = nextOrdinal()
  const ordFollowUps = nextOrdinal()
  const ordSupport = hasSupport ? nextOrdinal() : null

  return (
    <div className="doc-shell" dir="rtl">
      <style>{`
        @page { size: A4 portrait; margin: 12mm 11mm 14mm; }

        /* معاينة الشاشة: الورقة موسّطة على خلفية رمادية — كلها تختفي عند الطباعة */
        .doc-shell { min-height: 100vh; background: #eef1f4; padding: 24px 16px 40px; }
        .doc-sheet {
          max-width: 210mm; margin: 0 auto; background: #ffffff;
          padding: 36px 42px 28px; box-shadow: 0 2px 14px rgba(7, 59, 67, 0.14);
        }

        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #073B43; padding-bottom: 14px; }
        .school-name { font-size: 20px; font-weight: 700; color: #073B43; }
        .doc-kind { font-size: 14px; font-weight: 700; color: #ffffff; background: #073B43; padding: 6px 14px; border-radius: 6px; }
        .doc-meta-line { font-size: 12px; color: #64748B; }

        .plan-title { font-size: 22px; font-weight: 700; color: #172B36; text-align: center; margin: 18px 0 4px; }
        .plan-subtitle { text-align: center; font-size: 12px; color: #64748B; margin-bottom: 14px; }

        .print-strip { display: flex; flex-wrap: wrap; gap: 6px 22px; border: 1px solid #d7dee5; border-right: 4px solid #079FDF; background: #f8fafb; padding: 8px 12px; font-size: 12px; color: #172B36; margin-bottom: 6px; }
        .print-strip b { font-weight: 700; color: #073B43; }

        .section-title { font-size: 15px; font-weight: 700; color: #073B43; margin: 22px 0 10px; border-right: 4px solid #2878B8; padding-right: 10px; page-break-after: avoid; break-after: avoid; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; table-layout: fixed; }
        th, td { border: 1px solid #d7dee5; padding: 6px 8px; text-align: right; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; }
        th { background-color: #f4f6fb; color: #172B36; font-weight: 700; }
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }

        td.lbl, th.lbl { background-color: #f4f6fb; color: #64748B; font-weight: 600; width: 15%; font-size: 11px; }

        .para { font-size: 13px; line-height: 1.9; margin: 0 0 10px; white-space: pre-line; }
        .para-label { font-size: 12px; font-weight: 700; color: #073B43; margin: 10px 0 2px; }
        .muted { color: #94A3B8; }
        .avoid-break { page-break-inside: avoid; break-inside: avoid; }

        .sign-grid { display: flex; justify-content: space-between; gap: 40px; margin-top: 8px; }
        .sign-cell { flex: 1; text-align: center; font-size: 12px; color: #172B36; }
        .sign-line { margin-top: 26px; border-bottom: 1px dotted #64748B; height: 20px; }
        .sign-role { font-size: 11px; color: #64748B; margin-top: 4px; }

        .doc-footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #d7dee5; font-size: 10.5px; color: #94A3B8; text-align: center; }

        @media print {
          .no-print { display: none !important; }
          html, body { background: #ffffff !important; }
          .doc-shell { padding: 0 !important; background: #ffffff !important; min-height: auto !important; }
          .doc-sheet { max-width: none !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* شريط أدوات الشاشة فقط — لا يدخل الطباعة أبدًا */}
      <div className="no-print" style={{ maxWidth: "210mm", margin: "0 auto 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <PrintButton />
        <Link href={`/improvement-plans/${plan.id}`} className="text-sm text-slate-500 hover:underline">
          ← العودة إلى صفحة الخطة
        </Link>
      </div>

      <div className="doc-sheet">
        {/* ترويسة الوثيقة — شعار المدرسة وبياناتها كما هي مخزنة (بلا شعار مؤقت) */}
        <div className="doc-header">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0 }}>
            {plan.school.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={plan.school.logoUrl} alt={`شعار ${plan.school.name}`} style={{ width: 64, height: 64, objectFit: "contain", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: "#f4f6fb", display: "flex", alignItems: "center", justifyContent: "center", color: "#073B43", fontWeight: 700, fontSize: 26, flexShrink: 0 }}>
                {plan.school.name.charAt(0)}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="school-name">{plan.school.name}</div>
              {(plan.school.governorate || plan.school.city) && (
                <div className="doc-meta-line">{[plan.school.governorate, plan.school.city].filter(Boolean).join(" — ")}</div>
              )}
              <div className="doc-meta-line">
                الفرع: {plan.branch?.name || "كامل المدرسة"}
                {stageText ? <> • المرحلة: {stageText}</> : null}
              </div>
              {plan.academicYear?.label && <div className="doc-meta-line">العام الدراسي: {plan.academicYear.label}</div>}
            </div>
          </div>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <div className="doc-kind">{kindLabel}</div>
          </div>
        </div>

        {/* عنوان الخطة ومعرّفها */}
        <h1 className="plan-title">{plan.title}</h1>
        <p className="plan-subtitle">
          {plan.assessment?.cycle ? <>دورة التقويم: {plan.assessment.cycle} • </> : null}
          نسبة الإنجاز: {plan.progress}%
        </p>

        {/* بيانات الطباعة — الهوية من الجلسة المصادَقة، لا اسم ثابت */}
        <div className="print-strip avoid-break">
          <span><b>طُبعت بواسطة:</b> {user.name}</span>
          <span><b>تاريخ ووقت الطباعة:</b> {printedAt}</span>
          <span><b>حالة الخطة:</b> {statusLabel(plan.status)}</span>
        </div>

        {/* أولاً: بيانات الخطة */}
        <div className="section-title">{ordData}: بيانات الخطة</div>
        <table className="avoid-break">
          <tbody>
            <tr>
              <td className="lbl">نوع الخطة</td>
              <td style={{ width: "35%" }}>{kindLabel}</td>
              <td className="lbl">الأولوية</td>
              <td>{priorityLabel(plan.priority)}</td>
            </tr>
            <tr>
              <td className="lbl">المؤشر المستهدف</td>
              <td colSpan={3}>
                {indicatorCode ? <span style={{ fontFamily: "monospace", color: "#2878B8", fontWeight: 600 }}>{indicatorCode}</span> : null}
                {indicatorCode && indicatorDescription ? " — " : null}
                {indicatorDescription || <span className="muted">غير محدد</span>}
              </td>
            </tr>
            {plan.gap && (
              <tr>
                <td className="lbl">الفجوة المستهدفة</td>
                <td colSpan={3}>
                  {plan.gap.description}
                  <span className="muted"> (درجة الفجوة: {severityLabel(plan.gap.severity)})</span>
                </td>
              </tr>
            )}
            <tr>
              <td className="lbl">المدرسة / الفرع</td>
              <td style={{ width: "35%" }}>{plan.school.name}{plan.branch ? ` — ${plan.branch.name}` : " — كامل المدرسة"}</td>
              <td className="lbl">المرحلة التعليمية</td>
              <td>{stageText || "غير محدد"}</td>
            </tr>
            <tr>
              <td className="lbl">مُعد الخطة</td>
              <td style={{ width: "35%" }}>{plan.createdBy?.name ?? "غير محدد"}</td>
              <td className="lbl">العام الدراسي / الدورة</td>
              <td>{plan.academicYear?.label ?? "غير محدد"}{plan.assessment?.cycle ? ` / ${plan.assessment.cycle}` : ""}</td>
            </tr>
            <tr>
              <td className="lbl">تاريخ البدء</td>
              <td style={{ width: "35%" }}>{fmtDate(plan.startDate)}</td>
              <td className="lbl">تاريخ الإنجاز المستهدف</td>
              <td>{fmtDate(plan.targetDate)}</td>
            </tr>
            {plan.completedAt && (
              <tr>
                <td className="lbl">تاريخ الإنهاء الفعلي</td>
                <td colSpan={3}>{fmtDate(plan.completedAt)}</td>
              </tr>
            )}
            {plan.evidenceScore !== null && plan.evidenceScore !== undefined && (
              <tr>
                <td className="lbl">الدرجة المرجعية عند الإنشاء</td>
                <td colSpan={3}>{plan.evidenceScore}%</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ثانياً: الهدف ووصف الخطة */}
        <div className="section-title">{ordGoal}: الهدف ووصف الخطة</div>
        <div className="avoid-break">
          <p className="para-label">الهدف من الخطة</p>
          <p className="para">{plan.objective || <span className="muted">غير مسجل</span>}</p>
          <p className="para-label">وصف الخطة</p>
          <p className="para">{plan.description || <span className="muted">غير مسجل</span>}</p>
        </div>

        {/* ثالثاً: مؤشرات النجاح ومعايير الحكم */}
        <div className="section-title">{ordKpi}: مؤشرات النجاح ومعايير الحكم</div>
        <table className="avoid-break">
          <tbody>
            <tr>
              <td className="lbl">مؤشر الأداء (KPI)</td>
              <td>{plan.kpiName || <span className="muted">غير محدد</span>}</td>
            </tr>
            <tr>
              <th style={{ width: "33.4%" }}>النسبة الأساسية</th>
              <th style={{ width: "33.3%" }}>النسبة المستهدفة</th>
              <th>النسبة المقاسة حالياً</th>
            </tr>
            <tr style={{ textAlign: "center" }}>
              <td style={{ textAlign: "center", fontWeight: 700 }}>{plan.baseline !== null && plan.baseline !== undefined ? `${plan.baseline}%` : "—"}</td>
              <td style={{ textAlign: "center", fontWeight: 700, color: "#2878B8" }}>{plan.targetPercentage !== null && plan.targetPercentage !== undefined ? `${plan.targetPercentage}%` : "—"}</td>
              <td style={{ textAlign: "center", fontWeight: 700, color: "#0E7A4D" }}>{plan.currentMeasured !== null && plan.currentMeasured !== undefined ? `${plan.currentMeasured}%` : "—"}</td>
            </tr>
            <tr>
              <td className="lbl">معايير النجاح</td>
              <td colSpan={2}>{plan.successCriteria || <span className="muted">غير مسجلة</span>}</td>
            </tr>
          </tbody>
        </table>

        {/* رابعاً: تحليل الأداء الحالي — يظهر فقط بحقولته المحفوظة */}
        {ordAnalysis && (
          <>
            <div className="section-title">{ordAnalysis}: تحليل الأداء الحالي</div>
            <div className="avoid-break">
              {plan.reasons && (<><p className="para-label">الأسباب</p><p className="para">{plan.reasons}</p></>)}
              {plan.strengths && (<><p className="para-label">نقاط القوة</p><p className="para">{plan.strengths}</p></>)}
              {plan.improvements && (<><p className="para-label">جوانب التحسين</p><p className="para">{plan.improvements}</p></>)}
            </div>
          </>
        )}

        {/* خامساً: إجراءات التنفيذ — المسؤول والتواريخ والحالة كما حُفظت */}
        <div className="section-title">{ordActions}: إجراءات التنفيذ</div>
        {plan.actions.length === 0 ? (
          <p className="para muted">لا توجد إجراءات مسجلة.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "5%" }}>م</th>
                <th style={{ width: "30%" }}>الإجراء</th>
                <th style={{ width: "13%" }}>المسؤول</th>
                <th style={{ width: "12%" }}>تاريخ البدء</th>
                <th style={{ width: "12%" }}>تاريخ الاستحقاق</th>
                <th style={{ width: "12%" }}>الحالة</th>
                <th style={{ width: "11%" }}>الإنجاز</th>
              </tr>
            </thead>
            <tbody>
              {plan.actions.map((a, i) => (
                <tr key={a.id}>
                  <td style={{ textAlign: "center" }}>{i + 1}</td>
                  <td>
                    {a.title}
                    {a.description ? <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{a.description}</div> : null}
                  </td>
                  <td>{a.responsible?.name ?? "—"}</td>
                  <td>{a.startDate ? fmtDate(a.startDate) : "—"}</td>
                  <td>{a.dueDate ? fmtDate(a.dueDate) : "—"}</td>
                  <td>{actionStatusLabel(a.status)}</td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{a.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* سادساً: سجل المتابعة وقياس الأثر */}
        <div className="section-title">{ordFollowUps}: سجل المتابعة وقياس الأثر</div>
        {plan.followUps.length === 0 ? (
          <p className="para muted">لا توجد متابعات مسجلة.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "17%" }}>التاريخ</th>
                <th style={{ width: "17%" }}>بواسطة</th>
                <th>ملاحظة المتابعة</th>
                <th style={{ width: "10%" }}>التقدم</th>
              </tr>
            </thead>
            <tbody>
              {plan.followUps.map(fu => (
                <tr key={fu.id}>
                  <td>{fmtDate(fu.createdAt)}</td>
                  <td>{fu.createdBy?.name ?? "—"}</td>
                  <td>{fu.note}</td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{fu.progress !== null && fu.progress !== undefined ? `${fu.progress}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* سابعاً: الدعم المطلوب وآلية المتابعة والأثر — يظهر فقط بحقولته المحفوظة */}
        {ordSupport && (
          <>
            <div className="section-title">{ordSupport}: الدعم المطلوب وآلية المتابعة والأثر</div>
            <div className="avoid-break">
              {plan.requiredSupport && (<><p className="para-label">الدعم المطلوب</p><p className="para">{plan.requiredSupport}</p></>)}
              {plan.followUpMethod && (<><p className="para-label">آلية المتابعة</p><p className="para">{plan.followUpMethod}</p></>)}
              {plan.impactNotes && (<><p className="para-label">ملاحظات الأثر</p><p className="para">{plan.impactNotes}</p></>)}
            </div>
          </>
        )}

        {/* الاعتماد — اسم مُعد الخطة من البيانات المخزنة والتوقيعات فراغات رسمية */}
        <div className="section-title">الاعتماد</div>
        <div className="avoid-break">
          <div className="sign-grid">
            <div className="sign-cell">
              <div>مُعد الخطة: <b>{plan.createdBy?.name ?? "غير محدد"}</b></div>
              <div className="sign-line"></div>
              <div className="sign-role">التوقيع</div>
            </div>
            <div className="sign-cell">
              <div>اعتماد مدير المدرسة</div>
              <div className="sign-line"></div>
              <div className="sign-role">التوقيع</div>
            </div>
          </div>
        </div>

        <div className="doc-footer">
          صدرت هذه الوثيقة من منصة يُسر للتقويم المدرسي الداخلي — طُبعت بواسطة {user.name} بتاريخ {printedAt}
        </div>
      </div>
    </div>
  )
}