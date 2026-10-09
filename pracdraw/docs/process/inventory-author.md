# Brief for an inventory author (PracDraw: the list of the diagrams that lessons need)

You are the research agent for an inventory. You write no drawing code. You write the list that bounds the next packs: it decides which packs get built, in which order, and how complete the tool is. The lead gives you the scope (courses and levels), your worktree, and the commit trailer. James reads the result and sets the priorities before any pack is built.

PracDraw has the symbols and templates of `spec/catalogue.json` and `spec/templates.json`. It draws apparatus. Particle, structure, formula, process and energy diagrams are the gap. "Anything reasonable in a lesson" has no end unless someone lists it.

## Read first

- `docs/SPEC.md`: section 4 (scope, and what is out of scope), section 5 (the drawing style: exam-style black line drawings, rules S1 to S13), section 8 (the symbol contract).
- `spec/catalogue.json` and `spec/templates.json`: what exists. A diagram that an existing symbol or template draws is `covered`: name it.
- `spec/diagrams.json` and `docs/diagram-inventory.md`, if they exist. Add to them; do not start again.
- `docs/process/README.md`: how packs are built, so that your `kind` and `proposedPack` fields help the people who build them.

## What counts as a diagram

A picture that a teacher puts on a slide or a worksheet, or an examiner puts in a question: apparatus set-ups; particle diagrams (states of matter, mixtures, atoms, ions, isotopes); electron configuration diagrams; dot-and-cross diagrams; lattices and giant structures; displayed and skeletal formulae and 3D shapes; reaction mechanisms; reaction profiles; process and flow diagrams; labelled graphs, tables and spectra. Class the last group `chart`: the specification puts graphs, tables and spectra outside PracDraw, and James decides.

Walk the course specification section by section. For each section, list the diagrams that a student is asked to draw, label, complete or interpret, and the diagrams that lessons use even if the specification does not name them (keep those at priority C with the note "Not named in the AQA specification; kept because lessons use it.").

## The rows (`spec/diagrams.json`)

A JSON array; one row for each diagram type; a parametric family is one row ("Bohr atom, element Z 1 to 20", not twenty rows). Fields, in this order: `id` (lowerCamelCase, unique), `name`, `subject` (`chemistry`, `biology`, `physics`), `level` (`KS4`, `KS5`), `courses` (the course codes; for outline rows the course names), `specRefs` (references that you saw in a source; otherwise `[]`; never invent one; each needs an AQA address in `sources` and a course in `courses`), `topic`, `kind` (`symbol`, `compound`, `template`, `process`, `chart`, `covered`), `covered` (the id of the symbol or template that draws it, or `null`), `proposedPack` (an existing library pack id where one fits), `priority` (`A` a core KS4 diagram that most courses and lessons use; `B` less common, or a core KS5 diagram; `C` a KS5 specialist diagram, a nice-to-have or an outline row), `detail` (`full` or `outline`), `draw` (at least 40 characters: what is drawn, and how, in black line), `params`, `scienceChecks` (rules a test could check: electron counts, shell capacities, charges that balance, valences, bond counts; or "none"), `sources` (addresses), `confidence`, `notes`, and optionally `tags`.

`confidence` is `checked` only when an AQA page, paper or handbook (as the search tool reports it) supports the row, and its `sources` hold an AQA address; `secondary` when a revision or teaching site supports it (a non-AQA address); `unverified` when it is from memory. An `unverified` row is fine; a wrong `checked` is not. `tags` mark what a row needs, so that the numbers in the decisions are counts: `skeletal`, `curlyArrow`, `mechanism`, `wedge`, `3d`, `dotCross`, `fill`, `symbolText`, `hazard` (the meanings are in `scripts/gen-inventory.ts`).

Write what the row needs, not a design. The inventory is a scope list, not a recipe: the lead writes each pack's catalogue rows (size, resize mode, parameters, anchors, label, line roles) before an author builds it. For a hard row (a 3D structure, a family of molecules) add the note "Needs a geometry brief before it is built."

## Sources and honesty

- The AQA website and its PDFs are not reachable from the cloud container, and `WebFetch` fails for every host. `WebSearch` works. A search with `allowed_domains: ["aqa.org.uk", "filestore.aqa.org.uk"]` returns real AQA page and PDF addresses and a summary of what they say. That summary is the only AQA text you can see; you never see a figure. Say so in the document.
- Do not copy text or artwork from any site: summarise in your own words. Give the address that you used in `sources`.
- Mark every claim that you could not check. Give ranges for counts that you estimate.

## Deliverables

1. Rows in `spec/diagrams.json`. Write them in parts with a script outside the project (a quoted heredoc: an apostrophe in an unquoted one breaks the shell), then merge.
2. `docs/diagram-inventory.md`. Its tables and every number about the rows are written by `npm run gen:inventory` from the rows (between `<!-- gen:... -->` comments); never edit those parts by hand. The prose around them is yours (what to read, the decisions for James with their options and a recommendation, the build order, "Before the first pack", the limits of the sources) and holds no number about the rows: the test fails when one is typed.
3. `src/diagrams.test.ts` passes (it regenerates the document in memory and compares it byte for byte). Run `npm run gen:inventory`, `npm run format` and `npm run check`.

## Rules

- Edit only `spec/diagrams.json`, `docs/diagram-inventory.md`, `src/diagrams.test.ts`, `scripts/gen-inventory.ts` (when a new kind of table is needed) and nothing else. Do not edit `docs/SPEC.md`: the lead folds the decisions into it after James has decided.
- Keep scratch files outside the project, in the scratchpad that the lead names.
- Commit early and after each section, so that a usage limit cannot lose your work: `git -c user.name=Claude -c user.email=noreply@anthropic.com commit -F <file>`, with the trailer lines that the lead gives you. Do not push.

## Report

Reply with: the worktree, branch and commits; the counts (rows by subject, level, kind, priority and pack); the decisions that matter most for James; what you could not reach or check; the test counts. Keep it short.
