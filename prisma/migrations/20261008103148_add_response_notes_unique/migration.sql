/*
  Warnings:

  - A unique constraint covering the columns `[assessmentId,indicatorId]` on the table `AssessmentResponse` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `AssessmentResponse` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AssessmentResponse" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResponse_assessmentId_indicatorId_key" ON "AssessmentResponse"("assessmentId", "indicatorId");
