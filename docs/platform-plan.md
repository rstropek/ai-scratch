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
                          /antrag (teacher application), /lehrer (teacher area), /admin (Rainer)
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
  plan `ts-web-playground`, with a staging slot, a deploy job and the swap workflow per app (Next.js
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
  - Public endpoint with TLS; firewall for Azure services and the admin's IP. Login with the slots' managed
    identities (Entra authentication; `pg` takes a token callback as password), so no database password. No
    VNet: it would need VNet integration for the App Service plan.
  - One database per slot (`aiscratch`, `aiscratch_staging`), each owned by its slot's role.
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
  - Accepting an application creates the account, and the teacher sets their password through a link in the
    acceptance email.
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

## Teacher applications

- **Decided:** teachers you don't know apply through a form. They describe:
  - what they plan to do with it;
  - their teaching (school, students' ages, classes);
  - acceptance of the terms of use.

  You get an email and accept or reject the application.
- **Proposed:**
  - Store which version of each legal text was accepted and when.
  - Confirm the email address before you're notified.
  - A honeypot field + rate limit instead of Cloudflare Turnstile (keeps data in the EU; you review every
    application anyway).
  - Emails to the teacher on acceptance and rejection.
  - Resend from `mail.ai-scratch.dev`.

## Kids' ways into the chat

1. **A teacher's code backed by the donated keys** (the normal case).
2. **A teacher's code backed by the teacher's own OpenRouter key.**
3. **A parent's own OpenRouter key** (stays as it is today): for non-teachers who let their kids try it
   occasionally or once.

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
- **Decided:** codes backed by a teacher's own OpenRouter key have only the per-code limits.
- **Proposed:** checks before every model call:

  | Check | Donated keys | Teacher's OpenRouter key | Parent's key |
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

## Teachers' own OpenRouter keys

- **Decided:** teachers can enter budget-limited OpenRouter keys and create codes from them.
- **Proposed:**
  - Checked like parents' keys today (`GET /key`; keys without a limit are refused).
  - Stored encrypted (AES-GCM, master key in Key Vault, readable by both apps). Unlike parents' keys, they
    are stored, so the terms must say so.
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

- **Proposed wording:**

  > Personenbezogene Daten (die Angaben der Lehrkräfte) speichern und verarbeiten wir auf Servern in der EU.
  > Was Kinder in den Chat oder in den „frage KI“-Block schreiben, wird zur KI-Verarbeitung und
  > Sicherheitsprüfung auch außerhalb der EU verarbeitet (Anthropic, OpenRouter, TypeSafe). Darum dürfen
  > Kinder keine persönlichen Daten eingeben.

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
   No other logic. On top: deployment at office.ai-scratch.dev (own web app with staging slot, CI job) and
   Rainer's account from a seed script. **Open:** running the Azure scripts and the seed against production.
   Then: content pages.
2. Database, applications, admin, teacher login, codes with the key pool and budgets.
3. Teachers' own OpenRouter keys.
4. Exercises with starter projects.

## Still open

- The real cost per kid and per class-hour, from the event logs in Blob, to check the 5 € per code.
- The tech-stack discussion continues (Rainer, 2026-10-31).
- The open points above: video page and slides, `admin_` codes, "frage KI" default, thinking blocks across
  keys, Jev's data location, video hosting, legal texts.
