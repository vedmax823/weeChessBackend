import session from "express-session";
export const sessionMiddleware = session({
    secret: "nehochuhahahaahahaa877",
    resave: true,
    saveUninitialized: true,
  });