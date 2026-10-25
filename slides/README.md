# Digitalferien 2026: Folien

The slides Rainer records into the video tutorial. A standalone [Slidev](https://sli.dev) app; it shares no code
with the KI-Scratch app, only the Scratch colours (copied into `styles/album.css`).

```bash
cd slides
npm install
npm run dev      # http://localhost:3030, presenter view at /presenter
npm run export   # PDF (needs playwright-chromium)
npm run build    # into ../dist/slides; the app serves it at /slides/ (ai-scratch.azurewebsites.net/slides)
```

Picture and video paths in `slides.md` start at `public/` (`/art/robot.svg`); components pass them through
`publicUrl()` so they also work under `/slides/`.

## How the deck is built

The look is a **sticker album** (direction and reasoning: `.impeccable/surfaces/slides-md.md`, product facts:
`PRODUCT.md`):

- every slide is an album page in one Scratch block colour: `layout: page` with `color:` one of `looks`, `motion`,
  `events`, `operators`, `myblocks`, `sound`, `control`, and `ink: dark` on the light grounds (yellow, green,
  pink, blue) so the text keeps its contrast;
- pictures are stickers: `<Sticker src alt width rotate delay />` (white die-cut edge, pressed on when the slide
  opens); empty slots are `<Slot number size label />`, a `Slot` with a `Sticker` inside is a filled one;
- `<SpeechBubble>` is Scratch's own "sagen" bubble (`long` for a whole sentence at text size; `tail="left"`/`"right"` for chat bubbles); `<StickerVideo src />` plays a looping video only while its
  slide is open;
- two text sizes only: `h1` (display) and body text; `.print` is for small captions.

Adding a slide: copy one of the existing ones in `slides.md`, change `color:`, keep one idea per page.

## Pictures and video

- `public/scratch/`: sprites from the Scratch library (Scratch Foundation, CC BY-SA 2.0). The Scratch Cat is a
  Scratch Foundation trademark. The cover carries the credit; repeat it in the video description.
- `public/art/`: brain, chip (also labelled KI), muscle arm, agent robot, lightbulb, palette, dice, green flag, and the drawn Scratch script and code editor, all made for this deck in Scratch costume style. The script and editor use system fonts.
- `public/videos/ki-agent-loop.mp4`: the KI-Agent loop (6 s).

If an edit in `slides.md` does not show up in the browser, restart `npm run dev`; Slidev's file watcher
occasionally misses a change to the last slide.
