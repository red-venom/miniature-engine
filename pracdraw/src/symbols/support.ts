// support.ts — the "Support" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { P, Path, bounds, f, rng, roundPoly, scan, v } from '../kernel/geom'
import { bool, circle, closed, num, rect, str } from './kit'
import { SAFETY_FLAME } from './pilots'
import type { Anchor, Prim, SymbolDef } from './types'

/** Short straight line. */
const line = (x0: number, y0: number, x1: number, y1: number): string => `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`

/**
 * A luminous flame: the shape of the bunsenBurner safety flame, drawn `height` high and about `width` wide,
 * with its base centred at (cx, baseY). The caller draws the part that holds it over the base.
 */
export function luminousFlame(cx: number, baseY: number, height: number, width: number): Prim {
  const kx = width / 14,
    ky = height / 38 // the pilot's flame is 14 wide and 38 high
  const X = (n: number) => cx + n * kx,
    Y = (n: number) => baseY - n * ky
  return {
    d: new Path().M(X(-7), Y(0)).C(X(-15), Y(12), X(-4), Y(22), X(-3), Y(38)).C(X(4), Y(30), X(14), Y(14), X(7), Y(0)).Z().d(),
    role: 'flame',
    tint: SAFETY_FLAME,
  }
}

// ---------------------------------------------------------------- racks, bench, lids

const testTubeRack: SymbolDef = {
  id: 'testTubeRack',
  name: 'Test-tube rack',
  pack: 'support',
  size: { w: 220, h: 90 },
  resize: 'width',
  min: { w: 120, h: 90 },
  params: [
    { key: 'holes', label: 'Holes', type: 'number', default: 6, min: 3, max: 8, step: 1 },
    {
      key: 'tube',
      label: 'Tube',
      type: 'choice',
      default: 'test',
      options: [
        { value: 'test', label: 'Test tube' },
        { value: 'boiling', label: 'Boiling tube' },
      ],
    },
  ],
  build({ w, h, p }) {
    const x = w / 2,
      holes = Math.max(1, Math.round(num(p.holes, 6))),
      pitch = (w - 16) / holes,
      gap = Math.min(str(p.tube, 'test') === 'boiling' ? 38 : 26, pitch - 6),
      yTop = h * 0.25,
      yBot = h - 8
    const centres = Array.from({ length: holes }, (_, i) => -x + 8 + pitch * (i + 0.5))
    // The top bar in pieces: one between each pair of gaps, as the bung.
    const edges = [-x + 8, ...centres.flatMap((c) => [c - gap / 2, c + gap / 2]), x - 8]
    let bar = ''
    for (let i = 0; i < edges.length; i += 2) bar += rect(edges[i], yTop, edges[i + 1], yTop + 8)
    const anchors: Anchor[] = centres.map((c, i) => ({ id: `slot${i + 1}`, kind: 'cup', x: c, y: yBot, dir: -90, width: gap }))
    anchors.push({ id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: w })
    return {
      prims: [
        { d: bar, role: 'solid' },
        { d: rect(-x + 8, yBot, x - 8, h), role: 'solid' },
        { d: rect(-x, 0, -x + 8, h) + rect(x - 8, 0, x, h), role: 'solid' },
      ],
      anchors,
    }
  },
}

const testTubeHolder: SymbolDef = {
  id: 'testTubeHolder',
  name: 'Test-tube holder',
  pack: 'support',
  size: { w: 150, h: 26 },
  resize: 'width',
  min: { w: 100, h: 26 },
  build({ w, h }) {
    const x0 = -w / 2,
      x1 = w / 2,
      c = h / 2,
      xs = x0 + 0.6 * w, // the spring
      xa = x0 + 14, // the slit between the arms begins here: up to it they are one piece
      xg = x1 - 17, // the centre of the jaws: a ring 26 across with a hole 14 across, open at the right
      R = 13,
      ri = 7,
      g = 2, // half the width of the slit
      a = (33 * Math.PI) / 180 // the ends of the ring: this far above and below the level of the slit
    // Points on the outside and the inside of the ring. `s` is -1 above the level of the slit and 1 below it; `ang` is measured up from the level.
    const outer = (ang: number, s: number) => [xg + R * Math.cos(ang), c + s * R * Math.sin(ang)] as const
    const inner = (ang: number, s: number) => [xg + ri * Math.cos(ang), c + s * ri * Math.sin(ang)] as const
    // The upper edge runs level from the nose to the spring, then straight to where it touches the ring.
    const touch = -Math.atan2(-8, xs - xg) - Math.acos(Math.min(1, R / Math.hypot(xs - xg, 8)))
    const hole = xg - Math.sqrt(ri * ri - g * g) // where the slit meets the hole
    const tip = (R - ri) / 2 // the ends of the ring are round
    const outline = new Path()
      .M(x0, c - 2)
      .A(6, x0 + 6, c - 8, true) // the nose
      .L(xs, c - 8)
      .L(...outer(touch, -1))
      .A(R, ...outer(a, -1), true)
      .A(tip, ...inner(a, -1), true)
      .A(ri, hole, c - g, false)
      .L(xs, c - g)
      .L(xa, c)
      .L(xs, c + g)
      .L(hole, c + g)
      .A(ri, ...inner(a, 1), false)
      .A(tip, ...outer(a, 1), true)
      .A(R, ...outer(touch, 1), true)
      .L(xs, c + 8)
      .L(x0 + 6, c + 8)
      .A(6, x0, c + 2, true)
      .Z()
    return {
      prims: [
        { d: outline.d(), role: 'solid' },
        { d: rect(xs - 4, c - 10, xs + 4, c + 10), role: 'solid' }, // the spring
      ],
      anchors: [{ id: 'grip', kind: 'grip', x: xg, y: c, dir: 0, width: 2 * ri }],
    }
  },
}

const benchLine: SymbolDef = {
  id: 'benchLine',
  name: 'Bench',
  aliases: ['bench surface', 'table', 'floor'],
  autoLabel: false,
  pack: 'support',
  size: { w: 500, h: 12 },
  resize: 'width',
  min: { w: 60, h: 12 },
  build({ w }) {
    const x = w / 2,
      s = 10 / Math.SQRT2 // a hatch line 10 u long at 45 degrees
    let hatch = ''
    // One run from the left end to the right at an 8 u pitch, so that every gap is 8 u. Each line stays inside the box.
    for (let hx = -x + s; hx <= x; hx += 8) hatch += line(hx, 0, hx - s, s)
    return {
      prims: [
        { d: hatch, role: 'detail' },
        { d: line(-x, 0, x, 0), role: 'heavy' },
      ],
      anchors: [{ id: 'top', kind: 'surface', x: 0, y: 0, dir: -90, width: w }],
    }
  },
}

/**
 * A cloud: eight circular arcs round an oval centred on (0, h / 2), fitted to the w × h box.
 * The cusps lie on the oval at equal distances along it, so that the eight bumps are alike and the outline is symmetric about both axes.
 */
function cloud(w: number, h: number): Path {
  const cy = h / 2
  const draw = (a0: number, b0: number): Path => {
    const a = Math.max(a0, 0.5), // a box smaller than its minimum still gives a finite outline
      b = Math.max(b0, 0.5)
    // Distance along one quarter of the oval from the end of its long axis. The cusps lie at 1/4 and 3/4 of it.
    const n = 200,
      dist = [0]
    for (let i = 1; i <= n; i++) {
      const t0 = ((i - 1) * Math.PI) / 2 / n,
        t1 = (i * Math.PI) / 2 / n
      dist.push(dist[i - 1] + Math.hypot(a * (Math.cos(t1) - Math.cos(t0)), b * (Math.sin(t1) - Math.sin(t0))))
    }
    const at = (fraction: number) => {
      const target = fraction * dist[n]
      let i = 1
      while (i < n && dist[i] < target) i++
      const t = ((i - 1 + (target - dist[i - 1]) / (dist[i] - dist[i - 1])) * Math.PI) / 2 / n
      return P(a * Math.cos(t), b * Math.sin(t))
    }
    const p = at(0.25),
      q = at(0.75)
    // Clockwise from the top of the right-hand bump.
    const cusps = [P(p.x, -p.y), P(p.x, p.y), P(q.x, q.y), P(-q.x, q.y), P(-p.x, p.y), P(-p.x, -p.y), P(-q.x, -q.y), P(q.x, -q.y)]
    const path = new Path().M(cusps[0].x, cy + cusps[0].y)
    for (let i = 1; i <= cusps.length; i++) {
      const from = cusps[i - 1],
        to = cusps[i % cusps.length]
      path.A(0.58 * Math.hypot(to.x - from.x, to.y - from.y), to.x, cy + to.y, true) // a bump of about 120 degrees
    }
    return path.Z()
  }
  // The bumps stand out from the oval: grow the oval until the bumps touch the box.
  let a = w / 2 - 3,
    b = h / 2 - 3
  for (let i = 0; i < 6; i++) {
    const box = bounds(draw(a, b).polys(0.02).flat())
    a += w / 2 - box.x1
    b += h / 2 - (box.y1 - cy)
  }
  return draw(a, b)
}

const cottonWool: SymbolDef = {
  id: 'cottonWool',
  name: 'Cotton wool plug',
  pack: 'support',
  size: { w: 34, h: 22 },
  resize: 'free',
  min: { w: 24, h: 16 },
  build({ w, h }) {
    const outline = cloud(w, h)
    // Seated like a bung: 40 % of it above the rim. Its width there is the width of the plug.
    const row = scan(outline.polys(0.05), 0.4 * h)
    const width = row.length ? Math.max(...row.map((r) => r[1])) - Math.min(...row.map((r) => r[0])) : w
    return {
      prims: [{ d: outline.d(), role: 'solid' }],
      anchors: [{ id: 'plug', kind: 'plug', x: 0, y: 0.4 * h, dir: 90, width }],
    }
  },
}

const lid: SymbolDef = {
  id: 'lid',
  name: 'Lid',
  aliases: ['cover'],
  pack: 'support',
  size: { w: 120, h: 7 },
  resize: 'width',
  min: { w: 40, h: 7 },
  params: [{ key: 'holes', label: 'Holes', type: 'number', default: 0, min: 0, max: 2, step: 1 }],
  build({ w, h, p }) {
    const x = w / 2,
      holes = Math.round(num(p.holes, 0)),
      gap = 10
    const centres = holes <= 0 ? [] : holes === 1 ? [0] : [-w * 0.22, w * 0.22]
    const edges = [-x, ...centres.flatMap((c) => [c - gap / 2, c + gap / 2]), x]
    let d = ''
    for (let i = 0; i < edges.length; i += 2) {
      const l = edges[i],
        r = edges[i + 1]
      d += closed([v(l, 0, 2), v(r, 0, 2), v(r, h, 2), v(l, h, 2)]).d()
    }
    const anchors: Anchor[] = [{ id: 'under', kind: 'base', x: 0, y: h, dir: 90, width: w }]
    centres.forEach((c, i) => anchors.push({ id: `hole${i + 1}`, kind: 'port', x: c, y: 0, dir: -90, width: gap }))
    return { prims: [{ d, role: 'solid' }], anchors }
  },
}

// ---------------------------------------------------------------- rods and small glass

const stirringRod: SymbolDef = {
  id: 'stirringRod',
  name: 'Glass rod',
  aliases: ['stirring rod', 'stirrer'],
  pack: 'support',
  size: { w: 6, h: 190 },
  resize: 'height',
  min: { w: 6, h: 30 },
  build({ h }) {
    return { prims: [{ d: closed([v(-3, 0, 3), v(3, 0, 3), v(3, h, 3), v(-3, h, 3)]).d(), role: 'solid' }] }
  },
}

const spatula: SymbolDef = {
  id: 'spatula',
  name: 'Spatula',
  pack: 'support',
  size: { w: 14, h: 170 },
  resize: 'height',
  min: { w: 14, h: 90 },
  build({ h }) {
    const hw = 2.5, // the handle is 5 wide
      bw = 7, // the blade is 14 wide and 40 long, with its tip at the bottom
      y0 = h - 40
    const outline = new Path()
      .M(-hw, hw)
      .A(hw, hw, hw, true) // the rounded end of the handle
      .L(hw, y0)
      .C(hw, y0 + 7, bw, y0 + 7, bw, y0 + 14) // the handle widens into the blade
      .L(bw, h - bw)
      .A(bw, -bw, h - bw, true) // the rounded tip
      .L(-bw, y0 + 14)
      .C(-bw, y0 + 7, -hw, y0 + 7, -hw, y0)
      .Z()
    return { prims: [{ d: outline.d(), role: 'solid' }] }
  },
}

const splint: SymbolDef = {
  id: 'splint',
  name: 'Splint',
  aliases: ['wooden splint', 'glowing splint', 'burning splint', 'lit splint'],
  pack: 'support',
  size: { w: 130, h: 8 },
  resize: 'width',
  min: { w: 40, h: 8 },
  params: [
    {
      key: 'state',
      label: 'State',
      type: 'choice',
      default: 'lit',
      options: [
        { value: 'unlit', label: 'Unlit' },
        { value: 'lit', label: 'Lit' },
        { value: 'glowing', label: 'Glowing' },
      ],
    },
  ],
  build({ w, p }) {
    const x = w / 2,
      state = str(p.state, 'lit')
    const prims: Prim[] = []
    // The flame is drawn first: the splint hides its base.
    if (state === 'lit') prims.push(luminousFlame(x - 6, 4, 16, 8))
    prims.push({ d: rect(-x, 2, x, 6), role: 'solid' })
    if (state === 'glowing') {
      const cx = x - 3
      let rays = ''
      for (const a of [-45, 0, 45]) {
        const c = Math.cos((a * Math.PI) / 180),
          s = Math.sin((a * Math.PI) / 180)
        rays += line(cx + 5.5 * c, 4 + 5.5 * s, cx + 9.5 * c, 4 + 9.5 * s)
      }
      prims.push({ d: circle(cx, 4, 3), role: 'dark' }, { d: rays, role: 'detail' })
    }
    return { prims, anchors: [{ id: 'tip', kind: 'tip', x, y: 4, dir: 0 }] }
  },
}

const capillaryTube: SymbolDef = {
  id: 'capillaryTube',
  name: 'Capillary tube',
  aliases: ['melting point tube'],
  pack: 'support',
  size: { w: 5, h: 90 },
  resize: 'height',
  min: { w: 5, h: 30 },
  build({ h }) {
    const x = 2.5
    const end = (top: number) =>
      new Path()
        .M(-x, top)
        .L(-x, h - x)
        .A(x, x, h - x, false)
        .L(x, top)
    return {
      prims: [
        {
          d: end(h - 8)
            .Z()
            .d(),
          role: 'dark',
        },
        { d: end(0).d(), role: 'outline' },
      ],
      anchors: [{ id: 'tip', kind: 'tip', x: 0, y: h, dir: 90 }],
    }
  },
}

const stirBar: SymbolDef = {
  id: 'stirBar',
  name: 'Magnetic stirrer bar',
  aliases: ['flea', 'follower'],
  pack: 'support',
  size: { w: 30, h: 8 },
  resize: 'width',
  min: { w: 12, h: 8 },
  build({ w, h }) {
    const x = w / 2
    return { prims: [{ d: closed([v(-x, 0, 4), v(x, 0, 4), v(x, h, 4), v(-x, h, 4)]).d(), role: 'solid' }] }
  },
}

// ---------------------------------------------------------------- paper

const filterPaper: SymbolDef = {
  id: 'filterPaper',
  name: 'Filter paper',
  aliases: ['fluted filter paper'],
  pack: 'support',
  size: { w: 76, h: 46 },
  resize: 'free',
  min: { w: 30, h: 20 },
  params: [{ key: 'residue', label: 'Residue', type: 'boolean', default: false }],
  build({ w, h, p }) {
    const x = w / 2
    const prims: Prim[] = []
    if (bool(p.residue, false)) {
      // Stipple in the lowest third of the V, clear of the paper lines: rows of jittered dots, as the kernel draws a powder.
      const rand = rng(7)
      let d = ''
      for (let y = (2 * h) / 3 + 3; y < h - 2.5; y += 3.6) {
        const half = x * (1 - y / h) - 3
        for (let dx = -half + rand() * 2; dx < half; dx += 4.2 + rand() * 1.5) d += circle(dx, y + (rand() - 0.5) * 1.6, 0.7)
      }
      if (d) prims.push({ d, role: 'detail' })
    }
    prims.push({ d: line(-x, 0, 0, h) + line(x, 0, 0, h), role: 'dashed' })
    return { prims, anchors: [{ id: 'apex', kind: 'tip', x: 0, y: h, dir: 90 }] }
  },
}

/** One tint for each sample on a chromatogram. */
const SAMPLE_TINTS = ['#d9534f', '#3b7dd8', '#3aa655', '#f0a030', '#8e5bc8', '#2ab0b0']
/** Where the dots of each sample sit, as a fraction of the way from the baseline to the solvent front. */
const SAMPLE_RF = [[0.55], [0.3, 0.75], [0.2, 0.5, 0.8], [0.65], [0.4, 0.8], [0.25, 0.6]]

const chromatographyPaper: SymbolDef = {
  id: 'chromatographyPaper',
  name: 'Chromatography paper',
  aliases: ['TLC plate', 'chromatogram'],
  label: (p) => (bool(p.plate, false) ? 'TLC plate' : 'chromatography paper'),
  pack: 'support',
  size: { w: 50, h: 105 },
  resize: 'free',
  min: { w: 30, h: 50 },
  params: [
    { key: 'spots', label: 'Spots', type: 'number', default: 3, min: 1, max: 6, step: 1 },
    { key: 'front', label: 'Solvent front', type: 'number', default: 0.7, min: 0, max: 1, step: 0.05 },
    { key: 'developed', label: 'Developed', type: 'boolean', default: true },
    { key: 'plate', label: 'Plate', type: 'boolean', default: false },
  ],
  build({ w, h, p }) {
    const x = w / 2,
      spots = Math.max(1, Math.round(num(p.spots, 3))),
      front = Math.max(0, Math.min(1, num(p.front, 0.7))),
      developed = bool(p.developed, true),
      yBase = h - 18,
      yFront = yBase - front * yBase,
      r = Math.min(3, (w / spots) * 0.3) // a dot; smaller when the samples are crowded
    const prims: Prim[] = [{ d: rect(-x, 0, x, h), role: 'solid' }]
    if (bool(p.plate, false)) prims.push({ d: line(-x + 3, 0, -x + 3, h), role: 'detail' })
    prims.push({ d: line(-x, yBase, x, yBase), role: 'detail' })
    if (developed && front > 0) prims.push({ d: line(-x, yFront, x, yFront), role: 'dashed' })
    let crosses = ''
    for (let i = 0; i < spots; i++) {
      const cx = -x + (w / spots) * (i + 0.5),
        tint = SAMPLE_TINTS[i % SAMPLE_TINTS.length]
      if (!developed) {
        prims.push({ d: circle(cx, yBase, r), role: 'dark', tint })
        continue
      }
      crosses += line(cx - 1.4, yBase - 1.4, cx + 1.4, yBase + 1.4) + line(cx - 1.4, yBase + 1.4, cx + 1.4, yBase - 1.4)
      let d = ''
      for (const rf of SAMPLE_RF[i % SAMPLE_RF.length]) d += circle(cx, yBase - rf * (yBase - yFront), r)
      prims.push({ d, role: 'dark', tint })
    }
    if (crosses) prims.push({ d: crosses, role: 'detail' })
    return { prims, anchors: [{ id: 'top', kind: 'port', x: 0, y: 0, dir: -90, width: w }] }
  },
}

const crossPaper: SymbolDef = {
  id: 'crossPaper',
  name: 'Paper with cross',
  pack: 'support',
  size: { w: 150, h: 30 },
  resize: 'width',
  min: { w: 60, h: 30 },
  build({ w, h }) {
    const x = w / 2,
      cy = h * 0.72,
      s = 10 / (2 * Math.SQRT2)
    return {
      prims: [
        { d: roundPoly([v(-x + 18, 0), v(x, 0), v(x - 18, h), v(-x, h)], true).d(), role: 'solid' },
        { d: line(-s, cy - s, s, cy + s) + line(-s, cy + s, s, cy - s), role: 'heavy' },
      ],
      anchors: [{ id: 'top', kind: 'surface', x: 0, y: h * 0.45, dir: -90, width: w - 36 }],
    }
  },
}

// ---------------------------------------------------------------- tiles

const tile: SymbolDef = {
  id: 'tile',
  name: 'White tile',
  pack: 'support',
  size: { w: 150, h: 8 },
  resize: 'width',
  min: { w: 40, h: 8 },
  build({ w, h }) {
    const x = w / 2
    return {
      prims: [{ d: closed([v(-x, 0, 1.5), v(x, 0, 1.5), v(x, h, 1.5), v(-x, h, 1.5)]).d(), role: 'solid' }],
      anchors: [
        { id: 'top', kind: 'surface', x: 0, y: 0, dir: -90, width: w },
        { id: 'under', kind: 'base', x: 0, y: h, dir: 90, width: w },
      ],
    }
  },
}

const IODINE = '#b98556'
const BLUE_BLACK = '#3b4a6b'

const spottingTile: SymbolDef = {
  id: 'spottingTile',
  name: 'Spotting tile (top view)',
  aliases: ['dimple tile', 'spot plate'],
  pack: 'support',
  size: { w: 170, h: 120 },
  resize: 'free',
  min: { w: 60, h: 40 },
  params: [
    { key: 'rows', label: 'Rows', type: 'number', default: 3, min: 2, max: 4, step: 1 },
    { key: 'cols', label: 'Columns', type: 'number', default: 4, min: 3, max: 6, step: 1 },
    { key: 'iodine', label: 'Iodine', type: 'boolean', default: false },
    { key: 'blueBlack', label: 'Blue-black wells', type: 'number', default: 0, min: 0, max: 24, step: 1 },
  ],
  build({ w, h, p }) {
    const x = w / 2,
      rows = Math.max(1, Math.round(num(p.rows, 3))),
      cols = Math.max(1, Math.round(num(p.cols, 4))),
      iodine = bool(p.iodine, false),
      blueBlack = iodine ? Math.round(num(p.blueBlack, 0)) : 0,
      r = 0.3 * Math.min(w / cols, h / rows)
    let plain = '',
      starch = ''
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) {
        const d = circle(-x + (w / cols) * (j + 0.5), (h / rows) * (i + 0.5), r)
        if (i * cols + j < blueBlack) starch += d
        else plain += d
      }
    const prims: Prim[] = [{ d: closed([v(-x, 0, 8), v(x, 0, 8), v(x, h, 8), v(-x, h, 8)]).d(), role: 'solid' }]
    if (plain) prims.push(iodine ? { d: plain, role: 'solid', tint: IODINE } : { d: plain, role: 'solid' })
    if (starch) prims.push({ d: starch, role: 'dark', tint: BLUE_BLACK })
    return { prims }
  },
}

// ---------------------------------------------------------------- clamps

const gClamp: SymbolDef = {
  id: 'gClamp',
  name: 'G-clamp',
  aliases: ['clamp for the bench', 'C-clamp'],
  label: 'G-clamp',
  pack: 'support',
  size: { w: 50, h: 80 },
  resize: 'uniform',
  min: { w: 38, h: 60 },
  build({ h }) {
    const k = h / 80,
      s = (n: number) => n * k // drawn at 50 × 80, then scaled by k
    // The frame: a bar 8 thick down the left side and two jaws 8 thick that reach 30 u (0.6 w) from it. One outline.
    const frame = closed([
      v(s(-25), 0, s(2)),
      v(s(13), 0, s(2)),
      v(s(13), s(8), s(2)),
      v(s(-17), s(8), s(1.5)),
      v(s(-17), s(58), s(1.5)),
      v(s(13), s(58), s(2)),
      v(s(13), s(66), s(2)),
      v(s(-25), s(66), s(2)),
    ])
    // The screw on the centre line: the pad at its top end, under the upper jaw, and the T-bar handle at its bottom end.
    const pad = closed([v(s(-6), s(20), s(1.5)), v(s(6), s(20), s(1.5)), v(s(6), s(24), s(1.5)), v(s(-6), s(24), s(1.5))])
    const handle = closed([v(s(-10), s(76), s(2)), v(s(10), s(76), s(2)), v(s(10), s(80), s(2)), v(s(-10), s(80), s(2))])
    return {
      prims: [
        { d: frame.d(), role: 'solid' },
        { d: rect(s(-2.5), s(24), s(2.5), s(76)), role: 'solid' }, // the rod passes through the lower jaw
        { d: pad.d(), role: 'solid' },
        { d: handle.d(), role: 'solid' },
      ],
    }
  },
}

export const support: SymbolDef[] = [
  testTubeRack,
  testTubeHolder,
  benchLine,
  cottonWool,
  lid,
  stirringRod,
  spatula,
  splint,
  filterPaper,
  chromatographyPaper,
  capillaryTube,
  stirBar,
  tile,
  spottingTile,
  crossPaper,
  gClamp,
]
