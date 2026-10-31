# Research log and stats

During the event every Anthropic call and every guard screening was stored for research. **Since
2026-10-27 the server stores no conversations:** without `LOG_DIR` nothing is written, and production doesn't
set it. The stored logs stay in Azure; never delete them as part of a code change. Error output may still
contain messages or parts of them (e.g. an AI SDK error with its request body in the console): that is fine,
by Rainer's decision; only the normal path must not store content. Read before touching
[wire-log.ts](../apps/app/src/server/wire-log.ts), [stats.ts](../apps/app/src/server/stats.ts) or [cost.ts](../apps/app/src/server/cost.ts).

## The call log (local, opt-in)

- With `LOG_DIR` the server writes `calls.jsonl`, `guard.jsonl` and `prefix-<hash>.json` there. The game
  harness and the e2e tests set it; for `npm run dev`, set it in `.env` if you want the files.
- **At the wire:** each Anthropic call (chat steps and summaries) with the **exact request body** and the
  response **rebuilt from the SSE stream**: thinking with its signature, text, tool calls, usage, cost. The
  logging `fetch` tees the response; the SDK gets one branch untouched. The tee runs without `LOG_DIR` too,
  because `/api/stats` takes its usage from it; the records then go to a sink that drops them.
- **Every guard screening**, with Jev's probabilities. A message Jev flags as personal data is stored as a
  placeholder; everything else, including messages that pass while Jev is down, is stored verbatim.
- A call cut off by the output limit or a closed connection is logged with what arrived, marked `aborted`.
- Each record carries the access code (school), the session (page load) and the turn number (it keeps
  counting across "Zusammenfassen": the summary message carries the number of turns it replaced); summary calls
  carry `purpose: 'compact'`, questions of the "frage KI" block `purpose: 'ask'` with turn 0
  ([ki-block.md](ki-block.md)).
- **Prefix dedup:** system prompt + tools (~50 KB) are the same in every call, so they are stored once under a
  hash, and each call record references the hash.
- Logging never delays or fails a chat: it runs after the response is handed on, and errors only reach the
  console.

## The stored event logs (Azure)

- Storage account `stdigiferien`, container `logs`, written until 2026-10-27 by the code that is now removed.
  One blob per record, named `calls|guard/<code>/<session>/<turn>-<time>-<random>.json` (same record format
  as above), prefixes under `prefixes/` with the same hashes as the local files. Download command:
  [README](../README.md#deployment-azure).
- Auth is your `az login` (Storage Blob Data Reader); the storage account has shared keys disabled. A
  leftover `LOG_BLOB_URL` app setting is ignored by the server.
- **No retention rule**, by Rainer's decision: Rainer deletes the logs by hand once they are no longer needed. To
  delete: grant Storage Blob Data Contributor on the container temporarily, delete **blob by blob, retrying**
  until Azure confirms (`delete-batch` reports success but deletes nothing until the role has propagated),
  then remove the role.

## Reading the logs

- A session is the folder `calls/<code>/<session>/` (Azure) or its lines in `calls.jsonl` (local). Each
  call's request is the full model input apart from the prefix, so the last call of a turn shows everything
  the model knew.
- To see what the tools did, replay a session's tool calls in the browser ([testing.md](testing.md)).

## Live stats

- `GET /api/stats` (any school's code, not a parent's OpenRouter key): Anthropic calls with school codes only
  (parents' OpenRouter calls are not counted), errors, tokens incl. cache reads and writes, cost, guard
  categories and outages, output caps, refusals for hearts and memory, summaries, answers of the "frage KI" block (`asks`).
- In memory, **per instance**, since its last start: a restart or a deploy resets them, and with several
  instances each shows its own share. Nothing else records production use anymore.
- [cost.ts](../apps/app/src/server/cost.ts) has the Claude Haiku 5.5 prices hard-coded. Update them when `MODEL` changes,
  or every cost in the log and the stats is wrong.
