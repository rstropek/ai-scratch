import { describe, expect, it } from 'vitest';
import { openRegistration, sealRegistration } from './registration-token.ts';
import { LINK_VALID_MINUTES } from './rules.ts';

const secret = 'x'.repeat(32);
const now = new Date('2026-11-02T08:00:00Z');
const registration = { email: 'a@schule.at', kind: 'teacher' as const, termsVersion: 'v1', acceptedAt: now };

describe('the confirmation token', () => {
  it('opens to what was sealed while it is valid', () => {
    const token = sealRegistration(secret, registration, now);
    const later = new Date(now.getTime() + (LINK_VALID_MINUTES - 1) * 60_000);
    expect(openRegistration(secret, token, later)).toEqual({ ok: true, registration });
  });

  it('expires after its time', () => {
    const token = sealRegistration(secret, registration, now);
    const later = new Date(now.getTime() + LINK_VALID_MINUTES * 60_000);
    expect(openRegistration(secret, token, later)).toEqual({ ok: false, reason: 'expired' });
  });

  it('is refused when changed, cut off or sealed with another secret', () => {
    const token = sealRegistration(secret, registration, now);
    const flipped = `${token.slice(0, 20)}${token[20] === 'A' ? 'B' : 'A'}${token.slice(21)}`;
    expect(openRegistration(secret, flipped, now)).toEqual({ ok: false, reason: 'invalid' });
    expect(openRegistration(secret, token.slice(0, -5), now)).toEqual({ ok: false, reason: 'invalid' });
    expect(openRegistration('y'.repeat(32), token, now)).toEqual({ ok: false, reason: 'invalid' });
    expect(openRegistration(secret, '', now)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('does not show the address in the link', () => {
    expect(sealRegistration(secret, registration, now)).not.toContain('schule');
  });
});
