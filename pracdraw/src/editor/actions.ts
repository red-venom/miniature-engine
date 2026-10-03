// actions.ts — what the toolbar, the inspector, the library and the keys do. Each action calls a command and
// commits the result to the store as one undo step. No DOM here. Files, export and the clipboard are in files.ts.

import type { Layer } from '../kernel/contents'
import { P, dist, type Pt } from '../kernel/geom'
import { boxCentre, docBox, itemsBox } from '../model/bounds'
import {
  addItem,
  addSymbol,
  alignItems,
  cloneItems,
  deleteItems,
  distributeItems,
  duplicateItems,
  expandGroups,
  flipItems,
  groupItems,
  insertItems,
  insertTemplate,
  makeSymbol,
  moveItems,
  reorderItems,
  rotateItems,
  setFlip,
  setItem,
  setLocked,
  setParams,
  setRotation,
  setSettings,
  setSize,
  setTitle,
  ungroupItems,
  unlockAll,
  type Align,
  type Arrange,
  type Distribute,
  type SizeArgs,
} from '../model/commands'
import { autoLabel } from '../model/autoLabel'
import { deletePoint, isDrawable, makeConnector, presetConnector, setConnector, type ConnectorPatch, type ConnectorPreset } from '../model/connectors'
import { addLabel, freeTarget, setLabel, setLabelText, type LabelPatch } from '../model/labels'
import { addLayer, applyPreset, emptyCavity, fillWater, removeLayer, setLayer, setReading, type Preset } from '../model/contents'
import { orderRule } from '../model/order'
import { setShape, type ShapePatch } from '../model/shapes'
import { newDoc, type Doc, type DocSettings, type Id, type Item, type LabelItem, type ParamValue, type SymbolItem } from '../model/types'
import { hasSymbol, symbolDef } from '../symbols/registry'
import type { TemplateDef } from '../templates/types'
import { measureText } from './measure'
import { useEditor, type Prefs, type Tool } from './store'
import { fitView, viewCentre, zoom100, zoomAt } from './view'

const state = () => useEditor.getState()
const commit = (doc: Doc, merge?: string) => state().commit(doc, merge)

export const PASTE_OFFSET = 20

/** The ids of the selection that can be acted on. Items that share a group are already in it. */
const selected = (): Id[] => state().selection

// ---------------------------------------------------------------- selection

/**
 * Select items: the items that share a group with them come too (section 12). Locked items are never selected on the
 * canvas, not even as part of a group.
 */
export function select(ids: Id[], extend = false): void {
  const s = state()
  const unlocked = (id: Id) => !!s.doc.items[id] && !s.doc.items[id].locked
  const full = expandGroups(s.doc, ids.filter(unlocked)).filter(unlocked)
  if (!extend) {
    s.select(full)
    return
  }
  const current = new Set(s.selection)
  const allIn = full.every((id) => current.has(id))
  for (const id of full)
    if (allIn) current.delete(id)
    else current.add(id)
  s.select(s.doc.order.filter((id) => current.has(id)))
}

export const clearSelection = (): void => state().select([])

export function selectAll(): void {
  const s = state()
  s.select(s.doc.order.filter((id) => !s.doc.items[id].locked))
}

// ---------------------------------------------------------------- add

function remember(symbol: string): void {
  const s = state()
  s.setPrefs({ recent: [symbol, ...s.prefs.recent.filter((id) => id !== symbol)].slice(0, 8) })
}

/** The centre of the view, for a click on a library tile. Each further add since the view last changed is 20 u further on. */
function addPoint(): Pt {
  const s = state()
  const off = s.nextAdd()
  const c = viewCentre(s.view, s.canvas)
  return P(c.x + off, c.y + off)
}

/**
 * An add from the library returns the tool to Select, so that the new selection shows its handles. A connector that is
 * half drawn keeps its tool and its points.
 */
function backToSelect(): void {
  if (!state().draft?.points.length) state().setTool('select')
}

/** Add a symbol at a world point, or at the centre of the view (each further add is 20 u further). */
export function addSymbolAt(symbol: string, at?: Pt): Id {
  const p = at ?? addPoint()
  const it = makeSymbol(symbol, Math.round(p.x), Math.round(p.y))
  commit(orderRule(addSymbol(state().doc, symbol, it.x, it.y, it.id), [it.id]))
  backToSelect()
  state().select([it.id])
  remember(symbol)
  return it.id
}

/** Add a "Tubes and lines" preset (section 10) at a world point, or at the centre of the view as a symbol is added. */
export function addPresetAt(preset: ConnectorPreset, at?: Pt): Id {
  const it = presetConnector(preset, at ?? addPoint())
  commit(addItem(state().doc, it))
  backToSelect()
  state().select([it.id])
  return it.id
}

/** Insert a template. Into an empty diagram it becomes the diagram; otherwise its items are added at the view centre. */
export function insertTemplateAt(tpl: TemplateDef, at?: Pt): void {
  const s = state()
  const before = s.doc.order.length
  const next = insertTemplate(s.doc, tpl.build(), at ?? viewCentre(s.view, s.canvas), undefined, measureText)
  commit(next)
  backToSelect()
  const fresh = before === 0 ? [] : next.order.slice(before)
  state().select(fresh)
  if (before === 0) fit()
}

// ---------------------------------------------------------------- tools (section 12)

/** Choose a tool. A connector tool starts with no points; leaving it drops a connector that is half drawn. */
export const setTool = (tool: Tool): void => state().setTool(tool)

/** After a connector or a shape is finished, the tool returns to Select and the new item becomes the selection. */
export function toolDone(id: Id): void {
  state().setTool('select')
  state().select([id])
}

// ---------------------------------------------------------------- drawing a connector (section 10)

/**
 * Place a point of the connector being drawn; the first one starts it. A point closer than `gap` units to the last one
 * is not placed (the second click of a double-click adds its point once), and neither is the last point again.
 * Returns true when the point was placed.
 */
export function draftAdd(p: Pt, gap = 0): boolean {
  const s = state(),
    d = s.draft
  if (!d) return false
  const last = d.points[d.points.length - 1]
  if (last && (dist(last, p) < gap || (last.x === p.x && last.y === p.y))) return false
  s.setDraft({ ...d, points: [...d.points, p], pointer: p })
  return true
}

/** The end of the rubber band follows the pointer. `anchor` is true when it is on a port, terminal or tip. */
export function draftHover(pointer: Pt | undefined, anchor = false): void {
  const s = state(),
    d = s.draft
  if (!d || (d.pointer?.x === pointer?.x && d.pointer?.y === pointer?.y && !!d.anchor === anchor)) return
  s.setDraft({ ...d, pointer, anchor })
}

/** Backspace: the last point goes. */
export function draftBack(): void {
  const s = state(),
    d = s.draft
  if (d?.points.length) s.setDraft({ ...d, points: d.points.slice(0, -1) })
}

/** Escape: the connector being drawn goes. The tool stays. */
export function draftCancel(): void {
  const s = state(),
    d = s.draft
  if (d?.points.length) s.setDraft({ ...d, points: [] })
}

/**
 * Double-click or Enter: the connector goes into the document on top, as one undo step. The tool returns to Select and
 * the connector becomes the selection. Points that make no line (one point) are dropped.
 *
 * `dropLast` is for a double-click whose second click placed a point. That happens when the snap moved the first
 * click's point away from the pointer, so that the second click no longer lands on it. That point goes first, so that
 * the double-click adds its point once.
 */
export function draftFinish(dropLast = false): Id | null {
  if (dropLast) draftBack()
  const s = state(),
    d = s.draft
  if (!d?.points.length) return null
  if (!isDrawable(d.points)) {
    draftCancel()
    return null
  }
  const it = makeConnector(d.kind, d.points)
  commit(addItem(s.doc, it))
  toolDone(it.id)
  return it.id
}

// ---------------------------------------------------------------- labels and text (section 11)

/**
 * Open the text box for a new label that a gesture of the Label or Text tool made (`gestureLabel`). It holds the
 * label's text (a symbol's label text, or nothing), selected. The label goes into the document when the text is
 * committed.
 */
export function startLabel(label: LabelItem): void {
  state().setTextEdit({ label, fresh: true, text: label.text })
}

/** Open the text box on a label of the document (a double-click, or Enter), holding its text. Locked labels stay shut. */
export function editLabel(id: Id): boolean {
  const s = state()
  const it = s.doc.items[id]
  if (it?.type !== 'label' || it.locked) return false
  if (s.textEdit) commitText()
  if (!state().selection.includes(id)) state().select([id])
  state().setTextEdit({ label: it, fresh: false, text: it.text })
  return true
}

/** The text in the box changes as it is typed. Nothing reaches the document until it is committed. */
export function typeText(text: string): void {
  const e = state().textEdit
  if (e && e.text !== text) state().setTextEdit({ ...e, text })
}

/**
 * Enter, or a click outside the box: a new label goes into the document with the typed text, or an old label takes it,
 * as one undo step. An empty box deletes the label (a new one is not added). The tool returns to Select, and the label
 * becomes the selection.
 */
export function commitText(): void {
  const s = state(),
    e = s.textEdit
  if (!e) return
  s.setTextEdit(null)
  const next = e.fresh ? addLabel(s.doc, e.label, e.text) : setLabelText(s.doc, e.label.id, e.text)
  commit(next)
  state().setTool('select')
  if (next.items[e.label.id]) {
    if (e.fresh || !state().selection.includes(e.label.id)) state().select([e.label.id])
  } else if (!e.fresh) state().setStatus('Label deleted')
}

/** Escape: a new label is dropped, and an old label keeps its text. The tool returns to Select. */
export function cancelText(): void {
  const s = state()
  if (!s.textEdit) return
  s.setTextEdit(null)
  s.setTool('select')
}

/**
 * "Label all" (section 11): a label for every symbol that has none, as one undo step. The new labels become the
 * selection, so that they can be moved or deleted together.
 */
export function labelAll(): void {
  const s = state()
  if (s.textEdit) commitText()
  const doc = state().doc
  const next = autoLabel(doc)
  if (next === doc) {
    state().setStatus('Every part has a label')
    return
  }
  commit(next)
  const fresh = next.order.slice(doc.order.length)
  state().select(fresh)
  state().setStatus(fresh.length === 1 ? '1 label added' : `${fresh.length} labels added`)
}

/** The label inspector: text (an empty text deletes the label), size, side, leader end, smart text. */
export const labelFields = (id: Id, patch: LabelPatch): void => commit(setLabel(state().doc, id, patch))
/** The leader end stops following its item: it stays where it is, as a free point. */
export const freeLabel = (id: Id): void => commit(freeTarget(state().doc, id))

// ---------------------------------------------------------------- edit the selection

export function deleteSelection(): void {
  const ids = selected()
  if (ids.length) {
    commit(deleteItems(state().doc, ids))
    state().select([])
  }
}

export function duplicateSelection(dx = PASTE_OFFSET, dy = PASTE_OFFSET): void {
  const s = state()
  const ids = selected()
  if (!ids.length) return
  const next = duplicateItems(s.doc, ids, dx, dy)
  commit(next)
  state().select(next.order.slice(s.doc.order.length))
}

export function nudge(dx: number, dy: number): void {
  const ids = selected()
  if (ids.length) commit(orderRule(moveItems(state().doc, ids, dx, dy), ids), 'arrow')
}

export function arrange(how: Arrange): void {
  const ids = selected()
  if (ids.length) commit(reorderItems(state().doc, ids, how))
}

/**
 * Align the selection: left, centre, right, top, middle or bottom. A group aligns as one. A label counts as its text is
 * drawn (`measureText`). Then the order rule runs.
 */
export function alignSelection(how: Align): void {
  const ids = selected()
  if (ids.length > 1) commit(orderRule(alignItems(state().doc, ids, how, measureText), ids))
}

/** Distribute the selection across or down, with equal gaps. A group counts as one. Then the order rule runs. */
export function distributeSelection(how: Distribute): void {
  const ids = selected()
  if (ids.length > 2) commit(orderRule(distributeItems(state().doc, ids, how, measureText), ids))
}

/** Mirror the selection left to right about its centre. One symbol flips in place. */
export function flipSelection(): void {
  const s = state()
  const ids = selected()
  if (!ids.length) return
  const it = ids.length === 1 ? s.doc.items[ids[0]] : null
  if (it && it.type === 'symbol') {
    commit(setFlip(s.doc, it.id, !it.flip))
    return
  }
  const box = itemsBox(s.doc, ids, measureText)
  if (box) commit(flipItems(s.doc, ids, boxCentre(box).x))
}

export function groupSelection(): void {
  const ids = selected()
  if (ids.length > 1) commit(groupItems(state().doc, ids))
}

export function ungroupSelection(): void {
  const ids = selected()
  if (ids.length) commit(ungroupItems(state().doc, ids))
}

export function lockSelection(locked: boolean): void {
  const ids = selected()
  if (!ids.length) return
  commit(setLocked(state().doc, ids, locked))
  if (locked) state().select([])
}

export const unlockEverything = (): void => commit(unlockAll(state().doc))

// ---------------------------------------------------------------- one item (the inspector)

export const resize = (id: Id, size: SizeArgs): void => commit(setSize(state().doc, id, size))
export const rotateTo = (id: Id, rot: number): void => commit(setRotation(state().doc, id, rot))
export const rotateBy = (ids: Id[], delta: number, about: Pt): void => commit(rotateItems(state().doc, ids, delta, about))
export const flipTo = (id: Id, flip: boolean): void => commit(setFlip(state().doc, id, flip))
export const setParameter = (id: Id, key: string, value: ParamValue): void => commit(setParams(state().doc, id, { [key]: value }))
export const patchItem = <T extends Item>(id: Id, patch: Partial<Omit<T, 'id' | 'type'>>): void => commit(setItem<T>(state().doc, id, patch))
export const settings = (patch: Partial<DocSettings>): void => commit(setSettings(state().doc, patch))
export const rename = (title: string): void => commit(setTitle(state().doc, title))
export const prefs = (patch: Partial<Prefs>): void => state().setPrefs(patch)
/** The connector inspector: kind, width, bend radius, dash, caps. */
export const connectorFields = (id: Id, patch: ConnectorPatch): void => commit(setConnector(state().doc, id, patch))
/** A double-click on a connector point deletes it. Two points always remain. */
export const removePoint = (id: Id, index: number): void => commit(deletePoint(state().doc, id, index))
/** The shape inspector: fill, dash, width, height, rotation. */
export const shapeFields = (id: Id, patch: ShapePatch): void => commit(setShape(state().doc, id, patch))

/** The size of a symbol as typed in the inspector, keeping its resize mode. */
export function resizeTyped(it: SymbolItem, field: 'w' | 'h', value: number): void {
  if (!Number.isFinite(value) || value <= 0) return
  const mode = hasSymbol(it.symbol) ? symbolDef(it.symbol).resize : 'free'
  if (mode === 'none') return
  let w = it.w,
    h = it.h
  if (mode === 'uniform') {
    const k = value / (field === 'w' ? it.w : it.h)
    w = it.w * k
    h = it.h * k
  } else if (field === 'w' && mode !== 'height') w = value
  else if (field === 'h' && mode !== 'width') h = value
  resize(it.id, { w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100 })
}

// ---------------------------------------------------------------- contents (section 9)

export const cavityEmpty = (id: Id, cavity: string): void => commit(emptyCavity(state().doc, id, cavity))
export const cavityWater = (id: Id, cavity: string): void => commit(fillWater(state().doc, id, cavity))
export const layerAdd = (id: Id, cavity: string): void => commit(addLayer(state().doc, id, cavity))
export const layerRemove = (id: Id, cavity: string, index: number): void => commit(removeLayer(state().doc, id, cavity, index))
export const layerPreset = (id: Id, cavity: string, index: number, preset: Preset): void => commit(applyPreset(state().doc, id, cavity, index, preset))
/** A field of one layer. `merge` joins quick repeats into one undo step (the colour picker fires as the pointer moves). */
export const layerSet = (id: Id, cavity: string, index: number, patch: Partial<Layer>, merge?: string): void =>
  commit(setLayer(state().doc, id, cavity, index, patch), merge)
/** The Reading field: one undo step, made on Enter or when the field loses the focus. */
export const reading = (id: Id, value: number): void => commit(setReading(state().doc, id, value))

/**
 * The amount slider of a layer. A drag is one undo step: `start` on pointer down opens a gesture, each change previews
 * the document, and `end` on pointer up closes the gesture. A change with no drag (an arrow key) commits at once, and
 * quick repeats on the same layer join into one step.
 */
export const amountSlider = {
  start(): void {
    const s = state()
    if (!s.gesture) s.beginGesture('slider')
  },
  set(id: Id, cavity: string, index: number, amount: number): void {
    const s = state()
    const next = setLayer(s.doc, id, cavity, index, { amount })
    if (s.gesture?.kind === 'slider') s.preview(next)
    else commit(next, `amount:${id}:${cavity}:${index}`)
  },
  end(): void {
    const s = state()
    if (s.gesture?.kind === 'slider') s.endGesture()
  },
}

// ---------------------------------------------------------------- history, clipboard, document

export const undo = (): void => state().undo()
export const redo = (): void => state().redo()

export function copySelection(): void {
  const s = state()
  const ids = new Set(selected())
  s.setClipboard(s.doc.order.filter((id) => ids.has(id)).map((id) => s.doc.items[id]))
}

export function cutSelection(): void {
  copySelection()
  deleteSelection()
}

export function paste(): void {
  const s = state()
  if (!s.clipboard.length) return
  const copies = cloneItems(s.clipboard)
  const next = insertItems(s.doc, copies, PASTE_OFFSET, PASTE_OFFSET)
  commit(next)
  state().select(copies.map((c) => c.id))
  // The next paste lands a step further on.
  s.setClipboard(
    copies.map((c) =>
      c.type === 'connector'
        ? { ...c, points: c.points.map((p) => ({ ...p, x: p.x + PASTE_OFFSET, y: p.y + PASTE_OFFSET })) }
        : { ...c, x: c.x + PASTE_OFFSET, y: c.y + PASTE_OFFSET },
    ),
  )
}

/** New clears the diagram. It can be undone. There is no confirmation. A text box that is open closes, and so does the banner. */
export function newDiagram(): void {
  state().setTextEdit(null)
  state().setBanner(null)
  commit(newDoc())
  state().select([])
}

/** Replace the document as one undo step (Open, the test hook). A text box that is open closes. */
export function loadDoc(doc: Doc): void {
  state().setTextEdit(null)
  commit(doc)
  state().select([])
}

// ---------------------------------------------------------------- view

export function fit(): void {
  const s = state()
  s.setView(fitView(docBox(s.doc, measureText), s.canvas))
}

export function zoomStep(dir: 1 | -1): void {
  const s = state()
  s.setView(zoomAt(s.view, s.view.zoom * (dir > 0 ? 1.25 : 0.8), P(s.canvas.w / 2, s.canvas.h / 2)))
}

export function zoomTo(zoom: number): void {
  const s = state()
  s.setView(zoomAt(s.view, zoom, P(s.canvas.w / 2, s.canvas.h / 2)))
}

export function zoomReset(): void {
  const s = state()
  s.setView(zoom100(s.view, s.canvas))
}
