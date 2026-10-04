// autoLabel.ts — "Label all" (section 11 of the specification): a label for every symbol that has none, in two columns
// beside the diagram. The eight steps of the specification, in order; the step numbers are in the comments. Pure.

import type { Box, Pt } from '../kernel/geom'
import { geometry, hasSymbol, labelText, symbolDef } from '../symbols/registry'
import { labelPoint } from '../symbols/label'
import { itemsBox } from './bounds'
import { insertItems, newId, type IdGen } from './commands'
import { isFixed, leaderStart, makeLabel } from './labels'
import { toWorld } from './transform'
import type { Doc, Id, LabelItem, SymbolItem } from './types'

/** The text anchors are this far outside the bounds of the diagram, in units (step 6). */
export const LABEL_GAP = 40
/** Two text anchors in one column are at least this many times the label size apart (step 7). */
export const LABEL_SPACING = 1.4

/** True when the segments a–b and c–d cross: they meet at a point inside both. Touching at an end is not a crossing. */
export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const side = (p: Pt, q: Pt, r: Pt) => {
    const v = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
    // A tolerance that grows with the lengths involved, so that rounding noise is never a crossing.
    const tol = 1e-9 * (Math.abs(q.x - p.x) + Math.abs(q.y - p.y)) * (Math.abs(r.x - p.x) + Math.abs(r.y - p.y))
    return v > tol ? 1 : v < -tol ? -1 : 0
  }
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0
}

/** A new label and where its leader ends in the world. */
export interface Placed {
  label: LabelItem
  target: Pt
}

/** Step 1: the symbols to label, in draw order. */
function toLabel(doc: Doc): SymbolItem[] {
  const fixed = new Set<Id>()
  for (const it of Object.values(doc.items)) if (it.type === 'label' && isFixed(it)) fixed.add(it.target.item)
  return doc.order
    .map((id) => doc.items[id])
    .filter((it): it is SymbolItem => it?.type === 'symbol' && hasSymbol(it.symbol) && symbolDef(it.symbol).autoLabel !== false && !fixed.has(it.id))
}

/** Steps 3 to 6 for one symbol. */
function place(it: SymbolItem, B: Box, id: Id): Placed {
  // 3. The side, in the world: left when the symbol's centre is left of the centre of B.
  const side = it.x < (B.x0 + B.x1) / 2 ? 'left' : 'right'
  // 4. The leader point that lies further towards that side, of the symbol's two, in the world.
  const g = geometry(it.symbol, it.w, it.h, it.params)
  const left = labelPoint(g, it.w, it.h, 'left'),
    right = labelPoint(g, it.w, it.h, 'right')
  const wl = toWorld(it, left),
    wr = toWorld(it, right)
  const useLeft = side === 'left' ? wl.x <= wr.x : wl.x > wr.x
  const local = useLeft ? left : right,
    target = useLeft ? wl : wr
  // 5. The text. 6. The text anchor: 40 u outside B on that side, at the target's height.
  const label = makeLabel(
    {
      x: side === 'left' ? B.x0 - LABEL_GAP : B.x1 + LABEL_GAP,
      y: target.y,
      side,
      target: { item: it.id, lx: local.x, ly: local.y },
      text: labelText(symbolDef(it.symbol), it.params),
    },
    id,
  )
  return { label, target }
}

/** Step 7 for one column: no two text anchors closer than 1.4 × the label size, the column centred on its targets. */
export function spaceColumn(column: Placed[], size: number): void {
  const gap = LABEL_SPACING * size
  column.sort((a, b) => a.target.y - b.target.y)
  for (let i = 1; i < column.length; i++) {
    const above = column[i - 1].label.y
    if (column[i].label.y < above + gap) column[i].label.y = above + gap
  }
  const last = column[column.length - 1]
  if (!last) return
  const pushed = last.label.y - last.target.y
  for (const p of column) p.label.y -= pushed / 2
}

/** The most swaps step 8 makes. Each swap shortens the leaders, so the loop ends long before; this is a guard only. */
const SWAP_LIMIT = 10_000

/** Step 8 for one column: while two leaders cross, swap the heights of their two text anchors. */
export function uncrossColumn(column: Placed[], size: number): void {
  const cross = (a: Placed, b: Placed) => segmentsCross(leaderStart(a.label, size), a.target, leaderStart(b.label, size), b.target)
  let swaps = 0
  for (let again = true; again && swaps < SWAP_LIMIT;) {
    again = false
    for (let i = 0; i < column.length; i++) {
      for (let j = i + 1; j < column.length; j++) {
        if (!cross(column[i], column[j])) continue
        const y = column[i].label.y
        column[i].label.y = column[j].label.y
        column[j].label.y = y
        again = true
        swaps++
      }
    }
  }
}

/**
 * The labels that "Label all" adds: one for each symbol that has no label fixed to it, unless its definition says no
 * automatic label or its symbol id is unknown. They come in reading order, down the left column and then down the
 * right one, so that in letters mode (A, B, C … in draw order) the letters read down each column.
 */
export function autoLabels(doc: Doc, gen: IdGen = newId): LabelItem[] {
  const symbols = toLabel(doc)
  if (!symbols.length) return []
  // 2. B: the bounds of all items that are not labels.
  const B = itemsBox(
    doc,
    doc.order.filter((id) => doc.items[id] && doc.items[id].type !== 'label'),
  )
  if (!B) return []
  const size = doc.settings.labelSize
  const placed = symbols.map((it) => place(it, B, gen()))
  const columns = (['left', 'right'] as const).map((side) => {
    const column = placed.filter((p) => p.label.side === side)
    spaceColumn(column, size)
    uncrossColumn(column, size)
    return column.map((p) => p.label).sort((a, b) => a.y - b.y)
  })
  return columns.flat()
}

/** "Label all": the labels of `autoLabels` added on top, as one change (so one undo step). */
export function autoLabel(doc: Doc, gen: IdGen = newId): Doc {
  const labels = autoLabels(doc, gen)
  return labels.length ? insertItems(doc, labels) : doc
}
