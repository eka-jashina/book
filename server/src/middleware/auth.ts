import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getPrisma } from '../utils/prisma.js';
import { verifyPassword } from '../utils/password.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';

// Extend Express User type — passwordHash is never exposed in req.user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      displayName: string | null;
      avatarUrl: string | null;
      username: string | null;
      bio: string | null;
      googleId: string | null;
      hasPassword: boolean;
    }
  }
}

// ─── In-memory user cache for deserializeUser ─────────────────────────────────
// Avoids a DB query on every authenticated request.
// TTL-based: entries expire after USER_CACHE_TTL_MS.
// Invalidated explicitly via invalidateUserCache() on profile/password changes.

const USER_CACHE_TTL_MS = 60_000; // 1 minute
const USER_CACHE_MAX_SIZE = 1000;

interface CachedUser {
  user: Express.User;
  expiresAt: number;
}

const userCache = new Map<string, CachedUser>();

/** Remove a user from the deserialization cache (call after profile/password updates). */
export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

/** Evict expired entries when cache reaches max size. */
function evictExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of userCache) {
    if (entry.expiresAt <= now) userCache.delete(key);
  }
}

/** Convert a Prisma User row to Express.User (strips DB-only fields) */
function toSessionUser(dbUser: {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  username: string | null;
  bio: string | null;
  googleId: string | null;
  passwordHash: string | null;
}): Express.User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    displayName: dbUser.displayName,
    avatarUrl: dbUser.avatarUrl,
    username: dbUser.username,
    bio: dbUser.bio,
    googleId: dbUser.googleId,
    hasPassword: dbUser.passwordHash !== null,
  };
}

export function configurePassport(): void {
  const config = getConfig();
  const prisma = getPrisma();

  // Serialize user ID to session
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  // Deserialize user from session by ID — uses in-memory cache to avoid DB hit per request
  passport.deserializeUser(async (id: string, done) => {
    try {
      // Check cache first
      const cached = userCache.get(id);
      if (cached && cached.expiresAt > Date.now()) {
        done(null, cached.user);
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          username: true,
          bio: true,
          googleId: true,
          passwordHash: true,
        },
      });
      if (!user) {
        userCache.delete(id);
        done(null, false);
        return;
      }
      const sessionUser = toSessionUser(user);

      // Store in cache
      if (userCache.size >= USER_CACHE_MAX_SIZE) evictExpiredEntries();
      userCache.set(id, { user: sessionUser, expiresAt: Date.now() + USER_CACHE_TTL_MS });

      done(null, sessionUser);
    } catch (err) {
      logger.error({ err, userId: id }, 'deserializeUser failed');
      done(err);
    }
  });

  // Local strategy (email + password)
  passport.use(
    new LocalStrategy(
      { usernameField: 'email', passwordField: 'password' },
      async (email, password, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
          });

          if (!user || !user.passwordHash) {
            done(null, false, { message: 'Invalid email or password' });
            return;
          }

          const isValid = await verifyPassword(password, user.passwordHash);
          if (!isValid) {
            done(null, false, { message: 'Invalid email or password' });
            return;
          }

          done(null, toSessionUser(user));
        } catch (err) {
          done(err);
        }
      },
    ),
  );

  // Google OAuth strategy (only if credentials are configured)
  if (
    config.GOOGLE_CLIENT_ID !== 'placeholder' &&
    config.GOOGLE_CLIENT_SECRET !== 'placeholder'
  ) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.GOOGLE_CLIENT_ID,
          clientSecret: config.GOOGLE_CLIENT_SECRET,
          callbackURL: config.GOOGLE_CALLBACK_URL,
          scope: ['profile', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              logger.warn({ googleId: profile.id }, 'Google OAuth: profile has no email');
              done(new Error('No email from Google profile'));
              return;
            }

            // Check if user already exists by Google ID
            let user = await prisma.user.findUnique({
              where: { googleId: profile.id },
            });

            if (user) {
              done(null, toSessionUser(user));
              return;
            }

            // Check if user exists by email
            user = await prisma.user.findUnique({
              where: { email: email.toLowerCase() },
            });

            if (user) {
              // Only auto-link Google to accounts that have NO password set
              // (i.e., they were created via Google OAuth previously).
              // Accounts with a password require the user to link Google
              // explicitly from their profile — prevents account pre-hijacking
              // where an attacker registers with victim's email and then
              // victim's Google login silently merges into the attacker's account.
              if (user.passwordHash) {
                logger.warn(
                  { userId: user.id, email: email.toLowerCase(), googleId: profile.id },
                  'Google OAuth login rejected: email already registered with password',
                );
                done(null, false, { message: 'Unable to sign in with Google for this account.' } as any);
                return;
              }
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  googleId: profile.id,
                  avatarUrl: profile.photos?.[0]?.value || user.avatarUrl,
                  displayName: user.displayName || profile.displayName,
                },
              });
              done(null, toSessionUser(user));
              return;
            }

            // Create new user
            user = await prisma.user.create({
              data: {
                email: email.toLowerCase(),
                googleId: profile.id,
                displayName: profile.displayName || null,
                avatarUrl: profile.photos?.[0]?.value || null,
              },
            });

            logger.info({ userId: user.id, email }, 'New user via Google OAuth');
            done(null, toSessionUser(user));
          } catch (err) {
            done(err);
          }
        },
      ),
    );
  }
}

/**
 * Middleware that requires an authenticated session.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  res.status(401).json({
    error: 'Unauthorized',
    message: 'Authentication required',
    statusCode: 401,
  });
}
