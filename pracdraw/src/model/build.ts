// build.ts — make documents in code. Templates use this, so that parts are placed by anchors, not by typed coordinates.

import { P, type Pt, type V } from '../kernel/geom'
import type { Layer } from '../kernel/contents'
import { localMatrix, toWorld } from './transform'
import { geometry, symbolDef } from '../symbols/registry'
import type { Anchor } from '../symbols/types'
import {
  newDoc,
  type Cap,
  type ConnectorItem,
  type ConnectorKind,
  type Doc,
  type Item,
  type LabelItem,
  type ParamValue,
  type SymbolItem,
  type Target,
} from './types'

export function anchorOf(it: SymbolItem, anchorId: string): Anchor {
  const a = geometry(it.symbol, it.w, it.h, it.params).anchors?.find((q) => q.id === anchorId)
  if (!a) throw new Error(`${it.symbol} has no anchor "${anchorId}"`)
  return a
}

/** World position of an anchor. */
export const anchorWorld = (it: SymbolItem, anchorId: string): Pt => {
  const a = anchorOf(it, anchorId)
  return toWorld(it, P(a.x, a.y))
}

/** Move an item so that its anchor lands on a world point. Snapping uses the same sum. */
export function moveAnchorTo(it: SymbolItem, anchorId: string, to: Pt): void {
  const a = anchorOf(it, anchorId),
    m = localMatrix(it)
  it.x = to.x - (m[0] * a.x + m[2] * a.y + m[4])
  it.y = to.y - (m[1] * a.x + m[3] * a.y + m[5])
}

/** Shift every item. Used to drop a template at a chosen place. */
export function moveAll(doc: Doc, dx: number, dy: number): void {
  for (const it of Object.values(doc.items)) {
    if (it.type === 'connector') it.points = it.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
    else {
      it.x += dx
      it.y += dy
      if (it.type === 'label' && it.target && !('item' in it.target)) it.target = { x: it.target.x + dx, y: it.target.y + dy }
    }
  }
}

export interface SymbolOpts {
  x?: number
  y?: number
  rot?: number
  flip?: boolean
  w?: number
  h?: number
  params?: Record<string, ParamValue>
  contents?: Record<string, Layer[]>
}

export class DocBuilder {
  readonly doc: Doc
  private n = 0
  constructor(title?: string) {
    this.doc = newDoc(title)
  }

  private put<T extends Item>(it: T): T {
    this.doc.items[it.id] = it
    this.doc.order.push(it.id)
    return it
  }

  symbol(symbol: string, o: SymbolOpts = {}): SymbolItem {
    const def = symbolDef(symbol)
    return this.put<SymbolItem>({
      id: `${symbol}${++this.n}`,
      type: 'symbol',
      symbol,
      x: o.x ?? 0,
      y: o.y ?? 0,
      rot: o.rot ?? 0,
      flip: o.flip ?? false,
      w: o.w ?? def.size.w,
      h: o.h ?? def.size.h,
      params: o.params ?? {},
      contents: o.contents ?? {},
    })
  }

  /** Add a symbol with one of its anchors on a world point. */
  at(symbol: string, anchorId: string, to: Pt, o: SymbolOpts = {}): SymbolItem {
    const it = this.symbol(symbol, o)
    moveAnchorTo(it, anchorId, to)
    return it
  }

  /** Add a symbol with one of its anchors on an anchor of another item. `dx`, `dy` shift it afterwards. */
  on(symbol: string, anchorId: string, other: SymbolItem, otherAnchor: string, o: SymbolOpts & { dx?: number; dy?: number } = {}): SymbolItem {
    const p = anchorWorld(other, otherAnchor)
    return this.at(symbol, anchorId, P(p.x + (o.dx ?? 0), p.y + (o.dy ?? 0)), o)
  }

  /**
   * Add a symbol with its centre at an anchor of another item, shifted by `dx`, `dy`.
   * Use it for a symbol that has no anchor of its own (a stopwatch, a ruler, an eye).
   */
  near(symbol: string, other: SymbolItem, otherAnchor: string, o: SymbolOpts & { dx?: number; dy?: number } = {}): SymbolItem {
    const p = anchorWorld(other, otherAnchor)
    return this.symbol(symbol, { ...o, x: p.x + (o.dx ?? 0), y: p.y + (o.dy ?? 0) })
  }

  connector(kind: ConnectorKind, points: V[], o: { startCap?: Cap; endCap?: Cap; dash?: boolean; width?: number } = {}): ConnectorItem {
    return this.put<ConnectorItem>({
      id: `${kind}${++this.n}`,
      type: 'connector',
      kind,
      points,
      startCap: o.startCap ?? 'none',
      endCap: o.endCap ?? 'none',
      dash: o.dash,
      width: o.width,
    })
  }

  /**
   * Add a label. `target` is a world point, or [item, lx, ly] = a point in that item's local frame (it follows the item).
   * The side is chosen from where the target is, unless given.
   */
  label(
    text: string,
    x: number,
    y: number,
    target?: Pt | [SymbolItem, number, number],
    o: { side?: 'left' | 'right'; leaderEnd?: LabelItem['leaderEnd']; size?: number } = {},
  ): LabelItem {
    let t: Target | undefined,
      tx = x
    if (Array.isArray(target)) {
      t = { item: target[0].id, lx: target[1], ly: target[2] }
      tx = toWorld(target[0], P(target[1], target[2])).x
    } else if (target) {
      t = { x: target.x, y: target.y }
      tx = target.x
    }
    return this.put<LabelItem>({
      id: `label${++this.n}`,
      type: 'label',
      text,
      x,
      y,
      side: o.side ?? (tx > x ? 'left' : 'right'),
      target: t,
      leaderEnd: o.leaderEnd ?? 'none',
      size: o.size,
    })
  }
}
