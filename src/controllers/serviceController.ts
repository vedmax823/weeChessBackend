import { GameDetails, Prisma } from "@prisma/client";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class ServiceController {
  private calculateTime(
    gameDetails: GameDetails
  ): [number, number, Date | null, Date | null, number, number] {
    const whiteLastMoveAt =
      gameDetails.turn === "white" ? new Date() : gameDetails.whiteLastMoveAt;
    const blackLastMoveAt =
      gameDetails.turn === "black" ? new Date() : gameDetails.blackLastMoveAt;

    let whiteSpend = 0;
    let blackSpend = 0;
    let whiteTimeGoneAfterDisconnect = 0;
    let blackTimeGoneAfterDisconnect = 0;

    if (gameDetails.turn === "white") {
      if (!blackLastMoveAt) {
        whiteSpend = Math.floor(
          (new Date().getTime() - gameDetails.createdAt.getTime()) / 100);
        if (gameDetails.whiteUserDisconnectedAt) {
            whiteTimeGoneAfterDisconnect = Math.floor((new Date().getTime() - gameDetails.whiteUserDisconnectedAt.getTime()) / 1000);
        }
      } else {
        whiteSpend = Math.floor((new Date().getTime() - blackLastMoveAt.getTime()) / 100);
        if (gameDetails.whiteUserDisconnectedAt) {
          if (
            gameDetails.whiteUserDisconnectedAt.getTime() >
            blackLastMoveAt.getTime()
          ) {
            whiteTimeGoneAfterDisconnect =
              Math.floor(
                (new Date().getTime() -
                  gameDetails.whiteUserDisconnectedAt.getTime()
              ) / 1000);
          } else {
            whiteTimeGoneAfterDisconnect =
              Math.floor((new Date().getTime() - blackLastMoveAt.getTime()) /
              1000);
          }
        }
      }
    }

    if (gameDetails.turn === "black") {
      blackSpend = Math.floor(
        (new Date().getTime() - whiteLastMoveAt!.getTime()) / 100
      );
      if (gameDetails.blackUserDisconnectedAt) {
        if (
          gameDetails.blackUserDisconnectedAt.getTime() >
          whiteLastMoveAt!.getTime()
        ) {
          blackTimeGoneAfterDisconnect =
            Math.floor(
              (new Date().getTime() -
                gameDetails.blackUserDisconnectedAt.getTime()
        ) / 1000);
        } else {
          blackTimeGoneAfterDisconnect =
            Math.floor((new Date().getTime() - whiteLastMoveAt!.getTime()) / 1000);
        }
      }
    }

    const timeLeftWhite = Math.max(gameDetails.timeLeftWhite - whiteSpend, 0);
    const timeLeftBlack = Math.max(gameDetails.timeLeftBlack - blackSpend, 0);

    const timeLeftWhiteToReconnect = Math.max(
      gameDetails.timeForComeBack - whiteTimeGoneAfterDisconnect,
      0
    );
    const timeLeftBlackToReconnect = Math.max(
      gameDetails.timeForComeBack - blackTimeGoneAfterDisconnect,
      0
    );

    return [
      timeLeftWhite,
      timeLeftBlack,
      whiteLastMoveAt,
      blackLastMoveAt,
      timeLeftWhiteToReconnect,
      timeLeftBlackToReconnect,
    ];
  }

  public async calculateTimeAndUpdate(
    gameDetails: GameDetails,
    gameId: string,
    io: Server
  ) {
    
    const [
      timeLeftWhite,
      timeLeftBlack,
      whiteLastMoveAt,
      blackLastMoveAt,
      timeLeftWhiteToReconnect,
      timeLeftBlackToReconnect,
    ] = this.calculateTime(gameDetails);

    if (!timeLeftWhite || !timeLeftBlack) {
      const [pointsWhite, pointsBlack] = this.makeResultByTime(
        timeLeftWhite,
        timeLeftBlack,
        this.getMovesCount(gameDetails.moves)
      );
      await prisma.gameDetails.update({
        where: { id: gameDetails.id },
        data: {
          timeLeftWhite,
          timeLeftBlack,
          pointsWhite,
          pointsBlack,
          blackUserDisconnectedAt: null,
          whiteUserDisconnectedAt : null,
          drawProposed: null,
          resultExplanation: "time",
        },
      });
      const newGame = await prisma.game.update({
        where: { id: gameId },
        data: { ifFinished: true },
        include: { gameDetails: true, playerOne: true, playerTwo: true },
      });
      io.to(newGame.id).emit("gameResult", newGame);
      return;
    }
    if (!timeLeftWhiteToReconnect || !timeLeftBlackToReconnect) {
      const [pointsWhite, pointsBlack] = this.makeResultByTime(
        timeLeftWhiteToReconnect,
        timeLeftBlackToReconnect,
        this.getMovesCount(gameDetails.moves)
      );
      await prisma.gameDetails.update({
        where: { id: gameDetails.id },
        data: {
          timeLeftWhite,
          timeLeftBlack,
          pointsWhite,
          pointsBlack,
          blackUserDisconnectedAt: null,
          whiteUserDisconnectedAt: null,
          drawProposed: null,
          resultExplanation: "disconnection",
        },
      });
      const newGame = await prisma.game.update({
        where: { id: gameId },
        data: { ifFinished: true },
        include: { gameDetails: true, playerOne: true, playerTwo: true },
      });
      io.to(newGame.id).emit("gameResult", newGame);
      return;
    }
    return {
      timeLeftWhite,
      timeLeftBlack,
      whiteLastMoveAt,
      blackLastMoveAt,
      timeLeftWhiteToReconnect,
      timeLeftBlackToReconnect,
    };
  }

  private makeResultByTime(timeWhite: number, timeBlack: number, movesCount : number): number[] {
    if (movesCount < 3) return [0, 0];
    if (!timeWhite) return [0, 1];
    if (!timeBlack) return [1, 0];
    return [0, 0];
  }

  private getMovesCount(moves : Prisma.JsonValue) : number{
    if (Array.isArray(moves)) return moves.length;
    return 0;
  }
}

export default new ServiceController();
