// transform.ts — where a symbol's local frame sits in the world. Rendering, snapping and hit-testing all use this.

import { P, type Pt } from '../kernel/geom'
import { FLIP_X, mul, rotate, translate, type Mat } from '../kernel/nodes'
import type { SymbolItem } from './types'

export const applyMat = (m: Mat, p: Pt): Pt => P(m[0] * p.x + m[2] * p.y + m[4], m[1] * p.x + m[3] * p.y + m[5])

/** Local frame (origin top-centre of the nominal box) → frame centred on the item, rotated and flipped. */
export function localMatrix(it: Pick<SymbolItem, 'rot' | 'flip' | 'h'>): Mat {
  let m = rotate(it.rot)
  if (it.flip) m = mul(m, FLIP_X)
  return mul(m, translate(0, -it.h / 2))
}

/** Local frame → world. */
export const worldMatrix = (it: SymbolItem): Mat => mul(translate(it.x, it.y), localMatrix(it))

/** A point in a symbol's local frame → world. */
export const toWorld = (it: SymbolItem, p: Pt): Pt => applyMat(worldMatrix(it), p)

/** A world point → the symbol's local frame. */
export function toLocal(it: SymbolItem, p: Pt): Pt {
  const [a, b, c, d, e, f] = worldMatrix(it)
  const det = a * d - b * c
  const x = p.x - e,
    y = p.y - f
  return P((d * x - c * y) / det, (-b * x + a * y) / det)
}
