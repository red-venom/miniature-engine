// contents.ts — liquids, solids, gas and bubbles inside a cavity, as plain paths.
// The surface stays level in the world when the item is rotated or flipped.

import { P, f, xf, clipH, scan, polyD, bounds, rng, type Pt } from './geom'

export type LayerKind = 'liquid' | 'powder' | 'lumps' | 'gas'

export interface Layer {
  kind: LayerKind
  /**
   * Height of this layer as a fraction (0–1) of the cavity's vertical extent in its current orientation.
   * Layers stack from the bottom. A 'gas' layer ignores `amount` and fills the space that is left.
   */
  amount: number
  colour: string
  /** Liquids only: curved surface. The reading is the bottom of the curve. */
  meniscus?: boolean
  /** Liquids only. */
  bubbles?: 'none' | 'few' | 'many'
  /** Liquids only: a suspension. It adds sparse dots, so that it differs from a clear liquid when there is no colour. */
  cloudy?: boolean
}

export interface ContentPrim {
  d: string
  fill?: string
  stroke?: string
  sw?: number
}

export interface ContentOpts {
  /** Item rotation, degrees clockwise. */
  rot: number
  flip: boolean
  /** Local point that the item rotates about (the centre of its nominal box). */
  pivot: Pt
  /** Photocopy-safe mode: no colour fills; liquids are rows of dashes. */
  mono: boolean
  /** Seed for bubbles, stipple and lumps. Use a hash of the item id so the drawing never shimmers. */
  seed: number
  ink?: string
}

export const MENISCUS = 2.2 // rise at the wall, units
const DASH = { row: 9, len: 7, gap: 8, inset: 4 }
const FULL = 0.999

/** World-oriented copy of a cavity: origin at the pivot, rotated and flipped like the item. */
export function orient(cavity: Pt[][], o: Pick<ContentOpts, 'rot' | 'flip' | 'pivot'>): Pt[][] {
  return cavity.map((poly) => poly.map((p) => xf(P(p.x - o.pivot.x, p.y - o.pivot.y), o.rot, o.flip)))
}

/**
 * Build the contents of one cavity.
 * Input polygons are in the symbol's local coordinates.
 * Output paths are in the item's world-oriented frame (see `orient`): render them inside
 * translate(item.x, item.y) only — never inside the rotated group.
 * Order of the result: colour fills, then dashes / stipple / surface lines / dots / bubbles, then lumps.
 */
export function buildContents(cavity: Pt[][], layers: Layer[], o: ContentOpts): ContentPrim[] {
  const ink = o.ink ?? '#111111'
  const W = orient(cavity, o)
  const b = bounds(W.flat())
  const H = b.y1 - b.y0
  const fills: ContentPrim[] = [],
    marks: ContentPrim[] = [],
    solids: ContentPrim[] = []
  const rand = rng(o.seed)
  const between = (yTop: number, yBottom: number) => W.map((poly) => clipH(clipH(poly, yTop, 'below'), yBottom, 'above')).filter((poly) => poly.length >= 3)
  const flat = (surface: [number, number][], y: number) => surface.map(([xa, xb]) => `M${f(xa)} ${f(y)}L${f(xb)} ${f(y)}`).join('')

  let filled = 0
  let lumpsFrom: number | null = null // bottom of a run of lumps layers: liquid above it also fills between the lumps
  const top = layers.reduce((a, l, i) => (l.kind === 'gas' ? a : i), -1) // the highest layer that is not a gas
  layers.forEach((layer, li) => {
    const lo = Math.min(1, filled)
    const hi = layer.kind === 'gas' ? 1 : Math.min(1, filled + Math.max(0, layer.amount))
    filled = hi
    if (hi - lo <= 0) return
    const yBottom = b.y1 - lo * H,
      yTop = b.y1 - hi * H
    const surface = scan(W, yTop + 1e-6)
    const isLast = li === layers.length - 1

    if (layer.kind === 'lumps') {
      if (lumpsFrom === null) lumpsFrom = lo
      solids.push({ d: lumps(W, yTop, yBottom, rand), stroke: ink, sw: 1.25, fill: o.mono ? '#ffffff' : layer.colour })
      return
    }
    const yFloor = layer.kind === 'liquid' && lumpsFrom !== null ? b.y1 - lumpsFrom * H : yBottom
    lumpsFrom = null
    const region = between(yTop, yFloor)
    if (!region.length) return
    let d = region.map((poly) => polyD(poly)).join('')

    if (layer.kind === 'gas') {
      if (!o.mono) fills.push({ d, fill: layer.colour })
    } else if (layer.kind === 'liquid') {
      const men = !!layer.meniscus && li === top && hi < FULL
      if (men) for (const [xa, xb] of surface) d += meniscusPatch(xa, xb, yTop)
      if (!o.mono) fills.push({ d, fill: layer.colour })
      else marks.push({ d: dashRows(W, yTop, yFloor), stroke: ink, sw: 1 })
      if (hi < FULL || !isLast) {
        const s = men
          ? surface.map(([xa, xb]) => `M${f(xa)} ${f(yTop - MENISCUS)}Q${f((xa + xb) / 2)} ${f(yTop + MENISCUS)} ${f(xb)} ${f(yTop - MENISCUS)}`).join('')
          : flat(surface, yTop)
        if (s) marks.push({ d: s, stroke: ink, sw: 1.25 })
      }
      if (layer.cloudy) {
        const cd = cloud(W, yTop, yBottom, rand)
        if (cd) marks.push({ d: cd, fill: ink })
      }
      if (layer.bubbles && layer.bubbles !== 'none') {
        const bd = bubbles(W, yTop, yBottom, layer.bubbles === 'many' ? 22 : 9, rand)
        if (bd) marks.push({ d: bd, stroke: ink, sw: 1, fill: '#ffffff' })
      }
    } else {
      if (!o.mono) fills.push({ d, fill: layer.colour })
      const sd = stipple(W, yTop, yBottom, rand)
      if (sd) marks.push({ d: sd, fill: ink })
      if (hi < FULL || !isLast) marks.push({ d: flat(surface, yTop), stroke: ink, sw: 1.25 })
    }
  })
  return [...fills, ...marks, ...solids].filter((p) => p.d)
}

/** Sliver of liquid between the flat level and the curved surface. */
function meniscusPatch(xa: number, xb: number, y: number): string {
  return `M${f(xa)} ${f(y)}L${f(xa)} ${f(y - MENISCUS)}Q${f((xa + xb) / 2)} ${f(y + MENISCUS)} ${f(xb)} ${f(y - MENISCUS)}L${f(xb)} ${f(y)}Z`
}

/** Photocopy-safe liquid: staggered rows of short dashes. */
function dashRows(W: Pt[][], yTop: number, yBottom: number): string {
  let d = '',
    row = 0
  for (let y = yTop + DASH.row * 0.75; y < yBottom - 2; y += DASH.row, row++) {
    for (const [xa, xb] of scan(W, y)) {
      const start = xa + DASH.inset + (row % 2 ? (DASH.len + DASH.gap) / 2 : 0)
      for (let x = start; x + DASH.len <= xb - DASH.inset; x += DASH.len + DASH.gap) d += `M${f(x)} ${f(y)}h${DASH.len}`
    }
  }
  return d
}

const circle = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`

function bubbles(W: Pt[][], yTop: number, yBottom: number, n: number, rand: () => number): string {
  let d = ''
  for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
    const y = yTop + 5 + rand() * Math.max(0, yBottom - yTop - 10)
    const spans = scan(W, y)
    if (!spans.length) continue
    const [xa, xb] = spans[Math.floor(rand() * spans.length)]
    const r = 1.6 + rand() * 1.8
    if (xb - xa < 2 * r + 8) continue
    d += circle(xa + r + 4 + rand() * (xb - xa - 2 * r - 8), y, r)
    i++
  }
  return d
}

function stipple(W: Pt[][], yTop: number, yBottom: number, rand: () => number): string {
  let d = ''
  for (let y = yTop + 3; y < yBottom - 1.5; y += 3.6) {
    for (const [xa, xb] of scan(W, y)) {
      for (let x = xa + 3 + rand() * 2; x < xb - 3; x += 4.2 + rand() * 1.5) d += circle(x, y + (rand() - 0.5) * 1.6, 0.8)
    }
  }
  return d
}

/** Sparse dots for a suspension: a cloudy liquid, a precipitate that has not settled. */
function cloud(W: Pt[][], yTop: number, yBottom: number, rand: () => number): string {
  let d = ''
  for (let y = yTop + 5; y < yBottom - 3; y += 8) {
    for (const [xa, xb] of scan(W, y)) {
      for (let x = xa + 4 + rand() * 6; x < xb - 4; x += 9 + rand() * 6) d += circle(x, y + (rand() - 0.5) * 4, 0.75)
    }
  }
  return d
}

/** Irregular lumps: marble chips, anti-bumping granules, ice packed up to the surface. */
function lumps(W: Pt[][], yTop: number, yBottom: number, rand: () => number): string {
  let d = ''
  const size = 6.5
  for (let y = yBottom - size * 0.75; y > yTop + size * 0.4; y -= size * 1.5) {
    for (const [xa, xb] of scan(W, y)) {
      for (let x = xa + size + rand() * 3; x < xb - size; x += size * 2 + rand() * 4) {
        const k = 5 + Math.floor(rand() * 2),
          a0 = rand() * Math.PI
        const pts: Pt[] = []
        for (let i = 0; i < k; i++) {
          const a = a0 + (i / k) * 2 * Math.PI,
            r = size * (0.6 + rand() * 0.4)
          pts.push(P(x + r * Math.cos(a), y + r * Math.sin(a) * 0.8))
        }
        d += polyD(pts)
      }
    }
  }
  return d
}
