import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"

// ============================================================
// Enhancement 6 — تحويل مسار الطباعة القديم (مسار مدير المدرسة)
// إلى الوثيقة الرسمية المعزولة
// ============================================================
// وثيقة الطباعة الاحترافية أصبحت صفحة أعلى المستوى خارج هيكل التطبيق:
//   /print/improvement-plans/[planId]
// (app/print/...) — يغلّفها التخطيط الجذري فقط، فلا يُطبع معها
// الشريط الجانبي أو العلوي أو التبويبات أو أي واجهة تطبيق.
// هذا المسار القديم يُبقى حتى تظل أي روابط قائمة تشير إليه تعمل،
// والمسار الجديد يفرض نفس قاعدة الوصول canViewPlan على الخادم.
// ============================================================

export default async function LegacySchoolManagerPlanPrintRedirectPage({ params }: { params: { planId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  redirect(`/print/improvement-plans/${params.planId}`)
}