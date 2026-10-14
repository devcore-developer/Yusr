import { prisma } from "@/lib/prisma"

type Intent = "IDENTITY" | "COUNT_SCHOOLS" | "COUNT_BRANCHES" | "COUNT_USERS" | "GAPS_LIST" | "PLANS_DELAYED" | "GENERAL"

interface RouterResult {
  intent: Intent
  response: string | null // إذا كان هناك إجابة حتمية، تُرجع هنا ونتخطى الـ AI
  contextData?: any // إذا كنا نحتاج الـ AI لتلخيص بيانات معقدة
}

export function classifyIntent(message: string): Intent {
  const msg = message.toLowerCase().trim()
  
  if (msg.includes("اسم النظام") || msg.includes("اسم البرنامج") || msg.includes("من انتي") || msg.includes("من انت") || msg.includes("اسمك ايه")) {
    return "IDENTITY"
  }
  if (msg.includes("كام مدرسة") || msg.includes("عدد المدارس") || msg.includes("عندنا كام مدرسة")) {
    return "COUNT_SCHOOLS"
  }
  if (msg.includes("كام فرع") || msg.includes("عدد الفروع") || msg.includes("عندنا كام فرع")) {
    return "COUNT_BRANCHES"
  }
  if (msg.includes("كام مستخدم") || msg.includes("عدد المستخدمين")) {
    return "COUNT_USERS"
  }
  if (msg.includes("الفجوات") || msg.includes("اهم الفجوات") || msg.includes("ما هي الفجوات")) {
    return "GAPS_LIST"
  }
  if (msg.includes("خطط التحسين") || msg.includes("الخطط المتأخرة") || msg.includes("خطط متأخرة")) {
    return "PLANS_DELAYED"
  }
  
  return "GENERAL"
}

export async function handleDeterministicIntent(intent: Intent, user: any): Promise<RouterResult> {
  switch (intent) {
    case "IDENTITY":
      return { intent, response: "أنت بتستخدم منصة يُسر للتقويم المدرسي الداخلي (YUSR)." }

    case "COUNT_SCHOOLS":
      if (user.role === "SUPER_ADMIN") {
        const count = await prisma.school.count()
        return { intent, response: `عدد المدارس المسجلة في المنصة هو ${count} مدرسة.` }
      }
      if (user.role === "SCHOOL_MANAGER") {
        return { intent, response: "أنت تدير مدرسة واحدة مسجلة على المنصة ضمن نطاق حسابك." }
      }
      return { intent, response: "لا تمتلك الصلاحية لعرض العدد الإجمالي للمدارس." }

    case "COUNT_BRANCHES":
      if (user.role === "SUPER_ADMIN") {
        const count = await prisma.branch.count()
        return { intent, response: `إجمالي الفروع المسجلة في المنصة هو ${count} فرع.` }
      }
      if (user.role === "SCHOOL_MANAGER" && user.schoolId) {
        const count = await prisma.branch.count({ where: { schoolId: user.schoolId } })
        return { intent, response: `مدرستك تمتلك ${count} فرع مسجل.` }
      }
      if (user.role === "BRANCH_MANAGER") {
        return { intent, response: "أنت تدير فرع واحد ضمن حسابك." }
      }
      return { intent, response: "لا تمتلك الصلاحية لعرض الفروع." }

    case "COUNT_USERS":
      if (user.role === "SUPER_ADMIN") {
        const count = await prisma.user.count()
        return { intent, response: `يوجد ${count} مستخدم مسجل في المنصة.` }
      }
      if (user.role === "SCHOOL_MANAGER" && user.schoolId) {
        const count = await prisma.user.count({ where: { schoolId: user.schoolId } })
        return { intent, response: `يوجد ${count} مستخدم مسجل في مدرستك.` }
      }
      return { intent, response: "لا تمتلك الصلاحية لعرض عدد المستخدمين." }

    case "GAPS_LIST":
      const gapWhere: any = { status: "OPEN", assessment: { type: "NORMAL" } }
      if (user.role === "SCHOOL_MANAGER") gapWhere.schoolId = user.schoolId
      if (user.role === "BRANCH_MANAGER") gapWhere.branchId = user.branchId
      if (user.role === "QUALITY_ASSESSOR") gapWhere.assessment = { assessorId: user.id, type: "NORMAL" }

      const gaps = await prisma.gap.findMany({
        where: gapWhere,
        take: 5,
        include: { indicator: true },
        orderBy: { createdAt: "desc" }
      })

      if (gaps.length === 0) {
        return { intent, response: "مفيش فجوات مسجلة حاليًا في التقييمات المتاحة لحسابك. ده مش معناه بالضرورة إن مفيش فجوات فعلية، خصوصًا لو التقييم لسه غير مكتمل." }
      }
      
      let gapsText = "أهم الفجوات المسجلة حاليًا:\n"
      gaps.forEach(g => {
        gapsText += `- **${g.indicator.code}**: ${g.description} (الأولوية: ${g.severity})\n`
      })
      return { intent, response: gapsText }

    case "PLANS_DELAYED":
      const planWhere: any = { status: { not: "COMPLETED" }, targetDate: { lt: new Date() } }
      if (user.role === "SCHOOL_MANAGER") planWhere.schoolId = user.schoolId
      if (user.role === "BRANCH_MANAGER") planWhere.branchId = user.branchId

      const delayedPlans = await prisma.improvementPlan.findMany({
        where: planWhere,
        take: 5,
        include: { gap: { include: { indicator: true } } }
      })

      if (delayedPlans.length === 0) {
        return { intent, response: "لا توجد خطط تحسين متأخرة في نطاقك حالياً." }
      }

      let plansText = "خطط التحسين المتأخرة:\n"
      delayedPlans.forEach(p => {
        plansText += `- **${p.title}** (المستهدف: ${new Date(p.targetDate).toLocaleDateString('ar-SA')}) - ${p.progress}% مكتمل\n`
      })
      return { intent, response: plansText }

    default:
      return { intent: "GENERAL", response: null }
  }
}