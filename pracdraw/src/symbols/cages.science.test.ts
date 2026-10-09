// The science of the carbon pictures (graphite and C60): the model is tested against the lines of the catalogue row, then the drawing is
// tested against the model: the circles and lines in `geometry()` are counted and placed. A picture may never show a part that the model lacks.

import { describe, expect, it } from 'vitest'
import { P, dist, type Pt } from '../kernel/geom'
import {
  DASH,
  FORCE_SITES,
  GRAPHITE,
  GRAPHITE_BRIEF,
  GRAPHITE_STYLE,
  circleBounds,
  clampLayers,
  graphiteGeometry,
  graphiteModel,
  honeycombPatch,
  type GraphiteStyle,
} from './cages'
import { oblique } from './oblique'
import { geometry } from './registry'
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
    { w: 140, h: 119 }, // the minimum
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
            expect(s).toBeLessThanOrEqual(w / GRAPHITE.box.w + 1e-4) // never bigger than the size of the box asks for
            if (layers < 4) expect(s).toBeCloseTo(w / GRAPHITE.box.w, 3) // and at that size unless the picture would be taller than its box
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

  it('draws no two atoms touching: the outlines of neighbouring atoms are at least 2.5 u apart (the brief is not: see GRAPHITE_BRIEF)', () => {
    const gap = (style: GraphiteStyle) => {
      const g = graphiteGeometry(200, 170, 3, true, style)
      const c = circlesIn(prim(g, 'solid'))
      let min = Infinity
      for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) min = Math.min(min, dist(c[i].c, c[j].c) - 2 * (c[i].r + 1))
      return min
    }
    expect(gap(GRAPHITE_STYLE)).toBeGreaterThanOrEqual(2.5)
    // with the numbers of the brief the two atoms of a bond that runs along z are drawn 11 u apart: their outlines are 1 u apart
    expect(gap(GRAPHITE_BRIEF)).toBeCloseTo(1, 1)
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
