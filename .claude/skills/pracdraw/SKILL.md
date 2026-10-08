---
name: pracdraw
description: Draw a diagram of science apparatus for a lesson, worksheet or exam question, with no person at the editor. Use it when asked for a diagram of a lab set-up, a required practical, a circuit, labelled apparatus, or a worksheet or exam diagram. It writes an editable SVG, a PNG and the saved PracDraw document from a short JSON recipe, and checks the layout. It cannot draw graphs, tables, structural formulae, imported pictures, people or animation.
---

# PracDraw: apparatus diagrams from a recipe

PracDraw is a diagram editor with apparatus and circuit symbols (`reference/symbols.md`) and ready-made set-ups (`reference/templates.md`). You work without the editor: you write a recipe (JSON), run one command, look at the PNG, fix, and write the files.

Run every command from the `pracdraw/` folder of this repository (`npm ci` there once if `node_modules` is missing). The first run builds the editor, which takes about 2 seconds.

## The loop

1. Read the request. Name the apparatus, what each part holds, and what a student must label.
2. Find the symbols and the set-up: `npm run render -- --find <words>` (for example `--find filter funnel`) searches the names, the aliases and the titles and notes of the templates, and prints one line for each hit with its pack or group. Look in `reference/templates.md` first: if the set-up is there, `npm run render -- --template <id> --out <dir>` draws it at once, and `--explain` lists its parts with their anchors, so that you can copy their offsets into a recipe. If your diagram is close to one of `examples/*.json`, copy that recipe.
3. Look up each symbol in `reference/symbols.md` (id, size, parameters, cavities, anchors), or run `npm run render -- --symbol <id>`. A symbol id that is wrong is an error that names the nearest ids.
4. Write the recipe: one JSON file, in a folder of your own (not in `pracdraw/`).
5. Run `npm run render -- <recipe.json> --out <dir>`. Errors come as a numbered list with the path in the recipe and a hint; nothing is written until there are none. Warnings (layout faults) come with hints too: fix them.
6. Open `<dir>/<name>.png` with the Read tool and look at it. Check the list under "Look at the picture" below. The text after the file lines says where every part, anchor and label is, so you can reason in numbers as well.
7. Fix the recipe and run again, until the picture is right and the checks are clean.
8. Make the copies that the person needs (see "Student copies and teacher copies").

```
npm run render -- <recipe.json | file.pracdraw.json | file.svg> [--out <dir>] [--name <slug>] [--scale 1|2|4]
                  [--labels shown|text|blank|letters] [--mono] [--answer-key] [--transparent]
                  [--variants] [--student] [--no-png] [--no-svg] [--explain]
npm run render -- --template <id> [same flags]      npm run render -- --list templates | symbols
npm run render -- --symbol <id>                     npm run render -- --find <words>
```

`--labels shown` (the default) draws the labels as the recipe's `labelMode` says; `text` draws the label texts whatever the recipe says; `blank` and `letters` draw a line to write on, or A, B, C. `--explain` also shows how each part was placed and every anchor with its kind and direction. `--scale` is the pixels of the PNG for each unit (default 2; 4 for print). The default folder is `lesson-diagrams`. The same recipe always gives the same bytes. It needs no network.

Exit codes: 0 the files are written (warnings may be printed); 1 the command or the recipe is wrong, found before anything is drawn, and nothing is written: read the message and fix it; 2 the browser or the build failed: run `npm ci` in `pracdraw/`, then `npx playwright install chromium`, then `npm run build` to see the error, and tell the person if it still fails.

## Student copies and teacher copies

The name of a file says what is in it: `<name>`, then `-blank`, `-letters` or `-letters-key` for the labels (text has no suffix), then `-mono` when it is photocopy-safe. So `--labels blank --mono` writes `<name>-blank-mono.png`.

- `<name>.png`: the labels as text. It has the answers. For slides and for the teacher.
- `<name>-blank.png`: a line to write on for each label. For students; no answers.
- `<name>-letters.png`: letters A, B, C and no key. For students (an exam paper); no answers.
- `<name>-letters-key.png`: letters with the key under the diagram. The mark scheme; it has the answers.
- `<name>-mono.png`: the picture as the recipe says it, black line only, for the photocopier.
- `--variants` writes all of these (PNG and SVG), and the `.pracdraw.json`. `--mono` makes every file photocopy-safe and puts `-mono` on every name. `--labels letters --answer-key` makes the keyed picture the one that is written.
- Give students only the PNG of a copy marked "student copy" in the output. The SVG and the `.pracdraw.json` hold the label texts in their metadata, so that the editor can open them again: they are the teacher's.
- `--student` writes the student copies and nothing else: PNG files, no SVG, no saved diagram, no key. With `--variants` it writes the blank and letters copies; or give `--labels blank` or `--labels letters`. It says that the source is not written: the teacher's copy comes from a normal run.
- The letters, and the lines of the key, follow the order of the labels. `labels.order` sets that order, so that "A is the burette" can match the question.
- Each label should be one or two words, at most 100 u wide: blank mode draws a line of 100 u for the answer, and the checks warn about a longer text.

## The recipe

Units are world units: 1 unit is 1 pixel at 100 % zoom. x goes right and y goes down, so a negative `dy` is up. A recipe has `title`, `parts`, and optionally `settings`, `connectors` and `labels`. A key it does not know is an error with a hint. `"note"` may be added to the recipe, a part, a connector or an extra label, as a comment. The most is 300 parts, 300 connectors and 300 labels (a lesson diagram rarely needs 40 parts); a part, a point or a text is within 5000 u of the origin, and a size is from 1 to 5000 u.

**Parts** are drawn in list order, back to front. Place each one on a part listed before it, by anchors, not by coordinates:

| key | meaning |
| --- | --- |
| `id`, `symbol` | A name that you choose (it starts with a letter, then letters, digits, `_` and `-`, at most 40 characters), and the symbol id. |
| `on` | `{ "part": "mat", "anchor": "top", "own": "feet", "dx": 0, "dy": 0 }`: the part's own anchor `own` goes on that anchor of an earlier part. `out: 30` moves the point 30 along the direction of the anchor (negative goes back into the part). |
| `near` | `{ "part": "flask", "anchor": "base", "dx": 112, "dy": -33 }`: its centre goes there. For a symbol with no anchors (stopwatch, ribbon). |
| `at` | `{ "x": 0, "y": 0, "anchor": "under" }`: its own anchor (or its centre) on a point of the world. Use it for the first part: y = 0 is then the bench. |
| `alignX`, `alignY` | `{ "part": "clamp", "anchor": "sleeve", "own": "rod" }`: fix one coordinate only. A clamp stand uses both: the rod under the clamp, the base on the bench. |
| `rot`, `flip` | Degrees clockwise; mirror left to right. |
| `size` | `{ "w": 100, "h": 200 }`, within what the symbol's resize mode allows. `h` may be `{ "between": [point, point] }`: the distance between two anchors, such as a stand from the bench to above its clamp. |
| `params` | The parameters of the symbol, such as `{ "graduations": true }`. |
| `contents` | `{ "main": [layers] }`, by cavity, bottom layer first. A layer is `{ "preset": "Water", "amount": 0.6 }` or `{ "preset": "Water", "reading": 37 }`. See `reference/presets.md`. |
| `behind`, `back` | `"behind": "burette"` draws this part just behind that one. `"back": true` draws it behind everything. |

An anchor is named by its id or by its kind when only one anchor has that kind (`"surface"`, `"base"`). Anchors that fit: `base` on `surface`; `mouth` and `plug` (a bung, the `tip` of a tube); `round` in `cup`; `neck` in `grip` (a clamp or a test-tube holder); `rod` and `sleeve`; `port` with `port` (a spring and its hanger, the ends of tubes); `heat` with the bottom of a vessel (a flame under a tube).

**Contents** are fractions of the height of a cavity, or `reading`s on its scale: `{ "preset": "Water", "reading": 25 }` puts the surface of a measuring cylinder, burette or thermometer at 25. A measuring cylinder with `"rot": 180` (a gas collected) takes the volume of gas as its reading. At most 4 layers; at most one gas, last, with no amount; lumps first. Two things to know about the fill:

- A funnel's cavity includes its stem: an `amount` up to 0.55 fills only the stem. A filter paper in the 84 u filter funnel is `filterPaper` with `"size": { "w": 68 }`: the default paper, 76 u, nearly touches the wall of the funnel, and its dashes then read as a thick wall.
- A graduation mark is not at the `neck` anchor. On a `volumetricPipette` the mark is at 0.16 × the height from the top (48 u at the default height 300), 9.5 u above `neck`: `"amount": 0.845` puts the surface on it. On a `volumetricFlask` the mark is at 0.2 × the height (42 u at the default 210), 15.6 u above `neck`: `"amount": 0.806` puts the surface on it. (Checked in pictures.)

**Connectors** are drawn after all the parts (so a tube through a bung is in front of it), in list order, unless they say `behind` or `back`. `kind` is `glassTube`, `rubberTube`, `wire` or `line`; options are `id`, `width`, `radius` (the bend), `dash` (wire and line), `startCap` and `endCap` (`none` or `closed` for a tube; `none`, `arrow`, `dot` or `tick` for a wire or line). A point is:

- `{ "part": "flask", "anchor": "mouth", "dy": 46 }`: an anchor, moved by `dx`, `dy` or `out`.
- `{ "dx": 0, "dy": -60 }`: a step from the point before.
- `{ "x": 0, "y": 0 }`: a point of the world.
- `{ "y": { "part": "flask", "anchor": "mouth", "dy": -62 } }` or `{ "x": 120 }`: go upright or level from the point before, to where that anchor or number is. A tube is a chain of these.
- Any point may have `"r": 8`, the bend radius at that point (0 for a sharp corner).

**Labels** are Label all by default: one text for each part, in columns beside the diagram, with leaders that do not cross. Each is fixed to its part, so the blank and letters versions work. Write formulae as you type them: `H2SO4`, `cm3`, `Cu2+` are set correctly.

- `"text": { "beaker": "250 cm3 beaker" }` changes a text. `"skip": ["mat"]` leaves parts out. `"auto": false` leaves out every automatic label, so that only the `side` and `extra` labels are made.
- `"side": { "stand": "left" }` puts a part's text on that side, when its leader would cross the diagram.
- `"end": { "funnel": { "at": [36, 8] } }` moves only the end of the leader of an automatic label: `at` is a point of the part in its own frame (x = 0 is its centre line, y = 0 its top), or `{ "anchor": "mouth", "dx": 5, "dy": 8 }`. For a part turned with `rot`, `at` is in the part's own frame before it is turned: the same point of the part, wherever it is turned to. The label stays in its column.
- `"order": ["burette", "flask", "clamp"]` puts the labels of these parts first, in that order (all the labels of a part together), then the others as before. The letters of letters mode follow the order of the labels, so this makes A the burette.
- `"extra"`: `{ "text": "water", "part": "beaker", "at": [30, 90] }` points at a point of the part's own frame; `"anchor"` points at an anchor. `"connector": "tube", "along": 0.3` points at a tube or a `line` (name it by its `id`, or by the id it gets when it has none: its kind and its place in the list, such as `glassTube1`): its text goes just above it on a level run, and beside it on an upright run. `"point": { "x": 0, "y": 0 }` points at a place. `"near": {...}` is plain text with no leader. `"side": "left"` alone puts the text in the column on that side. `"textAt": [dx, dy]` sets where the text starts, from where the leader ends; with `"side": "right"` put it to the right and above the leader end, so that the leader does not run under the text. `"end": "arrow"` or `"dot"` ends the leader; `"size": 12` is the size of this text.

**Settings**: `labelMode` (`text`, `blank` for a line to write on, `letters` for A, B, C), `mono` (photocopy-safe), `labelSize` (15), `smartText` (true).

## Worked example 1: a beaker, heated, with a reading

The thermometer reads 60 degrees; the beaker is 60 % full of water. The tripod and the burner stand on the mat, the gauze on the tripod, the beaker on the gauze, and the thermometer stands in the beaker.

```json
{
  "title": "Heating water in a beaker",
  "parts": [
    { "id": "mat", "symbol": "heatproofMat", "at": { "x": 0, "y": 0, "anchor": "under" } },
    { "id": "tripod", "symbol": "tripod", "on": { "part": "mat", "anchor": "top", "own": "feet" } },
    { "id": "burner", "symbol": "bunsenBurner", "on": { "part": "mat", "anchor": "top", "own": "base" } },
    { "id": "gauze", "symbol": "gauze", "on": { "part": "tripod", "anchor": "top", "own": "under" } },
    {
      "id": "beaker",
      "symbol": "beaker",
      "params": { "graduations": true },
      "on": { "part": "gauze", "anchor": "top", "own": "base" },
      "contents": { "main": [{ "preset": "Water", "amount": 0.6 }] }
    },
    {
      "id": "thermometer",
      "symbol": "thermometer",
      "size": { "h": 200 },
      "on": { "part": "beaker", "anchor": "base", "own": "bulb", "dx": 16, "dy": -12 },
      "contents": { "main": [{ "reading": 60 }] }
    }
  ],
  "labels": {
    "text": { "gauze": "wire gauze" },
    "extra": [{ "text": "water", "part": "beaker", "at": [30, 90] }]
  }
}
```

## Worked example 2: a delivery tube, a clamp and a stand

A gas is collected over water in an upside-down measuring cylinder, which a clamp holds. The clamp is drawn behind the cylinder, the stand behind everything. The stand's height comes from two anchors, so it is right whatever the apparatus is. The tube is a chain of upright and level runs between anchors. The stand is on the right, with the cylinder and the trough in front of it: a leader from the column on the right to the trough would cross the rod, so the text of the cylinder goes to the top of the cylinder (`end`), above the rod, and the text of the trough goes below it (`textAt`).

```json
{
  "title": "Collecting a gas over water",
  "parts": [
    {
      "id": "flask",
      "symbol": "conicalFlask",
      "at": { "x": 0, "y": 0, "anchor": "base" },
      "contents": { "main": [{ "preset": "Colourless solution", "amount": 0.3, "bubbles": "few" }] }
    },
    { "id": "bung", "symbol": "bung", "on": { "part": "flask", "anchor": "mouth", "own": "plug" } },
    {
      "id": "trough",
      "symbol": "trough",
      "on": { "part": "flask", "anchor": "base", "own": "base", "dx": 310 },
      "contents": { "main": [{ "preset": "Water", "amount": 0.62 }] }
    },
    {
      "id": "cylinder",
      "symbol": "measuringCylinder",
      "rot": 180,
      "size": { "h": 170 },
      "on": { "part": "trough", "anchor": "base", "own": "mouth", "dx": 35, "dy": -22 },
      "contents": { "main": [{ "preset": "Water", "reading": 34 }, { "preset": "Colourless gas" }] }
    },
    {
      "id": "clamp",
      "symbol": "bossClamp",
      "size": { "w": 162 },
      "flip": true,
      "params": { "grip": 36 },
      "on": { "part": "cylinder", "anchor": "mouth", "own": "grip", "dy": -96 },
      "behind": "cylinder"
    },
    {
      "id": "stand",
      "symbol": "clampStand",
      "size": { "h": { "between": [{ "part": "flask", "anchor": "base" }, { "part": "clamp", "anchor": "sleeve", "dy": -22 }] } },
      "alignX": { "part": "clamp", "anchor": "sleeve", "own": "rod" },
      "alignY": { "part": "flask", "anchor": "base", "own": "base" },
      "back": true
    }
  ],
  "connectors": [
    {
      "id": "tube",
      "kind": "glassTube",
      "points": [
        { "part": "flask", "anchor": "mouth", "dy": 46 },
        { "y": { "part": "flask", "anchor": "mouth", "dy": -62 } },
        { "x": { "part": "trough", "anchor": "base", "dx": -90 } },
        { "y": { "part": "trough", "anchor": "base", "dy": -30 } },
        { "x": { "part": "cylinder", "anchor": "mouth" } },
        { "y": { "part": "cylinder", "anchor": "mouth", "dy": -36 } }
      ]
    }
  ],
  "labels": {
    "text": { "cylinder": "cylinder", "clamp": "clamp" },
    "skip": ["trough"],
    "end": { "cylinder": { "at": [-22, 140] } },
    "extra": [
      { "text": "34 cm3 of H2", "part": "cylinder", "at": [0, 150] },
      { "text": "delivery tube", "connector": "tube", "along": 0.3 },
      { "text": "trough", "part": "trough", "at": [0, 90], "textAt": [-30, 52] }
    ]
  }
}
```

All the recipes of `examples/` were rendered and looked at, and have no layout warning: `heating-beaker.json` (example 1), `gas-over-water.json` (example 2, with a magnesium ribbon, a stopwatch and more labels), `titration.json` (burette, clamp, stand, tile), `circuit.json` (wires between circuit symbols, labels with `textAt`), `cooling-curve.json` (a tube in a water bath; a stand beside the apparatus, flipped; a stopwatch beside the stand), `filtration.json` (funnel, paper and residue, with the leader ends of the template), `dilution.json` (a pipette with its filler, a volumetric flask with its mark), `boiling-tube.json` (a tube in a holder over a spirit burner) and `hookes-law.json` (spring, masses, ruler, with `labels.end` and `labels.side`).

## House rules

- Place by anchors. Do not type coordinates for a part that can stand on another. A part with no placement sits at the origin, on top of the rest.
- The first part defines the bench: put it at `y = 0` with `at` (the `under` or `base` anchor), and stand other things on it.
- A part with no anchors (a stopwatch, a ribbon) is placed with `near`. Give it a `dy` that stands it on the bench, not above it, and put it where no leader has to cross it: on the side with few labels (`examples/cooling-curve.json` has the stopwatch beside the stand). The checks do not see every leader that runs over a part.
- Draw the parts a student would label, and nothing more. Leave the bench, the mat and the stand unlabelled with `skip` unless they matter.
- Joined glassware that is heated (reflux, distillation) is open to the air at exactly one point, and every joint is drawn sealed, with no gap. Reflux is open at the top of the condenser; a distillation is open where the distillate leaves. Never draw a sealed flask that is heated with nowhere for the gas to go, or one that is open in two places.
- A connector is drawn after the item it passes through. This is the default. A tube goes through the hole of a bung (`hole1`), and its end goes below the surface of the liquid it bubbles into. A delivery tube does not dip into the liquid it comes from.
- A clamp that grips an upright vessel is drawn behind it (`behind`); so is a test-tube holder. A clamp stand is drawn behind everything (`back`). The clamp width (`size.w`) sets how far the stand stands from the vessel; a stand beside the apparatus on the left needs `flip: true`, so that its base plate points away.
- Liquids stand at sensible levels (half to two thirds of a beaker; a thermometer bulb in the liquid, not on the bottom). For a reading question put the value in `reading`, not in the text.
- A worksheet: make the copies as in "Student copies and teacher copies", and give students the PNG files. Keep each label to one or two words.
- Put only the labels on the diagram that the question asks for. A leader may not run across another part: put the text on the other side with `side`, or end the leader at another point of its part with `end`. In blank mode each label is a line of 100 u: keep 100 u free beside each leader end.
- Parts in the air: a pipette and its filler, or the handle of a test-tube holder, have no hand to hold them, because there is no hand or person symbol. The diagram shows the apparatus unsupported; the teacher may add a hand in the editor, if they want.

## Look at the picture

Open the PNG and check each of these before you hand it over.

1. Every part is there and looks like what it should.
2. Parts touch where they should: a burette tip in the neck of the flask, a beaker on the gauze, a bung in the mouth, a stand under its clamp. Nothing floats, nothing overlaps that should not.
3. Liquids are level, at sensible heights, and the readings are the ones asked for. Compare a liquid with a mark that the symbol draws (a pipette, a volumetric flask): see "Contents".
4. Tubes and wires reach both ends and do not run through other parts.
5. Each leader ends on the part it names, and not on a part in front of it. No two leaders cross. No text runs into the drawing.
6. Nothing is cut off or very small. A very wide picture (over about 1200 units) is small on a slide: bring the parts closer.

The checks at the end of the output find: leaders that cross each other; a leader that crosses another part from side to side; text, or the 100 u line of blank mode, that runs into a part or into other text; a label wider than 100 u; two vessels drawn through each other; a leader that ends in empty space; a clamp drawn in front of its vessel; a symbol that failed to build; a connector that draws nothing. Fix every warning (at most 25 are shown; the rest are counted). They cannot see everything: read the `box` of each part in the description, to see that parts touch and that nothing is far away; a leader that ends on the wrong part but near the right one; the end of a leader with no label; a liquid that is level with the wrong mark; a leader that runs through something in front of it.

## Common mistakes

- A part with no placement, or placed on the wrong anchor (`own` forgotten: use the anchor on the part that is being placed, for example `base` of a beaker on a `surface`).
- Forgetting `behind` on a clamp or a holder, so that its jaws cross the glass; or the stand's plate under the apparatus when it should stand beside it.
- A stand that is too short or too tall: give `h` as `between` the bench and a point above the clamp.
- A `reading` on a part that is turned, or on a symbol with no scale (burette, measuring cylinder, thermometer and the magnified scale have one).
- A wrong `at` for a label: it points at empty space. The point is in the part's own frame; read the anchors of the symbol, or use `"anchor"`.
- A label of three words or more in a worksheet: it is longer than the line to write on.
- A symbol id that is not in the list: the error names the nearest ones, and `--find` searches by words.
- Trying to draw what is not in the tool (below).

## What it cannot draw

Graphs and tables; skeletal or structural formulae; pictures that are imported; animation; pouring liquids; 3D or perspective views; people and hands (there is no person or hand symbol: a pipette in use, a holder in a hand and a student at the bench are drawn as apparatus with nothing holding it); a symbol that is not in `reference/symbols.md` (it lists the ones planned and not drawn yet). For those, say so, and draw the part of the diagram that it can.

## The files

- `<name>.png`: the picture, 2 pixels to the unit. Use `--scale 4` for print. The PNG is not larger than 8192 pixels on a side or 16 million in all: a picture over 4000 u or a big scale is warned about.
- `<name>.svg`: the same as an SVG, with the document in its metadata. Office software opens it as a picture; PracDraw opens it for editing.
- `<name>.pracdraw.json`: the document. To tweak a diagram by hand, open the built editor (`pracdraw/dist/index.html`) and use Open with this file or the SVG.
