---
name: Digitalferien 2026 Slides
description: Ferien-Stickeralbum. Every slide is a full-bleed album page in one Scratch block colour, every idea a die-cut sticker.
colors:
  looks: "#855cd6"
  motion: "#4c97ff"
  events: "#ffbf00"
  operators: "#59c059"
  myblocks: "#ff6680"
  sound: "#cf63cf"
  control: "#ffab19"
  ink: "#1b1340"
  paper: "#ffffff"
  cover-yellow: "#ffd84d"
  stamp-red: "#d92b57"
  scratch-text: "#575e75"
  bubble-edge: "#c4c8d6"
typography:
  display:
    fontFamily: "'Lilita One', 'Lexend Variable', sans-serif"
    fontSize: "76px"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "0.005em"
  text:
    fontFamily: "'Lexend Variable', sans-serif"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: 1.35
  print:
    fontFamily: "'Lexend Variable', sans-serif"
    fontSize: "20px"
    fontWeight: 500
    letterSpacing: "0.01em"
rounded:
  stamp: "14px"
  slot: "22px"
  photo: "26px"
  card: "28px"
  bubble: "34px"
  marker: "6px"
  message: "12px"
  badge: "50%"
spacing:
  page-x: "88px"
  page-top: "72px"
  page-bottom: "64px"
  slot-gap: "14px"
components:
  album-page:
    backgroundColor: "{colors.looks}"
    textColor: "{colors.paper}"
    typography: "{typography.text}"
  album-page-ink-dark:
    backgroundColor: "{colors.events}"
    textColor: "{colors.ink}"
  page-badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.looks}"
    typography: "{typography.print}"
    rounded: "{rounded.badge}"
    size: "56px"
  slot:
    rounded: "{rounded.slot}"
    size: "150px"
  speech-bubble:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.scratch-text}"
    typography: "{typography.display}"
    rounded: "{rounded.bubble}"
    padding: "26px 44px 30px"
  photo-sticker:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.photo}"
    padding: "14px"
  stamp:
    textColor: "{colors.stamp-red}"
    typography: "{typography.text}"
    rounded: "{rounded.stamp}"
    padding: "10px 22px 12px"
---

# Design System: Digitalferien 2026 Slides

> **Decided with Rainer (2026-10-25)**
> 1. **Four type sizes are fine:** display 76, the Haiku poem 62 (one-off), text 34, print 20.
> 2. **The yellow cover highlight stays:** "Digitalferien 2026!" in `cover-yellow`, cover only.
> 3. **No peeling corners.**
> 4. **The cover carries a small Scratch credit** at the bottom and no empty slots.

## Overview

**Creative North Star: "Das Ferien-Stickeralbum"**

The day is a sticker album the kid fills at their own pace. Each slide is one printed album page, full-bleed in a single Scratch block colour with a faint printed dot raster. Each idea is one die-cut Scratch sticker; ideas still to come are dashed, numbered empty slots. Done is a sticker, still to come is a slot: state is shown as a physical mark, never as a progress bar or a list.

Pages are sparse: one heading, at most a few short lines, one to three stickers. Rank comes from size, weight and colour, not from boxes, rules or bullets. The world refuses the white school slide with a purple title bar and bullet points.

**Key Characteristics:**
- One Scratch block colour per page, full bleed, 22px dot raster.
- Die-cut white edge that follows each sprite's own outline, soft lifted shadow, slight tilt.
- Dashed rounded slots in a light tint for what is still to come.
- Lilita One for display, Lexend for text; three sizes.
- One entry gesture: the sticker "sticks" when the page opens.

**Where the build differs from the direction contract:** not every sticker sits in a slot. Topic stickers do (pages 2, 3, 4, 7, 13); scene stickers stay loose on the page (the cover cat, the Haiku cat and mouse, the muscle arm on page 4, the chatting cat and chip on page 6, the robot on page 8, „Du“ and the friends on page 10, „Du“ and the KI chips on page 11, the KI chip beside the closing line on page 13, the running cat and the green flag on page 14). Page 4 breaks the one-to-three-stickers rule on purpose: 24 small chips fill one slot, so the size of the big model shows as a count. Name plates appear on pages 3 and 13; page 2 uses print captions. Page 8 is one big sticker beside a display-size sentence: the robot (`public/art/robot.svg`) carries the deck's chip in its head, labelled KI, and wires run from it to two yellow grippers, the tools; a pulse flows along the wires (a CSS animation inside the SVG, off under reduced motion). The key word takes the grippers' yellow. Page 9 reuses those wires as free cables (navy casing, light-blue core, the same pulse; an inline SVG under the stickers) from the KI chip (`chip-ki.svg`) to two drawn tools, a Scratch script and a code editor showing the same program. Pages 10 and 11 are a chat down the page (`.chat` in `album.css`): „Du“ (Dani from the Scratch library, print name below) stands on the left and asks, the others stand on the right and answer, one message per row, so who speaks and in what order reads top-down. Each message comes on its own click (six per page, `v-click="n"`); the speaker on the right appears with the answer. Space for hidden messages is kept, so nothing moves. Anything behind a click holds its entrance animation until revealed (the `slidev-vclick-hidden` rule in `album.css`), so the bubble pops when it appears. Put `v-click` on a wrapper `div`, never on a `SpeechBubble` or `Sticker` itself: they set their own classes when the page becomes active, which wipes the hidden class on a page Slidev rendered ahead. Chat bubbles are set at 30px instead of the 34px text size, so all six messages fit with each question on one line where it can. Page 10 tells the cinema evening on the phone: you ask, Mia answers, you ask Tom, Tom answers, and so on (Avery, Devin and Abby play Mia, Tom and Lea, 104px tall, print name below, each appearing with their answer); what you have to tell again is marked in Cover Yellow, so your questions grow call by call. Page 11 is the same chat with the KI chip on the right of every answer (no names): „Was ist die Hauptstadt von Österreich?“ gets „Wien.“; sent alone, „Und von Deutschland?“ gets „Was meinst du?“; sent with the first question and answer marked yellow, it gets „Berlin.“ Print captions over the second and third question say which is which; they sit beside the answer before them. Page 12 introduces the Kontextfenster: four `ContextWindow`s (1., 2., 3. Frage, then three dots and „viel später“), each a white window frame of fixed size with the whole chat as small blank message bars, yellow for told again, white for the new question; in the last one the chat runs out below the frame, and on a click a stamp says „voll!“ (`clicks: 1`). Page 14 kicks off the day with no h1: the running cat says "Los gehts!" in a speech bubble at display size, heading for Scratch's green flag (`green-flag.svg`). Slot numerals are set at text size, not print.

## Colors

The grounds are Scratch 3's own block-category colours, so the deck sits in the world the kids see in the editor all day.

### Primary (page grounds, one per page)
- **Looks Purple** (`looks`): the cover, page 8 (agents use tools), page 12 (the Kontextfenster) and the default ground; also the editor's menu bar. White ink.
- **Motion Blue** (`motion`): page 2, how the day works; page 9, the coding tool; page 11, asking the KI. Dark ink.
- **Events Yellow** (`events`): page 3, "Was ist KI?"; page 14, "Los gehts!", the colour of Scratch's "Wenn ⚑ angeklickt wird" block. Dark ink.
- **Control Orange** (`control`): page 4, small and huge AI models; page 13, what the kids bring. Dark ink.
- **Sound Magenta** (`sound`): page 5, the Haiku. Dark ink.
- **Operators Green** (`operators`): page 6, Chatbot; page 10, the phone calls. Dark ink.
- **My-Blocks Pink** (`myblocks`): page 7, KI-Agent. Dark ink.

### Neutral
- **Album Ink** (`ink`): deep navy-purple close to Scratch's outline navy. Text on every light ground (`ink: dark`), the page badge on dark-ink pages, the Haiku card text.
- **Sticker White** (`paper`): text on Looks Purple, the die-cut edge, the photo-sticker frame, the Haiku card, the speech bubble.
- **Scratch Stage Grey** (`scratch-text`) and **Bubble Edge** (`bubble-edge`): only inside the speech bubble, copied from Scratch's stage "sagen" bubble.

### Accents
- **Cover Yellow** (`cover-yellow`): the event name on the cover, the key word „Tools“ on page 8, and the marker for „told again“ on pages 10, 11 and 12 (`mark` in `album.css`) (a marker stroke behind words, the fill of repeated message bars).
- **Stamp Red** (`stamp-red`): the rubber stamp's ink, on its white paper label.

### Named Rules
**The One Block Colour Rule.** A page has exactly one ground, chosen from the Scratch block colours. No gradients, no second ground colour, no white slides.

**The Ink Follows The Ground Rule.** Looks Purple takes white ink; every lighter ground (motion, events, operators, myblocks, sound, control) takes `ink: dark`. All chrome (dot raster, slot outlines, slot numbers, page badge) derives from the current ink, never from a hard-coded colour.

## Typography

**Display Font:** Lilita One (fallback Lexend Variable, sans-serif)
**Body Font:** Lexend Variable (sans-serif)

**Character:** a chunky, rounded sticker-lettering display face against a calm, very legible text face built for reading support. Both loaded locally via Fontsource.

### Hierarchy
- **Display** (400, 76px, 1.02, balanced wrap): one heading per page, the speech bubble's words (short ones).
- **Text** (400, 34px, 1.35; strong is 700): the few lines a page carries, name plates under slots (700), slot numerals and stamp text (in the display face).
- **Print** (500, 20px): album chrome only: page-badge number, slot captions (600), counts, the missing-video note. The cover's Scratch credit is the one smaller line (16px, 400).

### Named Rules
**The Three Sizes Rule.** New content uses display, text or print, nothing else. Rank within a size comes from weight and colour. (The Haiku's 62px poem is the one approved exception.)

## Layout

A fixed 1280x720 Slidev canvas (`canvasWidth: 1280`, 16:9), `slide-left` transition between pages. No responsive behaviour: the deck is recorded as video.

Each page's content is a single root block with its own scoped grid or flex, filling the page height with margins of `page-x` left and right, `page-top` above and `page-bottom` below (the cover uses 88/88/40). Headings sit top-left or left column; stickers and slots take the right or lower part. Loose scenes (the Haiku, the chat on page 6, the tools on page 9, "Los gehts!" on page 14) position stickers absolutely on the page.

Difficulty is shown as one climbing staircase of slots (page 2): each step rises 44px.

### Adding a page
1. Frontmatter: `layout: page`, `color:` one of `looks | motion | events | operators | myblocks | sound | control`, and `ink: dark` on every ground except looks. Set `pageNumber: false` only on the cover.
2. One `<h1>` (display) at most, then a few `<p>` lines at text size. No bullets.
3. The idea is a `<Sticker>` (own art in `public/art/`, Scratch library sprites in `public/scratch/`), inside a `<Slot>` when it is a topic of the day. Give each sticker a small tilt (between -10 and 10 deg) and stagger `delay` by about 150ms for a second or third sticker.
4. Use page margins from the spacing tokens; keep layout CSS in the page's own scoped `<style>`.
5. Put the narration and the image credit for Scratch library art (Scratch Foundation, CC BY-SA 2.0) in the presenter-note comment.
6. Pick a ground not used by the neighbouring page.

## Elevation & Depth

Depth is physical: paper objects lying on a printed page. Everything that sits on the page casts one soft, ink-tinted shadow; the page itself is flat. No hard offset shadows.

### Shadow Vocabulary
- **Sticker rest** (`drop-shadow(0 10px 14px rgb(27 19 64 / 0.28))`): every die-cut sticker; follows the outline.
- **Sticker lifted** (`drop-shadow(0 30px 30px rgb(27 19 64 / 0.2))`): the start frame of the stick animation.
- **Bubble** (`drop-shadow(0 10px 14px rgb(27 19 64 / 0.22))`): the speech bubble.
- **Card / photo** (`box-shadow: 0 14px 28px rgb(27 19 64 / 0.28–0.3)`): rectangular paper (Haiku card, photo sticker).

### Named Rules
**The Ink-Tinted Shadow Rule.** Shadows are always tinted with the album ink (`rgb(27 19 64 / …)`), never neutral black.

## Shapes

Everything is rounded and soft. Die-cut stickers have no box at all: their white edge follows the sprite's outline and grows with the sticker (max(2, round(width x 0.025)) px). Rectangular paper has generous radii (stamp 14px, slot 22px, photo 26px, card 28px, bubble 34px); the page badge is a circle. Two small shapes sit inside paper: the marker stroke (6px) and the context window's message bars (12px, the corner toward the speaker 4px). Dashed borders belong to slots only; the stamp alone has a doubled solid border.

## Components

### Album page (`layouts/page.vue`)
Full-bleed ground from `color`, ink from `ink`, text size and Lexend by default, a 22px dot raster in 14% of the current ink. Bottom-right page badge: 56px circle in the ink colour with the ground colour as numeral, print size, 40px from the right and 28px from the bottom.

### Sticker (signature)
A die-cut picture: SVG `feMorphology` dilate on the alpha gives the even white edge, its own filter per instance so it also renders in overview and export. Props `src`, `alt`, `width`, `rotate`, `delay`. Rest shadow, tilt from `rotate`, transform origin 50% 60%.

### Slot
The empty place for a sticker: 4px dashed outline in 55% ink, radius 22px, fill 18% white, numeral centred in the display face at text size, 75% ink. Filled when a `Sticker` or `StickerVideo` is placed inside. `label` adds a print caption (600) 14px below; `plate` turns it into a name plate at text size (700). Square by `size` or sized by `width`/`height`.

### Photo sticker (`StickerVideo`)
A looping, muted 16:9 video in a 14px white frame with radius 26px (video radius 14px), slight tilt. Plays only while its page is open and restarts on entry; a print-size fallback note if the file is missing.

### Speech bubble
Scratch's stage "sagen" bubble: white, 4px edge in bubble grey, radius 34px, tail at the lower left, words in the display face at display size in Scratch's text grey. `long` is for a whole sentence: Lexend 600 at text size, wrapping, radius 28px (page 4). `tail="left"`/`"right"` makes a chat bubble: a short side tail at the lower corner pointing at the speaker, and tighter padding (14px 26px 16px), so a whole conversation fits on one page (page 6: the cat's bubbles left, the chip's right, popping in one after another about 900ms apart; each speaker sits beside their first bubble).

### Stamp
A rubber stamp on a white paper label: display face at text size in stamp red, 5px border plus a 2px outline 4px outside it, radius 14px, rotated -12deg, an 8px white margin and a soft ink-tinted shadow so it reads over any ground. Used on the Haiku and on the full Kontextfenster („voll!“).

### Context window (`ContextWindow`)
What the AI gets for one question: an 8px white frame, radius 22px, 270px tall, the ground showing through, with the chat so far as blank message bars (kid left, AI right). Props `messages` (count), `label` (print caption above), `delay`. Everything but the newest message is Cover Yellow (told again); messages that don't fit run out below the frame.

### Motion grammar
One easing for everything: `ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`). Each element plays once when its page becomes active:
- **Stick** (700ms): sticker drops from 26px higher, scaled 1.08 and rotated 7deg further, while its shadow tightens from lifted to rest. The photo sticker uses 1.04 and 4deg.
- **Pop** (520ms): the speech bubble scales from 0.6 out of its tail corner, after the sticker (delay 450ms).
- **Thump** (380ms): the stamp lands from scale 1.35 after the stickers (default delay 600ms).
- **Lay** (700ms): a context window drops in like the stick, without the die-cut shadow change.
Order on a page: stickers first (staggered by ~150ms), then bubble or stamp. All animation is off under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** give every page exactly one Scratch block-colour ground and set `ink: dark` on every ground except looks.
- **Do** show what is still to come as a dashed numbered slot and what is there as a sticker in it.
- **Do** use only the display, text and print sizes for new content.
- **Do** tilt every sticker slightly and let it stick on entry with the shared easing.
- **Do** use Scratch library sprites or own drawings in Scratch clipart style, credited in the presenter notes.

### Don't:
- **Don't** use white slides, title bars or bullet lists.
- **Don't** put a second ground colour, gradient or neutral-black shadow on a page.
- **Don't** use dashed borders for anything but slots.
- **Don't** add looping or fast motion beyond the one entry gesture per element; the only loops are the agent video and the wire pulse on pages 8 and 9.
