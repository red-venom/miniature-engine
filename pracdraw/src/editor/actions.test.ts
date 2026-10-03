import { beforeEach, describe, expect, it } from 'vitest'
import { itemBox } from '../model/bounds'
import { DocBuilder } from '../model/build'
import { WATER } from '../model/contents'
import type { Doc, SymbolItem } from '../model/types'
import { addSymbolAt, alignSelection, amountSlider, cavityWater, distributeSelection, groupSelection, nudge, reading, select, undo } from './actions'
import { useEditor } from './store'

const s = () => useEditor.getState()
const amount = (id: string) => (s().doc.items[id] as SymbolItem).contents.main?.[0]?.amount

function start(doc: Doc): void {
  s().replace(doc)
}

beforeEach(() => {
  const b = new DocBuilder()
  b.symbol('beaker', { x: 0, y: 0, contents: { main: [{ kind: 'liquid', amount: 0.5, colour: WATER }] } })
  start(b.doc)
})

describe('the amount slider', () => {
  it('a drag is one undo step', () => {
    amountSlider.start()
    for (const a of [0.55, 0.6, 0.7, 0.8]) amountSlider.set('beaker1', 'main', 0, a)
    expect(s().past).toHaveLength(0)
    amountSlider.end()
    expect(s().gesture).toBeNull()
    expect(s().past).toHaveLength(1)
    expect(amount('beaker1')).toBe(0.8)
    undo()
    expect(amount('beaker1')).toBe(0.5)
  })
  it('a change with no drag (a key) commits at once, and quick repeats join', () => {
    amountSlider.set('beaker1', 'main', 0, 0.51)
    amountSlider.set('beaker1', 'main', 0, 0.52)
    expect(s().gesture).toBeNull()
    expect(s().past).toHaveLength(1)
    expect(amount('beaker1')).toBe(0.52)
    amountSlider.end()
    expect(s().past).toHaveLength(1)
  })
})

describe('contents actions', () => {
  it('the Water button and a typed reading are one step each', () => {
    const id = addSymbolAt('measuringCylinder')
    const steps = s().past.length
    reading(id, 37)
    cavityWater(id, 'main')
    expect(s().past.length).toBe(steps + 2)
    expect(amount(id)).toBe(0.5)
    undo()
    expect(amount(id)).not.toBe(0.5)
    undo()
    expect(amount(id)).toBeUndefined()
  })
})

describe('several items: group, lock, align, distribute', () => {
  function three(): Doc {
    const b = new DocBuilder()
    b.symbol('beaker', { x: 0, y: 0 })
    b.symbol('tripod', { x: 300, y: 50 })
    b.symbol('bunsenBurner', { x: 500, y: 100 })
    return b.doc
  }
  it('items that share a group select as one; a locked item is never selected, not even with its group', () => {
    start(three())
    select(['beaker1', 'tripod2'])
    groupSelection()
    select(['tripod2'])
    expect(s().selection).toEqual(['beaker1', 'tripod2'])
    s().commit({ ...s().doc, items: { ...s().doc.items, beaker1: { ...s().doc.items.beaker1, locked: true } } })
    select(['tripod2'])
    expect(s().selection).toEqual(['tripod2'])
    select(['beaker1'])
    expect(s().selection).toEqual([])
  })
  it('align and distribute are one undo step each', () => {
    start(three())
    select(['beaker1', 'tripod2', 'bunsenBurner3'])
    alignSelection('top')
    const tops = s().selection.map((id) => itemBox(s().doc, s().doc.items[id]).y0)
    expect(tops[1]).toBeCloseTo(tops[0], 9)
    expect(tops[2]).toBeCloseTo(tops[0], 9)
    distributeSelection('across')
    expect(s().past).toHaveLength(2)
    undo()
    undo()
    expect(s().doc).toEqual(three())
  })
})

describe('the order rule in the move actions', () => {
  it('an arrow-key move into a beaker brings the thermometer to just above it', () => {
    const b = new DocBuilder()
    b.symbol('thermometer', { x: 200, y: 100 })
    b.symbol('beaker', { x: 100, y: 120 })
    start(b.doc)
    s().select(['thermometer1'])
    nudge(-10, 0)
    expect(s().doc.order).toEqual(['thermometer1', 'beaker2'])
    nudge(-100, 0)
    expect(s().doc.order).toEqual(['beaker2', 'thermometer1'])
  })
})
