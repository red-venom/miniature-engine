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

// ---------------------------------------------------------------- priority B

const flatBottomFlask: SymbolDef = {
  id: 'flatBottomFlask',
  name: 'Flat-bottomed flask',
  pack: 'containers',
  size: { w: 110, h: 150 },
  resize: 'free',
  min: { w: 50, h: 70 },
  build({ w, h }) {
    // The bulb has the radius of roundBottomFlask. Its centre is lower: the circle cuts y = h in a chord 0.5w long, the flat base.
    const R = Math.min(w / 2, h * 0.42),
      n = Math.min(NECK, R) / 2,
      c = Math.min(w * 0.25, R * 0.85), // half the chord
      dc = Math.sqrt(R * R - c * c), // the centre of the circle is dc above the base
      cy = h - dc,
      rb = 6 // radius of the fillets at the base
    const yj = cy - Math.sqrt(R * R - n * n) // where the neck meets the bulb
    const a = Math.atan2(yj - cy, n) + 7 / R // blend end point on the bulb, right side, as roundBottomFlask
    const bx = R * Math.cos(a),
      by = cy + R * Math.sin(a)
    // Base fillet: a circle of radius rb inside the glass, tangent to the base line and to the bulb.
    const fx = Math.sqrt(Math.max(0, (R - rb) ** 2 - (dc - rb) ** 2)),
      fy = h - rb
    const t = P((R * fx) / (R - rb), cy + (R * (fy - cy)) / (R - rb)) // where the fillet leaves the bulb
    // One side, from the neck down to the centre of the base. sg = −1 is the left side.
    const side = (sg: number, top: number) =>
      new Path()
        .M(sg * n, top)
        .L(sg * n, yj - 7)
        .Q(sg * n, yj, sg * bx, by)
        .A(R, sg * t.x, t.y, sg > 0)
        .A(rb, sg * fx, h, sg > 0)
        .L(0, h)
    const body = (top: number) => side(-1, top).add(joinTo(reversed(side(1, top))))
    const outline = new Path()
      .M(-n - 3, 0)
      .L(-n, 4)
      .add(joinTo(body(4)))
      .L(n + 3, 0)
    return {
      prims: [{ d: outline.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: body(RIM).Z().polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: 2 * c },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * n },
        { id: 'neck', kind: 'neck', x: 0, y: yj * 0.5, width: 2 * n },
      ],
    }
  },
}

const pearFlask: SymbolDef = {
  id: 'pearFlask',
  name: 'Pear-shaped flask',
  pack: 'containers',
  size: { w: 90, h: 140 },
  resize: 'free',
  min: { w: 60, h: 90 },
  build({ w, h }) {
    const W = w / 2,
      n = Math.min(NECK, w * 0.45) / 2,
      yN = h * 0.25, // the neck ends
      yW = h * 0.68, // the widest part
      r = w * 0.3, // radius of the bottom arc
      cy = h - r
    // The bottom arc starts at J, at angle `phi` below the horizontal. The lower curve runs from the widest point to J. Its control points lie
    // on the two tangents (vertical at the widest point, the arc's tangent at J), so it is convex and has no kink at either end. A short, wide
    // box needs a larger phi, so that the tangent at J still meets the vertical one below the widest point.
    const deg = Math.PI / 180
    let phi = 50 * deg
    for (let i = 0; i < 12; i++) {
      const dx = W - r * Math.cos(phi),
        dy = cy + r * Math.sin(phi) - yW
      phi = Math.min(80 * deg, Math.max(50 * deg, Math.atan2(dx, 0.7 * dy)))
    }
    const J = P(r * Math.cos(phi), cy + r * Math.sin(phi))
    const dyA = yW - yN,
      yC = Math.max(J.y - (W - J.x) / Math.tan(phi), yW + 0.2 * (J.y - yW)) // where the two tangents meet
    const c1 = P(W, yW + 0.7 * (yC - yW)),
      c2 = P(J.x + 0.7 * (W - J.x), J.y + 0.7 * (yC - J.y))
    // One side, from the neck to the centre of the bottom: the neck, two cubic curves, the arc. Every join has a common tangent.
    const side = (sg: number, top: number) =>
      new Path()
        .M(sg * n, top)
        .L(sg * n, yN)
        .C(sg * n, yN + 0.4 * dyA, sg * W, yW - 0.45 * dyA, sg * W, yW)
        .C(sg * c1.x, c1.y, sg * c2.x, c2.y, sg * J.x, J.y)
        .A(r, 0, h, sg > 0)
    const body = (top: number) => side(-1, top).add(joinTo(reversed(side(1, top))))
    const outline = new Path()
      .M(-n - 3, 0)
      .L(-n, 4)
      .add(joinTo(body(4)))
      .L(n + 3, 0)
    return {
      prims: [{ d: outline.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: body(RIM).Z().polys() }],
      anchors: [
        { id: 'bottom', kind: 'round', x: 0, y: h, dir: 90, width: w },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * n },
        { id: 'neck', kind: 'neck', x: 0, y: yN * 0.5, width: 2 * n },
      ],
    }
  },
}

const sideArmTube: SymbolDef = {
  id: 'sideArmTube',
  name: 'Side-arm boiling tube',
  pack: 'containers',
  size: { w: NECK, h: 150 },
  resize: 'free',
  min: { w: 20, h: 70 },
  build({ w, h }) {
    const x = w / 2,
      ya = h * 0.16, // centre line of the side arm
      armL = 20,
      a = 4 // half-width of the side arm (8 wide)
    // As boilingTube.
    const body = (top: number) =>
      new Path()
        .M(-x, top)
        .L(-x, h - x)
        .A(x, x, h - x, false)
        .L(x, top)
    // The lower wall of the arm leaves the right wall of the tube with a small fillet; the upper wall comes back to it. The end of the arm is open.
    const lower = roundPoly([v(x, h - x), v(x, ya + a, 2), v(x + armL, ya + a)])
    const upper = roundPoly([v(x + armL, ya - a), v(x, ya - a, 2), v(x, 3.5)]).L(x + 2.5, 0)
    const left = new Path()
      .M(-x - 2.5, 0)
      .L(-x, 3.5)
      .L(-x, h - x)
      .A(x, x, h - x, false)
      .add(joinTo(lower))
    return {
      prims: [{ d: left.d() + upper.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: body(RIM).Z().polys() }], // stops at the tube wall: the arm opens into the tube
      anchors: [
        { id: 'bottom', kind: 'round', x: 0, y: h, dir: 90, width: w },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
        { id: 'sideArm', kind: 'port', x: x + armL, y: ya, dir: 0, width: 2 * a },
      ],
    }
  },
}

const crystallisingDish: SymbolDef = {
  id: 'crystallisingDish',
  name: 'Crystallising dish',
  pack: 'containers',
  size: { w: 150, h: 55 },
  resize: 'free',
  min: { w: 60, h: 24 },
  build({ w, h }) {
    const x = w / 2
    // Straight walls and a flat base. The left rim turns out 5 u as a spout.
    const outline = roundPoly([v(-x - 5, 0), v(-x, 4.5, 2), v(-x, h, 8), v(x, h, 8), v(x, 0)])
    const cavity = closed([v(-x, RIM), v(-x, h, 8), v(x, h, 8), v(x, RIM)])
    return {
      prims: [{ d: outline.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
      ],
    }
  },
}

const crucible: SymbolDef = {
  id: 'crucible',
  name: 'Crucible',
  pack: 'containers',
  size: { w: 54, h: 56 },
  resize: 'free',
  min: { w: 30, h: 30 },
  params: [{ key: 'lid', label: 'Lid', type: 'boolean', default: false }],
  build({ w, h, p }) {
    const x = w / 2,
      bx = w * 0.275, // half-width of the base (0.55w)
      rimX = (y: number) => x - ((x - bx) * y) / h // the wall slopes in as it goes down
    const outline = roundPoly([v(-x, 0), v(-bx, h, 5), v(bx, h, 5), v(x, 0)])
    const cavity = closed([v(-rimX(RIM), RIM), v(-bx, h, 5), v(bx, h, 5), v(rimX(RIM), RIM)])
    const prims: Prim[] = [{ d: outline.d(), role: 'outline' }]
    if (bool(p.lid, false)) {
      // Lid and knob are one outline: a shallow arc 1.1w wide, flat underneath on the rim, with a 6 u knob at the top.
      const L = w * 0.55,
        s = w * 0.09, // rise of the arc
        R = (L * L + s * s) / (2 * s),
        k = 3, // half-width of the knob
        yk = -s - 4 // top of the knob
      const arc = (px: number) => -s + R - Math.sqrt(R * R - px * px)
      const lid = new Path()
        .M(-L, 0)
        .A(R, -k, arc(k), true)
        .L(-k, yk + 1.5)
        .Q(-k, yk, -k + 1.5, yk)
        .L(k - 1.5, yk)
        .Q(k, yk, k, yk + 1.5)
        .L(k, arc(k))
        .A(R, L, 0, true)
        .Z()
      prims.push({ d: lid.d(), role: 'solid' })
    }
    return {
      prims,
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: 2 * bx },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
      ],
    }
  },
}

const reagentBottle: SymbolDef = {
  id: 'reagentBottle',
  name: 'Reagent bottle',
  aliases: ['bottle'],
  pack: 'containers',
  size: { w: 80, h: 140 },
  resize: 'free',
  min: { w: 50, h: 80 },
  params: [{ key: 'stopper', label: 'Stopper', type: 'boolean', default: true }],
  build({ w, h, p }) {
    const x = w / 2,
      n = Math.min(13, x * 0.45), // half-width of the neck (26 wide)
      neckBot = h * 0.16,
      stopper = bool(p.stopper, true)
    // Bottle as washBottle: shoulders of radius 14 into the neck. An open bottle has a 3 u rim flare; a stopper sits on the rim and hides it.
    const prof = (top: number): V[] => [v(n, top), v(n, neckBot, 14), v(x, neckBot, 14), v(x, h, 8)]
    const outline = stopper
      ? roundPoly(mirrorProfile(prof(0)))
      : new Path()
          .M(-n - 3, 0)
          .add(joinTo(roundPoly(mirrorProfile(prof(4)))))
          .L(n + 3, 0)
    // Stopper: a flat round head on the rim and a short plug in the neck, one outline. The plug lies on the neck lines, so the cavity
    // starts under it and the white plug never covers a liquid.
    const hw = n + 6, // half-width of the head
      hh = 7, // height of the head
      pd = Math.min(8, neckBot * 0.45) // depth of the plug
    const plug = closed([v(-hw, -hh, 3), v(hw, -hh, 3), v(hw, 0, 1), v(n, 0), v(n, pd), v(-n, pd), v(-n, 0), v(-hw, 0, 1)])
    const cavity = closed(mirrorProfile(prof(stopper ? pd + 1 : RIM)))
    const prims: Prim[] = [{ d: outline.d(), role: 'outline' }]
    if (stopper) prims.push({ d: plug.d(), role: 'solid' })
    return {
      prims,
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * n },
      ],
    }
  },
}

const gasJar: SymbolDef = {
  id: 'gasJar',
  name: 'Gas jar',
  pack: 'containers',
  size: { w: 70, h: 170 },
  resize: 'free',
  min: { w: 30, h: 80 },
  params: [{ key: 'lid', label: 'Lid', type: 'boolean', default: false }],
  build({ w, h, p }) {
    const x = w / 2
    // Straight cylinder, flat base. The rim is a flat flange, 5 u out on each side.
    const outline = roundPoly([v(-x - 5, 0), v(-x, 0, 2), v(-x, h, 4), v(x, h, 4), v(x, 0, 2), v(x + 5, 0)])
    const cavity = closed([v(-x, RIM), v(-x, h, 4), v(x, h, 4), v(x, RIM)])
    const prims: Prim[] = [{ d: outline.d(), role: 'outline' }]
    if (bool(p.lid, false)) prims.push({ d: rect(-x - 8, -3, x + 8, 0), role: 'solid' }) // a glass plate on the flange
    return {
      prims,
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
      ],
    }
  },
}

const uTube: SymbolDef = {
  id: 'uTube',
  name: 'U-tube',
  label: 'U-tube',
  pack: 'containers',
  size: { w: 110, h: 150 },
  resize: 'free',
  min: { w: 64, h: 80 },
  build({ w, h }) {
    const tw = Math.min(24, w * 0.4), // the tube is 24 wide inside
      R = Math.min(w / 2, h - 16), // outer radius of the bend
      ri = R - tw, // inner radius of the bend
      cy = h - R // centre of the bend
    // One wall of the tube: a straight arm, a half-circle (two quarter arcs), a straight arm, each rim flared 2 u. The two walls are drawn open at the top.
    const wall = (r: number, flare: number) =>
      new Path()
        .M(-r - flare, 0)
        .L(-r, 3.5)
        .L(-r, cy)
        .A(r, 0, cy + r, false)
        .A(r, r, cy, false)
        .L(r, 3.5)
        .L(r + flare, 0)
    const cavity = new Path()
      .M(-R, RIM)
      .L(-R, cy)
      .A(R, 0, cy + R, false)
      .A(R, R, cy, false)
      .L(R, RIM)
      .L(ri, RIM)
      .L(ri, cy)
      .A(ri, 0, cy + ri, true)
      .A(ri, -ri, cy, true)
      .L(-ri, RIM)
      .Z()
    return {
      prims: [{ d: wall(R, 2).d() + wall(ri, -2).d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'mouthL', kind: 'mouth', x: -(R - tw / 2), y: 0, dir: -90, width: tw },
        { id: 'mouthR', kind: 'mouth', x: R - tw / 2, y: 0, dir: -90, width: tw },
      ],
    }
  },
}

const copperCalorimeter: SymbolDef = {
  id: 'copperCalorimeter',
  name: 'Calorimeter (metal can)',
  aliases: ['copper can', 'copper calorimeter'],
  pack: 'containers',
  size: { w: 80, h: 90 },
  resize: 'free',
  min: { w: 30, h: 30 },
  build({ w, h }) {
    const x = w / 2
    // Straight can, flat base, no lip.
    const outline = roundPoly([v(-x, 0), v(-x, h, 3), v(x, h, 3), v(x, 0)])
    const cavity = closed([v(-x, RIM), v(-x, h, 3), v(x, h, 3), v(x, RIM)])
    return {
      prims: [{ d: outline.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
      ],
    }
  },
}

export const containers: SymbolDef[] = [
  volumetricFlask,
  buchnerFlask,
  evaporatingBasin,
  watchGlass,
  polystyreneCup,
  washBottle,
  displacementCan,
  flatBottomFlask,
  pearFlask,
  sideArmTube,
  crystallisingDish,
  crucible,
  reagentBottle,
  gasJar,
  uTube,
  copperCalorimeter,
]
