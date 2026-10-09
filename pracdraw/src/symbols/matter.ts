// matter.ts — the particle box: states of matter, elements, compounds and mixtures as pictures of particles (release 1.2).
//
// The picture is drawn from a model. `particleModel(w, h, params)` is a pure function: from the parameters and a constant seed it returns
// every particle (kind, centre, radius, the unit it belongs to), the bonds, and the motion arrows. Nothing in it is random between calls,
// and no two circles overlap. `matter.science.test.ts` tests the model and checks that the drawing agrees with it.
//
// Kinds (rules S6 and S12): A is large and white (role `solid`), B is small and tinted with a hatch (`tinted()`), C is large and solid
// ink (role `ink`). They differ by fill, and A and B by size too, so that the picture reads on a photocopy.
// A unit is a free atom or a molecule: a group of atoms that touch and are bonded. `count` is the number of units.

import { P, f, rng, type Pt } from '../kernel/geom'
import { bool, circle, num, rect, str, tinted } from './kit'
import type { Prim, SymbolDef } from './types'

// ---------------------------------------------------------------- kinds, units and parameters

export type Kind = 'A' | 'B' | 'C'
export type Substance = 'element' | 'molecules' | 'compound' | 'mixtureElements' | 'mixtureCompounds' | 'mixtureElementCompound'
export type State = 'gas' | 'liquid' | 'solid'
export type Formula = 'AB' | 'AB2' | 'A2B'

export interface BoxParams {
  substance: Substance
  state: State
  count: number
  formula: Formula
  motion: boolean
}

/** Radius of each kind in u, at full size: 7 for the larger kinds and 5 for the smaller. */
export const RADIUS: Record<Kind, number> = { A: 7, B: 5, C: 7 }
/** The gap between a circle on the floor or against a wall and the line of the box, in u. */
export const INSET = 2
/** The space that keeps one molecule apart from the next in a liquid or a solid, so that each can be seen. Bonded atoms touch; molecules do not quite. */
export const MOLECULE_GAP = 3
/** A gas has a gap of more than this many circle diameters between any two circles of different units. */
export const GAS_GAP = 1.1
/** The angle at the central atom of a molecule of three atoms (that of water). */
const BOND_ANGLE = 104.5
/** A constant seed: the same parameters always give the same picture. */
const SEED = 0x7a11
/** A unit of a liquid falls at this many random places, and takes the lowest. */
const FALLS = 6

/** A kind of unit: its atoms in a fixed pose, relative to the middle of the unit (at full size), and which atoms are bonded. */
export interface Template {
  /** The formula of the unit as it is written: 'A', 'A2', 'AB2', 'CB'. */
  formula: string
  atoms: { kind: Kind; x: number; y: number }[]
  bonds: [number, number][]
}

/** The unit for a formula. The large kind is the single atom of AB2 and the pair of A2B (`big` is A or C). Its pose is a V that opens upwards. */
function compoundTemplate(formula: Formula, big: Kind): Template {
  const rb = RADIUS.B,
    rg = RADIUS[big]
  const name = formula.replace(/A/g, big)
  if (formula === 'AB')
    return {
      formula: name,
      atoms: [
        { kind: big, x: -(rb + rg) / 2, y: 0 },
        { kind: 'B', x: (rb + rg) / 2, y: 0 },
      ],
      bonds: [[0, 1]],
    }
  // Three atoms: the single one at the foot of a V, the two others on its arms.
  const centre: Kind = formula === 'AB2' ? big : 'B',
    arm: Kind = formula === 'AB2' ? 'B' : big
  const d = RADIUS[centre] + RADIUS[arm],
    half = ((BOND_ANGLE / 2) * Math.PI) / 180
  return {
    formula: name,
    atoms: [
      { kind: centre, x: 0, y: 0 },
      { kind: arm, x: -d * Math.sin(half), y: -d * Math.cos(half) },
      { kind: arm, x: d * Math.sin(half), y: -d * Math.cos(half) },
    ],
    bonds: [
      [0, 1],
      [0, 2],
    ],
  }
}

const freeAtom = (kind: Kind): Template => ({ formula: kind, atoms: [{ kind, x: 0, y: 0 }], bonds: [] })
const pairOf = (kind: Kind): Template => ({
  formula: `${kind}2`,
  atoms: [
    { kind, x: -RADIUS[kind], y: 0 },
    { kind, x: RADIUS[kind], y: 0 },
  ],
  bonds: [[0, 1]],
})

/** The kinds of unit that a substance holds. A mixture holds two. */
export function constituents(substance: Substance, formula: Formula): Template[] {
  switch (substance) {
    case 'element':
      return [freeAtom('A')]
    case 'molecules':
      return [pairOf('A')]
    case 'compound':
      return [compoundTemplate(formula, 'A')]
    case 'mixtureElements':
      return [freeAtom('A'), freeAtom('B')]
    case 'mixtureCompounds':
      return [compoundTemplate(formula, 'A'), compoundTemplate(formula, 'C')]
    case 'mixtureElementCompound':
      return [freeAtom('C'), compoundTemplate(formula, 'A')]
  }
}

/** How many units each kind of unit gets: the count is shared as evenly as it can be, the first kind taking the odd one. */
export const share = (count: number, parts: number): number[] => Array.from({ length: parts }, (_, i) => Math.floor(count / parts) + (i < count % parts ? 1 : 0))

export interface Particle {
  kind: Kind
  x: number
  y: number
  r: number
  /** The unit (free atom or molecule) that the particle belongs to: an index into `units`. */
  unit: number
}

export interface Unit {
  /** Which kind of unit of the substance this is: an index into `constituents`. */
  constituent: number
  /** The particles of the unit: indices into `particles`. */
  particles: number[]
}

/** A motion arrow: a shaft from (x0, y0) to a head whose tip is at (x1, y1). */
export interface Arrow {
  unit: number
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface ParticleModel {
  w: number
  h: number
  params: BoxParams
  constituents: Template[]
  /** How much smaller than full size the particles are drawn: 1 unless the box is too small for them. */
  scale: number
  particles: Particle[]
  units: Unit[]
  /** Pairs of bonded particles (indices into `particles`). They touch. A bond never joins two units. */
  bonds: [number, number][]
  arrows: Arrow[]
}

// ---------------------------------------------------------------- rigid groups of circles

interface Circle {
  x: number
  y: number
  r: number
  /** The least gap that this circle keeps from a circle of another unit. */
  pad?: number
}
interface Atom extends Circle {
  kind: Kind
}
/** A unit as a rigid body: its atoms are offsets from (x, y). */
interface Body {
  constituent: number
  x: number
  y: number
  atoms: Atom[]
}
/** How far the circles of a body reach from (x, y) in each direction, and the radius of a circle about (x, y) that holds them all. */
interface Reach {
  l: number
  r: number
  t: number
  b: number
  round: number
}
interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export const reachOf = (b: Body): Reach => ({
  l: Math.max(...b.atoms.map((a) => a.r - a.x)),
  r: Math.max(...b.atoms.map((a) => a.r + a.x)),
  t: Math.max(...b.atoms.map((a) => a.r - a.y)),
  b: Math.max(...b.atoms.map((a) => a.r + a.y)),
  round: Math.max(...b.atoms.map((a) => Math.hypot(a.x, a.y) + a.r)),
})

/**
 * A body for a template at scale `k`, turned by `angle` (radians, clockwise on the screen). The turn is rounded and made exact again, so
 * that every engine draws the same picture and the atoms of a molecule stay exactly as far apart as their radii say.
 */
export function bodyOf(t: Template, constituent: number, k: number, angle: number): Body {
  const round6 = (v: number) => Math.round(v * 1e6) / 1e6
  let c = round6(Math.cos(angle)),
    s = round6(Math.sin(angle))
  const len = Math.sqrt(c * c + s * s)
  c /= len
  s /= len
  const mx = t.atoms.reduce((n, a) => n + a.x, 0) / t.atoms.length,
    my = t.atoms.reduce((n, a) => n + a.y, 0) / t.atoms.length
  const pad = t.atoms.length > 1 ? MOLECULE_GAP * k : 0
  return {
    constituent,
    x: 0,
    y: 0,
    atoms: t.atoms.map((a) => ({
      kind: a.kind,
      r: RADIUS[a.kind] * k,
      x: k * (c * (a.x - mx) - s * (a.y - my)),
      y: k * (s * (a.x - mx) + c * (a.y - my)),
      pad,
    })),
  }
}

/** The atoms of a body where it stands. */
export const placed = (b: Body): Atom[] => b.atoms.map((a) => ({ ...a, x: b.x + a.x, y: b.y + a.y }))

/**
 * How far a rigid group of circles (offsets from `at`) can move along the unit vector (dx, dy) before one of its circles comes within
 * its gap of an obstacle, or leaves `box` (when there is one). Infinity when nothing is in the way.
 */
export function travel(atoms: Circle[], at: Pt, dx: number, dy: number, obstacles: Circle[], box?: Box): number {
  let best = Infinity
  for (const a of atoms) {
    const px = at.x + a.x,
      py = at.y + a.y
    if (box) {
      if (dx > 0) best = Math.min(best, (box.x1 - a.r - px) / dx)
      if (dx < 0) best = Math.min(best, (box.x0 + a.r - px) / dx)
      if (dy > 0) best = Math.min(best, (box.y1 - a.r - py) / dy)
      if (dy < 0) best = Math.min(best, (box.y0 + a.r - py) / dy)
    }
    for (const o of obstacles) {
      const qx = px - o.x,
        qy = py - o.y,
        need = a.r + o.r + Math.max(a.pad ?? 0, o.pad ?? 0)
      const b = qx * dx + qy * dy, // the circles come closer when this is negative
        c = qx * qx + qy * qy - need * need
      if (b >= 0 && c > 0) continue
      if (c <= 0) {
        best = Math.min(best, 0)
        continue
      }
      const disc = b * b - c
      if (disc >= 0) best = Math.min(best, -b - Math.sqrt(disc))
    }
  }
  return Math.max(0, best)
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

/** The room for the edges of the circles: the box without the gap at its line, and without `clear` more. */
export const innerBox = (w: number, h: number, clear = 0): Box => ({ x0: -w / 2 + INSET + clear, y0: INSET + clear, x1: w / 2 - INSET - clear, y1: h - INSET - clear })

// ---------------------------------------------------------------- solid: a lattice

/** A rectangular lattice of units that touch, filling rows from the floor. Returns the bodies, or null when they do not fit the box. */
export function lattice(groups: Body[][], box: Box): Body[] | null {
  const parts = groups.filter((g) => g.length)
  const far = 400
  const blocks = parts.map((group) => {
    const body = group[0],
      reach = reachOf(body)
    // One step along a row: a copy comes in from the right until it touches. One step up: a copy comes down on the three below it.
    const dx = far - travel(body.atoms, P(far, 0), -1, 0, placed(body))
    const row = [-dx, 0, dx].flatMap((x) => placed({ ...body, x }))
    const dy = far - travel(body.atoms, P(0, -far), 0, 1, row)
    // The ways to arrange n units in rows, widest first. A top row that is not full is centred, so the places left empty in it are even in number.
    const options: { cols: number; rows: number; empty: number; width: number; height: number }[] = []
    for (let cols = group.length; cols >= 1; cols--) {
      const rows = Math.ceil(group.length / cols),
        empty = cols * rows - group.length
      if (rows > 1 && empty % 2) continue
      const used = rows > 1 ? cols : group.length
      options.push({ cols, rows, empty, width: (used - 1) * dx + reach.l + reach.r, height: (rows - 1) * dy + reach.t + reach.b })
    }
    return { group, reach, dx, dy, options }
  })
  // Blocks (one for each kind of unit) stand side by side with a gap of a circle between them.
  const gap = 2 * Math.max(...parts.flatMap((g) => g[0].atoms.map((a) => a.r)))
  const room = box.x1 - box.x0,
    tall = box.y1 - box.y0
  // The best choice has the fewest blocks with a top row that is not full, then the least height, then the most width.
  let best: { pick: number[]; key: number[] } | undefined
  const before = (a: number[], b: number[]) => {
    const i = a.findIndex((v, j) => v !== b[j])
    return i >= 0 && a[i] < b[i]
  }
  const choose = (i: number, pick: number[], width: number) => {
    if (i === blocks.length) {
      const chosen = pick.map((o, j) => blocks[j].options[o])
      const height = Math.max(...chosen.map((o) => o.height))
      const key = [chosen.filter((o) => o.empty).length, height, -width]
      if (height <= tall && (!best || before(key, best.key))) best = { pick, key }
      return
    }
    blocks[i].options.forEach((o, j) => {
      const next = width + o.width + (i ? gap : 0)
      if (next <= room) choose(i + 1, [...pick, j], next)
    })
  }
  choose(0, [], 0)
  if (!best) return null
  const width = -best.key[2]
  let left = (box.x0 + box.x1 - width) / 2
  const out: Body[] = []
  blocks.forEach((b, i) => {
    const o = b.options[best!.pick[i]]
    let n = 0
    for (let row = 0; row < o.rows; row++) {
      const inRow = row === o.rows - 1 ? b.group.length - o.cols * (o.rows - 1) : o.cols
      const first = o.rows > 1 ? (o.cols - inRow) / 2 : 0
      for (let col = 0; col < inRow; col++) {
        const body = b.group[n++]
        body.x = left + b.reach.l + (first + col) * b.dx
        body.y = box.y1 - b.reach.b - row * b.dy
        out.push(body)
      }
    }
    left += o.width + gap
  })
  return out
}

// ---------------------------------------------------------------- liquid and gas: units pushed apart

/**
 * Push every pair of units that are closer than their gap apart (`gap` at least), and keep the units inside `box`.
 * Returns the largest overlap found. `over` above 1 pushes a little too far.
 */
export function pushApart(bodies: Body[], reach: Reach[], box: Box, gap: number, over: number): number {
  let worst = 0
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i],
        b = bodies[j]
      const pad = Math.max(gap, a.atoms[0].pad ?? 0, b.atoms[0].pad ?? 0)
      if (Math.hypot(a.x - b.x, a.y - b.y) >= reach[i].round + reach[j].round + pad) continue
      for (const p of a.atoms) {
        for (const q of b.atoms) {
          const dx = a.x + p.x - (b.x + q.x),
            dy = a.y + p.y - (b.y + q.y)
          const d = Math.hypot(dx, dy),
            need = p.r + q.r + pad
          if (d >= need) continue
          worst = Math.max(worst, need - d)
          const push = ((need - d) / 2) * over,
            nx = d > 1e-12 ? dx / d : 1,
            ny = d > 1e-12 ? dy / d : 0
          a.x += nx * push
          a.y += ny * push
          b.x -= nx * push
          b.y -= ny * push
        }
      }
    }
  }
  bodies.forEach((b, i) => {
    b.x = Math.min(Math.max(b.x, box.x0 + reach[i].l), box.x1 - reach[i].r)
    b.y = Math.min(Math.max(b.y, box.y0 + reach[i].t), box.y1 - reach[i].b)
  })
  return worst
}

/**
 * Push the units apart until no two circles of different units are closer than their gap. At the end no two circles overlap by more than
 * 1e-7 u. False when the box is too small for them.
 */
export function settle(bodies: Body[], box: Box, gap: number): boolean {
  const reach = bodies.map(reachOf)
  let worst = Infinity
  for (let i = 0; i < 3000 && worst >= 1e-7; i++) {
    worst = pushApart(bodies, reach, box, gap, 1.02)
    if (i === 300 && worst > 1e-3) return false // it is not going to fit
  }
  return worst < 1e-7
}

/** A shuffled copy: Fisher and Yates. */
function shuffled<T>(items: T[], rnd: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The units spread through the whole box, every pair of circles more than a circle apart. */
export function gas(bodies: Body[], w: number, h: number, rnd: () => number): boolean {
  const gap = 2 * Math.max(...bodies.flatMap((b) => b.atoms.map((a) => a.r))) * GAS_GAP
  const box = innerBox(w, h, gap / 2)
  const wide = box.x1 - box.x0,
    tall = box.y1 - box.y0
  // Each unit starts in a cell of its own, so that the picture is spread out evenly and still looks random.
  let cols = 1,
    cost = Infinity
  for (let c = 1; c <= bodies.length; c++) {
    const rows = Math.ceil(bodies.length / c),
      c2 = (c * rows - bodies.length) * 3 + 4 * Math.abs(Math.log(wide / c / (tall / rows)))
    if (c2 < cost) [cols, cost] = [c, c2]
  }
  const rows = Math.ceil(bodies.length / cols)
  const cells = shuffled(range(cols * rows), rnd)
  bodies.forEach((b, i) => {
    b.x = box.x0 + ((cells[i] % cols) + rnd()) * (wide / cols)
    b.y = box.y0 + (Math.floor(cells[i] / cols) + rnd()) * (tall / rows)
  })
  return settle(bodies, box, gap)
}

/** How near two circles of different units may come: the gap of either. */
const gapOf = (a: Circle, b: Circle): number => Math.max(a.pad ?? 0, b.pad ?? 0)

/** The units in a heap on the floor, touching and in no order. */
export function liquid(bodies: Body[], w: number, h: number, rnd: () => number): boolean {
  const room = innerBox(w, h)
  // The heap is about six times as wide as it is deep, and no wider than the box. It fills the lower two thirds at most.
  const area = bodies.reduce((n, b) => n + b.atoms.reduce((m, a) => m + Math.PI * a.r * a.r, 0), 0) / 0.8
  const round = Math.max(...bodies.map((b) => reachOf(b).round))
  const width = Math.min(room.x1 - room.x0, Math.max(8 * round, Math.sqrt(6 * area)))
  const box: Box = { x0: -width / 2, x1: width / 2, y0: Math.max(room.y0, h / 3), y1: room.y1 }
  const done: Body[] = []
  // One unit at a time falls from the top of the heap. It takes the lowest of a few random places, rolls a little way into a hollow, and
  // if it touches nothing but the floor it slides up to the nearest unit. Every unit ends up touching the floor or another unit.
  for (const b of shuffled(bodies, rnd)) {
    const reach = reachOf(b),
      others = done.flatMap(placed)
    const top = box.y0 + reach.t,
      lo = box.x0 + reach.l,
      hi = box.x1 - reach.r
    const free = (x: number, y: number) => b.atoms.every((a) => others.every((o) => Math.hypot(x + a.x - o.x, y + a.y - o.y) >= a.r + o.r + gapOf(a, o) - 1e-9))
    const fall = (x: number, y: number) => y + travel(b.atoms, P(x, y), 0, 1, others, box)
    const rest = (x: number) => (free(x, top) ? fall(x, top) : -Infinity)
    const places = done.length ? range(FALLS).map(() => lo + rnd() * (hi - lo)) : [(lo + hi) / 2]
    let at = { x: places[0], y: rest(places[0]) }
    for (const x of places.slice(1)) if (rest(x) > at.y) at = { x, y: rest(x) }
    if (at.y === -Infinity) return false // the heap is full
    for (const step of [5, 2.5]) {
      for (let n = 0; n < 20; n++) {
        const next = [at.x - step, at.x + step].filter((x) => x >= lo && x <= hi).map((x) => ({ x, y: rest(x) }))
        const lower = next.sort((p, q) => q.y - p.y)[0]
        if (!lower || lower.y <= at.y + 1e-9) break
        at = lower
      }
    }
    b.x = at.x
    b.y = at.y
    const touching = () => placed(b).some((a) => others.some((o) => Math.hypot(a.x - o.x, a.y - o.y) <= a.r + o.r + gapOf(a, o) + 1e-6))
    for (let n = 0; n < 4 && others.length && !touching(); n++) {
      const left = travel(b.atoms, P(b.x, b.y), -1, 0, others),
        right = travel(b.atoms, P(b.x, b.y), 1, 0, others)
      const slide = Math.min(left, right) === left ? -left : right
      if (!Number.isFinite(slide) || b.x + slide < lo || b.x + slide > hi) break
      b.x += slide
      b.y = fall(b.x, b.y)
    }
    done.push(b)
  }
  return true
}

/** The units of the substance placed in the box at scale `k`, or null when they do not fit. */
export function place(templates: Template[], counts: number[], state: State, w: number, h: number, k: number, rnd: () => number): Body[] | null {
  const turned = state !== 'solid'
  const groups = templates.map((t, i) => range(counts[i]).map(() => bodyOf(t, i, k, turned ? rnd() * 2 * Math.PI : 0)))
  if (state === 'solid') return lattice(groups, innerBox(w, h))
  const bodies = groups.flat()
  return (state === 'liquid' ? liquid(bodies, w, h, rnd) : gas(bodies, w, h, rnd)) ? bodies : null
}

// ---------------------------------------------------------------- motion arrows

/** Length of a motion arrow in u, at full size: short in a solid or a liquid, longer in a gas. */
export const ARROW_LENGTH = { short: 9, long: 20 }
/** The head of a motion arrow: how long it is, and how wide each side of it. */
const HEAD = { length: 5.5, half: 2.3 }
/** How far an arrow keeps from every circle and from the line of the box. */
const AWAY = 2.5

/** The arrowhead at the tip (x, y) of an arrow that points along the unit vector (ux, uy): a closed triangle for the role `ink`. */
export function headD(x: number, y: number, ux: number, uy: number, scale = 1): string {
  const bx = x - ux * HEAD.length * scale,
    by = y - uy * HEAD.length * scale,
    hx = -uy * HEAD.half * scale,
    hy = ux * HEAD.half * scale
  return `M${f(x)} ${f(y)}L${f(bx + hx)} ${f(by + hy)}L${f(bx - hx)} ${f(by - hy)}Z`
}

/** The distance from (px, py) to the segment (ax, ay)–(bx, by). */
function pointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax,
    dy = by - ay,
    l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

/**
 * A short arrow on some of the units. It leaves the unit's surface in a direction that is free for its whole length and keeps `AWAY` from every
 * circle and from the line of the box, so that it never crosses a particle. A unit that is packed in has no free direction and gets none.
 */
export function motionArrows(bodies: Body[], state: State, w: number, h: number, k: number, rnd: () => number): Arrow[] {
  const length = ARROW_LENGTH[state === 'gas' ? 'long' : 'short'] * k
  const circles = bodies.flatMap(placed)
  const room = innerBox(w, h, 1 + HEAD.half)
  const out: Arrow[] = []
  bodies.forEach((b, u) => {
    if (rnd() > (state === 'gas' ? 0.75 : 0.5)) return
    const atoms = placed(b),
      phase = rnd() * Math.PI * 2
    const valid: Arrow[] = []
    for (let i = 0; i < 16; i++) {
      const ux = Math.cos(phase + (i * Math.PI) / 8),
        uy = Math.sin(phase + (i * Math.PI) / 8)
      // The point of the unit that is farthest in this direction, and a little beyond it.
      const edge = atoms.reduce((m, a) => (a.x * ux + a.y * uy + a.r > m.x * ux + m.y * uy + m.r ? a : m))
      const sx = edge.x + (edge.r + 2 * k) * ux,
        sy = edge.y + (edge.r + 2 * k) * uy
      let free = Math.min(
        ux > 0 ? (room.x1 - sx) / ux : Infinity,
        ux < 0 ? (room.x0 - sx) / ux : Infinity,
        uy > 0 ? (room.y1 - sy) / uy : Infinity,
        uy < 0 ? (room.y0 - sy) / uy : Infinity,
      )
      for (const o of circles) {
        if (o.x === edge.x && o.y === edge.y) continue
        const qx = sx - o.x,
          qy = sy - o.y,
          reach = o.r + AWAY * k
        const along = qx * ux + qy * uy,
          c = qx * qx + qy * qy - reach * reach
        if (c <= 0) free = 0
        else if (along < 0 && along * along >= c) free = Math.min(free, -along - Math.sqrt(along * along - c))
      }
      if (free < length + 4 * k) continue
      const tx = sx + ux * length,
        ty = sy + uy * length
      // not near another arrow
      if (out.some((o) => [0, 0.25, 0.5, 0.75, 1].some((t) => pointToSegment(sx + (tx - sx) * t, sy + (ty - sy) * t, o.x0, o.y0, o.x1, o.y1) < 5 * k))) continue
      valid.push({ unit: u, x0: sx, y0: sy, x1: tx, y1: ty })
    }
    if (valid.length) out.push(valid[Math.floor(rnd() * valid.length)])
  })
  return out
}

// ---------------------------------------------------------------- the model

export function particleModel(w: number, h: number, params: BoxParams): ParticleModel {
  const templates = constituents(params.substance, params.formula)
  const counts = share(Math.max(1, Math.min(60, Math.round(params.count))), templates.length)
  let bodies: Body[] | null = null
  let scale = 1
  // Particles keep their size unless the box is too small for them: then they are drawn a little smaller, until they fit.
  while (!bodies && scale > 0.3) {
    bodies = place(templates, counts, params.state, w, h, scale, rng(SEED))
    if (!bodies) scale *= 0.94
  }
  if (!bodies) bodies = []
  const particles: Particle[] = [],
    units: Unit[] = [],
    bonds: [number, number][] = []
  bodies.forEach((b, u) => {
    const first = particles.length
    for (const a of placed(b)) particles.push({ kind: a.kind, x: a.x, y: a.y, r: a.r, unit: u })
    units.push({ constituent: b.constituent, particles: b.atoms.map((_, i) => first + i) })
    for (const [i, j] of templates[b.constituent].bonds) bonds.push([first + i, first + j])
  })
  // The arrows come from a stream of their own, so that the motion switch never moves a particle.
  const arrows = params.motion ? motionArrows(bodies, params.state, w, h, scale, rng(SEED ^ 0x5a5a)) : []
  return { w, h, params, constituents: templates, scale, particles, units, bonds, arrows }
}

// ---------------------------------------------------------------- the picture

export function particlePrims(m: ParticleModel): Prim[] {
  const prims: Prim[] = [{ d: rect(-m.w / 2, 0, m.w / 2, m.h), role: 'outline' }]
  const of = (kind: Kind) =>
    m.particles
      .filter((p) => p.kind === kind)
      .map((p) => circle(p.x, p.y, p.r))
      .join('')
  const a = of('A'),
    b = of('B'),
    c = of('C')
  if (a) prims.push({ d: a, role: 'solid' })
  if (b) prims.push(...tinted(b, { pitch: 3 }))
  if (c) prims.push({ d: c, role: 'ink' })
  if (m.arrows.length) {
    // The shaft stops at the foot of the head, so that the head is not drawn over a thick line end.
    const shaft = m.arrows.map((a) => {
      const l = Math.hypot(a.x1 - a.x0, a.y1 - a.y0),
        foot = Math.max(0, l - HEAD.length * m.scale * 0.8)
      return `M${f(a.x0)} ${f(a.y0)}L${f(a.x0 + ((a.x1 - a.x0) * foot) / l)} ${f(a.y0 + ((a.y1 - a.y0) * foot) / l)}`
    })
    const heads = m.arrows.map((a) => {
      const l = Math.hypot(a.x1 - a.x0, a.y1 - a.y0)
      return headD(a.x1, a.y1, (a.x1 - a.x0) / l, (a.y1 - a.y0) / l, m.scale)
    })
    prims.push({ d: shaft.join(''), role: 'detail' }, { d: heads.join(''), role: 'ink' })
  }
  return prims
}

export const particleBox: SymbolDef = {
  id: 'particleBox',
  name: 'Particle box',
  label: 'particle diagram',
  aliases: ['particles', 'states of matter', 'particle model', 'particle diagram', 'element compound mixture'],
  pack: 'matter',
  size: { w: 160, h: 120 },
  resize: 'free',
  min: { w: 100, h: 75 },
  params: [
    {
      key: 'substance',
      label: 'Substance',
      type: 'choice',
      default: 'element',
      options: [
        { value: 'element', label: 'Element (atoms)' },
        { value: 'molecules', label: 'Element (molecules)' },
        { value: 'compound', label: 'Compound' },
        { value: 'mixtureElements', label: 'Mixture of elements' },
        { value: 'mixtureCompounds', label: 'Mixture of compounds' },
        { value: 'mixtureElementCompound', label: 'Mixture of element and compound' },
      ],
    },
    {
      key: 'state',
      label: 'State',
      type: 'choice',
      default: 'gas',
      options: [
        { value: 'gas', label: 'Gas' },
        { value: 'liquid', label: 'Liquid' },
        { value: 'solid', label: 'Solid' },
      ],
    },
    { key: 'count', label: 'Particles', type: 'number', default: 16, min: 6, max: 40, step: 1 },
    {
      key: 'formula',
      label: 'Compound formula',
      type: 'choice',
      default: 'AB',
      options: [
        { value: 'AB', label: 'AB' },
        { value: 'AB2', label: 'AB₂' },
        { value: 'A2B', label: 'A₂B' },
      ],
    },
    { key: 'motion', label: 'Motion arrows', type: 'boolean', default: false },
  ],
  build({ w, h, p }) {
    const m = particleModel(w, h, {
      substance: str(p.substance, 'element') as Substance,
      state: str(p.state, 'gas') as State,
      count: num(p.count, 16),
      formula: str(p.formula, 'AB') as Formula,
      motion: bool(p.motion, false),
    })
    return { prims: particlePrims(m) }
  },
}

export const matter: SymbolDef[] = [particleBox]
