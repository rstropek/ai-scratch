# The Locker: saving and loading games

Kids save their game to the **CoderDojo Locker** (https://locker.coderdojo.net), load it back, and open
their Locker's own page, from three entries in Scratch's own *Datei* menu. Read before touching `src/editor/locker-menu.ts`, `src/client/locker`
or `src/server/locker.ts`.

## What the Locker is

- An anonymous file store for CoderDojo kids, written and run by a friend of Rainer's: **don't change that
  repo** (`/home/rainer/github/CoderDojo-Cloud`). Anything it needs goes to him as a small, general proposal.
- Each kid has a printed sticker with an **8-character code** (`K7QM 4XRT`; no 0/O/1/I). The code is the only
  identity and the only credential: no account, no key. For Digiferien there's one set of 30 per school,
  100 MB per Locker, no review and no automatic deletion.
- The API contract is `src/CoderDojoCloud.Api/openapi.json` in that repo. Its CLI (`src/CoderDojoCloud.Cli`)
  shows the call order; check the licence with the author before copying code.

## Decisions

- **Placement:** Scratch's *Datei* menu, below its computer entries (Rainer's choice): "Aus dem Locker laden",
  "Im Locker speichern" and "Locker in neuem Tab öffnen". Kids look for saving there already.
- **"Locker in neuem Tab öffnen"** opens `https://locker.coderdojo.net/locker/<code>`, where kids see,
  download and share their files. With the code from this tab it opens at once; otherwise the dialog asks
  for it. It never goes through our server, so it needs no school code, and the code isn't checked first:
  a wrong one gets the Locker site's own message. The tab opens right in the click (the menu click, or
  "Locker öffnen"), because browsers block new tabs opened later; if one is blocked anyway, the dialog
  shows a real link.
- **The dialog copies Scratch's own prompt** ("Neue Variable"): purple header, blue overlay, Abbrechen / OK.
  Its wording reuses the Locker's own ("Locker-Sticker", "Mit diesem Code geht kein Locker auf"), so the
  sticker and the app say the same thing. The design mockup with every state:
  https://claude.ai/artifact/WpdRv4abuoxFi2oZf1bpEy.
- **One game = one Locker project with one `<name>.sb3`.** The list shows every `.sb3` in the Locker, newest
  first, so files uploaded on the Locker's site show up too. Saving under a name that exists (any case)
  **replaces** that game after a warning (Rainer's choice); the Locker's overwrite keeps the file's id and
  share link and updates `uploadedAt`, which the list shows as "heute, 11:05".
- **The name** starts from Scratch's title (the default "Scratch-Projekt" counts as none), and saving or
  loading writes it back, so the computer save uses it too.
- **The code is kept for this tab only** (`sessionStorage`, Rainer's choice): a reload keeps it, which is
  when a kid needs to load; closing the tab forgets it, for shared school PCs. "Anderer Code" switches.
- **Loading replaces the project and clears the chat's undo copies** ("Rückgängig" would bring back the
  project before the load). The chat goes on: every turn sends the current project anyway. Loading waits
  while the KI-Helfer is working.
- The Locker needs the **school access code** like every `/api` route; before it, the dialog points to the chat.
- The assistant's prompt names both ways to save (section "SPEICHERN UND LADEN") and points at the menu;
  only the kid saves and loads.

## How it works

- **Menu:** [locker-menu.ts](../src/editor/locker-menu.ts) runs in the iframe. Scratch renders the menu
  only while it's open, so a `MutationObserver` clones Scratch's "Auf deinem Computer speichern" item each
  time. The clones keep `data-menu-item`, so Scratch's menu hook moves through them with the arrow keys and
  clicks them on Enter. A click sends an Escape keydown (Scratch 15's file menu isn't in redux; Escape is how
  its hook closes it) and calls `window.ki.openLocker`, which the host sets.
- **Server:** [locker.ts](../src/server/locker.ts) passes the calls on, because the Locker's CORS allows
  only its own site. The kid's code travels as the `X-Locker-Code` header, never in a URL, so it stays out
  of request logs; the research log never sees it. Save runs the Locker's three steps on the server: a
  ticket, the PUT to the storage URL it hands out (Azure Blob in production), then create or replace; on
  failure it gives the ticket back. `Accept-Language: de` returns the Locker's own German messages.
  `/api/stats` counts saves, loads and failed calls (wrong codes included).
- **Config:** `LOCKER_URL` (default `https://locker.coderdojo.net`).

## Traps

- **An `ArrayBuffer` from the host fails `instanceof ArrayBuffer` in the iframe**, and scratch-vm then
  reads it as project JSON and the load fails. The host passes a `Uint8Array`: `ArrayBuffer.isView` works
  across windows. Only the e2e test in the real editor showed this.
- **All kids reach the Locker from the App Service's one outbound IP.** The Locker rate-limits some
  anonymous routes per IP (60/min: device links, approvals, shares); the project upload and download routes
  we use have no limiter. Keep it that way: no polling, no extra calls.
- **The Locker's dev server hands out relative upload URLs;** production gives absolute SAS URLs. The server
  resolves both against `LOCKER_URL`.
- **Reading a Locker counts as using it** (it moves the Locker's activity clock). Harmless, but test with
  the reserved test codes (Rainer has the list), never with a school card.

## Tests

- [locker.test.ts](../src/server/locker.test.ts) fakes the Locker's API in memory (tickets, blob PUT,
  replace, errors); [LockerDialog.test.tsx](../src/client/locker/LockerDialog.test.tsx) covers every state;
  [e2e/locker.spec.ts](../e2e/locker.spec.ts) runs the menu, a save and a load in the real editor.
- **Live check:** save, replace, load and a wrong code ran against production on 2026-10-25 with a test
  code, through the real routes (`createApp` with `.env`). Repeat that after a Locker upgrade.
