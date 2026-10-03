// commands.ts — every change to a document. Each command is pure: (doc, arguments) => doc.
// A command never mutates its input: it returns a new document that shares every unchanged item.
// Event handlers only call commands. Unit tests run them without React or a DOM.

import { P, type Pt } from '../kernel/geom'
import { defaultParams, hasSymbol, symbolDef } from '../symbols/registry'
import { boxCentre, itemsBox } from './bounds'
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
 * Otherwise its items get new ids and are centred on `at`.
 */
export function insertTemplate(doc: Doc, tpl: Doc, at: Pt, gen: IdGen = newId): Doc {
  if (doc.order.length === 0) return { ...tpl, settings: { ...tpl.settings } }
  const copies = cloneItems(live(tpl, tpl.order), gen)
  const box = itemsBox(tpl, tpl.order)
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

export function reorderItems(doc: Doc, ids: readonly Id[], how: Arrange): Doc {
  const set = new Set(ids)
  const order = [...doc.order]
  if (how === 'front' || how === 'back') {
    const chosen = order.filter((id) => set.has(id)),
      rest = order.filter((id) => !set.has(id))
    const next = how === 'front' ? [...rest, ...chosen] : [...chosen, ...rest]
    return next.every((id, i) => id === order[i]) ? doc : withItems(doc, doc.items, next)
  }
  let changed = false
  if (how === 'forward') {
    for (let i = order.length - 2; i >= 0; i--) {
      if (set.has(order[i]) && !set.has(order[i + 1])) {
        ;[order[i], order[i + 1]] = [order[i + 1], order[i]]
        changed = true
      }
    }
  } else {
    for (let i = 1; i < order.length; i++) {
      if (set.has(order[i]) && !set.has(order[i - 1])) {
        ;[order[i], order[i - 1]] = [order[i - 1], order[i]]
        changed = true
      }
    }
  }
  return changed ? withItems(doc, doc.items, order) : doc
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
