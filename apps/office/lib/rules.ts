// Limits that the forms (client) and the server share. No imports: client components load this file.

export const MIN_PASSWORD_LENGTH = 12;
/** better-auth's default; its createUser doesn't check the minimum, so registration.ts checks both */
export const MAX_PASSWORD_LENGTH = 128;

/** how long a confirmation link works: school mail servers often hold back a first email for minutes */
export const LINK_VALID_MINUTES = 30;

/** registrations per hour from one IP address (App Service's X-Client-IP) */
export const REGISTRATIONS_PER_IP_HOUR = 5;

/** registrations per hour for one email address (no mail bombing through the form) */
export const REGISTRATIONS_PER_EMAIL_HOUR = 3;

export const SCHOOL_NAME_MAX = 200;
export const SCHOOL_URL_MAX = 300;
export const SUMMARY_MIN = 20;
export const SUMMARY_MAX = 1000;
export const NAME_MAX = 100;
/** the admin's internal note on a decision */
export const NOTE_MAX = 1000;

/** Jev checks per account: each costs money; after that, applications reach Rainer unchecked */
export const MAX_JEV_CHECKS = 5;

/** who donated an Anthropic key */
export const DONOR_MAX = 100;
/** the highest monthly cap per Anthropic key, in whole dollars (a typo guard, not a policy) */
export const KEY_CAP_MAX_USD = 10_000;
/** Anthropic keys are used highest priority first */
export const KEY_PRIORITY_MAX = 1000;

/** the name an adult gives an own OpenRouter key */
export const OPENROUTER_LABEL_MAX = 100;

// The budgets' limits (codes, accounts, the month) live in @ai-scratch/db/limits: both apps read them from env.
