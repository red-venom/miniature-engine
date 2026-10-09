// lattices.ts — the cubic structures of the structures pack: the sodium chloride block and diamond (release 1.2, pilot pictures).
// Both are drawn in the oblique projection of rule S14 (oblique.ts). Add each symbol here when it is built.
//
// Each picture is a pure model (what is there: ions or atoms with a kind and a place in 3D, bonds with their two ends) and a pure
// picture of that model (circles and lines in the symbol's frame). The symbol only turns the picture into paths, so that
// lattices.science.test.ts can test the science on the model and then check that the drawing agrees with it.

import { P, bounds, dist, f, type Pt } from '../kernel/geom'
import { bool, circle, tinted } from './kit'
import { oblique } from './oblique'
import type { Prim, SymbolDef } from './types'

/** A point or a direction of a model: x to the right, y up, z away from the viewer. */
export type Vec3 = readonly [number, number, number]

/** A circle of a picture, in the symbol's frame (x = 0 on the centre line, y = 0 at the top, y down). */
export interface Disc {
  c: Pt
  r: number
}

/** The line of a bond: from the edge of one circle to the edge of the other. It is null when the circles touch or overlap. */
function trimmed(a: Disc, b: Disc): [Pt, Pt] | null {
  const d = dist(a.c, b.c)
  if (d <= a.r + b.r) return null
  const ux = (b.c.x - a.c.x) / d,
    uy = (b.c.y - a.c.y) / d
  return [P(a.c.x + ux * a.r, a.c.y + uy * a.r), P(b.c.x - ux * b.r, b.c.y - uy * b.r)]
}

/** The shift that puts the middle of the bounds of the circles on the middle of the box (x = 0, y = h / 2). */
function centring(discs: readonly Disc[], h: number): Pt {
  const b = bounds(discs.flatMap((d) => [P(d.c.x - d.r, d.c.y - d.r), P(d.c.x + d.r, d.c.y + d.r)]))
  return P(-(b.x0 + b.x1) / 2, h / 2 - (b.y0 + b.y1) / 2)
}

/** The path of one straight line. */
const lineD = (p: Pt, q: Pt): string => `M${f(p.x)} ${f(p.y)}L${f(q.x)} ${f(q.y)}`

/** The smallest gap between the edges of two circles of a set: negative when two circles overlap, infinite for fewer than two. */
export function smallestGap(discs: readonly Disc[]): number {
  let gap = Infinity
  for (let i = 0; i < discs.length; i++) for (let j = i + 1; j < discs.length; j++) gap = Math.min(gap, dist(discs[i].c, discs[j].c) - discs[i].r - discs[j].r)
  return gap
}

// ---------------------------------------------------------------- ionic lattice (3D)

export type IonKind = 'Na+' | 'Cl-'

/** An ion of the block: `pos` is its place (i, j, k), whole numbers in lattice spacings: i along x, j up, k away from the viewer. */
export interface Ion {
  kind: IonKind
  pos: Vec3
}

/** A bond between two neighbouring ions (indices into `ions`, a < b). `hidden`: it lies on one of the three edges that meet the rear corner. */
export interface IonBond {
  a: number
  b: number
  hidden: boolean
}

export interface IonicModel {
  /** The block is n by n by n ions. */
  n: number
  ions: Ion[]
  bonds: IonBond[]
}

/**
 * A block of sodium chloride, n by n by n ions (3 by 3 by 3 in the symbol). Cl- sits where i + j + k is even and Na+ where it is odd,
 * so every ion has only unlike neighbours. The bonds join every pair of neighbours (one step along x, y or z). A bond is hidden when it
 * lies on one of the three edges of the block that meet the corner i = 0, j = 0, k = n - 1: the corner that none of the three faces
 * facing the viewer in the oblique projection (front, top, right) touches (see boxEdges in oblique.ts).
 */
export function ionicModel(n = 3): IonicModel {
  const ions: Ion[] = []
  const at = (i: number, j: number, k: number) => (i * n + j) * n + k
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) ions.push({ kind: (i + j + k) % 2 === 0 ? 'Cl-' : 'Na+', pos: [i, j, k] })
  const bonds: IonBond[] = []
  const rear = n - 1
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) {
        if (i + 1 < n) bonds.push({ a: at(i, j, k), b: at(i + 1, j, k), hidden: j === 0 && k === rear })
        if (j + 1 < n) bonds.push({ a: at(i, j, k), b: at(i, j + 1, k), hidden: i === 0 && k === rear })
        if (k + 1 < n) bonds.push({ a: at(i, j, k), b: at(i, j, k + 1), hidden: i === 0 && j === 0 })
      }
  return { n, ions, bonds }
}

/**
 * At the default size 150: the distance between neighbouring ions along an axis, and the radii (u).
 *
 * The brief gave 44 and radii 11 and 7, which put two Cl- circles on top of each other. In this projection the ion (i, j, k) and the ion
 * (i - 1, j - 1, k + 2) fall (√2 - 1) spacings apart, 18.2 u at spacing 44, and two Cl- circles of radius 11 need 22 u: they overlap by
 * 3.8 u (the corner (0, 0, 2) and the face centre (1, 1, 0) are such a pair). The edges of two circles must be at least 4 u apart, so that the
 * white between two outlines is as wide as an outline: (√2 - 1) s >= 2 r(Cl-) + 4. The block with its outlines must also fit the box:
 * (2 + √2 / 2) s + 2 r(Cl-) + 2 <= 150. A spacing of 48.5 with radii 8 and 5 meets both, and keeps the ratio of the brief (11 to 7, about 1.6).
 */
export const IONIC = {
  size: 150,
  spacing: 48.5,
  radius: { 'Cl-': 8, 'Na+': 5 } satisfies Record<IonKind, number>,
}

export interface IonicPicture {
  /** One circle for each ion, in the order of the model. */
  circles: Disc[]
  /** One line for each bond that has room to be drawn (all of them, at the sizes of the symbol), in the order of the model. */
  lines: { bond: number; p: Pt; q: Pt; hidden: boolean }[]
}

/**
 * The model in the symbol's frame at box height h: every distance and radius is scaled by h / 150, and the circles are centred in the box.
 * An ion is at oblique(i s, j s, k s) (rule S14); a bond is the straight line between its ions, trimmed to the circle edges.
 */
export function ionicPicture(m: IonicModel, h: number = IONIC.size): IonicPicture {
  const k = h / IONIC.size
  const s = IONIC.spacing * k
  const raw: Disc[] = m.ions.map((ion) => ({ c: oblique(ion.pos[0] * s, ion.pos[1] * s, ion.pos[2] * s), r: IONIC.radius[ion.kind] * k }))
  const shift = centring(raw, h)
  const circles = raw.map((d) => ({ c: P(d.c.x + shift.x, d.c.y + shift.y), r: d.r }))
  const lines: IonicPicture['lines'] = []
  m.bonds.forEach((bond, i) => {
    const ends = trimmed(circles[bond.a], circles[bond.b])
    if (ends) lines.push({ bond: i, p: ends[0], q: ends[1], hidden: bond.hidden })
  })
  return { circles, lines }
}

const ionicLattice3D: SymbolDef = {
  id: 'ionicLattice3D',
  name: 'Ionic lattice (3D)',
  aliases: ['sodium chloride lattice', 'giant ionic lattice', 'NaCl structure', 'ionic crystal', 'ionic lattice'],
  label: 'ionic lattice',
  pack: 'structures',
  size: { w: IONIC.size, h: IONIC.size },
  resize: 'uniform',
  min: { w: 120, h: 120 },
  params: [{ key: 'bonds', label: 'Bonds', type: 'boolean', default: true }],
  build({ h, p }) {
    const m = ionicModel()
    const pic = ionicPicture(m, h)
    const prims: Prim[] = []
    // Bonds first, then the circles, so that a circle always lies over the end of its bonds.
    if (bool(p.bonds, true)) {
      const hidden = pic.lines.filter((l) => l.hidden),
        shown = pic.lines.filter((l) => !l.hidden)
      if (hidden.length) prims.push({ d: hidden.map((l) => lineD(l.p, l.q)).join(''), role: 'dashed' })
      if (shown.length) prims.push({ d: shown.map((l) => lineD(l.p, l.q)).join(''), role: 'detail' })
    }
    // Far to near. The circles do not overlap, but if they ever did the nearer one would cover the farther one.
    const order = m.ions.map((_, i) => i).sort((a, b) => m.ions[b].pos[2] - m.ions[a].pos[2] || a - b)
    for (const i of order) {
      const { c, r } = pic.circles[i]
      const d = circle(c.x, c.y, r)
      if (m.ions[i].kind === 'Cl-') prims.push(...tinted(d))
      else prims.push({ d, role: 'solid' })
    }
    return { prims }
  },
}

// ---------------------------------------------------------------- diamond

/** The four bond directions of a carbon atom (every bond is one of ±these, with the length √3). Their sum is zero. */
export const TETRAHEDRAL: readonly Vec3[] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
]

/**
 * At the default size 160: u, the radius of an atom (u), and how far a stub reaches (a fraction of the bond length).
 *
 * `turn`: before it is projected, the cluster is turned about the vertical axis by this many degrees, its right-hand side swinging away
 * from the viewer. The brief allows up to 15 degrees, for circles that overlap. Straight on (turn 0) the cubic axes line up with the
 * projection: the neighbour N2 and the outer atom O43 fall 2 u apart (the circles overlap), and five atoms (O41, N4, C0, N1, O14) lie on
 * one straight line. At 15 degrees, the most the brief allows and the least that clears every overlap (turns from -30 to 30 were tried),
 * the nearest circles are 5.5 u apart, no bond passes within 7 u of another circle, and no two bonds at an atom are less than 64 degrees
 * apart. The other way round (-15) a bond runs through a circle.
 *
 * `rear`: a bond is thin (drawn farther away) when its middle is farther from the viewer than this (u, from the plane of the central atom).
 * The brief says 0.5. With the turn, 0.5 leaves C0-N4 thick although N4 lies behind C0, so the cut here is 0: the bonds whose middle is
 * behind the central atom are the thin ones, which gives 8 thin bonds and 8 thick ones, and the central atom two of each.
 */
export const DIAMOND = { size: 160, unit: 24, radius: 7, turn: 15, stub: 0.4, rear: 0 }

/** A point of a model turned about the vertical axis by `deg` degrees, so that its right-hand side (+x) swings away from the viewer (+z). */
export function turned(p: Vec3, deg: number): Vec3 {
  const a = (deg * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a)
  return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c]
}

/** An atom of the cluster. `shell`: 0 for the central atom, 1 for its four neighbours, 2 for the twelve outer atoms. */
export interface Atom {
  shell: 0 | 1 | 2
  /** The place in the crystal's own axes, in units of u. */
  pos: Vec3
  /** The same place after the turn: what the projection sees (x right, y up, z away from the viewer), in units of u. */
  view: Vec3
}

/** A bond between two atoms (indices into `atoms`). `rear`: its middle is behind the central atom, so it is drawn thin. */
export interface CBond {
  a: number
  b: number
  rear: boolean
}

/** A bond that an outer atom would make in the crystal and the cluster leaves out: `dir` is one of TETRAHEDRAL. */
export interface Stub {
  atom: number
  dir: Vec3
}

export interface DiamondModel {
  /** The turn about the vertical axis that `view` has, in degrees. */
  turn: number
  atoms: Atom[]
  bonds: CBond[]
  stubs: Stub[]
}

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

/**
 * A cluster of 17 carbon atoms cut from diamond: the central atom at the origin, its 4 neighbours at the points d_a of TETRAHEDRAL (in u),
 * and from each neighbour its 3 other neighbours at d_a - d_b for b not equal to a (12 atoms). 16 bonds, each of length √3 u.
 * Each outer atom is also given its 3 missing bonds, as `stubs`: the directions d_c for c not equal to b, where b is the direction that
 * points back to its neighbour (an outer atom sits at d_a - d_b, so its bond back to the neighbour runs along +d_b).
 */
export function diamondModel(turn: number = DIAMOND.turn): DiamondModel {
  const places: { shell: 0 | 1 | 2; pos: Vec3 }[] = [{ shell: 0, pos: [0, 0, 0] }]
  const links: [number, number][] = []
  const stubs: Stub[] = []
  TETRAHEDRAL.forEach((d) => {
    places.push({ shell: 1, pos: d })
    links.push([0, places.length - 1])
  })
  TETRAHEDRAL.forEach((da, a) => {
    TETRAHEDRAL.forEach((db, b) => {
      if (a === b) return
      places.push({ shell: 2, pos: sub3(da, db) })
      const outer = places.length - 1
      links.push([1 + a, outer])
      TETRAHEDRAL.forEach((dc, c) => {
        if (c !== b) stubs.push({ atom: outer, dir: dc })
      })
    })
  })
  const atoms: Atom[] = places.map((p) => ({ ...p, view: turned(p.pos, turn) }))
  const bonds: CBond[] = links.map(([a, b]) => ({ a, b, rear: (atoms[a].view[2] + atoms[b].view[2]) / 2 > DIAMOND.rear }))
  return { turn, atoms, bonds, stubs }
}

/** One thing to draw. `z` is its depth in u after the turn (larger is farther from the viewer): the drawing order is far to near. */
export type DiamondItem =
  | { type: 'atom'; index: number; z: number }
  | { type: 'bond'; index: number; p: Pt; q: Pt; z: number; rear: boolean }
  | { type: 'stub'; index: number; p: Pt; q: Pt; z: number }

export interface DiamondPicture {
  /** One circle for each atom, in the order of the model. */
  circles: Disc[]
  /** Atoms, bonds and (when asked for) stubs, far to near. */
  items: DiamondItem[]
}

/**
 * The cluster in the symbol's frame at box height h (every distance and radius scaled by h / 160), centred in the box.
 * Position = oblique(x, y, z) of the turned model. A bond is the straight line between its atoms, trimmed to the circle edges. A stub
 * starts at the edge of its atom and ends DIAMOND.stub of a bond length from the centre of the atom, along its direction.
 */
export function diamondPicture(m: DiamondModel, h: number = DIAMOND.size, withStubs = false): DiamondPicture {
  const k = h / DIAMOND.size
  const u = DIAMOND.unit * k
  const put = (v: Vec3): Pt => oblique(v[0] * u, v[1] * u, v[2] * u)
  const raw: Disc[] = m.atoms.map((a) => ({ c: put(a.view), r: DIAMOND.radius * k }))
  const shift = centring(raw, h)
  const circles = raw.map((d) => ({ c: P(d.c.x + shift.x, d.c.y + shift.y), r: d.r }))
  const items: DiamondItem[] = m.atoms.map((a, index) => ({ type: 'atom', index, z: a.view[2] }))
  m.bonds.forEach((bond, index) => {
    const ends = trimmed(circles[bond.a], circles[bond.b])
    const z = (m.atoms[bond.a].view[2] + m.atoms[bond.b].view[2]) / 2
    if (ends) items.push({ type: 'bond', index, p: ends[0], q: ends[1], z, rear: bond.rear })
  })
  if (withStubs)
    m.stubs.forEach((stub, index) => {
      const from = m.atoms[stub.atom].view
      const reach = turned(stub.dir, m.turn)
      const tip = put([from[0] + DIAMOND.stub * reach[0], from[1] + DIAMOND.stub * reach[1], from[2] + DIAMOND.stub * reach[2]])
      const end = P(tip.x + shift.x, tip.y + shift.y)
      const ends = trimmed(circles[stub.atom], { c: end, r: 0 })
      if (ends) items.push({ type: 'stub', index, p: ends[0], q: end, z: from[2] + (DIAMOND.stub * reach[2]) / 2 })
    })
  // Painter: far to near. At equal depth the model order stands, with bonds and stubs before atoms.
  const rank = { stub: 0, bond: 1, atom: 2 }
  items.sort((x, y) => y.z - x.z || rank[x.type] - rank[y.type] || x.index - y.index)
  return { circles, items }
}

const diamondStructure: SymbolDef = {
  id: 'diamondStructure',
  name: 'Diamond (giant covalent)',
  aliases: ['giant covalent', 'carbon structure', 'tetrahedral carbon', 'diamond lattice', 'diamond cluster'],
  label: 'diamond',
  pack: 'structures',
  size: { w: DIAMOND.size, h: DIAMOND.size },
  resize: 'uniform',
  min: { w: 120, h: 120 },
  params: [{ key: 'stubs', label: 'Stubs on outer atoms', type: 'boolean', default: false }],
  build({ h, p }) {
    const pic = diamondPicture(diamondModel(), h, bool(p.stubs, false))
    const prims: Prim[] = pic.items.map((it): Prim => {
      if (it.type === 'atom') {
        const { c, r } = pic.circles[it.index]
        return { d: circle(c.x, c.y, r), role: 'solid' }
      }
      return { d: lineD(it.p, it.q), role: it.type === 'bond' && !it.rear ? 'outline' : 'detail' }
    })
    return { prims }
  },
}

export const lattices: SymbolDef[] = [ionicLattice3D, diamondStructure]
