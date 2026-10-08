import { describe, expect, it } from 'vitest'
import { demoDoc } from '../demo'
import { P, rng } from '../kernel/geom'
import { TEMPLATES } from '../templates'
import { DocBuilder } from './build'
import { COLOUR, SYMBOL_SIZE, parseDoc, parseDocJson } from './parse'
import { newDoc, type Doc, type LabelItem, type SymbolItem } from './types'

/** A document as a file holds it: JSON, so undefined fields are gone. */
const json = (d: unknown) => JSON.parse(JSON.stringify(d))

/** A file as JSON.parse gives it: the broken files below are made by hand, field by field. */
type Raw = Record<string, any>

/** A small document with one item of each kind: beaker1, glassTube2, label3 (fixed to the beaker), label4 (free), label5 (plain), shape9. */
function base(): Raw {
  const b = new DocBuilder('Parse')
  const beaker = b.symbol('beaker', { x: 0, y: 0, contents: { main: [{ kind: 'liquid', amount: 0.5, colour: '#cfe8f7', bubbles: 'few' }] } })
  b.connector('glassTube', [P(0, -100), { x: 100, y: -100, r: 12 }, P(100, 0)], { endCap: 'closed' })
  b.label('beaker', 120, 0, [beaker, 50, 60])
  b.label('free', 120, 40, P(10, 10), { leaderEnd: 'arrow', size: 12 })
  b.label('title', 0, -150)
  b.doc.items.shape9 = { id: 'shape9', type: 'shape', shape: 'ellipse', x: 0, y: 0, w: 40, h: 20, rot: 15, fill: 'grey', dash: true }
  b.doc.order.push('shape9')
  return json(b.doc)
}

const IDS = ['beaker1', 'glassTube2', 'label3', 'label4', 'label5', 'shape9']

function parsed(raw: unknown): { doc: Doc; problems: string[] } {
  const r = parseDoc(raw)
  if (!r.ok) throw new Error(`expected a document, got: ${r.problems.join(' ')}`)
  return r
}

describe('parseDoc: good files', () => {
  it('a saved document comes back equal, with no problems', () => {
    for (const doc of [demoDoc(), base(), newDoc(), newDoc('')]) {
      const r = parsed(json(doc))
      expect(r.problems).toEqual([])
      expect(r.doc).toEqual(json(doc))
    }
  })

  it('every template parses with no problems', () => {
    expect(TEMPLATES.length).toBeGreaterThan(0)
    for (const t of TEMPLATES) {
      const r = parsed(json(t.build()))
      expect(r.problems, t.id).toEqual([])
      expect(r.doc, t.id).toEqual(json(t.build()))
    }
  })

  it('gives a new object that shares nothing with the file', () => {
    const raw = base()
    const { doc } = parsed(raw)
    expect(doc.items.beaker1).not.toBe(raw.items.beaker1)
    raw.items.beaker1.contents.main[0].amount = 0.9
    raw.order.pop()
    expect((doc.items.beaker1 as SymbolItem).contents.main[0].amount).toBe(0.5)
    expect(doc.order).toEqual(IDS)
  })

  it('an unknown symbol id stays (rule 6), with its parameters and contents', () => {
    const raw = base()
    raw.items.beaker1.symbol = 'fromTheFuture'
    raw.items.beaker1.params = { glow: true, size: 'XL', count: 3 }
    const r = parsed(raw)
    expect(r.problems).toEqual([])
    expect(r.doc.items.beaker1).toMatchObject({ symbol: 'fromTheFuture', params: { glow: true, size: 'XL', count: 3 }, contents: raw.items.beaker1.contents })
  })

  it('optional fields may be missing or null (JSON writes NaN as null); when present they are checked', () => {
    const raw = base()
    raw.items.label4.size = null
    raw.items.glassTube2.width = null
    raw.items.glassTube2.points[1].r = null
    raw.items.beaker1.locked = null
    raw.items.label3.smart = false
    raw.items.shape9.group = 'g1'
    raw.items.beaker1.contents.main[0].meniscus = true
    const r = parsed(raw)
    expect(r.problems).toEqual([])
    expect('size' in r.doc.items.label4).toBe(false)
    expect('width' in r.doc.items.glassTube2).toBe(false)
    expect(r.doc.items.glassTube2).toMatchObject({
      points: [
        { x: 0, y: -100 },
        { x: 100, y: -100 },
        { x: 100, y: 0 },
      ],
    })
    expect('locked' in r.doc.items.beaker1).toBe(false)
    expect(r.doc.items.label3).toMatchObject({ smart: false })
    expect(r.doc.items.shape9).toMatchObject({ group: 'g1' })
    expect((r.doc.items.beaker1 as SymbolItem).contents.main[0]).toEqual({ kind: 'liquid', amount: 0.5, colour: '#cfe8f7', bubbles: 'few', meniscus: true })
  })
})

describe('parseDoc: a wrong top-level shape fails', () => {
  const good = () => json(newDoc())
  const cases: [string, unknown][] = [
    ['nothing', undefined],
    ['null', null],
    ['a number', 42],
    ['text', 'pracdraw'],
    ['a list', [good()]],
    ['an empty object', {}],
    ['another app', { ...good(), app: 'chemix' }],
    ['no version', { ...good(), version: undefined }],
    ['version 0', { ...good(), version: 0 }],
    ['version as text', { ...good(), version: '1' }],
    ['a fractional version', { ...good(), version: 1.5 }],
    ['items as a list', { ...good(), items: [] }],
    ['no items', { ...good(), items: undefined }],
    ['no order', { ...good(), order: undefined }],
    ['order as an object', { ...good(), order: {} }],
    ['no settings', { ...good(), settings: undefined }],
    ['settings as text', { ...good(), settings: 'text' }],
  ]
  for (const [what, value] of cases) {
    it(what, () => {
      const r = parseDoc(json(value ?? null) ?? value)
      expect(r.ok).toBe(false)
      expect(r.problems.length).toBe(1)
      expect(r.problems[0]).toMatch(/PracDraw|version/)
    })
  }
})

describe('parseDoc: an item with a bad field is left out and listed', () => {
  // [item, field path, value (undefined = delete), what the problem says]
  const cases: [string, (string | number)[], unknown, string][] = [
    ['beaker1', ['x'], 'a', '"x" must be a number'],
    ['beaker1', ['x'], null, '"x" must be a number'],
    ['beaker1', ['y'], Infinity, '"y" must be a number'],
    ['beaker1', ['rot'], undefined, '"rot" must be a number'],
    ['beaker1', ['w'], 0, '"w" must be a number above 0'],
    ['beaker1', ['h'], -5, '"h" must be a number above 0'],
    ['beaker1', ['flip'], 'no', '"flip" must be true or false'],
    ['beaker1', ['symbol'], '', '"symbol" must be a name'],
    ['beaker1', ['params'], [], '"params" must be a set of values'],
    ['beaker1', ['params'], undefined, '"params" must be a set of values'],
    ['beaker1', ['params', 'spout'], { on: true }, 'the parameter "spout" must be a number, text, or true or false'],
    ['beaker1', ['params', 'spout'], null, 'the parameter "spout"'],
    ['beaker1', ['contents'], [], '"contents" must be a set of cavities'],
    ['beaker1', ['contents', 'main'], {}, 'the contents of "main" must be a list of layers'],
    ['beaker1', ['contents', 'main', 0], 'water', 'layer 1 of "main": it must be a layer'],
    ['beaker1', ['contents', 'main', 0, 'kind'], 'plasma', 'layer 1 of "main": "kind" must be "liquid", "powder", "lumps", "gas"'],
    ['beaker1', ['contents', 'main', 0, 'amount'], 1.2, 'layer 1 of "main": "amount" must be a number from 0 to 1'],
    ['beaker1', ['contents', 'main', 0, 'amount'], -0.1, '"amount" must be a number from 0 to 1'],
    ['beaker1', ['contents', 'main', 0, 'colour'], '#fff', '"colour" must be a colour'],
    ['beaker1', ['contents', 'main', 0, 'colour'], 'blue', '"colour" must be a colour'],
    ['beaker1', ['contents', 'main', 0, 'colour'], '#cfe8fg', '"colour" must be a colour'],
    ['beaker1', ['contents', 'main', 0, 'bubbles'], 'lots', '"bubbles" must be "none", "few", "many"'],
    ['beaker1', ['contents', 'main', 0, 'cloudy'], 'yes', '"cloudy" must be true or false'],
    ['beaker1', ['locked'], 'yes', '"locked" must be true or false'],
    ['beaker1', ['group'], 3, '"group" must be a name'],
    ['beaker1', ['id'], 'other', 'its "id" must be "beaker1"'],
    ['beaker1', ['type'], 'image', '"type" must be "symbol", "connector", "label" or "shape"'],
    ['glassTube2', ['kind'], 'hose', '"kind" must be'],
    ['glassTube2', ['points'], [{ x: 0, y: 0 }], '"points" must be a list of two points or more'],
    ['glassTube2', ['points'], 'M0 0L1 1', '"points" must be a list'],
    ['glassTube2', ['points', 1], 7, 'point 2: it must be a point'],
    ['glassTube2', ['points', 1, 'x'], '100', 'point 2: "x" must be a number'],
    ['glassTube2', ['points', 1, 'r'], -3, 'point 2: "r" must be a number from 0'],
    ['glassTube2', ['width'], 0, '"width" must be a number above 0'],
    ['glassTube2', ['dash'], 1, '"dash" must be true or false'],
    ['glassTube2', ['endCap'], 'open', '"endCap" must be "none", "arrow", "closed", "tick", "dot"'],
    ['glassTube2', ['startCap'], undefined, '"startCap" must be'],
    ['label4', ['text'], 5, '"text" must be text'],
    ['label4', ['side'], 'up', '"side" must be "left", "right"'],
    ['label4', ['leaderEnd'], 'circle', '"leaderEnd" must be "none", "arrow", "dot"'],
    ['label4', ['size'], 0, '"size" must be a number above 0'],
    ['label4', ['smart'], 1, '"smart" must be true or false'],
    ['label4', ['target'], 'there', '"target" must be a point'],
    ['label4', ['target', 'x'], 'a', '"target": "x" must be a number'],
    ['label3', ['target', 'lx'], undefined, '"target": "lx" must be a number'],
    ['label3', ['target', 'item'], '', '"target": "item" must be a name'],
    ['shape9', ['shape'], 'star', '"shape" must be "rect", "ellipse"'],
    ['shape9', ['fill'], 'red', '"fill" must be "none", "paper", "grey"'],
    ['shape9', ['w'], 0, '"w" must be a number above 0'],
    ['shape9', ['dash'], undefined, '"dash" must be true or false'],
    ['shape9', ['rot'], 'none', '"rot" must be a number'],
  ]
  for (const [id, path, value, says] of cases) {
    it(`${id}.${path.join('.')} = ${JSON.stringify(value)}`, () => {
      const raw = base()
      let o = raw.items[id]
      for (const k of path.slice(0, -1)) o = o[k]
      const last = path[path.length - 1]
      if (value === undefined) delete o[last]
      else o[last] = value
      const r = parsed(raw)
      expect(r.doc.items[id]).toBeUndefined()
      expect(r.doc.order).toEqual(IDS.filter((x) => x !== id))
      // The item is listed by its id and what it is. A label fixed to a dropped symbol stays as plain text, and is listed.
      const mine = r.problems.filter((p) => p.startsWith(`Left out item "${id}"`))
      expect(mine).toHaveLength(1)
      expect(mine[0]).toContain(says)
      expect(r.problems).toHaveLength(id === 'beaker1' ? 2 : 1)
      // Everything else is still there.
      for (const other of IDS) if (other !== id) expect(r.doc.items[other]).toBeDefined()
    })
  }

  it('an item that is not an object, or listed under a name that is not an id', () => {
    const raw = base()
    raw.items.extra = 5
    raw.items[''] = { id: '', type: 'shape', shape: 'rect' }
    const r = parsed(raw)
    expect(r.doc.items.extra).toBeUndefined()
    expect(r.problems).toContain('Left out item "extra" (item): it is not an item.')
    expect(r.problems).toContain('Left out item "" (rect): its id is not a name.')
  })

  it('names the item in a way a teacher can find it', () => {
    const raw = base()
    raw.items.beaker1.w = 0
    raw.items.label4.side = 'up'
    raw.items.glassTube2.kind = 'hose'
    const r = parsed(raw)
    expect(r.problems).toContain('Left out item "beaker1" (beaker): "w" must be a number above 0.')
    expect(r.problems).toContain('Left out item "label4" (label "free"): "side" must be "left", "right".')
    expect(r.problems).toContain('Left out item "glassTube2" (hose): "kind" must be "glassTube", "rubberTube", "wire", "line".')
  })
})

describe('parseDoc: repairs', () => {
  it('colours are # and six hex digits', () => {
    for (const c of ['#cfe8f7', '#ABCDEF', '#aBc012']) expect(COLOUR.test(c), c).toBe(true)
    for (const c of ['#abc', 'cfe8f7', '#cfe8f7 ', ' #cfe8f7', '#cfe8f77', 'rgb(1,2,3)', '#ggg000']) expect(COLOUR.test(c), c).toBe(false)
  })

  it('a symbol size outside 1 to 5000 u takes the size of its definition, and is listed', () => {
    expect(SYMBOL_SIZE).toEqual({ min: 1, max: 5000 })
    // A thermometer of 1e9 u took the browser two minutes to draw and then crashed it.
    const raw = base()
    raw.items.beaker1.h = 1e9
    raw.items.beaker1.w = 5000.5
    const r = parsed(raw)
    expect(r.doc.items.beaker1).toMatchObject({ w: 100, h: 120 })
    expect(r.problems).toEqual([
      'The width of the part "beaker1" (beaker) was 5000.5, outside 1 to 5000 u: it is now 100.',
      'The height of the part "beaker1" (beaker) was 1000000000, outside 1 to 5000 u: it is now 120.',
    ])
    // Below 1 as well, and the rest of the item is as it was.
    const small = base()
    small.items.beaker1.w = 0.5
    const s = parsed(small)
    expect(s.doc.items.beaker1).toMatchObject({ w: 100, h: 120, contents: small.items.beaker1.contents })
    expect(s.problems).toEqual(['The width of the part "beaker1" (beaker) was 0.5, outside 1 to 5000 u: it is now 100.'])
    // 1 and 5000 are allowed.
    const edge = base()
    edge.items.beaker1.w = 1
    edge.items.beaker1.h = 5000
    const e = parsed(edge)
    expect(e.problems).toEqual([])
    expect(e.doc.items.beaker1).toMatchObject({ w: 1, h: 5000 })
    // 0, negative numbers and what is no number leave the item out, as before.
    const zero = base()
    zero.items.beaker1.h = 0
    expect(parsed(zero).doc.items.beaker1).toBeUndefined()
    // A symbol that is not known has no size of its own to fall back to: the item is left out, and listed.
    const unknown = base()
    unknown.items.beaker1.symbol = 'fromTheFuture'
    unknown.items.beaker1.w = 1e9
    const u = parsed(unknown)
    expect(u.doc.items.beaker1).toBeUndefined()
    expect(u.problems).toContain('Left out item "beaker1" (fromTheFuture): "w" must be from 1 to 5000.')
    // The note is for an item that is kept: when the item is left out for another field, only that is said.
    const both = base()
    both.items.beaker1.w = 1e9
    both.items.beaker1.x = 'far'
    const b = parsed(both)
    expect(b.doc.items.beaker1).toBeUndefined()
    expect(b.problems.filter((p) => p.includes('beaker1') && p.includes('outside 1 to 5000'))).toEqual([])
    // Every template is within the limits, and so is the demo.
    for (const t of TEMPLATES) {
      const doc = t.build()
      for (const it of Object.values(doc.items)) if (it.type === 'symbol') expect(Math.max(it.w, it.h), `${t.id} ${it.id}`).toBeLessThanOrEqual(5000)
    }
  })

  it('a gas layer that is not last moves to the end; the other layers keep their order', () => {
    const raw = base()
    raw.items.beaker1.contents = {
      main: [
        { kind: 'gas', amount: 0, colour: '#e3efc1' },
        { kind: 'powder', amount: 0.1, colour: '#f1f1f1' },
        { kind: 'liquid', amount: 0.4, colour: '#cfe8f7' },
      ],
      other: [
        { kind: 'liquid', amount: 0.2, colour: '#cfe8f7' },
        { kind: 'gas', amount: 1, colour: '#cfa27a' },
      ],
    }
    const r = parsed(raw)
    expect(r.problems).toEqual([])
    const c = (r.doc.items.beaker1 as SymbolItem).contents
    expect(c.main.map((l) => l.kind)).toEqual(['powder', 'liquid', 'gas'])
    expect(c.main[2]).toEqual({ kind: 'gas', amount: 0, colour: '#e3efc1' })
    expect(c.other.map((l) => l.kind)).toEqual(['liquid', 'gas'])
  })

  it('a leader fixed to an item that is not a symbol of the document makes the label plain text', () => {
    const missing = base()
    missing.items.label3.target.item = 'nowhere'
    let r = parsed(missing)
    expect(r.doc.items.label3).toEqual({ ...missing.items.label3, target: undefined })
    expect('target' in r.doc.items.label3).toBe(false)
    expect(r.problems).toEqual(['The leader of the label "beaker" ended on a part that is not in the diagram: the label is now plain text.'])
    const connector = base()
    connector.items.label3.target.item = 'glassTube2'
    r = parsed(connector)
    expect((r.doc.items.label3 as LabelItem).target).toBeUndefined()
    // The beaker is left out for a bad field: its label stays, as plain text.
    const dropped = base()
    dropped.items.beaker1.w = 'wide'
    r = parsed(dropped)
    expect(r.doc.items.label3).toMatchObject({ text: 'beaker', x: 120, y: 0 })
    expect((r.doc.items.label3 as LabelItem).target).toBeUndefined()
    expect(r.problems).toHaveLength(2)
    // A free target is a point: it needs no item.
    expect(r.doc.items.label4).toMatchObject({ target: { x: 10, y: 10 } })
  })

  it('the draw order loses ids of no item, repeats and non-ids; an item missing from it is drawn on top', () => {
    const raw = base()
    raw.order = ['ghost', 'beaker1', 'beaker1', 7, null, 'label3', 'glassTube2', 'label4', 'label5']
    const r = parsed(raw)
    expect(r.doc.order).toEqual(['beaker1', 'label3', 'glassTube2', 'label4', 'label5', 'shape9'])
    expect(r.problems).toEqual(['One item was missing from the draw order: it is drawn on top.'])
    raw.order = []
    expect(parsed(raw).problems).toEqual(['6 items were missing from the draw order: they are drawn on top.'])
  })

  it('a bad title or setting takes the default and is listed; good settings stay', () => {
    const raw = base()
    raw.title = 5
    raw.settings = { mono: true, labelMode: 'words', labelSize: -1, smartText: 'yes' }
    let r = parsed(raw)
    expect(r.doc.title).toBe('Untitled diagram')
    expect(r.doc.settings).toEqual({ mono: true, labelMode: 'text', labelSize: 15, smartText: true })
    expect(r.problems).toEqual([
      'The diagram had no title: it is now "Untitled diagram".',
      'The setting "labelMode" was not valid: it is now "text".',
      'The setting "labelSize" was not valid: it is now 15.',
      'The setting "smartText" was not valid: it is now on.',
    ])
    raw.title = 'Kept'
    raw.settings = { labelMode: 'letters', labelSize: 18 }
    r = parsed(raw)
    expect(r.doc.title).toBe('Kept')
    expect(r.doc.settings).toEqual({ mono: false, labelMode: 'letters', labelSize: 18, smartText: true })
    expect(r.problems).toEqual(['The setting "mono" was missing: it is now off.', 'The setting "smartText" was missing: it is now on.'])
  })

  it('a key named __proto__ changes nothing: the item is left out', () => {
    const text = JSON.stringify(base()).replace('"items":{', '"items":{"__proto__":{"id":"__proto__","type":"shape","shape":"rect","polluted":true},')
    const r = parsed(JSON.parse(text))
    expect(r.problems).toContain('Left out item "__proto__" (rect): its id is not a name.')
    expect(Object.getPrototypeOf(r.doc.items)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    const params = JSON.parse(JSON.stringify(base()).replace('"params":{}', '"params":{"__proto__":{"x":1}}'))
    const p = parsed(params)
    expect(p.doc.items.beaker1).toBeUndefined()
    expect(p.problems[0]).toContain('"params" has an entry named "__proto__"')
  })
})

describe('parseDoc: versions', () => {
  it('runs the migrations before it checks a field', () => {
    // A made-up format 2 that renamed `items` to `parts`: the migration from 1 runs first, so the items are found.
    const raw = { ...base(), parts: base().items, items: undefined }
    expect(parseDoc(json(raw)).ok).toBe(false)
    const migrations = { 1: (d: Raw) => ({ ...d, items: d.parts }) }
    const r = parseDoc(json(raw), migrations, 2)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.doc.order).toEqual(IDS)
  })

  it('a file from a newer version opens, with a problem that says so', () => {
    const raw = { ...base(), version: 3 }
    const r = parsed(raw)
    expect(r.doc.version).toBe(1)
    expect(r.doc.order).toEqual(IDS)
    expect(r.problems).toEqual(['The file was made by a newer version of PracDraw (format 3). Anything that this version does not know is left out.'])
  })
})

describe('parseDoc never throws', () => {
  it('on any value made from a good file by random damage', () => {
    const rand = rng(7)
    const junk = [null, 0, -1, 1e9, NaN, '', 'x', '#cfe8f7', true, false, [], {}, [1, 2], { x: 1, y: 2 }]
    const paths = (o: unknown, at: (string | number)[] = []): (string | number)[][] =>
      o && typeof o === 'object'
        ? Object.entries(o).flatMap(([k, v]) => [[...at, Array.isArray(o) ? Number(k) : k], ...paths(v, [...at, Array.isArray(o) ? Number(k) : k])])
        : []
    const all = paths(base())
    for (let n = 0; n < 400; n++) {
      const raw = base()
      for (let k = 0; k < 3; k++) {
        const path = all[Math.floor(rand() * all.length)]
        let o = raw
        for (const key of path.slice(0, -1)) o = o?.[key]
        if (o && typeof o === 'object') o[path[path.length - 1]] = junk[Math.floor(rand() * junk.length)]
      }
      expect(() => parseDoc(raw)).not.toThrow()
      const r = parseDoc(raw)
      if (r.ok) expect(new Set(r.doc.order).size).toBe(Object.keys(r.doc.items).length)
    }
  })
})

describe('parseDocJson', () => {
  it('reads a saved file, with or without a byte order mark; text that is not JSON fails', () => {
    const text = JSON.stringify(demoDoc(), null, 2)
    expect(parseDocJson(text)).toEqual({ ok: true, doc: json(demoDoc()), problems: [] })
    expect(parseDocJson('\uFEFF' + text).ok).toBe(true)
    expect(parseDocJson('{"app":')).toEqual({ ok: false, problems: ['The file does not hold a PracDraw diagram: it is not JSON.'] })
    expect(parseDocJson('[]').ok).toBe(false)
  })
})
