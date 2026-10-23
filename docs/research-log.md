# Research log and stats

Every Anthropic call and every guard screening is stored for research. Read before touching
[wire-log.ts](../src/server/wire-log.ts), [blob-log.ts](../src/server/blob-log.ts),
[stats.ts](../src/server/stats.ts) or [cost.ts](../src/server/cost.ts).

## What is logged, and why at the wire

- **Every Anthropic call** (chat steps and summaries) with the **exact request body** and the response
  **rebuilt from the SSE stream**: thinking with its signature, text, tool calls, usage, cost. The logging
  `fetch` tees the response; the SDK gets one branch untouched. Logging at the wire keeps the log independent
  of any framework's message model: it shows exactly what Claude got and said.
- **Every guard screening**, with Jev's probabilities. A message Jev flags as personal data is stored as a
  placeholder; everything else, including messages that pass while Jev is down, is stored verbatim.
- A call cut off by the output limit or a closed connection is logged with what arrived, marked `aborted`.
- Each record carries the access code (school), the session (page load) and the turn number; summary calls
  carry `purpose: 'compact'`.
- **Prefix dedup:** system prompt + tools (~50 KB) are the same in every call, so they are stored once under a
  hash, and each call record references the hash. Both sinks use the same hash, so local and Azure logs mix.
- Logging never delays or fails a chat: it runs after the response is handed on, and errors only reach the
  console.

## Where it goes

- **Locally** (no `LOG_BLOB_URL`): `logs/calls.jsonl`, `logs/guard.jsonl`, `logs/prefix-<hash>.json`.
- **Azure:** one blob per record in `stdigiferien/logs`, named
  `calls|guard/<code>/<session>/<turn>-<time>-<random>.json`, prefixes under `prefixes/`. One blob per
  record because several instances may write at once (append blobs or a shared file would need coordination),
  and the names already split the data by school, kid and turn. Path segments from headers are sanitized.
- Uploads run in the background. A failed upload falls back to the local files **inside the container**,
  which are lost when the container is replaced; the console line says so. `SIGTERM` (restart, swap) waits up
  to 10 s for running uploads ([main.ts](../src/server/main.ts)).
- Auth is the app's managed identity (locally: your `az login`); the storage account has shared keys
  disabled. Download command: [README](../README.md#deployment-azure).

## Retention and deletion

- **No retention rule**, by Rainer's decision: he deletes the logs by hand when he no longer needs them.
- Rainer's account can only read blobs. To delete: grant Storage Blob Data Contributor on the container
  temporarily, delete **blob by blob, retrying** until Azure confirms (`delete-batch` reports success but
  deletes nothing until the role has propagated), then remove the role.

## Reading the logs

- A session is the folder `calls/<code>/<session>/`. Each call's request is the full model input apart from the
  prefix, so the last call of a turn shows everything the model knew.
- To see what the tools did, replay a session's tool calls in the browser ([testing.md](testing.md)).

## Live stats

- `GET /api/stats` (any valid access code): calls, errors, tokens incl. cache reads and writes, cost, guard
  categories and outages, output caps, refusals for hearts and memory, summaries.
- In memory, **per instance**, since its last start: a restart or a swap resets them, and with several
  instances each shows its own share. The research log is the record; stats are for watching the event.
- [cost.ts](../src/server/cost.ts) has the Claude Haiku 5.5 prices hard-coded. Update them when `MODEL` changes,
  or every cost in the log and the stats is wrong.
