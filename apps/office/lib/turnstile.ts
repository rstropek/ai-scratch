// Cloudflare Turnstile's server-side check of the registration form's token (managed mode).
export const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** the hidden field the widget adds to the form */
export const TURNSTILE_FIELD = 'cf-turnstile-response';

export type TurnstileVerifier = (token: string, ip: string | undefined) => Promise<boolean>;

export const createTurnstileVerifier =
  ({ secretKey, fetch: baseFetch = fetch }: { secretKey: string; fetch?: typeof fetch }): TurnstileVerifier =>
  async (token, ip) => {
    if (!token) return false;
    const body = new URLSearchParams({ secret: secretKey, response: token });
    if (ip) body.set('remoteip', ip);
    try {
      const res = await baseFetch(SITEVERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`Turnstile answered ${res.status}`);
      const { success } = (await res.json()) as { success?: unknown };
      return success === true;
    } catch (error) {
      // fail closed: the form says to try again, and the rate limits never see a request without a valid token
      console.warn('turnstile: siteverify failed', error);
      return false;
    }
  };
