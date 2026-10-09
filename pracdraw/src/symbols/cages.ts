// cages.ts — the carbon layers and cages of the structures pack: graphite and C60 (release 1.2, pilot pictures).
// Graphite is drawn in the oblique projection of rule S14 (oblique.ts); C60 is an orthographic view of a ball. Add each symbol here when it is built.
//
// Each picture has a pure model (exported, and tested in cages.science.test.ts) and a drawing that reads only the model:
// the atoms with their 3D positions, the bonds with their two ends, and, for the ball, the faces. The drawing never invents a part.

import { P, bounds, dist, f, type Pt } from '../kernel/geom'
import { bool, circle, num } from './kit'
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
  /** The default size of the symbol: the sizes below are for a picture at this size, and a picture in a bigger or smaller box scales with it. */
  box: { w: 200, h: 170 },
} as const

/** The sizes of a picture at the default size, in u. The outline of an atom is 2 u whatever the size (rule S3). */
export interface GraphiteStyle {
  /** One bond. */
  l: number
  /** The radius of an atom, to the middle of its outline. */
  atomR: number
}
/**
 * The numbers of the catalogue row: l = 22 u and atoms of radius 4 u. In the oblique projection a bond along z is drawn half as long (11 u),
 * so the outlines of its two atoms are 1 u apart and the bond between them is 3 u long: the atoms touch (see the report of phase 15).
 */
export const GRAPHITE_BRIEF: GraphiteStyle = { l: 22, atomR: 4 }
/** What the symbol draws: a bond of 24 u and atoms of radius 3.5 u, so that the outlines of a bond along z are 3 u apart. */
export const GRAPHITE_STYLE: GraphiteStyle = { l: 24, atomR: 3.5 }

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
 * The atoms of a sheet that the dotted lines start from, as (hexagon, corner): the front-left corner and the back-right corner of the
 * patch, and the two atoms that are one hexagon in from them. A dotted line is vertical on the page, so it runs over whatever lies above the
 * atom it ends on. These four are the atoms whose lines cross no atom and at most one bond; the front-right and back-left corners are not
 * among them because their lines run over a whole row of atoms. The test checks this.
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
  size: { w: 200, h: 170 },
  resize: 'uniform',
  min: { w: 140, h: 119 },
  params: [
    { key: 'layers', label: 'Layers', type: 'number', default: 3, min: 2, max: 4, step: 1 },
    { key: 'forces', label: 'Weak forces', type: 'boolean', default: true },
  ],
  build({ w, h, p }) {
    return graphiteGeometry(w, h, num(p.layers, 3), bool(p.forces, true))
  },
}

export const cages: SymbolDef[] = [graphiteStructure]
