import { mockSchools } from "@/data/mock-schools"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { MoreVertical } from "lucide-react"
import { formatDate } from "@/lib/utils"

export function SchoolsTable() {
  const statusVariant: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
    ACTIVE: 'success',
    SUSPENDED: 'danger',
    EXPIRED: 'warning',
    PENDING: 'neutral'
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right">
        <thead className="text-xs text-muted-foreground bg-surface-muted uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium rounded-r-lg">المدرسة</th>
            <th scope="col" className="px-4 py-3 font-medium">الحالة</th>
            <th scope="col" className="px-4 py-3 font-medium">الفروع</th>
            <th scope="col" className="px-4 py-3 font-medium">تقدم التقييم</th>
            <th scope="col" className="px-4 py-3 font-medium">درجة الجودة</th>
            <th scope="col" className="px-4 py-3 font-medium">الاشتراك</th>
            <th scope="col" className="px-4 py-3 font-medium">آخر تقييم</th>
            <th scope="col" className="px-4 py-3 font-medium rounded-l-lg">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {mockSchools.map((school) => (
            <tr key={school.id} className="hover:bg-surface-muted transition-colors">
              <td className="px-4 py-4 font-medium text-foreground whitespace-nowrap">{school.name}</td>
              <td className="px-4 py-4">
                <Badge variant={statusVariant[school.status] || 'neutral'}>
                  {school.status === 'ACTIVE' ? 'نشط' : school.status === 'SUSPENDED' ? 'موقوف' : school.status === 'EXPIRED' ? 'منتهي' : 'قيد الانتظار'}
                </Badge>
              </td>
              <td className="px-4 py-4 text-muted-foreground">{school.branchCount}</td>
              <td className="px-4 py-4 min-w-[120px]">
                <div className="flex items-center gap-2">
                  <Progress value={school.assessmentProgress} className="h-1.5" />
                  <span className="text-xs text-muted-foreground w-8">{school.assessmentProgress}%</span>
                </div>
              </td>
              <td className="px-4 py-4">
                <span className={school.qualityScore >= 80 ? "text-success font-bold" : school.qualityScore >= 60 ? "text-warning font-bold" : "text-danger font-bold"}>
                  {school.qualityScore ? `${school.qualityScore}%` : '-'}
                </span>
              </td>
              <td className="px-4 py-4 text-muted-foreground">{school.subscriptionStatus}</td>
              <td className="px-4 py-4 text-muted-foreground whitespace-nowrap">{formatDate(school.lastAssessment)}</td>
              <td className="px-4 py-4">
                <button className="text-muted-foreground hover:text-foreground">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}