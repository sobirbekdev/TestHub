-- DropForeignKey
ALTER TABLE "test_questions" DROP CONSTRAINT "test_questions_questionId_fkey";

-- AlterTable
ALTER TABLE "test_questions" ADD COLUMN     "correctAnswer" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "scorePoint" DOUBLE PRECISION,
ALTER COLUMN "questionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "pdfUrl" TEXT;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
