// physics.ts — the "Physics" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { Path, f, rng, roundPoly, v, type V } from '../kernel/geom'
import { RIM, bool, circle, closed, num, rect } from './kit'
import type { Prim, SymbolDef } from './types'

/** A rectangle with rounded corners, as a closed path. */
const rrect = (x0: number, y0: number, x1: number, y1: number, r: number): string => closed([v(x0, y0, r), v(x1, y0, r), v(x1, y1, r), v(x0, y1, r)]).d()

/** A bar of half-width `hw` from (x0, y0) to (x1, y1), as a closed path. */
function bar(x0: number, y0: number, x1: number, y1: number, hw: number): string {
  const dx = x1 - x0,
    dy = y1 - y0,
    l = Math.hypot(dx, dy) || 1,
    nx = (-dy / l) * hw,
    ny = (dx / l) * hw
  return closed([v(x0 + nx, y0 + ny), v(x1 + nx, y1 + ny), v(x1 - nx, y1 - ny), v(x0 - nx, y0 - ny)]).d()
}

const trolley: SymbolDef = {
  id: 'trolley',
  name: 'Trolley',
  aliases: ['dynamics trolley', 'cart'],
  pack: 'physics',
  size: { w: 120, h: 44 },
  resize: 'width',
  min: { w: 60, h: 44 },
  params: [{ key: 'card', label: 'Card', type: 'boolean', default: false }],
  build({ w, h, p }) {
    const x = w / 2,
      bodyH = 26,
      wx = w * 0.3,
      wy = h - 10,
      hookY = bodyH / 2
    const prims: Prim[] = []
    if (bool(p.card, false)) prims.push({ d: rrect(-15, -26, 15, 0, 1), role: 'solid' }) // the card stands on the body, above the box
    prims.push(
      { d: rrect(-x, 0, x, bodyH, 3), role: 'solid' },
      { d: `M${f(x)} ${f(hookY)}h7`, role: 'heavy' }, // the hook, for a string
      { d: circle(-wx, wy, 10) + circle(wx, wy, 10), role: 'solid' },
      { d: circle(-wx, wy, 1.5) + circle(wx, wy, 1.5), role: 'detail' }, // hubs
    )
    return {
      prims,
      anchors: [
        { id: 'wheels', kind: 'base', x: 0, y: h, dir: 90, width: 2 * wx + 20 },
        { id: 'front', kind: 'port', x: x + 7, y: hookY, dir: 0 },
        { id: 'rear', kind: 'port', x: -x, y: hookY, dir: 180 },
        { id: 'top', kind: 'surface', x: 0, y: 0, dir: -90, width: w },
      ],
    }
  },
}

const pulley: SymbolDef = {
  id: 'pulley',
  name: 'Bench pulley',
  aliases: ['pulley', 'pulley on clamp'],
  pack: 'physics',
  size: { w: 50, h: 70 },
  resize: 'free',
  min: { w: 36, h: 50 },
  build({ w, h }) {
    const kx = w / 50,
      ky = h / 70,
      r = 16 * Math.min(kx, ky),
      cx = 6 * kx,
      cy = 18 * ky
    // The clamp block, at the lower left, with a slot on its left side that takes the edge of the bench.
    const bx0 = -w / 2,
      bx1 = bx0 + 16 * kx,
      by0 = h - 30 * ky,
      sy = (by0 + h) / 2,
      slot = 10 * kx
    const block = closed([
      v(bx0, by0, 2),
      v(bx1, by0, 2),
      v(bx1, h, 2),
      v(bx0, h, 2),
      v(bx0, sy + 3),
      v(bx0 + slot, sy + 3, 1),
      v(bx0 + slot, sy - 3, 1),
      v(bx0, sy - 3),
    ])
    return {
      prims: [
        { d: bar(cx, cy, (bx0 + bx1) / 2, by0 + 4, 2.5), role: 'solid' }, // bracket
        { d: block.d(), role: 'solid' },
        { d: circle(cx, cy, r), role: 'solid' },
        { d: circle(cx, cy, 1.5), role: 'detail' }, // hub
      ],
      anchors: [
        { id: 'top', kind: 'port', x: cx, y: cy - r, dir: -90 },
        { id: 'side', kind: 'port', x: cx + r, y: cy, dir: 0 },
      ],
    }
  },
}

const massHanger: SymbolDef = {
  id: 'massHanger',
  name: 'Masses on a hanger',
  aliases: ['slotted masses', 'weights', '100 g masses'],
  pack: 'physics',
  size: { w: 40, h: 110 },
  resize: 'height',
  min: { w: 40, h: 60 },
  params: [{ key: 'masses', label: 'Masses', type: 'number', default: 3, min: 0, max: 10, step: 1 }],
  build({ h, p }) {
    const n = Math.max(0, Math.round(num(p.masses, 3))),
      discY = h - 5,
      slab = Math.min(8, (h - 24) / Math.max(1, n)) // slabs shrink on a short hanger so that the stack still fits
    const hook = new Path().M(0, 12).A(5.5, 0, 1, true).A(5.5, 5.5, 6.5, true)
    let masses = ''
    for (let i = 0; i < n; i++) masses += rrect(-18, discY - (i + 1) * slab, 18, discY - i * slab, 1)
    const prims: Prim[] = [
      { d: hook.d(), role: 'outline' },
      { d: rect(-1.5, 12, 1.5, discY), role: 'solid' },
    ]
    if (masses) prims.push({ d: masses, role: 'dark' })
    prims.push({ d: rrect(-15, discY, 15, h, 1), role: 'solid' })
    return { prims, anchors: [{ id: 'hook', kind: 'port', x: 0, y: 0, dir: -90 }] }
  },
}

const spring: SymbolDef = {
  id: 'spring',
  name: 'Spring',
  pack: 'physics',
  size: { w: 26, h: 120 },
  resize: 'height',
  min: { w: 26, h: 60 },
  params: [{ key: 'coils', label: 'Coils', type: 'number', default: 10, min: 4, max: 24, step: 1 }],
  build({ w, h, p }) {
    const n = Math.max(1, Math.round(num(p.coils, 10))),
      x = w / 2,
      y0 = 14,
      y1 = h - 14,
      pitch = (y1 - y0) / (2 * n)
    // Loop, tail, zigzag, tail, loop: one line.
    const line = new Path().M(0, 8).L(0, y0)
    for (let i = 0; i < 2 * n; i++) line.L(i % 2 ? x : -x, y0 + (i + 0.5) * pitch)
    line.L(0, y1).L(0, h - 8)
    return {
      prims: [{ d: circle(0, 4, 4) + circle(0, h - 4, 4) + line.d(), role: 'outline' }],
      anchors: [
        { id: 'top', kind: 'port', x: 0, y: 0, dir: -90 },
        { id: 'bottom', kind: 'port', x: 0, y: h, dir: 90 },
      ],
    }
  },
}

const metalBlock: SymbolDef = {
  id: 'metalBlock',
  name: 'Metal block',
  aliases: ['aluminium block', 'copper block', 'iron block', 'specific heat capacity block'],
  pack: 'physics',
  size: { w: 110, h: 120 },
  resize: 'free',
  min: { w: 70, h: 60 },
  params: [{ key: 'insulated', label: 'Insulated', type: 'boolean', default: true }],
  build({ w, h, p }) {
    const insulated = bool(p.insulated, true),
      inset = insulated ? 9 : 0, // the jacket takes the outer 9 u of the box
      x = w / 2 - inset,
      bottom = h - inset,
      hx = -0.2 * w,
      hd = 0.78 * h,
      tx = 0.22 * w,
      td = 0.6 * h
    // One outline: along the top, down into each hole and out again, round the block.
    const block = closed([
      v(-x, 0, 3),
      v(hx - 8, 0),
      v(hx - 8, hd, 2),
      v(hx + 8, hd, 2),
      v(hx + 8, 0),
      v(tx - 5, 0),
      v(tx - 5, td, 2),
      v(tx + 5, td, 2),
      v(tx + 5, 0),
      v(x, 0, 3),
      v(x, bottom, 3),
      v(-x, bottom, 3),
    ])
    const prims: Prim[] = [{ d: block.d(), role: 'solid' }]
    if (insulated) prims.push({ d: `M${f(-w / 2)} 0V${f(h)}H${f(w / 2)}V0`, role: 'dashed' })
    return {
      prims,
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: 2 * x },
        { id: 'heater', kind: 'mouth', x: hx, y: 0, dir: -90, width: 16 },
        { id: 'thermo', kind: 'mouth', x: tx, y: 0, dir: -90, width: 10 },
      ],
    }
  },
}

const leslieCube: SymbolDef = {
  id: 'leslieCube',
  name: 'Leslie cube',
  label: 'Leslie cube',
  pack: 'physics',
  size: { w: 100, h: 104 },
  resize: 'free',
  min: { w: 50, h: 50 },
  build({ w, h }) {
    const x = w / 2,
      capH = 4,
      lidY = capH + 6 // the can starts under the lid
    const can = (top: number): V[] => [v(-x, top, 2), v(x, top, 2), v(x, h, 2), v(-x, h, 2)]
    return {
      prims: [
        { d: closed(can(lidY)).d(), role: 'outline' },
        { d: rrect(-x - 3, capH, x + 3, lidY, 1), role: 'solid' }, // lid
        { d: rrect(-6, 0, 6, capH, 1), role: 'solid' }, // filler cap
      ],
      cavities: [{ id: 'main', polys: closed(can(lidY + RIM)).polys() }],
      anchors: [{ id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w }],
    }
  },
}

const infraredDetector: SymbolDef = {
  id: 'infraredDetector',
  name: 'Infrared detector',
  aliases: ['IR detector', 'infrared thermometer', 'thermopile'],
  pack: 'physics',
  size: { w: 84, h: 34 },
  resize: 'width',
  min: { w: 50, h: 34 },
  build({ w, h }) {
    const x0 = -w / 2,
      bx = x0 + 0.3 * w, // the box takes the right 0.7w
      cy = h / 2
    return {
      prims: [
        { d: rect(x0, cy - 8, bx + 4, cy + 8), role: 'solid' }, // snout
        { d: rrect(bx, 0, w / 2, h, 4), role: 'solid' },
        { d: rect(x0, cy - 8, x0 + 4, cy + 8), role: 'dark' }, // window
      ],
      anchors: [
        { id: 'sensor', kind: 'tip', x: x0, y: cy, dir: 180 },
        { id: 'lead', kind: 'terminal', x: w / 2, y: cy, dir: 0 },
      ],
    }
  },
}

const rippleTank: SymbolDef = {
  id: 'rippleTank',
  name: 'Ripple tank',
  pack: 'physics',
  size: { w: 320, h: 250 },
  resize: 'free',
  min: { w: 180, h: 140 },
  build({ w, h }) {
    const x = w / 2,
      yT = 0.42 * h,
      yB = yT + 26,
      legX = x - 8,
      bulbY = yT - 0.32 * h,
      bulbR = 9
    const tray = (top: number): V[] => [v(-x, top), v(-x, yB, 3), v(x, yB, 3), v(x, top)]
    // Dipper: a bar in the water at the left, on a rod from the motor above the tray.
    const d0 = -x + 10,
      d1 = d0 + 0.3 * w,
      dm = (d0 + d1) / 2,
      dipY = yT + 6,
      motorY = yT - 36
    const rays = [-0.25 * w, 0, 0.25 * w].map((rx) => `M0 ${f(bulbY + bulbR)}L${f(rx)} ${f(yT)}`).join('')
    return {
      prims: [
        { d: rays, role: 'dashed' },
        { d: rect(-2, 0, 2, bulbY - bulbR + 1), role: 'solid' }, // lamp rod
        { d: circle(0, bulbY, bulbR), role: 'solid' },
        { d: rect(-x + 1, motorY - 11, -x + 5, yT), role: 'solid' }, // post on the tray rim that carries the motor
        { d: rect(-x + 5, motorY - 11, dm - 13, motorY - 7), role: 'solid' }, // arm
        { d: rect(dm - 13, motorY - 18, dm + 13, motorY), role: 'solid' }, // motor
        { d: `M${f(dm)} ${f(motorY)}V${f(dipY)}`, role: 'outline' },
        { d: `M${f(d0)} ${f(dipY)}H${f(d1)}`, role: 'heavy' }, // dipper bar
        { d: rect(-legX - 2, yB, -legX + 2, h) + rect(legX - 2, yB, legX + 2, h), role: 'solid' },
        { d: rrect(-0.45 * w, h - 5, 0.45 * w, h, 1), role: 'solid' }, // screen
        { d: roundPoly(tray(yT)).d(), role: 'outline' },
      ],
      cavities: [{ id: 'main', polys: closed(tray(yT + RIM)).polys() }],
      anchors: [{ id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w }],
    }
  },
}

const vibrationGenerator: SymbolDef = {
  id: 'vibrationGenerator',
  name: 'Vibration generator',
  aliases: ['vibrator', 'oscillator'],
  pack: 'physics',
  size: { w: 84, h: 70 },
  resize: 'free',
  min: { w: 50, h: 40 },
  build({ w, h }) {
    const top = 16,
      ty = h - 0.3 * (h - top),
      tx = w / 4
    return {
      prims: [
        { d: rrect(-w / 2, top, w / 2, h, 6), role: 'solid' },
        { d: rect(-2, 5, 2, top), role: 'solid' }, // pin
        { d: new Path().M(0, 5).A(2.5, 0, 0, false).d(), role: 'outline' }, // hook: a half loop that opens to the left
        { d: circle(-tx, ty, 4) + circle(tx, ty, 4), role: 'solid' }, // terminals
      ],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'pin', kind: 'port', x: 0, y: 0, dir: -90, width: 4 },
        { id: 'terminalA', kind: 'terminal', x: -tx, y: ty },
        { id: 'terminalB', kind: 'terminal', x: tx, y: ty },
      ],
    }
  },
}

const woodenBridge: SymbolDef = {
  id: 'woodenBridge',
  name: 'Wooden bridge',
  pack: 'physics',
  size: { w: 26, h: 24 },
  resize: 'free',
  min: { w: 12, h: 10 },
  build({ w, h }) {
    return {
      prims: [{ d: closed([v(-1, 0), v(1, 0), v(w / 2, h), v(-w / 2, h)]).d(), role: 'solid' }],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w },
        { id: 'apex', kind: 'port', x: 0, y: 0, dir: -90, width: 2 },
      ],
    }
  },
}

const lamp: SymbolDef = {
  id: 'lamp',
  name: 'Lamp',
  aliases: ['light source', 'bench lamp', 'ray box lamp'],
  pack: 'physics',
  size: { w: 80, h: 120 },
  resize: 'free',
  min: { w: 50, h: 70 },
  params: [{ key: 'rays', label: 'Rays', type: 'boolean', default: true }],
  build({ w, h, p }) {
    const bx = 0.15 * w,
      by = 0.2 * h,
      r = Math.min(16, 0.2 * w),
      hx = bx - r - 1, // the holder's centre; the bulb comes out of its right side
      prims: Prim[] = []
    if (bool(p.rays, true)) {
      let d = ''
      for (const deg of [-40, -20, 0, 20, 40]) {
        const a = (deg * Math.PI) / 180
        d += `M${f(bx + (r + 4) * Math.cos(a))} ${f(by + (r + 4) * Math.sin(a))}L${f(bx + (r + 18) * Math.cos(a))} ${f(by + (r + 18) * Math.sin(a))}`
      }
      prims.push({ d, role: 'detail' })
    }
    prims.push(
      { d: circle(bx, by, r), role: 'solid' },
      { d: rect(hx - 2.5, by + 7, hx + 2.5, h - 8), role: 'solid' }, // stem
      { d: rrect(hx - 9, by - 7, hx + 9, by + 7, 2), role: 'solid' }, // holder
      { d: rrect(-0.35 * w, h - 8, 0.35 * w, h, 2), role: 'solid' }, // base
    )
    return {
      prims,
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: 0.7 * w },
        { id: 'bulb', kind: 'heat', x: bx + r, y: by, dir: 0 },
      ],
    }
  },
}

const irregularSolid: SymbolDef = {
  id: 'irregularSolid',
  name: 'Irregular solid',
  aliases: ['stone', 'rock', 'pebble'],
  pack: 'physics',
  size: { w: 44, h: 34 },
  resize: 'free',
  min: { w: 20, h: 16 },
  build({ w, h }) {
    const r = rng(11), // a fixed pattern of radii
      a = w / 2 - 1,
      b = h / 2 - 1,
      pts: V[] = []
    for (let i = 0; i < 9; i++) {
      const t = (i * 2 * Math.PI) / 9,
        k = 0.8 + 0.2 * r()
      pts.push(v(a * k * Math.cos(t), h / 2 + b * k * Math.sin(t), 5))
    }
    return { prims: [{ d: closed(pts).d(), role: 'rubber' }] }
  },
}

export const physics: SymbolDef[] = [
  trolley,
  pulley,
  massHanger,
  spring,
  metalBlock,
  leslieCube,
  infraredDetector,
  rippleTank,
  vibrationGenerator,
  woodenBridge,
  lamp,
  irregularSolid,
]
