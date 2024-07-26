import { PrismaClient } from "@prisma/client";
import { Server } from "socket.io";
import serviceController from "./serviceController";

const prisma = new PrismaClient();

class ConnectionService {
  public async disconnectUser(
    user: Express.User,
    userSocketMap: Map<string, string>,
    socketId: string,
    io: Server
  ) {
    try {
      if (
        userSocketMap.has(user.id) &&
        userSocketMap.get(user.id) === socketId
      ) {
        userSocketMap.delete(user.id);
      }

      if (!user || !user.id) return;
      const game = await prisma.game.findFirst({
        where: {
          OR: [{ playerOneId: user.id }, { playerTwoId: user.id }],
          NOT: { playerTwoId: null },
          ifFinished: false,
        },
        include: { gameDetails: true },
      });

      if (!game || !game.gameDetails || game.ifFinished) return;

      console.log('user disconnected', user)

      const timeLeftObj = await serviceController.calculateTimeAndUpdate(
        game.gameDetails,
        game.id,
        io
      );

      if (!timeLeftObj) return;

      const newGameDetails = await prisma.gameDetails.update({
        where: { gameId: game.id },
        data: {

          blackUserDisconnectedAt:
            user.id === game.gameDetails.blackUserId
              ? new Date()
              : game.gameDetails.blackUserDisconnectedAt,
          whiteUserDisconnectedAt:
            user.id === game.gameDetails.whiteUserId
              ? new Date()
              : game.gameDetails.whiteUserDisconnectedAt,
        },
      });

      io.to(game.id).emit("move", {
        ...newGameDetails,
        timeLeftWhite: timeLeftObj.timeLeftWhite,
        timeLeftBlack: timeLeftObj.timeLeftBlack,
        timeLeftWhiteToReconnect: timeLeftObj.timeLeftWhiteToReconnect,
        timeLeftBlackToReconnect: timeLeftObj.timeLeftBlackToReconnect,
      });
    } catch (err) {
      console.log(err);
    }
  }

  public async deleteDisconnect(user: Express.User, io: Server) {
    try {
      if (!user || !user.id) return;
      const game = await prisma.game.findFirst({
        where: {
          OR: [{ playerOneId: user.id }, { playerTwoId: user.id }],
          NOT: { playerTwoId: null },
          ifFinished: false,
        },
        include: { gameDetails: true },
      });

      if (!game || !game.gameDetails || game.ifFinished) return;

      const timeLeftObj = await serviceController.calculateTimeAndUpdate(
        game.gameDetails,
        game.id,
        io
      );

      if (!timeLeftObj) return;

      const newGameDetails = await prisma.gameDetails.update({
        where: { gameId: game.id },
        data: {
          blackUserDisconnectedAt:
            user.id === game.gameDetails.blackUserId
              ? null
              : game.gameDetails.blackUserDisconnectedAt,
          whiteUserDisconnectedAt:
            user.id === game.gameDetails.whiteUserId
              ? null
              : game.gameDetails.whiteUserDisconnectedAt,
        },
      });

      io.to(game.id).emit("move", {
        ...newGameDetails,
        timeLeftWhite: timeLeftObj.timeLeftWhite,
        timeLeftBlack: timeLeftObj.timeLeftBlack,
        timeLeftWhiteToReconnect: timeLeftObj.timeLeftWhiteToReconnect,
        timeLeftBlackToReconnect: timeLeftObj.timeLeftBlackToReconnect,
      });
    } catch (err) {
      console.log(err);
    }
  }
}

export default new ConnectionService();
