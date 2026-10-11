import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Select } from "@/components/ui/Select"
import { createPrivateReview } from "./actions"

export default async function NewPrivateReviewPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") redirect("/dashboard")

  const schools = await prisma.school.findMany({ include: { branches: true } })

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="بدء تقييم خاص جديد"
        description="هذا التقييم مستقل تماماً ولا يؤثر على تقارير المدرسة الرسمية أو متوسطاتها."
        breadcrumbs={[{ label: "الرئيسية", href: "/" }, { label: "التقييم الخاص", href: "/private-review" }, { label: "جديد" }]}
      />
      <Card>
        <CardContent className="p-6">
          <form action={createPrivateReview} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">المدرسة المستهدفة</label>
              <Select name="schoolId" required>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">الفرع (اختياري)</label>
              <Select name="branchId">
                <option value="">كامل المدرسة</option>
                {schools.flatMap(s => s.branches).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit">بدء التقييم الخاص</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}