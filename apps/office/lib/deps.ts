// What the server actions hand to registration.ts, applications.ts and anthropic-keys.ts, from the environment.
// Server-only.
import type { KeyDeps } from './anthropic-keys.ts';
import type { ApplicationDeps } from './applications.ts';
import { loadEnv } from './env.ts';
import type { RegistrationDeps } from './registration.ts';
import {
  getApplicationScreener,
  getDb,
  getKeyBox,
  getKeyChecker,
  getMailer,
  getServicesEnv,
  getTurnstileVerifier,
} from './services.ts';
import { getAuth } from './session.ts';

export const registrationDeps = (): RegistrationDeps => {
  const { authSecret, baseURL } = loadEnv();
  return {
    db: getDb(),
    auth: getAuth(),
    mailer: getMailer(),
    secret: authSecret,
    baseURL,
    verifyTurnstile: getTurnstileVerifier(),
  };
};

export const applicationDeps = (): ApplicationDeps => ({
  db: getDb(),
  mailer: getMailer(),
  screen: getApplicationScreener(),
  adminNotifyEmail: getServicesEnv().adminNotifyEmail,
  baseURL: loadEnv().baseURL,
});

export const keyDeps = (): KeyDeps => ({ db: getDb(), box: getKeyBox(), check: getKeyChecker() });
