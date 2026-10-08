// diagrams.test.ts — the diagram inventory in spec/diagrams.json against its own rules and against docs/diagram-inventory.md.
// The inventory is a plan, not code: it lists every diagram type that a KS4 science lesson or a KS5 chemistry lesson asks for,
// and what the next packs must draw. Nothing here draws anything. The document states the counts and lists every row by topic;
// this test fails when the document and the file disagree.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import catalogue from '../spec/catalogue.json'
import inventory from '../spec/diagrams.json'
import plan from '../spec/templates.json'

interface Row {
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
}

const rows = inventory as unknown as Row[]
const doc = readFileSync(resolve(__dirname, '../docs/diagram-inventory.md'), 'utf8')

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

const known = new Set([...catalogue.symbols.map((s) => s.id), ...plan.templates.map((t) => t.id)])
const isAqa = (url: string) => /^https:\/\/([a-z]+\.)*aqa\.org\.uk\//.test(url)
const count = (key: keyof Row): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const r of rows) out[String(r[key])] = (out[String(r[key])] ?? 0) + 1
  return out
}

describe('spec/diagrams.json: fields and values', () => {
  it('is a non-empty array of rows with exactly the agreed fields in the agreed order', () => {
    expect(Array.isArray(inventory)).toBe(true)
    expect(rows.length).toBeGreaterThan(100)
    for (const r of rows) expect(Object.keys(r), r.id).toEqual(FIELDS)
  })

  it('has text in every text field and arrays where arrays belong', () => {
    for (const r of rows) {
      for (const k of ['id', 'name', 'topic', 'proposedPack', 'draw', 'params', 'scienceChecks'] as const) {
        expect(typeof r[k] === 'string' && r[k].trim() !== '', `${r.id}.${k} is empty`).toBe(true)
      }
      expect(typeof r.notes, `${r.id}.notes`).toBe('string')
      expect(Array.isArray(r.courses) && r.courses.length > 0 && r.courses.every((c) => typeof c === 'string' && c !== ''), `${r.id}.courses`).toBe(true)
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

  it('does not reuse the id of a symbol or a template that is already in the catalogue', () => {
    for (const r of rows) expect(known.has(r.id), `${r.id} is an id of spec/catalogue.json or spec/templates.json`).toBe(false)
  })

  it('names a short pack in lowerCamelCase', () => {
    for (const r of rows) {
      expect(r.proposedPack, r.id).toMatch(/^[a-z][A-Za-z]*$/)
      expect(r.proposedPack.length, r.id).toBeLessThanOrEqual(20)
    }
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

  it('gives every chart row priority C or a note (charts are outside PracDraw until James decides)', () => {
    const charts = rows.filter((r) => r.kind === 'chart')
    expect(charts.length).toBeGreaterThan(10)
    for (const r of charts) expect(r.priority === 'C' || r.notes.trim() !== '', `${r.id} is a chart row with priority ${r.priority} and no note`).toBe(true)
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

  it('has specification references of the form "<course code> <section number>" and none twice in a row', () => {
    for (const r of rows) {
      expect(new Set(r.specRefs).size, `${r.id} repeats a reference`).toBe(r.specRefs.length)
      for (const ref of r.specRefs) expect(ref, `${r.id}`).toMatch(/^(8461|8462|8463|8464|7405) \d+(\.\d+)*$/)
    }
  })

  it('has https links as sources, an AQA link on every checked row and a revision-site link on every secondary row', () => {
    for (const r of rows) {
      for (const s of r.sources) expect(s, `${r.id} source`).toMatch(/^https:\/\/[^\s]+$/)
      expect(new Set(r.sources).size, `${r.id} repeats a source`).toBe(r.sources.length)
      if (r.confidence === 'checked') expect(r.sources.some(isAqa), `${r.id} is checked but cites no aqa.org.uk page`).toBe(true)
      if (r.confidence === 'secondary')
        expect(
          r.sources.some((s) => !isAqa(s)),
          `${r.id} is secondary but cites only AQA pages`,
        ).toBe(true)
    }
  })
})

describe('docs/diagram-inventory.md agrees with the file', () => {
  /** The "Counts" section: lines `| dimension | value | rows |`. */
  const stated = (() => {
    const section = doc.split(/^## /m).find((s) => s.startsWith('Counts')) ?? ''
    const out: Record<string, Record<string, number>> = {}
    for (const m of section.matchAll(/^\| (total|subject|level|kind|priority|confidence|pack) \| ([^|]+?) \| (\d+) \|$/gm)) {
      ;(out[m[1]] ??= {})[m[2]] = Number(m[3])
    }
    return out
  })()

  it('states the counts that the file has', () => {
    expect(stated.total, 'the Counts section has no total line').toBeDefined()
    expect(stated.total?.rows).toBe(rows.length)
    for (const key of ['subject', 'level', 'kind', 'priority', 'confidence'] as const) expect(stated[key], `Counts has no ${key} lines`).toEqual(count(key))
    expect(stated.pack, 'Counts has no pack lines').toEqual(count('proposedPack'))
  })

  /** The tables under "Rows by topic": lines `| `id` | name | kind | pack | priority | confidence | description |`. */
  const listed = (() => {
    const section = doc.split(/^## /m).find((s) => s.startsWith('Rows by topic')) ?? ''
    const out = new Map<string, { kind: string; pack: string; priority: string; confidence: string; text: string }>()
    for (const m of section.matchAll(/^\| `([A-Za-z0-9]+)` \| (.*?) \| (\w+) \| (\w+) \| ([ABC]) \| (\w+) \| (.*) \|$/gm)) {
      out.set(m[1], { kind: m[3], pack: m[4], priority: m[5], confidence: m[6], text: m[7] })
    }
    return out
  })()

  it('lists every row once, with the kind, pack, priority and confidence of the file', () => {
    expect([...listed.keys()].sort()).toEqual(rows.map((r) => r.id).sort())
    for (const r of rows) {
      const d = listed.get(r.id)
      expect(d, r.id).toBeDefined()
      if (!d) continue
      expect(d.kind, `${r.id} kind`).toBe(r.kind)
      expect(d.pack, `${r.id} pack`).toBe(r.proposedPack)
      expect(d.priority, `${r.id} priority`).toBe(r.priority)
      expect(d.confidence, `${r.id} confidence`).toBe(r.confidence)
      if (r.covered) expect(d.text, `${r.id} should name the template or symbol that covers it`).toContain(`\`${r.covered}\``)
    }
  })

  it('has the sections that the brief asks for', () => {
    for (const heading of ['Counts', 'Rows by topic', 'Build order', 'Decisions for James', 'Rows to check against the AQA PDF']) {
      expect(doc, heading).toMatch(new RegExp(`^## ${heading}`, 'm'))
    }
  })
})
