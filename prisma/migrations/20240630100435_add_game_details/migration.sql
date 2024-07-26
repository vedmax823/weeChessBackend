-- CreateTable
CREATE TABLE "GameDetails" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "whiteUserId" TEXT NOT NULL,
    "blackUserId" TEXT NOT NULL,
    "turn" TEXT NOT NULL DEFAULT 'white',
    "whiteStartedAt" TIMESTAMP(3) NOT NULL,
    "blackStartedAt" TIMESTAMP(3) NOT NULL,
    "timeLeftWhite" INTEGER NOT NULL DEFAULT 60,
    "timeLeftBlack" INTEGER NOT NULL DEFAULT 60,
    "moves" JSONB NOT NULL,
    "lastMove" TEXT NOT NULL,
    "currentPosition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameDetails_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GameDetails" ADD CONSTRAINT "GameDetails_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
