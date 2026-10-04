// commands.ts — every change to a document. Each command is pure: (doc, arguments) => doc.
// A command never mutates its input: it returns a new document that shares every unchanged item.
// Event handlers only call commands. Unit tests run them without React or a DOM.

import { P, type Box, type Pt } from '../kernel/geom'
import { defaultParams, hasSymbol, symbolDef } from '../symbols/registry'
import { boxCentre, estimateWidth, itemBox, itemsBox, labelBox, unionBox, type Measure } from './bounds'
import { toWorld } from './transform'
import type { Doc, DocSettings, Id, Item, LabelItem, ParamValue, SymbolItem } from './types'

export type IdGen = () => Id

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/** A new item id: 8 characters of base 36 from `crypto.getRandomValues` (section 7, rule 3). */
export function newId(): Id {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += ALPHABET[b % 36]
  return s
}

export const normRot = (r: number): number => ((r % 360) + 360) % 360

const withItems = (doc: Doc, items: Record<Id, Item>, order = doc.order): Doc => ({ ...doc, items, order })

function patchItem<T extends Item>(doc: Doc, id: Id, fn: (it: T) => T): Doc {
  const it = doc.items[id] as T | undefined
  if (!it) return doc
  const next = fn(it)
  return next === it ? doc : withItems(doc, { ...doc.items, [id]: next })
}

const live = (doc: Doc, ids: readonly Id[]): Item[] => ids.map((id) => doc.items[id]).filter((it): it is Item => !!it)

// ---------------------------------------------------------------- add and insert

/** Add one item on top. An id that is already used is replaced in place. */
export function addItem(doc: Doc, it: Item): Doc {
  const order = doc.items[it.id] ? doc.order : [...doc.order, it.id]
  return withItems(doc, { ...doc.items, [it.id]: it }, order)
}

/** A symbol item at its default size, centred on a world point. */
export function makeSymbol(symbol: string, x: number, y: number, id: Id = newId()): SymbolItem {
  const def = symbolDef(symbol)
  return { id, type: 'symbol', symbol, x, y, rot: 0, flip: false, w: def.size.w, h: def.size.h, params: {}, contents: {} }
}

export const addSymbol = (doc: Doc, symbol: string, x: number, y: number, id: Id = newId()): Doc => addItem(doc, makeSymbol(symbol, x, y, id))

/** Every item moved by (dx, dy). A label fixed to an item keeps its target: the target follows the item. */
export function shiftItems(items: readonly Item[], dx: number, dy: number): Item[] {
  if (!dx && !dy) return [...items]
  return items.map((it) => {
    if (it.type === 'connector') return { ...it, points: it.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) }
    const moved = { ...it, x: it.x + dx, y: it.y + dy }
    if (moved.type === 'label' && moved.target && !('item' in moved.target)) moved.target = { x: moved.target.x + dx, y: moved.target.y + dy }
    return moved
  })
}

/**
 * Copies of a set of items with new ids (section 7, rule 4). Label targets and group ids that point into the set are
 * rewritten. A label whose target item is not in the set keeps its target.
 */
export function cloneItems(items: readonly Item[], gen: IdGen = newId): Item[] {
  const ids = new Map<Id, Id>()
  for (const it of items) ids.set(it.id, gen())
  const groups = new Map<Id, Id>()
  return items.map((it) => {
    const copy: Item = { ...it, id: ids.get(it.id)! }
    if (it.group) {
      if (!groups.has(it.group)) groups.set(it.group, gen())
      copy.group = groups.get(it.group)
    }
    if (copy.type === 'label' && copy.target && 'item' in copy.target) {
      const t = ids.get(copy.target.item)
      if (t) copy.target = { ...copy.target, item: t }
    }
    return copy
  })
}

/** Add items on top, moved by (dx, dy). The ids must be new: use `cloneItems` for items that come from outside. */
export function insertItems(doc: Doc, items: readonly Item[], dx = 0, dy = 0): Doc {
  const moved = shiftItems(items, dx, dy)
  const next = { ...doc.items }
  for (const it of moved) next[it.id] = it
  return withItems(doc, next, [...doc.order, ...moved.map((it) => it.id)])
}

/**
 * Insert a template. Into an empty diagram it becomes the whole diagram and keeps its ids and title.
 * Otherwise its items get new ids and the box of its drawing (labels measured with `measure`) is centred on `at`.
 */
export function insertTemplate(doc: Doc, tpl: Doc, at: Pt, gen: IdGen = newId, measure: Measure = estimateWidth): Doc {
  if (doc.order.length === 0) return { ...tpl, settings: { ...tpl.settings } }
  const copies = cloneItems(live(tpl, tpl.order), gen)
  const box = itemsBox(tpl, tpl.order, measure)
  const c = box ? boxCentre(box) : P(0, 0)
  return insertItems(doc, copies, at.x - c.x, at.y - c.y)
}

/** Copies of items on top, moved by (dx, dy). The new ids are the tail of `order`. */
export function duplicateItems(doc: Doc, ids: readonly Id[], dx: number, dy: number, gen: IdGen = newId): Doc {
  const set = new Set(ids)
  const items = live(
    doc,
    doc.order.filter((id) => set.has(id)),
  )
  if (!items.length) return doc
  return insertItems(doc, cloneItems(items, gen), dx, dy)
}

// ---------------------------------------------------------------- move, delete, order

export function moveItems(doc: Doc, ids: readonly Id[], dx: number, dy: number): Doc {
  if (!dx && !dy) return doc
  const next = { ...doc.items }
  for (const it of shiftItems(live(doc, ids), dx, dy)) next[it.id] = it
  return withItems(doc, next)
}

/** Delete items. A label target fixed to a deleted item becomes the free point where it last was. */
export function deleteItems(doc: Doc, ids: readonly Id[]): Doc {
  const gone = new Set(ids.filter((id) => doc.items[id]))
  if (!gone.size) return doc
  const next: Record<Id, Item> = {}
  for (const [id, it] of Object.entries(doc.items)) {
    if (gone.has(id)) continue
    if (it.type === 'label' && it.target && 'item' in it.target && gone.has(it.target.item)) {
      const owner = doc.items[it.target.item]
      const p = owner?.type === 'symbol' ? toWorld(owner, P(it.target.lx, it.target.ly)) : null
      next[id] = p ? { ...it, target: { x: p.x, y: p.y } } : { ...it, target: undefined }
    } else next[id] = it
  }
  return withItems(
    doc,
    next,
    doc.order.filter((id) => !gone.has(id)),
  )
}

export type Arrange = 'front' | 'forward' | 'backward' | 'back'

/**
 * Bring to front, Forward, Backward, Send to back (section 12). Forward and Backward take each item one step past the
 * next item that is not chosen. Labels are always drawn after every other item, so the step is past an item drawn in
 * the same pass: a symbol, connector or shape steps past the next of those, and a label past the next label. Chosen
 * items keep their own order.
 */
export function reorderItems(doc: Doc, ids: readonly Id[], how: Arrange): Doc {
  const set = new Set(ids)
  const order = [...doc.order]
  if (how === 'front' || how === 'back') {
    const chosen = order.filter((id) => set.has(id)),
      rest = order.filter((id) => !set.has(id))
    const next = how === 'front' ? [...rest, ...chosen] : [...chosen, ...rest]
    return next.every((id, i) => id === order[i]) ? doc : withItems(doc, doc.items, next)
  }
  const isLabel = (id: Id) => doc.items[id]?.type === 'label'
  /** The next item from i in the step `dir` that is not chosen and is drawn in the same pass, or −1. */
  const passed = (i: number, dir: 1 | -1) => {
    const label = isLabel(order[i])
    for (let k = i + dir; k >= 0 && k < order.length; k += dir) if (!set.has(order[k]) && isLabel(order[k]) === label) return k
    return -1
  }
  let changed = false
  const start = how === 'forward' ? order.length - 2 : 1,
    dir = how === 'forward' ? 1 : -1
  for (let i = start; i >= 0 && i < order.length; i -= dir) {
    if (!set.has(order[i])) continue
    const k = passed(i, dir)
    if (k < 0) continue
    const [id] = order.splice(i, 1)
    order.splice(k, 0, id)
    changed = true
  }
  return changed ? withItems(doc, doc.items, order) : doc
}

// ---------------------------------------------------------------- align and distribute (several items)

export type Align = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom'
export type Distribute = 'across' | 'down'

/** A set of items that align and distribute as one: the items of one group, or one item that is in no group. */
export interface Unit {
  ids: Id[]
  /** The union of the items' drawn bounds. A label counts without its leader, which can end on an item that stays. */
  box: Box
}

/**
 * The items as units, in draw order of the first item of each. A label's text is measured with `measure`: as drawn
 * (canvas measureText) in the browser, the estimate in Node.
 */
export function arrangeUnits(doc: Doc, ids: readonly Id[], measure: Measure = estimateWidth): Unit[] {
  const set = new Set(ids)
  const units = new Map<string, Unit>()
  for (const id of doc.order) {
    const it = doc.items[id]
    if (!it || !set.has(id)) continue
    const key = it.group ? `group ${it.group}` : `item ${id}`
    const box = it.type === 'label' ? labelBox(doc, it, measure) : itemBox(doc, it, measure)
    const u = units.get(key)
    if (u) {
      u.ids.push(id)
      u.box = unionBox(u.box, box)!
    } else units.set(key, { ids: [id], box })
  }
  return [...units.values()]
}

/** Move each unit by its own offset, sharing what does not move. The same document when nothing moves. */
function moveUnits(doc: Doc, moves: { unit: Unit; dx: number; dy: number }[]): Doc {
  let next: Record<Id, Item> | null = null
  for (const { unit, dx, dy } of moves) {
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) continue
    next ??= { ...doc.items }
    for (const it of shiftItems(live(doc, unit.ids), dx, dy)) next[it.id] = it
  }
  return next ? withItems(doc, next) : doc
}

/**
 * Align several items (section 12): the left, centre or right, or the top, middle or bottom of their drawn bounds go
 * to that of the bounds of them all. A group moves as one. `measure` gives the drawn width of a label's text.
 */
export function alignItems(doc: Doc, ids: readonly Id[], how: Align, measure: Measure = estimateWidth): Doc {
  const units = arrangeUnits(doc, ids, measure)
  if (units.length < 2) return doc
  const all = units.reduce<Box>((b, u) => unionBox(b, u.box)!, units[0].box)
  const to = (b: Box): Pt => {
    switch (how) {
      case 'left':
        return P(all.x0 - b.x0, 0)
      case 'centre':
        return P((all.x0 + all.x1 - b.x0 - b.x1) / 2, 0)
      case 'right':
        return P(all.x1 - b.x1, 0)
      case 'top':
        return P(0, all.y0 - b.y0)
      case 'middle':
        return P(0, (all.y0 + all.y1 - b.y0 - b.y1) / 2)
      case 'bottom':
        return P(0, all.y1 - b.y1)
    }
  }
  return moveUnits(
    doc,
    units.map((unit) => ({ unit, dx: to(unit.box).x, dy: to(unit.box).y })),
  )
}

/**
 * Distribute several items (section 12), across or down: equal gaps between their drawn bounds. The first and the
 * last, by centre, stay where they are. A group moves as one. It takes three units or more. `measure` gives the drawn
 * width of a label's text.
 */
export function distributeItems(doc: Doc, ids: readonly Id[], how: Distribute, measure: Measure = estimateWidth): Doc {
  const units = arrangeUnits(doc, ids, measure)
  if (units.length < 3) return doc
  const lo = (b: Box) => (how === 'across' ? b.x0 : b.y0),
    hi = (b: Box) => (how === 'across' ? b.x1 : b.y1)
  const sorted = [...units].sort((a, b) => lo(a.box) + hi(a.box) - lo(b.box) - hi(b.box))
  const first = sorted[0],
    last = sorted[sorted.length - 1],
    inner = sorted.slice(1, -1)
  const gap = (lo(last.box) - hi(first.box) - inner.reduce((sum, u) => sum + hi(u.box) - lo(u.box), 0)) / (sorted.length - 1)
  let at = hi(first.box) + gap
  const moves = inner.map((unit) => {
    const d = at - lo(unit.box)
    at += hi(unit.box) - lo(unit.box) + gap
    return { unit, dx: how === 'across' ? d : 0, dy: how === 'down' ? d : 0 }
  })
  return moveUnits(doc, moves)
}

// ---------------------------------------------------------------- size, rotation, flip

export interface SizeArgs {
  w: number
  h: number
  /** The new centre. Absent = unchanged. */
  x?: number
  y?: number
}

/**
 * Resize a symbol or a shape. A symbol never goes below its `min`. Labels fixed to a symbol keep their part:
 * `lx` and `ly` scale with the box (section 7, rule 2).
 */
export function setSize(doc: Doc, id: Id, size: SizeArgs): Doc {
  const it = doc.items[id]
  if (!it || (it.type !== 'symbol' && it.type !== 'shape')) return doc
  let { w, h } = size
  if (it.type === 'symbol' && hasSymbol(it.symbol)) {
    const min = symbolDef(it.symbol).min
    if (min) {
      w = Math.max(min.w, w)
      h = Math.max(min.h, h)
    }
  }
  w = Math.max(1, w)
  h = Math.max(1, h)
  const x = size.x ?? it.x,
    y = size.y ?? it.y
  if (w === it.w && h === it.h && x === it.x && y === it.y) return doc
  const next: Record<Id, Item> = { ...doc.items, [id]: { ...it, w, h, x, y } }
  if (it.type === 'symbol') {
    const kx = w / it.w,
      ky = h / it.h
    for (const other of Object.values(doc.items)) {
      if (other.type === 'label' && other.target && 'item' in other.target && other.target.item === id) {
        next[other.id] = { ...other, target: { item: id, lx: other.target.lx * kx, ly: other.target.ly * ky } }
      }
    }
  }
  return withItems(doc, next)
}

export function setRotation(doc: Doc, id: Id, rot: number): Doc {
  return patchItem<Item>(doc, id, (it) => {
    if (it.type !== 'symbol' && it.type !== 'shape') return it
    const r = normRot(rot)
    return r === it.rot ? it : { ...it, rot: r }
  })
}

const turn = (p: Pt, about: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    dx = p.x - about.x,
    dy = p.y - about.y
  return P(about.x + dx * c - dy * s, about.y + dx * s + dy * c)
}

/** Turn items by `delta` degrees clockwise about a world point. */
export function rotateItems(doc: Doc, ids: readonly Id[], delta: number, about: Pt): Doc {
  if (!delta) return doc
  const next = { ...doc.items }
  for (const it of live(doc, ids)) {
    if (it.type === 'connector') {
      next[it.id] = { ...it, points: it.points.map((p) => ({ ...p, ...turn(p, about, delta) })) }
      continue
    }
    const c = turn(it, about, delta)
    if (it.type === 'label') {
      const target = it.target && !('item' in it.target) ? turn(it.target, about, delta) : it.target
      next[it.id] = { ...it, x: c.x, y: c.y, target }
    } else next[it.id] = { ...it, x: c.x, y: c.y, rot: normRot(it.rot + delta) }
  }
  return withItems(doc, next)
}

export function setFlip(doc: Doc, id: Id, flip: boolean): Doc {
  return patchItem<SymbolItem>(doc, id, (it) => (it.type !== 'symbol' || it.flip === flip ? it : { ...it, flip }))
}

/** Mirror items left to right about the vertical line x = cx. A symbol's text stays readable: the renderer never mirrors text. */
export function flipItems(doc: Doc, ids: readonly Id[], cx: number): Doc {
  const next = { ...doc.items }
  for (const it of live(doc, ids)) {
    if (it.type === 'connector') {
      next[it.id] = { ...it, points: it.points.map((p) => ({ ...p, x: 2 * cx - p.x })) }
    } else if (it.type === 'symbol') {
      next[it.id] = { ...it, x: 2 * cx - it.x, rot: normRot(-it.rot), flip: !it.flip }
    } else if (it.type === 'shape') {
      next[it.id] = { ...it, x: 2 * cx - it.x, rot: normRot(-it.rot) }
    } else {
      const target = it.target && !('item' in it.target) ? { x: 2 * cx - it.target.x, y: it.target.y } : it.target
      next[it.id] = { ...it, x: 2 * cx - it.x, side: it.side === 'left' ? 'right' : 'left', target }
    }
  }
  return withItems(doc, next)
}

// ---------------------------------------------------------------- fields

/** Set parameters. Only values that differ from the symbol's defaults are stored. */
export function setParams(doc: Doc, id: Id, patch: Record<string, ParamValue>): Doc {
  return patchItem<SymbolItem>(doc, id, (it) => {
    if (it.type !== 'symbol') return it
    const defaults = hasSymbol(it.symbol) ? defaultParams(symbolDef(it.symbol)) : {}
    const params: Record<string, ParamValue> = { ...it.params }
    for (const [k, v] of Object.entries(patch)) {
      if (k in defaults && defaults[k] === v) delete params[k]
      else params[k] = v
    }
    return { ...it, params }
  })
}

/** Change fields of one item. For the inspector: text, side, size, kind, caps, fill, dash, contents … */
export function setItem<T extends Item>(doc: Doc, id: Id, patch: Partial<Omit<T, 'id' | 'type'>>): Doc {
  return patchItem<T>(doc, id, (it) => ({ ...it, ...patch }))
}

export function setSettings(doc: Doc, patch: Partial<DocSettings>): Doc {
  return { ...doc, settings: { ...doc.settings, ...patch } }
}

export const setTitle = (doc: Doc, title: string): Doc => (title === doc.title ? doc : { ...doc, title })

export function setLocked(doc: Doc, ids: readonly Id[], locked: boolean): Doc {
  const next = { ...doc.items }
  for (const it of live(doc, ids)) next[it.id] = locked ? { ...it, locked: true } : { ...it, locked: undefined }
  return withItems(doc, next)
}

export const unlockAll = (doc: Doc): Doc =>
  setLocked(
    doc,
    doc.order.filter((id) => doc.items[id]?.locked),
    false,
  )

export function groupItems(doc: Doc, ids: readonly Id[], group: Id = newId()): Doc {
  if (ids.length < 2) return doc
  const next = { ...doc.items }
  for (const it of live(doc, ids)) next[it.id] = { ...it, group }
  return withItems(doc, next)
}

export function ungroupItems(doc: Doc, ids: readonly Id[]): Doc {
  const next = { ...doc.items }
  let changed = false
  for (const it of live(doc, ids)) {
    if (!it.group) continue
    next[it.id] = { ...it, group: undefined }
    changed = true
  }
  return changed ? withItems(doc, next) : doc
}

/** Items that share a `group` with any of `ids` join the set. The result keeps draw order. */
export function expandGroups(doc: Doc, ids: readonly Id[]): Id[] {
  const set = new Set(ids.filter((id) => doc.items[id]))
  const groups = new Set<Id>()
  for (const id of set) {
    const g = doc.items[id]?.group
    if (g) groups.add(g)
  }
  if (groups.size) for (const it of Object.values(doc.items)) if (it.group && groups.has(it.group)) set.add(it.id)
  return doc.order.filter((id) => set.has(id))
}

/** The label items fixed to an item. */
export const labelsOn = (doc: Doc, id: Id): LabelItem[] =>
  Object.values(doc.items).filter((it): it is LabelItem => it.type === 'label' && !!it.target && 'item' in it.target && it.target.item === id)
