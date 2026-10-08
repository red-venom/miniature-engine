# Diagram inventory: KS4 science and KS5 chemistry

Phase 13, written on 8 October 2026 by the research agent. The list itself is `spec/diagrams.json`. This document is the version for people. `src/diagrams.test.ts` checks that the two agree: it compares the counts and the rows by topic, so a change to one without the other fails the test.

## Read this first

**In short.**

- The list has 287 rows: 214 for chemistry (129 at KS4 and 85 at KS5) and 73 outline rows for biology and physics.
- 54 rows are already drawn by the 123 symbols and 43 templates. 39 rows are graphs, tables and spectra, which the specification puts outside PracDraw. The other 194 rows need something new.
- Steps 1 to 7 of the build order hold all 40 priority A rows that need new code: templates from existing symbols, atoms, bonding, the particle box, molecules, structures, and flow diagrams with cells.
- Decide five things before the packs start: charts in or out; KS5 skeletal formulae and mechanisms now or later; the style of 3D structures; the dot-and-cross marks; and which course comes first (see Decisions for James).
- Confidence is weaker than it looks: 118 rows are `checked`, but only through a search tool's account of AQA pages (see below). Start with the table at the end, "Rows to check against the AQA PDF".

**What the list is.** It lists the diagram types that a teacher puts on a slide or a worksheet, or that an examiner puts in a question, for AQA GCSE Chemistry (8462), the chemistry units of AQA GCSE Combined Science: Trilogy (8464) and AQA A-level Chemistry (7405). It also has an outline of the biology and physics diagrams for GCSE. A family of diagrams is one row: "Bohr model of an atom" is one row with the parameter "element, 1 to 20", not twenty rows.

**The kinds of row.** Each row says how PracDraw would draw it.

| Kind | What it is | Chemistry | Outline | Rows |
| --- | --- | --- | --- | --- |
| symbol | a new parametric symbol: one drawing made from parameters | 49 | 19 | 68 |
| compound | a diagram of several new symbols and connectors, built from a recipe | 54 | 24 | 78 |
| template | an apparatus set-up made from symbols that exist (a new template, no new symbol) | 16 | 0 | 16 |
| process | a flow, cycle or tower diagram | 24 | 8 | 32 |
| chart | a graph, table or spectrum (outside PracDraw unless James decides) | 32 | 7 | 39 |
| covered | an existing symbol or template already draws it (the row names it) | 39 | 15 | 54 |

**Priority.** A is a core KS4 diagram that appears in most courses and most lessons on its topic. B is a less common KS4 diagram, or a core KS5 diagram. C is a KS5 specialist diagram, a nice-to-have, or an outline row. Because a KS5 diagram can be B at most, priority is not a build order across levels: the build order below says what to do first.

**Confidence.** The brief defines three levels. One limit applies to all of them. The AQA website and its PDFs could not be opened from this environment (DNS fails, and so does every page fetch). The web-search tool could read AQA pages, specification PDFs, question papers, mark schemes, reports on the examination and practical handbooks, and it returned a paraphrase with section numbers. I used that for all ten sections of 8462, for 8464, 7405, and the biology and physics sections. I never saw a figure.

- `checked` (118 rows): the search tool's account of an AQA page, paper or practical handbook reported the requirement, the figure or the apparatus for this diagram. It does not mean that I compared a drawing with an AQA drawing, and a mistake in a paraphrase would be copied here.
- `secondary` (78 rows): a revision or teaching site (Save My Exams, Oak National Academy, Doc Brown's, Chemguide) described the diagram. The AQA text named the topic.
- `unverified` (91 rows): from my memory, or the AQA text I read named the topic but not the picture.

A `checked` row always cites an AQA address and a `secondary` row cites a revision site; the test enforces both.

**What I could not reach or check.**

- The AQA specification PDFs were not opened. Every AQA statement here came through the search tool's paraphrase. AQA's copyright rule stops the tool quoting, so I have no exact wording.
- BBC Bitesize was blocked for the search tool, and no page fetch worked, so I used Save My Exams, Oak National Academy, Doc Brown's and Chemguide.
- Specification references (`specRefs`) appear only where a summary showed the number. Many rows have none. The Trilogy numbers (section 5) are not given at all.
- Which topics are chemistry only (8462 but not 8464) is partly from the "chemistry only" labels that the summaries showed and partly from memory. Check the course tags first (see the last section).
- The biology and physics rows are an outline: one line each, mostly from memory, with a handful read in AQA material.
- Counts of rows are my grouping. Another person might split or join families differently, so treat the counts as good to about plus or minus 15 percent.

## Counts

All the counts that this document states are in the table below, and the test compares it with `spec/diagrams.json`.

| Dimension | Value | Rows |
| --- | --- | --- |
| total | rows | 287 |
| subject | chemistry | 214 |
| subject | biology | 36 |
| subject | physics | 37 |
| level | KS4 | 202 |
| level | KS5 | 85 |
| kind | symbol | 68 |
| kind | compound | 78 |
| kind | template | 16 |
| kind | process | 32 |
| kind | chart | 39 |
| kind | covered | 54 |
| priority | A | 60 |
| priority | B | 117 |
| priority | C | 110 |
| confidence | checked | 118 |
| confidence | secondary | 78 |
| confidence | unverified | 91 |
| pack | apparatus | 54 |
| pack | charts | 39 |
| pack | molecules | 30 |
| pack | process | 24 |
| pack | structures | 17 |
| pack | atoms | 10 |
| pack | bioOrgans | 10 |
| pack | labTemplates | 10 |
| pack | matter | 10 |
| pack | energy | 9 |
| pack | mechanisms | 9 |
| pack | biomolecules | 7 |
| pack | bioCells | 6 |
| pack | bioProcess | 6 |
| pack | organicApparatus | 6 |
| pack | physForces | 6 |
| pack | cells | 5 |
| pack | physWaves | 4 |
| pack | bioGenetics | 3 |
| pack | bonding | 3 |
| pack | physEnergy | 3 |
| pack | physFields | 3 |
| pack | analysis | 2 |
| pack | annotation | 2 |
| pack | bioEcology | 2 |
| pack | physCircuits | 2 |
| pack | physNuclear | 2 |
| pack | physSpace | 2 |
| pack | physParticles | 1 |

Kind by priority, all subjects:

| Kind | A | B | C | Total |
| --- | --- | --- | --- | --- |
| symbol | 20 | 22 | 26 | 68 |
| compound | 10 | 34 | 34 | 78 |
| template | 4 | 12 | 0 | 16 |
| process | 6 | 9 | 17 | 32 |
| chart | 3 | 18 | 18 | 39 |
| covered | 17 | 22 | 15 | 54 |
| all | 60 | 117 | 110 | 287 |

Reading the numbers:

- 54 rows are already covered by a symbol or template. They need no new code, only a recipe and a check that the picture shows what the lesson needs. 39 rows are charts (graphs, tables and spectra), which the specification puts outside PracDraw. The remaining 194 rows need something new: 68 symbols, 78 compounds, 16 templates and 32 process diagrams.
- Several rows share one engine (for example the Bohr atom and the ion, or all the displayed formulae), so the number of separate pieces of code is smaller than the number of rows. My estimate, not a measurement, is 51 to 76 separate pieces of code for the 127 new chemistry drawings.

## Rows by topic

The tables below are generated from `spec/diagrams.json`. Columns: the row id, its name, the kind, the proposed pack, the priority (A, B or C), the confidence, and one line on what it draws. For a covered row, the last column names the symbol or template that already draws it. The full recipe for each row (parameters, science checks, sources, notes) is in the JSON file.

### Chemistry, KS4

#### Atomic structure and the periodic table (12)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `particleElementCompoundMixture` | Particle diagram of an element, a compound or a mixture | symbol | matter | A | secondary | A rectangle (the container) holding 12 to 30 circles that never overlap. Element: all circles the same size and fill (single atoms), or joined pairs for a diatomic element such as H2 or O2. |
| `atomModels` | Models of the atom: plum pudding, nuclear and shell | symbol | atoms | A | checked | Plum pudding: a large circle with a pale fill, small electrons (marked with a minus sign) scattered inside it, and a label saying that the positive charge is spread through the ball. |
| `alphaScattering` | Alpha-particle scattering experiment | compound | atoms | A | secondary | On the left a source of alpha particles in a lead block with a narrow slit. A straight beam to a thin gold foil drawn as a vertical strip of small circles (the atoms) with a tiny nucleus dot in each. |
| `bohrAtom` | Bohr model of an atom (electronic structure diagram) | symbol | atoms | A | checked | Concentric circles for the shells (radii about 28, 48, 68 and 88 u), the nucleus at the centre labelled with the symbol or with the numbers of protons and neutrons, and electrons as small dots or crosses spaced evenly round each ... |
| `nuclideNotation` | Nuclear (isotope) notation with mass number and atomic number | symbol | atoms | A | secondary | The element symbol in 18 u text with two small stacked numbers at its left: the mass number above, the atomic number below, right-aligned with each other. |
| `isotopeNuclei` | Isotopes drawn as nuclei (protons and neutrons) | symbol | atoms | B | secondary | A tight cluster of circles for the nucleus: protons marked with a plus sign, neutrons plain. |
| `periodicTable` | Periodic table (outline with groups, periods and metal divider) | symbol | atoms | A | checked | A grid of 18 columns and 7 rows of square cells (the f-block as two separate rows below). Each cell can show the symbol, the atomic number, the name or the relative atomic mass. |
| `mendeleevTable` | Mendeleev's early periodic table with gaps | chart | charts | C | unverified | A table of rows and columns of element symbols in order of atomic weight with a few question marks where elements were then unknown (the gaps that predicted gallium and germanium). |
| `subatomicParticlesTable` | Table of relative charge and mass of the subatomic particles | chart | charts | C | unverified | A three-row table: proton (relative charge +1, relative mass 1), neutron (0, 1), electron (-1, very small, about 1/1835). |
| `groupOneWater` | A Group 1 metal reacting with water | template | labTemplates | B | secondary | A trough or a large beaker of water (Water preset, 60 %). A small piece of metal (the irregularSolid symbol made small and pale grey) on the surface, a few bubbles under it, and an optional lit splint above the bubbles. |
| `halogenDisplacement` | Halogen displacement reactions in test tubes | covered | apparatus | B | secondary | Covered by `testTubeReactions`. Use the testTubeReactions template with three or four tubes in a rack. |
| `groupTrendChart` | Graph of a property down a group (melting or boiling point) | chart | charts | C | unverified | A line graph or bar chart of melting point or boiling point against the elements of Group 1 or Group 7, used to predict a missing value. |

#### Bonding, structure and the properties of matter (25)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `ionShell` | Electron arrangement of an ion (shell diagram in brackets) | symbol | atoms | A | secondary | The shell diagram of bohrAtom for the ion: a metal ion has lost its outer shell, a non-metal ion has the electrons it gained added to its outer shell. |
| `particleStates` | Particle diagrams of a solid, a liquid and a gas | symbol | matter | A | secondary | Three boxes side by side. Solid: touching circles in a regular lattice, with small vibration marks. Liquid: touching circles in an irregular arrangement filling the lower part of the box, with a few short motion arrows. |
| `changeOfState` | Changes of state (melting, freezing, boiling, condensing, sublimation) | compound | matter | A | secondary | Three particle boxes (solid, liquid, gas) in a row with a pair of labelled arrows between solid and liquid (melting above, freezing below) and between liquid and gas (boiling or evaporating above, condensing below). |
| `heatingCurve` | Heating and cooling curve of a pure substance | chart | charts | A | unverified | Axes: temperature (vertical) against time (horizontal). |
| `ionicDotCross` | Dot-and-cross diagram of an ionic compound | symbol | bonding | A | checked | Two forms. Transfer: the metal atom and the non-metal atom as circles for their outer shells, the metal's electrons as dots and the non-metal's as crosses, with curved arrows showing the electrons moving across. |
| `covalentDotCross` | Dot-and-cross diagram of a simple covalent molecule | symbol | bonding | A | checked | One circle for the outer shell of each atom, overlapping where atoms are bonded. Each shared pair sits in the overlap as one dot and one cross. |
| `displayedFormulaSmall` | Displayed formula of a small molecule (lines for bonds) | symbol | molecules | A | checked | Atom symbols in 15 u text joined by single lines, double lines or triple lines, laid out flat with the bonds at right angles or at 120 degrees (the 2D convention, not the real shape). |
| `ballAndStickModel` | Ball-and-stick model of a small molecule | symbol | molecules | A | checked | Spheres joined by sticks, drawn as circles with a small highlight line (no shading, no gradient, S7) and sticks as two parallel lines in an oblique view. |
| `spaceFillingModel` | Space-filling model of a small molecule | symbol | molecules | C | secondary | Overlapping circles at the atom positions with the nearer atoms drawn in front, and a key for the atoms. No sticks. |
| `ionicLattice2D` | Giant ionic lattice in two dimensions | symbol | structures | A | checked | A square grid of touching circles in alternating kinds: the positive ions small and marked +, the negative ions larger and marked -. |
| `ionicLattice3D` | Sodium chloride lattice in three dimensions (ball and stick) | symbol | structures | B | secondary | A 3 by 3 by 3 cube of alternating small (Na+) and large (Cl-) circles in an oblique projection: the front face drawn square and the back face shifted up and right at half size, joined by lines. |
| `metallicBonding` | Metallic bonding (positive ions in a sea of delocalised electrons) | symbol | structures | A | checked | Rows of equal circles marked + (the metal ions) in a regular lattice, with small dots or minus signs scattered in the gaps between them (the delocalised electrons, drawn irregularly, not in rows). |
| `alloyStructure` | Alloy and pure metal layers (why alloys are harder) | symbol | structures | A | secondary | Rows of equal circles for the pure metal, with a heavy arrow showing one layer sliding over the next. |
| `diamondStructure` | Diamond (giant covalent, tetrahedral) | symbol | structures | A | secondary | Carbon atoms (small circles) joined by single lines, each atom bonded to four neighbours in a tetrahedral pattern, in an oblique projection with the rear bonds lighter or dashed. |
| `graphiteStructure` | Graphite (layers of hexagons) | symbol | structures | A | secondary | Three stacked layers drawn as flat parallelograms in oblique view, each a network of carbon hexagons with atoms at the corners. |
| `grapheneSheet` | Graphene (one layer of hexagons) | symbol | structures | A | secondary | A flat honeycomb of carbon hexagons, about 4 rows by 5 columns, atoms at the vertices and bonds as lines, with short stubs or a wavy cut line at the edge. |
| `fullereneC60` | Buckminsterfullerene C60 | symbol | structures | A | secondary | A ball of 60 carbon atoms joined by lines: 12 pentagons and 20 hexagons, each pentagon surrounded by hexagons. |
| `carbonNanotube` | Carbon nanotube | symbol | structures | B | secondary | A cylinder made by rolling the graphene honeycomb, in oblique view: an open or capped end ellipse, the hexagon network on the visible surface, atoms at the vertices. |
| `silicaStructure` | Silicon dioxide (giant covalent) | symbol | structures | B | secondary | The diamond network with an oxygen atom drawn in the middle of every bond between two silicon atoms. Silicon atoms larger, oxygen smaller, different fills, with a key. |
| `polymerChains` | Polymer chains (linear, branched and cross-linked) | symbol | structures | B | secondary | Several long zig-zag chains of carbon atoms side by side, with hydrogen stubs. Linear chains (HDPE) lie close and parallel. |
| `ionicConduction` | Why ionic compounds conduct only when molten or dissolved | compound | matter | B | secondary | Three particle boxes of + and - ions: solid (ions fixed in a lattice), molten (ions close together but free), dissolved (ions spread apart in water, with water drawn as plain background). |
| `surfaceAreaVolumeCubes` | Cubes for surface area to volume ratio (nanoparticles and rates) | symbol | matter | B | secondary | Cubes of side 1, 2 and 3 units (or one cube cut into 8 smaller cubes) in an oblique view, with grid squares on the visible faces, the side length on an edge, and a line of text under each giving the surface area, the volume and ... |
| `sizeScaleLadder` | Size scale: atoms, nanoparticles and cells on a powers-of-ten line | chart | charts | C | unverified | A horizontal line marked in powers of ten from 0.1 nm to 1 mm with labelled objects: atom, small molecule, nanoparticle range (1 to 100 nm), virus, bacterium, cell, hair width. |
| `smallMoleculeForces` | Small molecules with covalent bonds inside and weak forces between them | symbol | structures | B | secondary | Four to six small molecules (methane, water, carbon dioxide or iodine) arranged in a loose pattern. The covalent bonds inside each molecule are solid lines. |
| `conductivityTest` | Testing whether a substance conducts electricity | template | labTemplates | B | unverified | A circuit of a cell (or power supply), a lamp and two carbon electrodes on wires, the electrodes dipping into a beaker of the sample (a solution, or a crucible of the molten substance; for a solid, the electrodes touch the block). |

#### Quantitative chemistry (9)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `massChangeOpenFlask` | Mass change in an open and a closed flask on a balance | covered | apparatus | B | secondary | Covered by `massLoss`. Use the massLoss template: a conical flask on the balance with marble chips, acid and bubbles, a cotton wool plug in the neck, and the balance reading as text. |
| `magnesiumInCrucible` | Heating magnesium in a crucible with a lid (mass gain) | template | labTemplates | B | secondary | A crucible with a lid on a pipeclay triangle on a tripod, a Bunsen burner with a blue flame under it on a heatproof mat, a coil of magnesium ribbon inside the crucible, and a label 'lift the lid briefly to let air in'. |
| `balancedEquationModels` | A balanced equation drawn with particle models | compound | molecules | A | secondary | Each formula in the equation drawn as a small ball-and-stick model, the number of models equal to the coefficient, with plus signs and a reaction arrow between the groups. |
| `limitingReactantModels` | Limiting reactant shown with particle models (before and after) | compound | molecules | B | unverified | A box before the reaction with, for example, 6 hydrogen molecules and 2 nitrogen molecules, an arrow, and a box after with the ammonia formed and the reactant left over. |
| `concentrationParticles` | Dilute and concentrated solutions as particle pictures | symbol | matter | B | secondary | Two or three boxes or beakers of equal volume, each showing the same number of water background and a different number of solute particles (circles). |
| `readingScaleQuestion` | Reading a burette or measuring cylinder (enlarged scale) | covered | apparatus | B | secondary | Covered by `scaleWindow`. Use the magnified scale: a section of a burette or measuring cylinder with divisions and the end values, a liquid with a meniscus, and the reading set with the Reading field. |
| `titrationSetup` | Titration apparatus (burette, flask and white tile) | covered | apparatus | A | checked | Covered by `titration`. Use the titration template: a burette clamped upright with its tip inside the neck of a conical flask, the flask on a white tile with alkali and an indicator (Pink preset for phenolphthalein), labels for each part. |
| `titrationResultsTable` | Table of titration results (rough, trials, mean titre) | chart | charts | C | unverified | A ruled table with columns for rough, trial 1, trial 2 and trial 3, and rows for final burette reading, initial reading and titre (cm3), with a line for the mean of the concordant titres. |
| `formulaTriangle` | Formula triangle (moles, concentration and similar) | symbol | annotation | B | unverified | A triangle split by a horizontal line and a vertical line into three parts: one quantity at the top and two at the bottom. |

#### Chemical changes (15)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `reactivitySeriesList` | Reactivity series (ordered list with carbon and hydrogen) | chart | charts | A | secondary | A vertical list of metals from most to least reactive (potassium, sodium, lithium, calcium, magnesium, aluminium, then carbon for reference, zinc, iron, hydrogen for reference, copper, silver, gold) with an arrow along the side ... |
| `metalsAcidTubes` | Metals in dilute acid in test tubes (rate of bubbling) | covered | apparatus | A | secondary | Covered by `testTubeReactions`. Use the testTubeReactions template with four tubes in a rack, each with a small piece of a different metal (the metal ribbon symbol, labelled) in Colourless solution. |
| `metalDisplacementTubes` | Displacement of a metal from a salt solution | covered | apparatus | A | secondary | Covered by `testTubeReactions`. Use the testTubeReactions template: tubes with a metal strip or an iron nail in copper sulfate solution (Blue preset) before and after, the blue fading and a brown deposit (a powder layer) on the metal; a tube with no change for ... |
| `metalOxideCarbonHeating` | Heating a metal oxide with carbon and testing the gas | covered | apparatus | B | secondary | Covered by `thermalDecomposition`. Use the thermalDecomposition template with a black mixture of copper oxide and carbon (Black powder preset) in the boiling tube, the delivery tube into limewater in a test tube, and the Bunsen under the powder. |
| `blastFurnace` | Blast furnace for the extraction of iron | process | process | B | secondary | A tall furnace outline, wide in the middle and narrower at top and bottom. Inlets: iron ore, coke and limestone at the top, hot air blown in near the bottom. |
| `saltPreparation` | Preparing a pure dry soluble salt (react, filter, evaporate) | covered | apparatus | A | checked | Covered by `crystallisation`. Three pictures in order, all existing templates. Step 1, heatingBeaker: warm dilute acid in a beaker on a gauze, with the insoluble oxide or carbonate added in excess and stirred (glass rod). |
| `pHScale` | pH scale with universal indicator colours | symbol | analysis | A | secondary | A horizontal strip divided into 15 cells numbered 0 to 14, coloured red, orange, yellow, green (7) then blue and purple, with a bracket for acidic below 7, neutral at 7 and alkaline above 7. |
| `strongWeakAcids` | Strong and weak acids as particle pictures | symbol | matter | B | secondary | Two boxes of the same size and the same number of acid particles. Strong acid: every molecule split into H+ and a negative ion (fully ionised). |
| `electrolysisIons` | Electrolysis cell with the movement of ions | compound | cells | A | secondary | A cell holding the electrolyte (molten or a solution), two electrodes joined by wires to a power supply, the negative electrode (cathode) and positive electrode (anode) marked. |
| `electrolysisMoltenApparatus` | Apparatus for electrolysis of a molten compound | template | labTemplates | B | secondary | A crucible (or a deep basin) of the molten compound on a pipeclay triangle on a tripod, a Bunsen burner under it on a heatproof mat. |
| `electrolysisGasTubes` | Electrolysis of a solution with gas collected in inverted tubes | covered | apparatus | B | secondary | Covered by `electrolysis`. Use the electrolysis template: the cell with two electrodes, two upside-down test tubes over the electrodes, gas in both tubes with about twice the volume over the negative electrode for a sodium sulfate solution, wires to a ... |
| `electrolysisPetriLid` | Electrolysis of an aqueous solution with a Petri dish lid (required practical) | covered | apparatus | A | checked | Covered by `electrolysisBeaker`. Use the electrolysisBeaker template: a beaker of solution with a lid on its rim, a carbon rod through each of two holes, a crocodile clip on the top of each rod, wires to a low-voltage supply. |
| `aluminiumExtractionCell` | Electrolysis cell for the extraction of aluminium | process | cells | A | secondary | A section of a rectangular steel tank lined with carbon along the bottom and sides (the negative electrode). |
| `copperRefining` | Electrolytic purification of copper | compound | cells | B | secondary | A tank of copper sulfate solution with a thick block of impure copper as the positive electrode and a thin sheet of pure copper as the negative electrode, wires to a power supply. |
| `evaporationCrystallisation` | Evaporating a salt solution to obtain crystals | covered | apparatus | B | checked | Covered by `crystallisation`. Use the crystallisation template: an evaporating basin of salt solution sitting in the mouth of a beaker of water (a water bath) on a gauze over a Bunsen burner. |

#### Energy changes (6)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `reactionProfile` | Reaction profile (energy level diagram): exothermic and endothermic | symbol | energy | A | checked | Axes: 'Energy' up the side and 'Progress of reaction' along the bottom, with no numbers. A smooth curve from a flat reactants level up to a rounded peak and down to a flat products level. |
| `bondEnergyDiagram` | Bond breaking and bond making (bond energy calculation) | compound | energy | B | checked | The reaction as displayed formulae in a row (for example H-H plus Cl-Cl giving two H-Cl), the bonds to be broken circled on the left with their energies, the bonds made circled on the right with their energies. |
| `temperatureChangeCup` | Temperature change of a reaction in a polystyrene cup (required practical) | covered | apparatus | A | checked | Covered by `temperatureChange`. Use the temperatureChange template: a polystyrene cup with a lid in a beaker, a thermometer through the lid hole, the solution at about 50 percent. |
| `simpleCell` | Simple cell: two metals in an electrolyte with a voltmeter | template | labTemplates | A | checked | A beaker of electrolyte (Colourless solution) with two different metal strips (the electrode symbol, metal strip) standing in it without touching each other. |
| `fuelCell` | Hydrogen fuel cell | compound | cells | A | secondary | A box with an electrolyte in the middle and a porous electrode on each side. Hydrogen enters at the left electrode (negative), oxygen or air at the right (positive), and water leaves at the right. |
| `temperatureTimeGraph` | Temperature against time or volume for a reaction | chart | charts | B | unverified | Axes with scales, plotted points and a line of best fit, for the temperature change against the volume of alkali added, or against time. |

#### The rate and extent of chemical change (10)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `rateGraph` | Rate graph: amount of product against time, with a tangent | chart | charts | A | checked | Axes with scales: time along the bottom, volume of gas (or mass of product, or mass lost) up the side. One to three curves that start at the origin, rise steeply and flatten to a plateau. |
| `rateGasSyringeApparatus` | Rate of reaction: gas collected in a gas syringe | covered | apparatus | A | checked | Covered by `rateGasSyringe`. Use the rateGasSyringe template: a conical flask of acid with marble chips and bubbles, a bung and a tube to a gas syringe held by a clamp, a stopwatch beside the stand. |
| `rateGasOverWaterApparatus` | Rate of reaction: gas collected over water | covered | apparatus | A | checked | Covered by `rateGasOverWater`. Use the rateGasOverWater template: a flask of acid with magnesium ribbon, a one-hole bung and delivery tube to a trough of water, an upside-down measuring cylinder full of water held by a clamp over the tube end, a stopwatch. |
| `rateDisappearingCross` | Rate of reaction: disappearing cross (sodium thiosulfate and acid) | covered | apparatus | A | checked | Covered by `disappearingCross`. Use the disappearingCross template: a flask on a paper with a cross, the observer looking down into the flask, a stopwatch, a thermometer in the cloudy yellow mixture. |
| `collisionTheoryParticles` | Collision theory: particle pictures for concentration, temperature and surface area | compound | matter | A | secondary | Pairs of boxes with a short caption. Concentration or pressure: the same volume with few particles and with many. |
| `equilibriumClosedSystem` | Reversible reaction reaching equilibrium in a closed container | compound | matter | B | secondary | Three sealed boxes in a row: at the start (all reactant particles), part-way, and at equilibrium. Between them a pair of arrows labelled forward and backward, the two arrows equal in length at equilibrium. |
| `equilibriumConcentrationGraph` | Concentration against time as a reaction reaches equilibrium | chart | charts | B | secondary | Axes: concentration up, time along. A falling curve for the reactant and a rising curve for the product that both level off, from time zero, with a vertical dashed line where equilibrium starts. |
| `leChatelierGasSyringe` | Nitrogen dioxide and dinitrogen tetroxide in a sealed syringe (pressure change) | covered | apparatus | B | checked | Covered by `gasSyringe`. Two gas syringes side by side. The first holds a brown gas (Brown gas preset). |
| `reversibleHeatingTube` | Heating hydrated copper sulfate (a reversible reaction) | template | labTemplates | B | unverified | A boiling tube held by a test-tube holder (or a clamp) at a slope with its mouth lower than its closed end, blue crystals (Blue crystals preset) at the closed end, a Bunsen with a blue flame under the crystals, water droplets ... |
| `haberYieldGraphs` | Graphs of ammonia yield against pressure and temperature | chart | charts | B | checked | Axes: percentage yield of ammonia up, pressure along, with three curves for three temperatures (the lowest temperature on top). |

#### Organic chemistry (17)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `crudeOilFractionatingTower` | Fractional distillation of crude oil (industrial column) | process | process | A | checked | A tall column drawn as a vertical rectangle with horizontal trays, hot at the bottom and cool at the top (a temperature arrow). |
| `displayedFormulaHydrocarbon` | Displayed formula of an alkane or alkene | compound | molecules | A | checked | C and H in 15 u text joined by single lines, a double line for C=C. A straight chain of carbons with hydrogens above and below, bonds at right angles, lines long enough to read. |
| `displayedFormulaFunctional` | Displayed formula of an alcohol or a carboxylic acid | compound | molecules | A | checked | A straight carbon chain with hydrogens, plus the functional group drawn in full: -O-H for an alcohol, -C(=O)-O-H for a carboxylic acid, with every bond shown. |
| `esterDisplayed` | Ester formation (alcohol plus carboxylic acid) in displayed formulae | compound | molecules | B | checked | A carboxylic acid and an alcohol as displayed formulae joined by a plus sign, a reaction arrow, and the ester with the new C-O-C link in the middle and water as the second product. |
| `alkeneAdditionReactions` | Addition reactions of alkenes (hydrogen, water, halogens) in displayed formulae | compound | molecules | A | checked | The alkene as a displayed formula, a plus sign and the reagent (H-H, H-O-H, Cl-Cl, Br-Br, I-I), an arrow, and the product with the double bond now single and the new atoms on the two carbons. |
| `additionPolymerisation` | Addition polymerisation (monomer to repeating unit) | compound | molecules | A | checked | The monomer as a displayed formula (with C=C), an arrow labelled with n and the catalyst or conditions, and the polymer drawn as the repeating unit inside square brackets with the bonds running out through the brackets and a ... |
| `condensationPolymerBlock` | Condensation polymerisation (diol and dicarboxylic acid) with block diagrams | compound | molecules | B | secondary | Two monomers drawn as a rectangle (the carbon chain) with the functional groups at the two ends drawn in full: HO-OC- ... |
| `aminoAcid` | Amino acid and dipeptide in displayed formulae | compound | molecules | B | checked | The general amino acid H2N-CH(R)-COOH in displayed formula, with the amine and carboxyl groups marked, and glycine as the example (R is H). |
| `dnaStructure` | DNA: double helix, nucleotide and base pairs | compound | biomolecules | B | checked | Two ribbons twisted round each other with rungs for the base pairs, and one nucleotide in detail: a circle for the phosphate, a pentagon for the sugar and a rectangle for the base, joined in a line. |
| `naturalPolymerChains` | Natural polymers as chains of monomers (starch, cellulose, protein) | compound | biomolecules | C | unverified | A chain of repeated boxes or circles (glucose units for starch and cellulose, amino acids for a protein) joined end to end, with the repeating unit bracketed. |
| `crackingApparatus` | Laboratory cracking of a hydrocarbon | template | organicApparatus | B | secondary | A boiling tube lying almost horizontal and held by a clamp, with mineral wool soaked in paraffin at the closed end and pieces of catalyst (broken porcelain or aluminium oxide, a Chips layer) in the middle, heated strongly by a ... |
| `crackingEquationModels` | Cracking drawn as a long molecule breaking into smaller ones | compound | molecules | B | secondary | A long-chain alkane as a displayed formula (for example decane), a reaction arrow labelled with the catalyst or steam and high temperature, and the products: a shorter alkane and one or more alkenes, drawn as displayed formulae. |
| `fermentationApparatus` | Fermentation of a sugar solution (apparatus) | template | organicApparatus | B | unverified | A conical flask of sugar solution and yeast closed with a bung and a delivery tube that dips into limewater in a test tube, with the flask standing in a beaker of warm water (about 35 degrees) and a thermometer in the water bath. |
| `combustionProductsApparatus` | Testing the products of burning a hydrocarbon fuel | template | organicApparatus | B | unverified | A spirit burner or candle under a funnel, a tube from the funnel to a U-tube standing in a beaker of ice (liquid collects), a second tube to a test tube of limewater (turns cloudy), and a tube to a filter pump that draws the ... |
| `alkeneBromineTest` | Bromine water test for an alkene | covered | apparatus | A | secondary | Covered by `testTubeReactions`. Use the testTubeReactions template with two tubes in a rack: bromine water (Orange preset) with an alkane, which stays orange; and with an alkene, which goes colourless (Colourless solution preset). |
| `oilToPolymersFlow` | From crude oil to polymers (fractional distillation, cracking, polymerisation) | process | process | C | unverified | Boxes joined by arrows: crude oil, fractional distillation, long-chain fractions, cracking, alkenes and shorter alkanes, polymerisation, polymers. |
| `fractionalDistillationLab` | Fractional distillation in the laboratory (ethanol and water) | template | organicApparatus | B | unverified | The distillation template with a fractionating column between the flask and the still head: a round-bottomed flask in a heating mantle, a vertical column packed with glass beads, a thermometer at the top with its bulb level with ... |

#### Chemical analysis (13)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `chromatogramRf` | Paper chromatogram with Rf measurements | covered | apparatus | A | checked | Covered by `chromatographyPaper`. Use the chromatography paper symbol, developed: a pencil start line near the bottom, several spots (a pure substance gives one spot, a mixture several) and the solvent front line near the top. |
| `chromatographyApparatus` | Paper chromatography apparatus | covered | apparatus | A | checked | Covered by `paperChromatography`. Use the paperChromatography template: a beaker with a little solvent, a paper hanging from a rod across the rim, the pencil start line above the solvent level, and the spots on the line. |
| `filtrationApparatus` | Filtration apparatus (separating an insoluble solid) | covered | apparatus | A | checked | Covered by `filtration`. Use the filtration template: a funnel with fluted or folded filter paper standing in the neck of a conical flask, the residue (for example sand) on the paper and the filtrate in the flask. |
| `gasTests` | Tests for hydrogen, oxygen, carbon dioxide and chlorine | template | labTemplates | A | checked | Four small pictures. Hydrogen: a lit splint at the mouth of a test tube of gas (squeaky pop). Oxygen: a glowing splint going into a test tube of gas, relighting. |
| `carbonateTest` | Test for a carbonate (acid, then limewater) | template | labTemplates | A | checked | A test tube of the solid carbonate with dilute acid added from a dropper, fizzing, closed with a bung and a delivery tube that dips into limewater in a second test tube, which turns cloudy. |
| `flameTestApparatus` | Flame test apparatus (nichrome wire in a blue flame) | covered | apparatus | A | checked | Covered by `flameTest`. Use the flameTest template: a Bunsen burner on a heatproof mat with a blue flame, and a nichrome wire loop held in the edge of the flame. |
| `flameColours` | Flame test colours (lithium, sodium, potassium, calcium, copper) | symbol | analysis | B | checked | Five Bunsen flames side by side, each with the flame colour of one metal ion and the name below: lithium crimson, sodium yellow, potassium lilac, calcium orange-red, copper green. |
| `halideSulfateTubes` | Halide and sulfate precipitate tests in test tubes | covered | apparatus | A | checked | Covered by `testTubeReactions`. Use the testTubeReactions template with four tubes. Halides: add dilute nitric acid then silver nitrate; chloride gives a white precipitate, bromide a cream one, iodide a yellow one (the Cream and Yellow presets). |
| `hydroxideTubes` | Metal hydroxide precipitates with sodium hydroxide solution | covered | apparatus | A | unverified | Covered by `testTubeReactions`. Use the testTubeReactions template with six tubes: aluminium, calcium and magnesium ions give white precipitates (aluminium dissolving in excess alkali), copper(II) gives a blue precipitate, iron(II) a green one, iron(III) a ... |
| `flameEmissionSpectra` | Flame emission spectra (known ions and a mixture) | chart | charts | B | checked | Strips of line spectra on a common wavelength scale: one strip for each known metal ion and one for the unknown mixture, each a dark background with bright vertical lines at fixed positions. |
| `identificationFlowchart` | Flow chart for identifying an unknown ionic compound | process | process | C | unverified | A flow chart of tests with boxes and yes/no arrows: flame test, then sodium hydroxide, then the acid tests for carbonate, halide and sulfate, ending in the ions identified. |
| `waterAnalysisPurification` | Water analysis and purification (distillation set-up) | covered | apparatus | A | checked | Covered by `simpleDistillation`. Use the simpleDistillation template: a conical flask of salty water on a gauze over a Bunsen burner, a two-hole bung with a thermometer and a delivery tube to a test tube standing in a beaker of ice and water. |
| `gasCollectionMethods` | Collecting a gas: over water, upward delivery, downward delivery and gas syringe | template | labTemplates | B | unverified | Four small set-ups, each a flask producing the gas with a bung and delivery tube. Over water: a trough with an upside-down measuring cylinder or tube full of water (the gas is insoluble). |

#### Chemistry of the atmosphere (7)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `atmosphereComposition` | Composition of dry air (pie chart, bar chart or particle grid) | chart | charts | B | secondary | A pie chart or bar chart of the gases in dry air: nitrogen about 78 percent, oxygen about 21 percent, argon about 1 percent, carbon dioxide about 0.04 percent. |
| `earlyAtmosphereGraph` | How the gases in the atmosphere changed over time | chart | charts | B | checked | Axes: percentage of gas up the side, time since the Earth formed along the bottom. |
| `greenhouseEffect` | The greenhouse effect | process | process | A | secondary | The Sun at the top, the Earth's surface at the bottom and a band for the atmosphere across the middle. |
| `carbonCycleSimple` | Carbon cycle (simple, for the atmosphere topic) | process | process | B | secondary | Boxes for the atmosphere (carbon dioxide), plants and algae, animals, decomposers, fossil fuels, and oceans and rocks, joined by arrows labelled photosynthesis, feeding, respiration, decay, combustion, formation of fossil fuels, ... |
| `co2TemperatureGraphs` | Carbon dioxide concentration and global temperature against time | chart | charts | B | checked | One or two line graphs with years along the bottom: carbon dioxide concentration (parts per million) rising, and average global surface temperature rising, on separate axes one above the other. |
| `acidRainFormation` | How acid rain forms and what it damages | process | process | B | secondary | A power station or car on the left burning a fuel, with sulfur dioxide and oxides of nitrogen rising into a cloud; the gases dissolve in water droplets; rain falls on a limestone building, a lake and trees. |
| `catalyticConverter` | Catalytic converter (cross-section) | process | process | C | unverified | A tube cut away to show a honeycomb ceramic block coated with a metal catalyst, exhaust gases entering on the left (carbon monoxide, oxides of nitrogen, unburnt hydrocarbons) and cleaner gases leaving on the right (carbon ... |

#### Using resources (14)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `potableWaterTreatment` | Treatment of water to make it safe to drink (potable water) | process | process | A | checked | A flow diagram from left to right: a fresh water source (a reservoir or river), screening to remove large objects, a settling tank (sedimentation), filter beds of sand and gravel, then sterilising with chlorine (or ozone or ... |
| `desalinationReverseOsmosis` | Desalination by reverse osmosis | process | process | B | secondary | Salt water enters on the left, passes a high-pressure pump and meets a membrane drawn as a dashed barrier across a pipe. |
| `wasteWaterTreatment` | Treatment of waste water (sewage) | process | process | A | secondary | A flow chart with two branches. Raw sewage goes to screening and grit removal, then to sedimentation. |
| `phytomining` | Phytomining flow diagram | process | process | B | secondary | Boxes and arrows: plants grown on soil with a low metal content, the plants absorb metal compounds, the plants are harvested, burned, giving ash that contains metal compounds, and the metal is extracted from the ash (by ... |
| `bioleaching` | Bioleaching flow diagram | process | process | B | secondary | Boxes and arrows: low-grade copper ore, bacteria added, a leachate solution containing metal compounds is produced, and the metal is extracted from the leachate (displacement or electrolysis). |
| `lifeCycleAssessment` | Life cycle assessment (stages of a product's life) | process | process | B | secondary | A cycle or a row of four boxes: extracting and processing raw materials, manufacturing and packaging, use and operation during the lifetime, disposal at the end of life (with recycling feeding back to the first box). |
| `lcaTable` | Table of life cycle assessment data (two products) | chart | charts | C | checked | A table with columns for two products (for example a plastic bag and a paper bag) and rows for energy, water, waste and carbon dioxide at each stage. |
| `recyclingLoop` | Recycling loop for metals, glass or plastics | process | process | C | unverified | A loop of boxes: collect, sort, melt or reprocess, manufacture a new product, use, collect again. Arrows labelled with energy saved against extraction from ore. |
| `rustingTubes` | Rusting experiment (nails in test tubes) | template | labTemplates | A | secondary | Four test tubes in a rack, each with an iron nail. Tube 1: tap water, open to air (the nail rusts, drawn with brown marks). |
| `sacrificialProtection` | Sacrificial protection and galvanising | compound | structures | B | secondary | Sacrificial protection: part of a steel hull or pipe with a block of zinc (or magnesium) attached by a metal contact and an arrow showing the zinc dissolving instead of the iron. |
| `compositeMaterial` | Composite material (fibres in a matrix) | symbol | structures | C | unverified | A block cut away to show long fibres or rods embedded in a shaded matrix, with the labels reinforcement and matrix. |
| `haberProcess` | The Haber process (flow diagram) | process | process | A | checked | Boxes and arrows from left to right: hydrogen (from natural gas) and nitrogen (from the air) in the ratio 3 to 1 enter a compressor, then the reactor (iron catalyst, about 450 degrees C, about 200 atmospheres), then a cooler or ... |
| `npkFertiliserRoutes` | Making NPK fertilisers from ammonia, acids and potassium salts | process | process | C | unverified | Boxes and arrows: ammonia reacting with nitric acid to give ammonium nitrate; phosphate rock treated with nitric or sulfuric acid to give soluble phosphates; potassium chloride or sulfate from mining; the three combined into an ... |
| `npkBarChart` | Bar chart of the nitrogen, phosphorus and potassium content of fertilisers | chart | charts | C | checked | A bar chart with fertiliser types along the bottom and percentage by mass up the side, grouped bars for N, P and K. |

#### Working scientifically and practical skills (1)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `hazardSymbols` | Hazard symbols (the nine GHS pictograms) | symbol | annotation | B | unverified | A square set on its corner (a diamond) with a black outline and a black picture inside: exploding bomb, flame, flame over a circle, gas cylinder, corrosion (liquid on a hand and a metal), skull and crossbones, exclamation mark, ... |

### Chemistry, KS5

#### Physical chemistry (A-level) (25)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `tofMassSpectrometer` | Time-of-flight mass spectrometer (block diagram) | process | process | B | secondary | A block diagram from left to right: sample inlet, ionisation (electron gun or electrospray), acceleration between charged plates, a long flight tube kept under vacuum, a detector, then a data system. |
| `massSpectrumBar` | Mass spectrum of an element or a molecule (bar chart) | chart | charts | B | checked | A bar chart with m/z along the bottom and relative abundance (or percentage) up the side: vertical lines at the isotope masses (for example chlorine at 35 and 37, or Cl2 at 70, 72 and 74). |
| `electronBoxDiagram` | Electron configuration in sub-shell boxes (s, p and d) with spin arrows | symbol | atoms | B | secondary | A row of boxes for each sub-shell (one box for s, three for p, five for d) labelled 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p. |
| `subshellEnergyLevels` | Energy levels of sub-shells (1s to 4p) with electrons | symbol | energy | C | secondary | A vertical energy ladder with a short line for each sub-shell, ordered 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p, the gaps shrinking upwards so that 4s sits below 3d. |
| `orbitalShapes` | Shapes of s and p orbitals | symbol | atoms | C | unverified | A sphere for an s orbital and a pair of lobes (dumbbell) for each p orbital along the x, y and z axes, on a set of three axes. |
| `ionisationEnergyGraph` | Ionisation energy graphs (successive, and across Period 3 or down Group 2) | chart | charts | B | checked | Axes: ionisation energy (or its logarithm) up the side. Successive ionisation energies: points for the 1st to the nth ionisation of one element with large jumps where an inner shell is reached. |
| `covalentDotCrossAdvanced` | Dot-and-cross diagrams with dative bonds and expanded octets | symbol | bonding | B | secondary | As the GCSE covalent dot-and-cross, but for ions and molecules with a dative bond: both electrons of the shared pair come from the donor and are drawn with the same mark; in a displayed formula the dative bond is an arrow ... |
| `vseprShapes` | Shapes of molecules and ions with bond angles (wedge and dash) | symbol | molecules | B | checked | The central atom with its bonds drawn as plain lines in the plane of the page, wedges coming towards the viewer and dashes going away. |
| `bondPolarityDipoles` | Polar bonds and polar molecules (partial charges and dipole arrows) | compound | molecules | B | checked | A molecule drawn with its shape (plane, wedge and dash as needed), delta-plus on the less electronegative atom and delta-minus on the more electronegative atom of each polar bond, and a dipole arrow with a cross at the delta-plus ... |
| `intermolecularForceDiagrams` | Intermolecular forces: London forces, permanent dipoles and hydrogen bonds | compound | molecules | B | checked | Pairs or small groups of molecules with a dotted line for the force. London forces: two atoms or molecules with delta-plus and delta-minus labels showing an instantaneous dipole and an induced dipole. |
| `iceLattice` | Ice (hydrogen-bonded open lattice) | symbol | structures | B | secondary | Water molecules (an oxygen with two hydrogens) in an oblique view, each linked to four neighbours by hydrogen bonds drawn as dotted lines, forming puckered hexagonal rings with open space in the middle. |
| `iodineLattice` | Iodine (simple molecular lattice) | symbol | structures | B | secondary | Iodine molecules drawn as pairs of joined circles on the corners and face centres of a cube in an oblique projection (about 14 molecules), each pair tilted as in the crystal, with a label: weak London forces between molecules. |
| `magnesiumLattice` | Magnesium (close-packed metal lattice) | symbol | structures | B | secondary | Layers of Mg2+ ions (circles marked 2+) packed close together in two layers, the second layer sitting in the hollows of the first, with small delocalised electrons between the ions. |
| `hessCycle` | Hess's law cycle (formation, combustion and bond enthalpy) | compound | energy | B | checked | A triangle or box of species with state symbols: reactants top left, products top right, and the common species (elements, or the combustion products) at the bottom. |
| `bornHaberCycle` | Born-Haber cycle | compound | energy | B | checked | An energy-level diagram: the elements in their standard states at the base level, then levels for gaseous atoms, gaseous ions and the ionic solid, joined by labelled arrows: atomisation of the metal and of the non-metal (up), ... |
| `enthalpySolutionCycle` | Enthalpy cycle for dissolving an ionic solid (lattice and hydration) | compound | energy | C | unverified | A triangle: the solid at the top left, the aqueous ions at the top right, the gaseous ions at the bottom. |
| `reactionProfileMultiStep` | Reaction profile with an intermediate and a rate-determining step | symbol | energy | B | unverified | As the GCSE reaction profile but with two or three humps and valleys: reactants, a first hump, an intermediate in a valley, a second hump, products. |
| `maxwellBoltzmann` | Maxwell-Boltzmann distribution curves (temperature and catalyst) | chart | charts | B | checked | Axes: number of molecules (or fraction) up the side, energy along the bottom, with no numbers. A curve that starts at the origin, rises to a peak and falls without touching the axis. |
| `concentrationTimeGraph` | Concentration against time (tangents, order and half-life) | chart | charts | B | checked | Axes with scales: concentration up, time along. A falling curve with tangents at stated times and the gradient triangles; for first-order curves a series of equal half-lives marked; for zero order a straight line. |
| `rateConcentrationGraph` | Rate against concentration graphs (zero, first and second order) | chart | charts | B | checked | Three small graphs of rate against concentration: a horizontal line for zero order, a straight line through the origin for first order, and a curve rising faster than a straight line for second order, each labelled with its order. |
| `gibbsGraph` | Gibbs free energy change against temperature | chart | charts | C | checked | Axes: free energy change up (with zero marked), temperature in kelvin along. |
| `calorimetryCoolingGraph` | Temperature-time graph with extrapolation (calorimetry) | chart | charts | B | unverified | Axes with scales: temperature up, time along. |
| `phCurves` | pH curves for titrations (strong and weak acids and bases) | chart | charts | B | checked | Axes: pH (0 to 14) up the side, volume of added solution along the bottom. |
| `standardHydrogenElectrode` | Standard hydrogen electrode and half-cell diagrams | compound | cells | B | secondary | A glass jacket with a platinum electrode (platinised foil) dipping into a solution of 1.00 mol per dm3 hydrogen ions, hydrogen gas at 100 kPa bubbled in through a side tube and escaping from the top, connected through a salt ... |
| `electrodePotentialLadder` | Electrode potential series (vertical scale of standard potentials) | chart | charts | C | unverified | A vertical list of half-equations with their standard electrode potentials, the most negative at the top, with arrows for strongest reducing agent (top left) and strongest oxidising agent (bottom right). |

#### Inorganic chemistry (A-level) (12)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `periodicTrendsPeriod3` | Period 3 trends (atomic radius, first ionisation energy, melting point) | chart | charts | C | unverified | A line or bar graph with the elements sodium to argon along the bottom and one property up the side: atomic radius falling, first ionisation energy rising with dips at aluminium and sulfur, melting point rising to a peak at ... |
| `phosphorusSulfurMolecules` | Phosphorus (P4) and sulfur (S8) molecules | symbol | molecules | C | unverified | P4: four phosphorus atoms at the corners of a tetrahedron, six P-P bonds as solid lines with the hidden bond dashed. |
| `oxoacidStructures` | Oxoacids and oxoanions of phosphorus and sulfur (displayed formulae) | compound | molecules | B | checked | Displayed formulae with every bond: phosphoric(V) acid, sulfuric(IV) acid and sulfuric(VI) acid, each with P=O or S=O double bonds and O-H bonds, and the anions they form (phosphate, sulfite, sulfate) in square brackets with the ... |
| `p4o10Cage` | Phosphorus(V) oxide molecule (P4O10 cage) | symbol | molecules | C | unverified | A tetrahedron of four phosphorus atoms with an oxygen bridging each of the six edges and one more oxygen (double bonded) on each phosphorus, in the oblique projection. |
| `complexIonShapes` | Shapes of complex ions (octahedral, tetrahedral, square planar, linear) | symbol | molecules | B | checked | The metal ion at the centre, the ligands round it joined by lines, wedges and dashes, the whole inside square brackets with the overall charge outside. |
| `ligandStructures` | Ligands: monodentate, bidentate and EDTA (donor atoms marked) | compound | molecules | B | secondary | Displayed formulae of ligands with the lone pair on each donor atom drawn as a pair of dots or a lobe: water, ammonia, chloride, hydroxide; 1,2-diaminoethane (two nitrogens) and ethanedioate (two oxygens) as bidentate; EDTA4- ... |
| `complexIsomers` | Isomers of complex ions (cis-trans and optical) | compound | molecules | B | checked | Square planar cis- and trans-[Pt(NH3)2Cl2] (cisplatin and its isomer) drawn side by side. Octahedral cis- and trans-[Co(NH3)4Cl2]+ drawn with wedge and dash. |
| `dOrbitalSplitting` | d-orbital splitting in an octahedral or tetrahedral complex (colour) | symbol | energy | B | secondary | A vertical energy diagram: the five d orbitals as short lines at one level on the left (free ion), splitting on the right into two groups with a gap labelled the energy difference. |
| `colorimeterBlock` | Colorimeter (block diagram) and calibration graph | process | process | C | unverified | A light source, a filter of the complementary colour, a cuvette with the sample, a detector and a meter in a row, with arrows for the light beam. |
| `heterogeneousCatalysis` | Heterogeneous catalysis on a metal surface (adsorption, reaction, desorption) | compound | process | C | secondary | Three or four panels from left to right: reactant molecules approaching a row of metal atoms; the molecules adsorbed on the surface with their bonds weakened (dotted); the reaction on the surface; product molecules leaving the ... |
| `aquaIonReactionScheme` | Reaction scheme of aqua ions with hydroxide and ammonia | process | process | C | unverified | A branching scheme: the hexaaqua ion in the centre, an arrow with sodium hydroxide to the neutral hydroxide precipitate (colour and formula), a further arrow with excess hydroxide or ammonia to a dissolved complex (for aluminium, ... |
| `hexaaquaAcidity` | Why hexaaqua ions are acidic (polarised water ligand) | compound | molecules | C | unverified | An octahedral hexaaqua ion with one water ligand enlarged: the metal ion pulling electron density from the oxygen, the O-H bond polarised, and an arrow showing a hydrogen ion leaving to a free water molecule. |

#### Organic chemistry (A-level) (33)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `skeletalFormula` | Skeletal formula of an organic molecule | compound | molecules | B | checked | Zig-zag lines with a carbon at every corner and at the end of every line (the carbon is not labelled) and the hydrogens on carbon left out. |
| `structuralIsomers` | Structural isomers (chain, position and functional group) | compound | molecules | B | checked | A row of skeletal or displayed formulae that share one molecular formula, each with its name under it: for example butane and methylpropane (chain), pentan-1-ol and pentan-2-ol (position), ethanol and methoxymethane (functional ... |
| `ezIsomers` | E/Z isomers (cis and trans) | compound | molecules | B | checked | The two isomers of an alkene side by side as skeletal formulae with the double bond in the plane. The priority atoms on each carbon marked. |
| `opticalIsomers` | Optical isomers (enantiomers with wedge and dash bonds) | compound | molecules | B | checked | A carbon with four different groups: two bonds in the plane of the page, one wedge and one dash, the centre marked with a star. |
| `curlyArrow` | Curly arrow (movement of an electron pair, or of one electron) | symbol | mechanisms | B | checked | A curved line (one smooth curve) with a full arrowhead for a pair of electrons and a half arrowhead (fish-hook) for one electron. |
| `mechanismRadicalSubstitution` | Mechanism: free radical substitution (initiation, propagation, termination) | compound | mechanisms | B | checked | Three labelled groups of equations drawn with the structures: initiation (Cl-Cl splits into two chlorine radicals in ultraviolet light), propagation (a chlorine radical takes a hydrogen from methane to give HCl and a methyl ... |
| `mechanismElectrophilicAddition` | Mechanism: electrophilic addition to an alkene (via a carbocation) | compound | mechanisms | B | secondary | Step 1: the C=C of the alkene attacks the delta-plus hydrogen of H-Br with a curly arrow from the double bond, a second arrow from the H-Br bond to the bromine, giving a carbocation (positive charge on the carbon) and a bromide ... |
| `mechanismNucleophilicSubstitution` | Mechanism: nucleophilic substitution of a halogenoalkane (SN2 and SN1) | compound | mechanisms | B | checked | SN2 (primary): a curly arrow from the lone pair on the nucleophile (OH-, CN- or NH3) to the delta-plus carbon, a second arrow from the C-X bond to the halogen, with the transition state in square brackets (partial bonds dotted, a ... |
| `mechanismElimination` | Mechanism: elimination of hydrogen halide from a halogenoalkane | compound | mechanisms | B | checked | Three curly arrows on a halogenoalkane: from the lone pair of the hydroxide ion (acting as a base, in ethanolic solution) to a hydrogen on the carbon next to the C-X carbon; from that C-H bond to form the C=C; from the C-X bond ... |
| `mechanismCarbonylAddition` | Mechanism: nucleophilic addition to an aldehyde or ketone (cyanide, hydride) | compound | mechanisms | B | checked | The carbonyl group drawn with its polarity (delta-plus carbon, delta-minus oxygen). |
| `mechanismAdditionElimination` | Mechanism: nucleophilic addition-elimination (acyl chlorides) | compound | mechanisms | B | secondary | Step 1: a curly arrow from the nucleophile lone pair (water, an alcohol, ammonia or an amine) to the carbonyl carbon of the acyl chloride, a second arrow from the C=O pi bond to oxygen, giving a tetrahedral intermediate with O- ... |
| `mechanismElectrophilicSubstitution` | Mechanism: electrophilic substitution of benzene (nitration, acylation) | compound | mechanisms | B | checked | First the electrophile is made: NO2+ from concentrated nitric acid and concentrated sulfuric acid (equation), or the acylium ion from an acyl chloride and aluminium chloride. |
| `benzeneStructure` | Benzene: Kekule structure, delocalised ring and p-orbital overlap | compound | molecules | B | secondary | Three pictures: the Kekule hexagon with alternating double and single bonds; the delocalised ring (hexagon with a circle inside); and a side view of the planar carbon skeleton with six p orbitals as lobes above and below the ring ... |
| `benzeneEnthalpyLevels` | Enthalpy of hydrogenation levels: evidence for delocalisation in benzene | compound | energy | C | unverified | An energy-level diagram: cyclohexane at the bottom, benzene a little above the line predicted for three isolated double bonds, and cyclohexa-1,3,5-triene (hypothetical) higher still; arrows for the enthalpy changes of ... |
| `polyesterPolyamideRepeat` | Condensation polymers: polyester and polyamide repeat units (skeletal) | compound | molecules | B | checked | The two monomers as skeletal formulae, a reaction arrow, and the polymer chain with the repeat unit in square brackets, the ester or amide links circled, and water (or hydrogen chloride) shown as the small molecule lost. |
| `triglycerideSoap` | Triglyceride, soap and biodiesel | compound | molecules | C | secondary | A triglyceride as a glycerol backbone with three ester links to three long fatty acid chains (saturated or unsaturated, drawn as zig-zags). |
| `aminoAcidZwitterion` | Amino acid forms (zwitterion, cation, anion) and the peptide link | compound | biomolecules | B | secondary | A simple amino acid in three forms joined by arrows labelled with the pH: the cation at low pH (NH3+ and COOH), the zwitterion (NH3+ and COO-) at the isoelectric point, and the anion at high pH (NH2 and COO-). |
| `proteinStructure` | Protein structure (primary, secondary and tertiary) | compound | biomolecules | C | unverified | A chain of amino acid residues (primary), a helix and a pleated sheet with the hydrogen bonds between C=O and N-H groups as dotted lines (secondary), and a folded chain held by hydrogen bonds, ionic attractions and sulfur-sulfur ... |
| `dnaBasePairing` | DNA base pairs and the sugar-phosphate backbone (displayed) | compound | biomolecules | B | secondary | The four bases as skeletal formulae. Adenine and thymine side by side with two hydrogen bonds (dotted); guanine and cytosine with three. |
| `cisplatinDna` | Cisplatin binding to DNA | compound | biomolecules | C | secondary | Cisplatin (square planar platinum with two ammonia and two chloride ligands) with the two chloride ligands replaced by two nitrogen atoms of neighbouring guanine bases on one strand of DNA, which bends the double helix. |
| `enzymeActiveSite` | Enzyme active site and competitive inhibition | compound | biomolecules | C | unverified | An enzyme as a blob with a notch (the active site), a substrate with a matching shape fitting into it, the products leaving. |
| `synthesisRouteMap` | Multi-step organic synthesis route (reagents and conditions) | process | process | B | unverified | Boxes for compounds (names and skeletal formulae) joined by arrows, each arrow labelled above with the reagent and below with the conditions (for example reflux, ethanolic KOH, acidified dichromate). |
| `nmrProton` | Proton NMR spectrum (shift, splitting, integration) | chart | charts | B | checked | A spectrum drawn right to left with the chemical shift in ppm, the reference peak (TMS) at zero, and peaks as vertical lines or small groups of lines: singlets, doublets, triplets and quartets from the n plus 1 rule, with the ... |
| `nmrCarbon` | Carbon-13 NMR spectrum | chart | charts | B | checked | A spectrum with the chemical shift in ppm, TMS at zero, and one vertical line for each carbon environment. Groups of peaks such as C=O at 160 to 220 ppm and C-O at 50 to 90 ppm are labelled by region. |
| `infraredSpectrum` | Infrared spectrum (transmittance against wavenumber) | chart | charts | B | secondary | A spectrum with percentage transmittance up, wavenumber (cm-1) along from high to low, and downward troughs: a broad trough near 3300 for an alcohol O-H, a very broad trough from 2500 to 3300 for a carboxylic acid O-H, a sharp ... |
| `massSpectrumOrganic` | Mass spectrum of an organic compound (molecular ion and fragments) | chart | charts | B | secondary | A bar chart with m/z along the bottom and relative abundance up the side: a molecular ion peak at the relative molecular mass, a small M plus 1 peak, and fragment peaks at characteristic values (15 for CH3+, 29 for C2H5+, 43 for ... |
| `gasChromatographBlock` | Gas chromatograph and GC-MS (block diagram) | process | process | C | unverified | Boxes left to right: carrier gas cylinder, injector (sample in), a long coiled column inside an oven, a detector, and a recorder. |
| `gcTrace` | Gas chromatogram (retention times) | chart | charts | C | unverified | A trace with time along the bottom and detector response up the side: a baseline with peaks at different retention times, each labelled with its time, and an optional comparison with standards. |
| `columnChromatography` | Column chromatography apparatus | template | organicApparatus | B | unverified | A vertical column (a burette symbol) clamped upright, packed with silica gel (powder layer) with a layer of solvent above, a band of the sample at the top, and a separating funnel or dropper above supplying solvent. |
| `dehydrationEthanolApparatus` | Dehydration of ethanol to ethene (apparatus) | template | organicApparatus | B | unverified | The cracking apparatus layout: a boiling tube lying almost horizontal and clamped, with mineral wool soaked in ethanol at the closed end and aluminium oxide chips in the middle heated strongly, a delivery tube to a trough and an ... |
| `ethanolHydrationPlant` | Industrial hydration of ethene to ethanol (flow diagram) | process | process | C | unverified | Boxes and arrows: ethene and steam mixed, a reactor with a phosphoric acid catalyst on silica at about 300 degrees and 60 to 70 atmospheres, a condenser separating ethanol from unreacted ethene, and a recycle pipe returning the ... |
| `ozoneDepletionMechanism` | Ozone depletion by chlorine radicals (radical chain) | compound | mechanisms | C | unverified | A chain of steps with radical dots: ultraviolet light breaks a C-Cl bond in a chlorofluorocarbon, giving a chlorine radical; Cl plus ozone gives ClO and oxygen; ClO plus O gives chlorine radical and oxygen; the chlorine radical ... |
| `sigmaPiBonding` | Sigma and pi bonds (orbital overlap in ethene) | symbol | atoms | C | unverified | Two carbon atoms with the plane of the molecule marked. |

#### Required practicals (A-level) (15)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `standardSolutionPractical` | Making up a standard solution in a volumetric flask (practical 1) | covered | apparatus | B | checked | Covered by `standardSolution`. Use the standardSolution template: a volumetric flask with a filter funnel in its neck, a wash bottle and a beaker beside it, the solution below the graduation mark, and a label on the neck. |
| `enthalpyCombustionPractical` | Measuring an enthalpy change by calorimetry (practical 2) | covered | apparatus | B | checked | Covered by `spiritBurnerCalorimetry`. Use the spiritBurnerCalorimetry template for combustion: a metal can of water clamped above a spirit burner with a thermometer in the water. |
| `rateTemperaturePractical` | How the rate of a reaction changes with temperature (practical 3) | covered | apparatus | B | checked | Covered by `disappearingCross`. Use the disappearingCross template with a water bath: the flask on the cross paper, a thermometer in the mixture, and a beaker of warm water for the temperature control. |
| `ionTestsPractical` | Test-tube tests for cations and anions (practical 4) | covered | apparatus | B | checked | Covered by `testTubeReactions`. Use the testTubeReactions template with the tests in the list: Group 2 cations with sodium hydroxide and with sulfate, ammonium with sodium hydroxide and damp red litmus paper at the tube mouth, halide ions with silver nitrate ... |
| `distillationPractical` | Distillation of a product from a reaction (practical 5) | covered | apparatus | B | checked | Covered by `distillation`. Use the distillation template: a round-bottomed flask in a heating mantle, still head with a thermometer in an adaptor, a Liebig condenser sloping down with water in at the lower port, a receiver adaptor and a conical flask. |
| `organicTestsPractical` | Tests for alcohols, aldehydes, alkenes and carboxylic acids (practical 6) | covered | apparatus | B | checked | Covered by `testTubeReactions`. Use the testTubeReactions template, with a beaker of warm water for the aldehyde tests. |
| `rateMonitoringPractical` | Measuring rate by initial rate and by continuous monitoring (practical 7) | covered | apparatus | B | checked | Covered by `rateGasSyringe`. Use the rateGasSyringe template for volume against time, the massLoss template for mass against time, or the disappearingCross template for a clock reaction. |
| `emfPractical` | Measuring the EMF of an electrochemical cell (practical 8) | covered | apparatus | B | checked | Covered by `electrochemicalCell`. Use the electrochemicalCell template: two beakers with metal strips in their own solutions, a salt bridge (filter paper soaked in potassium nitrate) between them, and a high-resistance voltmeter joined to the two strips. |
| `phCurvePractical` | pH change in a titration with a pH meter (practical 9) | covered | apparatus | B | checked | Covered by `phCurve`. Use the phCurve template: a beaker on a hot plate with a stirrer bar, a pH probe in the solution wired to a pH meter, and a burette above. |
| `refluxPractical` | Heating under reflux (practical 10) | covered | apparatus | B | checked | Covered by `reflux`. Use the reflux template: a round-bottomed flask with anti-bumping granules in a heating mantle, an upright Liebig condenser with water in at the lower port and out at the upper port, a clamp at the flask neck. |
| `separatingFunnelPractical` | Separating and drying an organic liquid (practical 10) | covered | apparatus | B | checked | Covered by `separatingFunnelUse`. Use the separatingFunnelUse template: the funnel clamped upright with the stopper off, two layers labelled aqueous and organic, a beaker under the tap. |
| `buchnerPractical` | Filtration under reduced pressure and recrystallisation (practical 10) | covered | apparatus | B | checked | Covered by `buchnerFiltration`. Use the buchnerFiltration template: a Buchner funnel with filter paper in a one-hole bung on a Buchner flask, the side arm joined by thick rubber tube to a pump (label: to pump), the solid on the paper and the filtrate in the ... |
| `meltingPointPractical` | Measuring a melting point to test purity (practical 10) | covered | apparatus | B | checked | Covered by `meltingPoint`. Use the meltingPoint template: a melting point apparatus block with a thermometer and a capillary tube holding the solid, both in the holes of the heated block. |
| `transitionMetalIonsPractical` | Test-tube reactions of transition metal ions in solution (practical 11) | covered | apparatus | B | checked | Covered by `testTubeReactions`. Use the testTubeReactions template with tubes of aqueous ions and their products: copper(II) blue with a pale blue precipitate and a deep blue solution in excess ammonia, iron(II) pale green, iron(III) yellow-brown, chromium(III) ... |
| `tlcPractical` | Separating species by thin-layer chromatography (practical 12) | covered | apparatus | B | checked | Covered by `tlc`. Use the tlc template: a beaker with a little solvent, a plate leaning in it with the pencil start line above the solvent, a watch glass as a lid, and the developed spots and solvent front. |

### Biology (outline), KS4

#### Cell biology (7)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `bioCellDiagrams` | Animal, plant and algal cell diagrams (labelled) | symbol | bioCells | C | checked | Section drawings of an animal cell, a plant cell and an algal cell with nucleus, cytoplasm, membrane, mitochondria, ribosomes, and (plants) cell wall, vacuole and chloroplasts. |
| `bioBacterialCell` | Bacterial cell | symbol | bioCells | C | unverified | A rod-shaped cell with cell wall, membrane, cytoplasm, a loop of DNA, plasmids and a flagellum, with no nucleus. |
| `bioMicroscopeDrawing` | Labelled drawing of cells under the microscope with magnification | symbol | bioCells | C | checked | A clean outline drawing frame with a scale bar, a magnification label and label lines, for a student drawing of cells seen under a light microscope. |
| `bioMicroscopeParts` | Light microscope (parts) | covered | apparatus | C | checked | Covered by `microscopeParts`. The microscopeParts template: eyepiece, objective lenses, stage, mirror or lamp, focus wheels. |
| `bioMitosis` | Cell cycle and mitosis stages | compound | bioCells | C | unverified | A row of cells showing chromosomes copying, lining up, separating, and the cell dividing into two identical cells. |
| `bioTransportAcrossMembranes` | Diffusion, osmosis and active transport across a membrane | compound | bioCells | C | checked | A membrane with particles on both sides: arrows from high to low concentration (diffusion), water moving through a partially permeable membrane (osmosis), and a carrier using energy to move particles against the gradient. |
| `bioOsmosisPractical` | Osmosis in plant tissue (potato cylinders) | covered | apparatus | C | checked | Covered by `osmosis`. The osmosis template: potato cylinders in beakers of different sugar or salt solutions with a balance or ruler. |

#### Organisation (9)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `bioDigestiveSystem` | Human digestive system | symbol | bioOrgans | C | unverified | A body outline with mouth, oesophagus, stomach, liver, gall bladder, pancreas, small and large intestine, rectum and anus, labelled. |
| `bioHeartCirculation` | Heart and double circulation | compound | bioOrgans | C | unverified | A section of the heart with four chambers, valves and the four main vessels, and a loop diagram of blood going to the lungs and to the body. |
| `bioLungsGasExchange` | Lungs and an alveolus | symbol | bioOrgans | C | unverified | Trachea, bronchi, bronchioles and alveoli, and a close-up of an alveolus beside a capillary with arrows for oxygen and carbon dioxide. |
| `bioBloodCells` | Blood cells | symbol | bioOrgans | C | checked | Red blood cells (biconcave, no nucleus), a white blood cell with a nucleus, and platelets, labelled. |
| `bioBloodVessels` | Arteries, veins and capillaries | symbol | bioOrgans | C | unverified | Cross-sections of the three vessels showing wall thickness, lumen and valves. |
| `bioPlantTissues` | Leaf cross-section, stomata, xylem and phloem | symbol | bioOrgans | C | unverified | A leaf in section with epidermis, palisade and spongy layers, a stoma with guard cells, and a stem section with xylem and phloem. |
| `bioEnzymeModel` | Enzyme and substrate (lock and key) | compound | bioProcess | C | unverified | A substrate fitting the active site of an enzyme, the products leaving, and a denatured enzyme whose site no longer fits. |
| `bioFoodTestsPractical` | Food tests in a water bath | covered | apparatus | C | checked | Covered by `foodTestWaterBath`. The foodTestWaterBath template: boiling tubes of food samples with reagent in a beaker of hot water. |
| `bioEnzymePractical` | Effect of pH on amylase | covered | apparatus | C | checked | Covered by `enzymes`. The enzymes template: spotting tile with iodine drops and tubes of amylase, starch and buffer in a water bath. |

#### Infection and response (2)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `bioPathogenCells` | Virus, bacterium, fungus and protist | symbol | bioCells | C | unverified | Four simple drawings of a virus particle, a bacterial cell, a fungal hypha or yeast cell and a protist, labelled. |
| `bioImmuneResponse` | White blood cells and vaccination | process | bioProcess | C | unverified | Phagocytosis of a pathogen, antibodies binding antigens, and the vaccination sequence with memory cells. |

#### Bioenergetics (3)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `bioPhotosynthesisPractical` | Light intensity and the rate of photosynthesis | covered | apparatus | C | checked | Covered by `photosynthesis`. The photosynthesis template: pondweed in a beaker of water with a lamp at a measured distance and bubbles. |
| `bioEnergyFlow` | Photosynthesis and respiration (inputs and outputs) | process | bioProcess | C | unverified | Boxes and arrows linking light, carbon dioxide and water to glucose and oxygen, and glucose and oxygen back to carbon dioxide, water and energy. |
| `bioLimitingFactorsGraph` | Rate of photosynthesis against light, temperature or carbon dioxide | chart | charts | C | unverified | Curves that rise then level off, or rise then fall for temperature, with the limiting factor marked. |

#### Homeostasis and response (6)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `bioReflexArc` | Reflex arc and the nervous system pathway | compound | bioOrgans | C | unverified | Stimulus, receptor, sensory neurone, synapse, relay neurone, motor neurone, effector and response, with arrows along the path. |
| `bioEye` | The human eye (labelled structures) | symbol | bioOrgans | C | checked | A section of the eye with cornea, iris, pupil, lens, ciliary muscles, retina, optic nerve and sclera. |
| `bioKidneyNephron` | Kidney and nephron | compound | bioOrgans | C | unverified | A kidney section and a nephron with filtration, selective reabsorption and the collecting duct. |
| `bioNegativeFeedback` | Negative feedback loops (blood glucose, body temperature, thyroxine) | process | bioProcess | C | checked | A loop of boxes: stimulus, receptor, coordination centre, effector, response, and the return to the set level, with two such loops for blood glucose. |
| `bioEndocrineGlands` | Endocrine glands in the body | symbol | bioOrgans | C | unverified | A body outline with the pituitary, thyroid, pancreas, adrenals, ovaries and testes marked. |
| `bioMenstrualCycle` | Menstrual cycle hormone levels | chart | charts | C | unverified | Four hormone curves and the uterus lining against the 28 days. |

#### Inheritance, variation and evolution (4)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `bioPunnettSquare` | Punnett square (genetic cross) | symbol | bioGenetics | C | checked | A grid of the parents' gametes along the top and side, offspring genotypes in the cells, with ratios and probabilities below. |
| `bioPedigree` | Family tree (pedigree) for an inherited condition | symbol | bioGenetics | C | checked | Squares for males, circles for females, shaded for affected, joined by lines for partners and children. |
| `bioChromosomesMeiosis` | Chromosomes, genes, alleles and meiosis | compound | bioGenetics | C | unverified | A chromosome pair with alleles marked, and meiosis stages producing four different gametes. |
| `bioEvolutionTree` | Evolutionary tree, selective breeding and classification | process | bioProcess | C | unverified | A branching tree of species, a flow of selective breeding generations, and a classification ladder from kingdom to species. |

#### Ecology (5)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `bioFoodWeb` | Food chains and food webs with trophic levels | compound | bioEcology | C | checked | Organisms as labelled boxes or icons joined by arrows pointing from the food to the eater, with trophic levels marked. |
| `bioPyramidBiomass` | Pyramid of biomass or numbers | symbol | bioEcology | C | unverified | Horizontal bars stacked by trophic level, widths scaled to biomass, with the producer at the base. |
| `bioWaterCycle` | Water cycle | process | bioProcess | C | unverified | Evaporation, condensation, precipitation and run-off linking the sea, clouds and land. |
| `bioQuadratTransect` | Sampling with a quadrat and along a transect | covered | apparatus | C | checked | Covered by `quadratSampling`. The quadratSampling template; a transect adds a tape line across the habitat with quadrats at intervals. |
| `bioPredatorPreyGraph` | Predator-prey population graph | chart | charts | C | checked | Two cycling curves of population against time, the predator peak following the prey peak. |

### Physics (outline), KS4

#### Energy (5)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `physEnergyTransfer` | Energy transfer diagram (stores and pathways) | process | physEnergy | C | unverified | Boxes for energy stores joined by labelled arrows for the way energy is transferred (mechanically, electrically, by heating, by radiation). |
| `physSankey` | Sankey diagram | compound | physEnergy | C | unverified | An arrow from the energy input that splits into a useful output arrow and a wasted output arrow, widths in proportion to the energy. |
| `physHeatTransfer` | Conduction, convection and radiation diagrams | compound | physEnergy | C | unverified | A heated rod with vibrating particles, a convection current in a beaker with arrows, and radiation from a hot object. |
| `physSpecificHeatPractical` | Specific heat capacity (immersion heater and block) | covered | apparatus | C | unverified | Covered by `specificHeatCapacity`. The specificHeatCapacity template: an insulated metal block with an immersion heater and a thermometer. |
| `physInfraredPractical` | Infrared radiation from different surfaces | covered | apparatus | C | unverified | Covered by `infraredRadiation`. The infraredRadiation template: a Leslie cube and an infrared detector. |

#### Electricity (6)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `physCircuitDiagram` | Circuit diagrams (series and parallel) with standard symbols | covered | apparatus | C | checked | Covered by `resistorNetworks`. The resistorNetworks template and the circuit symbols: cells, switches, lamps, resistors, meters, joined by wires. |
| `physResistanceWirePractical` | Resistance of a wire | covered | apparatus | C | unverified | Covered by `resistanceWire`. The resistanceWire template: a wire on a ruler with an ammeter, a voltmeter and a cell. |
| `physIVPractical` | Current-voltage characteristic of a component | covered | apparatus | C | unverified | Covered by `ivCharacteristic`. The ivCharacteristic template: a component with a variable resistor, an ammeter and a voltmeter. |
| `physIVGraphs` | I-V graphs (resistor, filament lamp, diode) | chart | charts | C | unverified | Three small axes: a straight line through the origin, an S-shaped curve, and a diode curve that is flat for negative voltages. |
| `physPlugWiring` | Three-pin plug wiring | symbol | physCircuits | C | unverified | A plug opened up with live (brown), neutral (blue) and earth (green and yellow) wires, a fuse and the cable grip. |
| `physNationalGrid` | National Grid (power station to home) | process | physCircuits | C | unverified | A power station, step-up transformer, pylons, step-down transformer and homes in a line. |

#### Particle model of matter (3)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `physParticleModel` | Particle model of solids, liquids and gases | symbol | matter | C | checked | The chemistry particleStates symbol: three boxes of particles for solid, liquid and gas. |
| `physDensityPractical` | Density of a solid and a liquid | covered | apparatus | C | unverified | Covered by `densityDisplacement`. The densityDisplacement template (irregular solid in a displacement can) and densityLiquid for a measuring cylinder on a balance. |
| `physGasPressure` | Gas pressure: particles hitting the walls | compound | physParticles | C | unverified | A container with particles and arrows at the walls, shown at two volumes or temperatures. |

#### Atomic structure (3)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `physRadiationPenetration` | Penetration of alpha, beta and gamma radiation | compound | physNuclear | C | unverified | A source with three arrows stopped by paper, aluminium and lead. |
| `physHalfLifeGraph` | Radioactive decay curve and half-life | chart | charts | C | unverified | A falling curve of count rate against time with the half-lives marked. |
| `physFissionChain` | Nuclear fission chain reaction | compound | physNuclear | C | checked | A neutron striking a large nucleus that splits into two smaller nuclei and more neutrons, which go on to split further nuclei. |

#### Forces (9)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `physFreeBodyDiagram` | Free body diagram | symbol | physForces | C | checked | An object as a box with labelled arrows for weight, normal force, friction, drag or thrust. |
| `physVectorDrawing` | Scale drawing of vectors (resultant of two forces) | compound | physForces | C | checked | Two forces drawn nose to tail to a stated scale with the resultant drawn from the start to the end, and its length and angle measured. |
| `physMotionGraphs` | Distance-time and velocity-time graphs | chart | charts | C | checked | Axes with scales and lines for rest, constant speed, acceleration and terminal velocity. |
| `physSpringPractical` | Force and extension of a spring | covered | apparatus | C | unverified | Covered by `springExtension`. The springExtension template: a spring hanging from a clamp stand with masses and a ruler. |
| `physAccelerationPractical` | Force, mass and acceleration (trolley and light gates) | covered | apparatus | C | unverified | Covered by `acceleration`. The acceleration template: a trolley pulled by a hanging mass over a pulley, with light gates. |
| `physMomentumCollision` | Momentum before and after a collision | compound | physForces | C | unverified | Two trolleys with velocity arrows before and after a collision, masses labelled. |
| `physStoppingDistance` | Thinking and braking distance | compound | physForces | C | unverified | A bar split into thinking distance and braking distance, and a chart of how each changes with speed. |
| `physMoments` | Moments and levers | compound | physForces | C | unverified | A beam on a pivot with forces and distances, and a lever or gear train. |
| `physLiquidPressure` | Pressure in a liquid and upthrust | compound | physForces | C | unverified | A tank with arrows showing pressure on the walls increasing with depth, and an object with an upthrust arrow. |

#### Waves (6)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `physWaveDiagram` | Transverse and longitudinal waves (amplitude, wavelength, compressions) | symbol | physWaves | C | unverified | A sine wave with wavelength and amplitude marked, and a spring with compressions and rarefactions. |
| `physRippleTankPractical` | Waves in a ripple tank and on a string | covered | apparatus | C | unverified | Covered by `rippleTankWaves`. The rippleTankWaves template, or wavesOnString with a vibration generator. |
| `physRayReflection` | Ray diagram: reflection at a mirror or surface | compound | physWaves | C | checked | A plane mirror with the normal, an incident ray and a reflected ray, and the angles marked. |
| `physRayRefraction` | Ray diagram: refraction at a boundary and wavefronts | compound | physWaves | C | checked | A glass block with the normal, a ray bending towards the normal on entering and away on leaving, and a wavefront picture of the change in speed. |
| `physLensRays` | Ray diagrams for convex and concave lenses (image formation) | compound | physWaves | C | checked | A lens with the principal axis, focal points, three construction rays and the image drawn at the meeting point, for an object inside and outside the focal length. |
| `physEmSpectrum` | Electromagnetic spectrum (bands in order) | chart | charts | C | unverified | A row of bands from radio waves to gamma rays, with wavelength and frequency arrows. |

#### Magnetism and electromagnetism (3)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `physMagneticFields` | Magnetic field lines (bar magnet, wire, solenoid) | symbol | physFields | C | checked | Field lines from north to south round a bar magnet, circles round a straight current-carrying wire, and parallel lines inside a solenoid, with direction arrows. |
| `physMotorEffect` | Motor effect and the d.c. motor | compound | physFields | C | checked | A wire between two magnet poles with the directions of the field, current and force, and a coil with a commutator and brushes. |
| `physGeneratorTransformer` | Generator and transformer | compound | physFields | C | checked | An alternator with a rotating coil and slip rings, and a transformer with primary and secondary coils on an iron core. |

#### Space physics (2)

| Row | Name | Kind | Pack | Pri | Confidence | What it draws |
| --- | --- | --- | --- | --- | --- | --- |
| `physOrbits` | Orbits of planets, moons and satellites | compound | physSpace | C | unverified | A planet orbiting the Sun in a near-circular path with arrows for the velocity and the gravitational force towards the centre. |
| `physStarLifeCycle` | Life cycle of a star (a Sun-like star and a massive star) | process | physSpace | C | unverified | Boxes and arrows from a nebula to a protostar and main-sequence star, then red giant and white dwarf for a Sun-like star, or red supergiant, supernova and neutron star or black hole for a massive one. |


## Build order

### How the order was chosen

1. Do the rows that need no new symbol first. A template row is a recipe from symbols that exist. It costs a recipe and a review, and it brings A-priority rows at once (gas tests, the carbonate test, the simple cell, the rusting tubes).
2. Build the shared engines in the order the lessons need them. Six engines serve most rows: the atom-and-electron drawing (shells, electron marks, brackets and charges); the particle box; the molecule drawing from a list of atoms and bonds (displayed formula, ball and stick, and later skeletal and 3D shape); the oblique projection for 3D structures; the box-and-arrow layout for flow diagrams and cycles; and the energy diagram (levels, arrows and curves).
3. KS4 before KS5, A before B, chemistry before biology and physics. A KS5 row is B at most, so inside a pack the KS4 rows come first.
4. Every picture gets a reviewer who is not the author, as in `docs/process/README.md`. A pack with a hard drawing (the C60 ball, the sodium chloride cube, the nanotube) starts with a pilot sheet that James looks at before the rest is drawn.

### The order

| Step | What | Rows | A | B | C | What it draws | Why here |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Covered rows (54) | 54 | 17 | 22 | 15 | The required practicals and set-ups that the 123 symbols and 43 templates already draw. | Now. No code: check the recipe once for each row. |
| 1 | New templates: `labTemplates`, `organicApparatus` (KS4) | 14 | 4 | 10 | 0 | Gas tests, carbonate test, simple cell, rusting tubes, conductivity test, gas collection, molten electrolysis, cracking, laboratory fractional distillation, fermentation, magnesium in a crucible, Group 1 and water. | No new symbol. It brings four A rows, and it tests the process for new packs. Needs a nail symbol and two presets. |
| 2 | `atoms` (KS4) and four small symbols | 12 | 8 | 4 | 0 | Bohr atoms and ions, nuclide notation, models of the atom, alpha scattering, isotopes, the periodic table; the reaction profile, the pH strip, flame colours, hazard symbols, formula triangles. | Every KS4 course starts here. It builds the electron-mark engine that bonding reuses. The reaction profile and the pH strip are cheap A rows. |
| 3 | `bonding` (KS4) | 2 | 2 | 0 | 0 | Dot-and-cross diagrams of ionic compounds and of simple molecules. | An exam staple. It uses the electron engine from step 2. |
| 4 | `matter` (KS4) | 9 | 4 | 5 | 0 | The particle box: states of matter, element or compound or mixture, changes of state, ionic conduction, concentration, strong and weak acids, collision theory, equilibrium, surface area cubes. | One engine, nine rows. Physics (the particle model) and biology (diffusion, osmosis) reuse it. |
| 5 | `molecules` (KS4) | 13 | 7 | 5 | 1 | Displayed formulae, ball-and-stick and space-filling models, balanced equations drawn with models, alkene reactions, addition and condensation polymers, amino acids, cracking. | One molecule engine from a list of atoms and bonds. All of the organic work, and the KS5 skeletal formulae, rest on it. |
| 6 | `structures` (KS4) | 14 | 7 | 6 | 1 | Ionic lattices in 2D and 3D, metallic bonding, alloys, diamond, graphite, graphene, C60, nanotube, silica, polymer chains, forces between small molecules, sacrificial protection. | The hardest drawing. It needs the 3D decision (decision 3). Start with a pilot sheet of three pictures. |
| 7 | `process` and `cells` (KS4), and the bond energy diagram | 22 | 8 | 9 | 5 | Fractionating tower, greenhouse effect, water and sewage treatment, Haber process, blast furnace; the electrolysis cell with ions, the aluminium cell, the fuel cell, copper refining. | A box-and-arrow layout engine; the cells build on the electrolysis symbols that exist. Five A rows. |
| 8 | KS5 physical and inorganic chemistry | 27 | 0 | 18 | 9 | Hess and Born-Haber cycles, d-orbital splitting, electron boxes, shapes of molecules and ions, polarity, intermolecular forces, ice, iodine and magnesium lattices, complexes and their isomers, the mass spectrometer. | After the KS4 packs have passed review. Needs the wedge and dash bond from step 6. |
| 9 | KS5 organic chemistry, and `biomolecules` | 30 | 0 | 20 | 10 | Skeletal formulae, isomers, the curly arrow and seven mechanisms, amino acids, DNA, proteins, benzene, polymers, column chromatography. | The biggest new capability. It conflicts with section 4 of the specification, so wait for decision 2. |
| 10 | Biology and physics outline packs | 51 | 0 | 0 | 51 | Cell and organ diagrams, Punnett squares, food webs; free body diagrams, ray diagrams, field lines, waves, the star life cycle. | After the chemistry packs. Some rows are free (the physics particle model is the chemistry particle box). |
| 11 | Charts | 39 | 3 | 18 | 18 | Graphs, tables and spectra. | Only if decision 1 brings them into scope. |

### What each pack would draw

| Pack | Subject | Rows | A | B | C | KS4 | KS5 | Examples |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| atoms | chemistry | 10 | 6 | 2 | 2 | 7 | 3 | `alphaScattering`, `atomModels`, `bohrAtom`, `ionShell` |
| bonding | chemistry | 3 | 2 | 1 | 0 | 2 | 1 | `covalentDotCross`, `ionicDotCross`, `covalentDotCrossAdvanced` |
| matter | chemistry and physics | 10 | 4 | 5 | 1 | 10 | 0 | `changeOfState`, `collisionTheoryParticles`, `particleElementCompoundMixture`, `particleStates` |
| molecules | chemistry | 30 | 7 | 18 | 5 | 13 | 17 | `additionPolymerisation`, `alkeneAdditionReactions`, `balancedEquationModels`, `ballAndStickModel` |
| structures | chemistry | 17 | 7 | 9 | 1 | 14 | 3 | `alloyStructure`, `diamondStructure`, `fullereneC60`, `grapheneSheet` |
| energy | chemistry | 9 | 1 | 5 | 3 | 2 | 7 | `reactionProfile`, `bondEnergyDiagram`, `bornHaberCycle`, `dOrbitalSplitting` |
| process | chemistry | 24 | 5 | 9 | 10 | 17 | 7 | `crudeOilFractionatingTower`, `greenhouseEffect`, `haberProcess`, `potableWaterTreatment` |
| cells | chemistry | 5 | 3 | 2 | 0 | 4 | 1 | `aluminiumExtractionCell`, `electrolysisIons`, `fuelCell`, `copperRefining` |
| analysis | chemistry | 2 | 1 | 1 | 0 | 2 | 0 | `pHScale`, `flameColours` |
| annotation | chemistry | 2 | 0 | 2 | 0 | 2 | 0 | `formulaTriangle`, `hazardSymbols` |
| biomolecules | chemistry | 7 | 0 | 3 | 4 | 2 | 5 | `aminoAcidZwitterion`, `dnaBasePairing`, `dnaStructure`, `cisplatinDna` |
| mechanisms | chemistry | 9 | 0 | 8 | 1 | 0 | 9 | `curlyArrow`, `mechanismAdditionElimination`, `mechanismCarbonylAddition`, `mechanismElectrophilicAddition` |
| labTemplates | chemistry | 10 | 4 | 6 | 0 | 10 | 0 | `carbonateTest`, `gasTests`, `rustingTubes`, `simpleCell` |
| organicApparatus | chemistry | 6 | 0 | 6 | 0 | 4 | 2 | `columnChromatography`, `combustionProductsApparatus`, `crackingApparatus`, `dehydrationEthanolApparatus` |
| charts | chemistry and biology and physics | 39 | 3 | 18 | 18 | 24 | 15 | `heatingCurve`, `rateGraph`, `reactivitySeriesList`, `atmosphereComposition` |
| apparatus | chemistry and biology and physics | 54 | 17 | 22 | 15 | 39 | 15 | `alkeneBromineTest`, `chromatogramRf`, `chromatographyApparatus`, `electrolysisPetriLid` |
| bioCells | biology | 6 | 0 | 0 | 6 | 6 | 0 | `bioBacterialCell`, `bioCellDiagrams`, `bioMicroscopeDrawing`, `bioMitosis` |
| bioEcology | biology | 2 | 0 | 0 | 2 | 2 | 0 | `bioFoodWeb`, `bioPyramidBiomass` |
| bioGenetics | biology | 3 | 0 | 0 | 3 | 3 | 0 | `bioChromosomesMeiosis`, `bioPedigree`, `bioPunnettSquare` |
| bioOrgans | biology | 10 | 0 | 0 | 10 | 10 | 0 | `bioBloodCells`, `bioBloodVessels`, `bioDigestiveSystem`, `bioEndocrineGlands` |
| bioProcess | biology | 6 | 0 | 0 | 6 | 6 | 0 | `bioEnergyFlow`, `bioEnzymeModel`, `bioEvolutionTree`, `bioImmuneResponse` |
| physCircuits | physics | 2 | 0 | 0 | 2 | 2 | 0 | `physNationalGrid`, `physPlugWiring` |
| physEnergy | physics | 3 | 0 | 0 | 3 | 3 | 0 | `physEnergyTransfer`, `physHeatTransfer`, `physSankey` |
| physFields | physics | 3 | 0 | 0 | 3 | 3 | 0 | `physGeneratorTransformer`, `physMagneticFields`, `physMotorEffect` |
| physForces | physics | 6 | 0 | 0 | 6 | 6 | 0 | `physFreeBodyDiagram`, `physLiquidPressure`, `physMoments`, `physMomentumCollision` |
| physNuclear | physics | 2 | 0 | 0 | 2 | 2 | 0 | `physFissionChain`, `physRadiationPenetration` |
| physParticles | physics | 1 | 0 | 0 | 1 | 1 | 0 | `physGasPressure` |
| physSpace | physics | 2 | 0 | 0 | 2 | 2 | 0 | `physOrbits`, `physStarLifeCycle` |
| physWaves | physics | 4 | 0 | 0 | 4 | 4 | 0 | `physLensRays`, `physRayReflection`, `physRayRefraction`, `physWaveDiagram` |

### Small additions to existing symbols

These are not packs. They are small changes that several rows need.

- A nail (or a plain metal rod) symbol, for the rusting tubes and the displacement tubes.
- Contents presets: a copper deposit (pink-brown powder) and a pale green precipitate (iron(II) hydroxide).
- A flame tint parameter on `flame` and `bunsenBurner`, for the five flame test colours.
- Text with stacked indices at the left of a symbol, for nuclide notation (mass number over atomic number). The label markup has no such form.
- For KS5: a curved arrow connector (the curly arrow) and a wedge and dash bond style. The specification lists four connector kinds and none is curved.
- For the physics outline: the Later symbols `rayBox`, `glassBlock`, `convexLens` and `planeMirror`. For biology: `viskingTubing`, `potometer`, `forceps` and `scalpel`.

## Decisions for James

Nine decisions, in the order I think they matter. The first five decide how large the work is.

**1. Graphs, tables and spectra: outside PracDraw?** 39 rows are charts (32 in chemistry). Of the chemistry charts, 21 are priority A or B, which here means "teachers and examiners use them often", not "build first". Options: (a) leave all charts out, and teachers use a spreadsheet; (b) allow sketch graphs with no data as symbols, for the dozen or so shapes that a student draws freehand (the rate curve, heating curve, Maxwell-Boltzmann curve, pH curve, concentration-time curve); (c) build a data chart tool. My recommendation: (a) for the first packs, then (b) for about a dozen sketch shapes once the particle and molecule packs are reviewed. The reaction profile is a symbol already, because it has no data axis.

**2. KS5 skeletal formulae and mechanisms: now or later?** 21 A-level organic rows depend on a skeletal-formula drawing, on curly arrows or on both, and section 4 of the specification lists skeletal formulae as out of scope. My recommendation is later, after the KS4 packs. To keep the door open, build the KS4 molecule drawing (step 5) as a list of atoms and bonds, so that a skeletal drawing is a second way to draw the same data.

**3. The style of 3D structures in a 2D line drawing.** 18 rows are three-dimensional: diamond, graphite, the sodium chloride cube, C60, the nanotube, ice, iodine, the shapes of molecules, complex ions and others. Options: an oblique projection (the front face square, the back face shifted up and to the right at half size, hidden lines dashed); an isometric view; or flat 2D networks only. My recommendation is one oblique projection for every lattice and wedge-and-dash bonds for molecules. Before the structures pack is built, have three pilot sheets drawn for James to look at: the sodium chloride cube, a diamond cluster and graphite layers.

**4. Dot-and-cross marks.** The specification limits the examples to Group 1 and 2 metals with Group 6 and 7 non-metals, and to eight named molecules. Decide whether every picture uses dots for one atom and crosses for the other (the usual school convention, as revision sites describe it), whether the teacher can choose the marks, and what a photocopy-safe picture uses instead. Always: outer shell only, brackets and a charge on ions, and every lone pair drawn. I could not read an AQA mark scheme for the exact conventions, so check one before the pack is reviewed.

**5. Which course first?** 97 rows apply to Trilogy (8464). 32 rows are chemistry only (8462 but not 8464), among them the simple cell and fuel cell, the alkene reactions, polymers and DNA, the tests for ions, waste water treatment, phytomining and bioleaching, corrosion, the Haber process and NPK fertilisers. If the first users teach Trilogy, those rows move to the end of their packs.

**6. Colour and fill for particles under the black-line rule (S6).** Particles and balls are told apart by size and by a white, hatched or grey fill, with a key, not by colour. Hazard symbols have a red border in real life and would be a plain black outline here. Confirm, or allow a colour mode for slides.

**7. The periodic table is a symbol, not a chart.** It is a table, but a fixed grid of 118 cells with highlight parameters. I classed it as a symbol so that it is built early. Confirm, and say whether the first version can stop at element 36.

**8. New template files.** Step 1 adds about 14 templates in two new groups (`labTemplates` and `organicApparatus`). The template author brief covers one group file at a time, so say whether they go in one file or two.

**9. Biology and physics: when?** The outline has 73 rows, none above priority C. Some are free (the physics particle model is the chemistry particle box). The rest need the shared engines and some Later symbols. My recommendation is to start them after the KS4 chemistry packs have passed review.

## Rows to check against the AQA PDF

Because the PDF could not be opened, the first job for a person with access is to check the rows below against the specification PDF and a recent paper. They are the rows with the highest priority and the lowest confidence. The table gives the AQA topic to look under.

### Priority A rows that are not `checked`

| Row | Name | Confidence | Course | Look under | What to confirm |
| --- | --- | --- | --- | --- | --- |
| `particleElementCompoundMixture` | Particle diagram of an element, a compound or a mixture | secondary | 8464, 8462 | Atomic structure and the periodic table (8462 4.1.1.1) | Do papers draw particle pictures of elements, compounds and mixtures (4.1.1.1 and the next section)? |
| `alphaScattering` | Alpha-particle scattering experiment | secondary | 8464, 8462 | Atomic structure and the periodic table (8462 4.1.1.3) | Does the specification or a paper show the scattering experiment, or only ask students to explain it? |
| `ionShell` | Electron arrangement of an ion (shell diagram in brackets) | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.1.2) | Do papers expect the bracketed shell diagram of an ion with its charge? |
| `nuclideNotation` | Nuclear (isotope) notation with mass number and atomic number | secondary | 8464, 8462 | Atomic structure and the periodic table (8462 4.1.1.5) | The notation printed in 4.1.1.5 (mass number over atomic number). |
| `particleStates` | Particle diagrams of a solid, a liquid and a gas | secondary | 8464, 8462 | Bonding, structure and the properties of matter | The states-of-matter pictures and the limitations of the model. |
| `changeOfState` | Changes of state (melting, freezing, boiling, condensing, sublimation) | secondary | 8464, 8462 | Bonding, structure and the properties of matter | Is a changes-of-state diagram drawn, or are only the terms used? |
| `heatingCurve` | Heating and cooling curve of a pure substance | unverified | 8464, 8462 | Bonding, structure and the properties of matter | Do papers on states of matter use heating or cooling curves? |
| `alloyStructure` | Alloy and pure metal layers (why alloys are harder) | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.2.7) | The alloy layers picture in the section on metals and alloys. |
| `diamondStructure` | Diamond (giant covalent, tetrahedral) | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.3) | Do papers show the carbon structures, or ask only for properties? |
| `graphiteStructure` | Graphite (layers of hexagons) | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.3) | Do papers show the carbon structures, or ask only for properties? |
| `grapheneSheet` | Graphene (one layer of hexagons) | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.3) | Do papers show graphene and fullerenes for recognition (4.2.3)? |
| `fullereneC60` | Buckminsterfullerene C60 | secondary | 8464, 8462 | Bonding, structure and the properties of matter (8462 4.2.3) | Do papers show graphene and fullerenes for recognition (4.2.3)? |
| `balancedEquationModels` | A balanced equation drawn with particle models | secondary | 8464, 8462 | Quantitative chemistry | Do papers draw balanced equations with particle models? |
| `reactivitySeriesList` | Reactivity series (ordered list with carbon and hydrogen) | secondary | 8464, 8462 | Chemical changes | The reactivity series as printed in the specification, with carbon and hydrogen in place. |
| `metalsAcidTubes` | Metals in dilute acid in test tubes (rate of bubbling) | secondary | 8464, 8462 | Chemical changes | Do papers show test tubes, or only tables of observations? |
| `metalDisplacementTubes` | Displacement of a metal from a salt solution | secondary | 8464, 8462 | Chemical changes | Do papers show test tubes, or only tables of observations? |
| `pHScale` | pH scale with universal indicator colours | secondary | 8464, 8462 | Chemical changes | The pH colour bands the specification and papers use. |
| `electrolysisIons` | Electrolysis cell with the movement of ions | secondary | 8464, 8462 | Chemical changes (8462 4.4.3.1, 8462 4.4.3.2, 8462 4.4.3.4) | Is a cell with moving ions drawn in papers (4.4.3.1 to 4.4.3.4)? |
| `aluminiumExtractionCell` | Electrolysis cell for the extraction of aluminium | secondary | 8464, 8462 | Chemical changes (8462 4.4.3.3) | The aluminium cell figure in papers on 4.4.3.3. |
| `fuelCell` | Hydrogen fuel cell | secondary | 8462 | Energy changes (8462 4.5.2.2) | The fuel cell diagram in papers on 4.5.2.2, and the half-equation forms. |
| `collisionTheoryParticles` | Collision theory: particle pictures for concentration, temperature and surface area | secondary | 8464, 8462 | The rate and extent of chemical change | Do papers use particle collision pictures for the rate factors? |
| `alkeneBromineTest` | Bromine water test for an alkene | secondary | 8464, 8462 | Organic chemistry | Is the bromine water test drawn in test tubes or only described? |
| `hydroxideTubes` | Metal hydroxide precipitates with sodium hydroxide solution | unverified | 8462 | Chemical analysis | The metal hydroxide precipitate colours in 4.8.3. |
| `greenhouseEffect` | The greenhouse effect | secondary | 8464, 8462 | Chemistry of the atmosphere (8462 4.9.2) | The greenhouse effect diagram, and what the incoming radiation is called. |
| `wasteWaterTreatment` | Treatment of waste water (sewage) | secondary | 8462 | Using resources (8462 4.10.1.3) | The sewage treatment flow chart in 4.10.1.3. |
| `rustingTubes` | Rusting experiment (nails in test tubes) | secondary | 8462 | Using resources | The rusting tubes: what is in each tube, and whether papers draw them. |

### Priority B chemistry rows that are `unverified`

| Row | Name | Confidence | Course | Look under | What to confirm |
| --- | --- | --- | --- | --- | --- |
| `limitingReactantModels` | Limiting reactant shown with particle models (before and after) | unverified | 8464, 8462 | Quantitative chemistry | Do papers use particle pictures for a limiting reactant? |
| `temperatureTimeGraph` | Temperature against time or volume for a reaction | unverified | 8464, 8462 | Energy changes | The graph asked for in the temperature change practical. |
| `reversibleHeatingTube` | Heating hydrated copper sulfate (a reversible reaction) | unverified | 8464, 8462 | The rate and extent of chemical change | Which reversible reaction the specification names for practical work. |
| `fermentationApparatus` | Fermentation of a sugar solution (apparatus) | unverified | 8462 | Organic chemistry | The fermentation conditions, and whether any apparatus figure is printed. |
| `combustionProductsApparatus` | Testing the products of burning a hydrocarbon fuel | unverified | 8464, 8462 | Organic chemistry | Whether papers draw apparatus for the products of burning a fuel. |
| `hazardSymbols` | Hazard symbols (the nine GHS pictograms) | unverified | 8464, 8462 | Working scientifically and practical skills | Whether students draw or only identify hazard symbols. |
| `reactionProfileMultiStep` | Reaction profile with an intermediate and a rate-determining step | unverified | 7405 | Physical chemistry (A-level) | A-level: two-step profiles and the rate-determining step. |
| `calorimetryCoolingGraph` | Temperature-time graph with extrapolation (calorimetry) | unverified | 7405 | Physical chemistry (A-level) | A-level practical 2: the extrapolation graph. |
| `synthesisRouteMap` | Multi-step organic synthesis route (reagents and conditions) | unverified | 7405 | Organic chemistry (A-level) | A-level section 3.3.14: how routes are drawn. |
| `columnChromatography` | Column chromatography apparatus | unverified | 7405 | Organic chemistry (A-level) (7405 3.3.16) | A-level section 3.3.16: whether the column apparatus is drawn. |
| `dehydrationEthanolApparatus` | Dehydration of ethanol to ethene (apparatus) | unverified | 7405 | Organic chemistry (A-level) | A-level section 3.3.5: the dehydration apparatus. |
| `fractionalDistillationLab` | Fractional distillation in the laboratory (ethanol and water) | unverified | 8464, 8462 | Organic chemistry | Whether laboratory fractional distillation is named for GCSE. |
| `formulaTriangle` | Formula triangle (moles, concentration and similar) | unverified | 8464, 8462 | Quantitative chemistry | Not in the specification: a classroom aid. Nothing to check. |
| `gasCollectionMethods` | Collecting a gas: over water, upward delivery, downward delivery and gas syringe | unverified | 8464, 8462 | Chemical analysis | Which gas collection methods papers draw. |
| `conductivityTest` | Testing whether a substance conducts electricity | unverified | 8464, 8462 | Bonding, structure and the properties of matter | Whether the conductivity apparatus is drawn for ionic compounds. |

### Checks that apply to many rows

- **Course tags.** Which topics are chemistry only: nanoparticles (4.2.4, the sizes and surface-area rows), transition metals, yield and atom economy, chemical cells and fuel cells (4.5.2), alkenes and alcohols (4.7.2), polymers and DNA (4.7.3), the tests for ions (4.8.3), waste water and alternative extraction of metals, using materials (4.10.3) and the Haber process (4.10.4). The summaries confirmed 4.1.3, 4.7.2, 4.7.3, 4.8.3, 4.10.3 and 4.10.4; I took the rest from memory.
- **The metal hydroxide colours** (4.8.3): blue copper(II), green iron(II), brown iron(III), white aluminium, calcium and magnesium. The summary did not retrieve them.
- **The eight dot-and-cross molecules** in 4.2.1.4 (hydrogen, chlorine, oxygen, nitrogen, hydrogen chloride, water, ammonia, methane). The extra molecules in the row are my additions.
- **Whether AQA prints a figure** for the aluminium cell, the hydrogen fuel cell, the waste water treatment and the life cycle assessment. The AQA text names the topic and the steps; the pictures here are the usual teaching ones.
- **A-level 7405:** whether orbital box diagrams and orbital shapes are required (3.1.1.3), the wording of 3.3.5 (alcohols), 3.3.14 (synthesis) and 3.3.13 (proteins and DNA), and the Born-Haber and Hess detail in 3.1.4 and 3.1.8, which the summaries gave only in outline.
- **Trilogy practical numbers.** Trilogy practicals 8 to 13 are the chemistry ones; the numbers in the repository's template list match what the AQA summaries gave for 8 to 13.

## How this was made

I read the spec pages through the search tool one section at a time (8462 sections 4.1 to 4.10, 7405 sections 3.1 to 3.3 and the twelve practicals, the 8461 and 8463 sections for the outline), then the question papers and reports it named, then revision sites for the diagrams AQA's text only names. Rows were written in parts and merged by a script outside the project, which also checks the rules the test checks. Every source address in the file is one that the search tool returned.
