import { describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { demoDoc } from '../demo'
import { estimateBounds } from '../render/render'
import { geometry } from '../symbols/registry'
import { DocBuilder } from './build'
import { boxCentre, boxesTouch, docBox, itemBox, itemsBox, labelTarget, localBox, unionBox } from './bounds'

describe('itemBox', () => {
  it('a symbol box follows the drawing, turned', () => {
    const b = new DocBuilder()
    const up = b.symbol('beaker', { x: 100, y: 100 })
    const box = itemBox(b.doc, up)
    // The beaker is 100 wide with lips that stick out, 120 high, centred on (100, 100).
    expect(box.x0).toBeLessThan(50)
    expect(box.x1).toBeGreaterThan(150)
    expect(box.y0).toBeCloseTo(38, 0)
    expect(box.y1).toBeCloseTo(162, 0)
    const turned = b.symbol('beaker', { x: 100, y: 100, rot: 90 })
    const t = itemBox(b.doc, turned)
    expect(t.x0).toBeCloseTo(38, 0)
    expect(t.x1).toBeCloseTo(162, 0)
  })
  it('connector, shape and label boxes', () => {
    const b = new DocBuilder()
    const wire = b.connector('wire', [P(0, 0), P(50, 20)])
    expect(itemBox(b.doc, wire)).toEqual({ x0: -2, y0: -2, x1: 52, y1: 22 })
    const tube = b.connector('glassTube', [P(0, 0), P(50, 0)])
    expect(itemBox(b.doc, tube).y1).toBe(4.5)
    b.doc.items.s = { id: 's', type: 'shape', shape: 'rect', x: 0, y: 0, w: 20, h: 10, rot: 90, fill: 'none', dash: false }
    const s = itemBox(b.doc, b.doc.items.s)
    expect(s.x0).toBeCloseTo(-6)
    expect(s.y1).toBeCloseTo(11)
    const right = b.label('abcd', 10, 20)
    expect(itemBox(b.doc, right)).toMatchObject({ x0: 10, y0: 5, x1: 10 + 4 * 15 * 0.56 })
    const left = b.label('abcd', 10, 20, P(100, 0), { side: 'left' })
    const lb = itemBox(b.doc, left)
    expect(lb.x0).toBeCloseTo(10 - 4 * 15 * 0.56)
    expect(lb.x1).toBe(102)
    expect(lb.y0).toBe(-2)
    const measured = itemBox(b.doc, right, () => 300)
    expect(measured.x1).toBe(310)
  })
  it('a label in blank or letters mode changes only with a leader', () => {
    const b = new DocBuilder()
    const sym = b.symbol('beaker')
    const fixed = b.label('a very long label', 200, 0, [sym, 0, 0])
    const plain = b.label('a very long label', 200, 100)
    b.doc.settings.labelMode = 'blank'
    expect(itemBox(b.doc, fixed).x1).toBe(300)
    expect(itemBox(b.doc, plain).x1).toBeCloseTo(200 + 17 * 15 * 0.56)
    b.doc.settings.labelMode = 'letters'
    expect(itemBox(b.doc, fixed).x1).toBeCloseTo(200 + 15 * 0.56)
    expect(labelTarget(b.doc, fixed)).toEqual({ x: 0, y: -60 })
    expect(labelTarget(b.doc, plain)).toBeNull()
    b.doc.items.ghost = { ...fixed, id: 'ghost', target: { item: 'gone', lx: 0, ly: 0 } }
    expect(labelTarget(b.doc, b.doc.items.ghost as typeof fixed)).toBeNull()
  })
  it('localBox is cached per geometry', () => {
    const g = geometry('beaker', 100, 120)
    expect(localBox(g)).toBe(localBox(g))
  })
})

describe('itemsBox and docBox', () => {
  it('agree with estimateBounds on the demo', () => {
    const doc = demoDoc()
    const b = docBox(doc)!
    const e = estimateBounds(doc, 0)
    // The two estimates differ only in the allowance for symbol text and line width.
    expect(Math.abs(b.x0 - e.x)).toBeLessThan(6)
    expect(Math.abs(b.y0 - e.y)).toBeLessThan(6)
    expect(Math.abs(b.x1 - (e.x + e.w))).toBeLessThan(6)
    expect(Math.abs(b.y1 - (e.y + e.h))).toBeLessThan(6)
    expect(itemsBox(doc, ['nothing'])).toBeNull()
    expect(docBox(new DocBuilder().doc)).toBeNull()
  })
  it('helpers', () => {
    expect(unionBox(null, null)).toBeNull()
    expect(unionBox({ x0: 0, y0: 0, x1: 1, y1: 1 }, null)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 })
    expect(unionBox({ x0: 0, y0: 0, x1: 1, y1: 1 }, { x0: -1, y0: 2, x1: 0, y1: 3 })).toEqual({ x0: -1, y0: 0, x1: 1, y1: 3 })
    expect(boxCentre({ x0: 0, y0: 0, x1: 4, y1: 2 })).toEqual({ x: 2, y: 1 })
    expect(boxesTouch({ x0: 0, y0: 0, x1: 4, y1: 2 }, { x0: 4, y0: 2, x1: 5, y1: 5 })).toBe(true)
    expect(boxesTouch({ x0: 0, y0: 0, x1: 4, y1: 2 }, { x0: 5, y0: 2, x1: 6, y1: 5 })).toBe(false)
  })
})
