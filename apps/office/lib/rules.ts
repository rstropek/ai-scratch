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
/** the highest monthly cap per Anthropic key, in whole euros (a typo guard, not a policy) */
export const KEY_CAP_MAX_EUR = 10_000;
/** Anthropic keys are used highest priority first */
export const KEY_PRIORITY_MAX = 1000;

// Access codes and budgets: the starting values of the env vars in docs/platform-plan.md ("Budgets"). The public
// page /access shows them; once budgets are built, these are the env vars' defaults, so keep both in step.
/** the longest validity window of an access code */
export const CODE_MAX_HOURS = 4;
/** the AI cost of one access code */
export const CODE_BUDGET_EUR = 5;
/** access codes from the free budget per account and calendar month */
export const FREE_CODES_PER_ACCOUNT_MONTH = 5;
/** the free budget's AI cost per account and calendar month */
export const BUDGET_ACCOUNT_EUR_MONTH = 10;
/** the free budget's AI cost for all accounts together per calendar month */
export const BUDGET_TOTAL_EUR_MONTH = 100;
/** an own OpenRouter key: the most it may have left (limit_remaining, dollars) when a code is created from it */
export const OWN_KEY_MAX_REMAINING_USD = 25;
