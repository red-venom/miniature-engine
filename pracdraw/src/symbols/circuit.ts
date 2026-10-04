// circuit.ts — the "Circuit symbols" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.
//
// Every symbol here is a fixed-size circuit symbol (resize `none`) with no automatic label. The lead line lies at y = h/2.
// Terminals `a` (left) and `b` (right) sit on the box edge at (∓w/2, h/2); leads run from them to the symbol as main lines.
// The recipes follow the AQA GCSE figure as described in words (specification, section 8): the `circle` parameter on the
// diode, LED, LDR and thermistor is there so that a later correction is a change of default.

import { f } from '../kernel/geom'
import { bool, circle, rect } from './kit'
import type { Anchor, Prim, SymbolDef } from './types'

/** Horizontal line from x0 to x1 at y. */
const hline = (x0: number, x1: number, y: number): string => `M${f(x0)} ${f(y)}H${f(x1)}`
/** Vertical line at x from y0 to y1. */
const vline = (x: number, y0: number, y1: number): string => `M${f(x)} ${f(y0)}V${f(y1)}`
/** The two leads: from each terminal in to x = ±inner on the lead line. `inner` 0 gives one line straight through. */
const leads = (w: number, h: number, inner: number): string =>
  inner > 0 ? hline(-w / 2, -inner, h / 2) + hline(inner, w / 2, h / 2) : hline(-w / 2, w / 2, h / 2)
/** Terminal anchors a (left) and b (right), each pointing out of the box. */
const terminals = (w: number, h: number): Anchor[] => [
  { id: 'a', kind: 'terminal', x: -w / 2, y: h / 2, dir: 180 },
  { id: 'b', kind: 'terminal', x: w / 2, y: h / 2, dir: 0 },
]
/** The resistor body: a 30 by 12 rect on the lead line. */
const RES_W = 15,
  RES_H = 6
const resistorBody = (h: number): string => rect(-RES_W, h / 2 - RES_H, RES_W, h / 2 + RES_H)
/** A line from (x0, y0) to (x1, y1) with an open arrowhead at (x1, y1): two strokes `head` long, 26° either side of the shaft. */
function arrow(x0: number, y0: number, x1: number, y1: number, head: number): string {
  const a = Math.atan2(y0 - y1, x0 - x1), // direction from the tip back along the shaft
    s = (26 * Math.PI) / 180
  const wing = (t: number) => `M${f(x1)} ${f(y1)}L${f(x1 + head * Math.cos(a + t))} ${f(y1 + head * Math.sin(a + t))}`
  return `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}` + wing(s) + wing(-s)
}
/**
 * Two small parallel arrows, `apart` u apart, beside the ray from (cx, cy) in the unit direction (ux, uy), from distance t0 to t1 along it.
 * The pair is centred on the ray, then moved `shift` u across it (positive = clockwise of the ray on screen).
 * The arrows point along the ray when `out`, else back at the centre.
 */
function arrowPair(cx: number, cy: number, ux: number, uy: number, t0: number, t1: number, apart: number, out: boolean, shift = 0): string {
  const nx = -uy,
    ny = ux
  let d = ''
  for (const s of [-1, 1]) {
    const o = shift + (s * apart) / 2,
      ox = o * nx,
      oy = o * ny
    const p0 = [cx + ux * t0 + ox, cy + uy * t0 + oy],
      p1 = [cx + ux * t1 + ox, cy + uy * t1 + oy]
    d += out ? arrow(p0[0], p0[1], p1[0], p1[1], 5) : arrow(p1[0], p1[1], p0[0], p0[1], 5)
  }
  return d
}
/** The two plates of a cell whose centre is at (cx, y): the long positive plate on the left, the short negative plate on the right. */
const cellPlates = (cx: number, y: number): string => vline(cx - 3, y - 12, y + 12) + vline(cx + 3, y - 6, y + 6)

/** A fixed-size, unlabelled, two-terminal circuit symbol. */
function twoTerminal(
  def: Pick<SymbolDef, 'id' | 'name' | 'aliases' | 'label' | 'params'> & { w?: number; h?: number },
  draw: (
    w: number,
    h: number,
    p: Record<string, boolean | number | string>,
  ) => { prims: Prim[]; texts?: { x: number; y: number; text: string; size: number; anchor: 'middle' }[] },
): SymbolDef {
  const w = def.w ?? 60,
    h = def.h ?? 40
  return {
    id: def.id,
    name: def.name,
    aliases: def.aliases,
    label: def.label,
    autoLabel: false,
    pack: 'circuit',
    size: { w, h },
    resize: 'none',
    params: def.params,
    build({ w, h, p }) {
      return { ...draw(w, h, p), anchors: terminals(w, h) }
    },
  }
}

const cCell = twoTerminal({ id: 'cCell', name: 'Cell' }, (w, h) => ({
  prims: [{ d: leads(w, h, 3) + cellPlates(0, h / 2), role: 'outline' }],
}))

const cBattery = twoTerminal({ id: 'cBattery', name: 'Battery', w: 80 }, (w, h) => ({
  // Two cells that face the same way, 28 u apart, joined by a dashed line (the cells that are not drawn).
  prims: [
    { d: hline(-11, 11, h / 2), role: 'dashed' },
    { d: leads(w, h, 17) + cellPlates(-14, h / 2) + cellPlates(14, h / 2), role: 'outline' },
  ],
}))

const cSwitch = twoTerminal({ id: 'cSwitch', name: 'Switch', params: [{ key: 'closed', label: 'Closed', type: 'boolean', default: false }] }, (w, h, p) => {
  const y = h / 2,
    cx = 12,
    r = 2.5,
    len = 26
  // Open: the lever rises 30° from the left contact, long enough to reach past the right contact. Closed: it lies on both contacts.
  const lever = bool(p.closed, false) ? hline(-cx, cx, y) : `M${f(-cx)} ${f(y)}L${f(-cx + len * Math.cos(Math.PI / 6))} ${f(y - len * Math.sin(Math.PI / 6))}`
  return {
    prims: [
      { d: leads(w, h, cx) + lever, role: 'outline' },
      { d: circle(-cx, y, r) + circle(cx, y, r), role: 'solid' },
    ],
  }
})

const cLamp = twoTerminal({ id: 'cLamp', name: 'Lamp (symbol)', aliases: ['bulb', 'filament lamp'] }, (w, h) => {
  const y = h / 2,
    r = 12,
    k = r * Math.SQRT1_2
  const cross = `M${f(-k)} ${f(y - k)}L${f(k)} ${f(y + k)}M${f(-k)} ${f(y + k)}L${f(k)} ${f(y - k)}`
  return { prims: [{ d: leads(w, h, r) + circle(0, y, r) + cross, role: 'outline' }] }
})

const cFuse = twoTerminal({ id: 'cFuse', name: 'Fuse' }, (w, h) => ({
  prims: [{ d: leads(w, h, 0) + resistorBody(h), role: 'outline' }],
}))

const cResistor = twoTerminal({ id: 'cResistor', name: 'Resistor', aliases: ['fixed resistor'] }, (w, h) => ({
  prims: [{ d: leads(w, h, RES_W) + resistorBody(h), role: 'outline' }],
}))

const cVariableResistor = twoTerminal({ id: 'cVariableResistor', name: 'Variable resistor', aliases: ['rheostat'] }, (w, h) => {
  const y = h / 2
  return { prims: [{ d: leads(w, h, RES_W) + resistorBody(h) + arrow(-17, y + 14, 17, y - 14, 6), role: 'outline' }] }
})

const cThermistor = twoTerminal(
  { id: 'cThermistor', name: 'Thermistor', params: [{ key: 'circle', label: 'Circle', type: 'boolean', default: false }] },
  (w, h, p) => {
    const y = h / 2
    // A 45° line through the body with a level foot at its lower left; it stays inside the optional circle of radius 19.
    const line = `M-15 ${f(y + 9)}H-9L9 ${f(y - 9)}`
    const prims: Prim[] = [{ d: leads(w, h, RES_W) + resistorBody(h) + line, role: 'outline' }]
    if (bool(p.circle, false)) prims.push({ d: circle(0, y, 19), role: 'outline' })
    return { prims }
  },
)

const cLDR = twoTerminal(
  {
    id: 'cLDR',
    name: 'LDR',
    label: 'LDR',
    aliases: ['light-dependent resistor'],
    h: 44,
    params: [{ key: 'circle', label: 'Circle', type: 'boolean', default: true }],
  },
  (w, h, p) => {
    const y = h / 2
    // Two arrows from the upper left that point at the body. They start outside the circle of radius 19 and end 1 u short of it.
    // The pair sits just below the 45° diagonal so that it stays inside the box.
    const arrows = arrowPair(0, y, -Math.SQRT1_2, -Math.SQRT1_2, 20, 30, 7, false, -3.5)
    const prims: Prim[] = [{ d: leads(w, h, RES_W) + resistorBody(h) + arrows, role: 'outline' }]
    if (bool(p.circle, true)) prims.push({ d: circle(0, y, 19), role: 'outline' })
    return { prims }
  },
)

/** Diode: a triangle 16 wide that points right, with a bar 16 high at its tip. The lead line runs through. */
const diodeBody = (h: number): string => {
  const y = h / 2
  return `M-8 ${f(y - 8)}L8 ${f(y)}L-8 ${f(y + 8)}Z` + vline(8, y - 8, y + 8)
}

const cDiode = twoTerminal({ id: 'cDiode', name: 'Diode', params: [{ key: 'circle', label: 'Circle', type: 'boolean', default: true }] }, (w, h, p) => {
  const prims: Prim[] = [{ d: leads(w, h, 0) + diodeBody(h), role: 'outline' }]
  if (bool(p.circle, true)) prims.push({ d: circle(0, h / 2, 14), role: 'outline' })
  return { prims }
})

const cLED = twoTerminal(
  {
    id: 'cLED',
    name: 'LED',
    label: 'LED',
    aliases: ['light-emitting diode'],
    h: 44,
    params: [{ key: 'circle', label: 'Circle', type: 'boolean', default: true }],
  },
  (w, h, p) => {
    const y = h / 2
    // Two arrows that point away at the upper right. They start 1.5 u outside the circle of radius 14.
    const arrows = arrowPair(0, y, Math.SQRT1_2, -Math.SQRT1_2, 15.5, 25, 7, true)
    const prims: Prim[] = [{ d: leads(w, h, 0) + diodeBody(h) + arrows, role: 'outline' }]
    if (bool(p.circle, true)) prims.push({ d: circle(0, y, 14), role: 'outline' })
    return { prims }
  },
)

/** A meter: a circle of radius 12 with one letter in it, as symbol text that is never mirrored. */
const meter = (id: string, name: string, letter: string): SymbolDef =>
  twoTerminal({ id, name }, (w, h) => ({
    prims: [{ d: leads(w, h, 12) + circle(0, h / 2, 12), role: 'outline' }],
    texts: [{ x: 0, y: h / 2 + 5, text: letter, size: 14, anchor: 'middle' }],
  }))
const cAmmeter = meter('cAmmeter', 'Ammeter', 'A')
const cVoltmeter = meter('cVoltmeter', 'Voltmeter', 'V')

const cJunction: SymbolDef = {
  id: 'cJunction',
  name: 'Junction',
  autoLabel: false,
  pack: 'circuit',
  size: { w: 8, h: 8 },
  resize: 'none',
  build({ h }) {
    return {
      prims: [{ d: circle(0, h / 2, 3), role: 'dark' }],
      anchors: [{ id: 'c', kind: 'terminal', x: 0, y: h / 2 }],
    }
  },
}

export const circuit: SymbolDef[] = [
  cCell,
  cBattery,
  cSwitch,
  cLamp,
  cFuse,
  cResistor,
  cVariableResistor,
  cThermistor,
  cLDR,
  cDiode,
  cLED,
  cAmmeter,
  cVoltmeter,
  cJunction,
]
