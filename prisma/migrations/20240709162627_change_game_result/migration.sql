/*
  Warnings:

  - The `pointsBlack` column on the `GameDetails` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `pointsWhite` column on the `GameDetails` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "GameDetails" DROP COLUMN "pointsBlack",
ADD COLUMN     "pointsBlack" DOUBLE PRECISION,
DROP COLUMN "pointsWhite",
ADD COLUMN     "pointsWhite" DOUBLE PRECISION;
