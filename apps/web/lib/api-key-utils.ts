import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_PREFIX = 'nxk_';
const KEY_BYTES = 32;
const SALT_BYTES = 16;

export function generateApiKey(): { rawKey: string; prefix: string; hash: string } {
  const raw = randomBytes(KEY_BYTES).toString('base64url');
  const rawKey = `${KEY_PREFIX}${raw}`;
  const prefix = rawKey.slice(0, 8);
  const hash = hashApiKey(rawKey);
  return { rawKey, prefix, hash };
}

export function hashApiKey(rawKey: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(rawKey, salt, 64);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const [saltHex, derivedHex] = storedHash.split(':');
  if (!saltHex || !derivedHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const storedDerived = Buffer.from(derivedHex, 'hex');
  const derived = scryptSync(rawKey, salt, 64);
  return timingSafeEqual(derived, storedDerived);
}
