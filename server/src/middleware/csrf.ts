import type { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import { getConfig } from '../config.js';

type CsrfFunctions = ReturnType<typeof doubleCsrf>;
let _csrf: CsrfFunctions | null = null;

function getCsrf(): CsrfFunctions {
  if (_csrf) return _csrf;
  const config = getConfig();
  _csrf = doubleCsrf({
    getSecret: () => config.CSRF_SECRET,
    // Bind CSRF token to user session for per-user isolation.
    // For anonymous users (no saved session / no connect.sid cookie),
    // use a stable identifier — ephemeral sessionID changes every request
    // when saveUninitialized is false, breaking the double-submit flow.
    getSessionIdentifier: (req) => {
      const r = req as Request;
      return (r.session as Record<string, any>)?.passport?.user ? r.sessionID : 'anonymous';
    },
    cookieName: '__csrf',
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.SESSION_SECURE,
      path: '/',
    },
    getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
  });
  return _csrf;
}

export function doubleCsrfProtection(req: Request, res: Response, next: NextFunction): void {
  getCsrf().doubleCsrfProtection(req, res, next);
}

export function generateCsrfToken(req: Request, res: Response): string {
  return getCsrf().generateCsrfToken(req, res);
}
