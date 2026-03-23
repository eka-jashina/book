import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { registerUser, formatUser, createPasswordResetToken, resetPasswordWithToken } from '../services/auth.service.js';
import { isUsernameAvailable } from '../services/profile.service.js';
import { requireAuth, invalidateUserCache } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createAuthRateLimiter } from '../middleware/rateLimit.js';
import { generateCsrfToken } from '../middleware/csrf.js';
import { getConfig } from '../config.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * Regenerate session and then log in — prevents session fixation attacks.
 * Express session.regenerate() creates a new session ID while preserving
 * passport serialization through the req.login() call.
 */
function regenerateAndLogin(
  req: Request,
  user: Express.User,
  next: NextFunction,
  callback: () => void,
): void {
  req.session.regenerate((regenErr) => {
    if (regenErr) {
      next(regenErr);
      return;
    }
    req.login(user, (loginErr) => {
      if (loginErr) {
        next(loginErr);
        return;
      }
      callback();
    });
  });
}

const router = Router();

const authLimiter = createAuthRateLimiter();

/**
 * POST /api/auth/register — Register + auto-login
 */
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res, next) => {
    const { email, password, displayName, username } = req.body;
    const userResponse = await registerUser(email, password, displayName, username);

    // Auto-login after registration — only need id for serializeUser
    const sessionUser: Express.User = {
      id: userResponse.id,
      email: userResponse.email,
      displayName: userResponse.displayName,
      avatarUrl: userResponse.avatarUrl,
      username: userResponse.username,
      bio: userResponse.bio ?? null,
      googleId: null,
      hasPassword: userResponse.hasPassword,
    };

    regenerateAndLogin(req, sessionUser, next, () => {
      // Session was regenerated — CSRF token must be re-issued
      // (session identifier changed from 'anonymous' to real sessionID)
      const csrfToken = generateCsrfToken(req, res);
      logger.info({ userId: userResponse.id, email: userResponse.email, ip: req.ip }, 'User registered');
      created(res, { user: userResponse, csrfToken });
    });
  }),
);

/**
 * POST /api/auth/login — Login with email + password
 *
 * Uses Passport custom callback pattern — cannot use asyncHandler.
 */
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      'local',
      (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
        if (err) {
          next(err);
          return;
        }
        if (!user) {
          res.status(401).json({
            error: 'Unauthorized',
            message: info?.message || 'Invalid credentials',
            statusCode: 401,
          });
          return;
        }

        regenerateAndLogin(req, user, next, () => {
          const csrfToken = generateCsrfToken(req, res);
          logger.info({ userId: user.id, email: user.email, ip: req.ip }, 'User logged in');
          ok(res, { user: formatUser(user), csrfToken });
        });
      },
    )(req, res, next);
  },
);

/**
 * POST /api/auth/logout — Destroy session
 */
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) {
      next(err);
      return;
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        next(destroyErr);
        return;
      }
      res.clearCookie('connect.sid');
      ok(res, { message: 'Logged out successfully' });
    });
  });
});

/**
 * GET /api/auth/me — Get current authenticated user (or null for guests)
 *
 * Returns 200 with { user: null } when not authenticated — this is intentional.
 * The endpoint is used as a session probe (SPA auth check), not a protected resource.
 * Returning 401 would incorrectly imply "access denied" and pollute browser console.
 */
router.get('/me', (req: Request, res: Response) => {
  ok(res, { user: req.isAuthenticated() ? formatUser(req.user!) : null });
});

/**
 * GET /api/auth/csrf-token — Get CSRF token for SPA
 */
router.get('/csrf-token', (req: Request, res: Response) => {
  const token = generateCsrfToken(req, res);
  ok(res, { token });
});

/**
 * POST /api/auth/forgot-password — Request password reset token.
 * Always returns 200 to prevent email enumeration.
 */
router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const token = await createPasswordResetToken(email);

    // In production, send token via email. For now, log it.
    // Token is only returned in development for testing convenience.
    if (token && getConfig().NODE_ENV === 'development') {
      ok(res, { message: 'If an account exists, a reset link has been sent', token });
    } else {
      ok(res, { message: 'If an account exists, a reset link has been sent' });
    }
  }),
);

/**
 * POST /api/auth/reset-password — Reset password using token
 */
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    await resetPasswordWithToken(token, password);
    // Cache is invalidated by session destruction, but clear explicitly for safety
    if (req.user) invalidateUserCache(req.user.id);
    ok(res, { message: 'Password has been reset successfully' });
  }),
);

/**
 * GET /api/auth/check-username/:username — Public username availability check (for registration)
 */
router.get(
  '/check-username/:username',
  authLimiter,
  asyncHandler(async (req, res) => {
    const username = req.params.username as string;
    const available = await isUsernameAvailable(username);
    ok(res, { username, available });
  }),
);

/**
 * GET /api/auth/google — Redirect to Google OAuth
 */
router.get(
  '/google',
  authLimiter,
  passport.authenticate('google', { scope: ['profile', 'email'] }),
);

/**
 * GET /api/auth/google/callback — Google OAuth callback
 *
 * Uses session regeneration to prevent session fixation attacks.
 * Passport's built-in `req.login()` inside `passport.authenticate()` doesn't
 * regenerate the session, so we use `assignProperty` to delay login and handle
 * it ourselves in the callback.
 */
router.get(
  '/google/callback',
  authLimiter,
  passport.authenticate('google', {
    failureRedirect: '/login?error=google',
    assignProperty: 'authUser',
  }),
  (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).authUser as Express.User;
    if (!user) {
      res.redirect('/login?error=google');
      return;
    }
    regenerateAndLogin(req, user, next, () => {
      logger.info({ userId: user.id, email: user.email }, 'Google OAuth login');
      const config = getConfig();
      res.redirect(config.APP_URL);
    });
  },
);

export default router;
