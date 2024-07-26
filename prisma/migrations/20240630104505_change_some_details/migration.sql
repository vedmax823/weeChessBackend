/*
  Warnings:

  - A unique constraint covering the columns `[gameId]` on the table `GameDetails` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GameDetails" ALTER COLUMN "whiteStartedAt" DROP NOT NULL,
ALTER COLUMN "blackStartedAt" DROP NOT NULL,
ALTER COLUMN "moves" DROP NOT NULL,
ALTER COLUMN "lastMove" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GameDetails_gameId_key" ON "GameDetails"("gameId");
