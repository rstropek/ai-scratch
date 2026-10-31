// What the server actions hand to registration.ts and applications.ts, from the environment. Server-only.
import type { ApplicationDeps } from './applications.ts';
import { loadEnv } from './env.ts';
import type { RegistrationDeps } from './registration.ts';
import { getApplicationScreener, getDb, getMailer, getServicesEnv, getTurnstileVerifier } from './services.ts';
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
