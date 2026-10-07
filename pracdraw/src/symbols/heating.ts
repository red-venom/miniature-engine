// heating.ts — the "Heating" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { Path, f, roundPoly, v } from '../kernel/geom'
import { RIM, bool, circle, closed, rect, str } from './kit'
import { SAFETY_FLAME } from './pilots'
import type { Prim, SymbolDef } from './types'

const line = (x0: number, y0: number, x1: number, y1: number): string => `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`

const heatArrow: SymbolDef = {
  id: 'heatArrow',
  name: 'Heat arrow',
  autoLabel: false,
  pack: 'heating',
  size: { w: 44, h: 70 },
  resize: 'uniform',
  min: { w: 28, h: 44 },
  params: [{ key: 'text', label: 'Text', type: 'text', default: 'heat' }],
  build({ h, p }) {
    const k = h / 70,
      s = (n: number) => n * k // drawn at 44 × 70, then scaled by k
    // Block arrow: head 40 wide and 26 high, shaft 16 wide down to y = 50. The word sits under the shaft.
    const arrow = closed([v(0, 0), v(s(20), s(26)), v(s(8), s(26)), v(s(8), s(50), s(1)), v(s(-8), s(50), s(1)), v(s(-8), s(26)), v(s(-20), s(26))])
    return {
      prims: [{ d: arrow.d(), role: 'solid' }],
      texts: [{ x: 0, y: s(66), text: str(p.text, 'heat'), size: s(13), anchor: 'middle' }],
      anchors: [{ id: 'tip', kind: 'heat', x: 0, y: 0, dir: -90 }],
    }
  },
}

const hotPlate: SymbolDef = {
  id: 'hotPlate',
  name: 'Hot plate',
  aliases: ['electric heater', 'hotplate', 'magnetic stirrer', 'stirrer hotplate'],
  label: (p) => (bool(p.stirrer, false) ? 'magnetic stirrer' : 'hot plate'),
  pack: 'heating',
  size: { w: 150, h: 62 },
  resize: 'free',
  min: { w: 60, h: 30 },
  params: [{ key: 'stirrer', label: 'Stirrer', type: 'boolean', default: false }],
  build({ w, h, p }) {
    const x = w / 2,
      plate = w * 0.45,
      yBody = 7,
      dy = yBody + (h - yBody) * 0.55,
      dx = w * 0.25,
      r = Math.min(7, (h - yBody) * 0.25)
    const prims: Prim[] = [
      { d: closed([v(-x, yBody, 5), v(x, yBody, 5), v(x, h, 5), v(-x, h, 5)]).d(), role: 'solid' },
      { d: rect(-plate, 0, plate, yBody), role: 'dark' },
      { d: circle(-dx, dy, r) + circle(dx, dy, r), role: 'solid' },
    ]
    // A stirrer hotplate: the second dial sets the stirring speed, and has a pointer.
    if (bool(p.stirrer, false)) prims.push({ d: line(dx, dy, dx + r * 0.8 * Math.cos(-1.1), dy + r * 0.8 * Math.sin(-1.1)), role: 'detail' })
    return {
      prims,
      anchors: [
        { id: 'top', kind: 'surface', x: 0, y: 0, dir: -90, width: 2 * plate },
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
      ],
    }
  },
}

const heatingMantle: SymbolDef = {
  id: 'heatingMantle',
  name: 'Heating mantle',
  aliases: ['Isomantle', 'electric mantle'],
  pack: 'heating',
  size: { w: 170, h: 90 },
  resize: 'free',
  min: { w: 80, h: 44 },
  build({ w, h }) {
    const x = w / 2,
      R = Math.min(55, x - 14, h - 20) // the bowl: a half-circle recess centred on the top edge
    // One casing outline: from the left rim of the bowl round the box to its right rim, then the bowl.
    const casing = roundPoly([v(-R, 0), v(-x, 0, 8), v(-x, h, 8), v(x, h, 8), v(x, 0, 8), v(R, 0)])
      .A(R, -R, 0, true)
      .Z()
    return {
      prims: [
        { d: casing.d(), role: 'solid' },
        { d: circle(w * 0.38, h * 0.78, Math.min(7, h * 0.1)), role: 'solid' },
      ],
      anchors: [
        { id: 'cup', kind: 'cup', x: 0, y: R, dir: -90, width: 2 * R },
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
      ],
    }
  },
}

const waterBath: SymbolDef = {
  id: 'waterBath',
  name: 'Water bath (electric)',
  aliases: ['thermostatic water bath'],
  pack: 'heating',
  size: { w: 260, h: 130 },
  resize: 'free',
  min: { w: 80, h: 50 },
  build({ w, h }) {
    const x = w / 2,
      t = x - 10, // the tank wall
      yTank = h * 0.7,
      yStrip = h * 0.78
    const tank = (top: number) => [v(-t, top), v(-t, yTank, 6), v(t, yTank, 6), v(t, top)]
    const casing = roundPoly([v(-t, 0), v(-x, 0), v(-x, h, 6), v(x, h, 6), v(x, 0), v(t, 0)])
    // The control strip is filled but not closed by a line: its top edge is the detail line.
    const strip = new Path()
      .M(-x, yStrip)
      .L(-x, h - 6)
      .A(6, -x + 6, h, false)
      .L(x - 6, h)
      .A(6, x, h - 6, false)
      .L(x, yStrip)
    return {
      prims: [
        { d: casing.d() + roundPoly(tank(0)).d(), role: 'outline' },
        { d: strip.d(), role: 'solid' },
        { d: line(-x, yStrip, x, yStrip), role: 'detail' },
        { d: circle(w * 0.38, (yStrip + h) / 2, Math.min(7, (h - yStrip) * 0.3)), role: 'solid' },
      ],
      cavities: [{ id: 'main', polys: closed(tank(RIM)).polys() }],
      anchors: [{ id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w }],
    }
  },
}

const immersionHeater: SymbolDef = {
  id: 'immersionHeater',
  name: 'Immersion heater',
  aliases: ['heater', 'heating element', '12 V heater'],
  pack: 'heating',
  size: { w: 16, h: 130 },
  resize: 'height',
  min: { w: 16, h: 50 },
  build({ h }) {
    const r = 6,
      yCap = 10,
      capH = 18
    const rod = new Path()
      .M(-r, yCap + capH)
      .L(-r, h - r)
      .A(r, r, h - r, false)
      .L(r, yCap + capH)
      .Z()
    return {
      prims: [
        { d: line(-4, 0, -4, yCap) + line(4, 0, 4, yCap), role: 'outline' }, // lead stubs
        { d: rod.d(), role: 'dark' },
        { d: rect(-8, yCap, 8, yCap + capH), role: 'solid' },
      ],
      anchors: [
        { id: 'tip', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'terminalA', kind: 'terminal', x: -4, y: 0, dir: -90 },
        { id: 'terminalB', kind: 'terminal', x: 4, y: 0, dir: -90 },
      ],
    }
  },
}

// ---------------------------------------------------------------- release 1.1 (priority B)

/** The safety flame of the Bunsen burner (pilots.ts) at another size: `height` high, standing on the line y = base. */
function safetyFlame(base: number, height: number): string {
  const c = height / 38 // the Bunsen flame is 38 u high, from y = 2 to y = 40, and 14 u wide at its foot
  const X = (x: number) => x * c,
    Y = (y: number) => base - (40 - y) * c
  return new Path().M(X(-7), Y(40)).C(X(-15), Y(28), X(-4), Y(18), X(-3), Y(2)).C(X(4), Y(10), X(14), Y(26), X(7), Y(40)).Z().d()
}

/** Drawn at 80 × 76 and scaled, as bunsenBurner. The fuel is the cavity; the wick dips into it. */
const spiritBurner: SymbolDef = {
  id: 'spiritBurner',
  name: 'Spirit burner',
  aliases: ['alcohol burner', 'spirit lamp'],
  pack: 'heating',
  size: { w: 80, h: 76 },
  resize: 'uniform',
  min: { w: 54, h: 51 },
  build({ h }) {
    const k = h / 76,
      s = (n: number) => n * k,
      H = 76,
      yBody = H / 2, // the top of the body: it is 0.5h high
      yNeck = 32 // the top of the neck, closed by the cap line
    // A squat bottle: a body 72 wide (0.9w) with 10 u corners, and a short neck 22 wide. The cap line closes the neck.
    const bottle = (top: number) => [
      v(s(-11), top),
      v(s(-11), s(yBody), s(3)),
      v(s(-36), s(yBody), s(10)),
      v(s(-36), s(H), s(10)),
      v(s(36), s(H), s(10)),
      v(s(36), s(yBody), s(10)),
      v(s(11), s(yBody), s(3)),
      v(s(11), top),
    ]
    return {
      prims: [
        { d: safetyFlame(s(22), s(22)), role: 'flame', tint: SAFETY_FLAME },
        { d: closed(bottle(s(yNeck))).d(), role: 'outline' },
        { d: `M${f(s(-2))} ${f(s(yNeck))}V${f(s(66))}H${f(s(2))}V${f(s(yNeck))}`, role: 'detail' }, // the wick, down into the fuel
        { d: rect(s(-7), s(24), s(7), s(yNeck)), role: 'solid' }, // the wick holder
        { d: rect(s(-2), s(19), s(2), s(24)), role: 'solid' }, // the wick above it
      ],
      cavities: [{ id: 'main', polys: closed(bottle(s(yNeck) + RIM)).polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: s(72) },
        { id: 'flame', kind: 'heat', x: 0, y: 0, dir: -90 },
      ],
    }
  },
}

/** Seen from the side: the wire of the triangle is a heavy line, and the three pipeclay tubes are the beads on it. */
const pipeclayTriangle: SymbolDef = {
  id: 'pipeclayTriangle',
  name: 'Pipeclay triangle',
  pack: 'heating',
  size: { w: 90, h: 6 },
  resize: 'width',
  min: { w: 56, h: 6 },
  build({ w, h }) {
    const x = w / 2,
      c = 0.32 * w // the two outer beads; the third is at the centre
    const bead = (cx: number) => closed([v(cx - 7, 0, 1.5), v(cx + 7, 0, 1.5), v(cx + 7, h, 1.5), v(cx - 7, h, 1.5)]).d()
    return {
      prims: [
        { d: `M${f(-x)} ${f(h / 2)}H${f(x)}`, role: 'heavy' },
        { d: bead(-c) + bead(0) + bead(c), role: 'solid' },
      ],
      anchors: [
        { id: 'top', kind: 'surface', x: 0, y: 0, dir: -90, width: w },
        { id: 'under', kind: 'base', x: 0, y: h, dir: 90, width: w },
      ],
    }
  },
}

export const heating: SymbolDef[] = [heatArrow, hotPlate, heatingMantle, waterBath, immersionHeater, spiritBurner, pipeclayTriangle]
