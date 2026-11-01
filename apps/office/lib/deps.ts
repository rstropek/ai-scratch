// What the server actions and pages hand to registration.ts, applications.ts, anthropic-keys.ts, openrouter-keys.ts
// and codes.ts, from the environment. Server-only.
import type { KeyDeps } from './anthropic-keys.ts';
import type { ApplicationDeps } from './applications.ts';
import type { CodeDeps } from './codes.ts';
import { loadEnv } from './env.ts';
import type { OpenRouterDeps } from './openrouter-keys.ts';
import type { RegistrationDeps } from './registration.ts';
import {
  getApplicationScreener,
  getDb,
  getKeyBox,
  getKeyChecker,
  getMailer,
  getOpenRouterKeyReader,
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

export const openRouterDeps = (): OpenRouterDeps => ({
  db: getDb(),
  box: getKeyBox(),
  readKey: getOpenRouterKeyReader(),
});

export const codeDeps = (): CodeDeps => ({ ...openRouterDeps(), limits: getServicesEnv().limits });
