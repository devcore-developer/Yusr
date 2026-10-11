import * as React from "react"
import { ChartCard } from "./ChartCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { StatusBadge } from "@/components/ui/Badge"
import { School as SchoolIcon, ChevronLeft, MapPin } from "lucide-react"
import Link from "next/link"
import { formatDate } from "@/lib/utils"

interface RecentSchool {
  id: string
  name: string
  location: string
  status: string
  createdAt: Date | string
  _count: { branches: number; users: number }
}

interface RecentSchoolsProps {
  schools: RecentSchool[]
}

export function RecentSchools({ schools }: RecentSchoolsProps) {
  return (
    <ChartCard
      title="أحدث المدارس المنضمّة"
      icon={<SchoolIcon />}
      action={
        schools.length > 0 ? (
          <Link href="/schools" className="text-[13px] font-medium text-secondary hover:text-secondary-600 flex items-center gap-1 transition-smooth">
            عرض الكل
            <ChevronLeft className="w-4 h-4" />
          </Link>
        ) : undefined
      }
    >
      {schools.length === 0 ? (
        <EmptyState
          icon={<SchoolIcon />}
          title="لا توجد مدارس مسجلة"
          description="ستظهر المدارس الجديدة هنا بمجرد تسجيلها."
          compact
          action={{ label: "إضافة مدرسة", href: "/schools/add" }}
        />
      ) : (
        <ul className="space-y-1 -mx-2">
          {schools.map((school) => (
            <li key={school.id}>
              <Link
                href={`/schools/${school.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-muted transition-smooth group"
              >
                {/* Avatar/Logo */}
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">
                  {school.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground-strong truncate group-hover:text-secondary transition-smooth">
                    {school.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[12px] text-muted-foreground truncate">{school.location}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 shrink-0 text-[12px] text-muted-foreground">
                  <span className="numeric">{school._count.branches} فروع</span>
                  <span className="numeric">{school._count.users} مستخدم</span>
                </div>

                {/* Status */}
                <StatusBadge status={school.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  )
}