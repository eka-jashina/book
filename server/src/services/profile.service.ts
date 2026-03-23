import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESERVED_USERNAMES } from '../schemas.js';
import type { UserResponse } from '../types/api.js';
import { formatUser } from './auth.service.js';

/**
 * Check if a username is available (not taken and not reserved).
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  if (RESERVED_USERNAMES.has(username)) return false;

  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  return !existing;
}

/**
 * Get the current user's profile.
 */
export async function getProfile(userId: string): Promise<UserResponse> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, 'User not found');

  return formatUser(user);
}

/**
 * Update the current user's profile (display name, bio, avatar, username).
 */
export async function updateProfile(
  userId: string,
  data: {
    displayName?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    username?: string;
  },
): Promise<UserResponse> {
  const prisma = getPrisma();

  // Проверка уникальности username, если он меняется
  if (data.username !== undefined) {
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      throw new AppError(409, 'Username is already taken', 'USERNAME_TAKEN');
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      ...(data.username !== undefined && { username: data.username }),
    },
  });

  return formatUser(user);
}
