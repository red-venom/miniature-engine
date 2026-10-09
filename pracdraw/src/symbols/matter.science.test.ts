// matter.science.test.ts — the science of the particle box. The model (`particleModel`) is tested for what a particle diagram must show, and the
// drawing is checked against the model: every circle of the model is drawn, once, and nothing else.

import { beforeAll, describe, expect, it } from 'vitest'
import {
  ARROW_LENGTH,
  INSET,
  MOLECULE_GAP,
  RADIUS,
  particleBox,
  particleModel,
  type BoxParams,
  type Formula,
  type Particle,
  type ParticleModel,
  type State,
  type Substance,
} from './matter'
import { defaultParams } from './registry'
import type { Geometry } from './types'

const SUBSTANCES: Substance[] = ['element', 'molecules', 'compound', 'mixtureElements', 'mixtureCompounds', 'mixtureElementCompound']
const STATES: State[] = ['gas', 'liquid', 'solid']
const FORMULAS: Formula[] = ['AB', 'AB2', 'A2B']
const SIZES: [number, number][] = [
  [120, 90], // the smallest the symbol may be
  [160, 120], // the default
  [240, 180],
]
const COUNTS = [6, 13, 16, 24, 40]
const SLOW = 60_000

const DEFAULTS: BoxParams = { substance: 'element', state: 'gas', count: 16, formula: 'AB', motion: false }
const model = (p: Partial<BoxParams>, w = 160, h = 120): ParticleModel => particleModel(w, h, { ...DEFAULTS, ...p })

/** What a unit of each kind of substance must hold, written out here from the catalogue and not taken from the code: the atoms of each kind. */
const LETTERS: Record<Formula, { big: number; B: number }> = { AB: { big: 1, B: 1 }, AB2: { big: 1, B: 2 }, A2B: { big: 2, B: 1 } }
function expectedUnits(substance: Substance, formula: Formula): Record<string, number>[] {
  const compound = (big: 'A' | 'C') => ({ [big]: LETTERS[formula].big, B: LETTERS[formula].B })
  switch (substance) {
    case 'element':
      return [{ A: 1 }]
    case 'molecules':
      return [{ A: 2 }]
    case 'compound':
      return [compound('A')]
    case 'mixtureElements':
      return [{ A: 1 }, { B: 1 }]
    case 'mixtureCompounds':
      return [compound('A'), compound('C')]
    case 'mixtureElementCompound':
      return [{ C: 1 }, compound('A')]
  }
}

interface Case {
  /** What the case is, for a message. */
  tag: string
  params: BoxParams
  w: number
  h: number
  m: ParticleModel
}
let everything: Case[] = []
/** Every substance in every state, with each formula that applies, at the counts and sizes above. The arrows are on. */
function build(): Case[] {
  const out: Case[] = []
  for (const [w, h] of SIZES)
    for (const substance of SUBSTANCES)
      for (const formula of substance.includes('ompound') ? FORMULAS : ['AB' as const])
        for (const state of STATES)
          for (const count of COUNTS) {
            const params = { substance, state, count, formula, motion: true }
            out.push({ tag: `${substance} ${formula} ${state} n=${count} ${w}x${h}`, params, w, h, m: particleModel(w, h, params) })
          }
  return out
}
beforeAll(() => {
  everything = build()
}, SLOW)
const cases = (keep: (c: Case) => boolean = () => true): Case[] => everything.filter(keep)

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
const gapBetween = (m: ParticleModel, i: number, j: number) =>
  dist(m.particles[i].x, m.particles[i].y, m.particles[j].x, m.particles[j].y) - m.particles[i].r - m.particles[j].r
/** The least, over the pairs of circles of different units, of the gap between them less what `need` asks of that pair (nothing, at first). */
function leastMargin(m: ParticleModel, need: (a: Particle, b: Particle) => number = () => 0): number {
  let least = Infinity
  for (let i = 0; i < m.particles.length; i++)
    for (let j = i + 1; j < m.particles.length; j++)
      if (m.particles[i].unit !== m.particles[j].unit) least = Math.min(least, gapBetween(m, i, j) - need(m.particles[i], m.particles[j]))
  return least
}
/** The least gap between a circle of unit u and a circle of unit v. */
const unitGap = (m: ParticleModel, u: number, v: number) =>
  Math.min(...m.units[u].particles.flatMap((i) => m.units[v].particles.map((j) => gapBetween(m, i, j))))
/** How near the circles of two different units come in a liquid or a solid: a molecule keeps a small gap from the next unit. */
const apartOf = (m: ParticleModel, u: number, v: number) => (m.units[u].particles.length > 1 || m.units[v].particles.length > 1 ? MOLECULE_GAP * m.scale : 0)
/** The atoms of unit u by kind. */
const kindsOf = (m: ParticleModel, u: number): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const i of m.units[u].particles) out[m.particles[i].kind] = (out[m.particles[i].kind] ?? 0) + 1
  return out
}
const unitsOfConstituent = (m: ParticleModel, c: number) => m.units.map((_, u) => u).filter((u) => m.units[u].constituent === c)
/** The distance from the point (px, py) to the segment (x0, y0)–(x1, y1). */
function toSegment(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0,
    dy = y1 - y0,
    t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)))
  return dist(px, py, x0 + t * dx, y0 + t * dy)
}
/** The distinct values in a list, to a tolerance, from the biggest. */
function levels(values: number[], tol = 1e-6): number[] {
  const out: number[] = []
  for (const v of [...values].sort((a, b) => b - a)) if (!out.length || out[out.length - 1] - v > tol) out.push(v)
  return out
}

describe('particleBox: what is in the box', () => {
  it('has as many units as the count says: a molecule counts as one particle', () => {
    for (const { tag, params, m } of cases()) {
      expect(m.units.length, tag).toBe(params.count)
      const units = expectedUnits(params.substance, params.formula)
      const split = units.length === 1 ? [params.count] : [Math.ceil(params.count / 2), Math.floor(params.count / 2)]
      let atoms = 0
      units.forEach((kinds, c) => {
        const size = Object.values(kinds).reduce((n, k) => n + k, 0)
        expect(unitsOfConstituent(m, c).length, `${tag}: kind of unit ${c}`).toBe(split[c])
        for (const u of unitsOfConstituent(m, c)) expect(m.units[u].particles.length, tag).toBe(size)
        atoms += split[c] * size
      })
      expect(m.particles.length, tag).toBe(atoms)
    }
  })

  it('has one kind of particle in an element, whether its atoms are free or in pairs', () => {
    for (const { tag, params, m } of cases((c) => c.params.substance === 'element' || c.params.substance === 'molecules')) {
      expect(new Set(m.particles.map((p) => p.kind)), tag).toEqual(new Set(['A']))
      expect(m.bonds.length, tag).toBe(params.substance === 'element' ? 0 : params.count)
    }
  })

  it('has the atoms of its formula, in the right ratio, in every unit of a compound (AB2: two B to one A)', () => {
    for (const { tag, params, m } of cases()) {
      const expected = expectedUnits(params.substance, params.formula)
      m.units.forEach((unit, u) => expect(kindsOf(m, u), `${tag}: unit ${u}`).toEqual(expected[unit.constituent]))
    }
    // The ratio for each formula, spelled out.
    expect(kindsOf(model({ substance: 'compound', formula: 'AB2' }), 0)).toEqual({ A: 1, B: 2 })
    expect(kindsOf(model({ substance: 'compound', formula: 'A2B' }), 0)).toEqual({ A: 2, B: 1 })
    expect(kindsOf(model({ substance: 'compound', formula: 'AB' }), 0)).toEqual({ A: 1, B: 1 })
  })

  it('joins the atoms of a unit into one molecule: the bonds link them all, and bonded atoms touch', () => {
    for (const { tag, m } of cases()) {
      for (const [a, b] of m.bonds) {
        expect(m.particles[a].unit, `${tag}: a bond stays inside one unit`).toBe(m.particles[b].unit)
        expect(Math.abs(gapBetween(m, a, b)), `${tag}: bonded atoms touch`).toBeLessThan(1e-9)
      }
      m.units.forEach((unit, u) => {
        // a molecule of n atoms has n - 1 bonds, which link all of them (a tree); a free atom has none
        const own = m.bonds.filter(([a]) => m.particles[a].unit === u)
        expect(own.length, tag).toBe(unit.particles.length - 1)
        const reached = new Set([unit.particles[0]])
        for (let again = 0; again < unit.particles.length; again++) for (const [a, b] of own) if (reached.has(a) || reached.has(b)) reached.add(a).add(b)
        expect(reached.size, tag).toBe(unit.particles.length)
      })
    }
  })

  it('has at least two kinds of particle in a mixture, and no bond between them', () => {
    for (const { tag, m } of cases((c) => c.params.substance.startsWith('mixture'))) {
      expect(new Set(m.particles.map((p) => p.kind)).size, tag).toBeGreaterThanOrEqual(2)
      // two kinds of unit, and every bond is inside a unit, so no bond joins a particle of one kind of unit to one of the other
      expect(new Set(m.units.map((u) => u.constituent)), tag).toEqual(new Set([0, 1]))
      for (const [a, b] of m.bonds) expect(m.units[m.particles[a].unit].constituent, tag).toBe(m.units[m.particles[b].unit].constituent)
      expect(kindsOf(m, unitsOfConstituent(m, 0)[0]), `${tag}: the two kinds of unit are different`).not.toEqual(kindsOf(m, unitsOfConstituent(m, 1)[0]))
    }
    // a mixture of two elements is free atoms: nothing is bonded at all
    expect(model({ substance: 'mixtureElements' }).bonds).toEqual([])
  })

  it('tells the kinds apart by size and by fill, so that the picture survives a photocopy', () => {
    const m = model({ substance: 'mixtureElements' })
    const radii = (kind: string) => new Set(m.particles.filter((p) => p.kind === kind).map((p) => p.r))
    expect(radii('A')).toEqual(new Set([7])) // the larger kind
    expect(radii('B')).toEqual(new Set([5])) // the smaller kind
    expect(RADIUS).toEqual({ A: 7, B: 5, C: 7 })
    const g = drawn({ substance: 'mixtureElementCompound', state: 'gas', formula: 'AB' })
    expect(g.solid.length, 'A is white').toBeGreaterThan(0)
    expect(g.tint.length, 'B is tinted').toBeGreaterThan(0)
    expect(g.hatch, 'B has a hatch, which stands in for the tint on a photocopy').toBe(1)
    expect(g.ink.length, 'C is solid ink').toBeGreaterThan(0)
  })
})

describe('particleBox: the box is never too full', () => {
  it('never lets two circles of different units overlap', () => {
    for (const { tag, m } of cases()) expect(leastMargin(m), tag).toBeGreaterThanOrEqual(-1e-6)
  })

  it('keeps every circle and every arrow inside the box', () => {
    for (const { tag, w, h, m } of cases()) {
      for (const p of m.particles) {
        expect(Math.abs(p.x) + p.r, tag).toBeLessThanOrEqual(w / 2 - INSET + 1e-6)
        expect(p.y - p.r, tag).toBeGreaterThanOrEqual(INSET - 1e-6)
        expect(p.y + p.r, tag).toBeLessThanOrEqual(h - INSET + 1e-6)
      }
      for (const a of m.arrows) {
        for (const [x, y] of [
          [a.x0, a.y0],
          [a.x1, a.y1],
        ]) {
          expect(Math.abs(x), tag).toBeLessThan(w / 2 - INSET)
          expect(y, tag).toBeGreaterThan(INSET)
          expect(y, tag).toBeLessThan(h - INSET)
        }
      }
    }
  })

  it('draws the particles smaller, and all by the same factor, only when the box is too small for them', () => {
    expect(model({}).scale, '16 atoms fit the default box').toBe(1)
    for (const { tag, params, w, m } of cases()) {
      expect(m.scale, tag).toBeGreaterThan(0.3)
      expect(m.scale, tag).toBeLessThanOrEqual(1)
      for (const p of m.particles) expect(p.r, tag).toBeCloseTo(RADIUS[p.kind] * m.scale, 9)
      if (params.substance === 'element' && params.count <= 13 && w >= 160) expect(m.scale, `${tag}: a few atoms fit the box at full size`).toBe(1)
    }
    expect(model({ substance: 'molecules', count: 16 }).scale, '16 molecules do not fit the box at full size').toBeLessThan(1)
  })

  it('gives the three states of one substance, one count and one size particles of one size', () => {
    for (const substance of SUBSTANCES)
      for (const count of [16, 40]) {
        const scales = STATES.map((state) => model({ substance, state, count, formula: 'AB2' }).scale)
        expect(new Set(scales).size, `${substance} ${count}: ${scales}`).toBe(1)
      }
  })
})

describe('particleBox: a gas, a liquid and a solid', () => {
  it('has gaps in a gas that are bigger than a particle, and spreads the particles through the whole box', () => {
    for (const { tag, m } of cases((c) => c.params.state === 'gas'))
      expect(
        leastMargin(m, (a, b) => 2 * Math.max(a.r, b.r)),
        `${tag}: more than the diameter of the larger`,
      ).toBeGreaterThan(0)
    // spread through the box: each quarter of the default box holds particles
    const m = model({ count: 16 })
    for (const right of [false, true])
      for (const low of [false, true]) {
        const inQuarter = m.particles.filter((p) => p.x > 0 === right && p.y > 60 === low)
        expect(inQuarter.length, `right ${right} low ${low}`).toBeGreaterThanOrEqual(2)
      }
  })

  it('has a solid that is a lattice in contact: straight rows, equal steps, rows that touch, resting on the floor', () => {
    for (const { tag, w, h, m } of cases((c) => c.params.state === 'solid' && c.params.substance === 'element')) {
      const r = 7 * m.scale
      const rows = levels(m.particles.map((p) => p.y)) // from the bottom row to the top
      expect(rows.length, tag).toBeGreaterThanOrEqual(2)
      expect(rows[0] + r, `${tag}: the bottom row rests on the floor`).toBeCloseTo(h - INSET, 9)
      const rowAt = (y: number) => m.particles.filter((p) => Math.abs(p.y - y) < 1e-6).sort((a, b) => a.x - b.x)
      rows.forEach((y, k) => {
        const row = rowAt(y)
        row.slice(1).forEach((p, i) => expect(p.x - row[i].x, `${tag}: row ${k}: equal steps, touching`).toBeCloseTo(2 * r, 9))
        expect(row.reduce((n, p) => n + p.x, 0) / row.length, `${tag}: rows are centred`).toBeCloseTo(0, 9)
        if (k < rows.length - 1) expect(row.length, `${tag}: every row but the top is full`).toBe(rowAt(rows[0]).length)
        if (k === 0) return
        // the row below is a diameter down, or, for a top row that sits in the hollows, as far as two circles that touch
        const step = rows[k - 1] - y
        const nested = Math.abs(step - Math.sqrt(3) * r) < 1e-6
        expect(nested || Math.abs(step - 2 * r) < 1e-6, `${tag}: step ${step}`).toBe(true)
        if (nested) expect(k, `${tag}: only the top row sits in the hollows`).toBe(rows.length - 1)
        for (const p of row)
          expect(Math.min(...rowAt(rows[k - 1]).map((q) => dist(p.x, p.y, q.x, q.y) - 2 * r)), `${tag}: every circle touches one below`).toBeLessThan(1e-6)
      })
      expect(Math.max(...m.particles.map((p) => Math.abs(p.x) + p.r)), tag).toBeLessThanOrEqual(w / 2 - INSET + 1e-6)
    }
  })

  it('has molecules in a solid in a lattice too: units of one kind alike and the same way up, in straight rows, one gap apart', () => {
    for (const { tag, h, m } of cases((c) => c.params.state === 'solid' && ['molecules', 'compound', 'mixtureCompounds'].includes(c.params.substance))) {
      const anchor = (u: number) => m.particles[m.units[u].particles[0]]
      const shape = (u: number) =>
        m.units[u].particles.map((i) => `${(m.particles[i].x - anchor(u).x).toFixed(6)},${(m.particles[i].y - anchor(u).y).toFixed(6)}`)
      for (const c of new Set(m.units.map((u) => u.constituent))) {
        const units = unitsOfConstituent(m, c)
        for (const u of units) expect(shape(u), `${tag}: unit ${u}`).toEqual(shape(units[0]))
        for (const y of levels(units.map((u) => anchor(u).y))) {
          const row = units.filter((u) => Math.abs(anchor(u).y - y) < 1e-6).sort((a, b) => anchor(a).x - anchor(b).x)
          row.slice(1).forEach((u, i) => {
            expect(anchor(u).x - anchor(row[i]).x, `${tag}: equal steps along a row`).toBeCloseTo(anchor(row[1]).x - anchor(row[0]).x, 9)
            expect(unitGap(m, row[i], u), `${tag}: neighbours in a row are one gap apart`).toBeCloseTo(apartOf(m, row[i], u), 6)
          })
        }
      }
      expect(Math.max(...m.particles.map((p) => p.y + p.r)), `${tag}: the lowest row rests on the floor`).toBeCloseTo(h - INSET, 9)
    }
  })

  it('has a liquid that is touching, in no order, and no more than two thirds full', () => {
    for (const { tag, h, m } of cases((c) => c.params.state === 'liquid')) {
      m.units.forEach((_, u) => {
        const touching = m.units.some((_, v) => v !== u && unitGap(m, u, v) <= apartOf(m, u, v) + 1e-6)
        expect(touching, `${tag}: unit ${u} touches no other unit`).toBe(true)
      })
      expect(Math.max(...m.particles.map((p) => p.y + p.r)), `${tag}: the heap rests on the floor`).toBeCloseTo(h - INSET, 9)
      expect(Math.min(...m.particles.map((p) => p.y - p.r)), `${tag}: it fills the lower two thirds at most`).toBeGreaterThanOrEqual(h / 3 - 1e-6)
    }
    // no regular rows: a liquid of atoms has more heights than the solid of the same atoms has rows
    for (const count of [13, 16, 24, 40]) {
      const liquid = levels(
        model({ state: 'liquid', count }).particles.map((p) => p.y),
        0.5,
      )
      const solid = levels(
        model({ state: 'solid', count }).particles.map((p) => p.y),
        0.5,
      )
      expect(liquid.length, `${count} atoms`).toBeGreaterThanOrEqual(solid.length + 2)
    }
  })

  it('looks different in each state: the heights of the particles are spread most in a gas and least in a solid', () => {
    const spread = (state: State) => {
      const ys = model({ state, count: 24 }).particles.map((p) => p.y)
      return Math.max(...ys) - Math.min(...ys)
    }
    expect(spread('gas')).toBeGreaterThan(spread('liquid'))
    expect(spread('liquid')).toBeGreaterThan(spread('solid'))
  })
})

describe('particleBox: motion arrows', () => {
  it('has no arrow unless motion is on, and switching it on moves no particle', () => {
    for (const state of STATES)
      for (const substance of SUBSTANCES) {
        const off = model({ state, substance, motion: false }),
          on = model({ state, substance, motion: true })
        expect(off.arrows).toEqual([])
        expect(on.arrows.length, `${substance} ${state}`).toBeGreaterThan(0)
        expect(on.particles).toEqual(off.particles)
      }
  })

  it('has arrows that are short in a solid and a liquid and longer in a gas', () => {
    expect(ARROW_LENGTH.long).toBeGreaterThan(2 * ARROW_LENGTH.short)
    for (const { tag, params, m } of cases())
      for (const a of m.arrows) expect(dist(a.x0, a.y0, a.x1, a.y1), tag).toBeCloseTo(ARROW_LENGTH[params.state === 'gas' ? 'long' : 'short'] * m.scale, 9)
  })

  it('has arrows that never cross a particle, nor touch one', () => {
    for (const { tag, m } of cases())
      for (const a of m.arrows)
        expect(Math.min(...m.particles.map((p) => toSegment(p.x, p.y, a.x0, a.y0, a.x1, a.y1) - p.r)), tag).toBeGreaterThanOrEqual(2 * m.scale - 1e-9)
  })

  it('has arrows that start at their own unit and do not cross each other', () => {
    for (const { tag, m } of cases())
      m.arrows.forEach((a, i) => {
        const edge = Math.min(...m.units[a.unit].particles.map((j) => dist(m.particles[j].x, m.particles[j].y, a.x0, a.y0) - m.particles[j].r))
        expect(edge, `${tag}: the tail is just off the unit`).toBeGreaterThan(0)
        expect(edge, tag).toBeLessThan(3 * m.scale)
        for (const b of m.arrows.slice(i + 1)) expect(toSegment(b.x0, b.y0, a.x0, a.y0, a.x1, a.y1), tag).toBeGreaterThan(2 * m.scale)
      })
  })
})

describe('particleBox: the same parameters always give the same picture', () => {
  it('gives equal models and equal geometry, however often it is built', () => {
    for (const state of STATES)
      for (const substance of SUBSTANCES) {
        const p = { state, substance, count: 24, formula: 'AB2' as const, motion: true }
        expect(model(p)).toEqual(model(p))
        expect(JSON.stringify(drawn(p).geometry)).toBe(JSON.stringify(drawn(p).geometry))
      }
    // a different count is a different picture
    expect(model({ count: 16 }).particles).not.toEqual(model({ count: 17 }).particles)
  })
})

// ---------------------------------------------------------------- the drawing against the model

interface Circle {
  x: number
  y: number
  r: number
}
interface Drawn {
  geometry: Geometry
  /** The numbers of the box outline. */
  box: number[]
  solid: Circle[]
  tint: Circle[]
  ink: Circle[]
  /** The number of hatch prims. */
  hatch: number
  /** The shafts of the arrows: x0, y0, x1, y1. */
  shafts: number[][]
  /** The heads: the tip, then the two corners at the foot. */
  heads: number[][]
}

const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
/** The circles of a path made by `circle()` in kit.ts: M (cx - r) cy a r r 0 1 0 2r 0 a r r 0 1 0 -2r 0 Z. */
const circlesIn = (d: string): Circle[] =>
  [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)a([\d.]+) [\d.]+ 0 1 0 (-?[\d.]+) 0a/g)].map((m) => ({
    x: Number(m[1]) + Number(m[3]),
    y: Number(m[2]),
    r: Number(m[3]),
  }))

function drawn(p: Partial<BoxParams>, w = 160, h = 120): Drawn {
  const geometry = particleBox.build({ w, h, p: { ...defaultParams(particleBox), ...p } })
  const d = (role: string) => geometry.prims.filter((q) => q.role === role).map((q) => q.d)
  const inks = d('ink')
  return {
    geometry,
    box: numbers(d('outline')[0]),
    solid: d('solid').flatMap(circlesIn),
    tint: d('tint').flatMap(circlesIn),
    ink: inks.flatMap(circlesIn),
    hatch: d('hatch').length,
    shafts: d('detail').flatMap((s) => s.split('M').filter(Boolean).map(numbers)),
    heads: inks.filter((s) => !s.includes('a')).flatMap((s) => s.split('Z').filter(Boolean).map(numbers)),
  }
}

describe('particleBox: the drawing agrees with the model', () => {
  const same = (a: Circle, b: Circle) => Math.abs(a.x - b.x) < 0.02 && Math.abs(a.y - b.y) < 0.02 && Math.abs(a.r - b.r) < 0.02

  it(
    'draws every circle of the model once, in the fill of its kind, and nothing else',
    () => {
      for (const [w, h] of SIZES)
        for (const substance of SUBSTANCES)
          for (const state of STATES)
            for (const count of [6, 16, 40]) {
              const p = { substance, state, count, formula: 'AB2' as const }
              const m = model(p, w, h)
              const g = drawn(p, w, h)
              for (const [kind, circles] of [
                ['A', g.solid],
                ['B', g.tint],
                ['C', g.ink],
              ] as const) {
                const expected = m.particles.filter((q) => q.kind === kind)
                const tag = `${substance} ${state} n=${count} ${w}x${h} kind ${kind}`
                expect(circles.length, tag).toBe(expected.length)
                for (const q of expected) expect(circles.filter((c) => same(c, q)).length, `${tag}: drawn exactly once`).toBe(1)
              }
            }
    },
    SLOW,
  )

  it('draws the box as a rectangle round the nominal box, and a hatch inside the tinted circles', () => {
    for (const [w, h] of SIZES) {
      const g = drawn({ substance: 'mixtureCompounds', state: 'gas', formula: 'AB2' }, w, h)
      expect(g.box).toEqual([-w / 2, 0, w / 2, h, -w / 2])
      expect(g.hatch).toBe(1)
      const hatch = g.geometry.prims.find((q) => q.role === 'hatch')!.d
      for (const s of hatch.split('M').filter(Boolean))
        for (const [x, y] of [numbers(s).slice(0, 2), numbers(s).slice(2, 4)])
          expect(Math.min(...g.tint.map((c) => Math.abs(dist(x, y, c.x, c.y) - c.r))), 'a hatch line ends on the edge of a tinted circle').toBeLessThan(0.3)
    }
  })

  it('draws every arrow: a shaft from the tail towards the tip, and a head with its tip at the tip', () => {
    for (const state of STATES)
      for (const substance of SUBSTANCES) {
        const m = model({ state, substance, motion: true })
        const g = drawn({ state, substance, motion: true })
        expect(g.shafts.length).toBe(m.arrows.length)
        expect(g.heads.length).toBe(m.arrows.length)
        m.arrows.forEach((a, i) => {
          const [sx0, sy0, sx1, sy1] = g.shafts[i]
          expect(dist(sx0, sy0, a.x0, a.y0), `${substance} ${state}: the shaft starts at the tail`).toBeLessThan(0.02)
          expect(dist(g.heads[i][0], g.heads[i][1], a.x1, a.y1), `${substance} ${state}: the head is at the tip`).toBeLessThan(0.02)
          // the shaft points at the tip
          const cross = (sx1 - sx0) * (a.y1 - a.y0) - (sy1 - sy0) * (a.x1 - a.x0)
          expect(Math.abs(cross) / dist(sx0, sy0, sx1, sy1) / dist(a.x0, a.y0, a.x1, a.y1)).toBeLessThan(0.01)
        })
      }
  })
})
