// gen-inventory.ts — the tables and the numbers of docs/diagram-inventory.md. Run: npm run gen:inventory
// They are written from the rows of spec/diagrams.json (and from spec/catalogue.json, spec/templates.json and the library packs), so
// that the document cannot drift from the file. Generated text sits between `<!-- gen:KEY -->` and `<!-- /gen -->`: a block on its own
// lines (a table), or a number inside a sentence (`<!-- gen:n.total -->287<!-- /gen -->`). Everything else in the document is
// written by hand and is never touched. A unit test (src/diagrams.test.ts) regenerates the document in memory and compares it byte
// for byte with the file, and fails when a number about the rows is typed by hand.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PACKS } from '../src/editor/search.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const DOC_FILE = resolve(ROOT, 'docs', 'diagram-inventory.md')

export interface Row {
  id: string
  name: string
  subject: string
  level: string
  courses: string[]
  specRefs: string[]
  topic: string
  kind: string
  covered: string | null
  proposedPack: string
  priority: string
  detail: string
  draw: string
  params: string
  scienceChecks: string
  sources: string[]
  confidence: string
  notes: string
  tags?: string[]
}

/** What the document is made from. */
export interface Data {
  rows: Row[]
  /** The ids of the symbols of spec/catalogue.json, of its Later table, and of the templates of spec/templates.json. */
  symbols: string[]
  later: string[]
  templates: string[]
  /** The ids of the library packs in src/editor/search.ts. */
  packIds: string[]
}

/** The tags a row may carry, in the order they are listed, with what each marks. */
export const TAG_MEANING: Record<string, string> = {
  skeletal: 'Needs a skeletal-formula drawing (a zig-zag line formula).',
  curlyArrow: 'Needs the curly (curved) arrow, a new kind of connector in the editor.',
  mechanism: 'Is a reaction mechanism: steps that show where the electrons move.',
  wedge: 'Needs the wedge and dash bond, to show a three-dimensional shape in a flat formula.',
  '3d': 'Needs a three-dimensional structure drawn in an oblique projection.',
  dotCross: 'Draws the electrons of two atoms with different marks (dots and crosses).',
  fill: 'Needs a grey tint or a hatch fill to tell particles, atoms or regions apart.',
  symbolText: 'Puts element symbols, charges or numbers inside a symbol, which rule S11 does not allow.',
  hazard: 'Is the hazard symbols row, whose real red border breaks rule S6.',
}
export const TAGS = Object.keys(TAG_MEANING)

const KIND_ORDER = ['symbol', 'compound', 'template', 'process', 'chart', 'covered']
const KIND_MEANING: Record<string, string> = {
  symbol: 'a new parametric symbol: one drawing made from parameters',
  compound: 'a diagram of several new symbols and connectors, built from a recipe',
  template: 'an apparatus set-up that is a recipe from symbols that exist (a new template; the small additions are listed under Build order)',
  process: 'a flow, cycle or tower diagram',
  chart: 'a graph, table or spectrum (outside PracDraw unless James decides)',
  covered: 'an existing symbol or template already draws it (the row names it)',
}
const NEW_CODE = ['symbol', 'compound', 'template', 'process']
const SUBJECT_ORDER = ['chemistry', 'biology', 'physics']
const LEVEL_ORDER = ['KS4', 'KS5']
const PRIORITY_ORDER = ['A', 'B', 'C']
const CONFIDENCE_ORDER = ['checked', 'secondary', 'unverified']
const PACK_ORDER = [
  'atoms',
  'matter',
  'molecules',
  'structures',
  'energy',
  'flow',
  'plants',
  'scenes',
  'electrochemistry',
  'annotation',
  'biomolecules',
  'mechanisms',
  'labTemplates',
  'organicApparatus',
  'biology',
  'physics',
  'charts',
  'apparatus',
]
const SUBJECT_TITLE: Record<string, string> = { chemistry: 'Chemistry', biology: 'Biology (outline)', physics: 'Physics (outline)' }

/** The note that marks a row that lessons use and the AQA specification does not name (see the decision about these rows). */
export const KEPT_NOTE = 'Not named in the AQA specification; kept because lessons use it.'
/** The note that marks a hard row whose geometry the lead must settle before the pack is built. */
export const BRIEF_NOTE = 'Needs a geometry brief before it is built.'

// ---------- small helpers ----------

const count = (rows: Row[], f: (r: Row) => boolean): number => rows.filter(f).length
const lt = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
/** A table cell: no pipes, no line breaks. */
const cell = (s: string): string => s.replace(/\|/g, '/').replace(/\s+/g, ' ').trim()
const table = (head: string[], rows: string[][]): string =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n')
const ids = (rows: Row[]): string => rows.map((r) => `\`${r.id}\``).join(', ')
const tally = (rows: Row[], key: (r: Row) => string): Map<string, number> => {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1)
  return m
}
/** The first sentences of a description, up to about 110 characters, cut at a word when one is very long. */
function firstSentence(s: string, max = 230): string {
  const parts = s.split(/(?<=[.!?])\s/)
  let out = parts[0]
  for (let i = 1; i < parts.length && out.length < 110 && `${out} ${parts[i]}`.length <= max; i++) out += ` ${parts[i]}`
  if (out.length <= max) return out
  const cut = out.slice(0, max)
  return `${cut.slice(0, cut.lastIndexOf(' '))} ...`
}
const isAqa = (url: string): boolean => /^https:\/\/([a-z]+\.)*aqa\.org\.uk\//.test(url)
const thousands = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// ---------- the build order ----------

interface Step {
  n: number
  title: string
  pick: (r: Row) => boolean
}
const ks4chem = (r: Row): boolean => r.subject === 'chemistry' && r.level === 'KS4'
const ks5 = (r: Row): boolean => r.level === 'KS5' && r.kind !== 'chart' && r.kind !== 'covered'
/** Each row falls in the first step that picks it. The prose of each step is in the document, under its number. */
export const STEPS: Step[] = [
  { n: 0, title: 'Covered rows (no new code)', pick: (r) => r.kind === 'covered' },
  { n: 1, title: 'New templates (KS4)', pick: (r) => ks4chem(r) && r.kind === 'template' },
  { n: 2, title: 'Small symbols and the reaction profile (KS4)', pick: (r) => ks4chem(r) && (r.proposedPack === 'annotation' || r.id === 'reactionProfile') },
  { n: 3, title: 'Atoms, ions and dot-and-cross diagrams (KS4)', pick: (r) => ks4chem(r) && r.proposedPack === 'atoms' },
  { n: 4, title: 'The particle box', pick: (r) => r.proposedPack === 'matter' },
  { n: 5, title: 'Molecules (KS4)', pick: (r) => ks4chem(r) && r.proposedPack === 'molecules' },
  { n: 6, title: 'Structures (KS4)', pick: (r) => ks4chem(r) && r.proposedPack === 'structures' },
  { n: 7, title: 'Flow diagrams, plants and scenes (KS4)', pick: (r) => ks4chem(r) && ['flow', 'plants', 'scenes'].includes(r.proposedPack) },
  {
    n: 8,
    title: 'Electrochemical cells and the bond energy diagram (KS4)',
    pick: (r) => ks4chem(r) && (r.proposedPack === 'electrochemistry' || r.id === 'bondEnergyDiagram'),
  },
  {
    n: 9,
    title: 'KS5 physical and inorganic chemistry',
    pick: (r) => ks5(r) && ['Physical chemistry (A-level)', 'Inorganic chemistry (A-level)'].includes(r.topic),
  },
  {
    n: 10,
    title: 'KS5 organic chemistry and the biomolecules',
    pick: (r) => (ks5(r) && r.topic === 'Organic chemistry (A-level)') || (ks4chem(r) && r.proposedPack === 'biomolecules'),
  },
  { n: 11, title: 'Biology and physics outline', pick: (r) => r.proposedPack === 'biology' || r.proposedPack === 'physics' },
  { n: 12, title: 'Charts (only if decision 1 brings them in)', pick: (r) => r.kind === 'chart' },
]

/** The rows of each step. Throws when a row falls in no step. */
export function stepRows(rows: Row[]): Map<number, Row[]> {
  const out = new Map<number, Row[]>(STEPS.map((s) => [s.n, []]))
  const lost: string[] = []
  for (const r of rows) {
    const step = STEPS.find((s) => s.pick(r))
    if (step) out.get(step.n)?.push(r)
    else lost.push(r.id)
  }
  if (lost.length) throw new Error(`not in a build step: ${lost.join(', ')}`)
  return out
}

// ---------- what to confirm, row by row, for the "rows to check" lists ----------

/** For each row in the first two lists: what a person with the AQA PDF should look for. A row in a list without an entry fails. */
export const CONFIRM: Record<string, string> = {
  particleElementCompoundMixture: 'Do papers draw particle pictures of elements, compounds and mixtures (4.1.1.1 and the next section)?',
  alphaScattering: 'Does the specification or a paper show the scattering experiment, or only ask students to explain it?',
  ionShell: 'Do papers expect the bracketed shell diagram of an ion with its charge?',
  nuclideNotation: 'The notation printed in 4.1.1.5 (mass number over atomic number).',
  particleStates: 'The states-of-matter pictures and the limitations of the model.',
  changeOfState: 'Is a changes-of-state diagram drawn, or are only the terms used?',
  heatingCurve: 'Do papers on states of matter use heating or cooling curves?',
  metallicBonding: 'The wording of 4.2.1.5: do students recognise metallic structures from diagrams of their bonding?',
  alloyStructure: 'The alloy layers picture in the section on metals and alloys.',
  diamondStructure: 'Do papers show the carbon structures, or ask only for properties? (A-level 3.1.3.4 asks students to draw them.)',
  graphiteStructure: 'Do papers show the carbon structures, or ask only for properties? (A-level 3.1.3.4 asks students to draw them.)',
  grapheneSheet: 'Do papers show graphene and fullerenes for recognition (4.2.3)?',
  fullereneC60: 'Do papers show graphene and fullerenes for recognition (4.2.3)? A 2022 Higher paper showed C70.',
  balancedEquationModels: 'Do papers draw balanced equations with particle models?',
  reactivitySeriesList: 'The reactivity series as printed in the specification, with carbon and hydrogen in place.',
  metalsAcidTubes: 'Do papers show test tubes, or only tables of observations?',
  metalDisplacementTubes: 'Do papers show test tubes, or only tables of observations?',
  pHScale: 'The pH colour bands the specification and papers use.',
  electrolysisIons: 'Is a cell with moving ions drawn in papers (4.4.3.1 to 4.4.3.4)?',
  aluminiumExtractionCell: 'The aluminium cell figure in papers on 4.4.3.3.',
  fuelCell: 'The fuel cell diagram in papers on 4.5.2.2, and the half-equation forms (acid and alkaline).',
  collisionTheoryParticles: 'Do papers use particle collision pictures for the rate factors?',
  alkeneBromineTest: 'Is the bromine water test drawn in test tubes or only described?',
  greenhouseEffect: 'The greenhouse effect diagram, and what the incoming radiation is called.',
  wasteWaterTreatment: 'The sewage treatment flow chart in 4.10.1.3.',
  rustingTubes: 'The rusting tubes: what is in each tube, and whether papers draw them.',
  limitingReactantModels: 'Do papers use particle pictures for a limiting reactant?',
  temperatureTimeGraph: 'The graph asked for in the temperature change practical.',
  rateLossOfMass: 'Whether papers or practical sheets draw the loss-of-mass method (4.6.1.1).',
  electronBoxDiagram: 'Whether 7405 3.1.1.3 asks for electrons-in-boxes diagrams.',
  reactionProfileMultiStep: 'A-level: two-step profiles and the rate-determining step.',
  calorimetryCoolingGraph: 'A-level practical 2: the extrapolation graph.',
  synthesisRouteMap: 'A-level section 3.3.14: how routes are drawn.',
  columnChromatography: 'A-level section 3.3.16: whether the column apparatus is drawn.',
  dehydrationEthanolApparatus:
    'A-level section 3.3.5: the dehydration apparatus (the suggested practical makes cyclohexene from cyclohexanol by distillation).',
  fractionalDistillationLab: 'Whether laboratory fractional distillation is named for GCSE.',
  gasCollectionMethods: 'Which gas collection methods papers draw.',
  conductivityTest: 'Whether the conductivity apparatus is drawn for ionic compounds.',
}

// ---------- the numbers ----------

function lists(rows: Row[]): { risk: Row[]; b: Row[]; checkedA: Row[] } {
  const rank = (r: Row): number => (r.confidence === 'unverified' ? 0 : 1)
  const risk = rows.filter((r) => r.priority === 'A' && r.confidence !== 'checked')
  return {
    risk: [...risk].sort((a, b) => rank(a) - rank(b)),
    b: rows.filter((r) => r.subject === 'chemistry' && r.priority === 'B' && r.confidence === 'unverified'),
    checkedA: rows.filter((r) => r.priority === 'A' && r.confidence === 'checked'),
  }
}

/** Every number and list that the prose quotes, by key. The prose names a key in `<!-- gen:n.KEY -->`. */
export function facts(d: Data): Record<string, string> {
  const rows = d.rows
  const chem = rows.filter((r) => r.subject === 'chemistry')
  const newCode = (r: Row): boolean => NEW_CODE.includes(r.kind)
  const drawings = (r: Row): boolean => ['symbol', 'compound', 'process'].includes(r.kind)
  const steps = stepRows(rows)
  const aNew = rows.filter((r) => r.priority === 'A' && newCode(r))
  const lastAStep = Math.max(...aNew.map((r) => STEPS.find((s) => s.pick(r))?.n ?? 0))
  const l = lists(rows)
  const newChem = count(chem, newCode)
  const newDrawings = count(chem, drawings)
  const newPackNames = new Set(rows.filter((r) => drawings(r) && !d.packIds.includes(r.proposedPack)).map((r) => r.proposedPack))
  const kept = rows.filter((r) => r.notes.startsWith(KEPT_NOTE))
  const brief = rows.filter((r) => r.notes.includes(BRIEF_NOTE))
  const out: Record<string, string> = {
    total: String(rows.length),
    chem: String(chem.length),
    chemKs4: String(count(chem, (r) => r.level === 'KS4')),
    chemKs5: String(count(chem, (r) => r.level === 'KS5')),
    outline: String(rows.length - chem.length),
    covered: String(count(rows, (r) => r.kind === 'covered')),
    charts: String(count(rows, (r) => r.kind === 'chart')),
    chartsChem: String(count(chem, (r) => r.kind === 'chart')),
    chartsAB: String(count(rows, (r) => r.kind === 'chart' && r.priority !== 'C')),
    new: String(count(rows, newCode)),
    symbol: String(count(rows, (r) => r.kind === 'symbol')),
    compound: String(count(rows, (r) => r.kind === 'compound')),
    template: String(count(rows, (r) => r.kind === 'template')),
    process: String(count(rows, (r) => r.kind === 'process')),
    newChem: String(newChem),
    newDrawingsChem: String(newDrawings),
    estLow: String(Math.round(newDrawings * 0.4)),
    estHigh: String(Math.round(newDrawings * 0.6)),
    aNew: String(aNew.length),
    aCovered: String(count(rows, (r) => r.priority === 'A' && r.kind === 'covered')),
    lastAStep: String(lastAStep),
    checked: String(count(rows, (r) => r.confidence === 'checked')),
    secondary: String(count(rows, (r) => r.confidence === 'secondary')),
    unverified: String(count(rows, (r) => r.confidence === 'unverified')),
    aRisk: String(l.risk.length),
    bRisk: String(l.b.length),
    aChecked: String(l.checkedA.length),
    trilogy: String(count(chem, (r) => r.courses.includes('8464'))),
    both: String(count(chem, (r) => r.courses.includes('8464') && r.courses.includes('8462'))),
    gcseOnly: String(count(chem, (r) => r.courses.includes('8462') && !r.courses.includes('8464') && r.level === 'KS4')),
    symbols: String(d.symbols.length),
    templates: String(d.templates.length),
    later: String(d.later.length),
    packIds: String(d.packIds.length),
    newPacks: String(newPackNames.size),
    libraryGroups: String(d.packIds.length + newPackNames.size),
    kept: String(kept.length),
    keptIds: ids(kept),
    brief: String(brief.length),
    briefIds: ids(brief),
    skeletalOrCurly: String(count(rows, (r) => (r.tags ?? []).includes('skeletal') || (r.tags ?? []).includes('curlyArrow'))),
    mechanisms: String(count(rows, (r) => r.proposedPack === 'mechanisms')),
    steps: String(STEPS.length - 1),
    stepRowsTotal: String([...steps.values()].reduce((a, s) => a + s.length, 0)),
  }
  for (const t of TAGS) out[`tag.${t}`] = String(count(rows, (r) => (r.tags ?? []).includes(t)))
  return out
}

// ---------- the generated blocks ----------

function countsBlock(rows: Row[]): string {
  const lines: string[][] = [['total', 'rows', String(rows.length)]]
  const dim = (name: string, order: string[], key: (r: Row) => string): void => {
    const t = tally(rows, key)
    for (const k of order) if (t.get(k)) lines.push([name, k, String(t.get(k))])
  }
  dim('subject', SUBJECT_ORDER, (r) => r.subject)
  dim('level', LEVEL_ORDER, (r) => r.level)
  dim('kind', KIND_ORDER, (r) => r.kind)
  dim('priority', PRIORITY_ORDER, (r) => r.priority)
  dim('confidence', CONFIDENCE_ORDER, (r) => r.confidence)
  return table(['Dimension', 'Value', 'Rows'], lines)
}

function kindsBlock(rows: Row[]): string {
  const chem = rows.filter((r) => r.subject === 'chemistry')
  const body = KIND_ORDER.map((k) => [
    k,
    KIND_MEANING[k],
    String(count(chem, (r) => r.kind === k)),
    String(count(rows, (r) => r.subject !== 'chemistry' && r.kind === k)),
    String(count(rows, (r) => r.kind === k)),
  ])
  body.push(['all', '', String(chem.length), String(rows.length - chem.length), String(rows.length)])
  return table(['Kind', 'What it is', 'Chemistry', 'Outline', 'Rows'], body)
}

function kindPriorityBlock(rows: Row[]): string {
  const line = (label: string, sub: Row[]): string[] => [label, ...PRIORITY_ORDER.map((p) => String(count(sub, (r) => r.priority === p))), String(sub.length)]
  return table(
    ['Kind', 'A', 'B', 'C', 'Total'],
    [
      ...KIND_ORDER.map((k) =>
        line(
          k,
          rows.filter((r) => r.kind === k),
        ),
      ),
      line('all', rows),
    ],
  )
}

function tagsBlock(rows: Row[]): string {
  return table(
    ['Tag', 'What it marks', 'Rows', 'The rows'],
    TAGS.map((t) => {
      const sub = rows.filter((r) => (r.tags ?? []).includes(t))
      return [`\`${t}\``, TAG_MEANING[t], String(sub.length), ids(sub)]
    }),
  )
}

function stepsBlock(rows: Row[]): string {
  const steps = stepRows(rows)
  const body = STEPS.map((s) => {
    const sub = steps.get(s.n) ?? []
    const packs = [...new Set(sub.map((r) => r.proposedPack))].sort((a, b) => lt(a, b))
    return [
      String(s.n),
      s.title,
      packs.map((p) => `\`${p}\``).join(', '),
      String(sub.length),
      ...PRIORITY_ORDER.map((p) => String(count(sub, (r) => r.priority === p))),
    ]
  })
  body.push(['', 'All rows', '', String(rows.length), ...PRIORITY_ORDER.map((p) => String(count(rows, (r) => r.priority === p)))])
  return table(['Step', 'What', 'Packs', 'Rows', 'A', 'B', 'C'], body)
}

function packsBlock(d: Data): string {
  const rows = d.rows
  const names = [...new Set(rows.map((r) => r.proposedPack))]
  const known = PACK_ORDER.filter((p) => names.includes(p))
  const others = names.filter((p) => !PACK_ORDER.includes(p)).sort((a, b) => lt(a, b))
  const body = [...known, ...others].map((p) => {
    const sub = rows.filter((r) => r.proposedPack === p)
    const subjects = SUBJECT_ORDER.filter((s) => sub.some((r) => r.subject === s)).join(' and ')
    const group = sub.some((r) => ['symbol', 'compound', 'process'].includes(r.kind)) ? (d.packIds.includes(p) ? 'exists' : 'new') : 'none'
    const examples = [...sub].sort((a, b) => lt(a.priority, b.priority) || lt(a.id, b.id)).slice(0, 4)
    return [
      p,
      subjects,
      group,
      String(sub.length),
      ...PRIORITY_ORDER.map((q) => String(count(sub, (r) => r.priority === q))),
      ...LEVEL_ORDER.map((v) => String(count(sub, (r) => r.level === v))),
      ids(examples),
    ]
  })
  return table(['Pack', 'Subject', 'Library group', 'Rows', 'A', 'B', 'C', 'KS4', 'KS5', 'Examples'], body)
}

const lookUnder = (r: Row): string => `${r.topic}${r.specRefs.length ? ` (${r.specRefs.join(', ')})` : ''}`

function checkBlock(rows: Row[], which: string): string {
  const l = lists(rows)
  if (which === 'checked') {
    const link = (r: Row): string => {
      const url = r.sources.find(isAqa) ?? ''
      const seg = url.split('/').filter(Boolean).pop() ?? url
      return `[${seg}](${url})`
    }
    return table(
      ['Row', 'Name', 'Course', 'Look under', 'AQA address cited'],
      l.checkedA.map((r) => [`\`${r.id}\``, r.name, r.courses.join(', '), lookUnder(r), link(r)]),
    )
  }
  const list = which === 'risk' ? l.risk : l.b
  const body = list.map((r) => {
    const confirm = CONFIRM[r.id]
    if (!confirm) throw new Error(`no instruction in CONFIRM for the rows-to-check list: ${r.id}`)
    return [`\`${r.id}\``, r.name, r.confidence, r.courses.join(', '), lookUnder(r), confirm]
  })
  return table(['Row', 'Name', 'Confidence', 'Course', 'Look under', 'What to confirm'], body)
}

function topicsBlock(rows: Row[]): string {
  const out: string[] = []
  const groups: [string, string][] = []
  for (const r of rows) if (!groups.some(([s, v]) => s === r.subject && v === r.level)) groups.push([r.subject, r.level])
  for (const [subject, level] of groups) {
    const sub = rows.filter((r) => r.subject === subject && r.level === level)
    out.push(`### ${SUBJECT_TITLE[subject] ?? subject}, ${level}`, '')
    for (const topic of [...new Set(sub.map((r) => r.topic))]) {
      const list = sub.filter((r) => r.topic === topic)
      out.push(`#### ${topic} (${list.length})`, '')
      out.push(
        table(
          ['Row', 'Name', 'Kind', 'Pack', 'Pri', 'Confidence', 'Course', 'What it draws'],
          list.map((r) => [
            `\`${r.id}\``,
            r.name,
            r.kind,
            r.proposedPack,
            r.priority,
            r.confidence,
            r.courses.join(', '),
            (r.covered ? `Covered by \`${r.covered}\`. ` : '') + firstSentence(r.draw),
          ]),
        ),
        '',
      )
    }
  }
  return out.join('\n').replace(/\n+$/, '')
}

function blocks(d: Data): Record<string, string> {
  return {
    counts: countsBlock(d.rows),
    kinds: kindsBlock(d.rows),
    'kind-priority': kindPriorityBlock(d.rows),
    tags: tagsBlock(d.rows),
    steps: stepsBlock(d.rows),
    packs: packsBlock(d),
    'check-risk': checkBlock(d.rows, 'risk'),
    'check-b': checkBlock(d.rows, 'b'),
    'check-checked': checkBlock(d.rows, 'checked'),
    'rows-by-topic': topicsBlock(d.rows),
  }
}

// ---------- the markers ----------

/** `<!-- gen:KEY -->` text `<!-- /gen -->`. */
export const MARKER = /<!-- gen:([A-Za-z0-9_.-]+) -->([\s\S]*?)<!-- \/gen -->/g

/** The sections of the document that James is asked to read (the number of words is generated, from these). */
export const READING = ['Read this first', 'Decisions for James', 'Build order']

/** The words of the named `## ` sections, to the nearest hundred. Markers, table bars, code marks and headings do not count. */
export function readingWords(doc: string): number {
  let words = 0
  for (const name of READING) {
    const start = doc.search(new RegExp(`^## ${name}\\s*$`, 'm'))
    if (start < 0) throw new Error(`no section "${name}" in the document`)
    const rest = doc.slice(start + 1)
    const next = rest.search(/^## /m)
    const text = (next < 0 ? rest : rest.slice(0, next)).replace(/<!--[\s\S]*?-->/g, ' ').replace(/[`*|#>_-]+/g, ' ')
    words += text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length
  }
  return Math.round(words / 100) * 100
}

/** The document with every generated part written from the data. Throws on an unknown key or a marker that is not closed. */
export function generate(doc: string, d: Data): string {
  const opened = (doc.match(/<!-- gen:/g) ?? []).length
  const closed = (doc.match(/<!-- \/gen -->/g) ?? []).length
  const found = [...doc.matchAll(MARKER)].length
  if (opened !== closed || opened !== found) throw new Error(`the generated parts are not closed in pairs: ${opened} opened, ${closed} closed, ${found} found`)
  const f = facts(d)
  const b = blocks(d)
  const fill = (text: string, skip: string | null): string =>
    text.replace(MARKER, (whole: string, key: string) => {
      if (key === skip) return whole
      if (key.startsWith('n.')) {
        const v = f[key.slice(2)]
        if (v === undefined) throw new Error(`unknown number "${key}" in the document`)
        return `<!-- gen:${key} -->${v}<!-- /gen -->`
      }
      const v = b[key]
      if (v === undefined) throw new Error(`unknown block "${key}" in the document`)
      return `<!-- gen:${key} -->\n${v}\n<!-- /gen -->`
    })
  const first = fill(doc, 'n.readWords')
  const words = thousands(readingWords(first))
  return first.replace(/<!-- gen:n\.readWords -->[\s\S]*?<!-- \/gen -->/g, `<!-- gen:n.readWords -->${words}<!-- /gen -->`)
}

/** Numbers in the hand-written text that are not one of the allowed forms (a course code, a section number, a year, a step or a decision number). */
export function proseNumbers(doc: string): string[] {
  const text = doc
    .replace(MARKER, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
  const months = 'January|February|March|April|May|June|July|August|September|October|November|December'
  const bad: string[] = []
  for (const m of text.matchAll(/[\w.,%+-]*\d[\w.,%+-]*/g)) {
    const tok = m[0].replace(/[.,]+$/, '')
    if (/[A-Za-z]/.test(tok)) continue
    if (/^\d+(\.\d+)+$/.test(tok)) continue
    if (/^(8461|8462|8463|8464|7405|20\d\d)$/.test(tok)) continue
    const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0)
    const after = text.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 20)
    if (/\b(?:steps?|decisions?|sections?|parts?|rules?|practicals?|phases?|groups?)\s+(?:\d+\s*(?:,|and|to)\s*)*$/i.test(before)) continue
    if (/^\d+\.$/.test(m[0]) && /(?:^|\n)\s*(?:[-*]\s+)?(?:\*\*)?$/.test(before)) continue // the number of a numbered list
    if (/^\s*(?:to\s+\d+\s+)?u\b/.test(after)) continue
    if (new RegExp(`^\\s+(?:${months})\\b`).test(after)) continue
    bad.push(`${before.slice(-24).replace(/\s+/g, ' ')}[${m[0]}]${after.slice(0, 12).replace(/\s+/g, ' ')}`)
  }
  return bad
}

// ---------- the command ----------

const json = <T>(file: string): T => JSON.parse(readFileSync(resolve(ROOT, 'spec', file), 'utf8')) as T

/** The data that the document is made from, read from the files. */
export function loadData(): Data {
  const catalogue = json<{ symbols: { id: string }[]; later: { id: string }[] }>('catalogue.json')
  const plan = json<{ templates: { id: string }[] }>('templates.json')
  return {
    rows: json<Row[]>('diagrams.json'),
    symbols: catalogue.symbols.map((s) => s.id),
    later: catalogue.later.map((s) => s.id),
    templates: plan.templates.map((t) => t.id),
    packIds: PACKS.map((p) => p.id),
  }
}

function main(): void {
  const before = readFileSync(DOC_FILE, 'utf8')
  const after = generate(before, loadData())
  if (after !== before) writeFileSync(DOC_FILE, after)
  console.log(`${after === before ? 'unchanged' : 'wrote'} ${DOC_FILE} (${after.split('\n').length - 1} lines, ${after.length} characters)`)
  const bad = proseNumbers(after)
  if (bad.length) console.log(`warning: numbers typed by hand in the text:\n  ${bad.join('\n  ')}`)
}

// Run it when it is the command, not when a test imports it.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
