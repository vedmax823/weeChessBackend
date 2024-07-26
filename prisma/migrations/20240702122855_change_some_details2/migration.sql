/*
  Warnings:

  - You are about to drop the column `blackStartedAt` on the `GameDetails` table. All the data in the column will be lost.
  - You are about to drop the column `whiteStartedAt` on the `GameDetails` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GameDetails" DROP COLUMN "blackStartedAt",
DROP COLUMN "whiteStartedAt",
ADD COLUMN     "blackLastMoveAt" TIMESTAMP(3),
ADD COLUMN     "whiteLastMoveAt" TIMESTAMP(3);
