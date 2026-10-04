import { describe, expect, it } from 'vitest'
import { P, dist, type Pt } from '../kernel/geom'
import { demoDoc } from '../demo'
import { labelPoint } from '../symbols/label'
import { geometry, labelText, symbolDef } from '../symbols/registry'
import { labelLetters } from '../render/render'
import { TEMPLATES } from '../templates'
import { LABEL_GAP, LABEL_SPACING, autoLabel, autoLabels, segmentsCross, spaceColumn, uncrossColumn, type Placed } from './autoLabel'
import { itemsBox, labelTarget } from './bounds'
import { DocBuilder } from './build'
import { deleteItems, setSettings } from './commands'
import { leaderOf, leaderStart, makeLabel } from './labels'
import { toWorld } from './transform'
import type { Doc, LabelItem, SymbolItem } from './types'

const withoutLabels = (doc: Doc): Doc =>
  deleteItems(
    doc,
    doc.order.filter((id) => doc.items[id].type === 'label'),
  )

const gen = () => {
  let n = 0
  return () => `auto${++n}`
}

/** The two checks of steps 7 and 8, on each side: anchors at least 1.4 × the size apart, and no two leaders crossing. */
function expectColumns(doc: Doc, labels: LabelItem[]) {
  const size = doc.settings.labelSize
  for (const side of ['left', 'right'] as const) {
    const column = labels.filter((l) => l.side === side)
    for (let i = 0; i < column.length; i++) {
      for (let j = i + 1; j < column.length; j++) {
        const a = column[i],
          b = column[j]
        expect(dist(a, b), `${a.text} and ${b.text}`).toBeGreaterThanOrEqual(LABEL_SPACING * size - 1e-9)
        const la = leaderOf(doc, a)!,
          lb = leaderOf(doc, b)!
        expect(segmentsCross(la[0], la[1], lb[0], lb[1]), `the leaders of ${a.text} and ${b.text} cross`).toBe(false)
      }
    }
  }
}

describe('segmentsCross', () => {
  it('is true only when the two segments meet at a point inside both', () => {
    expect(segmentsCross(P(0, 0), P(10, 10), P(0, 10), P(10, 0))).toBe(true)
    expect(segmentsCross(P(0, 0), P(10, 0), P(5, 0), P(5, 10))).toBe(false) // an end on the other segment
    expect(segmentsCross(P(0, 0), P(10, 0), P(10, 0), P(20, 5))).toBe(false) // a shared end
    expect(segmentsCross(P(0, 0), P(10, 0), P(0, 1), P(10, 1))).toBe(false) // parallel
    expect(segmentsCross(P(0, 0), P(10, 0), P(5, 0), P(15, 0))).toBe(false) // collinear
    expect(segmentsCross(P(0, 0), P(10, 10), P(20, 0), P(11, 9))).toBe(false) // would cross if longer
  })
})

describe('autoLabel, steps 1 to 6', () => {
  function sample(): Doc {
    const b = new DocBuilder('Sample')
    b.symbol('beaker', { x: 100, y: 300 })
    b.symbol('benchLine', { x: 300, y: 400 }) // no automatic label
    b.symbol('heatArrow', { x: 300, y: 500 }) // no automatic label
    const flask = b.symbol('conicalFlask', { x: 300, y: 300 })
    b.label('my flask', 500, 200, [flask, 0, 50]) // already labelled
    b.symbol('hotPlate', { x: 520, y: 330, params: { stirrer: true } })
    b.label('far away plain text', 5000, -5000) // a label is not part of B
    const doc = b.doc
    // A symbol from a newer version: unknown here, so it is skipped.
    doc.items.ghost = { ...(doc.items.beaker1 as SymbolItem), id: 'ghost', symbol: 'fromTheFuture', x: 700 }
    doc.order.push('ghost')
    return doc
  }

  it('step 1: labels each symbol, except "no automatic label", unknown ids and symbols that have a label', () => {
    const labels = autoLabels(sample(), gen())
    expect(labels.map((l) => l.text)).toEqual(['beaker', 'magnetic stirrer'])
    expect(labels.map((l) => l.id)).toEqual(['auto1', 'auto2'])
    expect(labels.map((l) => (l.target && 'item' in l.target ? l.target.item : null))).toEqual(['beaker1', 'hotPlate6'])
    for (const l of labels) expect(l).toMatchObject({ type: 'label', leaderEnd: 'none' })
    for (const l of labels) expect(l.size).toBeUndefined()
  })

  it('steps 2 to 6: side by the centre of B, the leader point towards that side, the text, the anchor 40 u outside B', () => {
    const doc = sample()
    const B = itemsBox(
      doc,
      doc.order.filter((id) => doc.items[id].type !== 'label'),
    )!
    expect(B.x1).toBeLessThan(1000) // the far label is not in B
    const [beaker, plate] = autoLabels(doc, gen())
    const cx = (B.x0 + B.x1) / 2
    for (const [label, id] of [
      [beaker, 'beaker1'],
      [plate, 'hotPlate6'],
    ] as const) {
      const it = doc.items[id] as SymbolItem
      const side = it.x < cx ? 'left' : 'right'
      expect(label.side).toBe(side)
      const g = geometry(it.symbol, it.w, it.h, it.params)
      const local = labelPoint(g, it.w, it.h, side)
      expect(label.target).toEqual({ item: id, lx: local.x, ly: local.y })
      expect(label.text).toBe(labelText(symbolDef(it.symbol), it.params))
      const t = toWorld(it, local)
      expect(label.x).toBe(side === 'left' ? B.x0 - LABEL_GAP : B.x1 + LABEL_GAP)
      expect(label.y).toBeCloseTo(t.y, 9) // alone on its side: at the target's height
    }
    expect(beaker.side).toBe('left')
    expect(plate.side).toBe('right')
  })

  it('step 4: the leader point that lies further towards the side in the world, for a turned or flipped symbol', () => {
    const b = new DocBuilder()
    const turned = b.symbol('beaker', { x: 0, y: 0, rot: 180 })
    const flipped = b.symbol('conicalFlask', { x: 400, y: 0, flip: true })
    const [l1, l2] = autoLabels(b.doc, gen())
    const g1 = geometry('beaker', turned.w, turned.h)
    // Turned 180°: the local right-hand point is on the world left.
    expect(l1.side).toBe('left')
    expect(l1.target).toMatchObject({ lx: labelPoint(g1, turned.w, turned.h, 'right').x })
    expect(labelTarget(b.doc, l1)!.x).toBeLessThan(turned.x)
    // Flipped: the local left-hand point is on the world right.
    const g2 = geometry('conicalFlask', flipped.w, flipped.h)
    expect(l2.side).toBe('right')
    expect(l2.target).toMatchObject({ lx: labelPoint(g2, flipped.w, flipped.h, 'left').x })
    expect(labelTarget(b.doc, l2)!.x).toBeGreaterThan(flipped.x)
  })

  it('gives the labels in reading order: down the left column, then down the right one', () => {
    const bare = withoutLabels(demoDoc())
    const labels = autoLabels(bare, gen())
    const left = labels.filter((l) => l.side === 'left'),
      right = labels.filter((l) => l.side === 'right')
    expect(labels).toEqual([...left, ...right])
    for (const column of [left, right]) for (let i = 1; i < column.length; i++) expect(column[i].y).toBeGreaterThan(column[i - 1].y)
    // So the letters read down each column.
    const next = setSettings(autoLabel(bare, gen()), { labelMode: 'letters' })
    const letters = labelLetters(next)
    expect(left.map((l) => letters.get(l.id))).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].slice(0, left.length))
  })

  it('adds the labels on top as one change and leaves the input alone; a second run adds nothing', () => {
    const doc = sample()
    const copy = structuredClone(doc)
    const next = autoLabel(doc, gen())
    expect(doc).toEqual(copy)
    expect(next.order).toEqual([...doc.order, 'auto1', 'auto2'])
    expect(autoLabel(next)).toBe(next)
    expect(autoLabel(new DocBuilder().doc)).toEqual(new DocBuilder().doc)
  })
})

/** A label of a column, anchored at x = 0 on the left, with its target. */
const placed = (target: Pt, side: 'left' | 'right' = 'left'): Placed => ({
  label: makeLabel({ x: 0, y: target.y, side, target: { x: target.x, y: target.y } }),
  target,
})
const leader = (p: Placed, size: number): [Pt, Pt] => [leaderStart(p.label, size), p.target]
const crossings = (column: Placed[], size: number) => {
  let n = 0
  for (let i = 0; i < column.length; i++)
    for (let j = i + 1; j < column.length; j++) if (segmentsCross(...leader(column[i], size), ...leader(column[j], size))) n++
  return n
}

describe('autoLabel, step 7: the spacing of a column', () => {
  it('pushes each label down to 1.4 × the size below the one above, then moves the column up by half the push', () => {
    const column = [placed(P(50, 100)), placed(P(80, 100)), placed(P(60, 100))]
    spaceColumn(column, 15)
    expect(column.map((p) => p.label.y)).toEqual([79, 100, 121])
  })
  it('sorts by target height and leaves labels that are far enough apart where they are', () => {
    const column = [placed(P(50, 300)), placed(P(80, 100)), placed(P(60, 140))]
    spaceColumn(column, 20)
    expect(column.map((p) => p.target.y)).toEqual([100, 140, 300])
    expect(column.map((p) => p.label.y)).toEqual([100, 140, 300])
    const close = [placed(P(50, 100)), placed(P(50, 110)), placed(P(50, 200))]
    spaceColumn(close, 20) // the lowest one was not pushed: no move up
    expect(close.map((p) => p.label.y)).toEqual([100, 128, 200])
  })
})

describe('autoLabel, step 8: no leaders cross', () => {
  it('swaps the heights of two crossing leaders until none cross, and the leaders get shorter', () => {
    // Three targets at one height: near, far, middle. After step 7 the near one's leader crosses the far one's.
    const column = [placed(P(30, 100)), placed(P(200, 100)), placed(P(100, 100))]
    spaceColumn(column, 15)
    expect(crossings(column, 15)).toBeGreaterThan(0)
    const heights = column.map((p) => p.label.y).sort((a, b) => a - b)
    const length = (c: Placed[]) => c.reduce((sum, p) => sum + dist(...leader(p, 15)), 0)
    const before = length(column)
    uncrossColumn(column, 15)
    expect(crossings(column, 15)).toBe(0)
    expect(column.map((p) => p.label.y).sort((a, b) => a - b)).toEqual(heights)
    expect(length(column)).toBeLessThan(before)
  })
  it('untangles a column of many crossing leaders on the right side', () => {
    const column: Placed[] = []
    for (let i = 0; i < 12; i++) {
      const target = P(400 - ((i * 137) % 300), 200 + ((i * 7) % 5))
      column.push({ label: makeLabel({ x: 500, y: target.y, side: 'right', target }), target })
    }
    spaceColumn(column, 15)
    expect(crossings(column, 15)).toBeGreaterThan(3)
    uncrossColumn(column, 15)
    expect(crossings(column, 15)).toBe(0)
    const ys = column.map((p) => p.label.y).sort((a, b) => a - b)
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(LABEL_SPACING * 15 - 1e-9)
  })
})

describe('autoLabel on real diagrams: the checks of steps 7 and 8', () => {
  const cases: [string, () => Doc][] = [['demoDoc', demoDoc], ...TEMPLATES.map((t): [string, () => Doc] => [t.id, () => t.build()])]
  for (const [name, build] of cases) {
    it(`${name}: on each side no two anchors closer than 1.4 × the size, and no two leaders cross`, () => {
      const bare = withoutLabels(build())
      const next = autoLabel(bare)
      const labels = next.order.slice(bare.order.length).map((id) => next.items[id] as LabelItem)
      expect(labels.length).toBe(autoLabels(bare).length)
      for (const l of labels) expect(l.target && 'item' in l.target && next.items[l.target.item].type).toBe('symbol')
      expectColumns(next, labels)
    })
  }
  it('demoDoc: a label for every symbol, and no two leaders cross on either side or between the sides', () => {
    const bare = withoutLabels(demoDoc())
    const next = autoLabel(bare)
    const labels = next.order.slice(bare.order.length).map((id) => next.items[id] as LabelItem)
    expect(labels.length).toBe(bare.order.filter((id) => bare.items[id].type === 'symbol').length)
    const leaders = labels.map((l) => leaderOf(next, l)!)
    for (let i = 0; i < leaders.length; i++)
      for (let j = i + 1; j < leaders.length; j++) expect(segmentsCross(leaders[i][0], leaders[i][1], leaders[j][0], leaders[j][1])).toBe(false)
  })
  it('follows the document label size', () => {
    const bare = setSettings(withoutLabels(demoDoc()), { labelSize: 24 })
    const next = autoLabel(bare)
    const labels = next.order.slice(bare.order.length).map((id) => next.items[id] as LabelItem)
    expectColumns(next, labels)
    const left = labels
      .filter((l) => l.side === 'left')
      .map((l) => l.y)
      .sort((a, b) => a - b)
    expect(Math.min(...left.slice(1).map((y, i) => y - left[i]))).toBeGreaterThanOrEqual(1.4 * 24 - 1e-9)
  })
})
