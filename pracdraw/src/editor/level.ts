// level.ts — the maths of the level handle (section 9): where the top surface of a cavity's contents is, in the
// world, and what fraction of the cavity a pointer height means. Pure, so it is unit-tested.
// The surface is in the world-oriented frame of the kernel (`orient`): the cavity turned and flipped about the
// centre of the nominal box, with the item's centre as origin. Rendering uses the same frame.

import { orient } from '../kernel/contents'
import { P, bounds, scan, type Box, type Pt } from '../kernel/geom'
import { filledAmount, topLayerIndex } from '../model/contents'
import type { SymbolItem } from '../model/types'
import { geometry } from '../symbols/registry'

export interface Surface {
  cavity: string
  /** The oriented cavity's box, relative to the item's centre. */
  box: Box
  /** How full the cavity is, 0 to 1 (the layers that are not a gas). */
  filled: number
  /** The right end of the top surface, in the world: where the handle sits. */
  handle: Pt
}

const orientedBox = (it: SymbolItem, polys: Pt[][]): Box => bounds(orient(polys, { rot: it.rot, flip: it.flip, pivot: P(0, it.h / 2) }).flat())

/** One surface for each cavity that holds a layer that is not a gas. */
export function surfaces(it: SymbolItem): Surface[] {
  const out: Surface[] = []
  for (const cav of geometry(it.symbol, it.w, it.h, it.params).cavities ?? []) {
    const layers = it.contents[cav.id]
    if (!layers?.length || topLayerIndex(layers) < 0) continue
    const W = orient(cav.polys, { rot: it.rot, flip: it.flip, pivot: P(0, it.h / 2) })
    const box = bounds(W.flat())
    const filled = filledAmount(layers)
    const y = box.y1 - filled * (box.y1 - box.y0)
    // The surface line is scanned just under the level, as the kernel does. An empty or a full cavity has no span.
    const spans = scan(W, Math.min(box.y1 - 1e-6, Math.max(box.y0 + 1e-6, y + 1e-6)))
    const right = spans.length ? spans[spans.length - 1][1] : box.x1
    out.push({ cavity: cav.id, box, filled, handle: P(it.x + right, it.y + y) })
  }
  return out
}

/** The fraction of the cavity that a pointer at this world height fills, 0 to 1. */
export function filledAt(it: SymbolItem, cavity: string, pointer: Pt): number | null {
  const cav = geometry(it.symbol, it.w, it.h, it.params).cavities?.find((c) => c.id === cavity)
  if (!cav) return null
  const b = orientedBox(it, cav.polys)
  const H = b.y1 - b.y0
  if (H <= 0) return null
  return Math.min(1, Math.max(0, (b.y1 - (pointer.y - it.y)) / H))
}
