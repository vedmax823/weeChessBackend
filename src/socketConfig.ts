// socketConfig.ts
import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { NextFunction, Request, Response } from 'express';
import { sessionMiddleware } from './middlewares/sessionMiddleware';
import passport from 'passport';
import connectionController  from './controllers/connectionController'; // Adjust the import based on your setup
import gameController from './controllers/game-controller';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// import { userSocketMap } from './userSocketMap';


let io: Server;
export function configureSocketIO(server: HttpServer, userSocketMap : Map<string, string>): Server{

    io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });
  
    function onlyForHandshake(
      middleware: (req: Request, res: Response, next: NextFunction) => void
    ) {
      return (
        req: Request & { _query: Record<string, string> },
        res: Response,
        next: NextFunction
      ) => {
        const isHandshake = req._query.sid === undefined;
        if (isHandshake) {
          middleware(req, res, next);
        } else {
          next();
        }
      };
    }
  
    io.engine.use(onlyForHandshake(sessionMiddleware));
    io.engine.use(onlyForHandshake(passport.session()));
    io.engine.use(
      onlyForHandshake((req, res, next) => {
        if (req.user) {
          next();
        } else {
          res.writeHead(401);
          res.end();
        }
      })
    );
  
    io.on("connection", (socket: Socket) => {
      const req = socket.request as Request & { user: Express.User };
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
        connectionController.deleteDisconnect(req.user, io);
      }
  
      socket.on("message", (message) => saveMessage(message, req.user, io));
      socket.on("joinToWatch", (gameId) => socket.join(gameId));
      socket.on("createGame", (timeControl) =>
        gameController.createGame(timeControl, req.user, io, socketId, userSocketMap)
      );
      socket.on("joinGame", (id) =>
        gameController.joinGame(id, req.user, io, socketId, userSocketMap)
      );
      socket.on("move", (data) =>
        gameController.makeMove(data, req.user, io, socketId, userSocketMap)
      );
      socket.on("leaveGame", (id) => socket.leave(id));
      socket.on("gameResult", (data) =>
        gameController.saveGameRusults(data, req.user, io, socketId)
      );
      socket.on("timeIsUp", (data) => gameController.timesUp(data, req.user, io, socketId));
      socket.on("proposeDraw", (data) => gameController.proposeDraw(data, req.user, io, socketId));
      socket.on("declineDraw", (data) => gameController.declineDraw(data, req.user, io, socketId));
      socket.on("acceptDraw", (data) => gameController.acceptDraw(data, req.user, io, socketId));
      socket.on("resign", (data) => gameController.resignGame(data, req.user, io, socketId));
  
      socket.on("disconnect", () =>
        connectionController.disconnectUser(req.user, userSocketMap, socketId, io)
      );
    });
  
    return io;
  };

  export {io}

  


  async function saveMessage(
    message: string,
    user: Express.User,
    io: Server
  ) {
    // console.log(console.log(user, message));
    if (!user) return io.emit("error", { message: "Unauthorized" });
    if (!message.trim()) return io.emit("error", { message: "Invalid Message" });
    const newMessage = await prisma.message.create({
      data: { content: message.trim(), userId: user.id },
      include: { user: true },
    });
    io.emit("message", newMessage);
  }
  
  