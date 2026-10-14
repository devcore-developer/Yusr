import { GoogleGenerativeAI } from "@google/generative-ai"
import { AIProvider } from "./provider" // تأكد من أن المسار يطابق واجهة AIProvider الخاصة بك

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not set. Gemini provider will not be available.")
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export const GeminiProvider: AIProvider = {
  async generateResponse(prompt: string, context: string): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      return "نموذج Gemini غير مُهيأ. يرجى التأكد من إضافة مفتاح API في إعدادات الخادم."
    }

    try {
      // استخدام النموذج المتاح في الطبقة المجانية
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
      
      const fullPrompt = `
        أنت مساعد ذكي لإدارة الجودة التعليمية في منصة يُسر.
        استخدم سياق البيانات التالي للإجابة على سؤال المستخدم.
        لا تخترع أي مؤشرات أو نتائج تقييم غير موجودة في السياق.
        إذا لم تكن البيانات متوفرة، اذكر ذلك بوضوح.
        أجب باللغة العربية وبشكل مهني ومنظم.
        
        سياق البيانات:
        ${context}
        
        سؤال المستخدم:
        ${prompt}
      `

      const result = await model.generateContent(fullPrompt)
      const response = await result.response
      const text = response.text()
      
      return text
    } catch (error: any) {
      console.error("Gemini API Error:", error)
      
      // التعامل مع استنفاد حصة الطبقة المجانية (Quota Exceeded)
      if (error?.status === 429 || error?.message?.includes("quota")) {
        return "عذراً، تم تجاوز الحصة المحددة للطبقة المجانية من Gemini حالياً. يرجى المحاولة لاحقاً."
      }
      
      return "حدث خطأ أثناء الاتصال بنموذج Gemini. يرجى المحاولة مرة أخرى."
    }
  }
}