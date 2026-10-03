import { describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { DocBuilder } from './build'
import { insideCavity, orderRule } from './order'
import type { Doc, SymbolItem } from './types'

/** A thermometer behind a beaker, its centre inside the beaker's cavity. Ids: thermometer1, beaker2. */
function dropped(): Doc {
  const b = new DocBuilder()
  b.symbol('thermometer', { x: 100, y: 100 })
  b.symbol('beaker', { x: 100, y: 120 })
  return b.doc
}

describe('insideCavity', () => {
  it('is true for a point inside a cavity, in the item as it stands', () => {
    const b = new DocBuilder()
    const beaker = b.symbol('beaker', { x: 100, y: 100 }) // box 100 × 120: x 50 to 150, y 40 to 160; cavity from 1.5 u below the rim
    expect(insideCavity(beaker, P(100, 100))).toBe(true)
    expect(insideCavity(beaker, P(100, 41))).toBe(false)
    expect(insideCavity(beaker, P(160, 100))).toBe(false)
    const turned: SymbolItem = { ...beaker, rot: 90 } // the mouth faces right: x 40 to 160, y 50 to 150
    expect(insideCavity(turned, P(155, 100))).toBe(true)
    expect(insideCavity(turned, P(159, 100))).toBe(false)
    expect(insideCavity(turned, P(100, 45))).toBe(false)
  })
  it('is false outside the cavity but inside the box, and for a symbol with no cavity', () => {
    const b = new DocBuilder()
    const flask = b.symbol('conicalFlask', { x: 0, y: 0 }) // the neck is 34 u wide at the top of a 110 × 150 box
    expect(insideCavity(flask, P(0, -70))).toBe(true)
    expect(insideCavity(flask, P(40, -65))).toBe(false)
    expect(insideCavity(b.symbol('tripod', { x: 0, y: 0 }), P(0, 0))).toBe(false)
    const unknown: SymbolItem = { ...flask, id: 'x', symbol: 'fromTheFuture' }
    expect(insideCavity(unknown, P(0, 0))).toBe(false)
  })
})

describe('orderRule', () => {
  it('moves a symbol dropped into a cavity to just above that symbol', () => {
    const doc = dropped()
    expect(doc.order).toEqual(['thermometer1', 'beaker2'])
    const next = orderRule(doc, ['thermometer1'])
    expect(next.order).toEqual(['beaker2', 'thermometer1'])
    expect(next.items).toBe(doc.items)
    expect(doc.order).toEqual(['thermometer1', 'beaker2'])
  })
  it('leaves the order when the centre is outside every cavity above, or the symbol is already above', () => {
    const doc = dropped()
    const away: Doc = { ...doc, items: { ...doc.items, thermometer1: { ...(doc.items.thermometer1 as SymbolItem), x: 300 } } }
    expect(orderRule(away, ['thermometer1'])).toBe(away)
    const front: Doc = { ...doc, order: ['beaker2', 'thermometer1'] }
    expect(orderRule(front, ['thermometer1'])).toBe(front)
    expect(orderRule(doc, ['beaker2'])).toBe(doc)
  })
  it('goes just above the topmost symbol whose cavity holds the centre, and no further', () => {
    const b = new DocBuilder()
    b.symbol('thermometer', { x: 100, y: 100 })
    b.symbol('beaker', { x: 100, y: 120, w: 140, h: 160 })
    b.symbol('tripod', { x: 400, y: 100 })
    b.symbol('beaker', { x: 100, y: 120 })
    b.symbol('bunsenBurner', { x: 600, y: 100 })
    const next = orderRule(b.doc, ['thermometer1'])
    expect(next.order).toEqual(['beaker2', 'tripod3', 'beaker4', 'thermometer1', 'bunsenBurner5'])
  })
  it('a symbol that moves with it is not a target, and items that are not symbols do not move', () => {
    const doc = dropped()
    expect(orderRule(doc, ['thermometer1', 'beaker2'])).toBe(doc)
    const b = new DocBuilder()
    const beaker = b.symbol('beaker', { x: 100, y: 120 })
    b.label('beaker', 100, 100, [beaker, 0, 60])
    const withLabel: Doc = { ...b.doc, order: ['label2', 'beaker1'] }
    expect(orderRule(withLabel, ['label2'])).toBe(withLabel)
    expect(orderRule(withLabel, ['missing'])).toBe(withLabel)
  })
})
