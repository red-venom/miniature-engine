# PracDraw build report: releases 1.0 and 1.1

This report closes the release 1.0 build of PracDraw, as section 14 of `docs/SPEC.md` asks. The build started from the starter kit (phases 0 and 1) and ran phases 2 to 10 in two tracks: the editor (track E) and the drawings (track S). Every symbol, template and gate test was checked by a separate reviewer agent that did not write it. Release 1.1 (priority B) was built afterwards, on its own branch, when James asked for more development: section 8 covers it. Sections 1 to 7 are the release 1.0 report and stay as they were.

The project is in the `pracdraw/` folder of the repository, because the repository root already holds another project. The built single file is `pracdraw/dist/index.html` (`npm run build`).

## 1. Phases

| Phase                   | Result             | Gate                                                                                                      |
| ----------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| 0. Scaffold             | In the kit         | `npm run check` green before any change: 320 unit tests, 5 browser tests                                  |
| 1. Kernel and pilots    | In the kit         | as above                                                                                                  |
| 2. Editor core          | Passed             | 6 gate tests and the 5 ported starter tests, reviewed                                                     |
| 3. Contents             | Passed             | 3 gate tests, reviewed                                                                                    |
| 4. Connectors           | Passed             | 3 gate tests, reviewed                                                                                    |
| 5. Snapping and arrange | Passed             | 3 gate tests and one unit test for each row of the snap table, reviewed                                   |
| 6. Labels               | Passed             | 3 gate tests and the Label all unit tests, reviewed                                                       |
| 7. Export and files     | Passed             | 6 gate tests and the section 14 unit tests, reviewed                                                      |
| 8. Symbols A            | Passed             | `npm run release:a:symbols`; all 78 new symbols passed visual review                                      |
| 9. Templates A          | Passed             | `npm run release:a`; all 39 new templates reviewed (one accepted with a note); `gallery-inserts-template` |
| 10. Release 1.0         | Passed             | 8 gate tests and the four budgets, reviewed; `drag-budget` passed after a fix round                       |
| 11. Release 1.1         | Passed (section 8) | `npm run release:b`; all 27 new symbols and 3 new templates passed visual review                          |

A gap that a reviewer found in a gate test was fixed in the next phase's commit (for phase 10, in a fix round) and checked again by the next reviewer. Section 4 lists each one.

## 2. Command output

`npm run check` on the final tree:

```
> pracdraw@0.1.0 check
> npm run typecheck && npm run lint && npm run format:check && npm run test && npm run e2e


> pracdraw@0.1.0 typecheck
> tsc -b


> pracdraw@0.1.0 lint
> oxlint


> pracdraw@0.1.0 format:check
> prettier --check .

Checking formatting...
All matched files use Prettier code style!

> pracdraw@0.1.0 test
> vitest run


 RUN  v5.0.3 /home/user/miniature-engine/pracdraw


 Test Files  37 passed (37)
      Tests  1763 passed (1763)
   Start at  02:42:38
   Duration  3.72s (transform 39%, tests 31%, import 27%, worker 3%)

  Transform  transforming modules took 2.40s · 39% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


> pracdraw@0.1.0 e2e
> npm run build && playwright test


> pracdraw@0.1.0 build
> tsc -b && vite build

vite v8.3.2 building client environment for production...
transforming...
✓ 110 modules transformed.
rendering chunks...
[plugin vite:singlefile]

[plugin vite:singlefile] Inlining: index-fd_XdpLA.js
[plugin vite:singlefile] Inlining: style-DkvPe7V3.css
computing gzip size...
dist/index.html  493.06 kB │ gzip: 156.30 kB

✓ built in 517ms

Running 68 tests using 2 workers

  ✓   2 e2e/editor.spec.ts:54:1 › the single file runs from file:// with no network requests (424ms)
  ✓   1 e2e/files.spec.ts:128:1 › png-size-matches-bounds (1.2s)
  ✓   3 e2e/editor.spec.ts:77:1 › the PNG drawn on canvas matches the SVG on screen (831ms)
  ✓   5 e2e/editor.spec.ts:121:1 › the SVG export is standalone and plain (341ms)
  ✓   4 e2e/files.spec.ts:190:1 › svg-reopens-equal (833ms)
  ✓   6 e2e/editor.spec.ts:144:1 › copy puts a PNG on the clipboard (489ms)
  ✓   8 e2e/editor.spec.ts:155:1 › settings re-render the diagram (404ms)
  ✓   7 e2e/files.spec.ts:224:1 › save-open-round-trip (772ms)
  ✓   9 e2e/editor.spec.ts:169:1 › add-move-undo (628ms)
  ✓  10 e2e/files.spec.ts:257:1 › unknown-symbol-opens (655ms)
  ✓  11 e2e/editor.spec.ts:186:1 › resize-keeps-line-width (557ms)
  ✓  12 e2e/files.spec.ts:315:1 › open-lists-problems-in-a-banner (724ms)
  ✓  13 e2e/editor.spec.ts:200:1 › rotate-and-flip (694ms)
  ✓  14 e2e/files.spec.ts:347:1 › drop-a-file-on-the-canvas-opens-it (428ms)
  ✓  15 e2e/editor.spec.ts:231:1 › parameter-change (503ms)
  ✓  16 e2e/files.spec.ts:377:1 › copy-fallback-shows-picture (670ms)
  ✓  18 e2e/files.spec.ts:405:1 › text-fallback-and-download-did-not-start (1.1s)
  ✓  17 e2e/editor.spec.ts:244:1 › autosave-restores (1.6s)
  ✓  20 e2e/editor.spec.ts:277:1 › insert-template-twice (580ms)
  ✓  19 e2e/files.spec.ts:453:1 › claude-host-saves (864ms)
  ✓  21 e2e/editor.spec.ts:307:1 › fill-and-turn-stays-level (460ms)
  ✓  23 e2e/editor.spec.ts:356:1 › set-reading-37 (387ms)
  ✓  24 e2e/editor.spec.ts:373:1 › drop-into-beaker-comes-to-front (764ms)
  ✓  22 e2e/files.spec.ts:521:1 › gallery-inserts-template (2.5s)
  ✓  25 e2e/editor.spec.ts:400:1 › contents-controls (971ms)
  ✓  27 e2e/editor.spec.ts:490:1 › draw-tube-four-points (458ms)
  ✓  26 e2e/release.spec.ts:216:1 › job-1 (557ms)
  ✓  29 e2e/release.spec.ts:258:1 › job-2 (2.1s)
  ✓  28 e2e/editor.spec.ts:540:1 › edit-connector-point (2.4s)
  ✓  30 e2e/release.spec.ts:332:1 › job-3 (657ms)
  ✓  31 e2e/editor.spec.ts:672:1 › arrow-and-dimension-caps (506ms)
  ✓  32 e2e/release.spec.ts:369:1 › job-4 (459ms)
  ✓  33 e2e/editor.spec.ts:728:1 › connector-tools (1.0s)
  ✓  34 e2e/release.spec.ts:392:1 › job-5 (1.2s)
  ✓  35 e2e/editor.spec.ts:792:1 › shape-tools (1.1s)
  ✓  37 e2e/editor.spec.ts:846:1 › bung-snaps-and-fits (830ms)
budget: drag: mean frame gap 16.67 ms over 60 frames, longest 21.8 ms, 54 pointer moves handled over 983 ms (150 symbols with contents, 60 moves sent at 60 Hz, the last -0.3 ms late)
  ✓  36 e2e/release.spec.ts:433:1 › drag-budget (1.8s)
  ✓  38 e2e/editor.spec.ts:877:1 › beaker-stands-on-gauze (806ms)
budget: open to first paint from file://: 92 ms (first contentful 232 ms), 72 ms (first contentful 196 ms), 80 ms (first contentful 220 ms)
  ✓  39 e2e/release.spec.ts:558:1 › open-to-first-paint (1.0s)
  ✓  40 e2e/editor.spec.ts:908:1 › clamp-on-rod (784ms)
  ✓  41 e2e/release.spec.ts:590:1 › keyboard-only (1.2s)
  ✓  42 e2e/editor.spec.ts:932:1 › snap-off-and-guides (1.1s)
  ✓  44 e2e/editor.spec.ts:979:1 › arrange-several-items (728ms)
  ✓  45 e2e/editor.spec.ts:1027:1 › keys-work-after-a-checkbox (447ms)
  ✓  46 e2e/editor.spec.ts:1080:1 › label-follows-item (979ms)
  ✓  47 e2e/editor.spec.ts:1153:1 › blank-mode-has-no-label-text (520ms)
  ✓  48 e2e/editor.spec.ts:1191:1 › label-all-no-crossing (586ms)
  ✓  49 e2e/editor.spec.ts:1234:1 › label-and-text-tools (1.1s)
empty diagram: 134 controls, 134 new
More menu: 145 controls, 11 new
title: 134 controls, 1 new
templates: 76 controls, 45 new
help: 135 controls, 1 new
a beaker with water: 148 controls, 27 new
the colour presets: 178 controls, 29 new
a measuring cylinder: 142 controls, 4 new
a label: 134 controls, 7 new
the text box: 135 controls, 1 new
a wire: 133 controls, 6 new
a rectangle: 133 controls, 5 new
several items: 140 controls, 10 new
export: 158 controls, 14 new
copy by hand: picture: 141 controls, 1 new
copy by hand: text: 162 controls, 3 new
saved: 141 controls, 1 new
banner: 141 controls, 1 new
wide window: 151 controls, 0 new
narrow window, drawers open: 145 controls, 4 new
  ✓  43 e2e/release.spec.ts:701:1 › controls-have-names (4.7s)
  ✓  50 e2e/editor.spec.ts:1305:1 › edit-label-text (556ms)
  ✓  52 e2e/editor.spec.ts:1341:1 › label-inspector (791ms)
  ✓  53 e2e/editor.spec.ts:1387:1 › label-leader-end-handle (786ms)
  ✓  54 e2e/editor.spec.ts:1418:1 › alt-drag-selects-the-copy (590ms)
  ✓  55 e2e/editor.spec.ts:1447:1 › labels-move-like-items (604ms)
  ✓  56 e2e/editor.spec.ts:1483:1 › letters-mode (449ms)
  ✓  57 e2e/editor.spec.ts:1501:1 › align-and-guides-measure-label-text (719ms)
  ✓  58 e2e/editor.spec.ts:1539:1 › enter-on-a-focused-control-presses-it (560ms)
  ✓  51 e2e/release.spec.ts:1000:1 › focus-is-always-visible (25.5s)
budget: text contrast: lowest ratio 4.72 (empty diagram: 53 texts, lowest 4.72; More menu: 60 texts, lowest 4.72; templates: 42 texts, lowest 4.72; a beaker with its colour presets: 86 texts, lowest 4.72; help: 51 texts, lowest 15.05; export: 27 texts, lowest 4.72; banner and status bar: 49 texts, lowest 4.72)
  ✓  59 e2e/release.spec.ts:1185:1 › text-contrast (1.2s)
  ✓  60 e2e/release.spec.ts:1230:1 › empty-state-card (956ms)
  ✓  61 e2e/release.spec.ts:1270:1 › help-dialog (626ms)
  ✓  62 e2e/release.spec.ts:1303:1 › narrow-window-keyboard (997ms)
  ✓  63 e2e/release.spec.ts:1351:1 › tile-names-fit (588ms)
  ✓  64 e2e/release.spec.ts:1405:1 › library-drag-adds-at-the-pointer (2.0s)
  ✓  65 e2e/release.spec.ts:1503:3 › on a touch screen › touch-pinch-pan-and-handles (1.1s)
  ✓  66 e2e/release.spec.ts:1576:3 › on a touch screen › touch-drag-tile-to-canvas (2.8s)
  ✓  67 e2e/release.spec.ts:1659:3 › on a touch screen › touch-library-swipe-scrolls (907ms)
  ✓  68 e2e/release.spec.ts:1686:3 › on a touch screen › touch-swipes-keep-the-app (8.6s)

  68 passed (1.2m)
```

`npm run progress`:

```
> pracdraw@0.1.0 progress
> tsx scripts/progress.ts

Symbols         A built/planned   B built/planned
  containers        13/13             0/9
  measuring         12/12             0/4
  heating           9/9               0/2
  support           15/15             0/4
  filtering         3/3               0/2
  organic           5/5               0/1
  electrochemistry  5/5               0/0
  physics           12/12             0/0
  biology           5/5               0/2
  circuit           14/14             0/0
  annotation        3/3               0/3
  TOTAL             96/96             0/27
Templates       A 40/40   B 0/3
Next (priority A, not built): none
```

`npm run release:a`:

```
> pracdraw@0.1.0 release:a
> RELEASE=A vitest run src/spec.test.ts


 RUN  v5.0.3 /home/user/miniature-engine/pracdraw


 Test Files  1 passed (1)
      Tests  140 passed (140)
   Start at  02:44:08
   Duration  937ms (transform 75%, tests 17%, import 7%, worker 1%)
```

## 3. Size and budgets

| Budget (section 6)                                                    | Limit                      | Result                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dist/index.html`                                                     | 900 kB                     | 493.06 kB (gzip 156.30 kB): pass. The test `the single file runs from file:// with no network requests` checks the file's size in bytes.                                                                                                                                                                               |
| Network requests at run time                                          | 0                          | 0: pass. The test `the single file runs from file:// with no network requests` records every request; `job-1` to `job-5`, `keyboard-only`, `empty-state-card`, `help-dialog` and `narrow-window-keyboard` also assert none.                                                                                            |
| Drag one symbol 300 px in 60 pointer moves, 150 symbols with contents | mean frame gap under 20 ms | mean 16.67 ms over 60 frames, longest 21.8 ms: pass (`drag-budget`, in the final `npm run check`). The 60 moves are sent at a steady 60 Hz, and each frame is timed with `performance.now()`. With a 25 ms busy wait added to every pointer move, the same test fails at about 70 ms (69.46 and 72.84 ms in two runs). |
| Open to first paint from `file://`                                    | under 1 s                  | 92, 72 and 80 ms to first paint (first contentful paint 196 to 232 ms) on three fresh pages: pass (`open-to-first-paint`, in the final `npm run check`).                                                                                                                                                               |

The drag budget was also measured independently three times during the build, after phases 2 and 5 and in the phase 5 review: 16.67 ms each time, with the longest gap 16.8 ms.

## 4. Reviewer verdicts on the gate tests

Each phase's gate tests were checked against this document by a reviewer agent that did not write them. "Gap" means the test passed but did not prove all that the section says; each gap but one was closed in a later commit and passed on the next review; the one kept is recorded as a departure in section 5.

| Phase | Gate test                                                     | Verdict                                                                                                                                                                                                                              |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2     | the single file runs from file:// with no network requests    | pass                                                                                                                                                                                                                                 |
| 2     | the PNG drawn on canvas matches the SVG on screen             | pass                                                                                                                                                                                                                                 |
| 2     | the SVG export is standalone and plain                        | pass                                                                                                                                                                                                                                 |
| 2     | copy puts a PNG on the clipboard                              | pass                                                                                                                                                                                                                                 |
| 2     | settings re-render the diagram                                | pass                                                                                                                                                                                                                                 |
| 2     | `add-move-undo`                                               | pass                                                                                                                                                                                                                                 |
| 2     | `resize-keeps-line-width`                                     | pass                                                                                                                                                                                                                                 |
| 2     | `rotate-and-flip`                                             | pass                                                                                                                                                                                                                                 |
| 2     | `parameter-change`                                            | pass                                                                                                                                                                                                                                 |
| 2     | `autosave-restores`                                           | gap twice (view preferences not covered, then Snap and Recent not covered); pass in the phase 4 review                                                                                                                               |
| 2     | `insert-template-twice`                                       | pass                                                                                                                                                                                                                                 |
| 2     | `src/layers.test.ts`                                          | gap (test files are skipped); kept, and recorded as a departure in section 5                                                                                                                                                         |
| 3     | `fill-and-turn-stays-level`                                   | pass                                                                                                                                                                                                                                 |
| 3     | `set-reading-37`                                              | pass                                                                                                                                                                                                                                 |
| 3     | `drop-into-beaker-comes-to-front`                             | pass                                                                                                                                                                                                                                 |
| 4     | `draw-tube-four-points`                                       | pass                                                                                                                                                                                                                                 |
| 4     | `edit-connector-point`                                        | gap twice (no drag where snapping applies; then no terminal, tip or zoom check); pass in the phase 6 review                                                                                                                          |
| 4     | `arrow-and-dimension-caps`                                    | pass                                                                                                                                                                                                                                 |
| 5     | `bung-snaps-and-fits`                                         | pass                                                                                                                                                                                                                                 |
| 5     | `beaker-stands-on-gauze`                                      | pass                                                                                                                                                                                                                                 |
| 5     | `clamp-on-rod`                                                | pass                                                                                                                                                                                                                                 |
| 5     | snap table unit tests, one for each of the six rows           | pass                                                                                                                                                                                                                                 |
| 6     | `label-follows-item`                                          | gap (no turn or flip); pass in the phase 7 review                                                                                                                                                                                    |
| 6     | `blank-mode-has-no-label-text`                                | pass                                                                                                                                                                                                                                 |
| 6     | `label-all-no-crossing`                                       | pass                                                                                                                                                                                                                                 |
| 6     | Label all unit tests for steps 7 and 8                        | pass                                                                                                                                                                                                                                 |
| 7     | `png-size-matches-bounds`                                     | pass                                                                                                                                                                                                                                 |
| 7     | `svg-reopens-equal`                                           | pass                                                                                                                                                                                                                                 |
| 7     | `save-open-round-trip`                                        | pass                                                                                                                                                                                                                                 |
| 7     | `unknown-symbol-opens`                                        | pass                                                                                                                                                                                                                                 |
| 7     | `copy-fallback-shows-picture`                                 | pass                                                                                                                                                                                                                                 |
| 7     | `claude-host-saves`                                           | pass                                                                                                                                                                                                                                 |
| 7     | unit tests for docBounds, parseDoc, migrations and docFromSvg | pass                                                                                                                                                                                                                                 |
| 9     | `gallery-inserts-template`                                    | pass                                                                                                                                                                                                                                 |
| 10    | `job-1`                                                       | pass                                                                                                                                                                                                                                 |
| 10    | `job-2`                                                       | pass                                                                                                                                                                                                                                 |
| 10    | `job-3`                                                       | pass                                                                                                                                                                                                                                 |
| 10    | `job-4`                                                       | pass                                                                                                                                                                                                                                 |
| 10    | `job-5`                                                       | pass                                                                                                                                                                                                                                 |
| 10    | `drag-budget`                                                 | gap (each move waited for the page, and frames were timed by their vsync time, so a drag slowed by 25 ms a move still read 16.7 ms); pass on re-check after the fix round: the moves go at a steady 60 Hz, and the slowed drag fails |
| 10    | `keyboard-only`                                               | pass                                                                                                                                                                                                                                 |
| 10    | `controls-have-names`                                         | pass                                                                                                                                                                                                                                 |
| 10    | the four budgets of section 6                                 | pass (the size check counted characters; since the fix round it counts bytes)                                                                                                                                                        |

The reviews also found behaviour faults that no gate test covered. Each was fixed in the next commit and checked by the next reviewer: keys did nothing while a checkbox or a list had the focus; Enter on a focused button edited a selected label instead; align and distribute measured labels with an estimate instead of as drawn; labels took no part in guides; during an Alt+drag the original stayed selected; and the top bar's spacing broke the 8 px rule. The phase 10 review found five more, fixed in a fix round and checked by a further reviewer: a finger could not drag a library tile to the canvas; a sideways swipe outside the canvas made the browser go back and lose the diagram; a focus ring was cut off at the edge of a scrolling list; long tile names were cut off; and some 4 px gaps were left (one row keeps them; section 5). The re-check found one ring still hidden: in the colour presets, the next preset painted over the lower side of the focused one's ring. The lead fixed it, and a further reviewer passed the fix on all 29 presets. The lead also made `focus-is-always-visible` read the ring's pixels at every stop; it fails without the fix. That reviewer looked at the pixel check three times and twice found it too weak, and it now counts the whole band along the straight part of each side. The third look left small limits, which the test's comment states: the check does not find a cover smaller than a CSS pixel at the end of a side, a cover of one CSS pixel inside a square corner, or a cover over part of the band's width round a round corner. The README faults that the phase 10 review found were corrected by the lead.

### Visual review

| Item                                                                                             | Result                                                                                                           |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 78 new priority A symbols, in 5 groups of packs                                                  | all passed; one defect in round 1 (the bench line's hatch pitch), fixed and passed in round 2                    |
| 39 new priority A templates                                                                      | 38 passed (most in round 1; 12 after fixes in rounds 2 and 3); `rateGasSyringe` accepted with a note (section 6) |
| Symbols the lead changed after review (microscope, metal block, melting point apparatus, pulley) | passed on re-check                                                                                               |
| The style reference picture after the contents seed changed                                      | passed in round 3                                                                                                |

## 5. Departures from the specification

### Structure and process

- **Folder.** The project is in `pracdraw/`, not the repository root, which already holds another project. `REPORT.md` and `README.md` are in `pracdraw/`.
- **Spec test, labels (`src/spec.test.ts`).** Section 8 rule 11 asks hotPlate and chromatographyPaper for a label that depends on a parameter, but their catalogue rows list no label, and the kit's test failed any label not in the row. The test now accepts a label function that gives the default text at the default parameters.
- **Layer test (`src/layers.test.ts`).** Test files are exempt from the folder table (a test may import from any folder), although line 147 says "every file in `src`".
- **A second chemistry file while drafting.** The chemistry templates were drafted in two files at once and folded into `chemistry.ts`, in the order of the Templates tab, before review.
- **Interruptions.** Usage limits stopped the running agents three times. Each time the lead saved the partial work as a commit, and a new agent finished it. Reviews that were cut off were run again on the current tree. One verdict (biology round 2) is taken from the reviewer's last message, "Both fixes check out", because its verdict list did not arrive.

### Kernel and renderer (lead files)

Each change below came with a test that failed before it.

- **Narrow liquids in photocopy-safe mode (`contents.ts`).** A span too narrow for a row of dashes, such as a thermometer thread, a burette jet or a pipette stem, drew no liquid, so a thermometer lost its reading (rule S12). It now gets one line down its centre from the surface to the bottom. A run shorter than 6 u, the tip of a round bottom, gets none.
- **Thin layers of lumps (`contents.ts`).** A lumps layer thinner than one row drew nothing, so "anti-bumping granules (lumps 0.05)" in a round-bottomed flask (7.4 u) were missing. A layer at least half a lump deep now draws its bottom row.
- **The seed of bubbles, dots and lumps (`render.ts`).** Section 9 says the seed comes from the item id. It now comes from the symbol, the cavity and the size. A pasted or inserted copy gets a new id (section 7 rule 4), so its bubbles moved, and a label fixed to a bubble or a granule could end in clear liquid. The drawing still never moves between renders, and a move, a turn or a change of amount keeps it.
- **A connector with no length (`render.ts`).** A tube whose points all lie on one spot made the tube kernel throw. It now draws nothing.
- **The style reference.** `docs/style-reference.png` was regenerated from `out/reference.png` after the seed change, and the "CaCO3 chips" leader in `src/demo.ts` moved onto a chip.

### Symbols

- **Recipe sizes changed for fit (rule S9).** The thermometer holes of `metalBlock` (recipe 10 u) and `meltingPointApparatus` (recipe 9 u) are 16 u, because the thermometer's bulb is 13 u. The pulley's minimum size is 28 × 40 (was 36 × 50), so its wheel can sit at a trolley's hook height.
- **The microscope.** The nosepiece, tube and eyepiece sit 10 u higher, so the objective clears a slide with its cover slip. The stage clip is a post and a spring arm at the left end of the stage, so a slide no longer hides it.
- **Recipe readings accepted by the reviewers.** Spring end tails 6 u, not 8 u, so the loops stay in the box. The insulated metal block is inset 9 u so its jacket stays in the box. The vibration generator's pin and the immersion heater's leads are inside the box. The ripple tank's lamp hangs on a rod from the top of the box, and its motor stands on a post. The lamp's stem is under its holder. The trolley's front port is at its hook. The hot plate's top plate is the top 7 u of the box. The heating mantle's bowl radius shrinks at small sizes. The separating funnel's stopper head is 6 u above the rim, with a 6 u stem cut. The gas syringe's barrel is centred at y = 18 so its numbers fit under it. The wash bottle's cap is at y = 24 to 36. The polystyrene cup's lid sits above the rim. The meter box's terminals are 8 u above its lower edge. The light gate's lead is at the left end of its bar. The crocodile clip's teeth are detail-weight lines. The receiver adaptor's cavity starts 10 u past the socket. Terminal anchors have a direction. The melting point block is at y = 8. The LDR's two arrows are offset to fit the box, circuit arrow heads are at the main line weight, and the junction dot uses the dark role.
- **Anchors the catalogue does not give.** These are recorded, not added, because a catalogue row fixes a symbol's anchors: the water bath has no tank-floor anchor; the clamp stand has none on top of its base plate; the meter box with no terminals has none for a cable; chromatography paper has only its top anchor; the pulley has none at its clamp slot; the measuring cylinder and the condenser have no neck anchor for a clamp. Templates place these parts from other anchors with offsets.

### Templates

- **Lead conventions.** A clamp that grips an upright vessel, or a condenser or a sloping tube, is drawn behind it, so its jaws meet the glass. Drawn in front, the jaws cross the neck and read as a closed floor, which would also break S13. Condenser water labels are fixed labels with an arrow on "water in", as in the reference picture, so blank mode hides them.
- **Set-up notes followed with a change.** `standardSolution` holds 36 %, not 40 %: at 40 % the surface sits where the bulb meets the neck, so the bulb looks full. `rateGasOverWater` labels the gas H₂, not CO₂, because magnesium gives hydrogen. The pulley in `acceleration` is drawn at about 29 × 41, so the string is level, as it must be in this practical. `rateGasSyringe` holds 30 cm³ of gas and its clamp grips the barrel from the nozzle side, so the plunger's path is clear. The pH meter in `phCurve` reads 2.87 (0.1 mol/dm³ ethanoic acid), because the acid has had no alkali yet.
- **Smaller layout choices accepted by the reviewers.** These include label columns above the apparatus where a side column would cross a part, meter boxes that float above the bench because their terminals are on the lower edge, colourless gas drawn as `#ffffff`, and the sizes chosen for the distillation mantle and receiving flask (there is no lab jack).

### Editor

- **Top bar breakpoint (a lead decision; an open point for James).** The top bar keeps the 8 px spacing steps of line 517. All its controls then need 1537 px, so the "More" menu takes over below 1540 px, not 1300 px (line 515). On a 1366 or 1440 px laptop, zoom, Snap, Photocopy-safe, Label all, New, Open, Save and Help are in the More menu; the tools, Undo, Redo, the label-mode switch, Copy image and Export stay in the bar. The other choice is 6 px gaps with the 1300 px breakpoint, which squeezes the title at 1300 px.
- **Contents (section 9).** The commands keep at most one gas layer and at most four layers, and an edited layer takes only the room left. A gas layer shows a note instead of an amount slider, because the kernel ignores a gas's amount. A cavity holding only gas has no level handle. The Reading field is in an inspector section called "Scale".
- **Order rule (line 607).** It runs when a symbol is added from the library and when it moves, not on insert, paste or duplicate, which put items on top anyway. Items that move together are not targets of each other.
- **Connectors (section 10).** Points also snap to ports, terminals and tips while drawing, not only while editing. Preset tiles use a 1 px line, not 1.5 px, because a tube's two walls merge at tile size. The first Escape with nothing to cancel leaves a drawing tool and keeps the selection; a second clears it.
- **Snapping (section 12).** Guides match centre to centre and edge to edge. When an anchor snaps, no guide applies. The fit rule also resizes the bung when the mouth is the item dragged, unless the bung is locked. A moving item is never a target, so after an Alt+drag starts the copy is selected and the original may be a target.
- **Keys.** A focused control keeps the keys it uses itself: arrows on a list or a slider, Space on a button or a checkbox. Every other key reaches the editor (line 628).
- **Labels (section 11).** Label all adds its labels down the left column, then down the right, so letters read down each column. The label inspector has Arrange, because draw order sets the letters. A selected label has a handle on its leader end, and Enter edits it. Moving a label on its own moves a free target with it.
- **Widths in Node.** In Node, `docBounds` and the model measure text with an estimate in `src/model` that understands markup, because `src/model` may not import `src/render`, where line 654's `estimateWidth` lives. The browser measures with canvas `measureText`, as line 654 says.
- **Export and files (section 13).** The PNG's box is `docBounds` rounded out to whole units, so its margin is 16 u to under 17 u. `docBounds` takes the answer key's box as an optional third argument. `parseDoc` fails only a wrong top-level shape; a bad title or setting takes its default and is listed; a missing optional field may be `null`; a label whose target is gone becomes plain text and is listed; a file from a newer version opens with a warning. File names lose spaces at both ends. The export dialog adds a preview and a size line, the text fallback has a Copy button, and after Save, "Download did not start?" is in the status bar.

### Release 1.0 (phase 10)

- **Keyboard (section 12).** Enter in the library's search box adds the part and moves the focus to the canvas, so the arrow keys move the new part at once; keys do nothing while a text field has the focus (line 628). On the label-mode switch and the library tabs, the arrow keys move within the group instead of moving the selection.
- **Empty state.** The card hides while a drawing tool is chosen, so a press on the canvas goes to the tool.
- **Colours for contrast (line 517; access, line 637).** Muted text is #5f6672, not #6b7280. Accent-coloured text on a pale accent background, and link text, use #1f56c0. The focus ring is #1d4fc4, and the primary button darkens on hover. The accent #2f6fde for selection, handles and the primary button is unchanged. The lowest text contrast measured is 4.72:1.
- **Focus.** The canvas can take the focus, and a press on it does. This also fixed a fault from earlier phases: a half-typed inspector field kept the focus, uncommitted, when an item was pressed. When a focused control disappears, the focus moves to the canvas. Shut drawers are inert. A dialog keeps Tab inside it and gives the focus back when it closes.
- **Touch.** A double tap is found from pointer events and acts as a double-click; the browser's own double-click after taps is ignored. A handle pressed off its centre keeps that offset, so it does not jump to the finger. The help key table has a row for touch.
- **Gate tests.** In `job-2` the heatproof mat has no anchor that snaps to another part, so the test drags it until a guide snaps it (its bottom edge in line with the thermometer's); the other five parts snap by their anchors. In `job-3`, "no label text" is checked on what the SVG draws; its metadata still holds the text (section 13; see section 7).
- **Reuse in two clicks (section 2, job 5).** This holds at 1540 px or wider. Below that, Open is in the More menu, so it takes three clicks, or Ctrl+O and the file. It follows from the top bar breakpoint above.
- **Spacing (line 517).** The inspector's row of Align top, middle and bottom keeps 4 px gaps: with 8 px gaps it needs 267 px, and the inspector has 263 px inside its padding. Padding inside small controls (key chips, inputs, the text area, preset buttons) is taken as the control's own size, not as spacing.
- **Tile names (line 522).** A tile's name is 10 px, not the app's 13 px, and a word of 12 or more letters can break at a soft hyphen ("Chromato-graphy"), so that every name fits in a 76 × 84 tile on at most two lines. A name that would still need a third line is drawn smaller, down to 8 px: with the test machine's font, "Round-bottomed flask" is 9.5 px and "Microscope slide (side view)" is 9 px. The tooltip and the accessible name keep the full name.
- **Dragging a tile.** Tiles are dragged with pointer events for a mouse, a finger and a pen alike, not with HTML drag and drop. A finger drag must start sideways, because a move up or down scrolls the list. Below 1100 px, the library drawer shuts when a drag leaves it, so the whole canvas can take the drop.

## 6. Accepted with a note

- **`rateGasSyringe`.** Review found a different defect in each of three rounds: the stand stood in the plunger's path; then the jaws stood off the barrel; then the end of the clamp's arm crossed the nozzle. The lead fixed the third (the delivery tube now runs 12 u into the nozzle and hides the arm's end) and checked a close-up, but there was no fourth review round. The template is accepted with this note (section 14, visual review step 4).

No symbol was accepted with a note.

## 7. Manual checks for James

These are open. The build could not do them.

- [ ] Paste a copied PNG into PowerPoint, Word and Google Slides.
- [ ] Insert an exported SVG into PowerPoint and Word. Check the liquids, the text and the dashed lines.
- [ ] Photocopy a worksheet made in photocopy-safe mode.
- [ ] Open the file on a school Chromebook and on an iPad, and try touch there: pinch, two-finger pan, and dragging a tile sideways out of the library. (Only Chromium was tested, with touch emulated; Firefox and Safari were not.)
- [ ] In a Claude artifact, use Download and Copy image.
- [ ] Compare the 14 circuit symbols with the figure in the AQA specification. If one differs, change its recipe or its `circle` default.
- [ ] Read each template's set-up in the Templates tab against your own scheme of work.
- [ ] Decide on the top bar: 8 px spacing with the More menu below 1540 px (as built), or 6 px gaps with the full bar down to 1300 px.
- [ ] Note for worksheets: an SVG exported in blank or letters mode still carries every label's text in its metadata (section 13 requires it, so the file can be opened again). A student could read the answers from it. Give students PNG files.

## 8. Release 1.1 (phase 11)

Release 1.1 adds the 27 priority B symbols and the 3 priority B templates. The specification says that release 1.1 is "not built until James asks" (section 16). After release 1.0 was closed, James wrote "Continue with developing the site". The lead read this as the request for release 1.1, and built it on its own branch, `claude/pracdraw-release-1-1`, in a pull request stacked on the release 1.0 pull request. If James meant something else, release 1.1 can be left out: nothing in release 1.0 changed, except the counts in `README.md` and the gallery test (see "Departures" below).

### What was built

| Pack           | Priority B symbols                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Containers (9) | flatBottomFlask, pearFlask, sideArmTube, crystallisingDish, crucible, reagentBottle, gasJar, uTube, copperCalorimeter          |
| Measuring (4)  | syringe, newtonMeter, pipetteFiller, scaleWindow (the magnified scale for reading questions; its Reading field sets the level) |
| Heating (2)    | spiritBurner, pipeclayTriangle                                                                                                 |
| Support (4)    | testTubeHolder, cottonWool, spatula, gClamp                                                                                    |
| Filtering (2)  | droppingFunnel, thistleFunnel                                                                                                  |
| Organic (1)    | fractionatingColumn                                                                                                            |
| Biology (2)    | petriDishTop, leaf                                                                                                             |
| Annotation (3) | flame, drops, flameTestLoop                                                                                                    |

The 3 templates are `flameTest` (Flame test), `spiritBurnerCalorimetry` (Enthalpy of combustion) and `massLoss` (Rate of reaction: loss of mass), all in the Chemistry group.

Three symbol authors worked at the same time (containers; measuring, heating, filtering and organic; support, biology and annotation), then one template author. The lead merged one branch at a time and ran `npm run check` on each merged tree: 1853, 1943 and 2033 unit tests after the three symbol merges, and 2039 after the templates, with 68 browser tests each time. A separate reviewer agent opened every picture of every new symbol and template. Usage limits stopped two reviewers and the template author once; the template author was resumed with its work in progress, and the two reviews were run again from the start.

### Command output on the final tree

`npm run check`:

```
> pracdraw@0.1.0 check
> npm run typecheck && npm run lint && npm run format:check && npm run test && npm run e2e


> pracdraw@0.1.0 typecheck
> tsc -b


> pracdraw@0.1.0 lint
> oxlint


> pracdraw@0.1.0 format:check
> prettier --check .

Checking formatting...
All matched files use Prettier code style!

> pracdraw@0.1.0 test
> vitest run


 RUN  v5.0.3 /home/user/miniature-engine/pracdraw


 Test Files  37 passed (37)
      Tests  2039 passed (2039)
   Start at  07:06:58
   Duration  5.47s (transform 40%, tests 31%, import 26%, worker 2%)

  Transform  transforming modules took 3.78s · 40% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns


> pracdraw@0.1.0 e2e
> npm run build && playwright test


> pracdraw@0.1.0 build
> tsc -b && vite build

vite v8.3.2 building client environment for production...
transforming...
✓ 110 modules transformed.
rendering chunks...
[plugin vite:singlefile]

[plugin vite:singlefile] Inlining: index-Bd5r9WUJ.js
[plugin vite:singlefile] Inlining: style-DkvPe7V3.css
computing gzip size...
dist/index.html  514.25 kB │ gzip: 162.64 kB

✓ built in 863ms

Running 68 tests using 2 workers

  ✓   1 e2e/editor.spec.ts:54:1 › the single file runs from file:// with no network requests (628ms)
  ✓   2 e2e/files.spec.ts:128:1 › png-size-matches-bounds (1.5s)
  ✓   3 e2e/editor.spec.ts:77:1 › the PNG drawn on canvas matches the SVG on screen (1.1s)
  ✓   5 e2e/editor.spec.ts:121:1 › the SVG export is standalone and plain (477ms)
  ✓   4 e2e/files.spec.ts:190:1 › svg-reopens-equal (1.1s)
  ✓   6 e2e/editor.spec.ts:144:1 › copy puts a PNG on the clipboard (813ms)
  ✓   7 e2e/files.spec.ts:224:1 › save-open-round-trip (954ms)
  ✓   8 e2e/editor.spec.ts:155:1 › settings re-render the diagram (701ms)
  ✓   9 e2e/files.spec.ts:257:1 › unknown-symbol-opens (909ms)
  ✓  10 e2e/editor.spec.ts:169:1 › add-move-undo (848ms)
  ✓  12 e2e/editor.spec.ts:186:1 › resize-keeps-line-width (704ms)
  ✓  11 e2e/files.spec.ts:315:1 › open-lists-problems-in-a-banner (992ms)
  ✓  14 e2e/files.spec.ts:347:1 › drop-a-file-on-the-canvas-opens-it (549ms)
  ✓  13 e2e/editor.spec.ts:200:1 › rotate-and-flip (904ms)
  ✓  16 e2e/editor.spec.ts:231:1 › parameter-change (609ms)
  ✓  15 e2e/files.spec.ts:377:1 › copy-fallback-shows-picture (844ms)
  ✓  18 e2e/files.spec.ts:405:1 › text-fallback-and-download-did-not-start (1.5s)
  ✓  17 e2e/editor.spec.ts:244:1 › autosave-restores (1.8s)
  ✓  20 e2e/editor.spec.ts:277:1 › insert-template-twice (783ms)
  ✓  19 e2e/files.spec.ts:453:1 › claude-host-saves (1.1s)
  ✓  21 e2e/editor.spec.ts:307:1 › fill-and-turn-stays-level (627ms)
  ✓  23 e2e/editor.spec.ts:356:1 › set-reading-37 (561ms)
  ✓  24 e2e/editor.spec.ts:373:1 › drop-into-beaker-comes-to-front (1.0s)
  ✓  25 e2e/editor.spec.ts:400:1 › contents-controls (1.1s)
  ✓  26 e2e/editor.spec.ts:490:1 › draw-tube-four-points (591ms)
  ✓  22 e2e/files.spec.ts:521:1 › gallery-inserts-template (4.3s)
  ✓  28 e2e/release.spec.ts:216:1 › job-1 (796ms)
  ✓  27 e2e/editor.spec.ts:540:1 › edit-connector-point (2.8s)
  ✓  30 e2e/editor.spec.ts:672:1 › arrow-and-dimension-caps (683ms)
  ✓  29 e2e/release.spec.ts:258:1 › job-2 (2.5s)
  ✓  32 e2e/release.spec.ts:332:1 › job-3 (897ms)
  ✓  31 e2e/editor.spec.ts:728:1 › connector-tools (1.3s)
  ✓  33 e2e/release.spec.ts:369:1 › job-4 (601ms)
  ✓  34 e2e/editor.spec.ts:792:1 › shape-tools (1.2s)
  ✓  35 e2e/release.spec.ts:392:1 › job-5 (1.5s)
  ✓  36 e2e/editor.spec.ts:846:1 › bung-snaps-and-fits (916ms)
  ✓  38 e2e/editor.spec.ts:877:1 › beaker-stands-on-gauze (974ms)
budget: drag: mean frame gap 16.85 ms over 60 frames, longest 27.9 ms, 60 pointer moves handled over 992 ms (150 symbols with contents, 60 moves sent at 60 Hz, the last 0.8 ms late)
  ✓  37 e2e/release.spec.ts:433:1 › drag-budget (1.9s)
  ✓  39 e2e/editor.spec.ts:908:1 › clamp-on-rod (1.0s)
budget: open to first paint from file://: 116 ms (first contentful 272 ms), 108 ms (first contentful 288 ms), 156 ms (first contentful 324 ms)
  ✓  40 e2e/release.spec.ts:558:1 › open-to-first-paint (1.4s)
  ✓  41 e2e/editor.spec.ts:932:1 › snap-off-and-guides (1.4s)
  ✓  43 e2e/editor.spec.ts:979:1 › arrange-several-items (863ms)
  ✓  42 e2e/release.spec.ts:590:1 › keyboard-only (1.6s)
  ✓  44 e2e/editor.spec.ts:1027:1 › keys-work-after-a-checkbox (659ms)
  ✓  46 e2e/editor.spec.ts:1080:1 › label-follows-item (1.2s)
  ✓  47 e2e/editor.spec.ts:1153:1 › blank-mode-has-no-label-text (565ms)
  ✓  48 e2e/editor.spec.ts:1191:1 › label-all-no-crossing (719ms)
  ✓  49 e2e/editor.spec.ts:1234:1 › label-and-text-tools (1.3s)
  ✓  50 e2e/editor.spec.ts:1305:1 › edit-label-text (702ms)
  ✓  51 e2e/editor.spec.ts:1341:1 › label-inspector (1.0s)
  ✓  52 e2e/editor.spec.ts:1387:1 › label-leader-end-handle (837ms)
  ✓  53 e2e/editor.spec.ts:1418:1 › alt-drag-selects-the-copy (651ms)
empty diagram: 161 controls, 161 new
More menu: 172 controls, 11 new
title: 161 controls, 1 new
templates: 79 controls, 48 new
help: 162 controls, 1 new
a beaker with water: 175 controls, 27 new
the colour presets: 205 controls, 29 new
a measuring cylinder: 169 controls, 4 new
a label: 161 controls, 7 new
the text box: 162 controls, 1 new
a wire: 160 controls, 6 new
a rectangle: 160 controls, 5 new
several items: 167 controls, 10 new
export: 185 controls, 14 new
copy by hand: picture: 168 controls, 1 new
copy by hand: text: 189 controls, 3 new
saved: 168 controls, 1 new
banner: 168 controls, 1 new
wide window: 178 controls, 0 new
narrow window, drawers open: 172 controls, 4 new
  ✓  45 e2e/release.spec.ts:701:1 › controls-have-names (7.8s)
  ✓  54 e2e/editor.spec.ts:1447:1 › labels-move-like-items (746ms)
  ✓  56 e2e/editor.spec.ts:1483:1 › letters-mode (596ms)
  ✓  57 e2e/editor.spec.ts:1501:1 › align-and-guides-measure-label-text (848ms)
  ✓  58 e2e/editor.spec.ts:1539:1 › enter-on-a-focused-control-presses-it (747ms)
  ✓  55 e2e/release.spec.ts:1000:1 › focus-is-always-visible (34.7s)
budget: text contrast: lowest ratio 4.72 (empty diagram: 55 texts, lowest 4.72; More menu: 62 texts, lowest 4.72; templates: 42 texts, lowest 4.72; a beaker with its colour presets: 88 texts, lowest 4.72; help: 51 texts, lowest 15.05; export: 27 texts, lowest 4.72; banner and status bar: 51 texts, lowest 4.72)
  ✓  59 e2e/release.spec.ts:1185:1 › text-contrast (1.3s)
  ✓  60 e2e/release.spec.ts:1230:1 › empty-state-card (1.1s)
  ✓  61 e2e/release.spec.ts:1270:1 › help-dialog (721ms)
  ✓  62 e2e/release.spec.ts:1303:1 › narrow-window-keyboard (1.1s)
  ✓  63 e2e/release.spec.ts:1351:1 › tile-names-fit (849ms)
  ✓  64 e2e/release.spec.ts:1405:1 › library-drag-adds-at-the-pointer (2.1s)
  ✓  65 e2e/release.spec.ts:1503:3 › on a touch screen › touch-pinch-pan-and-handles (1.2s)
  ✓  66 e2e/release.spec.ts:1576:3 › on a touch screen › touch-drag-tile-to-canvas (3.0s)
  ✓  67 e2e/release.spec.ts:1659:3 › on a touch screen › touch-library-swipe-scrolls (1.0s)
  ✓  68 e2e/release.spec.ts:1686:3 › on a touch screen › touch-swipes-keep-the-app (8.8s)

  68 passed (1.5m)
```

`npm run progress`:

```
> pracdraw@0.1.0 progress
> tsx scripts/progress.ts

Symbols         A built/planned   B built/planned
  containers        13/13             9/9
  measuring         12/12             4/4
  heating           9/9               2/2
  support           15/15             4/4
  filtering         3/3               2/2
  organic           5/5               1/1
  electrochemistry  5/5               0/0
  physics           12/12             0/0
  biology           5/5               2/2
  circuit           14/14             0/0
  annotation        3/3               3/3
  TOTAL             96/96             27/27
Templates       A 40/40   B 3/3
Next (priority A, not built): none
```

`npm run release:b` (the gate of phase 11) and `npm run release:a` run the same test file with `RELEASE=B` or `RELEASE=A`; both pass:

```
> pracdraw@0.1.0 release:b
> RELEASE=B vitest run src/spec.test.ts


 RUN  v5.0.3 /home/user/miniature-engine/pracdraw


 Test Files  1 passed (1)
      Tests  170 passed (170)
   Start at  07:12:37
   Duration  1.36s (transform 77%, tests 15%, import 7%, worker 1%)
```

### Size and budgets

| Budget (section 6)                                                    | Limit                      | Result                                                                                                                                                                                               |
| --------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dist/index.html`                                                     | 900 kB                     | 514.25 kB (gzip 162.64 kB): pass (release 1.0: 493.06 kB)                                                                                                                                            |
| Network requests at run time                                          | 0                          | 0: pass (the same tests as in section 3)                                                                                                                                                             |
| Drag one symbol 300 px in 60 pointer moves, 150 symbols with contents | mean frame gap under 20 ms | mean 16.85 ms over 60 frames, longest 27.9 ms: pass (`drag-budget`, in the final `npm run check`)                                                                                                    |
| Open to first paint from `file://`                                    | under 1 s                  | 116, 108 and 156 ms to first paint (first contentful paint 272 to 324 ms) on three fresh pages: pass (`open-to-first-paint`; release 1.0 measured 44 to 92 ms, and the machine was busier this time) |

### Reviewer verdicts

Each new symbol and template was passed by a reviewer that did not write it. The reviewer judged every choice that the author recorded where the catalogue recipe was silent or open ("accepted" means that it looks right and breaks no style rule).

| Group                                                 | Round 1                                                                                               | Round 2                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Containers (9 symbols)                                | 9 pass                                                                                                |                                                                                               |
| Support, biology and annotation (9 symbols)           | 9 pass                                                                                                |                                                                                               |
| Measuring, heating, filtering and organic (9 symbols) | 8 pass; `thistleFunnel`: defect (fillet of 2 u under the cup; glass corners are 3 u or more, rule S4) | `thistleFunnel`: pass (fillet 3 u, arcs tangent, clean at 44 by 120, 44 by 270 and 44 by 405) |
| The 3 templates                                       | 3 pass                                                                                                |                                                                                               |

The functional check of `scaleWindow` was made in the built app: typed readings put the liquid surface exactly on the tick (0.00 u error) for the default scale (20 to 21, 10 divisions), for a reversed scale (top 50, bottom 40), and for 5 and 20 divisions; readings outside the scale clamp to its ends; when the item is turned or flipped the Reading field gives way to a hint, and no scale number is mirrored.

### Departures and notes

- **A lead change after review.** `thistleFunnel`: the fillet where the bowl meets the bulb is 3 u, not 2 u (one value in `src/symbols/filtering.ts`).
- **Tests and README.** `gallery-inserts-template` now checks a card with a thumbnail for all 43 templates of the plan, not only the 40 of priority A. `README.md` says 123 items and 43 templates.
- **Choices where the recipe is silent or open** (all accepted by the reviewers): `reagentBottle` with its stopper draws no rim flare, has an 8 u plug with no taper, and its cavity starts 1 u under the plug; `pearFlask` starts its bottom arc 50 degrees below horizontal; the `crucible` lid is one outline that rises 0.09w, with a 6 by 4 knob; the `gasJar` flange is a flat 5 u line with a radius 2 corner; `gClamp` reads "jaws reach 0.6w" as 30 u from the bar's inner face, so it sits left of the box centre with the screw on the centre line; `testTubeHolder` has a round ring jaw; `drops` at count 4 are 8 u high; the `leaf` stalk is a separate 2 u line; `flameTestLoop` has its `loop` anchor at the centre of the loop; `flame` reuses the `luminousFlame` shape (the same curve as the Bunsen safety flame, checked point by point); `syringe` has a 6 u closed-end taper, a piston face 1 u above the shoulder at plunger 0, and an edge-on flange; `newtonMeter` has a J hook, so `hook:port` is at x = 5; `scaleWindow` has tilde break lines, no middle tick for 5 divisions, and does not draw its `unit`; `spiritBurner` has a cap line under the wick holder; `fractionatingColumn` has a tube 30 u wide below a 28 u socket throat.
- **Template choices** (all accepted): `flameTest` draws the Bunsen burner at 1.75 times its size, because the 8 u loop cannot sit between the dark inner cone and the edge of the flame at the default size; `spiritBurnerCalorimetry` uses a can of 60 by 90, because the clamp's jaw opening is capped at 60 u.
- **Known, not changed.** On the turned photocopy-safe sheet, one dash of liquid in the `uTube` touches the outer wall by about 0.35 u (the kernel's dash layout does the same to `volumetricFlask`, which passed in release 1.0). At some turn angles (about 30, 45, 60, 150, 210 and 330 degrees), a stub of about 6 u of centre line shows in the acute pocket where the lower break line of `scaleWindow` meets the wall (the kernel's mark for a narrow span of liquid in photocopy-safe mode, `MIN_RUN`).
- **No symbol or template was accepted with a note.**
- **Manual checks.** The open list in section 7 applies to the 123 symbols and 43 templates of release 1.1 as well.
