"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const serviceController_1 = __importDefault(require("./serviceController"));
const prisma = new client_1.PrismaClient();
class ConnectionService {
    async disconnectUser(user, userSocketMap, socketId, io) {
        try {
            if (userSocketMap.has(user.id) &&
                userSocketMap.get(user.id) === socketId) {
                userSocketMap.delete(user.id);
            }
            if (!user || !user.id)
                return;
            const game = await prisma.game.findFirst({
                where: {
                    OR: [{ playerOneId: user.id }, { playerTwoId: user.id }],
                    NOT: { playerTwoId: null },
                    ifFinished: false,
                },
                include: { gameDetails: true },
            });
            if (!game || !game.gameDetails || game.ifFinished)
                return;
            console.log('user disconnected', user);
            const timeLeftObj = await serviceController_1.default.calculateTimeAndUpdate(game.gameDetails, game.id, io);
            if (!timeLeftObj)
                return;
            const newGameDetails = await prisma.gameDetails.update({
                where: { gameId: game.id },
                data: {
                    blackUserDisconnectedAt: user.id === game.gameDetails.blackUserId
                        ? new Date()
                        : game.gameDetails.blackUserDisconnectedAt,
                    whiteUserDisconnectedAt: user.id === game.gameDetails.whiteUserId
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
        }
        catch (err) {
            console.log(err);
        }
    }
    async deleteDisconnect(user, io) {
        try {
            if (!user || !user.id)
                return;
            const game = await prisma.game.findFirst({
                where: {
                    OR: [{ playerOneId: user.id }, { playerTwoId: user.id }],
                    NOT: { playerTwoId: null },
                    ifFinished: false,
                },
                include: { gameDetails: true },
            });
            if (!game || !game.gameDetails || game.ifFinished)
                return;
            const timeLeftObj = await serviceController_1.default.calculateTimeAndUpdate(game.gameDetails, game.id, io);
            if (!timeLeftObj)
                return;
            const newGameDetails = await prisma.gameDetails.update({
                where: { gameId: game.id },
                data: {
                    blackUserDisconnectedAt: user.id === game.gameDetails.blackUserId
                        ? null
                        : game.gameDetails.blackUserDisconnectedAt,
                    whiteUserDisconnectedAt: user.id === game.gameDetails.whiteUserId
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
        }
        catch (err) {
            console.log(err);
        }
    }
}
exports.default = new ConnectionService();
