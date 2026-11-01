# Anthropic key pool

The donated Anthropic access behind the free budget: keys, and federations (no key, the donor's organisation
trusts our Azure identity: [anthropic-federation.md](anthropic-federation.md)). The admin maintains them in the
office (`/admin/keys`, `apps/office/lib/anthropic-keys.ts`); the kids' app will draw on them (not built yet:
[platform-plan.md](platform-plan.md#anthropic-key-pool)). Table `anthropic_key` in `packages/db/src/schema/keys.ts`,
one row per entry, `kind` `key` or `federation`; a check constraint keeps each kind's columns filled and the
other's empty.

## Keys at rest

- **Sealed with AES-256-GCM** (`packages/db/src/key-box.ts`), the row's id as associated data: a sealed key
  copied onto another row doesn't open. Format `v1:<base64url(iv | ciphertext | tag)>`.
- **The master key is `KEY_ENCRYPTION_KEY`** (32 bytes, base64), Key Vault secret `key-encryption-key`, created
  once by the office's provision.sh. Not derived from `BETTER_AUTH_SECRET`: the kids' app needs it, and it must
  never hold the office's auth secret. **Never replace the secret:** every stored key becomes unreadable (no
  re-sealing exists yet). The kids' app gets the same app setting when it starts using the pool.
- **A keyed fingerprint** (HMAC under the master key) has a unique index: the same key can't be added twice.
  A save that loses the race to the same key gets the index's error, mapped to the same "already in the pool".
  The admin sees only `keyHint` (the last four characters); the sealed key and the fingerprint never leave
  `anthropic-keys.ts`.
- The OpenRouter keys of teachers and parents should use the same key box later.

## Workspace ID

- Only keys that aren't bound to a workspace need one: **personal keys (`sk-ant-usr…`) and service account
  keys**. They send `anthropic-workspace-id` on every call. Workspace keys (`sk-ant-api03…`) leave it empty.
- The Admin API refuses the header ("not supported on Admin API endpoints").

## Federations

- **The row holds only IDs:** organisation (UUID), rule (`fdrl_…`), service account (`svac_…`, optional),
  workspace (optional: Anthropic then picks the rule's only one). None is secret, nothing is sealed. Donor, cap,
  priority and pausing work as for keys.
- **The same rule for the same workspace can't be added twice** (a partial unique index on the rule and
  `coalesce(workspace_id, '')`; a lost race maps to the same message, like keys).
- **Two buttons on the list** (Rainer, 2026-11-01): "Föderation hinzufügen" opens `/admin/keys/new/federation`;
  the edit page shows the form of the row's kind. Changing an ID checks again; the kind never changes.
- **The check exchanges first:** the office's identity token (`lib/entra-token.ts`) goes to `/v1/oauth/token`,
  then the same one-token call runs with the Anthropic token. A refused exchange (`WorkloadIdentityError` with a
  4xx, or a 401 on the call) → `exchange` with Anthropic's message; no identity token, or no
  `ANTHROPIC_FEDERATION_AUDIENCE` on this server → `identity`; a 5xx or a 429 at the token endpoint → "not
  reachable" (a busy endpoint says nothing about the rule, unlike a 429 on the call, which proves a key).

## The check

- **A new key, or a new workspace for a stored one, is checked before it is saved** (federations: above): one Messages call with
  `claude-haiku-5-5`, `max_tokens: 1`, thinking off (a fraction of a cent). It proves the key, the workspace and
  that credit is left. 401 → unknown key; 400/403/404 → Anthropic's message is shown (missing workspace, no
  credit) as does any other 4xx (402 billing); 429 counts as working, without the SDK's retry (it would sleep for
  retry-after); anything else → "not reachable", nothing saved.
- **The office uses `@anthropic-ai/sdk` 1.x,** which sends the key as `Authorization: Bearer`, not `x-api-key`.
- **There is no remaining budget to read.** Anthropic has no endpoint for a key's or workspace's balance; spend
  limits live per workspace in the Console only. Spent amounts come from the Admin API's cost and usage reports
  (an Admin API key, not a pool key). Hence `capEurMonth` is our own cap, counted by the kids' app later, and
  donors should also set a spend limit in the Console.
- **e2e tests answer the check with `e2e/fake-anthropic.ts`** (the office's `ANTHROPIC_BASE_URL`, which the SDK
  reads): the key's prefix decides the answer (`sk-ant-bad-` → 401, `sk-ant-usr-` without workspace → 400), never
  a substring: the tests' keys end in random text. For federations it also plays App Service's identity endpoint
  (`IDENTITY_ENDPOINT`/`IDENTITY_HEADER`, so the real `ManagedIdentityCredential` runs) and the token exchange
  (`fdrl_bad…` → 401). Its port is never
  reused from another process: a stray office answers `/healthz` too.
