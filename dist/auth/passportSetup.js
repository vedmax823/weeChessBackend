"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const passport = require("passport");
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_facebook_1 = require("passport-facebook");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
passport.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
}, async (accessToken, refreshToken, profile, done) => {
    //   console.log(profile);
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
    return done(null, { id: user.id, email: profile.emails[0].value, displayName: profile.displayName, image: profile.photos[0].value });
}));
passport.use(new passport_facebook_1.Strategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "/auth/facebook/callback",
    profileFields: ['id', 'displayName', 'photos', 'email']
}, async (accessToken, refreshToken, profile, done) => {
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
    return done(null, { id: user.id, email: profile.emails[0].value, displayName: profile.displayName, image: profile.photos[0].value });
}));
passport.serializeUser((user, cb) => {
    // console.log(`serializeUser ${user.id}`);
    cb(null, user);
});
passport.deserializeUser((user, cb) => {
    // console.log(`deserializeUser ${user.id}`);
    cb(null, user);
});
exports.default = passport;
