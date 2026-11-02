# PracDraw handover

Start here. Updated 2 November 2026, at the end of release 1.2 (phases 14 and 15). The full record is `REPORT.md` (section 10 for the latest work); the plan for all future diagrams is `docs/diagram-inventory.md`.

## Where the project stands

- **What it is.** PracDraw is a single-file editor for exam-style science diagrams (`dist/index.html` after `npm run build`). Claude can also draw a diagram with no person at the editor: it writes a short JSON recipe and runs `npm run render`. The Claude skill that does this is `.claude/skills/pracdraw/`.
- **What is built.** 141 symbols and 57 templates:
  - apparatus and circuits (releases 1.0 and 1.1);
  - chemistry particle diagrams (release 1.2): atoms and ions, dot-and-cross diagrams, the periodic table, particle boxes, the reaction profile, the pH scale, the formula triangle and the hazard symbols;
  - four pilot 3D structures: the sodium chloride lattice, diamond, graphite and C60.
- **Is it working.** Yes, with one exception. On 15 October `npm run check` passed on commit `233fcc3`: 2,771 unit tests and 79 browser tests. In today's container, one touch test fails (see "Known faults"). `dist/index.html` is 616 kB (budget 900 kB). A separate reviewer has passed every picture.
- **Where the code is.** GitHub, `red-venom/miniature-engine`. There are four draft pull requests, stacked, none merged: #7 (release 1.0), #8 (release 1.1), #9 (render command, skill and inventory), #10 (release 1.2, branch `claude/pracdraw-particle-packs`). They must be merged in that order.

## Waiting for James (nothing more is built until the first item is decided)

1. **Approve the style of the 3D pictures.** Look at `docs/pilot-structures-colour.png` and `docs/pilot-structures-mono.png`. The reviewer's opinion:
   - The ionic lattice and C60 can go into a lesson as they are.
   - Diamond: the centre atom reads as a flat X, so a student could think the angles are 90°.
   - Graphite is the weakest: a flat hexagon in this view is about three times as wide as it is high.

   Options:
   - (a) Accept as is.
   - (b) Allow a steeper view for flat layers only (an exception to rule S14).
   - (c) Add a single-atom tetrahedral picture for diamond.
   - (d) Change the depth of the projection for all pictures (one number in `src/symbols/oblique.ts`).

2. **Check the nine hazard pictograms** against the official GHS artwork. They were drawn from a description.
3. **Check the periodic table** against the AQA data sheet. The masses print as whole numbers, except chlorine 35.5 and copper 63.5. The metal/non-metal staircase puts germanium on the metal side. Both come from memory and are unverified.
4. **Merge the pull requests** #7, #8, #9 and #10, in order.
5. **Older open items** (REPORT.md sections 7 and 9):
   - The manual checks.
   - How diagrams get into the lesson system. Today the route is PNG and SVG files plus the `.pracdraw.json`.
   - The AQA specification PDFs: allow `aqa.org.uk` in the environment's network settings, or send the PDFs.
   - `chemistryfigures.com`: allow the domain, or send screenshots.

## What to build next, in order

The inventory's build order (`docs/diagram-inventory.md`, "Build order"):

1. **Step 2, what is left:** flame colours (a tint parameter on `flame` and `bunsenBurner`).
2. **Step 4, the particle compound diagrams.** These are templates made of several `particleBox` parts with arrows and labels:
   - changes of state;
   - collision theory (concentration, temperature, surface area);
   - equilibrium in a closed box;
   - dilute and concentrated solutions;
   - why ionic compounds conduct;
   - strong and weak acids.

   Temperature needs one new parameter (arrow length) on `particleBox`.

3. **Step 5, molecules**, only after decision 1: displayed formulae, ball-and-stick and space-filling models, equations drawn with models. Build them on the molecule library `src/symbols/molecules.ts`.
4. **Step 6, the other structures**, only after decision 1: metallic bonding, alloys, graphene (one hexagon-net generator shared with graphite and the nanotube), silica, and the surface-area cubes.
5. **Steps 7 to 12:**
   - flow charts and plants;
   - electrochemical cells;
   - A-level physical, inorganic and organic chemistry (skeletal formulae and curly arrows need decision 2);
   - biology and physics;
   - charts, only if decision 1 of the inventory changes.

## Known faults to fix (small, lead-owned)

- **One browser test fails in the current cloud container.** `touch-drag-tile-to-canvas` (`e2e/release.spec.ts`): after two touch drags, a touch tap on the "Conical flask" tile adds nothing. It fails on commit `233fcc3` too, which passed all 79 browser tests on 15 October, so the cause is the new container's browser (Playwright 1.63 with Chromium build 1243), not a code change. Pauses before the tap do not help. Find out whether the editor's tap handling or the test must change; check on a real touch screen too. The other 78 browser tests and all 2,771 unit tests pass.

- **The contents kernel** (`src/kernel/contents.ts`):
  - A lumps layer lies on a level line, so lumps in a gently sloping tube cross its wall.
  - Bubbles spread over the whole layer.
  - The templates `reversibleHeating`, `crackingApparatus` and `groupOneWater` work round both. A fix would let them use the presets directly.
- **Flipping a symbol with text mirrors its layout.** Affected: `nuclideNotation`, `isotopeNuclei`, `ionicDotCross`, `periodicTable`. The skill says not to flip them. A no-flip flag on the symbol would need an editor change.
- **Result captions on worksheets.** The captions of `gasTests`, `rustingTubes` and `conductivityTest` state the result, and they stay on a blank worksheet copy. Make them labels, so that blank mode hides them.
- **Three old template leader blemishes** (`testTubeReactions`, `thermalDecomposition`), allow-listed in `src/model/check.test.ts`.
- **Minor overflows:**
  - `ionicDotCross` with inner shells can stand up to 11 u outside its box.
  - `bohrAtom` with four shells at its 82 u minimum draws about 102 u wide.

## How to carry on (the method that worked)

- **Setup.** Run `npm ci` once in `pracdraw/`. Then `npm run check` (typecheck, lint, format, unit tests, build, browser tests) must be green before every push.
- **Lead and authors.** A lead agent writes the catalogue rows and briefs. Authors work in parallel, each in its own git worktree, and own named files only. The lead merges one branch at a time and runs `npm run check` on the merged tree. The briefs are in `docs/process/` (`particle-author.md` and `particle-reviewer.md` for these packs; `geometry-brief.md` for a hard picture).
- **Science tests.** Every symbol exports its science as a data model. A `<pack>.science.test.ts` tests that model, and each test must be seen to fail when its code is broken on purpose.
- **Review.** A separate reviewer opens every picture (`npm run sheet <pack>`, `npm run render` recipes). Reviewers write their verdicts to a file as they go, because a container restart loses an agent's unsaved results. Allow up to three fix rounds.
- **After a pack is merged:**
  - Turn its rows in `spec/diagrams.json` into covered rows (`kind: covered`, `covered: <symbol or template id>`).
  - Run `npm run gen:inventory` and `npm run gen:skill`.
  - Never run Prettier on `.claude/`.
  - Record departures in `REPORT.md`.

## Getting the files

The zip of this project holds the whole repository at the commit named in its file name, without `node_modules` or the build. To work from it:

1. Unzip it.
2. Run `cd pracdraw && npm ci && npm run check`.
3. To build the single-file editor, run `npm run build`; it writes `dist/index.html`.

The GitHub branch is the master copy.
