// snap.ts — snapping while a symbol or a selection moves (section 12 of the specification). Pure.
//
// `snap(doc, moving, dx, dy, zoom)` corrects a drag of the items `moving` by (dx, dy) units. Anchors snap first: only
// the pairs of the snap table, never onto a moving item, and two anchors that both have a direction must point in
// opposite directions, within 30°, as the items stand. A plug that snaps into a mouth of another width gets the fit
// rule. With no anchor snap, the centre and the edges of the moving items' drawn bounds snap to the centres and edges
// of the other items' drawn bounds (centre to centre, edge to edge), and a guide line shows. The nearest candidate
// wins. The threshold T is 8 screen px. A snap leaves no lasting link: the result is only a move and maybe a width.
//
// What a drag needs is worked out once for each document and set of moving items (`snapContext`): the anchors and the
// bounds of every item. A pointer move then only compares numbers (the drag budget in section 6). A label's bounds are
// its text as drawn, without its leader (`labelBox`), measured with the `measure` it is given: canvas measureText in
// the browser, the estimate in Node.

import { P, dist, type Box, type Pt } from '../kernel/geom'
import { geometry, hasSymbol, symbolDef } from '../symbols/registry'
import type { Anchor, AnchorKind } from '../symbols/types'
import { estimateWidth, itemBox, labelBox, unionBox, type Measure } from './bounds'
import { moveItems, setSize } from './commands'
import { localMatrix, toWorld } from './transform'
import type { Doc, Id, SymbolItem } from './types'

/** The threshold T in screen px. In units it is SNAP_PX ÷ zoom. */
export const SNAP_PX = 8
/** A tip snaps to a mouth's centre line only this near the mouth along the line, in units. */
export const TIP_REACH = 40
/** Two anchors that both have a direction must point in opposite directions within this many degrees. */
export const DIR_WITHIN = 30

export type SnapGuide =
  /** A line to show, in world units: a guide of the bounds, or the surface, rod or centre line an anchor snapped to. */
  | { kind: 'line'; a: Pt; b: Pt }
  /** The world point where two anchors met. */
  | { kind: 'anchor'; p: Pt }

export interface SnapResult {
  /** The corrected drag. */
  dx: number
  dy: number
  /** The fit rule: the new width of the free symbol whose plug snapped into a mouth of another width. */
  resize?: { id: Id; w: number }
  guides: SnapGuide[]
}

/** How a pair of anchors snaps. */
type Rule =
  /** base onto a surface: the height snaps; sideways only to the surface centre when within T. */
  | 'surface'
  /** The two points meet. */
  | 'point'
  /** sleeve onto a rod's centre line, free along the rod. */
  | 'rod'
  /** tip onto a mouth's centre line, free along it. */
  | 'centre'

/** The snap table (section 12): for the kind of a moving anchor, the kinds it snaps to and how. */
const PAIRS: Partial<Record<AnchorKind, readonly (readonly [AnchorKind, Rule])[]>> = {
  base: [['surface', 'surface']],
  plug: [['mouth', 'point']],
  mouth: [['plug', 'point']],
  round: [['cup', 'point']],
  cup: [['round', 'point']],
  grip: [['neck', 'point']],
  neck: [['grip', 'point']],
  sleeve: [['rod', 'rod']],
  tip: [['mouth', 'centre']],
}

const TARGET_KINDS = new Set(Object.values(PAIRS).flatMap((pairs) => pairs!.map(([kind]) => kind)))

/** An anchor of an item in the world. A moving item's anchors are where they were at the start of the drag. */
interface WorldAnchor {
  item: SymbolItem
  a: Anchor
  p: Pt
  /** The anchor's direction in the world, a unit vector, when it has one. */
  dir?: Pt
  /** A surface: its outward normal. A mouth: its centre line, pointing out of the vessel. Up in the item when no `dir`. */
  axis?: Pt
  /** A rod: its centre line from the top of the item's box down to its base. */
  seg?: readonly [Pt, Pt]
}

/** What a drag needs, worked out once. */
export interface SnapContext {
  /** The anchors of the moving items that are in the snap table. */
  moving: WorldAnchor[]
  /** The anchors of every other symbol that something snaps to, by kind. */
  targets: Map<AnchorKind, WorldAnchor[]>
  /** The drawn bounds of the moving items (a label without its leader), or null when none has bounds. */
  box: Box | null
  /** The drawn bounds of every other item. */
  boxes: Box[]
}

const EPS = 1e-9
const add = (a: Pt, b: Pt): Pt => P(a.x + b.x, a.y + b.y)
const sub = (a: Pt, b: Pt): Pt => P(a.x - b.x, a.y - b.y)
const scale = (a: Pt, k: number): Pt => P(a.x * k, a.y * k)
const dot = (a: Pt, b: Pt): number => a.x * b.x + a.y * b.y

/** Rounding noise (cos 90° is 6e-17) becomes 0, so that a straight direction snaps exactly. */
const clean = (n: number): number => (Math.abs(n) < 1e-12 ? 0 : n)

/** A vector in an item's local frame, turned and flipped into the world. */
function worldVec(it: SymbolItem, v: Pt): Pt {
  const m = localMatrix(it)
  return P(m[0] * v.x + m[2] * v.y, m[1] * v.x + m[3] * v.y)
}

/** A direction in an item's local frame (degrees clockwise from +x) as a unit vector in the world. */
function worldDir(it: SymbolItem, deg: number): Pt {
  const r = (deg * Math.PI) / 180,
    w = worldVec(it, P(clean(Math.cos(r)), clean(Math.sin(r))))
  return P(clean(w.x), clean(w.y))
}

function worldAnchors(it: SymbolItem): WorldAnchor[] {
  return (geometry(it.symbol, it.w, it.h, it.params).anchors ?? []).map((a) => {
    const w: WorldAnchor = { item: it, a, p: toWorld(it, P(a.x, a.y)) }
    if (a.dir !== undefined) w.dir = worldDir(it, a.dir)
    if (a.kind === 'surface' || a.kind === 'mouth') w.axis = w.dir ?? worldDir(it, -90)
    if (a.kind === 'rod') w.seg = [toWorld(it, P(a.x, 0)), toWorld(it, P(a.x, it.h))]
    return w
  })
}

function buildContext(doc: Doc, ids: readonly Id[], measure: Measure): SnapContext {
  const mine = new Set(ids)
  const c: SnapContext = { moving: [], targets: new Map(), box: null, boxes: [] }
  for (const id of doc.order) {
    const it = doc.items[id]
    if (!it) continue
    if (it.type === 'symbol') {
      for (const w of worldAnchors(it)) {
        if (mine.has(id)) {
          if (PAIRS[w.a.kind]) c.moving.push(w)
        } else if (TARGET_KINDS.has(w.a.kind)) {
          const list = c.targets.get(w.a.kind)
          if (list) list.push(w)
          else c.targets.set(w.a.kind, [w])
        }
      }
    }
    // A label takes part with its text as drawn. Its leader is left out: it ends on another item, which may stay.
    const b = it.type === 'label' ? labelBox(doc, it, measure) : itemBox(doc, it, measure)
    if (mine.has(id)) c.box = unionBox(c.box, b)
    else c.boxes.push(b)
  }
  return c
}

const contexts = new WeakMap<Measure, WeakMap<Doc, Map<string, SnapContext>>>()

/**
 * The anchors and bounds that a drag of `moving` in `doc` snaps with. Worked out once for each document object, set of
 * ids and measure: a drag passes the document from its start on every pointer move, so the work is done at the start.
 */
export function snapContext(doc: Doc, moving: readonly Id[], measure: Measure = estimateWidth): SnapContext {
  const key = moving.join(' ')
  let byDoc = contexts.get(measure)
  if (!byDoc) {
    byDoc = new WeakMap()
    contexts.set(measure, byDoc)
  }
  let byIds = byDoc.get(doc)
  if (!byIds) {
    byIds = new Map()
    byDoc.set(doc, byIds)
  }
  let c = byIds.get(key)
  if (!c) {
    c = buildContext(doc, moving, measure)
    byIds.set(key, c)
  }
  return c
}

/** The direction rule: when both anchors have a direction, they point in opposite directions within 30°. */
export function facing(a: Pt | undefined, b: Pt | undefined): boolean {
  return !a || !b || dot(a, b) <= -Math.cos((DIR_WITHIN * Math.PI) / 180) + EPS
}

interface Candidate {
  /** How near the pair is: the distance that is compared with T. The nearest candidate wins. */
  d: number
  /** What to add to the drag. */
  fix: Pt
  m: WorldAnchor
  t: WorldAnchor
  rule: Rule
  /** The surface, the rod or the centre line, to show. */
  line?: readonly [Pt, Pt]
}

/** The candidate that a moving anchor, now at `q`, makes with a target, or null when the pair is out of reach. */
function candidate(rule: Rule, q: Pt, m: WorldAnchor, t: WorldAnchor, T: number): Candidate | null {
  switch (rule) {
    case 'point': {
      const d = dist(q, t.p)
      return d <= T ? { d, fix: sub(t.p, q), m, t, rule } : null
    }
    case 'surface': {
      const n = t.axis!,
        s = P(-n.y, n.x),
        v = sub(q, t.p)
      const height = dot(v, n),
        along = dot(v, s),
        half = (t.a.width ?? 0) / 2
      if (Math.abs(height) > T || Math.abs(along) > half + EPS) return null
      const fix = scale(n, -height)
      return {
        d: Math.abs(height),
        fix: Math.abs(along) <= T ? sub(fix, scale(s, along)) : fix,
        m,
        t,
        rule,
        line: [sub(t.p, scale(s, half)), add(t.p, scale(s, half))],
      }
    }
    case 'rod': {
      const [top, base] = t.seg!
      const length = dist(top, base)
      if (length < EPS) return null
      const u = scale(sub(base, top), 1 / length),
        v = sub(q, top),
        along = dot(v, u),
        off = sub(v, scale(u, along)),
        d = Math.hypot(off.x, off.y)
      if (along < -EPS || along > length + EPS || d > T) return null
      return { d, fix: scale(off, -1), m, t, rule, line: t.seg }
    }
    case 'centre': {
      const u = t.axis!,
        v = sub(q, t.p),
        along = dot(v, u),
        off = sub(v, scale(u, along)),
        d = Math.hypot(off.x, off.y)
      if (Math.abs(along) > TIP_REACH + EPS || d > T) return null
      return { d, fix: scale(off, -1), m, t, rule, line: [add(t.p, scale(u, TIP_REACH)), sub(t.p, scale(u, TIP_REACH))] }
    }
  }
}

/** The plug width of a symbol at width `w` (its other fields as they are), or undefined when it has none. */
function plugWidthAt(it: SymbolItem, anchorId: string, w: number): number | undefined {
  return geometry(it.symbol, w, it.h, it.params).anchors?.find((a) => a.id === anchorId)?.width
}

/**
 * The fit rule: the width at which the plug anchor `anchorId` of a free symbol is `target` wide. Two secant steps on
 * `build`, from the width it has and a first guess that the plug grows one for one with the box. The width never goes
 * below the symbol's `min`. Null when the width cannot change the plug (or the symbol is not free).
 */
export function fitWidth(it: SymbolItem, anchorId: string, target: number): number | null {
  if (!hasSymbol(it.symbol)) return null
  const def = symbolDef(it.symbol)
  if (def.resize !== 'free') return null
  const f = (w: number) => {
    const pw = plugWidthAt(it, anchorId, w)
    return pw === undefined ? NaN : pw - target
  }
  let w0 = it.w,
    f0 = f(w0)
  if (!Number.isFinite(f0)) return null
  if (Math.abs(f0) < 1e-6) return it.w
  let w1 = w0 - f0
  for (let step = 0; step < 2 && w1 > 0; step++) {
    const f1 = f(w1)
    if (!Number.isFinite(f1) || Math.abs(f1) < EPS || f1 === f0) break
    const w2 = w1 - (f1 * (w1 - w0)) / (f1 - f0)
    w0 = w1
    f0 = f1
    w1 = w2
  }
  if (!Number.isFinite(w1)) return null
  const w = Math.max(def.min?.w ?? 1, 1, Math.round(w1 * 1e6) / 1e6)
  return Math.abs(f(w) - f(it.w)) < EPS ? null : w
}

/** The world shift of an anchor when its item's width becomes `w`: `setSize` keeps the item's centre. */
function shiftAt(it: SymbolItem, a: Anchor, w: number): Pt | null {
  const b = geometry(it.symbol, w, it.h, it.params).anchors?.find((q) => q.id === a.id)
  return b ? worldVec(it, P(b.x - a.x, b.y - a.y)) : null
}

/** The anchor snap of a drag, or null when no pair is in reach. */
function anchorSnap(c: SnapContext, dx: number, dy: number, T: number): SnapResult | null {
  let best: Candidate | null = null
  for (const m of c.moving) {
    const q = P(m.p.x + dx, m.p.y + dy)
    for (const [kind, rule] of PAIRS[m.a.kind]!) {
      for (const t of c.targets.get(kind) ?? []) {
        if (!facing(m.dir, t.dir)) continue
        const k = candidate(rule, q, m, t, T)
        if (k && (!best || k.d < best.d)) best = k
      }
    }
  }
  if (!best) return null
  const { m, t } = best
  let out = { dx: dx + best.fix.x, dy: dy + best.fix.y }
  let at = P(m.p.x + out.dx, m.p.y + out.dy)
  let resize: SnapResult['resize']
  // The fit rule: a plug that snaps into a mouth of another width takes the mouth's width, if its symbol is free.
  if (best.rule === 'point' && (m.a.kind === 'plug' || m.a.kind === 'mouth')) {
    const plug = m.a.kind === 'plug' ? m : t,
      mouth = plug === m ? t : m
    const pw = plug.a.width,
      mw = mouth.a.width
    if (pw !== undefined && mw !== undefined && Math.abs(pw - mw) > 1e-6 && !plug.item.locked) {
      const w = fitWidth(plug.item, plug.a.id, mw)
      const shift = w === null || w === plug.item.w ? null : shiftAt(plug.item, plug.a, w)
      if (w !== null && shift) {
        resize = { id: plug.item.id, w }
        // A moving plug lands on the mouth at its new width; a moving mouth lands on the plug of the resized target.
        at = plug === m ? t.p : add(t.p, shift)
        const from = plug === m ? add(m.p, shift) : m.p
        out = { dx: at.x - from.x, dy: at.y - from.y }
      }
    }
  }
  const guides: SnapGuide[] = best.line ? [{ kind: 'line', a: best.line[0], b: best.line[1] }] : []
  guides.push({ kind: 'anchor', p: at })
  return resize ? { ...out, resize, guides } : { ...out, guides }
}

interface AxisSnap {
  /** What to add to the drag on this axis. */
  fix: number
  /** The coordinate snapped to. */
  at: number
}

const xs = (b: Box): readonly [number, number] => [b.x0, b.x1]
const ys = (b: Box): readonly [number, number] => [b.y0, b.y1]

/** The better of a guide so far and a move from `from` to `to`: the nearer one within T. */
function better(best: AxisSnap | null, from: number, to: number, T: number): AxisSnap | null {
  const fix = to - from
  return Math.abs(fix) <= T + EPS && (!best || Math.abs(fix) < Math.abs(best.fix)) ? { fix, at: to } : best
}

/** On one axis, the nearest of the other boxes' centres to the moving box's centre and of their edges to its edges. */
function nearest(moving: Box, boxes: readonly Box[], edges: (b: Box) => readonly [number, number], T: number): AxisSnap | null {
  let best: AxisSnap | null = null
  const [m0, m1] = edges(moving)
  for (const b of boxes) {
    const [e0, e1] = edges(b)
    best = better(best, (m0 + m1) / 2, (e0 + e1) / 2, T)
    best = better(best, m0, e0, T)
    best = better(best, m0, e1, T)
    best = better(best, m1, e0, T)
    best = better(best, m1, e1, T)
  }
  return best
}

/** The guide snap of a drag: the moving bounds against the other items' bounds. */
function guideSnap(c: SnapContext, dx: number, dy: number, T: number): SnapResult {
  if (!c.box || !c.boxes.length) return { dx, dy, guides: [] }
  const moved = (ox: number, oy: number): Box => ({ x0: c.box!.x0 + ox, y0: c.box!.y0 + oy, x1: c.box!.x1 + ox, y1: c.box!.y1 + oy })
  const at = moved(dx, dy)
  const gx = nearest(at, c.boxes, xs, T),
    gy = nearest(at, c.boxes, ys, T)
  const out = { dx: dx + (gx?.fix ?? 0), dy: dy + (gy?.fix ?? 0) }
  const b = moved(out.dx, out.dy)
  const guides: SnapGuide[] = []
  // Each guide runs across the moving bounds and every box that has a centre or an edge on it.
  const on = (v: number, e0: number, e1: number) => Math.abs(v - e0) < 1e-6 || Math.abs(v - e1) < 1e-6 || Math.abs(v - (e0 + e1) / 2) < 1e-6
  if (gx) {
    let y0 = b.y0,
      y1 = b.y1
    for (const o of c.boxes)
      if (on(gx.at, o.x0, o.x1)) {
        y0 = Math.min(y0, o.y0)
        y1 = Math.max(y1, o.y1)
      }
    guides.push({ kind: 'line', a: P(gx.at, y0), b: P(gx.at, y1) })
  }
  if (gy) {
    let x0 = b.x0,
      x1 = b.x1
    for (const o of c.boxes)
      if (on(gy.at, o.y0, o.y1)) {
        x0 = Math.min(x0, o.x0)
        x1 = Math.max(x1, o.x1)
      }
    guides.push({ kind: 'line', a: P(x0, gy.at), b: P(x1, gy.at) })
  }
  return { ...out, guides }
}

/**
 * Snap a drag of the items `moving` by (dx, dy) units, at a zoom (T = 8 ÷ zoom units). `on` is false when snapping is
 * off: the Snap view preference, or Ctrl or Cmd held during the drag. Then the drag is returned as it is. `measure`
 * gives the drawn width of a label's text, for the guides.
 */
export function snap(doc: Doc, moving: readonly Id[], dx: number, dy: number, zoom: number, on = true, measure: Measure = estimateWidth): SnapResult {
  if (!on || !moving.length || !(zoom > 0)) return { dx, dy, guides: [] }
  const c = snapContext(doc, moving, measure)
  const T = SNAP_PX / zoom
  return anchorSnap(c, dx, dy, T) ?? guideSnap(c, dx, dy, T)
}

/** The command for a snapped drag: the move, and the fit rule's new width, in one document (so one undo step). */
export function moveSnapped(doc: Doc, ids: readonly Id[], r: Pick<SnapResult, 'dx' | 'dy' | 'resize'>): Doc {
  const next = moveItems(doc, ids, r.dx, r.dy)
  const it = r.resize ? next.items[r.resize.id] : undefined
  return it?.type === 'symbol' ? setSize(next, it.id, { w: r.resize!.w, h: it.h }) : next
}
