# Lesson diagrams from a recipe

PracDraw can draw a diagram with no person at the editor. You write a short description of the apparatus, a **recipe**, as a JSON file. One command turns it into the pictures a lesson needs: a PNG for a slide or a worksheet, an SVG, and the saved diagram, which you can open in the editor to change by hand. The pictures are the editor's own: the command opens the built editor in a headless browser and takes them from it.

This is how Claude draws a custom diagram for a lesson. It reads the skill in `.claude/skills/pracdraw/`, writes a recipe, runs the command, looks at the picture, and fixes it. A person can do the same.

## Set up once

```
cd pracdraw
npm ci
```

The command builds the editor the first time (`dist/index.html`, about 10 seconds), and again when the source has changed. It needs a Chromium: `/opt/pw-browsers/chromium` when it exists, or the one from `npx playwright install chromium`. It needs no network.

## Make a diagram

Write `beaker.json`:

```json
{
  "title": "Heating water in a beaker",
  "parts": [
    { "id": "mat", "symbol": "heatproofMat", "at": { "x": 0, "y": 0, "anchor": "under" } },
    { "id": "tripod", "symbol": "tripod", "on": { "part": "mat", "anchor": "top", "own": "feet" } },
    { "id": "gauze", "symbol": "gauze", "on": { "part": "tripod", "anchor": "top", "own": "under" } },
    {
      "id": "beaker",
      "symbol": "beaker",
      "on": { "part": "gauze", "anchor": "top", "own": "base" },
      "contents": { "main": [{ "preset": "Water", "amount": 0.6 }] }
    }
  ]
}
```

Run it:

```
npm run render -- beaker.json --out lessons/heating
```

It prints one line for each file it wrote (size and bytes), then a description of the diagram (where every part, anchor and label is), and the problems it found. Open `lessons/heating/beaker.png` to look at it.

| Flag | Meaning |
| --- | --- |
| `--out <dir>` | The folder for the files. Default `lesson-diagrams`. |
| `--name <slug>` | The start of the file names. Default: the name of the input file. |
| `--scale 1`, `2`, `4` | Pixels of the PNG for each unit. Default 2. Use 4 for print. |
| `--labels shown`, `text`, `blank`, `letters` | Which labels to draw. `blank` is a line to write on; `letters` is A, B, C. Default `shown`: as the diagram is saved. |
| `--answer-key` | With `letters`: the key under the diagram. |
| `--mono` | Photocopy-safe: black line only, dashes for liquids. |
| `--transparent` | A transparent background instead of white. |
| `--variants` | Also write the `-blank`, `-letters` (with the key) and `-mono` pictures. |
| `--no-png`, `--no-svg` | Leave that file out. |
| `--explain` | Also show how each part was placed, and every anchor with its kind and direction. |
| `--template <id>` | Draw one of the 43 templates instead of a file. |
| `--list templates`, `--list symbols` | List what there is. |
| `--symbol <id>` | One symbol in full: size, resize mode, parameters, cavities, anchors with their directions. |

The input can also be a saved diagram (`.pracdraw.json`) or an SVG that PracDraw wrote: the command draws it as it is, so it makes the pictures of a diagram that you changed in the editor.

The same input gives the same files, byte for byte. When the recipe has an error, nothing is written and the exit code is 1; warnings do not change the exit code.

## The files

- `<name>.png`: the picture. Give this to students and put it in slides.
- `<name>.svg`: the same, as a vector picture. The editable diagram is inside it, in its metadata, so that the editor can open it again. The metadata has the label text too: a blank or lettered SVG still holds the answers. Give students the PNG.
- `<name>.pracdraw.json`: the diagram. To change it by hand, open `dist/index.html` in a browser and use **Open** (Ctrl+O) with this file or with the SVG. Save and export from there as usual.

With `--variants` there are also `<name>-blank.*`, `<name>-letters.*` (with the answer key) and `<name>-mono.*`.

## The recipe

A recipe has `title`, `parts`, and optionally `settings`, `connectors` and `labels`. Distances are in units, 1 unit = 1 pixel at 100 % zoom; x goes right and y goes down.

**Parts** are drawn in list order, back to front. Each is placed on a part listed before it, by anchors, the named points of a symbol (`npm run render -- --symbol beaker` lists them):

- `"on": { "part": "mat", "anchor": "top", "own": "feet" }`: the part's own anchor `own` goes on that anchor. `dx`, `dy` move it afterwards; `out` moves it along the direction of the anchor.
- `"near": { "part": "flask", "anchor": "base", "dx": 112, "dy": -33 }`: its centre goes there. For a stopwatch or a ribbon, which have no anchors.
- `"at": { "x": 0, "y": 0, "anchor": "under" }`: its own anchor on a point of the world. For the first part: y = 0 is the bench.
- `"alignX"` and `"alignY"`: one coordinate each. A clamp stand uses both: its rod under the clamp, its base on the bench.
- `rot` (degrees clockwise), `flip`, `size` (`{ "w": 100, "h": 200 }`; `h` can be `{ "between": [point, point] }`), `params` (the options of the symbol), `contents` (liquids and solids in a cavity: `{ "main": [{ "preset": "Water", "amount": 0.6 }] }`, or `"reading": 25` to put the surface at 25 on the scale).
- `"behind": "burette"` draws a part just behind another (a clamp behind the vessel it grips); `"back": true` draws it behind everything (a clamp stand).

**Connectors** (`glassTube`, `rubberTube`, `wire`, `line`) are drawn after all the parts. Their points are anchors (`{ "part": "flask", "anchor": "mouth", "dy": 46 }`), steps (`{ "dy": -60 }`), points (`{ "x": 0, "y": 0 }`), or runs that go upright or level to an anchor (`{ "y": { "part": "flask", "anchor": "mouth", "dy": -62 } }`).

**Labels** are made as Label all makes them in the editor: one text for each part, in columns beside the diagram, with leaders that do not cross. `labels.text` changes a text, `labels.skip` leaves parts out, `labels.side` moves one to the other side, and `labels.extra` adds labels: on a part (`"at": [30, 90]` is a point of the part's frame), on a connector, or on a place, with `textAt` to set where the text goes. Every label is fixed to its part, so the blank and the letters versions work.

**Settings**: `labelMode` (`text`, `blank`, `letters`), `mono`, `labelSize`, `smartText`.

Contents use the preset names of `.claude/skills/pracdraw/reference/presets.md`. A cavity holds up to four layers, listed from the bottom; at most one is a gas, and it is last; lumps are first.

The skill has the whole format with two worked examples, and `.claude/skills/pracdraw/examples/` has five more recipes that were drawn and looked at: a heated beaker, a titration, gas collected over water, a circuit and a cooling curve.

## Problems and checks

A recipe with a mistake gets a numbered list: where (the path in the recipe), what is wrong, and a hint that names the fix, for example:

```
1. error at parts[0].symbol
   Unknown symbol "beker".
   hint: Nearest symbols: beaker (Beaker). The whole list is in reference/symbols.md, or run: npm run render -- --list symbols
```

All the problems are listed, not only the first. After a good recipe the command checks the layout and warns about two leaders that cross, a text that runs into a part or into another text, a symbol that failed to build, a connector that draws nothing, a leader that ends in empty space, and a clamp drawn in front of the vessel it grips. It cannot see everything: look at the picture.

## What it cannot draw

Graphs and tables, skeletal or structural formulae, imported pictures, animation, pouring liquids, and 3D views. Symbols that are not in the editor (`reference/symbols.md` lists the ones that are planned) cannot be used.

## For Claude, and when the symbols change

The skill is `.claude/skills/pracdraw/`. Its `reference/` files (symbols, templates, presets) are written from the code and the plan: run `npm run gen:skill` after a symbol, a template or a preset changes. A unit test fails when they are out of date.
