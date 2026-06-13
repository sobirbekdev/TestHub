-- AlterTable
ALTER TABLE "answers" ADD COLUMN "orderNo" INTEGER;
ALTER TABLE "answers" ADD COLUMN "scorePoint" DOUBLE PRECISION;
ALTER TABLE "answers" ALTER COLUMN "questionId" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "answers" DROP CONSTRAINT "answers_questionId_fkey";

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable test_questions make questionId nullable
ALTER TABLE "test_questions" ALTER COLUMN "questionId" DROP NOT NULL;

-- DropForeignKey test_questions
ALTER TABLE "test_questions" DROP CONSTRAINT IF EXISTS "test_questions_questionId_fkey";

-- AddForeignKey test_questions
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "answers_attemptId_orderNo_key" ON "answers"("attemptId", "orderNo") WHERE "orderNo" IS NOT NULL;
