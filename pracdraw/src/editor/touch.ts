// touch.ts — what a finger needs beyond what a mouse does (section 12, "Touch"). The canvas works with pointer events
// only, so a finger and a pen press, drag and release as the mouse does. Two fingers pinch and pan (`pinchView` in
// view.ts), handles have a larger hit area on a coarse pointer, and a double tap does what a double-click does: the
// canvas finds it from the pointer events, so it does not depend on the browser making a dblclick of two taps. A tile
// of the library is dragged to the canvas with pointer events too (`tilePress`). Pure.

import type { Pt } from '../kernel/geom'

/** The media query of a pointer that is not precise, such as a finger: handles then get a larger hit area. */
export const COARSE = '(pointer: coarse)'
/** The hit area of a handle on a coarse pointer: a circle this many screen px across. */
export const HIT_PX = 28
/** A touch or a pen that moves less than this, in screen px, between press and release is a tap. */
export const TAP_PX = 10
/** Two taps at most this far apart in time (ms) and in place (screen px) make a double tap. */
export const DOUBLE_TAP_MS = 400
export const DOUBLE_TAP_PX = 24

/** A tap: when it ended (an event time stamp, ms) and where (page px). */
export interface Tap {
  t: number
  p: Pt
}

/** True when `second` comes soon enough after `first`, and near enough to it, to make a double tap. */
export function isDoubleTap(first: Tap | null, second: Tap): boolean {
  if (!first) return false
  const dt = second.t - first.t
  return dt >= 0 && dt <= DOUBLE_TAP_MS && Math.hypot(second.p.x - first.p.x, second.p.y - first.p.y) <= DOUBLE_TAP_PX
}

/** True when a press that went down at `down` and came up at `up` (page px) is a tap, not a drag. */
export const isTap = (down: Pt, up: Pt): boolean => Math.hypot(up.x - down.x, up.y - down.y) < TAP_PX

/** A press on a library tile becomes a drag of the tile when it has moved this far, in screen px: a mouse, a finger. */
export const TILE_DRAG_PX = { mouse: 4, touch: 8 } as const

/**
 * What a press on a library tile is, once it has moved (dx, dy) screen px from where it went down:
 * - 'press': not far enough yet. It is still a click, or a tap, if it comes up now.
 * - 'drag': the tile is dragged to the canvas. A mouse drags in any direction. A finger or a pen drags only when it
 *   moves mostly sideways: the list scrolls up and down, so a move that is mostly up or down belongs to the browser.
 * - 'scroll': a finger or a pen moved mostly up or down. The browser scrolls the list (the tiles allow only that,
 *   `touch-action: pan-y`) and cancels the pointer; the press is over.
 */
export function tilePress(pointerType: string, dx: number, dy: number): 'press' | 'drag' | 'scroll' {
  const mouse = pointerType === 'mouse'
  if (Math.hypot(dx, dy) < (mouse ? TILE_DRAG_PX.mouse : TILE_DRAG_PX.touch)) return 'press'
  return mouse || Math.abs(dx) > Math.abs(dy) ? 'drag' : 'scroll'
}
