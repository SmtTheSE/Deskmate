import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** Secrets (API keys, passwords for email, Twilio tokens) are encrypted at rest. */

let key: Buffer;

export function initKey(dataDir: string, envSecret?: string) {
  if (envSecret) {
    key = createHash('sha256').update(envSecret).digest();
    return;
  }
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, '.secret-key');
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 });
  key = Buffer.from(readFileSync(file, 'utf8').trim(), 'hex');
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(blob: string | undefined): string | undefined {
  if (!blob) return undefined;
  const [v, iv, tag, data] = blob.split(':');
  if (v !== 'v1' || !iv || !tag || !data) return undefined;
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString('base64')}:${scryptSync(pw, salt, 64).toString('base64')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [, salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(pw, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

export const randomId = (bytes = 9) => randomBytes(bytes).toString('base64url');
export const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
