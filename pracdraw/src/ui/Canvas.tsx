// Canvas.tsx — the drawing surface: the diagram, the pointer state machine of the Select tool, and the overlay
// (selection box, handles, marquee) in a separate SVG layer above the diagram. Hits come from the DOM.

import { useEffect, useRef, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { P, type Box, type Pt } from '../kernel/geom'
import { addSymbolAt, clearSelection, docFromText, loadDoc, select } from '../editor/actions'
import { ROTATE_GAP, handlePoint, handlesFor, resizeWith, rotatePoint, rotationTo, snapAngle, type HandleId } from '../editor/handles'
import { installHook } from '../editor/hook'
import { inTextField } from '../editor/keys'
import { filledAt, surfaces } from '../editor/level'
import { cachedNodes } from '../editor/nodes'
import { useEditor, type Gesture, type View } from '../editor/store'
import { screenBox, toScreen, toWorld, zoomAt } from '../editor/view'
import { boxCentre, boxesTouch, itemBox, itemsBox } from '../model/bounds'
import { duplicateItems, moveItems, rotateItems, setRotation, setSize } from '../model/commands'
import { setFilled } from '../model/contents'
import { orderRule } from '../model/order'
import type { Doc, Id, SymbolItem } from '../model/types'
import { NodeView } from '../render/NodeView'
import { hasSymbol, symbolDef } from '../symbols/registry'
import { DRAG_TYPE } from './constants'

const HANDLE = 8
const CLICK_PX = 3
/** The level handle: a short bar at the right end of the top surface. */
const LEVEL_W = 16
const LEVEL_H = 5

type Drag =
  | { kind: 'pan'; start: Pt; view0: View }
  | { kind: 'move'; start: Pt; ids: Id[]; alt: boolean; moving: boolean; base: Doc }
  | { kind: 'marquee'; start: Pt; keep: Id[] }
  | { kind: 'resize'; id: Id; handle: HandleId }
  | { kind: 'rotate'; ids: Id[]; centre: Pt; start: number }
  | { kind: 'level'; id: Id; cavity: string }

/** The unlocked items under a page point, topmost first. */
function itemsAt(x: number, y: number, doc: Doc): Id[] {
  const out: Id[] = []
  for (const el of document.elementsFromPoint(x, y)) {
    const id = el.closest('[data-id]')?.getAttribute('data-id')
    if (id && !out.includes(id) && doc.items[id] && !doc.items[id].locked) out.push(id)
  }
  return out
}

const resizeMode = (it: SymbolItem) => (hasSymbol(it.symbol) ? symbolDef(it.symbol) : null)

export function Canvas() {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const space = useRef(false)
  const doc = useEditor((s) => s.doc)
  const view = useEditor((s) => s.view)
  const selection = useEditor((s) => s.selection)
  const gesture = useEditor((s) => s.gesture)
  const grid = useEditor((s) => s.prefs.grid)

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
    const handleEl = (e.target as Element).closest('[data-handle]')
    const handle = handleEl?.getAttribute('data-handle') as HandleId | 'rotate' | 'level' | null
    if (handle && s.selection.length) {
      if (handle === 'level') {
        drag.current = { kind: 'level', id: s.selection[0], cavity: handleEl?.getAttribute('data-cavity') ?? 'main' }
        s.beginGesture('level')
      } else if (handle === 'rotate') {
        const one = s.selection.length === 1 ? s.doc.items[s.selection[0]] : null
        const centre = one && one.type === 'symbol' ? P(one.x, one.y) : boxCentre(itemsBox(s.doc, s.selection)!)
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
    if (!d) return
    const s = useEditor.getState()
    const sp = screenPt(e),
      wp = toWorld(s.view, sp)
    const base = s.gesture?.base ?? s.doc
    switch (d.kind) {
      case 'pan':
        s.setView({ x: d.view0.x + sp.x - d.start.x, y: d.view0.y + sp.y - d.start.y })
        return
      case 'move': {
        const dx = wp.x - d.start.x,
          dy = wp.y - d.start.y
        if (!d.moving) {
          if (Math.hypot(dx, dy) * s.view.zoom < CLICK_PX) return
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
        if (!it || it.type !== 'symbol') return
        const def = resizeMode(it)
        s.preview(setSize(base, d.id, resizeWith(it, def?.resize ?? 'free', def?.min, d.handle, wp, e.shiftKey)))
        return
      }
      case 'rotate': {
        const one = d.ids.length === 1 ? base.items[d.ids[0]] : null
        if (one && one.type === 'symbol') s.preview(setRotation(base, one.id, snapAngle(rotationTo(d.centre, wp), e.shiftKey)))
        else s.preview(rotateItems(base, d.ids, snapAngle(rotationTo(d.centre, wp) - d.start, e.shiftKey), d.centre))
        return
      }
      case 'level': {
        const it = base.items[d.id]
        if (!it || it.type !== 'symbol') return
        const filled = filledAt(it, d.cavity, wp)
        if (filled !== null) s.preview(setFilled(base, d.id, d.cavity, filled))
      }
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    const s = useEditor.getState()
    // The order rule (section 12): a symbol dropped into a cavity comes to just above that symbol.
    if (d.kind === 'move' && d.moving) s.preview(orderRule(s.doc, d.ids))
    s.endGesture()
    if (d.kind === 'move' && d.moving && d.alt) select(d.ids)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const symbol = e.dataTransfer.getData(DRAG_TYPE)
    if (symbol) {
      const s = useEditor.getState()
      addSymbolAt(symbol, toWorld(s.view, screenPt(e)))
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
      className="canvas"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
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
      <Overlay doc={doc} selection={selection} view={view} gesture={gesture} />
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

/** The level handle of one cavity: dragging it up or down changes the amount of the top layer that is not a gas. */
function LevelHandle({ cavity, p }: { cavity: string; p: Pt }) {
  return (
    <rect
      className="handle level"
      data-handle="level"
      data-cavity={cavity}
      x={p.x - LEVEL_W / 2}
      y={p.y - LEVEL_H / 2}
      width={LEVEL_W}
      height={LEVEL_H}
      rx={1.5}
      style={{ cursor: 'ns-resize' }}
    />
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

/** The selection box, the handles and the marquee, in screen px. Never part of the render tree. */
function Overlay({ doc, selection, view, gesture }: { doc: Doc; selection: Id[]; view: View; gesture: Gesture | null }) {
  const kids = []
  if (gesture?.marquee) {
    const m = screenBox(view, gesture.marquee)
    kids.push(<rect key="marquee" className="marquee" x={m.x0} y={m.y0} width={m.x1 - m.x0} height={m.y1 - m.y0} />)
  }
  const one = selection.length === 1 ? doc.items[selection[0]] : null
  const busy = gesture?.kind === 'move' || gesture?.kind === 'marquee'
  if (one && one.type === 'symbol') {
    const corners = (['nw', 'ne', 'se', 'sw'] as const).map((h) => toScreen(view, handlePoint(one, h)))
    kids.push(<polygon key="box" className="selection" points={corners.map((c) => `${c.x},${c.y}`).join(' ')} />)
    if (!busy) {
      const def = resizeMode(one)
      for (const h of handlesFor(def?.resize ?? 'free')) kids.push(<Handle key={h} id={h} p={toScreen(view, handlePoint(one, h))} />)
      kids.push(<RotateHandle key="rotate" from={toScreen(view, handlePoint(one, 'n'))} to={toScreen(view, rotatePoint(one, ROTATE_GAP / view.zoom))} />)
      for (const sf of surfaces(one)) kids.push(<LevelHandle key={`level-${sf.cavity}`} cavity={sf.cavity} p={toScreen(view, sf.handle)} />)
    }
  } else if (selection.length) {
    const b = itemsBox(doc, selection)
    if (b) {
      const s = screenBox(view, b)
      kids.push(<rect key="box" className="selection" x={s.x0} y={s.y0} width={s.x1 - s.x0} height={s.y1 - s.y0} />)
      if (!busy) kids.push(<RotateHandle key="rotate" from={P((s.x0 + s.x1) / 2, s.y0)} to={P((s.x0 + s.x1) / 2, s.y0 - ROTATE_GAP)} />)
    }
  }
  return (
    <svg className="overlay" width="100%" height="100%" aria-hidden="true">
      {kids}
    </svg>
  )
}
