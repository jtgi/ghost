/*
  Warnings:

  - A unique constraint covering the columns `[userId,teamId]` on the table `Grant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Grant_userId_teamId_key" ON "Grant"("userId", "teamId");
