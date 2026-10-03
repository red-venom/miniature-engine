// touch.ts — what a finger needs beyond what a mouse does (section 12, "Touch"). The canvas works with pointer events
// only, so a finger and a pen press, drag and release as the mouse does. Two fingers pinch and pan (`pinchView` in
// view.ts), handles have a larger hit area on a coarse pointer, and a double tap does what a double-click does: the
// canvas finds it from the pointer events, so it does not depend on the browser making a dblclick of two taps. Pure.

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
