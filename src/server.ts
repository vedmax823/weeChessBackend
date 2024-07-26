import express = require("express");
import { createServer } from "http";
import dotenv from "dotenv";
import bodyParser = require("body-parser");
import cors from "cors";
import { sessionMiddleware } from "./middlewares/sessionMiddleware";
import { configureSocketIO } from "./socketConfig";
import passport from "./auth/passportSetup";

import router from "./routes/routs";
dotenv.config();

let userSocketMap = new Map<string, string>();

const port = process.env.PORT || 5001;

const app = express();
const httpServer = createServer(app);
configureSocketIO(httpServer, userSocketMap);

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

app.use(sessionMiddleware);
app.use(bodyParser.json());
app.use(passport.initialize());
app.use(passport.session());

app.use( router)

configureSocketIO(httpServer, userSocketMap);


httpServer.listen(port, () => {
  console.log(`application is running at: http://localhost:${port}`);
});

