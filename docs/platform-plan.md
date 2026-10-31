# Platform plan: from event app to classroom offering

Status: **iteration 1 of the office implemented** (login, one protected page; Azure setup pending). The outcome of the architecture discussion of 2026-10-31. Each point is
marked **decided** (Rainer agreed), **proposed** (Claude's suggestion, not confirmed yet) or **open**.

## Why

The Digiferien event (about 200 kids at 10 schools) went well, and teachers want to keep using the app in
"Digitale Grundbildung". AGENTS.md's "one-time event, don't build for the long term" no longer holds: the app
becomes an ongoing offering at **ai-scratch.dev**, with a website around it and free access for teachers,
paid for with donated API credits. AGENTS.md and the topic docs get updated once this is implemented.

## Overview

```
ai-scratch.dev          apps/app: today's kids' app, same tech: Vite SPA + Scratch iframe + Hono
                          /api/chat, /api/ask, /api/compact, /api/locker
                          + code check and cost tracking against Postgres, Anthropic key pool,
                            "frage KI" switch per code
office.ai-scratch.dev   apps/office: Next.js (App Router)               → App Service container
                          registration and teacher application, area for teachers and parents, /admin (Rainer)
                          better-auth, emails via Resend
packages/db             data access, limits from env, code generator: shared by both apps
Postgres                Azure Database for PostgreSQL Flexible Server, Burstable B1ms, northeurope
```

- **Decided:** two apps side by side: the kids' app and the office (teachers and admin). Next.js for the office;
  the kids' app keeps its stack (Vite + React + Hono). Reasons:
  - Next.js covers forms, sessions, emails and admin in one framework.
  - The kids' app is a pure browser app around the unmodified Scratch bundle and a chat server proven with
    200 kids at once. Porting it would be risk without gain.
  - Office deploys (often, at first) never restart the kids' app during a lesson, office failures never reach
    it, and the teachers' login cookie never reaches the origin that runs Scratch and kids' projects.
- **Decided:** the kids' app at **ai-scratch.dev** (kids type the shortest address), the office at
  **office.ai-scratch.dev**. The office's session cookie stays host-only (no `Domain`); both hosts are the same
  site, so better-auth's origin checks (`trustedOrigins`) still matter.
- **Decided, done (2026-10-31):** an npm workspace at the repo root with `apps/app` (the kids' app),
  `apps/office` and `packages/db`. The slide deck stays in `apps/app/slides` with its own packages.
- **Decided:** old links may break; no compatibility redirects (school codes, `?code=` links, the old host
  name).
- **Proposed:** the kids' app reads codes and writes spend straight to the database and never calls the office
  at runtime. A broken or redeploying office then never interrupts a lesson.
- **Done (iteration 1):** a second App Service web app for the office (`ai-scratch-office`) on the existing P0v3
  plan `ts-web-playground`, deployed by CI straight to production, no staging slot (Next.js
  `output: 'standalone'`). Script: `apps/office/scripts/azure/provision.sh`.
- **Open:** where the public content pages live (what it is, exercises, videos, safety, Impressum, Datenschutz,
  terms of use): in the office, or as static pages in the kids' app.
- **Open:** whether the event's video page (`/digiferien-2026-live`) and the slide deck (`/slides/`) move to
  the office or stay in the kids' app.

## Languages

- **Decided:** iteration 1 is German only (website, teacher area, emails, kids' app). A later iteration supports
  German and English.
- **Proposed:** build iteration 1 so English can be added without a rewrite:
  - user-facing texts in one place per app instead of scattered literals;
  - German stays at the root URLs, English later under `/en/`;
  - a teacher's and a code's language get a field once English arrives (the kids' app then picks the prompt,
    the guard's fixed answers and the UI texts from the code's language).

## Data: Postgres

- **Decided (2026-10-31, replaces Cosmos DB serverless):** Azure Database for PostgreSQL Flexible Server,
  **Burstable B1ms** (1 vCore, 2 GiB), Postgres 17. Always on, so no wake-up delay.
- **Region `northeurope`** (Claude, technical): the subscription may not create Postgres servers in
  `westeurope` or `germanywestcentral`. North Europe is the cheapest open EU region and West Europe's pair.
- **Cost** (Azure list prices, 2026-10-31): compute €0.0158/h ≈ €11.53 + 32 GiB storage (the minimum) at about
  €0.12/GB ≈ €3.86, backups free up to the storage size: **about €15.40 a month**, used or not.
  The cheapest managed Postgres; a self-managed one on a VM saves ~€9 a month but means our own backups and
  patching.
- **Why Postgres over Cosmos (serverless would cost cents):** less to build and less risk.
  - better-auth supports it out of the box (its Drizzle adapter): no adapter of our own.
  - Local development and CI use the official `postgres` Docker image (a service container in GitHub
    Actions): no emulator with feature gaps.
  - Budget sums per teacher and month and the atomic spend updates are plain SQL with transactions.
- **Done (iteration 1):**
  - Public endpoint with TLS; firewall for Azure services and the admin's IP. Login with the web app's managed
    identity (Entra authentication; `pg` takes a token callback as password), so no database password. No
    VNet: it would need VNet integration for the App Service plan.
  - One database (`aiscratch`), owned by the office's role.
  - One schema in `packages/db`, migrations generated by `drizzle-kit`, applied by the office on start; better-auth's
    CLI generates the auth tables into it (better-auth's Drizzle adapter). Details: `docs/database.md`.
- **Proposed:** both apps connect: the office for everything, the kids' app to check codes and add spend.
- **Decided:** **Drizzle** as the ORM, in both apps. Data access uses Drizzle's built-in mechanisms (query
  builder, relational queries, `drizzle-kit` migrations); hand-written SQL is allowed, but the exception.
- **Proposed data shape:**
  - `codes` (teacher, time window, budget, comment, "frage KI" switch, spend). Unique among codes that haven't
    expired: checked in the insert's transaction, because a partial index can't use `now()`.
  - Monthly counters (overall, per teacher, per key): `INSERT … ON CONFLICT DO UPDATE SET eur = eur + …`.

## Auth: better-auth

- **Decided:** better-auth on Postgres through its Drizzle adapter, with the `admin` plugin for roles (`admin` /
  `user`), user management, banning and impersonation.
- **Decided:** iteration 1 logs in with **email + password**. The other ways follow later.
- **Done (iteration 1):** no open sign-up (`disableSignUp`); your account has the admin role (created with
  `npm run seed:admin -w apps/office`); sessions end after 8 hours without use (shared school PCs), "Abmelden"
  always visible; passwords at least 12 characters.
- **Proposed:**
  - Accounts are created on the confirmation page, where people set their password
    ([registration](#registration-and-teacher-applications)). This replaces the earlier proposal that accepting
    an application creates the account.
  - Password reset by email.
- **Later (discussed, not scheduled):**
  - Email one-time code (better-auth `emailOTP`; it has no "remember me", which is fine).
  - SSO with a multi-tenant Entra app:
    - better-auth's Microsoft provider with `tenantId: "organizations"`, a client assertion instead of a
      secret;
    - only `openid profile email`;
    - linking only explicitly, from inside the teacher area (`disableImplicitLinking`), because Entra's
      `email` claim isn't reliably verified;
    - needs **publisher verification**, or many school tenants block consent.
  - Device authorization and MCP for teachers (`oauthDeviceAuthorization`, `@better-auth/mcp`).

## Registration and teacher applications

Decided by Rainer on 2026-10-31; it replaces the earlier teacher-only application form.

**Two kinds of adults:**

- **Parents** (and other adults) enter budget-limited OpenRouter keys (at most €25, see
  [own OpenRouter keys](#own-openrouter-keys-teachers-and-parents)). They can create codes once they have a
  valid key.
- **Teachers** can do the same, and can also use the free budget (donated keys).
- **A teacher whose application isn't accepted is treated like a parent.**

**The steps:**

1. **Registration page:**
   - The email address.
   - Teacher or parent.
   - Confirming they are at least 18.
   - Accepting the terms of use (text still to be written). The full terms sit behind a link; their key points
     are shown on the page itself.
   - Agreeing that AI processing can happen outside the EU
     ([where data is processed](#where-data-is-processed)).
2. **Confirmation email:** a link with the email address and an expiry time, symmetrically encrypted. Nothing
   is stored in the database before the link is used. Rainer named 5 minutes as the expiry.
3. **The link:** for a parent, the registration is complete.
4. **Teachers only:**
   - They fill in the school's name, the school's URL and a summary of why they want access.
   - Jev checks the answers and refuses obviously invalid ones.
   - Once the application gets through, you get an email.

**Protection of the registration page:**

- **Cloudflare Turnstile** (managed mode), not Google reCAPTCHA: no tracking cookies, no ad use of the data,
  free, one server-side check. Mention it in the privacy policy.
- No honeypot. Rate limits as a second layer: **5 registrations per hour per IP** and **3 per hour per email
  address** (no mail bombing via the form). Counted in Postgres (several instances), from the client IP App
  Service forwards.

**Proposed:**

- **The link is valid for 30–60 minutes instead of 5.** School mail servers often hold back a first email
  from an unknown sender for 5–15 minutes, so many links would arrive expired.
- **The link only opens a page.** The account is created when the person sets a password there and submits
  it, because mail scanners (Outlook Safe Links, Defender) open links on their own. Sign-up stays disabled in
  better-auth (`disableSignUp`); the server creates the account.
- **The encrypted link holds everything from step 1:**
  - the email address, the role, the 18+ confirmation and the consent;
  - the version of the terms and when they were accepted;
  - the expiry time.

  It uses AES-256-GCM, which also detects tampering. The account stores the terms' version and time when it is
  created.
- **No hint that an address already has an account.** The page answers the same either way; the email then
  says "Sie haben schon ein Konto" with a link to reset the password.
- **The teacher form also asks for the grades they teach** (Schulstufen), ticked from a list: Volksschule,
  Mittelschule/AHS-Unterstufe, Oberstufe.
- **Jev answers are capped per account** (each check costs money). When Jev refuses an answer, the form says
  why, so a real teacher can fix it.
- **Your email hints when the email domain doesn't match the school's URL.** It's a hint, not a gate.
- **Labels for the choice:** "Lehrkraft" and "Eltern oder andere Erwachsene (z. B. CoderDojo, Jugendgruppe)".
- **One terms document with a section per role**, so there's one version to track. The page shows the key
  points for the role chosen.
- **Later applications:** a parent can apply later from their account ("Als Lehrkraft bewerben"). Someone
  rejected may apply again, and you see the earlier rejection.
- **Emails to the teacher** on acceptance and rejection, through Resend from `mail.ai-scratch.dev`.
- **Legal texts that change with parent accounts:**
  - The privacy statement: we store adults' email addresses and encrypted keys, not only teachers' details.
  - The safety table: "Codes only from teachers" becomes "Codes only from adults with an account".

## Kids' ways into the chat

1. **A teacher's code backed by the donated keys** (the normal case).
2. **A code backed by an adult's own OpenRouter key** (a teacher's or a parent's).
3. **A parent's OpenRouter key typed straight into the kids' app** (as today): for non-teachers who let their
   kids try it occasionally or once. **Proposed:** this goes away once parent accounts exist. Parents then
   have a single way in with a single set of terms, the key never reaches a kid's device, and the kid only
   sees a code that runs out.

Every way needs an adult: kids can't get access on their own. The per-school codes of the event go away.
**Open:** whether `admin_` test codes stay (via env).

## Access codes

- **Decided:**
  - Generated automatically; the teacher can choose their own instead.
  - A comment per code (example: "1A Digitale Grundbildung am 31.10.2026").
  - The validity window can start in the future and lasts at most 4 h.
  - The "frage KI" block can be switched off per code.
- **Proposed:**
  - Generated format: a kid-friendly German word + 4 digits (`TIGER-4821`), no offensive words.
  - Not case-sensitive.
  - A teacher's own code: at least 6 characters (letters, digits, dash), unique among codes that haven't
    expired, reusable after expiry.
  - Comment up to 200 characters, visible only to the teacher and you, with the hint "keine Namen von Kindern".
  - Failed code attempts limited per IP.
- **Open:** whether "frage KI" is on or off by default for a new code (parents' keys: always on).

## Budgets

- **Decided:** limits come from env vars (plain app settings, not secrets). Starting values:

  | Variable | Value |
  |---|---|
  | `BUDGET_TOTAL_EUR_MONTH` | 100 |
  | `BUDGET_TEACHER_EUR_MONTH` | 10 |
  | `CODES_PER_TEACHER_MONTH` | 5 |
  | `CODE_BUDGET_EUR` | 5 |
  | `CODE_MAX_HOURS` | 4 |

  Changing them needs a restart, so do it outside school hours.
- **Decided:** **only actual spend counts**, nothing is reserved, and the overall budget may be overbooked.
- **Decided:** codes backed by an own OpenRouter key have only the per-code limits (`CODE_BUDGET_EUR`,
  `CODE_MAX_HOURS`). That holds for parents' codes too (Rainer, 2026-10-31: change it if someone complains).
- **Proposed:** checks before every model call:

  | Check | Donated keys | Own OpenRouter key (teacher or parent) | Parent's key typed into the kids' app (today) |
  |---|---|---|---|
  | Code inside its time window | ✓ | ✓ | – |
  | Code spend < `CODE_BUDGET_EUR` | ✓ | ✓ | – |
  | Teacher's spend this month < `BUDGET_TEACHER_EUR_MONTH` | ✓ | – | – |
  | Overall spend this month < `BUDGET_TOTAL_EUR_MONTH` | ✓ | – | – |
  | A key in the pool has budget left | ✓ | – | – |
  | Key limit at OpenRouter | – | ✓ (OpenRouter enforces it) | ✓ (as today) |

- **Proposed:**
  - After each call, the actual cost goes atomically onto the code and the monthly counters.
  - Creating a code with donated keys needs: the teacher under their monthly budget and code count, and the
    overall budget not used up.
- **Proposed:**
  - Months are calendar months, Vienna time; a code's spend counts toward the month it was created in.
  - Providers bill in dollars, converted at a fixed `USD_PER_EUR`.
  - Emails to you at 80 % of the overall budget and when a key runs out.
- **Consequence of overbooking:** when the overall or a teacher's budget runs out, every running code under
  it stops, even mid-lesson. Kids get a German message. The overshoot is at most the calls already in flight.

## Anthropic key pool

- **Decided:** several Anthropic keys (Rainer's credits, friends' donations). When one key's budget is used up,
  the system switches to the next.
- **Decided (Rainer, 2026-10-31):** every donated key has a cap per calendar month (Vienna time), configurable
  per key (`capEurMonth`).
- **Proposed:**
  - One Key Vault secret holds JSON: `[{id, key, workspaceId, donor, capEurMonth, priority}]`. No admin page
    and no encryption code for keys. The database stores usage per key `id` only.
  - A session sticks to its key (prompt caching), otherwise the active key with the highest priority that
    has budget left. Keys are used up one at a time, not in rotation.
  - A key counts as used up when its monthly spend reaches its cap, or when Anthropic refuses it (billing,
    spend limit, invalid key). The same call is then retried on the next key at once; that's safe because
    those errors arrive before anything streams.
  - Donors should also set a spend limit in the Anthropic Console as a second safety net.
  - With no key left, kids get a German message and you get an email.
- **Open:** whether Anthropic accepts signed thinking blocks from another organisation's key when a session
  switches mid-turn. If not, the server drops old thinking blocks on a switch.

## Own OpenRouter keys (teachers and parents)

- **Decided:** teachers and parents can enter budget-limited OpenRouter keys and create codes from them.
- **Decided (Rainer, 2026-10-31):** we never hold an OpenRouter key that can spend more than **€25**, whoever
  entered it (teacher or parent). If a key leaks, at most that much is lost. Checked when the key is entered and
  **every time a code is created from it**.
- **Proposed:**
  - The cap applies to what the key can still spend, OpenRouter's `limit_remaining` (in dollars, converted
    with `USD_PER_EUR`), not to its `limit`. A key with no reset can then be topped up, by raising its limit by
    at most €25 above what it has already spent, without ever being worth more than €25.
  - Keys whose limit resets (daily, weekly, monthly) are refused: a leaked key would lose €25 again after every
    reset.
  - The kids' app checks the cap too, with its existing `GET /key` check (every 5 minutes). A key raised
    above the cap after the code was created stops its codes, and its owner gets an email.
  - Checked like keys typed into the kids' app today (`GET /key`; keys without a limit are refused).
  - Stored encrypted (AES-GCM, master key in Key Vault, readable by both apps). Unlike keys typed into the
    kids' app, they are stored, so the terms must say so.
  - Deleting a key stops its codes.

## "frage KI" block

- **Decided:**
  - Not limited to Scratch: general questions ("Was ist die Hauptstadt von Österreich?") must pass.
  - Jev screens it for things like hate speech, bullying and sexual content.
  - Teachers can switch the block off per code.
- **Already true today:** the block's own Jev questions (`BLOCK_QUESTIONS` in `src/server/guard.ts`) check:
  - distress, insults, inappropriate topics (sex, violence, drugs, hate against groups);
  - bullying of real people, personal data, flooding, jailbreaks;
  - no topic limit ("Wie hoch ist der Mount Everest?" passes in `kids-protection.md`).
- **Proposed:**
  - Add explicit general-knowledge cases to the eval set.
  - Try hate speech as its own Jev question (check with `npm run eval:guard`).

## Kids' safety and Anthropic's guidance for minors

**Decided** (from Anthropic's guidance for products used by minors), with the measures:

| Rule | Exists | New |
|---|---|---|
| No kid gets in without an adult | Codes only from teachers; parents' keys need a spending limit | Teacher application with real identity and review; codes limited in time |
| Working with an AI is never hidden; learning to work with AI is the whole point | "KI-Helfer" in the top bar and greeting | Core message on the website; a line under the chat input ("Du schreibst mit einer KI.") |
| Child safety measures | Jev guard, output limits, test set `docs/kids-protection.md` | Website page "Sicherheit & Jugendschutz" that renders `kids-protection.md` from the repo at build time |
| Limited to Scratch, not a general chatbot | Prompt (teaching mode), project-only tools, Jev `misuse` | "frage KI" stated honestly as the exception: short answers, inside the kid's own program, screened, switchable per code |
| Teachers and parents supervise and tell kids not to enter personal data | Jev `personal_data` with its German answer | In the teachers' terms (application) and the parents' terms (`TermsDialog`); hint in the app ("Gib keine echten Namen, Adressen oder Telefonnummern ein.") |
| A game, used anonymously by kids; only teachers reveal their identity | No kid accounts, random session id, no stored conversations, anonymous Locker codes | Stated on the website; only teachers' data is stored, covered by the privacy statement |

## Where data is processed

- **Decided (Rainer, 2026-10-31):** the terms state clearly that AI processing can happen outside the EU,
  including AI used for safety:
  - checking registrations and applications against fraud (Jev);
  - preventing misuse of the AI features, kids' protection included.

  Everyone who registers is an adult and consents to this **explicitly**, so Jev may check applications.
- **Proposed:**
  - The consent is its own checkbox, not part of "I accept the terms". It's stored with the terms' version and
    time.
  - Withdrawing consent means deleting the account.
- **Proposed wording:**

  > Personenbezogene Daten (die Angaben der registrierten Erwachsenen) speichern wir auf Servern in der EU.
  > KI-Verarbeitung, auch zur Sicherheit (Prüfung von Registrierungen gegen Missbrauch, Schutz vor Missbrauch
  > der KI-Funktionen, Jugendschutz), kann außerhalb der EU stattfinden (Anthropic, OpenRouter, TypeSafe). Das
  > gilt auch für das, was Kinder in den Chat oder in den „frage KI“-Block schreiben. Darum dürfen Kinder keine
  > persönlichen Daten eingeben.

- **True today in the EU:** app, Key Vault, storage and the future Postgres server in `westeurope`, App Service logs
  with IP addresses, the CoderDojo Locker (hosted in Europe), slide fonts (self-hosted).
- **Gaps to close before the statement holds:**

  | Where | What leaves the EU | Fix |
  |---|---|---|
  | Videos from `share.descript.com` | Visitors' IP addresses | An EU video host (for example Bunny Stream) or a two-click embed; self-hosting from Blob is costly because each kid watches about 2.5 h |
  | Scratch library from `cdn.assets.scratch.mit.edu` | Kids' IP addresses | Proxy or mirror the library through our server |
  | Resend (US company, sending region `eu-west-1`) | Teachers' names and email addresses | Check Resend's data processing agreement and subprocessors |

- **Open:**
  - Where TypeSafe (Jev) processes data.
  - The legal basis for US transfers (Data Privacy Framework, standard contractual clauses) and the final
    legal texts. These are for a lawyer, not for the code.

## Exercises (idea, not discussed in detail)

- **Proposed:** one folder per exercise:
  - `aufgabe.md` for kids and teachers;
  - an optional starter project `start.sb3`;
  - an optional `ki-hinweis.md` with the goal and what not to give away, which the server adds to the prompt.

  The website's "Starten" button opens `ai-scratch.dev/?aufgabe=<id>`.

## Order (proposed)

1. **Iteration 1 of the office** (decided: Rainer, 2026-10-31; code done 2026-10-31): Postgres, an empty Next.js
   app per our rules (`create-next-app`, current packages), better-auth with email + password, Rainer
   (rainer@software-architects.at) with the `admin` role and no limits, one protected "hello world" page.
   No other logic. On top: deployment at office.ai-scratch.dev (own web app, CI deploys to production) and
   Rainer's account from a seed script. **Open:** running the Azure scripts and the seed against production.
   Then: content pages.
2. Database, registration and applications, admin, login, codes with the key pool and budgets.
3. Own OpenRouter keys (teachers and parents).
4. Exercises with starter projects.

## Still open

- The real cost per kid and per class-hour, from the event logs in Blob, to check the 5 € per code.
- The tech-stack discussion continues (Rainer, 2026-10-31).
- The open points above: video page and slides, `admin_` codes, "frage KI" default, thinking blocks across
  keys, Jev's data location, video hosting, legal texts.
