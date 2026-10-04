// spec.test.ts — the code against the plan in spec/catalogue.json and spec/templates.json.
// Always on: whatever is built must match the plan. With RELEASE=A or RELEASE=B: everything of that priority must be built.

import { describe, expect, it } from 'vitest'
import catalogue from '../spec/catalogue.json'
import plan from '../spec/templates.json'
import { svgDocument } from './kernel/nodes'
import { docNodes, estimateBounds, resolveTarget } from './render/render'
import { SYMBOLS, geometry, labelText } from './symbols/registry'
import { TEMPLATES } from './templates'

const release = process.env.RELEASE // undefined | 'A' | 'B'
const wanted = (priority: string) => release === 'B' || (release === 'A' && priority === 'A')

/** A catalogue row. `label` and `autoLabel` are present only when they differ from the defaults. */
interface Row {
  id: string
  name: string
  pack: string
  priority: string
  w: number
  h: number
  resize: string
  cavities: string[]
  anchors: string[]
  params: string[]
  aliases: string[]
  label?: string
  autoLabel?: boolean
}
const rows: Row[] = catalogue.symbols

describe('symbols match the catalogue', () => {
  for (const def of SYMBOLS) {
    it(def.id, () => {
      const row = rows.find((s) => s.id === def.id)
      expect(row, `${def.id} is not in spec/catalogue.json`).toBeTruthy()
      if (!row) return
      expect(def.name).toBe(row.name)
      expect(def.pack).toBe(row.pack)
      expect(def.size).toEqual({ w: row.w, h: row.h })
      expect(def.resize).toBe(row.resize)
      expect([...(def.aliases ?? [])].sort()).toEqual([...row.aliases].sort())
      const g = geometry(def.id, def.size.w, def.size.h)
      expect((g.cavities ?? []).map((c) => c.id).sort()).toEqual([...row.cavities].sort())
      expect((g.anchors ?? []).map((a) => `${a.id}:${a.kind}`).sort()).toEqual([...row.anchors].sort())
      const params = (def.params ?? []).map((p) => {
        const tail = p.type === 'number' ? `[${p.min}..${p.max}]` : p.type === 'choice' ? `[${p.options.map((o) => o.value).join('|')}]` : ''
        return `${p.key}:${p.type}=${p.default}${tail}`
      })
      expect(params.sort()).toEqual([...row.params].sort())
      // Label text at the default parameters, and whether "Label all" may label it.
      if (row.label) expect(labelText(def)).toBe(row.label)
      // A row with no label may still have a label function (section 8, rule 11: hotPlate, chromatographyPaper), as long as it gives the
      // default text at the default parameters.
      else expect(labelText(def), `${def.id} sets a label that the catalogue does not list`).toBe(labelText({ ...def, label: undefined }))
      expect(def.autoLabel !== false).toBe(row.autoLabel !== false)
    })
  }
  it('builds every symbol the release needs', () => {
    const missing = rows.filter((s) => wanted(s.priority) && !SYMBOLS.some((d) => d.id === s.id)).map((s) => s.id)
    expect(missing).toEqual([])
  })
})

describe('templates match the plan', () => {
  for (const t of TEMPLATES) {
    it(t.id, () => {
      const row = plan.templates.find((p) => p.id === t.id)
      expect(row, `${t.id} is not in spec/templates.json`).toBeTruthy()
      if (!row) return
      expect(t.title).toBe(row.title)
      expect(t.group).toBe(row.group)
      expect(t.refs).toBe(row.refs)
      const doc = t.build()
      const used = new Set(Object.values(doc.items).flatMap((it) => (it.type === 'symbol' ? [it.symbol] : [])))
      expect([...used].sort()).toEqual([...row.uses].sort())
      // A valid, self-contained document.
      expect(JSON.parse(JSON.stringify(doc))).toEqual(doc)
      expect(doc.order.length).toBe(Object.keys(doc.items).length)
      const labels = Object.values(doc.items).filter((it) => it.type === 'label')
      const fixed = labels.filter((l) => l.target && 'item' in l.target)
      expect(fixed.length, 'at least three labels fixed to items').toBeGreaterThanOrEqual(3)
      for (const l of labels) if (l.target) expect(resolveTarget(doc, l.target)).not.toBeNull()
      const b = estimateBounds(doc)
      expect(Number.isFinite(b.w) && b.w > 50 && b.w < 1400).toBe(true)
      expect(Number.isFinite(b.h) && b.h > 50 && b.h < 1000).toBe(true)
      expect(svgDocument(docNodes(doc), b.w, b.h)).not.toMatch(/NaN|undefined/)
      expect(JSON.stringify(t.build())).toBe(JSON.stringify(doc)) // deterministic
    })
  }
  it('builds every template the release needs', () => {
    const missing = plan.templates.filter((p) => wanted(p.priority) && !TEMPLATES.some((t) => t.id === p.id)).map((p) => p.id)
    expect(missing).toEqual([])
  })
})

describe('the plan itself', () => {
  it('every template uses catalogue symbols only', () => {
    const ids = new Set(rows.map((s) => s.id))
    for (const p of plan.templates) for (const u of p.uses) expect(ids.has(u), `${p.id} uses ${u}`).toBe(true)
  })
  it('a priority A template needs priority A symbols only', () => {
    const a = new Set(rows.filter((s) => s.priority === 'A').map((s) => s.id))
    for (const p of plan.templates.filter((q) => q.priority === 'A')) for (const u of p.uses) expect(a.has(u), `${p.id} uses ${u}`).toBe(true)
  })
})
