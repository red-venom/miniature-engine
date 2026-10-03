// biology.ts — the "Biology" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { Path, f, v } from '../kernel/geom'
import { circle, closed, rect, str } from './kit'
import type { Prim, SymbolDef } from './types'

/** A rectangle with rounded corners, as a closed path. */
const rrect = (x0: number, y0: number, x1: number, y1: number, r: number): string => closed([v(x0, y0, r), v(x1, y0, r), v(x1, y1, r), v(x0, y1, r)]).d()

/**
 * A rectangle along a direction: from `l0` to `l1` along the unit vector (ux, uy) from (cx, cy), `hw` each side of that line.
 */
function along(cx: number, cy: number, ux: number, uy: number, l0: number, l1: number, hw: number, r = 1): string {
  const nx = -uy * hw,
    ny = ux * hw
  return closed([
    v(cx + ux * l0 + nx, cy + uy * l0 + ny, r),
    v(cx + ux * l1 + nx, cy + uy * l1 + ny, r),
    v(cx + ux * l1 - nx, cy + uy * l1 - ny, r),
    v(cx + ux * l0 - nx, cy + uy * l0 - ny, r),
  ]).d()
}

const microscope: SymbolDef = {
  id: 'microscope',
  name: 'Microscope',
  aliases: ['light microscope', 'optical microscope'],
  pack: 'biology',
  size: { w: 160, h: 250 },
  resize: 'uniform',
  min: { w: 64, h: 100 },
  build({ h }) {
    // Drawn at 160 × 250, then scaled by k. Side view: the arm at the back (right), the eyepiece at the upper left.
    const k = h / 250,
      s = (n: number) => n * k,
      H = 250,
      baseY = H - 12,
      stageY = 0.62 * H, // 155
      stage0 = -58,
      stage1 = 30
    // Body tube axis: from the nosepiece (nx, ny) up and to the left, 25° from upright.
    const tilt = (25 * Math.PI) / 180,
      ux = -Math.sin(tilt),
      uy = -Math.cos(tilt),
      nx = -10,
      ny = 121,
      tubeLen = 95
    const arm = new Path()
      .M(s(-26), s(58))
      .L(s(-2), s(58))
      .Q(s(46), s(62), s(50), s(130))
      .L(s(50), baseY * k)
      .L(s(30), baseY * k)
      .L(s(30), s(150))
      .Q(s(30), s(78), s(-26), s(74))
      .Z()
    const tube = along(s(nx), s(ny), ux, uy, s(6), s(tubeLen), s(11))
    const eyepiece = along(s(nx), s(ny), ux, uy, s(tubeLen), s(tubeLen + 18), s(8))
    // Objectives: one straight down at the stage, a shorter one turned 35° to the side.
    const o2 = (35 * Math.PI) / 180
    const objectives = along(s(-14), s(124), 0, 1, 0, s(24), s(5)) + along(s(-2), s(124), Math.sin(o2), Math.cos(o2), 0, s(16), s(5))
    const lamp = new Path()
      .M(s(-24), baseY * k)
      .A(s(10), s(-4), baseY * k, true)
      .Z()
    return {
      prims: [
        { d: arm.d(), role: 'solid' },
        { d: rrect(s(stage0), s(stageY - 3), s(stage1), s(stageY + 3), s(1)), role: 'solid' }, // stage
        { d: `M${f(s(-48))} ${f(s(stageY - 3))}v${f(s(-3))}h${f(s(28))}v${f(s(3))}`, role: 'detail' }, // stage clip
        { d: lamp.d(), role: 'solid' },
        { d: rrect(s(-64), baseY * k, s(64), H * k, s(2)), role: 'solid' },
        { d: circle(s(40), s(190), s(9)), role: 'solid' }, // coarse focus
        { d: circle(s(40), s(190), s(6)), role: 'solid' }, // fine focus
        { d: objectives, role: 'solid' },
        { d: circle(s(nx), s(ny), s(12)), role: 'solid' }, // nosepiece
        { d: tube, role: 'solid' },
        { d: eyepiece, role: 'solid' },
      ],
      anchors: [
        { id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: s(128) },
        { id: 'stage', kind: 'surface', x: s((stage0 + stage1) / 2), y: s(stageY - 3), dir: -90, width: s(stage1 - stage0) },
      ],
    }
  },
}

const microscopeSlide: SymbolDef = {
  id: 'microscopeSlide',
  name: 'Microscope slide (side view)',
  aliases: ['slide', 'cover slip'],
  pack: 'biology',
  size: { w: 120, h: 6 },
  resize: 'width',
  min: { w: 40, h: 6 },
  params: [{ key: 'coverSlip', label: 'Cover slip', type: 'boolean', default: true }],
  build({ w, p }) {
    const x = w / 2,
      c = 0.125 * w
    const prims: Prim[] = [{ d: rect(-x, 3, x, 6), role: 'solid' }]
    if (p.coverSlip !== false) {
      prims.push({ d: `M${f(-c + 2)} 3H${f(c - 2)}`, role: 'dark' }) // the specimen, under the cover slip
      prims.push({ d: rect(-c, 1, c, 3), role: 'solid' })
    }
    return {
      prims,
      anchors: [
        { id: 'top', kind: 'surface', x: 0, y: 3, dir: -90, width: w },
        { id: 'under', kind: 'base', x: 0, y: 6, dir: 90, width: w },
      ],
    }
  },
}

const quadrat: SymbolDef = {
  id: 'quadrat',
  name: 'Quadrat (top view)',
  pack: 'biology',
  size: { w: 170, h: 170 },
  resize: 'uniform',
  min: { w: 60, h: 60 },
  params: [
    {
      key: 'grid',
      label: 'Grid',
      type: 'choice',
      default: '5',
      options: ['1', '2', '5', '10'].map((n) => ({ value: n, label: `${n} × ${n}` })),
    },
  ],
  build({ h, p }) {
    const k = h / 170,
      o = 85 * k,
      i = 80 * k,
      n = Math.max(1, Math.round(Number(str(p.grid, '5'))) || 1)
    let grid = ''
    for (let j = 1; j < n; j++) {
      const t = -i + (2 * i * j) / n
      grid += `M${f(t)} ${f(o - i)}V${f(o + i)}M${f(-i)} ${f(o + t)}H${f(i)}`
    }
    const prims: Prim[] = [
      { d: rect(-o, 0, o, 2 * o), role: 'solid' },
      { d: rect(-i, o - i, i, o + i), role: 'solid' },
    ]
    if (grid) prims.push({ d: grid, role: 'detail' })
    return { prims }
  },
}

const pondweed: SymbolDef = {
  id: 'pondweed',
  name: 'Pondweed',
  aliases: ['Elodea', 'Cabomba', 'aquatic plant'],
  pack: 'biology',
  size: { w: 24, h: 110 },
  resize: 'free',
  min: { w: 16, h: 50 },
  build({ w, h }) {
    // The stem: a cubic S-curve from the cut end (0, h) to the tip (0, 0).
    const a = 0.5 * w,
      c1 = { x: a, y: 0.7 * h },
      c2 = { x: -a, y: 0.3 * h }
    const at = (t: number) => {
      const u = 1 - t
      return {
        x: 3 * u * u * t * c1.x + 3 * u * t * t * c2.x,
        y: u * u * u * h + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y,
        dx: 3 * u * u * c1.x + 6 * u * t * (c2.x - c1.x) - 3 * t * t * c2.x,
        dy: -3 * u * u * h + 3 * u * u * c1.y - 6 * u * t * c1.y + 6 * u * t * c2.y - 3 * t * t * c2.y,
      }
    }
    const stem = new Path().M(0, h).C(c1.x, c1.y, c2.x, c2.y, 0, 0)
    // Leaves: a pair every 10 u along the stem, each a pointed oval 9 by 4, angled 40° towards the tip.
    let leaves = ''
    const leaf = (x: number, y: number, ang: number) => {
      const ux = Math.cos(ang),
        uy = Math.sin(ang),
        nx = -uy * 4,
        ny = ux * 4
      return `M${f(x)} ${f(y)}Q${f(x + 4.5 * ux + nx)} ${f(y + 4.5 * uy + ny)} ${f(x + 9 * ux)} ${f(y + 9 * uy)}Q${f(x + 4.5 * ux - nx)} ${f(y + 4.5 * uy - ny)} ${f(x)} ${f(y)}Z`
    }
    for (let y = h - 10; y >= 12; y -= 10) {
      // Find the parameter t at this height (y falls as t rises).
      let lo = 0,
        hi = 1
      for (let j = 0; j < 24; j++) {
        const mid = (lo + hi) / 2
        if (at(mid).y > y) lo = mid
        else hi = mid
      }
      const q = at((lo + hi) / 2),
        up = Math.atan2(q.dy, q.dx) // along the stem, towards the tip
      leaves += leaf(q.x, q.y, up - (40 * Math.PI) / 180) + leaf(q.x, q.y, up + (40 * Math.PI) / 180)
    }
    return {
      prims: [
        { d: stem.d(), role: 'outline' },
        { d: leaves, role: 'solid' },
      ],
      anchors: [{ id: 'cut', kind: 'tip', x: 0, y: h, dir: 90 }],
    }
  },
}

const potatoCylinder: SymbolDef = {
  id: 'potatoCylinder',
  name: 'Potato cylinder',
  aliases: ['potato chip', 'plant tissue'],
  pack: 'biology',
  size: { w: 16, h: 56 },
  resize: 'free',
  min: { w: 8, h: 16 },
  build({ w, h }) {
    return { prims: [{ d: rrect(-w / 2, 0, w / 2, h, Math.min(5, w / 2, h / 2)), role: 'solid' }] }
  },
}

export const biology: SymbolDef[] = [microscope, microscopeSlide, quadrat, pondweed, potatoCylinder]
