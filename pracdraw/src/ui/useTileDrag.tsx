// useTileDrag.tsx — a tile of the library dragged to the canvas (section 12: "Drag a tile to the canvas: the symbol is
// added at the pointer"), with pointer events ("pointer events everywhere"), so that a mouse, a finger and a pen all
// drag it the same way. A press on a tile that comes up where it went down is a click or a tap: the part goes to the
// centre of the view. A press that moves (`tilePress`) drags the tile: a ghost of it follows the pointer, and a release
// over the canvas adds the part there, as the selection; a release anywhere else, or Escape, adds nothing. A finger
// that moves mostly up or down scrolls the list instead: the tiles allow the browser only that (`touch-action`), and
// it cancels the pointer. In a narrow window the library is a drawer over the canvas: when a drag leaves the drawer,
// the drawer shuts (`onLeave`), so that the whole canvas shows and takes the drop.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { addPresetAt, addSymbolAt } from '../editor/actions'
import { useEditor } from '../editor/store'
import { tilePress } from '../editor/touch'
import { toWorld } from '../editor/view'
import { P, type Pt } from '../kernel/geom'
import { CANVAS_ID } from './constants'
import { TileFace, type Part } from './Tile'

/** Add the part at a world point, or at the centre of the view. */
function add(part: Part, at?: Pt): void {
  if (part.kind === 'symbol') addSymbolAt(part.def.id, at)
  else addPresetAt(part.preset, at)
}

/** The world point under a page point when the canvas (or the card on it) is what is there; otherwise null. */
function canvasPoint(x: number, y: number): Pt | null {
  const canvas = document.getElementById(CANVAS_ID)
  const hit = document.elementFromPoint(x, y)
  if (!canvas || !hit || !canvas.contains(hit)) return null
  const r = canvas.getBoundingClientRect()
  return toWorld(useEditor.getState().view, P(x - r.left, y - r.top))
}

/** A press on a tile: by which pointer, from where (page px), of what part, and whether it has become a drag. */
interface Press {
  pointer: number
  type: string
  from: Pt
  part: Part
  dragging: boolean
  /** The drag has left `area` (and `onLeave` has run). */
  left: boolean
}

interface Options {
  /** The panel the tiles are in. */
  area: RefObject<HTMLElement | null>
  /** A drag has left the panel: in a narrow window the drawer shuts. */
  onLeave?(): void
}

export interface TileDrag {
  /** The props of the button of a tile that adds `part`: its click, and the pointer events of a drag. */
  tile(part: Part): {
    onClick(): void
    onPointerDown(e: ReactPointerEvent<HTMLButtonElement>): void
    onPointerMove(e: ReactPointerEvent<HTMLButtonElement>): void
    onPointerUp(e: ReactPointerEvent<HTMLButtonElement>): void
    onPointerCancel(e: ReactPointerEvent<HTMLButtonElement>): void
    onLostPointerCapture(e: ReactPointerEvent<HTMLButtonElement>): void
  }
  /** True while a tile is dragged. */
  dragging: boolean
  /** The ghost of the dragged tile, under the pointer, in a portal over everything; null when there is none. */
  ghost: ReactNode
}

/** The ghost's top left corner from the pointer: its middle is under the pointer, where the part will go. */
const GHOST = { x: 38, y: 42 }

export function useTileDrag({ area, onLeave }: Options): TileDrag {
  const press = useRef<Press | null>(null)
  const ghost = useRef<HTMLDivElement | null>(null)
  /** Where the pointer is (page px), while a drag is on. */
  const pointer = useRef<Pt>(P(0, 0))
  /** The part dragged, while a drag is on. */
  const [drag, setDrag] = useState<Part | null>(null)
  /**
   * The pointer of the last drag, until its release is over: the click that a mouse makes on its release is not a
   * click of the tile, whether the drag dropped the part or Escape cancelled it.
   */
  const dragged = useRef<number | null>(null)
  const released = (id: number) => {
    if (dragged.current === id)
      setTimeout(() => {
        if (dragged.current === id) dragged.current = null
      })
  }

  const stop = () => {
    press.current = null
    setDrag(null)
  }

  // Escape cancels a drag. It goes no further: it must not also clear the selection or cancel a gesture. And a release
  // that the tile did not get (the tile went from the page during the drag) ends the drag too, adding nothing: the
  // tile's own handlers run first, so they have ended any drag they got the release of.
  useEffect(() => {
    if (!drag) return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      stop()
    }
    const lost = (e: PointerEvent) => {
      if (press.current?.pointer === e.pointerId) stop()
    }
    window.addEventListener('keydown', key, true)
    window.addEventListener('pointerup', lost)
    window.addEventListener('pointercancel', lost)
    return () => {
      window.removeEventListener('keydown', key, true)
      window.removeEventListener('pointerup', lost)
      window.removeEventListener('pointercancel', lost)
    }
  }, [drag])

  /** Put the ghost under the pointer. It is solid over the canvas, where a release adds the part; faint elsewhere. */
  const place = () => {
    const el = ghost.current
    if (!el) return
    const { x, y } = pointer.current
    el.style.transform = `translate(${x - GHOST.x}px, ${y - GHOST.y}px)`
    el.classList.toggle('away', !canvasPoint(x, y))
  }

  const tile: TileDrag['tile'] = (part) => ({
    onClick: () => {
      if (dragged.current === null) add(part)
    },
    onPointerDown: (e) => {
      if (e.button !== 0 || !e.isPrimary) return
      press.current = { pointer: e.pointerId, type: e.pointerType, from: P(e.clientX, e.clientY), part, dragging: false, left: false }
      // The tile keeps the pointer: its moves and its release come here, wherever it goes.
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // The pointer is already gone.
      }
    },
    onPointerMove: (e) => {
      const p = press.current
      if (!p || p.pointer !== e.pointerId) return
      if (!p.dragging) {
        const what = tilePress(p.type, e.clientX - p.from.x, e.clientY - p.from.y)
        if (what === 'press') return
        if (what === 'scroll') {
          press.current = null // the browser scrolls the list
          return
        }
        p.dragging = true
        dragged.current = p.pointer
        setDrag(p.part)
      }
      pointer.current = P(e.clientX, e.clientY)
      place() // once React has drawn the ghost; until then, the ghost takes its place when it is drawn
      const r = area.current?.getBoundingClientRect()
      if (!p.left && r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) {
        p.left = true
        onLeave?.()
      }
    },
    onPointerUp: (e) => {
      released(e.pointerId) // after a drag, the click that follows in the same task is not a click
      const p = press.current
      if (!p || p.pointer !== e.pointerId) return
      stop()
      if (!p.dragging) return // a click or a tap: the click adds the part
      const at = canvasPoint(e.clientX, e.clientY)
      if (!at) return
      add(p.part, at)
      // The canvas takes the focus, as after Enter in the search box: the keys act on the new part.
      document.getElementById(CANVAS_ID)?.focus({ preventScroll: true })
    },
    // The browser took the press (a finger scrolls the list), or the pointer went: no drop.
    onPointerCancel: (e) => {
      released(e.pointerId)
      if (press.current?.pointer === e.pointerId) stop()
    },
    onLostPointerCapture: (e) => {
      if (press.current?.pointer === e.pointerId) stop()
    },
  })

  const shown = drag && (
    <div
      ref={(el) => {
        ghost.current = el
        place()
      }}
      className="tile-ghost"
      aria-hidden="true"
    >
      <TileFace part={drag} />
    </div>
  )
  return { tile, dragging: !!drag, ghost: shown ? createPortal(shown, document.body) : null }
}
