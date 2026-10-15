# Brief for a symbol author (PracDraw, phase 8)

You are one symbol author on the PracDraw build. The project lives in the `pracdraw/` folder of your git worktree. The complete specification is `pracdraw/docs/SPEC.md`. Read these parts of it before you draw anything:

- Section 1 (rules for the build workflow, lines 10 to 23). They bind you.
- Section 5 (drawing style, lines 92 to 124). The reference picture is `pracdraw/docs/style-reference.png`: open it with the Read tool and look at it.
- Section 8 (symbols, lines 247 to 332): the contract, the roles, the anchor table and the thirteen rules.
- Section 9 (contents, lines 334 to 350), so that you know how a cavity is used.
- The catalogue tables for your packs (the "Symbol catalogue" part of the document, from line 887). Each row is the contract: id, name, aliases, pack, box, resize, cavities, anchors, parameters, label, and the recipe in "How to draw".

Then read `pracdraw/src/symbols/types.ts`, `pracdraw/src/symbols/kit.ts`, `pracdraw/src/symbols/pilots.ts` (all 18 pilots: copy the nearest one), `pracdraw/src/symbols/label.ts`, `pracdraw/src/symbols/scale.ts`, and `pracdraw/src/kernel/geom.ts` (Path, roundPoly, mirrorProfile, rng).

## Rules

1. Build only the rows that your prompt names. For release 1.0 these were the priority A symbols that were not yet built; for release 1.2 (the particle packs, priority C) they are the rows of `spec/catalogue.json` that the lead lists for you. Skip every other row.
2. You own only the files that your prompt names: `pracdraw/src/symbols/<pack>.ts` for your packs and, for a particle pack, its data and science test (`<pack>.science.test.ts`; see rule 11). Edit nothing else. Do not edit `registry.ts`, `kit.ts`, `electrons.ts`, `elements.ts`, `types.ts`, `pilots.ts`, `label.ts`, `scale.ts`, the kernel, `spec/`, `scripts/`, other tests, config or package files. If you need a helper, write it inside your pack file. If you need a new role or a kernel change, do the nearest thing with what exists and record it in your report.
3. Draw from the recipe in the catalogue row. Do not copy artwork or code from Chemix or any other product.
4. Add no dependency.
5. The catalogue row is the contract. `src/spec.test.ts` compares your `SymbolDef` with `spec/catalogue.json` (same data as the document): id, name, aliases, pack, size, resize, cavity ids, anchor ids and kinds, parameter keys, types, defaults, ranges and options, the label text, and autoLabel. Parameter labels and choice-option labels are yours to choose (the key as words with a capital letter, e.g. "Scale numbers"). Give number parameters a `step` (1 for counts, 0.05 for fractions). Choose `min` so that the symbol still draws cleanly there.
6. `build` is pure. For a fixed pattern use `rng` from the kernel with a constant seed.
7. Every symbol in the registry gets the automatic tests in `src/symbols/registry.test.ts` with no extra code. Read that file so that you know what they check (clean numbers at default, minimum and 1.5 × size for every parameter value, geometry inside the box plus 45 u overhang, closed cavities inside the box, unique anchors, a leader end point, a usable scale, plain SVG).
8. Use the shared sizes from `kit.ts`: `NECK` 34, `BORE` 7, `HOLE` 4.5, `RIM` 1.5, `CONE_END` 28, `CONE_LEN` 24. A cavity of an open vessel starts `RIM` below the rim. The renderer paints every cavity white first: add no `paper` path for it. A part with a fill must not cover a cavity.
9. The symbol's local frame: x = 0 is the centre line, y = 0 the top of the box, y = h the bottom. A `uniform` symbol is drawn at its default size and every coordinate is multiplied by `h / defaultHeight` (see `bunsenBurner`).
10. Anchors: follow the anchor table in section 8 (position, `dir`, `width`) unless the recipe says otherwise. `dir` is degrees clockwise from +x: 90 is down, −90 is up.
11. Particle, molecule and structure packs (release 1.2). The roles `tint` (light-grey fill; white when photocopy-safe), `hatch` (hairlines, drawn in photocopy-safe mode only; make them with `hatchD` from `src/kernel/hatch.ts`, one `hatch` prim for each `tint` prim, of the same shape) and `ink` (a solid dot, no line) exist for you (section 8). Rules S6, S11 (relaxed: element symbols, charges and numbers inside a symbol, 12 to 18 u, with indices in the label markup) and S14 (the oblique projection) apply. The element table and the ion rule are in `src/symbols/elements.ts`; electron marks, rings and brackets are in `src/symbols/electrons.ts`. Particles are told apart by size and by tint or hatch, never by colour alone, and the picture must read in photocopy-safe mode. The science of a picture (electrons equal Z minus the charge; the shells fill 2, 8, 8; the atoms of a formula are all there; charges balance) is a data model that your pack file exports, and `<pack>.science.test.ts` (yours) tests the model and checks that the drawing agrees with it. A test you write must be shown to fail when the code it guards is broken: break the code on purpose, see the test fail, and say so in your report.

## Work cycle

```
cd pracdraw
npm ci                      # once, in your worktree
npm run test                # unit tests; the registry and spec tests cover your symbols
npm run sheet <pack>        # writes out/sheet-<pack>-{plain,filled,mono-turned,anchors}.png
```

Open the four PNG files with the Read tool and look at every symbol against the checklist in section 5 (lines 116 to 124). A symbol you have not looked at is not done. Fix what is wrong and look again. Common defects: a cavity that leaks outside the glass (filled sheet), text that is mirrored (turned sheet), anchors in the wrong place or pointing inwards (anchors sheet), parts outside the red dashed box, kinks where arcs meet lines, wrong line weights.

Before you finish:

```
npm run format              # Prettier
npm run check               # type check, lint, format check, unit tests, build, browser tests: must be green
```

Then commit everything on your branch (git add the pack files only; do not commit `out/` or `dist/`). Use `git -c user.name=Claude -c user.email=noreply@anthropic.com commit`. The commit message says which pack and symbols. Do not push.

## Report

Reply with: the worktree path and branch name; the list of symbols you built; one line per symbol on what you checked on the sheets; every departure from the catalogue recipe and why; anything you needed from the lead (a helper, a role, a change to a shared file). Keep it short.
