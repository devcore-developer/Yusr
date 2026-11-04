-- ============================================================
-- Migration: add_plan_evidence (التحسين 7 — رفع الشواهد داخل خطط التحسين)
-- إضافة فقط (additive-only): جدول جديد + علاقتا ربط — لا حذف، لا تعديل أعمدة
-- قائمة، لا فقدان بيانات. كل الخطط والمرفقات القائمة كما هي 100%.
-- ============================================================

-- جدول شواهد خطط التحسين — كل صف = ملف شاهد واحد مرتبط بخطة واحدة
CREATE TABLE "ImprovementPlanEvidence" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImprovementPlanEvidence_pkey" PRIMARY KEY ("id")
);

-- فهرس الاسترجاع الأساسي (قائمة شواهد الخطة)
CREATE INDEX "ImprovementPlanEvidence_planId_idx" ON "ImprovementPlanEvidence"("planId");

-- العلاقة بالخطة: حذف الخطة يحذف شواهدها (نفس سلوك ImprovementAction القائم)
ALTER TABLE "ImprovementPlanEvidence" ADD CONSTRAINT "ImprovementPlanEvidence_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ImprovementPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- العلاقة بالرافع: حذف المستخدم لا يحذف الشاهد (SetNull — نفس سلوك AssessmentAttachment القائم)
ALTER TABLE "ImprovementPlanEvidence" ADD CONSTRAINT "ImprovementPlanEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;