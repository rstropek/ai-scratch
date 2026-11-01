// The office's database pool, mailer, Turnstile check, Jev screening, the key pool's encryption and check, created on
// first use from the environment (like getAuth in session.ts: `next build` imports routes without any
// environment). Server-only.
import { createDb, createKeyBox, createPool, type Database, type KeyBox, parseMasterKey } from '@ai-scratch/db';
import { createAnthropicKeyChecker, type KeyChecker } from './anthropic-keys.ts';
import { createEntraTokenProvider } from './entra-token.ts';
import { loadServicesEnv, type ServicesEnv } from './env.ts';
import { type ApplicationScreener, createJevScreener } from './jev.ts';
import { createOutboxMailer, createResendMailer, type Mailer } from './mail.ts';
import { createTurnstileVerifier, type TurnstileVerifier } from './turnstile.ts';

interface Services {
  db: Database;
  env?: ServicesEnv;
  mailer?: Mailer;
  verifyTurnstile?: TurnstileVerifier;
  screenApplication?: ApplicationScreener;
  keyBox?: KeyBox;
  checkKey?: KeyChecker;
}

// on globalThis: hot reloads in development re-run this module but must not open another pool
const holder = globalThis as { officeServices?: Services };

const services = (): Services => {
  holder.officeServices ??= { db: createDb(createPool()) };
  return holder.officeServices;
};

export const getDb = (): Database => services().db;

export const getServicesEnv = (): ServicesEnv => {
  const s = services();
  if (!s.env) {
    s.env = loadServicesEnv();
    if (!s.env.jev) console.warn('jev: JEV_DISABLED=1, teacher applications reach the admin unchecked');
  }
  return s.env;
};

export const getMailer = (): Mailer => {
  const s = services();
  if (!s.mailer) {
    const { mail } = getServicesEnv();
    s.mailer =
      'outboxDir' in mail
        ? createOutboxMailer(mail.outboxDir)
        : createResendMailer({ apiKey: mail.resendApiKey, from: mail.from });
  }
  return s.mailer;
};

export const getTurnstileVerifier = (): TurnstileVerifier => {
  const s = services();
  s.verifyTurnstile ??= createTurnstileVerifier({ secretKey: getServicesEnv().turnstile.secretKey });
  return s.verifyTurnstile;
};

/** undefined when Jev is switched off (JEV_DISABLED=1) */
export const getApplicationScreener = (): ApplicationScreener | undefined => {
  const s = services();
  const { jev } = getServicesEnv();
  if (jev) s.screenApplication ??= createJevScreener(jev);
  return s.screenApplication;
};

/** the Anthropic key pool's encryption (KEY_ENCRYPTION_KEY): only the admin's key pages need it */
export const getKeyBox = (): KeyBox => {
  const s = services();
  s.keyBox ??= createKeyBox(parseMasterKey());
  return s.keyBox;
};

/** checks keys, and federations when ANTHROPIC_FEDERATION_AUDIENCE is set */
export const getKeyChecker = (): KeyChecker => {
  const s = services();
  if (!s.checkKey) {
    const { federation } = getServicesEnv();
    s.checkKey = createAnthropicKeyChecker(federation ? { identityToken: createEntraTokenProvider(federation) } : {});
  }
  return s.checkKey;
};
