// shapes.ts — the commands for rectangles and ellipses (section 12 of the specification: the Rectangle and Ellipse
// tools and the shape inspector). Each command is pure: (doc, arguments) => doc, and gives the same document when
// nothing changes. Resize and rotate handles use setSize and setRotation in commands.ts, as for a symbol.

import type { Pt } from '../kernel/geom'
import { addItem, newId, normRot } from './commands'
import type { Doc, Id, ShapeItem } from './types'

export type ShapeKind = ShapeItem['shape']
export type ShapeFill = ShapeItem['fill']

export const SHAPE_FILLS: readonly ShapeFill[] = ['none', 'paper', 'grey']

/** A shape's centre and size in units. */
export interface ShapeBox {
  x: number
  y: number
  w: number
  h: number
}

/** A new shape: no fill, not dashed, upright. It is at least 1 u each way. */
export function makeShape(shape: ShapeKind, box: ShapeBox, id: Id = newId()): ShapeItem {
  return { id, type: 'shape', shape, x: box.x, y: box.y, w: Math.max(1, box.w), h: Math.max(1, box.h), rot: 0, fill: 'none', dash: false }
}

/** Add a shape on top. */
export const addShape = (doc: Doc, shape: ShapeKind, box: ShapeBox, id: Id = newId()): Doc => addItem(doc, makeShape(shape, box, id))

/**
 * The box that a drag from `a` to `b` draws, in any direction. With `square` both sides take the longer one, measured
 * from `a` towards the pointer, so the drawn square or circle keeps the corner where the drag began.
 */
export function dragBox(a: Pt, b: Pt, square = false): ShapeBox {
  let dx = b.x - a.x,
    dy = b.y - a.y
  if (square) {
    const s = Math.max(Math.abs(dx), Math.abs(dy))
    dx = (dx < 0 ? -1 : 1) * s
    dy = (dy < 0 ? -1 : 1) * s
  }
  return { x: a.x + dx / 2, y: a.y + dy / 2, w: Math.max(1, Math.abs(dx)), h: Math.max(1, Math.abs(dy)) }
}

export interface ShapePatch {
  shape?: ShapeKind
  fill?: ShapeFill
  dash?: boolean
  /** The size keeps the centre where it is. */
  w?: number
  h?: number
  /** Degrees clockwise; kept in [0, 360). */
  rot?: number
}

/** Change the fields of a shape (the inspector). A fill that is not none, paper or grey, and a size below 1 u, are not taken. */
export function setShape(doc: Doc, id: Id, patch: ShapePatch): Doc {
  const it = doc.items[id]
  if (!it || it.type !== 'shape') return doc
  const next: ShapeItem = { ...it }
  if (patch.shape === 'rect' || patch.shape === 'ellipse') next.shape = patch.shape
  if (patch.fill && SHAPE_FILLS.includes(patch.fill)) next.fill = patch.fill
  if (typeof patch.dash === 'boolean') next.dash = patch.dash
  if (patch.w !== undefined && Number.isFinite(patch.w)) next.w = Math.max(1, patch.w)
  if (patch.h !== undefined && Number.isFinite(patch.h)) next.h = Math.max(1, patch.h)
  if (patch.rot !== undefined && Number.isFinite(patch.rot)) next.rot = normRot(patch.rot)
  const same = next.shape === it.shape && next.fill === it.fill && next.dash === it.dash && next.w === it.w && next.h === it.h && next.rot === it.rot
  return same ? doc : { ...doc, items: { ...doc.items, [id]: next } }
}
