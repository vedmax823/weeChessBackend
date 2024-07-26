import passport = require("passport");
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
      //   console.log(profile);
        let user = await prisma.user.findUnique({ where: { socialId: profile.id } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              socialId: profile.id,
              displayName: profile.displayName,
              email: profile.emails?.[0]?.value || '',
              image : profile.photos?.[0]?.value || '',
              provider: profile.provider,
            }
          });
        }
        return done(null, { id: user.id, email: profile.emails![0].value, displayName: profile.displayName, image: profile.photos![0].value});
      }
    )
  );

  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID!,
        clientSecret: process.env.FACEBOOK_APP_SECRET!,
        callbackURL: "/auth/facebook/callback",
        profileFields: ['id', 'displayName', 'photos', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        let user = await prisma.user.findUnique({ where: { socialId: profile.id } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              socialId: profile.id,
              displayName: profile.displayName,
              email: profile.emails?.[0]?.value || '',
              image: profile.photos?.[0]?.value || '',
              provider: profile.provider,
            }
          });
        }
        return done(null, { id: user.id, email: profile.emails![0].value, displayName: profile.displayName, image: profile.photos![0].value });
      }
    )
  );
  
  
  passport.serializeUser((user, cb) => {
    // console.log(`serializeUser ${user.id}`);
    cb(null, user);
  });
  
  passport.deserializeUser((user: Express.User, cb) => {
    // console.log(`deserializeUser ${user.id}`);
    cb(null, user);
  });


  export default passport;