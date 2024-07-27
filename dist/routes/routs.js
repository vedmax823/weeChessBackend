"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const client_1 = require("@prisma/client");
const serviceController_1 = __importDefault(require("../controllers/serviceController"));
const socketConfig_1 = require("../socketConfig");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
router.get("/", 
// passport.authenticate("google", { scope: ["profile", "email"] })
(req, res) => res.send("VeeChess!"));
router.get("/auth/google", passport_1.default.authenticate("google", {
    scope: ["profile", "email"],
    accessType: "offline",
    prompt: "consent",
}));
router.get("/auth/google/callback", passport_1.default.authenticate("google", { failureRedirect: process.env.CLIENT_URL }), (req, res) => {
    res.redirect(process.env.CLIENT_URL);
});
router.get("/auth/facebook", passport_1.default.authenticate("facebook", { scope: ["email"] }));
router.get("/auth/facebook/callback", passport_1.default.authenticate("facebook", {
    failureRedirect: process.env.CLIENT_URL,
}), (req, res) => {
    res.redirect(process.env.CLIENT_URL);
});
router.get("/auth/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.sendStatus(200);
    });
});
router.get("/messages", async (req, res) => {
    const messages = await prisma.message.findMany({ include: { user: true } });
    res.json(messages);
});
router.post("/game", async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: "Unauthorized" });
        const game = req.body.data;
        const gameType = game.replace("min", "| 0");
        const newGame = await prisma.game.create({
            data: { timeControl: gameType, playerOneId: userId },
        });
        res.json(newGame);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
router.get("/game/active", async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: "Unauthorized" });
        const activeGame = await prisma.game.findFirst({
            where: {
                OR: [{ playerOneId: userId }, { playerTwoId: userId }],
                playerTwoId: { not: null },
                ifFinished: false
            },
        });
        if (activeGame)
            return res.send(activeGame);
        return res.send(false);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
router.get("/game/mygames", async (req, res) => {
    try {
        const userId = req.user?.id;
        const skip = req.query.skip || 0;
        const start = typeof skip === "string" ? parseInt(skip) : 0;
        if (!userId)
            return res.status(401).json({ error: "Not authorized" });
        const myGames = await prisma.game.findMany({
            skip: start * 50,
            take: 50,
            where: {
                OR: [{ playerOneId: userId }, { playerTwoId: userId }],
                ifFinished: true,
                playerTwoId: {
                    not: null,
                },
            },
            orderBy: [
                {
                    createdAt: "desc",
                },
            ],
            include: { gameDetails: true, playerOne: true, playerTwo: true },
        });
        res.json(myGames);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
router.get("/game/created/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: "Not authorized" });
        const game = await prisma.game.findFirst({
            where: { id },
            include: { playerOne: true, playerTwo: true, gameDetails: true },
        });
        if (!game || !game.gameDetails)
            return res.status(404).json({ error: "Game Not Found" });
        if (game.ifFinished)
            return res.json(game);
        const timeLeftObj = await serviceController_1.default.calculateTimeAndUpdate(game.gameDetails, game.id, socketConfig_1.io);
        if (!timeLeftObj)
            return res.json(game);
        const newGameDetails = await prisma.gameDetails.update({
            where: { gameId: game.id },
            data: {
                blackUserDisconnectedAt: userId === game.gameDetails.blackUserId
                    ? null
                    : game.gameDetails.blackUserDisconnectedAt,
                whiteUserDisconnectedAt: userId === game.gameDetails.whiteUserId
                    ? null
                    : game.gameDetails.whiteUserDisconnectedAt,
            },
        });
        socketConfig_1.io.to(game.id).emit("move", {
            ...newGameDetails,
            timeLeftWhite: timeLeftObj.timeLeftWhite,
            timeLeftBlack: timeLeftObj.timeLeftBlack,
            timeLeftWhiteToReconnect: timeLeftObj.timeLeftWhiteToReconnect,
            timeLeftBlackToReconnect: timeLeftObj.timeLeftBlackToReconnect,
        });
        res.json({
            ...game,
            gameDetails: {
                ...game.gameDetails,
                timeLeftWhite: timeLeftObj.timeLeftWhite,
                timeLeftBlack: timeLeftObj.timeLeftBlack,
                timeLeftWhiteToReconnect: timeLeftObj.timeLeftWhiteToReconnect,
                timeLeftBlackToReconnect: timeLeftObj.timeLeftBlackToReconnect,
            },
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
router.get("/game/calls", async (req, res) => {
    try {
        // const userId = req.user?.id;
        // if (!userId) return res.status(401).json({error: 'Unauthorized'});
        const calls = await prisma.game.findMany({
            where: { playerTwoId: null },
            include: { playerOne: true },
        });
        // console.log(calls)
        res.json(calls);
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
router.get("/auth/profile", (req, res) => {
    res.send(req.user);
});
exports.default = router;
