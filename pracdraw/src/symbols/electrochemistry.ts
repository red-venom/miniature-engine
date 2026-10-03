// electrochemistry.ts — the "Electrochemistry" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { Path, f, roundPoly, v } from '../kernel/geom'
import { RIM, circle, closed, rect, str } from './kit'
import type { Prim, SymbolDef, SymbolText } from './types'

const electrode: SymbolDef = {
  id: 'electrode',
  name: 'Electrode',
  aliases: ['carbon rod', 'graphite electrode', 'metal strip'],
  pack: 'electrochemistry',
  size: { w: 16, h: 150 },
  resize: 'height',
  min: { w: 16, h: 40 },
  params: [
    {
      key: 'kind',
      label: 'Kind',
      type: 'choice',
      default: 'rod',
      options: [
        { value: 'rod', label: 'Rod' },
        { value: 'strip', label: 'Strip' },
      ],
    },
    {
      key: 'material',
      label: 'Material',
      type: 'choice',
      default: 'carbon',
      options: [
        { value: 'carbon', label: 'Carbon' },
        { value: 'metal', label: 'Metal' },
      ],
    },
  ],
  build({ w, h, p }) {
    const rod = str(p.kind, 'rod') === 'rod',
      x = rod ? 4 : w / 2
    const d = rod
      ? new Path()
          .M(-x, 0)
          .L(-x, h - x)
          .A(x, x, h - x, false)
          .L(x, 0)
          .Z()
          .d()
      : rect(-x, 0, x, h)
    return {
      prims: [{ d, role: str(p.material, 'carbon') === 'metal' ? 'solid' : 'dark' }],
      anchors: [
        { id: 'top', kind: 'terminal', x: 0, y: 0, dir: -90 },
        { id: 'tip', kind: 'tip', x: 0, y: h, dir: 90, width: 2 * x },
      ],
    }
  },
}

/** An open cell with two carbon electrodes through its base: the electrolysis of a solution. */
const electrolysisCell: SymbolDef = {
  id: 'electrolysisCell',
  name: 'Electrolysis cell',
  pack: 'electrochemistry',
  size: { w: 130, h: 120 },
  resize: 'free',
  min: { w: 70, h: 60 },
  build({ w, h }) {
    const x = w / 2,
      yb = h - 16, // the vessel base
      xe = 0.22 * w, // electrodes
      xf = 0.42 * w // feet
    const vessel = roundPoly([v(-x, 0), v(-x, yb, 6), v(x, yb, 6), v(x, 0)])
    const cavity = closed([v(-x, RIM), v(-x, yb, 6), v(x, yb, 6), v(x, RIM)])
    const seal = (c: number) => rect(c - 7, yb - 4, c + 7, yb + 4)
    const rod = (c: number) => rect(c - 4, 0.45 * h, c + 4, h - 4)
    return {
      prims: [
        { d: rect(-xf - 5, yb, -xf + 5, h) + rect(xf - 5, yb, xf + 5, h), role: 'solid' },
        { d: vessel.d(), role: 'outline' },
        { d: seal(-xe) + seal(xe), role: 'rubber' },
        { d: rod(-xe) + rod(xe), role: 'dark' },
      ],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'terminalL', kind: 'terminal', x: -xe, y: h - 4, dir: 90 },
        { id: 'terminalR', kind: 'terminal', x: xe, y: h - 4, dir: 90 },
      ],
    }
  },
}

const powerSupply: SymbolDef = {
  id: 'powerSupply',
  name: 'Power supply',
  aliases: ['power pack', 'lab pack', 'd.c. supply'],
  pack: 'electrochemistry',
  size: { w: 130, h: 84 },
  resize: 'free',
  min: { w: 90, h: 60 },
  params: [{ key: 'voltage', label: 'Voltage', type: 'text', default: '6 V' }],
  build({ w, h, p }) {
    const x = w / 2,
      rDial = 14,
      xDial = -0.24 * w,
      yDial = 0.58 * h,
      yT = 0.7 * h, // terminals
      xPlus = 0.17 * w,
      xMinus = 0.36 * w,
      rT = 5,
      pointer = (-60 * Math.PI) / 180
    const prims: Prim[] = [
      { d: closed([v(-x, 0, 6), v(x, 0, 6), v(x, h, 6), v(-x, h, 6)]).d(), role: 'solid' },
      { d: circle(xDial, yDial, rDial), role: 'outline' },
      { d: `M${f(xDial)} ${f(yDial)}L${f(xDial + 0.8 * rDial * Math.cos(pointer))} ${f(yDial + 0.8 * rDial * Math.sin(pointer))}`, role: 'detail' },
      { d: circle(xPlus, yT, rT) + circle(xMinus, yT, rT), role: 'solid' },
    ]
    const texts: SymbolText[] = [
      { x: xDial, y: yDial - rDial - 6, text: str(p.voltage, '6 V'), size: 10, anchor: 'middle' },
      { x: xPlus, y: yT - rT - 4, text: '+', size: 11, anchor: 'middle' },
      { x: xMinus, y: yT - rT - 4, text: '−', size: 11, anchor: 'middle' },
    ]
    return {
      prims,
      texts,
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'plus', kind: 'terminal', x: xPlus, y: yT, dir: -90 },
        { id: 'minus', kind: 'terminal', x: xMinus, y: yT, dir: -90 },
      ],
    }
  },
}

/** Side view, jaws to the left, wire to the right. The jaws are closed: they meet at the tip, and their teeth interlock. */
const crocodileClip: SymbolDef = {
  id: 'crocodileClip',
  name: 'Crocodile clip',
  pack: 'electrochemistry',
  size: { w: 34, h: 14 },
  resize: 'width',
  min: { w: 30, h: 14 },
  build({ w, h }) {
    const x = w / 2,
      ym = h / 2,
      xb = x - 15, // the body (hinge end) starts here
      xs = -x + 4, // the teeth start here
      pitch = (xb - 2 - xs) / 3 // three teeth along each jaw
    // The silhouette: tip, the two jaws, the body, the wire stub.
    const body = closed([
      v(-x, ym),
      v(xb - 8, 1.5, 2),
      v(xb, 1.5),
      v(xb, 0, 1),
      v(xb + 8, 0, 1),
      v(xb + 11, ym - 1.5),
      v(x, ym - 1.5),
      v(x, ym + 1.5),
      v(xb + 11, ym + 1.5),
      v(xb + 8, h, 1),
      v(xb, h, 1),
      v(xb, h - 1.5),
      v(xb - 8, h - 1.5, 2),
    ])
    // The inner edge of each jaw (s = -1 upper, +1 lower): a zigzag whose tooth tips nearly touch the other jaw's.
    const teeth = (s: number) => {
      const path = new Path().M(xs, ym + s * 0.7)
      for (let i = 0; i < 3; i++) path.L(xs + (i + 0.5) * pitch, ym + s * 2.4).L(xs + (i + 1) * pitch, ym + s * 0.7)
      return path
    }
    return {
      prims: [
        { d: body.d(), role: 'solid' },
        { d: teeth(-1).d() + teeth(1).d() + `M${f(xb)} 1.5V${f(h - 1.5)}`, role: 'detail' },
      ],
      anchors: [
        { id: 'jaw', kind: 'grip', x: (xs + xb) / 2, y: ym, dir: 180, width: 4 },
        { id: 'tail', kind: 'terminal', x: x, y: ym, dir: 0 },
      ],
    }
  },
}

const saltBridge: SymbolDef = {
  id: 'saltBridge',
  name: 'Salt bridge',
  pack: 'electrochemistry',
  size: { w: 170, h: 90 },
  resize: 'free',
  min: { w: 60, h: 40 },
  build({ w, h }) {
    const x = w / 2,
      t = 14, // inside width of the tube
      r = 16
    const outer = roundPoly([v(-x, h), v(-x, 0, r), v(x, 0, r), v(x, h)])
    const inner = roundPoly([v(-x + t, h), v(-x + t, t, r - t), v(x - t, t, r - t), v(x - t, h)])
    const cavity = roundPoly(
      [v(-x, h - RIM), v(-x, 0, r), v(x, 0, r), v(x, h - RIM), v(x - t, h - RIM), v(x - t, t, r - t), v(-x + t, t, r - t), v(-x + t, h - RIM)],
      true,
    )
    return {
      prims: [{ d: outer.d() + inner.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'endL', kind: 'tip', x: -x + t / 2, y: h, dir: 90, width: t },
        { id: 'endR', kind: 'tip', x: x - t / 2, y: h, dir: 90, width: t },
      ],
    }
  },
}

export const electrochemistry: SymbolDef[] = [electrode, electrolysisCell, powerSupply, crocodileClip, saltBridge]
