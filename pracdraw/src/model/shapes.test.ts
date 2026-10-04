import { describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { addSymbol, setRotation, setSize } from './commands'
import { SHAPE_FILLS, addShape, dragBox, makeShape, setShape } from './shapes'
import { newDoc, type Doc, type ShapeItem } from './types'

const shape = (doc: Doc, id: string) => doc.items[id] as ShapeItem
const rectDoc = (): Doc => addShape(newDoc(), 'rect', { x: 100, y: 50, w: 80, h: 40 }, 's')

describe('makeShape and addShape', () => {
  it('a new shape has no fill, is not dashed and is upright', () => {
    expect(makeShape('ellipse', { x: 10, y: 20, w: 30, h: 40 }, 'e')).toEqual({
      id: 'e',
      type: 'shape',
      shape: 'ellipse',
      x: 10,
      y: 20,
      w: 30,
      h: 40,
      rot: 0,
      fill: 'none',
      dash: false,
    })
    expect(makeShape('rect', { x: 0, y: 0, w: 0, h: -5 })).toMatchObject({ w: 1, h: 1 })
    expect(makeShape('rect', { x: 0, y: 0, w: 5, h: 5 }).id).toMatch(/^[0-9a-z]{8}$/)
  })
  it('adds it on top', () => {
    const doc = addSymbol(newDoc(), 'beaker', 0, 0, 'b')
    const next = addShape(doc, 'rect', { x: 0, y: 0, w: 10, h: 10 }, 'r')
    expect(next.order).toEqual(['b', 'r'])
    expect(next.items.b).toBe(doc.items.b)
    expect(doc.order).toEqual(['b'])
  })
})

describe('dragBox', () => {
  it('is the box between the two corners of a drag, in any direction', () => {
    expect(dragBox(P(10, 20), P(110, 70))).toEqual({ x: 60, y: 45, w: 100, h: 50 })
    expect(dragBox(P(110, 70), P(10, 20))).toEqual({ x: 60, y: 45, w: 100, h: 50 })
    expect(dragBox(P(10, 70), P(110, 20))).toEqual({ x: 60, y: 45, w: 100, h: 50 })
  })
  it('is at least 1 u each way', () => {
    expect(dragBox(P(0, 0), P(50, 0))).toEqual({ x: 25, y: 0, w: 50, h: 1 })
    expect(dragBox(P(3, 3), P(3, 3))).toEqual({ x: 3, y: 3, w: 1, h: 1 })
  })
  it('with Shift, a square on the longer side that keeps the corner where the drag began', () => {
    expect(dragBox(P(10, 20), P(110, 70), true)).toEqual({ x: 60, y: 70, w: 100, h: 100 })
    expect(dragBox(P(10, 20), P(-30, 25), true)).toEqual({ x: -10, y: 40, w: 40, h: 40 })
    expect(dragBox(P(10, 20), P(-30, -100), true)).toEqual({ x: -50, y: -40, w: 120, h: 120 })
  })
})

describe('setShape', () => {
  it('sets the fill, the dash, the kind, the size and the rotation; the centre stays', () => {
    const doc = rectDoc()
    expect(SHAPE_FILLS).toEqual(['none', 'paper', 'grey'])
    expect(shape(setShape(doc, 's', { fill: 'grey' }), 's').fill).toBe('grey')
    expect(shape(setShape(doc, 's', { fill: 'paper', dash: true }), 's')).toMatchObject({ fill: 'paper', dash: true })
    expect(shape(setShape(doc, 's', { shape: 'ellipse' }), 's').shape).toBe('ellipse')
    expect(shape(setShape(doc, 's', { w: 120, h: 10 }), 's')).toMatchObject({ x: 100, y: 50, w: 120, h: 10 })
    expect(shape(setShape(doc, 's', { rot: -30 }), 's').rot).toBe(330)
    expect(shape(doc, 's')).toMatchObject({ fill: 'none', dash: false, w: 80, rot: 0 })
  })
  it('refuses what a shape cannot have, and gives the same document when nothing changes', () => {
    const doc = rectDoc()
    expect(setShape(doc, 's', { fill: 'blue' as ShapeItem['fill'] })).toBe(doc)
    expect(setShape(doc, 's', { shape: 'star' as ShapeItem['shape'] })).toBe(doc)
    expect(setShape(doc, 's', { w: NaN, h: Infinity, rot: NaN })).toBe(doc)
    expect(shape(setShape(doc, 's', { w: 0, h: -4 }), 's')).toMatchObject({ w: 1, h: 1 })
    expect(setShape(doc, 's', { fill: 'none', dash: false, w: 80, h: 40, rot: 360 })).toBe(doc)
    expect(setShape(doc, 's', {})).toBe(doc)
    expect(setShape(doc, 'nothing', { fill: 'grey' })).toBe(doc)
    const b = addSymbol(doc, 'beaker', 0, 0, 'b')
    expect(setShape(b, 'b', { fill: 'grey' })).toBe(b)
  })
  it('the resize and rotate handles of a shape use the symbol commands', () => {
    const doc = rectDoc()
    expect(shape(setSize(doc, 's', { w: 60, h: 30, x: 90, y: 45 }), 's')).toMatchObject({ x: 90, y: 45, w: 60, h: 30 })
    expect(shape(setRotation(doc, 's', 45), 's').rot).toBe(45)
  })
})
