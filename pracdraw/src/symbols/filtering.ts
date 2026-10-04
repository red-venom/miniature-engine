// filtering.ts — the "Filtering" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { Path, f, roundPoly, v } from '../kernel/geom'
import { RIM, bool, rect } from './kit'
import type { Prim, SymbolDef } from './types'

const line = (x0: number, y0: number, x1: number, y1: number): string => `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`

const buchnerFunnel: SymbolDef = {
  id: 'buchnerFunnel',
  name: 'Büchner funnel',
  label: 'Büchner funnel',
  aliases: ['Buchner funnel'],
  pack: 'filtering',
  size: { w: 100, h: 116 },
  resize: 'free',
  min: { w: 40, h: 50 },
  params: [{ key: 'paper', label: 'Filter paper', type: 'boolean', default: true }],
  build({ w, h, p }) {
    const x = w / 2,
      s = 4.5,
      yp = h * 0.38, // the perforated plate
      ys = h * 0.66 // where the cone meets the stem
    // One wall each side: straight top, a rounded join into the cone, a sharp join into the stem. The stem end is cut at an angle.
    const wall = (side: number, end: number) => roundPoly([v(side * x, 0), v(side * x, yp, 5), v(side * s, ys), v(side * s, end)])
    const prims: Prim[] = [{ d: line(-x, yp, x, yp), role: 'dashed' }]
    if (bool(p.paper, true)) prims.push({ d: line(-x, yp - 2, x, yp - 2), role: 'detail' })
    prims.push({ d: wall(-1, h - 9).d() + wall(1, h).d(), role: 'outline' })
    return {
      prims,
      cavities: [{ id: 'main', polys: new Path().M(-x, RIM).L(-x, yp).L(x, yp).L(x, RIM).Z().polys() }],
      anchors: [
        { id: 'stem', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'rim', kind: 'mouth', x: 0, y: 0, dir: -90, width: w },
      ],
    }
  },
}

const separatingFunnel: SymbolDef = {
  id: 'separatingFunnel',
  name: 'Separating funnel',
  aliases: ['separatory funnel', 'tap funnel'],
  pack: 'filtering',
  size: { w: 90, h: 250 },
  resize: 'free',
  min: { w: 40, h: 120 },
  params: [{ key: 'stopper', label: 'Stopper', type: 'boolean', default: true }],
  build({ w, h, p }) {
    const n = 11, // half-width of the neck
      x = w / 2,
      yn = h * 0.1, // bottom of the neck
      yw = h * 0.3, // widest point
      yt = h * 0.74, // centre of the tap
      s = 3.2, // half-width of the stem
      yb = yt - 7 - 8 // where the body meets the stem above the tap
    // One side of the body, from the neck down to the stem: a round shoulder, then a cone that eases into the stem.
    const body = (side: number, path: Path) =>
      path
        .L(side * n, yn)
        .C(side * n, yn + (yw - yn) * 0.8, side * x, yw - (yw - yn) * 0.5, side * x, yw)
        .C(side * x, yw + (yb - yw) * 0.4, side * s, yb - (yb - yw) * 0.35, side * s, yb)
        .L(side * s, yt - 7)
    const outline = body(-1, new Path().M(-n - 2, 0).L(-n, 2.5)).d() + body(1, new Path().M(n + 2, 0).L(n, 2.5)).d()
    const stem = line(-s, yt + 7, -s, h - 6) + line(s, yt + 7, s, h)
    const cavity = body(-1, new Path().M(-n, RIM))
    cavity.L(s, yt - 7) // across the top of the tap
    // Up the right side: the mirror of the left, in reverse.
    cavity
      .L(s, yb)
      .C(s, yb - (yb - yw) * 0.35, x, yw + (yb - yw) * 0.4, x, yw)
      .C(x, yw - (yw - yn) * 0.5, n, yn + (yw - yn) * 0.8, n, yn)
      .L(n, RIM)
      .Z()
    const prims: Prim[] = [
      { d: outline + stem, role: 'outline' },
      { d: rect(-7, yt - 7, 7, yt + 7), role: 'solid' },
      { d: `M7 ${f(yt - 2.5)}H19V${f(yt - 7)}H24V${f(yt + 7)}H19V${f(yt + 2.5)}H7`, role: 'solid' },
    ]
    // Stopper: a flat head above the rim and a tapered plug in the neck, 26 wide and 16 high in all.
    if (bool(p.stopper, true))
      prims.push({
        d: roundPoly([v(-13, -6, 1.5), v(13, -6, 1.5), v(13, 0), v(10, 0), v(9, 10, 1), v(-9, 10, 1), v(-10, 0), v(-13, 0)], true).d(),
        role: 'solid',
      })
    return {
      prims,
      cavities: [{ id: 'main', polys: cavity.polys() }],
      anchors: [
        { id: 'stem', kind: 'tip', x: 0, y: h, dir: 90 },
        { id: 'mouth', kind: 'mouth', x: 0, y: 0, dir: -90, width: 2 * n },
        { id: 'neck', kind: 'neck', x: 0, y: yn * 0.5, width: 2 * n },
      ],
    }
  },
}

export const filtering: SymbolDef[] = [buchnerFunnel, separatingFunnel]
