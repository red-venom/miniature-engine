// Canvas.tsx — the drawing surface: the diagram, the pointer state machine of the tools, and the overlay (selection
// box, handles, marquee, snap guides, the connector being drawn, the leader of a label being made) in a separate SVG
// layer above the diagram, and the text box of a label. Hits come from the DOM. A move snaps with `snap` from
// src/model/snap.ts.
//
// Pointer events only (section 12, "Touch"): a finger and a pen work as the mouse does. Two fingers pinch to zoom
// about their centre and pan; a double tap is a double-click; on a coarse pointer every handle has a hit area 28 px
// across. The canvas takes the focus when it is pressed, so the keys work on it and a field that was typed in commits.
// An empty diagram shows the card of the first run.

import { useEffect, useRef, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { P, type Box, type Pt } from '../kernel/geom'
import {
  clearSelection,
  commitText,
  draftAdd,
  draftCancel,
  draftFinish,
  draftHover,
  editLabel,
  removePoint,
  select,
  startLabel,
  toolDone,
} from '../editor/actions'
import { CLICK_PX, pointFor, snapping } from '../editor/connect'
import { openFile } from '../editor/files'
import { ROTATE_GAP, handlePoint, handlesFor, resizeWith, rotatePoint, rotationTo, snapAngle, type HandleId } from '../editor/handles'
import { installHook } from '../editor/hook'
import { controlKey, inTextField } from '../editor/keys'
import { filledAt, surfaces } from '../editor/level'
import { measureText } from '../editor/measure'
import { cachedNodes } from '../editor/nodes'
import { useEditor, type Draft, type Gesture, type TextEdit, type Tool, type View } from '../editor/store'
import { COARSE, HIT_PX, isDoubleTap, isTap, type Tap } from '../editor/touch'
import { pinchView, screenBox, toScreen, toWorld, zoomAt } from '../editor/view'
import { boxCentre, boxesTouch, itemBox, itemsBox, labelBox, labelTarget } from '../model/bounds'
import { duplicateItems, newId, rotateItems, setRotation, setSize } from '../model/commands'
import { insertPoint, isDrawable, makeConnector, movePoint } from '../model/connectors'
import { setFilled } from '../model/contents'
import { gestureLabel, setTargetAt } from '../model/labels'
import { orderRule } from '../model/order'
import { addShape, dragBox, type ShapeKind } from '../model/shapes'
import { moveSnapped, snap, snapContext, type SnapGuide } from '../model/snap'
import type { ConnectorItem, Doc, DocSettings, Id, Item, LabelItem } from '../model/types'
import { NodeView } from '../render/NodeView'
import { connectorNode, labelNode } from '../render/render'
import { hasSymbol, symbolDef } from '../symbols/registry'
import type { ResizeMode } from '../symbols/types'
import { CANVAS_ID, HINT_ID } from './constants'
import { EmptyState } from './EmptyState'
import { TextBox } from './TextBox'
import { useMedia } from './useMedia'

const HANDLE = 8
/** A move of the Select tool starts after this many screen px. */
const MOVE_PX = 3
/** The level handle (section 9): a short bar that lies on the top surface and ends at its right end. Screen px. */
const LEVEL = { w: 18, h: 6 }

type Drag =
  | { kind: 'pan'; start: Pt; view0: View }
  /**
   * A move of the Select tool. `base` is the document when the move began (after the copy, for Alt+drag); every pointer
   * move snaps against it. `last` is the last snapped move shown, so that a pointer move that changes nothing is not
   * drawn again.
   */
  | { kind: 'move'; start: Pt; ids: Id[]; alt: boolean; moving: boolean; base: Doc; last?: string }
  | { kind: 'marquee'; start: Pt; keep: Id[] }
  /**
   * A resize handle. `grab` is from where it was pressed to the handle, in world units: a handle pressed off its
   * centre (a finger in its hit area) keeps that offset, so the corner does not jump to the pointer.
   */
  | { kind: 'resize'; id: Id; handle: HandleId; grab: Pt }
  /** The rotate handle. `turn`, for one item: its rotation less the pointer's angle at the press, for the same reason. */
  | { kind: 'rotate'; ids: Id[]; centre: Pt; start: number; turn: number }
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
  /**
   * A press with the Label or Text tool (section 11), at the world point `press`, on the symbol `on` (or not). `plain`
   * for the Text tool: it makes plain text however far the pointer goes.
   */
  | { kind: 'label'; start: Pt; press: Pt; on: Id | null; plain: boolean }
  /** The round handle on the leader end of a selected label. */
  | { kind: 'target'; id: Id; start: Pt; moved: boolean }

/** The unlocked items under a page point, topmost first. */
function itemsAt(x: number, y: number, doc: Doc): Id[] {
  const out: Id[] = []
  for (const el of document.elementsFromPoint(x, y)) {
    const id = el.closest('[data-id]')?.getAttribute('data-id')
    if (id && !out.includes(id) && doc.items[id] && !doc.items[id].locked) out.push(id)
  }
  return out
}

/**
 * The symbol that a leader pressed or dropped at a page point ends on: the topmost item there that is not a label, if
 * it is a symbol (locked or not). A connector or a shape on top gives none: the leader end is then a free point.
 */
function symbolAt(x: number, y: number, doc: Doc): Id | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const id = el.closest('[data-id]')?.getAttribute('data-id')
    const it = id ? doc.items[id] : undefined
    if (it && it.type !== 'label') return it.type === 'symbol' ? it.id : null
  }
  return null
}

/** The topmost item under a page point, if it is a label that is not locked: a double-click there edits its text. */
function labelAt(x: number, y: number, doc: Doc): Id | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const id = el.closest('[data-id]')?.getAttribute('data-id')
    const it = id ? doc.items[id] : undefined
    if (it) return it.type === 'label' && !it.locked ? it.id : null
  }
  return null
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
  /**
   * True when the last release with a connector tool placed a point. When that release is the second click of a
   * double-click, the point goes again: the double-click adds its point once (section 10).
   */
  const released = useRef(false)
  /** The fingers that are down on the canvas: where each one is, in screen px from the canvas origin, by pointer id. */
  const touches = useRef(new Map<number, Pt>())
  /** Two fingers on the canvas: their ids, where they came down, and the view then. */
  const pinch = useRef<{ ids: readonly [number, number]; from: readonly [Pt, Pt]; view0: View } | null>(null)
  /** Where the last press of a finger or a pen went down (page px), to tell a tap from a drag. */
  const press = useRef<{ type: string; at: Pt } | null>(null)
  /** The last tap of a finger or a pen: a second tap soon after and near it is a double tap. */
  const lastTap = useRef<Tap | null>(null)
  /** The kind of pointer that last pressed the canvas. A dblclick that follows taps is ignored: the double tap did it. */
  const lastType = useRef('mouse')
  const doc = useEditor((s) => s.doc)
  const view = useEditor((s) => s.view)
  const selection = useEditor((s) => s.selection)
  const gesture = useEditor((s) => s.gesture)
  const grid = useEditor((s) => s.prefs.grid)
  const tool = useEditor((s) => s.tool)
  const textEdit = useEditor((s) => s.textEdit)

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
      // Space pans, unless a text field or a control that Space works (a button, a checkbox) has the focus.
      if (e.code === 'Space' && !inTextField(e.target) && !controlKey(e.target, ' ')) {
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

  const capture = (e: ReactPointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone.
    }
  }

  /**
   * The second finger: the pinch begins. What the first finger began goes back (a move, a marquee, the first point of a
   * connector, a label): two fingers only zoom and pan.
   */
  const startPinch = () => {
    const s = useEditor.getState()
    const d = drag.current
    drag.current = null
    if (s.gesture) s.cancelGesture()
    if (d?.kind === 'draw' && d.fresh) draftCancel()
    const [[ia, a], [ib, b]] = [...touches.current]
    pinch.current = { ids: [ia, ib], from: [a, b], view0: s.view }
    press.current = null
    lastTap.current = null
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    lastType.current = e.pointerType
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, screenPt(e))
      // A third finger does nothing; a second one starts the pinch.
      if (pinch.current || touches.current.size > 2) return
      if (touches.current.size === 2) {
        startPinch()
        capture(e)
        return
      }
    }
    press.current = { type: e.pointerType, at: P(e.clientX, e.clientY) }
    // The press takes the focus to the canvas: a field of the inspector or the text box that has the focus loses it, and
    // commits what was typed, before the press changes anything. From now on the keys act on the canvas.
    if (document.activeElement !== e.currentTarget) e.currentTarget.focus({ preventScroll: true })
    // A press outside the text box finishes the text (the box's own presses do not reach the canvas). The tool is then
    // Select, and the press goes on as a press of the Select tool.
    if (useEditor.getState().textEdit) commitText()
    const s = useEditor.getState()
    if (s.gesture) return
    capture(e)
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
    // The Label tool: press where the leader must end, drag to where the text goes, release (section 11). The Text
    // tool: a press and release make plain text.
    if (s.tool === 'label' || s.tool === 'text') {
      const plain = s.tool === 'text'
      drag.current = { kind: 'label', start: sp, press: wp, on: plain ? null : symbolAt(e.clientX, e.clientY, s.doc), plain }
      s.beginGesture('label')
      e.preventDefault()
      return
    }
    if (s.tool !== 'select') return
    const handleEl = (e.target as Element).closest('[data-handle]')
    const handle = handleEl?.getAttribute('data-handle') as HandleId | 'rotate' | 'level' | 'point' | 'mid' | 'target' | null
    if (handle && s.selection.length) {
      if (handle === 'target') {
        drag.current = { kind: 'target', id: s.selection[0], start: sp, moved: false }
        s.beginGesture('target')
      } else if (handle === 'point' || handle === 'mid') {
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
        const turns = one && (one.type === 'symbol' || one.type === 'shape') ? one : null
        const centre = turns ? P(turns.x, turns.y) : boxCentre(itemsBox(s.doc, s.selection, measureText)!)
        const start = rotationTo(centre, wp)
        drag.current = { kind: 'rotate', ids: s.selection, centre, start, turn: turns ? turns.rot - start : 0 }
        s.beginGesture('rotate')
      } else {
        const it = s.doc.items[s.selection[0]]
        const at = it && (it.type === 'symbol' || it.type === 'shape') ? handlePoint(it, handle) : wp
        drag.current = { kind: 'resize', id: s.selection[0], handle, grab: P(at.x - wp.x, at.y - wp.y) }
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
    if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, screenPt(e))
    const p = pinch.current
    if (p) {
      // The world point under the middle of the two fingers stays under it; their distance sets the zoom.
      const a = touches.current.get(p.ids[0]),
        b = touches.current.get(p.ids[1])
      if (p.ids.includes(e.pointerId) && a && b) useEditor.getState().setView(pinchView(p.view0, p.from, [a, b]))
      return
    }
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
            // The copy is what moves, so it is the selection from the start: the original is no longer selected, and
            // it is a snap target like any other item (section 12).
            s.preview(dup)
            s.select(d.ids)
          } else d.base = base
          // The anchors and bounds to snap to are collected once, here, not on every pointer move (section 6).
          if (s.prefs.snap) snapContext(d.base, d.ids, measureText)
        }
        // Whole units, then the snap (section 12). Ctrl or Cmd turns it off for the drag; so does the Snap preference.
        const r = snap(d.base, d.ids, Math.round(dx), Math.round(dy), s.view.zoom, snapping(s.prefs.snap, e), measureText)
        const key = `${r.dx} ${r.dy} ${r.resize?.w ?? ''} ${r.guides.length}`
        if (key === d.last) return
        d.last = key
        // The fit rule's new width is in the same document as the move, so the drag stays one undo step.
        s.preview(moveSnapped(d.base, d.ids, r))
        s.updateGesture({ guides: r.guides.length ? r.guides : undefined })
        return
      }
      case 'marquee': {
        const box: Box = { x0: Math.min(d.start.x, wp.x), y0: Math.min(d.start.y, wp.y), x1: Math.max(d.start.x, wp.x), y1: Math.max(d.start.y, wp.y) }
        s.updateGesture({ marquee: box })
        const hit = s.doc.order.filter((id) => !s.doc.items[id].locked && boxesTouch(box, itemBox(s.doc, s.doc.items[id], measureText)))
        select([...d.keep, ...hit])
        return
      }
      case 'resize': {
        const it = base.items[d.id]
        const how = resizeOf(it)
        if (!how || (it.type !== 'symbol' && it.type !== 'shape')) return
        s.preview(setSize(base, d.id, resizeWith(it, how.mode, how.min, d.handle, P(wp.x + d.grab.x, wp.y + d.grab.y), e.shiftKey)))
        return
      }
      case 'rotate': {
        const one = d.ids.length === 1 ? base.items[d.ids[0]] : null
        if (one && (one.type === 'symbol' || one.type === 'shape'))
          s.preview(setRotation(base, one.id, snapAngle(rotationTo(d.centre, wp) + d.turn, e.shiftKey)))
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
      case 'label':
        // The leader follows the pointer from where it will end. Plain text has none.
        if (!d.plain && s.gesture?.kind === 'label') s.updateGesture({ leader: { from: d.press, to: wp } })
        return
      case 'target':
        // The leader end follows the pointer as a free point; the release fixes it to the symbol under it, if any.
        if (!d.moved) {
          if (!moved(sp, d.start, CLICK_PX)) return
          d.moved = true
        }
        s.preview(setTargetAt(base, d.id, wp))
        return
    }
  }

  /** The release of a press with a connector tool. */
  const releaseDraw = (d: Extract<Drag, { kind: 'draw' }>, e: ReactPointerEvent<HTMLDivElement>) => {
    released.current = false
    const s = useEditor.getState()
    const draft = s.draft
    if (!draft || draft.points[0] !== d.first) return
    const sp = screenPt(e),
      wp = toWorld(s.view, sp)
    const dragged = moved(sp, d.start, CLICK_PX)
    // A point within 4 screen px of the last one is not placed: most often it is the second click of a double-click.
    const gap = CLICK_PX / s.view.zoom
    if (d.fresh) {
      // A press, drag and release from nothing makes a two-point connector in one gesture.
      if (dragged && draftAdd(nextPoint(draft, wp, e).p, gap)) draftFinish()
      return
    }
    // A click puts its point where the press was; a drag puts it where the pointer is released.
    released.current = draftAdd(dragged ? nextPoint(draft, wp, e).p : d.p, gap)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    touches.current.delete(e.pointerId)
    // A finger of the pinch comes up: the pinch ends. The other finger does nothing until it comes up too.
    if (pinch.current) {
      if (pinch.current.ids.includes(e.pointerId)) pinch.current = null
      return
    }
    const d = drag.current
    if (!d) return
    drag.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone.
    }
    finish(d, e)
    if (e.type === 'pointerup') tapped(e)
  }

  /**
   * A finger or a pen that comes up where it went down has tapped. A second tap soon after the first and near it is a
   * double tap: it does what a double-click does. (A mouse makes its own dblclick.)
   */
  const tapped = (e: ReactPointerEvent<HTMLDivElement>) => {
    const down = press.current
    press.current = null
    if (e.pointerType === 'mouse' || !down || down.type !== e.pointerType) return
    const tap: Tap = { t: e.timeStamp, p: P(e.clientX, e.clientY) }
    if (!isTap(down.at, tap.p)) {
      lastTap.current = null
      return
    }
    if (isDoubleTap(lastTap.current, tap)) {
      lastTap.current = null
      doubleClick(e.clientX, e.clientY)
    } else lastTap.current = tap
  }

  /** The end of a press of one pointer: what its drag does on release. */
  const finish = (d: Drag, e: ReactPointerEvent<HTMLDivElement>) => {
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
      case 'label': {
        if (s.gesture?.kind !== 'label') return // Escape cancelled it
        s.endGesture()
        // A drag makes a label with a leader; a click, or the Text tool, makes plain text. The text box opens at the
        // release point.
        const sp = screenPt(e)
        startLabel(gestureLabel(s.doc, d.press, toWorld(s.view, sp), !d.plain && moved(sp, d.start, CLICK_PX), d.on))
        return
      }
      case 'target':
        if (s.gesture?.kind !== 'target') return // Escape cancelled it
        // Dropped on a symbol, the leader end is fixed to it; elsewhere it is a free point. A click changes nothing.
        if (d.moved) s.preview(setTargetAt(s.gesture.base, d.id, toWorld(s.view, screenPt(e)), symbolAt(e.clientX, e.clientY, s.doc)))
        s.endGesture()
        return
      default:
        s.endGesture()
    }
  }

  /** A double-click of the mouse, or a double tap, at a page point. */
  const doubleClick = (x: number, y: number) => {
    const s = useEditor.getState()
    // A double-click finishes the connector being drawn. Its first click has already placed its point, so a point that
    // its second click placed goes again.
    if (s.draft) {
      draftFinish(released.current)
      released.current = false
      return
    }
    if (s.tool !== 'select' || s.textEdit) return
    // A double-click on a square handle deletes that point. The event can be aimed at the canvas, which captured the
    // pointer, so the handle is found under the pointer.
    const el = document.elementsFromPoint(x, y).find((q) => q.getAttribute('data-handle') === 'point')
    if (el && s.selection.length === 1) {
      removePoint(s.selection[0], Number(el.getAttribute('data-index')))
      return
    }
    // A double-click on a label edits its text (section 11).
    const label = labelAt(x, y, s.doc)
    if (label) editLabel(label)
  }

  const onDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    // After taps, the browser's dblclick comes too late and twice over: the double tap has done it.
    if (lastType.current === 'mouse') doubleClick(e.clientX, e.clientY)
  }

  const onPointerLeave = () => {
    if (!drag.current) draftHover(undefined)
  }

  // A .pracdraw.json or a PracDraw SVG dropped on the canvas opens, as Open does (section 13). (A tile of the library
  // is dragged with pointer events, not dropped here: useTileDrag.tsx.)
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) void openFile(file)
  }

  const nodes = cachedNodes(doc)
  // A label whose text is in the box is not drawn: the box shows its text as typed, and the overlay its leader.
  const hidden = textEdit && !textEdit.fresh ? textEdit.label.id : null
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
      id={CANVAS_ID}
      className={tool === 'select' ? 'canvas' : tool === 'text' ? 'canvas typing' : 'canvas drawing'}
      style={style}
      tabIndex={0}
      role="application"
      aria-label="Canvas"
      aria-describedby={HINT_ID}
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
          {nodes.map(({ id, node }) => (id === hidden ? null : <NodeView key={id} n={node} itemId={id} />))}
        </g>
      </svg>
      <Overlay doc={doc} selection={selection} view={view} gesture={gesture} tool={tool} textEdit={textEdit} />
      {textEdit && <TextBox edit={textEdit} view={view} doc={doc} />}
      <EmptyState />
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

/** A ring round a port, terminal or tip that a connector point has snapped to, or where two anchors met (screen px). */
function Guide({ p }: { p: Pt }) {
  return <circle className="guide" cx={p.x} cy={p.y} r={7} />
}

/** What a move snapped to (section 12): thin guide lines, and a ring where two anchors met. */
function SnapGuides({ guides, view }: { guides: readonly SnapGuide[]; view: View }) {
  return (
    <>
      {guides.map((g, i) => {
        if (g.kind === 'anchor') return <Guide key={i} p={toScreen(view, g.p)} />
        const a = toScreen(view, g.a),
          b = toScreen(view, g.b)
        return <line key={i} className="guide-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      })}
    </>
  )
}

/** A handle, for its hit area on a coarse pointer: its centre (screen px) and the attributes that a press reads. */
interface HitSpot {
  key: string
  p: Pt
  handle: string
  index?: number
  cavity?: string
}

/**
 * The hit area of a handle on a coarse pointer such as a finger (section 12, "Touch"): a transparent circle 28 px
 * across, centred on the handle, under every handle. A press on it is a press on the handle.
 */
function HitArea({ spot }: { spot: HitSpot }) {
  return (
    <circle className="handle-hit" data-handle={spot.handle} data-index={spot.index} data-cavity={spot.cavity} cx={spot.p.x} cy={spot.p.y} r={HIT_PX / 2} />
  )
}

/** The handles of a selected connector, for their hit areas: the middle of each segment, then each point. */
function connectorSpots(it: ConnectorItem, view: View): HitSpot[] {
  const pts = it.points.map((p) => toScreen(view, p))
  const mids = pts.slice(1).map((b, i): HitSpot => ({ key: `mid${i}`, p: P((pts[i].x + b.x) / 2, (pts[i].y + b.y) / 2), handle: 'mid', index: i }))
  return [...mids, ...pts.map((p, i): HitSpot => ({ key: `point${i}`, p, handle: 'point', index: i }))]
}

/**
 * The handles of one selected connector (section 10): its points joined by a thin line, a round handle at the middle of
 * each segment (drag to insert a point) and a square handle on each point (drag to move it, double-click to delete it).
 * The square handles come last, so that on a short segment they stay on top and easy to grab.
 */
function ConnectorHandles({ it, view, busy }: { it: ConnectorItem; view: View; busy: boolean }) {
  const pts = it.points.map((p) => toScreen(view, p))
  const kids = [<polyline key="line" className="path-line" points={pts.map((p) => `${p.x},${p.y}`).join(' ')} />]
  if (!busy) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i],
        b = pts[i + 1]
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

/** The round handle on the leader end of a selected label (screen px): drag it to move the leader end. */
function TargetHandle({ p }: { p: Pt }) {
  return (
    <circle className="handle target" data-handle="target" cx={p.x} cy={p.y} r={HANDLE / 2 + 1}>
      <title>Drag to move the leader end. Drop it on a part to fix it there.</title>
    </circle>
  )
}

/**
 * The leader of the label whose text is in the box, drawn as it will be: the label is either not in the document yet,
 * or not drawn while its text is typed. Its text is the box.
 */
function EditLeader({ label, doc, view }: { label: LabelItem; doc: Doc; view: View }) {
  if (!label.target) return null
  const node = labelNode({ ...doc, settings: { ...doc.settings, labelMode: 'text' } }, { ...label, text: '' })
  return (
    <g transform={`matrix(${view.zoom} 0 0 ${view.zoom} ${view.x} ${view.y})`}>
      <NodeView n={node} />
    </g>
  )
}

/** The leader of a drag of the Label tool: from where it will end (a dot) to the pointer. */
function LeaderBand({ from, to, view }: { from: Pt; to: Pt; view: View }) {
  const a = toScreen(view, from),
    b = toScreen(view, to)
  return (
    <>
      <line className="rubber" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      <circle className="leader-end" cx={a.x} cy={a.y} r={3} />
    </>
  )
}

/**
 * The selection box, the handles, the marquee, the connector being drawn and the leader of a label being made, in
 * screen px. Never part of the render tree.
 */
function Overlay({
  doc,
  selection,
  view,
  gesture,
  tool,
  textEdit,
}: {
  doc: Doc
  selection: Id[]
  view: View
  gesture: Gesture | null
  tool: Tool
  textEdit: TextEdit | null
}) {
  const draft = useEditor((s) => s.draft)
  const coarse = useMedia(COARSE)
  const kids: ReactNode[] = []
  /** The handles shown, for their hit areas on a coarse pointer. */
  const spots: HitSpot[] = []
  if (gesture?.marquee) {
    const m = screenBox(view, gesture.marquee)
    kids.push(<rect key="marquee" className="marquee" x={m.x0} y={m.y0} width={m.x1 - m.x0} height={m.y1 - m.y0} />)
  }
  const one = selection.length === 1 ? doc.items[selection[0]] : null
  // While another tool is chosen, the selection shows no handles: a press belongs to the tool. Nor while a label's
  // text is typed.
  const busy = tool !== 'select' || !!textEdit || gesture?.kind === 'move' || gesture?.kind === 'marquee'
  const how = resizeOf(one)
  if (one && how && (one.type === 'symbol' || one.type === 'shape')) {
    const corners = (['nw', 'ne', 'se', 'sw'] as const).map((h) => toScreen(view, handlePoint(one, h)))
    kids.push(<polygon key="box" className="selection" points={corners.map((c) => `${c.x},${c.y}`).join(' ')} />)
    if (!busy) {
      // The level handles first, so that a resize handle on the same spot stays on top and can still be grabbed.
      if (one.type === 'symbol')
        for (const sf of surfaces(one)) {
          const p = toScreen(view, sf.right)
          kids.push(<LevelHandle key={`level-${sf.cavity}`} cavity={sf.cavity} p={p} />)
          spots.push({ key: `level-${sf.cavity}`, p: P(p.x - LEVEL.w / 2, p.y), handle: 'level', cavity: sf.cavity })
        }
      for (const h of handlesFor(how.mode)) {
        const p = toScreen(view, handlePoint(one, h))
        kids.push(<Handle key={h} id={h} p={p} />)
        spots.push({ key: h, p, handle: h })
      }
      const r = toScreen(view, rotatePoint(one, ROTATE_GAP / view.zoom))
      kids.push(<RotateHandle key="rotate" from={toScreen(view, handlePoint(one, 'n'))} to={r} />)
      spots.push({ key: 'rotate', p: r, handle: 'rotate' })
    }
  } else if (one && one.type === 'connector') {
    kids.push(<ConnectorHandles key="connector" it={one} view={view} busy={busy} />)
    if (!busy) spots.push(...connectorSpots(one, view))
  } else if (one && one.type === 'label') {
    // One label: a box round what is drawn at its text anchor, and a round handle on its leader end. A label does not
    // turn, so it has no rotate handle.
    if (one.id !== textEdit?.label.id) {
      const s = screenBox(view, labelBox(doc, one, measureText))
      kids.push(<rect key="box" className="selection" x={s.x0} y={s.y0} width={s.x1 - s.x0} height={s.y1 - s.y0} />)
      const t = labelTarget(doc, one)
      if (t && !busy) {
        const p = toScreen(view, t)
        kids.push(<TargetHandle key="target" p={p} />)
        spots.push({ key: 'target', p, handle: 'target' })
      }
    }
  } else if (selection.length) {
    const b = itemsBox(doc, selection, measureText)
    if (b) {
      const s = screenBox(view, b)
      kids.push(<rect key="box" className="selection" x={s.x0} y={s.y0} width={s.x1 - s.x0} height={s.y1 - s.y0} />)
      if (!busy) {
        const r = P((s.x0 + s.x1) / 2, s.y0 - ROTATE_GAP)
        kids.push(<RotateHandle key="rotate" from={P((s.x0 + s.x1) / 2, s.y0)} to={r} />)
        spots.push({ key: 'rotate', p: r, handle: 'rotate' })
      }
    }
  }
  if (gesture?.anchor) kids.push(<Guide key="anchor" p={toScreen(view, gesture.anchor)} />)
  if (gesture?.guides) kids.push(<SnapGuides key="guides" guides={gesture.guides} view={view} />)
  if (gesture?.leader) kids.push(<LeaderBand key="leader" from={gesture.leader.from} to={gesture.leader.to} view={view} />)
  if (textEdit) kids.push(<EditLeader key="edit" label={textEdit.label} doc={doc} view={view} />)
  if (draft) kids.push(<DraftView key="draft" draft={draft} view={view} settings={doc.settings} />)
  return (
    <svg className="overlay" width="100%" height="100%" aria-hidden="true">
      {coarse && spots.map((spot) => <HitArea key={`hit-${spot.key}`} spot={spot} />)}
      {kids}
    </svg>
  )
}
