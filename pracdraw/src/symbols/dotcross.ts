// dotcross.ts — the dot-and-cross diagrams and the periodic table (release 1.2). The pack is `atoms`: the library shows these symbols with the atoms.
// This file is the second author's. The symbols are in the plan in spec/catalogue.json (priority C).
//
// Each symbol has a model that the file exports, and the drawing is made from the model: `covalentDiagram` for the covalent molecules (the atoms of
// molecules.ts laid out as circles, every electron a mark with its owner and its bond), `ionicDiagram` for the ionic compounds, `periodicTable`
// for the table. `dotcross.science.test.ts` tests the models against the science and then counts the marks in the geometry to see that the
// drawing agrees with them.

import { P, dist, f, type Pt } from '../kernel/geom'
import { bool, circle, str } from './kit'
import { bracketD, electronPrims, pairedPoints } from './electrons'
import { elementBySymbol, ionShells, ks4Group, type Element } from './elements'
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

/** Widths of the letters of Arial, in thousandths of the type size: A to Z, then a to z. The element symbols are set in Arial (rule S11). */
const ARIAL = [
  ...[667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611],
  ...[556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500],
]
/** The width of a word of letters set in Arial at `size` u (a letter that it does not know counts as an M). */
export const textWidth = (word: string, size: number): number =>
  ([...word].reduce((n, c) => n + (ARIAL[c >= 'A' && c <= 'Z' ? c.charCodeAt(0) - 65 : c >= 'a' && c <= 'z' ? 26 + c.charCodeAt(0) - 97 : 12] ?? 833), 0) *
    size) /
  1000
/** How far the corner of the box of an element symbol is from its centre, plus a little room: the smallest circle that holds the symbol. */
const symbolRadius = (symbol: string, size: number): number => Math.hypot(textWidth(symbol, size) / 2, size * 0.358) + 1.8

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
  if (merged.length === 1 && merged[0][1] - merged[0][0] >= 360) return circle(cx, cy, r) // nothing left of the line to leave: keep the circle
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
/** In an ionic diagram with the inner shells drawn the symbol sits in the innermost circle, so it is set smaller. */
export const INNER_SYMBOL_SIZE = 12
export const MARGIN = 8
/** The drawing is never made smaller than this against its natural size (the marks do not shrink), nor larger than the other limit. */
export const K_MIN = 0.85
export const K_MAX = 1.6
/** The same limits for the ionic diagrams. */
export const ION_K_MIN = 0.6
export const ION_K_MAX = 1.5
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

// ---------------------------------------------------------------- ionic: the model

/** The metals and the non-metals that the parameters offer, in the order of the catalogue row. */
export const METALS = ['Li', 'Na', 'K', 'Mg', 'Ca', 'Al']
export const NON_METALS = ['N', 'O', 'F', 'S', 'Cl', 'Br']
/** The ending that a non-metal gives to the name of its compound: sodium chloride, magnesium oxide. */
const ENDING: Record<string, string> = { N: 'nitride', O: 'oxide', F: 'fluoride', S: 'sulfide', Cl: 'chloride', Br: 'bromide' }

export interface IonicModel {
  metal: Element
  nonMetal: Element
  /** The charge of one metal ion (+1, +2 or +3: the group number) and of one non-metal ion (-1, -2 or -3: the group number less 8). */
  metalCharge: number
  nonMetalCharge: number
  /** How many of each ion make the compound: the smallest numbers that cancel the charges (MgCl2: 1 and 2; Na2O: 2 and 1; Al2O3: 2 and 3). */
  nMetal: number
  nNonMetal: number
  /** The electrons on the shells of one metal ion and of one non-metal ion. */
  metalShells: number[]
  nonMetalShells: number[]
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** The ions of a compound. A metal or non-metal that is not in the lists above gives sodium or chlorine, so nothing here throws. */
export function ionicModel(metal: string, nonMetal: string): IonicModel {
  const m = elementBySymbol(METALS.includes(metal) ? metal : 'Na')!,
    x = elementBySymbol(NON_METALS.includes(nonMetal) ? nonMetal : 'Cl')!
  const cm = ks4Group(m) ?? 1,
    cx = (ks4Group(x) ?? 7) - 8
  const l = (cm * -cx) / gcd(cm, -cx)
  return {
    metal: m,
    nonMetal: x,
    metalCharge: cm,
    nonMetalCharge: cx,
    nMetal: l / cm,
    nNonMetal: l / -cx,
    metalShells: ionShells(m, cm) ?? [...m.shells],
    nonMetalShells: ionShells(x, cx) ?? [...x.shells],
  }
}

/** The name of the compound: the metal, then the non-metal with its ending (sodium chloride). */
export const compoundName = (m: IonicModel): string => `${m.metal.name} ${ENDING[m.nonMetal.symbol] ?? `${m.nonMetal.name}ide`}`

/** The marks of the metal's electrons and of the non-metal's: [dots, crosses] by default, [crosses, dots] swapped, [dots, rings] for rings. */
function ionicKinds(choice: MarksChoice): [MarkKind, MarkKind] {
  return choice === 'swapped' ? ['cross', 'dot'] : choice === 'ring' ? ['dot', 'ring'] : ['dot', 'cross']
}

export type IonicStage = 'transfer' | 'ions'

export interface IonicIon {
  kind: 'metal' | 'nonMetal'
  symbol: string
  x: number
  y: number
  /** The radius of the outermost circle drawn. */
  r: number
  /** The radii of the plain circles of the inner shells, outermost first: empty unless `inner` is on. */
  inner: number[]
  /** The charge written beside the bracket (ions stage); 0 for an atom. */
  charge: number
  /** The electrons on each shell of what is drawn: the atom's shells (transfer stage) or the ion's (ions stage). */
  shells: number[]
  /** The square brackets round an ion (ions stage). */
  bracket: { x0: number; y0: number; x1: number; y1: number } | null
}

export interface IonicMark {
  x: number
  y: number
  mark: MarkKind
  /** The ion or atom whose circle the mark is on (an index into `ions`). */
  ion: number
  /** Whose electron it is: the metal's (its own, or one that has moved across) or the non-metal's. */
  from: 'metal' | 'nonMetal'
}

/** A curved arrow from an electron of a metal to a place that is empty on a non-metal (transfer stage). */
export interface IonicArrow {
  /** The index (into `marks`) of the electron that the arrow leaves, and the ions that it joins. */
  mark: number
  fromIon: number
  toIon: number
  /** The empty place on the non-metal that the arrow points at. */
  slot: Pt
  /** The shaft: a quadratic curve from `start` by `via` to `end`, and the head, a triangle with its point at `tip`. */
  start: Pt
  via: Pt
  end: Pt
  tip: Pt
}

export interface IonicDiagram {
  model: IonicModel
  stage: IonicStage
  inner: boolean
  /** The size of the element symbols: smaller when the inner shells are drawn. */
  symbolSize: number
  k: number
  ions: IonicIon[]
  marks: IonicMark[]
  arrows: IonicArrow[]
}

/** Sizes at natural scale, in u: the circle of the outer shell, the room between it and its bracket, and the gaps between neighbours. */
export const ION = { r: 30, pad: 8, gap: 34, gapIons: 28, gapAround: 40, rowGap: 30, rowGapIons: 6 }
/** The size of the charge (a superscript, so it is drawn 0.7 times as big) and how far its baseline lies below the top of the bracket. */
const CHARGE_SIZE = 18
const CHARGE_DY = 12.8
const ARROW = { head: 7, wing: 6, clear: 4.5 }

interface Cell {
  kind: 'metal' | 'nonMetal'
  col: number
  row: number
}

/**
 * Who stands where: the ions in one row, the two kinds alternating (X M X for MgCl2, M X M for Na2O, X M X M X for Al2O3: every metal beside the
 * non-metals that take its electrons), the kind that there is more of at both ends. One ion beside three others (AlCl3, Li3N) stands in the middle with
 * a partner on each side and one above.
 */
export function arrangement(nMetal: number, nNonMetal: number): Cell[] {
  if (Math.abs(nMetal - nNonMetal) <= 1) {
    const first: Cell['kind'] = nMetal >= nNonMetal ? 'metal' : 'nonMetal',
      n = nMetal + nNonMetal
    return Array.from({ length: n }, (_, i) => ({ kind: (i % 2 === 0) === (first === 'metal') ? 'metal' : 'nonMetal', col: i - (n - 1) / 2, row: 0 }))
  }
  const single: Cell['kind'] = nMetal === 1 ? 'metal' : 'nonMetal',
    other: Cell['kind'] = single === 'metal' ? 'nonMetal' : 'metal'
  const cells: Cell[] = [{ kind: single, col: 0, row: 0 }]
  const places: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
  ]
  for (let i = 0; i < Math.max(nMetal, nNonMetal); i++) cells.push({ kind: other, col: (places[i] ?? [i, -1])[0], row: (places[i] ?? [i, -1])[1] })
  return cells
}

/** The width of a charge written as a superscript, for the room that it needs on the right of its bracket. */
const chargeWidth = (c: number): number => (Math.abs(c) > 1 ? 2 : 1) * 0.58 * CHARGE_SIZE * 0.7

/** The text of a charge in label markup: `^{2+}`, `^{-}` (the hyphen becomes a minus sign). */
export const chargeText = (c: number): string => `^{${Math.abs(c) > 1 ? Math.abs(c) : ''}${c > 0 ? '+' : '-'}}`

/** Which of the four places on a ring of 8 (right, below, left, above) holds each incoming electron, and in which of the place's two slots: slot = 2 * place + side. */
function assignSlots(directions: number[]): number[] {
  const free = [2, 2, 2, 2],
    taken = new Set<number>()
  return directions.map((d) => {
    const deg = ((d % 360) + 360) % 360
    let best = 0,
      bestAway = Infinity
    for (let q = 0; q < 4; q++) {
      if (!free[q]) continue
      const away = Math.abs(((deg - 90 * q + 540) % 360) - 180)
      if (away < bestAway - 1e-9) {
        best = q
        bestAway = away
      }
    }
    free[best]--
    // Of the two slots of the place, the one on the side that the electron comes from.
    const side = ((deg - 90 * best + 540) % 360) - 180 < 0 ? 0 : 1
    const slot = taken.has(2 * best + side) ? 2 * best + 1 - side : 2 * best + side
    taken.add(slot)
    return slot
  })
}

/**
 * The shaft and the head of an arrow from `a` (an electron) to `b` (an empty place), leaving a little room at both ends. The curve bulges to the side where
 * it stays clearer of the circles (upwards when both sides are as clear).
 */
function arrowOf(a: Pt, b: Pt, circles: { x: number; y: number; r: number }[]): Pick<IonicArrow, 'start' | 'via' | 'end' | 'tip'> {
  const u = unit(a, b)
  const start = P(a.x + u.x * ARROW.clear, a.y + u.y * ARROW.clear),
    tip = P(b.x - u.x * ARROW.clear, b.y - u.y * ARROW.clear)
  const len = dist(start, tip)
  let n = P(u.y, -u.x)
  if (n.y > 1e-9 || (Math.abs(n.y) <= 1e-9 && n.x < 0)) n = P(-n.x, -n.y) // the upward side
  const via = (side: number) => P((start.x + tip.x) / 2 + n.x * len * 0.5 * side, (start.y + tip.y) / 2 + n.y * len * 0.5 * side)
  // How near the middle of the curve comes to a circle line, for a bulge to each side.
  const clearance = (side: number): number => {
    const c = via(side)
    let least = Infinity
    for (let i = 3; i <= 9; i++) {
      const t = i / 12,
        w = 1 - t
      const p = P(w * w * start.x + 2 * w * t * c.x + t * t * tip.x, w * w * start.y + 2 * w * t * c.y + t * t * tip.y)
      for (const k of circles) least = Math.min(least, Math.abs(dist(p, k) - k.r))
    }
    return least
  }
  const v = clearance(-1) > clearance(1) + 1 ? via(-1) : via(1)
  const dir = unit(v, tip)
  return { start, via: v, tip, end: P(tip.x - dir.x * (ARROW.head - 1.5), tip.y - dir.y * (ARROW.head - 1.5)) }
}

/**
 * The model of an ionic dot-and-cross diagram in a box `w` by `h`. Stage 'transfer': each atom as a circle for its outer shell, the metal's outer electrons
 * as the first mark and the non-metal's as the second, and a curved arrow from each metal electron to an empty place on a non-metal. Stage 'ions': each ion in
 * square brackets with its charge; the metal ion has no outer electrons, the non-metal ion a full outer shell of both marks (its own and the metal's). The
 * ratio of ions follows the charges. `inner` adds the inner shells as plain circles. Nothing here throws.
 */
export function ionicDiagram(metal: string, nonMetal: string, stage: string, inner: boolean, marks: string, w: number, h: number): IonicDiagram {
  const model = ionicModel(metal, nonMetal)
  const st: IonicStage = stage === 'transfer' ? 'transfer' : 'ions'
  const [metalMark, nonMetalMark] = ionicKinds(marksChoice(marks))
  const cells = arrangement(model.nMetal, model.nNonMetal)
  const bracketed = st === 'ions',
    pad = bracketed ? ION.pad : 0
  const symbolSize = inner ? INNER_SYMBOL_SIZE : SYMBOL_SIZE
  // One ion with three others round it (AlCl3, Li3N) has room to spare across and none to spare up, so its brackets are further apart across.
  const gapAcross = bracketed ? (cells.some((c) => c.row === -1) ? ION.gapAround : ION.gapIons) : ION.gap

  // 1. Natural positions: a cell is a circle (and its bracket), and the cells are a gap apart.
  const pitchX = 2 * (ION.r + pad) + gapAcross,
    pitchY = 2 * (ION.r + pad) + (bracketed ? ION.rowGapIons : ION.rowGap)
  const at = cells.map((c) => P(c.col * pitchX, c.row * pitchY))
  const charge = (c: Cell) => (bracketed ? (c.kind === 'metal' ? model.metalCharge : model.nonMetalCharge) : 0)
  const box = cells.map((c, i) => ({
    x0: at[i].x - ION.r - pad,
    x1: at[i].x + ION.r + pad + (bracketed ? 3 + chargeWidth(charge(c)) : 0),
    y0: at[i].y - ION.r - pad - (bracketed ? 3 : 0),
    y1: at[i].y + ION.r + pad,
  }))
  const x0 = Math.min(...box.map((b) => b.x0)),
    x1 = Math.max(...box.map((b) => b.x1)),
    y0 = Math.min(...box.map((b) => b.y0)),
    y1 = Math.max(...box.map((b) => b.y1))

  // 2. The scale that fits the box, the cells centred in it.
  const fit = Math.min((w - 2 * MARGIN) / (x1 - x0), (h - 2 * MARGIN) / (y1 - y0))
  const k = Math.max(ION_K_MIN, Math.min(ION_K_MAX, Number.isFinite(fit) ? fit : 1))
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2
  const R = ION.r * k,
    padK = bracketed ? Math.max(ION.pad * k, 6.5) : 0
  const place = at.map((p) => P((p.x - cx) * k, h / 2 + (p.y - cy) * k))

  // 3. The circles. Inner shells are plain circles, a shell apart; an ion drops the shell that it has lost.
  const atomShells = (c: Cell) => (c.kind === 'metal' ? model.metal.shells : model.nonMetal.shells)
  const nInnerMax = Math.max(1, ...cells.map((c) => atomShells(c).length - 1))
  const innerMin = Math.max(symbolRadius(model.metal.symbol, symbolSize), symbolRadius(model.nonMetal.symbol, symbolSize))
  const step = inner ? Math.max(4, Math.min(9 * k, (R - innerMin) / nInnerMax)) : 0
  const ions: IonicIon[] = cells.map((c, i) => {
    const atom = atomShells(c),
      ionShellsOf = c.kind === 'metal' ? model.metalShells : model.nonMetalShells
    // The metal ion has lost its outer shell: with the inner shells shown, its circles are the ones inside.
    const lost = bracketed && c.kind === 'metal' && inner ? 1 : 0
    const nCircles = inner ? atom.length - lost : 1
    const radii = Array.from({ length: nCircles }, (_, j) => R - step * (j + lost))
    return {
      kind: c.kind,
      symbol: (c.kind === 'metal' ? model.metal : model.nonMetal).symbol,
      x: place[i].x,
      y: place[i].y,
      r: radii[0],
      inner: radii.slice(1),
      charge: charge(c),
      shells: bracketed ? [...ionShellsOf] : [...atom],
      bracket: bracketed ? { x0: place[i].x - R - padK, x1: place[i].x + R + padK, y0: place[i].y - R - padK, y1: place[i].y + R + padK } : null,
    }
  })

  // 4. Which electron goes where. The electrons of the metals, left to right, against the empty places of the non-metals, left to right: so each metal
  //    gives to the non-metals beside it. Round a single ion, each partner gives or takes one.
  const metals = ions.map((_, i) => i).filter((i) => ions[i].kind === 'metal'),
    nonMetals = ions.map((_, i) => i).filter((i) => ions[i].kind === 'nonMetal')
  const byPlace = (a: number, b: number) => (cells[a].row === -1 ? 2 : cells[a].col > 0 ? 1 : 0) - (cells[b].row === -1 ? 2 : cells[b].col > 0 ? 1 : 0)
  const byX = (a: number, b: number) => ions[a].x - ions[b].x
  const give = model.metalCharge,
    take = -model.nonMetalCharge
  const around = cells.some((c) => c.row === -1)
  const electrons = (around && metals.length > 1 ? [...metals].sort(byPlace) : [...metals].sort(byX)).flatMap((i) => Array<number>(give).fill(i))
  const spaces = (around && nonMetals.length > 1 ? [...nonMetals].sort(byPlace) : [...nonMetals].sort(byX)).flatMap((j) => Array<number>(take).fill(j))
  const flows = electrons.slice(0, spaces.length).map((i, e) => ({ metal: i, nonMetal: spaces[e] }))

  // 5. Marks. A non-metal has eight places in four pairs: the empty ones face the metals that give to it, the rest hold its own electrons.
  const out: IonicMark[] = []
  const slotAt = (ion: IonicIon, slot: number): Pt => pairedPoints(ion.x, ion.y, ion.r, 2, PAIR, 90 * Math.floor(slot / 2))[slot % 2]
  const target = new Map<number, Pt>() // flow -> the empty place that it fills
  for (const n of nonMetals) {
    const mine = flows.map((fl, e) => (fl.nonMetal === n ? e : -1)).filter((e) => e >= 0)
    const slots = assignSlots(mine.map((e) => angleOf(ions[n], ions[flows[e].metal])))
    mine.forEach((e, t) => target.set(e, slotAt(ions[n], slots[t])))
    for (let s = 0; s < 8; s++) {
      const p = slotAt(ions[n], s)
      if (!slots.includes(s)) out.push({ x: p.x, y: p.y, mark: nonMetalMark, ion: n, from: 'nonMetal' })
      else if (bracketed) out.push({ x: p.x, y: p.y, mark: metalMark, ion: n, from: 'metal' })
    }
  }
  // The metal's electrons sit on its circle (transfer stage only), a pair or a single facing the non-metal that takes them.
  const start = new Map<number, number>() // flow -> the mark that the electron is
  if (!bracketed) {
    for (const m of metals) {
      const goes = [...new Set(flows.filter((fl) => fl.metal === m).map((fl) => fl.nonMetal))]
      for (const n of goes) {
        const group = flows.map((fl, e) => (fl.metal === m && fl.nonMetal === n ? e : -1)).filter((e) => e >= 0)
        const theta = angleOf(ions[m], ions[n])
        const ring = (count: number, deg: number) => pairedPoints(ions[m].x, ions[m].y, ions[m].r, count, PAIR, deg)
        const pts =
          group.length === 1 ? ring(1, theta) : group.length === 2 ? ring(2, theta) : [...ring(2, theta), ...ring(1, theta + 40)].slice(0, group.length)
        // Match the electrons to the empty places in the same order across the line between the two circles, so that the arrows do not cross.
        const axis = unit(ions[m], ions[n]),
          across = (p: Pt) => (p.x - ions[m].x) * -axis.y + (p.y - ions[m].y) * axis.x
        const ends = group.map((e) => ({ e, p: target.get(e)! })).sort((a, b) => across(a.p) - across(b.p))
        pts.sort((a, b) => across(a) - across(b))
        pts.forEach((p, t) => {
          start.set(ends[t].e, out.length)
          out.push({ x: p.x, y: p.y, mark: metalMark, ion: m, from: 'metal' })
        })
      }
    }
  }
  const arrows: IonicArrow[] = []
  if (!bracketed)
    flows.forEach((fl, e) => {
      const mark = start.get(e)!,
        slot = target.get(e)!
      arrows.push({ mark, fromIon: fl.metal, toIon: fl.nonMetal, slot, ...arrowOf(out[mark], slot, ions) })
    })
  return { model, stage: st, inner, symbolSize, k, ions, marks: out, arrows }
}

/** The geometry of an ionic diagram: inner circles, outer circles (a gap in the line at each electron), brackets, marks, arrows, symbols and charges. */
function ionicGeometry(d: IonicDiagram) {
  const prims: Prim[] = []
  const inner = d.ions.flatMap((ion) => ion.inner.map((r) => circle(ion.x, ion.y, r))).join('')
  if (inner) prims.push({ d: inner, role: 'detail' })
  d.ions.forEach((ion, i) => {
    const cuts: [number, number][] = d.marks
      .filter((q) => q.ion === i)
      .map((q) => {
        const t = angleOf(ion, q),
          half = (GAP / ion.r) * (180 / Math.PI)
        return [t - half, t + half]
      })
    prims.push({ d: circleWithGaps(ion.x, ion.y, ion.r, cuts), role: 'outline' })
  })
  for (const ion of d.ions)
    if (ion.bracket)
      prims.push({
        d: bracketD(ion.bracket.x0, ion.bracket.y0, ion.bracket.x1, ion.bracket.y1, Math.min(7, (ion.bracket.x1 - ion.bracket.x0) / 4)),
        role: 'outline',
      })
  prims.push(...markPrims(d.marks))
  if (d.arrows.length) {
    prims.push({ d: d.arrows.map((a) => `M${f(a.start.x)} ${f(a.start.y)}Q${f(a.via.x)} ${f(a.via.y)} ${f(a.end.x)} ${f(a.end.y)}`).join(''), role: 'detail' })
    prims.push({
      d: d.arrows
        .map((a) => {
          const dir = unit(a.via, a.tip),
            base = P(a.tip.x - dir.x * ARROW.head, a.tip.y - dir.y * ARROW.head)
          return `M${f(a.tip.x)} ${f(a.tip.y)}L${f(base.x - dir.y * (ARROW.wing / 2))} ${f(base.y + dir.x * (ARROW.wing / 2))}L${f(base.x + dir.y * (ARROW.wing / 2))} ${f(base.y - dir.x * (ARROW.wing / 2))}Z`
        })
        .join(''),
      role: 'ink',
    })
  }
  const texts: SymbolText[] = d.ions.map((ion) => ({ x: ion.x, y: ion.y + d.symbolSize * 0.36, text: ion.symbol, size: d.symbolSize, anchor: 'middle' }))
  for (const ion of d.ions)
    if (ion.bracket) texts.push({ x: ion.bracket.x1 + 3, y: ion.bracket.y0 + CHARGE_DY, text: chargeText(ion.charge), size: CHARGE_SIZE, anchor: 'start' })
  return { prims, texts }
}

/** "Sodium (Na)": the name of an element and its symbol, for the lists in the inspector. */
const elementLabel = (symbol: string): string => {
  const e = elementBySymbol(symbol)!
  return `${e.name.charAt(0).toUpperCase()}${e.name.slice(1)} (${symbol})`
}

const ionicDotCross: SymbolDef = {
  id: 'ionicDotCross',
  name: 'Ionic dot-and-cross diagram',
  aliases: ['dot and cross', 'ionic bonding diagram', 'dot-and-cross ionic', 'ionic compound'],
  label: (p) => compoundName(ionicModel(str(p.metal, 'Na'), str(p.nonMetal, 'Cl'))),
  pack: 'atoms',
  size: { w: 420, h: 150 },
  resize: 'free',
  min: { w: 404, h: 140 },
  params: [
    { key: 'metal', label: 'Metal', type: 'choice', default: 'Na', options: METALS.map((s) => ({ value: s, label: elementLabel(s) })) },
    { key: 'nonMetal', label: 'Non-metal', type: 'choice', default: 'Cl', options: NON_METALS.map((s) => ({ value: s, label: elementLabel(s) })) },
    {
      key: 'stage',
      label: 'Stage',
      type: 'choice',
      default: 'ions',
      options: [
        { value: 'transfer', label: 'Electron transfer' },
        { value: 'ions', label: 'Ions' },
      ],
    },
    { key: 'inner', label: 'Inner shells', type: 'boolean', default: false },
    {
      key: 'marks',
      label: 'Marks',
      type: 'choice',
      default: 'default',
      options: [
        { value: 'default', label: 'Metal dots, non-metal crosses' },
        { value: 'swapped', label: 'Metal crosses, non-metal dots' },
        { value: 'ring', label: 'Metal dots, non-metal rings' },
      ],
    },
  ],
  build({ w, h, p }) {
    return ionicGeometry(ionicDiagram(str(p.metal, 'Na'), str(p.nonMetal, 'Cl'), str(p.stage, 'ions'), bool(p.inner, false), str(p.marks, 'default'), w, h))
  },
}

export const dotcross: SymbolDef[] = [covalentDotCross, ionicDotCross]
