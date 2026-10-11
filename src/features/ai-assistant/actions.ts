"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import { getDashboardContext } from "./services/context"

const SYSTEM_PROMPT = `You are the YUSR Quality Assistant, an AI integrated into a professional school quality management platform.
Your role is to analyze quality assessment data, gaps, and improvement plans.
Rules:
1. Communicate exclusively in professional Modern Standard Arabic.
2. NEVER invent official quality scores, accreditation percentages, or weights. Use only the provided metrics.
3. Distinguish clearly between "Platform Data" (facts), "AI Analysis", and "AI Recommendations".
4. Use neutral terminology (e.g., "مؤشرات لم يثبت تحققها" instead of "فشل").
5. If data is insufficient, explicitly state that.
Format your response cleanly using Markdown.`

export async function generateAIResponse(userMessage: string) {
  const apiKey = process.env.GEMINI_API_KEY

  // التحقق من وجود المفتاح وصحته (مفاتيح جوجل تبدأ بـ AIza)
  if (!apiKey || !apiKey.startsWith("AIza")) {
    return `**تنبيه:** المساعد الذكي لا يعمل حالياً لعدم وجود مفتاح API صالح.
يرجى التأكد من إضافة مفتاح Google Gemini الصحيح (والذي يبدأ بـ AIza) في ملف .env`
  }

  const context = await getDashboardContext()

  if (!context) {
    return "لا توجد بيانات كافية أو لا تمتلك الصلاحيات للقيام بهذا التحليل."
  }

  try {
    // تهيئة عميل Google Gemini
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }) // نموذج سريع ومجاني

    // دمج التعليمات والبيانات والسؤال في رسالة واحدة
    const prompt = `
 ${SYSTEM_PROMPT}

--- بيانات السياق المعتمدة (Context Data) ---
 ${JSON.stringify(context, null, 2)}

--- سؤال المستخدم ---
 ${userMessage}
`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    return text || "لم أتمكن من إنشاء رد."
  } catch (error) {
    console.error("Google Gemini API Error:", error)
    return "تعذر تشغيل المساعد الذكي حاليًا بسبب خطأ في الاتصال بخادم Google. تأكد من صلاحية المفتاح واتصال الإنترنت."
  }
}