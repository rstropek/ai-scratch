# To check before the event

Open checks, not yet done. Tick them off (or delete them) when done.

- [x] **Prompt caching strategy** (checked 2026-10-23 against 176 logged calls, then fixed). Breakpoints (`chat.ts`):
  1. tools + system prompt (~10k tokens): shared by all kids, read across sessions;
  2. the end of the earlier turns: the next turn reads them;
  3. the end of the request (automatic): the next step of the turn reads it.

  Breakpoint 2 was missing, so every turn wrote the whole history again. That cost about 8% of the test spend and grows with the square of the conversation length. Now each turn writes only what is new: the last kid message and answer, the new message and the project snapshot. Verified against the real API.

  Expected misses:
  - the project snapshot is new each turn by design;
  - "Zusammenfassen" replaces the history;
  - a kid idle for over 5 minutes loses their history cache, but tools and system stay warm through the other kids. A 1-hour TTL doubles every write and isn't worth it.
- [ ] **Video: the "frage KI" block** (docs/ki-block.md). Projects with it open only in this app, not on scratch.mit.edu; worth one sentence if kids take projects home. Each question costs a heart, shared with the chat.
- [ ] **Azure: SSE streaming** is not buffered by App Service (answers must stream, not arrive at once).
- [ ] **Azure: app settings** contain the real `ACCESS_CODES` (one per school plus the `admin_` code, without `test`), `JEV_API_KEY` and the Anthropic keys.
- [x] **Azure: instances** (decided 2026-10-23). Hearts live in memory per instance (`src/server/hearts.ts`). ARR affinity is on, so scaling out keeps each kid on one instance; losing affinity only refills a kid's hearts.
- [x] **Azure: logs** end up in Blob storage (`stdigiferien/logs`, one blob per record) and survive restarts. Verified in production on 2026-10-23.
