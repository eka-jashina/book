import { randomBytes, createHash } from 'node:crypto';
import { getPrisma } from '../utils/prisma.js';
import { hashPassword } from '../utils/password.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { mapUserToDto } from '../utils/mappers.js';
import type { UserResponse } from '../types/api.js';

/**
 * Hash a reset token with SHA-256 for storage.
 * Using SHA-256 (not bcrypt) because the token is already a 256-bit
 * cryptographically random value — no need for slow hashing.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Password reset token validity period (1 hour) */
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Format a User model for the API response.
 * Delegates to centralized mapper in utils/mappers.ts.
 */
export const formatUser = mapUserToDto;

/**
 * Register a new user with email and password.
 */
export async function registerUser(
  email: string,
  password: string,
  displayName: string | undefined,
  username: string,
): Promise<UserResponse> {
  const prisma = getPrisma();

  const normalizedEmail = email.toLowerCase().trim();

  // Check for existing user by email
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new AppError(409, 'User with this email already exists');
  }

  // Check for existing username (always required)
  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });
  if (existingUsername) {
    throw new AppError(409, 'Username is already taken');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      displayName: displayName || null,
      username,
    },
  });

  // Create default global settings for new user
  await prisma.globalSettings.create({
    data: { userId: user.id },
  });

  return formatUser(user);
}

/**
 * Get user by ID.
 */
export async function getUserById(
  id: string,
): Promise<UserResponse | null> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;

  return formatUser(user);
}

/**
 * Create a password reset token for a user.
 * Returns the token string. The caller is responsible for delivering
 * it to the user (e.g., via email). If no user exists with the given
 * email, returns null silently to prevent email enumeration.
 */
export async function createPasswordResetToken(
  email: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, passwordHash: true },
  });

  // Silently return null to prevent email enumeration
  if (!user) return null;

  // Only users with passwords can reset (Google-only users should use Google)
  if (!user.passwordHash) return null;

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: tokenHash,
      resetTokenExpiresAt: expiresAt,
    },
  });

  logger.info({ userId: user.id }, 'Password reset token created');
  return token; // Return unhashed token — caller delivers it to the user
}

/**
 * Reset a user's password using a valid reset token.
 * Clears the token after successful reset and destroys all sessions.
 *
 * Uses a transaction with optimistic locking: the UPDATE ... WHERE includes
 * the token hash so concurrent requests with the same token can't both succeed.
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<void> {
  const prisma = getPrisma();
  const tokenHash = hashToken(token);

  const user = await prisma.user.findUnique({
    where: { resetToken: tokenHash },
    select: { id: true, resetTokenExpiresAt: true },
  });

  if (!user) {
    throw new AppError(400, 'Invalid or expired reset token');
  }

  if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    // Clean up expired token
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: null, resetTokenExpiresAt: null },
    });
    throw new AppError(400, 'Invalid or expired reset token');
  }

  const newPasswordHash = await hashPassword(newPassword);

  // Atomic update: only succeeds if the token hasn't been consumed yet
  const result = await prisma.user.updateMany({
    where: { id: user.id, resetToken: tokenHash },
    data: {
      passwordHash: newPasswordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  });

  if (result.count === 0) {
    // Another concurrent request consumed the token first
    throw new AppError(400, 'Invalid or expired reset token');
  }

  // Invalidate all existing sessions for this user.
  // Use PostgreSQL JSON operator to match passport.user field reliably.
  try {
    await prisma.$executeRaw`
      DELETE FROM "session"
      WHERE sess -> 'passport' ->> 'user' = ${user.id}
    `;
  } catch {
    // Non-critical: session cleanup failure is logged but doesn't block reset
    logger.warn({ userId: user.id }, 'Failed to invalidate sessions after password reset');
  }

  logger.info({ userId: user.id }, 'Password reset completed');
}
