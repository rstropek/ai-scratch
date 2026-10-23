# To check before the event

Open checks, not yet done. Tick them off (or delete them) when done.

- [ ] **Prompt caching strategy.** Review the code (`src/server/model-input.ts`, `src/server/chat.ts`) and real conversations (`logs/calls.jsonl`, `cache_read_input_tokens` vs. `cache_creation_input_tokens`): is the system prompt, block catalog, tools and project snapshot built so that Anthropic's prompt cache actually hits across the steps of a turn and across turns? Where do cache breakpoints sit, and what invalidates the prefix (project snapshot, summary after "Zusammenfassen", tool-result trimming)?
- [ ] **Azure: SSE streaming** is not buffered by App Service (answers must stream, not arrive at once).
- [ ] **Azure: app settings** contain the real `ACCESS_CODES` (one per school plus the `admin_` code, without `test`), `JEV_API_KEY` and the Anthropic keys.
- [ ] **Azure: one instance.** Hearts live in memory (`src/server/hearts.ts`); scaling out would give each instance its own buckets.
- [ ] **Azure: logs** (`logs/calls.jsonl`, guard log) end up in Blob storage and survive restarts.
