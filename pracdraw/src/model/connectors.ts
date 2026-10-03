// connectors.ts — the commands for connectors (section 10 of the specification): glass and rubber tubes, wires, lines,
// arrows and dimension lines. Each command is pure: (doc, arguments) => doc, and gives the same document when nothing
// changes. Also the pure maths of the connector tools: the angle snap, the anchor snap and the library presets.
//
// A connector's bend radius lives on its points: `r` on each point between the two ends (an end has no bend). The
// inspector sets every bend at once.

import { P, dist, type Pt, type V } from '../kernel/geom'
import { geometry } from '../symbols/registry'
import type { AnchorKind } from '../symbols/types'
import { addItem, newId } from './commands'
import { toWorld } from './transform'
import type { Cap, ConnectorItem, ConnectorKind, Doc, Id } from './types'

export const CONNECTOR_KINDS: readonly ConnectorKind[] = ['glassTube', 'rubberTube', 'wire', 'line']

/** The default width and bend radius of each kind (section 10). Wires and lines have no width, and sharp bends. */
export const KIND_DEFAULTS: Readonly<Record<ConnectorKind, { width?: number; radius: number }>> = {
  glassTube: { width: 7, radius: 12 },
  rubberTube: { width: 10, radius: 16 },
  wire: { radius: 0 },
  line: { radius: 0 },
}

/** What the inspector allows for a tube's width and for a bend radius, in units. */
export const WIDTH_RANGE = { min: 2, max: 40 }
export const RADIUS_RANGE = { min: 0, max: 200 }

export const isTube = (kind: ConnectorKind): boolean => kind === 'glassTube' || kind === 'rubberTube'

const TUBE_CAPS: readonly Cap[] = ['none', 'closed']
const LINE_CAPS: readonly Cap[] = ['none', 'arrow', 'dot', 'tick']

/** The end caps a kind can have: open ('none') or closed for a tube; none, arrow, dot or tick for a wire or a line. */
export const capsFor = (kind: ConnectorKind): readonly Cap[] => (isTube(kind) ? TUBE_CAPS : LINE_CAPS)

const validCap = (kind: ConnectorKind, cap: Cap | undefined): Cap => (cap && capsFor(kind).includes(cap) ? cap : 'none')
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const finite = (p: Pt) => Number.isFinite(p.x) && Number.isFinite(p.y)

/** The points with bend radius `r` at every point between the ends (no `r` when it is 0). The same array when nothing changes. */
function withRadius(points: readonly V[], r: number): V[] {
  let changed = false
  const out = points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p
    if (r > 0 ? p.r === r : !('r' in p)) return p
    changed = true
    return r > 0 ? { x: p.x, y: p.y, r } : { x: p.x, y: p.y }
  })
  return changed ? out : (points as V[])
}

/**
 * True when points make a line: at least two of them, not all on one spot. A connector always keeps this, because the
 * kernel cannot draw a tube whose points all coincide.
 */
export const isDrawable = (points: readonly Pt[]): boolean => points.length >= 2 && points.some((p) => p.x !== points[0].x || p.y !== points[0].y)

/** The bend radius that the inspector shows: that of the first bend, or the kind's default when there is no bend. */
export const connectorRadius = (it: ConnectorItem): number => (it.points.length > 2 ? (it.points[1].r ?? 0) : KIND_DEFAULTS[it.kind].radius)

/** The width a connector is drawn with: its own, or its kind's default. Undefined for a wire or a line. */
export const connectorWidth = (it: ConnectorItem): number | undefined => (isTube(it.kind) ? (it.width ?? KIND_DEFAULTS[it.kind].width) : undefined)

// ---------------------------------------------------------------- add

export interface ConnectorOpts {
  width?: number
  radius?: number
  dash?: boolean
  startCap?: Cap
  endCap?: Cap
}

/**
 * A new connector through world points. A tube gets its kind's width and every bend gets its kind's bend radius, unless
 * the options give them (glass 7 and 12, rubber 10 and 16; wires and lines are sharp). A cap that the kind cannot have
 * becomes 'none'. Only a wire or a line can be dashed.
 */
export function makeConnector(kind: ConnectorKind, points: readonly Pt[], o: ConnectorOpts = {}, id: Id = newId()): ConnectorItem {
  const it: ConnectorItem = {
    id,
    type: 'connector',
    kind,
    points: withRadius(
      points.map((p) => P(p.x, p.y)),
      o.radius ?? KIND_DEFAULTS[kind].radius,
    ),
    startCap: validCap(kind, o.startCap),
    endCap: validCap(kind, o.endCap),
  }
  if (isTube(kind)) it.width = o.width ?? KIND_DEFAULTS[kind].width
  else if (o.dash) it.dash = true
  return it
}

/** Add a connector on top. Points that do not make a line (fewer than two, or all on one spot) make no connector. */
export function addConnector(doc: Doc, kind: ConnectorKind, points: readonly Pt[], o: ConnectorOpts = {}, id: Id = newId()): Doc {
  return isDrawable(points) ? addItem(doc, makeConnector(kind, points, o, id)) : doc
}

// ---------------------------------------------------------------- points

function patchConnector(doc: Doc, id: Id, fn: (it: ConnectorItem) => ConnectorItem): Doc {
  const it = doc.items[id]
  if (!it || it.type !== 'connector') return doc
  const next = fn(it)
  return next === it ? doc : { ...doc, items: { ...doc.items, [id]: next } }
}

/** Move one point to a world point. It keeps its bend radius. A move that would put every point on one spot is not made. */
export function movePoint(doc: Doc, id: Id, index: number, p: Pt): Doc {
  return patchConnector(doc, id, (it) => {
    const q = it.points[index]
    if (!q || !finite(p) || (q.x === p.x && q.y === p.y)) return it
    const points = [...it.points]
    points[index] = { ...q, x: p.x, y: p.y }
    return isDrawable(points) ? { ...it, points } : it
  })
}

/**
 * Insert a point between two points (a round handle dragged off the middle of a segment). It becomes point `index`,
 * 1 to the number of points − 1, between the points that were `index − 1` and `index`. It is a new bend, so it gets
 * the connector's bend radius.
 */
export function insertPoint(doc: Doc, id: Id, index: number, p: Pt): Doc {
  return patchConnector(doc, id, (it) => {
    if (!Number.isInteger(index) || index < 1 || index >= it.points.length || !finite(p)) return it
    const r = connectorRadius(it)
    const points = [...it.points]
    points.splice(index, 0, r > 0 ? { x: p.x, y: p.y, r } : { x: p.x, y: p.y })
    return { ...it, points }
  })
}

/** Delete one point. Two points always remain, and they are never on one spot. */
export function deletePoint(doc: Doc, id: Id, index: number): Doc {
  return patchConnector(doc, id, (it) => {
    if (it.points.length <= 2 || !Number.isInteger(index) || index < 0 || index >= it.points.length) return it
    const points = it.points.filter((_, i) => i !== index)
    return isDrawable(points) ? { ...it, points } : it
  })
}

// ---------------------------------------------------------------- fields (the inspector)

export interface ConnectorPatch {
  kind?: ConnectorKind
  width?: number
  /** Every bend at once. 0 makes the bends sharp. */
  radius?: number
  dash?: boolean
  startCap?: Cap
  endCap?: Cap
}

const sameConnector = (a: ConnectorItem, b: ConnectorItem) =>
  a.kind === b.kind && a.width === b.width && !!a.dash === !!b.dash && a.startCap === b.startCap && a.endCap === b.endCap && a.points === b.points

/**
 * Change the fields of a connector. A new kind keeps a width or a bend radius that the user chose, but one that was the
 * old kind's default becomes the new kind's default: a glass tube that becomes a rubber tube is 10 wide with 16 u bends.
 * What the new kind cannot have goes: a tube has no dash and only open or closed ends; a wire or a line has no width and
 * no closed end. A width or a radius is kept in its range.
 */
export function setConnector(doc: Doc, id: Id, patch: ConnectorPatch): Doc {
  return patchConnector(doc, id, (it) => {
    const kind = patch.kind && CONNECTOR_KINDS.includes(patch.kind) ? patch.kind : it.kind
    const from = KIND_DEFAULTS[it.kind],
      to = KIND_DEFAULTS[kind]
    let width = it.width,
      points = it.points
    if (kind !== it.kind) {
      if ((it.width ?? from.width) === from.width) width = to.width
      if (connectorRadius(it) === from.radius) points = withRadius(points, to.radius)
    }
    if (patch.width !== undefined && Number.isFinite(patch.width)) width = clamp(patch.width, WIDTH_RANGE.min, WIDTH_RANGE.max)
    if (patch.radius !== undefined && Number.isFinite(patch.radius)) points = withRadius(points, clamp(patch.radius, RADIUS_RANGE.min, RADIUS_RANGE.max))
    const next: ConnectorItem = {
      ...it,
      kind,
      points,
      startCap: validCap(kind, patch.startCap ?? it.startCap),
      endCap: validCap(kind, patch.endCap ?? it.endCap),
    }
    delete next.width
    delete next.dash
    if (isTube(kind)) {
      if (width !== undefined) next.width = width
    } else if (patch.dash ?? it.dash) next.dash = true
    return sameConnector(next, it) ? it : next
  })
}

// ---------------------------------------------------------------- the angle snap

/** A segment this close to level or upright, in degrees, snaps to it (section 10). */
export const ANGLE_SNAP = 5

/** A line through `o`: level, upright, or at 45° falling to the right (y − x constant) or rising to the right (y + x constant). */
interface Line {
  f: 'h' | 'v' | 'd1' | 'd2'
  o: Pt
}

/** Families of the eight 45° directions, by k = angle ÷ 45 (y points down, so 45° falls to the right). */
const FAMILIES: Line['f'][] = ['h', 'd1', 'v', 'd2']

/** The line that the segment from `from` to `p` snaps to, or null when it does not snap. */
function snapLine(from: Pt, p: Pt, step45: boolean): Line | null {
  const dx = p.x - from.x,
    dy = p.y - from.y
  if (!dx && !dy) return null
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI
  const near = Math.round(deg / (step45 ? 45 : 90)) * (step45 ? 45 : 90)
  if (!step45 && Math.abs(deg - near) > ANGLE_SNAP + 1e-9) return null
  return { f: FAMILIES[(((near / 45) % 4) + 4) % 4], o: from }
}

/**
 * The point of a line nearest to p. On a level or upright line the other coordinate is kept exactly; on a 45° line the
 * offset from the line's point is whole units on each axis, so the angle stays exact.
 */
function onto(l: Line, p: Pt): Pt {
  const { o } = l
  if (l.f === 'h') return P(p.x, o.y)
  if (l.f === 'v') return P(o.x, p.y)
  if (l.f === 'd1') {
    const d = Math.round((p.x - o.x + (p.y - o.y)) / 2)
    return P(o.x + d, o.y + d)
  }
  const d = Math.round((p.x - o.x - (p.y - o.y)) / 2)
  return P(o.x + d, o.y - d)
}

/** Where two lines cross, or null when they are parallel. Each line as a·x + b·y = c. */
function meet(l: Line, m: Line): Pt | null {
  if (l.f === m.f) return null
  const form = (q: Line): [number, number, number] =>
    q.f === 'h' ? [0, 1, q.o.y] : q.f === 'v' ? [1, 0, q.o.x] : q.f === 'd1' ? [-1, 1, q.o.y - q.o.x] : [1, 1, q.o.y + q.o.x]
  const [a1, b1, c1] = form(l),
    [a2, b2, c2] = form(m)
  const det = a1 * b2 - a2 * b1
  // + 0 turns −0 into 0.
  return P((c1 * b2 - c2 * b1) / det + 0, (a1 * c2 - a2 * c1) / det + 0)
}

/**
 * Snap a connector point against its neighbours on the connector (section 10). Without Shift, a segment within 5° of
 * level or upright becomes exactly level or upright; with Shift, each segment goes to the nearest 45° step. With two
 * neighbours both segments snap: the point goes where the two lines cross, unless they are parallel or cross more than
 * half a segment away from the pointer; then it goes onto the nearer line. A segment that does not snap is left as it is.
 */
export function angleSnap(p: Pt, neighbours: readonly Pt[], step45 = false): Pt {
  const lines = neighbours.map((n) => snapLine(n, p, step45)).filter((l): l is Line => !!l)
  if (!lines.length) return p
  if (lines.length === 1) return onto(lines[0], p)
  const x = meet(lines[0], lines[1])
  if (x && dist(x, p) <= 0.5 * Math.min(...neighbours.map((n) => dist(n, p)))) return x
  const a = onto(lines[0], p),
    b = onto(lines[1], p)
  return dist(a, p) <= dist(b, p) ? a : b
}

// ---------------------------------------------------------------- the anchor snap

/** The anchor kinds that a connector point snaps to (section 10). */
export const CONNECTOR_ANCHORS: readonly AnchorKind[] = ['port', 'terminal', 'tip']

const r2 = (n: number) => Math.round(n * 100) / 100

/** The world points of every port, terminal and tip of the symbols in a document, to 0.01 u. */
export function connectorAnchors(doc: Doc): Pt[] {
  const out: Pt[] = []
  for (const id of doc.order) {
    const it = doc.items[id]
    if (it?.type !== 'symbol') continue
    for (const a of geometry(it.symbol, it.w, it.h, it.params).anchors ?? []) {
      if (!CONNECTOR_ANCHORS.includes(a.kind)) continue
      const p = toWorld(it, P(a.x, a.y))
      out.push(P(r2(p.x), r2(p.y)))
    }
  }
  return out
}

/** The anchor nearest to p within `reach`, or null. */
export function nearestAnchor(anchors: readonly Pt[], p: Pt, reach: number): Pt | null {
  let best: Pt | null = null,
    bestD = reach
  for (const a of anchors) {
    const d = dist(a, p)
    if (d <= bestD) {
      best = a
      bestD = d
    }
  }
  return best
}

export interface PlaceOpts {
  /** From `connectorAnchors`. */
  anchors: readonly Pt[]
  /** How near an anchor must be, in units: 8 screen px ÷ zoom. */
  reach: number
  /** Shift: 45° steps. */
  step45: boolean
  /** False when Snap is off or Ctrl is held: no anchor snap and no 5° snap. Shift still gives 45° steps. */
  snap: boolean
}

/**
 * Where a connector point goes for a pointer at p (section 10): onto a port, terminal or tip of a symbol within reach;
 * otherwise on whole units, snapped to the angles of the segments to its neighbours.
 */
export function placePoint(p: Pt, neighbours: readonly Pt[], o: PlaceOpts): { p: Pt; anchor: boolean } {
  if (o.snap) {
    const a = nearestAnchor(o.anchors, p, o.reach)
    if (a) return { p: a, anchor: true }
  }
  const q = P(Math.round(p.x), Math.round(p.y))
  return { p: o.snap || o.step45 ? angleSnap(q, neighbours, o.step45) : q, anchor: false }
}

// ---------------------------------------------------------------- the library presets

export interface ConnectorPreset {
  id: string
  name: string
  aliases?: string[]
  kind: ConnectorKind
  /** The points, from the first; up is −y. */
  path: readonly Pt[]
  startCap?: Cap
  endCap?: Cap
}

/** The "Tubes and lines" group of the library (section 10). */
export const CONNECTOR_PRESETS: readonly ConnectorPreset[] = [
  { id: 'deliveryTube', name: 'Delivery tube', aliases: ['glass tube', 'bent tube'], kind: 'glassTube', path: [P(0, 0), P(0, -60), P(160, -60), P(160, 30)] },
  { id: 'rightAngleTube', name: 'Right-angle tube', aliases: ['glass tube', 'bent tube'], kind: 'glassTube', path: [P(0, 0), P(0, -60), P(100, -60)] },
  { id: 'rubberTubing', name: 'Rubber tubing', aliases: ['rubber tube', 'hose'], kind: 'rubberTube', path: [P(0, 0), P(50, 0), P(100, 30), P(150, 30)] },
  { id: 'wire', name: 'Wire', aliases: ['lead', 'connecting wire'], kind: 'wire', path: [P(0, 0), P(120, 0)] },
  { id: 'arrow', name: 'Arrow', kind: 'line', path: [P(0, 0), P(80, 0)], endCap: 'arrow' },
  {
    id: 'dimensionLine',
    name: 'Dimension line',
    aliases: ['measurement', 'length'],
    kind: 'line',
    path: [P(0, 0), P(120, 0)],
    startCap: 'tick',
    endCap: 'tick',
  },
]

/** A preset as a new connector, the middle of its points' box on `at`, on whole units. */
export function presetConnector(preset: ConnectorPreset, at: Pt, id: Id = newId()): ConnectorItem {
  const xs = preset.path.map((p) => p.x),
    ys = preset.path.map((p) => p.y)
  const dx = Math.round(at.x - (Math.min(...xs) + Math.max(...xs)) / 2),
    dy = Math.round(at.y - (Math.min(...ys) + Math.max(...ys)) / 2)
  return makeConnector(
    preset.kind,
    preset.path.map((p) => P(p.x + dx, p.y + dy)),
    { startCap: preset.startCap, endCap: preset.endCap },
    id,
  )
}
