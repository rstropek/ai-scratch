# Limits and kids' safety

What keeps kids safe and costs bounded, and why each layer is as lean as it is. Read before touching access
codes, hearts, the guard or the output limits.

## The layers, outermost first

1. **Adults in the room.** The kids are always supervised. Every other layer is deliberately lean because of
   this (Rainer's stance); don't add hardening the event doesn't need.
2. **Access code** per school: without one the chat is locked, Scratch still works.
3. **Hearts:** 3 messages, one refills every 20 s. A question from the "frage KI" block costs one too
   ([ki-block.md](ki-block.md)).
4. **Gedächtnis:** the 80k context limit ([conversation.md](conversation.md)).
5. **Kids-protection guard (Jev):** screens every new kid message, and every text of the "frage KI" block,
   before Claude sees it.
6. **Output limits:** visible text per answer and model calls per turn.
7. **Budget:** 200 €/month on the Anthropic key. The emergency stop is disabling the key.

## Client shows, server enforces

- The rules live once in [energy.ts](../src/shared/energy.ts) and are used on both sides. The client applies
  them so a kid almost never meets a refusal; the server enforces the same rules because the client could be
  bypassed.
- Only a **new kid message** costs a heart and is screened. The follow-up requests that carry tool results
  within a turn are neither: they are bounded by the step limit instead.
- If the server refuses for lack of hearts anyway (429 with `retryInMs`), the client resets its countdown to
  the server's clock.
- Hearts live in server memory, per instance, keyed by the session id (a page load). A restart or a reload
  just refills them; ARR affinity keeps a kid on one instance, and losing affinity only refills hearts. That
  is good enough, by Rainer's choice; no shared store.
- A request without `X-Session-Id` falls back to the access code as the key, so it shares one bucket with the
  whole school. The client always sends the header; keep it that way.
- `admin_` codes skip hearts (for testing), nothing else: the guard still screens them.

## Output limits

[output-guard.ts](../src/server/output-guard.ts). `max_tokens` (16k) only bounds the cost of one runaway
call. It can't be lower: thinking and tool inputs (scripts, SVG drawings) need room. Haiku does hit it now
and then (15k thinking tokens on Minesweeper neighbour counting). A tool call cut by `max_tokens` would
leave its input streaming forever and the chat stuck on „läuft“; `closeCutToolCalls` closes it as a tool
error, which the model reads with the next request (`/api/stats` counts these as `toolCuts`). Earlier tool
calls of that answer have run, so a `clear_scripts` before a cut `add_scripts` has already wiped the
scripts; the error tells the model to retry smaller. A call that only thought until `max_tokens` (Haiku on
Minesweeper logic: five turns of one game, ~70 s each) is asked once more at effort `low`
(`retryThinkingCut`); its answer continues the same message. Its thinking-only step must be left out of the
later steps' input (model-input.ts): the API rejects the retry's signed thinking behind it as "modified"
(a 400 that ended a game turn in the night test). Only if the retry thinks too long as well, the kid gets a fixed
German note instead of an empty answer (`noteThinkingCut`). `thinkingCuts` counts every cut call.

What a kid could provoke is bounded by two other limits:

- **Visible text** per model call (not per turn) is capped (3000 chars; the longest real answer was ~1,100).
  A turn of many calls can show more; the step limit bounds that. The stream is ended
  cleanly with a German note and the model call is aborted, so the kid never sees a broken answer.
- **Model calls per turn** are capped (25; real turns take 2–10). The turn then ends with a fixed answer.

## Kids-protection guard

[guard.ts](../src/server/guard.ts); what was tested and the current thresholds: the generated
[kids-protection.md](kids-protection.md). Never edit that file by hand; run `npm run eval:guard` after
changing questions or thresholds (it calls the real Jev, so it is not part of `npm test`).

- **One Jev call per new kid message**, with the previous assistant answer as context, so a short reply
  like "1000" is read correctly. Replies are not screened.
- **Categories in a fixed order;** the first that fires wins, so a kid in distress is always sent to an
  adult, even if the message also contains an insult. Distress fires at a lower threshold: sending a kid to an
  adult once too often costs little.
- A flagged message gets a fixed German answer, streamed like a model answer, and **never reaches Claude**,
  then or later.
- **Fail open:** if Jev errors or takes over 3 s, the message goes through. The event must not stop because of
  a third party, Claude refuses harmful requests on its own, and adults are present. Outages are logged and
  counted in `/api/stats`.
- Messages over 2000 characters are refused in code, without asking Jev. The "frage KI" block keeps the
  last 3000 characters of its text instead, and is screened with its own description of a chatbot (role
  play passes): [ki-block.md](ki-block.md).
- The Jev model version is pinned (`JEV_MODEL`): the thresholds are tuned against it.
- **Logs:** a message flagged as personal data is stored as a placeholder, never verbatim.

## Access codes

- One code per school, case-insensitive, from `ACCESS_CODES`. They group the research log by school and keep
  strangers out; they are not security (no login hardening, by decision).
- A kid types the code into the chat panel or gets it via `?code=` in the link. The link's code is removed from
  the address bar right away, so kids don't pass it on, and the browser remembers it (localStorage).
- A 401 on any `/api` call sends the chat back to the gate.
- New codes: edit `.env`, re-run `scripts/azure/provision.sh`, restart both slots
  ([deployment.md](deployment.md)).
