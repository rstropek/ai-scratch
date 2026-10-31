// The confirmation link's token: everything the registration page asked, sealed with AES-256-GCM (which also
// detects tampering). Nothing is stored before the link is used.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { LINK_VALID_MINUTES } from './rules.ts';
import { deriveKey } from './secrets.ts';

export type AdultKind = 'parent' | 'teacher';

export interface Registration {
  email: string;
  kind: AdultKind;
  /** a teacher ticked "Gratis-Budget beantragen" (always false for parents) */
  freeBudget: boolean;
  termsVersion: string;
  /** when the terms were accepted, the 18+ confirmed and the AI consent given (one submit, one time) */
  acceptedAt: Date;
}

interface Payload {
  v: 1;
  email: string;
  kind: AdultKind;
  freeBudget: boolean;
  adult: true;
  aiConsent: true;
  termsVersion: string;
  acceptedAt: number;
  exp: number;
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

export const sealRegistration = (secret: string, registration: Registration, now = new Date()): string => {
  const payload: Payload = {
    v: 1,
    email: registration.email,
    kind: registration.kind,
    freeBudget: registration.freeBudget,
    adult: true,
    aiConsent: true,
    termsVersion: registration.termsVersion,
    acceptedAt: registration.acceptedAt.getTime(),
    exp: now.getTime() + LINK_VALID_MINUTES * 60_000,
  };
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret, 'registration-link'), iv);
  const sealed = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, sealed, cipher.getAuthTag()]).toString('base64url');
};

export type OpenResult = { ok: true; registration: Registration } | { ok: false; reason: 'invalid' | 'expired' };

export const openRegistration = (secret: string, token: string, now = new Date()): OpenResult => {
  let payload: Payload;
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length <= IV_BYTES + TAG_BYTES) return { ok: false, reason: 'invalid' };
    const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret, 'registration-link'), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
    const plain = Buffer.concat([decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)), decipher.final()]);
    payload = JSON.parse(plain.toString('utf8')) as Payload;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (payload.v !== 1) return { ok: false, reason: 'invalid' };
  if (payload.exp <= now.getTime()) return { ok: false, reason: 'expired' };
  return {
    ok: true,
    registration: {
      email: payload.email,
      kind: payload.kind,
      freeBudget: payload.freeBudget === true,
      termsVersion: payload.termsVersion,
      acceptedAt: new Date(payload.acceptedAt),
    },
  };
};
