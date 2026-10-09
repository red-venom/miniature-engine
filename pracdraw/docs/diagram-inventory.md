# Diagram inventory: KS4 science and KS5 chemistry

Phase 13, rewritten after review on 9 October 2026. The list itself is `spec/diagrams.json`. This document is the version for people. Its tables and its numbers are written by `npm run gen:inventory` from that file: they sit between comments that start with `gen:` and are never edited by hand. `src/diagrams.test.ts` regenerates the document in memory and compares it with this file, so a change to the list without the document, or to the document without the list, fails the test. The text around the tables is written by hand and holds no number in digits about the rows; the test fails when one is typed. A number written as a word in the text is not checked, and neither is a change to the parameters, the science checks or the notes of a row, because no table shows them.

**What to read.** James: read "Read this first", "Decisions for James" and "Build order" (about <!-- gen:n.readWords -->2,600<!-- /gen --> words). The rest is for the lead, for the pack authors and for looking things up. "Rows by topic" at the end lists every row.

**A scope list, not a recipe.** The inventory says which diagrams to draw, roughly how, and in what order. It does not specify any symbol. Before a pack is built, the lead and the author write its catalogue rows (size, resize mode, parameters, anchors, label, line roles), as they did for the apparatus; a row here gives none of these.

## Read this first

**In short.**

- The list has <!-- gen:n.total -->293<!-- /gen --> rows: <!-- gen:n.chem -->219<!-- /gen --> for chemistry (<!-- gen:n.chemKs4 -->131<!-- /gen --> at KS4 and <!-- gen:n.chemKs5 -->88<!-- /gen --> at KS5) and <!-- gen:n.outline -->74<!-- /gen --> outline rows for biology and physics.
- <!-- gen:n.covered -->82<!-- /gen --> rows are already drawn by the symbols and templates of the catalogue. <!-- gen:n.charts -->40<!-- /gen --> rows are graphs, tables and spectra, which the specification puts outside PracDraw. The other <!-- gen:n.new -->171<!-- /gen --> rows need something new.
- Steps 1 to <!-- gen:n.lastAStep -->8<!-- /gen --> of the build order hold all <!-- gen:n.aNew -->29<!-- /gen --> priority A rows that need new code.
- Decisions 1 to 3 reverse things that the specification says PracDraw does not draw, and decisions 1 to 5 set how large the work is.
- Confidence is weaker than it looks (see Confidence below). The first job for a person with the AQA PDF is "Rows to check against the AQA PDF".

**What the list is.** It lists the diagram types that a teacher puts on a slide or a worksheet, or that an examiner puts in a question, for AQA GCSE Chemistry (8462), the chemistry units of AQA GCSE Combined Science: Trilogy (8464) and AQA A-level Chemistry (7405), with an outline of the biology and physics diagrams for GCSE. Its scope is the diagrams that lessons use, which is wider than the diagrams that AQA requires. A family of diagrams is one row: the Bohr model of an atom is one row with an element parameter, not twenty rows.

**The kinds of row.** Each row says how PracDraw would draw it.

<!-- gen:kinds -->
| Kind | What it is | Chemistry | Outline | Rows |
| --- | --- | --- | --- | --- |
| symbol | a new parametric symbol: one drawing made from parameters | 40 | 18 | 58 |
| compound | a diagram of several new symbols and connectors, built from a recipe | 55 | 24 | 79 |
| template | an apparatus set-up that is a recipe from symbols that exist (a new template; the small additions are listed under Build order) | 2 | 0 | 2 |
| process | a flow, cycle or tower diagram | 23 | 9 | 32 |
| chart | a graph, table or spectrum (outside PracDraw unless James decides) | 33 | 7 | 40 |
| covered | an existing symbol or template already draws it (the row names it) | 66 | 16 | 82 |
| all |  | 219 | 74 | 293 |
<!-- /gen -->

**Priority.** A is a core KS4 diagram that appears in most courses and most lessons on its topic. B is a less common KS4 diagram, or a core KS5 diagram. C is a KS5 specialist diagram, a nice-to-have, a diagram that lessons use but the AQA specification does not name, or an outline row. A KS5 diagram is B at most, so priority is not a build order across levels: the build order says what to do first.

**Confidence.** Each row says how sure the author is: <!-- gen:n.checked -->125<!-- /gen --> rows are `checked`, <!-- gen:n.secondary -->78<!-- /gen --> `secondary` and <!-- gen:n.unverified -->90<!-- /gen --> `unverified`. Treat `checked` as weaker than it sounds. The AQA website and its PDFs could not be opened, so it means only that a search tool's account of an AQA page or paper reported the requirement; I never saw a figure. The meanings, and what could not be reached, are under "Confidence and limits".

## Decisions for James

**What these decisions reverse.** Section 4 of `docs/SPEC.md` (out of scope: "3D views" and "Skeletal formulae, graphs, tables"), rule S1 (no perspective), `docs/lesson-pipeline.md` ("What it cannot draw": graphs and tables, skeletal or structural formulae, 3D views) and `.claude/skills/pracdraw/SKILL.md` (the same list) say that PracDraw does not draw three-dimensional or perspective views, structural formulae or graphs. The packs of steps 5 and 6 reverse the first two: step 5 draws displayed (structural) formulae and step 6 draws structures in an oblique view. Skeletal formulae and curly arrows (step 10) and charts (step 12) reverse the others. That is why decisions 1 to 3 are needed. After James decides, the lead edits the specification, the skill and the pipeline document to match.

Each decision gives the options and a recommendation, so that James can approve it or change it. Decisions 7 and 9 are confirmations.

**1. Graphs, tables and spectra (charts).** <!-- gen:n.charts -->40<!-- /gen --> rows are charts (<!-- gen:n.chartsChem -->33<!-- /gen --> in chemistry), and <!-- gen:n.chartsAB -->22<!-- /gen --> of them are priority A or B: used often, but not built first. Options: (a) leave all charts out and let teachers use a spreadsheet; (b) allow sketch graphs with no data as symbols, for the shapes a student draws freehand (the rate curve, the heating curve, the Maxwell-Boltzmann curve, the pH curve, the concentration-time curve); (c) build a data chart tool. Recommended: (a) for the first packs, then (b) once the particle and molecule packs have passed review. The reaction profile is a symbol already, because it has no data axis.

**2. Skeletal formulae and curly arrows (KS5 organic).** <!-- gen:n.tag.skeletal -->9<!-- /gen --> rows need skeletal formulae (tag `skeletal`) and <!-- gen:n.tag.curlyArrow -->8<!-- /gen --> rows need the curly arrow, a new kind of connector in the editor (tag `curlyArrow`); <!-- gen:n.skeletalOrCurly -->16<!-- /gen --> rows need one or both. The mechanisms pack waits for the connector, except for the rows that draw an unpaired electron or no arrow (the radical substitution and the ozone chain). Options: now; later, after the KS4 packs; never. Recommended: later. To keep the door open, build the KS4 molecule drawing (step 5) as a list of atoms and bonds, so that a skeletal drawing is a second way to draw the same data.

**3. The style of three-dimensional structures.** <!-- gen:n.tag.3d -->16<!-- /gen --> rows are structures in three dimensions (tag `3d`: diamond, graphite, the sodium chloride cube, C60, the nanotube, silica, ice, iodine, cages and others), and <!-- gen:n.tag.wedge -->8<!-- /gen --> rows need wedge and dash bonds (tag `wedge`). Options: (a) one oblique projection (the front face square, the back face shifted up and to the right at half size, hidden lines dashed) for every lattice and cage, with wedge and dash bonds for molecules; (b) an isometric view; (c) flat 2D networks only, which keeps the exclusion but cannot draw most of these rows. Recommended: (a), with one pilot sheet of four pictures for James to approve before the ball-and-stick model of step 5 and the structures pack of step 6 are built: the sodium chloride cube, a diamond cluster, graphite layers and C60 (the hardest).

**4. Dot-and-cross marks.** <!-- gen:n.tag.dotCross -->4<!-- /gen --> rows draw the electrons of two atoms (tag `dotCross`). AQA's wording, as a search summary of 4.2.1.2 gives it, is to use different symbols for the electrons of each atom ("dots and crosses, or any clearly distinguished marks") and to show the outer shell only. Options: (a) dots for one atom's electrons and crosses for the other's, all in black, so that one picture serves slides and photocopies; (b) any pair of clearly different marks, chosen by the teacher; (c) all dots, which cannot tell the atoms apart and is not exam-valid. Recommended: (a) as the default, with (b) as a parameter. Always: outer shell only, every lone pair drawn, and brackets and a charge on every ion.

**5. Which course first?** <!-- gen:n.both -->101<!-- /gen --> chemistry rows serve both Trilogy (8464) and GCSE Chemistry (8462), and <!-- gen:n.gcseOnly -->30<!-- /gen --> are for 8462 only, such as the simple cell and the fuel cell, the alkene reactions, the polymers and DNA, the tests for ions and the Haber process (the Course column of the appendix shows every row). Options: build in priority order across both courses; Trilogy first; GCSE Chemistry first. Recommended: in every pack, the rows that serve both courses first and the 8462-only rows last. If the first users teach Trilogy nothing changes, and if they teach GCSE Chemistry the 8462-only rows can be moved forward.

**6. Keep or drop the rows that lessons use but AQA does not name.** <!-- gen:n.kept -->8<!-- /gen --> rows are not named in the AQA specification and are kept at priority C because lessons use them: <!-- gen:n.keptIds -->`spaceFillingModel`, `blastFurnace`, `copperRefining`, `fermentationApparatus`, `combustionProductsApparatus`, `hazardSymbols`, `dOrbitalSplitting`, `formulaTriangle`<!-- /gen -->. Options: keep them (they come last in their packs and cost little), or drop them. Recommended: keep.

**7. Particles are told apart by fill, not by colour (confirm).** Particles, atoms and regions are told apart by size and by a light-grey tint or a hatch fill, with a key, never by colour alone (rules S6 and S12), so that a photocopy reads. <!-- gen:n.tag.fill -->14<!-- /gen --> rows need this (tag `fill`), and the hazard symbols (tag `hazard`) get a plain black border instead of a red one. The kernel has no tint role and no hatch role: add one light-grey tint role and one hatch role, black-and-white safe, before step 3 (the lead's work). Recommended: yes.

**8. Text inside symbols (rule S11).** Rule S11 allows only scale numbers, meter letters, readings, terminal signs and short fixed words, at 8 to 14 u. <!-- gen:n.tag.symbolText -->19<!-- /gen --> symbol rows need element symbols, charges or numbers inside the picture, at 12 to 18 u (tag `symbolText`: the displayed formulae, the dot-and-cross diagrams, the periodic table, nuclide notation, the lattices), and a charge such as `2+` needs a rule for superscript text. Options: relax S11 for every symbol; relax it for the particle, molecule and structure packs only; keep it and make each of these rows a compound with labels. Recommended: relax S11 for those packs and keep it for apparatus (the lead edits the specification).

**9. The periodic table is a symbol, not a chart (confirm).** It is a table, but a fixed grid of the elements with highlight parameters, so the list classes it as a symbol and builds it early. The first version may stop after the fourth period. Recommended: yes.

**10. Biology and physics: when?** The <!-- gen:n.outline -->74<!-- /gen --> outline rows are all priority C and none is detailed. Some cost nothing (the physics particle model is the chemistry particle box); the rest need the shared engines and some of the Later symbols. Options: after the KS4 chemistry packs have passed review; one subject earlier; leave them out of this build. Recommended: after the KS4 chemistry packs.

## Build order

### How the order was chosen

1. Rows that need no new symbol come first. A template is a recipe from symbols that exist, so it costs a recipe and a review, and it tests the process for a new pack.
2. The shared engines come in the order the lessons need them: atoms and electrons, the particle box, the molecule drawing from a list of atoms and bonds, the oblique projection (first needed by the ball-and-stick model, reused by the lattices), the box-and-arrow layout, and the energy diagram. A pack with a hard drawing starts with a pilot sheet that James looks at (decision 3).
3. KS4 before KS5, A before B, chemistry before biology and physics. Every picture has a reviewer who is not the author (`docs/process/README.md`).

### The order

<!-- gen:steps -->
| Step | What | Packs | Rows | A | B | C |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Covered rows (no new code) | `annotation`, `apparatus`, `energy`, `labTemplates`, `matter`, `organicApparatus`, `structures` | 82 | 29 | 33 | 20 |
| 1 | New templates (KS4) (built) |  | 0 | 0 | 0 | 0 |
| 2 | Small symbols and the reaction profile (KS4) | `annotation` | 1 | 0 | 1 | 0 |
| 3 | Atoms, ions and dot-and-cross diagrams (KS4) | `atoms` | 9 | 8 | 1 | 0 |
| 4 | The particle box | `matter` | 7 | 2 | 4 | 1 |
| 5 | Molecules (KS4) | `molecules` | 15 | 7 | 7 | 1 |
| 6 | Structures (KS4) | `structures` | 8 | 4 | 3 | 1 |
| 7 | Flow diagrams, plants and scenes (KS4) | `flow`, `plants`, `scenes` | 17 | 5 | 5 | 7 |
| 8 | Electrochemical cells and the bond energy diagram (KS4) | `electrochemistry`, `energy` | 6 | 3 | 2 | 1 |
| 9 | KS5 physical and inorganic chemistry | `atoms`, `electrochemistry`, `energy`, `flow`, `molecules`, `structures` | 27 | 0 | 18 | 9 |
| 10 | KS5 organic chemistry and the biomolecules | `atoms`, `biomolecules`, `energy`, `flow`, `mechanisms`, `molecules`, `organicApparatus` | 31 | 0 | 22 | 9 |
| 11 | Biology and physics outline | `biology`, `physics` | 50 | 0 | 0 | 50 |
| 12 | Charts (only if decision 1 brings them in) | `charts` | 40 | 3 | 19 | 18 |
|  | All rows |  | 293 | 61 | 115 | 117 |
<!-- /gen -->

What each step draws, and why it is where it is:

- **Step 0.** The required practicals and set-ups that the symbols and templates already draw. No code: check each recipe once.
- **Step 1.** Built in release 1.2: its rows are covered rows now (step 0). It was the gas tests, the carbonate test, the simple cell, rusting tubes, the conductivity test, gas collection, molten electrolysis, cracking, laboratory fractional distillation, fermentation, Group 1 and water. The only new symbol is a nail; the rest is recipes. It brought A rows at once and tested the process for a new pack. The lead puts the new templates in one file per group (`labTemplates` and `organicApparatus`), so this is not a decision for James.
- **Step 2.** The pH strip, flame colours, hazard symbols, the formula triangle and the reaction profile. Small, independent drawings; the reaction profile and the pH strip are cheap A rows.
- **Step 3.** Bohr atoms and ions, nuclide notation, models of the atom, alpha scattering, isotopes, the periodic table, and the dot-and-cross diagrams. Every KS4 course starts here, and the electron-mark engine is built once. Needs decisions 4, 7 and 8.
- **Step 4.** The particle box: states of matter, changes of state, concentration, collision theory, equilibrium and the rest. One engine; biology and physics reuse it.
- **Step 5.** Displayed formulae, ball-and-stick and space-filling models, balanced equations drawn with models, alkene reactions, polymers, amino acids, cracking. One molecule engine and one small-molecule library; all the organic work and the KS5 formulae rest on it. It reverses the exclusion of structural formulae, and its ball-and-stick model is the first drawing that needs the oblique projection (decision 3).
- **Step 6.** Ionic lattices, metallic bonding, alloys, diamond, graphite, graphene, C60, the nanotube, silica and the cubes for surface area to volume ratio. The hardest drawing: it reuses the oblique projection and needs the pilot sheet first (decision 3). Graphene, graphite and the nanotube share one hexagon-net generator, so build graphene first.
- **Step 7.** The flow charts, the plants (fractionating tower, blast furnace, catalytic converter, desalination) and the scenes (greenhouse effect, acid rain). A box-and-arrow layout engine serves the flow charts.
- **Step 8.** The electrolysis cell with ions, the aluminium cell, the fuel cell, copper refining, sacrificial protection and the bond energy diagram. The cells build on the electrolysis symbols that exist.
- **Step 9.** Hess and Born-Haber cycles, electron boxes, d-orbital splitting, shapes of molecules and ions, polarity, intermolecular forces, ice, iodine and magnesium lattices, complexes and the mass spectrometer. After the KS4 packs have passed review. The wedge and dash bond (an editor task, decision 3) is first needed here.
- **Step 10.** Skeletal formulae, isomers, the curly arrow and the mechanisms, amino acids, DNA, proteins, benzene and polymers. The biggest new capability: wait for decision 2.
- **Step 11.** Cell and organ diagrams, Punnett squares, food webs, free body diagrams, ray diagrams, field lines and waves. After the chemistry packs; some rows are free.
- **Step 12.** Graphs, tables and spectra, only if decision 1 brings them into scope.

### Small additions to existing symbols, and editor tasks

- A nail symbol and two contents presets (a copper deposit, a pale green precipitate), for the rusting tubes and the displacement tubes.
- A flame tint parameter on `flame` and `bunsenBurner`, for the flame test colours.
- Editor tasks, the lead's work: a curved arrow connector (the specification lists four connector kinds and none is curved) and a wedge and dash bond style. The mechanisms pack waits on the first; the rows tagged `wedge` wait on the second.
- Nuclide notation is a symbol that draws its own small text, so the label markup needs no stacked-index form (decision 8).
- The Later symbols that the outline rows use: `rayBox`, `glassBlock`, `convexLens` and `planeMirror` for physics, `viskingTubing`, `potometer`, `forceps` and `scalpel` for biology.

## Before the first pack

An inventory row is a scope, not a recipe. For each pack, the lead does the following before an author starts.

- **Catalogue rows.** Write the catalogue row of every symbol (size, resize mode, parameters with type, default and range, anchors, label, line roles), as for the apparatus. `src/spec.test.ts` compares the code with those rows.
- **A geometry brief for each hard row.** The rows with the note "Needs a geometry brief before it is built." are <!-- gen:n.briefIds -->`covalentDotCross`<!-- /gen -->. A brief gives the construction or the coordinates, the oblique transform, the rule for hidden lines, and what is drawn at the edge of a patch. Two more of the hardest rows, `ionicDotCross` and `displayedFormulaHydrocarbon`, are close to ready.
- **Text and fills.** Decisions 7 and 8: the kernel needs a tint role and a hatch role, and rule S11 needs relaxing for these packs.
- **Library groups.** The library's packs are a closed list: `PackId` in `src/symbols/types.ts`, `PACKS` in `src/editor/search.ts` and `src/editor/search.test.ts` agree on <!-- gen:n.packIds -->15<!-- /gen --> ids. The inventory proposes <!-- gen:n.newPacks -->6<!-- /gen --> more pack names, which would make <!-- gen:n.libraryGroups -->21<!-- /gen --> groups. The library will group the packs under a few headings (the lead's work) and will not show that many.
- **Science checks need a model.** The science checks of a row are written about atoms, bonds and electrons, but a symbol returns only paths. A symbol file exports its data (the element table, the molecule library) so that a test can check it. The author brief forbids authors to write tests; for these packs the lead changes that rule, and the author owns a `<pack>.science.test.ts`.

## Counts

<!-- gen:counts -->
| Dimension | Value | Rows |
| --- | --- | --- |
| total | rows | 293 |
| subject | chemistry | 219 |
| subject | biology | 37 |
| subject | physics | 37 |
| level | KS4 | 205 |
| level | KS5 | 88 |
| kind | symbol | 58 |
| kind | compound | 79 |
| kind | template | 2 |
| kind | process | 32 |
| kind | chart | 40 |
| kind | covered | 82 |
| priority | A | 61 |
| priority | B | 115 |
| priority | C | 117 |
| confidence | checked | 125 |
| confidence | secondary | 78 |
| confidence | unverified | 90 |
<!-- /gen -->

Kind by priority, all subjects:

<!-- gen:kind-priority -->
| Kind | A | B | C | Total |
| --- | --- | --- | --- | --- |
| symbol | 15 | 17 | 26 | 58 |
| compound | 9 | 37 | 33 | 79 |
| template | 0 | 2 | 0 | 2 |
| process | 5 | 7 | 20 | 32 |
| chart | 3 | 19 | 18 | 40 |
| covered | 29 | 33 | 20 | 82 |
| all | 61 | 115 | 117 | 293 |
<!-- /gen -->

Reading the numbers:

- <!-- gen:n.covered -->82<!-- /gen --> rows are already covered by a symbol or a template. They need no new code, only a recipe and a check that the picture shows what the lesson needs. <!-- gen:n.charts -->40<!-- /gen --> rows are charts, which the specification puts outside PracDraw. The other <!-- gen:n.new -->171<!-- /gen --> rows need something new: <!-- gen:n.symbol -->58<!-- /gen --> symbols, <!-- gen:n.compound -->79<!-- /gen --> compounds, <!-- gen:n.template -->2<!-- /gen --> templates and <!-- gen:n.process -->32<!-- /gen --> process diagrams.
- Of the chemistry rows, <!-- gen:n.newChem -->120<!-- /gen --> need something new (symbols, compounds, templates and process diagrams). The templates need no new drawing code beyond the small additions listed under Build order, so <!-- gen:n.newDrawingsChem -->118<!-- /gen --> chemistry drawings (symbols, compounds and process diagrams) need new code. Several rows share one engine (the Bohr atom and the ion, or all the displayed formulae), so the number of separate pieces of code is smaller than the number of drawings. My estimate, not a measurement, is <!-- gen:n.estLow -->47<!-- /gen --> to <!-- gen:n.estHigh -->71<!-- /gen --> separate pieces of code.

### Tags

A row may carry tags. They mark the rows that depend on a decision or on a new capability, and the decisions quote these counts.

<!-- gen:tags -->
| Tag | What it marks | Rows | The rows |
| --- | --- | --- | --- |
| `skeletal` | Needs a skeletal-formula drawing (a zig-zag line formula). | 9 | `skeletalFormula`, `structuralIsomers`, `ezIsomers`, `mechanismDehydrationAlcohol`, `benzeneStructure`, `polyesterPolyamideRepeat`, `triglycerideSoap`, `dnaBasePairing`, `synthesisRouteMap` |
| `curlyArrow` | Needs the curly (curved) arrow, a new kind of connector in the editor. | 8 | `curlyArrow`, `mechanismElectrophilicAddition`, `mechanismNucleophilicSubstitution`, `mechanismElimination`, `mechanismDehydrationAlcohol`, `mechanismCarbonylAddition`, `mechanismAdditionElimination`, `mechanismElectrophilicSubstitution` |
| `mechanism` | Is a reaction mechanism: steps that show where the electrons move. | 9 | `mechanismRadicalSubstitution`, `mechanismElectrophilicAddition`, `mechanismNucleophilicSubstitution`, `mechanismElimination`, `mechanismDehydrationAlcohol`, `mechanismCarbonylAddition`, `mechanismAdditionElimination`, `mechanismElectrophilicSubstitution`, `ozoneDepletionMechanism` |
| `wedge` | Needs the wedge and dash bond, to show a three-dimensional shape in a flat formula. | 8 | `vseprShapes`, `bondPolarityDipoles`, `oxoacidStructures`, `complexIonShapes`, `complexIsomers`, `hexaaquaAcidity`, `skeletalFormula`, `opticalIsomers` |
| `3d` | Needs a three-dimensional structure drawn in an oblique projection. | 16 | `ballAndStickModel`, `ionicLattice3D`, `diamondStructure`, `graphiteStructure`, `fullereneC60`, `carbonNanotube`, `silicaStructure`, `surfaceAreaVolumeCubes`, `orbitalShapes`, `iceLattice`, `iodineLattice`, `magnesiumLattice`, `phosphorusSulfurMolecules`, `p4o10Cage`, `benzeneStructure`, `sigmaPiBonding` |
| `dotCross` | Draws the electrons of two atoms with different marks (dots and crosses). | 4 | `ionShell`, `ionicDotCross`, `covalentDotCross`, `covalentDotCrossAdvanced` |
| `fill` | Needs a grey tint or a hatch fill to tell particles, atoms or regions apart. | 14 | `particleElementCompoundMixture`, `atomModels`, `periodicTable`, `ballAndStickModel`, `spaceFillingModel`, `alloyStructure`, `fullereneC60`, `silicaStructure`, `balancedEquationModels`, `limitingReactantModels`, `equilibriumClosedSystem`, `compositeMaterial`, `smallMoleculeForces`, `p4o10Cage` |
| `symbolText` | Puts element symbols, charges or numbers inside a symbol, which rule S11 does not allow. | 19 | `bohrAtom`, `ionShell`, `nuclideNotation`, `periodicTable`, `ionicDotCross`, `covalentDotCross`, `displayedFormulaSmall`, `ballAndStickModel`, `ionicLattice2D`, `ionicLattice3D`, `displayedFormulaHydrocarbon`, `displayedFormulaFunctional`, `electronBoxDiagram`, `subshellEnergyLevels`, `covalentDotCrossAdvanced`, `vseprShapes`, `magnesiumLattice`, `complexIonShapes`, `formulaTriangle` |
| `hazard` | Is the hazard symbols row, whose real red border breaks rule S6. | 1 | `hazardSymbols` |
<!-- /gen -->

## What each pack would draw

The library group says whether the pack name is already a group of the library (`exists`), would be a new one (`new`), or holds no symbols (`none`: covered rows, templates and charts).

<!-- gen:packs -->
| Pack | Subject | Library group | Rows | A | B | C | KS4 | KS5 | Examples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| atoms | chemistry | exists | 14 | 8 | 3 | 3 | 9 | 5 | `alphaScattering`, `atomModels`, `bohrAtom`, `covalentDotCross` |
| matter | chemistry and physics | exists | 10 | 4 | 4 | 2 | 10 | 0 | `changeOfState`, `collisionTheoryParticles`, `particleElementCompoundMixture`, `particleStates` |
| molecules | chemistry | new | 33 | 7 | 20 | 6 | 15 | 18 | `additionPolymerisation`, `alkeneAdditionReactions`, `balancedEquationModels`, `ballAndStickModel` |
| structures | chemistry | exists | 15 | 7 | 7 | 1 | 12 | 3 | `alloyStructure`, `diamondStructure`, `fullereneC60`, `grapheneSheet` |
| energy | chemistry | exists | 8 | 1 | 6 | 1 | 2 | 6 | `reactionProfile`, `benzeneEnthalpyLevels`, `bondEnergyDiagram`, `bornHaberCycle` |
| flow | chemistry | new | 17 | 3 | 5 | 9 | 11 | 6 | `haberProcess`, `potableWaterTreatment`, `wasteWaterTreatment`, `bioleaching` |
| plants | chemistry | new | 4 | 1 | 1 | 2 | 4 | 0 | `crudeOilFractionatingTower`, `desalinationReverseOsmosis`, `blastFurnace`, `catalyticConverter` |
| scenes | chemistry | new | 2 | 1 | 1 | 0 | 2 | 0 | `greenhouseEffect`, `acidRainFormation` |
| electrochemistry | chemistry | exists | 6 | 3 | 2 | 1 | 5 | 1 | `aluminiumExtractionCell`, `electrolysisIons`, `fuelCell`, `sacrificialProtection` |
| annotation | chemistry | exists | 4 | 1 | 1 | 2 | 4 | 0 | `pHScale`, `flameColours`, `formulaTriangle`, `hazardSymbols` |
| biomolecules | chemistry | new | 7 | 0 | 3 | 4 | 2 | 5 | `aminoAcidZwitterion`, `dnaBasePairing`, `dnaStructure`, `cisplatinDna` |
| mechanisms | chemistry | new | 10 | 0 | 9 | 1 | 0 | 10 | `curlyArrow`, `mechanismAdditionElimination`, `mechanismCarbonylAddition`, `mechanismDehydrationAlcohol` |
| labTemplates | chemistry | none | 10 | 4 | 6 | 0 | 10 | 0 | `carbonateTest`, `gasTests`, `rustingTubes`, `simpleCell` |
| organicApparatus | chemistry | none | 6 | 0 | 4 | 2 | 4 | 2 | `columnChromatography`, `crackingApparatus`, `dehydrationEthanolApparatus`, `fractionalDistillationLab` |
| biology | biology | exists | 28 | 0 | 0 | 28 | 28 | 0 | `bioBacterialCell`, `bioBloodCells`, `bioBloodVessels`, `bioCarbonCycle` |
| physics | physics | exists | 22 | 0 | 0 | 22 | 22 | 0 | `physEnergyTransfer`, `physFissionChain`, `physFreeBodyDiagram`, `physGeneratorTransformer` |
| charts | chemistry and biology and physics | none | 40 | 3 | 19 | 18 | 24 | 16 | `heatingCurve`, `rateGraph`, `reactivitySeriesList`, `arrheniusPlot` |
| apparatus | chemistry and biology and physics | none | 57 | 18 | 24 | 15 | 41 | 16 | `alkeneBromineTest`, `chromatogramRf`, `chromatographyApparatus`, `electrolysisPetriLid` |
<!-- /gen -->

## Confidence and limits

The AQA website and its PDFs could not be opened from this environment. The search tool could read AQA pages, specification PDFs, question papers, mark schemes, reports on the examination and practical handbooks, and it returned a paraphrase with section numbers. I never saw a figure.

- `checked` (<!-- gen:n.checked -->125<!-- /gen --> rows): the search tool's account of an AQA page, paper or practical handbook reported the requirement, the figure or the apparatus for this diagram. It does not mean that anyone compared a drawing with an AQA drawing, and a mistake in a paraphrase would be copied here.
- `secondary` (<!-- gen:n.secondary -->78<!-- /gen --> rows): a revision or teaching site (Save My Exams, Oak National Academy, Doc Brown's, Chemguide) described the diagram. The AQA text named the topic.
- `unverified` (<!-- gen:n.unverified -->90<!-- /gen --> rows): from memory, or the AQA text named the topic but not the picture, or two readers could not confirm it.

The test requires an AQA address on every `checked` row and a revision-site address on every `secondary` row. It does not use the network, so it cannot tell whether an address is real: a `checked` row that cites an invented AQA address would pass. A person should open the addresses.

What could not be reached or checked:

- The AQA specification PDFs were not opened. Every AQA statement here came through the search tool's paraphrase, and AQA's copyright rule stops the tool quoting, so I have no exact wording.
- BBC Bitesize was blocked for the search tool. The revision-site rows come from Save My Exams, Oak National Academy, Doc Brown's and Chemguide.
- Specification references (`specRefs`) appear only where a summary showed the number. Many rows have none, and most Trilogy numbers (section 5) are not given.
- Which topics are chemistry only (8462 but not 8464) is partly from the "chemistry only" labels that the summaries showed and partly from memory.
- The biology and physics rows are an outline: one line each, mostly from memory.
- The counts are my grouping. Another person might split or join families differently, so treat them as approximate.

## Rows to check against the AQA PDF

Because the PDF could not be opened, the first job for a person with access is to check these rows against the specification PDF and a recent paper. The lists run from the greatest risk to the least. `checked` is second-hand: it means that a search tool's account of an AQA page or paper reported the requirement, not that anyone compared a drawing with an AQA figure.

### Priority A rows that are not `checked` (<!-- gen:n.aRisk -->26<!-- /gen --> rows, the unverified ones first)

<!-- gen:check-risk -->
| Row | Name | Confidence | Course | Look under | What to confirm |
| --- | --- | --- | --- | --- | --- |
| `heatingCurve` | Heating and cooling curve of a pure substance | unverified | 8464, 8462 | Bonding, structure and the properties of matter | Do papers on states of matter use heating or cooling curves? |
| `particleElementCompoundMixture` | Particle diagram of an element, a compound or a mixture | secondary | 8464, 8462 | Atomic structure and the periodic table (8462 4.1.1.1) | Do papers draw particle pictures of elements, compounds and mixtures (4.1.1.1 and the next section)? |
| `alphaScattering` | Alpha-particle scattering experiment | secondary | 8464, 8462 | Atomic structure and the periodic table (8462 4.1.1.3) | Does the specification or a paper show the scattering experiment, or only ask students to explain it? |
| `ionShell` | Electron arrangement of an ion (shell diagram in brackets) | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.1.2) | Do papers expect the bracketed shell diagram of an ion with its charge? |
| `nuclideNotation` | Nuclear (isotope) notation with mass number and atomic number | secondary | 8464, 8462 | Atomic structure and the periodic table (8462 4.1.1.5) | The notation printed in 4.1.1.5 (mass number over atomic number). |
| `particleStates` | Particle diagrams of a solid, a liquid and a gas | secondary | 8464, 8462 | Bonding, structure and the properties of matter | The states-of-matter pictures and the limitations of the model. |
| `changeOfState` | Changes of state (melting, freezing, boiling, condensing, sublimation) | secondary | 8464, 8462 | Bonding, structure and the properties of matter | Is a changes-of-state diagram drawn, or are only the terms used? |
| `metallicBonding` | Metallic bonding (positive ions in a sea of delocalised electrons) | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.1.5) | The wording of 4.2.1.5: do students recognise metallic structures from diagrams of their bonding? |
| `alloyStructure` | Alloy and pure metal layers (why alloys are harder) | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.2.7) | The alloy layers picture in the section on metals and alloys. |
| `diamondStructure` | Diamond (giant covalent, tetrahedral) | secondary | 8464, 8462, 7405 | Bonding, structure and the properties of matter (8462 4.2.3, 7405 3.1.3.4) | Do papers show the carbon structures, or ask only for properties? (A-level 3.1.3.4 asks students to draw them.) |
| `graphiteStructure` | Graphite (layers of hexagons) | secondary | 8464, 8462, 7405 | Bonding, structure and the properties of matter (8462 4.2.3, 7405 3.1.3.4) | Do papers show the carbon structures, or ask only for properties? (A-level 3.1.3.4 asks students to draw them.) |
| `grapheneSheet` | Graphene (one layer of hexagons) | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.3) | Do papers show graphene and fullerenes for recognition (4.2.3)? |
| `fullereneC60` | Buckminsterfullerene C60 | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.3) | Do papers show graphene and fullerenes for recognition (4.2.3)? A 2022 Higher paper showed C70. |
| `balancedEquationModels` | A balanced equation drawn with particle models | secondary | 8464, 8462 | Quantitative chemistry | Do papers draw balanced equations with particle models? |
| `reactivitySeriesList` | Reactivity series (ordered list with carbon and hydrogen) | secondary | 8464, 8462 | Chemical changes | The reactivity series as printed in the specification, with carbon and hydrogen in place. |
| `metalsAcidTubes` | Metals in dilute acid in test tubes (rate of bubbling) | secondary | 8464, 8462 | Chemical changes | Do papers show test tubes, or only tables of observations? |
| `metalDisplacementTubes` | Displacement of a metal from a salt solution | secondary | 8464, 8462 | Chemical changes | Do papers show test tubes, or only tables of observations? |
| `pHScale` | pH scale with universal indicator colours | secondary | 8464, 8462 | Chemical changes | The pH colour bands the specification and papers use. |
| `electrolysisIons` | Electrolysis cell with the movement of ions | secondary | 8464, 8462 | Chemical changes (8462 4.4.3.1, 8462 4.4.3.2, 8462 4.4.3.4) | Is a cell with moving ions drawn in papers (4.4.3.1 to 4.4.3.4)? |
| `aluminiumExtractionCell` | Electrolysis cell for the extraction of aluminium | secondary | 8464, 8462 | Chemical changes (8462 4.4.3.3) | The aluminium cell figure in papers on 4.4.3.3. |
| `fuelCell` | Hydrogen fuel cell | secondary | 8462, 7405 | Energy changes (8462 4.5.2.2, 7405 3.1.11.2) | The fuel cell diagram in papers on 4.5.2.2, and the half-equation forms (acid and alkaline). |
| `collisionTheoryParticles` | Collision theory: particle pictures for concentration, temperature and surface area | secondary | 8464, 8462 | The rate and extent of chemical change | Do papers use particle collision pictures for the rate factors? |
| `alkeneBromineTest` | Bromine water test for an alkene | secondary | 8464, 8462 | Organic chemistry | Is the bromine water test drawn in test tubes or only described? |
| `greenhouseEffect` | The greenhouse effect | secondary | 8464, 8462 | Chemistry of the atmosphere (8462 4.9.2) | The greenhouse effect diagram, and what the incoming radiation is called. |
| `wasteWaterTreatment` | Treatment of waste water (sewage) | secondary | 8464, 8462 | Using resources (8462 4.10.1.3, 8464 5.10.1.3) | The sewage treatment flow chart in 4.10.1.3. |
| `rustingTubes` | Rusting experiment (nails in test tubes) | secondary | 8462 | Using resources | The rusting tubes: what is in each tube, and whether papers draw them. |
<!-- /gen -->

### Priority B chemistry rows that are `unverified` (<!-- gen:n.bRisk -->12<!-- /gen --> rows)

<!-- gen:check-b -->
| Row | Name | Confidence | Course | Look under | What to confirm |
| --- | --- | --- | --- | --- | --- |
| `limitingReactantModels` | Limiting reactant shown with particle models (before and after) | unverified | 8464, 8462 | Quantitative chemistry | Do papers use particle pictures for a limiting reactant? |
| `temperatureTimeGraph` | Temperature against time or volume for a reaction | unverified | 8464, 8462 | Energy changes | The graph asked for in the temperature change practical. |
| `rateLossOfMass` | Rate of reaction measured by loss of mass | unverified | 8464, 8462 | The rate and extent of chemical change (8462 4.6.1.1) | Whether papers or practical sheets draw the loss-of-mass method (4.6.1.1). |
| `electronBoxDiagram` | Electron configuration in sub-shell boxes (s, p and d) with spin arrows | unverified | 7405 | Physical chemistry (A-level) (7405 3.1.1.3) | Whether 7405 3.1.1.3 asks for electrons-in-boxes diagrams. |
| `reactionProfileMultiStep` | Reaction profile with an intermediate and a rate-determining step | unverified | 7405 | Physical chemistry (A-level) | A-level: two-step profiles and the rate-determining step. |
| `calorimetryCoolingGraph` | Temperature-time graph with extrapolation (calorimetry) | unverified | 7405 | Physical chemistry (A-level) | A-level practical 2: the extrapolation graph. |
| `synthesisRouteMap` | Multi-step organic synthesis route (reagents and conditions) | unverified | 7405 | Organic chemistry (A-level) | A-level section 3.3.14: how routes are drawn. |
| `columnChromatography` | Column chromatography apparatus | unverified | 7405 | Organic chemistry (A-level) (7405 3.3.16) | A-level section 3.3.16: whether the column apparatus is drawn. |
| `dehydrationEthanolApparatus` | Dehydration of ethanol to ethene (apparatus) | unverified | 7405 | Organic chemistry (A-level) | A-level section 3.3.5: the dehydration apparatus (the suggested practical makes cyclohexene from cyclohexanol by distillation). |
| `fractionalDistillationLab` | Fractional distillation in the laboratory (ethanol and water) | unverified | 8464, 8462 | Organic chemistry | Whether laboratory fractional distillation is named for GCSE. |
| `gasCollectionMethods` | Collecting a gas by downward or upward delivery | unverified | 8464, 8462 | Chemical analysis | Which gas collection methods papers draw. |
| `conductivityTest` | Testing whether a substance conducts electricity | unverified | 8464, 8462 | Bonding, structure and the properties of matter | Whether the conductivity apparatus is drawn for ionic compounds. |
<!-- /gen -->

### Priority A rows that are `checked` (<!-- gen:n.aChecked -->35<!-- /gen --> rows)

Open the address and compare the requirement with the row.

<!-- gen:check-checked -->
| Row | Name | Course | Look under | AQA address cited |
| --- | --- | --- | --- | --- |
| `atomModels` | Models of the atom: plum pudding, nuclear and shell | 8464, 8462 | Atomic structure and the periodic table (8462 4.1.1.3) | [atomic-structure-and-the-periodic-table](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/atomic-structure-and-the-periodic-table) |
| `bohrAtom` | Bohr model of an atom (electronic structure diagram) | 8464, 8462 | Atomic structure and the periodic table (8462 4.1.1.7) | [atomic-structure-and-the-periodic-table](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/atomic-structure-and-the-periodic-table) |
| `periodicTable` | Periodic table (outline with groups, periods and metal divider) | 8464, 8462 | Atomic structure and the periodic table (8462 4.1.2.1) | [atomic-structure-and-the-periodic-table](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/atomic-structure-and-the-periodic-table) |
| `ionicDotCross` | Dot-and-cross diagram of an ionic compound | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.1.2) | [bonding-structure-and-the-properties-of-matter](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/bonding-structure-and-the-properties-of-matter) |
| `covalentDotCross` | Dot-and-cross diagram of a simple covalent molecule | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.1.4) | [bonding-structure-and-the-properties-of-matter](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/bonding-structure-and-the-properties-of-matter) |
| `displayedFormulaSmall` | Displayed formula of a small molecule (lines for bonds) | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.1.4) | [bonding-structure-and-the-properties-of-matter](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/bonding-structure-and-the-properties-of-matter) |
| `ballAndStickModel` | Ball-and-stick model of a small molecule | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.1.4) | [bonding-structure-and-the-properties-of-matter](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/bonding-structure-and-the-properties-of-matter) |
| `ionicLattice2D` | Giant ionic lattice in two dimensions | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.1.3) | [bonding-structure-and-the-properties-of-matter](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/bonding-structure-and-the-properties-of-matter) |
| `titrationSetup` | Titration apparatus (burette, flask and white tile) | 8462, 7405 | Quantitative chemistry | [practical-assessment](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/practical-assessment) |
| `saltPreparation` | Preparing a pure dry soluble salt (react, filter, evaporate) | 8464, 8462 | Chemical changes | [practical-assessment](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/practical-assessment) |
| `electrolysisPetriLid` | Electrolysis of an aqueous solution with a Petri dish lid (required practical) | 8464, 8462 | Chemical changes (8462 4.4.3.4) | [practical-assessment](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/practical-assessment) |
| `reactionProfile` | Reaction profile (energy level diagram): exothermic and endothermic | 8464, 8462 | Energy changes (8462 4.5.1.2) | [energy-changes](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/energy-changes) |
| `temperatureChangeCup` | Temperature change of a reaction in a polystyrene cup (required practical) | 8464, 8462 | Energy changes | [practical-assessment](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/practical-assessment) |
| `simpleCell` | Simple cell: two metals in an electrolyte with a voltmeter | 8462 | Energy changes (8462 4.5.2.1) | [energy-changes](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/energy-changes) |
| `rateGraph` | Rate graph: amount of product against time, with a tangent | 8464, 8462 | The rate and extent of chemical change (8462 4.6.1.1) | [the-rate-and-extent-of-chemical-change](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/the-rate-and-extent-of-chemical-change) |
| `rateGasSyringeApparatus` | Rate of reaction: gas collected in a gas syringe | 8464, 8462 | The rate and extent of chemical change | [practical-assessment](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/practical-assessment) |
| `rateGasOverWaterApparatus` | Rate of reaction: gas collected over water | 8464, 8462 | The rate and extent of chemical change | [practical-assessment](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/practical-assessment) |
| `rateDisappearingCross` | Rate of reaction: disappearing cross (sodium thiosulfate and acid) | 8464, 8462 | The rate and extent of chemical change | [practical-assessment](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/practical-assessment) |
| `crudeOilFractionatingTower` | Fractional distillation of crude oil (industrial column) | 8464, 8462, 7405 | Organic chemistry | [organic-chemistry](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/organic-chemistry) |
| `displayedFormulaHydrocarbon` | Displayed formula of an alkane or alkene | 8464, 8462, 7405 | Organic chemistry | [organic-chemistry](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/organic-chemistry) |
| `displayedFormulaFunctional` | Displayed formula of an alcohol or a carboxylic acid | 8462, 7405 | Organic chemistry | [organic-chemistry](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/organic-chemistry) |
| `alkeneAdditionReactions` | Addition reactions of alkenes (hydrogen, water, halogens) in displayed formulae | 8462, 7405 | Organic chemistry | [organic-chemistry](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/organic-chemistry) |
| `additionPolymerisation` | Addition polymerisation (monomer to repeating unit) | 8462, 7405 | Organic chemistry | [organic-chemistry](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/organic-chemistry) |
| `chromatogramRf` | Paper chromatogram with Rf measurements | 8464, 8462 | Chemical analysis (8462 4.8.1.3) | [chemical-analysis](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/chemical-analysis) |
| `chromatographyApparatus` | Paper chromatography apparatus | 8464, 8462 | Chemical analysis | [practical-assessment](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/practical-assessment) |
| `filtrationApparatus` | Filtration apparatus (separating an insoluble solid) | 8464, 8462 | Atomic structure and the periodic table (8462 4.1.1.2) | [atomic-structure-and-the-periodic-table](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/atomic-structure-and-the-periodic-table) |
| `gasTests` | Tests for hydrogen, oxygen, carbon dioxide and chlorine | 8464, 8462 | Chemical analysis | [chemical-analysis](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/chemical-analysis) |
| `carbonateTest` | Test for a carbonate (acid, then limewater) | 8462 | Chemical analysis | [chemical-analysis](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/chemical-analysis) |
| `flameTestApparatus` | Flame test apparatus (nichrome wire in a blue flame) | 8462 | Chemical analysis (8462 4.8.3.1) | [chemical-analysis](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/chemical-analysis) |
| `halideSulfateTubes` | Halide and sulfate precipitate tests in test tubes | 8462 | Chemical analysis | [chemical-analysis](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/chemical-analysis) |
| `hydroxideTubes` | Metal hydroxide precipitates with sodium hydroxide solution | 8462 | Chemical analysis (8462 4.8.3.2) | [chemical-analysis](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/chemical-analysis) |
| `waterAnalysisPurification` | Water analysis and purification (distillation set-up) | 8464, 8462 | Chemical analysis | [practical-assessment](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/practical-assessment) |
| `potableWaterTreatment` | Treatment of water to make it safe to drink (potable water) | 8464, 8462 | Using resources | [using-resources](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/using-resources) |
| `haberProcess` | The Haber process (flow diagram) | 8462 | Using resources (8462 4.10.4) | [using-resources](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/subject-content/using-resources) |
| `heatingLiquidBeaker` | Heating a liquid in a beaker (Bunsen burner, tripod, gauze, thermometer) | 8464, 8462 | Working scientifically and practical skills | [practical-assessment](https://www.aqa.org.uk/subjects/chemistry/gcse/chemistry-8462/specification/practical-assessment) |
<!-- /gen -->

### Checks that apply to many rows

- **Course tags.** The topics that are chemistry only are nanoparticles (4.2.4), transition metals (4.1.3), yield and atom economy (4.3.3), chemical cells (4.5.2.1), alkenes and alcohols (4.7.2), polymers and DNA (4.7.3), the tests for ions (4.8.3), using materials (4.10.3) and the Haber process (4.10.4). Waste water treatment and the alternative extraction of metals are in both courses (Trilogy 5.10.1.3 and 5.10.1.4, the second for the Higher Tier only). The summaries confirmed 4.1.3, 4.7.2, 4.7.3, 4.8.3, 4.10.3 and 4.10.4; I took the rest from memory.
- **The eight dot-and-cross molecules** in 4.2.1.4 are hydrogen, chlorine, oxygen, nitrogen, hydrogen chloride, water, ammonia and methane. The extra molecules of the small-molecule library are my additions.
- **Whether AQA prints a figure** for the aluminium cell, the hydrogen fuel cell, the waste water treatment and the life cycle assessment. The AQA text names the topic and the steps; the pictures here are the usual teaching ones.
- **A-level 7405.** Whether orbital shapes and electrons in boxes are required (3.1.1.3: two readers could not confirm either), the wording of 3.3.5, 3.3.13 and 3.3.14, and the Born-Haber and Hess detail in 3.1.4 and 3.1.8, which the summaries gave only in outline.
- **Practical numbers.** Trilogy practicals 8 to 13 are the chemistry ones. The Trilogy biology practicals are numbered one lower than in GCSE Biology (8461) after the first, and the rows say which numbering they use.

## How this was made

I read the specification pages through the search tool one section at a time (8462 sections 4.1 to 4.10, 7405 sections 3.1 to 3.3 and the twelve practicals, and the 8461 and 8463 sections for the outline), then the question papers and reports it named, then revision sites for the diagrams that the AQA text only names. Rows were written in parts and merged by a script outside the project. Two reviewers then checked the list, and their findings are in the rows (notes that say "a second reader"). The tables and numbers of this document are written by `npm run gen:inventory`. Every source address in the list is one that a search tool returned.

## Rows by topic (appendix)

Every row once, under its topic, for looking things up. The last column is the start of the row's `draw` field in `spec/diagrams.json`.

<!-- gen:rows-by-topic -->
### Chemistry, KS4

#### Atomic structure and the periodic table (13)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `particleElementCompoundMixture` | Particle diagram of an element, a compound or a mixture | covered | matter | A | secondary | 8464, 8462 | Covered by `particleBox`. Use the particleBox symbol: set `substance` (element, molecules, compound, mixtureElements, mixtureCompounds or mixtureElementCompound), `state` (gas, liquid or solid), `count` (6 to 40; a molecule counts as one) and, for a ... |
| `atomModels` | Models of the atom: plum pudding, nuclear and shell | symbol | atoms | A | checked | 8464, 8462 | Plum pudding: a large circle with a pale fill, small electrons (marked with a minus sign) scattered inside it, and a label saying that the positive charge is spread through the ball. |
| `alphaScattering` | Alpha-particle scattering experiment | compound | atoms | A | secondary | 8464, 8462 | On the left a source of alpha particles in a lead block with a narrow slit. A straight beam to a thin gold foil drawn as a vertical strip of small circles (the atoms) with a tiny nucleus dot in each. |
| `bohrAtom` | Bohr model of an atom (electronic structure diagram) | symbol | atoms | A | checked | 8464, 8462 | Concentric circles for the shells (radii about 28, 48, 68 and 88 u), the nucleus at the centre labelled with the symbol or with the numbers of protons and neutrons, and electrons as small dots or crosses spaced evenly round each ... |
| `nuclideNotation` | Nuclear (isotope) notation with mass number and atomic number | symbol | atoms | A | secondary | 8464, 8462 | The element symbol in 18 u text with two small stacked numbers at its left: the mass number above, the atomic number below, right-aligned with each other. |
| `isotopeNuclei` | Isotopes drawn as nuclei (protons and neutrons) | symbol | atoms | B | secondary | 8464, 8462 | A tight cluster of circles for the nucleus: protons marked with a plus sign, neutrons plain. |
| `periodicTable` | Periodic table (outline with groups, periods and metal divider) | symbol | atoms | A | checked | 8464, 8462 | A grid of 18 columns and 7 rows of square cells (the f-block as two separate rows below). Each cell can show the symbol, the atomic number, the name or the relative atomic mass. |
| `mendeleevTable` | Mendeleev's early periodic table with gaps | chart | charts | C | unverified | 8464, 8462 | A table of rows and columns of element symbols in order of atomic weight with a few question marks where elements were then unknown (the gaps that predicted gallium and germanium). |
| `subatomicParticlesTable` | Table of relative charge and mass of the subatomic particles | chart | charts | C | unverified | 8464, 8462 | A three-row table: proton (relative charge +1, relative mass 1), neutron (0, 1), electron (-1, very small, about 1/1835). |
| `groupOneWater` | A Group 1 metal reacting with water | covered | labTemplates | B | secondary | 8464, 8462 | Covered by `groupOneWater`. Use the groupOneWater template: a beaker of water with a piece of lithium floating at the surface, bubbles below it and a burning splint above. |
| `halogenDisplacement` | Halogen displacement reactions in test tubes | covered | apparatus | B | secondary | 8464, 8462 | Covered by `testTubeReactions`. Use the testTubeReactions template with three or four tubes in a rack. |
| `groupTrendChart` | Graph of a property down a group (melting or boiling point) | chart | charts | C | unverified | 8464, 8462 | A line graph or bar chart of melting point or boiling point against the elements of Group 1 or Group 7, used to predict a missing value. |
| `filtrationApparatus` | Filtration apparatus (separating an insoluble solid) | covered | apparatus | A | checked | 8464, 8462 | Covered by `filtration`. Use the filtration template: a funnel with fluted or folded filter paper standing in the neck of a conical flask, the residue (for example sand) on the paper and the filtrate in the flask. |

#### Bonding, structure and the properties of matter (25)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ionShell` | Electron arrangement of an ion (shell diagram in brackets) | symbol | atoms | A | secondary | 8464, 8462 | The shell diagram of bohrAtom for the ion: a metal ion has lost its outer shell, a non-metal ion has the electrons it gained added to its outer shell. |
| `particleStates` | Particle diagrams of a solid, a liquid and a gas | covered | matter | A | secondary | 8464, 8462 | Covered by `particleBox`. Use three particleBox parts side by side with `state` solid, liquid and gas (same substance and count, `motion` on if wanted), and label them with label items. |
| `changeOfState` | Changes of state (melting, freezing, boiling, condensing, sublimation) | compound | matter | A | secondary | 8464, 8462 | Three particle boxes (solid, liquid, gas) in a row with a pair of labelled arrows between solid and liquid (melting above, freezing below) and between liquid and gas (boiling or evaporating above, condensing below). |
| `heatingCurve` | Heating and cooling curve of a pure substance | chart | charts | A | unverified | 8464, 8462 | Axes: temperature (vertical) against time (horizontal). |
| `ionicDotCross` | Dot-and-cross diagram of an ionic compound | symbol | atoms | A | checked | 8464, 8462 | Two forms. Transfer: the metal atom and the non-metal atom as circles for their outer shells, the metal's electrons as dots and the non-metal's as crosses, with curved arrows showing the electrons moving across. |
| `covalentDotCross` | Dot-and-cross diagram of a simple covalent molecule | symbol | atoms | A | checked | 8464, 8462 | One circle for the outer shell of each atom, overlapping where atoms are bonded. Each shared pair sits in the overlap as one dot and one cross. |
| `displayedFormulaSmall` | Displayed formula of a small molecule (lines for bonds) | symbol | molecules | A | checked | 8464, 8462 | Atom symbols in 15 u text joined by single lines, double lines or triple lines, laid out flat with the bonds at right angles or at 120 degrees (the 2D convention, not the real shape). |
| `ballAndStickModel` | Ball-and-stick model of a small molecule | symbol | molecules | A | checked | 8464, 8462 | Spheres joined by sticks, drawn as plain circles (no shading, no gradient, no highlight: rule S1) and sticks as two parallel lines in an oblique view. |
| `spaceFillingModel` | Space-filling model of a small molecule | symbol | molecules | C | secondary | 8464, 8462 | Overlapping circles at the atom positions with the nearer atoms drawn in front, and a key for the atoms. No sticks. |
| `ionicLattice2D` | Giant ionic lattice in two dimensions | symbol | structures | A | checked | 8464, 8462 | A square grid of touching circles in alternating kinds: the positive ions small and marked +, the negative ions larger and marked -. |
| `ionicLattice3D` | Sodium chloride lattice in three dimensions (ball and stick) | covered | structures | B | secondary | 8464, 8462, 7405 | Covered by `ionicLattice3D`. Use the ionicLattice3D symbol: a 3 by 3 by 3 block of 27 ions in the oblique view, 14 Cl- (large, grey with hatch) and 13 Na+ (small, white), with 54 bonds between unlike ions and the three hidden back bonds dashed. |
| `metallicBonding` | Metallic bonding (positive ions in a sea of delocalised electrons) | symbol | structures | A | secondary | 8464, 8462 | Rows of equal circles marked + (the metal ions) in a regular lattice, with small dots or minus signs scattered in the gaps between them (the delocalised electrons, drawn irregularly, not in rows). |
| `alloyStructure` | Alloy and pure metal layers (why alloys are harder) | symbol | structures | A | secondary | 8464, 8462 | Rows of equal circles for the pure metal, with a heavy arrow showing one layer sliding over the next. |
| `diamondStructure` | Diamond (giant covalent, tetrahedral) | covered | structures | A | secondary | 8464, 8462, 7405 | Covered by `diamondStructure`. Use the diamondStructure symbol: a cluster of 17 carbon atoms (one atom, its four neighbours and their twelve other neighbours) with 16 bonds, in the oblique view turned about the vertical axis so that no circles overlap. |
| `graphiteStructure` | Graphite (layers of hexagons) | covered | structures | A | secondary | 8464, 8462, 7405 | Covered by `graphiteStructure`. Use the graphiteStructure symbol: 2 to 4 (default 3) identical sheets one above the other, each a patch of two rows of three hexagons (22 atoms) in the oblique view, with a short stub at every edge atom to show that the net goes ... |
| `grapheneSheet` | Graphene (one layer of hexagons) | symbol | structures | A | secondary | 8464, 8462 | A flat honeycomb of carbon hexagons, about 4 rows by 5 columns, atoms at the vertices and bonds as lines, with short stubs or a wavy cut line at the edge. |
| `fullereneC60` | Buckminsterfullerene C60 | covered | structures | A | secondary | 8464, 8462 | Covered by `fullereneC60`. Use the fullereneC60 symbol: the truncated icosahedron of 60 carbon atoms and 90 bonds, seen from the direction of a pentagon and tilted a little, as an opaque ball: only the 30 atoms and 40 bonds on faces that face the viewer ... |
| `carbonNanotube` | Carbon nanotube | symbol | structures | B | secondary | 8464, 8462 | A cylinder made by rolling the graphene honeycomb, in oblique view: an open or capped end ellipse, the hexagon network on the visible surface, atoms at the vertices. |
| `silicaStructure` | Silicon dioxide (giant covalent) | symbol | structures | B | secondary | 8464, 8462 | The diamond network with an oxygen atom drawn in the middle of every bond between two silicon atoms. Silicon atoms larger, oxygen smaller, different fills, with a key. |
| `polymerChains` | Polymer chains (linear, branched and cross-linked) | symbol | molecules | B | secondary | 8464, 8462 | Several long zig-zag chains of carbon atoms side by side, with hydrogen stubs. Linear chains (HDPE) lie close and parallel. |
| `ionicConduction` | Why ionic compounds conduct only when molten or dissolved | compound | matter | B | secondary | 8464, 8462 | Three particle boxes of + and - ions: solid (ions fixed in a lattice), molten (ions close together but free), dissolved (ions spread apart in water, with water drawn as plain background). |
| `surfaceAreaVolumeCubes` | Cubes for surface area to volume ratio (nanoparticles and rates) | symbol | structures | B | secondary | 8462 | Cubes of side 1, 2 and 3 units (or one cube cut into 8 smaller cubes) in an oblique view, with grid squares on the visible faces, the side length on an edge, and a line of text under each giving the surface area, the volume and ... |
| `sizeScaleLadder` | Size scale: atoms, nanoparticles and cells on a powers-of-ten line | chart | charts | C | unverified | 8462 | A horizontal line marked in powers of ten from 0.1 nm to 1 mm with labelled objects: atom, small molecule, nanoparticle range (1 to 100 nm), virus, bacterium, cell, hair width. |
| `smallMoleculeForces` | Small molecules with covalent bonds inside and weak forces between them | compound | molecules | B | secondary | 8464, 8462 | Four to eight small molecules (methane, water, carbon dioxide or iodine) arranged in a loose pattern. The covalent bonds inside each molecule are solid lines. |
| `conductivityTest` | Testing whether a substance conducts electricity | covered | labTemplates | B | unverified | 8464, 8462 | Covered by `conductivityTest`. Use the conductivityTest template: a cell and a lamp in series with two carbon rods that dip into the sample without touching each other. |

#### Quantitative chemistry (10)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `massChangeOpenFlask` | Mass change in an open and a closed flask on a balance | covered | apparatus | B | secondary | 8464, 8462 | Covered by `massLoss`. Use the massLoss template: a conical flask on the balance with marble chips, acid and bubbles, a cotton wool plug in the neck, and the balance reading as text. |
| `magnesiumInCrucible` | Heating magnesium in a crucible with a lid (mass gain) | covered | labTemplates | B | secondary | 8464, 8462 | Covered by `magnesiumInCrucible`. Use the magnesiumInCrucible template: a lidded crucible on a pipeclay triangle on a tripod, the flame touching its base, and magnesium ribbon in the crucible. |
| `thermalDecompositionCarbonate` | Thermal decomposition of a metal carbonate with a limewater test | covered | apparatus | B | checked | 8464, 8462 | Covered by `thermalDecomposition`. Use the thermalDecomposition template: a boiling tube of green copper carbonate powder held by a clamp, sloping with its mouth a little higher than its closed end, a Bunsen flame under the powder, a one-hole bung with a delivery ... |
| `balancedEquationModels` | A balanced equation drawn with particle models | compound | molecules | A | secondary | 8464, 8462 | Each formula in the equation drawn as a small ball-and-stick model, the number of models equal to the coefficient, with plus signs and a reaction arrow between the groups. |
| `limitingReactantModels` | Limiting reactant shown with particle models (before and after) | compound | molecules | B | unverified | 8464, 8462 | A box before the reaction with, for example, 6 hydrogen molecules and 3 nitrogen molecules (N2 + 3H2 -> 2NH3), an arrow, and a box after with 4 ammonia molecules and 1 nitrogen molecule left over. |
| `concentrationParticles` | Dilute and concentrated solutions as particle pictures | symbol | matter | B | secondary | 8464, 8462 | Two or three boxes or beakers of equal volume, each showing the same number of water background and a different number of solute particles (circles). |
| `readingScaleQuestion` | Reading a burette or measuring cylinder (enlarged scale) | covered | apparatus | B | secondary | 8464, 8462 | Covered by `scaleWindow`. Use the magnified scale: a section of a burette or measuring cylinder with divisions and the end values, a liquid with a meniscus, and the reading set with the Reading field. |
| `titrationSetup` | Titration apparatus (burette, flask and white tile) | covered | apparatus | A | checked | 8462, 7405 | Covered by `titration`. Use the titration template: a burette clamped upright with its tip inside the neck of a conical flask, the flask on a white tile with alkali and an indicator (Pink preset for phenolphthalein), labels for each part. |
| `titrationResultsTable` | Table of titration results (rough, trials, mean titre) | chart | charts | C | unverified | 8462, 7405 | A ruled table with columns for rough, trial 1, trial 2 and trial 3, and rows for final burette reading, initial reading and titre (cm3), with a line for the mean of the concordant titres. |
| `formulaTriangle` | Formula triangle (moles, concentration and similar) | covered | annotation | C | unverified | 8464, 8462 | Covered by `formulaTriangle`. Use the formulaTriangle symbol: a triangle split by a horizontal and a vertical line into three parts, one quantity at the top and two at the bottom. |

#### Chemical changes (14)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `reactivitySeriesList` | Reactivity series (ordered list with carbon and hydrogen) | chart | charts | A | secondary | 8464, 8462 | A vertical list of metals from most to least reactive (potassium, sodium, lithium, calcium, magnesium, aluminium, then carbon for reference, zinc, iron, hydrogen for reference, copper, silver, gold) with an arrow along the side ... |
| `metalsAcidTubes` | Metals in dilute acid in test tubes (rate of bubbling) | covered | apparatus | A | secondary | 8464, 8462 | Covered by `testTubeReactions`. Use the testTubeReactions template with four tubes in a rack, each with a small piece of a different metal (the metal ribbon symbol, labelled) in Colourless solution. |
| `metalDisplacementTubes` | Displacement of a metal from a salt solution | covered | apparatus | A | secondary | 8464, 8462 | Covered by `testTubeReactions`. Use the testTubeReactions template: tubes with a metal strip or an iron nail in copper sulfate solution (Blue preset) before and after, the blue fading and a brown deposit as a powder layer at the foot of the tube (powder lies at ... |
| `metalOxideCarbonHeating` | Heating a metal oxide with carbon and testing the gas | covered | apparatus | B | secondary | 8464, 8462 | Covered by `thermalDecomposition`. Use the thermalDecomposition template with a black mixture of copper oxide and carbon (Black powder preset) in the boiling tube, the delivery tube into limewater in a test tube, and the Bunsen under the powder. |
| `blastFurnace` | Blast furnace for the extraction of iron | process | plants | C | secondary | 8464, 8462 | A tall furnace outline, wide in the middle and narrower at top and bottom. Inlets: iron ore, coke and limestone at the top, hot air blown in near the bottom. |
| `saltPreparation` | Preparing a pure dry soluble salt (react, filter, evaporate) | covered | apparatus | A | checked | 8464, 8462 | Covered by `crystallisation`. Three pictures in order, all existing templates. Step 1, heatingBeaker: warm dilute acid in a beaker on a gauze, with the insoluble oxide or carbonate added in excess and stirred (glass rod). |
| `pHScale` | pH scale with universal indicator colours | covered | annotation | A | secondary | 8464, 8462 | Covered by `phScale`. Use the phScale symbol: a strip of 15 equal cells numbered 0 to 14 in the universal indicator colours (red, orange, yellow, green at 7, blue, purple), with brackets for acidic (below 7), neutral (7) and alkaline (above 7) and, if ... |
| `strongWeakAcids` | Strong and weak acids as particle pictures | symbol | matter | B | secondary | 8464, 8462 | Two boxes of the same size and the same number of acid particles. Strong acid: every molecule split into H+ and a negative ion (fully ionised). |
| `electrolysisIons` | Electrolysis cell with the movement of ions | compound | electrochemistry | A | secondary | 8464, 8462 | A cell holding the electrolyte (molten or a solution), two electrodes joined by wires to a power supply, the negative electrode (cathode) and positive electrode (anode) marked. |
| `electrolysisMoltenApparatus` | Apparatus for electrolysis of a molten compound | covered | labTemplates | B | secondary | 8464, 8462 | Covered by `electrolysisMolten`. Use the electrolysisMolten template: a crucible on a pipeclay triangle on a tripod, heated by a Bunsen burner; two rods held by one stand with two clamps that each grip a rod; two wires to a power supply that do not cross. |
| `electrolysisGasTubes` | Electrolysis of a solution with gas collected in inverted tubes | covered | apparatus | B | secondary | 8464, 8462 | Covered by `electrolysis`. Use the electrolysis template: the cell with two electrodes, two upside-down test tubes over the electrodes, gas in both tubes with about twice the volume over the negative electrode for a sodium sulfate solution, wires to a ... |
| `electrolysisPetriLid` | Electrolysis of an aqueous solution with a Petri dish lid (required practical) | covered | apparatus | A | checked | 8464, 8462 | Covered by `electrolysisBeaker`. Use the electrolysisBeaker template: a beaker of solution with a lid on its rim, a carbon rod through each of two holes, a crocodile clip on the top of each rod, wires to a low-voltage supply. |
| `aluminiumExtractionCell` | Electrolysis cell for the extraction of aluminium | compound | electrochemistry | A | secondary | 8464, 8462 | A section of a rectangular steel tank lined with carbon along the bottom and sides (the negative electrode). |
| `copperRefining` | Electrolytic purification of copper | compound | electrochemistry | C | unverified | 8464, 8462 | A tank of copper sulfate solution with a thick block of impure copper as the positive electrode and a thin sheet of pure copper as the negative electrode, wires to a power supply. |

#### Energy changes (6)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `reactionProfile` | Reaction profile (energy level diagram): exothermic and endothermic | covered | energy | A | checked | 8464, 8462 | Covered by `reactionProfile`. Use the reactionProfile symbol: the axes "Energy" and "Progress of reaction" and a smooth curve from a flat reactants level over a rounded peak to a flat products level (exothermic: the products are lower; endothermic: higher). |
| `bondEnergyDiagram` | Bond breaking and bond making (bond energy calculation) | compound | energy | B | checked | 8464, 8462 | The reaction as displayed formulae in a row (for example H-H plus Cl-Cl giving two H-Cl), the bonds to be broken circled on the left with their energies, the bonds made circled on the right with their energies. |
| `temperatureChangeCup` | Temperature change of a reaction in a polystyrene cup (required practical) | covered | apparatus | A | checked | 8464, 8462 | Covered by `temperatureChange`. Use the temperatureChange template: a polystyrene cup with a lid in a beaker, a thermometer through the lid hole, the solution at about 50 percent. |
| `simpleCell` | Simple cell: two metals in an electrolyte with a voltmeter | covered | labTemplates | A | checked | 8462 | Covered by `simpleCell`. Use the simpleCell template: a beaker of electrolyte with a zinc strip and a copper strip 44 u apart, their tips under the surface, and wires with clips to a voltmeter; zinc is marked minus and copper plus. |
| `fuelCell` | Hydrogen fuel cell | compound | electrochemistry | A | secondary | 8462, 7405 | A box with an electrolyte in the middle and a porous electrode on each side. Hydrogen enters at the left electrode (negative), oxygen or air at the right (positive), and water leaves at the right. |
| `temperatureTimeGraph` | Temperature against time or volume for a reaction | chart | charts | B | unverified | 8464, 8462 | Axes with scales, plotted points and a line of best fit, for the temperature change against the volume of alkali added, or against time. |

#### The rate and extent of chemical change (11)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `rateGraph` | Rate graph: amount of product against time, with a tangent | chart | charts | A | checked | 8464, 8462 | Axes with scales: time along the bottom, volume of gas (or mass of product, or mass lost) up the side. One to three curves that start at the origin, rise steeply and flatten to a plateau. |
| `rateGasSyringeApparatus` | Rate of reaction: gas collected in a gas syringe | covered | apparatus | A | checked | 8464, 8462 | Covered by `rateGasSyringe`. Use the rateGasSyringe template: a conical flask of acid with marble chips and bubbles, a bung and a tube to a gas syringe held by a clamp, a stopwatch beside the stand. |
| `rateGasOverWaterApparatus` | Rate of reaction: gas collected over water | covered | apparatus | A | checked | 8464, 8462 | Covered by `rateGasOverWater`. Use the rateGasOverWater template: a flask of acid with magnesium ribbon, a one-hole bung and delivery tube to a trough of water, an upside-down measuring cylinder full of water held by a clamp over the tube end, a stopwatch. |
| `rateLossOfMass` | Rate of reaction measured by loss of mass | covered | apparatus | B | unverified | 8464, 8462 | Covered by `massLoss`. Use the massLoss template: a conical flask of acid with marble chips on a balance, a cotton wool plug in the neck so that spray stays in and the gas escapes, and a stopwatch beside the balance. |
| `rateDisappearingCross` | Rate of reaction: disappearing cross (sodium thiosulfate and acid) | covered | apparatus | A | checked | 8464, 8462 | Covered by `disappearingCross`. Use the disappearingCross template: a flask on a paper with a cross, the observer looking down into the flask, a stopwatch, a thermometer in the cloudy yellow mixture. |
| `collisionTheoryParticles` | Collision theory: particle pictures for concentration, temperature and surface area | compound | matter | A | secondary | 8464, 8462 | Pairs of boxes with a short caption. Concentration or pressure: the same volume with few particles and with many. |
| `equilibriumClosedSystem` | Reversible reaction reaching equilibrium in a closed container | compound | matter | B | secondary | 8464, 8462 | Three sealed boxes in a row: at the start (all reactant particles), part-way, and at equilibrium. Between them a pair of arrows labelled forward and backward, the two arrows equal in length at equilibrium. |
| `equilibriumConcentrationGraph` | Concentration against time as a reaction reaches equilibrium | chart | charts | B | secondary | 8464, 8462, 7405 | Axes: concentration up, time along. A falling curve for the reactant and a rising curve for the product that both level off, from time zero, with a vertical dashed line where equilibrium starts. |
| `leChatelierGasSyringe` | Nitrogen dioxide and dinitrogen tetroxide in a sealed syringe (pressure change) | covered | apparatus | B | checked | 8464, 8462 | Covered by `gasSyringe`. Three pictures of a gas syringe, or three gas syringes side by side. First: a brown gas (Brown gas preset) at the starting volume. |
| `reversibleHeatingTube` | Heating hydrated copper sulfate (a reversible reaction) | covered | labTemplates | B | checked | 8464, 8462 | Covered by `reversibleHeating`. Use the reversibleHeating template: two boiling tubes, each in its own holder: the first slopes with its mouth down, blue crystals on its lower wall and the flame under them; the second holds white powder, with a dropper above it ... |
| `haberYieldGraphs` | Graphs of ammonia yield against pressure and temperature | chart | charts | B | checked | 8462 | Axes: percentage yield of ammonia up, pressure along, with three curves for three temperatures (the lowest temperature on top). |

#### Organic chemistry (17)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `crudeOilFractionatingTower` | Fractional distillation of crude oil (industrial column) | process | plants | A | checked | 8464, 8462, 7405 | A tall column drawn as a vertical rectangle with horizontal trays, hot at the bottom and cool at the top (a temperature arrow). |
| `displayedFormulaHydrocarbon` | Displayed formula of an alkane or alkene | symbol | molecules | A | checked | 8464, 8462, 7405 | C and H in 15 u text joined by single lines, a double line for C=C. A straight chain of carbons with hydrogens above and below, bonds at right angles, lines long enough to read. |
| `displayedFormulaFunctional` | Displayed formula of an alcohol or a carboxylic acid | symbol | molecules | A | checked | 8462, 7405 | A straight carbon chain with hydrogens, plus the functional group drawn in full: -O-H for an alcohol, -C(=O)-O-H for a carboxylic acid, with every bond shown. |
| `esterDisplayed` | Ester formation (alcohol plus carboxylic acid) in displayed formulae | compound | molecules | B | checked | 8462, 7405 | A carboxylic acid and an alcohol as displayed formulae joined by a plus sign, a reaction arrow, and the ester with the new C-O-C link in the middle and water as the second product. |
| `alkeneAdditionReactions` | Addition reactions of alkenes (hydrogen, water, halogens) in displayed formulae | compound | molecules | A | checked | 8462, 7405 | The alkene as a displayed formula, a plus sign and the reagent (H-H, H-O-H, Cl-Cl, Br-Br, I-I), an arrow, and the product with the double bond now single and the new atoms on the two carbons. |
| `additionPolymerisation` | Addition polymerisation (monomer to repeating unit) | compound | molecules | A | checked | 8462, 7405 | The monomer as a displayed formula (with C=C), an arrow labelled with n and the catalyst or conditions, and the polymer drawn as the repeating unit inside square brackets with the bonds running out through the brackets and a ... |
| `condensationPolymerBlock` | Condensation polymerisation (diol and dicarboxylic acid) with block diagrams | compound | molecules | B | secondary | 8462, 7405 | Two monomers drawn as a rectangle (the carbon chain) with the functional groups at the two ends drawn in full: HO-OC- ... |
| `aminoAcid` | Amino acid and dipeptide in displayed formulae | compound | molecules | B | checked | 8462, 7405 | The general amino acid H2N-CH(R)-COOH in displayed formula, with the amine and carboxyl groups marked, and glycine as the example (R is H). |
| `dnaStructure` | DNA: double helix, nucleotide and base pairs | compound | biomolecules | B | checked | 8462 | Two ribbons twisted round each other with rungs for the base pairs, and one nucleotide in detail: a circle for the phosphate, a pentagon for the sugar and a rectangle for the base, joined in a line. |
| `naturalPolymerChains` | Natural polymers as chains of monomers (starch, cellulose, protein) | compound | biomolecules | C | unverified | 8462 | A chain of repeated boxes or circles (glucose units for starch and cellulose, amino acids for a protein) joined end to end, with the repeating unit bracketed. |
| `crackingApparatus` | Laboratory cracking of a hydrocarbon | covered | organicApparatus | B | secondary | 8464, 8462 | Covered by `crackingApparatus`. Use the crackingApparatus template: a boiling tube nearly level, held by a clamp near its mouth whose arm runs to the stand behind the tube; a delivery tube runs along the floor of a trough into an inverted, water-filled, clamped ... |
| `crackingEquationModels` | Cracking drawn as a long molecule breaking into smaller ones | compound | molecules | B | secondary | 8464, 8462 | A long-chain alkane as a displayed formula (for example decane), a reaction arrow labelled with the catalyst or steam and high temperature, and the products: a shorter alkane and one or more alkenes, drawn as displayed formulae. |
| `fermentationApparatus` | Fermentation of a sugar solution (apparatus) | covered | organicApparatus | C | unverified | 8462 | Covered by `fermentationApparatus`. Use the fermentationApparatus template: a flask standing in a beaker of warm water with a thermometer at 35 degrees; the delivery tube from the bung, the only opening, dips into limewater in a test tube in a small beaker. |
| `combustionProductsApparatus` | Testing the products of burning a hydrocarbon fuel | covered | organicApparatus | C | unverified | 8464, 8462 | Covered by `combustionProducts`. Use the combustionProducts template: an inverted funnel clamped over a spirit burner; the funnel, a U-tube in ice, limewater and "to pump" are joined by glass and rubber tubing through bungs. |
| `alkeneBromineTest` | Bromine water test for an alkene | covered | apparatus | A | secondary | 8464, 8462 | Covered by `testTubeReactions`. Use the testTubeReactions template with two tubes in a rack: bromine water (Orange preset) with an alkane, which stays orange; and with an alkene, which goes colourless (Colourless solution preset). |
| `oilToPolymersFlow` | From crude oil to polymers (fractional distillation, cracking, polymerisation) | process | flow | C | unverified | 8462 | Boxes joined by arrows: crude oil, fractional distillation, long-chain fractions, cracking, alkenes and shorter alkanes, polymerisation, polymers. |
| `fractionalDistillationLab` | Fractional distillation in the laboratory (ethanol and water) | covered | organicApparatus | B | unverified | 8464, 8462 | Covered by `fractionalDistillationLab`. Use the fractionalDistillationLab template: a heating mantle, a flask, a packed column, a still head with a thermometer (its bulb level with the side arm), a sloping Liebig condenser (water in at the low port) and a receiver ... |

#### Chemical analysis (12)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `chromatogramRf` | Paper chromatogram with Rf measurements | covered | apparatus | A | checked | 8464, 8462 | Covered by `chromatographyPaper`. Use the chromatography paper symbol, developed: a pencil start line near the bottom, several spots (a pure substance gives one spot, a mixture several) and the solvent front line near the top. |
| `chromatographyApparatus` | Paper chromatography apparatus | covered | apparatus | A | checked | 8464, 8462 | Covered by `paperChromatography`. Use the paperChromatography template: a beaker with a little solvent, a paper hanging from a rod across the rim, the pencil start line above the solvent level, and the spots on the line. |
| `gasTests` | Tests for hydrogen, oxygen, carbon dioxide and chlorine | covered | labTemplates | A | checked | 8464, 8462 | Covered by `gasTests`. Use the gasTests template: one rack of five test tubes holds the four gas tests: hydrogen and oxygen with a splint (at the mouth, and in the tube), carbon dioxide (a source tube whose delivery tube runs into limewater) and ... |
| `carbonateTest` | Test for a carbonate (acid, then limewater) | covered | labTemplates | A | checked | 8462 | Covered by `carbonateTest`. Use the carbonateTest template: a test tube of carbonate with a dropper of acid in one bung hole and a delivery tube from the other hole into limewater in a second test tube; both tubes stand in a rack. |
| `flameTestApparatus` | Flame test apparatus (nichrome wire in a blue flame) | covered | apparatus | A | checked | 8462 | Covered by `flameTest`. Use the flameTest template: a Bunsen burner on a heatproof mat with a blue flame, and a nichrome wire loop held in the edge of the flame. |
| `flameColours` | Flame test colours (lithium, sodium, potassium, calcium, copper) | symbol | annotation | B | checked | 8462 | Five Bunsen flames side by side, each with the flame colour of one metal ion and the name below: lithium crimson, sodium yellow, potassium lilac, calcium orange-red, copper green. |
| `halideSulfateTubes` | Halide and sulfate precipitate tests in test tubes | covered | apparatus | A | checked | 8462 | Covered by `testTubeReactions`. Use the testTubeReactions template with four tubes. Halides: add dilute nitric acid then silver nitrate; chloride gives a white precipitate, bromide a cream one, iodide a yellow one (the Cream and Yellow presets). |
| `hydroxideTubes` | Metal hydroxide precipitates with sodium hydroxide solution | covered | apparatus | A | checked | 8462 | Covered by `testTubeReactions`. Use the testTubeReactions template with six tubes: aluminium, calcium and magnesium ions give white precipitates (aluminium dissolving in excess alkali), copper(II) gives a blue precipitate, iron(II) a green one, iron(III) a ... |
| `flameEmissionSpectra` | Flame emission spectra (known ions and a mixture) | chart | charts | B | checked | 8462 | Strips of line spectra on a common wavelength scale: one strip for each known metal ion and one for the unknown mixture, each a dark background with bright vertical lines at fixed positions. |
| `identificationFlowchart` | Flow chart for identifying an unknown ionic compound | process | flow | C | unverified | 8462 | A flow chart of tests with boxes and yes/no arrows: flame test, then sodium hydroxide, then the acid tests for carbonate, halide and sulfate, ending in the ions identified. |
| `waterAnalysisPurification` | Water analysis and purification (distillation set-up) | covered | apparatus | A | checked | 8464, 8462 | Covered by `simpleDistillation`. Use the simpleDistillation template: a conical flask of salty water on a gauze over a Bunsen burner, a two-hole bung with a thermometer and a delivery tube to a test tube standing in a beaker of ice and water. |
| `gasCollectionMethods` | Collecting a gas by downward or upward delivery | covered | labTemplates | B | unverified | 8464, 8462 | Covered by `gasCollection`. Use the gasCollection template: downward delivery and upward delivery side by side, with a lid under the inverted jar; a plain-text note under each says which gases it suits. |

#### Chemistry of the atmosphere (7)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `atmosphereComposition` | Composition of dry air (pie chart, bar chart or particle grid) | chart | charts | B | secondary | 8464, 8462 | A pie chart or bar chart of the gases in dry air: nitrogen about 78 percent, oxygen about 21 percent, argon about 1 percent, carbon dioxide about 0.04 percent. |
| `earlyAtmosphereGraph` | How the gases in the atmosphere changed over time | chart | charts | B | checked | 8464, 8462 | Axes: percentage of gas up the side, time since the Earth formed along the bottom. |
| `greenhouseEffect` | The greenhouse effect | process | scenes | A | secondary | 8464, 8462 | The Sun at the top, the Earth's surface at the bottom and a band for the atmosphere across the middle. |
| `co2TemperatureGraphs` | Carbon dioxide concentration and global temperature against time | chart | charts | B | checked | 8464, 8462 | One or two line graphs with years along the bottom: carbon dioxide concentration (parts per million) rising, and average global surface temperature rising, on separate axes one above the other. |
| `acidRainFormation` | How acid rain forms and what it damages | process | scenes | B | secondary | 8464, 8462 | A power station or car on the left burning a fuel, with sulfur dioxide and oxides of nitrogen rising into a cloud; the gases dissolve in water droplets; rain falls on a limestone building, a lake and trees. |
| `catalyticConverter` | Catalytic converter (cross-section) | process | plants | C | unverified | 8464, 8462 | A tube cut away to show a honeycomb ceramic block coated with a metal catalyst, exhaust gases entering on the left (carbon monoxide, oxides of nitrogen, unburnt hydrocarbons) and cleaner gases leaving on the right (carbon ... |
| `fossilFuelFormation` | Formation of fossil fuels and limestone | process | flow | C | unverified | 8464, 8462 | Two short chains of boxes and arrows. First: dead plankton and plants buried under sediment, then heat and pressure over millions of years, then crude oil, natural gas and coal. |

#### Using resources (14)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `potableWaterTreatment` | Treatment of water to make it safe to drink (potable water) | process | flow | A | checked | 8464, 8462 | A flow diagram from left to right: a fresh water source (a reservoir or river), screening to remove large objects, a settling tank (sedimentation), filter beds of sand and gravel, then sterilising with chlorine (or ozone or ... |
| `desalinationReverseOsmosis` | Desalination by reverse osmosis | process | plants | B | secondary | 8464, 8462 | Salt water enters on the left, passes a high-pressure pump and meets a membrane drawn as a dashed barrier across a pipe. |
| `wasteWaterTreatment` | Treatment of waste water (sewage) | process | flow | A | secondary | 8464, 8462 | A flow chart with two branches. Raw sewage goes to screening and grit removal, then to sedimentation. |
| `phytomining` | Phytomining flow diagram | process | flow | B | secondary | 8464, 8462 | Boxes and arrows: plants grown on soil with a low metal content, the plants absorb metal compounds, the plants are harvested, burned, giving ash that contains metal compounds, and the metal is extracted from the ash (by ... |
| `bioleaching` | Bioleaching flow diagram | process | flow | B | secondary | 8464, 8462 | Boxes and arrows: low-grade copper ore, bacteria added, a leachate solution containing metal compounds is produced, and the metal is extracted from the leachate (displacement or electrolysis). |
| `lifeCycleAssessment` | Life cycle assessment (stages of a product's life) | process | flow | B | secondary | 8464, 8462 | A cycle or a row of four boxes: extracting and processing raw materials, manufacturing and packaging, use and operation during the lifetime, disposal at the end of life (with recycling feeding back to the first box). |
| `lcaTable` | Table of life cycle assessment data (two products) | chart | charts | C | checked | 8464, 8462 | A table with columns for two products (for example a plastic bag and a paper bag) and rows for energy, water, waste and carbon dioxide at each stage. |
| `recyclingLoop` | Recycling loop for metals, glass or plastics | process | flow | C | unverified | 8464, 8462 | A loop of boxes: collect, sort, melt or reprocess, manufacture a new product, use, collect again. Arrows labelled with energy saved against extraction from ore. |
| `rustingTubes` | Rusting experiment (nails in test tubes) | covered | labTemplates | A | secondary | 8462 | Covered by `rustingTubes`. Use the rustingTubes template: four test tubes in a rack, each with a nail (the nail symbol); rust is a thin orange-brown layer at the foot of tubes 1 and 4, tube 3 has a bung, and a plain note explains the rust. |
| `sacrificialProtection` | Sacrificial protection and galvanising | compound | electrochemistry | B | secondary | 8462 | Sacrificial protection: part of a steel hull or pipe with a block of zinc (or magnesium) attached by a metal contact and an arrow showing the zinc dissolving instead of the iron. |
| `compositeMaterial` | Composite material (fibres in a matrix) | symbol | structures | C | unverified | 8462 | A block cut away to show long fibres or rods embedded in a shaded matrix, with the labels reinforcement and matrix. |
| `haberProcess` | The Haber process (flow diagram) | process | flow | A | checked | 8462 | Boxes and arrows from left to right: hydrogen (from natural gas) and nitrogen (from the air) in the ratio 3 to 1 enter a compressor, then the reactor (iron catalyst, about 450 degrees C, about 200 atmospheres), then a cooler or ... |
| `npkFertiliserRoutes` | Making NPK fertilisers from ammonia, acids and potassium salts | process | flow | C | unverified | 8462 | Boxes and arrows: ammonia reacting with nitric acid to give ammonium nitrate; phosphate rock treated with nitric, sulfuric or phosphoric acid to give soluble phosphates; potassium chloride or sulfate from mining; the three ... |
| `npkBarChart` | Bar chart of the nitrogen, phosphorus and potassium content of fertilisers | chart | charts | C | checked | 8462 | A bar chart with fertiliser types along the bottom and percentage by mass up the side, grouped bars for N, P and K. |

#### Working scientifically and practical skills (2)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hazardSymbols` | Hazard symbols (the nine GHS pictograms) | covered | annotation | C | unverified | 8464, 8462 | Covered by `hazardSymbol`. Use the hazardSymbol symbol: a diamond with a black picture inside, one of the nine GHS pictograms chosen by `hazard` (explosive, flammable, oxidising, gasUnderPressure, corrosive, toxic, harmful, health, environment). |
| `heatingLiquidBeaker` | Heating a liquid in a beaker (Bunsen burner, tripod, gauze, thermometer) | covered | apparatus | A | checked | 8464, 8462 | Covered by `heatingBeaker`. Use the heatingBeaker template: a Bunsen burner on a heatproof mat under a tripod and gauze, a beaker of water (60 percent) on the gauze and a thermometer in the water. |

### Chemistry, KS5

#### Physical chemistry (A-level) (26)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tofMassSpectrometer` | Time-of-flight mass spectrometer (block diagram) | process | flow | B | secondary | 7405 | A block diagram from left to right: sample inlet, ionisation (electron gun or electrospray), acceleration between charged plates, a long flight tube kept under vacuum, a detector, then a data system. |
| `massSpectrumBar` | Mass spectrum of an element or a molecule (bar chart) | chart | charts | B | checked | 7405 | A bar chart with m/z along the bottom and relative abundance (or percentage) up the side: vertical lines at the isotope masses (for example chlorine at 35 and 37). |
| `electronBoxDiagram` | Electron configuration in sub-shell boxes (s, p and d) with spin arrows | symbol | atoms | B | unverified | 7405 | A row of boxes for each sub-shell (one box for s, three for p, five for d) labelled 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p. |
| `subshellEnergyLevels` | Energy levels of sub-shells (1s to 4p) with electrons | symbol | atoms | C | secondary | 7405 | A vertical energy ladder with a short line for each sub-shell, ordered 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p, the gaps shrinking upwards so that 4s sits below 3d. |
| `orbitalShapes` | Shapes of s and p orbitals | symbol | atoms | C | unverified | 7405 | A sphere for an s orbital and a pair of lobes (dumbbell) for each p orbital along the x, y and z axes, on a set of three axes. |
| `ionisationEnergyGraph` | Ionisation energy graphs (successive, and across Period 3 or down Group 2) | chart | charts | B | checked | 7405 | Axes: ionisation energy (or its logarithm) up the side. Successive ionisation energies: points for the 1st to the nth ionisation of one element with large jumps where an inner shell is reached. |
| `covalentDotCrossAdvanced` | Dot-and-cross diagrams with dative bonds and expanded octets | symbol | atoms | B | secondary | 7405 | As the GCSE covalent dot-and-cross, but for ions and molecules with a dative bond: both electrons of the shared pair come from the donor and are drawn with the same mark; in a displayed formula the dative bond is an arrow ... |
| `vseprShapes` | Shapes of molecules and ions with bond angles (wedge and dash) | symbol | molecules | B | checked | 7405 | The central atom with its bonds drawn as plain lines in the plane of the page, wedges coming towards the viewer and dashes going away. |
| `bondPolarityDipoles` | Polar bonds and polar molecules (partial charges and dipole arrows) | compound | molecules | B | checked | 7405 | A molecule drawn with its shape (plane, wedge and dash as needed), delta-plus on the less electronegative atom and delta-minus on the more electronegative atom of each polar bond, and a dipole arrow with a cross at the delta-plus ... |
| `intermolecularForceDiagrams` | Intermolecular forces: London forces, permanent dipoles and hydrogen bonds | compound | molecules | B | checked | 7405 | Pairs or small groups of molecules with a dotted line for the force. London forces: two atoms or molecules with delta-plus and delta-minus labels showing an instantaneous dipole and an induced dipole. |
| `iceLattice` | Ice (hydrogen-bonded open lattice) | symbol | structures | B | secondary | 7405 | Water molecules (an oxygen with two hydrogens) in an oblique view, each linked to four neighbours by hydrogen bonds drawn as dotted lines, forming puckered hexagonal rings with open space in the middle. |
| `iodineLattice` | Iodine (simple molecular lattice) | symbol | structures | B | secondary | 7405 | Iodine molecules drawn as pairs of joined circles on the corners and face centres of a cube in an oblique projection (about 14 molecules), each pair tilted as in the crystal, with a label: weak London forces between molecules. |
| `magnesiumLattice` | Magnesium (close-packed metal lattice) | symbol | structures | B | secondary | 7405 | Layers of Mg2+ ions (circles marked 2+) packed close together in two layers, the second layer sitting in the hollows of the first, with small delocalised electrons between the ions. |
| `hessCycle` | Hess's law cycle (formation, combustion and bond enthalpy) | compound | energy | B | checked | 7405 | A triangle or box of species with state symbols: reactants top left, products top right, and the common species (elements, or the combustion products) at the bottom. |
| `bornHaberCycle` | Born-Haber cycle | compound | energy | B | checked | 7405 | An energy-level diagram: the elements in their standard states at the base level, then levels for gaseous atoms, gaseous ions and the ionic solid, joined by labelled arrows: atomisation of the metal and of the non-metal (up), ... |
| `enthalpySolutionCycle` | Enthalpy cycle for dissolving an ionic solid (lattice and hydration) | compound | energy | B | checked | 7405 | A triangle: the solid at the top left, the aqueous ions at the top right, the gaseous ions at the bottom. |
| `reactionProfileMultiStep` | Reaction profile with an intermediate and a rate-determining step | symbol | energy | B | unverified | 7405 | As the GCSE reaction profile but with two or three humps and valleys: reactants, a first hump, an intermediate in a valley, a second hump, products. |
| `maxwellBoltzmann` | Maxwell-Boltzmann distribution curves (temperature and catalyst) | chart | charts | B | checked | 7405 | Axes: number of molecules (or fraction) up the side, energy along the bottom, with no numbers. A curve that starts at the origin, rises to a peak and falls without touching the axis. |
| `concentrationTimeGraph` | Concentration against time (tangents, order and half-life) | chart | charts | B | checked | 7405 | Axes with scales: concentration up, time along. A falling curve with tangents at stated times and the gradient triangles; for first-order curves a series of equal half-lives marked; for zero order a straight line. |
| `rateConcentrationGraph` | Rate against concentration graphs (zero, first and second order) | chart | charts | B | checked | 7405 | Three small graphs of rate against concentration: a horizontal line for zero order, a straight line through the origin for first order, and a curve rising faster than a straight line for second order, each labelled with its order. |
| `arrheniusPlot` | Arrhenius plot: ln k against 1/T | chart | charts | B | checked | 7405 | A graph with 1/T (per kelvin) along the bottom and ln k up the side: points close to a falling straight line, the gradient labelled -Ea/R and the intercept labelled ln A. |
| `gibbsGraph` | Gibbs free energy change against temperature | chart | charts | C | checked | 7405 | Axes: free energy change up (with zero marked), temperature in kelvin along. |
| `calorimetryCoolingGraph` | Temperature-time graph with extrapolation (calorimetry) | chart | charts | B | unverified | 7405 | Axes with scales: temperature up, time along. |
| `phCurves` | pH curves for titrations (strong and weak acids and bases) | chart | charts | B | checked | 7405 | Axes: pH (0 to 14) up the side, volume of added solution along the bottom. |
| `standardHydrogenElectrode` | Standard hydrogen electrode and half-cell diagrams | compound | electrochemistry | B | secondary | 7405 | A glass jacket with a platinum electrode (platinised foil) dipping into a solution of 1.00 mol per dm3 hydrogen ions, hydrogen gas at 100 kPa bubbled in through a side tube and escaping from the top, connected through a salt ... |
| `electrodePotentialLadder` | Electrode potential series (vertical scale of standard potentials) | chart | charts | C | unverified | 7405 | A vertical list of half-equations with their standard electrode potentials, the most negative at the top, with arrows for strongest reducing agent (top left) and strongest oxidising agent (bottom right). |

#### Inorganic chemistry (A-level) (13)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `periodicTrendsPeriod3` | Period 3 trends (atomic radius, first ionisation energy, melting point) | chart | charts | C | unverified | 7405 | A line or bar graph with the elements sodium to argon along the bottom and one property up the side: atomic radius falling, first ionisation energy rising with dips at aluminium and sulfur, melting point rising to a peak at ... |
| `phosphorusSulfurMolecules` | Phosphorus (P4) and sulfur (S8) molecules | symbol | molecules | C | unverified | 7405 | P4: four phosphorus atoms at the corners of a tetrahedron, six P-P bonds as solid lines with the hidden bond dashed. |
| `oxoacidStructures` | Oxoacids and oxoanions of phosphorus and sulfur (displayed formulae) | compound | molecules | B | checked | 7405 | Displayed formulae with every bond: phosphoric(V) acid, sulfuric(IV) acid and sulfuric(VI) acid, each with P=O or S=O double bonds and O-H bonds, and the anions they form (phosphate, sulfite, sulfate) in square brackets with the ... |
| `p4o10Cage` | Phosphorus(V) oxide molecule (P4O10 cage) | symbol | molecules | C | unverified | 7405 | A tetrahedron of four phosphorus atoms with an oxygen bridging each of the six edges and one more oxygen (double bonded) on each phosphorus, in the oblique projection. |
| `complexIonShapes` | Shapes of complex ions (octahedral, tetrahedral, square planar, linear) | symbol | molecules | B | checked | 7405 | The metal ion at the centre, the ligands round it joined by lines, wedges and dashes, the whole inside square brackets with the overall charge outside. |
| `ligandStructures` | Ligands: monodentate, bidentate and EDTA (donor atoms marked) | compound | molecules | B | secondary | 7405 | Displayed formulae of ligands with the lone pair on each donor atom drawn as a pair of dots or a lobe: water, ammonia, chloride, hydroxide; 1,2-diaminoethane (two nitrogens) and ethanedioate (two oxygens) as bidentate; EDTA4- ... |
| `complexIsomers` | Isomers of complex ions (cis-trans and optical) | compound | molecules | B | checked | 7405 | Square planar cis- and trans-[Pt(NH3)2Cl2] (cisplatin and its isomer) drawn side by side. Octahedral cis- and trans-[Co(NH3)4Cl2]+ drawn with wedge and dash. |
| `dOrbitalSplitting` | d-orbital splitting in an octahedral or tetrahedral complex (colour) | symbol | energy | C | secondary | 7405 | A vertical energy diagram: the five d orbitals as short lines at one level on the left (free ion), splitting on the right into two groups with a gap labelled the energy difference. |
| `colorimeterBlock` | Colorimeter (block diagram) and calibration graph | process | flow | C | unverified | 7405 | A light source, a filter of the complementary colour, a cuvette with the sample, a detector and a meter in a row, with arrows for the light beam. |
| `heterogeneousCatalysis` | Heterogeneous catalysis on a metal surface (adsorption, reaction, desorption) | compound | molecules | C | secondary | 7405 | Three or four panels from left to right: reactant molecules approaching a row of metal atoms; the molecules adsorbed on the surface with their bonds weakened (dotted); the reaction on the surface; product molecules leaving the ... |
| `aquaIonReactionScheme` | Reaction scheme of aqua ions with hydroxide and ammonia | process | flow | C | unverified | 7405 | A branching scheme: the hexaaqua ion in the centre, an arrow with sodium hydroxide to the neutral hydroxide precipitate (colour and formula), a further arrow with excess hydroxide or ammonia to a dissolved complex (for aluminium, ... |
| `hexaaquaAcidity` | Why hexaaqua ions are acidic (polarised water ligand) | compound | molecules | C | unverified | 7405 | An octahedral hexaaqua ion with one water ligand enlarged: the metal ion pulling electron density from the oxygen, the O-H bond polarised, and an arrow showing a hydrogen ion leaving to a free water molecule. |
| `redoxTitrationManganate` | Redox titration with potassium manganate(VII) (iron(II) or ethanedioate) | covered | apparatus | B | checked | 7405 | Covered by `titration`. Use the titration template with the Purple preset in the burette: purple manganate(VII) solution in the burette, and in the conical flask on the white tile an acidified solution of iron(II) ions or ethanedioate ions. |

#### Organic chemistry (A-level) (34)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `skeletalFormula` | Skeletal formula of an organic molecule | compound | molecules | B | checked | 7405 | Zig-zag lines with a carbon at every corner and at the end of every line (the carbon is not labelled) and the hydrogens on carbon left out. |
| `structuralIsomers` | Structural isomers (chain, position and functional group) | compound | molecules | B | checked | 7405 | A row of skeletal or displayed formulae that share one molecular formula, each with its name under it: for example butane and methylpropane (chain), pentan-1-ol and pentan-2-ol (position), ethanol and methoxymethane (functional ... |
| `ezIsomers` | E/Z isomers (cis and trans) | compound | molecules | B | checked | 7405 | The two isomers of an alkene side by side as skeletal formulae with the double bond in the plane. The priority atoms on each carbon marked. |
| `opticalIsomers` | Optical isomers (enantiomers with wedge and dash bonds) | compound | molecules | B | checked | 7405 | A carbon with four different groups: two bonds in the plane of the page, one wedge and one dash, the centre marked with a star. |
| `curlyArrow` | Curly arrow (movement of an electron pair, or of one electron) | symbol | mechanisms | B | checked | 7405 | A curved line (one smooth curve) with a full arrowhead for a pair of electrons and a half arrowhead (fish-hook) for one electron. |
| `mechanismRadicalSubstitution` | Mechanism: free radical substitution (initiation, propagation, termination) | compound | mechanisms | B | checked | 7405 | Three labelled groups of equations drawn with the structures: initiation (Cl-Cl splits into two chlorine radicals in ultraviolet light), propagation (a chlorine radical takes a hydrogen from methane to give HCl and a methyl ... |
| `mechanismElectrophilicAddition` | Mechanism: electrophilic addition to an alkene (via a carbocation) | compound | mechanisms | B | secondary | 7405 | Step 1: the C=C of the alkene attacks the delta-plus hydrogen of H-Br with a curly arrow from the double bond, a second arrow from the H-Br bond to the bromine, giving a carbocation (positive charge on the carbon) and a bromide ... |
| `mechanismNucleophilicSubstitution` | Mechanism: nucleophilic substitution of a halogenoalkane (SN2 and SN1) | compound | mechanisms | B | secondary | 7405 | SN2 (primary): a curly arrow from the lone pair on the nucleophile (OH-, CN- or NH3) to the delta-plus carbon, a second arrow from the C-X bond to the halogen, with the transition state in square brackets (partial bonds dotted, a ... |
| `mechanismElimination` | Mechanism: elimination of hydrogen halide from a halogenoalkane | compound | mechanisms | B | checked | 7405 | Three curly arrows on a halogenoalkane: from the lone pair of the hydroxide ion (acting as a base, in ethanolic solution) to a hydrogen on the carbon next to the C-X carbon; from that C-H bond to form the C=C; from the C-X bond ... |
| `mechanismDehydrationAlcohol` | Mechanism: acid-catalysed dehydration (elimination of water) of an alcohol | compound | mechanisms | B | checked | 7405 | Three steps with curly arrows. Step 1: a lone pair on the oxygen of the alcohol takes an H+ from the acid catalyst, giving the protonated alcohol with a positive charge on oxygen. |
| `mechanismCarbonylAddition` | Mechanism: nucleophilic addition to an aldehyde or ketone (cyanide, hydride) | compound | mechanisms | B | checked | 7405 | The carbonyl group drawn with its polarity (delta-plus carbon, delta-minus oxygen). |
| `mechanismAdditionElimination` | Mechanism: nucleophilic addition-elimination (acyl chlorides) | compound | mechanisms | B | secondary | 7405 | Step 1: a curly arrow from the nucleophile lone pair (water, an alcohol, ammonia or an amine) to the carbonyl carbon of the acyl chloride, a second arrow from the C=O pi bond to oxygen, giving a tetrahedral intermediate with O- ... |
| `mechanismElectrophilicSubstitution` | Mechanism: electrophilic substitution of benzene (nitration, acylation) | compound | mechanisms | B | checked | 7405 | First the electrophile is made: NO2+ from concentrated nitric acid and concentrated sulfuric acid (equation), or the acylium ion from an acyl chloride and aluminium chloride. |
| `benzeneStructure` | Benzene: Kekule structure, delocalised ring and p-orbital overlap | compound | molecules | B | secondary | 7405 | Three pictures: the Kekule hexagon with alternating double and single bonds; the delocalised ring (hexagon with a circle inside); and a side view of the planar carbon skeleton with six p orbitals as lobes above and below the ring ... |
| `benzeneEnthalpyLevels` | Enthalpy of hydrogenation levels: evidence for delocalisation in benzene | compound | energy | B | checked | 7405 | An energy-level diagram of enthalpy changes of hydrogenation. At the bottom, cyclohexane. |
| `polyesterPolyamideRepeat` | Condensation polymers: polyester and polyamide repeat units (skeletal) | compound | molecules | B | checked | 7405 | The two monomers as skeletal formulae, a reaction arrow, and the polymer chain with the repeat unit in square brackets, the ester or amide links circled, and water (or hydrogen chloride) shown as the small molecule lost. |
| `triglycerideSoap` | Triglyceride, soap and biodiesel | compound | molecules | C | secondary | 7405 | A triglyceride as a glycerol backbone with three ester links to three long fatty acid chains (saturated or unsaturated, drawn as zig-zags). |
| `aminoAcidZwitterion` | Amino acid forms (zwitterion, cation, anion) and the peptide link | compound | biomolecules | B | secondary | 7405 | A simple amino acid in three forms joined by arrows labelled with the pH: the cation at low pH (NH3+ and COOH), the zwitterion (NH3+ and COO-) at the isoelectric point, and the anion at high pH (NH2 and COO-). |
| `proteinStructure` | Protein structure (primary, secondary and tertiary) | compound | biomolecules | C | unverified | 7405 | A chain of amino acid residues (primary), a helix and a pleated sheet with the hydrogen bonds between C=O and N-H groups as dotted lines (secondary), and a folded chain held by hydrogen bonds, ionic attractions and sulfur-sulfur ... |
| `dnaBasePairing` | DNA base pairs and the sugar-phosphate backbone (displayed) | compound | biomolecules | B | secondary | 7405 | The four bases as skeletal formulae. Adenine and thymine side by side with two hydrogen bonds (dotted); guanine and cytosine with three. |
| `cisplatinDna` | Cisplatin binding to DNA | compound | biomolecules | C | secondary | 7405 | Cisplatin (square planar platinum with two ammonia and two chloride ligands) with the two chloride ligands replaced by two nitrogen atoms of neighbouring guanine bases on one strand of DNA, which bends the double helix. |
| `enzymeActiveSite` | Enzyme active site and competitive inhibition | compound | biomolecules | C | unverified | 7405 | An enzyme as a blob with a notch (the active site), a substrate with a matching shape fitting into it, the products leaving. |
| `synthesisRouteMap` | Multi-step organic synthesis route (reagents and conditions) | process | flow | B | unverified | 7405 | Boxes for compounds (names and skeletal formulae) joined by arrows, each arrow labelled above with the reagent and below with the conditions (for example reflux, ethanolic KOH, acidified dichromate). |
| `nmrProton` | Proton NMR spectrum (shift, splitting, integration) | chart | charts | B | checked | 7405 | A spectrum drawn right to left with the chemical shift in ppm, the reference peak (TMS) at zero, and peaks as vertical lines or small groups of lines: singlets, doublets, triplets and quartets from the n plus 1 rule, with the ... |
| `nmrCarbon` | Carbon-13 NMR spectrum | chart | charts | B | checked | 7405 | A spectrum with the chemical shift in ppm, TMS at zero, and one vertical line for each carbon environment. Groups of peaks such as C=O at 160 to 220 ppm and C-O at 50 to 90 ppm are labelled by region. |
| `infraredSpectrum` | Infrared spectrum (transmittance against wavenumber) | chart | charts | B | secondary | 7405 | A spectrum with percentage transmittance up, wavenumber (cm-1) along from high to low, and downward troughs: a broad trough near 3300 for an alcohol O-H, a very broad trough from 2500 to 3300 for a carboxylic acid O-H, a sharp ... |
| `massSpectrumOrganic` | Mass spectrum of an organic compound (molecular ion and fragments) | chart | charts | B | secondary | 7405 | A bar chart with m/z along the bottom and relative abundance up the side: a molecular ion peak at the relative molecular mass, a small M plus 1 peak, and fragment peaks at characteristic values (15 for CH3+, 29 for C2H5+, 43 for ... |
| `gasChromatographBlock` | Gas chromatograph and GC-MS (block diagram) | process | flow | C | unverified | 7405 | Boxes left to right: carrier gas cylinder, injector (sample in), a long coiled column inside an oven, a detector, and a recorder. |
| `gcTrace` | Gas chromatogram (retention times) | chart | charts | C | unverified | 7405 | A trace with time along the bottom and detector response up the side: a baseline with peaks at different retention times, each labelled with its time, and an optional comparison with standards. |
| `columnChromatography` | Column chromatography apparatus | template | organicApparatus | B | unverified | 7405 | A vertical column (a burette symbol) clamped upright, packed with silica gel (powder layer) with a layer of solvent above, a band of the sample at the top, and a separating funnel or dropper above supplying solvent. |
| `dehydrationEthanolApparatus` | Dehydration of ethanol to ethene (apparatus) | template | organicApparatus | B | unverified | 7405 | The cracking apparatus layout: a boiling tube lying almost horizontal and clamped, with mineral wool soaked in ethanol at the closed end and aluminium oxide chips in the middle heated strongly, a delivery tube to a trough and an ... |
| `ethanolHydrationPlant` | Industrial hydration of ethene to ethanol (flow diagram) | process | flow | C | unverified | 7405 | Boxes and arrows: ethene and steam mixed, a reactor with a phosphoric acid catalyst on silica at about 300 degrees and 60 to 70 atmospheres, a condenser separating ethanol from unreacted ethene, and a recycle pipe returning the ... |
| `ozoneDepletionMechanism` | Ozone depletion by chlorine radicals (radical chain) | compound | mechanisms | C | checked | 7405 | A chain of steps with radical dots: ultraviolet light breaks a C-Cl bond in a chlorofluorocarbon, giving a chlorine radical; Cl plus ozone gives ClO and oxygen; ClO plus a second ozone (or an oxygen atom) gives the chlorine ... |
| `sigmaPiBonding` | Sigma and pi bonds (orbital overlap in ethene) | symbol | atoms | C | unverified | 7405 | Two carbon atoms with the plane of the molecule marked. |

#### Required practicals (A-level) (15)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `standardSolutionPractical` | Making up a standard solution in a volumetric flask (practical 1) | covered | apparatus | B | checked | 7405 | Covered by `standardSolution`. Use the standardSolution template: a volumetric flask with a filter funnel in its neck, a wash bottle and a beaker beside it, the solution below the graduation mark, and a label on the neck. |
| `enthalpyCombustionPractical` | Measuring an enthalpy change by calorimetry (practical 2) | covered | apparatus | B | checked | 7405 | Covered by `spiritBurnerCalorimetry`. Use the spiritBurnerCalorimetry template for combustion: a metal can of water clamped above a spirit burner with a thermometer in the water. |
| `rateTemperaturePractical` | How the rate of a reaction changes with temperature (practical 3) | covered | apparatus | B | checked | 7405 | Covered by `disappearingCross`. Use the disappearingCross template (the flask stands on the cross paper, with a thermometer in the mixture) and add a separate beaker of warm water beside it for the temperature control: the template has no water bath. |
| `ionTestsPractical` | Test-tube tests for cations and anions (practical 4) | covered | apparatus | B | checked | 7405 | Covered by `testTubeReactions`. Use the testTubeReactions template with the tests in the list: Group 2 cations with sodium hydroxide and with sulfate, ammonium with sodium hydroxide and damp red litmus paper at the tube mouth, halide ions with silver nitrate ... |
| `distillationPractical` | Distillation of a product from a reaction (practical 5) | covered | apparatus | B | checked | 7405 | Covered by `distillation`. Use the distillation template: a round-bottomed flask in a heating mantle, still head with a thermometer in an adaptor, a Liebig condenser sloping down with water in at the lower port, a receiver adaptor and a conical flask. |
| `organicTestsPractical` | Tests for alcohols, aldehydes, alkenes and carboxylic acids (practical 6) | covered | apparatus | B | checked | 7405 | Covered by `testTubeReactions`. Use the testTubeReactions template, with a beaker of warm water for the aldehyde tests. |
| `rateMonitoringPractical` | Measuring rate by initial rate and by continuous monitoring (practical 7) | covered | apparatus | B | checked | 7405 | Covered by `rateGasSyringe`. Use the rateGasSyringe template for volume against time, the massLoss template for mass against time, or the disappearingCross template for a clock reaction. |
| `emfPractical` | Measuring the EMF of an electrochemical cell (practical 8) | covered | apparatus | B | checked | 7405 | Covered by `electrochemicalCell`. Use the electrochemicalCell template: two beakers with metal strips in their own solutions, a salt bridge (filter paper soaked in potassium nitrate) between them, and a high-resistance voltmeter joined to the two strips. |
| `phCurvePractical` | pH change in a titration with a pH meter (practical 9) | covered | apparatus | B | checked | 7405 | Covered by `phCurve`. Use the phCurve template: a beaker on a hot plate with a stirrer bar, a pH probe in the solution wired to a pH meter, and a burette above. |
| `refluxPractical` | Heating under reflux (practical 10) | covered | apparatus | B | checked | 7405 | Covered by `reflux`. Use the reflux template: a round-bottomed flask with anti-bumping granules in a heating mantle, an upright Liebig condenser with water in at the lower port and out at the upper port, a clamp at the flask neck. |
| `separatingFunnelPractical` | Separating and drying an organic liquid (practical 10) | covered | apparatus | B | checked | 7405 | Covered by `separatingFunnelUse`. Use the separatingFunnelUse template: the funnel clamped upright with the stopper off, two layers labelled aqueous and organic, a beaker under the tap. |
| `buchnerPractical` | Filtration under reduced pressure and recrystallisation (practical 10) | covered | apparatus | B | checked | 7405 | Covered by `buchnerFiltration`. Use the buchnerFiltration template: a Buchner funnel with filter paper in a one-hole bung on a Buchner flask, the side arm joined by thick rubber tube to a pump (label: to pump), the solid on the paper and the filtrate in the ... |
| `meltingPointPractical` | Measuring a melting point to test purity (practical 10) | covered | apparatus | B | checked | 7405 | Covered by `meltingPoint`. Use the meltingPoint template: a melting point apparatus block with a thermometer and a capillary tube holding the solid, both in the holes of the heated block. |
| `transitionMetalIonsPractical` | Test-tube reactions of transition metal ions in solution (practical 11) | covered | apparatus | B | checked | 7405 | Covered by `testTubeReactions`. Use the testTubeReactions template with tubes of aqueous ions and their products: copper(II) blue with a pale blue precipitate and a deep blue solution in excess ammonia, iron(II) pale green, iron(III) yellow-brown, chromium(III) ... |
| `tlcPractical` | Separating species by thin-layer chromatography (practical 12) | covered | apparatus | B | checked | 7405 | Covered by `tlc`. Use the tlc template: a beaker with a little solvent, a plate leaning in it with the pencil start line above the solvent, a watch glass as a lid, and the developed spots and solvent front. |

### Biology (outline), KS4

#### Cell biology (7)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bioCellDiagrams` | Animal, plant and algal cell diagrams (labelled) | symbol | biology | C | checked | Trilogy, GCSE Biology | Section drawings of an animal cell, a plant cell and an algal cell with nucleus, cytoplasm, membrane, mitochondria, ribosomes, and (plants) cell wall, vacuole and chloroplasts. |
| `bioBacterialCell` | Bacterial cell | symbol | biology | C | unverified | Trilogy, GCSE Biology | A rod-shaped cell with cell wall, membrane, cytoplasm, a loop of DNA, plasmids and a flagellum, with no nucleus. |
| `bioMicroscopeDrawing` | Labelled drawing of cells under the microscope with magnification | symbol | biology | C | checked | Trilogy, GCSE Biology | A clean outline drawing frame with a scale bar, a magnification label and label lines, for a student drawing of cells seen under a light microscope. |
| `bioMicroscopeParts` | Light microscope (parts) | covered | apparatus | C | checked | Trilogy, GCSE Biology | Covered by `microscopeParts`. The microscopeParts template: eyepiece, objective lenses, stage, mirror or lamp, focus wheels. |
| `bioMitosis` | Cell cycle and mitosis stages | compound | biology | C | unverified | Trilogy, GCSE Biology | A row of cells showing chromosomes copying, lining up, separating, and the cell dividing into two identical cells. |
| `bioTransportAcrossMembranes` | Diffusion, osmosis and active transport across a membrane | compound | biology | C | checked | Trilogy, GCSE Biology | A membrane with particles on both sides: arrows from high to low concentration (diffusion), water moving through a partially permeable membrane (osmosis), and a carrier using energy to move particles against the gradient. |
| `bioOsmosisPractical` | Osmosis in plant tissue (potato cylinders) | covered | apparatus | C | checked | Trilogy, GCSE Biology | Covered by `osmosis`. The osmosis template: five boiling tubes in a rack, each with a potato cylinder in a solution of a different concentration (0.0 to 1.0 mol/dm3), and a balance beside the rack. |

#### Organisation (9)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bioDigestiveSystem` | Human digestive system | symbol | biology | C | unverified | Trilogy, GCSE Biology | A body outline with mouth, oesophagus, stomach, liver, gall bladder, pancreas, small and large intestine, rectum and anus, labelled. |
| `bioHeartCirculation` | Heart and double circulation | compound | biology | C | unverified | Trilogy, GCSE Biology | A section of the heart with four chambers, valves and the four main vessels, and a loop diagram of blood going to the lungs and to the body. |
| `bioLungsGasExchange` | Lungs and an alveolus | symbol | biology | C | unverified | Trilogy, GCSE Biology | Trachea, bronchi, bronchioles and alveoli, and a close-up of an alveolus beside a capillary with arrows for oxygen and carbon dioxide. |
| `bioBloodCells` | Blood cells | symbol | biology | C | checked | Trilogy, GCSE Biology | Red blood cells (biconcave, no nucleus), a white blood cell with a nucleus, and platelets, labelled. |
| `bioBloodVessels` | Arteries, veins and capillaries | symbol | biology | C | unverified | Trilogy, GCSE Biology | Cross-sections of the three vessels showing wall thickness, lumen and valves. |
| `bioPlantTissues` | Leaf cross-section, stomata, xylem and phloem | symbol | biology | C | unverified | Trilogy, GCSE Biology | A leaf in section with epidermis, palisade and spongy layers, a stoma with guard cells, and a stem section with xylem and phloem. |
| `bioEnzymeModel` | Enzyme and substrate (lock and key) | compound | biology | C | unverified | Trilogy, GCSE Biology | A substrate fitting the active site of an enzyme, the products leaving, and a denatured enzyme whose site no longer fits. |
| `bioFoodTestsPractical` | Food tests in a water bath | covered | apparatus | C | checked | Trilogy, GCSE Biology | Covered by `foodTestWaterBath`. The foodTestWaterBath template: one test tube with the food sample and reagent standing in a beaker of hot water on a tripod and gauze over a Bunsen burner, with a thermometer in the water. |
| `bioEnzymePractical` | Effect of pH on amylase | covered | apparatus | C | checked | Trilogy, GCSE Biology | Covered by `enzymes`. The enzymes template: spotting tile with iodine drops and tubes of amylase, starch and buffer in a water bath. |

#### Infection and response (2)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bioPathogenCells` | Virus, bacterium, fungus and protist | symbol | biology | C | unverified | Trilogy, GCSE Biology | Four simple drawings of a virus particle, a bacterial cell, a fungal hypha or yeast cell and a protist, labelled. |
| `bioImmuneResponse` | White blood cells and vaccination | process | biology | C | unverified | Trilogy, GCSE Biology | Phagocytosis of a pathogen, antibodies binding antigens, and the vaccination sequence with memory cells. |

#### Bioenergetics (3)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bioPhotosynthesisPractical` | Light intensity and the rate of photosynthesis | covered | apparatus | C | checked | Trilogy, GCSE Biology | Covered by `photosynthesis`. The photosynthesis template: pondweed in a beaker of water with a lamp at a measured distance and bubbles. |
| `bioEnergyFlow` | Photosynthesis and respiration (inputs and outputs) | process | biology | C | unverified | Trilogy, GCSE Biology | Boxes and arrows linking light, carbon dioxide and water to glucose and oxygen, and glucose and oxygen back to carbon dioxide, water and energy. |
| `bioLimitingFactorsGraph` | Rate of photosynthesis against light, temperature or carbon dioxide | chart | charts | C | unverified | Trilogy, GCSE Biology | Curves that rise then level off, or rise then fall for temperature, with the limiting factor marked. |

#### Homeostasis and response (6)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bioReflexArc` | Reflex arc and the nervous system pathway | compound | biology | C | unverified | Trilogy, GCSE Biology | Stimulus, receptor, sensory neurone, synapse, relay neurone, motor neurone, effector and response, with arrows along the path. |
| `bioEye` | The human eye (labelled structures) | symbol | biology | C | checked | Trilogy, GCSE Biology | A section of the eye with cornea, iris, pupil, lens, ciliary muscles, retina, optic nerve and sclera. |
| `bioKidneyNephron` | Kidney and nephron | compound | biology | C | unverified | Trilogy, GCSE Biology | A kidney section and a nephron with filtration, selective reabsorption and the collecting duct. |
| `bioNegativeFeedback` | Negative feedback loops (blood glucose, body temperature, thyroxine) | process | biology | C | checked | Trilogy, GCSE Biology | A loop of boxes: stimulus, receptor, coordination centre, effector, response, and the return to the set level, with two such loops for blood glucose. |
| `bioEndocrineGlands` | Endocrine glands in the body | symbol | biology | C | unverified | Trilogy, GCSE Biology | A body outline with the pituitary, thyroid, pancreas, adrenals, ovaries and testes marked. |
| `bioMenstrualCycle` | Menstrual cycle hormone levels | chart | charts | C | unverified | Trilogy, GCSE Biology | Four hormone curves and the uterus lining against the 28 days. |

#### Inheritance, variation and evolution (4)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bioPunnettSquare` | Punnett square (genetic cross) | symbol | biology | C | checked | Trilogy, GCSE Biology | A grid of the parents' gametes along the top and side, offspring genotypes in the cells, with ratios and probabilities below. |
| `bioPedigree` | Family tree (pedigree) for an inherited condition | symbol | biology | C | checked | Trilogy, GCSE Biology | Squares for males, circles for females, shaded for affected, joined by lines for partners and children. |
| `bioChromosomesMeiosis` | Chromosomes, genes, alleles and meiosis | compound | biology | C | unverified | Trilogy, GCSE Biology | A chromosome pair with alleles marked, and meiosis stages producing four different gametes. |
| `bioEvolutionTree` | Evolutionary tree, selective breeding and classification | process | biology | C | unverified | Trilogy, GCSE Biology | A branching tree of species, a flow of selective breeding generations, and a classification ladder from kingdom to species. |

#### Ecology (6)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bioFoodWeb` | Food chains and food webs with trophic levels | compound | biology | C | checked | Trilogy, GCSE Biology | Organisms as labelled boxes or icons joined by arrows pointing from the food to the eater, with trophic levels marked. |
| `bioPyramidBiomass` | Pyramid of biomass or numbers | symbol | biology | C | unverified | Trilogy, GCSE Biology | Horizontal bars stacked by trophic level, widths scaled to biomass, with the producer at the base. |
| `bioCarbonCycle` | Carbon cycle | process | biology | C | secondary | Trilogy, GCSE Biology | Boxes for the air (carbon dioxide), plants and algae, animals, decomposers and fossil fuels, joined by arrows labelled photosynthesis, feeding, respiration, decay and combustion. |
| `bioWaterCycle` | Water cycle | process | biology | C | unverified | Trilogy, GCSE Biology | Evaporation, condensation, precipitation and run-off linking the sea, clouds and land. |
| `bioQuadratTransect` | Sampling with a quadrat and along a transect | covered | apparatus | C | checked | Trilogy, GCSE Biology | Covered by `quadratSampling`. The quadratSampling template; a transect adds a tape line across the habitat with quadrats at intervals. |
| `bioPredatorPreyGraph` | Predator-prey population graph | chart | charts | C | checked | Trilogy, GCSE Biology | Two cycling curves of population against time, the predator peak following the prey peak. |

### Physics (outline), KS4

#### Energy (5)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `physEnergyTransfer` | Energy transfer diagram (stores and pathways) | process | physics | C | unverified | Trilogy, GCSE Physics | Boxes for energy stores joined by labelled arrows for the way energy is transferred (mechanically, electrically, by heating, by radiation). |
| `physSankey` | Sankey diagram | compound | physics | C | unverified | Trilogy, GCSE Physics | An arrow from the energy input that splits into a useful output arrow and a wasted output arrow, widths in proportion to the energy. |
| `physHeatTransfer` | Conduction, convection and radiation diagrams | compound | physics | C | unverified | Trilogy, GCSE Physics | A heated rod with vibrating particles, a convection current in a beaker with arrows, and radiation from a hot object. |
| `physSpecificHeatPractical` | Specific heat capacity (immersion heater and block) | covered | apparatus | C | unverified | Trilogy, GCSE Physics | Covered by `specificHeatCapacity`. The specificHeatCapacity template: an insulated metal block with an immersion heater and a thermometer. |
| `physInfraredPractical` | Infrared radiation from different surfaces | covered | apparatus | C | unverified | Trilogy, GCSE Physics | Covered by `infraredRadiation`. The infraredRadiation template: a Leslie cube and an infrared detector. |

#### Electricity (6)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `physCircuitDiagram` | Circuit diagrams (series and parallel) with standard symbols | covered | apparatus | C | checked | Trilogy, GCSE Physics | Covered by `resistorNetworks`. The resistorNetworks template and the circuit symbols: cells, switches, lamps, resistors, meters, joined by wires. |
| `physResistanceWirePractical` | Resistance of a wire | covered | apparatus | C | unverified | Trilogy, GCSE Physics | Covered by `resistanceWire`. The resistanceWire template: a wire on a ruler with an ammeter, a voltmeter and a cell. |
| `physIVPractical` | Current-voltage characteristic of a component | covered | apparatus | C | unverified | Trilogy, GCSE Physics | Covered by `ivCharacteristic`. The ivCharacteristic template: a component with a variable resistor, an ammeter and a voltmeter. |
| `physIVGraphs` | I-V graphs (resistor, filament lamp, diode) | chart | charts | C | unverified | Trilogy, GCSE Physics | Three small axes: a straight line through the origin, an S-shaped curve, and a diode curve that is flat for negative voltages. |
| `physPlugWiring` | Three-pin plug wiring | symbol | physics | C | unverified | Trilogy, GCSE Physics | A plug opened up with live (brown), neutral (blue) and earth (green and yellow) wires, a fuse and the cable grip. |
| `physNationalGrid` | National Grid (power station to home) | process | physics | C | unverified | Trilogy, GCSE Physics | A power station, step-up transformer, pylons, step-down transformer and homes in a line. |

#### Particle model of matter (3)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `physParticleModel` | Particle model of solids, liquids and gases | covered | matter | C | checked | Trilogy, GCSE Physics | Covered by `particleBox`. Use three particleBox parts (solid, liquid and gas) as for particleStates. |
| `physDensityPractical` | Density of a solid and a liquid | covered | apparatus | C | unverified | Trilogy, GCSE Physics | Covered by `densityDisplacement`. The densityDisplacement template (irregular solid in a displacement can) and densityLiquid for a measuring cylinder on a balance. |
| `physGasPressure` | Gas pressure: particles hitting the walls | compound | matter | C | unverified | Trilogy, GCSE Physics | A container with particles and arrows at the walls, shown at two volumes or temperatures. |

#### Atomic structure (3)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `physRadiationPenetration` | Penetration of alpha, beta and gamma radiation | compound | physics | C | unverified | Trilogy, GCSE Physics | A source with three arrows stopped by paper, aluminium and lead. |
| `physHalfLifeGraph` | Radioactive decay curve and half-life | chart | charts | C | unverified | Trilogy, GCSE Physics | A falling curve of count rate against time with the half-lives marked. |
| `physFissionChain` | Nuclear fission chain reaction | compound | physics | C | checked | Trilogy, GCSE Physics | A neutron striking a large nucleus that splits into two smaller nuclei and more neutrons, which go on to split further nuclei. |

#### Forces (9)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `physFreeBodyDiagram` | Free body diagram | symbol | physics | C | checked | Trilogy, GCSE Physics | An object as a box with labelled arrows for weight, normal force, friction, drag or thrust. |
| `physVectorDrawing` | Scale drawing of vectors (resultant of two forces) | compound | physics | C | checked | Trilogy, GCSE Physics | Two forces drawn nose to tail to a stated scale with the resultant drawn from the start to the end, and its length and angle measured. |
| `physMotionGraphs` | Distance-time and velocity-time graphs | chart | charts | C | checked | Trilogy, GCSE Physics | Axes with scales and lines for rest, constant speed, acceleration and terminal velocity. |
| `physSpringPractical` | Force and extension of a spring | covered | apparatus | C | unverified | Trilogy, GCSE Physics | Covered by `springExtension`. The springExtension template: a spring hanging from a clamp stand with masses and a ruler. |
| `physAccelerationPractical` | Force, mass and acceleration (trolley and light gates) | covered | apparatus | C | unverified | Trilogy, GCSE Physics | Covered by `acceleration`. The acceleration template: a trolley pulled by a hanging mass over a pulley, with light gates. |
| `physMomentumCollision` | Momentum before and after a collision | compound | physics | C | unverified | Trilogy, GCSE Physics | Two trolleys with velocity arrows before and after a collision, masses labelled. |
| `physStoppingDistance` | Thinking and braking distance | compound | physics | C | unverified | Trilogy, GCSE Physics | A bar split into thinking distance and braking distance, and a chart of how each changes with speed. |
| `physMoments` | Moments and levers | compound | physics | C | unverified | GCSE Physics | A beam on a pivot with forces and distances, and a lever or gear train. |
| `physLiquidPressure` | Pressure in a liquid and upthrust | compound | physics | C | unverified | GCSE Physics | A tank with arrows showing pressure on the walls increasing with depth, and an object with an upthrust arrow. |

#### Waves (6)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `physWaveDiagram` | Transverse and longitudinal waves (amplitude, wavelength, compressions) | symbol | physics | C | unverified | Trilogy, GCSE Physics | A sine wave with wavelength and amplitude marked, and a spring with compressions and rarefactions. |
| `physRippleTankPractical` | Waves in a ripple tank and on a string | covered | apparatus | C | unverified | Trilogy, GCSE Physics | Covered by `rippleTankWaves`. The rippleTankWaves template, or wavesOnString with a vibration generator. |
| `physRayReflection` | Ray diagram: reflection at a mirror or surface | compound | physics | C | checked | GCSE Physics | A plane mirror with the normal, an incident ray and a reflected ray, and the angles marked. |
| `physRayRefraction` | Ray diagram: refraction at a boundary and wavefronts | compound | physics | C | checked | Trilogy, GCSE Physics | A glass block with the normal, a ray bending towards the normal on entering and away on leaving, and a wavefront picture of the change in speed. |
| `physLensRays` | Ray diagrams for convex and concave lenses (image formation) | compound | physics | C | checked | GCSE Physics | A lens with the principal axis, focal points, three construction rays and the image drawn at the meeting point, for an object inside and outside the focal length. |
| `physEmSpectrum` | Electromagnetic spectrum (bands in order) | chart | charts | C | unverified | Trilogy, GCSE Physics | A row of bands from radio waves to gamma rays, with wavelength and frequency arrows. |

#### Magnetism and electromagnetism (3)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `physMagneticFields` | Magnetic field lines (bar magnet, wire, solenoid) | symbol | physics | C | checked | Trilogy, GCSE Physics | Field lines from north to south round a bar magnet, circles round a straight current-carrying wire, and parallel lines inside a solenoid, with direction arrows. |
| `physMotorEffect` | Motor effect and the d.c. motor | compound | physics | C | checked | Trilogy, GCSE Physics | A wire between two magnet poles with the directions of the field, current and force, and a coil with a commutator and brushes. |
| `physGeneratorTransformer` | Generator and transformer | compound | physics | C | checked | GCSE Physics | An alternator with a rotating coil and slip rings, and a transformer with primary and secondary coils on an iron core. |

#### Space physics (2)

| Row | Name | Kind | Pack | Pri | Confidence | Course | What it draws |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `physOrbits` | Orbits of planets, moons and satellites | compound | physics | C | unverified | GCSE Physics | A planet orbiting the Sun in a near-circular path with arrows for the velocity and the gravitational force towards the centre. |
| `physStarLifeCycle` | Life cycle of a star (a Sun-like star and a massive star) | process | physics | C | unverified | GCSE Physics | Boxes and arrows from a nebula to a protostar and main-sequence star, then red giant and white dwarf for a Sun-like star, or red supergiant, supernova and neutron star or black hole for a massive one. |
<!-- /gen -->
