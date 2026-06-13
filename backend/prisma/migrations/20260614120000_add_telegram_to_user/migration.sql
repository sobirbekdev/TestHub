-- AlterTable
ALTER TABLE "users" ADD COLUMN "telegramId" BIGINT;
ALTER TABLE "users" ADD COLUMN "telegramUsername" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");
