/*
  Warnings:

  - You are about to drop the column `value` on the `AssessmentResponse` table. All the data in the column will be lost.
  - You are about to drop the column `indicatorId` on the `Evidence` table. All the data in the column will be lost.
  - You are about to drop the column `responseId` on the `Evidence` table. All the data in the column will be lost.
  - You are about to drop the column `responseId` on the `Gap` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `School` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[schoolCode]` on the table `School` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_actorId_fkey";

-- DropForeignKey
ALTER TABLE "Assessment" DROP CONSTRAINT "Assessment_assessorId_fkey";

-- DropForeignKey
ALTER TABLE "Assessment" DROP CONSTRAINT "Assessment_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "Evidence" DROP CONSTRAINT "Evidence_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "Evidence" DROP CONSTRAINT "Evidence_responseId_fkey";

-- DropForeignKey
ALTER TABLE "Evidence" DROP CONSTRAINT "Evidence_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "Gap" DROP CONSTRAINT "Gap_assessmentId_fkey";

-- DropForeignKey
ALTER TABLE "Gap" DROP CONSTRAINT "Gap_responseId_fkey";

-- DropForeignKey
ALTER TABLE "Gap" DROP CONSTRAINT "Gap_schoolId_fkey";

-- DropForeignKey
ALTER TABLE "ImprovementFollowUp" DROP CONSTRAINT "ImprovementFollowUp_actionId_fkey";

-- DropForeignKey
ALTER TABLE "ImprovementFollowUp" DROP CONSTRAINT "ImprovementFollowUp_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ImprovementPlan" DROP CONSTRAINT "ImprovementPlan_createdById_fkey";

-- DropForeignKey
ALTER TABLE "ImprovementPlan" DROP CONSTRAINT "ImprovementPlan_schoolId_fkey";

-- DropIndex
DROP INDEX "Assessment_branchId_idx";

-- DropIndex
DROP INDEX "Assessment_schoolId_idx";

-- DropIndex
DROP INDEX "Evidence_responseId_idx";

-- AlterTable
ALTER TABLE "Activity" ALTER COLUMN "actorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "cycle" TEXT DEFAULT '2024-2025',
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'NORMAL',
ALTER COLUMN "assessorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AssessmentResponse" DROP COLUMN "value";

-- AlterTable
ALTER TABLE "Evidence" DROP COLUMN "indicatorId",
DROP COLUMN "responseId",
ALTER COLUMN "uploadedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Gap" DROP COLUMN "responseId";

-- AlterTable
ALTER TABLE "ImprovementFollowUp" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ImprovementPlan" ADD COLUMN     "baseline" DOUBLE PRECISION,
ADD COLUMN     "currentMeasured" DOUBLE PRECISION,
ADD COLUMN     "followUpMethod" TEXT,
ADD COLUMN     "impactNotes" TEXT,
ADD COLUMN     "improvements" TEXT,
ADD COLUMN     "indicatorId" TEXT,
ADD COLUMN     "kpiName" TEXT,
ADD COLUMN     "reasons" TEXT,
ADD COLUMN     "requiredSupport" TEXT,
ADD COLUMN     "strengths" TEXT,
ADD COLUMN     "successCriteria" TEXT,
ADD COLUMN     "targetPercentage" DOUBLE PRECISION,
ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Indicator" ADD COLUMN     "coverage" TEXT DEFAULT 'مغطى',
ADD COLUMN     "evidenceCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paragraphCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "guidePage" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "School" DROP COLUMN "email",
ADD COLUMN     "academicYear" TEXT,
ADD COLUMN     "address" TEXT,
ADD COLUMN     "administrativeStaffCount" INTEGER,
ADD COLUMN     "alternativePhone" TEXT,
ADD COLUMN     "buildingCount" INTEGER,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'مصر',
ADD COLUMN     "educationalStage" TEXT,
ADD COLUMN     "establishedYear" INTEGER,
ADD COLUMN     "governorate" TEXT,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "officialEmail" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "schoolCode" TEXT,
ADD COLUMN     "schoolType" TEXT,
ADD COLUMN     "studentCount" INTEGER,
ADD COLUMN     "teacherCount" INTEGER,
ADD COLUMN     "websiteUrl" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AssessmentTool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AssessmentTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedEvidence" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "indicatorCode" TEXT NOT NULL,
    "paragraphNo" INTEGER,
    "paragraphText" TEXT,
    "indicatorId" TEXT NOT NULL,

    CONSTRAINT "FixedEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceResponse" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "visitNumber" INTEGER,
    "scoreValue" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "indicatorId" TEXT,
    "include" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "schoolId" TEXT,
    "generalResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupHistory" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity" TEXT,
    "targetGroup" TEXT,
    "linkedPlanId" TEXT,
    "idea" TEXT,
    "generalGoals" TEXT,
    "specialGoals" TEXT,
    "indicators" JSONB,
    "programs" JSONB,
    "followUp" TEXT,
    "duration" TEXT,
    "evidenceText" TEXT,
    "evidenceUrl" TEXT,
    "impact" TEXT,
    "sustainability" TEXT,
    "improvementPlan" TEXT,
    "schoolId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttachment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IndicatorTools" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTool_name_key" ON "AssessmentTool"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FixedEvidence_code_key" ON "FixedEvidence"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceResponse_assessmentId_evidenceId_visitNumber_key" ON "EvidenceResponse"("assessmentId", "evidenceId", "visitNumber");

-- CreateIndex
CREATE INDEX "AssessmentAttachment_assessmentId_idx" ON "AssessmentAttachment"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentAttachment_evidenceId_idx" ON "AssessmentAttachment"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "_IndicatorTools_AB_unique" ON "_IndicatorTools"("A", "B");

-- CreateIndex
CREATE INDEX "_IndicatorTools_B_index" ON "_IndicatorTools"("B");

-- CreateIndex
CREATE INDEX "Assessment_assessorId_idx" ON "Assessment"("assessorId");

-- CreateIndex
CREATE INDEX "Assessment_schoolId_branchId_status_idx" ON "Assessment"("schoolId", "branchId", "status");

-- CreateIndex
CREATE INDEX "Assessment_cycle_idx" ON "Assessment"("cycle");

-- CreateIndex
CREATE UNIQUE INDEX "School_schoolCode_key" ON "School"("schoolCode");

-- AddForeignKey
ALTER TABLE "FixedEvidence" ADD CONSTRAINT "FixedEvidence_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceResponse" ADD CONSTRAINT "EvidenceResponse_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceResponse" ADD CONSTRAINT "EvidenceResponse_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "FixedEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementPlan" ADD CONSTRAINT "ImprovementPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementPlan" ADD CONSTRAINT "ImprovementPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementFollowUp" ADD CONSTRAINT "ImprovementFollowUp_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ImprovementAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImprovementFollowUp" ADD CONSTRAINT "ImprovementFollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttachment" ADD CONSTRAINT "AssessmentAttachment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttachment" ADD CONSTRAINT "AssessmentAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IndicatorTools" ADD CONSTRAINT "_IndicatorTools_A_fkey" FOREIGN KEY ("A") REFERENCES "AssessmentTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_IndicatorTools" ADD CONSTRAINT "_IndicatorTools_B_fkey" FOREIGN KEY ("B") REFERENCES "Indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
