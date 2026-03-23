import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/utils/password.js';

describe('Password utilities', () => {
  it('should hash a password (not return plaintext)', async () => {
    const hash = await hashPassword('MySecret123');
    expect(hash).not.toBe('MySecret123');
    expect(hash).toMatch(/^\$2[aby]?\$/); // bcrypt hash prefix
  });

  it('should produce different hashes for the same password (unique salts)', async () => {
    const hash1 = await hashPassword('SamePassword');
    const hash2 = await hashPassword('SamePassword');
    expect(hash1).not.toBe(hash2);
  });

  it('should verify correct password against hash', async () => {
    const hash = await hashPassword('CorrectPassword');
    const result = await verifyPassword('CorrectPassword', hash);
    expect(result).toBe(true);
  });

  it('should reject wrong password against hash', async () => {
    const hash = await hashPassword('CorrectPassword');
    const result = await verifyPassword('WrongPassword', hash);
    expect(result).toBe(false);
  });

  it('should handle empty password', async () => {
    const hash = await hashPassword('');
    expect(await verifyPassword('', hash)).toBe(true);
    expect(await verifyPassword('notempty', hash)).toBe(false);
  });

  it('should handle unicode passwords', async () => {
    const hash = await hashPassword('пароль123!');
    expect(await verifyPassword('пароль123!', hash)).toBe(true);
    expect(await verifyPassword('пароль123?', hash)).toBe(false);
  });
});
