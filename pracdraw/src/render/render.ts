// render.ts — document → render tree. Pure: no DOM. The same tree feeds the screen, the SVG file and the PNG.

import { P, f, hash, pathBounds, polyD, roundPoly, type Pt } from '../kernel/geom'
import { buildContents } from '../kernel/contents'
import { parseMarkup, smartChem } from '../kernel/text'
import { tube } from '../kernel/tube'
import { mul, rotate, translate, type Node, type PathNode, type TextNode } from '../kernel/nodes'
import { localMatrix, toWorld } from '../model/transform'
import type { Cap, ConnectorItem, Doc, DocSettings, Item, LabelItem, ShapeItem, SymbolItem, Target } from '../model/types'
import { geometry } from '../symbols/registry'
import type { Prim, Role } from '../symbols/types'

export const INK = '#111111'
export const PAPER = '#ffffff'
export const GREY = '#c9c9c9'
export const DARK = '#4a4a4a'
export const FLAME = '#bfe0f7'
export const FLAME_CORE = '#6fb3e8'
export const LINE = { main: 2, heavy: 3, detail: 1.25 }
export const TUBE_WIDTH = { glassTube: 7, rubberTube: 10 }
export const BLANK_RULE = 100 // length of the line to write on, in 'blank' label mode

export function resolveTarget(doc: Doc, t: Target): Pt | null {
  if (!('item' in t)) return P(t.x, t.y)
  const it = doc.items[t.item]
  return it && it.type === 'symbol' ? toWorld(it, P(t.lx, t.ly)) : null
}

function primNode(p: Prim, mono: boolean): PathNode {
  const line = (sw: number, fill?: string): PathNode => ({ t: 'path', d: p.d, stroke: INK, sw, fill })
  const table: Record<Role, () => PathNode> = {
    outline: () => line(LINE.main),
    heavy: () => line(LINE.heavy),
    detail: () => line(LINE.detail),
    dashed: () => ({ ...line(LINE.detail), dash: [5, 3], cap: 'butt' }),
    paper: () => ({ t: 'path', d: p.d, fill: PAPER }),
    solid: () => line(LINE.main, mono ? PAPER : (p.tint ?? PAPER)),
    rubber: () => line(LINE.main, mono ? PAPER : (p.tint ?? GREY)),
    dark: () => line(LINE.main, mono ? INK : (p.tint ?? DARK)),
    flame: () => line(LINE.detail, mono ? PAPER : (p.tint ?? FLAME)),
    flameCore: () => line(LINE.detail, mono ? PAPER : (p.tint ?? FLAME_CORE)),
    mesh: () => ({ t: 'path', d: p.d, stroke: INK, sw: 4.5, dash: [2.5, 2.5], cap: 'butt' }),
  }
  return table[p.role]()
}

export function textNodes(x: number, y: number, raw: string, size: number, anchor: TextNode['anchor'], smart: boolean): TextNode[] {
  return raw.split('\n').map((line, i) => ({
    t: 'text',
    x,
    y: y + i * size * 1.25,
    size,
    anchor,
    fill: INK,
    runs: parseMarkup(smart ? smartChem(line) : line),
  }))
}

export function symbolNode(it: SymbolItem, s: DocSettings): Node {
  const g = geometry(it.symbol, it.w, it.h, it.params)
  const local = localMatrix(it)
  const under: Node[] = [],
    inside: Node[] = [],
    over: Node[] = []
  // 1. White behind every cavity and every 'paper' prim.
  for (const cav of g.cavities ?? []) under.push({ t: 'path', d: cav.polys.map((poly) => polyD(poly)).join(''), fill: PAPER })
  for (const p of g.prims) (p.role === 'paper' ? under : over).push(primNode(p, s.mono))
  // 2. Contents in the world-oriented frame: the surface stays level.
  for (const cav of g.cavities ?? []) {
    const layers = it.contents[cav.id]
    if (!layers?.length) continue
    for (const c of buildContents(cav.polys, layers, {
      rot: it.rot,
      flip: it.flip,
      pivot: P(0, it.h / 2),
      mono: s.mono,
      // Photocopy-safe liquid: a thread gets a centre line; a cavity with a scale gets its level only (dashes between
      // the ticks would read as a second scale); any other cavity gets rows of dashes.
      monoLiquid: cav.thread ? 'thread' : g.scale?.cavity === cav.id ? 'level' : 'dashes',
      // From what a copy keeps (not the id), so a pasted or inserted copy draws the same bubbles, dots and lumps.
      seed: hash(`${it.symbol}|${cav.id}|${it.w}|${it.h}`),
      ink: INK,
    })) {
      inside.push({ t: 'path', d: c.d, fill: c.fill, stroke: c.stroke, sw: c.sw })
    }
  }
  // 3. Symbol text. A flipped symbol must not mirror its text.
  for (const t of g.texts ?? []) {
    if (!it.flip) {
      over.push(...textNodes(t.x, t.y, t.text, t.size, t.anchor, false))
      continue
    }
    const anchor = t.anchor === 'start' ? 'end' : t.anchor === 'end' ? 'start' : 'middle'
    over.push({ t: 'g', m: [-1, 0, 0, 1, 2 * t.x, 0], kids: textNodes(t.x, t.y, t.text, t.size, anchor, false) })
  }
  return {
    t: 'g',
    key: it.id,
    m: translate(it.x, it.y),
    kids: [
      { t: 'g', m: local, kids: under },
      { t: 'g', kids: inside },
      { t: 'g', m: local, kids: over },
    ],
  }
}

function arrowHead(tip: Pt, from: Pt, size = 8): PathNode {
  const a = Math.atan2(tip.y - from.y, tip.x - from.x),
    w = 0.42
  const p1 = P(tip.x - size * Math.cos(a - w), tip.y - size * Math.sin(a - w)),
    p2 = P(tip.x - size * Math.cos(a + w), tip.y - size * Math.sin(a + w))
  return { t: 'path', d: `M${f(p1.x)} ${f(p1.y)}L${f(tip.x)} ${f(tip.y)}L${f(p2.x)} ${f(p2.y)}Z`, fill: INK }
}

function capNode(cap: Cap, end: Pt, prev: Pt): PathNode | null {
  if (cap === 'arrow') return arrowHead(end, prev)
  if (cap === 'dot') return { t: 'path', d: `M${f(end.x - 2.5)} ${f(end.y)}a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0Z`, fill: INK }
  if (cap === 'tick') {
    const a = Math.atan2(end.y - prev.y, end.x - prev.x) + Math.PI / 2,
      dx = 5 * Math.cos(a),
      dy = 5 * Math.sin(a)
    return { t: 'path', d: `M${f(end.x - dx)} ${f(end.y - dy)}L${f(end.x + dx)} ${f(end.y + dy)}`, stroke: INK, sw: LINE.detail }
  }
  return null
}

export function connectorNode(it: ConnectorItem, s: DocSettings): Node {
  // Fewer than two points, or every point on one spot (a file can hold that): nothing to draw. The tube kernel cannot draw it.
  const p0 = it.points[0]
  if (it.points.length < 2 || it.points.every((p) => Math.abs(p.x - p0.x) < 1e-6 && Math.abs(p.y - p0.y) < 1e-6)) return { t: 'g', key: it.id, kids: [] }
  if (it.kind === 'glassTube' || it.kind === 'rubberTube') {
    const t = tube(it.points, it.width ?? TUBE_WIDTH[it.kind], [it.startCap === 'closed' ? 'closed' : 'open', it.endCap === 'closed' ? 'closed' : 'open'])
    const body = it.kind === 'rubberTube' && !s.mono ? GREY : PAPER
    return {
      t: 'g',
      key: it.id,
      kids: [
        { t: 'path', d: t.body, fill: body },
        { t: 'path', d: t.walls, stroke: INK, sw: LINE.main, cap: 'butt' },
      ],
    }
  }
  const n = it.points.length
  const kids: Node[] = [
    { t: 'path', d: roundPoly(it.points).d(), stroke: INK, sw: it.kind === 'wire' ? LINE.main : LINE.detail, dash: it.dash ? [6, 4] : undefined },
  ]
  const a = capNode(it.startCap, it.points[0], it.points[1]),
    b = capNode(it.endCap, it.points[n - 1], it.points[n - 2])
  if (a) kids.push(a)
  if (b) kids.push(b)
  return { t: 'g', key: it.id, kids }
}

/** `letter` is set in 'letters' mode for labels that have a leader. */
export function labelNode(doc: Doc, it: LabelItem, letter?: string): Node {
  const s = doc.settings,
    size = it.size ?? s.labelSize
  const kids: Node[] = []
  const target = it.target ? resolveTarget(doc, it.target) : null
  if (target) {
    // The leader starts just outside the text. Text on the left ends at x; text on the right starts at x. No text measuring needed.
    const start = P(it.x + (it.side === 'left' ? 5 : -5), it.y - size * 0.33)
    kids.push({ t: 'path', d: `M${f(start.x)} ${f(start.y)}L${f(target.x)} ${f(target.y)}`, stroke: INK, sw: LINE.detail })
    const end = capNode(it.leaderEnd === 'none' ? 'none' : it.leaderEnd, target, start)
    if (end) kids.push(end)
  }
  const anchor = it.side === 'left' ? 'end' : 'start'
  if (target && s.labelMode === 'blank') {
    const x1 = it.side === 'left' ? it.x - BLANK_RULE : it.x + BLANK_RULE
    kids.push({ t: 'path', d: `M${f(it.x)} ${f(it.y)}L${f(x1)} ${f(it.y)}`, stroke: INK, sw: LINE.detail })
  } else if (target && s.labelMode === 'letters' && letter) {
    kids.push(...textNodes(it.x, it.y, letter, size, anchor, false))
  } else {
    kids.push(...textNodes(it.x, it.y, it.text, size, anchor, it.smart ?? s.smartText))
  }
  return { t: 'g', key: it.id, kids }
}

export function shapeNode(it: ShapeItem): Node {
  const x = it.w / 2,
    y = it.h / 2
  const d =
    it.shape === 'rect' ? `M${f(-x)} ${f(-y)}H${f(x)}V${f(y)}H${f(-x)}Z` : `M${f(-x)} 0A${f(x)} ${f(y)} 0 1 0 ${f(x)} 0A${f(x)} ${f(y)} 0 1 0 ${f(-x)} 0Z`
  const fill = it.fill === 'none' ? undefined : it.fill === 'paper' ? PAPER : GREY
  return {
    t: 'g',
    key: it.id,
    m: mul(translate(it.x, it.y), rotate(it.rot)),
    kids: [{ t: 'path', d, fill, stroke: INK, sw: LINE.main, dash: it.dash ? [6, 4] : undefined }],
  }
}

/** A, B … Z, AA, AB … */
export function letterFor(i: number): string {
  let s = ''
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s
  return s
}

/** Letters for labels with a leader, in draw order. Used for the picture and for the answer key. */
export function labelLetters(doc: Doc): Map<string, string> {
  const out = new Map<string, string>()
  for (const id of doc.order) {
    const it = doc.items[id]
    if (it?.type === 'label' && it.target) out.set(id, letterFor(out.size))
  }
  return out
}

export function itemNode(doc: Doc, it: Item, letters?: Map<string, string>): Node {
  switch (it.type) {
    case 'symbol':
      return symbolNode(it, doc.settings)
    case 'connector':
      return connectorNode(it, doc.settings)
    case 'shape':
      return shapeNode(it)
    case 'label':
      return labelNode(doc, it, letters?.get(it.id))
  }
}

/** The whole diagram, back to front. Labels always come last. */
export function docNodes(doc: Doc): Node[] {
  const items = doc.order.map((id) => doc.items[id]).filter((it): it is Item => !!it)
  const letters = doc.settings.labelMode === 'letters' ? labelLetters(doc) : undefined
  return [...items.filter((it) => it.type !== 'label'), ...items.filter((it) => it.type === 'label')].map((it) => itemNode(doc, it, letters))
}

/** Text width without a browser: 0.56 × the size for each character. The Node stand-in for canvas `measureText`. */
export const estimateWidth = (text: string, size: number): number => text.length * size * 0.56

/**
 * Rough bounds of the diagram as it is drawn in its label mode, for tests and Node scripts. Text width is estimated.
 * In the browser, measure text with a canvas (see the specification, "Bounds").
 */
export function estimateBounds(doc: Doc, pad = 16): { x: number; y: number; w: number; h: number } {
  const letters = doc.settings.labelMode === 'letters' ? labelLetters(doc) : undefined
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  const add = (p: Pt, m = 0) => {
    x0 = Math.min(x0, p.x - m)
    y0 = Math.min(y0, p.y - m)
    x1 = Math.max(x1, p.x + m)
    y1 = Math.max(y1, p.y + m)
  }
  for (const id of doc.order) {
    const it = doc.items[id]
    if (!it) continue
    if (it.type === 'symbol') {
      const g = geometry(it.symbol, it.w, it.h, it.params)
      const bb = g.prims
        .map((p) => pathBounds(p.d))
        .reduce((a, c) => ({ x0: Math.min(a.x0, c.x0), y0: Math.min(a.y0, c.y0), x1: Math.max(a.x1, c.x1), y1: Math.max(a.y1, c.y1) }))
      for (const t of g.texts ?? []) {
        bb.x0 = Math.min(bb.x0, t.x - t.size * 2)
        bb.x1 = Math.max(bb.x1, t.x + t.size * 2)
      }
      for (const c of [P(bb.x0, bb.y0), P(bb.x1, bb.y0), P(bb.x0, bb.y1), P(bb.x1, bb.y1)]) add(toWorld(it, c), LINE.heavy)
    } else if (it.type === 'connector') {
      for (const p of it.points) add(p, 8)
    } else if (it.type === 'shape') {
      const r = Math.hypot(it.w, it.h) / 2
      add(P(it.x - r, it.y - r))
      add(P(it.x + r, it.y + r))
    } else {
      const size = it.size ?? doc.settings.labelSize
      const t = it.target ? resolveTarget(doc, it.target) : null
      // What is drawn at the text anchor: the text, the line to write on, or the letter. Only a label with a leader changes.
      const mode = t ? doc.settings.labelMode : 'text'
      const lines = mode === 'text' ? it.text.split('\n') : mode === 'letters' ? [letters?.get(it.id) ?? ''] : []
      const width = mode === 'blank' ? BLANK_RULE : Math.max(...lines.map((l) => estimateWidth(l, size)))
      add(P(it.side === 'left' ? it.x - width : it.x, it.y - size))
      add(P(it.side === 'left' ? it.x : it.x + width, it.y + Math.max(0, lines.length - 1) * size * 1.25 + size * 0.3))
      if (t) add(t, 2)
    }
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 }
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad }
}
