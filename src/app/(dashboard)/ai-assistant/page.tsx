import { getCurrentUser } from "@/lib/permissions"
import { PageHeader } from "@/components/layout/PageHeader"
import { ChatInterface } from "@/features/ai-assistant/components/ChatInterface"
import { Sparkles } from "lucide-react"

export default async function AIAssistantPage() {
  const user = await getCurrentUser()
  if (!user) return null

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="المساعد الذكي للجودة"
        description="تحليل بيانات الجودة واقتراح خطوات التحسين"
        breadcrumbs={[{ label: 'الرئيسية', href: '/' }, { label: 'المساعد الذكي' }]}
      />
      <ChatInterface />
    </div>
  )
}