# Conversation: model input, caching, memory

What the model sees each turn, why, and how that stays cheap. Read before touching
[model-input.ts](../src/server/model-input.ts), the cache settings in [chat.ts](../src/server/chat.ts),
`/api/compact` or the Gedächtnis gauge.

## The model input is rebuilt every turn

The browser keeps the full conversation, but the server never replays it raw. The rules and their reasons
are in the header of [model-input.ts](../src/server/model-input.ts): earlier turns as text plus a tool note (in the kid's next message, never in the model's own: there it
copied the note as text instead of calling the tool),
the current turn verbatim, the project snapshot frozen into the kid's message, guarded turns left out (also
from summaries). What the header doesn't say:

- **Signed thinking is fragile.** Dropping thinking blocks is accepted by the API, but a *modified* signature
  gets a 400, which breaks every multi-step turn. Anything that rewrites the current turn (sanitizing,
  trimming, a framework's message model) must pass thinking blocks and tool results through untouched.
- **The snapshot is taken by the client** when the kid sends, not by the server and not per step. That is what
  makes all steps of a turn share a prefix, and why the server never needs to reach the VM.

## Prompt caching

Three cache breakpoints (Anthropic allows four):

1. **Tools + system prompt** (~10k tokens): identical for every kid, so it stays warm across all sessions.
   Keep it static: nothing per kid, per turn or time-dependent may go into the instructions or tool texts.
2. **The end of the earlier turns:** byte-identical from one turn to the next, so the next turn reads them.
3. **The end of the request** (automatic, top level): the next step of the same turn reads it.

Before breakpoint 2 existed, every turn wrote the whole history again (~8% of the test spend, growing with
the square of the conversation). Now a turn writes only what is new. Checked against 176 logged calls and the
real API ([to-check.md](to-check.md)).

Expected misses, by design: the project snapshot is new each turn; "Zusammenfassen" replaces the history; a
kid idle for over 5 minutes loses their history cache (tools and system stay warm through the other kids).
A 1-hour TTL would double every cache write and isn't worth it.

To check caching, read the `usage` of consecutive calls of one session in the research log
([research-log.md](research-log.md)): `cache_read_input_tokens` should cover everything but the new part.

## Gedächtnis (context limit)

- The gauge shows the **input tokens of a turn's first model call**: the context the model reads before it
  does anything. It comes back as message metadata (`context`), so the client and the server read the same
  number from the conversation ([energy.ts](../src/shared/energy.ts)).
- At **80k** a new message is refused (409) until the kid frees memory by hand. Measured: ~10k at the start,
  0.1–0.5k per turn, so few kids reach it; Rainer kept 80k because games can get long. Rainer explains the
  two buttons in the video.
- **The project alone never locks a kid out:** the limit applies only when there is conversation to free.
- **"Neu anfangen"** clears the chat in the browser; the project stays. **"Zusammenfassen"** calls
  [compact.ts](../src/server/compact.ts), and the client replaces the whole conversation with the summary.
- Until the next turn measures again, the gauge shows an estimate (session start + summary length).

## Summaries

- The kid reads the summary too, so it is short German addressed to the kid ("du"), under fixed headings
  (**Dein Spiel**, **Schon gebaut**, **Als Nächstes**), and leaves out scripts (the model sees the project
  anyway) and personal data.
- In later turns it goes to the model as a *user* message with a heading, so the conversation still starts
  with the user role.
- Summarizing costs no heart and is logged like any call, marked `purpose: 'compact'`.
