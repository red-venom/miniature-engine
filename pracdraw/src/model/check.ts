// check.ts — the layout faults that a person would see in a diagram, found without looking at it, and a compact text
// description of a diagram so that positions can be read instead of looked at. Pure: no DOM. Text width comes from
// `measure` (the estimate of bounds.ts in Node; the render command passes the width the browser draws).
//
// `checkDoc` finds: two leader lines that cross; a label text (or the line to write on) that overlaps a part other than
// the one it names; two label texts that overlap; a symbol that failed to build (it is drawn as a dashed box); a
// connector whose points are all in one place. Every finding is a warning with the id of the item as its path and a hint.
// A warning must be a real fault: the 43 templates have none (check.test.ts).

import { P, pathPolys, roundPoly, type Box, type Pt } from '../kernel/geom'
import { smartChem } from '../kernel/text'
import { geometry, hasSymbol } from '../symbols/registry'
import type { Role } from '../symbols/types'
import { segmentsCross } from './autoLabel'
import { BLANK_RULE, EXPORT_MARGIN, docBounds, drawnItemBox, estimateWidth, labelTarget, letterMap, type Measure } from './bounds'
import { presetOf, readingOf } from './contents'
import { labelSize, leaderStart } from './labels'
import type { Problem } from './recipe'
import { toWorld } from './transform'
import type { ConnectorItem, Doc, DocSettings, Id, Item, LabelItem, ShapeItem, SymbolItem } from './types'

// ---------------------------------------------------------------- geometry

/** Cap height and descender of the label font, × the size: the text box that is tested is the ink, not the line box. */
const INK_TOP = 0.78,
  INK_BOTTOM = 0.22
/** A text box shrinks by this much on each side before it is tested, so that a line that only touches it is no overlap. */
const TOUCH = 1
const LINE_GAP = 1.25

/** True when the segment a–b meets the box (Liang–Barsky). */
function segmentHitsBox(a: Pt, b: Pt, box: Box): boolean {
  let t0 = 0,
    t1 = 1
  const dx = b.x - a.x,
    dy = b.y - a.y
  for (const [p, q] of [
    [-dx, a.x - box.x0],
    [dx, box.x1 - a.x],
    [-dy, a.y - box.y0],
    [dy, box.y1 - a.y],
  ]) {
    if (p === 0) {
      if (q < 0) return false
    } else {
      const t = q / p
      if (p < 0) {
        if (t > t1) return false
        t0 = Math.max(t0, t)
      } else {
        if (t < t0) return false
        t1 = Math.min(t1, t)
      }
    }
  }
  return true
}

/** Even–odd test: is the point inside the polygon? */
function inside(p: Pt, poly: readonly Pt[]): boolean {
  let in_ = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_
  }
  return in_
}

const boxesOverlap = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
const shrink = (b: Box, by: number): Box => ({ x0: b.x0 + by, y0: b.y0 + by, x1: b.x1 - by, y1: b.y1 - by })
const grow = (b: Box, by: number): Box => shrink(b, -by)

/** What a text can run into: the line segments of a drawing, and the regions that are filled. */
interface Obstacle {
  id: Id
  /** What it is, for a message: the part, connector or shape. */
  what: string
  segments: [Pt, Pt][]
  regions: Pt[][]
  /** Half the width of its lines. */
  pad: number
}

const FILLED: readonly Role[] = ['solid', 'rubber', 'dark', 'flame', 'flameCore']

function polyline(obs: Obstacle, pts: readonly Pt[], closed: boolean): void {
  for (let i = 1; i < pts.length; i++) obs.segments.push([pts[i - 1], pts[i]])
  if (closed && pts.length > 2) obs.regions.push([...pts])
}

function symbolObstacle(it: SymbolItem): Obstacle {
  const g = geometry(it.symbol, it.w, it.h, it.params)
  const obs: Obstacle = { id: it.id, what: `part "${it.id}"`, segments: [], regions: [], pad: 1 }
  for (const prim of g.prims) {
    if (prim.role === 'paper') continue
    for (const poly of pathPolys(prim.d, 0.5)) {
      const pts = poly.map((p) => toWorld(it, p))
      const closed = FILLED.includes(prim.role) && pts.length > 2 && Math.hypot(poly[0].x - poly[poly.length - 1].x, poly[0].y - poly[poly.length - 1].y) < 1e-6
      polyline(obs, pts, closed)
    }
  }
  for (const c of g.cavities ?? []) for (const poly of c.polys) obs.regions.push(poly.map((p) => toWorld(it, p)))
  return obs
}

function connectorObstacle(it: ConnectorItem): Obstacle | null {
  if (!isDrawn(it)) return null
  const width = it.kind === 'glassTube' ? (it.width ?? 7) : it.kind === 'rubberTube' ? (it.width ?? 10) : 0
  const obs: Obstacle = { id: it.id, what: `connector "${it.id}"`, segments: [], regions: [], pad: width / 2 + 1 }
  for (const poly of roundPoly(it.points).polys(0.5)) polyline(obs, poly, false)
  return obs
}

function shapeObstacle(it: ShapeItem): Obstacle {
  const a = (it.rot * Math.PI) / 180
  const turn = (x: number, y: number) => P(it.x + x * Math.cos(a) - y * Math.sin(a), it.y + x * Math.sin(a) + y * Math.cos(a))
  const pts: Pt[] = []
  if (it.shape === 'rect') {
    for (const [x, y] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      pts.push(turn((x * it.w) / 2, (y * it.h) / 2))
    }
  } else {
    for (let i = 0; i < 32; i++) pts.push(turn(Math.cos((i / 32) * 2 * Math.PI) * (it.w / 2), Math.sin((i / 32) * 2 * Math.PI) * (it.h / 2)))
  }
  pts.push(pts[0])
  const obs: Obstacle = { id: it.id, what: `shape "${it.id}"`, segments: [], regions: [], pad: 1 }
  polyline(obs, pts, it.fill !== 'none')
  return obs
}

/** A connector draws something unless it has fewer than two points or they are all in one place. */
const isDrawn = (it: ConnectorItem): boolean =>
  it.points.length >= 2 && it.points.some((p) => Math.abs(p.x - it.points[0].x) > 1e-6 || Math.abs(p.y - it.points[0].y) > 1e-6)

function obstaclesOf(doc: Doc): Obstacle[] {
  const out: Obstacle[] = []
  for (const id of doc.order) {
    const it = doc.items[id]
    if (!it) continue
    if (it.type === 'symbol') out.push(symbolObstacle(it))
    else if (it.type === 'connector') {
      const o = connectorObstacle(it)
      if (o) out.push(o)
    } else if (it.type === 'shape') out.push(shapeObstacle(it))
  }
  return out
}

function hits(o: Obstacle, box: Box): boolean {
  const reach = grow(box, o.pad)
  if (o.segments.some(([a, b]) => segmentHitsBox(a, b, reach))) return true
  const centre = P((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2)
  return o.regions.some((r) => inside(centre, r))
}

// ---------------------------------------------------------------- labels

type Mode = DocSettings['labelMode']

/** The ink box of a label as the mode draws it: its text, the line to write on, or its letter. */
function inkBox(doc: Doc, l: LabelItem, mode: Mode, letter: string | undefined, measure: Measure): Box {
  const size = labelSize(doc, l)
  const m = labelTarget(doc, l) ? mode : 'text'
  const left = l.side === 'left'
  if (m === 'blank') return { x0: left ? l.x - BLANK_RULE : l.x, x1: left ? l.x : l.x + BLANK_RULE, y0: l.y - 0.625, y1: l.y + 0.625 }
  const smart = l.smart ?? doc.settings.smartText
  const lines = m === 'letters' && letter ? [letter] : l.text.split('\n').map((s) => (smart ? smartChem(s) : s))
  const w = Math.max(8, ...lines.map((s) => measure(s, size)))
  return { x0: left ? l.x - w : l.x, x1: left ? l.x : l.x + w, y0: l.y - INK_TOP * size, y1: l.y + (lines.length - 1) * LINE_GAP * size + INK_BOTTOM * size }
}

const quote = (s: string) => `"${s.replace(/\n/g, ' ')}"`
const labelName = (l: LabelItem) => quote(l.text)

const MODE_NAME: Record<Mode, string> = { text: 'as text', blank: 'as the line to write on', letters: 'as a letter' }

/** The modes in which the document is exported: slides use text, worksheets blank or letters. */
function modesOf(doc: Doc): Mode[] {
  return doc.settings.labelMode === 'letters' ? ['text', 'blank', 'letters'] : ['text', 'blank']
}

/**
 * The layout faults of a diagram, as warnings. Text is measured with `measure`. Labels are checked as text and as the
 * line to write on (and as letters when the document is in letters mode), because all of them are exported.
 */
export function checkDoc(doc: Doc, measure: Measure = estimateWidth): Problem[] {
  const out: Problem[] = []
  const warn = (path: string, message: string, hint: string) => out.push({ level: 'warning', path, message, hint })

  // Symbols that failed to build, and connectors that draw nothing.
  for (const id of doc.order) {
    const it = doc.items[id]
    if (it?.type === 'symbol') {
      const g = geometry(it.symbol, it.w, it.h, it.params)
      const dashedBox =
        g.prims.length === 1 && g.prims[0].role === 'dashed' && g.texts?.length === 1 && g.texts[0].text === it.symbol && !g.cavities && !g.anchors
      if (!hasSymbol(it.symbol)) {
        warn(
          it.id,
          `The part ${quote(it.id)} has an unknown symbol ${quote(it.symbol)}: it is drawn as a dashed box.`,
          'Use a symbol id from the list: npm run render -- --list symbols',
        )
      } else if (dashedBox) {
        warn(
          it.id,
          `The part ${quote(it.id)} (${it.symbol}) failed to build with this size and these parameters: it is drawn as a dashed box.`,
          `Use the default size and parameters, or check them: npm run render -- --symbol ${it.symbol}`,
        )
      }
    } else if (it?.type === 'connector' && !isDrawn(it)) {
      warn(it.id, `The connector ${quote(it.id)} has all its points in one place, so nothing is drawn.`, 'Give it two points that are apart.')
    }
  }

  const labels = doc.order.map((id) => doc.items[id]).filter((it): it is LabelItem => it?.type === 'label')

  // Leaders that cross.
  const leaders = labels.flatMap((l) => {
    const end = labelTarget(doc, l)
    return end ? [{ l, a: leaderStart(l, labelSize(doc, l)), b: end }] : []
  })
  for (let i = 0; i < leaders.length; i++) {
    for (let j = i + 1; j < leaders.length; j++) {
      if (segmentsCross(leaders[i].a, leaders[i].b, leaders[j].a, leaders[j].b)) {
        warn(
          leaders[i].l.id,
          `The leaders of the labels ${labelName(leaders[i].l)} and ${labelName(leaders[j].l)} cross.`,
          'Swap the heights of the two texts, or put one of them on the other side of the diagram, so that the two lines do not cross.',
        )
      }
    }
  }

  // Texts that run into a part, and texts that run into each other.
  const letters = letterMap(doc)
  const obstacles = obstaclesOf(doc)
  const seen = new Map<string, Mode[]>()
  for (const mode of modesOf(doc)) {
    const boxes = labels.map((l) => ({ l, box: shrink(inkBox(doc, l, mode, letters.get(l.id), measure), TOUCH) }))
    for (const { l, box } of boxes) {
      const named = l.target && 'item' in l.target ? l.target.item : undefined
      for (const o of obstacles) {
        if (o.id === named || !hits(o, box)) continue
        const key = `${l.id}|${o.id}`
        seen.set(key, [...(seen.get(key) ?? []), mode])
      }
    }
    if (mode === 'blank') continue
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (!boxesOverlap(boxes[i].box, boxes[j].box)) continue
        const key = `${boxes[i].l.id}|${boxes[j].l.id}`
        seen.set(key, [...(seen.get(key) ?? []), mode])
      }
    }
  }
  const byId = new Map<Id, Item>(Object.entries(doc.items))
  for (const [key, modes] of seen) {
    const [a, b] = key.split('|')
    const la = byId.get(a) as LabelItem
    const other = byId.get(b)
    const how = modes.map((m) => MODE_NAME[m]).join(' and ')
    if (other?.type === 'label') {
      warn(la.id, `The texts of the labels ${labelName(la)} and ${labelName(other)} overlap (${how}).`, 'Move one of the texts up or down, or shorten it.')
    } else {
      const o = obstacles.find((x) => x.id === b)!
      warn(
        la.id,
        `The label ${labelName(la)} runs into the ${o.what} (${how}).`,
        'Move the text clear of the drawing: give the label a "textAt" that puts it outside, or a "side". Labels from "labels.auto" stand in columns beside the diagram.',
      )
    }
  }
  return out
}

// ---------------------------------------------------------------- the description

export interface DescribeOptions {
  /** Text width as drawn. The estimate when it is left out. */
  measure?: Measure
  /** Every anchor with its kind and direction, the parameters, and the layers of the contents. */
  verbose?: boolean
  /** The problems to list at the end. `checkDoc` of the document when they are left out. */
  problems?: Problem[]
}

const num = (n: number): string => String(Math.round(n * 10) / 10 || 0)
const pt = (p: Pt): string => `(${num(p.x)}, ${num(p.y)})`
const boxText = (b: Box | null): string => (b ? `x ${num(b.x0)}..${num(b.x1)}, y ${num(b.y0)}..${num(b.y1)}` : 'nothing drawn')

function contentsText(it: SymbolItem): string {
  const parts = Object.entries(it.contents).map(([cavity, layers]) => {
    const text = layers
      .map((l) => {
        const name = presetOf(l)?.name.replace(/\s*\(.*?\)\s*$/, '') ?? `${l.kind} ${l.colour}`
        return l.kind === 'gas' ? `${name} gas` : `${name} ${num(l.amount * 100)}%`
      })
      .join(' + ')
    return `${cavity}: ${text}`
  })
  const reading = readingOf(it)
  const g = geometry(it.symbol, it.w, it.h, it.params)
  return [...parts, ...(reading !== null && g.scale ? [`reading ${num(reading)} ${g.scale.unit}`] : [])].join('; ')
}

/**
 * A compact text description of a diagram, so that an agent can reason about positions without looking: the title and
 * the size of the picture, one line for each part (id, symbol, size, the box that is drawn, the anchors in world
 * coordinates, the contents), each connector and each label, and the checks.
 */
export function describeDoc(doc: Doc, options: DescribeOptions = {}): string {
  const measure = options.measure ?? estimateWidth
  const lines: string[] = []
  const b = docBounds(doc, measure)
  const w = Math.ceil(b.x + b.w) - Math.floor(b.x),
    h = Math.ceil(b.y + b.h) - Math.floor(b.y)
  const s = doc.settings
  lines.push(`${doc.title}`)
  lines.push(
    `picture ${w} × ${h} u (x ${num(Math.floor(b.x))}..${num(Math.ceil(b.x + b.w))}, y ${num(Math.floor(b.y))}..${num(Math.ceil(b.y + b.h))}, with a ${EXPORT_MARGIN} u margin); labels: ${s.labelMode}; photocopy-safe: ${s.mono ? 'on' : 'off'}`,
  )
  lines.push('world units, x to the right, y down; the box is what is drawn, the anchors are in the world')
  const items = doc.order.map((id) => doc.items[id]).filter((it): it is Item => !!it)
  const symbols = items.filter((it): it is SymbolItem => it.type === 'symbol')
  const connectors = items.filter((it): it is ConnectorItem => it.type === 'connector')
  const shapes = items.filter((it): it is ShapeItem => it.type === 'shape')
  const labels = items.filter((it): it is LabelItem => it.type === 'label')
  lines.push(`parts (${symbols.length}, back to front):`)
  for (const it of symbols) {
    const g = geometry(it.symbol, it.w, it.h, it.params)
    const anchors = (g.anchors ?? []).map((a) => {
      const p = toWorld(it, P(a.x, a.y))
      return options.verbose ? `${a.id}[${a.kind}${a.dir !== undefined ? `, ${num(a.dir)}°` : ''}]@${pt(p)}` : `${a.id}${pt(p)}`
    })
    const turned = `${it.rot ? `, turned ${num(it.rot)}°` : ''}${it.flip ? ', flipped' : ''}`
    const params = Object.keys(it.params).length ? ` params ${JSON.stringify(it.params)}` : ''
    const contents = Object.keys(it.contents).length ? ` contents ${contentsText(it)}` : ''
    lines.push(`  ${it.id}  ${it.symbol}  ${num(it.w)} × ${num(it.h)}${turned}  box ${boxText(drawnItemBox(doc, it, measure))}${params}${contents}`)
    if (anchors.length) lines.push(`    anchors ${anchors.join('  ')}`)
  }
  if (connectors.length) {
    lines.push(`connectors (${connectors.length}):`)
    for (const it of connectors) {
      const width = it.kind === 'glassTube' || it.kind === 'rubberTube' ? `, width ${num(it.width ?? (it.kind === 'glassTube' ? 7 : 10))}` : ''
      const caps = `${it.startCap !== 'none' ? `, start ${it.startCap}` : ''}${it.endCap !== 'none' ? `, end ${it.endCap}` : ''}${it.dash ? ', dashed' : ''}`
      lines.push(`  ${it.id}  ${it.kind}${width}${caps}  ${it.points.map(pt).join(' → ')}`)
    }
  }
  if (shapes.length) {
    lines.push(`shapes (${shapes.length}):`)
    for (const it of shapes) lines.push(`  ${it.id}  ${it.shape} ${num(it.w)} × ${num(it.h)} at ${pt(it)}`)
  }
  if (labels.length) {
    const letter = letterMap(doc)
    lines.push(`labels (${labels.length}; letters read in this order):`)
    for (const it of labels) {
      const end = labelTarget(doc, it)
      const fixed = it.target && 'item' in it.target ? `${it.target.item}(${num(it.target.lx)}, ${num(it.target.ly)}) = ` : ''
      const where = end ? `leader to ${fixed}${pt(end)}${it.leaderEnd !== 'none' ? ` with ${it.leaderEnd}` : ''}` : 'plain text'
      lines.push(`  ${letter.get(it.id) ?? '-'}  ${quote(it.text)}  ${where}; text ${it.side === 'left' ? 'ends' : 'starts'} at ${pt(it)}`)
    }
  }
  const problems = options.problems ?? checkDoc(doc, measure)
  if (!problems.length) lines.push('checks: no layout faults')
  else {
    lines.push(`checks: ${problems.length} warning${problems.length === 1 ? '' : 's'}`)
    problems.forEach((p, i) => lines.push(`  ${i + 1}. ${p.message}`))
  }
  return lines.join('\n')
}
