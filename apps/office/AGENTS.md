# The teachers' office (apps/office)

Next.js (App Router) at office.ai-scratch.dev: teacher applications, the teacher area (access codes, own OpenRouter keys) and Rainer's admin. **A placeholder so far, not deployed.** What it will do, and what is decided, proposed or open: `docs/platform-plan.md`.

## Commands

Run them here (or from the root with `-w apps/office`).

| Command | What it does |
|---|---|
| `npm run dev` | dev server on http://localhost:3100 |
| `npm run typecheck` | `next typegen` (route types), then `tsc --noEmit` |
| `npm run build` | production build (`output: 'standalone'`, traced from the workspace root) |

## Decisions

- **The kids' app never calls the office at runtime.** Both share data through the database, so a broken or redeploying office never interrupts a lesson.
- **The office's session cookie stays host-only** (no `Domain`): it must never reach ai-scratch.dev, where Scratch and kids' projects run. Both hosts are the same site, so keep better-auth's origin checks.
- `next-env.d.ts` and `.next/` are generated and git-ignored.
