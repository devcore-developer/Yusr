import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

// تعريف واجهة موحدة لجميع المزودين
export interface AIProvider {
  generateResponse: (prompt: string, systemContext: string) => Promise<string>;
}

// 1. Mock Provider (الوضع الافتراضي للتطوير)
const MockProvider: AIProvider = {
  generateResponse: async (prompt: string) => {
    return `[وضع المحاكاة - Mock Mode] تم استلام طلبك بنجاح: "${prompt}". هذا رد تجريبي لاختبار الواجهة دون استهلاك حصة API.`;
  }
};

// 2. OpenAI Provider
function getOpenAIProvider(): AIProvider {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return {
    generateResponse: async (prompt, systemContext) => {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemContext },
            { role: "user", content: prompt }
          ],
        });
        return response.choices[0].message.content || "لم يرد النموذج بأي نص.";
      } catch (error: any) {
        console.error("OpenAI API Error:", error);
        return "حدث خطأ أثناء الاتصال بـ OpenAI.";
      }
    }
  };
}

// 3. Google Gemini Provider
function getGeminiProvider(): AIProvider {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  return {
    generateResponse: async (prompt, systemContext) => {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const fullPrompt = `${systemContext}\n\nسؤال المستخدم: ${prompt}`;
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        return response.text();
      } catch (error: any) {
        console.error("Gemini API Error:", error);
        if (error?.status === 429) return "تم تجاوز الحصة المجانية من Gemini حالياً.";
        return "حدث خطأ أثناء الاتصال بنموذج Gemini.";
      }
    }
  };
}

// 4. Groq Provider (جديد)
function getGroqProvider(): AIProvider {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  // استخدام النموذج المطلوب مع إمكانية تجاوزه عبر متغيرات البيئة
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

  return {
    generateResponse: async (prompt, systemContext) => {
      try {
        // لا نستخدم Streaming للحفاظ على البنية الحالية للواجهة
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: systemContext },
            { role: "user", content: prompt }
          ],
          model: model,
          temperature: 0.7,
          max_tokens: 1024,
        });
        return chatCompletion.choices[0]?.message?.content || "لم يرد النموذج بأي نص.";
      } catch (error: any) {
        console.error("Groq API Error:", error);
        // التعامل مع أخطاء Groq المحددة
        if (error?.status === 429) {
          return "عذراً، تم تجاوز حد الطلبات المسموح به في Groq حالياً. يرجى المحاولة لاحقاً.";
        }
        if (error?.status === 401) {
          return "خطأ في مصادقة Groq. يرجى التحقق من GROQ_API_KEY.";
        }
        return "حدث خطأ أثناء الاتصال بنموذج Groq.";
      }
    }
  };
}

// الدالة الرئيسية لاختيار الموفر
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || "mock";

  switch (provider) {
    case "openai":
      if (process.env.OPENAI_API_KEY) return getOpenAIProvider();
      break;
    case "gemini":
      if (process.env.GEMINI_API_KEY) return getGeminiProvider();
      break;
    case "groq":
      if (process.env.GROQ_API_KEY) return getGroqProvider();
      break;
  }
  
  console.warn("[AI] Provider not configured or invalid key. Falling back to Mock Provider.");
  return MockProvider;
}