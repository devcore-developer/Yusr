// ===== FILE: src/features/quality-reports/services/school-manager-overview.server.ts =====
// ============================================================
// school-manager-overview.server.ts — محمّل خادمي لملخص أداء مدرسة
// مدير المدرسة (لوحة /school-manager — نفس منهجية لوحة مدير النظام)
// ============================================================
// الغرض: مصدر حساب واحد لنسب لوحة مدير المدرسة. لا توجد هنا أي معادلة
// جديدة إطلاقًا: الحساب كله في الطبقة النقية المُختبَرة
//   buildSchoolPerformanceSummary (school-overview.ts ← weighted-score.ts)
// حرفيًا كما في لوحة مدير النظام وصفحة تفاصيل المدرسة وبطاقة التقويم
// الرسمية — فتتطابق أرقام لوحة مدير المدرسة معها على نفس البيانات:
//   - درجة كل تقييم مستقلة (تفريد الشواهد داخليًا — صفوف الزيارات المتكررة
//     لنفس الشاهد لا تُعدّ أكثر من مرة — إصلاح التضخم حتى 700%)
//   - درجة المدرسة = متوسط النتائج المرجحة للتقييمات المستقلة (لا دمج صفوف
//     عبر التقييمات — العيب الذي كان يولّد نسبًا فوق 100% كلما تعددت)
//   - الأوزان الرسمية (20/30/40/10) تُطبَّق مرة واحدة داخل computeWeightedOverall
//   - درجات المجالات مستقلة قبل الأوزان (حصّة المجال المرجحة لا تُعرض كنسبة)
//   - تغطية الشواهد حقل مستقل عن الدرجة المرجحة (اتحاد مميز ÷ إجمالي البنك)
//   - بلا تقييم مكتمل → null في كل شيء (لا أصفار مصنوعة — «غير مقيم»)
//
// الحراسة (نفس قواعد القراءة القائمة في permissions.ts):
//   - SCHOOL_MANAGER حصرًا: نطاقه القرائي «كل تقييمات مدرسته عدا الخاصة» —
//     وهو حرفيًا نطاق هذا الملخص (schoolId من مستخدم الجلسة، وليس من الطلب).
//   - BRANCH_MANAGER وغيره من الأدوار → null: لوحة مدير المدرسة تبقي سلوكها
//     القائم لهم (هذا المحمّل لا يغيّر أي دور آخر إطلاقًا).
//   - بلا schoolId أو المدرسة غير موجودة → null (الصفحة تعرض حالة فارغة بهدوء).
//
// فلاتر النطاق مطابقة حرفيًا لبطاقة التقويم الرسمية (getWeightedCardData)
// وللمحمّلَي الخادميَين في school-overview.server.ts:
//   type: { not: "PRIVATE_REVIEW" } + status: "COMPLETED" للاحتساب
//   و status: "IN_PROGRESS" لعدّ الجارية — فلا انفصام بين أرقام اللوحة
//   وأرقام التقارير الرسمية لنفس المدرسة.
//
// القراءة فقط: لا كتابة ولا إنشاء ولا تعديل في أي سطر هنا. خمسة استعلامات
// مستقلة دفعة واحدة (بلا N+1 — مستوى مدرسة واحدة)، ثم الحساب في الذاكرة
// داخل الطبقة النقية فوق weighted-score.ts.
// ============================================================

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import {
  buildSchoolPerformanceSummary,
  type SchoolCompletedAssessmentInput,
  type SchoolPerformanceSummary,
} from "./school-overview"

// ------------------------------------------------------------
// النتيجة المُعادة للوحة
// ------------------------------------------------------------

export interface SchoolManagerOverviewData {
  school: {
    id: string
    name: string
    nameEn: string | null
    logoUrl: string | null
    status: string
    branchCount: number
  }
  /** الملخص الرسمي المختبَر — الدرجة المرجحة + المجالات قبل الأوزان + التغطية + العدادات */
  summary: SchoolPerformanceSummary
}

/**
 * ملخص أداء مدرسة مدير الجلسة — null لغير مدير مدرسة مصرّح، أو بلا مدرسة
 * مرتبطة، أو إذا لم توجد المدرسة. لا تُرمى أخطاء صلاحيات (نمط
 * school-overview.server.ts: الصفحة تحوّل بهدوء بدل شاشة خطأ).
 */
export async function getSchoolManagerOverview(): Promise<SchoolManagerOverviewData | null> {
  const user = await getCurrentUser()
  if (!user || user.role !== "SCHOOL_MANAGER" || !user.schoolId) return null

  // --- الدفعة الواحدة (5 استعلامات مستقلة — بلا N+1) ---
  const [school, completedAssessments, inProgressCount, officialDomains, totalBankEvidence] =
    await Promise.all([
      prisma.school.findUnique({
        where: { id: user.schoolId },
        select: {
          id: true,
          name: true,
          nameEn: true,
          logoUrl: true,
          status: true,
          _count: { select: { branches: true } },
        },
      }),
      prisma.assessment.findMany({
        where: { schoolId: user.schoolId, type: { not: "PRIVATE_REVIEW" }, status: "COMPLETED" },
        select: {
          id: true,
          completedAt: true,
          evidenceResponses: {
            where: { isVerified: true },
            // evidenceId + مجال/محور الشاهد: الحد الأدنى الذي تتطلبه طبقة الحساب
            // (تفريد الشواهد + إسناد المجال) — بلا أي حقول زائدة (نفس نمط
            // school-overview.server.ts حرفيًا)
            select: {
              evidenceId: true,
              evidence: { select: { indicator: { select: { domainId: true, axisId: true } } } },
            },
          },
        },
      }),
      prisma.assessment.count({
        where: { schoolId: user.schoolId, type: { not: "PRIVATE_REVIEW" }, status: "IN_PROGRESS" },
      }),
      prisma.domain.findMany({
        select: {
          id: true,
          name: true,
          indicators: {
            select: {
              id: true,
              domainId: true,
              axisId: true,
              axis: { select: { name: true } },
              fixedEvidence: { select: { id: true } },
            },
          },
        },
      }),
      prisma.fixedEvidence.count(),
    ])

  // المدرسة غير موجودة (حساب مستخدم يتيم) — حالة فارغة بهدوء، لا خطأ
  if (!school) return null

  // --- الحساب: الطبقة الرسمية المختبَرة نفسها المستخدمة في لوحة مدير النظام ---
  const summary = buildSchoolPerformanceSummary(
    {
      id: school.id,
      name: school.name,
      nameEn: school.nameEn,
      logoUrl: school.logoUrl,
      status: school.status,
    },
    completedAssessments.map(
      (a): SchoolCompletedAssessmentInput => ({
        id: a.id,
        completedAt: a.completedAt ? a.completedAt.toISOString() : null,
        evidenceResponses: a.evidenceResponses,
      })
    ),
    inProgressCount,
    { officialDomains, totalBankEvidence }
  )

  return {
    school: {
      id: school.id,
      name: school.name,
      nameEn: school.nameEn,
      logoUrl: school.logoUrl,
      status: school.status,
      branchCount: school._count.branches,
    },
    summary,
  }
}