# Night test 2026-10-24/25: all prepared games, Haiku high

The game harness ran all five games: Memory, Fangspiel, Fang mich, Space Shooter and Minesweeper. Each game ran twice per round, with claude-haiku-5-5 at effort high as the app model; the simulated kid and the judge run on Opus. There were five rounds, and I fixed technical findings between them.

The fixes were committed on 2026-10-25 after Rainer's review (not pushed or swapped yet). Rainer's answers to the design decisions are at the end.

## Results per round

| Round | Run folder (`eval/games/runs/`) | Green | Turns | Broken JSON reaching the model | `clear_scripts` / `remove_scripts` | Cost (app / total) |
|---|---|---|---|---|---|---|
| 1, before any fix | `20261024-2223` | 6/10 | 157 | 11 | 69 / – | $0.40 / $4.42 |
| 2 | `20261024-2322` | 7/10 (2 failures were check artifacts) | 151 | 42 | 66 / – | $0.70 / $5.41 |
| 3 | `20261025-0035` | 9/10 | 122 | 14 (11 more were repaired) | 58 / – | $0.56 / $3.82 |
| 4 | `20261025-0121` | 9/10 | 139 | 4 | 0 / 61 | $0.54 / $4.15 |
| 5 | `20261025-0246` | 6/10 | 192 | 1 | 0 / 94 | $0.72 / $6.51 |
| 6 | `20261025-0808` | 10/10 (with the corrected Memory check) | 148 | – | – | $0.37 / $2.50 |
| 7 | `20261025-0901` | 10/10 (with the corrected Minesweeper check) | 199 | 2 | 4 / 84 | $0.69 / $4.19 |
| 8 | `20261025-0957` | 10/10 | 148 | – | 0 / 71 | $0.38 / $2.61 |

"Green" means every core check passes at the end. In each round, every run's `report.md` holds the conversation, the checks per turn and the judge's findings, and the folder's `summary.md` has one row per run. One run costs the app 1–20 ct. The total per run, $0.15–1.30, is mostly the Opus kid. The whole night cost about $24.

**Round 5 fell back to 6/10.** Four runs hit the 30-turn limit: Fang mich 1, Space Shooter 1 and both Minesweeper runs. All four went the same way, and it is the main open problem: the game worked or nearly worked, a later change broke one part, and the model never found the regression. It rebuilt scripts by guessing, said „müsste funktionieren“, and pushed debugging chores onto the kid (see D1).

One of the four (Minesweeper 2, turn 14) also hit a bug of mine. The new thinking-cut retry ran its tools, and the next request of that turn was rejected with a 400. That is fixed and checked against the real API (see Fixes, item 4), but there was no sixth round to measure it.

Two runs per game is too few to tell 9/10 from 6/10 reliably. Across all rounds:
- Memory and Fangspiel were always green, in 7–11 turns.
- Fang mich and Space Shooter were usually green, mostly in 7–10 turns (some runs took 17–23), with one 30-turn spiral each in round 5.
- Minesweeper took 26–30 turns, with teaching scores of 2–3/5; 3 of its 10 runs ended green.

## Fixes (uncommitted)

### App

1. **Tool call cut off by `max_tokens`:** the chat used to say „läuft“ forever.
   - `closeCutToolCalls` (`src/server/output-guard.ts`) turns it into a tool error that the model reads next.
   - Counted as `toolCuts` in `/api/stats`.
2. **`draw_costume` and `add_library_costume` switched the sprite to the new costume.** So every Memory or Minesweeper clone started as „offen“ or „Bombe“.
   - The sprite now keeps its costume (`asset-tools.ts`); a new Stage backdrop is still shown.
   - Verified in the real editor.
3. **Broken JSON in `add_scripts`:** usually one bracket too many in long inputs.
   - `src/server/tool-input.ts` repairs up to 2 wrong brackets, and only when the result parses; the compiler still checks every block.
   - Any other broken input gets a short error that shows where it broke. Before, the AI SDK's error repeated the whole input, and Haiku resent the same JSON three times.
4. **A call that only thinks until `max_tokens`:** Minesweeper logic, 16k thinking tokens, about 70 s of waiting, then an empty answer.
   - Round 4 showed a fixed German note (`THOUGHT_TOO_LONG`). Round 5 first retries once at effort `low` (`retryThinkingCut`); the note only comes if the retry thinks too long as well.
   - Round 5 had 7 such cuts, and every retry answered: no canned note, no empty answer.
   - Counted as `thinkingCuts`.
   - **Bug found in round 5, fixed after it:** the cut call's thinking must not be sent back with the rest of the turn. The API rejects the retry's signed thinking behind it as "modified" (400, „Da ist etwas schiefgegangen“). My filter missed the step because every step also holds a provider `custom` part.
   - Now fixed in `model-input.ts`, with a unit test of the whole flow (cut → retry with a tool call → tool result).
   - Checked with three real Haiku calls (`api-probe.mjs` in my scratchpad): 200 without the cut thinking, the same 400 with it.
5. **New tool `remove_scripts`,** a proposal (D3).
6. **Prompt** (`src/shared/prompt.ts`), a proposal (D2):
   - a new section „WENN ETWAS NICHT GEHT“;
   - „stoppe alles“ only when the game really ends;
   - change one script by removing and re-adding it.

### Game harness: the simulated kid was misled

- **Space Shooter:** the shoot check no longer waits for meteors.
- **Fang mich:** a 2 s „Game Over“ pause no longer counts as "stuck".
- **Minesweeper**, these now count:
  - a cell that hides or turns ghost when it opens;
  - a number in a speech bubble;
  - a flag sprite put on top of the cell. To take a flag away, the bot clicks a visible part of it, because the flag SVG was see-through at the cell centre.
  - Also, a board with unopened cells is not judged, and the new-board check compares at least 6 cells.
- **Memory:** a „Gewonnen!“ shown as a variable monitor counts as a win message, and the points variable is the one shown on the stage.
- **Kid prompt:** a part nobody mentions is untested, not broken.

Before these fixes, a single wrong check sentence cost a whole run. In round 2 the assistant was right („ich finde keinen Fehler“) while the harness was wrong.

### Tests and docs

- `npm run check` is clean, 137 unit tests pass, and the reference checks are unchanged.
- e2e: 23 tests pass.
- After round 5: 138 unit tests pass, plus the e2e run above.
- Updated docs:
  - `docs/limits-and-safety.md`: output limits, cuts, the retry;
  - `docs/architecture.md`: error conventions;
  - `docs/scratch-editor.md`: the costume trap;
  - `docs/tools-and-scripts.md`: `remove_scripts`, marked as a proposal;
  - `eval/games/README.md`: traps.

## Design decisions for you

- **D1: a test-run tool for the assistant.** The tool would run the game for N seconds and report positions, variables and speech.
  - Haiku never really debugs: it reads the scripts, says they look right, and guesses.
  - Example: Fang mich run 2 in round 4. The model's own „stoppe alles“ froze the game, and it took 18 turns to find it. The kid had guessed the cause in turn 14, and the assistant said no.
  - A probe tool would let the assistant check instead of guessing. It conflicts with teaching mode, where the kid tries the game.
  - My recommendation: yes, as a read-only probe the prompt reserves for "the kid says it doesn't work".
- **D2: the prompt section „WENN ETWAS NICHT GEHT“.**
  - What it says: believe the kid, don't blame the screen or keyboard, trace the scripts step by step, and after two failed tries rebuild the part more simply or ask for an observation.
  - It helped only a little: Haiku still writes „die Skripte sehen richtig aus“.
  - Risk: real kids misreport too, so „Glaub dem Kind“ can make the assistant change correct code.
  - Also in the prompt now: „stoppe alles“ only when the game really ends. The Spielende tip made the model put it into a catch that should go on.
- **D3: the `remove_scripts` tool,** plus a prompt line: to change a script, remove that one and add its new version.
  - It replaces clearing all of a sprite's scripts and re-adding them, which caused most of the broken JSON and `max_tokens` cuts. Clearing also left sprites empty when the following add failed, and it wiped scripts the kid had built by hand. You saw that in your own session with a custom block.
  - In round 4 the model used it 61 times and `clear_scripts` never, and broken inputs fell from 14 to 4.
  - The docs said edit tools are your call, so it is marked as a proposal.
- **D4: Minesweeper in the tutorial?**
  - Haiku in teaching mode takes 26–30 turns, the judge gave 2–3/5, and it causes all thinking cuts.
  - 3 of its 10 runs ended green. It is buildable, but not in a 2-hour budget with ~75 turns shared among other goals.
  - Options: a smaller board, a simpler version without flags or the cascade, or leaving it out of the suggestions.
- **D5: the effort level.** You chose high, and I left the default unchanged.
  - Thinking cuts happen only on Minesweeper-level logic: 6 in round 4, 7 in round 5.
  - The retry at `low` is a fallback; check that you are fine with it.
- **D6: wording.**
  - `THOUGHT_TOO_LONG`, kid-facing German: „Puh, darüber habe ich so lange nachgedacht, dass ich nicht fertig geworden bin. Lass uns das in kleineren Schritten bauen: Was soll als Erstes klappen?“ It now shows only if the retry fails too.
  - `CUT_TOOL_CALL_ERROR` and the broken-JSON error text are model-facing English.
- **Older, still open:**
  - tighten `staysHiddenAfterStop`;
  - make the Stage switch after `add_scripts` visible;
  - Opus or Sonnet for the simulated kid and the judge (the kid is ~75 % of the eval cost);
  - the „frag einen Erwachsenen“ wording;
  - the model still claims changes without calling a tool (Space Shooter run 2 in round 3, turns 8 and 12).

## Model weaknesses seen (no fix, for the record)

- **Rebuilds instead of debugging, and regressions it never finds.**
  - Minesweeper round 4, run 2: adding flags broke the cascade.
  - Space Shooter round 5, run 1: Game Over broke the points, and it then made new variables against the kid's naming.
  - Fang mich round 5, run 1: rebuilding the shark broke its movement twice.
- **A debug aid that breaks the game.** In Minesweeper round 4, run 1, the model added a „Leertaste: 0“ bubble for 8 s on every click.
  - Speech bubbles take the clicks meant for the cells above them, so those cells stay closed, and the bubbles cover „Gewonnen!“.
  - I checked this by playing the final project directly: all safe cells open only after waiting for the bubbles, and the win message still never shows.
- **Asks the kid to tick checkboxes in the editor** after the kid has said they can't (simulated kid).

## Rainer's decisions (2026-10-25)

- **D1:** build the probe tool, read-only, and only when the kid says something doesn't work.
- **D2:** keep the section, but soften „Glaub dem Kind“ to „nimm die Beobachtung ernst und prüfe sie“. Keep the stop-all lines.
- **D3:** keep `remove_scripts`, and keep `clear_scripts` for a full rebuild.
- **D4:** a simpler Minesweeper (smaller board, no flags or cascade), tested in the harness first.
- **D5:** effort high with the retry at low, as built.
- **D6:** keep the `THOUGHT_TOO_LONG` text.
- **Older items:** Sonnet for the simulated kid (the judge stays on Opus).
- **Next:** commit these fixes first, then build the decisions.

## Round 6 (2026-10-25 morning): the decisions built

Built after the decisions above:
- `test_run` (D1, `src/shared/tools/test-run.ts`);
- the softer first rule (D2);
- `minesweeper-mini` (D4);
- the Sonnet kid.

Run `20261025-0808`: Memory, Fangspiel, Fang mich, Space Shooter and `minesweeper-mini`, two runs each, 148 turns, $0.37 app / $2.50 total.

- **9/10 green, and 10/10 with a corrected check.**
  - Memory run 2 failed only „Bilder passen“. The model drew the cherry twice, so the two cards are slightly different drawings, both with the costume name „Kirsche“.
  - The game pairs them by name, and a kid sees two cherries. So the check now groups pictures the way it matches pairs: by image, or by a costume name that isn't generic. When pictures really don't pair up, the kid message names the odd ones out.
  - The final project then passes 7/7.
- **Minesweeper (klein): 2/2 green, in 11 and 12 turns,** with teaching scores of 3/5. Full Minesweeper took 26–30 turns.
- **No 400s** in 348 model calls; the fix from round 5 holds.
- **`test_run`: 46 calls in 9 of 10 runs.**
  - It helped: in Fang mich and Space Shooter the model found regressions by playing them. In Memory run 2 it correctly saw that Sprite1 was still there when the kid said it had deleted it.
  - It costs time: up to 10 s per call, and some answers ran two.
  - **Teaching mode: about a third of the calls came without a bug report** (the model checked its own new work, e.g. Minesweeper turn 2, Space Shooter turns 3 and 6), despite the prompt line and the tool description. See D7.
  - Its timeline shows costume names, not images, so it couldn't see the two different cherries.
- **The Sonnet kid is weaker than the Opus kid:**
  - it quoted the harness („unter ‚Beim Ausprobieren‘ steht …“, „auf dem Bild“);
  - it claimed to have deleted the cat;
  - it kept saying the game-over sign never appears, because the stage picture is taken just after the green flag (Fangspiel run 2: green after turn 7, but 27 turns).
  - The kid prompt now forbids both; not measured yet.
- **Kids ask to delete the cat in almost every run,** and the assistant can only explain the right-click. See D8.

Rainer's decisions on round 6: D7, keep `test_run` as it is (he wants to try it himself first); D8, no delete tool.

## Round 7 (2026-10-25): production version 145188b (library pictures)

Run `20261025-0901`: the same five games as round 6, two runs each. 199 turns, $0.69 app / $4.19 total, 468 model calls, all 200.

- **9/10 green, and 10/10 with a corrected check.** Minesweeper (klein) run 2 failed „Die Zahlen stimmen“, but its bomb cell opens like a safe cell („offen“ plus „Verloren!“). The check had already recorded that cell as a number, so it found „0 bombs“ and told the kid „Ich finde keine Bomben“ for 20 turns. Fixed: the cell that loses is a bomb. The final project then passes 6/6.
- **Four runs went 25–30 turns although they were green by turn 8–11.** None of them is the app's fault:
  - **Fangspiel 2 and Space Shooter 1: „ich sehe kein Game Over“ for ~20 turns,** while Game Over was visible from turn 9 (a monitor, then a speech bubble, then a full red sign). The kid only ever got the picture right after the green flag, never the end. The model kept redrawing a sign that worked.
  - **Memory 1: „die Karten liegen in einer Reihe“ for 17 turns,** right after the kid had seen two rows. The kid gets no picture on turns that change nothing, and it misremembered. The model checked with `test_run` each time and correctly held that the cards were in two rows.
  - Fixed in the harness: the kid now gets every picture the check takes, with its label (start, while playing, the end), and the latest ones stay with each answer while nothing changes.
  - Space Shooter 2: a real restart bug the model first denied („Ich habe nichts geändert“), then fixed by guessing in turn 22.
- **Library pictures (new in 145188b): they work.** The kids picked by picture: „Shark 2“, „Underwater 2“, „Galaxy“, „Nebula“. But every search shows its pictures, also searches the model makes for itself: basketball players for „Korb“, „Glow-0…5“ when it looked for digit costumes, and the same sharks twice after two searches in one answer.
- **`test_run`: 60 calls.** In Fang mich 2 the model's run didn't reproduce the bug: the shark starts at a random place, the harness's seed put it on the fish (Game Over at once), the model's run didn't. It told the kid twice that everything moves. That's real for kids too: a bug that depends on chance shows only sometimes.
- **The cat again:** Space Shooter 1 asked nine times; the model hid it with a script only in turn 15 (Fang mich 2: turn 11, after the kid suggested it).
- **Leaked reasoning:** Space Shooter 2 talked about „dem Kind“ in the third person in three answers.
- Teaching scores 2–3/5; the judges' main complaints are the loops above and guessed rebuilds.

## Round 8 (2026-10-25): the round-7 harness fixes, pictures once per answer

Run `20261025-0957`: the same games, 148 turns, $0.38 app / $2.61 total, 355 model calls, all 200.

- **10/10 green, 9 of them ended by the kid („FERTIG“) after 7–20 turns.** Teaching scores 3–4/5, up from 2–3.
- **Fangspiel 2 still ran 30 turns on „kein Game Over“.** This time the kid saw the end picture, but the game says „Game Over“ for 3 s and then „stoppe alles“, which clears every speech bubble, so the picture taken after it has none. A kid at the screen would have seen it. From turn 14 on it was also real: the basket repeats „Punkte: …“ in a loop and overwrote the Game Over bubble; the model never found that.
  - Harness: the kid's sentence now names what the game said („Dabei sagt Korb „Game Over““), and the kid prompt says that what it was told counts even when a picture no longer shows it.
  - Not changed in the app (Rainer, 2026-10-25: small agent mistakes are fine, kids may spot them). An `add_scripts` warning for „sage“ directly before „stoppe alles“ was tried and dropped: no round ever had that pattern (the model uses „sage … für 2 Sekunden“).
