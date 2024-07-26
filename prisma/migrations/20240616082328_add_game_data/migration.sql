-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "timeControl" TEXT NOT NULL,
    "ifFinished" BOOLEAN NOT NULL DEFAULT false,
    "playerOneId" TEXT NOT NULL,
    "playerTwoId" TEXT,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_playerOneId_key" ON "Game"("playerOneId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_playerTwoId_key" ON "Game"("playerTwoId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_playerOneId_fkey" FOREIGN KEY ("playerOneId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_playerTwoId_fkey" FOREIGN KEY ("playerTwoId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
