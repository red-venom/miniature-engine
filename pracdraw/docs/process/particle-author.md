# Brief for a particle-pack author (release 1.2 and after)

Read this with `author.md` (symbols) or `template-author.md` (templates). It adds what the particle, molecule and structure packs need. It replaces the phase 15 brief that the lead kept outside the repository.

## Read first

1. `docs/process/README.md`, then `author.md` (rules 5 to 11) or `template-author.md`. Find sections by heading: line numbers are old.
2. `docs/SPEC.md`: section 5 (rules S1 to S14; S11 for text in particle symbols, S14 for the oblique projection), section 8 (the roles `tint`, `hatch`, `ink`), section 9.
3. The shared code: `src/symbols/types.ts`, `kit.ts` (`tinted()`), `elements.ts` (the first 36 elements, `ionShells`), `electrons.ts`, `oblique.ts`, `molecules.ts` (the small-molecule library), `src/kernel/hatch.ts`, `src/symbols/registry.test.ts`, `src/spec.test.ts`.
4. Your contract: your rows in `spec/catalogue.json` (`draw` holds the lead's brief) and the row of the same id in `spec/diagrams.json` (`draw`, `params`, `scienceChecks`). The catalogue row wins.

## Rules

- Work only in your worktree; edit only the files your prompt names. Never edit `registry.ts`, `kit.ts`, `electrons.ts`, `elements.ts`, `types.ts`, the kernel, `spec/`, `scripts/`, `docs/`, `package.json`, or another author's file: say what you need in your report.
- Photocopy-safe (S12): a tint always comes with a hatch (`tinted()`); no meaning by colour alone. Marks and text do not scale (S3): choose `min` so the symbol still draws cleanly at its minimum size.
- `build` is pure and deterministic: no `Math.random`, no dates; use `rng` with a constant seed.
- The science is a data model that your file exports. `<pack>.science.test.ts` tests the model (the `scienceChecks` of the row) and that the drawing agrees with it (count the marks in the geometry). A test counts only if you have broken the code it guards on purpose, seen it fail, and restored the code. List each break in your report.
- Look at every picture: `npm run sheet <pack>` (four sheets) and your own recipes (`npm run render`) for every parameter value, at default, minimum and 1.5 times, in colour and `--mono`, turned and flipped. Check that nothing overlaps, every count can be counted by eye, the hatch shows where the tint does, and nothing is mirrored.
- Commit early (work in progress) with `git commit -F <file>`, ending with the session's trailers. Do not push. Run `npm run format` inside `pracdraw/` only; never run Prettier on `.claude/`.
- Before the last commit: `npm run check`. Two failures are expected and are the lead's: `src/diagrams.test.ts` (the inventory row must become a covered row) and `src/skill.test.ts` (`npm run gen:skill`).

## Report

Worktree, branch, commits; what you built; what you checked on the sheets; departures from the `draw` text and why; each science test and the break that made it fail; the `npm run check` counts; what you need from the lead.
