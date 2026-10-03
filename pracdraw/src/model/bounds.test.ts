import { describe, expect, it } from 'vitest'
import { P, bounds, pathPolys, type Box } from '../kernel/geom'
import { demoDoc } from '../demo'
import { estimateBounds, labelLetters } from '../render/render'
import { geometry } from '../symbols/registry'
import { DocBuilder } from './build'
import {
  EXPORT_MARGIN,
  boxCentre,
  boxesTouch,
  docBounds,
  docBox,
  drawnBox,
  drawnItemBox,
  estimateWidth,
  itemBox,
  itemsBox,
  labelBox,
  labelTarget,
  letterMap,
  localBox,
  unionBox,
  type Measure,
} from './bounds'
import { setSettings } from './commands'
import { toWorld } from './transform'
import { newDoc, type ConnectorItem, type Doc, type LabelItem, type ShapeItem, type SymbolItem } from './types'

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
  it('labelBox is the label as drawn without its leader', () => {
    const b = new DocBuilder()
    const sym = b.symbol('beaker')
    const fixed = b.label('abcd', 200, 0, [sym, 0, 0]) // the leader ends at (0, −60)
    expect(labelBox(b.doc, fixed)).toEqual({ x0: 200, y0: -15, x1: 200 + 4 * 15 * 0.56, y1: 4.5 })
    expect(itemBox(b.doc, fixed)).toMatchObject({ x0: -2, y0: -62 })
    b.doc.settings.labelMode = 'blank'
    expect(labelBox(b.doc, fixed).x1).toBe(300)
  })
  it('a label is measured as drawn: smart text first, then the measure, which counts scripts at 0.7 size', () => {
    const b = new DocBuilder()
    const co2 = b.label('CO2 gas', 0, 0)
    // The estimate counts what is drawn: "CO", a subscript 2 at 0.7 size, " gas".
    expect(estimateWidth('CO_{2} gas', 10)).toBeCloseTo((6 + 0.7) * 10 * 0.56, 9)
    expect(estimateWidth('a\\_b', 10)).toBeCloseTo(3 * 10 * 0.56, 9)
    expect(labelBox(b.doc, co2).x1).toBeCloseTo((6 + 0.7) * 15 * 0.56, 9)
    const seen: string[] = []
    labelBox(b.doc, co2, (text, size) => {
      seen.push(text)
      return text.length * size
    })
    expect(seen).toEqual(['CO_{2} gas'])
    // Smart text off, for the label or for the document: the text is measured as typed.
    b.doc.items[co2.id] = { ...co2, smart: false }
    expect(labelBox(b.doc, b.doc.items[co2.id] as typeof co2).x1).toBeCloseTo(7 * 15 * 0.56, 9)
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

// ---------------------------------------------------------------- docBounds: the bounds of the export (section 13)

/** Every point of a symbol's paths, flattened finely and taken to the world. */
const drawingPoints = (it: SymbolItem) =>
  geometry(it.symbol, it.w, it.h, it.params)
    .prims.flatMap((p) => pathPolys(p.d, 0.05).flat())
    .map((p) => toWorld(it, p))

const expectBox = (got: Box | null, want: Box, digits = 9) => {
  expect(got).not.toBeNull()
  for (const k of ['x0', 'y0', 'x1', 'y1'] as const) expect(got![k], k).toBeCloseTo(want[k], digits)
}

/** A measure that records what it measures: 10 u for each character. */
function recorder() {
  const seen: [string, number][] = []
  const measure: Measure = (text, size) => {
    seen.push([text, size])
    return text.length * 10
  }
  return { seen, measure }
}

describe('docBounds', () => {
  it('adds 16 u on each side of everything that is drawn; an empty diagram gives the margin round the origin', () => {
    expect(EXPORT_MARGIN).toBe(16)
    expect(drawnBox(newDoc())).toBeNull()
    expect(docBounds(newDoc())).toEqual({ x: -16, y: -16, w: 32, h: 32 })
    const b = new DocBuilder()
    b.connector('wire', [P(0, 0), P(100, 50)])
    expect(docBounds(b.doc)).toEqual({ x: -17, y: -17, w: 134, h: 84 })
  })

  it('a symbol is its paths, each line reaching half its width outside them', () => {
    const b = new DocBuilder()
    const beaker = b.symbol('beaker', { x: 100, y: 100 })
    const exact = bounds(drawingPoints(beaker))
    // The beaker's widest line is its 2 u outline.
    expectBox(drawnItemBox(b.doc, beaker), { x0: exact.x0 - 1, y0: exact.y0 - 1, x1: exact.x1 + 1, y1: exact.y1 + 1 })
    // A tripod's top is a 3 u line.
    const tripod = b.symbol('tripod', { x: 0, y: 0 })
    const t = bounds(drawingPoints(tripod))
    expectBox(drawnItemBox(b.doc, tripod), { x0: t.x0 - 1.5, y0: t.y0 - 1.5, x1: t.x1 + 1.5, y1: t.y1 + 1.5 })
  })

  it('a turned symbol is bounded by its turned drawing, which is tighter than its turned box', () => {
    // Curves are flattened 0.05 u from the true curve, so a turned curve's extreme is good to that.
    const b = new DocBuilder()
    const flask = b.symbol('conicalFlask', { x: 40, y: -30, rot: 45 })
    const exact = bounds(drawingPoints(flask))
    expectBox(drawnItemBox(b.doc, flask), { x0: exact.x0 - 1, y0: exact.y0 - 1, x1: exact.x1 + 1, y1: exact.y1 + 1 }, 1)
    const loose = itemBox(b.doc, flask)
    const tight = drawnItemBox(b.doc, flask)!
    expect(tight.x1 - tight.x0).toBeLessThan(loose.x1 - loose.x0 - 10)
    // Flipped and turned: still the drawing itself.
    const flipped = b.symbol('conicalFlask', { x: 0, y: 0, rot: 30, flip: true })
    const f = bounds(drawingPoints(flipped))
    expectBox(drawnItemBox(b.doc, flipped), { x0: f.x0 - 1, y0: f.y0 - 1, x1: f.x1 + 1, y1: f.y1 + 1 }, 1)
  })

  it("a symbol's text is measured, at its anchor, and turns with the symbol", () => {
    const b = new DocBuilder()
    const cyl = b.symbol('measuringCylinder', { x: 0, y: 0, params: { numbers: true } })
    const g = geometry(cyl.symbol, cyl.w, cyl.h, cyl.params)
    expect(g.texts?.length).toBeGreaterThan(3)
    const r = recorder()
    drawnItemBox(b.doc, cyl, r.measure)
    expect(r.seen).toEqual(g.texts!.map((t) => [t.text, t.size]))
    // A very wide measure widens the box on the side the text runs to.
    const wide = drawnItemBox(b.doc, cyl, () => 500)!
    const narrow = drawnItemBox(b.doc, cyl, () => 0)!
    const t = g.texts![0]
    const runsRight = t.anchor === 'start'
    expect(runsRight ? wide.x1 - narrow.x1 : narrow.x0 - wide.x0).toBeGreaterThan(400)
    // An unknown symbol is the kit's dashed box with its id in it: the box and the id, as measured.
    b.doc.items.ghost = { ...cyl, id: 'ghost', symbol: 'fromTheFuture', params: {}, w: 80, h: 60 }
    b.doc.order.push('ghost')
    const ghost = drawnItemBox(b.doc, b.doc.items.ghost, () => 200)!
    expect(ghost.x0).toBeCloseTo(-100, 9) // the id, 200 u wide, centred on the box
    expect(ghost.x1).toBeCloseTo(100, 9)
    expect(ghost.y0).toBeCloseTo(-30 - 0.625, 9)
    expect(ghost.y1).toBeCloseTo(30 + 0.625, 9)
  })

  it('a connector is its centre line widened by half its width, with its caps', () => {
    const b = new DocBuilder()
    const box = (c: ConnectorItem) => drawnItemBox(b.doc, c)
    expect(box(b.connector('wire', [P(0, 0), P(100, 0)]))).toEqual({ x0: -1, y0: -1, x1: 101, y1: 1 })
    expect(box(b.connector('line', [P(0, 0), P(0, 50), { x: 30, y: 50, r: 10 }]))).toEqual({ x0: -0.625, y0: -0.625, x1: 30.625, y1: 50.625 })
    // A tube: half its width and half its wall line.
    expect(box(b.connector('glassTube', [P(0, 0), P(100, 0)]))).toEqual({ x0: -4.5, y0: -4.5, x1: 104.5, y1: 4.5 })
    expect(box(b.connector('rubberTube', [P(0, 0), P(100, 0)], { width: 16 }))).toEqual({ x0: -9, y0: -9, x1: 109, y1: 9 })
    // An arrow head 8 u long at 0.42 rad to each side, a tick 5 u to each side, a dot of radius 2.5.
    const arrow = box(b.connector('line', [P(0, 0), P(100, 0)], { endCap: 'arrow' }))!
    expect(arrow.y0).toBeCloseTo(-8 * Math.sin(0.42), 9)
    expect(arrow.y1).toBeCloseTo(8 * Math.sin(0.42), 9)
    expect(arrow.x1).toBeCloseTo(100.625, 9)
    expect(box(b.connector('line', [P(0, 0), P(100, 0)], { startCap: 'tick', endCap: 'dot' }))).toEqual({ x0: -5.625, y0: -5.625, x1: 102.5, y1: 5.625 })
    // A tube's caps are open or closed ends: no more than its width.
    expect(box(b.connector('glassTube', [P(0, 0), P(100, 0)], { startCap: 'closed' }))).toEqual({ x0: -4.5, y0: -4.5, x1: 104.5, y1: 4.5 })
    // Every point on one spot: drawn as nothing, so not counted.
    const none = b.connector('glassTube', [P(500, 500), P(500, 500)])
    expect(box(none)).toBeNull()
    expect(drawnBox(b.doc)!.x1).toBeLessThan(200)
  })

  it('a shape is its turned rectangle or ellipse with its 2 u line', () => {
    const shape = (s: Partial<ShapeItem>): ShapeItem => ({
      id: 's',
      type: 'shape',
      shape: 'rect',
      x: 0,
      y: 0,
      w: 20,
      h: 10,
      rot: 0,
      fill: 'none',
      dash: false,
      ...s,
    })
    const doc = newDoc()
    expectBox(drawnItemBox(doc, shape({})), { x0: -11, y0: -6, x1: 11, y1: 6 })
    expectBox(drawnItemBox(doc, shape({ rot: 90, x: 5 })), { x0: -1, y0: -11, x1: 11, y1: 11 })
    // An ellipse turned 45°: exactly as far as its curve reaches, which is less than its turned box.
    const e = drawnItemBox(doc, shape({ shape: 'ellipse', w: 40, h: 20, rot: 45 }))!
    expect(e.x1).toBeCloseTo(Math.sqrt(250) + 1, 9)
    expect(e.y1).toBeCloseTo(Math.sqrt(250) + 1, 9)
    expect(drawnItemBox(doc, shape({ rot: 45, w: 40, h: 20 }))!.x1).toBeCloseTo(15 * Math.SQRT2 + 1, 9)
  })

  it('a label is drawn as the label mode draws it, with its target in every mode; plain text is always its text', () => {
    const b = new DocBuilder()
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    const fixed = b.label('glass beaker', 200, 0, [beaker, 0, 60], { side: 'right' }) // the target is (0, 0)
    const other = b.label('water', 200, 40, P(10, 30), { side: 'right', leaderEnd: 'dot' })
    const plain = b.label('title\nsecond line', -200, -100)
    const r = recorder()
    // Text mode: the text box of each line, as measured; the leader start (5 u before the text) and the target.
    let doc: Doc = b.doc
    expectBox(drawnItemBox(doc, fixed, r.measure), { x0: -0.625, y0: -15, x1: 200 + 120, y1: 4.5 })
    expect(r.seen).toEqual([['glass beaker', 15]])
    expectBox(drawnItemBox(doc, other, r.measure), { x0: 10 - 2.5, y0: 25, x1: 250, y1: 44.5 })
    expectBox(drawnItemBox(doc, plain, r.measure), { x0: -200, y0: -115, x1: -200 + 110, y1: -100 + 18.75 + 4.5 })
    // Blank mode: the 100 u line instead of the text, and still the leader from its start (5 u before the anchor, a
    // third of the size above the baseline) to the target. Plain text keeps its text.
    doc = setSettings(b.doc, { labelMode: 'blank' })
    r.seen.length = 0
    expectBox(drawnItemBox(doc, fixed, r.measure), { x0: -0.625, y0: -4.95 - 0.625, x1: 300.625, y1: 0.625 })
    expect(r.seen).toEqual([])
    expectBox(drawnItemBox(doc, plain, r.measure), { x0: -200, y0: -115, x1: -90, y1: -76.75 })
    // Letters mode: the letter as measured. The second label with a leader is B.
    doc = setSettings(b.doc, { labelMode: 'letters' })
    const letters = letterMap(doc)
    expect([...letters.entries()]).toEqual([
      [fixed.id, 'A'],
      [other.id, 'B'],
    ])
    r.seen.length = 0
    expectBox(
      drawnBox(doc, r.measure),
      unionBox(unionBox(drawnItemBox(doc, beaker), drawnItemBox(doc, plain, r.measure)), { x0: -0.625, y0: -15, x1: 210, y1: 44.5 })!,
    )
    expect(r.seen.filter(([t]) => t.length === 1)).toEqual([
      ['A', 15],
      ['B', 15],
    ])
    // A label on the left ends at its anchor.
    const left = b.label('flask', -100, 0, P(0, 0), { side: 'left' })
    expectBox(drawnItemBox(b.doc, left, r.measure), { x0: -150, y0: -15, x1: 0.625, y1: 4.5 })
  })

  it("the letters are the renderer's letters", () => {
    const doc = setSettings(demoDoc(), { labelMode: 'letters' })
    expect([...letterMap(doc)]).toEqual([...labelLetters(doc)])
    const b = new DocBuilder()
    for (let i = 0; i < 30; i++) b.label(`l${i}`, 0, i * 20, P(100, i * 20))
    expect([...letterMap(b.doc).values()].slice(24, 28)).toEqual(['Y', 'Z', 'AA', 'AB'])
    expect([...letterMap(b.doc)]).toEqual([...labelLetters(b.doc)])
  })

  it('the answer key adds its own box; then the margin', () => {
    const b = new DocBuilder()
    b.connector('wire', [P(0, 0), P(100, 0)])
    const key: Box = { x0: -1, y0: 25, x1: 300, y1: 60 }
    expect(docBounds(b.doc, estimateWidth, key)).toEqual({ x: -17, y: -17, w: 301 + 32, h: 61 + 32 })
  })

  it('in blank mode every 100 u line of the reference picture is inside; each mode is inside the kit estimate', () => {
    const demo = demoDoc()
    for (const mode of ['text', 'blank', 'letters'] as const) {
      const doc = setSettings(demo, { labelMode: mode })
      const b = docBounds(doc)
      // The kit's estimate follows the same rules with rougher allowances: it turns a symbol's box, not its drawing.
      const e = estimateBounds(doc)
      expect(b.x).toBeGreaterThanOrEqual(e.x - 1)
      expect(b.y).toBeGreaterThanOrEqual(e.y - 1)
      expect(b.x + b.w).toBeLessThanOrEqual(e.x + e.w + 1)
      expect(b.y + b.h).toBeLessThanOrEqual(e.y + e.h + 1)
      expect(b.w).toBeGreaterThan(e.w - 30)
      expect(b.h).toBeGreaterThan(e.h - 30)
      if (mode !== 'blank') continue
      const labels = doc.order.map((id) => doc.items[id]).filter((it): it is LabelItem => it.type === 'label' && !!it.target)
      expect(labels.length).toBeGreaterThan(10)
      for (const l of labels) {
        const end = l.side === 'left' ? l.x - 100 : l.x + 100
        for (const x of [l.x, end]) {
          expect(x).toBeGreaterThanOrEqual(b.x + EXPORT_MARGIN)
          expect(x).toBeLessThanOrEqual(b.x + b.w - EXPORT_MARGIN)
        }
        expect(l.y).toBeGreaterThan(b.y + EXPORT_MARGIN)
        expect(l.y).toBeLessThan(b.y + b.h - EXPORT_MARGIN)
      }
    }
  })

  it('an item that cannot be drawn is left out', () => {
    const b = new DocBuilder()
    b.connector('wire', [P(0, 0), P(10, 0)])
    const broken = { id: 'bad', type: 'symbol', symbol: 'beaker', x: 0, y: 0, rot: 0, flip: false, w: 100, h: 120, params: {}, contents: {} } as SymbolItem
    b.doc.items.bad = {
      ...broken,
      get x(): number {
        throw new Error('broken')
      },
    }
    b.doc.order.push('bad')
    expect(drawnBox(b.doc)).toEqual({ x0: -1, y0: -1, x1: 11, y1: 1 })
  })
})
