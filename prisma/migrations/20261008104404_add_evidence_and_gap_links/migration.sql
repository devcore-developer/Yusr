/*
  Warnings:

  - Made the column `assessmentId` on table `Gap` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Gap" DROP CONSTRAINT "Gap_assessmentId_fkey";

-- DropIndex
DROP INDEX "AssessmentResponse_assessmentId_idx";

-- DropIndex
DROP INDEX "AssessmentResponse_indicatorId_idx";

-- DropIndex
DROP INDEX "Gap_branchId_idx";

-- AlterTable
ALTER TABLE "Gap" ADD COLUMN     "responseId" TEXT,
ALTER COLUMN "assessmentId" SET NOT NULL;

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evidence_responseId_idx" ON "Evidence"("responseId");

-- CreateIndex
CREATE INDEX "Evidence_assessmentId_idx" ON "Evidence"("assessmentId");

-- CreateIndex
CREATE INDEX "Gap_assessmentId_idx" ON "Gap"("assessmentId");

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gap" ADD CONSTRAINT "Gap_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AssessmentResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AssessmentResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
