"use server"

import { getDashboardContext } from "./services/context"
import { getAIProvider } from "./services/provider"
import { classifyIntent, handleDeterministicIntent } from "./services/router"
import { getCurrentUser } from "@/lib/permissions"

const SYSTEM_PROMPT = `You are the YUSR Quality Assistant. 
Answer concisely and naturally in Egyptian/Standard Arabic. 
Do not use rigid headers like "AI Analysis" unless explicitly asked.
If data is provided in the context, use it strictly. Do not invent data.`

export async function generateAIResponse(userMessage: string) {
  const user = await getCurrentUser()
  if (!user) return "يجب تسجيل الدخول لاستخدام المساعد."

  // 1. تصنيف السؤال والتحقق مما إذا كان يمكن الرد عليه حتمياً (استعلام مباشر)
  const intent = classifyIntent(userMessage)
  const deterministicResult = await handleDeterministicIntent(intent, user)

  // 2. إذا كان هناك رد حتمي (مثل عدد المدارس)، أرجعه فوراً دون استدعاء الـ AI
  if (deterministicResult.response) {
    return deterministicResult.response
  }

  // 3. للأسئلة العامة، اجلب السياق ومرره للـ AI
  const context = await getDashboardContext()
  const provider = getAIProvider()
  const systemContext = `${SYSTEM_PROMPT}\n\n--- بيانات السياق ---\n${JSON.stringify(context, null, 2)}`
  
  try {
    const response = await provider.generateResponse(userMessage, systemContext)
    return response || "لم أتمكن من إنشاء رد."
  } catch (error) {
    console.error("AI Provider Error:", error)
    return "تعذر تشغيل المساعد الذكي حاليًا. يرجى المحاولة مرة أخرى لاحقاً."
  }
}