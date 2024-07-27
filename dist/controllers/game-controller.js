"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const starterposition_1 = require("../data/starterposition");
const serviceController_1 = __importDefault(require("./serviceController"));
const starterposition_2 = require("../data/starterposition");
const prisma = new client_1.PrismaClient();
class GameController {
    async createGame(timeControl, user, io, socketId, userSocketMap) {
        try {
            if (!user)
                return io
                    .to(socketId)
                    .emit("error", { message: "Unauthorized", code: 401 });
            const userId = user.id;
            if (!userId)
                return io
                    .to(socketId)
                    .emit("error", { message: "Unauthorized", code: 401 });
            if (!timeControl)
                return io
                    .to(socketId)
                    .emit("error", { message: "Invalid Time Control", code: 404 });
            const notFinishedGame = await prisma.game.findFirst({
                where: {
                    OR: [{ playerOneId: userId }, { playerTwoId: userId }],
                    NOT: { playerTwoId: null },
                    ifFinished: false,
                },
            });
            // console.log(notFinishedGame);
            if (notFinishedGame) {
                return io.to(socketId).emit("gameStarted", notFinishedGame);
            }
            const gameType = timeControl.replace("min", "| 0");
            const game = await prisma.game.findFirst({
                where: {
                    NOT: {
                        playerOneId: userId,
                    },
                    playerTwoId: null,
                    timeControl: gameType,
                },
            });
            if (game) {
                const updatedGame = await prisma.game.update({
                    where: { id: game.id },
                    data: { playerTwoId: userId },
                });
                await this.createGameDetails(game.playerOneId, userId, game.id, gameType);
                await this.deleteGames(game.playerOneId, userId, game.id, io);
                io.to(socketId).emit("gameStarted", updatedGame);
                const playerOneSocketId = userSocketMap.get(updatedGame.playerOneId);
                // const playerTwoSocketId = userSocketMap.get(userId);
                if (playerOneSocketId)
                    io.to(playerOneSocketId).emit("gameStarted", updatedGame);
                // if (playerTwoSocketId)
                //   io.to(playerTwoSocketId).emit("gameStarted", updatedGame);
                return;
            }
            const exsistGame = await prisma.game.findFirst({
                where: {
                    playerOneId: userId,
                    playerTwoId: null,
                    timeControl: gameType,
                },
            });
            if (exsistGame)
                return io
                    .to(socketId)
                    .emit("error", { message: "Game Already Exists", code: 404 });
            const newGame = await prisma.game.create({
                data: { timeControl: gameType, playerOneId: userId },
                include: { playerOne: true },
            });
            //   console.log(newGame);
            io.emit("newGame", newGame);
        }
        catch (err) {
            io.to(socketId).emit("error", {
                message: "Internal Server Error",
                code: 500,
            });
            console.log(err);
        }
    }
    async joinGame(id, user, io, socketId, userSocketMap) {
        try {
            if (!user)
                return io
                    .to(socketId)
                    .emit("error", { message: "Unauthorized", code: 401 });
            const userId = user.id;
            if (!userId)
                return io
                    .to(socketId)
                    .emit("error", { message: "Unauthorized", code: 401 });
            if (!id)
                return io
                    .to(socketId)
                    .emit("error", { message: "Invalid Game", code: 404 });
            const game = await prisma.game.findFirst({
                where: {
                    id: id,
                    playerTwoId: null,
                    NOT: { playerOneId: userId },
                },
            });
            if (!game)
                return io
                    .to(socketId)
                    .emit("error", { message: `Game doesn't exsist`, code: 404 });
            await this.deleteGames(game.playerOneId, userId, game.id, io);
            const updatedGame = await prisma.game.update({
                where: { id: game.id },
                data: { playerTwoId: userId },
            });
            await this.createGameDetails(game.playerOneId, userId, game.id, game.timeControl);
            const playerOneSocketId = userSocketMap.get(updatedGame.playerOneId);
            if (playerOneSocketId)
                io.to(playerOneSocketId).emit("gameStarted", updatedGame);
            io.to(socketId).emit("gameStarted", updatedGame);
        }
        catch (e) {
            io.to(socketId).emit("error", {
                message: "Internal Server Error",
                code: 500,
            });
            console.log(e);
        }
    }
    async deleteGames(playerOneId, playerTwoId, gameId, io) {
        // console.log(playerOneId, playerTwoId);
        const deletedGames = await prisma.game.findMany({
            where: {
                OR: [{ playerOneId }, { playerOneId: playerTwoId }],
                playerTwoId: null,
            },
        });
        await prisma.game.deleteMany({
            where: {
                OR: [{ playerOneId }, { playerOneId: playerTwoId }],
                playerTwoId: null,
                NOT: { id: gameId },
            },
        });
        const deletedGamesIds = deletedGames.map((game) => game.id);
        return io.emit("deletedGames", deletedGamesIds);
    }
    async makeMove(move, user, io, socketId, userSocketMap) {
        const game = await this.checkUserAndGetGame(user, move.gameId, io, socketId);
        if (!game || !game.gameDetails)
            return io
                .to(socketId)
                .emit("error", { message: "Game not found", code: 404 });
        const gameDetails = game.gameDetails;
        const zeroMove = { ...starterposition_2.startMove, gameId: move.gameId };
        const moves = gameDetails.moves
            ? [...gameDetails.moves, move]
            : [zeroMove, move];
        const timeLeftObj = await serviceController_1.default.calculateTimeAndUpdate(gameDetails, move.gameId, io);
        if (!timeLeftObj)
            return;
        const timeLeftWhite = timeLeftObj.timeLeftWhite +
            (gameDetails.turn === "white" ? gameDetails.additionalTime : 0);
        const timeLeftBlack = timeLeftObj.timeLeftBlack +
            (gameDetails.turn === "black" ? gameDetails.additionalTime : 0);
        const newGameDetails = await prisma.gameDetails.update({
            where: { id: gameDetails.id },
            data: {
                currentPosition: move.position,
                moves: moves,
                lastMove: move.move,
                timeLeftWhite,
                timeLeftBlack,
                whiteLastMoveAt: timeLeftObj.whiteLastMoveAt,
                blackLastMoveAt: timeLeftObj.blackLastMoveAt,
                drawProposed: null,
                turn: gameDetails.turn === "white" ? "black" : "white",
            },
        });
        // io.to().emit()
        const playerOneSocketId = userSocketMap.get(game.playerOneId);
        if (playerOneSocketId)
            io.to(playerOneSocketId).emit("gameStarted", game);
        const playerTwoSocketId = userSocketMap.get(game.playerTwoId);
        if (playerTwoSocketId)
            io.to(playerTwoSocketId).emit("gameStarted", game);
        io.to(game.id).emit("move", {
            ...newGameDetails,
            timeLeftWhiteToReconnect: timeLeftObj.timeLeftWhiteToReconnect,
            timeLeftBlackToReconnect: timeLeftObj.timeLeftBlackToReconnect,
        });
    }
    async createGameDetails(playerOneId, playerTwoId, gameId, timeControl) {
        const whitePlayer = Math.random() > 0.5 ? playerOneId : playerTwoId;
        const blackPlayer = whitePlayer === playerOneId ? playerTwoId : playerOneId;
        const currentPosition = starterposition_1.starterPosition;
        const startTime = timeControl.split("|")[0].trim();
        const additionalTime = timeControl.split("|")[1].trim();
        await prisma.gameDetails.create({
            data: {
                gameId,
                whiteUserId: whitePlayer,
                blackUserId: blackPlayer,
                currentPosition,
                additionalTime: parseInt(additionalTime) * 10,
                timeForComeBack: this.makeTimeForComeBack(parseInt(startTime)),
                timeLeftBlack: parseInt(startTime) * 60 * 10,
                timeLeftWhite: parseInt(startTime) * 60 * 10,
            },
        });
    }
    async proposeDraw(data, user, io, socketId) {
        try {
            const game = await this.checkUserAndGetGame(user, data.gameId, io, socketId);
            if (!game || !game.gameDetails)
                return io
                    .to(socketId)
                    .emit("error", { message: "Game not found", code: 404 });
            const newGameDetails = await prisma.gameDetails.update({
                where: { id: game.gameDetails.id },
                data: { drawProposed: data.player.color },
            });
            io.to(game.id).emit("drawProposed", newGameDetails.drawProposed);
        }
        catch (e) {
            io.to(socketId).emit("error", {
                message: "Internal Server Error",
                code: 500,
            });
            console.log(e);
        }
    }
    async declineDraw(gameId, user, io, socketId) {
        try {
            const game = await this.checkUserAndGetGame(user, gameId, io, socketId);
            if (!game || !game.gameDetails)
                return io
                    .to(socketId)
                    .emit("error", { message: "Game not found", code: 404 });
            await prisma.gameDetails.update({
                where: { id: game.gameDetails.id },
                data: { drawProposed: null },
            });
            io.to(game.id).emit("drawDeclined", true);
        }
        catch (e) {
            io.to(socketId).emit("error", {
                message: "Internal Server Error",
                code: 500,
            });
            console.log(e);
        }
    }
    async acceptDraw(gameId, user, io, socketId) {
        try {
            const game = await this.checkUserAndGetGame(user, gameId, io, socketId);
            // console.log(gameId)
            if (!game || !game.gameDetails)
                return io
                    .to(socketId)
                    .emit("error", { message: "Game not found", code: 404 });
            const timeLeftObj = await serviceController_1.default.calculateTimeAndUpdate(game.gameDetails, gameId, io);
            if (!timeLeftObj)
                return;
            await prisma.gameDetails.update({
                where: { id: game.gameDetails.id },
                data: {
                    timeLeftWhite: timeLeftObj.timeLeftWhite,
                    timeLeftBlack: timeLeftObj.timeLeftBlack,
                    whiteLastMoveAt: timeLeftObj.whiteLastMoveAt,
                    blackLastMoveAt: timeLeftObj.blackLastMoveAt,
                    resultExplanation: "draw agreed",
                    whiteUserDisconnectedAt: null,
                    blackUserDisconnectedAt: null,
                    drawProposed: null,
                    pointsWhite: 0.5,
                    pointsBlack: 0.5,
                },
            });
            const newGame = await prisma.game.update({
                where: { id: gameId },
                data: { ifFinished: true },
                include: { gameDetails: true, playerOne: true, playerTwo: true },
            });
            io.to(game.id).emit("gameResult", newGame);
        }
        catch (e) {
            io.to(socketId).emit("error", {
                message: "Internal Server Error",
                code: 500,
            });
            console.log(e);
        }
    }
    async resignGame(gameId, user, io, socketId) {
        try {
            const game = await this.checkUserAndGetGame(user, gameId, io, socketId);
            const userId = user.id;
            // console.log(gameId)
            if (!game || !game.gameDetails)
                return io
                    .to(socketId)
                    .emit("error", { message: "Game not found", code: 404 });
            const timeLeftObj = await serviceController_1.default.calculateTimeAndUpdate(game.gameDetails, gameId, io);
            if (!timeLeftObj)
                return;
            const [pointsWhite, pointsBlack] = game.gameDetails.whiteUserId === userId ? [0, 1] : [1, 0];
            await prisma.gameDetails.update({
                where: { id: game.gameDetails.id },
                data: {
                    timeLeftWhite: timeLeftObj.timeLeftWhite,
                    timeLeftBlack: timeLeftObj.timeLeftBlack,
                    whiteLastMoveAt: timeLeftObj.whiteLastMoveAt,
                    blackLastMoveAt: timeLeftObj.blackLastMoveAt,
                    resultExplanation: "resign",
                    whiteUserDisconnectedAt: null,
                    blackUserDisconnectedAt: null,
                    drawProposed: null,
                    pointsWhite,
                    pointsBlack,
                },
            });
            const newGame = await prisma.game.update({
                where: { id: gameId },
                data: { ifFinished: true },
                include: { gameDetails: true, playerOne: true, playerTwo: true },
            });
            io.to(game.id).emit("gameResult", newGame);
        }
        catch (e) {
            io.to(socketId).emit("error", {
                message: "Internal Server Error",
                code: 500,
            });
            console.log(e);
        }
    }
    makeTimeForComeBack(time) {
        if (time < 2)
            return 15;
        if (time < 5)
            return 30;
        if (time < 15)
            return 60;
        if (time < 30)
            return 120;
        if (time < 60)
            return 300;
        return 600;
    }
    async saveGameRusults(result, user, io, socketId) {
        const game = await this.checkUserAndGetGame(user, result.move.gameId, io, socketId);
        if (!game || !game.gameDetails)
            return;
        const move = result.move;
        const gameDetails = game.gameDetails;
        const moves = gameDetails.moves
            ? [...gameDetails.moves, move]
            : [move];
        const timeLeftObj = await serviceController_1.default.calculateTimeAndUpdate(gameDetails, move.gameId, io);
        if (!timeLeftObj)
            return;
        const [pointsWhite, pointsBlack] = this.makeResult(gameDetails.turn, result.result);
        await prisma.gameDetails.update({
            where: { id: gameDetails.id },
            data: {
                currentPosition: move.position,
                moves: moves,
                lastMove: move.move,
                // lastMoveDate : new Date()
                timeLeftWhite: timeLeftObj.timeLeftWhite,
                timeLeftBlack: timeLeftObj.timeLeftBlack,
                whiteLastMoveAt: timeLeftObj.whiteLastMoveAt,
                blackLastMoveAt: timeLeftObj.blackLastMoveAt,
                resultExplanation: result.result,
                drawProposed: null,
                blackUserDisconnectedAt: null,
                whiteUserDisconnectedAt: null,
                pointsWhite,
                pointsBlack,
                turn: gameDetails.turn === "white" ? "black" : "white",
            },
        });
        const newGame = await prisma.game.update({
            where: { id: move.gameId },
            data: { ifFinished: true },
            include: { gameDetails: true, playerOne: true, playerTwo: true },
        });
        io.to(game.id).emit("gameResult", newGame);
    }
    async timesUp(color, user, io, socketId) {
        if (!user)
            return io
                .to(socketId)
                .emit("error", { message: "Unauthorized", code: 401 });
        const userId = user.id;
        if (!userId)
            return io
                .to(socketId)
                .emit("error", { message: "Unauthorized", code: 401 });
        const gameId = color.gameId;
        const game = await prisma.game.findFirst({
            where: {
                id: gameId,
                OR: [{ playerOneId: userId }, { playerTwoId: userId }],
                ifFinished: false,
            },
            include: { gameDetails: true },
        });
        if (!game || !game.gameDetails)
            return io
                .to(socketId)
                .emit("error", { message: "Game not found", code: 404 });
        const gameDetails = game.gameDetails;
        if (game.gameDetails.turn !== color.color) {
            return io
                .to(socketId)
                .emit("error", { message: "Not your turn", code: 404 });
        }
        const timeLeftObj = await serviceController_1.default.calculateTimeAndUpdate(gameDetails, gameId, io);
        if (!timeLeftObj)
            return;
    }
    async disconnectUser(data, user, io, socketId) { }
    makeResult(turn, result) {
        if (result === "mate")
            return turn === "white" ? [1, 0] : [0, 1];
        if (result === "draw")
            return [0.5, 0.5];
        if (result === "stealMate")
            return [0.5, 0.5];
        if (result === "decline")
            return [0, 0];
        return [0, 0];
    }
    async checkUserAndGetGame(user, gameId, io, socketId) {
        if (!user) {
            io.to(socketId).emit("error", { message: "Unauthorized", code: 401 });
            return;
        }
        const userId = user.id;
        if (!userId) {
            io.to(socketId).emit("error", { message: "Unauthorized", code: 401 });
            return;
        }
        // const move: Move = result.move;
        const game = await prisma.game.findFirst({
            where: {
                id: gameId,
                OR: [{ playerOneId: userId }, { playerTwoId: userId }],
                ifFinished: false,
            },
            include: { gameDetails: true },
        });
        return game;
    }
}
exports.default = new GameController();
