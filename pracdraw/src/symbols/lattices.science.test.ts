// lattices.science.test.ts — the science of the two pilot pictures of the structures pack: sodium chloride (ionicLattice3D) and diamond
// (diamondStructure). The models (ions or atoms with a kind and a place in 3D, bonds with their two ends) are tested against the SCIENCE
// lines of the brief (spec/catalogue.json) and the inventory rows (spec/diagrams.json). Then the drawing that geometry() gives is checked
// against the model: every circle and every bond line is where the model puts it, and nothing else is drawn.

import { describe, expect, it } from 'vitest'
import { P, dist, type Pt } from '../kernel/geom'
import { primNodes } from '../render/render'
import { DIAMOND, IONIC, TETRAHEDRAL, diamondModel, diamondPicture, ionicModel, ionicPicture, smallestGap, turned, type Disc, type Vec3 } from './lattices'
import { boxEdges, oblique } from './oblique'
import { geometry, symbolDef } from './registry'
import type { Geometry, Role } from './types'

// ---------------------------------------------------------------- reading a drawing

interface DrawnCircle extends Disc {
  role: Role
  /** Index of its prim in the geometry. */
  at: number
}
interface DrawnLine {
  role: Role
  p: Pt
  q: Pt
  at: number
}

const NUMBER = '-?\\d+(?:\\.\\d+)?'
const CIRCLE = new RegExp(`^M(${NUMBER}) (${NUMBER})a(${NUMBER}) (${NUMBER}) 0 1 0 ${NUMBER} 0a\\3 \\4 0 1 0 ${NUMBER} 0Z$`)
const LINE = new RegExp(`M(${NUMBER}) (${NUMBER})L(${NUMBER}) (${NUMBER})`, 'g')

/**
 * What a geometry draws. A prim of role `solid` or `tint` is one circle (the kit's `circle`); a prim of role `outline`, `detail` or `dashed` is
 * straight lines, one M and one L each; a `hatch` prim is hatch lines. Any other role, or a path of any other shape, fails the test.
 */
function read(g: Geometry): { circles: DrawnCircle[]; lines: DrawnLine[]; hatches: { d: string; at: number }[] } {
  const circles: DrawnCircle[] = [],
    lines: DrawnLine[] = [],
    hatches: { d: string; at: number }[] = []
  g.prims.forEach((prim, at) => {
    if (prim.role === 'solid' || prim.role === 'tint') {
      const m = CIRCLE.exec(prim.d)
      expect(m, `prim ${at} (${prim.role}) is not one circle: ${prim.d}`).not.toBeNull()
      const [x0, y0, r] = [Number(m![1]), Number(m![2]), Number(m![3])]
      circles.push({ role: prim.role, c: P(x0 + r, y0), r, at })
    } else if (prim.role === 'outline' || prim.role === 'detail' || prim.role === 'dashed') {
      expect(prim.d.replace(LINE, ''), `prim ${at} (${prim.role}) is not made of straight lines only: ${prim.d}`).toBe('')
      for (const m of prim.d.matchAll(LINE)) lines.push({ role: prim.role, p: P(Number(m[1]), Number(m[2])), q: P(Number(m[3]), Number(m[4])), at })
    } else if (prim.role === 'hatch') hatches.push({ d: prim.d, at })
    else expect.unreachable(`prim ${at} has the role ${prim.role}, which a lattice picture does not use`)
  })
  return { circles, lines, hatches }
}

/** How far a point is from a segment. */
function toSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)))
  return dist(p, P(a.x + t * dx, a.y + t * dy))
}

/** How far a point is from the line through two points. */
const toLine = (p: Pt, a: Pt, b: Pt): number => Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / dist(a, b)

/** The line runs from the edge of circle A to the edge of circle B, straight along the line of their centres (either way round). */
function joins(line: { p: Pt; q: Pt }, a: Disc, b: Disc, tol = 0.03): boolean {
  const run = (p: Pt, q: Pt) =>
    Math.abs(dist(p, a.c) - a.r) <= tol && Math.abs(dist(q, b.c) - b.r) <= tol && toLine(p, a.c, b.c) <= tol && toLine(q, a.c, b.c) <= tol
  return run(line.p, line.q) || run(line.q, line.p)
}

/** The sizes that the registry tests draw a uniform symbol at: default, minimum and one and a half times. */
function sizes(id: string): number[] {
  const def = symbolDef(id)
  return [def.size.h, def.min!.h, def.size.h * 1.5]
}

/** The circles lie inside the box with their outlines (2 u: one u outside the radius), and the middle of their bounds is the middle of the box. */
function expectCentredInBox(circles: Disc[], h: number, what: string): void {
  const xs = circles.flatMap((d) => [d.c.x - d.r - 1, d.c.x + d.r + 1]),
    ys = circles.flatMap((d) => [d.c.y - d.r - 1, d.c.y + d.r + 1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  expect(x0, `${what}: left`).toBeGreaterThanOrEqual(-h / 2 - 1e-6)
  expect(x1, `${what}: right`).toBeLessThanOrEqual(h / 2 + 1e-6)
  expect(y0, `${what}: top`).toBeGreaterThanOrEqual(-1e-6)
  expect(y1, `${what}: bottom`).toBeLessThanOrEqual(h + 1e-6)
  expect((x0 + x1) / 2, `${what}: middle x`).toBeCloseTo(0, 1)
  expect((y0 + y1) / 2, `${what}: middle y`).toBeCloseTo(h / 2, 1)
}

const same = (a: Pt, b: Pt, tol = 0.03): boolean => dist(a, b) <= tol
const manhattan = (a: Vec3, b: Vec3): number => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const length3 = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
const key3 = (p: Vec3): string => p.join(',')
/** A pair of places, written the same whichever is first. */
const pair = (a: Vec3, b: Vec3): string =>
  [a, b]
    .map((p) => p.join(''))
    .sort()
    .join('-')

// ---------------------------------------------------------------- the sodium chloride block

/** How many coordinates of a place lie in the middle of the block (1): 0 for a corner, 1 for an edge middle, 2 for a face centre, 3 for the body centre. */
const middles = (pos: Vec3): number => pos.filter((v) => v === 1).length
const PLACES = ['corner', 'edge middle', 'face centre', 'body centre']
const NEIGHBOURS = [3, 4, 5, 6]

describe('ionicLattice3D: the model of a 3 by 3 by 3 block of sodium chloride', () => {
  const m = ionicModel()

  it('has 27 ions at the whole-number places 0 to 2 in x, y and z, none twice', () => {
    expect(m.ions).toHaveLength(27)
    expect(new Set(m.ions.map((ion) => ion.pos.join(''))).size).toBe(27)
    for (const ion of m.ions) for (const v of ion.pos) expect([0, 1, 2]).toContain(v)
  })

  it('has 14 Cl- and 13 Na+: Cl- on the 8 corners and the 6 face centres, Na+ on the 12 edge middles and the body centre', () => {
    const count = (kind: string, place: string) => m.ions.filter((ion) => ion.kind === kind && PLACES[middles(ion.pos)] === place).length
    expect(m.ions.filter((ion) => ion.kind === 'Cl-')).toHaveLength(14)
    expect(m.ions.filter((ion) => ion.kind === 'Na+')).toHaveLength(13)
    expect([count('Cl-', 'corner'), count('Cl-', 'face centre'), count('Na+', 'edge middle'), count('Na+', 'body centre')]).toEqual([8, 6, 12, 1])
  })

  it('has no two like ions as nearest neighbours: every pair one step apart along x, y or z is a Cl- and a Na+', () => {
    let pairs = 0
    for (const a of m.ions)
      for (const b of m.ions) {
        if (a === b || manhattan(a.pos, b.pos) !== 1) continue
        pairs++
        expect(a.kind, `${a.pos} and ${b.pos}`).not.toBe(b.kind)
      }
    expect(pairs).toBe(2 * 54) // each pair seen from both ends
  })

  it('has 54 bonds, one for every pair of neighbouring places and none other, each between unlike ions', () => {
    const neighbours = new Set<string>()
    for (const a of m.ions) for (const b of m.ions) if (a !== b && manhattan(a.pos, b.pos) === 1) neighbours.add(pair(a.pos, b.pos))
    expect(neighbours.size).toBe(54)
    expect(m.bonds).toHaveLength(54)
    const bonded = m.bonds.map((bond) => pair(m.ions[bond.a].pos, m.ions[bond.b].pos))
    expect(new Set(bonded).size).toBe(54) // none twice
    expect(new Set(bonded)).toEqual(neighbours)
    for (const bond of m.bonds) expect(m.ions[bond.a].kind).not.toBe(m.ions[bond.b].kind)
  })

  it('gives each ion as many neighbours as its place gives: corner 3, edge middle 4, face centre 5, body centre 6', () => {
    const degree = m.ions.map(() => 0)
    for (const bond of m.bonds) {
      degree[bond.a]++
      degree[bond.b]++
    }
    m.ions.forEach((ion, i) => expect(degree[i], `${PLACES[middles(ion.pos)]} at ${ion.pos}`).toBe(NEIGHBOURS[middles(ion.pos)]))
    expect(degree.reduce((n, d) => n + d, 0)).toBe(2 * 54)
  })

  it('hides the 6 bonds on the three edges that meet the corner (0, 0, 2), and no other bond', () => {
    const hidden = new Set(m.bonds.filter((bond) => bond.hidden).map((bond) => pair(m.ions[bond.a].pos, m.ions[bond.b].pos)))
    // the brief: the line i = 0, j = 0 along k; the line j = 0, k = 2 along i; the line i = 0, k = 2 along j; two bonds on each
    expect(hidden).toEqual(new Set(['000-001', '001-002', '002-102', '102-202', '002-012', '012-022']))
  })

  it('agrees with the box edges of oblique.ts: a bond on a hidden edge of the block is hidden, any other bond is not', () => {
    const edges = boxEdges()
    let onEdges = 0
    for (const bond of m.bonds) {
      const a = m.ions[bond.a].pos,
        b = m.ions[bond.b].pos
      const axis = [0, 1, 2].find((i) => a[i] !== b[i])!
      if ([0, 1, 2].some((i) => i !== axis && a[i] === 1)) {
        expect(bond.hidden, `${a} - ${b} lies on no edge`).toBe(false)
        continue
      }
      onEdges++
      // the unit box edge that the bond lies on: from the corner with 0 on the axis to the corner with 1 on it
      const corner = (end: number) => [0, 1, 2].map((i) => (i === axis ? end : a[i] / 2)).join()
      const edge = edges.find((e) => e.from.join() === corner(0) && e.to.join() === corner(1))
      expect(edge, `${a} - ${b}`).toBeDefined()
      expect(bond.hidden, `${a} - ${b}`).toBe(edge!.hidden)
    }
    expect(onEdges).toBe(24) // 12 edges, two bonds each
  })

  it('is a block of any size n: 2 by 2 by 2 has 4 Cl-, 4 Na+, 12 bonds, 3 neighbours for each ion and 3 hidden bonds', () => {
    const s = ionicModel(2)
    expect([s.ions.filter((i) => i.kind === 'Cl-').length, s.ions.filter((i) => i.kind === 'Na+').length, s.bonds.length]).toEqual([4, 4, 12])
    expect(s.bonds.filter((b) => b.hidden)).toHaveLength(3)
    for (let i = 0; i < 8; i++) expect(s.bonds.filter((b) => b.a === i || b.b === i)).toHaveLength(3)
  })
})

describe('ionicLattice3D: the picture of the model', () => {
  /** The circle that the drawing has for each ion, found from where the model puts it (oblique(i s, j s, k s), then centred in the box). */
  function drawnIons(h: number, params: Record<string, boolean> = {}) {
    const m = ionicModel(),
      k = h / IONIC.size,
      s = IONIC.spacing * k
    const raw = m.ions.map((ion) => ({ ion, c: oblique(ion.pos[0] * s, ion.pos[1] * s, ion.pos[2] * s), r: IONIC.radius[ion.kind] * k }))
    const xs = raw.flatMap((d) => [d.c.x - d.r, d.c.x + d.r]),
      ys = raw.flatMap((d) => [d.c.y - d.r, d.c.y + d.r])
    const dx = -(Math.min(...xs) + Math.max(...xs)) / 2,
      dy = h / 2 - (Math.min(...ys) + Math.max(...ys)) / 2
    const drawn = read(geometry('ionicLattice3D', h, h, params))
    const taken = new Set<number>()
    const circles = raw.map((e) => {
      const want = P(e.c.x + dx, e.c.y + dy)
      const i = drawn.circles.findIndex(
        (d, n) => !taken.has(n) && same(d.c, want) && Math.abs(d.r - e.r) < 0.02 && d.role === (e.ion.kind === 'Cl-' ? 'tint' : 'solid'),
      )
      expect(i, `no circle of the right kind and size at ${want.x.toFixed(2)}, ${want.y.toFixed(2)} for the ion at ${e.ion.pos}`).toBeGreaterThanOrEqual(0)
      taken.add(i)
      return drawn.circles[i]
    })
    return { m, k, s, drawn, circles }
  }

  it('uses a spacing of 48.5 u and radii of 8 (Cl-) and 5.5 (Na+) at the size 150, and scales them with the box', () => {
    expect([IONIC.size, IONIC.spacing, IONIC.radius['Cl-'], IONIC.radius['Na+']]).toEqual([150, 48.5, 8, 5.5])
    for (const h of sizes('ionicLattice3D')) {
      const { k, circles, m } = drawnIons(h)
      m.ions.forEach((ion, i) => expect(circles[i].r).toBeCloseTo(IONIC.radius[ion.kind] * k, 2))
    }
  })

  it('is the front face true to shape, with depth running up and to the right at 45 degrees and at half length (rule S14)', () => {
    const { m, s, circles } = drawnIons(IONIC.size)
    const at = (i: number, j: number, k: number) => circles[m.ions.findIndex((ion) => ion.pos.join() === [i, j, k].join())].c
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        for (let c = 0; c < 3; c++) {
          const here = at(a, b, c)
          if (a < 2) expect(dist(at(a + 1, b, c), P(here.x + s, here.y))).toBeLessThan(0.03) // along x: to the right
          if (b < 2) expect(dist(at(a, b + 1, c), P(here.x, here.y - s))).toBeLessThan(0.03) // along y: up the page
          if (c < 2) {
            const step = P(at(a, b, c + 1).x - here.x, at(a, b, c + 1).y - here.y)
            expect(step.x).toBeCloseTo(-step.y, 1) // 45 degrees
            expect(step.x).toBeGreaterThan(0) // to the right, and so up the page
            expect(Math.hypot(step.x, step.y)).toBeCloseTo(s / 2, 1) // half the length
          }
        }
  })

  it('keeps every circle clear of every other, the edges at least 4 u apart (the white between two outlines is as wide as an outline), at every size', () => {
    for (const h of sizes('ionicLattice3D')) {
      const { k, drawn } = drawnIons(h)
      expect(drawn.circles).toHaveLength(27)
      expect(smallestGap(drawn.circles), `the drawing at ${h}`).toBeGreaterThanOrEqual(4 * k - 1e-6)
      expect(smallestGap(ionicPicture(ionicModel(), h).circles), `the picture at ${h}`).toBeGreaterThanOrEqual(4 * k - 1e-6)
    }
  })

  it('needed other numbers than the first brief: spacing 44 with radii 11 and 7 put two Cl- circles on top of each other', () => {
    const brief: Disc[] = ionicModel().ions.map((ion) => ({
      c: oblique(ion.pos[0] * 44, ion.pos[1] * 44, ion.pos[2] * 44),
      r: ion.kind === 'Cl-' ? 11 : 7,
    }))
    // the corner (0, 0, 2) and the face centre (1, 1, 0) are (sqrt 2 - 1) spacings apart: 18.2 u, and two radii of 11 need 22 u
    expect(smallestGap(brief)).toBeCloseTo(44 * (Math.SQRT2 - 1) - 22, 6)
    expect(smallestGap(brief)).toBeLessThan(0)
  })

  it('finds the smallest gap between circles: negative when two overlap, zero when two touch, infinite for fewer than two', () => {
    expect(
      smallestGap([
        { c: P(0, 0), r: 5 },
        { c: P(8, 0), r: 5 },
      ]),
    ).toBeCloseTo(-2, 9)
    expect(
      smallestGap([
        { c: P(0, 0), r: 5 },
        { c: P(10, 0), r: 5 },
        { c: P(0, 40), r: 5 },
      ]),
    ).toBeCloseTo(0, 9)
    expect(smallestGap([{ c: P(0, 0), r: 5 }])).toBe(Infinity)
  })

  it('draws no bond through a circle that is not at one of its ends: the line stays at least 4 u from every other circle', () => {
    for (const h of sizes('ionicLattice3D')) {
      const { k, drawn, circles } = drawnIons(h)
      for (const line of drawn.lines) {
        const ends = circles.filter((d) => Math.abs(dist(line.p, d.c) - d.r) < 0.03 || Math.abs(dist(line.q, d.c) - d.r) < 0.03)
        expect(ends, 'a bond line has a circle at each end').toHaveLength(2)
        for (const d of circles) if (!ends.includes(d)) expect(toSegment(d.c, line.p, line.q) - d.r, `at ${h}`).toBeGreaterThanOrEqual(4 * k - 1e-6)
      }
    }
  })

  it('is centred in its box and inside it, at every size', () => {
    for (const h of sizes('ionicLattice3D')) expectCentredInBox(drawnIons(h).drawn.circles, h, `size ${h}`)
  })

  it('draws the model: 27 circles (14 tinted Cl-, 13 white Na+) at the places of the ions, and nothing but bond lines and hatch', () => {
    for (const h of sizes('ionicLattice3D')) {
      const { drawn } = drawnIons(h)
      expect(drawn.circles).toHaveLength(27)
      expect(drawn.circles.filter((d) => d.role === 'tint')).toHaveLength(14)
      expect(drawn.circles.filter((d) => d.role === 'solid')).toHaveLength(13)
      expect(drawn.hatches).toHaveLength(14)
      expect(drawn.lines).toHaveLength(54)
      expect(drawn.circles.length + drawn.hatches.length + new Set(drawn.lines.map((l) => l.at)).size).toBe(geometry('ionicLattice3D', h, h).prims.length)
    }
  })

  it('draws each of the 54 bonds as one straight line from the edge of one circle to the edge of the other: role dashed for the 6 hidden bonds, detail for the rest', () => {
    for (const h of sizes('ionicLattice3D')) {
      const { m, drawn, circles } = drawnIons(h)
      const used = new Set<DrawnLine>()
      for (const bond of m.bonds) {
        const found = drawn.lines.filter((line) => joins(line, circles[bond.a], circles[bond.b]))
        const where = `${m.ions[bond.a].pos} - ${m.ions[bond.b].pos} at ${h}`
        expect(found, where).toHaveLength(1)
        expect(found[0].role, where).toBe(bond.hidden ? 'dashed' : 'detail')
        used.add(found[0])
      }
      expect(used.size).toBe(54) // no line is drawn for two bonds, and no line is left over
      expect(drawn.lines.filter((l) => l.role === 'dashed')).toHaveLength(6)
      expect(drawn.lines.filter((l) => l.role === 'detail')).toHaveLength(48)
    }
  })

  it('draws the bonds first and the circles after, so that a circle covers the end of each of its bonds', () => {
    const { drawn } = drawnIons(IONIC.size)
    expect(Math.max(...drawn.lines.map((l) => l.at))).toBeLessThan(Math.min(...drawn.circles.map((c) => c.at)))
  })

  it('shows the 27 circles only, with bonds off', () => {
    for (const h of sizes('ionicLattice3D')) {
      const { drawn } = drawnIons(h, { bonds: false })
      expect(drawn.lines).toHaveLength(0)
      expect(drawn.circles).toHaveLength(27)
      expect(geometry('ionicLattice3D', h, h, { bonds: false }).prims).toHaveLength(27 + 14) // the circles and the 14 hatches
    }
  })

  it('tells Cl- from Na+ by size and tint, and in photocopy-safe mode by size and hatch: each Cl- has a hatch of its own shape, a Na+ has none', () => {
    const g = geometry('ionicLattice3D', IONIC.size, IONIC.size)
    const { circles, hatches } = read(g)
    for (const t of circles.filter((c) => c.role === 'tint')) {
      const h = hatches.find((x) => x.at === t.at + 1)
      expect(h, `the hatch of the Cl- at ${t.c.x}, ${t.c.y}`).toBeDefined()
      // every end of every hatch line lies on the circle (the circle is flattened to within 0.25 u)
      for (const m of h!.d.matchAll(LINE))
        for (const e of [P(Number(m[1]), Number(m[2])), P(Number(m[3]), Number(m[4]))]) expect(Math.abs(dist(e, t.c) - t.r)).toBeLessThan(0.4)
    }
    for (const w of circles.filter((c) => c.role === 'solid')) expect(hatches.some((x) => x.at === w.at + 1)).toBe(false)
    // the renderer draws the hatch in photocopy-safe mode only, and the tint in colour mode only
    const colour = primNodes(g.prims, false),
      mono = primNodes(g.prims, true)
    expect(mono.over.length - colour.over.length).toBe(14)
    expect(colour.over.filter((n) => n.t === 'path' && n.fill === '#e4e4e4')).toHaveLength(14)
    expect(mono.over.filter((n) => n.t === 'path' && n.fill === '#e4e4e4')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------- the diamond cluster

/** The four bond directions of the brief: d1 = (1, 1, 1), d2 = (1, -1, -1), d3 = (-1, 1, -1), d4 = (-1, -1, 1). */
const D: Vec3[] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
]
const angle3 = (a: Vec3, b: Vec3): number => (Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (length3(a) * length3(b))) * 180) / Math.PI
const TETRAHEDRAL_ANGLE = (Math.acos(-1 / 3) * 180) / Math.PI // 109.4712 degrees

describe('diamondStructure: the model of a cluster of 17 carbon atoms', () => {
  const m = diamondModel()
  const neighbours = (i: number): number[] => m.bonds.flatMap((b) => (b.a === i ? [b.b] : b.b === i ? [b.a] : []))
  const direction = (from: number, to: number): Vec3 => minus(m.atoms[to].pos, m.atoms[from].pos)

  it('uses the four directions of the brief, which add up to nothing (a regular tetrahedron)', () => {
    expect([...TETRAHEDRAL]).toEqual(D)
    expect(D.reduce((s, d) => plus(s, d), [0, 0, 0] as Vec3)).toEqual([0, 0, 0])
  })

  it('has 17 atoms: the central one at the origin, 4 neighbours at d_a, and 12 outer atoms at d_a - d_b for b not equal to a, none twice', () => {
    const outer = D.flatMap((da, a) => D.flatMap((db, b) => (a === b ? [] : [minus(da, db)])))
    expect(m.atoms).toHaveLength(17)
    expect(m.atoms.map((a) => a.pos)).toEqual([[0, 0, 0], ...D, ...outer])
    expect(m.atoms.map((a) => a.shell)).toEqual([0, ...Array(4).fill(1), ...Array(12).fill(2)])
    expect(new Set(m.atoms.map((a) => key3(a.pos))).size).toBe(17)
  })

  it('has 16 bonds: 4 from the central atom to its neighbours and 3 from each neighbour to its outer atoms', () => {
    expect(m.bonds).toHaveLength(16)
    expect(m.bonds.filter((b) => m.atoms[b.a].shell === 0 && m.atoms[b.b].shell === 1)).toHaveLength(4)
    expect(m.bonds.filter((b) => m.atoms[b.a].shell === 1 && m.atoms[b.b].shell === 2)).toHaveLength(12)
    expect(new Set(m.bonds.map((b) => `${b.a}-${b.b}`)).size).toBe(16)
    // the outer atom at d_a - d_b is bonded to the neighbour at d_a, whose atoms are 3 (1, 1, 1)-steps from it
    for (const b of m.bonds.filter((x) => m.atoms[x.a].shell === 1))
      expect(D.some((d) => key3(plus(m.atoms[b.b].pos, d)) === key3(m.atoms[b.a].pos))).toBe(true)
  })

  it('gives every bond the same length in the model, the square root of 3 u (before and after the turn)', () => {
    for (const b of m.bonds) {
      expect(length3(direction(b.a, b.b)), `${m.atoms[b.a].pos} - ${m.atoms[b.b].pos}`).toBeCloseTo(Math.sqrt(3), 9)
      expect(length3(minus(m.atoms[b.b].view, m.atoms[b.a].view)), 'after the turn').toBeCloseTo(Math.sqrt(3), 9)
    }
  })

  it('gives the central atom 4 bonds at the tetrahedral angle, 109.47 degrees, to each other', () => {
    const around = neighbours(0)
    expect(around).toHaveLength(4)
    let pairs = 0
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) {
        pairs++
        expect(angle3(direction(0, around[i]), direction(0, around[j]))).toBeCloseTo(TETRAHEDRAL_ANGLE, 6)
      }
    expect(pairs).toBe(6)
    expect(TETRAHEDRAL_ANGLE).toBeCloseTo(109.4712206, 6)
  })

  it('gives each neighbour 4 bonds, 1 inward (to the central atom) and 3 outward, at the tetrahedral angle to each other', () => {
    let seen = 0
    m.atoms.forEach((atom, i) => {
      if (atom.shell !== 1) return
      seen++
      const around = neighbours(i)
      expect(around, `neighbour at ${atom.pos}`).toHaveLength(4)
      // inward: the other end is nearer the centre than this atom is; outward: farther
      expect(around.filter((j) => length3(m.atoms[j].pos) < length3(atom.pos))).toEqual([0])
      expect(around.filter((j) => length3(m.atoms[j].pos) > length3(atom.pos))).toHaveLength(3)
      for (let a = 0; a < 4; a++)
        for (let b = a + 1; b < 4; b++) expect(angle3(direction(i, around[a]), direction(i, around[b])), `at ${atom.pos}`).toBeCloseTo(TETRAHEDRAL_ANGLE, 6)
    })
    expect(seen).toBe(4)
  })

  it('gives each outer atom 1 bond and 3 stubs (the bonds of the crystal that the cluster leaves out): 36 stubs, and 4 directions at the tetrahedral angle', () => {
    expect(m.stubs).toHaveLength(36)
    m.atoms.forEach((atom, i) => {
      const own = m.stubs.filter((s) => s.atom === i)
      expect(own, `atom at ${atom.pos}`).toHaveLength(atom.shell === 2 ? 3 : 0)
      if (atom.shell !== 2) return
      expect(neighbours(i)).toHaveLength(1)
      const dirs = [direction(i, neighbours(i)[0]), ...own.map((s) => s.dir)]
      expect(new Set(dirs.map(key3)).size).toBe(4) // four different directions
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) expect(angle3(dirs[a], dirs[b]), `at ${atom.pos}`).toBeCloseTo(TETRAHEDRAL_ANGLE, 6)
    })
  })

  describe('is a piece of diamond', () => {
    // The diamond lattice, drawn with a cell 4 u wide: carbon on the face-centred cubic points (0,0,0), (0,2,2), (2,0,2), (2,2,0) + 4 Z^3 (A),
    // and on the same points moved by (1, 1, 1) (B). Each A atom is bonded to the four B atoms at +d, each B atom to the four A atoms at -d.
    const FCC: Vec3[] = [
      [0, 0, 0],
      [0, 2, 2],
      [2, 0, 2],
      [2, 2, 0],
    ]
    const mod4 = (n: number) => ((n % 4) + 4) % 4
    const onFcc = (p: Vec3) => FCC.some((q) => q[0] === mod4(p[0]) && q[1] === mod4(p[1]) && q[2] === mod4(p[2]))
    const site = (p: Vec3): 'A' | 'B' | null => (onFcc(p) ? 'A' : onFcc(minus(p, [1, 1, 1])) ? 'B' : null)

    /** The length of the shortest ring of a graph, or Infinity when it has none (a breadth-first search from every vertex). */
    function girth(adjacent: Map<string, string[]>): number {
      let best = Infinity
      for (const root of adjacent.keys()) {
        const depth = new Map([[root, 0]]),
          parent = new Map<string, string>(),
          queue = [root]
        for (let h = 0; h < queue.length; h++)
          for (const next of adjacent.get(queue[h])!) {
            if (!depth.has(next)) {
              depth.set(next, depth.get(queue[h])! + 1)
              parent.set(next, queue[h])
              queue.push(next)
            } else if (parent.get(queue[h]) !== next) best = Math.min(best, depth.get(queue[h])! + depth.get(next)! + 1)
          }
      }
      return best
    }
    const graph = (edges: [Vec3, Vec3][]): Map<string, string[]> => {
      const g = new Map<string, string[]>()
      for (const [p, q] of edges) {
        g.set(key3(p), [...(g.get(key3(p)) ?? []), key3(q)])
        g.set(key3(q), [...(g.get(key3(q)) ?? []), key3(p)])
      }
      return g
    }

    it('has every atom at a site of the lattice (the neighbours on one sublattice, the central and outer atoms on the other), and every bond a bond of it', () => {
      m.atoms.forEach((a) => expect(site(a.pos), `atom at ${a.pos}`).toBe(a.shell === 1 ? 'B' : 'A'))
      for (const b of m.bonds) {
        const [p, q] = [m.atoms[b.a].pos, m.atoms[b.b].pos]
        const [from, to] = site(p) === 'A' ? [p, q] : [q, p]
        expect(
          D.some((d) => key3(plus(from, d)) === key3(to)),
          `${p} - ${q}`,
        ).toBe(true)
      }
    })

    it('has no ring in the cluster itself (16 bonds join 17 atoms into one tree), and the shortest ring of the crystal has six atoms', () => {
      const tree = graph(m.bonds.map((b) => [m.atoms[b.a].pos, m.atoms[b.b].pos]))
      expect(tree.size).toBe(17)
      expect(girth(tree)).toBe(Infinity)
      // the crystal, 5 u each way about the central atom
      const edges: [Vec3, Vec3][] = []
      for (let x = -5; x <= 5; x++)
        for (let y = -5; y <= 5; y++)
          for (let z = -5; z <= 5; z++)
            if (site([x, y, z]) === 'A')
              for (const d of D) {
                const to = plus([x, y, z], d)
                if (Math.max(...to.map(Math.abs)) <= 5) edges.push([[x, y, z], to])
              }
      expect(girth(graph(edges))).toBe(6)
    })

    it('has stubs that lead on into six-membered rings only: complete each stub to a site of the crystal and the shortest ring has six atoms', () => {
      const edges: [Vec3, Vec3][] = m.bonds.map((b) => [m.atoms[b.a].pos, m.atoms[b.b].pos])
      const ends = new Set<string>()
      for (const s of m.stubs) {
        const end = plus(m.atoms[s.atom].pos, s.dir)
        expect(site(end), `the end of the stub at ${m.atoms[s.atom].pos} along ${s.dir}`).toBe('B')
        edges.push([m.atoms[s.atom].pos, end])
        ends.add(key3(end))
      }
      expect(ends.size).toBeLessThan(36) // some stubs of neighbouring atoms meet, and close a ring
      expect(girth(graph(edges))).toBe(6)
    })
  })

  describe('is turned about the vertical axis for the picture', () => {
    it('by no more than the 15 degrees the brief allows, and about the vertical axis: y stays, lengths stay, the right-hand side swings away', () => {
      expect(DIAMOND.turn).toBeGreaterThan(0)
      expect(DIAMOND.turn).toBeLessThanOrEqual(15)
      expect(m.turn).toBe(DIAMOND.turn)
      for (const p of [...D, [2, -1, 3], [-4, 2, 0]] as Vec3[]) {
        const q = turned(p, DIAMOND.turn)
        expect(q[1]).toBe(p[1])
        expect(length3(q)).toBeCloseTo(length3(p), 9)
        expect(Math.hypot(q[0], q[2])).toBeCloseTo(Math.hypot(p[0], p[2]), 9)
        expect(angle3([p[0], 0, p[2]], [q[0], 0, q[2]])).toBeCloseTo(DIAMOND.turn, 6)
      }
      const right = turned([1, 0, 0], DIAMOND.turn)
      expect(right[0]).toBeGreaterThan(0)
      expect(right[2]).toBeGreaterThan(0) // +z is away from the viewer
      expect(turned([1, 2, 3], 0)).toEqual([1, 2, 3])
    })

    it('puts each atom of the model at its turned place', () => {
      const t = (DIAMOND.turn * Math.PI) / 180
      for (const a of m.atoms) {
        expect(a.view[0]).toBeCloseTo(a.pos[0] * Math.cos(t) - a.pos[2] * Math.sin(t), 9)
        expect(a.view[1]).toBeCloseTo(a.pos[1], 9)
        expect(a.view[2]).toBeCloseTo(a.pos[0] * Math.sin(t) + a.pos[2] * Math.cos(t), 9)
      }
    })

    it('is needed: straight on, N2 and O43 fall 2 u apart and five atoms lie on one straight line; at the turn of the symbol no two circles overlap', () => {
      const index = (p: Vec3) => m.atoms.findIndex((a) => key3(a.pos) === key3(p))
      const straight = diamondPicture(diamondModel(0))
      // N2 is the neighbour at d2, O43 the outer atom at d4 - d3
      expect(dist(straight.circles[index(D[1])].c, straight.circles[index(minus(D[3], D[2]))].c)).toBeCloseTo(2.06, 1)
      expect(smallestGap(straight.circles)).toBeLessThan(-10)
      // O41, N4, C0, N1 and O14 run along the line x + y = constant of the picture (y points down)
      const line = [minus(D[3], D[0]), D[3], [0, 0, 0], D[0], minus(D[0], D[3])].map((p) => straight.circles[index(p as Vec3)].c)
      for (const c of line) expect(c.x + c.y).toBeCloseTo(line[0].x + line[0].y, 9)
      expect(smallestGap(diamondPicture(m).circles)).toBeGreaterThan(5)
    })
  })

  it('has the bonds at the rear that the picture draws thin: those whose middle is behind the central atom, 8 of the 16 and 2 of the 4 at the central atom', () => {
    const t = (DIAMOND.turn * Math.PI) / 180
    const z = (p: Vec3) => p[0] * Math.sin(t) + p[2] * Math.cos(t)
    for (const b of m.bonds) expect(b.rear, `${m.atoms[b.a].pos} - ${m.atoms[b.b].pos}`).toBe((z(m.atoms[b.a].pos) + z(m.atoms[b.b].pos)) / 2 > 0)
    expect(m.bonds.filter((b) => b.rear)).toHaveLength(8)
    expect(m.bonds.filter((b) => b.rear && b.a === 0)).toHaveLength(2)
    expect(DIAMOND.rear).toBe(0)
  })
})

describe('diamondStructure: the picture of the model', () => {
  const m = diamondModel()

  /**
   * What the drawing should show, from the model and the brief: u = 24 at the size 160, radius 7, the cluster turned and projected by
   * oblique(x, y, z), centred in the box; a bond is the line between its circle edges, a stub runs from the edge of its atom to 0.4 of the way
   * to the atom at the other end of the missing bond.
   */
  function expected(h: number, withStubs: boolean) {
    const k = h / 160,
      u = 24 * k,
      t = (DIAMOND.turn * Math.PI) / 180
    const turn = (p: Vec3): Vec3 => [p[0] * Math.cos(t) - p[2] * Math.sin(t), p[1], p[0] * Math.sin(t) + p[2] * Math.cos(t)]
    const place = (p: Vec3) => {
      const v = turn(p)
      return oblique(v[0] * u, v[1] * u, v[2] * u)
    }
    const raw = m.atoms.map((a) => ({ c: place(a.pos), r: 7 * k, z: turn(a.pos)[2] }))
    const xs = raw.flatMap((d) => [d.c.x - d.r, d.c.x + d.r]),
      ys = raw.flatMap((d) => [d.c.y - d.r, d.c.y + d.r])
    const dx = -(Math.min(...xs) + Math.max(...xs)) / 2,
      dy = h / 2 - (Math.min(...ys) + Math.max(...ys)) / 2
    const circles = raw.map((d) => ({ ...d, c: P(d.c.x + dx, d.c.y + dy) }))
    const bonds = m.bonds.map((b) => ({ a: b.a, b: b.b, z: (raw[b.a].z + raw[b.b].z) / 2, rear: (raw[b.a].z + raw[b.b].z) / 2 > 0 }))
    const stubs = (withStubs ? m.stubs : []).map((s) => {
      const from = circles[s.atom].c,
        far = place(plus(m.atoms[s.atom].pos, s.dir))
      const zFar = turn(plus(m.atoms[s.atom].pos, s.dir))[2]
      return {
        atom: s.atom,
        tip: P(from.x + 0.4 * (far.x + dx - from.x), from.y + 0.4 * (far.y + dy - from.y)),
        z: raw[s.atom].z + 0.2 * (zFar - raw[s.atom].z), // the middle of the stub
      }
    })
    return { k, circles, bonds, stubs }
  }

  /** The drawing of the cluster, matched to the model: the circle of each atom, the line of each bond and the line of each stub. */
  function drawn(h: number, withStubs = false) {
    const want = expected(h, withStubs)
    const d = read(geometry('diamondStructure', h, h, { stubs: withStubs }))
    const taken = new Set<number>()
    const circles = want.circles.map((e, i) => {
      const n = d.circles.findIndex((c, idx) => !taken.has(idx) && same(c.c, e.c) && Math.abs(c.r - e.r) < 0.02 && c.role === 'solid')
      expect(
        n,
        `no white circle of radius ${e.r.toFixed(2)} at ${e.c.x.toFixed(2)}, ${e.c.y.toFixed(2)} for the atom at ${m.atoms[i].pos}`,
      ).toBeGreaterThanOrEqual(0)
      taken.add(n)
      return { ...d.circles[n], z: e.z }
    })
    const used = new Set<DrawnLine>()
    const bonds = want.bonds.map((b) => {
      const found = d.lines.filter((line) => joins(line, circles[b.a], circles[b.b]))
      expect(found, `bond ${m.atoms[b.a].pos} - ${m.atoms[b.b].pos} at ${h}`).toHaveLength(1)
      used.add(found[0])
      return { ...b, line: found[0] }
    })
    const stubs = want.stubs.map((s) => {
      const c = circles[s.atom]
      const found = d.lines.filter((line) => {
        const [near, far] = dist(line.p, c.c) < dist(line.q, c.c) ? [line.p, line.q] : [line.q, line.p]
        return Math.abs(dist(near, c.c) - c.r) < 0.03 && same(far, s.tip) && toLine(near, c.c, s.tip) < 0.03
      })
      expect(found, `stub of the atom at ${m.atoms[s.atom].pos} at ${h}`).toHaveLength(1)
      used.add(found[0])
      return { ...s, line: found[0] }
    })
    expect(used.size, 'every line is a bond or a stub, none twice').toBe(d.lines.length)
    return { k: want.k, d, circles, bonds, stubs }
  }

  it('uses the numbers of the brief: size 160, u = 24, radius 7, stubs 0.4 of a bond', () => {
    expect([DIAMOND.size, DIAMOND.unit, DIAMOND.radius, DIAMOND.stub]).toEqual([160, 24, 7, 0.4])
  })

  it('draws the model: 17 white circles of radius 7 (scaled with the box) at the places of the atoms, 16 bond lines, and nothing else', () => {
    for (const h of sizes('diamondStructure')) {
      const x = drawn(h)
      expect(x.d.circles).toHaveLength(17)
      expect(x.d.lines).toHaveLength(16)
      expect(x.d.hatches).toHaveLength(0)
      for (const c of x.d.circles) expect([c.role, c.r]).toEqual(['solid', 7 * x.k])
      expect(geometry('diamondStructure', h, h).prims).toHaveLength(17 + 16)
    }
  })

  it('draws a bond thin (role detail) when it is at the rear and heavy (role outline) when it is not, 8 of each', () => {
    for (const h of sizes('diamondStructure')) {
      const x = drawn(h)
      for (const b of x.bonds) expect(b.line.role, `${m.atoms[b.a].pos} - ${m.atoms[b.b].pos} at ${h}`).toBe(b.rear ? 'detail' : 'outline')
      expect(x.bonds.filter((b) => b.line.role === 'detail')).toHaveLength(8)
      expect(x.bonds.filter((b) => b.line.role === 'outline')).toHaveLength(8)
    }
  })

  it('draws far to near: nothing comes after anything that is nearer to the viewer', () => {
    for (const withStubs of [false, true]) {
      const x = drawn(DIAMOND.size, withStubs)
      const depth = new Map<number, number>()
      for (const c of x.circles) depth.set(c.at, c.z)
      for (const b of x.bonds) depth.set(b.line.at, b.z)
      for (const s of x.stubs) depth.set(s.line.at, s.z)
      const order = [...depth.keys()].sort((p, q) => p - q).map((at) => depth.get(at)!)
      expect(order).toHaveLength(17 + 16 + (withStubs ? 36 : 0))
      for (let i = 1; i < order.length; i++) expect(order[i], `item ${i}`).toBeLessThanOrEqual(order[i - 1] + 1e-9)
      expect(order[0]).toBeGreaterThan(order[order.length - 1] + 1) // the picture has depth
    }
  })

  it('keeps every circle clear of every other, the edges at least 4 u apart, at every size: no two circles overlap', () => {
    for (const h of sizes('diamondStructure'))
      for (const withStubs of [false, true]) {
        const x = drawn(h, withStubs)
        expect(smallestGap(x.d.circles), `the drawing at ${h}`).toBeGreaterThanOrEqual(4 * x.k - 1e-6)
        expect(smallestGap(diamondPicture(m, h, withStubs).circles), `the picture at ${h}`).toBeGreaterThanOrEqual(4 * x.k - 1e-6)
      }
  })

  it('draws no bond through a circle that is not at one of its ends: the line stays at least 7 u from every other circle (7 u scaled with the box)', () => {
    for (const h of sizes('diamondStructure')) {
      const x = drawn(h)
      for (const b of x.bonds)
        x.circles.forEach((c, i) => {
          if (i === b.a || i === b.b) return
          expect(toSegment(c.c, b.line.p, b.line.q) - c.r, `${m.atoms[b.a].pos} - ${m.atoms[b.b].pos} past ${m.atoms[i].pos} at ${h}`).toBeGreaterThanOrEqual(
            7 * x.k - 1e-6,
          )
        })
    }
  })

  it('draws no two bonds of an atom less than 60 degrees apart, so that the directions can be told apart in the picture', () => {
    const x = drawn(DIAMOND.size)
    x.circles.forEach((c, i) => {
      const ways = x.bonds
        .filter((b) => b.a === i || b.b === i)
        .map((b) => {
          const far = x.circles[b.a === i ? b.b : b.a].c
          return Math.atan2(far.y - c.c.y, far.x - c.c.x)
        })
      for (let a = 0; a < ways.length; a++)
        for (let b = a + 1; b < ways.length; b++) {
          const apart = Math.abs(((ways[a] - ways[b]) * 180) / Math.PI) % 360
          expect(Math.min(apart, 360 - apart), `at ${m.atoms[i].pos}`).toBeGreaterThanOrEqual(60)
        }
    })
  })

  it('is centred in its box and inside it, at every size, with stubs on or off', () => {
    for (const h of sizes('diamondStructure')) for (const withStubs of [false, true]) expectCentredInBox(drawn(h, withStubs).d.circles, h, `size ${h}`)
  })

  it('shows no stubs by default; with stubs on it adds 36 thin lines, 3 on each outer atom, each from the edge of its atom to 0.4 of a bond along the missing bond', () => {
    expect(drawn(DIAMOND.size).d.lines).toHaveLength(16)
    for (const h of sizes('diamondStructure')) {
      const x = drawn(h, true)
      expect(x.d.lines).toHaveLength(16 + 36)
      expect(x.stubs).toHaveLength(36)
      for (const s of x.stubs) {
        expect(s.line.role).toBe('detail')
        // clear of every circle but its own
        x.circles.forEach((c, i) => {
          if (i !== s.atom) expect(toSegment(c.c, s.line.p, s.line.q) - c.r, `at ${h}`).toBeGreaterThanOrEqual(4 * x.k - 1e-6)
        })
      }
      m.atoms.forEach((a, i) => expect(x.stubs.filter((s) => s.atom === i)).toHaveLength(a.shell === 2 ? 3 : 0))
      // the same direction gives the same stub on every atom: a parallel projection
      for (const d of D) {
        const reach = m.stubs.flatMap((s, i) =>
          key3(s.dir) === key3(d) ? [P(x.stubs[i].tip.x - x.circles[s.atom].c.x, x.stubs[i].tip.y - x.circles[s.atom].c.y)] : [],
        )
        expect(reach).toHaveLength(9)
        for (const r of reach) expect(same(r, reach[0], 0.05)).toBe(true)
      }
    }
  })
})
