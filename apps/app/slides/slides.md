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
    <div><Slot :size="96"><Sticker src="/scratch/cat.svg" alt="Scratch-Katze" :width="70" :rotate="-6" /></Slot><span class="print">leicht</span></div>
    <div><Slot :number="2" :size="96" /></div>
    <div><Slot :number="3" :size="96" /><span class="print">eure Idee</span></div>
    <div><Slot :number="4" :size="96" /></div>
    <div><Slot :number="5" :size="96" /><span class="print">knifflig</span></div>
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
.day .stairs { display: flex; align-items: flex-end; gap: 14px; align-self: end; padding-bottom: 76px; }
.day .stairs > div { position: relative; }
/* out of the flow, so a caption doesn't lift its step */
.day .stairs .print { position: absolute; top: calc(100% + 12px); left: -30px; right: -30px; font-weight: 600; text-align: center; white-space: nowrap; }
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
color: looks
---

<div class="hike">
  <h1>Wandern oder Seilbahn?</h1>
  <div class="lines">
    <p v-click="1"><strong>Selber programmieren:</strong> Der Weg ist das Ziel.</p>
    <p v-click="2"><strong>Mit KI:</strong> schneller oben bei deinem Traumspiel.</p>
    <p v-click="3" class="today">Heute lernt ihr die Seilbahn kennen. <strong class="nb">Wandern bleibt super!</strong></p>
  </div>
  <!-- cable-car.svg shares the mountain's viewBox, size and tilt, so it lies exactly on it -->
  <div class="scene">
    <div class="layer"><Sticker src="/art/mountain.svg" alt="Ein Berg mit Wanderweg und einer Fahne auf dem Gipfel" :width="640" :rotate="-2" /></div>
    <div v-click="1" class="hiker"><Sticker src="/scratch/cat-b.svg" alt="Die Scratch-Katze wandert hinauf" :width="70" :rotate="-6" /></div>
    <div v-click="2" class="layer"><Sticker src="/art/cable-car.svg" alt="Eine Seilbahn mit KI-Kabine" :width="640" :rotate="-2" /></div>
  </div>
</div>

<style>
.hike {
  display: grid;
  grid-template-columns: 450px 1fr;
  grid-template-rows: auto 1fr;
  column-gap: 40px;
  height: 100%;
  padding: 72px 88px 64px;
}
.hike h1 { grid-column: 1 / 3; margin-bottom: 32px; }
.hike .lines { display: flex; flex-direction: column; gap: 26px; padding-top: 12px; }
.hike .today { margin-top: 18px; }
.hike .scene { position: relative; width: 640px; height: 395px; align-self: end; justify-self: end; margin-bottom: 24px; }
.hike .layer { position: absolute; inset: 0; }
.hike .hiker { position: absolute; left: 220px; top: 186px; } /* on the trail, halfway up */
.hike .nb { white-space: nowrap; }
</style>

<!--
Bevor wir loslegen, etwas Wichtiges: Wir wollen Scratch nicht ersetzen.
Auf einen Berg kommt ihr zu Fuß oder mit der Seilbahn. [click] Selber programmieren ist wie Wandern: Jedes Rätsel, das ihr selbst knackt, gehört euch. Wenn ihr gern selbst tüftelt, lasst die KI weg, das ist großartig, und das soll euch keine KI der Welt wegnehmen.
[click] Mit KI ist es wie mit der Seilbahn: Wenn ihr ein Spiel im Kopf habt und es einfach bauen wollt, bringt sie euch schneller hin.
[click] Heute geht es um KI: wie sie funktioniert und wie man mit ihr arbeitet. Scratch ist dafür unser Spielplatz. Wandern bleibt super!
Bildnachweis: Scratch-Katze aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0).
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
clicks: 2
---

<div class="sizes">
  <h1>Kleine KI, riesige KI</h1>
  <!-- each side is mounted on its click, so its stickers press on then -->
  <div class="side small">
    <SpeechBubble v-if="$clicks >= 1" long :delay="300">Ich bin klein und laufe sogar auf normalen Computern. Aber ich kann nicht alles.</SpeechBubble>
    <Slot v-if="$clicks >= 1" :size="160"><Sticker src="/art/chip.svg" alt="Ein Computer-Chip" :width="118" :rotate="-5" /></Slot>
  </div>
  <div class="side big">
    <SpeechBubble v-if="$clicks >= 2" long :delay="900">Ich bin riesig und superschlau. Aber ich brauche viiiiiel Computer-Power!</SpeechBubble>
    <div v-if="$clicks >= 2" class="muscle"><Sticker src="/art/muscle.svg" alt="Muskel" :width="130" :rotate="10" :delay="1200" /></div>
    <Slot v-if="$clicks >= 2" :width="540" :height="214">
      <div class="farm">
        <Sticker v-for="i in 24" :key="i" src="/art/chip.svg" alt="" :width="50" :rotate="((i * 7) % 11) - 5" :delay="100 + i * 30" />
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
Sprachmodelle gibt es in vielen Größen. [click] Kleine laufen sogar auf einem Laptop oder Handy, können aber weniger.
[click] Riesige sind viel schlauer, brauchen aber ein ganzes Rechenzentrum voller Chips.
-->

---
layout: page
color: sound
ink: dark
---

<div class="haiku">
  <div class="card">
    <p>Scratch-Katze hüpft los,</p>
    <p>ein Agent schreibt ihren Code.</p>
    <p>Ups, die Maus gewinnt!</p>
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
  font-family: var(--font-display);
  font-size: 62px; /* the poem: one line per verse */
  line-height: 1.15;
  white-space: nowrap;
}
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
  <h1 v-click>KI-Agenten interagieren mit der Umwelt über <span class="hl">Tools</span></h1>
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
Ein Chatbot kann nur reden. [click] Ein KI-Agent bekommt Tools, also Werkzeuge, wie die Greifer dieses Roboters, und kann damit selbst etwas tun.
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

---
layout: page
color: motion
ink: dark
---

<div class="exercise">
  <div class="text">
    <h1>Zurück zu Scratch</h1>
    <p>Wir bauen das Fische-Spiel, ganz ohne KI.</p>
    <p>Ihr steuert den Fisch. Der Hai will ihn fangen.</p>
    <p>Am Ende kommt euer Spiel in den Locker.</p>
  </div>
  <div class="shark"><Sticker src="/scratch/shark.svg" alt="Hai" :width="250" :rotate="4" :delay="700" /></div>
  <Stairs :current="1" />
</div>

<style>
/* swims towards the fish on the first step */
.exercise .shark { position: absolute; right: 150px; top: 120px; transform: scaleX(-1); }
</style>

<!--
Übung 1: Bevor die KI dazukommt, frischen wir Scratch auf. Wir bauen das Fische-Spiel („Fang mich“) gemeinsam, Schritt für Schritt: Pfeiltasten für den Fisch, der Hai schwimmt von selbst und prallt am Rand ab, und wenn er den Fisch erwischt: Game Over.
Am Ende speichern wir das Spiel im CoderDojo Locker (nächste Seite).
Bildnachweis: Fisch und Hai aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0).
-->

---
layout: page
color: control
ink: dark
clicks: 2
---

<div class="locker">
  <h1>Ab in den Locker!</h1>
  <div class="lines">
    <p>Im Menü <strong>Datei</strong> speichert ihr euer Spiel im CoderDojo Locker.</p>
    <p>Dafür braucht ihr den Code von eurem Locker-Sticker.</p>
    <p>Zu Hause ladet ihr es wieder und baut weiter.</p>
  </div>
  <div v-click="1" class="menu-at">
    <div class="menu" role="img" aria-label="Das Menü Datei in Scratch mit den drei Locker-Einträgen">
      <div class="bar"><span class="tab">Datei</span><span>Bearbeiten</span></div>
      <ul>
        <li>Neu</li>
        <li>Von deinem Computer hochladen</li>
        <li>Auf deinem Computer speichern</li>
        <li class="ours">Aus dem Locker laden</li>
        <li class="ours"><mark>Im Locker speichern</mark></li>
        <li class="ours">Locker in neuem Tab öffnen</li>
      </ul>
    </div>
  </div>
  <div v-click="2" class="tag-at">
    <div class="tag">
      <span class="print">Dein Locker-Code</span>
      <span class="code">AB12 CD34</span>
    </div>
  </div>
</div>

<style>
.locker {
  display: grid;
  grid-template-columns: 1fr 500px;
  grid-template-rows: auto 1fr;
  column-gap: 56px;
  height: 100%;
  padding: 72px 88px 64px;
}
.locker h1 { grid-column: 1 / 3; margin-bottom: 36px; }
.locker .lines { display: flex; flex-direction: column; gap: 22px; }
.locker .menu-at { grid-column: 2; grid-row: 2; position: relative; }
/* Scratch's own menu: the purple of the menu bar, white words, a line before our entries */
.locker .menu {
  padding: 10px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 14px 28px rgb(27 19 64 / 0.28);
  transform: rotate(-2deg);
  animation: menu-lay 700ms var(--ease-out) both;
}
.locker .bar { display: flex; gap: 6px; padding: 8px 10px 0; border-radius: 10px 10px 0 0; background: #855cd6; color: #fff; font-size: var(--size-print); font-weight: 600; }
.locker .bar span { padding: 6px 14px 10px; }
.locker .bar .tab { border-radius: 8px 8px 0 0; background: #6b3fc8; }
.locker ul { margin: 0; padding: 6px 0 10px; list-style: none; border-radius: 0 0 10px 10px; background: #6b3fc8; color: #fff; font-size: var(--size-print); }
.locker li { padding: 7px 24px; }
.locker li.ours { font-weight: 700; }
.locker li:nth-child(4) { margin-top: 8px; padding-top: 15px; border-top: 2px solid rgb(255 255 255 / 0.3); }
.locker li mark { padding: 2px 8px; color: var(--ink); }
.locker .tag-at { position: absolute; right: 250px; bottom: 30px; }
.locker .tag {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 28px 16px;
  border-radius: 22px;
  background: #fff;
  color: var(--ink);
  box-shadow: 0 14px 28px rgb(27 19 64 / 0.28);
  transform: rotate(5deg);
  animation: tag-stick 700ms var(--ease-out) both;
}
.locker .tag .code { font-family: var(--font-display); font-size: var(--size-display); line-height: 1; letter-spacing: 0.04em; }
@keyframes menu-lay { from { transform: translateY(-26px) rotate(3deg) scale(1.04); } }
@keyframes tag-stick { from { transform: translateY(-26px) rotate(12deg) scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .locker .menu, .locker .tag { animation: none; } }
</style>

<!--
Damit euer Spiel nicht verloren geht, wenn ihr den Browser schließt: [click] Im Menü Datei gibt es drei Einträge für den CoderDojo Locker: laden, speichern und den Locker in einem neuen Tab öffnen.
[click] Beim ersten Speichern fragt Scratch nach eurem Code. Der steht auf eurem Locker-Sticker. Mit dem Code findet ihr euer Spiel auch zu Hause wieder, auf locker.coderdojo.net.
Der Code auf der Folie ist nur ein Beispiel (mit einer 1, die es in echten Codes nicht gibt).
-->

---
layout: page
color: looks
---

<div class="exercise">
  <div class="text">
    <h1>Jetzt mit KI</h1>
    <p>Gebt den KI-Code im Chat ein.</p>
    <p>Wir bauen das Fische-Spiel noch einmal, diesmal mit der KI.</p>
    <p>Frage für Frage, gemeinsam mit mir.</p>
  </div>
  <Stairs :current="2" />
</div>

<!--
Übung 2: Jetzt kommt die KI dazu. Gebt den Code für eure Schule im Chat rechts ein. [TODO Rainer: woher die Kinder den Code bekommen]
Wir bauen dasselbe Fische-Spiel noch einmal, aber diesmal sagen wir der KI, was wir wollen. Ich mache es vor, ihr macht es mit, eine Nachricht nach der anderen.
Dabei seht ihr die Tools der KI in Aktion und lernt ihre Grenzen kennen.
-->

---
layout: page
color: myblocks
ink: dark
---

<div class="tools-live">
  <h1>Die Tools in Aktion</h1>
  <div class="row">
    <Slot :size="230" label="Figur suchen" plate>
      <div v-click="1" class="pair">
        <Sticker src="/scratch/cat-b.svg" alt="Scratch-Katze" :width="120" :rotate="-5" />
        <div class="lens"><Sticker src="/art/magnifier.svg" alt="Lupe" :width="110" :rotate="8" :delay="150" /></div>
      </div>
    </Slot>
    <Slot :size="230" label="Block suchen" plate>
      <div v-click="2" class="pair">
        <Sticker src="/art/block.svg" alt="Ein Scratch-Block" :width="160" :rotate="-4" />
        <div class="lens"><Sticker src="/art/magnifier.svg" alt="Lupe" :width="110" :rotate="8" :delay="150" /></div>
      </div>
    </Slot>
    <Slot :size="230" label="Skript bauen" plate>
      <div v-click="3"><Sticker src="/art/scratch-blocks.svg" alt="Ein Skript aus Scratch-Blöcken" :width="196" :rotate="3" /></div>
    </Slot>
    <Slot :size="230" label="Figur zeichnen" plate>
      <div v-click="4"><Sticker src="/scratch/pencil.svg" alt="Bleistift" :width="120" :rotate="-6" /></div>
    </Slot>
  </div>
</div>

<style>
.tools-live {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 72px 88px 64px;
}
.tools-live .row { flex: 1; display: flex; justify-content: space-between; align-items: center; padding-bottom: 40px; }
.tools-live .pair { position: relative; }
.tools-live .lens { position: absolute; right: -34px; bottom: -30px; }
</style>

<!--
Erinnert ihr euch an die Tools? Hier seht ihr sie in Aktion, jedes Mal, wenn die KI etwas in Scratch tut.
[click] Die KI sucht Figuren und Hintergründe in der Scratch-Bibliothek.
[click] Sie sucht die passenden Blöcke.
[click] Sie baut daraus Skripte, direkt in eurem Projekt.
[click] Und wenn es eine Figur nicht gibt, zeichnet sie eine neue, die ihr danach selbst bearbeiten könnt.
Bildnachweis: Scratch-Katze und Bleistift aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0).
-->

---
layout: page
color: control
ink: dark
clicks: 2
---

<div class="oops">
  <h1>KI macht Fehler!</h1>
  <!-- the chat as the app shows it: your message lilac on the right, the answer in a stage bubble, "Rückgängig" under it -->
  <div class="chat-card">
    <p class="kid">Mach den Hai schneller!</p>
    <SpeechBubble long :delay="300">Fertig! Der Hai ist jetzt superschnell.</SpeechBubble>
    <p class="undo print" :class="{ on: $clicks >= 1 }">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
      Rückgängig
    </p>
  </div>
  <div class="stage">
    <div class="fish"><Sticker src="/scratch/fish.svg" alt="Fisch" :width="110" :rotate="-4" :delay="150" /></div>
    <div class="shark" :class="{ upside: $clicks < 2 }"><Sticker src="/scratch/shark.svg" alt="Der Hai, auf dem Rücken" :width="250" :rotate="3" :delay="300" /></div>
    <div v-if="$clicks < 2" class="stamp-at"><Stamp>Ups!</Stamp></div>
  </div>
  <div class="lines">
    <p v-click="1">Passt etwas nicht? Klickt unter der Antwort auf <strong>Rückgängig</strong>. Euer Projekt ist wieder so wie vor eurer Nachricht.</p>
    <p v-click="2"><strong>Achtung:</strong> Was danach kam, ist dann auch weg.</p>
  </div>
</div>

<style>
.oops {
  display: grid;
  grid-template-columns: 560px 1fr;
  grid-template-rows: auto auto 1fr;
  column-gap: 48px;
  height: 100%;
  padding: 64px 88px 56px;
}
.oops h1 { grid-column: 1 / 3; margin-bottom: 28px; }
.oops .chat-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  padding: 22px 24px 18px;
  border-radius: 22px;
  background: #fff;
  color: var(--ink);
  box-shadow: 0 14px 28px rgb(27 19 64 / 0.28);
  transform: rotate(-1.5deg);
  --size-text: 30px; /* the chat pages' size */
}
.oops .kid {
  align-self: flex-end;
  padding: 12px 22px 14px;
  border: 2px solid rgb(133 92 214 / 0.35);
  border-radius: 22px;
  background: #ede7f9;
  color: #3b2a6b;
  font-size: var(--size-text);
  font-weight: 600;
  line-height: 1.3;
}
.oops .undo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 18px 0 0 6px;
  padding: 2px 10px;
  border-radius: 6px;
  color: #575e75;
  font-weight: 600;
  transition: background-color 300ms var(--ease-out), color 300ms var(--ease-out);
}
.oops .undo.on { background: #ffd84d; color: var(--ink); }
.oops .undo svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
/* the game's stage, under water */
.oops .stage {
  position: relative;
  align-self: start;
  height: 300px;
  margin-top: 8px;
  border: 10px solid #fff;
  border-radius: 22px;
  background: #bfe3ff;
  box-shadow: 0 14px 28px rgb(27 19 64 / 0.28);
  transform: rotate(2deg);
}
.oops .fish { position: absolute; left: 36px; bottom: 40px; }
.oops .shark { position: absolute; right: 40px; top: 50px; transition: transform 900ms var(--ease-out); }
.oops .shark.upside { transform: rotate(180deg); }
.oops .stamp-at { position: absolute; left: 30px; top: 24px; }
.oops .lines { grid-column: 1 / 3; display: flex; flex-direction: column; gap: 14px; align-self: end; }
@media (prefers-reduced-motion: reduce) { .oops .shark, .oops .undo { transition: none; } }
</style>

<!--
Die KI ist schlau, aber sie macht auch Fehler. Hier sollte der Hai schneller werden, und jetzt schwimmt er auf dem Rücken!
[click] Kein Problem: Unter jeder Antwort, die euer Projekt verändert hat, steht „Rückgängig“. Ein Klick, und euer Projekt ist wieder so, wie es war, bevor ihr die Nachricht geschickt habt.
[click] Aber Achtung: Alles, was danach passiert ist, ist dann auch weg, auch das, was ihr selbst geändert habt. Am besten gleich rückgängig machen, wenn etwas nicht passt.
Bildnachweis: Fisch und Hai aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0).
-->

---
layout: page
color: events
ink: dark
clicks: 1
---

<div class="hearts">
  <h1>Jede Frage kostet ein Herz</h1>
  <div class="lines">
    <p>Ihr habt 3 Herzen.</p>
    <p>Alle 20 Sekunden wächst eins nach.</p>
  </div>
  <div class="row">
    <Slot :size="190"><Sticker src="/art/heart.svg" alt="Herz" :width="140" :rotate="-6" /></Slot>
    <Slot :size="190"><Sticker src="/art/heart.svg" alt="Herz" :width="140" :rotate="4" :delay="150" /></Slot>
    <div class="third">
      <Slot :size="190"><div v-click.hide="1"><Sticker src="/art/heart.svg" alt="Herz" :width="140" :rotate="-3" :delay="300" /></div></Slot>
      <p v-click="1" class="print">in 20 Sekunden wieder da</p>
    </div>
  </div>
</div>

<style>
.hearts {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto 1fr;
  column-gap: 48px;
  height: 100%;
  padding: 72px 88px 64px;
}
.hearts h1 { grid-column: 1 / 3; margin-bottom: 36px; }
.hearts .lines { display: flex; flex-direction: column; gap: 22px; }
.hearts .row { display: flex; gap: 28px; align-self: center; margin-top: -40px; }
.hearts .third { position: relative; }
.hearts .third .print { position: absolute; top: calc(100% + 14px); left: -20px; right: -20px; font-weight: 600; text-align: center; }
</style>

<!--
Die riesige KI braucht viiiel Computer-Power, und heute arbeiten 200 Kinder gleichzeitig mit ihr. Damit es für alle reicht, gibt es die KI-Energie: oben im Chat seht ihr drei Herzen.
[click] Jede Nachricht an die KI kostet ein Herz. Alle 20 Sekunden wächst eins nach. Sind alle weg, wartet kurz: Das nächste kommt bestimmt.
Gleich danach schauen wir uns die zweite Anzeige daneben an, das Gedächtnis.
-->

---
layout: page
color: operators
ink: dark
---

<div class="chat">
  <h1>Jedes Mal von vorn</h1>
  <div class="me">
    <Sticker src="/scratch/dani.svg" alt="Du" :width="56" :rotate="-3" />
    <div class="name print">Du</div>
  </div>
  <div v-click="1" class="q turn1"><SpeechBubble long tail="left">Gehst du mit ins Kino?</SpeechBubble></div>
  <div v-click="2" class="a turn2"><SpeechBubble long tail="right">Ja, den <span class="nb">Dino-Film</span>!</SpeechBubble></div>
  <div v-click="3" class="q turn3"><SpeechBubble long tail="left"><mark>Mia und ich gehen in den <span class="nb">Dino-Film</span>.</mark> Gehst du mit?</SpeechBubble></div>
  <div v-click="4" class="a turn4"><SpeechBubble long tail="right">Ja, um 18 Uhr!</SpeechBubble></div>
  <div v-click="5" class="q turn5"><SpeechBubble long tail="left"><mark>Mia, Tom und ich: <span class="nb">Dino-Film</span> um 18 Uhr.</mark> Gehst du mit?</SpeechBubble></div>
  <div v-click="6" class="a turn6"><SpeechBubble long tail="right">Klar, bin dabei!</SpeechBubble></div>
  <div v-for="(f, i) in friends" :key="f.name" v-click="2 * i + 2" class="who" :class="`turn${2 * i + 2}`">
    <Sticker :src="f.src" :alt="f.name" :width="f.width" :rotate="f.rotate" />
    <div class="name print">{{ f.name }}</div>
  </div>
</div>

<script setup>
const friends = [
  // widths give all three the same height (104px)
  { name: 'Mia', src: '/scratch/avery.svg', width: 49, rotate: -4 },
  { name: 'Tom', src: '/scratch/devin.svg', width: 49, rotate: 3 },
  { name: 'Lea', src: '/scratch/abby.svg', width: 33, rotate: -3 },
];
</script>

<!--
Stell dir vor, du planst einen Kinoabend und rufst deine Freunde an, einen nach dem anderen.
Mia will den Dino-Film sehen. Dann rufst du Tom an: Er weiß nichts von deinem Gespräch mit Mia, also erzählst du es ihm noch einmal (gelb markiert). Bei Lea musst du schon alles von Mia und Tom wiederholen. Die Anrufe werden immer länger.
Bildnachweis: Dani, Avery, Devin und Abby aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0).
-->

---
layout: page
color: motion
ink: dark
---

<div class="chat ki">
  <h1>Bei der KI genauso</h1>
  <div class="me">
    <Sticker src="/scratch/dani.svg" alt="Du" :width="56" :rotate="-3" />
    <div class="name print">Du</div>
  </div>
  <div v-click="1" class="q turn1"><SpeechBubble long tail="left">Was ist die Hauptstadt von Österreich?</SpeechBubble></div>
  <div v-click="2" class="a turn2"><SpeechBubble long tail="right">Wien.</SpeechBubble></div>
  <div v-click="3" class="q turn3">
    <p class="how print">Nur die neue Frage:</p>
    <SpeechBubble long tail="left">Und von Deutschland?</SpeechBubble>
  </div>
  <div v-click="4" class="a turn4"><SpeechBubble long tail="right">Was meinst du?</SpeechBubble></div>
  <div v-click="5" class="q turn5">
    <p class="how print">Mit dem ganzen Gespräch:</p>
    <SpeechBubble long tail="left"><mark>Was ist die Hauptstadt von Österreich? Wien.</mark> <span class="nb">Und von Deutschland?</span></SpeechBubble>
  </div>
  <div v-click="6" class="a turn6"><SpeechBubble long tail="right">Berlin.</SpeechBubble></div>
  <div v-for="i in 3" :key="i" v-click="2 * i" class="who" :class="`turn${2 * i}`">
    <Sticker src="/art/chip-ki.svg" alt="KI-Chip" :width="76" :rotate="[-4, 3, -3][i - 1]" />
  </div>
</div>

<style>
/* the captions sit over the bubble, beside the answer before it */
.chat.ki .how { margin: -26px 0 4px 8px; font-weight: 600; }
</style>

<!--
Und bei der KI? Sie ist wie ein neuer Freund bei jedem Anruf: Sie merkt sich nichts.
Zuerst fragen wir nach der Hauptstadt von Österreich: Wien.
Schicken wir dann nur „Und von Deutschland?“, versteht sie nichts. Woher soll sie wissen, dass es um Hauptstädte geht?
Darum schickt die App bei jeder Frage das ganze Gespräch noch einmal mit (gelb markiert). Dann weiß die KI, was gemeint ist: Berlin.
-->

---
layout: page
color: looks
clicks: 1
---

<div class="window">
  <h1>Das Kontextfenster</h1>
  <p>Bei jeder Frage bekommt die KI das ganze Gespräch noch einmal. Aber nur so viel, wie ins Fenster passt.</p>
  <div class="row">
    <ContextWindow :messages="1" label="1. Frage" :delay="300" />
    <ContextWindow :messages="3" label="2. Frage" :delay="800" />
    <ContextWindow :messages="5" label="3. Frage" :delay="1300" />
    <span class="more" aria-hidden="true"><i></i><i></i><i></i></span>
    <div class="full">
      <ContextWindow :messages="9" label="viel später" :delay="2000" />
      <!-- mounted on the click, so the thump plays then -->
      <div v-if="$clicks >= 1" class="stamp-at"><Stamp :delay="0">voll!</Stamp></div>
    </div>
  </div>
</div>

<style>
.window {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 56px 88px 64px;
}
.window h1 { margin-bottom: 16px; }
.window p { max-width: 900px; }
.window .row { flex: 1; display: flex; align-items: center; gap: 36px; padding-top: 12px; }
.window .more { display: flex; gap: 10px; padding: 0 6px; }
.window .more i { width: 14px; height: 14px; border-radius: 50%; background: var(--fg); }
.window .full { position: relative; }
.window .stamp-at { position: absolute; right: -64px; top: 64px; }
</style>

<!--
Darum schickt die App bei jeder Frage das ganze Gespräch noch einmal mit, gelb ist das, was die KI schon einmal gehört hat. Weiß ist die neue Frage.
Das Gespräch wird immer länger. Aber die KI kann nur so viel auf einmal lesen, wie in ihr Kontextfenster passt. [click] Irgendwann ist es voll.
In unserer App seht ihr das oben im Chat als „Gedächtnis“. Ist es voll, könnt ihr „Zusammenfassen“ (die KI schreibt das Wichtigste kurz auf) oder „Neu anfangen“.
-->

---
layout: page
color: operators
ink: dark
---

<div class="exercise">
  <div class="text">
    <h1>Baut etwas Cooles!</h1>
    <p>Ihr habt eine Idee? Super, baut sie mit der KI!</p>
    <p>Noch keine Idee? Ich habe eine für euch.</p>
  </div>
  <Stairs :current="3" />
</div>

<!--
Übung 3: Jetzt seid ihr dran. Ihr habt viel Zeit, um mit der KI etwas Eigenes zu bauen. Ihr entscheidet: die Idee, den Look, die Spielregeln.
Wer noch keine Idee hat: Auf der nächsten Seite ist eine.
-->

---
layout: page
color: motion
ink: dark
clicks: 4
---

<div class="zoo">
  <h1>Fütterung im Zoo</h1>
  <p v-click="4" class="more">Punkte, Zeit, mehr Tiere? Das erfindet ihr!</p>
  <div class="stalls">
    <Slot :width="220" :height="180" label="Pferd" plate><Sticker src="/scratch/horse.svg" alt="Pferd" :width="170" :rotate="-3" /></Slot>
    <Slot :width="220" :height="180" label="Löwe" plate><Sticker src="/scratch/lion.svg" alt="Löwe" :width="190" :rotate="3" :delay="120" /></Slot>
    <Slot :width="220" :height="180" label="Affe" plate><Sticker src="/scratch/monkey.svg" alt="Affe" :width="104" :rotate="-4" :delay="240" /></Slot>
    <Slot :width="220" :height="180" label="Panda" plate><Sticker src="/art/panda.svg" alt="Panda" :width="132" :rotate="4" :delay="360" /></Slot>
  </div>
  <div v-click="3" class="says lion-says"><SpeechBubble long>Bäääh!</SpeechBubble></div>
  <div v-click="3" class="says panda-says"><SpeechBubble long :delay="300">Mmmh!</SpeechBubble></div>
  <div v-click="2" class="player">
    <Sticker src="/scratch/dani.svg" alt="Du" :width="40" :rotate="-3" />
    <div class="keys">
      <p><kbd>Pfeiltasten</kbd> laufen</p>
      <p><kbd>Leertaste</kbd> Futter nehmen und füttern</p>
    </div>
  </div>
  <div v-click="1" class="food">
    <div><Sticker src="/art/bamboo.svg" alt="Bambus" :width="62" :rotate="-6" /><span class="print">Bambus</span></div>
    <div><Sticker src="/art/hay.svg" alt="Stroh" :width="120" :rotate="4" :delay="120" /><span class="print">Stroh</span></div>
    <div><Sticker src="/scratch/bananas.svg" alt="Bananen" :width="82" :rotate="-4" :delay="240" /><span class="print">Bananen</span></div>
    <div><Sticker src="/art/steak.svg" alt="Fleisch" :width="124" :rotate="5" :delay="360" /><span class="print">Fleisch</span></div>
  </div>
</div>

<style>
.zoo { position: relative; height: 100%; }
.zoo h1 { position: absolute; top: 56px; left: 88px; }
.zoo .more { position: absolute; top: 464px; left: 88px; font-weight: 700; }
.zoo .stalls { position: absolute; top: 212px; left: 88px; right: 88px; display: flex; justify-content: space-between; }
.zoo .says { position: absolute; top: 132px; }
.zoo .lion-says { left: 470px; }
.zoo .panda-says { left: 1010px; }
.zoo .player { position: absolute; left: 88px; bottom: 40px; display: flex; align-items: flex-end; gap: 28px; }
.zoo .keys { display: flex; flex-direction: column; gap: 14px; padding-bottom: 8px; font-size: var(--size-print); font-weight: 600; }
/* paper keycaps */
.zoo kbd {
  display: inline-block;
  min-width: 150px;
  margin-right: 10px;
  padding: 8px 16px 10px;
  border-radius: 12px;
  border-bottom: 5px solid #c4c8d6;
  background: #fff;
  color: var(--ink);
  font-family: var(--font-text);
  font-weight: 700;
  text-align: center;
  box-shadow: 0 6px 12px rgb(27 19 64 / 0.22);
}
.zoo .food { position: absolute; right: 120px; bottom: 56px; display: flex; align-items: flex-end; gap: 40px; }
.zoo .food > div { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.zoo .food .print { font-weight: 600; }
</style>

<!--
Eine Idee, wenn euch keine eigene einfällt: Fütterung im Zoo. Im Stall wohnen vier Tiere: ein Pferd, ein Löwe, ein Affe und ein Panda.
[click] Daneben liegt das Futter: Bambus, Stroh, Bananen und Fleisch.
[click] Ihr seid der Tierpfleger: Mit den Pfeiltasten lauft ihr herum. Mit der Leertaste nehmt ihr Futter auf, tragt es zu einem Tier und füttert es mit der Leertaste.
[click] Passt das Futter, sagt das Tier „Mmmh!“. Wenn nicht: „Bäääh!“
[click] Und dann erfindet ihr weiter: Punkte, eine Zeit, mehr Tiere, Tiere, die hungrig werden …
Bildnachweis: Pferd, Löwe, Affe, Bananen und Dani aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0). Panda, Stroh, Fleisch und Bambus sind für diese Folien gezeichnet.
-->

---
layout: page
color: control
ink: dark
---

<div class="exercise">
  <div class="text">
    <h1>Euer eigener Chatbot</h1>
    <p>Zuerst baut ihr selbst einen, mit dem Block <span class="ki-block">frage KI <i></i></span></p>
    <p>Dann baut ihn die KI um, damit er sich das Gespräch merkt.</p>
    <p>Zum Schluss: ein Hauptstadt-Quiz!</p>
  </div>
  <Stairs :current="4" />
</div>

<!--
Übung 4: Wir bauen einen eigenen Chatbot. Ganz unten in der Block-Palette gibt es die Kategorie KI mit dem Block „frage KI“. Damit baut ihr zuerst selbst einen Chatbot: eine Frage, eine Antwort.
Dann bitten wir die KI im Chat, ihn umzubauen, damit er sich den Gesprächsverlauf merkt. Wisst ihr noch, warum? Die KI merkt sich nichts, jede Frage ist für sie ein neuer Anruf.
Zum Schluss baut ihr mit dem, was ihr gelernt habt, ein Quiz: Die KI fragt nach Hauptstädten und sagt euch, ob es stimmt.
Der Block kostet auch Herzen, genau wie der Chat.
-->

---
layout: page
color: sound
ink: dark
clicks: 3
---

<div class="memory">
  <h1>Das Gedächtnis ist eine Variable</h1>
  <p>Euer Chatbot schreibt das Gespräch in die Variable <strong>Verlauf</strong> und schickt jedes Mal alles mit.</p>
  <div class="monitor" role="img" aria-label="Die Variable Verlauf auf der Scratch-Bühne">
    <span class="name">Verlauf</span>
    <span class="value">
      <span>Ich: Was ist die Hauptstadt von Österreich?</span>
      <span v-click="1">KI: Wien.</span>
      <span v-click="2">Ich: Und von Deutschland?</span>
      <span v-click="3">KI: Berlin.</span>
    </span>
  </div>
  <p class="ask"><span class="print">An die KI geht:</span> <span class="ki-block">frage KI <b>Verlauf</b></span></p>
</div>

<style>
.memory {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  padding: 72px 88px 64px;
}
.memory > p { max-width: 900px; }
/* Scratch's variable monitor on the stage, grown to show a whole conversation */
.memory .monitor {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  align-self: flex-start;
  margin-top: 28px;
  padding: 16px 18px;
  border: 3px solid #c4c8d6;
  border-radius: 14px;
  background: #e6f0ff;
  color: #575e75;
  box-shadow: 0 14px 28px rgb(27 19 64 / 0.28);
  transform: rotate(-1deg);
}
.memory .monitor .name { padding-top: 8px; font-size: var(--size-print); font-weight: 700; }
.memory .monitor .value {
  display: flex;
  flex-direction: column;
  width: 760px;
  min-height: 196px;
  padding: 10px 20px 12px;
  border-radius: 10px;
  background: #ff8c1a;
  color: #fff;
  font-size: 30px;
  font-weight: 600;
  line-height: 1.45;
}
.memory .ask { display: flex; align-items: center; gap: 18px; margin-top: 16px; }
.memory .ask .print { font-weight: 600; }
</style>

<!--
So merkt sich euer Chatbot das Gespräch: Er hängt jede Frage und jede Antwort an die Variable Verlauf. Die könnt ihr euch auf der Bühne anzeigen lassen, Häkchen neben der Variable.
[click] Die Antwort kommt dazu. [click] Die nächste Frage. [click] Und an die KI geht jedes Mal der ganze Verlauf: genau das, was unsere App auch macht, ihr erinnert euch an die Telefonate.
Darum versteht der Chatbot jetzt auch „Und von Deutschland?“.
-->

---
layout: page
color: events
ink: dark
---

<div class="exercise">
  <div class="text">
    <h1>Echter Code</h1>
    <p>Jetzt programmiert ihr wie die Profis: mit Code, direkt im Browser.</p>
    <p>So lernen wir das auch an der HTL Leonding.</p>
    <p>Und wieder baut ihr ein kleines Spiel.</p>
  </div>
  <Stairs :current="5" />
</div>

<!--
Übung 5, für alle, die noch mehr wollen: echter Code. Statt Blöcken schreiben wir Text, so wie Profis programmieren. [TODO Rainer: Name und Link der Programmierumgebung]
Wir verwenden dieselbe Umgebung im Browser, mit der wir an der HTL Leonding arbeiten, und bauen damit ein kleines Spiel.
-->

---
layout: page
color: looks
pageNumber: false
---

<div class="bye">
  <h1>Danke fürs fleißige <span class="hl">Mitmachen!</span></h1>
  <div class="more">
    <p class="ask">Lust auf mehr?</p>
    <ul>
      <li><strong>CoderDojo Linz:</strong> <a href="https://linz.coderdojo.net" target="_blank" rel="noopener">linz.coderdojo.net</a></li>
      <li><strong>HTL Leonding:</strong> <a href="https://htl-leonding.at" target="_blank" rel="noopener">htl-leonding.at</a></li>
    </ul>
  </div>
  <div class="cat"><Sticker src="/scratch/cat.svg" alt="Scratch-Katze" :width="300" :rotate="-6" /></div>
  <SpeechBubble class="says" :delay="600">Bis bald!</SpeechBubble>
</div>

<style>
.bye {
  display: grid;
  grid-template-columns: 1fr 380px;
  grid-template-rows: 1fr auto 1fr;
  column-gap: 40px;
  height: 100%;
  padding: 72px 88px 64px;
}
.bye h1 { grid-row: 2; margin-bottom: 52px; }
.bye .hl { color: #ffd84d; } /* the cover's yellow, so the album closes as it opened */
.bye .more { grid-row: 3; align-self: start; }
.bye .ask { margin-bottom: 14px; font-family: var(--font-display); }
.bye ul { display: flex; flex-direction: column; gap: 10px; margin: 0; padding: 0; list-style: none; }
.bye a { color: inherit; text-decoration: underline 3px #ffd84d; text-underline-offset: 7px; }
.bye a:hover { color: #ffd84d; }
.bye a:focus-visible { outline: 3px solid #ffd84d; outline-offset: 4px; border-radius: 6px; }
.bye .cat { grid-column: 2; grid-row: 1 / 4; align-self: end; justify-self: center; margin-bottom: 20px; }
.bye .says { position: absolute; right: 60px; top: 138px; } /* the tail on the cat's head */
</style>

<!--
Das war's für heute! Danke, dass ihr so fleißig mitgemacht habt.
Lust auf mehr? Beim CoderDojo Linz könnt ihr weiter programmieren lernen, und an der HTL Leonding kann man Informatik zum Beruf machen. Die Links stehen hier und in der Beschreibung des Videos.
Bildnachweis: Scratch-Katze aus der Scratch-Bibliothek (Scratch Foundation, CC BY-SA 2.0).
-->
