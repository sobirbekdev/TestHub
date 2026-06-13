-- Group curator
ALTER TABLE "groups" ADD COLUMN "curatorId" INTEGER;
ALTER TABLE "groups" ADD CONSTRAINT "groups_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TestGroup open window
ALTER TABLE "test_groups" ADD COLUMN "startsAt" TIMESTAMP(3);
ALTER TABLE "test_groups" ADD COLUMN "endsAt" TIMESTAMP(3);
