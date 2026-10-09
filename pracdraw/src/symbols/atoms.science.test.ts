// atoms.science.test.ts — the science of the atoms pack. Each picture is made from a data model that atoms.ts exports. These tests check the
// model against the science (electrons = Z minus the charge, the shells fill 2, 8, 8, 2, neutrons = A minus Z, no alpha path enters a nucleus)
// and then read the geometry that the symbol draws, as the renderer would, and check that it agrees with the model: that it has as many marks,
// in the same places. A test that only read the model would pass whatever was drawn.

import { describe, expect, it } from 'vitest'
import { P, bounds, dist, pathPolys, type Pt } from '../kernel/geom'
import {
  ALPHA,
  BOHR,
  MINUS_R,
  NOTATION,
  NUCLEON_R,
  alphaModel,
  alphaPattern,
  atomModel,
  bohrLabel,
  bohrModel,
  chargeMarkup,
  clusterCircles,
  deflection,
  isotopeModel,
  nuclide,
  nuclideLabel,
  type Mark,
} from './atoms'
import { CROSS_ARM, DOT_R } from './electrons'
import { ELEMENTS, element, ionShells, ks4Group, shellString } from './elements'
import { geometry, labelText, symbolDef } from './registry'
import type { Geometry, ParamValue } from './types'

// ---------------------------------------------------------------- reading a drawing

const sum = (a: readonly number[]): number => a.reduce((n, m) => n + m, 0)
const last = <T>(a: readonly T[]): T => a[a.length - 1]

/** The subpaths of every prim of a role, as polylines. */
const polysOf = (g: Geometry, role: string): Pt[][] => g.prims.filter((p) => p.role === role).flatMap((p) => pathPolys(p.d, 0.05))
const centre = (poly: Pt[]): Pt => {
  const b = bounds(poly)
  return P((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)
}
const radiusOf = (poly: Pt[]): number => {
  const b = bounds(poly)
  return (b.x1 - b.x0) / 2
}
/** The round subpaths of a role (dots, circles): where each is and how big. */
const circlesOf = (g: Geometry, role: string): { at: Pt; r: number }[] => polysOf(g, role).map((poly) => ({ at: centre(poly), r: radiusOf(poly) }))

/** The crosses of a drawing: two strokes, 2 × CROSS_ARM × √2 long, that share a middle. Each cross is found once, at its middle. */
function crossesOf(g: Geometry): Pt[] {
  const strokes = polysOf(g, 'detail').filter((p) => p.length === 2 && Math.abs(dist(p[0], p[1]) - 2 * CROSS_ARM * Math.SQRT2) < 0.1)
  const found = new Map<string, { at: Pt; strokes: number }>()
  for (const [a, b] of strokes) {
    const at = P((a.x + b.x) / 2, (a.y + b.y) / 2)
    const key = `${at.x.toFixed(2)},${at.y.toFixed(2)}`
    const f = found.get(key) ?? { at, strokes: 0 }
    f.strokes++
    found.set(key, f)
  }
  for (const f of found.values()) expect(f.strokes, `a cross at ${f.at.x}, ${f.at.y} has two strokes`).toBe(2)
  return [...found.values()].map((f) => f.at)
}

/** True when the two lists hold the same points, each point of one matched by a different point of the other within `tol`. */
function samePoints(a: readonly Pt[], b: readonly Pt[], tol = 0.03): boolean {
  if (a.length !== b.length) return false
  const left = [...b]
  for (const p of a) {
    const i = left.findIndex((q) => dist(p, q) <= tol)
    if (i < 0) return false
    left.splice(i, 1)
  }
  return true
}

const minDistance = (pts: readonly Pt[]): number => {
  let m = Infinity
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) m = Math.min(m, dist(pts[i], pts[j]))
  return m
}

/** Which of the 36 elements, and which charges, the model accepts: all of them, but `ionShells` refuses some. */
const CHARGES = [-3, -2, -1, 0, 1, 2, 3]
const PERIOD = (z: number): number => (z <= 2 ? 1 : z <= 10 ? 2 : z <= 18 ? 3 : 4)
/** What a shell holds, innermost first, in the first four periods (K, L, M, N) as the course teaches it: 2, 8, 8, 2. */
const FILL = [2, 8, 8, 2]

// ---------------------------------------------------------------- the Bohr atom

const BOX = 170
const bohrDrawn = (z: number, charge: number, extra: Record<string, ParamValue> = {}): Geometry => geometry('bohrAtom', BOX, BOX, { z, charge, ...extra })

describe('Bohr atom: the model', () => {
  it('puts Z minus the charge electrons on the shells of each of the 36 elements, for every charge it accepts', () => {
    let accepted = 0,
      refused = 0
    for (const e of ELEMENTS) {
      for (const charge of CHARGES) {
        const shells = ionShells(e, charge)
        const m = bohrModel(e.z, charge)
        if (!shells) {
          // A charge that the element cannot have draws the neutral atom.
          refused++
          expect([m.asked, m.charge, m.structure], `${e.symbol} ${charge}`).toEqual([charge, 0, e.shells])
          expect(m.electrons.length, `${e.symbol} ${charge}`).toBe(e.z)
          continue
        }
        accepted++
        expect(m.charge, `${e.symbol} ${charge}`).toBe(charge)
        expect(m.electrons.length, `${e.symbol} ${charge}: electrons`).toBe(e.z - charge)
        expect(
          m.shells.map((s) => s.electrons.length),
          `${e.symbol} ${charge}: the shells are those of ionShells`,
        ).toEqual(shells)
        expect(sum(m.structure), `${e.symbol} ${charge}`).toBe(e.z - charge)
      }
    }
    expect(accepted).toBeGreaterThan(200)
    expect(refused).toBeGreaterThan(0)
  })

  it('fills the shells 2, 8, 8, 2 for the first twenty elements: an outer shell has electrons only when the shell inside it is full', () => {
    for (const e of ELEMENTS.filter((x) => x.z <= 20)) {
      for (const charge of CHARGES) {
        if (!ionShells(e, charge)) continue
        const s = bohrModel(e.z, charge).structure
        if (!s.length) continue // H+ has no electrons
        const tag = `${e.symbol} ${charge}: ${shellString(s)}`
        s.slice(0, -1).forEach((n, i) => expect(n, `${tag}: shell ${i + 1} is full`).toBe(FILL[i]))
        // An atom or a cation fills no shell beyond its place; an anion may fill its outer shell to the octet (a first shell holds two).
        const cap = charge > 0 || charge === 0 ? FILL[s.length - 1] : s.length === 1 ? 2 : 8
        expect(last(s), tag).toBeGreaterThan(0)
        expect(last(s), tag).toBeLessThanOrEqual(cap)
      }
    }
  })

  it('has as many shells as the period number, and as many outer electrons as the group number (groups 1 to 7; helium 2, the other noble gases 8)', () => {
    for (const e of ELEMENTS) {
      const s = bohrModel(e.z, 0).structure
      expect(s.length, `${e.symbol}: shells`).toBe(PERIOD(e.z))
      const group = ks4Group(e)
      if (group === undefined) continue // a transition metal has no group at KS4
      if (group === 0) expect(last(s), `${e.symbol}: noble gas`).toBe(e.z === 2 ? 2 : 8)
      else expect(last(s), `${e.symbol}: group ${group}`).toBe(group)
    }
  })

  it('gives each simple ion the shells of the nearest noble gas', () => {
    const cases: [number, number, number[]][] = [
      [3, 1, [2]], // Li+
      [11, 1, [2, 8]], // Na+
      [12, 2, [2, 8]], // Mg2+
      [13, 3, [2, 8]], // Al3+
      [8, -2, [2, 8]], // O2-
      [9, -1, [2, 8]], // F-
      [17, -1, [2, 8, 8]], // Cl-
      [16, -2, [2, 8, 8]], // S2-
      [19, 1, [2, 8, 8]], // K+
      [20, 2, [2, 8, 8]], // Ca2+
    ]
    for (const [z, charge, shells] of cases) expect(bohrModel(z, charge).structure, `${element(z)!.symbol} ${charge}`).toEqual(shells)
  })

  it('puts the first electron of each shell at the top and spaces the others evenly', () => {
    for (const z of [1, 2, 6, 11, 17, 20, 29, 36]) {
      const m = bohrModel(z, 0)
      for (const s of m.shells) {
        const n = s.electrons.length
        expect(s.electrons[0].x, `z ${z}`).toBeCloseTo(m.cx, 6)
        expect(s.electrons[0].y, `z ${z}`).toBeCloseTo(m.cy - s.radius, 6)
        s.electrons.forEach((e, i) => {
          expect(dist(e, P(m.cx, m.cy)), `z ${z}`).toBeCloseTo(s.radius, 6)
          expect(e.angle, `z ${z}`).toBeCloseTo(-90 + (360 * i) / n, 6)
        })
      }
    }
  })

  it('gives the last k electrons of the outermost shell the other mark (and no more than the shell holds)', () => {
    for (const [z, charge] of [
      [11, 0],
      [17, -1],
      [8, -2],
      [11, 1],
    ]) {
      const outer = last(bohrModel(z, charge).structure)
      for (const k of [0, 1, 2, 8]) {
        const m = bohrModel(z, charge, { otherMarks: k })
        const other = m.electrons.filter((e) => e.mark === 'cross')
        expect(other.length, `z ${z} ${charge} k ${k}`).toBe(Math.min(k, outer))
        // They are on the outermost shell, the last of it.
        const outermost = last(m.shells).electrons
        expect(outermost.slice(outermost.length - other.length).every((e) => e.mark === 'cross')).toBe(true)
        expect(m.shells.slice(0, -1).every((s) => s.electrons.every((e) => e.mark === 'dot'))).toBe(true)
      }
    }
    expect(bohrModel(11, 0, { mark: 'cross', otherMarks: 1 }).electrons.filter((e) => e.mark === 'dot')).toHaveLength(1)
  })

  it('draws only the outermost shell with outerOnly: its electrons, round the nucleus', () => {
    for (const z of [3, 11, 17, 20]) {
      const full = bohrModel(z, 0)
      const m = bohrModel(z, 0, { outerOnly: true })
      expect(m.shells).toHaveLength(1)
      expect(m.electrons.length).toBe(last(full.structure))
      expect(m.shells[0].radius).toBeCloseTo(last(full.shells).radius, 6)
    }
  })

  it('writes the proton and neutron counts of the commonest isotope in the nucleus, or the symbol, or nothing', () => {
    for (const e of ELEMENTS) {
      expect(
        bohrModel(e.z, 0).nucleus.texts.map((t) => t.text),
        e.symbol,
      ).toEqual([e.symbol])
      expect(bohrModel(e.z, 0, { nucleus: 'blank' }).nucleus.texts).toEqual([])
      const lines = bohrModel(e.z, 0, { nucleus: 'numbers' }).nucleus.texts.map((t) => t.text)
      expect(lines, e.symbol).toEqual([`${e.z} p`, `${e.a - e.z} n`])
      expect(e.a - e.z, e.symbol).toBeGreaterThanOrEqual(0)
    }
  })

  it('puts an ion in square brackets with its charge at the top right, and a neutral atom in none', () => {
    for (const e of ELEMENTS) {
      for (const charge of CHARGES) {
        const m = bohrModel(e.z, charge)
        if (m.charge === 0) {
          expect(m.bracket, `${e.symbol} ${charge}`).toBeNull()
          expect(m.chargeText, `${e.symbol} ${charge}`).toBeNull()
          continue
        }
        const b = m.bracket!
        expect(m.chargeText!.text).toBe(chargeMarkup(charge))
        expect(m.chargeText!.x, `${e.symbol} ${charge}: the charge is outside the brackets`).toBeGreaterThan(b.x1)
        expect(m.chargeText!.y, `${e.symbol} ${charge}: the charge is at the top`).toBeLessThan(m.cy)
        // The brackets are clear of the outermost electron: at least 6 u between the mark and the line.
        for (const el of m.electrons) expect(Math.min(el.x - b.x0, b.x1 - el.x, el.y - b.y0, b.y1 - el.y), `${e.symbol} ${charge}`).toBeGreaterThan(DOT_R + 6)
      }
    }
    expect(chargeMarkup(1)).toBe('^{+}')
    expect(chargeMarkup(2)).toBe('^{2+}')
    expect(chargeMarkup(-1)).toBe('^{-}')
    expect(chargeMarkup(-3)).toBe('^{3-}')
  })

  it('fills its box: the outermost shell is 8 u inside the edge, 26 u for an ion, and the box of 38 + 44 × shells keeps the shells about 20 u apart', () => {
    for (const e of ELEMENTS) {
      const n = e.shells.length
      const side = 38 + 44 * n
      const m = bohrModel(e.z, 0, { w: side, h: side })
      expect(last(m.shells).radius, e.symbol).toBeCloseTo(side / 2 - 8, 6)
      m.shells.forEach((s, i) => {
        const gap = s.radius - (i ? m.shells[i - 1].radius : BOHR.nucleusR)
        expect(gap, `${e.symbol} shell ${i + 1}`).toBeGreaterThan(18.9)
        expect(gap, `${e.symbol} shell ${i + 1}`).toBeLessThan(21.6)
      })
    }
    expect(last(bohrModel(11, 1, { w: 170, h: 170 }).shells).radius).toBeCloseTo(170 / 2 - 8 - 18, 6)
  })

  it('names the atom or the ion', () => {
    expect(bohrLabel(11, 0)).toBe('sodium atom')
    expect(bohrLabel(11, 1)).toBe('sodium ion')
    expect(bohrLabel(12, 2)).toBe('magnesium ion')
    expect(bohrLabel(17, -1)).toBe('chloride ion')
    expect(bohrLabel(8, -2)).toBe('oxide ion')
    expect(bohrLabel(1, 2)).toBe('hydrogen atom') // hydrogen cannot lose two electrons: the neutral atom is drawn
    expect(labelText(symbolDef('bohrAtom'))).toBe('sodium atom')
    expect(labelText(symbolDef('bohrAtom'), { z: 17, charge: -1 })).toBe('chloride ion')
  })
})

describe('Bohr atom: the drawing agrees with the model', () => {
  it('has as many dots as the model has electrons, at the same places, for every element and every charge', () => {
    for (const e of ELEMENTS) {
      for (const charge of CHARGES) {
        const m = bohrModel(e.z, charge, { w: BOX, h: BOX })
        const dots = circlesOf(bohrDrawn(e.z, charge), 'ink')
        const tag = `${e.symbol} ${charge}`
        expect(dots.length, tag).toBe(m.electrons.length)
        expect(dots.length, tag).toBe(e.z - m.charge)
        for (const d of dots) expect(d.r, tag).toBeCloseTo(DOT_R, 1)
        expect(
          samePoints(
            dots.map((d) => d.at),
            m.electrons.map((el) => P(el.x, el.y)),
          ),
          `${tag}: the dots are where the model puts the electrons`,
        ).toBe(true)
      }
    }
  })

  it('has as many crosses as the model has electrons when the mark is a cross, and no dots', () => {
    for (const e of ELEMENTS) {
      for (const charge of [-1, 0, 1]) {
        const m = bohrModel(e.z, charge, { w: BOX, h: BOX, mark: 'cross' })
        const g = bohrDrawn(e.z, charge, { mark: 'cross' })
        const tag = `${e.symbol} ${charge}`
        expect(polysOf(g, 'ink'), tag).toHaveLength(0)
        const crosses = crossesOf(g)
        expect(crosses.length, tag).toBe(e.z - m.charge)
        expect(
          samePoints(
            crosses,
            m.electrons.map((el) => P(el.x, el.y)),
          ),
          tag,
        ).toBe(true)
      }
    }
  })

  it('draws the electrons that moved with the other mark, and the others with the first', () => {
    for (const [z, charge, mark, k] of [
      [17, -1, 'dot', 1],
      [8, -2, 'dot', 2],
      [11, 0, 'dot', 1],
      [11, 0, 'cross', 1],
      [12, 0, 'cross', 2],
    ] as [number, number, 'dot' | 'cross', number][]) {
      const m = bohrModel(z, charge, { w: BOX, h: BOX, mark, otherMarks: k })
      const g = bohrDrawn(z, charge, { mark, otherMarks: k })
      const dots = circlesOf(g, 'ink').map((d) => d.at),
        crosses = crossesOf(g)
      expect(dots.length + crosses.length).toBe(m.electrons.length)
      expect(
        samePoints(
          dots,
          m.electrons.filter((e) => e.mark === 'dot').map((e) => P(e.x, e.y)),
        ),
      ).toBe(true)
      expect(
        samePoints(
          crosses,
          m.electrons.filter((e) => e.mark === 'cross').map((e) => P(e.x, e.y)),
        ),
      ).toBe(true)
      expect(m.electrons.filter((e) => e.mark !== mark)).toHaveLength(Math.min(k, last(m.structure)))
    }
  })

  it('draws a shell as a whole circle round the nucleus, and breaks it only round a cross', () => {
    const rings = (g: Geometry) => polysOf(g, 'detail').filter((p) => p.length > 2)
    const m = bohrModel(11, 0, { w: BOX, h: BOX })
    // Dots: three whole circles, centred on the nucleus.
    const whole = rings(bohrDrawn(11, 0))
    expect(whole).toHaveLength(3)
    expect(whole.map((p) => radiusOf(p)).sort((a, b) => a - b)).toEqual(m.shells.map((s) => s.radius).map((r) => expect.closeTo(r, 1)))
    for (const p of whole) expect(dist(centre(p), P(m.cx, m.cy))).toBeLessThan(0.05)
    // Crosses: each ring is broken once for each cross on it, so that a cross is never drawn over a line.
    const broken = rings(bohrDrawn(11, 0, { mark: 'cross' }))
    expect(broken).toHaveLength(2 + 1 + 8) // two on the first shell, eight on the second, one on the third: an arc between each pair
    for (const c of crossesOf(bohrDrawn(11, 0, { mark: 'cross' })))
      for (const p of broken) for (const q of p) expect(dist(q, c), 'no ring runs through a cross').toBeGreaterThan(CROSS_ARM * Math.SQRT2)
  })

  it('draws the brackets and the charge of an ion, and neither for an atom', () => {
    for (const [z, charge] of [
      [11, 1],
      [12, 2],
      [13, 3],
      [17, -1],
      [8, -2],
      [7, -3],
    ]) {
      const m = bohrModel(z, charge, { w: BOX, h: BOX })
      const g = bohrDrawn(z, charge)
      const outline = polysOf(g, 'outline')
      expect(outline, `${z} ${charge}`).toHaveLength(2) // the left bracket and the right one
      const b = m.bracket!
      const box = bounds(outline.flat())
      expect([box.x0, box.y0, box.x1, box.y1].map((v) => Math.round(v))).toEqual([b.x0, b.y0, b.x1, b.y1].map((v) => Math.round(v)))
      const charges = (g.texts ?? []).filter((t) => t.size === BOHR.chargeSize)
      expect(charges.map((t) => t.text)).toEqual([chargeMarkup(charge)])
      expect(charges[0].anchor).toBe('start')
      expect(charges[0].x).toBeGreaterThan(box.x1)
    }
    for (const z of [1, 11, 17, 36]) {
      const g = bohrDrawn(z, 0)
      expect(polysOf(g, 'outline')).toHaveLength(0)
      expect((g.texts ?? []).filter((t) => t.text.includes('^'))).toHaveLength(0)
    }
    // A charge that the element cannot have draws the neutral atom.
    const g = bohrDrawn(1, 2)
    expect(polysOf(g, 'outline')).toHaveLength(0)
    expect(circlesOf(g, 'ink')).toHaveLength(1)
  })

  it('writes in the nucleus what the model says, centred on the nucleus', () => {
    for (const e of ELEMENTS) {
      const g = bohrDrawn(e.z, 0)
      expect((g.texts ?? []).map((t) => t.text)).toEqual([e.symbol])
      const t = g.texts![0]
      expect([t.x, t.size, t.anchor]).toEqual([0, BOHR.symbolSize, 'middle'])
      // The capital letters are centred on the nucleus.
      expect(BOX / 2 - (t.y - (0.716 * t.size) / 2)).toBeCloseTo(0, 1)
      const numbers = bohrDrawn(e.z, 0, { nucleus: 'numbers' })
      expect((numbers.texts ?? []).map((n) => n.text)).toEqual([`${e.z} p`, `${e.a - e.z} n`])
      expect(bohrDrawn(e.z, 0, { nucleus: 'blank' }).texts ?? []).toEqual([])
    }
  })

  it('writes the electron structure under the atom, and makes the atom smaller to make room', () => {
    for (const [z, charge] of [
      [11, 0],
      [17, -1],
      [20, 0],
      [12, 2],
    ]) {
      const g = bohrDrawn(z, charge, { structure: true })
      const m = bohrModel(z, charge, { w: BOX, h: BOX, structure: true })
      const plain = bohrModel(z, charge, { w: BOX, h: BOX })
      const t = (g.texts ?? []).find((x) => x.size === BOHR.structureSize)!
      expect(t.text).toBe(shellString(ionShells(element(z)!, charge)!))
      // Under every mark and under the brackets, inside the box.
      const lowest = Math.max(
        ...circlesOf(g, 'ink').map((d) => d.at.y + d.r),
        ...polysOf(g, 'outline')
          .flat()
          .map((q) => q.y),
      )
      expect(t.y - 0.716 * t.size, `${z} ${charge}`).toBeGreaterThan(lowest)
      expect(t.y).toBeLessThan(BOX)
      expect(last(m.shells).radius).toBeCloseTo(last(plain.shells).radius - BOHR.structureRoom / 2, 6)
    }
    expect(((bohrDrawn(11, 0).texts ?? []) as { size: number }[]).some((t) => t.size === BOHR.structureSize)).toBe(false)
  })

  it('keeps every electron clear of the nucleus and of the other electrons, at the default size and at the smallest', () => {
    const min = symbolDef('bohrAtom').min!
    for (const side of [BOX, min.w, 1.5 * BOX]) {
      for (const e of ELEMENTS) {
        for (const charge of [0, -1, 1].filter((c) => ionShells(e, c))) {
          for (const mark of ['dot', 'cross'] as const) {
            const g = geometry('bohrAtom', side, side, { z: e.z, charge, mark })
            const marks = [...circlesOf(g, 'ink').map((d) => d.at), ...crossesOf(g)]
            const tag = `${e.symbol} ${charge} ${mark} in ${side}`
            expect(marks.length, tag).toBe(e.z - bohrModel(e.z, charge).charge)
            expect(minDistance(marks), `${tag}: no two marks touch`).toBeGreaterThan(2 * DOT_R + 2.5)
            const c = P(0, side / 2)
            for (const p of marks) expect(dist(p, c), `${tag}: clear of the nucleus`).toBeGreaterThan(BOHR.nucleusR + DOT_R + 1.5)
          }
        }
      }
    }
  })
})

// ---------------------------------------------------------------- the models of the atom

describe('models of the atom', () => {
  const size = 150
  const MARKS: Mark[] = ['minus', 'dot', 'cross']
  const draw = (model: string, electrons: number, mark: Mark, side = size): Geometry => geometry('atomModels', side, side, { model, electrons, mark })
  /** The electron marks of a drawing: circled minus signs, dots or crosses, as the mark says. */
  const marksOf = (g: Geometry, mark: Mark): Pt[] =>
    mark === 'dot' ? circlesOf(g, 'ink').map((c) => c.at) : mark === 'cross' ? crossesOf(g) : circlesOf(g, 'solid').map((c) => c.at)

  it('has as many electrons in the picture as the parameter asks for, in every model and with every mark', () => {
    for (const model of ['plumPudding', 'nuclear', 'shell'] as const) {
      for (const mark of MARKS) {
        for (let n = 1; n <= 10; n++) {
          const m = atomModel(model, n, mark, size)
          const tag = `${model} ${mark} ${n}`
          expect(m.electrons, tag).toHaveLength(n)
          const drawn = marksOf(draw(model, n, mark), mark)
          expect(drawn.length, tag).toBe(n)
          expect(
            samePoints(
              drawn,
              m.electrons.map((e) => P(e.x, e.y)),
            ),
            `${tag}: where the model puts them`,
          ).toBe(true)
          // Only the marks of the electrons are drawn with the mark's role: a minus sign has its circle.
          if (mark === 'minus') for (const c of circlesOf(draw(model, n, mark), 'solid')) expect(c.r, tag).toBeCloseTo(MINUS_R, 1)
        }
      }
    }
  })

  it('has no separate nucleus in the plum pudding: one tinted ball, its hatch, and electrons inside it', () => {
    for (const n of [1, 4, 10]) {
      const m = atomModel('plumPudding', n, 'minus', size)
      expect(m.nucleus).toBeNull()
      const g = draw('plumPudding', n, 'minus')
      expect(g.prims.map((p) => p.role).filter((r) => r === 'dark')).toHaveLength(0)
      const ball = circlesOf(g, 'tint')
      expect(ball).toHaveLength(1)
      expect(ball[0].r).toBeCloseTo(size / 2 - 8, 1)
      expect(
        g.prims.some((p) => p.role === 'hatch'),
        'a tint always has its hatch',
      ).toBe(true)
      for (const e of m.electrons) expect(dist(e, P(m.cx, m.cy)) + MINUS_R + 1, `${n}: inside the ball`).toBeLessThan(m.radius)
    }
  })

  it('keeps the electrons of the pudding apart, and one more electron never moves the others', () => {
    for (const mark of MARKS) {
      const ten = atomModel('plumPudding', 10, mark, 100) // the smallest box
      expect(minDistance(ten.electrons.map((e) => P(e.x, e.y))), mark).toBeGreaterThan(2 * MINUS_R + 1)
      for (let n = 1; n < 10; n++) {
        const fewer = atomModel('plumPudding', n, mark, 100)
        expect(fewer.electrons.map((e) => [e.x, e.y])).toEqual(ten.electrons.slice(0, n).map((e) => [e.x, e.y]))
      }
    }
  })

  it('has, in the nuclear and the shell model, a nucleus much smaller than the atom, with every electron outside it', () => {
    for (const model of ['nuclear', 'shell'] as const) {
      for (const n of [1, 2, 3, 6, 10]) {
        const m = atomModel(model, n, 'minus', size)
        const g = draw(model, n, 'minus')
        const nucleus = circlesOf(g, 'dark')
        expect(nucleus, `${model} ${n}`).toHaveLength(1)
        const r = nucleus[0].r
        expect(m.nucleus!.r).toBeCloseTo(r, 1)
        // "Much smaller": a tenth of the atom or less.
        expect(r, `${model} ${n}`).toBeLessThanOrEqual(m.radius / 10)
        for (const p of marksOf(g, 'minus'))
          expect(dist(p, nucleus[0].at), `${model} ${n}: an electron is outside the nucleus`).toBeGreaterThan(r + MINUS_R + 10)
        // The plus sign is drawn beside the nucleus and not on it.
        const plus = polysOf(g, 'detail').filter((q) => q.length === 2 && Math.abs(dist(q[0], q[1]) - 7) < 0.1)
        expect(plus).toHaveLength(2)
        expect(dist(centre(plus[0]), nucleus[0].at)).toBeGreaterThan(r + 3)
      }
    }
  })

  it('puts the electrons of the nuclear model on one wide ring, and those of the shell model on shells of 2 and then the rest', () => {
    for (let n = 1; n <= 10; n++) {
      const nuclear = atomModel('nuclear', n, 'dot', size)
      expect(nuclear.rings).toHaveLength(1)
      expect(nuclear.rings[0].radius).toBeCloseTo(0.42 * size, 6)
      const shell = atomModel('shell', n, 'dot', size)
      expect(
        shell.rings.map((r) => r.electrons.length),
        `shell ${n}`,
      ).toEqual(n <= 2 ? [n] : [2, n - 2])
      // The drawing: the marks at each radius from the nucleus.
      const g = draw('shell', n, 'dot')
      const c = P(0, size / 2)
      const radii = circlesOf(g, 'ink').map((d) => Math.round(dist(d.at, c) * 10) / 10)
      expect([...new Set(radii)].length, `shell ${n}`).toBe(shell.rings.length)
    }
  })
})

// ---------------------------------------------------------------- nuclide notation

describe('nuclide notation', () => {
  it('has neutrons = A minus Z, never negative; A = 0 is the commonest isotope; an A below Z is raised to Z', () => {
    for (const e of ELEMENTS) {
      for (const a of [0, 1, e.z - 1, e.z, e.z + 1, e.a, 80]) {
        const n = nuclide(e.z, a)
        expect(n.protons, `${e.symbol} ${a}`).toBe(e.z)
        expect(n.neutrons, `${e.symbol} ${a}`).toBe(n.a - n.z)
        expect(n.neutrons, `${e.symbol} ${a}`).toBeGreaterThanOrEqual(0)
        expect(n.a, `${e.symbol} ${a}`).toBeGreaterThanOrEqual(e.z)
        if (a === 0) expect(n.a, `${e.symbol}: the commonest isotope`).toBe(e.a)
        else expect(n.a, `${e.symbol} ${a}`).toBe(Math.max(a, e.z))
      }
    }
    expect(nuclide(11, 0).neutrons).toBe(12)
    expect(nuclide(17, 37).neutrons).toBe(20)
    expect(nuclide(6, 3)).toMatchObject({ a: 6, neutrons: 0 })
  })

  it('has Z minus the charge electrons, and draws the neutral atom for a charge that the element cannot have', () => {
    for (const e of ELEMENTS) {
      for (const charge of CHARGES) {
        const n = nuclide(e.z, 0, charge)
        if (ionShells(e, charge)) expect([n.charge, n.electrons], `${e.symbol} ${charge}`).toEqual([charge, e.z - charge])
        else expect([n.charge, n.electrons], `${e.symbol} ${charge}`).toEqual([0, e.z])
        expect(n.electrons).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('draws the mass number above the atomic number, right-aligned, left of the symbol, and the charge after it', () => {
    for (const e of ELEMENTS) {
      for (const [a, charge] of [
        [0, 0],
        [e.a + 1, 0],
        [0, 1],
        [0, -2],
      ]) {
        const n = nuclide(e.z, a, charge)
        const g = geometry('nuclideNotation', 96, 50, { z: e.z, a, charge })
        const texts = g.texts!
        const symbol = texts.find((t) => t.size === NOTATION.symbol)!
        const [mass, atomic] = texts.filter((t) => t.size === NOTATION.numbers)
        const tag = `${e.symbol} ${a} ${charge}`
        expect(symbol.text, tag).toBe(n.charge ? `${e.symbol}${chargeMarkup(n.charge)}` : e.symbol)
        expect(mass.text, tag).toBe(String(n.a))
        expect(atomic.text, `${tag}: the atomic number matches the symbol (element ${e.z})`).toBe(String(e.z))
        expect(mass.anchor).toBe('end')
        expect(atomic.anchor).toBe('end')
        expect(mass.x).toBe(atomic.x) // right-aligned with each other
        expect(mass.y).toBeLessThan(atomic.y) // the mass number above
        expect(mass.x, tag).toBeLessThan(symbol.x) // at its left
        expect(symbol.anchor).toBe('start')
        // The pair is centred on the capital letters of the symbol.
        const mid = symbol.y - (0.716 * NOTATION.symbol) / 2
        expect((mass.y - 0.716 * NOTATION.numbers + atomic.y) / 2, tag).toBeCloseTo(mid, 0)
      }
    }
  })

  it('adds the counts: Z protons, N neutrons, E electrons', () => {
    for (const e of ELEMENTS) {
      for (const charge of [-1, 0, 1]) {
        const n = nuclide(e.z, 0, charge)
        const g = geometry('nuclideNotation', 96, 50, { z: e.z, charge, counts: true })
        const lines = g.texts!.filter((t) => t.size === NOTATION.counts).map((t) => t.text)
        const word = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : 's'}`
        expect(lines, `${e.symbol} ${charge}`).toEqual([word(e.z, 'proton'), word(e.a - e.z, 'neutron'), word(e.z - n.charge, 'electron')])
      }
    }
    expect(geometry('nuclideNotation', 96, 50, { z: 11 }).texts!.filter((t) => t.size === NOTATION.counts)).toHaveLength(0)
  })

  it('is named by the element and the mass number', () => {
    expect(labelText(symbolDef('nuclideNotation'))).toBe('sodium-23')
    expect(labelText(symbolDef('nuclideNotation'), { z: 17, a: 37 })).toBe('chlorine-37')
    expect(nuclideLabel(nuclide(1, 2))).toBe('hydrogen-2')
  })
})

// ---------------------------------------------------------------- isotopes drawn as nuclei

describe('isotopes drawn as nuclei', () => {
  /** The circles of a drawing grouped into the clusters that they touch: protons (tint) and neutrons (solid). */
  function clustersOf(g: Geometry): { protons: Pt[]; neutrons: Pt[] }[] {
    const circles = [...circlesOf(g, 'tint').map((c) => ({ ...c, proton: true })), ...circlesOf(g, 'solid').map((c) => ({ ...c, proton: false }))]
    for (const c of circles) expect(c.r, 'every circle has the radius of a nucleon').toBeCloseTo(NUCLEON_R, 1)
    const group = circles.map((_, i) => i)
    const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])))
    for (let i = 0; i < circles.length; i++)
      for (let j = i + 1; j < circles.length; j++) if (dist(circles[i].at, circles[j].at) < 2 * NUCLEON_R + 0.6) group[find(i)] = find(j)
    const by = new Map<number, typeof circles>()
    circles.forEach((c, i) => by.set(find(i), [...(by.get(find(i)) ?? []), c]))
    return [...by.values()]
      .sort((p, q) => p[0].at.x - q[0].at.x)
      .map((cs) => ({ protons: cs.filter((c) => c.proton).map((c) => c.at), neutrons: cs.filter((c) => !c.proton).map((c) => c.at) }))
  }

  const CASES: [number, number, number, number][] = [
    [17, 35, 37, 0], // chlorine, the default
    [1, 1, 2, 3], // hydrogen
    [6, 12, 13, 14],
    [18, 36, 38, 40],
    [8, 16, 17, 18],
    [12, 24, 25, 26],
    [3, 6, 7, 0],
    [17, 35, 0, 0], // one nucleus
  ]

  it('draws a circles in each cluster, z of them protons, and the isotopes share z', () => {
    for (const [z, a1, a2, a3] of CASES) {
      const g = geometry('isotopeNuclei', 300, 150, { z, a1, a2, a3 })
      const clusters = clustersOf(g)
      const asked = [a1, a2, a3].filter((a, i) => i === 0 || a > 0)
      expect(
        clusters.map((c) => c.protons.length + c.neutrons.length),
        `z ${z}`,
      ).toEqual(asked)
      for (const c of clusters) {
        expect(c.protons.length, `z ${z}: the protons`).toBe(z)
        expect(c.neutrons.length, `z ${z}: the neutrons`).toBe(c.protons.length + c.neutrons.length - z)
      }
      // The neutron numbers differ, the proton number does not.
      expect(new Set(clusters.map((c) => c.protons.length)).size).toBe(1)
      expect(new Set(clusters.map((c) => c.neutrons.length)).size).toBe(new Set(asked).size)
    }
  })

  it('raises a mass number below z to z, and leaves out a second or third isotope that is 0', () => {
    const g = geometry('isotopeNuclei', 300, 150, { z: 17, a1: 10, a2: 0, a3: 12 })
    const clusters = clustersOf(g)
    expect(clusters.map((c) => c.protons.length + c.neutrons.length)).toEqual([17, 17])
    expect(clusters.every((c) => c.neutrons.length === 0)).toBe(true)
    expect(clustersOf(geometry('isotopeNuclei', 300, 150, { z: 17, a1: 35, a2: 0, a3: 0 }))).toHaveLength(1)
  })

  it('has circles that touch but never overlap, and clusters that never touch each other', () => {
    for (const side of [1, 0.8]) {
      for (const [z, a1, a2, a3] of CASES) {
        const g = geometry('isotopeNuclei', 300 * side, 150 * side, { z, a1, a2, a3 })
        const all = [...circlesOf(g, 'tint'), ...circlesOf(g, 'solid')].map((c) => c.at)
        expect(minDistance(all), `z ${z} at ${side}`).toBeGreaterThan(2 * NUCLEON_R - 0.05)
        const clusters = clustersOf(g)
        // Between two clusters there is room for a circle's width at least.
        for (let i = 0; i < clusters.length; i++) {
          for (let j = i + 1; j < clusters.length; j++) {
            const p = [...clusters[i].protons, ...clusters[i].neutrons],
              q = [...clusters[j].protons, ...clusters[j].neutrons]
            let near = Infinity
            for (const u of p) for (const v of q) near = Math.min(near, dist(u, v))
            expect(near, `z ${z} at ${side}: clusters ${i} and ${j}`).toBeGreaterThan(2 * NUCLEON_R + 4)
          }
        }
      }
    }
  })

  it('packs each cluster hexagonally: every circle touches another, and the cluster is compact', () => {
    for (let a = 1; a <= 40; a++) {
      const cs = clusterCircles(Math.ceil(a / 2), a)
      expect(cs).toHaveLength(a)
      if (a > 1) for (const c of cs) expect(Math.min(...cs.filter((d) => d !== c).map((d) => dist(c, d))), `a ${a}`).toBeLessThan(2 * NUCLEON_R + 0.01)
      // As round as a hexagonal cluster can be: the farthest circle is within 1.2 of the radius of a disc of the same area.
      const far = Math.max(...cs.map((c) => Math.hypot(c.x, c.y)))
      const disc = Math.sqrt((a * ((Math.sqrt(3) / 2) * (2 * NUCLEON_R) ** 2)) / Math.PI)
      expect(far, `a ${a}`).toBeLessThan(disc * 1.2 + NUCLEON_R)
    }
  })

  it('writes the nuclide notation under each cluster, with the same code as nuclideNotation', () => {
    const g = geometry('isotopeNuclei', 300, 150, { z: 17, a1: 35, a2: 37, a3: 0, notation: true })
    const symbols = g.texts!.filter((t) => t.size === NOTATION.symbol)
    expect(symbols.map((t) => t.text)).toEqual(['Cl', 'Cl'])
    expect(g.texts!.filter((t) => t.size === NOTATION.numbers).map((t) => t.text)).toEqual(['35', '17', '37', '17'])
    // Each notation is under its cluster, and the two are level.
    const clusters = clustersOf(g)
    clusters.forEach((c, i) => {
      const lowest = Math.max(...[...c.protons, ...c.neutrons].map((p) => p.y)) + NUCLEON_R
      expect(symbols[i].y - 0.716 * NOTATION.symbol).toBeGreaterThan(lowest)
      const centreX = (Math.min(...[...c.protons, ...c.neutrons].map((p) => p.x)) + Math.max(...[...c.protons, ...c.neutrons].map((p) => p.x))) / 2
      expect(Math.abs(symbols[i].x - centreX), 'the notation is centred under its cluster').toBeLessThan(40)
    })
    expect(symbols[0].y).toBe(symbols[1].y)
    expect(g.texts!.filter((t) => t.size === NOTATION.symbol)).toHaveLength(2)
    expect(geometry('isotopeNuclei', 300, 150, { notation: false }).texts ?? []).toEqual([])
    // The same text as the symbol of the same nuclide.
    const alone = geometry('nuclideNotation', 96, 50, { z: 17, a: 35 }).texts!
    expect(alone.map((t) => t.text).sort()).toEqual(
      g
        .texts!.slice(0, 3)
        .map((t) => t.text)
        .sort(),
    )
  })

  it('counts the protons and the neutrons of each nucleus, when asked', () => {
    const g = geometry('isotopeNuclei', 300, 150, { z: 17, a1: 35, a2: 37, counts: true })
    const lines = g.texts!.filter((t) => t.size === NOTATION.counts).map((t) => t.text)
    expect(lines).toEqual(['17 protons', '18 neutrons', '17 protons', '20 neutrons'])
    expect(
      geometry('isotopeNuclei', 300, 150, { z: 1, a1: 1, a2: 2, a3: 3, counts: true })
        .texts!.filter((t) => t.size === NOTATION.counts)
        .map((t) => t.text),
    ).toEqual(['1 proton', '0 neutrons', '1 proton', '1 neutron', '1 proton', '2 neutrons'])
  })

  it('draws a plus sign in each proton and none in a neutron, and mixes both kinds through the cluster', () => {
    const g = geometry('isotopeNuclei', 300, 150, { z: 17, a1: 35, a2: 37 })
    const clusters = clustersOf(g)
    const plus = polysOf(g, 'detail').filter((p) => p.length === 2)
    expect(plus).toHaveLength(2 * (17 + 17)) // two strokes in each plus sign
    for (const c of clusters) {
      for (const p of c.protons) expect(plus.filter((q) => dist(centre(q), p) < 0.05)).toHaveLength(2)
      for (const n of c.neutrons) expect(plus.filter((q) => dist(centre(q), n) < 0.05)).toHaveLength(0)
    }
    // Mixed: the protons are spread over the cluster, not collected on one side.
    for (const c of clusters) {
      const all = [...c.protons, ...c.neutrons]
      const mean = (pts: Pt[], k: 'x' | 'y') => sum(pts.map((p) => p[k])) / pts.length
      expect(Math.hypot(mean(c.protons, 'x') - mean(all, 'x'), mean(c.protons, 'y') - mean(all, 'y'))).toBeLessThan(5)
    }
  })

  it('is named by the element', () => {
    expect(labelText(symbolDef('isotopeNuclei'))).toBe('chlorine isotopes')
    expect(isotopeModel(1, [1, 2, 3]).clusters.map((c) => c.a)).toEqual([1, 2, 3])
  })
})

// ---------------------------------------------------------------- alpha-particle scattering

describe('alpha-particle scattering', () => {
  /** What the drawing shows: the atoms (and their nuclei), and each path as a polyline with the tip of its arrow head. */
  function read(g: Geometry) {
    const detail = polysOf(g, 'detail')
    const closed = (p: Pt[]) => dist(p[0], last(p)) < 0.01
    const atoms = detail.filter((p) => closed(p) && Math.abs(radiusOf(p) - ALPHA.atomR) < 0.1).map(centre)
    const paths = detail.filter((p) => !closed(p) && bounds(p).x1 - bounds(p).x0 > 60)
    const nuclei = circlesOf(g, 'ink').filter((c) => Math.abs(c.r - ALPHA.nucleusR) < 0.05)
    const arrows = polysOf(g, 'ink').filter((p) => Math.abs(radiusOf(p) - ALPHA.nucleusR) >= 0.05)
    return { atoms, paths, nuclei, arrows }
  }
  const turnOf = (path: Pt[]): number => {
    const a = path[0],
      b = path[1],
      c = path[path.length - 2],
      d = last(path)
    const first = Math.atan2(b.y - a.y, b.x - a.x),
      end = Math.atan2(d.y - c.y, d.x - c.x)
    let t = ((end - first) * 180) / Math.PI
    if (t > 180) t -= 360
    if (t < -180) t += 360
    return t
  }
  /** The distance of a polyline from a point. */
  const passes = (path: Pt[], at: Pt): number => {
    let best = Infinity
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i],
        b = path[i + 1]
      const dx = b.x - a.x,
        dy = b.y - a.y
      const t = Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
      best = Math.min(best, dist(P(a.x + t * dx, a.y + t * dy), at))
    }
    return best
  }
  const SIZES: [number, number][] = [
    [380, 230],
    [300, 200],
    [570, 345],
  ]

  it('draws as many paths as asked for, a nucleus in each atom of the foil when they are on, and none when they are off', () => {
    for (const [w, h] of SIZES) {
      for (let n = 5; n <= 12; n++) {
        const g = geometry('alphaScattering', w, h, { paths: n, nuclei: true })
        const r = read(g)
        expect(r.paths, `${n} paths in ${w} × ${h}`).toHaveLength(n)
        expect(r.arrows, `${n}: an arrow head for each`).toHaveLength(n)
        expect(r.atoms.length).toBeGreaterThan(8)
        expect(r.nuclei).toHaveLength(r.atoms.length)
        expect(
          samePoints(
            r.nuclei.map((c) => c.at),
            r.atoms,
          ),
          'a nucleus at the centre of each atom',
        ).toBe(true)
        expect(read(geometry('alphaScattering', w, h, { paths: n, nuclei: false })).nuclei).toHaveLength(0)
      }
    }
  })

  it('lets no path enter a nucleus', () => {
    for (const [w, h] of SIZES) {
      for (let n = 5; n <= 12; n++) {
        const r = read(geometry('alphaScattering', w, h, { paths: n }))
        for (const path of r.paths) for (const at of r.atoms) expect(passes(path, at), `${n} paths in ${w} × ${h}`).toBeGreaterThan(ALPHA.nucleusR + 1.25)
      }
    }
  })

  it('bends each bent path away from the nucleus that it passes, and bends it more the closer it passes', () => {
    for (const [w, h] of SIZES) {
      for (let n = 5; n <= 12; n++) {
        const r = read(geometry('alphaScattering', w, h, { paths: n }))
        const bent: { s: number; turn: number }[] = []
        for (const path of r.paths) {
          const turn = turnOf(path)
          // The nucleus that it passes: the nearest to its incident line (the first part of the path, which is level).
          const y = path[0].y
          expect(Math.abs(path[1].y - y), 'the incident line is level').toBeLessThan(0.3)
          const near = r.atoms.reduce((p, q) => (Math.abs(q.y - y) < Math.abs(p.y - y) ? q : p))
          const s = y - near.y // above the nucleus is negative
          if (Math.abs(turn) < 3) continue
          bent.push({ s, turn })
          // Away: a path above its nucleus is turned upwards (negative on the page), one below it downwards.
          expect(Math.sign(turn), `${n} paths: the path at ${s.toFixed(1)} u from its nucleus bends away from it`).toBe(Math.sign(s))
        }
        expect(bent.length, `${n} paths: some bend`).toBeGreaterThan(0)
        for (const p of bent)
          for (const q of bent)
            if (Math.abs(p.s) < Math.abs(q.s) - 0.05) expect(Math.abs(p.turn), `${n}: ${p.s} bends more than ${q.s}`).toBeGreaterThan(Math.abs(q.turn))
        // Closer than any path that does not bend.
        for (const path of r.paths) {
          if (Math.abs(turnOf(path)) >= 3) continue
          const y = path[0].y
          const near = Math.min(...r.atoms.map((q) => Math.abs(q.y - y)))
          for (const p of bent) expect(Math.abs(p.s), `${n}: a straight path passes further out than a bent one`).toBeLessThan(near)
        }
      }
    }
  })

  it('has most paths straight, and at most one that turns back', () => {
    for (const [w, h] of SIZES) {
      for (let n = 5; n <= 12; n++) {
        const r = read(geometry('alphaScattering', w, h, { paths: n }))
        const turns = r.paths.map(turnOf)
        expect(turns.filter((t) => Math.abs(t) < 1).length, `${n}: most are straight`).toBeGreaterThan(n / 2)
        const back = r.paths.filter((p) => last(p).x < p[p.length - 2].x)
        expect(back.length, `${n}: one turns back`).toBe(1)
        expect(turns.filter((t) => Math.abs(t) > 90)).toHaveLength(1)
      }
    }
  })

  it('draws every path from the lead block to the detector screen, and no two paths cross', () => {
    for (const [w, h] of SIZES) {
      for (let n = 5; n <= 12; n++) {
        const g = geometry('alphaScattering', w, h, { paths: n })
        const r = read(g)
        const screen = 0.45 * h
        const middle = P(r.atoms[0].x, h / 2)
        for (const arrow of r.arrows) {
          // The tip of each arrow head is on the screen, which is a circle of radius 0.45 h round the foil.
          const tip = arrow.reduce((p, q) => (Math.abs(dist(q, middle) - screen) < Math.abs(dist(p, middle) - screen) ? q : p))
          expect(Math.abs(dist(tip, middle) - screen), `${n} in ${w} × ${h}`).toBeLessThan(0.1)
        }
        for (const path of r.paths) expect(path[0].x, 'it starts at the block').toBeLessThan(-w / 2 + 40)
        for (let i = 0; i < r.paths.length; i++) {
          for (let j = i + 1; j < r.paths.length; j++) {
            const p = r.paths[i],
              q = r.paths[j]
            const crossed = p.some((_, a) => a + 1 < p.length && q.some((__, b) => b + 1 < q.length && cross(p[a], p[a + 1], q[b], q[b + 1])))
            expect(crossed, `${n} paths in ${w} × ${h}: paths ${i} and ${j} cross`).toBe(false)
          }
        }
      }
    }
  })

  it('has a deflection that falls as the path passes further out, reaches 0 at 4 u, and turns the closest path back', () => {
    let before = Infinity
    for (let b = ALPHA.reverseB; b < ALPHA.straight; b += 0.05) {
      const t = deflection(b)
      expect(t, `b ${b}`).toBeLessThan(before)
      expect(t).toBeGreaterThan(0)
      before = t
    }
    expect(deflection(ALPHA.straight)).toBe(0)
    expect(deflection(10)).toBe(0)
    expect(deflection(ALPHA.reverseB)).toBeGreaterThan(90)
    // The nucleus is 1.5 u across: the closest path passes outside it.
    expect(ALPHA.reverseB).toBeGreaterThan(ALPHA.nucleusR + 0.625)
  })

  it('keeps every path at least 9 u from the next at the foil, and puts the closest pass at the top of the beam', () => {
    for (let n = 5; n <= 12; n++) {
      const slots = alphaPattern(n)
      expect(slots).toHaveLength(n)
      const heights = slots.map((q) => q.k * ALPHA.pitch + q.s)
      for (let i = 1; i < n; i++) expect(heights[i] - heights[i - 1], `${n}: ${i}`).toBeGreaterThan(9)
      expect(Math.abs(slots[0].s)).toBe(Math.min(...slots.map((q) => Math.abs(q.s))))
    }
  })

  it('builds the same model as it draws', () => {
    const m = alphaModel(8, true)
    const r = read(geometry('alphaScattering', 380, 230, { paths: 8 }))
    expect(m.paths).toHaveLength(r.paths.length)
    expect(samePoints(m.nuclei, r.atoms)).toBe(true)
  })
})

/** True when the segments a–b and c–d cross (they meet at a point inside both). */
function cross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const d1 = o(a, b, c),
    d2 = o(a, b, d),
    d3 = o(c, d, a),
    d4 = o(c, d, b)
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9
}
