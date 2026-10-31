// Keys derived from BETTER_AUTH_SECRET, one per purpose (HKDF), so the office needs no further secret.
import { createHmac, hkdfSync } from 'node:crypto';

export type KeyPurpose = 'registration-link' | 'rate-limit';

export const deriveKey = (secret: string, purpose: KeyPurpose): Buffer =>
  Buffer.from(hkdfSync('sha256', secret, 'ai-scratch-office', purpose, 32));

/** a stable pseudonym for a value (an email address, an IP) that can't be turned back into it */
export const keyedHash = (key: Buffer, value: string): string =>
  createHmac('sha256', key).update(value).digest('base64url');
