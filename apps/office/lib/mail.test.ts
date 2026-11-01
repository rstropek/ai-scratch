import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createOutboxMailer, createResendMailer, RESEND_URL } from './mail.ts';
import { createTurnstileVerifier, SITEVERIFY_URL } from './turnstile.ts';

const mail = { to: 'a@schule.at', subject: 'Betreff', text: 'Text' };

describe('the Resend mailer', () => {
  it('posts the mail with the key and the reply address', async () => {
    const fetch = vi.fn(async () => new Response('{"id":"1"}'));
    await createResendMailer({
      apiKey: 're_key',
      from: 'AI-Scratch <o@mail.ai-scratch.dev>',
      replyTo: 'rainer@software-architects.at',
      fetch,
    })(mail);
    expect(fetch).toHaveBeenCalledWith(
      RESEND_URL,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer re_key' }),
        body: JSON.stringify({
          from: 'AI-Scratch <o@mail.ai-scratch.dev>',
          to: ['a@schule.at'],
          reply_to: 'rainer@software-architects.at',
          subject: 'Betreff',
          text: 'Text',
        }),
      }),
    );
  });

  it('throws when Resend refuses', async () => {
    const fetch = async () => new Response('{"message":"invalid from"}', { status: 422 });
    await expect(createResendMailer({ apiKey: 'k', from: 'f', replyTo: 'r', fetch })(mail)).rejects.toThrow(/422/);
  });
});

describe('the outbox mailer', () => {
  it('writes each mail as a JSON file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'outbox-'));
    try {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      await createOutboxMailer(dir)(mail);
      const [file] = await readdir(dir);
      expect(JSON.parse(await readFile(path.join(dir, file ?? ''), 'utf8'))).toEqual(mail);
    } finally {
      vi.restoreAllMocks();
      await rm(dir, { recursive: true });
    }
  });
});

describe('the Turnstile check', () => {
  it('passes the token and the IP to siteverify', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({ success: true }));
    expect(await createTurnstileVerifier({ secretKey: 's', fetch })('tok', '1.2.3.4')).toBe(true);
    expect(fetch.mock.calls[0]?.[0]).toBe(SITEVERIFY_URL);
    expect(String(fetch.mock.calls[0]?.[1]?.body)).toBe('secret=s&response=tok&remoteip=1.2.3.4');
  });

  it('fails closed: no token, a refusal or an error', async () => {
    const never = async () => Response.json({ success: true });
    expect(await createTurnstileVerifier({ secretKey: 's', fetch: never })('', undefined)).toBe(false);
    const refused = async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
    expect(await createTurnstileVerifier({ secretKey: 's', fetch: refused })('t', undefined)).toBe(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = async () => new Response('', { status: 500 });
    expect(await createTurnstileVerifier({ secretKey: 's', fetch: broken })('t', undefined)).toBe(false);
    vi.restoreAllMocks();
  });
});
