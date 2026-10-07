// measuring.ts — the "Measuring" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { Path, f, v, type Pt } from '../kernel/geom'
import { RIM, bool, circle, closed, num, rect, str, ticks } from './kit'
import type { Anchor, Prim, SymbolDef, SymbolText } from './types'

/** Vertical tick marks along a horizontal edge: one path. `len(i)` > 0 draws down from y, < 0 up. */
function vticks(y: number, x0: number, x1: number, count: number, len: (i: number) => number): string {
  let d = ''
  for (let i = 0; i <= count; i++) {
    const l = len(i)
    if (l) d += `M${f(x0 + (i * (x1 - x0)) / count)} ${f(y)}v${f(l)}`
  }
  return d
}

const volumetricPipette: SymbolDef = {
  id: 'volumetricPipette',
  name: 'Pipette',
  aliases: ['volumetric pipette', 'bulb pipette'],
  pack: 'measuring',
  size: { w: 20, h: 300 },
  resize: 'height',
  min: { w: 20, h: 160 },
  build({ h }) {
    const a = 3, // half-width of the stem (6 wide)
      b = 10, // half-width of the bulb (20 wide)
      y0 = h / 2 - 35, // bulb, 70 long, centred at 0.5h
      y1 = h / 2 + 35,
      sh = 16, // length of each shoulder curve
      jet = 1.25,
      yTaper = h - 26
    // One wall from the top down to the jet. s = −1 is the left wall. The shoulders are cubic curves with vertical tangents.
    const wall = (s: number, top: number) =>
      new Path()
        .M(s * a, top)
        .L(s * a, y0)
        .C(s * a, y0 + sh / 2, s * b, y0 + sh / 2, s * b, y0 + sh)
        .L(s * b, y1 - sh)
        .C(s * b, y1 - sh / 2, s * a, y1 - sh / 2, s * a, y1)
        .L(s * a, yTaper)
        .L(s * jet, h)
    const inside = new Path()
      .M(-a, RIM)
      .L(-a, y0)
      .C(-a, y0 + sh / 2, -b, y0 + sh / 2, -b, y0 + sh)
      .L(-b, y1 - sh)
      .C(-b, y1 - sh / 2, -a, y1 - sh / 2, -a, y1)
      .L(-a, yTaper)
      .L(-jet, h)
      .L(jet, h)
      .L(a, yTaper)
      .L(a, y1)
      .C(a, y1 - sh / 2, b, y1 - sh / 2, b, y1 - sh)
      .L(b, y0 + sh)
      .C(b, y0 + sh / 2, a, y0 + sh / 2, a, y0)
      .L(a, RIM)
      .Z()
    return {
      prims: [
        { d: `M${f(-a)} ${f(h * 0.16)}H${f(a)}`, role: 'detail' }, // the graduation mark
        { d: wall(-1, 0).d() + wall(1, 0).d(), role: 'outline' },
      ],
      cavities: [{ id: 'main', polys: inside.polys() }],
      anchors: [
        { id: 'tip', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'neck', kind: 'neck', x: 0, y: y0 * 0.5, width: 2 * a },
      ],
    }
  },
}

const dropper: SymbolDef = {
  id: 'dropper',
  name: 'Dropping pipette',
  aliases: ['teat pipette', 'dropper', 'Pasteur pipette'],
  pack: 'measuring',
  size: { w: 16, h: 100 },
  resize: 'height',
  min: { w: 16, h: 60 },
  build({ h }) {
    const a = 4, // half-width of the tube (8 wide)
      teatH = 30,
      jet = 1.25,
      yTaper = h - 30
    const wall = (s: number) =>
      new Path()
        .M(s * a, teatH - 2)
        .L(s * a, yTaper)
        .L(s * jet, h)
    const inside = new Path()
      .M(-a, teatH + 1)
      .L(-a, yTaper)
      .L(-jet, h)
      .L(jet, h)
      .L(a, yTaper)
      .L(a, teatH + 1)
      .Z()
    // Teat: a dome 16 wide and 30 high, with a small radius at its lower edge.
    const teat = closed([v(-8, teatH, 3), v(-8, 0, 8), v(8, 0, 8), v(8, teatH, 3)])
    return {
      prims: [
        { d: wall(-1).d() + wall(1).d(), role: 'outline' },
        { d: teat.d(), role: 'rubber' },
      ],
      cavities: [{ id: 'main', polys: inside.polys() }],
      anchors: [{ id: 'tip', kind: 'tip', x: 0, y: h, dir: 90 }],
    }
  },
}

/**
 * Drawn lying down, nozzle to the left. The piston's left face reads the volume on the barrel scale: 0 at the closed end,
 * 100 cm³ just inside the open end. The cavity is the gas space between the closed end and the piston.
 */
const gasSyringe: SymbolDef = {
  id: 'gasSyringe',
  name: 'Gas syringe',
  pack: 'measuring',
  size: { w: 230, h: 46 },
  resize: 'width',
  min: { w: 150, h: 46 },
  params: [
    { key: 'plunger', label: 'Plunger', type: 'number', default: 0.3, min: 0, max: 1, step: 0.05 },
    { key: 'numbers', label: 'Scale numbers', type: 'boolean', default: false },
  ],
  build({ w, p }) {
    const cy = 18, // centre line of the barrel; the numbers sit under it
      B = 17, // half-height of the barrel (34 high)
      bx0 = -w / 2 + 16, // closed end of the barrel
      L = w * 0.45,
      bx1 = bx0 + L, // open end
      x0 = bx0 + 2, // piston at reading 0
      x100 = bx1 - 6, // piston at reading 100
      plunger = Math.max(0, Math.min(1, num(p.plunger, 0.3))),
      px = x0 + plunger * (x100 - x0), // left face of the piston
      ft = 6, // flange thickness
      rodL = w / 2 - ft - bx1 // so that the flange reaches the edge of the box at plunger = 1
    const nozzle = `M${f(bx0)} ${f(cy - 3.5)}H${f(-w / 2)}V${f(cy + 3.5)}H${f(bx0)}`
    const barrel = new Path()
      .M(bx1, cy - B)
      .L(bx0 + 4, cy - B)
      .A(4, bx0, cy - B + 4, false)
      .L(bx0, cy + B - 4)
      .A(4, bx0 + 4, cy + B, false)
      .L(bx1, cy + B)
    // Plunger: piston, rod and flange as one rigid part.
    const fx = px + 5 + rodL
    const plungerD = new Path()
      .M(px, cy - B)
      .L(px + 5, cy - B)
      .L(px + 5, cy - 3)
      .L(fx, cy - 3)
      .L(fx, cy - 15)
      .L(fx + ft, cy - 15)
      .L(fx + ft, cy + 15)
      .L(fx, cy + 15)
      .L(fx, cy + 3)
      .L(px + 5, cy + 3)
      .L(px + 5, cy + B)
      .L(px, cy + B)
      .Z()
    const texts: SymbolText[] = []
    if (bool(p.numbers, false))
      for (let i = 0; i <= 100; i += 20) texts.push({ x: x0 + (i * (x100 - x0)) / 100, y: cy + B + 9, text: String(i), size: 8, anchor: 'middle' })
    const cavity = closed([v(bx0, cy - B, 4), v(px, cy - B), v(px, cy + B), v(bx0, cy + B, 4)])
    return {
      prims: [
        { d: vticks(cy + B, x0, x100, 20, (i) => (i % 4 === 0 ? -9 : -5)), role: 'detail' },
        { d: nozzle + barrel.d(), role: 'outline' },
        { d: plungerD.d(), role: 'solid' },
      ],
      texts,
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'nozzle', kind: 'port', x: -w / 2, y: cy, dir: 180, width: 7 },
        { id: 'neck', kind: 'neck', x: (bx0 + bx1) / 2, y: cy, width: 2 * B },
      ],
    }
  },
}

const balance: SymbolDef = {
  id: 'balance',
  name: 'Balance',
  aliases: ['top-pan balance', 'digital balance', 'electronic balance', 'scales'],
  pack: 'measuring',
  size: { w: 180, h: 56 },
  resize: 'width',
  min: { w: 100, h: 56 },
  params: [{ key: 'reading', label: 'Reading', type: 'text', default: '0.00 g' }],
  build({ w, h, p }) {
    const pan = w * 0.35,
      top = w * 0.43,
      x = w / 2,
      yb = 11, // top of the body
      dy = (yb + h) / 2 // centre of the display
    return {
      prims: [
        { d: rect(-5, 5, 5, yb), role: 'solid' }, // stem
        { d: closed([v(-top, yb, 4), v(top, yb, 4), v(x, h, 4), v(-x, h, 4)]).d(), role: 'solid' }, // body
        { d: closed([v(-pan, 0, 1.5), v(pan, 0, 1.5), v(pan, 5, 1.5), v(-pan, 5, 1.5)]).d(), role: 'solid' }, // pan
        { d: rect(-27, dy - 8, 27, dy + 8), role: 'outline' }, // display
      ],
      texts: [{ x: 0, y: dy + 3.5, text: str(p.reading, '0.00 g'), size: 10, anchor: 'middle' }],
      anchors: [
        { id: 'pan', kind: 'surface', x: 0, y: 0, dir: -90, width: 2 * pan },
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
      ],
    }
  },
}

const stopwatch: SymbolDef = {
  id: 'stopwatch',
  name: 'Stopwatch',
  aliases: ['stopclock', 'timer'],
  pack: 'measuring',
  size: { w: 54, h: 66 },
  resize: 'uniform',
  min: { w: 36, h: 44 },
  params: [
    {
      key: 'style',
      label: 'Style',
      type: 'choice',
      default: 'digital',
      options: [
        { value: 'digital', label: 'Digital' },
        { value: 'analogue', label: 'Analogue' },
      ],
    },
    { key: 'reading', label: 'Reading', type: 'text', default: '00:00.0' },
  ],
  build({ h, p }) {
    const k = h / 66,
      s = (n: number) => n * k,
      W = 54,
      H = 66 // drawn at 54 × 66, then scaled by k
    const prims: Prim[] = []
    const texts: SymbolText[] = []
    if (str(p.style, 'digital') === 'analogue') {
      const r = 0.44 * W,
        cy = H - 0.46 * W
      prims.push({ d: rect(s(-4), s(cy - r - 9), s(4), s(cy - r)), role: 'solid' }) // crown
      prims.push({ d: circle(0, s(cy), s(r)), role: 'solid' })
      let ticks = ''
      for (let i = 0; i < 12; i++) {
        const t = (i * Math.PI) / 6,
          r0 = r - 2,
          r1 = r - (i % 3 === 0 ? 7 : 4.5)
        ticks += `M${f(s(r0 * Math.sin(t)))} ${f(s(cy - r0 * Math.cos(t)))}L${f(s(r1 * Math.sin(t)))} ${f(s(cy - r1 * Math.cos(t)))}`
      }
      prims.push({ d: ticks, role: 'detail' })
      prims.push({ d: `M0 ${f(s(cy))}V${f(s(cy - r * 0.72))}`, role: 'outline' }) // the hand, at zero
    } else {
      const top = 0.16 * H,
        dw = 0.38 * W,
        dh = 0.34 * H,
        dy0 = top + 5 // display: in the upper half of the case
      prims.push({ d: rect(s(-20), s(top - 6), s(-10), s(top)) + rect(s(10), s(top - 6), s(20), s(top)), role: 'solid' }) // buttons
      prims.push({ d: closed([v(s(-W / 2), s(top), s(8)), v(s(W / 2), s(top), s(8)), v(s(W / 2), s(H), s(8)), v(s(-W / 2), s(H), s(8))]).d(), role: 'solid' })
      prims.push({ d: rect(s(-dw), s(dy0), s(dw), s(dy0 + dh)), role: 'outline' })
      texts.push({ x: 0, y: s(dy0 + dh / 2 + 3.2), text: str(p.reading, '00:00.0'), size: s(9), anchor: 'middle' })
    }
    return { prims, texts }
  },
}

const ruler: SymbolDef = {
  id: 'ruler',
  name: 'Ruler',
  aliases: ['metre rule', 'metre stick', 'rule', 'tape measure', 'half-metre rule'],
  pack: 'measuring',
  size: { w: 300, h: 22 },
  resize: 'width',
  min: { w: 100, h: 22 },
  params: [
    {
      key: 'length',
      label: 'Length (cm)',
      type: 'choice',
      default: '30',
      options: ['15', '30', '50', '100'].map((c) => ({ value: c, label: c })),
    },
    { key: 'numbers', label: 'Numbers', type: 'boolean', default: true },
  ],
  build({ w, h, p }) {
    const x = w / 2,
      cm = Number(str(p.length, '30')) || 30,
      margin = 8,
      x0 = -x + margin,
      x1 = x - margin,
      gap = (x1 - x0) / cm,
      per = cm === 100 ? 10 : 5 // centimetres between long ticks
    const fine = gap >= 3 // the 1 cm ticks need 3 u each
    const length = (i: number) => (i % per === 0 ? 12 : fine ? 8 : 0)
    const texts: SymbolText[] = []
    if (bool(p.numbers, true)) for (let i = 0; i <= cm; i += per) texts.push({ x: x0 + i * gap, y: h - 2.5, text: String(i), size: 8, anchor: 'middle' })
    return {
      prims: [
        { d: closed([v(-x, 0, 2), v(x, 0, 2), v(x, h, 2), v(-x, h, 2)]).d(), role: 'solid' },
        { d: vticks(0, x0, x1, cm, length), role: 'detail' },
      ],
      texts,
    }
  },
}

const instrumentBox: SymbolDef = {
  id: 'instrumentBox',
  name: 'Meter box',
  aliases: ['joulemeter', 'pH meter', 'data logger', 'signal generator', 'colorimeter', 'digital voltmeter', 'digital ammeter', 'multimeter'],
  label: (p) => str(p.title, 'pH meter'),
  pack: 'measuring',
  size: { w: 130, h: 80 },
  resize: 'free',
  min: { w: 70, h: 60 },
  params: [
    { key: 'title', label: 'Title', type: 'text', default: 'pH meter' },
    { key: 'reading', label: 'Reading', type: 'text', default: '7.00' },
    {
      key: 'terminals',
      label: 'Terminals',
      type: 'choice',
      default: 'none',
      options: [
        { value: 'none', label: 'None' },
        { value: '2', label: '2' },
        { value: '4', label: '4' },
      ],
    },
  ],
  build({ w, h, p }) {
    const x = w / 2,
      dw = w * 0.3, // half-width of the display (0.6w wide)
      dy0 = h * 0.15,
      dy1 = dy0 + 22,
      ty = h - 8 // centre of a terminal
    const terminals = str(p.terminals, 'none')
    const at: [string, number][] =
      terminals === '2'
        ? [
            ['a', -0.3 * w],
            ['b', 0.3 * w],
          ]
        : terminals === '4'
          ? [
              ['inA', -0.3 * w - 8],
              ['inB', -0.3 * w + 8],
              ['outA', 0.3 * w - 8],
              ['outB', 0.3 * w + 8],
            ]
          : []
    const prims: Prim[] = [
      { d: closed([v(-x, 0, 6), v(x, 0, 6), v(x, h, 6), v(-x, h, 6)]).d(), role: 'solid' },
      { d: rect(-dw, dy0, dw, dy1), role: 'outline' },
    ]
    if (at.length) prims.push({ d: at.map(([, tx]) => circle(tx, ty, 4)).join(''), role: 'solid' })
    const anchors: Anchor[] = [{ id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w }]
    for (const [id, tx] of at) anchors.push({ id, kind: 'terminal', x: tx, y: ty, dir: 90 })
    return {
      prims,
      texts: [
        { x: 0, y: (dy0 + dy1) / 2 + 4.2, text: str(p.reading, '7.00'), size: 12, anchor: 'middle' },
        { x: 0, y: dy1 + 13, text: str(p.title, 'pH meter'), size: 10, anchor: 'middle' },
      ],
      anchors,
    }
  },
}

const probe: SymbolDef = {
  id: 'probe',
  name: 'Probe',
  aliases: ['pH probe', 'temperature probe', 'sensor'],
  pack: 'measuring',
  size: { w: 12, h: 150 },
  resize: 'height',
  min: { w: 12, h: 50 },
  build({ h }) {
    const rod = new Path()
      .M(-4, 14)
      .L(-4, h - 4)
      .A(4, 4, h - 4, false)
      .L(4, 14)
      .Z()
    return {
      prims: [
        { d: rod.d(), role: 'solid' },
        { d: closed([v(-6, 0, 2), v(6, 0, 2), v(6, 16, 2), v(-6, 16, 2)]).d(), role: 'dark' }, // cap
      ],
      anchors: [
        { id: 'tip', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'top', kind: 'terminal', x: 0, y: 0, dir: -90 },
      ],
    }
  },
}

const lightGate: SymbolDef = {
  id: 'lightGate',
  name: 'Light gate',
  pack: 'measuring',
  size: { w: 70, h: 90 },
  resize: 'free',
  min: { w: 40, h: 40 },
  params: [{ key: 'beam', label: 'Beam', type: 'boolean', default: true }],
  build({ w, h, p }) {
    const x = w / 2,
      bar = 14,
      arm = 10,
      yBeam = h * 0.37
    const frame = closed([v(-x, 0, 3), v(x, 0, 3), v(x, h), v(x - arm, h), v(x - arm, bar, 2), v(-x + arm, bar, 2), v(-x + arm, h), v(-x, h)])
    const prims: Prim[] = [{ d: frame.d(), role: 'solid' }]
    if (bool(p.beam, true)) prims.push({ d: `M${f(-x + arm)} ${f(yBeam)}H${f(x - arm)}`, role: 'dashed' })
    return {
      prims,
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'lead', kind: 'terminal', x: -x, y: bar / 2, dir: 180 },
      ],
    }
  },
}

// ---------------------------------------------------------------- release 1.1 (priority B)

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

/**
 * Upright plastic syringe, nozzle down. The plunger is one rigid part: piston, rod and thumb pad. At plunger = 0 the piston is at the
 * nozzle end and the pad rests on the barrel; at plunger = 1 the pad is at the top of the box. The cavity is the space under the piston.
 */
const syringe: SymbolDef = {
  id: 'syringe',
  name: 'Syringe',
  aliases: ['plastic syringe'],
  pack: 'measuring',
  size: { w: 26, h: 120 },
  resize: 'height',
  min: { w: 26, h: 70 },
  params: [{ key: 'plunger', label: 'Plunger', type: 'number', default: 0.5, min: 0, max: 1, step: 0.05 }],
  build({ h, p }) {
    const B = 10, // half-width of the barrel (20 wide)
      N = 2, // half-width of the nozzle (4 wide)
      yEnd = h - 12, // the nozzle is 12 long
      yCone = yEnd - 6, // the closed end narrows from the barrel to the nozzle over 6 u
      yTop = yEnd - 0.5 * h, // the open end: the barrel is 0.5h long
      ear = 3, // the finger flange: a plate that sticks out 3 u on each side of the barrel, drawn edge on
      padW = 11, // half-width of the thumb pad
      padH = 5,
      pistonH = 5,
      rod = 3, // half-width of the rod
      plunger = clamp01(num(p.plunger, 0.5)),
      travel = yTop - padH, // how far the plunger moves: the pad is at y = 0 at plunger = 1
      face = yCone - 1 - plunger * travel, // the lower face of the piston: just above the shoulder at plunger = 0
      back = face - pistonH,
      padB = yTop - plunger * travel, // at plunger = 0 the pad rests on the barrel
      padT = padB - padH
    // One side: the flange, the barrel wall, the shoulder and the nozzle, as one line.
    const wall = (s: number) => `M${f(s * (B + ear))} ${f(yTop)}H${f(s * B)}V${f(yCone)}L${f(s * N)} ${f(yEnd)}V${f(h)}`
    // Piston, rod and thumb pad: one rigid part.
    const plungerD = `M${f(-B)} ${f(face)}V${f(back)}H${f(-rod)}V${f(padB)}H${f(-padW)}V${f(padT)}H${f(padW)}V${f(padB)}H${f(rod)}V${f(back)}H${f(B)}V${f(face)}Z`
    const cavity = closed([v(-B, face), v(B, face), v(B, yCone), v(N, yEnd), v(N, h), v(-N, h), v(-N, yEnd), v(-B, yCone)])
    return {
      prims: [
        { d: wall(-1) + wall(1), role: 'outline' },
        { d: plungerD, role: 'solid' },
      ],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [{ id: 'tip', kind: 'tip', x: 0, y: h, dir: 90, width: 2 * N }],
    }
  },
}

/** A spring balance. The pointer is a heavy line across the body, and the rod from it to the hook below moves with it. */
const newtonMeter: SymbolDef = {
  id: 'newtonMeter',
  name: 'Newton meter',
  aliases: ['spring balance', 'force meter', 'newtonmeter'],
  pack: 'measuring',
  size: { w: 30, h: 160 },
  resize: 'height',
  min: { w: 30, h: 100 },
  params: [{ key: 'reading', label: 'Reading', type: 'number', default: 0.3, min: 0, max: 1, step: 0.05 }],
  build({ h, p }) {
    const X = 11, // half-width of the body (22 wide)
      yTop = 14,
      yBot = 0.72 * h,
      R = 6, // the ring on top
      yZero = yTop + 10, // the first and the last mark of the scale: 10 divisions
      yLast = yBot - 10,
      yPointer = yZero + clamp01(num(p.reading, 0.3)) * (yLast - yZero),
      r = 5, // the hook
      yHook = h - 1 - r // where the rod ends and the hook bends; its lowest point is at y = h - 1
    const rodAndHook = new Path()
      .M(0, yPointer)
      .L(0, yHook)
      .A(r, 2 * r, yHook, false)
      .L(2 * r, yHook - 6)
    return {
      prims: [
        { d: rect(-X, yTop, X, yBot), role: 'solid' },
        { d: ticks(-X, yZero, yLast, 10, (i) => (i % 5 === 0 ? 8 : 5)), role: 'detail' },
        { d: rodAndHook.d(), role: 'outline' },
        { d: `M${f(1 - X)} ${f(yPointer)}H${f(X - 1)}`, role: 'heavy' }, // its round ends stay under the side walls
        { d: circle(0, yTop - R, R), role: 'outline' },
      ],
      anchors: [
        { id: 'top', kind: 'port', x: 0, y: yTop - 2 * R, dir: -90 },
        { id: 'hook', kind: 'port', x: r, y: h - 1, dir: 90 },
      ],
    }
  },
}

/** A rubber bulb on a sleeve that takes the top of a pipette. Drawn at 34 × 62 and scaled, as bunsenBurner. */
const pipetteFiller: SymbolDef = {
  id: 'pipetteFiller',
  name: 'Pipette filler',
  aliases: ['pipette pump', 'safety filler'],
  pack: 'measuring',
  size: { w: 34, h: 62 },
  resize: 'uniform',
  min: { w: 22, h: 40 },
  build({ h }) {
    const k = h / 62,
      s = (n: number) => n * k,
      R = 0.44 * 34, // the bulb
      yj = R + Math.sqrt(R * R - 7 * 7) // where the bulb is 14 wide: the top of the sleeve
    const sleeve = closed([v(s(-7), s(yj)), v(s(7), s(yj)), v(s(4.5), s(62), s(1.5)), v(s(-4.5), s(62), s(1.5))])
    return {
      prims: [
        { d: sleeve.d(), role: 'rubber' }, // under the bulb: it comes out from below it
        { d: circle(0, s(R), s(R)), role: 'rubber' },
        { d: circle(0, s(2 * R), s(4)), role: 'solid' }, // the valve, where the bulb meets the sleeve
      ],
    }
  },
}

/**
 * A magnified section of a scale, for reading questions. The scale is tied to the tube, so the Reading field sets the liquid level on
 * it: `top` is the value at y0 and `bottom` the value at y1, and either may be the larger. A burette reads down (top < bottom); a
 * measuring cylinder or a thermometer reads up (top > bottom). The cavity runs from one break line to the other.
 */
const scaleWindow: SymbolDef = {
  id: 'scaleWindow',
  name: 'Magnified scale',
  aliases: ['scale reading', 'enlarged scale'],
  pack: 'measuring',
  size: { w: 70, h: 150 },
  resize: 'free',
  min: { w: 50, h: 100 },
  params: [
    { key: 'top', label: 'Top value', type: 'number', default: 20, min: 0, max: 1000, step: 1 },
    { key: 'bottom', label: 'Bottom value', type: 'number', default: 21, min: 0, max: 1000, step: 1 },
    {
      key: 'divisions',
      label: 'Divisions',
      type: 'choice',
      default: '10',
      options: ['5', '10', '20'].map((c) => ({ value: c, label: c })),
    },
    { key: 'unit', label: 'Unit', type: 'text', default: 'cm³' },
  ],
  build({ w, h, p }) {
    const x = 0.25 * w, // the walls are 0.5w apart
      A = 2.5, // each break line swings 2.5 u above and below its middle line
      top = num(p.top, 20),
      end = num(p.bottom, 21),
      bottom = end === top ? top + 1 : end, // equal ends: draw as if bottom were top + 1
      count = Number(str(p.divisions, '10')) || 10,
      y0 = 14, // the value `top`
      y1 = h - 14 // the value `bottom`
    // A wavy break line across the tube, one full wave, as points. The upper one has its middle line at y = A, the lower one at y = h - A.
    const N = 40
    const wave = (dy: number): Pt[] => Array.from({ length: N + 1 }, (_, i) => ({ x: -x + (2 * x * i) / N, y: dy + A - A * Math.sin((2 * Math.PI * i) / N) }))
    const upper = wave(0),
      lower = wave(h - 2 * A)
    const line = (pts: Pt[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join('')
    const long = 0.45 * 2 * x,
      short = 0.22 * 2 * x
    const mark = (i: number) => (i === 0 || i === count || 2 * i === count ? long : short) // long at each end and at the middle
    const shown = (n: number) => String(Math.round(n * 1000) / 1000)
    return {
      prims: [
        { d: ticks(-x, y0, y1, count, mark), role: 'detail' },
        { d: `M${f(-x)} ${f(A)}V${f(h - A)}M${f(x)} ${f(A)}V${f(h - A)}`, role: 'outline' },
        { d: line(upper) + line(lower), role: 'detail' },
      ],
      texts: [
        { x: -x - 5, y: y0 + 3.6, text: shown(top), size: 10, anchor: 'end' },
        { x: -x - 5, y: y1 + 3.6, text: shown(bottom), size: 10, anchor: 'end' },
      ],
      cavities: [{ id: 'main', polys: [[...upper, ...lower.slice().reverse()]] }],
      scale: { cavity: 'main', unit: str(p.unit, 'cm³'), v0: top, y0, v1: bottom, y1 },
    }
  },
}

export const measuring: SymbolDef[] = [
  volumetricPipette,
  dropper,
  gasSyringe,
  balance,
  stopwatch,
  ruler,
  instrumentBox,
  probe,
  lightGate,
  syringe,
  newtonMeter,
  pipetteFiller,
  scaleWindow,
]
