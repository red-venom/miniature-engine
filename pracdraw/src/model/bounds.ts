// bounds.ts — upright world boxes of items. The editor uses them for the selection box, the marquee, align and
// distribute, the snap guides and Fit. Pure: no DOM. Text width comes from `measure`: in the browser canvas
// measureText (src/editor/measure.ts), and in Node the estimate below.

import { P, pathBounds, type Box, type Pt } from '../kernel/geom'
import { SCRIPT } from '../kernel/nodes'
import { parseMarkup, smartChem } from '../kernel/text'
import { geometry } from '../symbols/registry'
import type { Geometry } from '../symbols/types'
import { toWorld } from './transform'
import type { Doc, Id, Item, LabelItem } from './types'

/**
 * The width of one line of label text as drawn, at a size. The text is markup (`parseMarkup`), with smart text already
 * applied when it is on, as the renderer draws it; subscripts and superscripts are drawn at 0.7 size.
 */
export type Measure = (text: string, size: number) => number

/**
 * The Node stand-in for canvas measureText (`estimateWidth` in src/render/render.ts): 0.56 × the size for each
 * character that is drawn. A subscript or superscript counts at 0.7 size, and the markup characters are not drawn.
 */
export const estimateWidth: Measure = (text, size) =>
  parseMarkup(text).reduce((w, r) => w + r.text.length * size * 0.56 * (r.script === 'normal' ? 1 : SCRIPT.scale), 0)

export const BLANK_RULE = 100
const TUBE_WIDTH = { glassTube: 7, rubberTube: 10 }

const localBoxes = new WeakMap<Geometry, Box>()

/** The box of a symbol's drawing in its local frame: every path and every text. */
export function localBox(g: Geometry): Box {
  let b = localBoxes.get(g)
  if (b) return b
  b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  for (const p of g.prims) {
    const c = pathBounds(p.d)
    b = { x0: Math.min(b.x0, c.x0), y0: Math.min(b.y0, c.y0), x1: Math.max(b.x1, c.x1), y1: Math.max(b.y1, c.y1) }
  }
  for (const t of g.texts ?? []) {
    b.x0 = Math.min(b.x0, t.x - t.size * 2)
    b.x1 = Math.max(b.x1, t.x + t.size * 2)
    b.y0 = Math.min(b.y0, t.y - t.size)
    b.y1 = Math.max(b.y1, t.y)
  }
  if (!Number.isFinite(b.x0)) b = { x0: 0, y0: 0, x1: 0, y1: 0 }
  localBoxes.set(g, b)
  return b
}

function grow(b: Box | null, p: Pt, m = 0): Box {
  if (!b) return { x0: p.x - m, y0: p.y - m, x1: p.x + m, y1: p.y + m }
  return { x0: Math.min(b.x0, p.x - m), y0: Math.min(b.y0, p.y - m), x1: Math.max(b.x1, p.x + m), y1: Math.max(b.y1, p.y + m) }
}

export function unionBox(a: Box | null, b: Box | null): Box | null {
  if (!a) return b
  if (!b) return a
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }
}

export const boxCentre = (b: Box): Pt => P((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2)

export const boxesTouch = (a: Box, b: Box): boolean => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1

/** The point a label's leader ends at, or null for plain text. Only the item's own transform is needed, so no symbol code runs. */
export function labelTarget(doc: Doc, it: LabelItem): Pt | null {
  if (!it.target) return null
  if (!('item' in it.target)) return P(it.target.x, it.target.y)
  const t = doc.items[it.target.item]
  return t && t.type === 'symbol' ? toWorld(t, P(it.target.lx, it.target.ly)) : null
}

/** The upright world box of one item as it is drawn, with a 2 u line allowance. */
export function itemBox(doc: Doc, it: Item, measure: Measure = estimateWidth): Box {
  let b: Box | null = null
  if (it.type === 'symbol') {
    const l = localBox(geometry(it.symbol, it.w, it.h, it.params))
    for (const c of [P(l.x0, l.y0), P(l.x1, l.y0), P(l.x0, l.y1), P(l.x1, l.y1)]) b = grow(b, toWorld(it, c), 2)
    return b!
  }
  if (it.type === 'connector') {
    const half = (it.width ?? (it.kind === 'glassTube' || it.kind === 'rubberTube' ? TUBE_WIDTH[it.kind] : 2)) / 2 + 1
    for (const p of it.points) b = grow(b, p, half)
    return b ?? { x0: 0, y0: 0, x1: 0, y1: 0 }
  }
  if (it.type === 'shape') {
    const a = (it.rot * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a)
    for (const [dx, dy] of [
      [-it.w / 2, -it.h / 2],
      [it.w / 2, -it.h / 2],
      [it.w / 2, it.h / 2],
      [-it.w / 2, it.h / 2],
    ]) {
      b = grow(b, P(it.x + dx * c - dy * s, it.y + dx * s + dy * c), 1)
    }
    return b!
  }
  const t = labelTarget(doc, it)
  b = labelBox(doc, it, measure)
  if (t) b = grow(b, t, 2)
  return b
}

/**
 * A label as it is drawn, without its leader: the text box, the 100 u line in blank mode, or the letter in letters
 * mode. Plain text is always its text box. Each line is measured as it is drawn: after smart text, when that is on.
 */
export function labelBox(doc: Doc, it: LabelItem, measure: Measure = estimateWidth): Box {
  const size = it.size ?? doc.settings.labelSize
  const mode = labelTarget(doc, it) ? doc.settings.labelMode : 'text'
  const smart = it.smart ?? doc.settings.smartText
  const lines = mode === 'text' ? it.text.split('\n').map((l) => (smart ? smartChem(l) : l)) : mode === 'letters' ? ['A'] : []
  const width = mode === 'blank' ? BLANK_RULE : Math.max(8, ...lines.map((l) => measure(l, size)))
  const b = grow(null, P(it.side === 'left' ? it.x - width : it.x, it.y - size))
  return grow(b, P(it.side === 'left' ? it.x : it.x + width, it.y + Math.max(0, lines.length - 1) * size * 1.25 + size * 0.3))
}

/** The union box of several items, or null when none exists. */
export function itemsBox(doc: Doc, ids: readonly Id[], measure: Measure = estimateWidth): Box | null {
  let b: Box | null = null
  for (const id of ids) {
    const it = doc.items[id]
    if (it) b = unionBox(b, itemBox(doc, it, measure))
  }
  return b
}

/** The box of the whole diagram, or null when it is empty. */
export const docBox = (doc: Doc, measure: Measure = estimateWidth): Box | null => itemsBox(doc, doc.order, measure)
