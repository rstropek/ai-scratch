# Registration and teacher applications

How adults get an office account and how teachers get confirmed. The decisions behind it:
[platform-plan.md](platform-plan.md#registration-and-teacher-applications). Code: `apps/office/lib/registration.ts`,
`lib/applications.ts`, `lib/jev.ts`; the tables in `packages/db/src/schema/office.ts`.

## The flow

`/register` (email, role, 18+, terms, AI consent, Turnstile) → email with a link → `/register/confirm?t=…` (name,
password) → account, signed in → parents: done; teachers: `/apply` (school, website, Schulstufen, summary) → Jev →
open application, mail to the admin → `/admin` → accept or reject, mail to the applicant.

## Principles and traps

- **Nothing is stored before the link is used.** The link's token holds the whole registration (address, role,
  terms version, consent time, expiry), sealed with AES-256-GCM. The key is derived from `BETTER_AUTH_SECRET`
  with HKDF (`lib/secrets.ts`, one purpose per key): no new secret, but **rotating the auth secret kills open
  links** (and sessions). Links are valid 30 minutes (`LINK_VALID_MINUTES`).
- **The link only opens a page; the submit creates the account.** Mail scanners (Safe Links, Defender) follow
  links. Never create or change anything in a page's render.
- **Accounts are created with `auth.api.createUser` without headers** (a server call without a session may);
  sign-up stays disabled. `createUser` checks neither the minimum password length nor the password policy:
  `completeRegistration` does. Then `auth.api.signInEmail` in the server action sets the cookie (`nextCookies`).
- **No hint that an address has an account:** the form answers "check your mail" either way; the mail differs
  (link vs. "Sie haben schon ein Konto" with login and reset links). Keep both paths equally fast enough; the
  rate limit runs first in both.
- **Rate limits in Postgres** (`registration_attempt`): 5 per hour per IP, 3 per hour per address. Only
  HMACs of the IP and address are stored, rows older than an hour go on each request. Requests that fail
  Turnstile are not counted. The IP is App Service's `X-Client-IP` (`lib/client-ip.ts`, the same order as
  better-auth's `ipAddressHeaders`).
- **Turnstile fails closed** (an unreachable siteverify refuses the submit). The widget renders explicitly and is
  reset after every answer: a token works once. The site key reaches the page as a prop from the server
  (runtime env), not as `NEXT_PUBLIC_`, because the build has no environment.
- **Jev fails open and is capped:** at most `MAX_JEV_CHECKS` (5) checks per account (`adult_profile.jev_checks`,
  counted atomically); after that, or on any Jev error, the application reaches the admin unchecked, and the
  admin sees why. Refusals store nothing and name the reason in the form. Threshold 0.8: a wrongly refused
  teacher costs more than one more application to read. `JEV_DISABLED=1` (local, e2e) skips it explicitly;
  without it `JEV_API_KEY` is required.
- **One open application per account** (a partial unique index); an accepted one ends applying, a rejected one
  allows a new one. "Teacher" for anything later means an `accepted` application (`isTeacher`); the profile's
  `kind` only says what someone registered or applied as.
- **Mails are plain text.** In development and e2e, `MAIL_OUTBOX_DIR` writes them as JSON files instead of
  sending (`lib/mail.ts`); e2e tests read the links from there. A failed mail to the admin or applicant never
  undoes the application or the decision; the admin page says when the applicant's mail didn't go out.
- **The decision redirects** (`?decided=…`): the form disappears with the open application, so its own state
  can't carry the result.
- **Admin pages check the role in every server action** too; the page's check doesn't protect the action.
- **A new terms version blocks the account until it agrees again** (`/consent`, [legal-texts.md](legal-texts.md)).
  `requireSession` does the check (one query per request, cached); only `/consent` and its action pass
  `outdatedTerms: 'allow'`. Server actions that call `requireSession` redirect there too.
