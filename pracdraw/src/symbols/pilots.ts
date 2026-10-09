// pilots.ts — the first 18 symbols. They set the drawing style. Every later symbol must look as if the same hand drew it.
// Read symbols/types.ts first for the local frame and the roles.

import { Path, f, mirrorProfile, roundPoly, v, type V } from '../kernel/geom'
import { CONE_END, CONE_LEN, HOLE, NECK, RIM, bool, circle, closed, joinTo, num, rect, str, ticks } from './kit'
import type { Anchor, Prim, SymbolDef, SymbolText } from './types'

// ---------------------------------------------------------------- containers

const beaker: SymbolDef = {
  id: 'beaker',
  name: 'Beaker',
  pack: 'containers',
  size: { w: 100, h: 120 },
  resize: 'free',
  min: { w: 40, h: 40 },
  params: [
    { key: 'graduations', label: 'Graduations', type: 'boolean', default: false },
    { key: 'spout', label: 'Spout', type: 'boolean', default: true },
  ],
  build({ w, h, p }) {
    const x = w / 2,
      r = Math.min(10, w * 0.1),
      lipL = bool(p.spout, true) ? 8 : 5
    // Rim turns out on both sides; the left side is the spout.
    const outline = roundPoly([v(-x - lipL, 0), v(-x, 6, 3), v(-x, h, r), v(x, h, r), v(x, 6, 3), v(x + 5, 0)])
    const cavity = closed([v(-x, RIM), v(-x, h, r), v(x, h, r), v(x, RIM)])
    const prims: Prim[] = []
    if (bool(p.graduations, false)) prims.push({ d: ticks(-x, h - (h - 24) / 5, h - (4 * (h - 24)) / 5, 3, (i) => (i % 2 ? 9 : 14)), role: 'detail' })
    prims.push({ d: outline.d(), role: 'outline' })
    return {
      prims,
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
        { id: 'rim', kind: 'surface', x: 0, y: 0, dir: -90, width: w }, // a lid, a watch glass or a basin rests here
      ],
    }
  },
}

const conicalFlask: SymbolDef = {
  id: 'conicalFlask',
  name: 'Conical flask',
  aliases: ['Erlenmeyer flask'],
  pack: 'containers',
  size: { w: 110, h: 150 },
  resize: 'free',
  min: { w: 50, h: 60 },
  build({ w, h }) {
    const n = Math.min(NECK, w * 0.5) / 2,
      neckH = h * 0.26,
      x = w / 2
    const outline = roundPoly(mirrorProfile([v(n + 3, 0), v(n, 4, 2), v(n, neckH, 16), v(x, h, 10)]))
    const cavity = closed([v(-n, RIM), v(-n, neckH, 16), v(-x, h, 10), v(x, h, 10), v(n, neckH, 16), v(n, RIM)])
    return {
      prims: [{ d: outline.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * n },
        { id: 'neck', kind: 'neck', x: 0, y: neckH * 0.5, width: 2 * n },
      ],
    }
  },
}

const roundBottomFlask: SymbolDef = {
  id: 'roundBottomFlask',
  name: 'Round-bottomed flask',
  aliases: ['RB flask', 'boiling flask'],
  pack: 'containers',
  size: { w: 110, h: 150 },
  resize: 'free',
  min: { w: 50, h: 70 },
  build({ w, h }) {
    const R = Math.min(w / 2, h * 0.42),
      cy = h - R,
      n = Math.min(NECK, R) / 2
    const yj = cy - Math.sqrt(R * R - n * n) // where the neck meets the bulb
    const a = Math.atan2(yj - cy, n) + 7 / R // blend end point on the bulb, right side
    const bx = R * Math.cos(a),
      by = cy + R * Math.sin(a)
    const body = (top: number) =>
      new Path()
        .M(-n, top)
        .L(-n, yj - 7)
        .Q(-n, yj, -bx, by)
        .A(R, bx, by, false, true)
        .Q(n, yj, n, yj - 7)
        .L(n, top)
    const outline = new Path()
      .M(-n - 3, 0)
      .L(-n, 4)
      .add(joinTo(body(4)))
      .L(n + 3, 0)
    return {
      prims: [{ d: outline.d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: body(RIM).Z().polys() }],
      anchors: [
        { id: 'bottom', kind: 'round', x: 0, y: h, dir: 90, width: 2 * R },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * n },
        { id: 'neck', kind: 'neck', x: 0, y: yj * 0.5, width: 2 * n },
      ],
    }
  },
}

function tube(id: string, name: string, w: number, h: number, aliases?: string[]): SymbolDef {
  return {
    id,
    name,
    aliases,
    pack: 'containers',
    size: { w, h },
    resize: 'free',
    min: { w: 12, h: 40 },
    build({ w, h }) {
      const x = w / 2
      const body = (top: number) =>
        new Path()
          .M(-x, top)
          .L(-x, h - x)
          .A(x, x, h - x, false)
          .L(x, top)
      const outline = new Path()
        .M(-x - 2.5, 0)
        .L(-x, 3.5)
        .add(joinTo(body(3.5)))
        .L(x + 2.5, 0)
      return {
        prims: [{ d: outline.d(), role: 'outline' }],
        cavities: [{ id: 'main', polys: body(RIM).Z().polys() }],
        anchors: [
          { id: 'bottom', kind: 'round', x: 0, y: h, dir: 90, width: w },
          { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
          { id: 'neck', kind: 'neck', x: 0, y: h * 0.2, width: w },
        ],
      }
    },
  }
}
const testTube = tube('testTube', 'Test tube', 24, 120)
const boilingTube = tube('boilingTube', 'Boiling tube', NECK, 150)

const trough: SymbolDef = {
  id: 'trough',
  name: 'Trough',
  aliases: ['water trough', 'pneumatic trough', 'washing-up bowl'],
  pack: 'containers',
  size: { w: 280, h: 95 },
  resize: 'free',
  min: { w: 80, h: 40 },
  build({ w, h }) {
    const x = w / 2
    const prof = (top: number): V[] => [v(-x, top), v(-x, h, 9), v(x, h, 9), v(x, top)]
    return {
      prims: [{ d: roundPoly(prof(0)).d(), role: 'outline' }],
      cavities: [{ id: 'main', polys: closed(prof(RIM)).polys() }],
      anchors: [{ id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w }],
    }
  },
}

// ---------------------------------------------------------------- measuring

/** Real divisions only (cm³): a fine step, a coarse step for a short cylinder, and the step between numbers. */
const CYLINDER: Record<string, { fine: number; coarse: number; numbers: number }> = {
  '10': { fine: 0.2, coarse: 0.5, numbers: 2 },
  '25': { fine: 0.5, coarse: 1, numbers: 5 },
  '50': { fine: 1, coarse: 2, numbers: 10 },
  '100': { fine: 2, coarse: 5, numbers: 20 },
  '250': { fine: 5, coarse: 10, numbers: 50 },
}

const measuringCylinder: SymbolDef = {
  id: 'measuringCylinder',
  name: 'Measuring cylinder',
  aliases: ['graduated cylinder'],
  pack: 'measuring',
  size: { w: 60, h: 190 },
  resize: 'free',
  min: { w: 30, h: 80 },
  params: [
    {
      key: 'capacity',
      label: 'Capacity (cm³)',
      type: 'choice',
      default: '100',
      options: ['10', '25', '50', '100', '250'].map((c) => ({ value: c, label: c })),
    },
    { key: 'numbers', label: 'Scale numbers', type: 'boolean', default: false },
  ],
  build({ w, h, p }) {
    const x = w * 0.3, // the tube is 0.6w wide; the foot is the full width of the box
      yb = h - 8,
      key = str(p.capacity, '100'),
      cap = Number(key),
      yFull = 26,
      div = CYLINDER[key] ?? CYLINDER['100']
    const outline = roundPoly([v(-x - 7, 0), v(-x, 8, 3), v(-x, yb, 3), v(x, yb, 3), v(x, 5, 2), v(x + 3, 0)])
    const foot = closed([v(-w / 2, yb, 2), v(w / 2, yb, 2), v(w / 2, h, 2), v(-w / 2, h, 2)])
    const cavity = closed([v(-x, RIM), v(-x, yb, 3), v(x, yb, 3), v(x, RIM)])
    // From the inside bottom (0) to yFull (capacity). Use the fine step when the ticks are 2.5 u apart or more.
    const step = (yb - yFull) / (cap / div.fine) >= 2.5 ? div.fine : div.coarse
    const count = Math.round(cap / step),
      per = Math.round(div.numbers / step), // divisions from one number to the next
      gap = (yb - yFull) / count
    const length = (i: number) => (i === 0 ? 0 : i % per === 0 ? x : per % 2 === 0 && i % (per / 2) === 0 ? x * 0.76 : x * 0.5)
    const texts: SymbolText[] = []
    if (bool(p.numbers, false))
      for (let i = per; i <= count; i += per)
        texts.push({ x: x + 5, y: yb - i * gap + 3.2, text: String(Math.round(i * step * 10) / 10), size: 9, anchor: 'start' })
    return {
      prims: [
        { d: foot.d(), role: 'solid' },
        { d: ticks(-x, yb, yFull, count, length), role: 'detail' },
        { d: outline.d(), role: 'outline' },
      ],
      texts,
      cavities: [{ id: 'main', polys: cavity.polys() }],
      scale: { cavity: 'main', unit: 'cm³', v0: 0, y0: yb, v1: cap, y1: yFull },
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * x },
      ],
    }
  },
}

const burette: SymbolDef = {
  id: 'burette',
  name: 'Burette',
  pack: 'measuring',
  size: { w: 18, h: 340 },
  resize: 'height',
  min: { w: 18, h: 200 },
  params: [{ key: 'numbers', label: 'Scale numbers', type: 'boolean', default: false }],
  build({ h, p }) {
    const x = 9,
      yTube = h - 92,
      yTap = h - 70,
      jet = 3.2,
      tip = 2.6,
      y0 = 24,
      y50 = yTube - 8
    const wall = (s: number) =>
      new Path()
        .M(s * x, 0)
        .L(s * x, yTube)
        .L(s * jet, yTube + 12)
        .L(s * jet, yTap - 7)
    const nozzle = (s: number) =>
      new Path()
        .M(s * jet, yTap + 7)
        .L(s * jet, h - 30)
        .L(s * tip, h)
    const inside = (top: number) =>
      new Path()
        .M(-x, top)
        .L(-x, yTube)
        .L(-jet, yTube + 12)
        .L(-jet, h - 30)
        .L(-tip, h)
        .L(tip, h)
        .L(jet, h - 30)
        .L(jet, yTube + 12)
        .L(x, yTube)
        .L(x, top)
        .Z()
    const key = `M7 ${f(yTap - 2.5)}H19V${f(yTap - 7)}H24V${f(yTap + 7)}H19V${f(yTap + 2.5)}H7`
    const texts: SymbolText[] = []
    if (bool(p.numbers, false))
      for (let i = 0; i <= 50; i += 10) texts.push({ x: x + 5, y: y0 + (i * (y50 - y0)) / 50 + 3.2, text: String(i), size: 9, anchor: 'start' })
    return {
      prims: [
        { d: ticks(-x, y0, y50, 50, (i) => (i % 10 === 0 ? 12 : i % 5 === 0 ? 9 : 5)), role: 'detail' },
        { d: wall(-1).d() + wall(1).d() + nozzle(-1).d() + nozzle(1).d(), role: 'outline' },
        { d: rect(-7, yTap - 7, 7, yTap + 7), role: 'solid' },
        { d: key, role: 'solid' },
      ],
      texts,
      cavities: [{ id: 'main', polys: inside(RIM).polys() }],
      scale: { cavity: 'main', unit: 'cm³', v0: 0, y0, v1: 50, y1: y50 },
      anchors: [
        { id: 'tip', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'neck', kind: 'neck', x: 0, y: h * 0.3, width: 18 },
      ],
    }
  },
}

const thermometer: SymbolDef = {
  id: 'thermometer',
  name: 'Thermometer',
  pack: 'measuring',
  size: { w: 9, h: 210 },
  resize: 'height',
  min: { w: 9, h: 100 },
  params: [{ key: 'numbers', label: 'Scale numbers', type: 'boolean', default: false }],
  build({ h, p }) {
    const x = 4.5,
      rb = 6.5,
      ys = h - 13,
      bore = 1.3,
      yBore = h - 12.6,
      yLow = ys - 16,
      yHigh = 22
    const outer = new Path().M(-x, x).A(x, x, x, true).L(x, ys).A(rb, -x, ys, true, true).Z()
    const thread = new Path().M(-bore, 9).L(-bore, yBore).A(4.4, bore, yBore, false, true).L(bore, 9).Z()
    // −10 °C to 110 °C. A tick every 5 °C, a long tick every 10 °C, a number every 20 °C.
    const texts: SymbolText[] = []
    if (bool(p.numbers, false))
      for (let i = 2; i <= 22; i += 4) texts.push({ x: x + 4, y: yLow + (i * (yHigh - yLow)) / 24 + 2.8, text: String(5 * i - 10), size: 8, anchor: 'start' })
    return {
      prims: [
        { d: outer.d(), role: 'paper' },
        { d: ticks(x, yLow, yHigh, 24, (i) => (i % 2 ? -3 : -4.6)), role: 'detail' },
        { d: outer.d(), role: 'outline' },
      ],
      texts,
      cavities: [{ id: 'main', polys: thread.polys(0.05), thread: true }],
      scale: { cavity: 'main', unit: '°C', v0: -10, y0: yLow, v1: 110, y1: yHigh },
      anchors: [{ id: 'bulb', kind: 'tip', x: 0, y: h, dir: 90 }],
    }
  },
}

// ---------------------------------------------------------------- heating

/** Tint of a luminous (yellow) flame: the safety flame, a spirit burner, a burning splint. */
export const SAFETY_FLAME = '#f7d26a'

const bunsenBurner: SymbolDef = {
  id: 'bunsenBurner',
  name: 'Bunsen burner',
  label: 'Bunsen burner',
  pack: 'heating',
  size: { w: 60, h: 124 },
  resize: 'uniform',
  min: { w: 40, h: 83 },
  params: [
    {
      key: 'flame',
      label: 'Flame',
      type: 'choice',
      default: 'blue',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'safety', label: 'Safety (yellow)' },
        { value: 'blue', label: 'Blue' },
      ],
    },
  ],
  build({ h, p }) {
    const k = h / 124,
      s = (n: number) => n * k,
      H = 124,
      top = 40 // drawn at 60 × 124, then scaled by k
    const base = closed([
      v(s(-28), s(H), s(1.5)),
      v(s(-28), s(H - 6), s(3)),
      v(s(-11), s(H - 13), s(3)),
      v(s(11), s(H - 13), s(3)),
      v(s(28), s(H - 6), s(3)),
      v(s(28), s(H), s(1.5)),
    ])
    const prims: Prim[] = []
    const flame = str(p.flame, 'blue')
    if (flame === 'blue') {
      prims.push({
        d: new Path()
          .M(s(-7), s(top))
          .C(s(-12), s(top - 14), s(-5), s(top - 26), 0, s(2))
          .C(s(5), s(top - 26), s(12), s(top - 14), s(7), s(top))
          .Z()
          .d(),
        role: 'flame',
      })
      prims.push({
        d: new Path()
          .M(s(-4), s(top))
          .C(s(-5), s(top - 9), s(-2), s(top - 15), 0, s(top - 21))
          .C(s(2), s(top - 15), s(5), s(top - 9), s(4), s(top))
          .Z()
          .d(),
        role: 'flameCore',
      })
    } else if (flame === 'safety') {
      prims.push({
        d: new Path()
          .M(s(-7), s(top))
          .C(s(-15), s(top - 12), s(-4), s(top - 22), s(-3), s(2))
          .C(s(4), s(top - 30), s(14), s(top - 14), s(7), s(top))
          .Z()
          .d(),
        role: 'flame',
        tint: SAFETY_FLAME,
      })
    }
    prims.push(
      { d: rect(s(-7), s(top), s(7), s(H - 13)), role: 'solid' }, // barrel
      { d: `M${f(s(7))} ${f(s(H - 20))}H${f(s(36))}V${f(s(H - 14))}H${f(s(7))}`, role: 'solid' }, // gas inlet
      { d: rect(s(-10), s(H - 36), s(10), s(H - 22)), role: 'solid' }, // collar
      { d: circle(0, s(H - 29), s(3)), role: 'detail' }, // air hole
      { d: base.d(), role: 'solid' },
    )
    return {
      prims,
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: s(56) },
        { id: 'flame', kind: 'heat', x: 0, y: 0, dir: -90 },
        { id: 'gas', kind: 'port', x: s(36), y: s(H - 17), dir: 0, width: s(6) },
      ],
    }
  },
}

const tripod: SymbolDef = {
  id: 'tripod',
  name: 'Tripod',
  pack: 'heating',
  size: { w: 120, h: 110 },
  resize: 'free',
  min: { w: 60, h: 50 },
  build({ w, h }) {
    const x = w / 2
    return {
      prims: [
        { d: `M${f(-x + 9)} 2L${f(-x)} ${f(h)}M${f(x - 9)} 2L${f(x)} ${f(h)}`, role: 'outline' },
        { d: `M${f(-x)} 0H${f(x)}`, role: 'heavy' },
      ],
      anchors: [
        { id: 'top', kind: 'surface', x: 0, y: 0, dir: -90, width: w },
        { id: 'feet', kind: 'base', x: 0, y: h, dir: 90, width: w },
      ],
    }
  },
}

const gauze: SymbolDef = {
  id: 'gauze',
  name: 'Gauze',
  aliases: ['gauze mat', 'wire gauze'],
  pack: 'heating',
  size: { w: 136, h: 5 },
  resize: 'width',
  min: { w: 40, h: 5 },
  build({ w }) {
    return {
      prims: [{ d: `M${f(-w / 2)} 2.5H${f(w / 2)}`, role: 'mesh' }],
      anchors: [
        { id: 'top', kind: 'surface', x: 0, y: 0, dir: -90, width: w },
        { id: 'under', kind: 'base', x: 0, y: 5, dir: 90, width: w },
      ],
    }
  },
}

const heatproofMat: SymbolDef = {
  id: 'heatproofMat',
  name: 'Heatproof mat',
  aliases: ['heat-resistant mat', 'bench mat'],
  pack: 'heating',
  size: { w: 180, h: 8 },
  resize: 'width',
  min: { w: 60, h: 8 },
  build({ w }) {
    const x = w / 2
    return {
      prims: [{ d: closed([v(-x, 0, 1.5), v(x, 0, 1.5), v(x, 8, 1.5), v(-x, 8, 1.5)]).d(), role: 'rubber' }],
      anchors: [
        { id: 'top', kind: 'surface', x: 0, y: 0, dir: -90, width: w },
        { id: 'under', kind: 'base', x: 0, y: 8, dir: 90, width: w },
      ],
    }
  },
}

// ---------------------------------------------------------------- support

const bung: SymbolDef = {
  id: 'bung',
  name: 'Bung',
  aliases: ['stopper', 'rubber bung'],
  pack: 'support',
  size: { w: 38, h: 24 },
  resize: 'free',
  min: { w: 14, h: 12 },
  params: [{ key: 'holes', label: 'Holes', type: 'number', default: 1, min: 0, max: 2, step: 1 }],
  build({ w, h, p }) {
    const top = w / 2,
      bot = w / 2 - 4,
      holes = Math.round(num(p.holes, 1))
    const centres = holes === 0 ? [] : holes === 1 ? [0] : [-w * 0.2, w * 0.2]
    const edges = [-Infinity, ...centres.flatMap((c) => [c - HOLE, c + HOLE]), Infinity]
    let d = ''
    // One trapezium piece between each pair of holes. A hole is left empty so that a tube shows through it.
    for (let i = 0; i < edges.length; i += 2) {
      const l = edges[i],
        r = edges[i + 1]
      d += roundPoly([v(Math.max(l, -top), 0), v(Math.min(r, top), 0), v(Math.min(r, bot), h), v(Math.max(l, -bot), h)], true).d()
    }
    const anchors: Anchor[] = [{ id: 'plug', kind: 'plug', x: 0, y: h * 0.4, dir: 90, width: w - 3.2 }]
    centres.forEach((c, i) => anchors.push({ id: `hole${i + 1}`, kind: 'port', x: c, y: 0, dir: -90, width: 2 * HOLE }))
    return { prims: [{ d, role: 'rubber' }], anchors }
  },
}

const clampStand: SymbolDef = {
  id: 'clampStand',
  name: 'Clamp stand',
  aliases: ['retort stand', 'stand'],
  pack: 'support',
  size: { w: 150, h: 380 },
  resize: 'free',
  min: { w: 80, h: 120 },
  build({ w, h }) {
    const x = w / 2,
      rod = -x + 24
    return {
      prims: [
        { d: rect(rod - 3, 0, rod + 3, h - 9), role: 'solid' },
        { d: closed([v(-x, h - 9, 2), v(x, h - 9, 2), v(x, h, 2), v(-x, h, 2)]).d(), role: 'solid' },
      ],
      anchors: [
        { id: 'rod', kind: 'rod', x: rod, y: h / 2, dir: 0 },
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
      ],
    }
  },
}

const bossClamp: SymbolDef = {
  id: 'bossClamp',
  name: 'Boss and clamp',
  aliases: ['clamp', 'boss'],
  pack: 'support',
  size: { w: 110, h: 40 },
  resize: 'width',
  min: { w: 70, h: 40 },
  params: [{ key: 'grip', label: 'Jaw opening', type: 'number', default: 30, min: 14, max: 60, step: 2 }],
  build({ w, p }) {
    const x0 = -w / 2,
      ay = 20,
      grip = Math.min(num(p.grip, 30), (w - 40) / 0.9), // a short clamp cannot open as wide
      g = grip / 2,
      xj = w / 2 - (10 + grip * 0.9)
    const jaw = (s: number) => `M${f(xj)} ${f(ay + s * 2.5)}L${f(xj + 10)} ${f(ay + s * g)}H${f(w / 2)}`
    return {
      prims: [
        { d: rect(x0 + 18, ay - 2.5, xj, ay + 2.5), role: 'solid' }, // arm
        { d: rect(x0, ay - 9, x0 + 18, ay + 9), role: 'solid' }, // boss
        { d: jaw(-1) + jaw(1), role: 'heavy' },
      ],
      anchors: [
        { id: 'sleeve', kind: 'sleeve', x: x0 + 9, y: ay, dir: 180 },
        { id: 'grip', kind: 'grip', x: w / 2 - grip * 0.45, y: ay, dir: 0, width: grip },
      ],
    }
  },
}

// ---------------------------------------------------------------- filtering

const filterFunnel: SymbolDef = {
  id: 'filterFunnel',
  name: 'Filter funnel',
  aliases: ['funnel'],
  pack: 'filtering',
  size: { w: 84, h: 110 },
  resize: 'free',
  min: { w: 40, h: 50 },
  build({ w, h }) {
    const x = w / 2,
      s = 4.5,
      yc = h * 0.46
    // The stem end is cut at an angle: the left wall is 9 u shorter.
    const outline = `M${f(-x)} 0L${f(-s)} ${f(yc)}V${f(h - 9)}M${f(x)} 0L${f(s)} ${f(yc)}V${f(h)}`
    const cavity = new Path()
      .M(-x + 1, RIM)
      .L(-s, yc)
      .L(-s, h - 9)
      .L(s, h)
      .L(s, yc)
      .L(x - 1, RIM)
      .Z()
    return {
      prims: [{ d: outline, role: 'outline' }],
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'stem', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'rim', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
      ],
    }
  },
}

// ---------------------------------------------------------------- organic

/**
 * Drawn lying down. Left end = the higher end: a socket. Right end = the lower end: a cone. Rotate it for reflux or distillation.
 * The cone seats in a flask neck or in a receiver adaptor. The socket takes the cone of a still head.
 */
const liebigCondenser: SymbolDef = {
  id: 'liebigCondenser',
  name: 'Liebig condenser',
  label: 'Liebig condenser',
  aliases: ['condenser'],
  pack: 'organic',
  size: { w: 290, h: 70 },
  resize: 'width',
  min: { w: 180, h: 70 },
  build({ w }) {
    const h = 70,
      ax = h / 2,
      a = 6.5, // half-width of the inner tube
      J = 17, // half-width of the jacket
      S = NECK / 2, // half-width of the socket mouth and of the cone shoulder
      E = CONE_END / 2,
      x0 = -w / 2,
      x1 = w / 2
    const j0 = x0 + CONE_LEN + 18,
      j1 = x1 - CONE_LEN - 18 // jacket ends
    const pOut = j0 + 20,
      pIn = j1 - 20,
      pw = 4.5 // water ports: centres and half-width
    // One wall of the inner tube: socket, tube, cone. s = -1 is the upper side, +1 the lower side.
    const inner = (s: number): V[] => [
      v(x0, ax + s * S),
      v(x0 + CONE_LEN, ax + s * E, 3),
      v(x0 + CONE_LEN + 10, ax + s * a, 6),
      v(x1 - CONE_LEN - 10, ax + s * a, 6),
      v(x1 - CONE_LEN, ax + s * S, 3),
      v(x1, ax + s * E),
    ]
    // One side of the jacket with its port.
    const jacket = (s: number, port: number, open: boolean) => {
      const yj = ax + s * J,
        yp = s < 0 ? 2 : h - 2
      const q = new Path()
        .M(j0, ax + s * a)
        .Q(j0, yj, j0 + 9, yj)
        .L(port - pw, yj)
        .L(port - pw, yp)
      if (open) q.M(port + pw, yp)
      else q.L(port + pw, yp)
      return q
        .L(port + pw, yj)
        .L(j1 - 9, yj)
        .Q(j1, yj, j1, ax + s * a)
    }
    const bore = closed([...inner(-1), ...inner(1).reverse()])
    return {
      prims: [{ d: roundPoly(inner(-1)).d() + roundPoly(inner(1)).d() + jacket(-1, pOut, true).d() + jacket(1, pIn, true).d(), role: 'outline' }],
      cavities: [
        { id: 'jacket', polys: [...jacket(-1, pOut, false).Z().polys(), ...jacket(1, pIn, false).Z().polys()] },
        { id: 'inner', polys: bore.polys() },
      ],
      anchors: [
        { id: 'socket', kind: 'mouth', x: x0, y: ax, dir: 180, width: NECK },
        { id: 'cone', kind: 'plug', x: x1 - CONE_LEN, y: ax, dir: 0, width: NECK },
        { id: 'tip', kind: 'tip', x: x1, y: ax, dir: 0, width: CONE_END },
        { id: 'waterOut', kind: 'port', x: pOut, y: 2, dir: -90, width: 2 * pw },
        { id: 'waterIn', kind: 'port', x: pIn, y: h - 2, dir: 90, width: 2 * pw },
      ],
    }
  },
}

export const PILOTS: SymbolDef[] = [
  beaker,
  conicalFlask,
  roundBottomFlask,
  testTube,
  boilingTube,
  trough,
  measuringCylinder,
  burette,
  thermometer,
  bunsenBurner,
  tripod,
  gauze,
  heatproofMat,
  bung,
  clampStand,
  bossClamp,
  filterFunnel,
  liebigCondenser,
]
