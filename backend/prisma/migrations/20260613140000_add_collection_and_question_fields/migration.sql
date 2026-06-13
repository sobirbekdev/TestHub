-- AlterTable
ALTER TABLE "test_questions" ADD COLUMN IF NOT EXISTS "questionText" TEXT;

-- AlterTable
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "collectionName" TEXT,
ADD COLUMN IF NOT EXISTS "coverImage" TEXT,
ADD COLUMN IF NOT EXISTS "telegramId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "answers_attemptId_orderNo_key" ON "answers"("attemptId", "orderNo");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tests_telegramId_key" ON "tests"("telegramId");
