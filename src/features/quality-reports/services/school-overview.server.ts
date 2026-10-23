// ===== FILE: src/features/quality-reports/services/school-overview.server.ts =====
// ============================================================
// school-overview.server.ts — محمّل خادمي لملخصات أداء المدارس
// (لوحة مدير النظام + صفحة «عرض جميع المدارس» + صفحة تفاصيل المدرسة)
// ============================================================
// الحراسة: مدير النظام فقط (SUPER_ADMIN) — كل الدوال تعيد null لغيره
// وترمي لا شيء؛ الصفحات تحوّل غير المصرّح لهم بهدوء (نمط quality/page.tsx).
// القراءة فقط: لا كتابة ولا إنشاء ولا تعديل في أي دالة هنا (رقابة قراءة فقط).
//
// منع N+1: كل بيانات المنصة تُقرأ في دفعة واحدة (5 استعلامات مستقلة على
// الأكثر، ثم تجميع في الذاكرة) — لا استعلام لكل مدرسة إطلاقًا:
//   1) prisma.school.findMany          — المدارس + عدد فروع كل مدرسة (._count)
//   2) prisma.assessment.findMany      — المكتملة التشغيلية + صفوفها المتحققة
//                                        (select أدنى: evidenceId + مجال/محور الشاهد)
//   3) prisma.assessment.groupBy       — عدّ الجارية لكل مدرسة
//   4) prisma.domain.findMany          — إطار التقويم الرسمي (مصدر واحد)
//   5) prisma.fixedEvidence.count      — حجم البنك (مقام التغطية)
//
// فلاتر النطاق مطابقة حرفيًا لبطاقة التقويم الرسمية (getWeightedCardData):
//   type: { not: "PRIVATE_REVIEW" } + status: "COMPLETED" للاحتساب —
//   فتتفق أرقام البطاقات مع أرقام صفحة التفاصيل والتقارير الرسمية.
// الحساب نفسه كله في school-overview.ts النقية فوق weighted-score.ts.
// ============================================================

import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/permissions"
import {
  buildSchoolPerformanceSummary,
  sortSchoolSummaries,
  type SchoolCompletedAssessmentInput,
  type SchoolPerformanceSummary,
} from "./school-overview"

// ------------------------------------------------------------
// الأنواع المُعادة للصفحات
// ------------------------------------------------------------

export interface PlatformKpis {
  totalSchools: number
  totalBranches: number
  activeAssessments: number
  completedAssessments: number
}

export interface SchoolsOverviewData {
  kpis: PlatformKpis
  /** مرتبة عربيًا (نفس ترتيب صفحة عرض الجميع) */
  schools: SchoolPerformanceSummary[]
}

export interface SchoolDetailAssessmentRow {
  id: string
  status: string
  stage: string | null
  branchName: string | null
  assessorName: string | null
  startedAt: string
  completedAt: string | null
}

export interface SchoolDetailData {
  school: {
    id: string
    name: string
    nameEn: string | null
    logoUrl: string | null
    location: string
    city: string | null
    governorate: string | null
    educationalStage: string | null
    status: string
  }
  branchCount: number
  summary: SchoolPerformanceSummary
  /** أحدث التقييمات (تشغيلية + خاصة بمقيّم النظام وفق قواعد القراءة القائمة) */
  assessments: SchoolDetailAssessmentRow[]
}

// ------------------------------------------------------------
// ملخصات كل المدارس — اللوحة الرئيسية + صفحة عرض الجميع
// ------------------------------------------------------------

/**
 * null = المتصل ليس مدير النظام (الصفحة تحوّله بهدوء).
 * لا تُرمى أخطاء صلاحيات — قارئ اللوحة صفحة اتجاهية فقط.
 */
export async function getSchoolsOverview(): Promise<SchoolsOverviewData | null> {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") return null

  // --- الدفعة الواحدة (لا N+1) ---
  const [schools, completedAssessments, inProgressGroups, officialDomains, totalBankEvidence] =
    await Promise.all([
      prisma.school.findMany({
        select: {
          id: true,
          name: true,
          nameEn: true,
          logoUrl: true,
          status: true,
          _count: { select: { branches: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.assessment.findMany({
        where: { type: { not: "PRIVATE_REVIEW" }, status: "COMPLETED" },
        select: {
          id: true,
          schoolId: true,
          completedAt: true,
          evidenceResponses: {
            where: { isVerified: true },
            // evidenceId + مجال/محور الشاهد: الحد الأدنى الذي تتطلبه طبقة الحساب
            // (تفريد الشواهد + إسناد المجال) — بلا أي حقول زائدة
            select: {
              evidenceId: true,
              evidence: { select: { indicator: { select: { domainId: true, axisId: true } } } },
            },
          },
        },
      }),
      prisma.assessment.groupBy({
        by: ["schoolId"],
        where: { type: { not: "PRIVATE_REVIEW" }, status: "IN_PROGRESS" },
        _count: { _all: true },
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

  // --- تجميع في الذاكرة ---
  const inProgressBySchool = new Map<string, number>()
  for (const g of inProgressGroups) {
    inProgressBySchool.set(g.schoolId, g._count._all)
  }

  const completedBySchool = new Map<string, SchoolCompletedAssessmentInput[]>()
  for (const a of completedAssessments) {
    const list = completedBySchool.get(a.schoolId) ?? []
    list.push({
      id: a.id,
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
      evidenceResponses: a.evidenceResponses,
    })
    completedBySchool.set(a.schoolId, list)
  }

  const framework = { officialDomains, totalBankEvidence }

  const summaries = schools.map(s =>
    buildSchoolPerformanceSummary(
      { id: s.id, name: s.name, nameEn: s.nameEn, logoUrl: s.logoUrl, status: s.status },
      completedBySchool.get(s.id) ?? [],
      inProgressBySchool.get(s.id) ?? 0,
      framework
    )
  )

  let totalBranches = 0
  for (const s of schools) totalBranches += s._count.branches

  return {
    kpis: {
      totalSchools: schools.length,
      totalBranches,
      activeAssessments: inProgressGroups.reduce((sum, g) => sum + g._count._all, 0),
      completedAssessments: completedAssessments.length,
    },
    schools: sortSchoolSummaries(summaries),
  }
}

// ------------------------------------------------------------
// تفاصيل مدرسة واحدة — صفحة «شاهد المزيد» (رقابة قراءة فقط)
// ------------------------------------------------------------

/**
 * null = غير مصرّح (ليس مدير النظام) أو المدرسة غير موجودة —
 * الصفحة تعرض حالة «غير متاحة» بهدوء بدل شاشة خطأ.
 */
export async function getSuperAdminSchoolDetail(schoolId: string): Promise<SchoolDetailData | null> {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") return null

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      nameEn: true,
      logoUrl: true,
      location: true,
      city: true,
      governorate: true,
      educationalStage: true,
      status: true,
      _count: { select: { branches: true } },
    },
  })
  if (!school) return null

  // نفس الدفعة المعتمدة على مستوى المدرسة الواحدة (ثلاثة استعلامات مستقلة)
  const [completedAssessments, inProgressCount, officialDomains, totalBankEvidence, latestAssessments] =
    await Promise.all([
      prisma.assessment.findMany({
        where: { schoolId, type: { not: "PRIVATE_REVIEW" }, status: "COMPLETED" },
        select: {
          id: true,
          completedAt: true,
          evidenceResponses: {
            where: { isVerified: true },
            select: {
              evidenceId: true,
              evidence: { select: { indicator: { select: { domainId: true, axisId: true } } } },
            },
          },
        },
      }),
      prisma.assessment.count({
        where: { schoolId, type: { not: "PRIVATE_REVIEW" }, status: "IN_PROGRESS" },
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
      prisma.assessment.findMany({
        where: { schoolId, type: { not: "PRIVATE_REVIEW" } },
        select: {
          id: true,
          status: true,
          stage: true,
          startedAt: true,
          completedAt: true,
          branch: { select: { name: true } },
          assessor: { select: { name: true } },
        },
        orderBy: { startedAt: "desc" },
        take: 10,
      }),
    ])

  const summary = buildSchoolPerformanceSummary(
    {
      id: school.id,
      name: school.name,
      nameEn: school.nameEn,
      logoUrl: school.logoUrl,
      status: school.status,
    },
    completedAssessments.map(a => ({
      id: a.id,
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
      evidenceResponses: a.evidenceResponses,
    })),
    inProgressCount,
    { officialDomains, totalBankEvidence }
  )

  return {
    school: {
      id: school.id,
      name: school.name,
      nameEn: school.nameEn,
      logoUrl: school.logoUrl,
      location: school.location,
      city: school.city,
      governorate: school.governorate,
      educationalStage: school.educationalStage,
      status: school.status,
    },
    branchCount: school._count.branches,
    summary,
    assessments: latestAssessments.map(a => ({
      id: a.id,
      status: a.status,
      stage: a.stage ?? null,
      branchName: a.branch?.name ?? null,
      assessorName: a.assessor?.name ?? null,
      startedAt: a.startedAt.toISOString(),
      completedAt: a.completedAt ? a.completedAt.toISOString() : null,
    })),
  }
}