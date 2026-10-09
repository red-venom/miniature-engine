// The science of the carbon pictures (graphite and C60): the model is tested against the lines of the catalogue row, then the drawing is
// tested against the model: the circles and lines in `geometry()` are counted and placed. A picture may never show a part that the model lacks.

import { describe, expect, it } from 'vitest'
import { P, dist, type Pt } from '../kernel/geom'
import {
  C60_DRAW,
  C60_RADIUS,
  C60_TURN,
  DASH,
  FORCE_SITES,
  GRAPHITE,
  GRAPHITE_BRIEF,
  GRAPHITE_STYLE,
  PHI,
  c60Geometry,
  c60Molecule,
  c60View,
  circleBounds,
  clampLayers,
  graphiteGeometry,
  graphiteModel,
  honeycombPatch,
  type C60Turn,
  type GraphiteStyle,
} from './cages'
import { oblique } from './oblique'
import { geometry } from './registry'
import { primNodes } from '../render/render'
import type { Geometry, Prim } from './types'

// ---------------------------------------------------------------- reading a drawing

/** The circles of a path made by `circle()` in kit.ts: the centre and the radius of each, in the order drawn. */
function circlesIn(d: string): { c: Pt; r: number }[] {
  const out: { c: Pt; r: number }[] = []
  for (const m of d.matchAll(/M(-?[\d.]+) (-?[\d.]+)a([\d.]+) ([\d.]+) 0 1 0 (-?[\d.]+) 0a[\d.]+ [\d.]+ 0 1 0 -?[\d.]+ 0Z/g)) {
    const r = Number(m[3])
    out.push({ c: P(Number(m[1]) + r, Number(m[2])), r })
  }
  return out
}
/** The straight lines `M x y L x y` of a path, in the order drawn. */
function linesIn(d: string): [Pt, Pt][] {
  return [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [P(Number(m[1]), Number(m[2])), P(Number(m[3]), Number(m[4]))])
}
const prim = (g: Geometry, role: Prim['role']): string =>
  g.prims
    .filter((p) => p.role === role)
    .map((p) => p.d)
    .join('')
const near = (a: Pt, b: Pt, tol = 0.03): boolean => dist(a, b) <= tol
/** Do the segments p-q and a-b cross? (Touching at an end does not count.) */
function crosses([p, q]: [Pt, Pt], [a, b]: [Pt, Pt]): boolean {
  const side = (u: Pt, v: Pt, w: Pt) => Math.sign((v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x))
  return side(p, q, a) * side(p, q, b) < 0 && side(a, b, p) * side(a, b, q) < 0
}
/** The distance from a point to a segment. */
function distToSegment(p: Pt, [a, b]: [Pt, Pt]): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2,
    t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2)) : 0
  return dist(p, P(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)))
}

// ================================================================ graphite

describe('graphite: the model', () => {
  const m = graphiteModel(3)
  const per = m.atomsPerSheet
  const sheet0 = m.atoms.filter((a) => a.sheet === 0)
  const adjacency = (model = m) => {
    const nb = model.atoms.map(() => [] as number[])
    for (const { a, b } of model.bonds) {
      nb[a].push(b)
      nb[b].push(a)
    }
    return nb
  }
  const pos = (id: number): [number, number, number] => [m.atoms[id].x, m.atoms[id].y, m.atoms[id].z]
  const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i])
  const len = (v: number[]) => Math.hypot(...v)

  it('puts a patch of two rows of three hexagons in each sheet, every ring with six atoms and six bonds', () => {
    expect(GRAPHITE.rows).toBe(2)
    expect(GRAPHITE.cols).toBe(3)
    const rings = m.rings.filter((ring) => ring.every((id) => m.atoms[id].sheet === 0))
    expect(rings).toHaveLength(6)
    const bondSet = new Set(m.bonds.map(({ a, b }) => `${Math.min(a, b)}-${Math.max(a, b)}`))
    for (const ring of rings) {
      expect(new Set(ring).size).toBe(6)
      ring.forEach((a, i) => {
        const b = ring[(i + 1) % 6]
        expect(bondSet.has(`${Math.min(a, b)}-${Math.max(a, b)}`), `ring side ${a}-${b}`).toBe(true)
      })
    }
  })

  it('has the atoms per sheet that the honeycomb patch gives, counted from the corners of the hexagons', () => {
    // The corners of the 6 hexagons, from the rule in the brief (centres at x = (m + 1/2 on odd rows) sqrt 3, z = 1.5 row; corners at 30, 90, ... degrees),
    // joined when they are the same point. This does not use the model's own list of atoms.
    const corners: { x: number; z: number; ring: number }[] = []
    let ring = 0
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++, ring++)
        for (let a = 0; a < 6; a++) {
          const t = (Math.PI / 180) * (30 + 60 * a)
          corners.push({ x: (col + (row % 2) / 2) * Math.sqrt(3) + Math.cos(t), z: 1.5 * row + Math.sin(t), ring })
        }
    const clusters: { rings: Set<number> }[] = []
    const seeds: { x: number; z: number }[] = []
    for (const c of corners) {
      const i = seeds.findIndex((s) => Math.hypot(s.x - c.x, s.z - c.z) < 1e-6)
      if (i < 0) {
        seeds.push(c)
        clusters.push({ rings: new Set([c.ring]) })
      } else clusters[i].rings.add(c.ring)
    }
    expect(per).toBe(seeds.length)
    // An independent count: a patch of h hexagons has 4h + 2 - i atoms, where i is the number of atoms that belong to three hexagons.
    const inner = clusters.filter((c) => c.rings.size === 3).length
    expect(per).toBe(4 * 6 + 2 - inner)
    // And the same atoms are where the model puts them.
    for (const s of seeds) expect(sheet0.some((a) => Math.hypot(a.x - s.x, a.z - s.z) < 1e-6)).toBe(true)
    expect(honeycombPatch(2, 3).atoms).toHaveLength(per)
  })

  it('gives every atom three bonds: the bonds of the patch, and a stub on each edge atom that has only two', () => {
    const nb = adjacency()
    const stubs = new Map<number, number>()
    for (const s of m.stubs) stubs.set(s.atom, (stubs.get(s.atom) ?? 0) + 1)
    for (const a of m.atoms) {
      const bonds = nb[a.id].length,
        stub = stubs.get(a.id) ?? 0
      expect(bonds + stub, `atom ${a.id}`).toBe(3)
      expect(bonds === 3 ? stub === 0 : stub === 1, `atom ${a.id} has ${bonds} bonds and ${stub} stubs`).toBe(true)
    }
    // The number of edge atoms follows from the bonds: 3 V = 2 E + (atoms with a stub).
    const sheetBonds = m.bonds.filter((b) => m.atoms[b.a].sheet === 0).length
    expect(m.stubs.filter((s) => m.atoms[s.atom].sheet === 0)).toHaveLength(3 * per - 2 * sheetBonds)
    // Euler for the patch: atoms - bonds + hexagons = 1.
    expect(per - sheetBonds + 6).toBe(1)
  })

  it('has bonds of one length, and 120 degrees between the three bonds of an atom (the stub points along the third)', () => {
    for (const { a, b } of m.bonds) expect(len(sub(pos(a), pos(b)))).toBeCloseTo(1, 9)
    const nb = adjacency()
    for (const a of m.atoms) {
      const dirs: number[][] = nb[a.id].map((j) => {
        const v = sub(pos(j), pos(a.id))
        return v.map((x) => x / len(v))
      })
      for (const s of m.stubs.filter((st) => st.atom === a.id)) {
        expect(len(s.dir)).toBeCloseTo(1, 9)
        dirs.push([...s.dir])
      }
      expect(dirs).toHaveLength(3)
      for (let i = 0; i < 3; i++)
        for (let j = i + 1; j < 3; j++) {
          const cos = dirs[i].reduce((sum, x, k) => sum + x * dirs[j][k], 0)
          expect((Math.acos(cos) * 180) / Math.PI, `atom ${a.id}`).toBeCloseTo(120, 6)
        }
    }
    for (const s of m.stubs) expect(s.length).toBeCloseTo(GRAPHITE.stub, 9)
    expect(GRAPHITE.stub).toBeLessThan(1)
  })

  it('has parallel sheets, one above the other, further apart than a bond is long', () => {
    for (let k = 0; k < m.layers; k++) {
      const sheet = m.atoms.filter((a) => a.sheet === k)
      expect(sheet).toHaveLength(per)
      for (const a of sheet) {
        expect(a.y).toBeCloseTo(k * m.gap, 9) // every atom of a sheet at one height: the sheet is flat
        expect(a.x).toBeCloseTo(sheet0[a.site].x, 9) // a straight stack: the same patch above the same patch
        expect(a.z).toBeCloseTo(sheet0[a.site].z, 9)
      }
    }
    expect(m.gap).toBeGreaterThan(2) // "clearly larger than a bond"; the bond is 1
    // and no bond joins two sheets
    for (const { a, b } of m.bonds) expect(m.atoms[a].sheet).toBe(m.atoms[b].sheet)
  })

  it('has as many sheets as `layers` says, from 2 to 4', () => {
    for (const n of [2, 3, 4]) {
      const model = graphiteModel(n)
      expect(model.layers).toBe(n)
      expect(new Set(model.atoms.map((a) => a.sheet)).size).toBe(n)
      expect(model.atoms).toHaveLength(n * per)
      expect(model.bonds).toHaveLength(n * (m.bonds.length / 3))
      expect(model.rings).toHaveLength(6 * n)
    }
    expect([1, 2, 2.4, 2.6, 4, 9].map(clampLayers)).toEqual([2, 2, 2, 3, 4, 4])
    expect(graphiteModel(9).layers).toBe(4)
  })

  it('joins the sheets by weak forces: four vertical lines for each pair of neighbouring sheets, and none of them is a bond', () => {
    for (const n of [2, 3, 4]) {
      const model = graphiteModel(n)
      expect(model.forces).toHaveLength(4 * (n - 1))
      expect(FORCE_SITES).toHaveLength(4)
      const bondKeys = new Set(model.bonds.map(({ a, b }) => `${Math.min(a, b)}-${Math.max(a, b)}`))
      for (const { upper, lower } of model.forces) {
        const u = model.atoms[upper],
          l = model.atoms[lower]
        expect(u.sheet).toBe(l.sheet + 1)
        expect(u.x).toBeCloseTo(l.x, 9) // vertical
        expect(u.z).toBeCloseTo(l.z, 9)
        expect(u.y - l.y).toBeCloseTo(model.gap, 9)
        expect(bondKeys.has(`${Math.min(upper, lower)}-${Math.max(upper, lower)}`)).toBe(false)
      }
      // four different atoms of the upper sheet in each pair
      for (let k = 1; k < n; k++) expect(new Set(model.forces.filter((f) => model.atoms[f.upper].sheet === k).map((f) => f.upper)).size).toBe(4)
    }
  })
})

describe('graphite: the drawing agrees with the model', () => {
  const styles: [string, GraphiteStyle][] = [
    ['the symbol', GRAPHITE_STYLE],
    ['the numbers of the brief', GRAPHITE_BRIEF],
  ]
  const sizes = [
    { w: 200, h: 170 },
    { w: 170, h: 144 }, // the minimum
    { w: 300, h: 255 }, // 1.5 times
  ]

  for (const [styleName, style] of styles)
    for (const layers of [2, 3, 4])
      for (const forces of [true, false])
        for (const { w, h } of sizes)
          it(`draws every atom, bond, stub and dotted line, and no other (${styleName}, ${layers} layers, forces ${forces}, ${w} x ${h})`, () => {
            const model = graphiteModel(layers)
            const g = graphiteGeometry(w, h, layers, forces, style)
            // one circle for each atom, in the order of the atoms, all of one radius
            const circles = circlesIn(prim(g, 'solid'))
            expect(circles).toHaveLength(model.atoms.length)
            const r = circles[0].r
            for (const c of circles) expect(c.r).toBeCloseTo(r, 2)
            // The scale of this picture, from the two atoms that are farthest apart (the model at one bond length = 1); then the radius must fit it.
            const unit = model.atoms.map((a) => oblique(a.x, a.y, a.z))
            let far: [number, number] = [0, 1]
            for (let i = 0; i < unit.length; i++)
              for (let j = i + 1; j < unit.length; j++) if (dist(unit[i], unit[j]) > dist(unit[far[0]], unit[far[1]])) far = [i, j]
            const L = dist(circles[far[0]].c, circles[far[1]].c) / dist(unit[far[0]], unit[far[1]])
            const s = L / style.l
            expect(Math.abs(r - style.atomR * s)).toBeLessThan(0.02)
            const asked = Math.min(w / GRAPHITE.box.w, h / GRAPHITE.box.h) // the scale that the size of the box asks for
            expect(s).toBeLessThanOrEqual(asked + 1e-4) // never bigger
            if (layers < 4) expect(s).toBeCloseTo(asked, 3) // and exactly that unless the picture would be taller than its box
            // the atoms are where the oblique projection puts them, centred in the box
            const raw = model.atoms.map((a) => oblique(a.x * L, a.y * L, a.z * L))
            const b = circleBounds(raw, r)
            const by = P(-(b.x0 + b.x1) / 2, h / 2 - (b.y0 + b.y1) / 2)
            circles.forEach((c, i) => expect(near(c.c, P(raw[i].x + by.x, raw[i].y + by.y)), `atom ${i} at ${c.c.x},${c.c.y}`).toBe(true))
            // and the whole picture is inside its box
            const d = circleBounds(
              circles.map((c) => c.c),
              r,
            )
            expect(d.x0).toBeGreaterThanOrEqual(-w / 2 - 0.02)
            expect(d.x1).toBeLessThanOrEqual(w / 2 + 0.02)
            expect(d.y0).toBeGreaterThanOrEqual(-0.02)
            expect(d.y1).toBeLessThanOrEqual(h + 0.02)
            // one bond line for each bond, from the edge of one circle to the edge of the other
            const bonds = linesIn(prim(g, 'outline'))
            expect(bonds).toHaveLength(model.bonds.length)
            model.bonds.forEach(({ a, b: bb }, i) => {
              const [p, q] = bonds[i]
              expect(Math.abs(dist(p, circles[a].c) - r), `bond ${i} start`).toBeLessThan(0.03)
              expect(Math.abs(dist(q, circles[bb].c) - r), `bond ${i} end`).toBeLessThan(0.03)
              // on the line between the centres
              expect(distToSegment(p, [circles[a].c, circles[bb].c])).toBeLessThan(0.03)
              expect(distToSegment(q, [circles[a].c, circles[bb].c])).toBeLessThan(0.03)
            })
            // one stub for each stub: from the edge of its circle, along the missing bond as the projection draws it
            const stubs = linesIn(prim(g, 'detail'))
            expect(stubs).toHaveLength(model.stubs.length)
            model.stubs.forEach(({ atom, dir, length }, i) => {
              const [p, q] = stubs[i]
              const v = oblique(dir[0] * length * L, dir[1] * length * L, dir[2] * length * L)
              expect(Math.abs(dist(p, circles[atom].c) - r), `stub ${i}`).toBeLessThan(0.03)
              expect(near(P(q.x - p.x, q.y - p.y), v, 0.03), `stub ${i} vector`).toBe(true)
            })
            // dotted lines (role dashed) only when forces is on, one for each force, vertical, between the circles, cut to whole dashes
            const dotted = linesIn(prim(g, 'dashed'))
            expect(g.prims.some((p) => p.role === 'dashed')).toBe(forces)
            expect(dotted).toHaveLength(forces ? model.forces.length : 0)
            if (forces)
              model.forces.forEach(({ upper, lower }, i) => {
                const [p, q] = dotted[i]
                expect(Math.abs(p.x - circles[upper].c.x)).toBeLessThan(0.02)
                expect(Math.abs(q.x - circles[upper].c.x)).toBeLessThan(0.02)
                expect(Math.abs(circles[lower].c.x - circles[upper].c.x)).toBeLessThan(0.02)
                expect(p.y).toBeGreaterThanOrEqual(circles[upper].c.y + r - 0.02)
                expect(q.y).toBeLessThanOrEqual(circles[lower].c.y - r + 0.02)
                const dashes = (q.y - p.y + DASH.off) / (DASH.on + DASH.off)
                expect(dashes).toBeCloseTo(Math.round(dashes), 1) // the line ends on a dash
                expect(Math.round(dashes)).toBeGreaterThanOrEqual(2)
              })
            // nothing else: no text, no tint, no hatch, and every prim is one of these four
            expect(g.texts ?? []).toEqual([])
            expect(g.prims.every((p) => ['dashed', 'outline', 'detail', 'solid'].includes(p.role))).toBe(true)
            expect(g.prims.map((p) => p.role)).toEqual(['dashed', 'outline', 'detail', 'solid'].filter((role) => forces || role !== 'dashed'))
          })

  it('is what the registry draws for the symbol, with `layers` and `forces` read from the parameters', () => {
    for (const layers of [2, 3, 4])
      for (const forces of [true, false]) {
        const g = geometry('graphiteStructure', 200, 170, { layers, forces })
        expect(JSON.stringify(g)).toBe(JSON.stringify(graphiteGeometry(200, 170, layers, forces)))
        expect(circlesIn(prim(g, 'solid'))).toHaveLength(layers * graphiteModel(2).atomsPerSheet)
      }
    expect(circlesIn(prim(geometry('graphiteStructure', 200, 170), 'solid'))).toHaveLength(3 * 22) // the default: 3 layers
    expect(prim(geometry('graphiteStructure', 200, 170), 'dashed')).not.toBe('') // and the forces are on
  })

  it('keeps the sheets apart on the page, with a clear gap between them', () => {
    for (const layers of [2, 3, 4]) {
      const model = graphiteModel(layers)
      const g = graphiteGeometry(200, 170, layers, true)
      const circles = circlesIn(prim(g, 'solid'))
      const r = circles[0].r
      const rows = Array.from({ length: layers }, (_, k) => {
        const ys = circles.filter((_, i) => model.atoms[i].sheet === k).map((c) => c.c.y)
        return { top: Math.min(...ys) - r - 1, bottom: Math.max(...ys) + r + 1 }
      })
      for (let k = 0; k + 1 < layers; k++) expect(rows[k + 1].bottom, `sheet ${k + 1} above sheet ${k}`).toBeLessThan(rows[k].top - 8)
    }
  })

  it('draws no two atoms touching: the outlines of neighbouring atoms are 2.5 u apart or more, and 2 u at the smallest size (the brief is not: see GRAPHITE_BRIEF)', () => {
    const gap = (style: GraphiteStyle, w = 200, layers = 3) => {
      const g = graphiteGeometry(w, (w * 170) / 200, layers, true, style)
      const c = circlesIn(prim(g, 'solid'))
      let min = Infinity
      for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) min = Math.min(min, dist(c[i].c, c[j].c) - 2 * (c[i].r + 1))
      return min
    }
    expect(gap(GRAPHITE_STYLE)).toBeGreaterThanOrEqual(2.5)
    expect(gap(GRAPHITE_STYLE, 300)).toBeGreaterThanOrEqual(2.5)
    expect(gap(GRAPHITE_STYLE, 170)).toBeGreaterThanOrEqual(2) // the minimum size
    expect(gap(GRAPHITE_STYLE, 170, 4)).toBeGreaterThanOrEqual(1.5) // and four sheets at the minimum size
    expect(gap(GRAPHITE_STYLE, 200, 4)).toBeGreaterThanOrEqual(2) // four sheets are drawn a little smaller to fit the box
    // with the numbers of the brief the two atoms of a bond that runs along z are drawn 11 u apart: their outlines are 1 u apart
    expect(gap(GRAPHITE_BRIEF)).toBeCloseTo(1, 1)
  })

  it('runs no bond over an atom that is not at its end', () => {
    for (const layers of [2, 3, 4]) {
      const g = graphiteGeometry(200, 170, layers, true)
      const circles = circlesIn(prim(g, 'solid'))
      for (const line of linesIn(prim(g, 'outline')))
        for (const c of circles) {
          if (line.some((p) => Math.abs(dist(p, c.c) - c.r) < 0.03)) continue
          expect(distToSegment(c.c, line), 'a bond runs over an atom').toBeGreaterThan(c.r + 1 + 0.5)
        }
    }
  })

  it('runs a dotted line over no atom and at most one bond of the sheets', () => {
    for (const layers of [2, 3, 4]) {
      const model = graphiteModel(layers)
      const g = graphiteGeometry(200, 170, layers, true)
      const circles = circlesIn(prim(g, 'solid'))
      const bonds = linesIn(prim(g, 'outline'))
      const r = circles[0].r
      linesIn(prim(g, 'dashed')).forEach((line, i) => {
        const { upper, lower } = model.forces[i]
        circles.forEach((c, j) => {
          if (j === upper || j === lower) return
          expect(distToSegment(c.c, line), `dotted line ${i} and atom ${j}`).toBeGreaterThan(r + 1 + 0.6)
        })
        expect(bonds.filter((b) => crosses(line, b)).length, `dotted line ${i}`).toBeLessThanOrEqual(1)
      })
    }
  })
})

// ================================================================ C60

type V3 = [number, number, number]
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len3 = (a: V3): number => Math.hypot(a[0], a[1], a[2])
const rad = (deg: number): number => (deg * Math.PI) / 180

/** All the cycles of `n` atoms in a graph, each once, as sorted lists of atoms. */
function cyclesOf(neighbours: number[][], n: number): number[][] {
  const found = new Map<string, number[]>()
  const walk = (start: number, path: number[]) => {
    const last = path[path.length - 1]
    if (path.length === n) {
      if (neighbours[last].includes(start))
        found.set(
          [...path].sort((a, b) => a - b).join(),
          [...path].sort((a, b) => a - b),
        )
      return
    }
    for (const next of neighbours[last]) if (next > start && !path.includes(next)) walk(start, [...path, next])
  }
  neighbours.forEach((_, start) => walk(start, [start]))
  return [...found.values()]
}

describe('C60: the molecule (the full model, before any view)', () => {
  const m = c60Molecule()
  const at = (i: number): V3 => [m.atoms[i].x, m.atoms[i].y, m.atoms[i].z]
  const key = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`
  const neighbours = m.atoms.map(() => [] as number[])
  for (const { a, b } of m.bonds) {
    neighbours[a].push(b)
    neighbours[b].push(a)
  }
  const pentagons = m.faces.filter((f) => f.kind === 'pentagon'),
    hexagons = m.faces.filter((f) => f.kind === 'hexagon')

  it('has 60 atoms, all different, on a sphere, from the three families of the formula (edge 2, phi = (1 + sqrt 5) / 2)', () => {
    expect(PHI).toBeCloseTo((1 + Math.sqrt(5)) / 2, 12)
    expect(m.atoms).toHaveLength(60)
    for (let i = 0; i < 60; i++) for (let j = i + 1; j < 60; j++) expect(len3(sub3(at(i), at(j)))).toBeGreaterThan(1.9)
    for (const a of m.atoms) expect(len3(at(a.id))).toBeCloseTo(Math.sqrt(10 + 9 * PHI), 9) // one distance from the middle
    expect(C60_RADIUS).toBeCloseTo(4.9563, 3)
    // The three families: 12 atoms with a zero coordinate, 24 with the coordinate 2 phi or its permutations, 24 with phi, 2 and 2 phi + 1.
    const has = (x: number) => (a: { x: number; y: number; z: number }) => [a.x, a.y, a.z].some((c) => Math.abs(Math.abs(c) - x) < 1e-9)
    expect(m.atoms.filter(has(0))).toHaveLength(12)
    expect(m.atoms.filter(has(3 * PHI))).toHaveLength(12)
    expect(m.atoms.filter(has(2 + PHI))).toHaveLength(24)
    expect(m.atoms.filter(has(2 * PHI + 1))).toHaveLength(24)
  })

  it('has 90 bonds of one length, 2: the pairs of atoms that close, and no other pair closer than 3', () => {
    expect(m.bonds).toHaveLength(90)
    const keys = new Set(m.bonds.map((b) => key(b.a, b.b)))
    expect(keys.size).toBe(90)
    for (const { a, b } of m.bonds) expect(len3(sub3(at(a), at(b)))).toBeCloseTo(2, 9)
    for (let i = 0; i < 60; i++) for (let j = i + 1; j < 60; j++) if (!keys.has(key(i, j))) expect(len3(sub3(at(i), at(j)))).toBeGreaterThan(3)
  })

  it('has 12 pentagons and 20 hexagons: rings of 5 and 6 atoms joined by bonds, flat, with every side 2', () => {
    expect(pentagons).toHaveLength(12)
    expect(hexagons).toHaveLength(20)
    const keys = new Set(m.bonds.map((b) => key(b.a, b.b)))
    for (const f of m.faces) {
      expect(f.atoms).toHaveLength(f.kind === 'pentagon' ? 5 : 6)
      expect(new Set(f.atoms).size).toBe(f.atoms.length)
      f.atoms.forEach((a, i) => {
        expect(keys.has(key(a, f.atoms[(i + 1) % f.atoms.length])), `${f.kind} side`).toBe(true)
        expect(dot3(at(a), f.dir)).toBeCloseTo(dot3(at(f.atoms[0]), f.dir), 9) // all in one plane, square to `dir`
      })
      expect(len3(f.dir)).toBeCloseTo(1, 9)
    }
  })

  it('has exactly the faces that the bonds make: the 5-rings and the flat 6-rings of the bond graph are the pentagons and hexagons (no other)', () => {
    const asKey = (atoms: number[]) => [...atoms].sort((a, b) => a - b).join()
    // every 5-cycle of the graph is a pentagon of the model, and the other way round
    const five = cyclesOf(neighbours, 5).map((c) => c.join())
    expect(five.sort()).toEqual(pentagons.map((f) => asKey(f.atoms)).sort())
    // a 6-cycle of the graph that lies in a plane is a hexagon of the model
    const flat = cyclesOf(neighbours, 6).filter((c) => {
      const centre = c.map(at).reduce((s, p) => [s[0] + p[0] / 6, s[1] + p[1] / 6, s[2] + p[2] / 6] as V3, [0, 0, 0] as V3)
      const n = cross3(sub3(at(c[0]), centre), sub3(at(c[1]), centre))
      const normal = len3(n) > 1e-9 ? n : cross3(sub3(at(c[0]), centre), sub3(at(c[2]), centre))
      return c.every((i) => Math.abs(dot3(sub3(at(i), centre), normal)) < 1e-9)
    })
    expect(flat.map((c) => c.join()).sort()).toEqual(hexagons.map((f) => asKey(f.atoms)).sort())
  })

  it('puts every atom on 3 bonds, 1 pentagon and 2 hexagons', () => {
    for (const a of m.atoms) {
      expect(neighbours[a.id], `atom ${a.id}`).toHaveLength(3)
      expect(
        pentagons.filter((f) => f.atoms.includes(a.id)),
        `atom ${a.id} pentagons`,
      ).toHaveLength(1)
      expect(
        hexagons.filter((f) => f.atoms.includes(a.id)),
        `atom ${a.id} hexagons`,
      ).toHaveLength(2)
    }
  })

  it('puts every bond on two faces and no two pentagons side by side: each pentagon touches only hexagons', () => {
    const onBond = new Map<string, string[]>()
    for (const f of m.faces)
      f.atoms.forEach((a, i) => {
        const k = key(a, f.atoms[(i + 1) % f.atoms.length])
        onBond.set(k, [...(onBond.get(k) ?? []), f.kind])
      })
    expect(onBond.size).toBe(90)
    for (const kinds of onBond.values()) expect(kinds).toHaveLength(2)
    const pairs = [...onBond.values()].map((k) => k.sort().join('+'))
    expect(pairs.filter((p) => p === 'hexagon+pentagon')).toHaveLength(60) // 12 pentagons of 5 sides
    expect(pairs.filter((p) => p === 'hexagon+hexagon')).toHaveLength(30)
    expect(pairs.filter((p) => p === 'pentagon+pentagon')).toHaveLength(0)
  })

  it("satisfies Euler's formula for a closed surface: atoms - bonds + faces = 2", () => {
    expect(m.atoms.length - m.bonds.length + m.faces.length).toBe(2)
  })
})

describe('C60: the view', () => {
  const view = c60View()
  const at = (i: number): V3 => [view.atoms[i].x, view.atoms[i].y, view.atoms[i].z]
  /** The outward unit normal of a face, from the positions of its atoms in the view (not from the `normal` that the model holds). */
  function normalOf(atoms: number[]): V3 {
    const ps = atoms.map(at)
    let n: V3 = [0, 0, 0]
    ps.forEach((p, i) => {
      const q = ps[(i + 1) % ps.length]
      n = [n[0] + (p[1] - q[1]) * (p[2] + q[2]), n[1] + (p[2] - q[2]) * (p[0] + q[0]), n[2] + (p[0] - q[0]) * (p[1] + q[1])]
    })
    const centre = ps.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]] as V3, [0, 0, 0] as V3)
    const unit = n.map((x) => x / len3(n)) as V3
    return dot3(unit, centre) < 0 ? (unit.map((x) => -x) as V3) : unit
  }

  it('is a rigid turn of the molecule: the same distances, the middle of the ball at the origin', () => {
    const m = c60Molecule()
    for (let i = 0; i < 60; i++) expect(len3(at(i))).toBeCloseTo(C60_RADIUS, 9)
    for (const { a, b } of m.bonds) expect(len3(sub3(at(a), at(b)))).toBeCloseTo(2, 9)
    expect(view.bonds).toHaveLength(90)
    expect(view.faces).toHaveLength(32)
  })

  it('turns a pentagon to the viewer, then tilts the ball 14 degrees about x and 10 degrees about y', () => {
    expect(C60_TURN.tiltX).toBe(14)
    expect(C60_TURN.tiltY).toBe(10)
    const front = [...view.faces].sort((a, b) => b.normal[2] - a.normal[2])[0]
    expect(front.kind).toBe('pentagon')
    // (0, 0, 1) turned about x by 14 degrees, then about y by 10 degrees
    const expected: V3 = [Math.cos(rad(14)) * Math.sin(rad(10)), -Math.sin(rad(14)), Math.cos(rad(14)) * Math.cos(rad(10))]
    normalOf(front.atoms).forEach((x, i) => expect(x).toBeCloseTo(expected[i], 9)) // from the positions of its atoms in the view
    front.normal.forEach((x, i) => expect(x).toBeCloseTo(expected[i], 9))
    // without the tilt the pentagon is square to the viewer and a corner of it points the way `corner` says
    const flat = c60View({ ...C60_TURN, tiltX: 0, tiltY: 0 })
    const f0 = flat.faces.find((f) => f.normal[2] > 1 - 1e-9)!
    expect(f0.kind).toBe('pentagon')
    const corner = f0.atoms
      .map((i) => flat.atoms[i])
      .sort((a, b) => Math.cos(rad(C60_TURN.corner)) * (b.x - a.x) + Math.sin(rad(C60_TURN.corner)) * (b.y - a.y))[0]
    expect(Math.atan2(corner.y, corner.x)).toBeCloseTo(rad(C60_TURN.corner), 9)
  })

  it('has the faces that face the viewer: those whose outward normal, from the atoms in the view, points at the viewer by more than `facing`', () => {
    for (const f of view.faces) {
      const n = normalOf(f.atoms)
      n.forEach((x, i) => expect(x).toBeCloseTo(f.normal[i], 9))
      expect(f.facing, `${f.kind} with normal z ${n[2].toFixed(3)}`).toBe(n[2] > C60_TURN.facing)
    }
    // no face is close to the threshold: the set does not depend on rounding
    for (const f of view.faces) expect(Math.abs(f.normal[2] - C60_TURN.facing)).toBeGreaterThan(0.05)
    expect(view.faces.filter((f) => f.facing).length).toBeGreaterThan(8)
    expect(view.faces.filter((f) => f.facing).length).toBeLessThan(16)
  })

  it('hides a bond exactly when it lies on no face that faces the viewer, and shows exactly the atoms at the ends of the other bonds', () => {
    const facing = view.faces.filter((f) => f.facing)
    for (const b of view.bonds) expect(b.hidden, `bond ${b.a}-${b.b}`).toBe(!facing.some((f) => f.atoms.includes(b.a) && f.atoms.includes(b.b)))
    const ends = new Set(view.bonds.filter((b) => !b.hidden).flatMap((b) => [b.a, b.b]))
    expect(new Set(view.shown)).toEqual(ends)
    expect(view.shown).toHaveLength(ends.size)
    // every atom of a face that faces the viewer is shown
    for (const f of facing) for (const a of f.atoms) expect(view.shown).toContain(a)
    // far to near
    for (let i = 1; i < view.shown.length; i++) expect(view.atoms[view.shown[i]].z).toBeGreaterThanOrEqual(view.atoms[view.shown[i - 1]].z)
  })

  it('agrees with an opaque ball: a bond is seen when the point on it, moved towards the viewer, is outside the ball', () => {
    const m = c60Molecule()
    // The ball is the set of points that are inside every face plane (it is convex). A point on a bond that is nudged towards the viewer
    // leaves the ball exactly when it is not covered by the ball in front of it.
    const outside = (p: V3) => view.faces.some((f) => dot3(p, f.normal) > dot3(at(f.atoms[0]), f.normal) + 1e-9)
    const all = c60View({ ...C60_TURN, facing: 0 }) // every face turned to the viewer at all
    for (const b of all.bonds) {
      const mid: V3 = [0, 1, 2].map((k) => (at(b.a)[k] + at(b.b)[k]) / 2) as V3
      expect(outside([mid[0], mid[1], mid[2] + 1e-6]), `bond ${b.a}-${b.b}`).toBe(!b.hidden)
    }
    // and the picture only ever shows bonds that the opaque ball shows: a bond left out by `facing` is one that is almost edge-on
    for (const b of view.bonds) if (!b.hidden) expect(all.bonds.find((q) => q.a === b.a && q.b === b.b)!.hidden).toBe(false)
    const cut = view.bonds.filter((b, i) => b.hidden && !all.bonds[i].hidden)
    for (const b of cut)
      for (const f of view.faces.filter((q) => q.atoms.includes(b.a) && q.atoms.includes(b.b))) expect(f.normal[2]).toBeLessThanOrEqual(C60_TURN.facing)
    expect(m.bonds).toHaveLength(90)
  })
})

describe('C60: the drawing agrees with the model', () => {
  const sizes = [150, 105, 225] // the default, the minimum, 1.5 times
  /** The scale (u for one unit of the model) of a picture, from the two shown atoms that are farthest apart on the page. */
  function scaleOf(view: ReturnType<typeof c60View>, circles: { c: Pt; r: number }[]): number {
    const flat = view.shown.map((i) => P(view.atoms[i].x, -view.atoms[i].y))
    let far: [number, number] = [0, 1]
    for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) if (dist(flat[i], flat[j]) > dist(flat[far[0]], flat[far[1]])) far = [i, j]
    return dist(circles[far[0]].c, circles[far[1]].c) / dist(flat[far[0]], flat[far[1]])
  }

  for (const pentagons of [false, true])
    for (const w of sizes)
      it(`draws every atom and bond that the view shows, and no other (${w} x ${w}, pentagons ${pentagons})`, () => {
        const view = c60View()
        const g = c60Geometry(w, w, pentagons)
        const circles = circlesIn(prim(g, 'solid'))
        expect(circles).toHaveLength(view.shown.length)
        const k = w / C60_DRAW.box
        const r = C60_DRAW.atomR * k
        for (const c of circles) expect(c.r).toBeCloseTo(r, 2)
        // orthographic, with the ball radius 0.44 w: one unit of the model is 0.44 w / C60_RADIUS u
        const u = scaleOf(view, circles)
        expect(u * C60_RADIUS).toBeCloseTo(C60_DRAW.ball * w, 1)
        // atom i is at (x, -y) u, centred in the box (the circles are the far-to-near list of `shown`)
        const raw = view.shown.map((i) => P(view.atoms[i].x * u, -view.atoms[i].y * u))
        const b = circleBounds(raw, r)
        const by = P(-(b.x0 + b.x1) / 2, w / 2 - (b.y0 + b.y1) / 2)
        circles.forEach((c, i) => expect(near(c.c, P(raw[i].x + by.x, raw[i].y + by.y)), `atom ${view.shown[i]} at ${c.c.x},${c.c.y}`).toBe(true))
        const d = circleBounds(
          circles.map((c) => c.c),
          r,
        )
        expect(d.x0).toBeGreaterThanOrEqual(-w / 2 - 0.02)
        expect(d.x1).toBeLessThanOrEqual(w / 2 + 0.02)
        expect(d.y0).toBeGreaterThanOrEqual(-0.02)
        expect(d.y1).toBeLessThanOrEqual(w + 0.02)
        // one line for each bond that is not hidden, from the edge of one circle to the edge of the other, far to near; none for a hidden bond
        const slot = new Map(view.shown.map((id, i) => [id, i]))
        const lines = linesIn(prim(g, 'outline'))
        const visible = view.bonds.filter((q) => !q.hidden)
        expect(lines).toHaveLength(visible.length)
        const drawn = lines.map(([p, q]) => {
          const ends = [0, 1].map((e) => circles.findIndex((c) => Math.abs(dist([p, q][e], c.c) - r) < 0.03))
          return ends
        })
        const wanted = new Set(visible.map((q) => [slot.get(q.a)!, slot.get(q.b)!].sort((x, y) => x - y).join()))
        expect(new Set(drawn.map((e) => e.sort((x, y) => x - y).join()))).toEqual(wanted)
        expect(new Set(drawn.map((e) => e.sort((x, y) => x - y).join())).size).toBe(visible.length)
        lines.forEach(([p, q], i) => {
          const [a, c] = drawn[i]
          expect(a).toBeGreaterThanOrEqual(0)
          expect(c).toBeGreaterThanOrEqual(0)
          expect(distToSegment(p, [circles[a].c, circles[c].c])).toBeLessThan(0.03) // on the line between the two centres
          expect(distToSegment(q, [circles[a].c, circles[c].c])).toBeLessThan(0.03)
        })
        for (const q of view.bonds.filter((x) => x.hidden && slot.has(x.a) && slot.has(x.b)))
          expect(wanted.has([slot.get(q.a)!, slot.get(q.b)!].sort((x, y) => x - y).join()), `hidden bond ${q.a}-${q.b} drawn`).toBe(false)
        // far to near: the circles, and the lines by the middle of the bond
        for (let i = 1; i < circles.length; i++) expect(view.atoms[view.shown[i]].z).toBeGreaterThanOrEqual(view.atoms[view.shown[i - 1]].z)
        const depth = drawn.map(([a, c]) => view.atoms[view.shown[a]].z + view.atoms[view.shown[c]].z)
        for (let i = 1; i < depth.length; i++) expect(depth[i]).toBeGreaterThanOrEqual(depth[i - 1] - 1e-9)
        // the pentagons: a tinted polygon (and its hatch) behind the bonds for each pentagon that faces the viewer, and only then
        const tints = g.prims.filter((p) => p.role === 'tint'),
          hatches = g.prims.filter((p) => p.role === 'hatch')
        const facingPentagons = view.faces.filter((q) => q.facing && q.kind === 'pentagon')
        expect(tints).toHaveLength(pentagons ? facingPentagons.length : 0)
        expect(hatches.length).toBeLessThanOrEqual(tints.length)
        expect(hatches.length).toBeGreaterThan(pentagons ? 0 : -1)
        if (pentagons) {
          const wantedPolys = new Set(
            facingPentagons.map((q) =>
              q.atoms
                .map((a) => slot.get(a)!)
                .sort((x, y) => x - y)
                .join(),
            ),
          )
          const polys = tints.map((t) =>
            [...t.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)]
              .map((m) => circles.findIndex((c) => near(c.c, P(Number(m[1]), Number(m[2])), 0.03)))
              .sort((x, y) => x - y)
              .join(),
          )
          expect(new Set(polys)).toEqual(wantedPolys)
          // behind the bonds: every tint and hatch comes before the first bond line
          const first = g.prims.findIndex((p) => p.role === 'outline')
          g.prims.forEach((p, i) => {
            if (p.role === 'tint' || p.role === 'hatch') expect(i).toBeLessThan(first)
          })
        }
        // nothing else: no text, no dashes
        expect(g.texts ?? []).toEqual([])
        expect(g.prims.every((p) => ['outline', 'solid', 'tint', 'hatch'].includes(p.role))).toBe(true)
        expect(g.prims.at(-1)!.role).toBe('solid')
      })

  it('is what the registry draws for the symbol, with `pentagons` read from the parameters', () => {
    for (const pentagons of [false, true])
      expect(JSON.stringify(geometry('fullereneC60', 150, 150, { pentagons }))).toBe(JSON.stringify(c60Geometry(150, 150, pentagons)))
    expect(geometry('fullereneC60', 150, 150).prims.some((p) => p.role === 'tint')).toBe(false) // the default shades nothing
  })

  it('shows the pentagons as a hatch, not only a tint, on a photocopy', () => {
    const g = c60Geometry(150, 150, true)
    const colour = primNodes(g.prims, false).over,
      mono = primNodes(g.prims, true).over
    const pentagonsFacing = c60View().faces.filter((f) => f.facing && f.kind === 'pentagon').length
    expect(g.prims.filter((p) => p.role === 'tint')).toHaveLength(pentagonsFacing)
    expect(mono.length - colour.length).toBe(g.prims.filter((p) => p.role === 'hatch').length) // the hatch lines exist on the photocopy only
    expect(g.prims.filter((p) => p.role === 'hatch').length).toBeGreaterThanOrEqual(pentagonsFacing - 1) // a pentagon seen edge-on may be too thin for a line
  })

  it('draws no two atoms overlapping, and their outlines 2 u apart or more at every size (the closest pair is 5 u apart without `facing`)', () => {
    const gap = (turn: C60Turn, w = 150) => {
      const view = c60View(turn)
      const circles = circlesIn(prim(c60Geometry(w, w, false, turn), 'solid'))
      expect(circles).toHaveLength(view.shown.length)
      let min = Infinity
      for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) min = Math.min(min, dist(circles[i].c, circles[j].c))
      return { min, r: circles[0].r }
    }
    for (const w of sizes) {
      const { min, r } = gap(C60_TURN, w)
      expect(min, `closest pair at ${w}`).toBeGreaterThan(2 * r) // no two circles overlap
      expect(min - 2 * (r + 1), `outlines at ${w}`).toBeGreaterThanOrEqual(2) // and the outlines do not touch
    }
    // The brief draws every face that is turned to the viewer at all: that is 16 faces and 40 atoms, and the closest two atoms are less than 2 r apart.
    const brief = gap({ ...C60_TURN, facing: 0 })
    expect(brief.min).toBeLessThan(2 * brief.r)
    expect(c60View({ ...C60_TURN, facing: 0 }).shown).toHaveLength(40)
  })

  it('runs no bond over an atom that is not at its end', () => {
    const g = c60Geometry(150, 150, false)
    const circles = circlesIn(prim(g, 'solid'))
    for (const line of linesIn(prim(g, 'outline')))
      for (const c of circles) {
        const ends = line.some((p) => Math.abs(dist(p, c.c) - c.r) < 0.03)
        if (!ends) expect(distToSegment(c.c, line), 'a bond runs over an atom').toBeGreaterThan(c.r + 1 + 1)
      }
  })
})
