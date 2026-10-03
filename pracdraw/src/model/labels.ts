// labels.ts — the commands for labels and text (section 11 of the specification): the label that a Label or Text tool
// gesture makes, its text, its fields in the inspector, and freeing its leader end. Each command is pure:
// (doc, arguments) => doc, and gives the same document when nothing changes.

import { P, type Pt } from '../kernel/geom'
import { hasSymbol, labelText, symbolDef } from '../symbols/registry'
import { labelTarget } from './bounds'
import { addItem, deleteItems, newId } from './commands'
import { toLocal } from './transform'
import type { Doc, Id, LabelItem, Target } from './types'

/** What the inspector allows for a label's size, in units: the same range as the document's label size. */
export const LABEL_SIZE_RANGE = { min: 6, max: 60 }

export const LEADER_ENDS: readonly LabelItem['leaderEnd'][] = ['none', 'arrow', 'dot']

/** The size a label is drawn at: its own, or the document's label size. */
export const labelSize = (doc: Doc, it: Pick<LabelItem, 'size'>): number => it.size ?? doc.settings.labelSize

/** True when the label has a leader whose end is fixed to an item (it follows the item). */
export const isFixed = (it: LabelItem): it is LabelItem & { target: { item: Id; lx: number; ly: number } } => !!it.target && 'item' in it.target

/**
 * Where the leader starts, as the renderer draws it (`labelNode` in src/render/render.ts): 5 u outside the text anchor,
 * a third of the size above the baseline. Text on the left ends at the anchor, so the leader starts to its right.
 */
export function leaderStart(it: Pick<LabelItem, 'x' | 'y' | 'side'>, size: number): Pt {
  return P(it.x + (it.side === 'left' ? 5 : -5), it.y - size * 0.33)
}

/** The leader of a label as it is drawn: from just outside its text to its target. Null for plain text. */
export function leaderOf(doc: Doc, it: LabelItem): [Pt, Pt] | null {
  const end = labelTarget(doc, it)
  return end ? [leaderStart(it, labelSize(doc, it)), end] : null
}

/** The label text of a symbol item: `labelText` of its definition with its parameters. Empty for an unknown symbol. */
export function symbolLabelText(doc: Doc, id: Id): string {
  const it = doc.items[id]
  return it?.type === 'symbol' && hasSymbol(it.symbol) ? labelText(symbolDef(it.symbol), it.params) : ''
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** A new label with no text. */
export function makeLabel(fields: Pick<LabelItem, 'x' | 'y' | 'side'> & Partial<LabelItem>, id: Id = newId()): LabelItem {
  return { text: '', leaderEnd: 'none', ...fields, id, type: 'label' }
}

/**
 * The label that a gesture of the Label tool makes (section 11): a press at `press`, a release at `release`, both
 * world points. A drag gives a leader that ends at the press point: fixed to the symbol `on` (a point in its local
 * frame) when the press was on one, else a free point. Its text is that symbol's label text. The text anchor is the
 * release point, and the text is on the left of its target when the release point is left of the press point.
 * A click (`drag` false), and any gesture of the Text tool, makes plain text with no leader at the release point.
 * The anchor and a free target are on whole units. The label is not in the document yet: `addLabel` puts it there.
 */
export function gestureLabel(doc: Doc, press: Pt, release: Pt, drag: boolean, on: Id | null = null, id: Id = newId()): LabelItem {
  const x = Math.round(release.x),
    y = Math.round(release.y)
  if (!drag) return makeLabel({ x, y, side: 'right' }, id)
  const owner = on ? doc.items[on] : undefined
  let target: Target
  let text = ''
  if (owner?.type === 'symbol') {
    const l = toLocal(owner, press)
    target = { item: owner.id, lx: r2(l.x), ly: r2(l.y) }
    text = symbolLabelText(doc, owner.id)
  } else target = { x: Math.round(press.x), y: Math.round(press.y) }
  return makeLabel({ x, y, side: release.x < press.x ? 'left' : 'right', target, text }, id)
}

/** True when the text would draw nothing: an empty box deletes the label (section 11). */
export const isBlankText = (text: string): boolean => text.trim() === ''

/** Add a new label on top with its typed text. An empty text adds nothing. */
export function addLabel(doc: Doc, it: LabelItem, text: string = it.text): Doc {
  return isBlankText(text) ? doc : addItem(doc, { ...it, text })
}

/** Set the text of a label. An empty text deletes the label (section 11). */
export function setLabelText(doc: Doc, id: Id, text: string): Doc {
  const it = doc.items[id]
  if (it?.type !== 'label') return doc
  if (isBlankText(text)) return deleteItems(doc, [id])
  return text === it.text ? doc : { ...doc, items: { ...doc.items, [id]: { ...it, text } } }
}

export interface LabelPatch {
  text?: string
  /** Units. Undefined, or the document's label size, makes the label follow the document's label size. */
  size?: number
  side?: LabelItem['side']
  leaderEnd?: LabelItem['leaderEnd']
  /** Smart text for this label. The document's setting makes the label follow the document again. */
  smart?: boolean
}

/**
 * Change the fields of a label (the inspector). An empty text deletes the label. A size is kept in its range. A size or
 * a smart-text flag that equals the document's setting is not stored, so that the label follows the document.
 */
export function setLabel(doc: Doc, id: Id, patch: LabelPatch): Doc {
  const it = doc.items[id]
  if (it?.type !== 'label') return doc
  if (patch.text !== undefined && isBlankText(patch.text)) return deleteItems(doc, [id])
  const next: LabelItem = { ...it }
  if (patch.text !== undefined) next.text = patch.text
  if ('size' in patch) {
    const s = patch.size
    if (s === undefined || s === doc.settings.labelSize) delete next.size
    else if (Number.isFinite(s)) next.size = Math.min(LABEL_SIZE_RANGE.max, Math.max(LABEL_SIZE_RANGE.min, s))
  }
  if (patch.side === 'left' || patch.side === 'right') next.side = patch.side
  if (patch.leaderEnd && LEADER_ENDS.includes(patch.leaderEnd)) next.leaderEnd = patch.leaderEnd
  if (typeof patch.smart === 'boolean') {
    if (patch.smart === doc.settings.smartText) delete next.smart
    else next.smart = patch.smart
  }
  const same = next.text === it.text && next.size === it.size && next.side === it.side && next.leaderEnd === it.leaderEnd && next.smart === it.smart
  return same ? doc : { ...doc, items: { ...doc.items, [id]: next } }
}

/**
 * Move a label's leader end to a world point (the round handle of a selected label): fixed to the symbol `on` there, as
 * a point in its local frame, or a free point on whole units. Plain text has no leader end and is left as it is.
 */
export function setTargetAt(doc: Doc, id: Id, p: Pt, on: Id | null = null): Doc {
  const it = doc.items[id]
  if (it?.type !== 'label' || !it.target || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return doc
  const owner = on ? doc.items[on] : undefined
  let target: Target
  if (owner?.type === 'symbol') {
    const l = toLocal(owner, p)
    target = { item: owner.id, lx: r2(l.x), ly: r2(l.y) }
  } else target = { x: Math.round(p.x), y: Math.round(p.y) }
  const t = it.target
  const same =
    'item' in t
      ? 'item' in target && t.item === target.item && t.lx === target.lx && t.ly === target.ly
      : !('item' in target) && t.x === target.x && t.y === target.y
  return same ? doc : { ...doc, items: { ...doc.items, [id]: { ...it, target } } }
}

/**
 * Free a label's leader end (the inspector's button): a target fixed to an item becomes the world point where it is
 * now, so that it no longer follows the item. A free target, plain text and a target whose item is missing (a file
 * from elsewhere) are left as they are.
 */
export function freeTarget(doc: Doc, id: Id): Doc {
  const it = doc.items[id]
  if (it?.type !== 'label' || !isFixed(it)) return doc
  const p = labelTarget(doc, it)
  return p ? { ...doc, items: { ...doc.items, [id]: { ...it, target: { x: r2(p.x), y: r2(p.y) } } } } : doc
}
