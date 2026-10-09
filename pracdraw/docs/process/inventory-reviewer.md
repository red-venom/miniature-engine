# Brief for an inventory reviewer (PracDraw: the diagram inventory)

You are a reviewer. You did not write the inventory. Two reviewers share the five jobs below (A: jobs 1, 4 and 5; B: jobs 2 and 3); your prompt says which are yours. You change no file in the repository. Keep scratch files in the scratchpad that the lead names.

Read `docs/process/inventory-author.md` first: it gives the row format and the rules (`confidence` is `checked` only when an AQA page, paper or handbook supports the row; `specRefs` only if seen in a source; summaries in the author's own words). The deliverables under review are `spec/diagrams.json`, `docs/diagram-inventory.md` and `src/diagrams.test.ts`.

## Network facts

`WebFetch` fails on every host in the cloud container (ENOTFOUND). `WebSearch` works. A search with `allowed_domains: ["aqa.org.uk", "filestore.aqa.org.uk"]` returns real AQA addresses and a summary of what the pages say. That summary is the only AQA text you can see. Do not try to get round the network policy in any other way.

## The five jobs

1. **The test.** Does `src/diagrams.test.ts` prove what the author's brief asked (required fields; enum values; unique ids; `covered` names an existing id; `covered` is null for every other kind; arrays where arrays belong; chart rows of priority A or B have a note; the document is exactly what `npm run gen:inventory` writes)? Run it. Then break it, in a copy of the files outside the repository: make at least eight deliberate faults in `spec/diagrams.json` and in the document (a missing field, a bad enum, a duplicate id, a `covered` id that does not exist, `covered` on a non-covered row, a string where an array belongs, a changed row name, a number typed in the prose, a row moved to another topic) and say which the test catches. A fault that passes is a gap. Try five new ways that the author has not thought of.
2. **Coverage.** Walk the course content (for AQA: GCSE Chemistry 8462 sections 4.1 to 4.10, the matching Trilogy 8464 units, and A-level 7405 sections 3.1 to 3.3 and its required practicals) with `WebSearch` on the AQA domains. For each section, list the diagrams that the specification asks students to draw, label, complete or interpret, and check that the inventory has a row for each. Report every **missing diagram type** with its section, and every **padding** row that no section needs. Search by words in `name`, `draw` and `topic` before you call a type missing.
3. **Row accuracy.** Take a sample of at least 40 rows: every priority A row with `confidence: checked`, every `covered` row, at least 10 `unverified` rows, and at least 10 KS5 or outline rows. For each: is `draw` right in science and drawable in black line? Are `params` and `scienceChecks` right (electron counts, shell capacities, ion charges, valences, bond counts, lattice charge balance)? For a `covered` row, does the named symbol or template draw it (`npm run render -- --template <id>` or `--symbol <id>`, then open the PNG)? Is `specRefs` right against what the AQA summary says? Is `confidence` honest? Report each fault with the row id and the correction. Say "looks copied" (with eight words quoted) for any text that looks copied from a site.
4. **The document.** Do the numbers match the rows (compute them yourself)? Is each decision for James a real decision with its options and a recommendation, and a number that you can reproduce? Does the list "rows to check against the AQA PDF" hold the right rows? Can James, reading only the sections that the document names, set the priorities in about ten minutes? Is anything in the document not in the rows, or the reverse? Does it say what it reverses in `docs/SPEC.md` (section 4), `docs/lesson-pipeline.md` and the skill?
5. **Can a pack be built from it?** Pick the six hardest priority A `symbol` or `compound` rows. For each, say whether `draw`, `params` and `scienceChecks` are enough for an author who has never seen the course, and name what is missing. Name any row whose `kind` or `proposedPack` looks wrong, and any family that should be split or merged.

## Rules for running

- In your copy of the project, run `npm ci` first. If a command fails, say so and go on.
- A usage limit has stopped agents before. After each job, append your findings to your notes file in the scratchpad. Your final reply repeats them.
- A fault that you cannot show with a row id or a line and a quote is not a finding. Mark what you could not check.

## Report

In this order, in short lines, with counts: (1) the test: pass, or the faults that it missed; (2) missing diagram types and padding rows; (3) row faults (id, fault, correction), how many rows you checked, how many faults; (4) the document: pass, or the faults; (5) pack-readiness: one line for each hard row, and rows to re-pack or split; (6) what you could not check. Do not pad. Do not commit or push.
