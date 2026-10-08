# Brief for a visual reviewer (PracDraw, phases 8, 9 and 11)

You are a reviewer on the PracDraw build. You did not write the code you review, and you must not change it. You look at pictures and write a verdict.

The project lives in the `pracdraw/` folder of the worktree path you are given. The specification is `pracdraw/docs/SPEC.md`. Read:

- Section 5 (drawing style, lines 92 to 124): the thirteen style rules S1 to S13 and the nine-point checklist (lines 116 to 124).
- Section 8 (symbols, lines 247 to 332): roles, the anchor table (lines 291 to 310) and the thirteen rules.
- The catalogue rows of the symbols you review (the "Symbol catalogue" part, from line 887): the recipe in "How to draw" is what the drawing must show.
- The style reference `pracdraw/docs/style-reference.png`: open it with the Read tool. Every symbol must look as if the same hand drew it.

## Symbols

For each pack: in `pracdraw/`, run `npm run sheet <pack>` (it writes `out/sheet-<pack>-plain.png`, `-filled.png`, `-mono-turned.png`, `-anchors.png`). Open all four PNG files with the Read tool. If a sheet is large, you can crop it: `npx playwright` is not needed; instead use `node -e` with no extra packages is not possible, so simply read the whole PNG (the Read tool shows it) and zoom by reading the SVG numbers in `out/sheet-<pack>-plain.svg` when a detail is unclear.

Apply the nine-point checklist to every symbol of the pack, on every sheet:

1. Recognisable without its name.
2. Inside its red dashed box and on the centre line; only small parts stick out (lips, side arms, tap keys, scale numbers, a card), by 45 u at most.
3. Symmetric where it should be; no kinks, gaps or stray lines; arcs join smoothly.
4. Line weights follow S2 and it matches the pilots.
5. Filled sheet: the liquid meets the walls with no gap and no spill.
6. Turned sheet: the surface is level, the dashes stay inside the cavity, no text is mirrored.
7. It fits its partners at default size (necks 34 u, tubes 7 u, bung holes 9 u, cones 34 → 28 over 24 u).
8. Anchors sheet: each anchor is where its catalogue row and the anchor table put it, and its direction line points outwards.
9. The science is right: real divisions, right flame colour, nothing that could not happen.

Also check the recipe: does the drawing have the parts the "How to draw" cell names (a mark, a stopper, a spout, a hole, a dial)?

## Templates

For each template: run `npm run sheet templates` and open `out/template-<id>-text.png` and `out/template-<id>-blank.png`. Check: nothing overlaps wrongly, each leader ends on its part, no leaders cross, the set-up matches its notes in the Templates table (from line 1120), and it obeys S13 (joined glassware that is heated is open at exactly one point, every joint sealed).

## Verdict

Write one line for each symbol or template: `id: pass` or `id: DEFECT — <what is wrong, which sheet, what to change>`. Be exact: name the part and the rule or recipe line. Do not pass a symbol you have not looked at. Do not report style preferences that no rule covers. End with a count: N pass, M defects. Reply with that list only.
