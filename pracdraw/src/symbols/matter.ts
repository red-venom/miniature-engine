// matter.ts — the particle box: states of matter, elements, compounds and mixtures as pictures of particles (release 1.2).
//
// The picture is drawn from a model. `particleModel(w, h, params)` is a pure function: from the parameters and a constant seed it returns
// every particle (kind, centre, radius, the unit it belongs to), the bonds and the motion arrows. The same parameters always give the same
// model, and no two circles of the model overlap. `matter.science.test.ts` tests the model and checks that the drawing agrees with it.
//
// Kinds (rules S6 and S12): A is large and white (role `solid`), B is small and tinted with a hatch (`tinted()`), C is large and solid ink
// (role `ink`). They differ by fill, and A and B by size too, so that the picture reads on a photocopy.
// A unit is a free atom or a molecule: a group of atoms that touch and are bonded. `count` is the number of units, so a molecule counts as one.
//
// The three states are three ways to place the units: a gas has them spread through the whole box with a gap of more than a circle between
// any two; a liquid has them in a heap on the floor, touching and in no order; a solid has them in a lattice of rows that touch, from the floor.
// Particles have the radii of `RADIUS` unless the box is too small for the count: then all three states draw them smaller by the same
// factor (`scale`), so that three boxes of one substance, one count and one size show particles of one size.

import { P, f, rng, type Pt } from '../kernel/geom'
import { arrowHeadD } from './energy'
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
/** How far a molecule keeps from the next one in a liquid or a solid, so that each can be seen. Bonded atoms touch; molecules nearly do. */
export const MOLECULE_GAP = 3
/** In a gas, any two circles of different units are more than this many circle diameters apart. */
export const GAS_GAP = 1.1
/** The angle at the central atom of a molecule of three atoms (that of water). */
const BOND_ANGLE = 104.5
/** A constant seed: the same parameters always give the same picture. */
const SEED = 0x7a11
/** A unit of a liquid falls at this many random places and takes the lowest. */
const FALLS = 6
/** How far a unit of a gas starts from the middle of its cell, in cells (the clamp then keeps it in the box): a gas that is not in rows. */
const SCATTER = 2
/** The scale of the particles falls by this factor at a time, and no further than `MIN_SCALE`, until the units fit the box. */
const SHRINK = 0.94
const MIN_SCALE = 0.3

/** A kind of unit: its atoms in a fixed pose, relative to the middle of the unit (at full size), and which atoms are bonded. */
export interface Template {
  /** The formula of the unit as it is written: 'A', 'A2', 'AB2', 'CB'. */
  formula: string
  atoms: { kind: Kind; x: number; y: number }[]
  bonds: [number, number][]
}

/**
 * The unit for a formula. `big` is the larger kind (A, or C in the second compound of a mixture). The single atom of AB2 and the pair of A2B
 * are large, so AB2 is one large atom with two small ones, as water is. A unit of three atoms is a V that opens upwards.
 */
function compoundTemplate(formula: Formula, big: Kind): Template {
  const name = formula.replace(/A/g, big)
  if (formula === 'AB') {
    const d = RADIUS[big] + RADIUS.B
    return {
      formula: name,
      atoms: [
        { kind: big, x: -d / 2, y: 0 },
        { kind: 'B', x: d / 2, y: 0 },
      ],
      bonds: [[0, 1]],
    }
  }
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

/** The kinds of unit that a substance holds: one, or two for a mixture. */
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
export const share = (count: number, parts: number): number[] =>
  Array.from({ length: parts }, (_, i) => Math.floor(count / parts) + (i < count % parts ? 1 : 0))

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
  /** How much smaller than full size the particles are: 1 unless the box is too small for the count. */
  scale: number
  particles: Particle[]
  units: Unit[]
  /** Pairs of bonded particles (indices into `particles`). Bonded particles touch. A bond never joins two units. */
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
/** How far the circles of a body reach from (x, y) to the left, right, top and bottom, and the radius of a circle about (x, y) that holds them. */
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

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

const reachOf = (b: Body): Reach => ({
  l: Math.max(...b.atoms.map((a) => a.r - a.x)),
  r: Math.max(...b.atoms.map((a) => a.r + a.x)),
  t: Math.max(...b.atoms.map((a) => a.r - a.y)),
  b: Math.max(...b.atoms.map((a) => a.r + a.y)),
  round: Math.max(...b.atoms.map((a) => Math.hypot(a.x, a.y) + a.r)),
})

/**
 * A body for a template at scale `k`, turned by `angle` (radians, clockwise on the screen). The turn is rounded and made exact again, so
 * that every engine draws the same picture and the atoms of a molecule stay as far apart as their radii say.
 */
function bodyOf(t: Template, constituent: number, k: number, angle: number): Body {
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
const placed = (b: Body): Atom[] => b.atoms.map((a) => ({ ...a, x: b.x + a.x, y: b.y + a.y }))

/** How near two circles of different units may come: the larger of their gaps. */
const gapOf = (a: Circle, b: Circle): number => Math.max(a.pad ?? 0, b.pad ?? 0)

/**
 * How far a rigid group of circles (offsets from `at`) can move along the unit vector (dx, dy) before one of its circles comes within
 * its gap of an obstacle, or leaves `box` (when there is one). Infinity when nothing is in the way.
 */
function travel(atoms: Circle[], at: Pt, dx: number, dy: number, obstacles: Circle[], box?: Box): number {
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
        need = a.r + o.r + gapOf(a, o)
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

/** The room for the edges of the circles: the box without the gap at its line, and without `clear` more. */
const innerBox = (w: number, h: number, clear = 0): Box => ({ x0: -w / 2 + INSET + clear, y0: INSET + clear, x1: w / 2 - INSET - clear, y1: h - INSET - clear })

/** A shuffled copy (Fisher and Yates). */
function shuffled<T>(items: T[], rnd: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ---------------------------------------------------------------- solid: a lattice

/**
 * A lattice of units that touch, in rows from the floor, every unit turned the same way. Each kind of unit of a mixture has a block of its own,
 * and the blocks stand side by side. A top row that is not full is centred: it sits on the places of the row below, or, when it cannot be
 * centred on them, in the hollows between them. Returns null when the units do not fit the box.
 */
function lattice(groups: Body[][], box: Box): Body[] | null {
  const far = 400
  const blocks = groups
    .filter((g) => g.length)
    .map((group) => {
      const body = group[0],
        reach = reachOf(body),
        n = group.length
      // One step along a row: a copy comes in from the right until it touches. One step up: a copy comes down on the row below it, directly
      // above one unit, or (nested) between two.
      const dx = far - travel(body.atoms, P(far, 0), -1, 0, placed(body))
      const below = [-dx, 0, dx, 2 * dx].flatMap((x) => placed({ ...body, x }))
      const dy = far - travel(body.atoms, P(0, -far), 0, 1, below)
      const dyNested = far - travel(body.atoms, P(dx / 2, -far), 0, 1, below)
      // The ways to arrange the units: in more than one row unless there are only a few units.
      const plans = range(n)
        .map((i) => n - i)
        .flatMap((cols) => {
          const rows = Math.ceil(n / cols),
            empty = cols * rows - n
          if (n > 3 && rows === 1) return []
          const nested = rows > 1 && empty % 2 === 1
          const rise = rows > 1 ? (rows - 2) * dy + (nested ? dyNested : dy) : 0 // from the first row to the top row
          const used = rows > 1 ? cols : n
          return [{ cols, rows, empty, rise, width: (used - 1) * dx + reach.l + reach.r, height: rise + reach.t + reach.b }]
        })
      return { group, reach, dx, dy, plans }
    })
  const gap = 2 * Math.max(...blocks.flatMap((b) => b.group[0].atoms.map((a) => a.r)))
  // The best choice has the fewest blocks that are taller than they are wide, then the fewest with a top row that is not full, then the least
  // height (the widest rows), then blocks of one height, then the fewest empty places, then the most width.
  const before = (a: number[], b: number[]) => {
    const i = a.findIndex((v, j) => Math.abs(v - b[j]) > 1e-9)
    return i >= 0 && a[i] < b[i]
  }
  let best: { pick: number[]; key: number[] } | undefined
  const choose = (i: number, pick: number[], width: number) => {
    if (i === blocks.length) {
      const chosen = pick.map((p, j) => blocks[j].plans[p])
      const heights = chosen.map((p) => p.height)
      const key = [
        chosen.filter((p) => p.cols < p.rows).length,
        chosen.filter((p) => p.empty).length,
        Math.max(...heights),
        Math.max(...heights) - Math.min(...heights),
        chosen.reduce((m, p) => m + p.empty, 0),
        -width,
      ]
      if (key[2] <= box.y1 - box.y0 && (!best || before(key, best.key))) best = { pick, key }
      return
    }
    blocks[i].plans.forEach((p, j) => {
      const next = width + p.width + (i ? gap : 0)
      if (next <= box.x1 - box.x0) choose(i + 1, [...pick, j], next)
    })
  }
  choose(0, [], 0)
  if (!best) return null
  let left = (box.x0 + box.x1 + best.key[5]) / 2
  const out: Body[] = []
  blocks.forEach((b, i) => {
    const plan = b.plans[best!.pick[i]]
    let n = 0
    for (let row = 0; row < plan.rows; row++) {
      const top = row === plan.rows - 1
      const inRow = top ? b.group.length - plan.cols * (plan.rows - 1) : plan.cols
      const first = plan.rows > 1 ? (plan.cols - inRow) / 2 : 0
      for (let col = 0; col < inRow; col++) {
        const body = b.group[n++]
        body.x = left + b.reach.l + (first + col) * b.dx
        body.y = box.y1 - b.reach.b - (top ? plan.rise : row * b.dy)
        out.push(body)
      }
    }
    left += plan.width + gap
  })
  return out
}

// ---------------------------------------------------------------- gas: units pushed apart

/**
 * Push every pair of units that are closer than their gap (`gap` at least) apart, and keep the units inside `box`.
 * Returns the largest overlap found. `over` above 1 pushes a little too far, so that the overlaps end.
 */
function pushApart(bodies: Body[], reach: Reach[], box: Box, gap: number, over: number): number {
  const keepIn = () =>
    bodies.forEach((b, i) => {
      b.x = Math.min(Math.max(b.x, box.x0 + reach[i].l), box.x1 - reach[i].r)
      b.y = Math.min(Math.max(b.y, box.y0 + reach[i].t), box.y1 - reach[i].b)
    })
  keepIn() // so that the overlaps that the box itself causes are found
  let worst = 0
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i],
        b = bodies[j]
      const apart = Math.max(gap, gapOf(a.atoms[0], b.atoms[0]))
      if (Math.hypot(a.x - b.x, a.y - b.y) >= reach[i].round + reach[j].round + apart) continue
      for (const p of a.atoms) {
        for (const q of b.atoms) {
          const dx = a.x + p.x - (b.x + q.x),
            dy = a.y + p.y - (b.y + q.y)
          const d = Math.hypot(dx, dy),
            need = p.r + q.r + apart
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
  keepIn()
  return worst
}

/**
 * The units spread through the whole box, no two circles of different units within `GAS_GAP` diameters of each other. False when the box is
 * too small for them. Each unit starts in a cell of its own, so that the units are spread out evenly and still look random.
 */
function gas(bodies: Body[], w: number, h: number, rnd: () => number): boolean {
  const gap = 2 * Math.max(...bodies.flatMap((b) => b.atoms.map((a) => a.r))) * GAS_GAP
  const box = innerBox(w, h, gap / 2)
  const wide = box.x1 - box.x0,
    tall = box.y1 - box.y0
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
    b.x = box.x0 + ((cells[i] % cols) + 0.5 + (rnd() - 0.5) * SCATTER) * (wide / cols)
    b.y = box.y0 + (Math.floor(cells[i] / cols) + 0.5 + (rnd() - 0.5) * SCATTER) * (tall / rows)
  })
  // Push until nothing overlaps. A box that is too small shows at once: the overlaps do not shrink. At the end none is left (to 1e-7 u).
  const reach = bodies.map(reachOf)
  let worst = Infinity
  for (let pass = 0; pass < 500 && worst >= 1e-7; pass++) {
    worst = pushApart(bodies, reach, box, gap, 1.02)
    if ((pass === 40 && worst > 1.5) || (pass === 100 && worst > 0.01)) return false
  }
  return worst < 1e-7
}

// ---------------------------------------------------------------- liquid: a heap that falls

/**
 * The units in a heap on the floor, touching and in no order. They are dropped one at a time. Each takes the lowest of a few random places
 * at the top of the heap, rolls a little way into a hollow, and if it touches nothing but the floor, slides up to the nearest unit. So every
 * unit touches the floor or another unit (within its gap). The heap is about six times as wide as it is deep and no wider than the box, and
 * it fills the lower two thirds of the box at most. False when it is too full for that.
 */
function liquid(bodies: Body[], w: number, h: number, rnd: () => number): boolean {
  const room = innerBox(w, h)
  const area = bodies.reduce((n, b) => n + b.atoms.reduce((m, a) => m + Math.PI * a.r * a.r, 0), 0) / 0.8
  const round = Math.max(...bodies.map((b) => reachOf(b).round))
  const width = Math.min(room.x1 - room.x0, Math.max(8 * round, Math.sqrt(6 * area)))
  const box: Box = { x0: -width / 2, x1: width / 2, y0: Math.max(room.y0, h / 3), y1: room.y1 }
  const done: Body[] = []
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
        const lower = [at.x - step, at.x + step]
          .filter((x) => x >= lo && x <= hi)
          .map((x) => ({ x, y: rest(x) }))
          .sort((p, q) => q.y - p.y)[0]
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
      const slide = left <= right ? -left : right
      if (!Number.isFinite(slide) || b.x + slide < lo || b.x + slide > hi) break
      b.x += slide
      b.y = fall(b.x, b.y)
    }
    done.push(b)
  }
  return true
}

// ---------------------------------------------------------------- placing the units

/** The units of the substance placed in the box at scale `k`, or null when they do not fit. */
function place(templates: Template[], counts: number[], state: State, w: number, h: number, k: number): Body[] | null {
  const rnd = rng(SEED)
  const groups = templates.map((t, i) => range(counts[i]).map(() => bodyOf(t, i, k, state === 'solid' ? 0 : rnd() * 2 * Math.PI)))
  if (state === 'solid') return lattice(groups, innerBox(w, h))
  const bodies = groups.flat()
  return (state === 'liquid' ? liquid(bodies, w, h, rnd) : gas(bodies, w, h, rnd)) ? bodies : null
}

// ---------------------------------------------------------------- motion arrows

/** The length of a motion arrow in u at full size: short in a solid or a liquid, longer in a gas. */
export const ARROW_LENGTH = { short: 9, long: 20 }
/** The head of a motion arrow: its length and the half of its width. */
const HEAD = { length: 5.5, half: 2.3 }
/** How far an arrow keeps from every circle and from the line of the box. */
const AWAY = 2.5

/** The distance from (px, py) to the segment (ax, ay)–(bx, by). */
function pointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax,
    dy = by - ay,
    l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

/**
 * A short arrow on some of the units. It leaves the unit's surface in a direction that is free for its whole length, and keeps `AWAY` from
 * every circle, from the line of the box and from the other arrows, so that it never crosses a particle. A unit that is packed in has no
 * free direction and gets no arrow.
 */
function motionArrows(bodies: Body[], state: State, w: number, h: number, k: number, rnd: () => number): Arrow[] {
  const length = ARROW_LENGTH[state === 'gas' ? 'long' : 'short'] * k
  const circles = bodies.flatMap(placed)
  const room = innerBox(w, h, 1 + HEAD.half)
  const out: Arrow[] = []
  bodies.forEach((b, u) => {
    if (rnd() > (state === 'gas' ? 0.75 : 0.5)) return
    const atoms = placed(b),
      phase = rnd() * 2 * Math.PI
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
      const near = out.some((o) => [0, 0.25, 0.5, 0.75, 1].some((t) => pointToSegment(sx + (tx - sx) * t, sy + (ty - sy) * t, o.x0, o.y0, o.x1, o.y1) < 5 * k))
      if (!near) valid.push({ unit: u, x0: sx, y0: sy, x1: tx, y1: ty })
    }
    if (valid.length) out.push(valid[Math.floor(rnd() * valid.length)])
  })
  return out
}

// ---------------------------------------------------------------- the model

/**
 * The largest scale (by steps of `SHRINK`) at which the units fit the box as a gas. A gas needs the most room, so this is the scale of all three
 * states of the substance. The answer is kept, because the three states ask for it, and so does every redraw of the same box.
 */
const gasScales = new Map<string, number>()
function gasScale(templates: Template[], counts: number[], w: number, h: number): number {
  const key = `${templates.map((t) => t.formula).join('+')}|${counts}|${w}|${h}`
  let scale = gasScales.get(key)
  if (scale === undefined) {
    scale = 1
    while (scale * SHRINK > MIN_SCALE && !place(templates, counts, 'gas', w, h, scale)) scale *= SHRINK
    if (gasScales.size > 500) gasScales.clear()
    gasScales.set(key, scale)
  }
  return scale
}

export function particleModel(w: number, h: number, params: BoxParams): ParticleModel {
  const templates = constituents(params.substance, params.formula)
  const counts = share(Math.max(1, Math.min(60, Math.round(params.count))), templates.length)
  // Particles have their full size unless the box is too small for them. Then all three states draw them smaller by the same factor; a solid
  // or a liquid that does not fit even at that scale takes a smaller one.
  let scale = gasScale(templates, counts, w, h)
  let bodies = place(templates, counts, params.state, w, h, scale)
  while (!bodies && scale * SHRINK > MIN_SCALE) bodies = place(templates, counts, params.state, w, h, (scale *= SHRINK))
  const placedBodies = bodies ?? []
  const particles: Particle[] = [],
    units: Unit[] = [],
    bonds: [number, number][] = []
  placedBodies.forEach((b, u) => {
    const first = particles.length
    for (const a of placed(b)) particles.push({ kind: a.kind, x: a.x, y: a.y, r: a.r, unit: u })
    units.push({ constituent: b.constituent, particles: b.atoms.map((_, i) => first + i) })
    for (const [i, j] of templates[b.constituent].bonds) bonds.push([first + i, first + j])
  })
  // The arrows come from a stream of their own, so that switching motion on never moves a particle.
  const arrows = params.motion ? motionArrows(placedBodies, params.state, w, h, scale, rng(SEED ^ 0x5a5a)) : []
  return { w, h, params, constituents: templates, scale, particles, units, bonds, arrows }
}

// ---------------------------------------------------------------- the picture

function particlePrims(m: ParticleModel): Prim[] {
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
    // The shaft stops at the foot of its head, so that the head is not drawn over the end of a line.
    const shafts: string[] = [],
      heads: string[] = []
    for (const a of m.arrows) {
      const l = Math.hypot(a.x1 - a.x0, a.y1 - a.y0),
        ux = (a.x1 - a.x0) / l,
        uy = (a.y1 - a.y0) / l,
        foot = Math.max(0, l - HEAD.length * m.scale * 0.8)
      shafts.push(`M${f(a.x0)} ${f(a.y0)}L${f(a.x0 + ux * foot)} ${f(a.y0 + uy * foot)}`)
      heads.push(arrowHeadD(a.x1, a.y1, ux, uy, HEAD.length * m.scale, HEAD.half * m.scale))
    }
    prims.push({ d: shafts.join(''), role: 'detail' }, { d: heads.join(''), role: 'ink' })
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
  min: { w: 120, h: 90 },
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
    return {
      prims: particlePrims(
        particleModel(w, h, {
          substance: str(p.substance, 'element') as Substance,
          state: str(p.state, 'gas') as State,
          count: num(p.count, 16),
          formula: str(p.formula, 'AB') as Formula,
          motion: bool(p.motion, false),
        }),
      ),
    }
  },
}

export const matter: SymbolDef[] = [particleBox]
