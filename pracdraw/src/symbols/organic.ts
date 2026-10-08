// organic.ts — the "Organic" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { Path, P, polyD, rng, roundPoly, v, type Pt, type V } from '../kernel/geom'
import { CONE_END, CONE_LEN, HOLE, NECK, RIM, circle, closed, rect } from './kit'
import type { Prim, SymbolDef } from './types'

const S = NECK / 2, // half-width of a socket mouth and of a cone shoulder
  E = CONE_END / 2, // half-width of a cone end and of a socket throat
  ARM = 18, // slope of a still-head arm and of a receiver socket, degrees below +x
  BORE_ARM = 6.5 // half-width of the 13 u arm tube
const rad = (deg: number) => (deg * Math.PI) / 180

/** Points along a sloping tube: `t` along its axis from `o`, `s` across it (positive = clockwise of the axis on screen). */
function along(o: Pt, deg: number) {
  const c = Math.cos(rad(deg)),
    s = Math.sin(rad(deg))
  return (t: number, n: number): Pt => P(o.x + t * c - n * s, o.y + t * s + n * c)
}
const vp = (p: Pt, r = 0): V => v(p.x, p.y, r)

/**
 * Three-way adaptor between a flask, a thermometer adaptor and a condenser. The upright tube stands at the left of the box
 * so that the arm and its cone fit in it. Each joint has the shared sizes, so it fits any neck, socket or cone.
 */
const stillHead: SymbolDef = {
  id: 'stillHead',
  name: 'Still head',
  aliases: ['distillation head', 'three-way adaptor'],
  pack: 'organic',
  size: { w: 130, h: 130 },
  resize: 'none',
  build({ w, h }) {
    const xc = -w / 2 + 17, // centre line of the upright tube
      a = 14, // half-width of the upright tube
      yArm = 0.3 * h,
      yShoulder = h - CONE_LEN
    const arm = along(P(xc + a, yArm), ARM) // arm axis, from the right wall of the upright tube
    const dy = BORE_ARM / Math.cos(rad(ARM)) // where the arm walls meet the upright wall, above and below the axis
    // Left wall: socket, tube, shoulder, cone.
    const left = roundPoly([v(xc - S, 0), v(xc - a, CONE_LEN, 3), v(xc - a, yShoulder - 10, 6), v(xc - S, yShoulder, 3), v(xc - a, h)])
    // Right wall, upper piece: socket, tube, then the upper wall of the arm out to its cone.
    const upper = roundPoly([
      v(xc + S, 0),
      v(xc + a, CONE_LEN, 3),
      v(xc + a, yArm - dy, 4),
      vp(arm(60, -BORE_ARM), 6),
      vp(arm(70, -S), 3),
      vp(arm(70 + CONE_LEN, -E)),
    ])
    // Right wall, lower piece: the lower wall of the arm back to the tube, then the shoulder and cone.
    const lower = roundPoly([
      vp(arm(70 + CONE_LEN, E)),
      vp(arm(70, S), 3),
      vp(arm(60, BORE_ARM), 6),
      v(xc + a, yArm + dy, 4),
      v(xc + a, yShoulder - 10, 6),
      v(xc + S, yShoulder, 3),
      v(xc + a, h),
    ])
    const sRim = S - (RIM * (S - E)) / CONE_LEN // half-width of the socket RIM below its mouth
    const cavity = closed([
      v(xc - sRim, RIM),
      v(xc - a, CONE_LEN, 3),
      v(xc - a, yShoulder - 10, 6),
      v(xc - S, yShoulder, 3),
      v(xc - a, h),
      v(xc + a, h),
      v(xc + S, yShoulder, 3),
      v(xc + a, yShoulder - 10, 6),
      v(xc + a, CONE_LEN, 3),
      v(xc + sRim, RIM),
    ])
    const shoulder = arm(70, 0)
    return {
      prims: [{ d: left.d() + upper.d() + lower.d(), role: 'outline' }],
      cavities: [{ id: 'inner', polys: cavity.polys() }],
      anchors: [
        { id: 'bottom', kind: 'plug', x: xc, y: yShoulder, dir: 90, width: NECK },
        { id: 'top', kind: 'mouth', x: xc, y: 0, dir: -90, width: NECK },
        { id: 'arm', kind: 'plug', x: shoulder.x, y: shoulder.y, dir: ARM, width: NECK },
      ],
    }
  },
}

/** Bent tube from the cone of a condenser down into a receiving flask. Its socket takes the condenser's cone. */
const receiverAdaptor: SymbolDef = {
  id: 'receiverAdaptor',
  name: 'Receiver adaptor',
  aliases: ['receiver bend', 'delivery adaptor'],
  pack: 'organic',
  size: { w: 110, h: 110 },
  resize: 'none',
  build({ w, h }) {
    const R = 20, // centre-line radius of the bend
      a = BORE_ARM,
      out = 5, // half-width of the outlet
      xOut = 0.25 * w,
      cut = 7 // the outlet is cut at an angle: the left wall is this much shorter
    const mouth = P(-w / 2 + 6, 17) // centre of the socket mouth: its upper corner touches the top of the box
    const tube = along(mouth, ARM)
    const sinA = Math.sin(rad(ARM)),
      cosA = Math.cos(rad(ARM))
    // The bend ends pointing down at x = xOut. Its centre is R to the left of that; it starts R·cos(ARM) above the centre.
    const xC = xOut - R
    const tB = (xC + R * sinA - mouth.x) / cosA // where the straight tube meets the bend
    const yC = mouth.y + tB * sinA + R * cosA
    const yTaper = h - 20
    const upper = roundPoly([vp(tube(0, -S)), vp(tube(CONE_LEN, -E), 3), vp(tube(CONE_LEN + 10, -a), 6), vp(tube(tB, -a))])
      .A(R + a, xC + R + a, yC)
      .L(xOut + a, yTaper)
      .L(xOut + out, h)
    const lower = roundPoly([vp(tube(0, S)), vp(tube(CONE_LEN, E), 3), vp(tube(CONE_LEN + 10, a), 6), vp(tube(tB, a))])
      .A(R - a, xC + R - a, yC)
      .L(xOut - a, yTaper)
      .L(xOut - out, h - cut)
    const t0 = CONE_LEN + 10 // the cavity starts where the tube is 13 wide
    const cavity = new Path()
      .M(tube(t0, -a).x, tube(t0, -a).y)
      .L(tube(tB, -a).x, tube(tB, -a).y)
      .A(R + a, xC + R + a, yC)
      .L(xOut + a, yTaper)
      .L(xOut + out, h)
      .L(xOut - out, h - cut)
      .L(xOut - a, yTaper)
      .L(xC + R - a, yC)
      .A(R - a, tube(tB, a).x, tube(tB, a).y, false)
      .L(tube(t0, a).x, tube(t0, a).y)
      .Z()
    return {
      prims: [{ d: upper.d() + lower.d(), role: 'outline' }],
      cavities: [{ id: 'inner', polys: cavity.polys() }],
      anchors: [
        { id: 'in', kind: 'mouth', x: mouth.x, y: mouth.y, dir: 180 + ARM, width: NECK },
        { id: 'out', kind: 'tip', x: xOut, y: h, dir: 90, width: 2 * out },
      ],
    }
  },
}

/** Cone joint with a cap, drilled for a thermometer. The hole is left empty so that the thermometer shows through it, as in `bung`. */
const thermometerAdaptor: SymbolDef = {
  id: 'thermometerAdaptor',
  name: 'Thermometer adaptor',
  aliases: ['screw-cap adaptor', 'thermometer pocket'],
  pack: 'organic',
  size: { w: 38, h: 34 },
  resize: 'none',
  build({ w, h }) {
    const cap = 10,
      x = w / 2
    // One side of the cone (s = -1 left, +1 right): shoulder at the cap, narrowing to the end at h.
    const cone = (s: number) => closed([v(s * HOLE, cap), v(s * S, cap), v(s * E, h), v(s * HOLE, h)])
    return {
      prims: [
        { d: cone(-1).d() + cone(1).d(), role: 'outline' },
        { d: rect(-x, 0, -HOLE, cap) + rect(HOLE, 0, x, cap), role: 'rubber' },
      ],
      anchors: [
        { id: 'plug', kind: 'plug', x: 0, y: cap, dir: 90, width: NECK },
        { id: 'hole', kind: 'port', x: 0, y: 0, dir: -90, width: 2 * HOLE },
      ],
    }
  },
}

const meltingPointApparatus: SymbolDef = {
  id: 'meltingPointApparatus',
  name: 'Melting point apparatus',
  pack: 'organic',
  size: { w: 130, h: 150 },
  resize: 'free',
  min: { w: 80, h: 90 },
  build({ w, h }) {
    const x = w / 2,
      top = 8, // top of the heating block
      bw = 0.5 * w,
      bh = 0.3 * h,
      depth = 0.6 * bh, // of the holes
      xT = -0.12 * w, // thermometer hole: 16 wide (the recipe's 9 is narrower than the 13 u bulb, rule S9)
      tH = 8, // its half-width
      xS = 0.12 * w, // capillary (sample) hole, 5 wide
      yFront = top + bh + 0.5 * (h - top - bh), // centre of the lens and the dial
      xLens = -0.22 * w,
      xDial = 0.22 * w,
      rDial = 9
    const box = closed([v(-x, 0, 8), v(x, 0, 8), v(x, h, 8), v(-x, h, 8)])
    // The block with its two holes cut from the top edge.
    const block = roundPoly(
      [
        v(-bw / 2, top),
        v(xT - tH, top),
        v(xT - tH, top + depth),
        v(xT + tH, top + depth),
        v(xT + tH, top),
        v(xS - 2.5, top),
        v(xS - 2.5, top + depth),
        v(xS + 2.5, top + depth),
        v(xS + 2.5, top),
        v(bw / 2, top),
        v(bw / 2, top + bh),
        v(-bw / 2, top + bh),
      ],
      true,
    )
    const pointer = rad(-60)
    const prims: Prim[] = [
      { d: box.d(), role: 'solid' },
      { d: block.d(), role: 'dark' },
      { d: circle(xLens, yFront, 12), role: 'outline' },
      { d: circle(xDial, yFront, rDial), role: 'outline' },
      {
        d: new Path()
          .M(xDial, yFront)
          .L(xDial + 0.8 * rDial * Math.cos(pointer), yFront + 0.8 * rDial * Math.sin(pointer))
          .d(),
        role: 'detail',
      },
    ]
    return {
      prims,
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'thermo', kind: 'mouth', x: xT, y: top, dir: -90, width: 2 * tH },
        { id: 'sample', kind: 'mouth', x: xS, y: top, dir: -90, width: 5 },
      ],
    }
  },
}

// ---------------------------------------------------------------- release 1.1 (priority B)

/**
 * Packing for the 30 u tube of a column: small irregular lumps in staggered rows from y = top to y = bottom. The rows have 3 and 4
 * lumps in turn, so that they interlock. The pattern comes from a fixed seed, so it never changes between renders.
 */
function packing(top: number, bottom: number): string {
  const rand = rng(20261007)
  const gap = 6.4 // between the centres of two lumps in a row
  let d = ''
  for (let y = top, row = 0; y <= bottom; y += 5.6, row++) {
    const count = row % 2 ? 4 : 3
    for (let i = 0; i < count; i++) {
      const cx = (i - (count - 1) / 2) * gap + (rand() - 0.5) * 1.2,
        cy = y + (rand() - 0.5) * 1.2,
        r = 2.1 + rand() * 0.7,
        k = 5 + Math.floor(rand() * 2),
        a0 = rand() * Math.PI
      const pts: Pt[] = []
      for (let j = 0; j < k; j++) {
        const a = a0 + (j / k) * 2 * Math.PI,
          q = r * (0.75 + rand() * 0.25)
        pts.push(P(cx + q * Math.cos(a), cy + q * Math.sin(a) * 0.85))
      }
      d += polyD(pts)
    }
  }
  return d
}

/**
 * A tube 30 wide with a socket at the top and a cone at the bottom, packed with lumps. The joints have the shared sizes, so the cone
 * seats in a flask neck and the socket takes a thermometer adaptor. The tube is wider than the throat of its joints, as on the bench.
 */
const fractionatingColumn: SymbolDef = {
  id: 'fractionatingColumn',
  name: 'Fractionating column',
  pack: 'organic',
  size: { w: 44, h: 240 },
  resize: 'height',
  min: { w: 44, h: 120 },
  build({ h }) {
    const a = 15, // half-width of the tube (30 wide)
      yShoulder = h - CONE_LEN
    // One wall below the socket mouth: the end of the socket (28 wide), a gentle widening to the tube (30 wide), the tube, the flare to
    // the shoulder of the cone, and the end of the cone. The large radii take the elbows out of the widening.
    const wall = (s: number): V[] => [v(s * E, CONE_LEN, 40), v(s * a, CONE_LEN + 18, 40), v(s * a, yShoulder - 10, 6), v(s * S, yShoulder, 3), v(s * E, h)]
    const sRim = S - (RIM * (S - E)) / CONE_LEN // half-width of the socket RIM below its mouth
    const cavity = closed([v(-sRim, RIM), ...wall(-1), ...wall(1).reverse(), v(sRim, RIM)])
    return {
      prims: [
        { d: roundPoly([v(-S, 0), ...wall(-1)]).d() + roundPoly([v(S, 0), ...wall(1)]).d(), role: 'outline' },
        { d: packing(0.15 * h, 0.85 * h), role: 'detail' }, // the middle 70 %
      ],
      cavities: [{ id: 'inner', polys: cavity.polys() }],
      anchors: [
        { id: 'bottom', kind: 'plug', x: 0, y: yShoulder, dir: 90, width: NECK },
        { id: 'top', kind: 'mouth', x: 0, y: 0, dir: -90, width: NECK },
      ],
    }
  },
}

export const organic: SymbolDef[] = [stillHead, receiverAdaptor, thermometerAdaptor, meltingPointApparatus, fractionatingColumn]
