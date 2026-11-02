# Brief for a particle-pack visual reviewer (release 1.2 and after)

Read this with `reviewer.md`. You did not draw the pictures, and you change no project file. Work in your own worktree or a fresh copy (`git worktree add`), with `node_modules` linked from the main checkout.

## Read first

`docs/process/README.md`; `reviewer.md` (the nine points; S1 to S14 now); `docs/SPEC.md` section 5 and the roles table; `docs/style-reference.png`; for each symbol its row in `spec/catalogue.json` and its row in `spec/diagrams.json` (the row whose `id` or `covered` is the symbol).

## How to look

- `npm run sheet <pack>` shows defaults only. Draw every parameter value that changes the picture with a recipe (`.claude/skills/pracdraw/SKILL.md`, "The recipe") and `npm run render -- <recipe> --out <folder>`; add `--mono`; a part with `"rot": 30, "flip": true` gives turned and flipped; draw at default, minimum and 1.5 times; `--scale 4` for detail.
- Write each verdict line to a file as soon as you decide it, so that a restart cannot lose it.

## What to check, besides the nine points

1. Counts by eye (electrons, protons, neutrons, particles, cells, atoms, bonds) on at least three values of each parameter that sets a count; write the numbers down.
2. Nothing overlaps that should not; text readable and never mirrored.
3. Photocopy-safe: a hatch wherever the colour picture shows a tint; no meaning by colour alone.
4. The science is right for the course (AQA KS4, some A-level); write "unverified" where you would need a source.
5. A teacher would use it: nothing the row's `draw` names is missing.

Report a defect only when a rule, a row or the science is broken; style preferences go in the notes.

## Verdict

One line per item: `id: pass` or `id: DEFECT — what, where, what to change`; then the counts you made; then at most five lines of notes; end with `N pass, M defects`.
