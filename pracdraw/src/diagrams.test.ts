// diagrams.test.ts — the diagram inventory in spec/diagrams.json against its own rules and against docs/diagram-inventory.md.
// The inventory is a plan, not code: it lists every diagram type that a KS4 science lesson or a KS5 chemistry lesson asks for,
// and what the next packs must draw. Nothing here draws anything. The tables and numbers of the document are written by
// `npm run gen:inventory` from the file; this test regenerates them in memory and compares them with the document byte for byte,
// so a change to the file without the document (or the other way round) fails, and so does a number about the rows typed by hand.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import catalogue from '../spec/catalogue.json'
import inventory from '../spec/diagrams.json'
import plan from '../spec/templates.json'
import {
  BRIEF_NOTE,
  DOC_FILE,
  KEPT_NOTE,
  STEPS,
  TAGS,
  generate,
  proseNumbers,
  readingWords,
  stepRows,
  MARKER,
  type Data,
  type Row,
} from '../scripts/gen-inventory'
import { PACKS } from './editor/search'

const rows = inventory as unknown as Row[]
const doc = readFileSync(DOC_FILE, 'utf8')
const data: Data = {
  rows,
  symbols: catalogue.symbols.map((s) => s.id),
  later: catalogue.later.map((s) => s.id),
  templates: plan.templates.map((t) => t.id),
  packIds: PACKS.map((p) => p.id),
}

const FIELDS = [
  'id',
  'name',
  'subject',
  'level',
  'courses',
  'specRefs',
  'topic',
  'kind',
  'covered',
  'proposedPack',
  'priority',
  'detail',
  'draw',
  'params',
  'scienceChecks',
  'sources',
  'confidence',
  'notes',
]
const SUBJECTS = ['chemistry', 'biology', 'physics']
const LEVELS = ['KS4', 'KS5']
const KINDS = ['symbol', 'compound', 'template', 'process', 'chart', 'covered']
const PRIORITIES = ['A', 'B', 'C']
const DETAILS = ['full', 'outline']
const CONFIDENCES = ['checked', 'secondary', 'unverified']
const CHEMISTRY_COURSES = ['8464', '8462', '7405']
const BIOLOGY_COURSES = ['Trilogy', 'GCSE Biology']
const PHYSICS_COURSES = ['Trilogy', 'GCSE Physics']
const HEADINGS = [
  'Read this first',
  'Decisions for James',
  'Build order',
  'Before the first pack',
  'Counts',
  'What each pack would draw',
  'Confidence and limits',
  'Rows to check against the AQA PDF',
  'How this was made',
  'Rows by topic (appendix)',
]

const known = new Set([...data.symbols, ...data.templates])
const isAqa = (url: string) => /^https:\/\/([a-z]+\.)*aqa\.org\.uk\//.test(url)

/**
 * A row may not reuse the id of a symbol or template of the catalogue, except that a `covered` row may have the id of the
 * symbol or template it names (a pack that is built turns its row into a covered row of the same name).
 */
const idClash = (r: Pick<Row, 'id' | 'kind' | 'covered'>, ids: Set<string>): boolean => ids.has(r.id) && !(r.kind === 'covered' && r.covered === r.id)

/** The name of the course that a reference such as "8464 5.10.1.3" belongs to, in the `courses` of a row of that subject. */
const courseOf = (r: Row, code: string): string => {
  if (r.subject === 'chemistry') return code
  if (code === '8461') return 'GCSE Biology'
  if (code === '8463') return 'GCSE Physics'
  if (code === '8464') return 'Trilogy'
  return code
}

describe('spec/diagrams.json: fields and values', () => {
  it('is a non-empty array of rows with exactly the agreed fields in the agreed order (`tags` last, when present)', () => {
    expect(Array.isArray(inventory)).toBe(true)
    expect(rows.length).toBeGreaterThan(100)
    for (const r of rows) expect(Object.keys(r), r.id).toEqual(r.tags === undefined ? FIELDS : [...FIELDS, 'tags'])
  })

  it('has text in every text field, a `draw` of at least 40 characters, and arrays where arrays belong', () => {
    for (const r of rows) {
      for (const k of ['id', 'name', 'topic', 'proposedPack', 'draw', 'params', 'scienceChecks'] as const) {
        expect(typeof r[k] === 'string' && r[k].trim() !== '', `${r.id}.${k} is empty`).toBe(true)
      }
      expect(r.draw.trim().length, `${r.id}.draw is shorter than 40 characters`).toBeGreaterThanOrEqual(40)
      expect(typeof r.notes, `${r.id}.notes`).toBe('string')
      expect(Array.isArray(r.courses) && r.courses.length > 0 && r.courses.every((c) => typeof c === 'string' && c !== ''), `${r.id}.courses`).toBe(true)
      expect(new Set(r.courses).size, `${r.id} lists a course twice`).toBe(r.courses.length)
      expect(Array.isArray(r.specRefs) && r.specRefs.every((s) => typeof s === 'string'), `${r.id}.specRefs`).toBe(true)
      expect(Array.isArray(r.sources) && r.sources.every((s) => typeof s === 'string'), `${r.id}.sources`).toBe(true)
    }
  })

  it('uses only the allowed values for subject, level, kind, priority, detail and confidence', () => {
    for (const r of rows) {
      expect(SUBJECTS, `${r.id}.subject`).toContain(r.subject)
      expect(LEVELS, `${r.id}.level`).toContain(r.level)
      expect(KINDS, `${r.id}.kind`).toContain(r.kind)
      expect(PRIORITIES, `${r.id}.priority`).toContain(r.priority)
      expect(DETAILS, `${r.id}.detail`).toContain(r.detail)
      expect(CONFIDENCES, `${r.id}.confidence`).toContain(r.confidence)
    }
  })

  it('has unique ids in lowerCamelCase and unique names', () => {
    const ids = new Set<string>()
    const names = new Set<string>()
    for (const r of rows) {
      expect(r.id, `${r.id} is not lowerCamelCase`).toMatch(/^[a-z][A-Za-z0-9]*$/)
      expect(ids.has(r.id), `duplicate id ${r.id}`).toBe(false)
      expect(names.has(r.name), `duplicate name ${r.name}`).toBe(false)
      ids.add(r.id)
      names.add(r.name)
    }
  })

  it('does not reuse the id of a symbol or template of the catalogue, unless it is the covered row of that very symbol or template', () => {
    for (const r of rows)
      expect(idClash(r, known), `${r.id} is an id of spec/catalogue.json or spec/templates.json and is not the covered row of it`).toBe(false)
    // The rule itself, both ways: a row of a pack that has been built may keep its name, and no other row may take a catalogue id.
    const ids = new Set(['bohrAtom', 'beaker'])
    expect(idClash({ id: 'bohrAtom', kind: 'covered', covered: 'bohrAtom' }, ids)).toBe(false)
    expect(idClash({ id: 'bohrAtom', kind: 'symbol', covered: null }, ids)).toBe(true)
    expect(idClash({ id: 'bohrAtom', kind: 'covered', covered: 'beaker' }, ids)).toBe(true)
    expect(idClash({ id: 'someNewRow', kind: 'symbol', covered: null }, ids)).toBe(false)
  })

  it('names a short pack in lowerCamelCase', () => {
    for (const r of rows) {
      expect(r.proposedPack, r.id).toMatch(/^[a-z][A-Za-z]*$/)
      expect(r.proposedPack.length, r.id).toBeLessThanOrEqual(20)
    }
  })

  it('gives `tags`, when present, as a non-empty list from the fixed list with none twice', () => {
    for (const r of rows) {
      if (r.tags === undefined) continue
      expect(Array.isArray(r.tags) && r.tags.length > 0, `${r.id}.tags`).toBe(true)
      expect(new Set(r.tags).size, `${r.id} repeats a tag`).toBe(r.tags.length)
      for (const t of r.tags) expect(TAGS, `${r.id} tag ${t}`).toContain(t)
    }
    for (const t of TAGS)
      expect(
        rows.some((r) => r.tags?.includes(t)),
        `no row carries the tag ${t}`,
      ).toBe(true)
  })
})

describe('spec/diagrams.json: kinds, courses and levels', () => {
  it('has `covered` name an existing symbol or template, and null for every other kind', () => {
    for (const r of rows) {
      if (r.kind === 'covered') {
        expect(typeof r.covered, `${r.id}.covered`).toBe('string')
        expect(known.has(String(r.covered)), `${r.id} is covered by ${r.covered}, which is not in spec/catalogue.json or spec/templates.json`).toBe(true)
      } else expect(r.covered, `${r.id}.covered must be null for a ${r.kind} row`).toBeNull()
    }
  })

  it('gives every chart row priority C or a note of at least 20 characters (charts are outside PracDraw until James decides)', () => {
    const charts = rows.filter((r) => r.kind === 'chart')
    expect(charts.length).toBeGreaterThan(10)
    for (const r of charts)
      expect(r.priority === 'C' || r.notes.trim().length >= 20, `${r.id} is a chart row with priority ${r.priority} and no note of 20 characters`).toBe(true)
  })

  it('keeps chemistry rows full, with course codes, and KS5 rows to A-level 7405 and priority B or C', () => {
    for (const r of rows.filter((x) => x.subject === 'chemistry')) {
      expect(r.detail, r.id).toBe('full')
      for (const c of r.courses) expect(CHEMISTRY_COURSES, `${r.id} course ${c}`).toContain(c)
      if (r.level === 'KS5') {
        expect(r.courses, `${r.id}`).toEqual(['7405'])
        expect(r.priority, `${r.id} is KS5, so it cannot be priority A`).not.toBe('A')
      } else {
        expect(
          r.courses.some((c) => c === '8464' || c === '8462'),
          `${r.id} is KS4 but names no GCSE course`,
        ).toBe(true)
      }
    }
  })

  it('keeps biology and physics rows as KS4 outline rows with priority C and course names', () => {
    for (const r of rows.filter((x) => x.subject !== 'chemistry')) {
      expect(r.detail, r.id).toBe('outline')
      expect(r.priority, r.id).toBe('C')
      expect(r.level, r.id).toBe('KS4')
      const allowed = r.subject === 'biology' ? BIOLOGY_COURSES : PHYSICS_COURSES
      for (const c of r.courses) expect(allowed, `${r.id} course ${c}`).toContain(c)
    }
  })

  it('has specification references of the form "<course code> <section number>", none twice, each for a course that the row lists', () => {
    for (const r of rows) {
      expect(new Set(r.specRefs).size, `${r.id} repeats a reference`).toBe(r.specRefs.length)
      for (const ref of r.specRefs) {
        expect(ref, `${r.id}`).toMatch(/^(8461|8462|8463|8464|7405) \d+(\.\d+)*$/)
        expect(r.courses, `${r.id} has the reference ${ref}, but its courses do not include ${courseOf(r, ref.split(' ')[0])}`).toContain(
          courseOf(r, ref.split(' ')[0]),
        )
      }
    }
  })

  it('has https links as sources, an AQA link on every checked row and on every row with a reference, and a revision-site link on every secondary row', () => {
    for (const r of rows) {
      for (const s of r.sources) expect(s, `${r.id} source`).toMatch(/^https:\/\/[^\s]+$/)
      expect(new Set(r.sources).size, `${r.id} repeats a source`).toBe(r.sources.length)
      if (r.confidence === 'checked') expect(r.sources.some(isAqa), `${r.id} is checked but cites no aqa.org.uk page`).toBe(true)
      if (r.specRefs.length > 0) expect(r.sources.some(isAqa), `${r.id} has a specification reference but cites no aqa.org.uk page`).toBe(true)
      if (r.confidence === 'secondary')
        expect(
          r.sources.some((s) => !isAqa(s)),
          `${r.id} is secondary but cites only AQA pages`,
        ).toBe(true)
    }
  })

  it('keeps the rows that lessons use but AQA does not name at priority C, and the geometry-brief rows among the symbols of priority A', () => {
    const kept = rows.filter((r) => r.notes.startsWith(KEPT_NOTE))
    expect(kept.length).toBeGreaterThan(0)
    for (const r of kept) expect(r.priority, `${r.id} is kept because lessons use it, so it is priority C`).toBe('C')
    const brief = rows.filter((r) => r.notes.includes(BRIEF_NOTE))
    expect(brief.length).toBeGreaterThan(0)
    for (const r of brief) expect(r.kind === 'symbol' && r.priority === 'A', `${r.id} needs a geometry brief, so it is a symbol of priority A`).toBe(true)
  })

  it('puts every row in exactly one step of the build order', () => {
    const steps = stepRows(rows)
    expect([...steps.values()].reduce((n, s) => n + s.length, 0)).toBe(rows.length)
    for (const s of STEPS) expect(steps.get(s.n)?.length, `step ${s.n} picks no row`).toBeGreaterThan(0)
  })
})

describe('docs/diagram-inventory.md agrees with the file', () => {
  it('is exactly what `npm run gen:inventory` writes now', () => {
    const made = generate(doc, data)
    expect(
      made === doc,
      'docs/diagram-inventory.md differs from what gen-inventory writes from spec/diagrams.json now: run npm run gen:inventory (and edit the text outside the generated parts, not inside them)',
    ).toBe(true)
    expect(generate(made, data) === made, 'generating twice changes the document').toBe(true)
  })

  it('has the sections in the agreed order, with the appendix last', () => {
    expect([...doc.matchAll(/^## (.+)$/gm)].map((m) => m[1])).toEqual(HEADINGS)
  })

  it('types no number about the rows by hand (a number comes from a generated part, or is a course code, a section, a step or a decision)', () => {
    expect(proseNumbers(doc), 'numbers typed by hand in the text; make each one a <!-- gen:n.KEY --> part or reword').toEqual([])
    // the check itself
    expect(proseNumbers('The list has 287 rows.')).toHaveLength(1)
    expect(proseNumbers('Steps 1 to 7 and decision 3 follow 7405 3.1.8.1 in KS4 on 9 October 2026, at 8 to 14 u.')).toEqual([])
  })

  it('names in backticks only ids that exist: rows, symbols, templates, Later symbols, packs, fields, tags and values', () => {
    const ok = new Set<string>([
      ...rows.map((r) => r.id),
      ...known,
      ...data.later,
      ...rows.map((r) => r.proposedPack),
      ...FIELDS,
      ...TAGS,
      ...CONFIDENCES,
      ...KINDS,
      'tags',
      'exists',
      'new',
      'none',
    ])
    const prose = doc.replace(MARKER, ' ')
    const dangling = [...prose.matchAll(/`([a-z][A-Za-z0-9]*)`/g)].map((m) => m[1]).filter((t) => !ok.has(t))
    expect(dangling, 'ids in the text that are not rows, symbols, templates, packs, fields or tags').toEqual([])
  })

  it('has a paragraph for each step of the build order, and a recommendation under each decision', () => {
    for (const s of STEPS) expect(doc, `no paragraph for step ${s.n}`).toContain(`- **Step ${s.n}.**`)
    const decisions = doc
      .slice(doc.indexOf('\n## Decisions for James'), doc.indexOf('\n## Build order'))
      .split(/^\*\*(?=\d+\. )/m)
      .slice(1)
    expect(decisions.length).toBeGreaterThanOrEqual(8)
    for (const d of decisions) {
      expect(d, d.slice(0, 40)).toContain('Recommended:')
      if (d.includes('(confirm)')) expect(d, d.slice(0, 40)).toContain('Recommended: yes')
    }
  })

  it('states the number of words that James reads as the document has them, to the nearest hundred', () => {
    const stated = /\(about <!-- gen:n\.readWords -->([\d,]+)<!-- \/gen --> words\)/.exec(doc)?.[1]
    expect(stated).toBeDefined()
    expect(Number((stated ?? '').replace(',', ''))).toBe(readingWords(doc))
  })
})

describe('the document test catches drift: each of these breaks fails the comparison', () => {
  const copy = (): Data => structuredClone(data)
  const rowOf = (d: Data, id: string): Row => {
    const r = d.rows.find((x) => x.id === id)
    if (!r) throw new Error(`no row ${id}`)
    return r
  }
  /** A pair of the document and the data that disagree: the comparison of the test must fail on it. */
  const breaks: [string, string, Data][] = []
  const docBreak = (name: string, change: (d: string) => string): number => breaks.push([name, change(doc), data])
  const dataBreak = (name: string, change: (d: Data) => void): number => {
    const d = copy()
    change(d)
    return breaks.push([name, doc, d])
  }

  // 1 a number in the prose
  docBreak('the total in the text is changed by hand', (d) => d.replace(/(<!-- gen:n\.total -->)\d+/, (_all, head: string) => `${head}999`))
  // 2 a row name
  dataBreak('a row is renamed', (d) => void (rowOf(d, 'bohrAtom').name += ' (renamed)'))
  // 3 a row moved to another topic
  dataBreak('a row moves to another topic', (d) => void (rowOf(d, 'bohrAtom').topic = 'Energy changes'))
  // 4 a changed description
  dataBreak('a description changes', (d) => void (rowOf(d, 'bohrAtom').draw = `Changed. ${rowOf(d, 'bohrAtom').draw}`))
  // 5 a number in a decision
  docBreak('a number in a decision is changed by hand', (d) => d.replace(/(<!-- gen:n\.tag\.3d -->)\d+/, (_all, head: string) => `${head}99`))
  // 6 a pack count
  dataBreak('a row moves to another pack', (d) => void (rowOf(d, 'bohrAtom').proposedPack = 'structures'))
  // 7 a rows-to-check entry (in the file, and in the document)
  dataBreak('a checked row of priority A becomes secondary', (d) => void (rowOf(d, 'bohrAtom').confidence = 'secondary'))
  docBreak('a row is deleted from a rows-to-check table', (d) => d.replace(/^\| `heatingCurve` \|.*\n/m, ''))
  // 8 a build-order cell
  docBreak('a cell of the build-order table is changed by hand', (d) =>
    d.replace(/^(\| 1 \| New templates \(KS4\) \| [^|]+\| )\d+/m, (_all, head: string) => `${head}99`),
  )
  // more
  dataBreak('a row is added', (d) => void d.rows.push({ ...rowOf(d, 'bohrAtom'), id: 'aNewRow', name: 'A new row' }))
  dataBreak(
    'a row is removed',
    (d) =>
      void d.rows.splice(
        d.rows.findIndex((r) => r.id === 'bohrAtom'),
        1,
      ),
  )
  dataBreak('a tag is removed', (d) => void delete rowOf(d, 'ionicLattice3D').tags)
  dataBreak('a priority changes', (d) => void (rowOf(d, 'diamondStructure').priority = 'B'))
  dataBreak('the note of a kept row changes', (d) => void (rowOf(d, 'blastFurnace').notes = 'Changed.'))
  dataBreak('a row changes course', (d) => void (rowOf(d, 'haberProcess').courses = ['8464', '8462']))
  docBreak('a table cell of the pack table is changed by hand', (d) =>
    d.replace(/^(\| atoms \| chemistry \| new \| )\d+/m, (_all, head: string) => `${head}99`),
  )
  docBreak('a row is deleted by hand from the appendix', (d) => d.replace(/^\| `bohrAtom` \|.*\n/m, ''))
  docBreak('a generated part is left empty', (d) => d.replace(/<!-- gen:counts -->[\s\S]*?<!-- \/gen -->/, '<!-- gen:counts --><!-- /gen -->'))

  /** Whether the document made from the data is the text given. An error while making it counts as a disagreement. */
  const agrees = (text: string, d: Data): boolean => {
    try {
      return generate(text, d) === text
    } catch {
      return false
    }
  }
  it('agrees for the real document and the real data (so that every break below is the break and nothing else)', () => {
    expect(agrees(doc, data)).toBe(true)
  })
  for (const [name, text, d] of breaks) {
    it(`fails when ${name}`, () => {
      expect(agrees(text, d), `the comparison does not notice that ${name}`).toBe(false)
    })
  }

  it('refuses a generated part that it does not know, or that is not closed', () => {
    expect(() => generate('<!-- gen:n.nothing -->1<!-- /gen -->', data)).toThrow(/unknown number/)
    expect(() => generate('<!-- gen:nothing --><!-- /gen -->', data)).toThrow(/unknown block/)
    expect(() => generate('<!-- gen:n.total -->1', data)).toThrow(/not closed/)
  })
})
