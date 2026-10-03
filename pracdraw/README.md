# PracDraw

PracDraw draws exam-style diagrams of practical apparatus: clean 2D section drawings in black line, with coloured contents, labels and exact scale readings. It is built round the AQA required practicals. It is one file, `index.html`, that runs in a browser with no installation, no account and no network connection.

## Using PracDraw

Open `index.html` in a recent browser. It works from a file share, a USB stick or a static web host. It is tested in Chrome (Chromium); Firefox, Safari, a Chromebook and an iPad have not been checked yet. Your diagram is saved in the browser as you work, and comes back when you open the file again.

### A ready-made diagram in three clicks

1. Open the **Templates** tab in the library on the left. The chips filter the 40 templates by group: General, Chemistry, Biology, Physics.
2. Click a card. On an empty canvas the template becomes the diagram.
3. Click **Copy image**, then paste into your slide or worksheet.

The empty canvas also offers three templates straight away: heating a liquid in a beaker, titration, and gas collected over water.

### Your own set-up

- **Add apparatus.** In the **Apparatus** tab, type in the search box (or press `/`) and press Enter, or click a tile, or drag a tile onto the canvas. The library has 96 items in 11 groups, plus ready-made tubes, wires, arrows and dimension lines.
- **Put parts together.** Drag a part near its partner and it snaps: a beaker onto gauze, a bung into a flask's neck (the bung resizes to fit), a clamp onto a stand's rod, a thermometer onto the centre line of a beaker. Hold Ctrl (Cmd on a Mac) to drag without snapping.
- **Fill a vessel.** Select it and use the **Contents** block in the inspector on the right: **Water**, or **Add layer** and pick a colour preset (solutions, indicators, precipitates, powders, chips, ice, gases). Drag the small bar at the surface to change the level. Liquids stay level when you turn a vessel.
- **Set a reading.** Select a measuring cylinder, burette or thermometer and type a value in **Reading**: the liquid moves to that mark. For a gas syringe, Reading sets the plunger.
- **Draw tubes and wires.** Press `U` for a glass tube, `W` for a wire or `A` for a line or arrow, click each point, and press Enter. Segments snap level and upright, and ends snap to ports and terminals.
- **Label it.** Press `L`, press on the part, drag to where the text should go, and release. The box already holds the part's name: press Enter to keep it, or type your own. Labels stay fixed to their part when it moves. **Label all** labels every part that has no label yet, with no leaders crossing; circuit symbols, arrows and the bench line are left out. Formulae and units format themselves: `H2SO4`, `Cu2+`, `25 cm3`, `mol/dm3`.

### Worksheets

- The **label-mode switch** in the top bar changes every label in one click: **Text** for teaching slides, **Blank** for a "label the diagram" worksheet (a line to write on), **Letters** for an exam-style question (A, B, C …).
- In Letters mode, **Export** can add an answer key under the diagram.
- **Photocopy-safe** draws contents as patterns instead of colour, so a black-and-white copy stays readable.
- For worksheets that students receive, export **PNG**. An SVG file carries the whole diagram inside it, including the label text, so that PracDraw can open it again; a student could read the answers from it.

### Save, open and export

- **Save** (Ctrl+S) downloads `<title>.pracdraw.json`. **Open** (Ctrl+O) opens that file, or an SVG exported by PracDraw, for editing. You can also drop either file on the canvas.
- **Export** offers PNG at 1×, 2× or 4×, or SVG; a white or transparent background; any label mode; and photocopy-safe on or off. **Copy** puts the picture on the clipboard; **Download** saves it.
- If the browser blocks the clipboard or a download, PracDraw shows the picture in a window: right-click it and choose **Copy image**.

### Keys

| Key                              | Action                                                    |
| -------------------------------- | --------------------------------------------------------- |
| V, L, T, U, W, A, R, E           | Select, Label, Text, Tube, Wire, Line, Rectangle, Ellipse |
| Ctrl+Z; Ctrl+Shift+Z or Ctrl+Y   | Undo; redo                                                |
| Ctrl+C, Ctrl+X, Ctrl+V; Ctrl+D   | Copy, cut, paste; duplicate                               |
| Delete, Backspace                | Delete                                                    |
| Ctrl+A                           | Select all                                                |
| Arrow keys (with Shift)          | Move 1 u (10 u)                                           |
| Ctrl+G; Ctrl+Shift+G             | Group; ungroup                                            |
| ] and [; Ctrl+] and Ctrl+[       | Forward, backward; front, back                            |
| H                                | Flip                                                      |
| + and −; 0; 1                    | Zoom in and out; 100 %; fit                               |
| Space+drag, middle button, wheel | Pan; Ctrl+wheel zooms                                     |
| Ctrl+S; Ctrl+O; Ctrl+Shift+C     | Save; open; copy image                                    |
| /                                | Search the library                                        |
| Escape                           | Cancel, leave a drawing tool, or clear the selection      |
| ?                                | Help: how to start, and every key                         |

On a Mac, Cmd replaces Ctrl. In a window narrower than 1540 px, the less-used top-bar controls (zoom and Fit, Snap, Photocopy-safe, Label all, New, Open, Save, Help) are in the **More** menu.

Everything works from the keyboard. Tab reaches every control. Press `/`, type a name and press Enter: the part appears in the middle of the view, and the arrow keys move it at once. On the label-mode switch, the arrow keys change the mode.

On a touchscreen, pinch with two fingers to zoom, and move two fingers together to pan. A double tap acts as a double-click, and the handles are easier to hit.

### Good to know

- The 14 circuit symbols follow descriptions of the AQA symbol figure; they have not yet been checked against the figure itself.
- Nothing you draw leaves your computer. There is no account and no cloud storage.

## For developers

The build specification is `docs/SPEC.md`; `REPORT.md` records how release 1.0 was built and checked.

```
npm ci
npx playwright install chromium   # only when /opt/pw-browsers/chromium does not exist
npm run check     # type check, lint, format check, unit tests, build, browser tests
npm run sheet     # writes the style reference, the contact sheets and the template pictures to out/
npm run dev       # the editor at http://localhost:5173
npm run build     # dist/index.html, the single file to ship
```

Node 20.19 or later (Vite 8 needs it). The browser tests and the contact sheets use Playwright's Chromium: `playwright.config.ts` and `scripts/sheet.ts` use `/opt/pw-browsers/chromium` when it exists, and Playwright's own download when it does not.

| Command                                  | What it does                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run check`                          | Everything below except the sheets.                                                    |
| `npm run test`                           | Unit tests (Vitest).                                                                   |
| `npm run e2e`                            | Builds the single file, then runs the browser tests against it from `file://`.         |
| `npm run sheet [pack\|templates]`        | `out/reference.png`, `out/sheet-<pack>-<variant>.png`, `out/template-<id>-<mode>.png`. |
| `npm run progress`                       | What is built against `spec/catalogue.json` and `spec/templates.json`.                 |
| `npm run release:a`, `npm run release:b` | Fails while a symbol or template of that priority is missing. (POSIX shells.)          |
| `npm run release:a:symbols`              | The symbol half of `release:a`.                                                        |
| `npm run format`                         | Prettier.                                                                              |

### Layout

| Path                     | Holds                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/kernel`             | Paths and clipping, contents, tubes, text markup, the render tree. Pure: no DOM except the canvas back-end.                                                          |
| `src/symbols`            | The `SymbolDef` contract, shared sizes, the 18 pilots, one file for each of the 11 packs, the registry, scales and leaders.                                          |
| `src/model`              | The document (also the file format), transforms, `DocBuilder`, commands, contents, connectors, labels, Label all, snapping, bounds, `parseDoc` and migrations. Pure. |
| `src/render`             | Document to render tree (`render.ts`) and the React back-end (`NodeView.tsx`).                                                                                       |
| `src/templates`          | One file for each group: `general.ts`, `chemistry.ts`, `biology.ts`, `physics.ts`.                                                                                   |
| `src/export`             | PNG, SVG, reopening an SVG, file names, the answer key.                                                                                                              |
| `src/host`               | Files, clipboard and storage: `webHost`, and `claudeHost` for a Claude artifact.                                                                                     |
| `src/editor`, `src/ui`   | The store and history, tools, keys, autosave, the test hook; the top bar, library, canvas, inspector and dialogs.                                                    |
| `src/layers.test.ts`     | Fails when a file imports from a folder that section 6 of the specification does not allow.                                                                          |
| `src/spec.test.ts`       | Compares the code with `spec/*.json`.                                                                                                                                |
| `scripts`, `e2e`, `spec` | Contact sheets and progress; browser tests; the plan as data.                                                                                                        |

### Add a symbol

1. Find its row in `spec/catalogue.json` (or the Symbol catalogue tab of the specification). The row is the contract.
2. Write a `SymbolDef` in the pack's file, `src/symbols/<pack>.ts`, and add it to the array that the file exports. Copy the nearest pilot in `src/symbols/pilots.ts`.
3. `npm run test`. The registry tests and `src/spec.test.ts` cover the new symbol with no extra code.
4. `npm run sheet <pack>`. Open the four PNG files and check them against the checklist in section 5 of the specification.

### Add a template

1. Find its row in `spec/templates.json`.
2. Write a `TemplateDef` in the group's file, `src/templates/<group>.ts`, and add it to the array that the file exports. Copy `heatingBeaker` in `general.ts`. Place parts with `DocBuilder.at`, `.on` and `.near`.
3. `npm run test`, then `npm run sheet templates`. Open both pictures (`text` and `blank`).
