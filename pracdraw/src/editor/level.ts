// level.ts — the maths of the level handle (section 9): where the top surface of a cavity's contents is in the world,
// and what fraction of the cavity a pointer height means. Pure, so it is unit-tested.
// The surface is in the world-oriented frame of the kernel (`orient` in src/kernel/contents.ts): the cavity turned and
// flipped about the centre of the nominal box, with the item's centre as origin. The renderer draws the contents in
// the same frame, so the handle sits on the drawn surface, which is level for any rotation or flip.

import { orient } from '../kernel/contents'
import { P, bounds, scan, type Box, type Pt } from '../kernel/geom'
import { filledAmount, topLayerIndex } from '../model/contents'
import type { SymbolItem } from '../model/types'
import { geometry } from '../symbols/registry'

export interface Surface {
  cavity: string
  /** How full the cavity is, 0 to 1: the layers that are not a gas. */
  filled: number
  /** The left and the right end of the top surface, in the world. The handle sits at the right end. */
  left: Pt
  right: Pt
}

/** A cavity in the world-oriented frame, relative to the item's centre, and its box. */
function oriented(it: SymbolItem, polys: Pt[][]): { W: Pt[][]; box: Box } {
  const W = orient(polys, { rot: it.rot, flip: it.flip, pivot: P(0, it.h / 2) })
  return { W, box: bounds(W.flat()) }
}

/** One surface for each cavity that holds a layer that is not a gas: the cavities that get a level handle. */
export function surfaces(it: SymbolItem): Surface[] {
  const out: Surface[] = []
  for (const cav of geometry(it.symbol, it.w, it.h, it.params).cavities ?? []) {
    const layers = it.contents[cav.id] ?? []
    if (topLayerIndex(layers) < 0) continue
    const { W, box } = oriented(it, cav.polys)
    const filled = filledAmount(layers)
    const y = box.y1 - filled * (box.y1 - box.y0)
    // The kernel scans just under the level. Stay inside the box, so that an empty or a full cavity has a span too.
    // A level that crosses no part of the cavity (a jacket half full: the line runs through the inner tube) puts the
    // handle at the right edge of the cavity.
    const spans = scan(W, Math.min(box.y1 - 1e-3, Math.max(box.y0 + 1e-3, y + 1e-6)))
    const x0 = spans.length ? spans[0][0] : box.x1
    const x1 = spans.length ? spans[spans.length - 1][1] : box.x1
    out.push({ cavity: cav.id, filled, left: P(it.x + x0, it.y + y), right: P(it.x + x1, it.y + y) })
  }
  return out
}

/** The fraction of the cavity, 0 to 1, below a world height: where a dragged level handle puts the top surface. */
export function filledAt(it: SymbolItem, cavity: string, pointer: Pt): number | null {
  const cav = geometry(it.symbol, it.w, it.h, it.params).cavities?.find((c) => c.id === cavity)
  if (!cav) return null
  const { box } = oriented(it, cav.polys)
  const H = box.y1 - box.y0
  if (!(H > 0)) return null
  return Math.min(1, Math.max(0, (box.y1 - (pointer.y - it.y)) / H))
}
