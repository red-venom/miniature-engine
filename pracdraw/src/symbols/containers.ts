// containers.ts — the "Containers" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { P, Path, f, mirrorProfile, roundPoly, v, type Pt, type V } from '../kernel/geom'
import { NECK, RIM, bool, closed, joinTo, rect } from './kit'
import type { Prim, SymbolDef } from './types'

// ---------------------------------------------------------------- helpers (this file only)

/** The same path drawn backwards: arcs swap their sweep, curves swap their control points. One open subpath only. */
function reversed(p: Path): Path {
  const segs = p.segs
  const q = new Path()
  const at = (i: number): Pt => {
    const s = segs[i]
    return s.k === 'Z' ? P(0, 0) : s.p
  }
  const end = at(segs.length - 1)
  q.M(end.x, end.y)
  for (let i = segs.length - 1; i > 0; i--) {
    const s = segs[i],
      to = at(i - 1)
    if (s.k === 'L') q.L(to.x, to.y)
    else if (s.k === 'A') q.A(s.r, to.x, to.y, !s.sweep, s.large)
    else if (s.k === 'Q') q.Q(s.c.x, s.c.y, to.x, to.y)
    else if (s.k === 'C') q.C(s.c2.x, s.c2.y, s.c1.x, s.c1.y, to.x, to.y)
  }
  return q
}

/**
 * The two walls of a bent tube of width 2·hw whose centre line is a polyline with bend radius `bend` at each inner vertex.
 * Returns the wall on each side of the centre line, as vertices for roundPoly: the outer wall of a bend gets radius bend + hw,
 * the inner wall bend − hw.
 */
function tubeWalls(centre: Pt[], hw: number, bend: number): [V[], V[]] {
  const dirs = centre.slice(1).map((p, i) => {
    const dx = p.x - centre[i].x,
      dy = p.y - centre[i].y,
      l = Math.hypot(dx, dy) || 1
    return P(dx / l, dy / l)
  })
  const normal = (d: Pt) => P(-d.y, d.x)
  const wall = (s: number): V[] =>
    centre.map((p, i) => {
      if (i === 0 || i === centre.length - 1) {
        const n = normal(dirs[Math.min(i, dirs.length - 1)])
        return v(p.x + s * hw * n.x, p.y + s * hw * n.y)
      }
      const d1 = dirs[i - 1],
        d2 = dirs[i],
        n1 = normal(d1),
        n2 = normal(d2)
      // Intersection of the two offset lines (the miter point).
      const a = P(p.x + s * hw * n1.x, p.y + s * hw * n1.y)
      const b = P(p.x + s * hw * n2.x, p.y + s * hw * n2.y)
      const cross = d1.x * d2.y - d1.y * d2.x
      let m = a
      if (Math.abs(cross) > 1e-9) {
        const t = ((b.x - a.x) * d2.y - (b.y - a.y) * d2.x) / cross
        m = P(a.x + d1.x * t, a.y + d1.y * t)
      }
      return v(m.x, m.y, Math.max(0.5, bend - s * Math.sign(cross) * hw))
    })
  return [wall(-1), wall(1)]
}

// ---------------------------------------------------------------- symbols

const volumetricFlask: SymbolDef = {
  id: 'volumetricFlask',
  name: 'Volumetric flask',
  aliases: ['standard flask', 'graduated flask'],
  pack: 'containers',
  size: { w: 110, h: 210 },
  resize: 'free',
  min: { w: 50, h: 100 },
  params: [
    { key: 'stopper', label: 'Stopper', type: 'boolean', default: false },
    { key: 'mark', label: 'Mark', type: 'boolean', default: true },
  ],
  build({ w, h, p }) {
    // Bulb: circle of radius 0.44w, centre 0.36w above the base: a chord 0.5w long is the flat base.
    // A wide, short box would push the bulb through the top: then the bulb follows the height instead.
    const s = Math.min(w, (h - 30) / 0.8),
      R = 0.44 * s,
      cy = h - 0.36 * s,
      n = Math.min(9, R * 0.45), // half-width of the neck (18 wide)
      rf = Math.min(10, R * 0.4), // fillet where the neck meets the bulb
      rb = 6 // fillet at the base
    // Neck fillet: a circle of radius rf outside the glass, tangent to the neck wall and to the bulb.
    const fcx = n + rf,
      fcy = cy - Math.sqrt((R + rf) ** 2 - fcx * fcx)
    const fl = Math.hypot(fcx, fcy - cy)
    const t1 = P((R * fcx) / fl, cy + (R * (fcy - cy)) / fl) // where the fillet meets the bulb
    // Base fillet: a circle of radius rb inside the glass, tangent to the base line and to the bulb.
    const bcy = h - rb,
      bcx = Math.sqrt(Math.max(0, (R - rb) ** 2 - (bcy - cy) ** 2))
    const bl = Math.hypot(bcx, bcy - cy)
    const t2 = P((R * bcx) / bl, cy + (R * (bcy - cy)) / bl) // where the base fillet leaves the bulb
    // One side, from the neck top down to the centre of the base. sg = −1 is the left side.
    const side = (sg: number, top: number) =>
      new Path()
        .M(sg * n, top)
        .L(sg * n, fcy)
        .A(rf, sg * t1.x, t1.y, sg < 0)
        .A(R, sg * t2.x, t2.y, sg > 0)
        .A(rb, sg * bcx, h, sg > 0)
        .L(0, h)
    const body = (top: number) => side(-1, top).add(joinTo(reversed(side(1, top))))
    const outline = new Path()
      .M(-n - 2, 0)
      .L(-n, 3)
      .add(joinTo(body(3)))
      .L(n + 2, 0)
    const prims: Prim[] = []
    if (bool(p.mark, true)) prims.push({ d: `M${f(-n)} ${f(h * 0.2)}H${f(n)}`, role: 'detail' })
    prims.push({ d: outline.d(), role: 'outline' })
    if (bool(p.stopper, false)) prims.push({ d: closed([v(-11, -14, 3), v(11, -14, 3), v(11, 0, 1), v(-11, 0, 1)]).d(), role: 'solid' })
    return {
      prims,
      cavities: [{ id: 'main', polys: body(RIM).Z().polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: 2 * bcx + 2 * rb },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * n },
        { id: 'neck', kind: 'neck', x: 0, y: fcy * 0.5, width: 2 * n },
      ],
    }
  },
}

const buchnerFlask: SymbolDef = {
  id: 'buchnerFlask',
  name: 'Büchner flask',
  label: 'Büchner flask',
  aliases: ['side-arm flask', 'filter flask', 'Buchner flask'],
  pack: 'containers',
  size: { w: 120, h: 150 },
  resize: 'free',
  min: { w: 60, h: 80 },
  build({ w, h }) {
    const n = Math.min(NECK, w * 0.5) / 2,
      neckH = h * 0.26,
      x = w / 2,
      ya = h * 0.14, // centre line of the side arm
      armL = 22,
      a = 4 // half-width of the side arm
    const left = roundPoly([v(-n - 3, 0), v(-n, 4, 2), v(-n, neckH, 16), v(-x, h, 10), v(x, h, 10), v(n, neckH, 16), v(n, ya + a, 2), v(n + armL, ya + a)])
    const right = roundPoly([v(n + armL, ya - a), v(n, ya - a, 2), v(n, 4, 2), v(n + 3, 0)])
    const cavity = closed([v(-n, RIM), v(-n, neckH, 16), v(-x, h, 10), v(x, h, 10), v(n, neckH, 16), v(n, RIM)])
    return {
      prims: [{ d: left.d() + right.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * n },
        { id: 'neck', kind: 'neck', x: 0, y: neckH * 0.5, width: 2 * n },
        { id: 'sideArm', kind: 'port', x: n + armL, y: ya, dir: 0, width: 2 * a },
      ],
    }
  },
}

const evaporatingBasin: SymbolDef = {
  id: 'evaporatingBasin',
  name: 'Evaporating basin',
  aliases: ['evaporating dish'],
  pack: 'containers',
  size: { w: 120, h: 44 },
  resize: 'free',
  min: { w: 50, h: 20 },
  build({ w, h }) {
    const x = w / 2,
      fx = w * 0.15 // half-width of the foot
    // Each wall is one quadratic curve from the rim to the foot end; its control point is under the rim.
    const bowl = (top: number) => new Path().M(-x, top).Q(-x, h, -fx, h).L(fx, h).Q(x, h, x, top)
    const outline = new Path().M(-x - 6, -3).add(joinTo(bowl(0)))
    return {
      prims: [{ d: outline.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: bowl(RIM).Z().polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: 2 * fx },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
      ],
    }
  },
}

const watchGlass: SymbolDef = {
  id: 'watchGlass',
  name: 'Watch glass',
  aliases: ['clock glass'],
  pack: 'containers',
  size: { w: 110, h: 14 },
  resize: 'width',
  min: { w: 40, h: 14 },
  build({ w, h }) {
    const x = w / 2,
      R = (x * x + h * h) / (2 * h) // the arc through (±x, 0) and (0, h)
    return {
      prims: [{ d: new Path().M(-x, 0).A(R, x, 0, false).d(), role: 'outline' }],
      anchors: [
        { id: 'under', kind: 'base', x: 0, y: h, dir: 90, width: w * 0.5 }, // stands on a surface
        { id: 'edge', kind: 'base', x: 0, y: 0, dir: 90, width: w }, // rests on a rim, bowl inside the mouth
        { id: 'top', kind: 'surface', x: 0, y: 0, dir: -90, width: w },
      ],
    }
  },
}

const polystyreneCup: SymbolDef = {
  id: 'polystyreneCup',
  name: 'Polystyrene cup',
  aliases: ['insulated cup', 'calorimeter cup'],
  pack: 'containers',
  size: { w: 84, h: 104 },
  resize: 'free',
  min: { w: 40, h: 40 },
  params: [{ key: 'lid', label: 'Lid', type: 'boolean', default: true }],
  build({ w, h, p }) {
    const x = w / 2,
      bx = w * 0.34, // half-width of the base
      t = 5, // wall thickness
      k = (x - bx) / h, // slope of the wall
      i = t * Math.hypot(1, k) // horizontal inset of the inner wall
    const ibx = bx + t * k - i // half-width of the inside at the inside bottom (y = h − t)
    // The wall: outer outline down and round, inner outline back up, closed across the rim.
    const wall = closed([v(-x, 0), v(-bx, h, 4), v(bx, h, 4), v(x, 0), v(x - i, 0), v(ibx, h - t, 2), v(-ibx, h - t, 2), v(-x + i, 0)])
    const cavity = closed([v(-x + i, RIM), v(-ibx, h - t, 2), v(ibx, h - t, 2), v(x - i, RIM)])
    const prims: Prim[] = [{ d: wall.d(), role: 'solid' }]
    if (bool(p.lid, true)) {
      // Lid: a slab with a centre hole for a thermometer, in two pieces as the bung.
      const lx = x + 4,
        hole = 5
      prims.push({ d: rect(-lx, -6, -hole, 0) + rect(hole, -6, lx, 0), role: 'solid' })
    }
    return {
      prims,
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: 2 * bx },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * (x - i) },
      ],
    }
  },
}

const washBottle: SymbolDef = {
  id: 'washBottle',
  name: 'Wash bottle',
  aliases: ['distilled water bottle'],
  pack: 'containers',
  size: { w: 70, h: 150 },
  resize: 'free',
  min: { w: 44, h: 90 },
  build({ w, h }) {
    const x = w / 2,
      n = 11, // half-width of the neck (22 wide)
      capTop = 24, // the bent tube above the cap needs the room
      capBot = capTop + 12,
      neckBot = capBot + h * 0.16,
      tw = 2.5 // half-width of the delivery tube (5 wide)
    // Bottle: as reagentBottle. The cap covers the mouth, so the glass starts under the cap.
    const prof = (top: number): V[] => [v(n, top), v(n, neckBot, 14), v(x, neckBot, 14), v(x, h, 8)]
    const outline = roundPoly(mirrorProfile(prof(capBot)))
    const cavity = closed(mirrorProfile(prof(capBot + RIM)))
    // Delivery tube: up the centre from 12 u above the base, through the cap, then bent to run 34 u down-left to a jet.
    const run = 34,
      ang = Math.PI / 6, // 30° below horizontal
      bendY = 6
    const jet = P(-run * Math.cos(ang), bendY + run * Math.sin(ang))
    const [wa, wb] = tubeWalls([P(0, h - 12), P(0, bendY), jet], tw, 7)
    // The jet: the last 8 u of each wall narrows the tube to 3 wide.
    const taper = (wall: V[], s: number) => {
      const end = wall[wall.length - 1],
        back = P(end.x + 8 * Math.cos(ang), end.y - 8 * Math.sin(ang))
      const nx = -Math.sin(ang),
        ny = -Math.cos(ang) // unit normal to the run, on the same side as tubeWalls puts s = +1
      const path = roundPoly([wall[0], wall[1], v(back.x, back.y)])
      return path.L(jet.x + s * 1.5 * nx, jet.y + s * 1.5 * ny)
    }
    const tube = taper(wa, -1).d() + taper(wb, 1).d()
    return {
      prims: [
        { d: outline.d(), role: 'outline' },
        { d: rect(-14, capTop, -tw, capBot) + rect(tw, capTop, 14, capBot), role: 'solid' }, // cap, in two pieces round the tube
        { d: tube, role: 'outline' },
      ],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [{ id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w }],
    }
  },
}

const displacementCan: SymbolDef = {
  id: 'displacementCan',
  name: 'Displacement can',
  aliases: ['eureka can', 'overflow can'],
  pack: 'containers',
  size: { w: 90, h: 130 },
  resize: 'free',
  min: { w: 40, h: 60 },
  build({ w, h }) {
    const x = w / 2,
      ys = h * 0.22, // where the spout leaves the wall
      a = 4.5, // half-width of the spout (9 wide)
      len = 30,
      c = Math.cos(Math.PI / 6),
      s = Math.sin(Math.PI / 6)
    // The spout walls are the axis offset by ±a; each meets the can wall at ys ∓ a / cos 30°.
    const dy = a / c
    const end = P(x + len * c, ys + len * s)
    const upper = P(end.x + a * s, end.y - a * c),
      lower = P(end.x - a * s, end.y + a * c)
    const can = roundPoly([v(-x, 0), v(-x, h, 4), v(x, h, 4), v(x, ys + dy), v(lower.x, lower.y)])
    const top = new Path()
      .M(upper.x, upper.y)
      .L(x, ys - dy)
      .L(x, 0)
    const cavity = closed([v(-x, RIM), v(-x, h, 4), v(x, h, 4), v(x, RIM)])
    return {
      prims: [{ d: can.d() + top.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'spout', kind: 'port', x: end.x, y: end.y, dir: 30, width: 2 * a },
      ],
    }
  },
}

export const containers: SymbolDef[] = [volumetricFlask, buchnerFlask, evaporatingBasin, watchGlass, polystyreneCup, washBottle, displacementCan]
