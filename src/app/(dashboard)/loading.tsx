import { DashboardSkeleton } from "@/components/ui/Skeleton"

export default function Loading() {
  return (
    <div className="px-4 py-6 lg:px-10 lg:py-8">
      <DashboardSkeleton />
    </div>
  )
}