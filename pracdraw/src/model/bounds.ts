// bounds.ts — upright world boxes of items. The editor uses them for the selection box, the marquee, align and
// distribute, the snap guides and Fit. `docBounds` is the box of the export (section 13). Pure: no DOM. Text width
// comes from `measure`: in the browser canvas measureText (src/editor/measure.ts), and in Node the estimate below.

import { P, pathBounds, pathPolys, type Box, type Pt } from '../kernel/geom'
import { SCRIPT } from '../kernel/nodes'
import { parseMarkup, smartChem } from '../kernel/text'
import { geometry } from '../symbols/registry'
import type { Geometry, Role } from '../symbols/types'
import { applyMat, toWorld, worldMatrix } from './transform'
import type { Cap, ConnectorItem, Doc, Id, Item, LabelItem, ShapeItem, SymbolItem } from './types'

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

// ---------------------------------------------------------------- the bounds of the export (section 13, "Bounds")

/** The space round an export, in units, on each side. */
export const EXPORT_MARGIN = 16

/** The box of an export: its top-left corner and its size, in world units. */
export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

/** Half the line width of each role (section 8): a line reaches that far outside its path. */
const HALF_LINE: Readonly<Record<Role, number>> = {
  outline: 1,
  heavy: 1.5,
  detail: 0.625,
  dashed: 0.625,
  paper: 0,
  solid: 1,
  rubber: 1,
  dark: 1,
  flame: 0.625,
  flameCore: 0.625,
  mesh: 2.25,
}
/** Half the line of a wire and of a tube's walls (2 u); half the line of a line, a leader, a tick and a blank rule (1.25 u). */
const HALF_WIRE = 1,
  HALF_DETAIL = 0.625
/** Text reaches about one size above its baseline and 0.3 × the size below it; each further line is 1.25 × the size lower. */
const DESCENT = 0.3,
  LINE_GAP = 1.25
/** The caps as the renderer draws them: an arrow head 8 u long at 0.42 rad to each side, a dot of radius 2.5, a tick 5 u to each side. */
const ARROW = { size: 8, spread: 0.42 },
  DOT = 2.5,
  TICK = 5

/** The convex hull of points (monotone chain): a turned drawing is bounded by turning a few points. */
function convexHull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (p.length < 3) return p
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const chain = (pts: Pt[]) => {
    const out: Pt[] = []
    for (const q of pts) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop()
      out.push(q)
    }
    out.pop()
    return out
  }
  return [...chain(p), ...chain([...p].reverse())]
}

interface Outline {
  /** The hull of every path and every cavity of the drawing, in the symbol's local frame. */
  hull: Pt[]
  /** The widest half line of its paths. */
  pad: number
}
const outlines = new WeakMap<Geometry, Outline>()

function outlineOf(g: Geometry): Outline {
  let o = outlines.get(g)
  if (o) return o
  const pts: Pt[] = []
  let pad = 0
  for (const p of g.prims) {
    for (const poly of pathPolys(p.d, 0.05)) pts.push(...poly)
    pad = Math.max(pad, HALF_LINE[p.role] ?? HALF_WIRE)
  }
  for (const c of g.cavities ?? []) for (const poly of c.polys) pts.push(...poly)
  o = { hull: convexHull(pts), pad }
  outlines.set(g, o)
  return o
}

/**
 * Lines of text whose first baseline is at (x, y), as drawn: each line measured and placed at its anchor. `at` takes a
 * corner of a line's box to the world (a symbol's text turns with it).
 */
function textLinesBox(
  b: Box | null,
  lines: readonly string[],
  x: number,
  y: number,
  size: number,
  anchor: 'start' | 'middle' | 'end',
  measure: Measure,
  at: (p: Pt) => Pt = (p) => p,
): Box | null {
  lines.forEach((line, i) => {
    if (!line) return
    const w = measure(line, size)
    const x0 = anchor === 'start' ? x : anchor === 'middle' ? x - w / 2 : x - w
    const base = y + i * size * LINE_GAP
    for (const c of [P(x0, base - size), P(x0 + w, base - size), P(x0, base + size * DESCENT), P(x0 + w, base + size * DESCENT)]) b = grow(b, at(c))
  })
  return b
}

/** A symbol as drawn: its paths (each line reaching half its width outside), its cavities, and its text as measured. */
function symbolDrawn(it: SymbolItem, measure: Measure): Box | null {
  const g = geometry(it.symbol, it.w, it.h, it.params)
  const m = worldMatrix(it)
  const at = (p: Pt) => applyMat(m, p)
  const o = outlineOf(g)
  let b: Box | null = null
  for (const p of o.hull) b = grow(b, at(p), o.pad)
  // The text turns with the symbol. A flipped symbol mirrors its text's box, though not the glyphs.
  for (const t of g.texts ?? []) b = textLinesBox(b, t.text.split('\n'), t.x, t.y, t.size, t.anchor, measure, at)
  return b
}

/** The arrow head, dot or tick at the end `end` of a line that comes from `from`. */
function capBox(b: Box, cap: Cap | LabelItem['leaderEnd'], end: Pt, from: Pt): Box {
  if (cap === 'arrow') {
    const a = Math.atan2(end.y - from.y, end.x - from.x)
    for (const s of [-ARROW.spread, ARROW.spread]) b = grow(b, P(end.x - ARROW.size * Math.cos(a + s), end.y - ARROW.size * Math.sin(a + s)))
  } else if (cap === 'dot') b = grow(b, end, DOT)
  else if (cap === 'tick') b = grow(b, end, TICK + HALF_DETAIL)
  return b
}

/**
 * A connector as drawn: its centre line widened by half its width (a tube's width plus its wall line, or the line of a
 * wire or a line), and the caps of a wire or a line. The mitre of a sharp bend in a tube reaches a little further; the
 * margin covers it. A connector whose points all lie on one spot is drawn as nothing.
 */
function connectorDrawn(it: ConnectorItem): Box | null {
  const pts = it.points,
    n = pts.length
  if (n < 2 || pts.every((p) => Math.abs(p.x - pts[0].x) < 1e-6 && Math.abs(p.y - pts[0].y) < 1e-6)) return null
  const tube = it.kind === 'glassTube' || it.kind === 'rubberTube'
  const half = tube ? (it.width ?? TUBE_WIDTH[it.kind as keyof typeof TUBE_WIDTH]) / 2 + HALF_WIRE : it.kind === 'wire' ? HALF_WIRE : HALF_DETAIL
  let b: Box | null = null
  for (const p of pts) b = grow(b, p, half)
  if (!tube) {
    b = capBox(b!, it.startCap, pts[0], pts[1])
    b = capBox(b, it.endCap, pts[n - 1], pts[n - 2])
  }
  return b
}

/** A rectangle or an ellipse as drawn, turned, with its 2 u line. */
function shapeDrawn(it: ShapeItem): Box {
  const a = (it.rot * Math.PI) / 180,
    c = Math.abs(Math.cos(a)),
    s = Math.abs(Math.sin(a))
  const rx = it.w / 2,
    ry = it.h / 2
  const hx = (it.shape === 'rect' ? rx * c + ry * s : Math.hypot(rx * c, ry * s)) + HALF_WIRE
  const hy = (it.shape === 'rect' ? rx * s + ry * c : Math.hypot(rx * s, ry * c)) + HALF_WIRE
  return { x0: it.x - hx, y0: it.y - hy, x1: it.x + hx, y1: it.y + hy }
}

/**
 * The letters of letters mode: A, B … Z, AA, AB … for the labels with a leader, in draw order. The same as
 * `labelLetters` in src/render/render.ts, which this folder may not import.
 */
export function letterMap(doc: Doc): Map<Id, string> {
  const out = new Map<Id, string>()
  for (const id of doc.order) {
    const it = doc.items[id]
    if (it?.type !== 'label' || !it.target) continue
    let s = ''
    for (let n = out.size; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s
    out.set(id, s)
  }
  return out
}

/**
 * A label as the document's label mode draws it: the text box in text mode, the 100 u line in blank mode, the letter
 * in letters mode, and in every mode the leader to its target with its end. Plain text is always its text box.
 */
function labelDrawn(doc: Doc, it: LabelItem, letter: string | undefined, measure: Measure): Box | null {
  const size = it.size ?? doc.settings.labelSize
  const target = labelTarget(doc, it)
  const mode = target ? doc.settings.labelMode : 'text'
  let b: Box | null
  if (mode === 'blank') {
    b = grow(grow(null, P(it.x, it.y), HALF_DETAIL), P(it.side === 'left' ? it.x - BLANK_RULE : it.x + BLANK_RULE, it.y), HALF_DETAIL)
  } else {
    const smart = it.smart ?? doc.settings.smartText
    const lines = mode === 'letters' && letter ? [letter] : it.text.split('\n').map((l) => (smart ? smartChem(l) : l))
    b = textLinesBox(null, lines, it.x, it.y, size, it.side === 'left' ? 'end' : 'start', measure)
  }
  if (target) {
    // The leader starts 5 u outside the text anchor, a third of the size above the baseline (`labelNode`).
    const start = P(it.x + (it.side === 'left' ? 5 : -5), it.y - size * 0.33)
    b = capBox(grow(grow(b, start, HALF_DETAIL), target, HALF_DETAIL), it.leaderEnd, target, start)
  }
  return b
}

/** One item as the export draws it, or null when it draws nothing. `letter` is its letter in letters mode. */
export function drawnItemBox(doc: Doc, it: Item, measure: Measure = estimateWidth, letter?: string): Box | null {
  switch (it.type) {
    case 'symbol':
      return symbolDrawn(it, measure)
    case 'connector':
      return connectorDrawn(it)
    case 'shape':
      return shapeDrawn(it)
    case 'label':
      return labelDrawn(doc, it, letter, measure)
  }
}

/**
 * The box of everything the export draws, without the margin: the union of every symbol's path bounds and symbol
 * text, every connector's centre line widened by half its width, every shape, and every label as the document's label
 * mode draws it (the text box in text mode, the 100 u line in blank mode, the letter in letters mode, and in every mode
 * the target). Plain text is always its text box. Null when nothing is drawn. An item whose drawing fails is left out,
 * as the export leaves it out.
 */
export function drawnBox(doc: Doc, measure: Measure = estimateWidth): Box | null {
  const letters = doc.settings.labelMode === 'letters' ? letterMap(doc) : undefined
  let b: Box | null = null
  for (const id of doc.order) {
    const it = doc.items[id]
    if (!it) continue
    try {
      b = unionBox(b, drawnItemBox(doc, it, measure, letters?.get(id)))
    } catch {
      // The export draws it as nothing.
    }
  }
  return b
}

/**
 * The bounds of an export (section 13): `drawnBox`, with the answer key's box when the key is on (`extra`), and then
 * 16 u on each side. `measure(text, size)` gives the width of one line as drawn: canvas measureText in the browser,
 * with scripts at 0.7 size, and `estimateWidth` in Node. An empty diagram gives the margin round the origin.
 */
export function docBounds(doc: Doc, measure: Measure = estimateWidth, extra: Box | null = null): Bounds {
  const b = unionBox(drawnBox(doc, measure), extra) ?? { x0: 0, y0: 0, x1: 0, y1: 0 }
  return { x: b.x0 - EXPORT_MARGIN, y: b.y0 - EXPORT_MARGIN, w: b.x1 - b.x0 + 2 * EXPORT_MARGIN, h: b.y1 - b.y0 + 2 * EXPORT_MARGIN }
}
