// energy.science.test.ts — the science of the reaction profile. The model (`profileModel`) is tested for what a reaction profile must show, and the
// drawing is checked against the model: the curve, the arrows and the labels are where the model puts them.

import { describe, expect, it } from 'vitest'
import { pathPolys, type Pt } from '../kernel/geom'
import { FORMULAE, bezierAt, profileModel, reactionProfile, type Bezier, type ProfileModel, type ProfileParams, type ProfileType } from './energy'
import { defaultParams } from './registry'
import type { Geometry } from './types'

const TYPES: ProfileType[] = ['exothermic', 'endothermic']
const SIZES: [number, number][] = [
  [230, 160], // the smallest the symbol may be
  [260, 170], // the default
  [390, 255],
]
const DEFAULTS: ProfileParams = { type: 'exothermic', catalyst: false, activation: true, change: true, levels: 'words' }
const model = (p: Partial<ProfileParams> = {}, w = 260, h = 170): ProfileModel => profileModel(w, h, { ...DEFAULTS, ...p })

/** Every parameter set, at every size. */
function everyModel(): { tag: string; w: number; h: number; p: ProfileParams; m: ProfileModel }[] {
  const out = []
  for (const [w, h] of SIZES)
    for (const type of TYPES)
      for (const catalyst of [false, true])
        for (const activation of [false, true])
          for (const change of [false, true])
            for (const levels of ['words', 'formulae', 'blank'] as const) {
              const p = { type, catalyst, activation, change, levels }
              out.push({ tag: `${JSON.stringify(p)} ${w}x${h}`, w, h, p, m: profileModel(w, h, p) })
            }
  return out
}

const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** The curve of the model as points: every segment, fine enough that a straight chord stays within 0.02 u of the curve. */
function sample(segments: Bezier[], steps = 60): Pt[] {
  return segments.flatMap((b) => Array.from({ length: steps + 1 }, (_, i) => bezierAt(b, i / steps)))
}
/** The distance from p to a polyline. */
function toPolyline(p: Pt, line: Pt[]): number {
  let best = Infinity
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i],
      b = line[i + 1],
      dx = b.x - a.x,
      dy = b.y - a.y,
      l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
    best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy))
  }
  return best
}

interface Head {
  tip: Pt
  /** The unit vector from the middle of the foot to the tip: the way the head points. */
  dir: Pt
}
/** The arrowheads of a path of closed triangles: each starts at its tip. */
const headsIn = (d: string): Head[] =>
  d
    .split('Z')
    .filter(Boolean)
    .map(numbers)
    .map(([x, y, x1, y1, x2, y2]) => {
      const mx = (x1 + x2) / 2,
        my = (y1 + y2) / 2,
        l = Math.hypot(x - mx, y - my)
      return { tip: { x, y }, dir: { x: (x - mx) / l, y: (y - my) / l } }
    })

interface Drawn {
  geometry: Geometry
  axes: number[]
  axisHeads: Head[]
  /** The solid curve, as a path. */
  curve: string
  dashed: string[]
  shafts: number[][]
  arrowHeads: Head[]
  texts: Geometry['texts']
}
function drawn(p: Partial<ProfileParams> = {}, w = 260, h = 170): Drawn {
  const geometry = reactionProfile.build({ w, h, p: { ...defaultParams(reactionProfile), ...p } })
  const role = (r: string) => geometry.prims.filter((q) => q.role === r).map((q) => q.d)
  const inks = role('ink'),
    details = role('detail')
  const hasArrows = (p.activation ?? true) || (p.change ?? true)
  return {
    geometry,
    axes: numbers(role('outline')[0]),
    axisHeads: headsIn(inks[0]),
    curve: role('outline')[1],
    dashed: role('dashed'),
    shafts: hasArrows ? details[0].split('M').filter(Boolean).map(numbers) : [],
    arrowHeads: hasArrows ? headsIn(inks[1]) : [],
    texts: geometry.texts,
  }
}

describe('reactionProfile: the levels', () => {
  it('puts the products below the reactants for an exothermic reaction, and above them for an endothermic one', () => {
    const exo = model({ type: 'exothermic' }),
      endo = model({ type: 'endothermic' })
    expect(exo.energy.products).toBeLessThan(exo.energy.reactants)
    expect(endo.energy.products).toBeGreaterThan(endo.energy.reactants)
    // drawn so: a lower energy is lower on the page, which is a greater y
    expect(exo.y.products).toBeGreaterThan(exo.y.reactants)
    expect(endo.y.products).toBeLessThan(endo.y.reactants)
    // the plateaus of the drawn curve are at those heights: M start, L end of the first plateau, then two curves, then L end of the last
    for (const [m, g] of [
      [exo, drawn({ type: 'exothermic' })],
      [endo, drawn({ type: 'endothermic' })],
    ] as const) {
      const [start, plateau, end] = (g.curve.match(/[ML]-?[\d.]+ -?[\d.]+/g) ?? []).map((c) => numbers(c.slice(1)))
      expect(start[0]).toBeCloseTo(m.axes.origin.x, 1) // it starts on the vertical axis
      expect(start[1]).toBeCloseTo(m.y.reactants, 1)
      expect(plateau[1]).toBeCloseTo(m.y.reactants, 1) // the first plateau is level
      expect(end[1]).toBeCloseTo(m.y.products, 1)
      expect(end[0]).toBeGreaterThan(plateau[0])
    }
  })

  it('puts the peak above both levels', () => {
    for (const { tag, m } of everyModel()) {
      expect(m.energy.peak, tag).toBeGreaterThan(Math.max(m.energy.reactants, m.energy.products))
      expect(m.y.peak, tag).toBeLessThan(Math.min(m.y.reactants, m.y.products))
      expect(m.energy.reactants, tag).toBeGreaterThan(0) // both levels are above the axis
      expect(m.energy.products, tag).toBeGreaterThan(0)
    }
  })

  it('has a catalysed route with a lower peak, and the same start and the same end', () => {
    for (const type of TYPES)
      for (const [w, h] of SIZES) {
        const plain = model({ type, catalyst: false }, w, h),
          cat = model({ type, catalyst: true }, w, h)
        expect(plain.catalysed).toBeNull()
        const c = cat.catalysed!
        const higher = Math.max(cat.energy.reactants, cat.energy.products)
        // lower than the peak of the plain route, and still above both levels
        expect(cat.energy.catalysed).toBeLessThan(cat.energy.peak)
        expect(cat.energy.catalysed).toBeGreaterThan(higher)
        expect(c.rise.p1.y).toBeGreaterThan(cat.y.peak) // lower on the page
        expect(c.rise.p1.y).toBeLessThan(Math.min(cat.y.reactants, cat.y.products))
        // the same start and the same end, and nothing else about the plain route changes
        expect(c.rise.p0).toEqual(cat.curve.rise.p0)
        expect(c.fall.p1).toEqual(cat.curve.fall.p1)
        expect(c.rise.p1.x, 'the peak is in the same place').toBe(cat.curve.rise.p1.x)
        expect(cat.curve).toEqual(plain.curve)
        expect(cat.energy.reactants).toBe(plain.energy.reactants)
        expect(cat.energy.products).toBe(plain.energy.products)
        expect(cat.energy.peak).toBe(plain.energy.peak)
        // drawn: a dashed route from the end of the first plateau to the start of the last
        const g = drawn({ type, catalyst: true }, w, h)
        const dashed = pathPolys(g.dashed[1])[0]
        expect(dist(dashed[0], c.rise.p0)).toBeLessThan(0.02)
        expect(dist(dashed[dashed.length - 1], c.fall.p1)).toBeLessThan(0.02)
        expect(Math.min(...dashed.map((p) => p.y))).toBeCloseTo(c.rise.p1.y, 1)
        expect(drawn({ type, catalyst: false }, w, h).dashed.length, 'only the level line is dashed without a catalyst').toBe(1)
      }
  })
})

describe('reactionProfile: the arrows', () => {
  it('runs the activation energy arrow from the reactants level up to the peak, with a head at each end', () => {
    for (const { tag, m } of everyModel().filter((c) => c.p.activation)) {
      const a = m.activation!
      expect(a.from, tag).toBe(m.y.reactants)
      expect(a.to, tag).toBe(m.y.peak)
      expect(a.both, tag).toBe(true)
      expect(a.x, `${tag}: it stands under the top of the curve`).toBe(m.curve.rise.p1.x)
    }
    for (const type of TYPES)
      for (const [w, h] of SIZES) {
        const m = model({ type }, w, h),
          g = drawn({ type, change: false }, w, h)
        const x = m.activation!.x
        // a head whose tip is on the peak and points up, and one whose tip is on the reactants level and points down
        expect(g.arrowHeads.length).toBe(2)
        const top = g.arrowHeads.find((hd) => Math.abs(hd.tip.y - m.y.peak) < 0.02)
        const foot = g.arrowHeads.find((hd) => Math.abs(hd.tip.y - m.y.reactants) < 0.02)
        expect(top, `${type} ${w}x${h}: a head has its tip on the peak`).toBeDefined()
        expect(foot, `${type} ${w}x${h}: a head has its tip on the reactants level`).toBeDefined()
        expect(top!.tip.x).toBeCloseTo(x, 1)
        expect(top!.dir).toEqual({ x: expect.closeTo(0, 6), y: expect.closeTo(-1, 6) })
        expect(foot!.tip.x).toBeCloseTo(x, 1)
        expect(foot!.dir).toEqual({ x: expect.closeTo(0, 6), y: expect.closeTo(1, 6) })
        // the shaft joins the two heads
        const [sx0, sy0, sx1, sy1] = g.shafts[0]
        expect([sx0, sx1].every((v) => Math.abs(v - x) < 0.02)).toBe(true)
        expect(Math.min(sy0, sy1)).toBeGreaterThan(m.y.peak)
        expect(Math.max(sy0, sy1)).toBeLessThan(m.y.reactants)
      }
  })

  it('runs the overall energy change arrow from the reactants level to the products level: down for exothermic, up for endothermic', () => {
    for (const { tag, m } of everyModel().filter((c) => c.p.change)) {
      const a = m.change!
      expect(a.from, tag).toBe(m.y.reactants)
      expect(a.to, tag).toBe(m.y.products)
      expect(a.both, tag).toBe(false)
      expect(Math.sign(a.to - a.from), `${tag}: down is a greater y`).toBe(m.params.type === 'exothermic' ? 1 : -1)
      expect(a.x, `${tag}: it stands on the last level`).toBeGreaterThan(m.curve.fall.p1.x)
      expect(a.x, tag).toBeLessThan(m.curve.end.x)
      expect(m.levelLine.y, `${tag}: the reactants level is carried across to it`).toBe(m.y.reactants)
      expect(m.levelLine.x0, tag).toBe(m.curve.rise.p0.x)
      expect(m.levelLine.x1, tag).toBeGreaterThan(a.x)
    }
    for (const type of TYPES)
      for (const [w, h] of SIZES) {
        const m = model({ type }, w, h),
          g = drawn({ type, activation: false }, w, h)
        const a = m.change!
        expect(g.arrowHeads.length).toBe(1)
        const head = g.arrowHeads[0]
        expect(head.tip.x).toBeCloseTo(a.x, 1)
        expect(head.tip.y, 'the head is on the products level').toBeCloseTo(m.y.products, 1)
        expect(head.dir.y, 'and points down for exothermic, up for endothermic').toBeCloseTo(type === 'exothermic' ? 1 : -1, 6)
        const [sx0, sy0, sx1] = g.shafts[0]
        expect(Math.abs(sx0 - a.x) + Math.abs(sx1 - a.x)).toBeLessThan(0.04)
        expect(sy0, 'the shaft starts on the reactants level').toBeCloseTo(m.y.reactants, 1)
        // the dashed line that carries the reactants level across runs level, and a little past the arrow
        const [lx0, ly, lx1] = numbers(g.dashed[0])
        expect(ly).toBeCloseTo(m.y.reactants, 1)
        expect(lx0).toBeCloseTo(m.curve.rise.p0.x, 1)
        expect(lx1).toBeGreaterThan(a.x)
      }
  })

  it('has an arrow only when it is switched on', () => {
    expect(model({ activation: false }).activation).toBeNull()
    expect(model({ change: false }).change).toBeNull()
    const none = drawn({ activation: false, change: false })
    expect(none.shafts).toEqual([])
    expect(none.arrowHeads).toEqual([])
  })
})

describe('reactionProfile: the curve', () => {
  it('has no kink: every segment is level where it meets the next, and the drawn curve turns gently everywhere', () => {
    for (const { tag, m } of everyModel().filter((c) => c.p.levels === 'words' && !c.p.catalyst)) {
      for (const route of [m.curve, ...(m.catalysed ? [m.catalysed] : [])]) {
        for (const b of [route.rise, route.fall]) {
          expect(b.c1.y, `${tag}: level at the start`).toBe(b.p0.y)
          expect(b.c2.y, `${tag}: level at the end`).toBe(b.p1.y)
        }
      }
      expect(m.curve.rise.p1).toEqual(m.curve.fall.p0)
      expect(m.curve.start.y).toBe(m.curve.rise.p0.y)
      expect(m.curve.end.y).toBe(m.curve.fall.p1.y)
    }
    // the drawn curve, flattened finely: no turn of more than 12 degrees between one piece and the next
    for (const type of TYPES)
      for (const catalyst of [false, true])
        for (const [w, h] of SIZES) {
          const g = drawn({ type, catalyst }, w, h)
          for (const d of [g.curve, ...(catalyst ? [g.dashed[1]] : [])]) {
            const line = pathPolys(d, 0.02)[0]
            let worst = 0
            for (let i = 1; i + 1 < line.length; i++) {
              const a = Math.atan2(line[i].y - line[i - 1].y, line[i].x - line[i - 1].x),
                b = Math.atan2(line[i + 1].y - line[i].y, line[i + 1].x - line[i].x)
              worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))))
            }
            expect((worst * 180) / Math.PI, `${type} ${w}x${h}`).toBeLessThan(12)
          }
        }
  })

  it('has one rounded peak: the curve climbs to the peak and then falls, and nothing rises above it', () => {
    for (const { tag, m } of everyModel().filter((c) => c.p.levels === 'words')) {
      const rise = sample([m.curve.rise]),
        fall = sample([m.curve.fall])
      rise.slice(1).forEach((p, i) => expect(p.y, `${tag}: rises`).toBeLessThanOrEqual(rise[i].y + 1e-9))
      fall.slice(1).forEach((p, i) => expect(p.y, `${tag}: falls`).toBeGreaterThanOrEqual(fall[i].y - 1e-9))
      const top = [...rise, ...fall].reduce((a, p) => (p.y < a.y ? p : a))
      expect(top.y, tag).toBeCloseTo(m.y.peak, 9)
      expect(top.x, tag).toBeCloseTo(m.curve.rise.p1.x, 9)
      // rounded: at 4 u either side of the top the curve has not yet dropped by more than 4 u (no point)
      const near = [...rise, ...fall].filter((p) => Math.abs(p.x - top.x) <= 4)
      expect(Math.max(...near.map((p) => p.y)) - top.y, `${tag}: the top is rounded`).toBeLessThan(2)
    }
  })

  it('is drawn where the model puts it', () => {
    for (const type of TYPES)
      for (const [w, h] of SIZES) {
        const m = model({ type }, w, h),
          g = drawn({ type }, w, h)
        const line = pathPolys(g.curve, 0.02)[0]
        const want = [m.curve.start, m.curve.rise.p0, ...sample([m.curve.rise, m.curve.fall]), m.curve.fall.p1, m.curve.end]
        for (const p of want) expect(toPolyline(p, line), `${type} ${w}x${h}`).toBeLessThan(0.05)
        for (const p of line) expect(toPolyline(p, want), `${type} ${w}x${h}`).toBeLessThan(0.05)
        expect(Math.min(...line.map((p) => p.y))).toBeCloseTo(m.y.peak, 1)
      }
  })
})

describe('reactionProfile: axes and labels', () => {
  it('has two axes with arrowheads, and writes Energy above the vertical axis and the progress of reaction along the other', () => {
    for (const { tag, w, h, m } of everyModel().filter((c) => c.p.levels === 'words' && !c.p.catalyst)) {
      const g = drawn(m.params, w, h)
      const { origin, top, right } = m.axes
      expect(g.axes.slice(0, 2), tag).toEqual([origin.x, expect.closeTo(top.y + 8.1, 6)]) // the vertical axis ends at the foot of its head
      const up = g.axisHeads.find((hd) => Math.abs(hd.tip.y - top.y) < 0.02),
        along = g.axisHeads.find((hd) => Math.abs(hd.tip.x - right.x) < 0.02)
      expect(up, `${tag}: the vertical axis has a head`).toBeDefined()
      expect(along, `${tag}: the horizontal axis has a head`).toBeDefined()
      expect(up!.tip.x, tag).toBeCloseTo(origin.x, 1)
      expect(up!.dir.y, 'the vertical axis points up').toBeCloseTo(-1, 6)
      expect(along!.tip.y, tag).toBeCloseTo(origin.y, 1)
      expect(along!.dir.x, 'the horizontal axis points right').toBeCloseTo(1, 6)
      const energy = g.texts!.find((t) => t.text === 'Energy')!,
        progress = g.texts!.find((t) => t.text === 'Progress of reaction')!
      expect(energy.anchor).toBe('middle')
      expect(energy.x, `${tag}: Energy is over the vertical axis`).toBeCloseTo(origin.x, 6)
      expect(energy.y, `${tag}: above the head of the axis`).toBeLessThan(top.y)
      expect(progress.y, `${tag}: Progress of reaction is under the horizontal axis`).toBeGreaterThan(origin.y)
      expect(progress.x, tag).toBeCloseTo((origin.x + right.x) / 2, 6)
      for (const t of g.texts!) {
        expect(t.size, tag).toBeGreaterThanOrEqual(12)
        expect(t.size, tag).toBeLessThanOrEqual(18)
      }
    }
  })

  it('labels the levels with words, with formulae that balance, or with lines to write on', () => {
    const words = drawn({ levels: 'words' }).texts!.map((t) => t.text)
    expect(words).toEqual(expect.arrayContaining(['reactants', 'products']))
    const blank = drawn({ levels: 'blank' })
    expect(blank.texts!.map((t) => t.text)).toEqual(['Energy', 'Progress of reaction'])
    // the lines to write on: one for each level, 80 u long, at the foot of where the words would be
    const rules = blank.geometry.prims
      .filter((p) => p.role === 'detail')
      .map((p) => p.d)
      .slice(-1)[0]
      .split('M')
      .filter(Boolean)
      .map(numbers)
    const m = model({ levels: 'blank' })
    expect(rules.length).toBe(2)
    expect(rules[0][0]).toBeCloseTo(m.labels.reactants.x, 1)
    expect(rules[0][1]).toBeCloseTo(m.labels.reactants.y, 1)
    expect(rules[1][0]).toBeCloseTo(m.labels.products.x, 1)
    expect(rules[1][1]).toBeCloseTo(m.labels.products.y, 1)
    expect(rules.map((r) => r[2])).toEqual([80, -80]) // the first runs right from its end of the label, the second left
    // formulae: the atoms on the two sides of the equation are the same
    const atoms = (side: string) => {
      const out: Record<string, number> = {}
      for (const term of side.split(' + ')) {
        const [, coefficient, body] = /^(\d*)(.*)$/.exec(term)!
        for (const [, element, n] of body.matchAll(/([A-Z][a-z]?)(?:_(\d+))?/g)) out[element] = (out[element] ?? 0) + Number(coefficient || 1) * Number(n ?? 1)
      }
      return out
    }
    for (const type of TYPES) {
      expect(atoms(FORMULAE[type].reactants), type).toEqual(atoms(FORMULAE[type].products))
      const labels = drawn({ type, levels: 'formulae' }).texts!.map((t) => t.text)
      expect(labels).toEqual(expect.arrayContaining([FORMULAE[type].reactants, FORMULAE[type].products]))
    }
    expect(FORMULAE.exothermic).not.toEqual(FORMULAE.endothermic)
  })

  it('writes each label beside its level, on the side away from the other level', () => {
    for (const { tag, m } of everyModel().filter((c) => c.p.levels !== 'blank')) {
      const { reactants, products } = m.labels
      expect(reactants.y > m.y.reactants, `${tag}: reactants are written below their level`).toBe(true)
      // the products of an exothermic reaction are the lower level and are written under it; those of an endothermic reaction, above it
      expect(products.y > m.y.products, tag).toBe(m.params.type === 'exothermic')
      expect(Math.abs(reactants.y - m.y.reactants), tag).toBeLessThan(20)
      expect(Math.abs(products.y - m.y.products), tag).toBeLessThan(20)
      expect(reactants.x, `${tag}: the reactants are at the left`).toBeLessThan(m.curve.rise.p0.x)
      expect(products.x, `${tag}: the products are at the right`).toBeGreaterThan(m.curve.fall.p1.x)
    }
  })

  it('stays inside its box at every size', () => {
    for (const { tag, w, h, p } of everyModel()) {
      const g = drawn(p, w, h)
      for (const prim of g.geometry.prims) {
        for (const line of pathPolys(prim.d)) {
          for (const q of line) {
            expect(Math.abs(q.x), tag).toBeLessThanOrEqual(w / 2)
            expect(q.y, tag).toBeGreaterThanOrEqual(0)
            expect(q.y, tag).toBeLessThanOrEqual(h)
          }
        }
      }
      // text: an estimate of its width, 0.56 of its size for each character (the subscripts are narrower, so this is generous)
      for (const t of g.texts!) {
        const width = t.text.replace(/[_^]/g, '').length * t.size * 0.56
        const [x0, x1] = t.anchor === 'middle' ? [t.x - width / 2, t.x + width / 2] : t.anchor === 'start' ? [t.x, t.x + width] : [t.x - width, t.x]
        expect(x0, `${tag}: ${t.text}`).toBeGreaterThanOrEqual(-w / 2)
        expect(x1, `${tag}: ${t.text}`).toBeLessThanOrEqual(w / 2)
        expect(t.y - t.size, `${tag}: ${t.text}`).toBeGreaterThanOrEqual(0)
        expect(t.y, `${tag}: ${t.text}`).toBeLessThanOrEqual(h)
      }
    }
  })
})

describe('reactionProfile: the same parameters always give the same picture', () => {
  it('gives equal models and equal geometry, however often it is built', () => {
    for (const { p, w, h } of everyModel()) {
      expect(profileModel(w, h, p)).toEqual(profileModel(w, h, p))
    }
    expect(JSON.stringify(drawn({ catalyst: true }).geometry)).toBe(JSON.stringify(drawn({ catalyst: true }).geometry))
  })
})
