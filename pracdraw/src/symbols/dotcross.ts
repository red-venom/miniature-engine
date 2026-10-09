// dotcross.ts — the dot-and-cross diagrams and the periodic table (release 1.2). The pack is `atoms`: the library shows these symbols with the atoms.
// This file is the second author's. The symbols are in the plan in spec/catalogue.json (priority C).
//
// Each symbol has a model that the file exports, and the drawing is made from the model: `covalentDiagram` for the covalent molecules (the atoms of
// molecules.ts laid out as circles, every electron a mark with its owner and its bond), `ionicDiagram` for the ionic compounds, `periodicTable`
// for the table. `dotcross.science.test.ts` tests the models against the science and then counts the marks in the geometry to see that the
// drawing agrees with them.

import { P, dist, f, type Pt } from '../kernel/geom'
import { circle, str } from './kit'
import { electronPrims, pairedPoints } from './electrons'
import { MOLECULES, molecule, type Molecule } from './molecules'
import type { Prim, SymbolDef, SymbolText } from './types'

// ---------------------------------------------------------------- marks

/** The three marks of an electron: a solid dot, a cross, and a small open ring (the third pair, for a teacher who wants no crosses). */
export type MarkKind = 'dot' | 'cross' | 'ring'
/** The `marks` parameter. Always black (decision 4), so that one picture serves slides and photocopies. */
export type MarksChoice = 'default' | 'swapped' | 'ring'

/** Radius of the circle of an open ring: its outside is as wide as a dot (rule S2: a detail line, 1.25 u, so the centre line of the ring is 0.6 u in). */
const RING_R = 2.2

/** The prims of a list of marks, back to front: dots (ink), then crosses and rings (detail). Nothing for no marks. */
function markPrims(marks: readonly { x: number; y: number; mark: MarkKind }[]): Prim[] {
  const of = (kind: MarkKind) => marks.filter((m) => m.mark === kind).map((m) => P(m.x, m.y))
  const rings = of('ring')
  return [
    ...electronPrims(of('dot'), 'dot'),
    ...electronPrims(of('cross'), 'cross'),
    ...(rings.length ? [{ d: rings.map((q) => circle(q.x, q.y, RING_R)).join(''), role: 'detail' as const }] : []),
  ]
}

/** `choice` of the `marks` parameter, or the default for anything else (a file from a newer version). */
const marksChoice = (v: string): MarksChoice => (v === 'swapped' || v === 'ring' ? v : 'default')

/** The mark of the first kind of atom and of the second kind: [crosses, dots] by default, [dots, crosses] swapped, [rings, dots] for rings. */
function covalentKinds(choice: MarksChoice): [MarkKind, MarkKind] {
  return choice === 'swapped' ? ['dot', 'cross'] : choice === 'ring' ? ['ring', 'dot'] : ['cross', 'dot']
}

/** The angle (degrees, clockwise from +x on the screen) of a point seen from a centre. */
const angleOf = (c: { x: number; y: number }, q: { x: number; y: number }): number => (Math.atan2(q.y - c.y, q.x - c.x) * 180) / Math.PI
const unit = (a: Pt, b: Pt): Pt => {
  const d = dist(a, b) || 1
  return P((b.x - a.x) / d, (b.y - a.y) / d)
}

/** A circle drawn as arcs, leaving out the angular intervals of `cuts` (degrees, `[from, to]`, clockwise from +x). No cuts: the whole circle. */
function circleWithGaps(cx: number, cy: number, r: number, cuts: [number, number][]): string {
  if (!cuts.length) return circle(cx, cy, r)
  const sorted = cuts
    .map(([a, b]): [number, number] => {
      const lo = ((a % 360) + 360) % 360
      return [lo, lo + (b - a)]
    })
    .sort((p, q) => p[0] - q[0])
  const merged: [number, number][] = []
  for (const c of sorted) {
    const last = merged[merged.length - 1]
    if (last && c[0] <= last[1]) last[1] = Math.max(last[1], c[1])
    else merged.push([c[0], c[1]])
  }
  // The last cut may run past 360 degrees into the first.
  while (merged.length > 1 && merged[merged.length - 1][1] - 360 >= merged[0][0]) {
    const last = merged.pop()!
    merged[0] = [Math.min(merged[0][0], last[0] - 360), Math.max(merged[0][1], last[1] - 360)]
  }
  if (merged.length === 1 && merged[0][1] - merged[0][0] >= 360) return ''
  const at = (deg: number) => `${f(cx + r * Math.cos((deg * Math.PI) / 180))} ${f(cy + r * Math.sin((deg * Math.PI) / 180))}`
  let d = ''
  merged.forEach((cut, i) => {
    const from = cut[1],
      to = i + 1 < merged.length ? merged[i + 1][0] : merged[0][0] + 360
    if (to - from > 0.01) d += `M${at(from)}A${f(r)} ${f(r)} 0 ${to - from > 180 ? 1 : 0} 1 ${at(to)}`
  })
  return d
}

// ---------------------------------------------------------------- covalent: the model

export type CovalentLayout = 'overlap' | 'apart'

export interface CovalentAtom {
  x: number
  y: number
  /** The radius of the circle that stands for the outer shell. */
  r: number
  symbol: string
  /** The mark that this atom's own electrons are drawn with. */
  mark: MarkKind
}

export interface CovalentMark {
  x: number
  y: number
  mark: MarkKind
  /** The atom whose electron this is (an index into the molecule's atoms). */
  atom: number
  /** The bond whose shared pair this electron belongs to (an index into the molecule's bonds), or null for an electron of a lone pair. */
  bond: number | null
}

export interface CovalentDiagram {
  molecule: Molecule
  layout: CovalentLayout
  /** The size of the drawing against its natural size: the circles and the distances between them scale, the marks and the text do not. */
  k: number
  atoms: CovalentAtom[]
  marks: CovalentMark[]
}

/**
 * The size of a diagram at its natural scale, in u. `atom` and `hydrogen` are the radii of the circle of the outer shell (hydrogen has one shell of 2, so
 * its circle is smaller). `lens` is, by the order of the bond, the width of the overlap of two bonded circles or, circles apart, of the gap between them:
 * wide enough for the marks of the shared pairs with room to spare, and (overlapping) narrow enough to leave the element symbol clear of the other circle.
 */
export interface Metrics {
  atom: number
  hydrogen: number
  lens: number[]
}
export const METRICS: Record<CovalentLayout, Metrics> = {
  overlap: { atom: 33, hydrogen: 23, lens: [0, 14, 22, 24] },
  apart: { atom: 24, hydrogen: 17, lens: [0, 13, 20, 22] },
}
/** Distance between the two marks of a pair, and between the rows of a multiple bond. A dot is 5.2 u wide and a cross 5.4 u. */
export const PAIR = 8
/** Size of the element symbol in the centre of a circle, and the room that the drawing leaves round its edge. */
export const SYMBOL_SIZE = 15
export const MARGIN = 8
/** The drawing is never made smaller than this against its natural size (the marks do not shrink), nor larger than the other limit. */
export const K_MIN = 0.85
export const K_MAX = 1.6
/** How far along a circle a gap in its line reaches beyond the centre of a lone-pair mark, in u. */
export const GAP = 6

/**
 * Where each atom sits, as the angle (degrees, clockwise from +x on the screen: 0 is right, 90 is down) of the atom as seen from the atom it is bonded to
 * on the way from the centre. The entry for the centre itself is not used. A dot-and-cross diagram shows no shape, so water is bent (104°) only because a
 * bent picture does not say that it is straight, and ammonia has its lone pair on top.
 */
const ANGLES: Record<string, number[]> = {
  H2: [0, 0],
  Cl2: [0, 0],
  O2: [0, 0],
  N2: [0, 0],
  HCl: [0, 0],
  H2O: [0, 142, 38],
  NH3: [0, 180, 90, 0],
  CH4: [0, -90, 0, 90, 180],
  CO2: [0, 180, 0],
  HF: [0, 0],
  F2: [0, 0],
  C2H4: [0, 0, -120, 120, -60, 60],
  C2H6: [0, 0, 180, -105, 105, 0, -75, 75],
}

interface Tree {
  /** The atom each atom hangs from on the way from the centre, -1 for the centre (and for an atom that cannot be reached). */
  parent: number[]
  /** Bonds from the centre: 0 for the centre. */
  depth: number[]
}

function treeOf(m: Molecule): Tree {
  const parent = m.atoms.map(() => -1),
    depth = m.atoms.map(() => 0)
  const seen = new Set([m.centre]),
    queue = [m.centre]
  for (let q = 0; q < queue.length; q++) {
    const a = queue[q]
    for (const b of m.atoms[a].bonded) {
      if (seen.has(b)) continue
      seen.add(b)
      parent[b] = a
      depth[b] = depth[a] + 1
      queue.push(b)
    }
  }
  return { parent, depth }
}

/** The angle of each atom from its parent: the table above, or (for a molecule that it does not list) the children of an atom spread evenly. */
function anglesOf(m: Molecule, tree: Tree): number[] {
  const given = ANGLES[m.id]
  if (given && given.length === m.atoms.length) return given
  const out = m.atoms.map(() => 0)
  const done = new Map<number, number>()
  for (let a = 0; a < m.atoms.length; a++) {
    const p = tree.parent[a]
    if (p < 0) continue
    const kids = m.atoms.map((_, i) => i).filter((i) => tree.parent[i] === p)
    const j = done.get(p) ?? 0
    done.set(p, j + 1)
    const back = tree.parent[p] < 0 ? 0 : out[p] + 180
    out[a] = tree.parent[p] < 0 ? (360 * j) / kids.length : back + (360 * (j + 1)) / (kids.length + 1)
  }
  return out
}

const radiusOf = (z: number, layout: CovalentLayout): number => (z === 1 ? METRICS[layout].hydrogen : METRICS[layout].atom)
const orderOf = (m: Molecule, a: number, b: number): number => m.bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))?.order ?? 1
const lens = (order: number, layout: CovalentLayout): number => METRICS[layout].lens[Math.max(1, Math.min(3, Math.round(order)))]

/** Distance between the centres of two bonded circles at natural size: the circles overlap by `lens(order)` or, apart, are `lens(order)` apart. */
function bondLength(ra: number, rb: number, order: number, layout: CovalentLayout): number {
  return layout === 'apart' ? ra + rb + lens(order, layout) : ra + rb - lens(order, layout)
}

/**
 * Where the lone pairs of atom `a` go, as angles on its circle: the pairs are spread evenly over the widest free arc, the arc that the circles of its bonded
 * atoms do not cover (the arc a bonded circle covers is found from the overlapping layout, whatever the layout, so that both layouts put the pairs in the same
 * places). Water has its two pairs above the hydrogens, ammonia its pair on top, chlorine three pairs round the side away from the other atom.
 */
function lonePairAngles(m: Molecule, a: number, dirs: Map<string, number>): number[] {
  const n = m.atoms[a].lonePairs
  if (n <= 0) return []
  const ra = radiusOf(m.atoms[a].element.z, 'overlap')
  const sectors = m.atoms[a].bonded.map((b) => {
    const rb = radiusOf(m.atoms[b].element.z, 'overlap'),
      d = bondLength(ra, rb, orderOf(m, a, b), 'overlap')
    const half = (Math.acos(Math.max(-1, Math.min(1, (d * d + ra * ra - rb * rb) / (2 * d * ra)))) * 180) / Math.PI
    return { centre: (((dirs.get(`${a}>${b}`) ?? 0) % 360) + 360) % 360, half }
  })
  sectors.sort((p, q) => p.centre - q.centre)
  let start = -90,
    len = 360
  if (sectors.length) {
    len = -1
    sectors.forEach((s, i) => {
      const next = sectors[(i + 1) % sectors.length]
      const from = s.centre + s.half,
        to = (i + 1 < sectors.length ? next.centre : next.centre + 360) - next.half
      if (to - from > len) {
        len = to - from
        start = from
      }
    })
  }
  return Array.from({ length: n }, (_, i) => start + ((i + 0.5) * Math.max(len, 0)) / n)
}

/**
 * The model of a covalent dot-and-cross diagram in a box `w` by `h`: the circles, and every electron as a mark that knows its owner and its bond.
 * Layout 'overlap': a circle for the outer shell of each atom, overlapping where atoms are bonded, the shared pairs in the overlap, the lone pairs on
 * the circle. Layout 'apart': the circles apart, the shared pairs between them. A molecule that is not in the library draws water, and a size that is
 * too small or too large draws the nearest drawing that works: nothing here throws.
 */
export function covalentDiagram(id: string, layout: string, marks: string, w: number, h: number): CovalentDiagram {
  const m = molecule(id) ?? molecule('H2O')!
  const lay: CovalentLayout = layout === 'apart' ? 'apart' : 'overlap'
  const [first, second] = covalentKinds(marksChoice(marks))
  const tree = treeOf(m),
    angle = anglesOf(m, tree)
  const kind = (a: number): MarkKind => (tree.depth[a] % 2 === 0 ? first : second)

  // 1. The circles at natural size, with the centre of the molecule at the origin.
  const rad = m.atoms.map((a) => radiusOf(a.element.z, lay))
  const pos: Pt[] = m.atoms.map(() => P(0, 0))
  const dirs = new Map<string, number>() // the direction from one atom to a bonded atom, "from>to"
  const queue = [m.centre]
  for (let q = 0; q < queue.length; q++) {
    const a = queue[q]
    for (const b of m.atoms[a].bonded) {
      if (tree.parent[b] !== a) continue
      const d = bondLength(rad[a], rad[b], orderOf(m, a, b), lay),
        t = (angle[b] * Math.PI) / 180
      pos[b] = P(pos[a].x + d * Math.cos(t), pos[a].y + d * Math.sin(t))
      dirs.set(`${a}>${b}`, angle[b])
      dirs.set(`${b}>${a}`, angle[b] + 180)
      queue.push(b)
    }
  }
  const x0 = Math.min(...pos.map((p, i) => p.x - rad[i])),
    x1 = Math.max(...pos.map((p, i) => p.x + rad[i])),
    y0 = Math.min(...pos.map((p, i) => p.y - rad[i])),
    y1 = Math.max(...pos.map((p, i) => p.y + rad[i]))

  // 2. The scale that fits the box, and the circles centred in it (the box has its centre at x = 0, y = h / 2).
  const fit = Math.min((w - 2 * MARGIN) / (x1 - x0), (h - 2 * MARGIN) / (y1 - y0))
  const k = Math.max(K_MIN, Math.min(K_MAX, Number.isFinite(fit) ? fit : 1))
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2
  const atoms: CovalentAtom[] = m.atoms.map((a, i) => ({
    x: (pos[i].x - cx) * k,
    y: h / 2 + (pos[i].y - cy) * k,
    r: rad[i] * k,
    symbol: a.element.symbol,
    mark: kind(i),
  }))

  // 3. The lone pairs, on the circle of their atom.
  const out: CovalentMark[] = []
  m.atoms.forEach((_, a) => {
    for (const deg of lonePairAngles(m, a, dirs))
      for (const q of pairedPoints(atoms[a].x, atoms[a].y, atoms[a].r, 2, PAIR, deg)) out.push({ x: q.x, y: q.y, mark: kind(a), atom: a, bond: null })
  })

  // 4. The shared pairs, in the overlap or in the gap: the two circles meet (or part) over a strip whose middle is the middle of the pair of marks.
  m.bonds.forEach((bond, bi) => {
    const [a, b] = tree.parent[bond.b] === bond.a ? [bond.a, bond.b] : [bond.b, bond.a] // a is nearer the centre
    const ra = atoms[a].r,
      rb = atoms[b].r,
      d = dist(atoms[a], atoms[b])
    const u = unit(atoms[a], atoms[b]),
      mid = P(atoms[a].x + (u.x * (ra + d - rb)) / 2, atoms[a].y + (u.y * (ra + d - rb)) / 2)
    // The marks are laid out across the bond; the side that is "up" (or, for a vertical bond, "right") is the same in every bond.
    let across = P(-u.y, u.x)
    if (across.y > 1e-9 || (Math.abs(across.y) <= 1e-9 && across.x < 0)) across = P(-across.x, -across.y)
    if (bond.order === 1) {
      // One pair, one mark above the other: the narrowest strip that holds it, so that the small circle of hydrogen keeps room for its symbol.
      out.push({ x: mid.x + (across.x * PAIR) / 2, y: mid.y + (across.y * PAIR) / 2, mark: kind(a), atom: a, bond: bi })
      out.push({ x: mid.x - (across.x * PAIR) / 2, y: mid.y - (across.y * PAIR) / 2, mark: kind(b), atom: b, bond: bi })
    } else {
      // Two or three pairs: a row for each pair, the mark of the atom on its own side, the rows one above the other.
      for (let j = 0; j < bond.order; j++) {
        const off = (j - (bond.order - 1) / 2) * PAIR
        out.push({ x: mid.x - (u.x * PAIR) / 2 + across.x * off, y: mid.y - (u.y * PAIR) / 2 + across.y * off, mark: kind(a), atom: a, bond: bi })
        out.push({ x: mid.x + (u.x * PAIR) / 2 + across.x * off, y: mid.y + (u.y * PAIR) / 2 + across.y * off, mark: kind(b), atom: b, bond: bi })
      }
    }
  })
  return { molecule: m, layout: lay, k, atoms, marks: out }
}

/** The geometry of a covalent diagram: the circles (a gap in the line where a lone pair sits), the marks and the element symbols. */
function covalentGeometry(d: CovalentDiagram) {
  const prims: Prim[] = []
  d.atoms.forEach((a, i) => {
    const cuts: [number, number][] = d.marks
      .filter((q) => q.atom === i && q.bond === null)
      .map((q) => {
        const t = angleOf(a, q),
          half = (GAP / a.r) * (180 / Math.PI)
        return [t - half, t + half]
      })
    prims.push({ d: circleWithGaps(a.x, a.y, a.r, cuts), role: 'outline' })
  })
  prims.push(...markPrims(d.marks))
  const texts: SymbolText[] = d.atoms.map((a) => ({ x: a.x, y: a.y + SYMBOL_SIZE * 0.36, text: a.symbol, size: SYMBOL_SIZE, anchor: 'middle' }))
  return { prims, texts }
}

/** "Hydrogen (H₂)": the name of a molecule and its formula with subscript digits, for the list in the inspector. */
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const optionLabel = (m: Molecule): string => `${m.name.charAt(0).toUpperCase()}${m.name.slice(1)} (${m.id.replace(/\d/g, (c) => SUB[Number(c)])})`

const covalentDotCross: SymbolDef = {
  id: 'covalentDotCross',
  name: 'Covalent dot-and-cross diagram',
  aliases: ['dot and cross', 'covalent bonding diagram', 'dot-and-cross covalent', 'molecule'],
  label: (p) => (molecule(str(p.molecule, 'H2O')) ?? molecule('H2O')!).name,
  pack: 'atoms',
  size: { w: 220, h: 160 },
  resize: 'free',
  min: { w: 196, h: 144 },
  params: [
    { key: 'molecule', label: 'Molecule', type: 'choice', default: 'H2O', options: MOLECULES.map((m) => ({ value: m.id, label: optionLabel(m) })) },
    {
      key: 'layout',
      label: 'Layout',
      type: 'choice',
      default: 'overlap',
      options: [
        { value: 'overlap', label: 'Overlapping circles' },
        { value: 'apart', label: 'Circles apart' },
      ],
    },
    {
      key: 'marks',
      label: 'Marks',
      type: 'choice',
      default: 'default',
      options: [
        { value: 'default', label: 'Crosses and dots' },
        { value: 'swapped', label: 'Dots and crosses' },
        { value: 'ring', label: 'Rings and dots' },
      ],
    },
  ],
  build({ w, h, p }) {
    return covalentGeometry(covalentDiagram(str(p.molecule, 'H2O'), str(p.layout, 'overlap'), str(p.marks, 'default'), w, h))
  },
}

export const dotcross: SymbolDef[] = [covalentDotCross]
