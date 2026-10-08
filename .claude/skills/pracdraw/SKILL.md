---
name: pracdraw
description: Draw a diagram of science apparatus for a lesson, worksheet or exam question, with no person at the editor. Use it when asked for a diagram of a lab set-up, a required practical, a circuit, labelled apparatus, or a worksheet or exam diagram. It writes an editable SVG, a PNG and the saved PracDraw document from a short JSON recipe, and checks the layout. It cannot draw graphs, tables, structural formulae, imported pictures or animation.
---

# PracDraw: apparatus diagrams from a recipe

PracDraw is a diagram editor with apparatus and circuit symbols (`reference/symbols.md`) and ready-made set-ups (`reference/templates.md`). You work without the editor: you write a recipe (JSON), run one command, look at the PNG, fix, and write the files.

Run every command from the `pracdraw/` folder of this repository (`npm ci` there once if `node_modules` is missing). The first run builds the editor, which takes about 10 seconds.

## The loop

1. Read the request. Name the apparatus, what each part holds, and what a student must label.
2. Look in `reference/templates.md` for the set-up. If it is there, `npm run render -- --template <id> --out <dir>` draws it at once. If your diagram is close to one of `examples/*.json`, copy that recipe.
3. Look up each symbol in `reference/symbols.md` (id, size, parameters, cavities, anchors), or run `npm run render -- --symbol <id>`. Find a symbol by words with `npm run render -- --list symbols`.
4. Write the recipe: one JSON file, in a folder of your own (not in `pracdraw/`).
5. Run `npm run render -- <recipe.json> --out <dir>`. Errors come as a numbered list with the path in the recipe and a hint; nothing is written until there are none. Warnings (layout faults) come with hints too: fix them.
6. Open `<dir>/<name>.png` with the Read tool and look at it. Check the list under "Look at the picture" below. The text after the file lines says where every part, anchor and label is, so you can reason in numbers as well.
7. Fix the recipe and run again, until the picture is right and the checks are clean.
8. Make the variants: `--variants` also writes `-blank`, `-letters` (with the answer key) and `-mono` (photocopy-safe) pictures. Give the person the PNG files they asked for, and the `.pracdraw.json`.

```
npm run render -- <recipe.json | file.pracdraw.json | file.svg> [--out <dir>] [--name <slug>] [--scale 2|4]
                  [--labels shown|text|blank|letters] [--mono] [--answer-key] [--transparent]
                  [--variants] [--no-png] [--no-svg] [--explain]
npm run render -- --template <id> [same flags]      npm run render -- --list templates | symbols
npm run render -- --symbol <id>
```

`--explain` also shows how each part was placed and every anchor with its kind and direction. The default folder is `lesson-diagrams`. The same recipe always gives the same bytes. It needs no network.

## The recipe

Units are world units: 1 unit is 1 pixel at 100 % zoom. x goes right and y goes down, so a negative `dy` is up. A recipe has `title`, `parts`, and optionally `settings`, `connectors` and `labels`. A key it does not know is an error with a hint. `"note"` may be added to the recipe, a part, a connector or an extra label, as a comment.

**Parts** are drawn in list order, back to front. Place each one on a part listed before it, by anchors, not by coordinates:

| key | meaning |
| --- | --- |
| `id`, `symbol` | A name that you choose (letters, digits, `_`, `-`), and the symbol id. |
| `on` | `{ "part": "mat", "anchor": "top", "own": "feet", "dx": 0, "dy": 0 }`: the part's own anchor `own` goes on that anchor of an earlier part. `out: 30` moves the point 30 along the direction of the anchor (negative goes back into the part). |
| `near` | `{ "part": "flask", "anchor": "base", "dx": 112, "dy": -33 }`: its centre goes there. For a symbol with no anchors (stopwatch, ribbon). |
| `at` | `{ "x": 0, "y": 0, "anchor": "under" }`: its own anchor (or its centre) on a point of the world. Use it for the first part: y = 0 is then the bench. |
| `alignX`, `alignY` | `{ "part": "clamp", "anchor": "sleeve", "own": "rod" }`: fix one coordinate only. A clamp stand uses both: the rod under the clamp, the base on the bench. |
| `rot`, `flip` | Degrees clockwise; mirror left to right. |
| `size` | `{ "w": 100, "h": 200 }`, within what the symbol's resize mode allows. `h` may be `{ "between": [point, point] }`: the distance between two anchors, such as a stand from the bench to above its clamp. |
| `params` | The parameters of the symbol, such as `{ "graduations": true }`. |
| `contents` | `{ "main": [layers] }`, by cavity, bottom layer first. A layer is `{ "preset": "Water", "amount": 0.6 }` or `{ "preset": "Water", "reading": 37 }`. See `reference/presets.md`. |
| `behind`, `back` | `"behind": "burette"` draws this part just behind that one. `"back": true` draws it behind everything. |

An anchor is named by its id or by its kind when only one anchor has that kind (`"surface"`, `"base"`). Anchors that fit: `base` on `surface`; `mouth` and `plug` (a bung, the `tip` of a tube); `round` in `cup`; `neck` in `grip` (a clamp); `rod` and `sleeve`.

**Contents** are fractions of the height of a cavity, or `reading`s on its scale: `{ "preset": "Water", "reading": 25 }` puts the surface of a measuring cylinder, burette or thermometer at 25. A measuring cylinder with `"rot": 180` (a gas collected) takes the volume of gas as its reading. At most 4 layers; at most one gas, last, with no amount; lumps first.

**Connectors** are drawn after all the parts (so a tube through a bung is in front of it), in list order, unless they say `behind` or `back`. `kind` is `glassTube`, `rubberTube`, `wire` or `line`; options are `id`, `width`, `radius` (the bend), `dash` (wire and line), `startCap` and `endCap` (`none` or `closed` for a tube; `none`, `arrow`, `dot` or `tick` for a wire or line). A point is:

- `{ "part": "flask", "anchor": "mouth", "dy": 46 }`: an anchor, moved by `dx`, `dy` or `out`.
- `{ "dx": 0, "dy": -60 }`: a step from the point before.
- `{ "x": 0, "y": 0 }`: a point of the world.
- `{ "y": { "part": "flask", "anchor": "mouth", "dy": -62 } }` or `{ "x": 120 }`: go upright or level from the point before, to where that anchor or number is. A tube is a chain of these.

**Labels** are Label all by default: one text for each part, in columns beside the diagram, with leaders that do not cross. Each is fixed to its part, so the blank and letters versions work.

- `"text": { "beaker": "250 cm3 beaker" }` changes a text. Write formulae as you type them: `H2SO4`, `cm3`, `Cu2+` are set correctly.
- `"skip": ["mat"]` leaves parts out. `"side": { "stand": "left" }` puts a part's text on that side, when its leader would cross the diagram.
- `"extra"`: `{ "text": "water", "part": "beaker", "at": [30, 90] }` points at a point of the part's own frame (x = 0 is its centre line, y = 0 its top); `"anchor"` points at an anchor. `"connector": "tube", "along": 0.3` points at a tube (give it an `id`): its text goes just above it. `"point": { "x": 0, "y": 0 }` points at a place. `"near": {...}` is plain text with no leader. `"textAt": [dx, dy]` sets where the text starts, from where the leader ends; with `"side": "right"` put it to the right and above the leader end, so that the leader does not run under the text. `"end": "arrow"` or `"dot"` ends the leader.

**Settings**: `labelMode` (`text`, `blank` for a line to write on, `letters` for A, B, C), `mono` (photocopy-safe), `labelSize` (15), `smartText` (true).

## Worked example 1: a beaker, heated, with a reading

The thermometer reads 60 degrees; the beaker is 60 % full of water. Every part stands on the one before by its anchors.

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
    "text": { "beaker": "250 cm3 beaker" },
    "extra": [{ "text": "water", "part": "beaker", "at": [30, 90] }]
  }
}
```

## Worked example 2: a delivery tube, a clamp and a stand

A gas is collected over water in an upside-down measuring cylinder, which a clamp holds. The clamp is drawn behind the cylinder, the stand behind everything. The stand's height comes from two anchors, so it is right whatever the apparatus is. The tube is a chain of upright and level runs between anchors.

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
    "text": { "cylinder": "100 cm3 measuring cylinder", "trough": "trough of water", "clamp": "clamp" },
    "extra": [
      { "text": "34 cm3 of H2", "part": "cylinder", "at": [0, 150] },
      { "text": "delivery tube", "connector": "tube", "along": 0.3 }
    ]
  }
}
```

All the recipes of `examples/` were rendered and looked at: `heating-beaker.json` (example 1), `gas-over-water.json` (example 2, with a magnesium ribbon, a stopwatch and more labels), `titration.json` (burette, clamp, stand, tile), `circuit.json` (wires between circuit symbols, labels with `textAt`) and `cooling-curve.json` (a tube in a water bath; a stand beside the apparatus, flipped).

## House rules

- Place by anchors. Do not type coordinates for a part that can stand on another. A part with no placement sits at the origin, on top of the rest.
- The first part defines the bench: put it at `y = 0` with `at` (the `under` or `base` anchor), and stand other things on it.
- Draw the parts a student would label, and nothing more. Leave the bench, the mat and the stand unlabelled with `skip` unless they matter.
- Joined glassware that is heated (reflux, distillation) is open to the air at exactly one point, and every joint is drawn sealed, with no gap. Reflux is open at the top of the condenser; a distillation is open where the distillate leaves. Never draw a sealed flask that is heated with nowhere for the gas to go, or one that is open in two places.
- A connector is drawn after the item it passes through. This is the default. A tube goes through the hole of a bung (`hole1`), and its end goes below the surface of the liquid it bubbles into. A delivery tube does not dip into the liquid it comes from.
- A clamp that grips an upright vessel is drawn behind it (`behind`). A clamp stand is drawn behind everything (`back`). The clamp width (`size.w`) sets how far the stand stands from the vessel; a stand beside the apparatus on the left needs `flip: true`, so that its base plate points away.
- Liquids stand at sensible levels (half to two thirds of a beaker; a thermometer bulb in the liquid, not on the bottom). For a reading question put the value in `reading`, not in the text.
- A worksheet: `labelMode` `blank` (a line to write on) or `letters` (A, B, C, with the answer key). `--variants` writes both. Give students the PNG files. An SVG carries the label text in its metadata, so that the editor can open it again: a blank or lettered SVG still holds the answers.
- Put only the labels on the diagram that the question asks for. Labels that cross the diagram: use `side`, or `textAt` on an extra label.

## Look at the picture

Open the PNG and check each of these before you hand it over.

1. Every part is there and looks like what it should.
2. Parts touch where they should: a burette tip in the neck of the flask, a beaker on the gauze, a bung in the mouth, a stand under its clamp. Nothing floats, nothing overlaps that should not.
3. Liquids are level, at sensible heights, and the readings are the ones asked for.
4. Tubes and wires reach both ends and do not run through other parts.
5. Each leader ends on the part it names. No two leaders cross. No text runs into the drawing. The checks at the end of the output find leaders that cross, text that runs into a part or into other text, a leader that ends in empty space, a clamp drawn in front of its vessel, and a symbol that failed to build: fix every warning. They cannot see a leader that runs through another part, so look for those yourself.
6. Nothing is cut off or very small. A very wide picture (over about 1200 units) is small on a slide: bring the parts closer.

## Common mistakes

- A part with no placement, or placed on the wrong anchor (`own` forgotten: use the anchor on the part that is being placed, for example `base` of a beaker on a `surface`).
- Forgetting `behind` on a clamp, so that its jaws cross the glass; or the stand's plate under the apparatus when it should stand beside it.
- A stand that is too short or too tall: give `h` as `between` the bench and a point above the clamp.
- A `reading` on a part that is turned, or on a symbol with no scale (burette, measuring cylinder, thermometer and the magnified scale have one).
- A wrong `at` for a label: it points at empty space. The point is in the part's own frame; read the anchors of the symbol, or use `"anchor"`.
- A symbol id that is not in the list: the error names the nearest ones.
- Trying to draw what is not in the tool (below).

## What it cannot draw

Graphs and tables; skeletal or structural formulae; pictures that are imported; animation; pouring liquids; 3D or perspective views; a symbol that is not in `reference/symbols.md` (it lists the ones planned and not drawn yet). For those, say so, and draw the part of the diagram that it can.

## The files

- `<name>.png`: the picture, 2 pixels to the unit. Use `--scale 4` for print.
- `<name>.svg`: the same as an SVG, with the document in its metadata. Office software opens it as a picture; PracDraw opens it for editing.
- `<name>.pracdraw.json`: the document. To tweak a diagram by hand, open the built editor (`pracdraw/dist/index.html`) and use Open with this file or the SVG.
