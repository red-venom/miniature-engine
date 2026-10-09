// cages.ts — the carbon layers and cages of the structures pack: graphite and C60 (release 1.2, pilot pictures).
// Graphite is drawn in the oblique projection of rule S14 (oblique.ts); C60 is an orthographic view of a ball. Add each symbol here when it is built.
//
// Each picture has a pure model (exported, and tested in cages.science.test.ts) and a drawing that reads only the model:
// the atoms with their 3D positions, the bonds with their two ends, and, for the ball, the faces. The drawing never invents a part.
//
// Where the pictures differ from the numbers of the catalogue `draw` text, and why (both are pilots for James to look at):
//  - graphite: the default size is 250 x 212 (the draw text has 200 x 170), and at that size a bond is 30 u and an atom has the radius
//    4.375 u: the picture of a bond of 24 u and atoms of 3.5 u at 200 x 170, 1.25 times as big, with the outline of an atom still 2 u (rule
//    S3). The brief's 22 u and 4 u (GRAPHITE_BRIEF keeps them, as 27.5 u and 5 u at this size) draw a bond along z half as long, so its two
//    atoms touch. The picture scales with w / 250 and h / 212; four sheets are drawn smaller (0.86) so that they fit the box; the minimum
//    size is 170 x 144, because the strokes do not scale and below it the 66 atoms touch.
//  - C60: a face counts as facing the viewer when its normal is more than 0.3 from edge-on (C60_TURN.facing; the brief has 0), because the
//    faces seen almost edge-on make doubled lines and overlapping circles at the rim. The hexagon directions are the cyclic permutations
//    of (0, phi, 1/phi), which is what the atoms of the formula need: the draw text has the mirror family (0, 1/phi, phi), which picks out
//    one atom, not a hexagon (the test finds the faces again from the bond graph).

import { P, bounds, dist, f, type Pt } from '../kernel/geom'
import { bool, circle, num, tinted } from './kit'
import { oblique } from './oblique'
import type { Geometry, Prim, SymbolDef } from './types'

// ================================================================ graphite

/**
 * The sheets of graphite. Every length of the model is in bond lengths l (a bond is 1 long), x to the right, y up and z away from the viewer,
 * as `oblique()` wants them. A sheet is a patch of the honeycomb net in the horizontal x-z plane: ROWS rows of COLS hexagons.
 */
export const GRAPHITE = {
  rows: 2,
  cols: 3,
  /** The spacing g of the sheets, in bond lengths: clearly more than a bond, as in the real crystal (0.335 nm against 0.142 nm). */
  gap: 2.2,
  /** The length of a stub, in bond lengths. It shows that the net goes on: an edge atom has two bonds in the patch and one stub. */
  stub: 0.4,
  minLayers: 2,
  maxLayers: 4,
  /** The default size of the symbol: the sizes of a GraphiteStyle are for a picture at this size, and a picture in a bigger or smaller box scales with it. */
  box: { w: 250, h: 212 },
} as const

/** The sizes of a picture at the default size (GRAPHITE.box), in u. The outline of an atom is 2 u whatever the size (rule S3). */
export interface GraphiteStyle {
  /** One bond. */
  l: number
  /** The radius of an atom, to the middle of its outline. */
  atomR: number
}
/**
 * The numbers of the catalogue row, which are for a box of 200 x 170: l = 22 u and atoms of radius 4 u. Here they are 1.25 times as big, for
 * the box of 250 x 212 (so a picture of 200 x 170 in this style has 22 u and 4 u). In the oblique projection a bond along z is drawn half as
 * long (11 u), so the outlines of its two atoms are 1 u apart and the bond between them is 3 u long: the atoms touch (cages.science.test.ts).
 */
export const GRAPHITE_BRIEF: GraphiteStyle = { l: 27.5, atomR: 5 }
/**
 * What the symbol draws at 250 x 212: a bond of 30 u and atoms of radius 4.375 u. That is the picture of 24 u and 3.5 u at 200 x 170, 1.25
 * times as big, so the outlines of a bond along z (15 u long on the page) are 4.25 u apart.
 */
export const GRAPHITE_STYLE: GraphiteStyle = { l: 30, atomR: 4.375 }

/** One sheet: a patch of the honeycomb net. The hexagons have their corners at 30, 90, ..., 330 degrees in the x-z plane (two sides run along z). */
export interface Honeycomb {
  /** The atoms of the patch in the x-z plane, in bond lengths. Each atom once, in the order that the hexagons meet it. */
  atoms: { x: number; z: number }[]
  /** The hexagons: the six atoms of each, in order round the ring (corner 0 is at 30 degrees). */
  rings: number[][]
  /** The bonds of the patch: each pair of neighbouring atoms once (the smaller id first). */
  bonds: [number, number][]
}

/** The patch of `rows` rows of `cols` hexagons: the centres of row r are at x = (m + r/2) sqrt(3) with the half dropped for even r, z = 1.5 r. */
export function honeycombPatch(rows: number, cols: number): Honeycomb {
  const atoms: Honeycomb['atoms'] = []
  const at = new Map<string, number>()
  const atom = (x: number, z: number): number => {
    const key = `${Math.round(x * 1e6)}|${Math.round(z * 1e6)}`
    let id = at.get(key)
    if (id === undefined) {
      id = atoms.length
      at.set(key, id)
      atoms.push({ x, z })
    }
    return id
  }
  const rings: number[][] = []
  for (let r = 0; r < rows; r++)
    for (let m = 0; m < cols; m++) {
      const cx = (m + (r % 2) / 2) * Math.sqrt(3),
        cz = 1.5 * r
      rings.push(Array.from({ length: 6 }, (_, a) => atom(cx + Math.cos(((30 + 60 * a) * Math.PI) / 180), cz + Math.sin(((30 + 60 * a) * Math.PI) / 180))))
    }
  const seen = new Set<string>()
  const bonds: [number, number][] = []
  for (const ring of rings)
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % 6],
        pair: [number, number] = a < b ? [a, b] : [b, a]
      if (!seen.has(pair.join('-'))) {
        seen.add(pair.join('-'))
        bonds.push(pair)
      }
    })
  return { atoms, rings, bonds }
}

export interface GraphiteAtom {
  id: number
  /** 0 is the lowest sheet. */
  sheet: number
  /** The atom of the patch that this is (the same in every sheet). */
  site: number
  x: number
  y: number
  z: number
}
/** A bond between two atoms of one sheet. */
export interface GraphiteBond {
  a: number
  b: number
}
/** The short line at an edge atom that stands for the bond that the patch does not show: `dir` is the unit vector along the missing bond. */
export interface GraphiteStub {
  atom: number
  dir: [number, number, number]
  /** In bond lengths. */
  length: number
}
/** A weak force between layers: an atom of one sheet and the atom directly below it. It is never a bond. */
export interface GraphiteForce {
  upper: number
  lower: number
}
export interface GraphiteModel {
  layers: number
  /** Distance between sheets, in bond lengths. */
  gap: number
  atomsPerSheet: number
  atoms: GraphiteAtom[]
  bonds: GraphiteBond[]
  stubs: GraphiteStub[]
  forces: GraphiteForce[]
  /** The hexagons, sheet by sheet: the six atom ids of each in order. */
  rings: number[][]
}

/**
 * The atoms of a sheet that the dotted lines start from, as (hexagon, corner): the front-left and the back-right corner of the patch, and the
 * pair of atoms that the patch turns into each other when it is turned half a turn about its middle, so the four stand in two even pairs.
 * A dotted line is vertical on the page, so it runs over whatever lies above the atom it ends on. The lines of these four cross no atom and
 * at most one bond (the test checks it); the other two corners of the patch are not used, because their lines run over a whole row of atoms.
 */
export const FORCE_SITES: readonly (readonly [number, number])[] = [
  [0, 3],
  [0, 1],
  [2, 0],
  [5, 0],
]

export const clampLayers = (v: number): number => Math.min(GRAPHITE.maxLayers, Math.max(GRAPHITE.minLayers, Math.round(v)))

/** The model of `layers` identical sheets, one straight above the other: sheet k at height k g. */
export function graphiteModel(layers: number = 3): GraphiteModel {
  const n = clampLayers(layers)
  const patch = honeycombPatch(GRAPHITE.rows, GRAPHITE.cols)
  const per = patch.atoms.length
  const neighbours = patch.atoms.map(() => [] as number[])
  for (const [a, b] of patch.bonds) {
    neighbours[a].push(b)
    neighbours[b].push(a)
  }
  const atoms: GraphiteAtom[] = [],
    bonds: GraphiteBond[] = [],
    stubs: GraphiteStub[] = [],
    forces: GraphiteForce[] = [],
    rings: number[][] = []
  for (let k = 0; k < n; k++) {
    const id = (site: number) => k * per + site
    patch.atoms.forEach((a, site) => atoms.push({ id: id(site), sheet: k, site, x: a.x, y: k * GRAPHITE.gap, z: a.z }))
    for (const [a, b] of patch.bonds) bonds.push({ a: id(a), b: id(b) })
    for (const ring of patch.rings) rings.push(ring.map(id))
    // An atom with two bonds gets a stub along the third: the bonds are 120 degrees apart, so it points away from their sum.
    neighbours.forEach((nb, site) => {
      if (nb.length !== 2) return
      const here = patch.atoms[site]
      const u = nb.map((j) => {
        const dx = patch.atoms[j].x - here.x,
          dz = patch.atoms[j].z - here.z,
          len = Math.hypot(dx, dz)
        return [dx / len, dz / len]
      })
      const sx = -(u[0][0] + u[1][0]),
        sz = -(u[0][1] + u[1][1]),
        len = Math.hypot(sx, sz)
      stubs.push({ atom: id(site), dir: [sx / len, 0, sz / len], length: GRAPHITE.stub })
    })
    if (k > 0) for (const [ring, corner] of FORCE_SITES) forces.push({ upper: id(patch.rings[ring][corner]), lower: (k - 1) * per + patch.rings[ring][corner] })
  }
  return { layers: n, gap: GRAPHITE.gap, atomsPerSheet: per, atoms, bonds, stubs, forces, rings }
}

/** Role `dashed` draws 5 u on and 3 u off (render.ts). A dotted line is cut so that it starts and ends on a dash. */
export const DASH = { on: 5, off: 3 }

/** Where everything goes, in the frame of the symbol, before the picture is centred in its box. */
export interface GraphiteDrawing {
  /** The centre of each atom, by id. */
  centres: Pt[]
  r: number
  bonds: [Pt, Pt][]
  stubs: [Pt, Pt][]
  forces: [Pt, Pt][]
}

/** The drawing at the scale `s` (1 is the default size): a bond is `style.l` s u long and an atom has the radius `style.atomR` s. */
export function drawGraphite(m: GraphiteModel, s: number, forcesOn: boolean, style: GraphiteStyle = GRAPHITE_STYLE): GraphiteDrawing {
  const L = style.l * s,
    r = style.atomR * s
  const centres = m.atoms.map((a) => oblique(a.x * L, a.y * L, a.z * L))
  const along = (from: Pt, to: Pt, d: number): Pt => {
    const len = dist(from, to) || 1
    return P(from.x + ((to.x - from.x) / len) * d, from.y + ((to.y - from.y) / len) * d)
  }
  // A line between two circles starts and ends on their edges.
  const bonds = m.bonds.map(({ a, b }): [Pt, Pt] => [along(centres[a], centres[b], r), along(centres[b], centres[a], r)])
  const stubs = m.stubs.map(({ atom, dir, length }): [Pt, Pt] => {
    const c = centres[atom],
      v = oblique(dir[0] * length * L, dir[1] * length * L, dir[2] * length * L), // the stub is a short bond: it is foreshortened like one
      len = Math.hypot(v.x, v.y)
    const from = P(c.x + (v.x / len) * r, c.y + (v.y / len) * r)
    return [from, P(from.x + v.x, from.y + v.y)]
  })
  const forces = forcesOn
    ? m.forces.map(({ upper, lower }): [Pt, Pt] => {
        const top = centres[upper],
          bottom = centres[lower]
        const free = bottom.y - top.y - 2 * r,
          dashes = Math.max(1, Math.floor((free + DASH.off) / (DASH.on + DASH.off))),
          line = dashes * DASH.on + (dashes - 1) * DASH.off,
          y0 = top.y + r + (free - line) / 2
        return [P(top.x, y0), P(top.x, y0 + line)]
      })
    : []
  return { centres, r, bonds, stubs, forces }
}

const lineD = ([a, b]: [Pt, Pt]): string => `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`

/** The box of the circles, outlines included (the outline of a circle is 2 u, and it does not scale). */
export const circleBounds = (centres: Pt[], r: number) => bounds(centres.flatMap((c) => [P(c.x - r - 1, c.y - r - 1), P(c.x + r + 1, c.y + r + 1)]))

/** The geometry of graphite for a box of w by h u. */
export function graphiteGeometry(w: number, h: number, layers: number, forces: boolean, style: GraphiteStyle = GRAPHITE_STYLE): Geometry {
  const model = graphiteModel(layers)
  const k = Math.min(w / GRAPHITE.box.w, h / GRAPHITE.box.h)
  // The picture has the size of its box, but it is never bigger than the box: four sheets are taller than the box of three.
  const unit = circleBounds(drawGraphite(model, 1, forces, style).centres, style.atomR)
  const s = Math.min(k, (w - 2) / (unit.x1 - unit.x0 - 2), (h - 2) / (unit.y1 - unit.y0 - 2))
  const d = drawGraphite(model, s, forces, style)
  // The circles are centred in the box; the stubs are small enough to stick out.
  const b = circleBounds(d.centres, d.r)
  const by = P(-(b.x0 + b.x1) / 2, h / 2 - (b.y0 + b.y1) / 2)
  const move = (lines: [Pt, Pt][]) => lines.map(([p, q]): [Pt, Pt] => [P(p.x + by.x, p.y + by.y), P(q.x + by.x, q.y + by.y)])
  // Back to front: the dotted lines, the bonds, the stubs, then the atoms (white, so that they hide the ends of the lines).
  const prims: Prim[] = []
  if (d.forces.length) prims.push({ d: move(d.forces).map(lineD).join(''), role: 'dashed' })
  prims.push({ d: move(d.bonds).map(lineD).join(''), role: 'outline' })
  if (d.stubs.length) prims.push({ d: move(d.stubs).map(lineD).join(''), role: 'detail' })
  prims.push({ d: d.centres.map((c) => circle(c.x + by.x, c.y + by.y, d.r)).join(''), role: 'solid' })
  return { prims }
}

const graphiteStructure: SymbolDef = {
  id: 'graphiteStructure',
  name: 'Graphite (layers)',
  aliases: ['giant covalent', 'carbon layers', 'hexagonal layers', 'graphite lattice'],
  label: 'graphite',
  pack: 'structures',
  size: { w: 250, h: 212 },
  resize: 'uniform',
  min: { w: 170, h: 144 },
  params: [
    { key: 'layers', label: 'Layers', type: 'number', default: 3, min: 2, max: 4, step: 1 },
    { key: 'forces', label: 'Weak forces', type: 'boolean', default: true },
  ],
  build({ w, h, p }) {
    return graphiteGeometry(w, h, num(p.layers, 3), bool(p.forces, true))
  },
}

// ================================================================ C60

export const PHI = (1 + Math.sqrt(5)) / 2

type V3 = [number, number, number]
const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const norm3 = (a: V3): number => Math.hypot(a[0], a[1], a[2])
const unit3 = (a: V3): V3 => {
  const l = norm3(a)
  return [a[0] / l, a[1] / l, a[2] / l]
}
/** The even permutations of (a, b, c): the three cyclic ones. */
const cyclic = ([a, b, c]: V3): V3[] => [
  [a, b, c],
  [b, c, a],
  [c, a, b],
]
/** All sign choices of a triple (a zero stays zero, so it gives one choice, not two). */
const signed = (v: V3): V3[] => {
  const out: V3[] = []
  for (const sx of v[0] === 0 ? [1] : [1, -1])
    for (const sy of v[1] === 0 ? [1] : [1, -1]) for (const sz of v[2] === 0 ? [1] : [1, -1]) out.push([sx * v[0], sy * v[1], sz * v[2]])
  return out
}

/** One carbon atom of the molecule: the truncated icosahedron of edge length 2. */
export interface C60Atom {
  id: number
  x: number
  y: number
  z: number
}
export interface C60Bond {
  a: number
  b: number
}
/** A pentagon or hexagon: `dir` is the unit vector from the middle of the ball to the middle of the face; `atoms` go round the ring. */
export interface C60Face {
  kind: 'pentagon' | 'hexagon'
  dir: V3
  atoms: number[]
}
export interface C60Molecule {
  atoms: C60Atom[]
  bonds: C60Bond[]
  faces: C60Face[]
}

/** The distance from the middle of the ball to an atom, for an edge of 2. */
export const C60_RADIUS = Math.sqrt(10 + 9 * PHI)

let molecule: C60Molecule | undefined
/**
 * The molecule, from the formula of the brief. Atoms: the even (cyclic) permutations of (0, 1, 3 phi), (1, 2 + phi, 2 phi) and
 * (phi, 2, 2 phi + 1) with every choice of signs. Bonds: the pairs of atoms 2 apart. Faces: the 12 pentagons are along the directions
 * (0, 1, phi) and its cyclic permutations; the 20 hexagons along (1, 1, 1) and the cyclic permutations of (0, phi, 1/phi). (The brief writes
 * (0, 1/phi, phi) for the last twelve, which is the mirror image of the family that this set of atoms has: it picks out one atom, not a hexagon.)
 * The atoms of a face are the ones whose projection on its direction is the largest.
 */
export function c60Molecule(): C60Molecule {
  if (molecule) return molecule
  const atoms: C60Atom[] = []
  for (const base of [
    [0, 1, 3 * PHI],
    [1, 2 + PHI, 2 * PHI],
    [PHI, 2, 2 * PHI + 1],
  ] as V3[])
    for (const c of cyclic(base)) for (const [x, y, z] of signed(c)) atoms.push({ id: atoms.length, x, y, z })
  const at = (i: number): V3 => [atoms[i].x, atoms[i].y, atoms[i].z]
  const bonds: C60Bond[] = []
  for (const p of atoms) for (const q of atoms) if (p.id < q.id && Math.abs(norm3(sub3(at(p.id), at(q.id))) - 2) < 1e-9) bonds.push({ a: p.id, b: q.id })
  const faces: C60Face[] = []
  const face = (kind: C60Face['kind'], d: V3) => {
    const dir = unit3(d),
      along = atoms.map((_, i) => dot3(at(i), dir)),
      top = Math.max(...along)
    const ids = atoms.filter((_, i) => along[i] > top - 1e-9).map((a) => a.id)
    // Round the ring: by the angle about the middle of the face.
    const mid: V3 = [0, 1, 2].map((k) => ids.reduce((sum, i) => sum + at(i)[k], 0) / ids.length) as V3
    const e1 = unit3(sub3(at(ids[0]), mid)),
      e2 = cross3(dir, e1)
    const angle = (i: number) => Math.atan2(dot3(sub3(at(i), mid), e2), dot3(sub3(at(i), mid), e1))
    faces.push({ kind, dir, atoms: [...ids].sort((p, q) => angle(p) - angle(q)) })
  }
  for (const c of cyclic([0, 1, PHI])) for (const d of signed(c)) face('pentagon', d)
  for (const d of signed([1, 1, 1])) face('hexagon', d)
  for (const c of cyclic([0, PHI, 1 / PHI])) for (const d of signed(c)) face('hexagon', d)
  molecule = { atoms, bonds, faces }
  return molecule
}

/** How the ball is turned to the viewer. */
export interface C60Turn {
  /** The direction of the pentagon that is turned to the viewer. */
  pentagon: V3
  /** Before the tilt, a corner of that pentagon points this way on the page: degrees anticlockwise from the right, so 90 is up and -90 is down. */
  corner: number
  /** Then the ball is tilted about x (positive: the top comes towards the viewer) and about y (positive: the front goes to the right), in degrees. */
  tiltX: number
  tiltY: number
  /**
   * A face faces the viewer when the cosine of the angle between its normal and the line of sight is more than this. 0 is every face that is
   * turned to the viewer at all (the brief); 0.3 leaves out the faces that are seen within 17.5 degrees of edge-on. Those are slivers with two
   * lines a few u apart and atoms on top of each other at the rim: with 0 the closest two atoms are 5 u apart, with 0.3 they are 13.5 u apart.
   * No face has a cosine between 0.214 and 0.413 in this view, so any value in that gap draws the same picture.
   */
  facing: number
}
export const C60_TURN: C60Turn = { pentagon: [0, 1, PHI], corner: -90, tiltX: 14, tiltY: 10, facing: 0.3 }

type Matrix = [V3, V3, V3]
const apply = (m: Matrix, v: V3): V3 => [dot3(m[0], v), dot3(m[1], v), dot3(m[2], v)]
const times = (a: Matrix, b: Matrix): Matrix => [0, 1, 2].map((i) => [0, 1, 2].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j])) as Matrix
function rotation(axis: V3, degrees: number): Matrix {
  const [x, y, z] = unit3(axis),
    c = Math.cos((degrees * Math.PI) / 180),
    s = Math.sin((degrees * Math.PI) / 180),
    t = 1 - c
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ]
}

/** The ball as the viewer sees it: x to the right, y up, z towards the viewer, the middle of the ball at the origin, an edge 2 long. */
export interface C60View {
  atoms: C60Atom[]
  /** `hidden`: the bond lies on no face that faces the viewer, so an opaque ball hides it. */
  bonds: (C60Bond & { hidden: boolean })[]
  faces: (C60Face & { normal: V3; facing: boolean })[]
  /** The atoms at the ends of the bonds that are not hidden, far to near: the atoms that the picture draws. */
  shown: number[]
}

export function c60View(turn: C60Turn = C60_TURN, m: C60Molecule = c60Molecule()): C60View {
  // Turn the pentagon to the viewer along the shortest way, then about the line of sight so that a corner of it points the way `corner` says.
  const n = unit3(turn.pentagon),
    axis = cross3(n, [0, 0, 1])
  let to: Matrix =
    norm3(axis) < 1e-12
      ? [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ]
      : rotation(axis, (Math.acos(n[2]) * 180) / Math.PI)
  const front = m.faces.find((fc) => fc.kind === 'pentagon' && dot3(apply(to, fc.dir), [0, 0, 1]) > 1 - 1e-9)!
  const p0 = apply(to, [m.atoms[front.atoms[0]].x, m.atoms[front.atoms[0]].y, m.atoms[front.atoms[0]].z])
  to = times(rotation([0, 0, 1], turn.corner - (Math.atan2(p0[1], p0[0]) * 180) / Math.PI), to)
  const matrix = times(rotation([0, 1, 0], turn.tiltY), times(rotation([1, 0, 0], turn.tiltX), to))
  const atoms = m.atoms.map((a): C60Atom => {
    const [x, y, z] = apply(matrix, [a.x, a.y, a.z])
    return { id: a.id, x, y, z }
  })
  const faces = m.faces.map((fc) => {
    const normal = apply(matrix, fc.dir)
    return { ...fc, normal, facing: normal[2] > turn.facing }
  })
  // A bond is seen when it is a side of a face that faces the viewer.
  const seen = new Set<string>()
  for (const fc of faces)
    if (fc.facing)
      fc.atoms.forEach((a, i) => {
        const b = fc.atoms[(i + 1) % fc.atoms.length]
        seen.add(`${Math.min(a, b)}-${Math.max(a, b)}`)
      })
  const bonds = m.bonds.map((b) => ({ ...b, hidden: !seen.has(`${b.a}-${b.b}`) }))
  const shown = [...new Set(bonds.filter((b) => !b.hidden).flatMap((b) => [b.a, b.b]))].sort((p, q) => atoms[p].z - atoms[q].z || p - q)
  return { atoms, bonds, faces, shown }
}

/** At the default size 150: the ball has the radius 0.44 w and an atom the radius 3.8 u (its outline is 2 u whatever the size). */
export const C60_DRAW = { box: 150, ball: 0.44, atomR: 3.8 }

const meanZ = (view: C60View, ids: number[]): number => ids.reduce((s, i) => s + view.atoms[i].z, 0) / ids.length

/** The geometry of the ball for a box of w by h u: orthographic, far to near. */
export function c60Geometry(w: number, h: number, pentagons: boolean, turn: C60Turn = C60_TURN): Geometry {
  const view = c60View(turn)
  const k = Math.min(w / C60_DRAW.box, h / C60_DRAW.box)
  const u = (C60_DRAW.ball * C60_DRAW.box * k) / C60_RADIUS, // u for one unit of the model
    r = C60_DRAW.atomR * k
  const raw = view.atoms.map((a) => P(a.x * u, -a.y * u))
  const b = circleBounds(
    view.shown.map((i) => raw[i]),
    r,
  )
  const by = P(-(b.x0 + b.x1) / 2, h / 2 - (b.y0 + b.y1) / 2)
  const at = (i: number) => P(raw[i].x + by.x, raw[i].y + by.y)
  const prims: Prim[] = []
  // The pentagons are tinted polygons behind the bonds.
  if (pentagons)
    for (const fc of view.faces.filter((q) => q.facing && q.kind === 'pentagon').sort((p, q) => meanZ(view, p.atoms) - meanZ(view, q.atoms)))
      prims.push(...tinted(fc.atoms.map((i, j) => `${j ? 'L' : 'M'}${f(at(i).x)} ${f(at(i).y)}`).join('') + 'Z'))
  const lines = view.bonds
    .filter((q) => !q.hidden)
    .sort((p, q) => view.atoms[p.a].z + view.atoms[p.b].z - (view.atoms[q.a].z + view.atoms[q.b].z) || p.a - q.a || p.b - q.b)
    .map(({ a, b: c }) => {
      const p = at(a),
        q = at(c),
        len = dist(p, q) || 1,
        dx = ((q.x - p.x) / len) * r,
        dy = ((q.y - p.y) / len) * r
      return `M${f(p.x + dx)} ${f(p.y + dy)}L${f(q.x - dx)} ${f(q.y - dy)}`
    })
  prims.push({ d: lines.join(''), role: 'outline' })
  prims.push({ d: view.shown.map((i) => circle(at(i).x, at(i).y, r)).join(''), role: 'solid' })
  return { prims }
}

const fullereneC60: SymbolDef = {
  id: 'fullereneC60',
  name: 'Buckminsterfullerene (C60)',
  aliases: ['C60', 'fullerene', 'buckyball', 'football molecule', 'giant molecule'],
  label: 'buckminsterfullerene',
  pack: 'structures',
  size: { w: 150, h: 150 },
  resize: 'uniform',
  min: { w: 105, h: 105 },
  params: [{ key: 'pentagons', label: 'Shade pentagons', type: 'boolean', default: false }],
  build({ w, h, p }) {
    return c60Geometry(w, h, bool(p.pentagons, false))
  },
}

export const cages: SymbolDef[] = [graphiteStructure, fullereneC60]
