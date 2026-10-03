// handles.ts — the maths of the resize and rotate handles. Pure, so it is unit-tested.
// The "frame" of a symbol is its box centred on the item, turned by `rot` and mirrored by `flip`: world = centre + R·F·c.

import { P, type Pt } from '../kernel/geom'
import { FLIP_X, mul, rotate, type Mat } from '../kernel/nodes'
import { applyMat } from '../model/transform'
import type { SizeArgs } from '../model/commands'
import type { SymbolItem } from '../model/types'
import type { ResizeMode } from '../symbols/types'

export type HandleId = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const ROTATE_GAP = 24
export const SNAP_STEP = 15
export const SNAP_WITHIN = 4

/** The handles a resize mode shows. */
export function handlesFor(mode: ResizeMode): HandleId[] {
  switch (mode) {
    case 'free':
      return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
    case 'uniform':
      return ['nw', 'ne', 'se', 'sw']
    case 'width':
      return ['e', 'w']
    case 'height':
      return ['n', 's']
    default:
      return []
  }
}

/** The handle's direction in the frame: −1, 0 or 1 on each axis. */
export function handleDir(h: HandleId): { hx: -1 | 0 | 1; hy: -1 | 0 | 1 } {
  return { hx: h.includes('e') ? 1 : h.includes('w') ? -1 : 0, hy: h.includes('s') ? 1 : h.includes('n') ? -1 : 0 }
}

/** R·F for an item: frame direction → world direction. */
export function frameMatrix(it: Pick<SymbolItem, 'rot' | 'flip'>): Mat {
  const m = rotate(it.rot)
  return it.flip ? mul(m, FLIP_X) : m
}

export const fromFrame = (it: Pick<SymbolItem, 'x' | 'y' | 'rot' | 'flip'>, c: Pt): Pt => {
  const p = applyMat(frameMatrix(it), c)
  return P(it.x + p.x, it.y + p.y)
}

export function toFrame(it: Pick<SymbolItem, 'x' | 'y' | 'rot' | 'flip'>, p: Pt): Pt {
  const [a, b, c, d] = frameMatrix(it)
  const det = a * d - b * c,
    x = p.x - it.x,
    y = p.y - it.y
  return P((d * x - c * y) / det, (-b * x + a * y) / det)
}

/** Where a handle sits in the world. */
export const handlePoint = (it: SymbolItem, h: HandleId): Pt => {
  const { hx, hy } = handleDir(h)
  return fromFrame(it, P((hx * it.w) / 2, (hy * it.h) / 2))
}

/** The rotate handle: `gap` world units above the top centre of the frame. */
export const rotatePoint = (it: SymbolItem, gap: number): Pt => fromFrame(it, P(0, -it.h / 2 - gap))

/**
 * The size and centre after a resize drag. The opposite side or corner stays where it is, in the frame.
 * `uniform` keeps the aspect, and so does Shift on a corner of a `free` symbol. The size never goes below `min`.
 */
export function resizeWith(
  it: SymbolItem,
  mode: ResizeMode,
  min: { w: number; h: number } | undefined,
  handle: HandleId,
  pointer: Pt,
  shift: boolean,
): SizeArgs {
  const { hx, hy } = handleDir(handle)
  const p = toFrame(it, pointer)
  const fixed = P((-hx * it.w) / 2, (-hy * it.h) / 2)
  let w = hx ? Math.max(1, hx * (p.x - fixed.x)) : it.w
  let h = hy ? Math.max(1, hy * (p.y - fixed.y)) : it.h
  const lo = { w: min?.w ?? 1, h: min?.h ?? 1 }
  if (mode === 'uniform' || (shift && hx && hy)) {
    let k = Math.max(w / it.w, h / it.h)
    k = Math.max(k, lo.w / it.w, lo.h / it.h)
    w = it.w * k
    h = it.h * k
  } else {
    w = Math.max(lo.w, w)
    h = Math.max(lo.h, h)
  }
  const c = P(fixed.x + (hx * w) / 2, fixed.y + (hy * h) / 2)
  const centre = fromFrame(it, c)
  return { w, h, x: centre.x, y: centre.y }
}

/** The rotation that puts the handle on the line from the centre to the pointer. */
export function rotationTo(centre: Pt, pointer: Pt): number {
  return (Math.atan2(pointer.y - centre.y, pointer.x - centre.x) * 180) / Math.PI + 90
}

/** Snap to multiples of 15° when within 4°; `force` always snaps. */
export function snapAngle(deg: number, force: boolean): number {
  const near = Math.round(deg / SNAP_STEP) * SNAP_STEP || 0
  return force || Math.abs(deg - near) <= SNAP_WITHIN ? near : deg
}
