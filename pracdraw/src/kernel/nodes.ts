// nodes.ts — the render tree. Three node types only. Three back-ends read the same tree:
//   toSvg()    → standalone SVG string (file export, tests)
//   toCanvas() → Canvas 2D (PNG export, clipboard). No SVG-image round trip, so no CSP or tainting risk.
//   React      → live editor view (see NodeView in the app)

import type { Run } from './text'

/** Affine matrix [a, b, c, d, e, f], same order as SVG matrix() and CanvasRenderingContext2D.transform(). */
export type Mat = readonly [number, number, number, number, number, number]

export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y]
export const rotate = (deg: number): Mat => {
  const a = (deg * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a)
  return [c, s, -s, c, 0, 0]
}
export const FLIP_X: Mat = [-1, 0, 0, 1, 0, 0]
/** m·n — apply n first, then m (same order as writing "m n" in an SVG transform list). */
export const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]

export interface PathNode {
  t: 'path'
  d: string
  fill?: string
  stroke?: string
  sw?: number
  dash?: readonly number[]
  cap?: 'butt' | 'round'
  join?: 'round' | 'miter'
}
export interface TextNode {
  t: 'text'
  x: number
  y: number
  runs: Run[]
  size: number
  anchor: 'start' | 'middle' | 'end'
  fill: string
}
export interface GroupNode {
  t: 'g'
  m?: Mat
  kids: Node[]
  key?: string
}
export type Node = PathNode | TextNode | GroupNode

export const FONT = 'Arial, Helvetica, sans-serif'
export const SCRIPT = { scale: 0.7, sub: 0.28, sup: -0.38 }

/** Baseline shift (dy) to apply before each run, so that sub- and superscripts sit right and the text returns to the baseline. */
export function runShifts(runs: Run[], size: number): number[] {
  let shift = 0
  return runs.map((r) => {
    const target = r.script === 'sub' ? size * SCRIPT.sub : r.script === 'sup' ? size * SCRIPT.sup : 0
    const dy = target - shift
    shift = target
    return dy
  })
}

const n2 = (v: number): string => {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
/** Attribute values. A colour comes from a file, so it must never be able to close the attribute. */
const attr = (s: string) => esc(s).replace(/"/g, '&quot;')

export function toSvg(node: Node): string {
  if (node.t === 'g') {
    const m = node.m ? ` transform="matrix(${node.m.map(n2).join(' ')})"` : ''
    return `<g${m}>${node.kids.map(toSvg).join('')}</g>`
  }
  if (node.t === 'path') {
    let a = ` fill="${attr(node.fill ?? 'none')}"`
    if (node.stroke) {
      a += ` stroke="${attr(node.stroke)}" stroke-width="${n2(node.sw ?? 1)}" stroke-linecap="${node.cap ?? 'round'}" stroke-linejoin="${node.join ?? 'round'}"`
      if (node.dash?.length) a += ` stroke-dasharray="${node.dash.join(' ')}"`
    }
    return `<path d="${node.d}"${a}/>`
  }
  const shifts = runShifts(node.runs, node.size)
  const spans = node.runs
    .map((r, i) => {
      const dy = shifts[i]
      const fs = r.script === 'normal' ? '' : ` font-size="${n2(node.size * SCRIPT.scale)}"`
      return `<tspan${dy ? ` dy="${n2(dy)}"` : ''}${fs}>${esc(r.text)}</tspan>`
    })
    .join('')
  return `<text x="${n2(node.x)}" y="${n2(node.y)}" font-family="${FONT}" font-size="${n2(node.size)}" text-anchor="${node.anchor}" fill="${attr(node.fill)}">${spans}</text>`
}

export function svgDocument(nodes: Node[], w: number, h: number, bg?: string, metadata?: string): string {
  const meta = metadata ? `<metadata>${esc(metadata)}</metadata>` : ''
  const back = bg ? `<path d="M0 0H${n2(w)}V${n2(h)}H0Z" fill="${attr(bg)}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n2(w)}" height="${n2(h)}" viewBox="0 0 ${n2(w)} ${n2(h)}">${meta}${back}${nodes.map(toSvg).join('')}</svg>`
}

/** Draw the tree on a 2D context. The caller sets the scale and paints any background first. */
export function toCanvas(ctx: CanvasRenderingContext2D, node: Node): void {
  if (node.t === 'g') {
    ctx.save()
    if (node.m) ctx.transform(...(node.m as [number, number, number, number, number, number]))
    for (const k of node.kids) toCanvas(ctx, k)
    ctx.restore()
    return
  }
  if (node.t === 'path') {
    const p = new Path2D(node.d)
    if (node.fill && node.fill !== 'none') {
      ctx.fillStyle = node.fill
      ctx.fill(p)
    }
    if (node.stroke) {
      ctx.strokeStyle = node.stroke
      ctx.lineWidth = node.sw ?? 1
      ctx.lineCap = node.cap ?? 'round'
      ctx.lineJoin = node.join ?? 'round'
      ctx.miterLimit = 4 // SVG default
      ctx.setLineDash(node.dash ? [...node.dash] : [])
      ctx.stroke(p)
    }
    return
  }
  const font = (script: Run['script']) => `${script === 'normal' ? node.size : node.size * SCRIPT.scale}px ${FONT}`
  const widths = node.runs.map((r) => {
    ctx.font = font(r.script)
    return ctx.measureText(r.text).width
  })
  const total = widths.reduce((a, b) => a + b, 0)
  let x = node.anchor === 'start' ? node.x : node.anchor === 'middle' ? node.x - total / 2 : node.x - total
  ctx.fillStyle = node.fill
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  node.runs.forEach((r, i) => {
    ctx.font = font(r.script)
    const dy = r.script === 'sub' ? node.size * SCRIPT.sub : r.script === 'sup' ? node.size * SCRIPT.sup : 0
    ctx.fillText(r.text, x, node.y + dy)
    x += widths[i]
  })
}
