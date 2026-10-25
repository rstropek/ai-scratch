# The "frage KI" block

Kids' own programs can ask the AI: a "KI" category at the bottom of the block palette with one reporter,
`frage KI [ ]`. The goal is a super simple chatbot, first one question at a time, then one that remembers by
joining the conversation into a variable. Read this before touching the block, `/api/ask` or its guard.

## The path of one question

1. [ki-extension.ts](../src/editor/ki-extension.ts) (in the editor iframe) calls `window.ki.ask`, which the
   host sets only while the kid has a valid code. Without it the block reports „Gib zuerst den Code im Chat
   ein.“
2. [ki-ask.ts](../src/client/ki-ask.ts) (host) takes a heart from the **same store as the chat**
   ([hearts.ts](../src/client/hearts.ts)). Without a heart it **waits** for the next one (Rainer's choice),
   so a block in a loop can't flood the server; the chat waits too, since it shares the hearts.
3. [ask.ts](../src/server/ask.ts) (`POST /api/ask`, access code required): one heart from the server's
   bucket, then Jev, then one model call (same model, no tools, no thinking, `max_tokens` 300). Answers are
   plain JSON, not a stream. A model failure or an empty answer is a 502 with a German message the sprite
   says.

The server keeps no conversation. Memory is the kid's work: their program joins „Ich: …“ and „KI: …“ into a
variable and sends all of it. That is the point of the exercise: a chatbot only "remembers" what is sent again.

## Decisions

- **Same hearts, same guard, same code** as the chat (Rainer). `admin_` codes skip hearts here too.
- **Audience instructions** (`ASK_INSTRUCTIONS`): ages 10–16, German, at most 2–3 short sentences (a Scratch
  speech bubble shows about 330 characters), plain text, continue a joined conversation, play along with a
  role, send kids with personal problems to the adults.
- **Its own Jev description** (`BLOCK_QUESTIONS` in [guard.ts](../src/server/guard.ts)): same questions,
  categories and thresholds, but the context describes a chatbot, and four questions are reworded so a role
  („Du bist ein Pirat“), teasing within that role and a sad character pass. „Ignoriere deine Regeln“ still
  doesn't. The cases are in [kids-protection.md](kids-protection.md); the chat's questions are unchanged.
- **Sliding window, 3000 characters:** only the end of a longer text reaches Jev and the model (Rainer: no
  refusal). The start of a long conversation drops out, so a role belongs *in front of* the window: the prompt
  teaches `frage KI (verbinde (Du bist ein Pirat.) und (Verlauf))`.
- **Prompt caching:** the instructions (~350 tokens) are under Haiku's 512-token minimum, so one question
  never caches. A chatbot resends its growing conversation, so the text is sent in 400-character blocks with
  the cache breakpoint after the last full block; the next ask reads them from the cache. Once the window
  slides, the blocks shift and every ask misses. That is acceptable: an ask costs about 0.01 ct.
- **Stop aborts:** the stop sign or the green flag (`PROJECT_STOP_ALL`) aborts asks still waiting for a heart
  or an answer.

## Traps

- **Registration order:** a project with KI blocks only loads where the extension is registered first. The
  editor registers it right after the VM exists, before any project; the headless test VM does the same.
  Scratch elsewhere can't load these projects, **scratch.mit.edu included**: a kid who takes a chatbot
  project home can't open it there.
- **`getInfo()` needs `color1`, `color2` and `color3`:** without `color3`, scratch-blocks throws "Invalid
  colour" and the whole workspace stops rendering.
- **`frage … und warte` replaces the speech bubble at once.** `sage (frage KI …)` followed by
  `frage … und warte` shows the answer for a split second only. The prompt teaches the AI's answer as the next
  question: `frage (frage KI (Antwort)) und warte`.
- **`disableMonitor`:** a stage monitor of the reporter would ask again and again.
- **Thinking must be turned off explicitly** (`thinking: disabled`). Haiku 5.5 thinks by default, more the
  longer the text: from about 800 characters of chatbot conversation it thought through all 300 tokens and
  returned no text, so every ask became a 502. `/api/compact` has the same setting.
- `test_run` and the harness run the block for real: each ask costs a heart (none with the harness's `admin_`
  code) and a Jev call.
