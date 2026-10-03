// Canvas.tsx — the drawing surface: the diagram, the pointer state machine of the tools, and the overlay (selection
// box, handles, marquee, guides, the connector being drawn) in a separate SVG layer above the diagram. Hits come from
// the DOM.

import { useEffect, useRef, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { P, type Box, type Pt } from '../kernel/geom'
import {
  addPresetAt,
  addSymbolAt,
  clearSelection,
  docFromText,
  draftAdd,
  draftFinish,
  draftHover,
  loadDoc,
  removePoint,
  select,
  toolDone,
} from '../editor/actions'
import { CLICK_PX, pointFor } from '../editor/connect'
import { ROTATE_GAP, handlePoint, handlesFor, resizeWith, rotatePoint, rotationTo, snapAngle, type HandleId } from '../editor/handles'
import { installHook } from '../editor/hook'
import { inTextField } from '../editor/keys'
import { filledAt, surfaces } from '../editor/level'
import { cachedNodes } from '../editor/nodes'
import { useEditor, type Draft, type Gesture, type Tool, type View } from '../editor/store'
import { screenBox, toScreen, toWorld, zoomAt } from '../editor/view'
import { boxCentre, boxesTouch, itemBox, itemsBox } from '../model/bounds'
import { duplicateItems, moveItems, newId, rotateItems, setRotation, setSize } from '../model/commands'
import { CONNECTOR_PRESETS, insertPoint, isDrawable, makeConnector, movePoint } from '../model/connectors'
import { setFilled } from '../model/contents'
import { orderRule } from '../model/order'
import { addShape, dragBox, type ShapeKind } from '../model/shapes'
import type { ConnectorItem, Doc, DocSettings, Id, Item } from '../model/types'
import { NodeView } from '../render/NodeView'
import { connectorNode } from '../render/render'
import { hasSymbol, symbolDef } from '../symbols/registry'
import type { ResizeMode } from '../symbols/types'
import { DRAG_TYPE, PRESET_DRAG_TYPE } from './constants'

const HANDLE = 8
/** A move of the Select tool starts after this many screen px. */
const MOVE_PX = 3
/** The level handle (section 9): a short bar that lies on the top surface and ends at its right end. Screen px. */
const LEVEL = { w: 18, h: 6 }
/** A segment shorter than this, in screen px, shows no round handle, so that its square handles stay easy to grab. */
const MID_MIN = 24

type Drag =
  | { kind: 'pan'; start: Pt; view0: View }
  | { kind: 'move'; start: Pt; ids: Id[]; alt: boolean; moving: boolean; base: Doc }
  | { kind: 'marquee'; start: Pt; keep: Id[] }
  | { kind: 'resize'; id: Id; handle: HandleId }
  | { kind: 'rotate'; ids: Id[]; centre: Pt; start: number }
  | { kind: 'level'; id: Id; cavity: string; dy: number } // dy: from the pointer to the surface, so that the surface does not jump
  /**
   * A press with a connector tool (section 10). `p` is where a click puts its point; `fresh` is true when the press
   * started the connector. `first` is the connector's first point at the press: if a key cancels or finishes the
   * connector while the button is down, the release does nothing.
   */
  | { kind: 'draw'; start: Pt; p: Pt; fresh: boolean; first: Pt | undefined }
  /** A square handle moves point `index`; a round handle inserts point `index`. */
  | { kind: 'point'; id: Id; index: number; insert: boolean; start: Pt; moved: boolean }
  /** A drag with the Rectangle or Ellipse tool, from the world point `from`. */
  | { kind: 'shape'; shape: ShapeKind; from: Pt; start: Pt; id: Id; moved: boolean }

/** The unlocked items under a page point, topmost first. */
function itemsAt(x: number, y: number, doc: Doc): Id[] {
  const out: Id[] = []
  for (const el of document.elementsFromPoint(x, y)) {
    const id = el.closest('[data-id]')?.getAttribute('data-id')
    if (id && !out.includes(id) && doc.items[id] && !doc.items[id].locked) out.push(id)
  }
  return out
}

/** How a symbol or a shape resizes. A shape has the handles of a free symbol. Null for any other item. */
function resizeOf(it: Item | null | undefined): { mode: ResizeMode; min?: { w: number; h: number } } | null {
  if (it?.type === 'shape') return { mode: 'free' }
  if (it?.type !== 'symbol') return null
  const def = hasSymbol(it.symbol) ? symbolDef(it.symbol) : null
  return { mode: def?.resize ?? 'free', min: def?.min }
}

const lastPoint = (d: Draft): Pt | undefined => d.points[d.points.length - 1]
const moved = (a: Pt, b: Pt, px: number) => Math.hypot(a.x - b.x, a.y - b.y) >= px
const round = (p: Pt): Pt => P(Math.round(p.x), Math.round(p.y))

export function Canvas() {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const space = useRef(false)
  const doc = useEditor((s) => s.doc)
  const view = useEditor((s) => s.view)
  const selection = useEditor((s) => s.selection)
  const gesture = useEditor((s) => s.gesture)
  const grid = useEditor((s) => s.prefs.grid)
  const tool = useEditor((s) => s.tool)

  // Size, the test hook, the wheel listener (passive: false, so that it can stop the page zoom), the Space key.
  useEffect(() => {
    const el = ref.current!
    const measure = () => useEditor.getState().setCanvas(el.clientWidth, el.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    installHook(() => el.getBoundingClientRect())
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const s = useEditor.getState()
      const r = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) s.setView(zoomAt(s.view, s.view.zoom * Math.exp(-e.deltaY * 0.0025), P(e.clientX - r.left, e.clientY - r.top)))
      else s.setView({ x: s.view.x - e.deltaX, y: s.view.y - e.deltaY })
    }
    el.addEventListener('wheel', wheel, { passive: false })
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !inTextField(e.target)) {
        space.current = true
        el.classList.add('panning')
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        space.current = false
        el.classList.remove('panning')
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const screenPt = (e: { clientX: number; clientY: number }): Pt => {
    const r = ref.current!.getBoundingClientRect()
    return P(e.clientX - r.left, e.clientY - r.top)
  }

  /** Where the connector being drawn would put its next point for a pointer at a world point. */
  const nextPoint = (draft: Draft, wp: Pt, e: ReactPointerEvent) => {
    const s = useEditor.getState()
    const prev = lastPoint(draft)
    return pointFor(s.doc, wp, prev ? [prev] : [], s.view.zoom, s.prefs.snap, e)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    const s = useEditor.getState()
    if (s.gesture) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const sp = screenPt(e),
      wp = toWorld(s.view, sp)
    if (e.button === 1 || space.current) {
      drag.current = { kind: 'pan', start: sp, view0: s.view }
      return
    }
    // A connector tool: the first press starts the connector, and each click places a point (section 10).
    if (s.draft) {
      const place = nextPoint(s.draft, wp, e)
      const fresh = !s.draft.points.length
      if (fresh) draftAdd(place.p)
      drag.current = { kind: 'draw', start: sp, p: place.p, fresh, first: useEditor.getState().draft?.points[0] }
      e.preventDefault()
      return
    }
    // The Rectangle and Ellipse tools: a drag draws the shape, as one undo step.
    if (s.tool === 'rect' || s.tool === 'ellipse') {
      drag.current = { kind: 'shape', shape: s.tool, from: round(wp), start: sp, id: newId(), moved: false }
      s.beginGesture('shape')
      e.preventDefault()
      return
    }
    if (s.tool !== 'select') return
    const handleEl = (e.target as Element).closest('[data-handle]')
    const handle = handleEl?.getAttribute('data-handle') as HandleId | 'rotate' | 'level' | 'point' | 'mid' | null
    if (handle && s.selection.length) {
      if (handle === 'point' || handle === 'mid') {
        const index = Number(handleEl?.getAttribute('data-index'))
        drag.current = { kind: 'point', id: s.selection[0], index: handle === 'mid' ? index + 1 : index, insert: handle === 'mid', start: sp, moved: false }
        s.beginGesture('point')
      } else if (handle === 'level') {
        const cavity = handleEl?.getAttribute('data-cavity') ?? 'main'
        const one = s.doc.items[s.selection[0]]
        const surface = one?.type === 'symbol' ? surfaces(one).find((q) => q.cavity === cavity) : undefined
        drag.current = { kind: 'level', id: s.selection[0], cavity, dy: surface ? surface.right.y - wp.y : 0 }
        s.beginGesture('level')
      } else if (handle === 'rotate') {
        const one = s.selection.length === 1 ? s.doc.items[s.selection[0]] : null
        const centre = one && (one.type === 'symbol' || one.type === 'shape') ? P(one.x, one.y) : boxCentre(itemsBox(s.doc, s.selection)!)
        drag.current = { kind: 'rotate', ids: s.selection, centre, start: rotationTo(centre, wp) }
        s.beginGesture('rotate')
      } else {
        drag.current = { kind: 'resize', id: s.selection[0], handle }
        s.beginGesture('resize')
      }
      e.preventDefault()
      return
    }
    const hits = itemsAt(e.clientX, e.clientY, s.doc)
    let id = hits[0]
    if (e.altKey && hits.length > 1) {
      const i = hits.findIndex((h) => s.selection.includes(h))
      id = hits[(i + 1) % hits.length]
    }
    if (id) {
      if (e.shiftKey) {
        select([id], true)
        return
      }
      if (!s.selection.includes(id)) select([id])
      const ids = useEditor.getState().selection
      drag.current = { kind: 'move', start: wp, ids, alt: e.altKey, moving: false, base: s.doc }
      s.beginGesture('move')
      e.preventDefault()
      return
    }
    if (!e.shiftKey) clearSelection()
    drag.current = { kind: 'marquee', start: wp, keep: e.shiftKey ? s.selection : [] }
    s.beginGesture('marquee')
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const s = useEditor.getState()
    const sp = screenPt(e),
      wp = toWorld(s.view, sp)
    if (!d || d.kind === 'draw') {
      // The rubber band follows the pointer, between clicks and during a press.
      if (s.draft) {
        const place = nextPoint(s.draft, wp, e)
        draftHover(place.p, place.anchor)
      }
      return
    }
    const base = s.gesture?.base ?? s.doc
    switch (d.kind) {
      case 'pan':
        s.setView({ x: d.view0.x + sp.x - d.start.x, y: d.view0.y + sp.y - d.start.y })
        return
      case 'move': {
        const dx = wp.x - d.start.x,
          dy = wp.y - d.start.y
        if (!d.moving) {
          if (Math.hypot(dx, dy) * s.view.zoom < MOVE_PX) return
          d.moving = true
          if (d.alt) {
            const dup = duplicateItems(base, d.ids, 0, 0)
            d.base = dup
            d.ids = dup.order.slice(base.order.length)
          } else d.base = base
        }
        s.preview(moveItems(d.base, d.ids, Math.round(dx), Math.round(dy)))
        return
      }
      case 'marquee': {
        const box: Box = { x0: Math.min(d.start.x, wp.x), y0: Math.min(d.start.y, wp.y), x1: Math.max(d.start.x, wp.x), y1: Math.max(d.start.y, wp.y) }
        s.updateGesture({ marquee: box })
        const hit = s.doc.order.filter((id) => !s.doc.items[id].locked && boxesTouch(box, itemBox(s.doc, s.doc.items[id])))
        select([...d.keep, ...hit])
        return
      }
      case 'resize': {
        const it = base.items[d.id]
        const how = resizeOf(it)
        if (!how || (it.type !== 'symbol' && it.type !== 'shape')) return
        s.preview(setSize(base, d.id, resizeWith(it, how.mode, how.min, d.handle, wp, e.shiftKey)))
        return
      }
      case 'rotate': {
        const one = d.ids.length === 1 ? base.items[d.ids[0]] : null
        if (one && (one.type === 'symbol' || one.type === 'shape')) s.preview(setRotation(base, one.id, snapAngle(rotationTo(d.centre, wp), e.shiftKey)))
        else s.preview(rotateItems(base, d.ids, snapAngle(rotationTo(d.centre, wp) - d.start, e.shiftKey), d.centre))
        return
      }
      case 'level': {
        const it = base.items[d.id]
        if (!it || it.type !== 'symbol') return
        const filled = filledAt(it, d.cavity, P(wp.x, wp.y + d.dy))
        if (filled !== null) s.preview(setFilled(base, d.id, d.cavity, filled))
        return
      }
      case 'point': {
        // A square handle moves its point; a round one inserts a point. The point snaps to the angles of its two
        // segments and to ports, terminals and tips (section 10).
        if (!d.moved) {
          if (!moved(sp, d.start, CLICK_PX)) return
          d.moved = true
        }
        const it = base.items[d.id]
        if (it?.type !== 'connector') return
        const pts = it.points
        const neighbours = (d.insert ? [pts[d.index - 1], pts[d.index]] : [pts[d.index - 1], pts[d.index + 1]]).filter((q): q is Pt => !!q)
        const place = pointFor(base, wp, neighbours, s.view.zoom, s.prefs.snap, e)
        s.preview(d.insert ? insertPoint(base, d.id, d.index, place.p) : movePoint(base, d.id, d.index, place.p))
        s.updateGesture({ anchor: place.anchor ? place.p : undefined })
        return
      }
      case 'shape': {
        if (!d.moved) {
          if (!moved(sp, d.start, CLICK_PX)) return
          d.moved = true
        }
        s.preview(addShape(base, d.shape, dragBox(d.from, round(wp), e.shiftKey), d.id))
        return
      }
    }
  }

  /** The release of a press with a connector tool. */
  const releaseDraw = (d: Extract<Drag, { kind: 'draw' }>, e: ReactPointerEvent<HTMLDivElement>) => {
    const s = useEditor.getState()
    const draft = s.draft
    if (!draft || draft.points[0] !== d.first) return
    const sp = screenPt(e),
      wp = toWorld(s.view, sp)
    const dragged = moved(sp, d.start, CLICK_PX)
    // The second click of a double-click lands on the point that the first one placed: it places nothing.
    const gap = CLICK_PX / s.view.zoom
    if (d.fresh) {
      // A press, drag and release from nothing makes a two-point connector in one gesture.
      if (dragged && draftAdd(nextPoint(draft, wp, e).p, gap)) draftFinish()
      return
    }
    // A click puts its point where the press was; a drag puts it where the pointer is released.
    draftAdd(dragged ? nextPoint(draft, wp, e).p : d.p, gap)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    const s = useEditor.getState()
    switch (d.kind) {
      case 'draw':
        releaseDraw(d, e)
        return
      case 'shape':
        if (s.gesture?.kind !== 'shape') return // Escape cancelled it
        if (!d.moved) {
          s.cancelGesture() // a click draws nothing
          return
        }
        s.endGesture()
        toolDone(d.id)
        return
      case 'move':
        // The order rule (section 12): a symbol dropped into a cavity comes to just above that symbol.
        if (d.moving) s.preview(orderRule(s.doc, d.ids))
        s.endGesture()
        if (d.moving && d.alt) select(d.ids)
        return
      default:
        s.endGesture()
    }
  }

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const s = useEditor.getState()
    // A double-click finishes the connector being drawn; its first click has already placed its point.
    if (s.draft) {
      draftFinish()
      return
    }
    if (s.tool !== 'select' || s.selection.length !== 1) return
    // A double-click on a square handle deletes that point. The event can be aimed at the canvas, which captured the
    // pointer, so the handle is found under the pointer.
    const el = document.elementsFromPoint(e.clientX, e.clientY).find((q) => q.getAttribute('data-handle') === 'point')
    if (el) removePoint(s.selection[0], Number(el.getAttribute('data-index')))
  }

  const onPointerLeave = () => {
    if (!drag.current) draftHover(undefined)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const at = toWorld(useEditor.getState().view, screenPt(e))
    const symbol = e.dataTransfer.getData(DRAG_TYPE)
    if (symbol) {
      addSymbolAt(symbol, at)
      return
    }
    const preset = CONNECTOR_PRESETS.find((p) => p.id === e.dataTransfer.getData(PRESET_DRAG_TYPE))
    if (preset) {
      addPresetAt(preset, at)
      return
    }
    const file = e.dataTransfer.files[0]
    if (file) {
      void file.text().then((text) => {
        const d = docFromText(text)
        if (d) loadDoc(d)
        else useEditor.getState().setStatus('Not a PracDraw file')
      })
    }
  }

  const nodes = cachedNodes(doc)
  const showGrid = grid && view.zoom >= 0.5
  const style = showGrid
    ? {
        backgroundSize: `${20 * view.zoom}px ${20 * view.zoom}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        backgroundImage: 'radial-gradient(circle, var(--dot) 1px, transparent 1.5px)',
      }
    : undefined
  return (
    <div
      ref={ref}
      className={tool === 'select' ? 'canvas' : 'canvas drawing'}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
      onDoubleClick={onDoubleClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <svg id="stage" className="stage" width="100%" height="100%">
        <g transform={`matrix(${view.zoom} 0 0 ${view.zoom} ${view.x} ${view.y})`}>
          {nodes.map(({ id, node }) => (
            <NodeView key={id} n={node} itemId={id} />
          ))}
        </g>
      </svg>
      <Overlay doc={doc} selection={selection} view={view} gesture={gesture} tool={tool} />
    </div>
  )
}

const CURSORS: Record<HandleId, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
}

function Handle({ id, p }: { id: HandleId; p: Pt }) {
  return <rect className="handle" data-handle={id} x={p.x - HANDLE / 2} y={p.y - HANDLE / 2} width={HANDLE} height={HANDLE} style={{ cursor: CURSORS[id] }} />
}

/**
 * The level handle of one cavity, at the right end `p` of the top surface (screen px). Dragging it up or down changes
 * the amount of the top layer that is not a gas.
 */
function LevelHandle({ cavity, p }: { cavity: string; p: Pt }) {
  return (
    <rect className="handle level" data-handle="level" data-cavity={cavity} x={p.x - LEVEL.w} y={p.y - LEVEL.h / 2} width={LEVEL.w} height={LEVEL.h} rx={2}>
      <title>Drag to change the level</title>
    </rect>
  )
}

function RotateHandle({ from, to }: { from: Pt; to: Pt }) {
  return (
    <>
      <line className="handle-line" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <circle className="handle" data-handle="rotate" cx={to.x} cy={to.y} r={HANDLE / 2 + 1} style={{ cursor: 'grab' }} />
    </>
  )
}

/** A ring round a port, terminal or tip that a connector point has snapped to (screen px). */
function Guide({ p }: { p: Pt }) {
  return <circle className="guide" cx={p.x} cy={p.y} r={7} />
}

/**
 * The handles of one selected connector (section 10): its points joined by a thin line, a square handle on each point
 * (drag to move it, double-click to delete it) and a round handle at the middle of each segment (drag to insert a point).
 */
function ConnectorHandles({ it, view, busy }: { it: ConnectorItem; view: View; busy: boolean }) {
  const pts = it.points.map((p) => toScreen(view, p))
  const kids = [<polyline key="line" className="path-line" points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />]
  if (!busy) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i],
        b = pts[i + 1]
      if (!moved(a, b, MID_MIN)) continue
      kids.push(
        <circle key={`mid${i}`} className="handle mid" data-handle="mid" data-index={i} cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} r={HANDLE / 2}>
          <title>Drag to add a point</title>
        </circle>,
      )
    }
    pts.forEach((p, i) =>
      kids.push(
        <rect
          key={`point${i}`}
          className="handle point"
          data-handle="point"
          data-index={i}
          x={p.x - HANDLE / 2}
          y={p.y - HANDLE / 2}
          width={HANDLE}
          height={HANDLE}
        >
          <title>Drag to move the point. Double-click to delete it.</title>
        </rect>,
      ),
    )
  }
  return <>{kids}</>
}

/**
 * The connector being drawn: drawn as it will be, through its points and the pointer, with a rubber band from the last
 * point to the pointer and a mark on each point placed. Not part of the render tree: it is not in the document yet.
 */
function DraftView({ draft, view, settings }: { draft: Draft; view: View; settings: DocSettings }) {
  const placed = draft.points
  const last = lastPoint(draft)
  const pointer = draft.pointer
  const kids = []
  const pts = pointer && last && (pointer.x !== last.x || pointer.y !== last.y) ? [...placed, pointer] : placed
  if (isDrawable(pts)) {
    kids.push(
      <g key="connector" transform={`matrix(${view.zoom} 0 0 ${view.zoom} ${view.x} ${view.y})`}>
        <NodeView n={connectorNode(makeConnector(draft.kind, pts, {}, 'draft'), settings)} />
      </g>,
    )
  }
  if (pointer && last) {
    const a = toScreen(view, last),
      b = toScreen(view, pointer)
    kids.push(<line key="rubber" className="rubber" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />)
  }
  placed.forEach((p, i) => {
    const q = toScreen(view, p)
    kids.push(<rect key={`p${i}`} className="draft-point" x={q.x - 3} y={q.y - 3} width={6} height={6} />)
  })
  if (pointer && draft.anchor) kids.push(<Guide key="anchor" p={toScreen(view, pointer)} />)
  return <>{kids}</>
}

/** The selection box, the handles, the marquee and the connector being drawn, in screen px. Never part of the render tree. */
function Overlay({ doc, selection, view, gesture, tool }: { doc: Doc; selection: Id[]; view: View; gesture: Gesture | null; tool: Tool }) {
  const draft = useEditor((s) => s.draft)
  const kids = []
  if (gesture?.marquee) {
    const m = screenBox(view, gesture.marquee)
    kids.push(<rect key="marquee" className="marquee" x={m.x0} y={m.y0} width={m.x1 - m.x0} height={m.y1 - m.y0} />)
  }
  const one = selection.length === 1 ? doc.items[selection[0]] : null
  // While another tool is chosen, the selection shows no handles: a press belongs to the tool.
  const busy = tool !== 'select' || gesture?.kind === 'move' || gesture?.kind === 'marquee'
  const how = resizeOf(one)
  if (one && how && (one.type === 'symbol' || one.type === 'shape')) {
    const corners = (['nw', 'ne', 'se', 'sw'] as const).map((h) => toScreen(view, handlePoint(one, h)))
    kids.push(<polygon key="box" className="selection" points={corners.map((c) => `${c.x},${c.y}`).join(' ')} />)
    if (!busy) {
      // The level handles first, so that a resize handle on the same spot stays on top and can still be grabbed.
      if (one.type === 'symbol')
        for (const sf of surfaces(one)) kids.push(<LevelHandle key={`level-${sf.cavity}`} cavity={sf.cavity} p={toScreen(view, sf.right)} />)
      for (const h of handlesFor(how.mode)) kids.push(<Handle key={h} id={h} p={toScreen(view, handlePoint(one, h))} />)
      kids.push(<RotateHandle key="rotate" from={toScreen(view, handlePoint(one, 'n'))} to={toScreen(view, rotatePoint(one, ROTATE_GAP / view.zoom))} />)
    }
  } else if (one && one.type === 'connector') {
    kids.push(<ConnectorHandles key="connector" it={one} view={view} busy={busy} />)
  } else if (selection.length) {
    const b = itemsBox(doc, selection)
    if (b) {
      const s = screenBox(view, b)
      kids.push(<rect key="box" className="selection" x={s.x0} y={s.y0} width={s.x1 - s.x0} height={s.y1 - s.y0} />)
      if (!busy) kids.push(<RotateHandle key="rotate" from={P((s.x0 + s.x1) / 2, s.y0)} to={P((s.x0 + s.x1) / 2, s.y0 - ROTATE_GAP)} />)
    }
  }
  if (gesture?.anchor) kids.push(<Guide key="anchor" p={toScreen(view, gesture.anchor)} />)
  if (draft) kids.push(<DraftView key="draft" draft={draft} view={view} settings={doc.settings} />)
  return (
    <svg className="overlay" width="100%" height="100%" aria-hidden="true">
      {kids}
    </svg>
  )
}
