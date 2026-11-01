# Budgets

What a code may spend and how the kids' app checks it. The decisions: [platform-plan.md](platform-plan.md#budgets)
(the check table) and its iteration 3. Code: `packages/db/src/budget.ts` (sums, checks, shared by both apps),
`apps/app/src/server/budget.ts` (the snapshot), `access.ts` (the checks per request), `model.ts` (who pays, the
usage after each call), `warnings.ts` (80 %).

## Principles

- **Straightforward over exact** (Rainer). A small overcount or one "Versuch es gleich nochmal" is fine; code for
  rare races isn't.
- **Tokens are stored, never dollars.** Every sum is `usage` tokens × the one current `model_price` row. A price
  change re-values the month (accepted). The migration seeds the row; the admin form refuses 0.
- **`usage` has no foreign keys** and carries owner, source and both key ids itself: deleting a code, an own key,
  a pool entry or an account never lowers a sum. Its unique constraint is `NULLS NOT DISTINCT`: an own-key row has
  no pool entry, and without it the upsert would never find its row.
- **Months are Vienna calendar months** (`viennaMonth`, text `2026-11`). A code's own budget counts over all
  months; the account, the pool entries and the overall budget per month; the code count by creation month,
  over codes that still exist.

## The snapshot

- **One per instance, refreshed every 60 s:** unexpired codes (with owner role, ban, free-budget flag, the own
  key sealed), the price, the pool, and the sums. Checks run in memory. A code the snapshot lacks is looked up
  directly and kept, so a code created a moment ago works at once.
- **Fail closed for the free budget:** after a failed refresh, free codes get "nicht erreichbar" until one
  works; own-key codes go on with the last snapshot. No snapshot at all → every code gets 503.
- **Each call's cost is added to this instance's snapshot at once**, so one instance stops at a limit without
  waiting for the refresh. Other instances see it within a minute: the overshoot is what all instances spend in
  that minute, plus calls in flight. The pool's 97.5 % covers that for a few instances.
- Changes in the office (deleting a code, pausing an entry, a ban, a new price) reach the kids' app within a
  minute. Banned owners' codes count as unknown.

## Who pays

- **Free budget:** the highest-priority pool entry that is active, not refused and under 97.5 % of `capMonth`.
  No sticky sessions, no retry within a call. Anthropic refusing the entry (401, 402, 403, a 400 about the
  credit balance, or a federation's token exchange with a 4xx) sets `refusedAt` (this instance skips it at
  once, the others from their next refresh), the kid gets "Versuch es gleich nochmal", the next request takes
  the next entry. The office clears `refusedAt` when the admin saves the entry.
- **Federations:** one `@ai-scratch/anthropic` token source per entry (and rule IDs), kept for the process;
  the token goes to the AI SDK as Bearer with `anthropic-beta: oauth-2025-04-20`.
- **Own OpenRouter key:** opened with the key box (row id as associated data) per call. OpenRouter enforces the
  key's limit; its refusal (402, or 403 with `limit_source`) is remembered for a minute per key, so a spent key
  costs no heart or screening per try.
- **Test codes** (`TEST_CODES`, dev and tests only, never on Azure) need no database and are paid with
  `ANTHROPIC_API_KEY`; `admin_` test codes skip hearts. The e2e tests and the game harness use them and blank
  `DATABASE_URL`, so a developer's `.env` can't switch them to the database.

## Usage

- Written after each call that answered 2xx, from the usage the call log already parses (`wire-log.ts`). **A cut
  call** (the kid's "Stopp", a closed tab, the output guard) has no final usage event: its output counts as its
  `max_tokens` (under a cent at Haiku's price).
- A failed write is logged with the tokens and never fails the kid's call.
- `/api/stats` counts the pool's and the test codes' calls, not own keys', and requests with unknown codes
  (`wrongCodes`: guessing shows there). Only test codes may read it.

## The 80 % warning

- Watches the overall free month and each pool entry's cap, at each refresh. A row in `budget_warning` keyed
  by budget, month and limit value; only the instance whose insert wins sends (Resend, every user with the role
  `admin`). A raised limit warns again. Without `RESEND_API_KEY` the mail goes to the log.

## The kids' app's database role

- Its own Postgres role (`ai-scratch`, the web app's managed identity), created and granted by
  `apps/app/scripts/azure/provision.sh` as the tables' owner: read codes, the pool, the price, `key_sealed` of
  own keys, the free-budget flag and `user`'s email, role and ban; write usage, budget warnings and the pool's
  `refused_at`/`refused_reason`. **A migration that adds a table or column the kids' app reads needs that script
  re-run** after the office has migrated.
