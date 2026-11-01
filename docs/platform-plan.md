# Platform plan: from event app to classroom offering

Status: **iteration 2 of the office implemented** (registration of parents and teachers, email confirmation,
teachers' applications for the free budget screened by Jev, the admin's account list, decisions and free-budget
switch, password reset), **and the admin's Anthropic key pool** (`/admin/keys`); next:
[iteration 3](#iteration-3-codes-own-openrouter-keys-the-kids-app-on-the-database) (codes, own OpenRouter keys, the
kids' app on the database), detailed and partly decided, not built yet. The outcome of the architecture discussion
of 2026-10-31. Each point is marked **decided** (Rainer agreed), **proposed** (Claude's suggestion, not confirmed yet) or **open**.

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
- **Done (2026-10-31):** the legal pages live in the office, public and static (`app/(info)/`); the terms of
  use at `/terms` (draft for a lawyer, `docs/legal-texts.md`); since 2026-11-01 also `/access`, a click-through of
  codes, budgets, the key pool and federation as designed here. **Open:** where the other content pages live
  (what it is, exercises, videos, safety): in the office, or as static pages in the kids' app.
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
- The data shape of codes, keys and usage: [iteration 3](#iteration-3-codes-own-openrouter-keys-the-kids-app-on-the-database).

## Auth: better-auth

- **Decided:** better-auth on Postgres through its Drizzle adapter, with the `admin` plugin for roles (`admin` /
  `user`), user management, banning and impersonation.
- **Decided:** iteration 1 logs in with **email + password**. The other ways follow later.
- **Done (iteration 1):** no open sign-up (`disableSignUp`); your account has the admin role (created with
  `npm run seed:admin -w apps/office`); sessions end after 8 hours without use (shared school PCs), "Abmelden"
  always visible; passwords at least 12 characters.
- **Done (iteration 2):**
  - Accounts are created on the confirmation page, where people set their password
    ([registration](#registration-and-teacher-applications)).
  - Password reset by email (`/forgot-password`, better-auth's reset link, all sessions end).
- **Decided (Rainer, 2026-10-31):** all URL parts are English (`/login`, `/register`, `/apply`, `/admin`, `/terms`);
  the pages stay German.
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

## Registration and the free budget

Decided by Rainer on 2026-10-31; it replaces the earlier teacher-only application form.

**Two kinds of adults, and one flag:**

- **Parents** (and other adults) and **teachers** register as what they are; nobody confirms a teacher's status.
- **Everyone** can enter budget-limited OpenRouter keys (at most $25 left when a code is created, see
  [own OpenRouter keys](#own-openrouter-keys-teachers-and-parents)) and creates codes once they have a valid key
  or the free budget.
- **The free budget** (donated keys) is a separate flag per account, the one thing you confirm (decided,
  Rainer 2026-10-31):
  - teachers ask for it with a checkbox at registration, **only there**, and send one application;
  - parents can't ask for it (for now);
  - you switch it on for anyone by hand, parents too (they get a mail), and off again (no mail).

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
   is stored in the database before the link is used. **Decided (Rainer, 2026-10-31): valid for 30 minutes.**
3. **The link:** the registration is complete.
4. **Teachers who asked for the free budget:**
   - They fill in the school's name, the school's URL and a summary of why they want access.
   - Jev checks the answers and refuses obviously invalid ones.
   - Once the application gets through, you get an email; accepting it switches the free budget on.

**Protection of the registration page:**

- **Cloudflare Turnstile** (managed mode), not Google reCAPTCHA: no tracking cookies, no ad use of the data,
  free, one server-side check. Mention it in the privacy policy.
- No honeypot. Rate limits as a second layer: **5 registrations per hour per IP** and **3 per hour per email
  address** (no mail bombing via the form). Counted in Postgres (several instances), from the client IP App
  Service forwards.

**Done (iteration 2)**, details and traps in `docs/registration.md`:

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
- **Jev checks every application** (decided, Rainer 2026-10-31), at most 5 times per account (each check costs
  money); after that, or when Jev fails, the application reaches you unchecked. When Jev refuses an answer, the
  form says why, so a real teacher can fix it.
- **Your email hints when the email domain doesn't match the school's URL.** It's a hint, not a gate.
- **Labels for the choice:** "Lehrkraft" and "Eltern oder andere Erwachsene (z. B. Code Club, Jugendgruppe)"
  (Rainer, 2026-11-01: Code Club as the example, not CoderDojo; in the terms too).
- **Who may register, on the login page and the registration page** (Rainer, 2026-11-01): a yes/no list (teachers,
  parents and guardians, other adults who work with kids; no kids under 18, with a line in "du" saying where their
  code comes from) and, at the foot, the note that AI-Scratch is not Scratch's own offering.
- **One terms document with a section per role**, so there's one version to track (`TERMS_VERSION` in
  `apps/office/lib/terms.ts`).
- **No later applications** (Rainer, 2026-10-31): only the checkbox at registration leads to one, and there is
  one per account; after a rejection you can still switch the budget on by hand.
- **Emails** on acceptance and rejection, and when you switch the budget on, through Resend from
  `mail.ai-scratch.dev`. **Decided (Rainer, 2026-10-31):** the rejection says the free budget can't be switched
  on at the moment, but AI-Scratch works with their own OpenRouter keys. Switching it off sends nothing.
- **The admin's list** (`/admin`): every registered adult, filtered by open applications, free budget,
  teachers, parents (by what they registered as), all; searchable by name, email and school. Each account's page
  shows its consent, the free budget with its switch (Freischalten, Entziehen behind a confirmation; while an
  application is open, the application decides), every application with Jev's verdict, and Annehmen/Ablehnen
  (rejecting behind a confirmation).
- **The key points of the terms** on the registration page come from the terms page (`content/terms.tsx`), one
  list for both roles, not one per role.
- **Still open: legal texts that change with parent accounts:**
  - The privacy statement: we store adults' email addresses and encrypted keys, not only teachers' details.
  - The safety table: "Codes only from teachers" becomes "Codes only from adults with an account".

## Kids' ways into the chat

1. **A code from the free budget** (donated keys; teachers' normal case).
2. **A code backed by an adult's own OpenRouter key** (a teacher's or a parent's).
3. ~~A parent's OpenRouter key typed straight into the kids' app~~ (the event's way): removed in iteration 3.
   Parents have a single way in with a single set of terms, the key never reaches a kid's device, and the kid
   only sees a code that runs out.

Every way needs an adult: kids can't get access on their own. The per-school codes of the event go away.
**Decided (Rainer, 2026-11-01):** way 3 goes with [iteration 3](#iteration-3-codes-own-openrouter-keys-the-kids-app-on-the-database); `admin_` test codes become env test codes for dev and tests only.

## Access codes

- **Decided:**
  - Generated automatically. **Decided (Rainer, 2026-11-01): only generated codes**, adults can't choose their
    own (replaces "the teacher can choose their own instead").
  - A comment per code (example: "1A Digitale Grundbildung am 31.10.2026").
  - The validity window can start in the future and lasts at most 4 h.
  - The "frage KI" block can be switched off per code.
- **Proposed:**
  - Generated format: two kid-friendly German nouns + 2 digits (`TIGER-APFEL-48`), no offensive words; unique
    among codes that haven't expired.
  - Not case-sensitive.
  - Comment up to 200 characters, visible only to the teacher and you, with the hint "keine Namen von Kindern".
  - No limit on failed code attempts (Rainer, 2026-11-01: a limit per IP lets one kid lock out a class behind
    the school's NAT); the codes are hard enough to guess
    ([iteration 3](#iteration-3-codes-own-openrouter-keys-the-kids-app-on-the-database)).
- **Decided (Rainer, 2026-11-01):** "frage KI" is on for a new code.

## Budgets

- **Decided:** limits come from env vars (plain app settings, not secrets). Starting values:

  | Variable | Value |
  |---|---|
  | `BUDGET_TOTAL_USD_MONTH` | 100 |
  | `BUDGET_ACCOUNT_USD_MONTH` | 10 |
  | `FREE_CODES_PER_ACCOUNT_MONTH` | 5 |
  | `CODE_BUDGET_USD` | 5 |
  | `CODE_MAX_HOURS` | 4 |

  Changing them needs a restart, so do it outside school hours.
- **Decided:** **only actual spend counts**, nothing is reserved, and the overall budget may be overbooked.
- **Decided:** codes backed by an own OpenRouter key have only the per-code limits (`CODE_BUDGET_USD`,
  `CODE_MAX_HOURS`). That holds for parents' codes too (Rainer, 2026-10-31: change it if someone complains).
- **Proposed:** checks before every model call (how they are computed and cached:
  [iteration 3](#iteration-3-codes-own-openrouter-keys-the-kids-app-on-the-database)):

  | Check | Free budget (adult) | Free budget (admin) | Own OpenRouter key |
  |---|---|---|---|
  | Code exists, not deleted, inside its time window | ✓ | ✓ | ✓ |
  | The code's owner exists and isn't banned | ✓ | ✓ | ✓ |
  | Code spend (all months) < `CODE_BUDGET_USD` | ✓ | ✓ | ✓ |
  | The owner's free budget still switched on (switching it off stops its running codes) | ✓ | – | – |
  | The owner's free-budget spend this month < `BUDGET_ACCOUNT_USD_MONTH` | ✓ | – | – |
  | Overall free-budget spend this month < `BUDGET_TOTAL_USD_MONTH` | ✓ | ✓ | – |
  | A pool entry under 97.5 % of its cap, not refused | ✓ | ✓ | – |
  | The key exists; its limit at OpenRouter (OpenRouter enforces it) | – | – | ✓ |

  "Admin" is the owner's role at the time of the call: a former admin's codes get the adult's checks.
- **Decided (Rainer, 2026-11-01): everything in US dollars**, as providers bill: budgets, pool caps, display. No
  currency conversion. Months are calendar months, Vienna time.
- **Not in any budget:** the Jev guard's calls (TypeSafe, every kid message and "frage KI" text, every source,
  own keys included), paid by Rainer's TypeSafe key.
- **Consequence of overbooking:** when the overall or an account's budget runs out, every running code under
  it stops, even mid-lesson. Kids get a German message. The overshoot is what all instances spend before their
  next refresh (at most a minute), plus calls in flight.

## Anthropic key pool

- **Decided:** several Anthropic keys (Rainer's credits, friends' donations). When one key's budget is used up,
  the system switches to the next.
- **Decided (Rainer, 2026-10-31):** every donated key has a cap per calendar month (Vienna time), configurable
  per key (`capMonth`, in dollars from iteration 3).
- **Decided (Rainer, 2026-10-31, replaces the Key Vault JSON):** the admin maintains the keys on an admin-only
  page in the office. **Done (2026-10-31)**, details and traps in `docs/key-pool.md`:
  - Table `anthropic_key`: donor, the key sealed with AES-256-GCM (`KEY_ENCRYPTION_KEY` in Key Vault, for both
    apps), its last four characters, an optional workspace ID, `capMonth`, priority, active/paused.
  - Add, edit (also replace the key), pause, delete. A new key, or a new workspace, is checked with one tiny
    Anthropic call before it is saved; the key is never shown again.
  - **No remaining budget from Anthropic** (Rainer: "without budget"): Anthropic has no endpoint for a key's
    balance, only cost and usage reports with an Admin API key. `capMonth` is our own cap.
  - **The workspace ID** is needed only by keys not bound to a workspace (personal and service account keys).
- **Proposed:**
  - Every call uses the active entry with the highest priority that is usable: under 97.5 % of its cap and not
    refused. Entries are used up one at a time, not in rotation, so all sessions share one entry (prompt caching)
    until it is used up. No retry within a call
    ([iteration 3](#iteration-3-codes-own-openrouter-keys-the-kids-app-on-the-database)).
  - Donors should also set a spend limit in the Anthropic Console as a second safety net.
  - With no entry left, kids get a German message; the dashboard shows it.
- **Open:** whether Anthropic accepts signed thinking blocks from another organisation's key when a session
  switches mid-turn. If not, the server drops old thinking blocks on a switch.

### Federated pool entries (Workload Identity Federation)

- **Decided (Rainer, 2026-11-01):** besides keys, the pool takes **federated entries**: no key at all, our Azure
  identity is trusted by the donor's Anthropic organisation. Not a replacement for keys; mainly for Rainer's
  own organisation, the main donor. Other donors would need an org admin, so keys stay the normal donation.
- **Proven (2026-11-01):** a throwaway container with the managed identity called Claude through Rainer's org;
  setup, IDs and traps (issuer lifetime 25 h, JTI off) in `docs/anthropic-federation.md`.
- **Decided (Rainer, 2026-11-01):** the office side first, the kids' app's client with the pool. In the list, two
  buttons: "Föderation hinzufügen" next to "Schlüssel hinzufügen", each with its own form.
- **Built (2026-11-01), office side:** table, admin pages, check, provision.sh, local debugging with `az login`
  (`docs/key-pool.md#federations`).
- **Technical** (built in the office so far):
  - **How it works:** an app gets an Entra token for its managed identity, exchanges it at Anthropic
    (`POST /v1/oauth/token`, jwt-bearer) for an access token that lasts minutes, and calls Claude with it.
    `@anthropic-ai/sdk` 1.x does both: `credentials: oidcFederationProvider({ identityTokenProvider, … })`
    from `@anthropic-ai/sdk/lib/credentials/oidc-federation`, refreshed by the client's `TokenCache`.
  - **One user-assigned managed identity for both apps** (both have system-assigned ones today, with different
    object IDs): one federation rule then covers the office's check and the kids' calls. Tokens come from
    `IDENTITY_ENDPOINT` (App Service) with the identity's `client_id`; IMDS isn't reachable there.
  - **Azure, once (provision.sh):** an app registration as the token audience (`api://<APP_ID>`,
    `requestedAccessTokenVersion=2`, with a service principal), the user-assigned identity on both web apps,
    app settings for the audience and the identity's client ID.
  - **Anthropic, once per donor organisation (Console, by its org admin):** an issuer
    `https://login.microsoftonline.com/<TENANT_ID>/v2.0` (discovery), a service account in the workspace, a rule
    with `audience: <APP_ID>` that matches the identity's `oid` and our `tid`. Never only the tenant: any
    workload in the tenant could then mint tokens.
  - **Table `anthropic_key`** gets a kind: `key` (as today) or `federation` with organisation ID, rule ID
    (`fdrl_…`), service account ID (`svac_…`, optional) and workspace ID. None of them is secret, so nothing
    is sealed. Donor, cap, priority and pausing stay the same for both kinds.
  - **The check** stays one tiny Messages call, after the exchange; the exchange's errors (unknown rule, claims
    that don't match) show like a refused key.
  - **The kids' app** keeps one client per federated entry, so it exchanges only when the token runs out.
  - **Tests:** the fake Anthropic answers `/v1/oauth/token` and plays App Service's identity endpoint. Locally,
    your `az login` stands in for the managed identity, with a rule of its own.
- **Open:** the kids' app's side, with the pool; attaching the identity to the kids' web app then.

## Own OpenRouter keys (teachers and parents)

- **Decided:** teachers and parents can enter budget-limited OpenRouter keys and create codes from them.
- **Decided (Rainer, 2026-10-31, replaces the earlier "never hold a key worth more than €25"):** when a code
  is created from a key, and **only then**, the key's remaining budget, OpenRouter's `limit_remaining`, must be
  **at most $25** (dollars as OpenRouter reports them, no conversion). Otherwise the code isn't created.
  - Keys whose limit resets (daily, weekly, monthly) are allowed.
  - Keys without a limit are refused (no `limit_remaining`).
  - Entering a key only checks that it works; no cap. A key worth more can be stored, but no code is created
    from it until its remaining budget is at most $25.
  - No later checks: raising the limit or a reset after the code was created doesn't stop the code. The terms
    make the key's owner responsible for its limit.
- **Proposed:**
  - Checked with OpenRouter's `GET /key`, like keys typed into the kids' app today.
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

## Iteration 3: codes, own OpenRouter keys, the kids' app on the database

Rainer, 2026-11-01: next after the key pool. Merges "codes, the kids' app on the pool, budgets" and "own
OpenRouter keys" ([order](#order-proposed) 2 and 3) into one iteration. **Straightforward code matters more than
covering every edge** (Rainer, 2026-11-01): where a rare case would need much code, the plan accepts a small
cost or a German "versuch es nochmal" instead.

**Decided (Rainer, 2026-11-01):**

- Adults create access codes once they have the free budget or a valid own OpenRouter key; the limits of
  [budgets](#budgets) apply. They see their codes with what is left of each.
- **Admins** use the free budget without switching it on, with the per-code limits only (`CODE_BUDGET_USD`,
  `CODE_MAX_HOURS`) and the overall budget; no account budget, no code count. They see every code with what is
  left.
- Adults delete their codes at any time, admins any code.
- **The kids' app takes codes from the database.** The OpenRouter key typed into the kids' app goes away (way 3 of
  [kids' ways](#kids-ways-into-the-chat)), and with it the school codes of `ACCESS_CODES`.
- **Usage is stored** per code, by source (free budget or own OpenRouter key) and per pool entry.
- "frage KI" is **on** for a new code.
- **Env test codes stay for dev and tests only** (`TEST_CODES` with `ANTHROPIC_API_KEY`, no hearts, like `admin_`
  codes today): the game harness and the kids' app's e2e need no Postgres. Never set on Azure.
- **The kid sees the code's end time** ("Code gilt bis 10:50" in the chat's top bar), never its budget.
- **US dollars everywhere** (budgets, pool caps, display), as providers bill: no currency conversion. The pool
  cap is `capMonth`; the env vars keep `USD` in their names.
- **The Locker works without a code**, always.
- **The admin maintains the model price** (only Haiku for now) on an admin page, with a button that fetches the
  current Haiku price from OpenRouter.
- **A warning email to all admins when 80 % of a budget is reached**, this iteration.
- **Budget numbers, no charts,** for adults and admins (basic, also for testing; enhanced later).
- **Generated codes only:** adults can't choose their own (replaces the earlier decision). With them goes the
  protection of the code entry: no proof of work, no challenge, no signed token; the codes are hard enough to
  guess (below).
- **Federation stays** in the kids' app.

**Proposed: data** (`packages/db`):

- `openrouter_key`: owner, label, the key sealed with the key box (row id as associated data), its last four
  characters, a fingerprint unique per owner. Deleting it deletes its codes too (`ON DELETE CASCADE`).
- `access_code`: the code (stored lowercase, shown uppercase), owner, source (`free` / `openrouter` with the key),
  start and end, "frage KI", comment, created. **Deleting is a real delete.** Unique among codes that haven't
  expired: checked in the insert's transaction under an advisory lock on the code, and on the owner, so two tabs
  can't both create the fifth code.
- **Codes:** two German nouns kids know and two digits (`TIGER-APFEL-48`), from a list of about 200 words checked
  by hand: about 4 million codes. Guessing one of 100 active codes takes about 40,000 tries for a $5 code that
  ends within 4 h; failed lookups are counted (`/api/stats`, the log), so that shows.
- `usage`: one row per code, Vienna month and pool entry (none for OpenRouter): calls and tokens by kind (input,
  output, cache write, cache read), **no cost**, no model (only Haiku; a second model adds the column).
  `INSERT … ON CONFLICT DO UPDATE` after each call, its unique index `NULLS NOT DISTINCT` (else an own-key call
  never matches its row). Every sum (code, account, pool entry, month, source) comes from this one table.
  - **No foreign keys:** the row carries the code's owner and source itself, so deleting a code, an own key, a
    pool entry or an account never lowers a month's sums.
  - **A cut call counts as `max_tokens` output** (the kid's "Stopp", a closed tab, the output guard): it has no
    final usage event. At Haiku's price that is under a cent per cut call, a harmless overcount, and no estimate.
  - **A failed write is logged,** nothing more.
- `model_price`: one row, dollars per million tokens for input, output, cache write (5 min) and cache read, who
  set it and when. The migration creates it with today's Haiku price; the form refuses 0. **Cost is always
  tokens × the current price**, so a corrected price corrects the whole month, and a real price change re-values
  the month's earlier calls too (accepted: Haiku's price rarely changes).
- `anthropic_key` gets `refusedAt` and `refusedReason`, written by the kids' app when Anthropic refuses the entry
  (billing, spend limit, invalid key): every instance then skips it, the dashboard shows it. Saving the entry in
  the office (after a successful check) clears it. Pool entries are deleted for real; a key deleted and added
  again within a month starts with a fresh cap (the admin's own doing).
- `capEurMonth` is renamed to `capMonth` (dollars) in one migration (Rainer, 2026-11-01: a deploy may break the
  old container for a minute).
- **Months** (changes "a code's spend counts toward the month it was created in"): spend counts in the month of
  the call (Vienna; Anthropic bills in UTC, an hour or two apart, which the 97.5 % absorbs). **A code's own budget
  counts over all months** (a code running over midnight on the 31st gets no fresh $5). **The code count goes by
  the month a code is created**, over codes that still exist: deleting one gives a code back, never money (the
  account's monthly budget still holds).
- The limits from env live in `packages/db` and are read by both apps; `lib/rules.ts`'s values become their
  defaults, and its `EUR` names become `USD` (`KEY_CAP_MAX_EUR` too).

**Proposed: office:**

- `/` becomes the adult's start page: the budget numbers, their codes, their OpenRouter keys, a "Neuer Code"
  button. Admins get `/admin/codes` as well.
- **Budget numbers:** plain figures (spent, limit, left) at the top of the start page, from the same sums the
  kids' app checks:
  - adults with the free budget: this month's spend and what is left of `BUDGET_ACCOUNT_USD_MONTH`, codes created
    and left of `FREE_CODES_PER_ACCOUNT_MONTH`;
  - adults with own keys: each key's `limit_remaining` from OpenRouter, and this month's spend through it;
  - admins, in addition: the overall month against `BUDGET_TOTAL_USD_MONTH`, each pool entry's spend against its
    `capMonth` (paused or refused shown), this month's OpenRouter spend, and the number of running codes.
- `/openrouter-keys`: add a key (label and key; `GET /key` only checks that OpenRouter knows it), the list with
  OpenRouter's current `limit_remaining`, read while the page loads ("nicht erreichbar" after 3 s), delete behind a
  confirmation that names the codes deleted with it.
- `/codes/new`:
  - the source: the free budget (when switched on, or for admins) or one of the account's keys;
  - the code is generated; "Neuer Vorschlag" draws another;
  - start (date and time, now by default, at most 30 days ahead) and duration (at most 4 h, 1 h by default);
  - comment (at most 200 characters, hint "keine Namen von Kindern"), "frage KI" (on).
  - **Checks when it is created:** the free budget switched on and fewer than `FREE_CODES_PER_ACCOUNT_MONTH`
    codes this month (admins: neither); an own key's `limit_remaining` set and at most $25. **No budget checks**
    here: every call checks money anyway.
- **The code list:** code, window, state (geplant, läuft, abgelaufen), source, comment, spent and left of
  `CODE_BUDGET_USD`. Delete behind a confirmation.
- `/admin/codes`: every code with its owner, filtered by running, planned, expired. `/admin/keys` shows each
  entry's month spend against its cap and whether it is refused.
- `/admin/prices`: the four prices; "Von OpenRouter holen" fills the form from OpenRouter's public model list
  (`anthropic/claude-haiku-5.5`, prices per token), the admin checks and saves. Saving takes effect in the kids'
  app within a minute.

**Proposed: kids' app:**

- **The gate asks only for a code.** The key choice, `TermsDialog`, the `sk-or-` handling and the key checker
  go. A line for adults says where codes come from (office.ai-scratch.dev).
- **One snapshot per instance, refreshed every 60 s** (Rainer's design): all codes that haven't expired, the
  price, the pool, and every sum (each code over all months; per account, per pool entry and overall this month),
  in a handful of queries. Checks then run in memory. A code that isn't in the snapshot is looked up directly, so
  a code created a moment ago works at once.
  - A pool entry is used while at most **97.5 %** of its cap is spent; the code's, the account's and the overall
    budget stop at 100 %. The overshoot is what all instances spend within the minute, plus calls in flight;
    Anthropic's spend limit and the refusal catch the rest. The margin assumes a few instances (today one, two
    during a deploy).
  - **A failed refresh stops the free budget's codes** until the next refresh succeeds (fail closed); own-key
    codes go on with the last snapshot. A Postgres outage then leaves at most a minute's spend uncounted.
  - Pausing an entry, deleting a code, banning an account, withdrawing the free budget or a new price take effect
    within a minute.
- **Per request:** the [checks](#budgets) against the snapshot. Chat, "Zusammenfassen" and "frage KI" need budget
  left; "frage KI" also its switch. The Locker needs no code. `GET /api/access` answers with the end time and the
  switch.
- **A German message per refusal:** not valid yet ("ab 10:00 Uhr"), expired, the code's budget used up, free
  budget withdrawn or the month used up, no pool entry left, the OpenRouter key empty. An unknown or deleted code
  is a wrong code (back to the gate).
- **Free budget, the pool client:** the active entry with the highest priority that is usable (under 97.5 %, not
  refused). No sticky sessions: entries are used up one after another, so all sessions share one entry until it
  is used up. **No retry within a call:** when Anthropic refuses an entry (401, 402, billing or permission 403,
  credit 400), the kids' app marks it refused, the kid gets "Versuch es gleich nochmal", and the next request
  takes the next entry. Federations: one `@anthropic-ai/sdk` credential provider per entry, kept for the
  process, its token as Bearer for the AI SDK. The credential code (key or federation, Entra token) moves out of
  the office into a shared package, so the office's check and the kids' app use one implementation.
- **Own key:** decrypted from the database, the model through OpenRouter as today, OpenRouter's refusals as today.
- **After each call** the usage row is written from the usage the call log already parses. A failed write never
  fails the kid's call.
- `/api/stats` only for test codes.
- **Thinking blocks across entries** ([open](#anthropic-key-pool)): when all sessions move to the next entry, their
  history holds thinking signed by the old one. Tested with two organisations; if Anthropic refuses it, the server
  drops thinking blocks of earlier entries.

**Proposed: the 80 % warning:**

- Budgets watched: the overall month (`BUDGET_TOTAL_USD_MONTH`) and each pool entry's cap. No other emails: a
  refused entry shows on the dashboard.
- The kids' app notices it when it refreshes its snapshot and sends through Resend, to every user with the role
  `admin`. **Once across all instances:** a row in `budget_warning` keyed by budget, month and the limit's value
  (a raised cap warns again at its new 80 %); only the instance whose insert wins sends. A failed send is logged.

**Proposed: Azure and rollout:**

- The kids' app's managed identity gets its own Postgres role with only what it needs: read codes, own keys, the
  pool, profiles, the price, `user`'s role, ban and email; read and write usage and budget warnings; write the
  pool's `refusedAt`/`refusedReason`. Granted by provision.sh after the office has migrated. Its Key Vault list
  already holds `RESEND_API_KEY` for the warnings.
- The kids' app gets `KEY_ENCRYPTION_KEY`, `PG*`, the federation identity and its `ANTHROPIC_FEDERATION_*`
  settings; `ANTHROPIC_API_KEY` and `ACCESS_CODES` leave its settings and Key Vault references.
- **Order:** Rainer's Anthropic key into the pool, office deploy (migrations), the kids' app's provision.sh (role,
  grants, settings), kids' app deploy. School codes and typed keys stop with that deploy.

**Proposed: tests:** codes, sums, checks and pool choice on PGlite; the kids' app's server tests on PGlite with
a fake Anthropic and OpenRouter; the office's e2e for keys and codes with a fake OpenRouter next to the fake
Anthropic; the kids' app's e2e keep `TEST_CODES`.

Docs and legal texts that change with it are updated in the same change: the kids' app's parents' terms go;
`limits-and-safety.md`; `/access` and the terms (dollars, the Locker without a code, no codes of one's own).

## Order (proposed)

1. **Iteration 1 of the office** (decided: Rainer, 2026-10-31; code done 2026-10-31): Postgres, an empty Next.js
   app per our rules (`create-next-app`, current packages), better-auth with email + password, Rainer
   (rainer@software-architects.at) with the `admin` role and no limits, one protected "hello world" page.
   No other logic. On top: deployment at office.ai-scratch.dev (own web app, CI deploys to production) and
   Rainer's account from a seed script. **Open:** running the Azure scripts and the seed against production.
   Then: content pages.
2. Database, registration and applications, admin, login (**done 2026-10-31**, iteration 2 of the office); the
   admin's key pool (**done 2026-10-31**); then codes, the kids' app on the pool, and budgets.
3. Own OpenRouter keys (teachers and parents).
4. Exercises with starter projects.

## Still open

- The real cost per kid and per class-hour, from the event logs in Blob, to check the $5 per code.
- The tech-stack discussion continues (Rainer, 2026-10-31).
- The open points above: video page and slides, thinking blocks across keys, Jev's data location, video
  hosting, legal texts.
