"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
exports.configureSocketIO = configureSocketIO;
const socket_io_1 = require("socket.io");
const sessionMiddleware_1 = require("./middlewares/sessionMiddleware");
const passport_1 = __importDefault(require("passport"));
const connectionController_1 = __importDefault(require("./controllers/connectionController")); // Adjust the import based on your setup
const game_controller_1 = __importDefault(require("./controllers/game-controller"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// import { userSocketMap } from './userSocketMap';
let io;
function configureSocketIO(server, userSocketMap) {
    exports.io = io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.CLIENT_URL,
            methods: ["GET", "POST"],
            credentials: true,
        },
    });
    function onlyForHandshake(middleware) {
        return (req, res, next) => {
            const isHandshake = req._query.sid === undefined;
            if (isHandshake) {
                middleware(req, res, next);
            }
            else {
                next();
            }
        };
    }
    io.engine.use(onlyForHandshake(sessionMiddleware_1.sessionMiddleware));
    io.engine.use(onlyForHandshake(passport_1.default.session()));
    io.engine.use(onlyForHandshake((req, res, next) => {
        if (req.user) {
            next();
        }
        else {
            res.writeHead(401);
            res.end();
        }
    }));
    io.on("connection", (socket) => {
        const req = socket.request;
        const socketId = socket.id;
        if (req.user.id) {
            if (userSocketMap.has(req.user.id)) {
                const previousSocketId = userSocketMap.get(req.user.id);
                if (previousSocketId && previousSocketId !== socketId) {
                    io.to(previousSocketId).emit("error", {
                        message: "Already Connected",
                        code: 404,
                    });
                }
                userSocketMap.delete(req.user.id);
            }
            userSocketMap.set(req.user.id, socketId);
            connectionController_1.default.deleteDisconnect(req.user, io);
        }
        socket.on("message", (message) => saveMessage(message, req.user, io, socketId));
        socket.on("joinToWatch", (gameId) => socket.join(gameId));
        socket.on("createGame", (timeControl) => game_controller_1.default.createGame(timeControl, req.user, io, socketId, userSocketMap));
        socket.on("joinGame", (id) => game_controller_1.default.joinGame(id, req.user, io, socketId, userSocketMap));
        socket.on("move", (data) => game_controller_1.default.makeMove(data, req.user, io, socketId, userSocketMap));
        socket.on("leaveGame", (id) => socket.leave(id));
        socket.on("gameResult", (data) => game_controller_1.default.saveGameRusults(data, req.user, io, socketId));
        socket.on("timeIsUp", (data) => game_controller_1.default.timesUp(data, req.user, io, socketId));
        socket.on("proposeDraw", (data) => game_controller_1.default.proposeDraw(data, req.user, io, socketId));
        socket.on("declineDraw", (data) => game_controller_1.default.declineDraw(data, req.user, io, socketId));
        socket.on("acceptDraw", (data) => game_controller_1.default.acceptDraw(data, req.user, io, socketId));
        socket.on("resign", (data) => game_controller_1.default.resignGame(data, req.user, io, socketId));
        socket.on("disconnect", () => connectionController_1.default.disconnectUser(req.user, userSocketMap, socketId, io));
    });
    return io;
}
;
async function saveMessage(message, user, io, socketId) {
    // console.log(console.log(user, message));
    if (!user)
        return io.emit("error", { message: "Unauthorized" });
    if (!message.trim())
        return io.emit("error", { message: "Invalid Message" });
    const newMessage = await prisma.message.create({
        data: { content: message.trim(), userId: user.id },
        include: { user: true },
    });
    io.emit("message", newMessage);
}
