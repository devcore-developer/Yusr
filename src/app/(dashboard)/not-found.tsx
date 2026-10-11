import { EmptyState } from "@/components/ui/EmptyState"
import { FileQuestion } from "lucide-react"
import { Button } from "@/components/ui/Button"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="px-4 py-6 lg:px-10 lg:py-8">
      <EmptyState
        icon={<FileQuestion />}
        title="الصفحة غير موجودة"
        description="عذراً، الصفحة التي تبحث عنها غير متوفرة أو تم نقلها."
        action={{ label: "العودة للوحة التحكم", href: "/", icon: undefined }}
      />
    </div>
  )
}