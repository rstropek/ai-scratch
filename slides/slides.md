---
theme: none
title: Digitalferien 2026
favicon: /favicon.svg
info: Folien zum Video-Tutorial der Digitalferien 2026 (KI-Scratch)
canvasWidth: 1280
aspectRatio: 16/9
transition: slide-left
fonts:
  sans: Lexend Variable
  serif: Lilita One
  provider: none
layout: page
color: looks
pageNumber: false
---

<div class="cover">
  <h1>Willkommen bei den <span class="hl">Digitalferien 2026!</span></h1>
  <div class="cat"><Sticker src="/scratch/cat.svg" alt="Scratch-Katze" :width="330" :rotate="8" /></div>
  <p class="credit print">Scratch-Figuren aus der Scratch-Bibliothek, Scratch Foundation, CC BY-SA 2.0. Scratch ist ein Projekt der Scratch Foundation.</p>
</div>

<style>
.cover {
  display: grid;
  grid-template-columns: 1fr 400px;
  grid-template-rows: 1fr auto;
  height: 100%;
  padding: 88px 88px 40px;
}
.cover h1 { align-self: center; max-width: 11ch; }
.cover .hl { color: #ffd84d; }
.cover .cat { grid-row: 1; grid-column: 2; align-self: center; justify-self: center; }
.cover .credit { grid-column: 1 / 3; font-size: 16px; font-weight: 400; }
</style>

<!--
Begrüßung. Das Album füllt sich heute: jede Seite ein neues Thema.
Bildnachweis: Scratch-Katze aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0).
-->

---
layout: page
color: motion
ink: dark
---

<div class="day">
  <h1>Heute programmieren wir mit KI</h1>
  <div class="lines">
    <p>Die Übungen werden Schritt für Schritt schwieriger.</p>
    <p>Ihr müsst <strong>nicht</strong> alles schaffen. Nehmt euch so viel Zeit, wie ihr wollt.</p>
    <p>Schon fertig? Dann baut etwas ganz Eigenes!</p>
  </div>
  <div class="stairs">
    <Slot :size="96" label="leicht"><Sticker src="/scratch/cat.svg" alt="Scratch-Katze" :width="70" :rotate="-6" /></Slot>
    <Slot :number="2" :size="96" />
    <Slot :number="3" :size="96" />
    <Slot :number="4" :size="96" label="knifflig" />
    <Slot number="?" :size="96" label="eure Idee" />
  </div>
</div>

<style>
.day {
  display: grid;
  grid-template-columns: 500px 1fr;
  grid-template-rows: auto 1fr;
  column-gap: 48px;
  height: 100%;
  padding: 72px 88px 72px;
}
.day h1 { grid-column: 1 / 3; margin-bottom: 40px; }
.day .lines { display: flex; flex-direction: column; gap: 26px; }
.day .stairs { display: flex; align-items: flex-end; gap: 14px; align-self: end; padding-bottom: 40px; }
.day .stairs > :nth-child(2) { margin-bottom: 44px; }
.day .stairs > :nth-child(3) { margin-bottom: 88px; }
.day .stairs > :nth-child(4) { margin-bottom: 132px; }
.day .stairs > :nth-child(5) { margin-bottom: 176px; }
</style>

<!--
Jede Übung ist eine Stufe. Nicht alle müssen bis oben. Wer früher fertig ist, baut mit dem Gelernten etwas Eigenes.
-->

---
layout: page
color: events
ink: dark
---

<div class="what">
  <h1>Was ist eigentlich KI?</h1>
  <div class="pair">
    <Slot :size="360" label="Gehirn" plate><Sticker src="/art/brain.svg" alt="Gehirn" :width="290" :rotate="-5" /></Slot>
    <Slot :size="360" label="Computer-Chip" plate><Sticker src="/art/chip.svg" alt="Computer-Chip" :width="250" :rotate="5" :delay="160" /></Slot>
  </div>
</div>

<style>
.what {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 72px 88px 64px;
}
.what .pair { flex: 1; display: flex; justify-content: center; align-items: center; gap: 110px; padding-top: 24px; }
</style>

<!--
Hier erzähle ich über KI und LLMs: Gehirn und Computer-Chip.
-->

---
layout: page
color: control
ink: dark
---

<div class="sizes">
  <h1>Kleine KI, riesige KI</h1>
  <div class="side small">
    <SpeechBubble long :delay="300">Ich bin klein und laufe sogar auf normalen Computern. Aber ich kann nicht alles.</SpeechBubble>
    <Slot :size="160"><Sticker src="/art/chip.svg" alt="Ein Computer-Chip" :width="118" :rotate="-5" /></Slot>
  </div>
  <div class="side big">
    <SpeechBubble long :delay="1300">Ich bin riesig und superschlau. Aber ich brauche viiiiiel Computer-Power!</SpeechBubble>
    <div class="muscle"><Sticker src="/art/muscle.svg" alt="Muskel" :width="130" :rotate="10" :delay="1600" /></div>
    <Slot :width="540" :height="214">
      <div class="farm">
        <Sticker v-for="i in 24" :key="i" src="/art/chip.svg" alt="" :width="50" :rotate="((i * 7) % 11) - 5" :delay="300 + i * 35" />
      </div>
    </Slot>
  </div>
</div>

<style>
.sizes {
  display: grid;
  grid-template-columns: 1fr 560px;
  grid-template-rows: auto 1fr;
  column-gap: 64px;
  height: 100%;
  padding: 64px 88px 64px;
}
.sizes h1 { grid-column: 1 / 3; }
.sizes .side { position: relative; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; gap: 52px; }
.sizes .big .bubble { margin-right: 90px; }
.sizes .muscle { position: absolute; right: -20px; bottom: 200px; }
.sizes .farm { display: grid; grid-template-columns: repeat(8, 50px); gap: 12px 14px; }
</style>

<!--
Sprachmodelle gibt es in vielen Größen. Kleine laufen sogar auf einem Laptop oder Handy, können aber weniger.
Riesige sind viel schlauer, brauchen aber ein ganzes Rechenzentrum voller Chips.
-->

---
layout: page
color: sound
ink: dark
---

<div class="haiku">
  <div class="card">
    <p><span>Scratch-Katze hüpft los,</span><span class="count print">5</span></p>
    <p><span>ein Agent schreibt ihren Code.</span><span class="count print">7</span></p>
    <p><span>Ups, die Maus gewinnt!</span><span class="count print">5</span></p>
    <div class="stamp-at"><Stamp>Haiku 5-7-5</Stamp></div>
  </div>
  <div class="cat"><Sticker src="/scratch/cat-b.svg" alt="Scratch-Katze" :width="200" :rotate="-10" :delay="150" /></div>
  <div class="mouse"><Sticker src="/scratch/mouse.svg" alt="Maus" :width="190" :rotate="-4" :delay="300" /></div>
</div>

<style>
.haiku { position: relative; height: 100%; }
.haiku .card {
  position: absolute;
  left: 88px;
  right: 88px;
  top: 96px;
  padding: 44px 64px 52px;
  border-radius: 28px;
  background: #fff;
  color: var(--ink);
  box-shadow: 0 14px 28px rgb(27 19 64 / 0.28);
  transform: rotate(-1.5deg);
}
.haiku .card p {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: baseline;
  font-family: var(--font-display);
  font-size: 62px; /* the poem: one line per verse */
  line-height: 1.15;
  white-space: nowrap;
}
.haiku .count { color: #8a4fa8; font-family: var(--font-display); font-size: var(--size-text); }
.haiku .stamp-at { position: absolute; right: 120px; bottom: -34px; }
.haiku .cat { position: absolute; left: 96px; bottom: 30px; }
.haiku .mouse { position: absolute; left: 600px; bottom: 52px; }
</style>

<!--
Ein Haiku: drei Zeilen, 5-7-5 Silben. Sprachmodelle haben oft lustige Namen: Haiku, Fable, Luna, Astra …
Bildnachweis: Scratch-Katze und Maus aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0).
-->

---
layout: page
color: operators
ink: dark
---

<div class="bot">
  <h1>Was ist eigentlich ein Chatbot?</h1>
  <SpeechBubble class="cat-says r1" long tail="left" :delay="500">Was ist die Hauptstadt von Frankreich?</SpeechBubble>
  <SpeechBubble class="ai-says r2" long tail="right" :delay="1400">Paris</SpeechBubble>
  <SpeechBubble class="cat-says r3" long tail="left" :delay="2300">Und von Deutschland?</SpeechBubble>
  <SpeechBubble class="ai-says r4" long tail="right" :delay="3200">Berlin. Warst du schon einmal dort?</SpeechBubble>
  <SpeechBubble class="cat-says r5 narrow" long tail="left" :delay="4300">Nein, ist es schön dort zu dieser Jahreszeit?</SpeechBubble>
  <div class="cat"><Sticker src="/scratch/cat.svg" alt="Scratch-Katze" :width="150" :rotate="-4" /></div>
  <div class="chip"><Sticker src="/art/chip.svg" alt="Computer-Chip" :width="130" :rotate="5" :delay="150" /></div>
</div>

<style>
.bot {
  display: grid;
  grid-template-columns: 150px 1fr 130px;
  grid-template-rows: auto 1fr repeat(5, auto);
  gap: 12px 32px;
  height: 100%;
  padding: 56px 88px 40px;
}
.bot h1 { grid-column: 1 / 4; }
.bot .cat-says { grid-column: 2; justify-self: start; }
.bot .ai-says { grid-column: 2; justify-self: end; }
.bot .r1 { grid-row: 3; }
.bot .r2 { grid-row: 4; }
.bot .r3 { grid-row: 5; }
.bot .r4 { grid-row: 6; }
.bot .r5 { grid-row: 7; }
.bot .narrow { max-width: 500px; } /* a wrapped bubble keeps the full width, so it gets the width of its longer line */
/* each speaker sits beside their first bubble; zero height so the sticker doesn't stretch the row */
.bot .cat,
.bot .chip { height: 0; display: flex; align-items: center; justify-content: center; align-self: center; }
.bot .cat { grid-row: 3; grid-column: 1; margin-top: 28px; } /* clear of the heading */
.bot .chip { grid-row: 4; grid-column: 3; }
</style>

<!--
Ein Chatbot ist vor allem zum Plaudern da: Wir schreiben etwas, die KI antwortet, und daraus wird ein Gespräch.
Sie kann dabei nur reden. Als Nächstes: Ein KI-Agent bekommt Werkzeuge und kann damit etwas in der Welt tun, bei uns in Scratch.
Bildnachweis: Scratch-Katze aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0).
-->

---
layout: page
color: myblocks
ink: dark
---

<div class="agent">
  <h1>Was ist eigentlich <span class="nowrap">ein KI-Agent?</span></h1>
  <Slot :width="590" :height="372"><StickerVideo src="/videos/ki-agent-loop.mp4" :width="530" :rotate="2" /></Slot>
</div>

<style>
.agent .nowrap { white-space: nowrap; }
.agent {
  display: grid;
  grid-template-columns: 470px 1fr;
  align-items: center;
  column-gap: 40px;
  height: 100%;
  padding: 72px 88px 64px;
}
.agent h1 { align-self: start; }
</style>

---
layout: page
color: looks
---

<div class="tools">
  <Sticker src="/art/robot.svg" alt="Ein Roboter mit dem KI-Chip im Kopf und Greifern als Händen" :width="520" :rotate="-3" />
  <h1>KI-Agenten interagieren mit der Umwelt über <span class="hl">Tools</span></h1>
</div>

<style>
.tools {
  display: grid;
  grid-template-columns: 520px 1fr;
  align-items: center;
  column-gap: 56px;
  height: 100%;
  padding: 64px 88px 64px 72px;
}
.tools .hl { color: #ffd84d; } /* the grippers' yellow */
</style>

<!--
Ein Chatbot kann nur reden. Ein KI-Agent bekommt Tools, also Werkzeuge, wie die Greifer dieses Roboters, und kann damit selbst etwas tun.
Bei uns sind die Tools für Scratch: Skripte lesen und bauen, Figuren und Hintergründe hinzufügen, neue Figuren zeichnen und im Editor zeigen, wo etwas ist.
-->

---
layout: page
color: motion
ink: dark
---

<div class="ide">
  <h1>Beim Programmieren ist das Tool der Editor</h1>
  <!-- the same wires as the robot on page 8: navy cable, light-blue core, a pulse from the chip outwards -->
  <svg class="cables" viewBox="0 0 1280 720" aria-hidden="true">
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path class="casing" d="M 340 444 H 470 C 600 444, 620 341, 772 341 M 470 444 C 600 444, 620 575, 772 575" />
      <path class="wire" d="M 340 444 H 470 C 600 444, 620 341, 772 341 M 470 444 C 600 444, 620 575, 772 575" />
      <path class="core" d="M 340 444 H 470 C 600 444, 620 341, 772 341 M 470 444 C 600 444, 620 575, 772 575" />
      <path class="pulse" d="M 340 444 H 470 C 600 444, 620 341, 772 341" />
      <path class="pulse" d="M 340 444 H 470 C 600 444, 620 575, 772 575" />
    </g>
    <circle cx="470" cy="444" r="12" fill="#9fe3ff" stroke="#151a2e" stroke-width="4" />
  </svg>
  <div class="chip"><Sticker src="/art/chip-ki.svg" alt="KI-Chip" :width="210" :rotate="-4" /></div>
  <div class="blocks"><Sticker src="/art/scratch-blocks.svg" alt="Scratch mit einem Skript aus Blöcken" :width="400" :rotate="-2" :delay="200" /></div>
  <div class="code"><Sticker src="/art/code-editor.svg" alt="Ein Code-Editor mit drei Zeilen TypeScript" :width="400" :rotate="2" :delay="350" /></div>
</div>

<style>
.ide { position: relative; height: 100%; }
.ide h1 { position: absolute; top: 56px; left: 88px; right: 88px; }
.ide .cables { position: absolute; inset: 0; width: 100%; height: 100%; }
.ide .casing { stroke: #151a2e; stroke-width: 30px; }
.ide .wire { stroke: #2b3554; stroke-width: 20px; }
.ide .core { stroke: #9fe3ff; stroke-width: 6px; }
.ide .pulse { stroke: #fff; stroke-width: 6px; stroke-dasharray: 14 46; animation: ide-flow 1.2s linear infinite; }
@keyframes ide-flow { to { stroke-dashoffset: -60; } }
@media (prefers-reduced-motion: reduce) { .ide .pulse { animation: none; } }
.ide .chip { position: absolute; left: 150px; top: 339px; }
.ide .blocks { position: absolute; left: 760px; top: 222px; }
.ide .code { position: absolute; left: 760px; top: 484px; }
</style>

<!--
Für eine KI, die programmiert, ist das wichtigste Tool der Editor: bei uns Scratch, bei Profis ein Code-Editor.
Oben und unten steht dasselbe Programm, einmal als Blöcke, einmal als TypeScript.
KI kann auf vielen Stufen helfen: etwas erklären, einen Fehler finden, ein Skript bauen, ein ganzes Projekt.
-->

---
layout: page
color: control
ink: dark
---

<div class="ideas">
  <h1>Ihr bringt die Ideen mit</h1>
  <div class="row">
    <Slot :size="240" label="Die Idee" plate><Sticker src="/art/lightbulb.svg" alt="Glühbirne" :width="170" :rotate="-6" /></Slot>
    <Slot :size="240" label="Der Look" plate><Sticker src="/art/palette.svg" alt="Malpalette" :width="196" :rotate="5" :delay="150" /></Slot>
    <Slot :size="240" label="Die Spielregeln" plate><Sticker src="/art/dice.svg" alt="Würfel" :width="184" :rotate="-4" :delay="300" /></Slot>
  </div>
  <div class="ki">
    <Sticker src="/art/chip-ki.svg" alt="KI-Chip" :width="96" :rotate="6" :delay="450" />
    <p>Die KI nimmt euch viel Technik und Tipparbeit ab. <strong>So wird Programmieren kreativer.</strong></p>
  </div>
</div>

<style>
.ideas {
  display: flex;
  flex-direction: column;
  gap: 44px;
  height: 100%;
  padding: 64px 88px 56px;
}
.ideas .row { display: flex; justify-content: space-between; padding: 0 40px; }
.ideas .ki { display: flex; align-items: center; gap: 32px; margin-top: 12px; max-width: 960px; }
</style>

<!--
Ihr entscheidet, was gebaut wird (die Idee), wie es aussehen soll (der Look) und wie das Spiel funktioniert (die Spielregeln).
Die KI übernimmt viel von der technischen Kleinarbeit. Dadurch wird Programmieren weniger mühsam und viel kreativer.
-->

---
layout: page
color: events
ink: dark
---

<div class="go">
  <div class="cat"><Sticker src="/scratch/cat-b.svg" alt="Scratch-Katze" :width="340" :rotate="-6" /></div>
  <div class="flag"><Sticker src="/art/green-flag.svg" alt="Die grüne Flagge" :width="330" :rotate="6" :delay="150" /></div>
  <SpeechBubble class="says" :delay="600">Los gehts!</SpeechBubble>
</div>

<style>
.go { position: relative; height: 100%; }
.go .cat { position: absolute; left: 110px; bottom: 64px; }
.go .flag { position: absolute; right: 120px; top: 120px; }
.go .says { position: absolute; left: 270px; top: 100px; }
</style>

<!--
Startschuss: Wie in Scratch startet die grüne Flagge das Programm, heute startet sie unseren Tag.
Bildnachweis: Scratch-Katze aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0).
-->
