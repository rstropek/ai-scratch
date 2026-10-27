# Deployment

The reasons behind the Azure setup and the traps we hit. What exists and the everyday commands are in the
[README](../README.md#deployment-azure); the scripts in [scripts/azure](../scripts/azure) are the source of
truth for settings and roles.

## Shape and why

- **One container web app with a staging slot**, on Rainer's existing P0v3 plan, image from his existing ACR
  (his choice: no extra cost; the plan and the registry live in other resource groups). The app, Key Vault and
  storage are in their own group `2026-digitalferien`.
- **A one-day event, not a product:** the setup favors working reliably on that day over elaborate operations.
  No database, no Redis, no monitoring stack. Live counters come from `/api/stats`; the research log of the
  event day stays in Blob storage, nothing new is written ([research-log.md](research-log.md)).
- **Several instances are possible:** ARR affinity is on, so a kid stays on one instance; hearts and stats are
  per instance, which is acceptable ([limits-and-safety.md](limits-and-safety.md)).
- **Secrets** live in a dedicated Key Vault, read by app settings that reference it, with the app's managed
  identity. **Never use the vault `kvtswebplayground`** on the same subscription: an external student account
  can read its secrets.
- **No keys anywhere:** the storage account has shared-key access disabled, both slots pull from ACR with their
  managed identity, and GitHub logs in with OIDC.

## Release flow

- Every push to `main`: check + unit tests, build the image (tagged with the commit), run it in **staging**,
  wait until staging's `/healthz` reports that commit ([deploy.yml](../.github/workflows/deploy.yml)). e2e
  tests don't run in CI; run them locally before pushing UI changes.
- **Production changes only by the manual swap** ([swap.yml](../.github/workflows/swap.yml)), which checks
  afterwards that production reports the staging commit. Running it again swaps back (rollback).
- **No deploy to production and no swap during the event:** a swap restarts production and cuts the turns in
  progress. The chats themselves survive (they live in the browser), but kids would see errors mid-answer.
  Pushing to `main` is harmless then; it only touches staging.

## Traps we hit

- **A swap restarts the staging slot with production's settings** before switching. Any setting the new code
  needs must therefore exist on production too. Concretely, both slots need `acrUseManagedIdentityCreds`, or
  the swap fails with "the 'staging' slot did not respond to http ping" (the container log shows
  `ImagePullUnauthorizedFailure`).
- **Key Vault references resolve only when the app starts.** After `provision.sh` uploads new secrets
  (keys, access codes), restart both slots. An unresolved reference arrives as the literal
  `@Microsoft.KeyVault(…)` string; [config.ts](../src/server/config.ts) refuses to start with a clear message
  instead of using it as a key.
- **GitHub's OIDC subject** for this repo uses the immutable format with owner and repo ids
  (`repo:rstropek@<id>/ai-scratch@<id>:ref:refs/heads/main`). [github-identity.sh](../scripts/azure/github-identity.sh)
  asks GitHub for the prefix instead of guessing. Adding a GitHub `environment:` to a job changes the subject
  and breaks the login; adjust the federated credential first.
- **Role assignments take minutes to propagate.** Data-plane commands right after an assignment fail or, worse,
  report success and do nothing; `provision.sh` retries them.

## Image

- Node runs the server's TypeScript directly, so the image has no server build step.
- **Browser-only packages are devDependencies** (Scratch, React, UI libraries): Vite bundles them into `dist/`,
  and the runtime image installs only what the server imports. A new server import must be a dependency, or
  the container fails at start while everything works locally.
- `APP_VERSION` (the commit) is baked in at build time and shown by `/healthz`, which needs no access code.
- **The slide deck** (`slides/`, its own packages) is built into `dist/slides` with base `/slides/` before the
  app's build, which precompresses it with the rest. The server serves it at `/slides/` without an access code;
  a path without a file extension gets the deck's page, because Slidev routes in the browser (`/slides/11`,
  `/slides/presenter/`). Pictures named from the root in `slides.md` go through `publicUrl()`
  (`slides/utils/public-url.ts`): Vite only rewrites static URLs, not props.
- **Headers set in `serveStatic`'s `onFound` only arrive under `@hono/node-server`** (its own `Response` keeps the
  headers by reference); `app.request()` in tests drops them. The `/slides` route sets `Cache-Control` on the
  finished response instead, so its test sees it.

## Streaming through App Service

The chat streams SSE. The server sends a keep-alive comment every 15 s while the model thinks, so no proxy
closes a quiet connection. Whether App Service buffers SSE is still on [to-check.md](to-check.md).
