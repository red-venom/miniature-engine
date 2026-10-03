// thumbs.ts — render nodes and view boxes for library thumbnails. Pure; the components draw them.

import type { Node } from '../kernel/nodes'
import { docBox, localBox } from '../model/bounds'
import { DEFAULT_SETTINGS, type Doc } from '../model/types'
import { docNodes, symbolNode } from '../render/render'
import { geometry } from '../symbols/registry'
import type { SymbolDef } from '../symbols/types'

export interface Thumb {
  nodes: Node[]
  viewBox: string
}

const symbolThumbs = new Map<string, Thumb>()

/** The symbol at its default size, in a square view box round its drawing. Cached by symbol id. */
export function symbolThumb(def: SymbolDef): Thumb {
  let t = symbolThumbs.get(def.id)
  if (t) return t
  const { w, h } = def.size
  const b = localBox(geometry(def.id, w, h))
  const size = Math.max(b.x1 - b.x0, b.y1 - b.y0) + 6
  const cx = (b.x0 + b.x1) / 2,
    cy = (b.y0 + b.y1) / 2 - h / 2
  t = {
    nodes: [symbolNode({ id: def.id, type: 'symbol', symbol: def.id, x: 0, y: 0, rot: 0, flip: false, w, h, params: {}, contents: {} }, DEFAULT_SETTINGS)],
    viewBox: `${cx - size / 2} ${cy - size / 2} ${size} ${size}`,
  }
  symbolThumbs.set(def.id, t)
  return t
}

/** A whole document in a view box of the given aspect ratio, centred on the drawing. */
export function docThumb(doc: Doc, aspect: number): Thumb {
  const b = docBox(doc) ?? { x0: 0, y0: 0, x1: 100, y1: 100 }
  let w = b.x1 - b.x0 + 16,
    h = b.y1 - b.y0 + 16
  if (w / h < aspect) w = h * aspect
  else h = w / aspect
  const cx = (b.x0 + b.x1) / 2,
    cy = (b.y0 + b.y1) / 2
  return { nodes: docNodes(doc), viewBox: `${cx - w / 2} ${cy - h / 2} ${w} ${h}` }
}
