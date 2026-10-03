import { describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { TEMPLATES } from '../templates'
import { DocBuilder } from './build'
import { itemsBox, boxCentre } from './bounds'
import {
  addItem,
  addSymbol,
  cloneItems,
  deleteItems,
  duplicateItems,
  expandGroups,
  flipItems,
  groupItems,
  insertItems,
  insertTemplate,
  labelsOn,
  makeSymbol,
  moveItems,
  newId,
  normRot,
  reorderItems,
  rotateItems,
  setFlip,
  setItem,
  setLocked,
  setParams,
  setRotation,
  setSettings,
  setSize,
  setTitle,
  shiftItems,
  ungroupItems,
  unlockAll,
} from './commands'
import { toWorld } from './transform'
import { newDoc, type Doc, type LabelItem, type SymbolItem } from './types'

const heatingBeaker = () => TEMPLATES.find((t) => t.id === 'heatingBeaker')!.build()

/** A deterministic id generator for tests. */
const gen = () => {
  let n = 0
  return () => `new${++n}`
}

function sample(): Doc {
  const b = new DocBuilder('Sample')
  const beaker = b.symbol('beaker', { x: 100, y: 100 })
  b.symbol('tripod', { x: 100, y: 200 })
  b.connector('wire', [P(0, 0), P(50, 0)])
  b.label('beaker', 200, 80, [beaker, 50, 60])
  b.label('free', 300, 300, P(250, 250))
  return b.doc
}

const sym = (doc: Doc, id: string) => doc.items[id] as SymbolItem
const lab = (doc: Doc, id: string) => doc.items[id] as LabelItem

describe('newId', () => {
  it('is 8 characters of base 36 and different each time', () => {
    const ids = new Set(Array.from({ length: 200 }, newId))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(/^[0-9a-z]{8}$/)
  })
})

describe('add and insert', () => {
  it('adds a symbol at its default size on top and keeps the input unchanged', () => {
    const doc = newDoc()
    const next = addSymbol(doc, 'beaker', 10, 20, 'b1')
    expect(doc.order).toEqual([])
    expect(next.order).toEqual(['b1'])
    expect(sym(next, 'b1')).toMatchObject({ type: 'symbol', symbol: 'beaker', x: 10, y: 20, w: 100, h: 120, rot: 0, flip: false, params: {}, contents: {} })
    expect(makeSymbol('beaker', 0, 0).id).toMatch(/^[0-9a-z]{8}$/)
  })
  it('addItem replaces an item with the same id in place', () => {
    const doc = sample()
    const next = addItem(doc, { ...sym(doc, 'beaker1'), x: 999 })
    expect(next.order).toEqual(doc.order)
    expect(sym(next, 'beaker1').x).toBe(999)
  })
  it('shiftItems moves free label targets with the text and leaves fixed targets alone', () => {
    const doc = sample()
    const [free, fixed, wire] = shiftItems([doc.items.label5, doc.items.label4, doc.items.wire3], 10, 5)
    expect((free as LabelItem).target).toEqual({ x: 260, y: 255 })
    expect((fixed as LabelItem).target).toEqual({ item: 'beaker1', lx: 50, ly: 60 })
    expect(wire.type === 'connector' && wire.points[1]).toEqual({ x: 60, y: 5 })
  })
  it('cloneItems gives new ids and rewrites targets and groups inside the set only', () => {
    let doc = sample()
    doc = groupItems(doc, ['beaker1', 'tripod2'], 'g1')
    const items = doc.order.map((id) => doc.items[id])
    const copies = cloneItems(items, gen())
    expect(copies.map((c) => c.id)).toEqual(['new1', 'new2', 'new3', 'new4', 'new5'])
    expect(copies[0].group).toBe('new6')
    expect(copies[1].group).toBe('new6')
    expect((copies[3] as LabelItem).target).toEqual({ item: 'new1', lx: 50, ly: 60 })
    // A label whose target was not copied keeps it.
    const only = cloneItems([doc.items.label4], gen())
    expect((only[0] as LabelItem).target).toEqual({ item: 'beaker1', lx: 50, ly: 60 })
    expect(doc.items.beaker1.id).toBe('beaker1')
  })
  it('insertItems appends moved copies', () => {
    const doc = newDoc()
    const next = insertItems(doc, [makeSymbol('beaker', 0, 0, 'a')], 30, 40)
    expect(next.order).toEqual(['a'])
    expect(sym(next, 'a')).toMatchObject({ x: 30, y: 40 })
  })
  it('a template into an empty diagram keeps its ids and title', () => {
    const tpl = heatingBeaker()
    const next = insertTemplate(newDoc(), tpl, P(0, 0), gen())
    expect(next.order).toEqual(tpl.order)
    expect(next.title).toBe(tpl.title)
  })
  it('a template into a diagram gets new ids, centred on the point, with labels fixed to the new copy', () => {
    const tpl = heatingBeaker()
    const first = insertTemplate(newDoc(), tpl, P(0, 0))
    const next = insertTemplate(first, tpl, P(500, 500), gen())
    expect(next.order.length).toBe(2 * tpl.order.length)
    expect(new Set(next.order).size).toBe(next.order.length)
    expect(next.title).toBe(tpl.title)
    const fresh = next.order.slice(tpl.order.length)
    const c = boxCentre(itemsBox(next, fresh)!)
    expect(c.x).toBeCloseTo(500, 6)
    expect(c.y).toBeCloseTo(500, 6)
    for (const id of fresh) {
      const it = next.items[id]
      if (it.type === 'label' && it.target && 'item' in it.target) expect(fresh).toContain(it.target.item)
    }
  })
})

describe('move, delete, duplicate', () => {
  it('moves symbols, connectors and labels and shares what did not move', () => {
    const doc = sample()
    const next = moveItems(doc, ['beaker1', 'wire3', 'label5'], 5, -5)
    expect(sym(next, 'beaker1')).toMatchObject({ x: 105, y: 95 })
    expect(next.items.tripod2).toBe(doc.items.tripod2)
    expect(lab(next, 'label5').target).toEqual({ x: 255, y: 245 })
    expect(moveItems(doc, ['beaker1'], 0, 0)).toBe(doc)
  })
  it('deleting a symbol turns the labels fixed to it into free points where they were', () => {
    const doc = sample()
    const was = toWorld(sym(doc, 'beaker1'), P(50, 60))
    const next = deleteItems(doc, ['beaker1'])
    expect(next.order).toEqual(['tripod2', 'wire3', 'label4', 'label5'])
    expect(next.items.beaker1).toBeUndefined()
    expect(lab(next, 'label4').target).toEqual({ x: was.x, y: was.y })
    expect(deleteItems(doc, ['nothing'])).toBe(doc)
  })
  it('duplicates on top with an offset and new ids', () => {
    const doc = sample()
    const next = duplicateItems(doc, ['label4', 'beaker1'], 20, 20, gen())
    expect(next.order).toEqual([...doc.order, 'new1', 'new2'])
    expect(sym(next, 'new1')).toMatchObject({ symbol: 'beaker', x: 120, y: 120 })
    expect(lab(next, 'new2').target).toEqual({ item: 'new1', lx: 50, ly: 60 })
    expect(duplicateItems(doc, [], 20, 20)).toBe(doc)
  })
})

describe('reorder', () => {
  const doc = (): Doc => {
    const b = new DocBuilder()
    for (const s of ['beaker', 'tripod', 'gauze', 'bung']) b.symbol(s)
    return b.doc
  }
  it('front and back', () => {
    expect(reorderItems(doc(), ['tripod2'], 'front').order).toEqual(['beaker1', 'gauze3', 'bung4', 'tripod2'])
    expect(reorderItems(doc(), ['gauze3', 'tripod2'], 'back').order).toEqual(['tripod2', 'gauze3', 'beaker1', 'bung4'])
    const d = doc()
    expect(reorderItems(d, ['bung4'], 'front')).toBe(d)
  })
  it('forward and backward one step, keeping a block together', () => {
    expect(reorderItems(doc(), ['beaker1'], 'forward').order).toEqual(['tripod2', 'beaker1', 'gauze3', 'bung4'])
    expect(reorderItems(doc(), ['beaker1', 'tripod2'], 'forward').order).toEqual(['gauze3', 'beaker1', 'tripod2', 'bung4'])
    expect(reorderItems(doc(), ['bung4'], 'backward').order).toEqual(['beaker1', 'tripod2', 'bung4', 'gauze3'])
    const d = doc()
    expect(reorderItems(d, ['beaker1'], 'backward')).toBe(d)
  })
})

describe('size, rotation, flip', () => {
  it('setSize scales fixed label targets and never goes below min', () => {
    const doc = sample()
    const next = setSize(doc, 'beaker1', { w: 200, h: 60, x: 150, y: 70 })
    expect(sym(next, 'beaker1')).toMatchObject({ w: 200, h: 60, x: 150, y: 70 })
    expect(lab(next, 'label4').target).toEqual({ item: 'beaker1', lx: 100, ly: 30 })
    expect(lab(next, 'label5')).toBe(doc.items.label5)
    const small = setSize(doc, 'beaker1', { w: 1, h: 1 })
    expect(sym(small, 'beaker1')).toMatchObject({ w: 40, h: 40 })
    expect(setSize(doc, 'wire3', { w: 5, h: 5 })).toBe(doc)
    expect(setSize(doc, 'beaker1', { w: 100, h: 120 })).toBe(doc)
  })
  it('setRotation normalises to [0, 360)', () => {
    const doc = sample()
    expect(sym(setRotation(doc, 'beaker1', -90), 'beaker1').rot).toBe(270)
    expect(sym(setRotation(doc, 'beaker1', 450), 'beaker1').rot).toBe(90)
    expect(setRotation(doc, 'wire3', 90)).toBe(doc)
    expect(normRot(360)).toBe(0)
  })
  it('rotateItems turns every item about a point', () => {
    const doc = sample()
    const next = rotateItems(doc, ['beaker1', 'wire3', 'label5'], 90, P(100, 100))
    expect(sym(next, 'beaker1')).toMatchObject({ x: 100, y: 100, rot: 90 })
    const w = next.items.wire3
    expect(w.type === 'connector' && w.points[0].x).toBeCloseTo(200)
    expect(w.type === 'connector' && w.points[0].y).toBeCloseTo(0)
    expect(w.type === 'connector' && w.points[1].x).toBeCloseTo(200)
    expect(w.type === 'connector' && w.points[1].y).toBeCloseTo(50)
    const l = lab(next, 'label5')
    expect(l.x).toBeCloseTo(-100)
    expect(l.y).toBeCloseTo(300)
    expect(l.target).toMatchObject({ x: expect.closeTo(-50, 6), y: expect.closeTo(250, 6) })
    expect(rotateItems(doc, ['beaker1'], 0, P(0, 0))).toBe(doc)
  })
  it('setFlip and flipItems', () => {
    const doc = setRotation(sample(), 'beaker1', 30)
    expect(sym(setFlip(doc, 'beaker1', true), 'beaker1').flip).toBe(true)
    expect(setFlip(doc, 'beaker1', false)).toBe(doc)
    // A mirror about x = 150: the beaker lands at 200, turned the other way, flipped.
    const next = flipItems(doc, ['beaker1', 'label4', 'wire3'], 150)
    expect(sym(next, 'beaker1')).toMatchObject({ x: 200, rot: 330, flip: true })
    expect(lab(next, 'label4')).toMatchObject({ x: 100, side: 'left' })
    const w = next.items.wire3
    expect(w.type === 'connector' && w.points.map((p) => p.x)).toEqual([300, 250])
    // The label target stays on the same part of the mirrored beaker, mirrored in the world.
    const before = toWorld(sym(doc, 'beaker1'), P(50, 60)),
      after = toWorld(sym(next, 'beaker1'), P(50, 60))
    expect(after.x).toBeCloseTo(300 - before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
})

describe('fields', () => {
  it('setParams stores only values that differ from the defaults', () => {
    const doc = sample()
    const on = setParams(doc, 'beaker1', { graduations: true, spout: true })
    expect(sym(on, 'beaker1').params).toEqual({ graduations: true })
    const off = setParams(on, 'beaker1', { graduations: false })
    expect(sym(off, 'beaker1').params).toEqual({})
    expect(setParams(doc, 'wire3', { a: 1 })).toBe(doc)
  })
  it('setItem, setSettings, setTitle', () => {
    const doc = sample()
    expect(lab(setItem<LabelItem>(doc, 'label4', { text: 'glass', side: 'left' }), 'label4')).toMatchObject({ text: 'glass', side: 'left' })
    expect(setSettings(doc, { mono: true }).settings).toEqual({ ...doc.settings, mono: true })
    expect(setTitle(doc, 'New').title).toBe('New')
    expect(setTitle(doc, 'Sample')).toBe(doc)
  })
  it('lock, unlock all, group, ungroup, expandGroups', () => {
    let doc = sample()
    doc = setLocked(doc, ['beaker1'], true)
    expect(doc.items.beaker1.locked).toBe(true)
    expect(unlockAll(doc).items.beaker1.locked).toBeUndefined()
    doc = groupItems(doc, ['beaker1', 'tripod2'], 'g')
    expect(doc.items.beaker1.group).toBe('g')
    expect(expandGroups(doc, ['tripod2', 'label5'])).toEqual(['beaker1', 'tripod2', 'label5'])
    expect(groupItems(doc, ['beaker1'])).toBe(doc)
    const un = ungroupItems(doc, ['beaker1'])
    expect(un.items.beaker1.group).toBeUndefined()
    expect(un.items.tripod2.group).toBe('g')
    expect(ungroupItems(un, ['beaker1'])).toBe(un)
    expect(labelsOn(doc, 'beaker1').map((l) => l.id)).toEqual(['label4'])
  })
})
