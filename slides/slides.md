---
theme: none
title: Digitalferien 2026
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
  <div class="scene">
    <div class="say"><SpeechBubble :delay="450">Hallo Welt!</SpeechBubble></div>
    <Slot :size="340"><Sticker src="/art/chip.svg" alt="Computer-Chip" :width="270" :rotate="-4" /></Slot>
  </div>
</div>

<style>
.bot {
  display: grid;
  grid-template-columns: 440px 1fr;
  height: 100%;
  padding: 72px 88px 64px;
}
.bot .scene { position: relative; display: flex; align-items: flex-end; justify-content: flex-start; padding: 0 0 20px 40px; }
.bot .say { position: absolute; top: 4px; left: 250px; }
</style>

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
