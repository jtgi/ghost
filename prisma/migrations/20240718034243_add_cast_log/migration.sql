/*
  Warnings:

  - Added the required column `castContent` to the `CastLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hash` to the `CastLog` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CastLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hash" TEXT NOT NULL,
    "castContent" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CastLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CastLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CastLog" ("createdAt", "id", "teamId", "updatedAt", "userId") SELECT "createdAt", "id", "teamId", "updatedAt", "userId" FROM "CastLog";
DROP TABLE "CastLog";
ALTER TABLE "new_CastLog" RENAME TO "CastLog";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
