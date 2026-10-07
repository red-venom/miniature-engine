// annotation.ts — the "Annotation" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { Path, f, v } from '../kernel/geom'
import { circle, closed, num, rect, str } from './kit'
import { luminousFlame } from './support'
import type { SymbolDef } from './types'

/** Side view of an eye that looks to the right. Turn the item to make it look another way. */
const eye: SymbolDef = {
  id: 'eye',
  name: 'Eye',
  aliases: ['observer', 'eye level'],
  autoLabel: false,
  pack: 'annotation',
  size: { w: 46, h: 26 },
  resize: 'uniform',
  min: { w: 23, h: 13 },
  build({ h }) {
    const k = h / 26,
      s = (n: number) => n * k,
      W = 46,
      H = 26,
      back = -W / 2,
      xf = 0.3 * W, // where the lids meet the front arc
      ym = H / 2
    // Front arc through (xf, 0), (W/2, ym) and (xf, H): sagitta W/2 - xf on a chord H.
    const sag = W / 2 - xf,
      r = (sag * sag + ym * ym) / (2 * sag),
      cx = W / 2 - r
    const lids = new Path().M(s(back), s(ym)).L(s(xf), 0).M(s(back), s(ym)).L(s(xf), s(H))
    const front = new Path().M(s(xf), 0).A(s(r), s(xf), s(H))
    // Iris: a concentric arc 4 u inside the front, over 120 degrees.
    const ri = r - 4,
      a = Math.PI / 3
    const iris = new Path().M(s(cx + ri * Math.cos(a)), s(ym - ri * Math.sin(a))).A(s(ri), s(cx + ri * Math.cos(a)), s(ym + ri * Math.sin(a)))
    // Pupil: a lens 4 wide and 10 high, on the iris at the middle of the front.
    const px = cx + ri - 0.5,
      ph = 5,
      rp = (2 * 2 + ph * ph) / (2 * 2) // circular arcs with a sagitta of 2 on a chord of 2·ph
    const pupil = new Path()
      .M(s(px), s(ym - ph))
      .A(s(rp), s(px), s(ym + ph))
      .A(s(rp), s(px), s(ym - ph))
      .Z()
    return {
      prims: [
        { d: lids.d() + front.d(), role: 'outline' },
        { d: iris.d(), role: 'detail' },
        { d: pupil.d(), role: 'dark' },
      ],
    }
  },
}

/**
 * A flame on its own: the luminous (safety) flame of the Bunsen burner and the burning splint, drawn the same way, `h` high.
 * Its flat foot is the bottom edge of the box: stand it on a burner, a wick or a candle.
 */
const flame: SymbolDef = {
  id: 'flame',
  name: 'Flame',
  autoLabel: false,
  pack: 'annotation',
  size: { w: 26, h: 44 },
  resize: 'uniform',
  min: { w: 13, h: 22 },
  build({ h }) {
    const k = h / 38 // the flame of the pilot is 14 u wide at its foot and 38 u high
    return {
      prims: [luminousFlame(0, h, h, 14 * k)],
      anchors: [{ id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: 14 * k }],
    }
  },
}

/** A teardrop `height` high and 0.7 `height` wide, point up, with its tip at (0, top): a circle with two straight sides to the tip. */
function teardrop(top: number, height: number): string {
  const r = 0.35 * height,
    d = height - r, // from the tip to the centre of the round end
    a = Math.acos(r / d), // the sides touch the circle where the tangent from the tip leaves it
    tx = r * Math.sin(a),
    ty = top + d - r * Math.cos(a)
  return new Path().M(0, top).L(tx, ty).A(r, -tx, ty, true, true).Z().d()
}

const drops: SymbolDef = {
  id: 'drops',
  name: 'Drops',
  aliases: ['drip', 'droplets'],
  autoLabel: false,
  pack: 'annotation',
  size: { w: 12, h: 44 },
  resize: 'height',
  min: { w: 12, h: 36 },
  params: [{ key: 'count', label: 'Count', type: 'number', default: 2, min: 1, max: 4, step: 1 }],
  build({ h, p }) {
    const n = Math.max(1, Math.round(num(p.count, 2))),
      gap = 4, // least distance from the bottom of one drop to the tip of the next: 2 u of clear paper between the lines
      size = Math.max(1, Math.min(10, (h - (n - 1) * gap) / n)), // 10 u high; a little smaller when four must fit the default box
      pitch = n > 1 ? (h - size) / (n - 1) : 0, // the first drop at the top, the last at the bottom
      top = n > 1 ? 0 : (h - size) / 2
    let d = ''
    for (let i = 0; i < n; i++) d += teardrop(top + i * pitch, size)
    return { prims: [{ d, role: 'solid' }] }
  },
}

/** The liquid presets of section 9 of the specification, by colour name. */
const PAPER_TINT: Record<string, string> = {
  red: '#e98a8a',
  blue: '#7fb8e6',
  green: '#8fce8a',
  orange: '#f2b56b',
  yellow: '#f5e58a',
  purple: '#b497d6',
}

const indicatorPaper: SymbolDef = {
  id: 'indicatorPaper',
  name: 'Indicator paper',
  aliases: ['litmus paper', 'pH paper', 'universal indicator paper'],
  pack: 'annotation',
  size: { w: 14, h: 60 },
  resize: 'free',
  min: { w: 6, h: 10 },
  params: [
    {
      key: 'colour',
      label: 'Colour',
      type: 'choice',
      default: 'red',
      options: Object.keys(PAPER_TINT).map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
    },
  ],
  build({ w, h, p }) {
    return { prims: [{ d: rect(-w / 2, 0, w / 2, h), role: 'solid', tint: PAPER_TINT[str(p.colour, 'red')] ?? PAPER_TINT.red }] }
  },
}

const flameTestLoop: SymbolDef = {
  id: 'flameTestLoop',
  name: 'Flame test wire',
  aliases: ['nichrome wire', 'wire loop'],
  pack: 'annotation',
  size: { w: 180, h: 12 },
  resize: 'width',
  min: { w: 100, h: 12 },
  build({ w, h }) {
    const x = w / 2,
      y = h / 2,
      r = 4, // the loop at the right end
      hx = -x + 0.45 * w // the handle ends here
    return {
      prims: [
        // The wire starts inside the handle, which hides its end.
        { d: `M${f(hx - 4)} ${f(y)}H${f(x - 2 * r)}` + circle(x - r, y, r), role: 'detail' },
        { d: closed([v(-x, y - 4, 2), v(hx, y - 4, 2), v(hx, y + 4, 2), v(-x, y + 4, 2)]).d(), role: 'solid' },
      ],
      anchors: [{ id: 'loop', kind: 'tip', x: x - r, y, dir: 0 }],
    }
  },
}

/** A thin strip in side view: three shallow arcs, drawn as two parallel outlines 3 u apart. */
const magnesiumRibbon: SymbolDef = {
  id: 'magnesiumRibbon',
  name: 'Metal ribbon',
  aliases: ['magnesium ribbon', 'magnesium strip'],
  label: 'magnesium ribbon',
  pack: 'annotation',
  size: { w: 60, h: 12 },
  resize: 'free',
  min: { w: 24, h: 8 },
  build({ w, h }) {
    const n = 3,
      t = 1.5, // half the thickness of the strip
      ym = h / 2,
      sag = 0.22 * h, // of each arc, above or below the middle line
      c = (w - 2) / n, // chord of each arc: the tilted end caps stay inside the box
      r = (sag * sag + (c * c) / 4) / (2 * sag),
      x0 = -w / 2 + 1
    // Arc i bulges up when i is even. Its centre is r - sag below (up) or above (down) the middle line.
    const centre = (i: number) => ({ x: x0 + (i + 0.5) * c, y: ym + (i % 2 === 0 ? 1 : -1) * (r - sag) })
    // The point of the upper (side = -1) or lower (+1) outline at the chord end x, on arc i.
    const at = (i: number, x: number, side: number) => {
      const o = centre(i),
        dx = x - o.x,
        dy = ym - o.y,
        d = Math.hypot(dx, dy),
        k = (d - side * (i % 2 === 0 ? 1 : -1) * t) / d // the outline farther from the centre is t outside the arc
      return { x: o.x + dx * k, y: o.y + dy * k }
    }
    const radius = (i: number, side: number) => r + (i % 2 === 0 ? -side : side) * t
    const p0 = at(0, x0, -1)
    const path = new Path().M(p0.x, p0.y)
    for (let i = 0; i < n; i++) {
      const q = at(i, x0 + (i + 1) * c, -1)
      path.A(radius(i, -1), q.x, q.y, i % 2 === 0)
    }
    const end = at(n - 1, x0 + n * c, 1)
    path.L(end.x, end.y)
    for (let i = n - 1; i >= 0; i--) {
      const q = at(i, x0 + i * c, 1)
      path.A(radius(i, 1), q.x, q.y, i % 2 !== 0)
    }
    return { prims: [{ d: path.Z().d(), role: 'solid' }] }
  },
}

export const annotation: SymbolDef[] = [eye, flame, drops, indicatorPaper, flameTestLoop, magnesiumRibbon]
