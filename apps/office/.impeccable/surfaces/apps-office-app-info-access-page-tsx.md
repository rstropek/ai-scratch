---
version: 1
slug: "apps-office-app-info-access-page-tsx"
primary_target: "apps/office/app/(info)/access/page.tsx"
related_targets: []
---

# Surface: /access (So funktionieren Zugang und Schlüssel)

Mode: Read. Public, static info page in the office's `(info)` group, German, Sie.
Audience: teachers and parents first; donors and technically curious readers in a separate technical part.
Job: understand who creates what (donors, Rainer, adults, kids), which limits apply (with numbers), why it is secure.
Constraints: describe the target system with no status markers (Rainer, 2026-11-01); numbers from `lib/rules.ts`;
Scratch office tokens only (`app/globals.css`), components in `components/ui/`.

## Direction contract

THESIS: the page is a map you walk: one diagram of the whole system, lit one step at a time. Refuses the default of a wall of FAQ text with a static flow image.
OWN-WORLD: Scratch 3 office: purple top bar, blue ground, white panels, Scratch purple for the active path, state colours for limits (warning ink) and safety (success ink); Helvetica, 15px body.
STORY: the reader steps from the donor's credit to the kid's answer, sees at each step who acts, what is created and what limit holds, then finds the full tables and the technical part below.
FIRST VIEWPORT: page title and a two-line answer; a panel with the step rail (numbered pills, current filled). From tablets up the hand-placed diagram sits left, lighting the current step's nodes and edges, with the step's title, actor and text beside it (limits, safety), so Weiter never changes a diagram out of view; on phones the order is title, diagram, text. The text cell keeps the longest step's height; Zurück/Weiter sit in a sticky bar at the panel's foot.
FORM: user-pinned stepper diagram (the roll's lead, a sticky diagram with text, came closest); seed:afd14e2eb8dc5e25.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
