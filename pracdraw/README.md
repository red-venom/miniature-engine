# PracDraw starter kit

This kit is phases 0 and 1 of the PracDraw build: a tested scaffold, the drawing kernel, 18 pilot symbols, one template and the review tools.
The full brief is `docs/SPEC.md`. It is a snapshot of the live specification document. If the two differ, the live document wins.

## Start

```
npm ci
npx playwright install chromium   # only when /opt/pw-browsers/chromium does not exist
npm run check     # type check, lint, format check, unit tests, build, browser tests
npm run sheet     # writes the style reference and the contact sheets to out/
npm run dev       # the starter shell at http://localhost:5173
```

Node 20.19 or later (Vite 8 needs it). The browser tests and the contact sheets use Playwright's Chromium.
`playwright.config.ts` and `scripts/sheet.ts` use `/opt/pw-browsers/chromium` when it exists, and Playwright's own download when it does not.
The kit is not a git repository: run `git init` before the first commit.

| Command                                  | What it does                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run check`                          | Everything below except the sheets. Must be green before and after every phase.        |
| `npm run test`                           | Unit tests (Vitest).                                                                   |
| `npm run e2e`                            | Builds the single file, then runs the browser tests against it from `file://`.         |
| `npm run sheet [pack\|templates]`        | `out/reference.png`, `out/sheet-<pack>-<variant>.png`, `out/template-<id>-<mode>.png`. |
| `npm run progress`                       | What is built against `spec/catalogue.json` and `spec/templates.json`.                 |
| `npm run release:a`, `npm run release:b` | Fails while a symbol or template of that priority is missing. (POSIX shells.)          |
| `npm run release:a:symbols`              | The symbol half of `release:a`: the gate for phase 8.                                  |
| `npm run format`                         | Prettier.                                                                              |

`npm run sheet` deletes the old pictures first, and it fails when it cannot write the PNG files. The sheet variants are `plain`, `filled`,
`mono-turned` (photocopy-safe, turned 30° and flipped, scale numbers on) and `anchors`.

## What the kit proves

- One self-contained `dist/index.html` (about 260 kB) that runs from `file://` with no network request.
- One render tree and three back-ends: React SVG for the screen, an SVG string for files, Canvas 2D for PNG.
  A browser test checks that the canvas PNG matches the SVG on screen.
- Contents drawn by geometry: the surface stays level when a vessel turns; layers, lumps, bubbles, a meniscus, cloudy liquids,
  and dashes for photocopy-safe mode. The output is plain paths: no clipPath, mask, pattern or filter.
- Tubes as two wall lines with rounded bends. Wires, lines, arrows and dimension ticks.
- Label markup and the chemistry formatter (`H2SO4`, `Cu2+`, `25 cm3`, `mol/dm3`, `2e-` …).
- Scale readings: a measuring cylinder, burette or thermometer set to an exact value, on scales with real divisions.
- Parts placed by anchors (`DocBuilder`), labels fixed to items, and the label modes text, blank and letters.
- A file from a newer version still opens: an unknown symbol is drawn as a dashed box.
- A PNG copied to the clipboard.

## Layout

| Path                         | Holds                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/kernel`                 | `geom.ts` paths and clipping, `contents.ts`, `tube.ts`, `text.ts`, `nodes.ts` render tree. Pure: no DOM.                                  |
| `src/symbols`                | `types.ts` the contract, `kit.ts` shared sizes and helpers, `pilots.ts` the 18 worked examples, `registry.ts`, `scale.ts`.                |
| `src/symbols/<pack>.ts`      | One file for each of the 11 packs. Each exports an array, empty for now. The registry already imports them all.                           |
| `src/model`                  | `types.ts` the document (also the file format), `transform.ts`, `build.ts` (`DocBuilder`).                                                |
| `src/render`                 | `render.ts` document to render tree, `NodeView.tsx` the React back-end.                                                                   |
| `src/export`                 | `canvas.ts` the PNG back-end.                                                                                                             |
| `src/templates`              | `types.ts`, `index.ts`, and one file for each group: `general.ts` (holds the worked example), `chemistry.ts`, `biology.ts`, `physics.ts`. |
| `src/demo.ts`, `src/App.tsx` | The style reference picture and a starter shell. Phase 2 replaces the shell with the editor.                                              |
| `src/spec.test.ts`           | Compares the code with `spec/*.json`.                                                                                                     |
| `scripts`                    | `sheet.ts` contact sheets, `progress.ts`.                                                                                                 |
| `e2e`                        | Browser tests against the built file.                                                                                                     |
| `spec`                       | `catalogue.json` (123 symbols) and `templates.json` (43 templates): the plan as data.                                                     |
| `docs`                       | `SPEC.md` and `style-reference.png`.                                                                                                      |

## Add a symbol

1. Find its row in `spec/catalogue.json` (or the Symbol catalogue tab of the specification). The row is the contract.
2. Write a `SymbolDef` in the pack's file, `src/symbols/<pack>.ts`, and add it to the array that the file exports. Copy the nearest pilot.
   Do not edit `registry.ts`: it already imports every pack file.
3. `npm run test`. The registry tests and `src/spec.test.ts` cover the new symbol with no extra code.
4. `npm run sheet <pack>`. Open the four PNG files and check them against the checklist in section 5 of the specification.

## Add a template

1. Find its row in `spec/templates.json`.
2. Write a `TemplateDef` in the group's file, `src/templates/<group>.ts`, and add it to the array that the file exports.
   Copy `heatingBeaker` in `general.ts`. Place parts with `DocBuilder.at`, `.on` and `.near`. Do not edit `index.ts`.
3. `npm run test`, then `npm run sheet templates`. Open both pictures (`text` and `blank`).
