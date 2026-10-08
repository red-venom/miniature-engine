# Lesson diagrams from a recipe

PracDraw can draw a diagram with no person at the editor. You write a short description of the apparatus, a **recipe**, as a JSON file. One command turns it into the pictures a lesson needs: a PNG for a slide or a worksheet, an SVG, and the saved diagram, which you can open in the editor to change by hand. The pictures are the editor's own: the command opens the built editor in a headless browser and takes them from it.

This is how Claude draws a custom diagram for a lesson. It reads the skill in `.claude/skills/pracdraw/`, writes a recipe, runs the command, looks at the picture, and fixes it. A person can do the same.

## Set up once

```
cd pracdraw
npm ci
```

The command builds the editor the first time (`dist/index.html`, about 2 seconds), and again when the source has changed. It needs a Chromium: `/opt/pw-browsers/chromium` when it exists, or the one from `npx playwright install chromium`. It needs no network.

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

It prints one line for each file it wrote (size, bytes, and what the file is for), then a description of the diagram (where every part, anchor and label is), and the problems it found. The second line of the description gives the size of the picture, and after `this render:` the label mode and the photocopy-safe setting that the flags of this run made. Open `lessons/heating/beaker.png` to look at it.

| Flag | Meaning |
| --- | --- |
| `--out <dir>` | The folder for the files. Default `lesson-diagrams`. |
| `--name <slug>` | The start of the file names, at most 100 characters. Default: the name of the input file. |
| `--scale 1`, `2`, `4` | Pixels of the PNG for each unit. Default 2. Use 4 for print. |
| `--labels shown`, `text`, `blank`, `letters` | Which labels to draw. `shown` (the default) is as the diagram is saved; `text` is the label texts, whatever the diagram says; `blank` is a line to write on; `letters` is A, B, C. |
| `--answer-key` | With `--labels letters`: the key under the diagram, in a file named `-letters-key`. |
| `--mono` | Photocopy-safe: black line only, dashes for liquids. Every file of the run, each named `-mono`. |
| `--transparent` | A transparent background instead of white. |
| `--variants` | Every label mode, and the photocopy-safe copy: see the file names below. |
| `--student` | The copies for students only: PNG files, no SVG, no saved diagram (both hold the label texts), no key. With `--labels blank` or `--labels letters`, or with `--variants` (the blank and letters copies). |
| `--no-png`, `--no-svg` | Leave that file out. |
| `--explain` | Also show how each part was placed, and every anchor with its kind and direction. |
| `--template <id>` | Draw one of the 43 templates instead of a file. With `--explain` it gives the world position of every anchor, to copy offsets. |
| `--list templates`, `--list symbols` | List what there is. |
| `--symbol <id>` | One symbol in full: size, resize mode, parameters, cavities, anchors with their directions. |
| `--find <words>` | The symbols and templates that match the words (names, aliases, titles and notes of templates), one line for each, with the pack or group: `npm run render -- --find filter funnel`. |

The input can also be a saved diagram (`.pracdraw.json`) or an SVG that PracDraw wrote: the command draws it as it is, so it makes the pictures of a diagram that you changed in the editor.

The same input gives the same files, byte for byte.

**Exit codes.** 0: the files are written (warnings may be printed). 1: the command or the recipe is wrong: a flag, a name, a folder that is a file, an input that is a folder or not JSON, a recipe with errors (a numbered list with the path and a hint for each). It is found before anything is drawn, and nothing is written. 2: the browser or the build failed; run `npm ci`, then `npx playwright install chromium`, then `npm run build` to see why.

## The files, and who gets which

The name of a file says what is in it: `<name>`, then `-blank`, `-letters` or `-letters-key` for the labels (text has no suffix), then `-mono` when it is photocopy-safe.

- `<name>.png`: the labels as text. It has the answers: for slides and for the teacher.
- `<name>-blank.png`: a line to write on for each label. For students; no answers.
- `<name>-letters.png`: letters A, B, C and no key. For students, as an exam paper; no answers.
- `<name>-letters-key.png`: letters with the key under the diagram. The mark scheme; it has the answers.
- `<name>-mono.png`: the picture as the diagram says it, photocopy-safe. With `--mono`, every name has `-mono` (`-blank-mono`, `-letters-key-mono`).
- `<name>.svg` (and the SVGs of the copies): the same as a vector picture. The editable diagram is inside it, in its metadata, and so are the label texts: a blank or lettered SVG still holds the answers. Give students the PNG.
- `<name>.pracdraw.json`: the diagram. To change it by hand, open `dist/index.html` in a browser and use **Open** (Ctrl+O) with this file or with an SVG. Save and export from there as usual. It holds the label texts: it is the teacher's.

`--variants` writes all of these. `--student` writes only the copies for students, as PNG files, and says that the source is not written: the teacher's copy comes from a normal run. The output says for each file what it is for ("student copy, no answers", "mark scheme, has the answers").

## The recipe

A recipe has `title`, `parts`, and optionally `settings`, `connectors` and `labels`. Distances are in units, 1 unit = 1 pixel at 100 % zoom; x goes right and y goes down. The most is 300 parts, 300 connectors and 300 labels (a lesson diagram rarely needs 40 parts); a part, a point or a text is within 5000 u of the origin, and a size is from 1 to 5000 u.

**Parts** are drawn in list order, back to front. Each is placed on a part listed before it, by anchors, the named points of a symbol (`npm run render -- --symbol beaker` lists them):

- `"on": { "part": "mat", "anchor": "top", "own": "feet" }`: the part's own anchor `own` goes on that anchor. `dx`, `dy` move it afterwards; `out` moves it along the direction of the anchor.
- `"near": { "part": "flask", "anchor": "base", "dx": 112, "dy": -33 }`: its centre goes there. For a stopwatch or a ribbon, which have no anchors.
- `"at": { "x": 0, "y": 0, "anchor": "under" }`: its own anchor on a point of the world. For the first part: y = 0 is the bench.
- `"alignX"` and `"alignY"`: one coordinate each. A clamp stand uses both: its rod under the clamp, its base on the bench.
- `rot` (degrees clockwise), `flip`, `size` (`{ "w": 100, "h": 200 }`; `h` can be `{ "between": [point, point] }`), `params` (the options of the symbol), `contents` (liquids and solids in a cavity: `{ "main": [{ "preset": "Water", "amount": 0.6 }] }`, or `"reading": 25` to put the surface at 25 on the scale).
- `"behind": "burette"` draws a part just behind another (a clamp behind the vessel it grips, or a test-tube holder behind its tube); `"back": true` draws it behind everything (a clamp stand).

**Connectors** (`glassTube`, `rubberTube`, `wire`, `line`) are drawn after all the parts. Their points are anchors (`{ "part": "flask", "anchor": "mouth", "dy": 46 }`), steps (`{ "dy": -60 }`), points (`{ "x": 0, "y": 0 }`), or runs that go upright or level to an anchor (`{ "y": { "part": "flask", "anchor": "mouth", "dy": -62 } }`). A point may have `"r": 8`, its bend radius.

**Labels** are made as Label all makes them in the editor: one text for each part, in columns beside the diagram, with leaders that do not cross. Every label is fixed to its part, so the blank and the letters versions work.

- `labels.text` changes a text; `labels.skip` leaves parts out; `labels.auto: false` leaves out every automatic label.
- `labels.side` moves a label to the other side of the diagram.
- `labels.end` moves only the end of the leader of an automatic label: `"end": { "funnel": { "at": [36, 8] } }` (a point of the part, in the part's own frame: for a part that is turned with `rot`, the frame before it is turned), or `{ "anchor": "mouth", "dx": 5, "dy": 8 }`.
- `labels.order` puts the labels of the listed parts first, in that order, so that the letters match a question ("A is the burette"). The letters, and the lines of the key, follow the order of the labels.
- `labels.extra` adds labels: on a part (`"at": [30, 90]` is a point of the part's frame; `"anchor"` an anchor), on a connector or a `line` (`"connector": "tube", "along": 0.3`; name it by its `id`, or by the id it gets: its kind and its place in the list, such as `glassTube1`), or on a place, with `side` and `textAt` to set where the text goes, `end` for an arrow or a dot, and `size`.

**Settings**: `labelMode` (`text`, `blank`, `letters`), `mono`, `labelSize`, `smartText`.

Contents use the preset names of `.claude/skills/pracdraw/reference/presets.md`. A cavity holds up to four layers, listed from the bottom; at most one is a gas, and it is last; lumps are first. A funnel's cavity includes its stem (an amount up to 0.55 fills only the stem). A filter paper in the 84 u filter funnel is `"size": { "w": 68 }`. A pipette's mark is reached by `"amount": 0.845`, a volumetric flask's by `"amount": 0.806`.

The skill has the whole format with two worked examples, and `.claude/skills/pracdraw/examples/` has nine more recipes that were drawn and looked at: a heated beaker, a titration, gas collected over water, a circuit, a cooling curve, a filtration, a dilution with a pipette, a boiling tube in a holder and Hooke's law.

## Problems and checks

A recipe with a mistake gets a numbered list: where (the path in the recipe), what is wrong, and a hint that names the fix, for example:

```
1. error at parts[0].symbol
   Unknown symbol "beker".
   hint: Nearest symbols: beaker (Beaker). The whole list is in reference/symbols.md, or run: npm run render -- --list symbols
```

All the problems are listed, not only the first. After a good recipe the command checks the layout and warns about: two leaders that cross; a leader that crosses another part from side to side; a text, or the 100 u line of blank mode, that runs into a part or into another text; a label wider than the 100 u line (keep each label to one or two words for a worksheet); two vessels drawn through each other; a symbol that failed to build; a connector that draws nothing; a leader that ends in empty space; and a clamp drawn in front of the vessel it grips. At most 25 warnings are shown, and the rest are counted. The command also warns when the picture is more than 4000 u on a side, and when a PNG is smaller than the scale asks for because a PNG is at most 8192 pixels on a side and 16 million in all. The checks cannot see everything: look at the picture.

## What it cannot draw

Graphs and tables, skeletal or structural formulae, imported pictures, animation, pouring liquids, 3D views, and people and hands: a pipette and its filler, or the handle of a test-tube holder, are drawn with nothing holding them (add a hand in the editor if you want one). Symbols that are not in the editor (`reference/symbols.md` lists the ones that are planned) cannot be used.

## For Claude, and when the symbols change

The skill is `.claude/skills/pracdraw/`. Its `reference/` files (symbols, templates, presets) are written from the code and the plan: run `npm run gen:skill` after a symbol, a template or a preset changes. A unit test fails when they are out of date.
