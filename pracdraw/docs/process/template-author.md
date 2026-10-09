# Brief for a template author (PracDraw, phase 9)

You are a template author on the PracDraw build. The project lives in the `pracdraw/` folder of your git worktree. The specification is `pracdraw/docs/SPEC.md`. Read:

- Section 1 (rules, lines 10 to 23). They bind you.
- Section 5 (drawing style, lines 92 to 124), especially S13.
- Section 7 (document model, lines 184 to 245) and section 9 (contents and the preset table, lines 334 to 393).
- Section 11 (labels, lines 437 to 501): how a label with a leader is drawn; the side rule (text on the left ends at the anchor, text on the right starts at it).
- The Templates tab (from line 1120): the intro paragraphs and the rows of your templates. The Symbols column is exact: use these symbols and no others (tubes, wires, lines and labels are not listed and are allowed). The Set-up column is the science: follow it.
- Section 8's anchor table (lines 291 to 310), so that you know which anchors to place by.

Then read `pracdraw/src/templates/types.ts`, `pracdraw/src/templates/general.ts` (the worked example `heatingBeaker`: copy its pattern), `pracdraw/src/model/build.ts` (`DocBuilder`: `symbol`, `at`, `on`, `near`, `connector`, `label`, `anchorWorld`, `moveAnchorTo`), `pracdraw/src/demo.ts` (a larger worked example with tubes, readings and layers), `pracdraw/src/symbols/scale.ts` (`readingToAmount`) and the `SymbolDef`s you use in `pracdraw/src/symbols/*.ts` (their anchors, parameters and cavities). `spec/templates.json` has the same rows as the document.

## Rules

1. Build only the priority A templates of your group file. Skip priority B.
2. You own only `pracdraw/src/templates/<group>.ts`. Edit nothing else. Do not edit `index.ts`, symbols, the kernel, `spec/`, `scripts/` or tests. If a symbol lacks an anchor or draws wrongly, do the nearest thing with what exists and record it in your report for the lead.
3. Place every part by anchors: `at` puts an anchor on a point, `on` puts an anchor on an anchor of another item, `near` puts a symbol with no useful anchor beside an anchor of another item. Small `dx`, `dy` adjustments are fine. Do not type absolute coordinates for parts except the first one.
4. Give each template at least three labels fixed to items (`b.label(text, x, y, [item, lx, ly])`). Label the parts a student would label. Put the labels in columns left or right of the apparatus, 35 to 45 u apart vertically, so that no leaders cross and no text overlaps apparatus. A leader must end on the part it names.
5. Use the preset colours from section 9 by their hex values. A layer amount is a fraction 0 to 1. Lumps are always the bottom layer; a gas layer is always last. Use `readingToAmount` for an exact reading (burette 0.00, cylinder 60 cm³).
6. `src/spec.test.ts` compares your template with its plan row: id, title, group, refs, the exact set of symbols used, at least three fixed labels, bounds under 1400 × 1000 u, deterministic output. Run `npm run test`.
7. Keep the set-up physically right: a tube enters a bung hole and ends where the notes say; a thermometer bulb is where the notes say; a cone sits in a neck; joined heated glassware is open at exactly one point (S13). Draw a connector after the item it passes through, so that its white body hides the bung hole correctly (the draw order is the order you add items).
8. Add no dependency. `build()` must be pure (no randomness, no dates).

## Work cycle

```
cd pracdraw
npm ci                      # once, in your worktree
npm run test
npm run sheet templates     # writes out/template-<id>-text.png and -blank.png for every template
```

Open both PNG files of each of your templates with the Read tool and look at them: the set-up, the leaders, the overlaps, the blank mode (100 u lines must not overlap apparatus). Fix and look again. Then:

```
npm run format
npm run check               # must be green
```

Commit your file on your branch with `git -c user.name=Claude -c user.email=noreply@anthropic.com commit` (not `out/` or `dist/`). Do not push.

## Report

Reply with: the worktree path and branch; the templates you built; one line per template on what you checked; every departure from the Set-up notes and why; anything you needed from the lead (a missing anchor, a symbol defect). Keep it short.
