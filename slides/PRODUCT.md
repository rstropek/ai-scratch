# Product

<!-- impeccable:product-schema 1 -->

Scope: the slide deck in `slides/` only. The KI-Scratch app itself is described in the repo's README.md and AGENTS.md.

## Platform

web

## Stack

Slidev (https://sli.dev), as a completely independent Node app in `slides/` with its own package.json; how far it shares code or assets with the app is delegated. Rainer presents and records from `npm run dev` locally. `npm run build` also bakes the deck into the app's Docker image, which serves it at `/slides/` (ai-scratch.azurewebsites.net/slides).

## Users

Kids aged 10–16 at the Digiferien workshop (about 200 kids at 10 Austrian schools), coding beginners who know a little Scratch. They do not see the deck live: Rainer records it into the video tutorial they watch at their own pace on a school laptop, with adults in the room but no live trainer. Rainer narrates over the slides.

## Product Purpose

Accompany the video tutorial: welcome the kids, explain how the day works, and give Rainer visual anchors while he explains AI, LLMs, chat bots and AI agents, and later the exercises. Success: a kid watching on a laptop understands each idea from the slide plus Rainer's voice, and feels invited to play rather than lectured.

## Positioning

The deck lives in the same world as the app the kids use all day: the Scratch 3 editor with its colors and clipart, and the AI helper beside it. Ideas are shown as Scratch-style characters and objects, not as tech diagrams.

## Operating Context

- Recorded as a screen capture into the tutorial video (16:9), watched on laptop screens, possibly paused.
- Slides carry little text; Rainer's narration carries the explanation.
- The day: single exercises that get harder step by step; nobody has to do them all; each group spends as long as it likes on one (some draw sprites for an hour, others want to code); whoever finishes early builds something of their own with what they learned.
- More slides (exercises) will be added over the coming hours and days.

## Capabilities and Constraints

- All kid-facing text is German, age-appropriate, short. Code and comments in English.
- Scratch library art (sprites, backdrops; CC BY-SA 2.0 by the Scratch Team) may be reused, with credit.
- The "KI Agent" slide plays a looping video (`public/videos/ki-agent-loop.mp4`, 6 s).
- Wording of the slides Rainer gave is a starting point and may be improved.

## Brand Commitments

- Event name: "Digitalferien 2026" (the repo calls it Digiferien).
- Binding visual constraint from Rainer: playful and colorful, aligned with the Scratch app's colors; illustrations in Scratch clipart style.

## Evidence on Hand

- The app's palette mirrors Scratch 3 (`src/client/index.css`): menu-bar purple #855cd6, motion blue #4c97ff, control orange #ffab19, heart red #e6335f, text #575e75, panel ground #e9f1fc.
- Scratch library assets are reachable via the `@scratch/scratch-gui` package and the Scratch asset CDN.
- No photos, testimonials or numbers about the event exist; none may be invented.

## Product Principles

- One idea per slide; the picture explains, the narration adds the words.
- Speak like a friendly tutor to a 10-year-old, without talking down to a 16-year-old.
- Invite, don't pressure: "you don't have to do everything" is a core message.
- Stay inside the Scratch world the kids already know.

## Accessibility & Inclusion

Readable on a laptop screen inside a video: large type, high contrast, no meaning carried by color alone, no fast flashing motion.
