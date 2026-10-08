// filtering.ts — the "Filtering" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { P, Path, clipH, f, roundPoly, v, type Pt, type V } from '../kernel/geom'
import { RIM, bool, closed, rect } from './kit'
import type { Prim, SymbolDef } from './types'

const line = (x0: number, y0: number, x1: number, y1: number): string => `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`

const buchnerFunnel: SymbolDef = {
  id: 'buchnerFunnel',
  name: 'Büchner funnel',
  label: 'Büchner funnel',
  aliases: ['Buchner funnel'],
  pack: 'filtering',
  size: { w: 100, h: 116 },
  resize: 'free',
  min: { w: 40, h: 50 },
  params: [{ key: 'paper', label: 'Filter paper', type: 'boolean', default: true }],
  build({ w, h, p }) {
    const x = w / 2,
      s = 4.5,
      yp = h * 0.38, // the perforated plate
      ys = h * 0.66 // where the cone meets the stem
    // One wall each side: straight top, a rounded join into the cone, a sharp join into the stem. The stem end is cut at an angle.
    const wall = (side: number, end: number) => roundPoly([v(side * x, 0), v(side * x, yp, 5), v(side * s, ys), v(side * s, end)])
    const prims: Prim[] = [{ d: line(-x, yp, x, yp), role: 'dashed' }]
    if (bool(p.paper, true)) prims.push({ d: line(-x, yp - 2, x, yp - 2), role: 'detail' })
    prims.push({ d: wall(-1, h - 9).d() + wall(1, h).d(), role: 'outline' })
    return {
      prims,
      cavities: [{ id: 'main', polys: new Path().M(-x, RIM).L(-x, yp).L(x, yp).L(x, RIM).Z().polys() }],
      anchors: [
        { id: 'stem', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'rim', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
      ],
    }
  },
}

const separatingFunnel: SymbolDef = {
  id: 'separatingFunnel',
  name: 'Separating funnel',
  aliases: ['separatory funnel', 'tap funnel'],
  pack: 'filtering',
  size: { w: 90, h: 250 },
  resize: 'free',
  min: { w: 40, h: 120 },
  params: [{ key: 'stopper', label: 'Stopper', type: 'boolean', default: true }],
  build({ w, h, p }) {
    const n = 11, // half-width of the neck
      x = w / 2,
      yn = h * 0.1, // bottom of the neck
      yw = h * 0.3, // widest point
      yt = h * 0.74, // centre of the tap
      s = 3.2, // half-width of the stem
      yb = yt - 7 - 8 // where the body meets the stem above the tap
    // One side of the body, from the neck down to the stem: a round shoulder, then a cone that eases into the stem.
    const body = (side: number, path: Path) =>
      path
        .L(side * n, yn)
        .C(side * n, yn + (yw - yn) * 0.8, side * x, yw - (yw - yn) * 0.5, side * x, yw)
        .C(side * x, yw + (yb - yw) * 0.4, side * s, yb - (yb - yw) * 0.35, side * s, yb)
        .L(side * s, yt - 7)
    const outline = body(-1, new Path().M(-n - 2, 0).L(-n, 2.5)).d() + body(1, new Path().M(n + 2, 0).L(n, 2.5)).d()
    const stem = line(-s, yt + 7, -s, h - 6) + line(s, yt + 7, s, h)
    const cavity = body(-1, new Path().M(-n, RIM))
    cavity.L(s, yt - 7) // across the top of the tap
    // Up the right side: the mirror of the left, in reverse.
    cavity
      .L(s, yb)
      .C(s, yb - (yb - yw) * 0.35, x, yw + (yb - yw) * 0.4, x, yw)
      .C(x, yw - (yw - yn) * 0.5, n, yn + (yw - yn) * 0.8, n, yn)
      .L(n, RIM)
      .Z()
    const prims: Prim[] = [
      { d: outline + stem, role: 'outline' },
      { d: rect(-7, yt - 7, 7, yt + 7), role: 'solid' },
      { d: `M7 ${f(yt - 2.5)}H19V${f(yt - 7)}H24V${f(yt + 7)}H19V${f(yt + 2.5)}H7`, role: 'solid' },
    ]
    // Stopper: a flat head above the rim and a tapered plug in the neck, 26 wide and 16 high in all.
    if (bool(p.stopper, true))
      prims.push({
        d: roundPoly([v(-13, -6, 1.5), v(13, -6, 1.5), v(13, 0), v(10, 0), v(9, 10, 1), v(-9, 10, 1), v(-10, 0), v(-13, 0)], true).d(),
        role: 'solid',
      })
    return {
      prims,
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'stem', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * n },
        { id: 'neck', kind: 'neck', x: 0, y: yn * 0.5, width: 2 * n },
      ],
    }
  },
}

// ---------------------------------------------------------------- release 1.1 (priority B)

/**
 * A tap funnel with a cylinder body. Neck, tap and stem are those of separatingFunnel: a neck 22 wide, a tap 14 by 14 with its key to
 * the right, and a stem 6.4 wide that is cut at an angle.
 */
const droppingFunnel: SymbolDef = {
  id: 'droppingFunnel',
  name: 'Dropping funnel',
  aliases: ['tap funnel', 'addition funnel'],
  pack: 'filtering',
  size: { w: 60, h: 230 },
  resize: 'free',
  min: { w: 40, h: 150 },
  build({ w, h }) {
    const n = 11, // half-width of the neck
      x = w / 2,
      s = 3.2, // half-width of the stem
      yn = 0.1 * h, // the neck ends and the body starts
      yc = 0.6 * h, // the body ends: a cylinder from 0.1h to 0.6h with round shoulders
      yt = 0.74 * h, // centre of the tap
      yb = yt - 7 - 6 // where the cone meets the stem above the tap
    // One wall from the neck down to the top of the tap: neck, round shoulder, cylinder, round shoulder, straight cone (sharp at the stem).
    const wall = (sd: number, top: number): V[] => [v(sd * n, top), v(sd * n, yn, 3), v(sd * x, yn, 14), v(sd * x, yc, 14), v(sd * s, yb), v(sd * s, yt - 7)]
    const outline = (sd: number) => roundPoly([v(sd * (n + 2), 0), v(sd * n, 2.5), ...wall(sd, 2.5).slice(1)])
    const cavity = closed([...wall(-1, RIM), ...wall(1, RIM).reverse()])
    return {
      prims: [
        { d: outline(-1).d() + outline(1).d() + line(-s, yt + 7, -s, h - 6) + line(s, yt + 7, s, h), role: 'outline' },
        { d: rect(-7, yt - 7, 7, yt + 7), role: 'solid' }, // tap body
        { d: `M7 ${f(yt - 2.5)}H19V${f(yt - 7)}H24V${f(yt + 7)}H19V${f(yt + 2.5)}H7`, role: 'solid' }, // its key
      ],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'stem', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * n },
      ],
    }
  },
}

/** The centre of the circle that touches circle 1 (radius r1) and circle 2 (radius r2) from outside: of the two, the one at larger x. */
function touching(c1: Pt, r1: number, c2: Pt, r2: number): Pt {
  const d = Math.hypot(c2.x - c1.x, c2.y - c1.y),
    a = (r1 * r1 - r2 * r2 + d * d) / (2 * d),
    hh = Math.sqrt(Math.max(0, r1 * r1 - a * a)),
    ux = (c2.x - c1.x) / d,
    uy = (c2.y - c1.y) / d
  const p = P(c1.x + a * ux - hh * uy, c1.y + a * uy + hh * ux),
    q = P(c1.x + a * ux + hh * uy, c1.y + a * uy - hh * ux)
  return p.x > q.x ? p : q
}

/** The point of a circle (centre c, radius r) where a circle of radius rho and centre `at` touches it from outside. */
const touchPoint = (c: Pt, r: number, at: Pt, rho: number): Pt => P(c.x + ((at.x - c.x) * r) / (r + rho), c.y + ((at.y - c.y) * r) / (r + rho))

/**
 * A bowl-shaped cup on a small bulb on a long stem. The outline is made of circular arcs that touch: the bowl (44 wide and 26 deep),
 * a small fillet, the bulb (a circle 18 wide), another fillet and the straight stem (7 wide).
 */
const thistleFunnel: SymbolDef = {
  id: 'thistleFunnel',
  name: 'Thistle funnel',
  pack: 'filtering',
  size: { w: 44, h: 270 },
  resize: 'height',
  min: { w: 44, h: 120 },
  build({ h }) {
    const x = 22, // half-width of the cup (44 wide)
      depth = 26, // the bowl is 26 deep on the centre line
      b = 9, // radius of the bulb (18 wide)
      s = 3.5, // half-width of the stem (7 wide)
      xn = 5.5, // where the bowl meets the bulb
      r1 = 3, // fillets: where the bowl meets the bulb, and where the bulb meets the stem (glass corners are 3 u or more: S4)
      r2 = 3
    // The bowl is the arc through the rim (x, 0) and the bottom (0, depth) with its centre on the line y = 0.
    const cx = (x * x - depth * depth) / (2 * x),
      R = x - cx,
      c1 = P(cx, 0)
    const yn = Math.sqrt(R * R - (xn - cx) ** 2), // the bowl at x = xn: the shoulder of the bulb is there
      c2 = P(0, yn + Math.sqrt(b * b - xn * xn)) // centre of the bulb
    const f1 = touching(c1, R + r1, c2, b + r1) // the fillet between the bowl and the bulb
    const t1 = touchPoint(c1, R, f1, r1),
      t2 = touchPoint(c2, b, f1, r1)
    const yg = c2.y + Math.sqrt((b + r2) ** 2 - (s + r2) ** 2) // the fillet between the bulb and the stem touches the line x = s here
    const t3 = touchPoint(c2, b, P(s + r2, yg), r2)
    // One wall from the rim down to y = end. sd = -1 is the left wall: a mirror, so every sweep flag flips.
    const wall = (sd: number, end: number) => {
      const sw = (clockwise: boolean) => (sd > 0 ? clockwise : !clockwise)
      return new Path()
        .M(sd * x, 0)
        .A(R, sd * t1.x, t1.y, sw(true))
        .A(r1, sd * t2.x, t2.y, sw(false))
        .A(b, sd * t3.x, t3.y, sw(true))
        .A(r2, sd * s, yg, sw(false))
        .L(sd * s, end)
    }
    // The stem is cut at an angle: the left wall is 6 u shorter. The cavity is the same outline, closed 1.5 u below the rim.
    const left = wall(-1, h).polys(0.05)[0]
    const right = left.map((q) => P(-q.x, q.y)).reverse()
    left[left.length - 1] = P(-s, h - 6)
    return {
      prims: [{ d: wall(-1, h - 6).d() + wall(1, h).d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: [clipH([...left, ...right], RIM, 'below')] }],
      anchors: [
        { id: 'stem', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * x },
      ],
    }
  },
}

export const filtering: SymbolDef[] = [buchnerFunnel, separatingFunnel, droppingFunnel, thistleFunnel]
