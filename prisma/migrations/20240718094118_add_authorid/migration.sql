/*
  Warnings:

  - You are about to drop the column `userId` on the `CastLog` table. All the data in the column will be lost.
  - Added the required column `ghostwriterId` to the `CastLog` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CastLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hash" TEXT NOT NULL,
    "castContent" TEXT NOT NULL,
    "ghostwriterId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CastLog_ghostwriterId_fkey" FOREIGN KEY ("ghostwriterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CastLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CastLog" ("castContent", "createdAt", "hash", "id", "teamId", "updatedAt") SELECT "castContent", "createdAt", "hash", "id", "teamId", "updatedAt" FROM "CastLog";
DROP TABLE "CastLog";
ALTER TABLE "new_CastLog" RENAME TO "CastLog";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
