// check.ts — the layout faults that a person would see in a diagram, found without looking at it, and a compact text
// description of a diagram so that positions can be read instead of looked at. Pure: no DOM. Text width comes from
// `measure` (the estimate of bounds.ts in Node; the render command passes the width the browser draws).
//
// `checkDoc` finds: two leader lines that cross; a leader that crosses a part other than the one it names; a label text
// (or the line to write on) that overlaps a part other than the one it names; two label texts that overlap; a label
// text that is wider than the line to write on; a part drawn through another part; a symbol that failed to build (it
// is drawn as a dashed box); a connector whose points are all in one place; a leader that ends in empty space; a clamp
// drawn in front of the vessel it grips. Every finding is a warning with the id of the item as its path and a hint. A
// warning must be a real fault: the 43 templates have none (check.test.ts), except the long labels that the test lists.
//
// It must stay fast on a big diagram (1200 parts): every pair test is behind a test of bounding boxes.

import { P, dist, nearestOnSegment, pathPolys, roundPoly, type Box, type Pt } from '../kernel/geom'
import { smartChem } from '../kernel/text'
import { geometry, hasSymbol } from '../symbols/registry'
import type { Role } from '../symbols/types'
import { segmentsCross } from './autoLabel'
import { BLANK_RULE, EXPORT_MARGIN, docBounds, drawnItemBox, estimateWidth, labelTarget, letterMap, type Measure } from './bounds'
import { presetOf, readingOf } from './contents'
import { labelSize, leaderStart } from './labels'
import { insideCavity } from './order'
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
const segmentBox = (a: Pt, b: Pt): Box => ({ x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) })

/** How far a point is from a box: 0 on it or inside it. */
function boxDistance(b: Box, p: Pt): number {
  return Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.y0 - p.y, 0, p.y - b.y1))
}

/** The point where the segments a–b and c–d cross (they do: see `segmentsCross`). */
function crossingPoint(a: Pt, b: Pt, c: Pt, d: Pt): Pt {
  const rx = b.x - a.x,
    ry = b.y - a.y,
    sx = d.x - c.x,
    sy = d.y - c.y
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / (rx * sy - ry * sx)
  return P(a.x + t * rx, a.y + t * ry)
}

/** What a text can run into: the line segments of a drawing, and the regions that are filled. */
interface Obstacle {
  id: Id
  /** What it is, for a message: the part, connector or shape. */
  what: string
  item: Item
  /** Every line of the drawing. */
  segments: [Pt, Pt][]
  /** The lines that a leader may not cross: all but graduations and dashes. */
  ink: [Pt, Pt][]
  /** The walls: the lines of glass, metal, rubber and wood, without flames, graduations and dashes. */
  walls: [Pt, Pt][]
  regions: Pt[][]
  /** The regions that hide what is behind them: filled shapes, cavities, and the white fill of glass parts. */
  cover: Pt[][]
  /** Half the width of its lines. */
  pad: number
  /** The box of its lines and regions, without `pad`. */
  box: Box
  /** A symbol with a cavity: a vessel that can hold contents. */
  vessel: boolean
}

const FILLED: readonly Role[] = ['solid', 'rubber', 'dark', 'flame', 'flameCore']
const WALL_ROLES: readonly Role[] = ['outline', 'heavy', 'solid', 'rubber', 'dark']
const INK_ROLES: readonly Role[] = [...WALL_ROLES, 'mesh', 'flame', 'flameCore']

function newObstacle(item: Item, what: string, pad: number): Obstacle {
  return {
    id: item.id,
    what,
    item,
    segments: [],
    ink: [],
    walls: [],
    regions: [],
    cover: [],
    pad,
    box: { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
    vessel: false,
  }
}

/** Add the lines of a polyline to an obstacle; `lists` says which lists they go in. */
function addLine(obs: Obstacle, pts: readonly Pt[], closed: boolean, ink: boolean, wall: boolean): void {
  for (let i = 1; i < pts.length; i++) {
    const s: [Pt, Pt] = [pts[i - 1], pts[i]]
    obs.segments.push(s)
    if (ink) obs.ink.push(s)
    if (wall) obs.walls.push(s)
  }
  if (closed && pts.length > 2) obs.regions.push([...pts])
}

/** The box of everything an obstacle draws, once all its lines are in. */
function finish(obs: Obstacle): Obstacle {
  const b = obs.box
  for (const [p, q] of obs.segments) {
    b.x0 = Math.min(b.x0, p.x, q.x)
    b.y0 = Math.min(b.y0, p.y, q.y)
    b.x1 = Math.max(b.x1, p.x, q.x)
    b.y1 = Math.max(b.y1, p.y, q.y)
  }
  for (const r of obs.regions) {
    for (const p of r) {
      b.x0 = Math.min(b.x0, p.x)
      b.y0 = Math.min(b.y0, p.y)
      b.x1 = Math.max(b.x1, p.x)
      b.y1 = Math.max(b.y1, p.y)
    }
  }
  if (!Number.isFinite(b.x0)) obs.box = { x0: 0, y0: 0, x1: 0, y1: 0 }
  return obs
}

function symbolObstacle(it: SymbolItem): Obstacle {
  const g = geometry(it.symbol, it.w, it.h, it.params)
  const obs = newObstacle(it, `part "${it.id}"`, 1)
  for (const prim of g.prims) {
    for (const poly of pathPolys(prim.d, 0.5)) {
      const pts = poly.map((p) => toWorld(it, p))
      if (prim.role === 'paper') {
        if (pts.length > 2) obs.cover.push(pts)
        continue
      }
      const closed = FILLED.includes(prim.role) && pts.length > 2 && Math.hypot(poly[0].x - poly[poly.length - 1].x, poly[0].y - poly[poly.length - 1].y) < 1e-6
      addLine(obs, pts, closed, INK_ROLES.includes(prim.role), WALL_ROLES.includes(prim.role))
      if (closed) obs.cover.push(pts)
    }
  }
  for (const c of g.cavities ?? []) {
    for (const poly of c.polys) {
      const pts = poly.map((p) => toWorld(it, p))
      obs.regions.push(pts)
      obs.cover.push(pts)
    }
  }
  obs.vessel = !!g.cavities?.length
  return finish(obs)
}

function connectorObstacle(it: ConnectorItem): Obstacle | null {
  if (!isDrawn(it)) return null
  const width = it.kind === 'glassTube' ? (it.width ?? 7) : it.kind === 'rubberTube' ? (it.width ?? 10) : 0
  const obs = newObstacle(it, `connector "${it.id}"`, width / 2 + 1)
  for (const poly of roundPoly(it.points).polys(0.5)) addLine(obs, poly, false, false, false)
  return finish(obs)
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
  const obs = newObstacle(it, `shape "${it.id}"`, 1)
  addLine(obs, pts, it.fill !== 'none', false, false)
  return finish(obs)
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
  if (!boxesOverlap(o.box, reach)) return false
  if (o.segments.some(([a, b]) => segmentHitsBox(a, b, reach))) return true
  const centre = P((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2)
  return o.regions.some((r) => inside(centre, r))
}

/** How far a point is from the drawing of an obstacle: 0 on a line or inside a filled part or a cavity. */
function distanceTo(o: Obstacle, p: Pt): number {
  if (o.regions.some((r) => inside(p, r))) return 0
  let best = Infinity
  for (const [a, b] of o.segments) best = Math.min(best, dist(nearestOnSegment(a, b, p), p))
  return Math.max(0, best - o.pad)
}

/** The distance from a point to the nearest drawing of `obstacles`: boxes first, so that only the near ones are measured. */
function nearestDrawing(obstacles: readonly Obstacle[], p: Pt): number {
  let best = Infinity
  for (const o of obstacles) {
    if (boxDistance(o.box, p) - o.pad >= best) continue
    best = Math.min(best, distanceTo(o, p))
    if (best === 0) break
  }
  return best
}

/** A leader ends within this many units of a drawing, or inside it. Every label of the templates ends within 3. */
const REACH = 6

/** A crossing this close to the end of a leader is the leader meeting the part it names, not crossing another. */
const AT_THE_TARGET = 6

// ---------------------------------------------------------------- labels

type Mode = DocSettings['labelMode']

/** The ink box of a label as the mode draws it: its text, the line to write on, or its letter. */
function inkBox(doc: Doc, l: LabelItem, mode: Mode, letter: string | undefined, measure: Measure): Box {
  const size = labelSize(doc, l)
  const m = labelTarget(doc, l) ? mode : 'text'
  const left = l.side === 'left'
  if (m === 'blank') return { x0: left ? l.x - BLANK_RULE : l.x, x1: left ? l.x : l.x + BLANK_RULE, y0: l.y - 0.625, y1: l.y + 0.625 }
  const lines = m === 'letters' && letter ? [letter] : textLines(doc, l)
  const w = Math.max(8, ...lines.map((s) => measure(s, size)))
  return { x0: left ? l.x - w : l.x, x1: left ? l.x : l.x + w, y0: l.y - INK_TOP * size, y1: l.y + (lines.length - 1) * LINE_GAP * size + INK_BOTTOM * size }
}

/** The lines of a label's text as they are drawn: after smart text, when that is on. */
function textLines(doc: Doc, l: LabelItem): string[] {
  const smart = l.smart ?? doc.settings.smartText
  return l.text.split('\n').map((s) => (smart ? smartChem(s) : s))
}

const quote = (s: string) => `"${s.replace(/\n/g, ' ')}"`
const labelName = (l: LabelItem) => quote(l.text)

/** What a mode draws for a label, for a message: the first mention names the label, the next ones say "it". */
const MODE_FIRST: Record<Mode, (label: string) => string> = {
  text: (label) => `the text of the label ${label}`,
  blank: (label) => `the ${BLANK_RULE} u line that blank mode draws for the label ${label}`,
  letters: (label) => `the letter that letters mode draws for the label ${label}`,
}
const MODE_NEXT: Record<Mode, string> = {
  text: 'the text',
  blank: `the ${BLANK_RULE} u line that blank mode draws for it`,
  letters: 'the letter that letters mode draws for it',
}

/** The modes in which the document is exported: slides use text, worksheets blank or letters. */
function modesOf(doc: Doc): Mode[] {
  return doc.settings.labelMode === 'letters' ? ['text', 'blank', 'letters'] : ['text', 'blank']
}

/** The part that a label names, or undefined for plain text and a leader that ends on a free point. */
const namedPart = (l: LabelItem): Id | undefined => (l.target && 'item' in l.target ? l.target.item : undefined)

/** The texts that `checkDoc`, `describeDoc` and the bounds measure, as `measure(text, size)` is called: the render command measures them in the browser. */
export function measuredTexts(doc: Doc): { text: string; size: number }[] {
  const out = new Map<string, { text: string; size: number }>()
  const add = (text: string, size: number) => out.set(`${size} ${text}`, { text, size })
  const letters = letterMap(doc)
  for (const id of doc.order) {
    const it = doc.items[id]
    // The text of a symbol (scale numbers, the letters of a meter).
    if (it?.type === 'symbol') for (const t of geometry(it.symbol, it.w, it.h, it.params).texts ?? []) for (const line of t.text.split('\n')) add(line, t.size)
    const l = it
    if (l?.type !== 'label') continue
    const size = labelSize(doc, l)
    for (const line of textLines(doc, l)) add(line, size)
    add('A', size) // the box of a label in letters mode
    const letter = letters.get(id)
    if (letter) {
      add(letter, size)
      // The answer key: the letter, and the whole text on one line, at the label size of the document.
      const smart = l.smart ?? doc.settings.smartText
      const joined = l.text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(' ')
      add(letter, doc.settings.labelSize)
      add(smart ? smartChem(joined) : joined, doc.settings.labelSize)
    }
  }
  return [...out.values()]
}

// ---------------------------------------------------------------- the checks

/** Two symbols stand one on the other when an anchor of one is where an anchor of the other is. A rod and a sleeve share the line of the rod. */
function placedOn(a: SymbolItem, b: SymbolItem): boolean {
  const spots = (it: SymbolItem) => (geometry(it.symbol, it.w, it.h, it.params).anchors ?? []).map((k) => ({ kind: k.kind, at: toWorld(it, P(k.x, k.y)) }))
  const sa = spots(a),
    sb = spots(b)
  return sa.some((p) =>
    sb.some((q) => {
      if ((p.kind === 'rod' && q.kind === 'sleeve') || (p.kind === 'sleeve' && q.kind === 'rod')) return Math.abs(p.at.x - q.at.x) <= 0.5
      return dist(p.at, q.at) <= 0.5
    }),
  )
}

/** True when a point is hidden behind a part that is drawn after `parts[k]`: it lies inside a region that hides what is behind it. */
function hiddenBehind(parts: readonly Obstacle[], k: number, p: Pt): boolean {
  for (let i = k + 1; i < parts.length; i++) {
    const o = parts[i]
    if (p.x < o.box.x0 || p.x > o.box.x1 || p.y < o.box.y0 || p.y > o.box.y1) continue
    if (o.cover.some((r) => inside(p, r))) return true
  }
  return false
}

/** True when some wall of `a` crosses some wall of `b`. */
function wallsCross(a: Obstacle, b: Obstacle): boolean {
  for (const [p, q] of a.walls) {
    const sb = segmentBox(p, q)
    if (!boxesOverlap(sb, grow(b.box, 0.001))) continue
    for (const [r, s] of b.walls) {
      if (Math.max(r.x, s.x) < sb.x0 || Math.min(r.x, s.x) > sb.x1 || Math.max(r.y, s.y) < sb.y0 || Math.min(r.y, s.y) > sb.y1) continue
      if (segmentsCross(p, q, r, s)) return true
    }
  }
  return false
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

  // A clamp that grips a vessel is drawn behind it, so that its jaws meet the walls and do not cross the glass.
  const symbols = doc.order.map((id) => doc.items[id]).filter((it): it is SymbolItem => it?.type === 'symbol' && hasSymbol(it.symbol))
  const spots = (it: SymbolItem, kind: 'grip' | 'neck') =>
    (geometry(it.symbol, it.w, it.h, it.params).anchors ?? []).filter((a) => a.kind === kind).map((a) => toWorld(it, P(a.x, a.y)))
  symbols.forEach((clamp, i) => {
    const grips = spots(clamp, 'grip')
    if (!grips.length) return
    for (const vessel of symbols.slice(0, i)) {
      if (grips.some((g) => spots(vessel, 'neck').some((n) => dist(g, n) < 2))) {
        warn(
          clamp.id,
          `The clamp ${quote(clamp.id)} is drawn in front of ${quote(vessel.id)}, which it grips: its jaws would cross the glass.`,
          `Draw the clamp behind it: in a recipe add "behind": ${quote(vessel.id)} to the clamp; in the editor use Arrange, Send backward.`,
        )
      }
    }
  })

  const labels = doc.order.map((id) => doc.items[id]).filter((it): it is LabelItem => it?.type === 'label')
  const obstacles = obstaclesOf(doc)
  const parts = obstacles.filter((o) => o.item.type === 'symbol')

  // A part drawn through another part: their walls cross, and neither stands on the other (anchors that meet) or holds
  // the other in its cavity (the centre of the other is inside it, as the order rule of the editor says).
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i],
        b = parts[j]
      if (!a.vessel || !b.vessel || !boxesOverlap(a.box, b.box) || !a.walls.length || !b.walls.length) continue
      const ia = a.item as SymbolItem,
        ib = b.item as SymbolItem
      if (!wallsCross(a, b)) continue
      if (placedOn(ia, ib) || insideCavity(ia, P(ib.x, ib.y)) || insideCavity(ib, P(ia.x, ia.y))) continue
      warn(
        ib.id,
        `The part ${quote(ia.id)} (${ia.symbol}) and the part ${quote(ib.id)} (${ib.symbol}) are drawn through each other: their outlines cross, and neither stands on the other or holds it in its cavity.`,
        `Move one of them away, or stand one on the other so that their anchors meet ("on": { "part": ..., "anchor": ..., "own": ... }). A part that is meant to be inside a vessel has its centre inside the vessel.`,
      )
    }
  }

  // Leaders that cross.
  const leaders = labels.flatMap((l) => {
    const end = labelTarget(doc, l)
    return end ? [{ l, a: leaderStart(l, labelSize(doc, l)), b: end }] : []
  })
  for (let i = 0; i < leaders.length; i++) {
    const bi = segmentBox(leaders[i].a, leaders[i].b)
    for (let j = i + 1; j < leaders.length; j++) {
      if (!boxesOverlap(bi, segmentBox(leaders[j].a, leaders[j].b))) continue
      if (segmentsCross(leaders[i].a, leaders[i].b, leaders[j].a, leaders[j].b)) {
        warn(
          leaders[i].l.id,
          `The leaders of the labels ${labelName(leaders[i].l)} and ${labelName(leaders[j].l)} cross.`,
          'Swap the heights of the two texts, or put one of them on the other side of the diagram, so that the two lines do not cross.',
        )
      }
    }
  }

  // A leader that crosses a part other than the one it names. It may reach into a part that holds its end (a leader to a
  // thermometer in a beaker, to a burner inside a tripod: one line crossed, and the end inside the other part), and it
  // may touch another part where it ends. Crossing a part from side to side is the fault.
  for (const { l, a, b } of leaders) {
    const named = namedPart(l)
    const box = segmentBox(a, b)
    parts.forEach((o, k) => {
      if (o.id === named || !boxesOverlap(box, grow(o.box, 0.001)) || o.regions.some((r) => inside(b, r))) return
      const crossings: Pt[] = []
      for (const [c, d] of o.ink) {
        if (Math.max(c.x, d.x) < box.x0 || Math.min(c.x, d.x) > box.x1 || Math.max(c.y, d.y) < box.y0 || Math.min(c.y, d.y) > box.y1) continue
        if (!segmentsCross(a, b, c, d)) continue
        const at = crossingPoint(a, b, c, d)
        // A drawing is a chain of short segments: crossings 2 u apart are one line.
        if (dist(at, b) > AT_THE_TARGET && !crossings.some((p) => dist(p, at) < 2) && !hiddenBehind(parts, k, at)) crossings.push(at)
      }
      const reachesIn = crossings.length === 1 && b.x >= o.box.x0 && b.x <= o.box.x1 && b.y >= o.box.y0 && b.y <= o.box.y1
      if (!crossings.length || reachesIn) return
      const target = named ? `"${named}"` : 'the place it points at'
      warn(
        l.id,
        `The leader of the label ${labelName(l)} crosses ${o.what}${named ? `, and the label names ${target}` : ''}.`,
        `Put the text on the other side with "labels.side", or end the leader at another point of ${named ? target : 'the diagram'} with "labels.end", so that the line does not run over ${quote(o.id)}. In the editor, drag the round handle at the end of the leader.`,
      )
    })
  }

  // Texts that run into a part, and texts that run into each other.
  const letters = letterMap(doc)

  // Leaders that end in empty space: nothing is drawn where they end. (The leader of a label fixed to a part ends on that part.)
  for (const { l, b } of leaders) {
    const near = nearestDrawing(obstacles, b)
    if (near > REACH) {
      warn(
        l.id,
        `The leader of the label ${labelName(l)} ends in empty space, ${Math.round(near)} u from the nearest drawing.`,
        'Move the end of the leader onto the part: the point "at" [lx, ly] of a part is in its own frame (x = 0 is its centre line, y = 0 its top).',
      )
    }
  }

  // A text wider than the line that blank mode draws for it: the answer would not fit on its line.
  for (const l of labels) {
    if (!labelTarget(doc, l)) continue
    const size = labelSize(doc, l)
    const width = Math.max(0, ...textLines(doc, l).map((s) => measure(s, size)))
    if (width > BLANK_RULE) {
      warn(
        l.id,
        `The label ${labelName(l)} is ${Math.round(width)} u wide, and the line to write on in blank mode is ${BLANK_RULE} u: the answer will not fit on its line.`,
        'Shorten the label to one or two words, or give it a shorter text: "labels.text" in a recipe, the text of the label in the editor.',
      )
    }
  }

  const seen = new Map<string, Mode[]>()
  for (const mode of modesOf(doc)) {
    const boxes = labels.map((l) => ({ l, box: shrink(inkBox(doc, l, mode, letters.get(l.id), measure), TOUCH) }))
    for (const { l, box } of boxes) {
      const named = namedPart(l)
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
  const byObstacle = new Map(obstacles.map((o) => [o.id, o]))
  for (const [key, modes] of seen) {
    const [a, b] = key.split('|')
    const la = byId.get(a) as LabelItem
    const other = byId.get(b)
    if (other?.type === 'label') {
      warn(
        la.id,
        `The texts of the labels ${labelName(la)} and ${labelName(other)} overlap (${modes.map((m) => (m === 'letters' ? 'as letters' : 'as text')).join(' and ')}).`,
        'Move one of the texts up or down, or shorten it.',
      )
    } else {
      const o = byObstacle.get(b)!
      const [first, ...rest] = modes
      const subject = `${MODE_FIRST[first](labelName(la))}${rest.length ? `, or ${rest.map((m) => MODE_NEXT[m]).join(', or ')},` : ''}`
      warn(
        la.id,
        `${subject[0].toUpperCase()}${subject.slice(1)} overlaps the ${o.what}.`,
        `Move the text clear of the drawing: "labels.side" puts it on the other side, "labels.end" ends its leader at another point of the part, "labels.skip" leaves the automatic label out (a "labels.extra" label with "textAt" then places it by hand). Blank mode needs ${BLANK_RULE} u free beside each leader end.`,
      )
    }
  }
  return out
}

// ---------------------------------------------------------------- the description

/** The most warnings that a listing shows. The rest are counted. */
export const MAX_LISTED = 25

/** The first `max` problems, and how many more there are. */
export function listed(problems: readonly Problem[], max = MAX_LISTED): { shown: Problem[]; more: number } {
  return { shown: problems.slice(0, max), more: Math.max(0, problems.length - max) }
}

export interface DescribeOptions {
  /** Text width as drawn. The estimate when it is left out. */
  measure?: Measure
  /** Every anchor with its kind and direction, the parameters, and the layers of the contents. */
  verbose?: boolean
  /** The problems to list at the end. `checkDoc` of the document when they are left out. */
  problems?: Problem[]
  /** What this render makes of the diagram (label mode, photocopy-safe, key), for the header: the flags may differ from the document's settings. */
  render?: string
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
 * coordinates, the contents), each connector and each label, and the checks (the first 25, and a count of the rest).
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
    `picture ${w} × ${h} u (x ${num(Math.floor(b.x))}..${num(Math.ceil(b.x + b.w))}, y ${num(Math.floor(b.y))}..${num(Math.ceil(b.y + b.h))}, with a ${EXPORT_MARGIN} u margin); labels: ${s.labelMode}; photocopy-safe: ${s.mono ? 'on' : 'off'}${options.render ? `; this render: ${options.render}` : ''}`,
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
    const { shown, more } = listed(problems)
    lines.push(`checks: ${problems.length} warning${problems.length === 1 ? '' : 's'}`)
    shown.forEach((p, i) => lines.push(`  ${i + 1}. ${p.message}`))
    if (more) lines.push(`  and ${more} more`)
  }
  return lines.join('\n')
}
