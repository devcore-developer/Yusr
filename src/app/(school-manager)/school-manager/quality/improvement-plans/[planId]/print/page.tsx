import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PrintButton } from "@/components/reports/PrintButton"

export default async function PrintPlanPage({ params }: { params: { planId: string } }) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const plan = await prisma.improvementPlan.findUnique({
    where: { id: params.planId },
    include: { 
      actions: true, 
      school: true, 
      branch: true, 
      indicator: true, 
      gap: { include: { indicator: true } } 
    } as any // تجاوز خطأ TypeScript المؤقت للعلاقات
  })

  if (!plan) redirect("/")

  const planData = plan as any
  const indicatorCode = planData.indicator?.code || planData.gap?.indicator?.code || "غير محدد"

  return (
    <div className="bg-white text-black p-8 md:p-12" dir="rtl">
      <style>{`
        @media print { .no-print { display: none !important; } }
        @page { size: A4; margin: 15mm; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        th { background-color: #f4f6fb; }
        .section-title { font-size: 18px; font-weight: 700; color: #0C3740; margin-top: 24px; margin-bottom: 12px; border-right: 4px solid #079FDF; padding-right: 8px; }
      `}</style>

      <div className="no-print mb-8">
        <PrintButton />
      </div>

      <h1 className="text-2xl font-bold text-[#0C3740] mb-2">{planData.title}</h1>
      <p className="text-sm text-gray-600 mb-6">{planData.school.name} - {planData.branch?.name || "كامل المدرسة"}</p>

      <div className="section-title">تفاصيل الخطة</div>
      <table>
        <tbody>
          <tr><th>المؤشر المستهدف</th><td>{indicatorCode}</td></tr>
          <tr><th>تاريخ البدء</th><td>{new Date(planData.startDate).toLocaleDateString('ar-SA')}</td></tr>
          <tr><th>تاريخ الانتهاء</th><td>{new Date(planData.targetDate).toLocaleDateString('ar-SA')}</td></tr>
          <tr><th>الحالة</th><td>{planData.status === 'COMPLETED' ? 'مكتملة' : planData.status === 'ACTIVE' ? 'جارية' : 'مسودة'}</td></tr>
        </tbody>
      </table>

      <div className="section-title">تحليل الأداء</div>
      <p><strong>الأسباب:</strong> {planData.reasons || "غير محدد"}</p>
      <p><strong>نقاط القوة:</strong> {planData.strengths || "غير محدد"}</p>
      <p><strong>جوانب التحسين:</strong> {planData.improvements || "غير محدد"}</p>

      <div className="section-title">مؤشرات النجاح</div>
      <table>
        <thead><tr><th>الأساسي</th><th>المستهدف</th><th>المقاس حالياً</th></tr></thead>
        <tbody>
          <tr>
            <td>{planData.baseline || 0}%</td>
            <td>{planData.targetPercentage || 0}%</td>
            <td>{planData.currentMeasured || 0}%</td>
          </tr>
        </tbody>
      </table>

      <div className="section-title">إجراءات التحسين</div>
      <table>
        <thead>
          <tr>
            <th>الإجراء</th>
            <th>تاريخ البدء</th>
            <th>تاريخ الانتهاء</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {planData.actions.map((a: any) => (
            <tr key={a.id}>
              <td>{a.title}</td>
              <td>{a.startDate ? new Date(a.startDate).toLocaleDateString('ar-SA') : "-"}</td>
              <td>{a.dueDate ? new Date(a.dueDate).toLocaleDateString('ar-SA') : "-"}</td>
              <td>
                {a.status === 'COMPLETED' ? 'مكتملة' : 
                 a.status === 'IN_PROGRESS' ? 'جارية' : 
                 a.status === 'DELAYED' ? 'متعثرة' : 'لم يبدأ'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}