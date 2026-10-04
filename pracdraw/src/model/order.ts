// order.ts — the order rule of section 12: after a symbol is added or moved, if its centre lies inside a cavity of a
// symbol that is above it in the draw order, it moves to just above that symbol. So a thermometer dropped into a
// beaker is never hidden by the beaker. Pure.

import { P, scan, type Pt } from '../kernel/geom'
import { geometry } from '../symbols/registry'
import { toLocal } from './transform'
import type { Doc, Id, SymbolItem } from './types'

/** True when a world point lies inside one of the symbol's cavities (even–odd rule). */
export function insideCavity(it: SymbolItem, p: Pt): boolean {
  const cavities = geometry(it.symbol, it.w, it.h, it.params).cavities
  if (!cavities?.length) return false
  const l = toLocal(it, p)
  return cavities.some((c) => scan(c.polys, l.y).some(([x0, x1]) => l.x >= x0 && l.x <= x1))
}

/**
 * Apply the order rule to the symbols among `ids` (the items just added or moved). Each one moves to just above the
 * topmost symbol whose cavity holds its centre. Items in `ids` are not targets, so a set that moves together keeps its
 * own order. Returns the same document when nothing moves.
 */
export function orderRule(doc: Doc, ids: readonly Id[]): Doc {
  const moving = new Set(ids)
  let order = doc.order
  for (const id of ids) {
    const it = doc.items[id]
    if (!it || it.type !== 'symbol') continue
    const i = order.indexOf(id)
    if (i < 0) continue
    const centre = P(it.x, it.y)
    let target = -1
    for (let j = order.length - 1; j > i; j--) {
      const o = doc.items[order[j]]
      if (!o || o.type !== 'symbol' || moving.has(o.id)) continue
      if (insideCavity(o, centre)) {
        target = j
        break
      }
    }
    if (target < 0) continue
    const next = [...order]
    next.splice(i, 1)
    next.splice(target, 0, id)
    order = next
  }
  return order === doc.order ? doc : { ...doc, order }
}
