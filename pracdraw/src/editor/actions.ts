// actions.ts — what the toolbar, the inspector, the library and the keys do. Each action calls a command and
// commits the result to the store as one undo step. No DOM here, except the clipboard through the host.

import type { Layer } from '../kernel/contents'
import { P, type Pt } from '../kernel/geom'
import { svgDocument, translate, type Node } from '../kernel/nodes'
import { canvasToBlob, renderCanvas } from '../export/canvas'
import type { Host } from '../host/host'
import { boxCentre, docBox, itemsBox } from '../model/bounds'
import {
  addSymbol,
  cloneItems,
  deleteItems,
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
  type Arrange,
  type SizeArgs,
} from '../model/commands'
import { addLayer, applyPreset, emptyCavity, fillWater, removeLayer, setLayer, setReading, type Preset } from '../model/contents'
import { orderRule } from '../model/order'
import { newDoc, type Doc, type DocSettings, type Id, type Item, type ParamValue, type SymbolItem } from '../model/types'
import { docNodes, estimateBounds } from '../render/render'
import { hasSymbol, symbolDef } from '../symbols/registry'
import type { TemplateDef } from '../templates/types'
import { useEditor, type Prefs } from './store'
import { fitView, viewCentre, zoom100, zoomAt } from './view'

const state = () => useEditor.getState()
const commit = (doc: Doc, merge?: string) => state().commit(doc, merge)

export const PASTE_OFFSET = 20

/** The ids of the selection that can be acted on. Items that share a group are already in it. */
const selected = (): Id[] => state().selection

// ---------------------------------------------------------------- selection

export function select(ids: Id[], extend = false): void {
  const s = state()
  const live = ids.filter((id) => s.doc.items[id] && !s.doc.items[id].locked)
  const full = expandGroups(s.doc, live)
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

/** Add a symbol at a world point, or at the centre of the view (each further add is 20 u further). */
export function addSymbolAt(symbol: string, at?: Pt): Id {
  const s = state()
  let p = at
  if (!p) {
    const off = s.nextAdd()
    const c = viewCentre(s.view, s.canvas)
    p = P(c.x + off, c.y + off)
  }
  const it = makeSymbol(symbol, Math.round(p.x), Math.round(p.y))
  commit(orderRule(addSymbol(s.doc, symbol, it.x, it.y, it.id), [it.id]))
  state().select([it.id])
  remember(symbol)
  return it.id
}

/** Insert a template. Into an empty diagram it becomes the diagram; otherwise its items are added at the view centre. */
export function insertTemplateAt(tpl: TemplateDef, at?: Pt): void {
  const s = state()
  const before = s.doc.order.length
  const next = insertTemplate(s.doc, tpl.build(), at ?? viewCentre(s.view, s.canvas))
  commit(next)
  const fresh = before === 0 ? [] : next.order.slice(before)
  state().select(fresh)
  if (before === 0) fit()
}

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
  const box = itemsBox(s.doc, ids)
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
export const reading = (id: Id, value: number): void => commit(setReading(state().doc, id, value))

/**
 * An amount slider is one undo step: the drag is a gesture. `start` opens it (once), `move` previews the document,
 * `end` closes it. A change outside a gesture (a programmatic one) is its own step.
 */
export const slider = {
  start(): void {
    const s = state()
    if (!s.gesture) s.beginGesture('slider')
  },
  move(doc: Doc): void {
    const s = state()
    if (s.gesture?.kind === 'slider') s.preview(doc)
    else commit(doc)
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

/** New clears the diagram. It can be undone. There is no confirmation. */
export function newDiagram(): void {
  commit(newDoc())
  state().select([])
}

/** Replace the document as one undo step (Open, the test hook). */
export function loadDoc(doc: Doc): void {
  commit(doc)
  state().select([])
}

// ---------------------------------------------------------------- view

export function fit(): void {
  const s = state()
  s.setView(fitView(docBox(s.doc), s.canvas))
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

// ---------------------------------------------------------------- export (the default export; phase 7 adds the dialog)

export interface Picture {
  nodes: Node[]
  x: number
  y: number
  w: number
  h: number
}

/** The diagram cropped to its bounds plus 16 u, on whole units so that screen and export pixels line up. */
export function picture(doc: Doc): Picture {
  const b = estimateBounds(doc)
  const x = Math.floor(b.x),
    y = Math.floor(b.y)
  const w = Math.max(1, Math.ceil(b.x + b.w) - x),
    h = Math.max(1, Math.ceil(b.y + b.h) - y)
  return { nodes: [{ t: 'g', m: translate(-x, -y), kids: docNodes(doc) }], x, y, w, h }
}

export function pngDataUrl(doc: Doc, scale: number): string {
  const p = picture(doc)
  return renderCanvas(p.nodes, p.w, p.h, scale, '#ffffff').toDataURL('image/png')
}

export const pngBlob = (doc: Doc, scale: number): Promise<Blob> => {
  const p = picture(doc)
  return canvasToBlob(renderCanvas(p.nodes, p.w, p.h, scale, '#ffffff'))
}

/** The SVG file: plain SVG with the document as metadata, so that it can be opened again. */
export function svgText(doc: Doc): string {
  const p = picture(doc)
  return svgDocument(p.nodes, p.w, p.h, '#ffffff', JSON.stringify(doc))
}

/** A safe file name: `<title>` with the forbidden characters replaced (section 7). */
export function fileName(title: string, ext: string): string {
  const safe = [...title.replace(/[\\/:*?"<>|]/g, '-')]
    .map((c) => (c.charCodeAt(0) < 32 ? '-' : c))
    .join('')
    .trim()
  return `${safe || 'diagram'}${ext}`
}

export async function copyImage(host: Host): Promise<void> {
  const s = state()
  const ok = await host.copyImage(pngBlob(s.doc, 2))
  state().setStatus(ok ? 'Copied' : 'Copy failed')
}

export async function savePng(host: Host): Promise<void> {
  const s = state()
  const r = await host.saveFile(fileName(s.doc.title, '.png'), await pngBlob(s.doc, 2))
  state().setStatus(r === 'saved' ? 'PNG saved' : r === 'cancelled' ? '' : 'Save failed')
}

export async function saveSvg(host: Host): Promise<void> {
  const s = state()
  const r = await host.saveFile(fileName(s.doc.title, '.svg'), new Blob([svgText(s.doc)], { type: 'image/svg+xml' }))
  state().setStatus(r === 'saved' ? 'SVG saved' : r === 'cancelled' ? '' : 'Save failed')
}

export async function saveJson(host: Host): Promise<void> {
  const s = state()
  const r = await host.saveFile(fileName(s.doc.title, '.pracdraw.json'), new Blob([JSON.stringify(s.doc, null, 2)], { type: 'application/json' }))
  state().setStatus(r === 'saved' ? 'Saved' : r === 'cancelled' ? '' : 'Save failed')
}

/** A light check of a document from storage or a file. Phase 7 replaces it with `parseDoc`. */
export function looksLikeDoc(value: unknown): value is Doc {
  if (!value || typeof value !== 'object') return false
  const d = value as Partial<Doc>
  return d.app === 'pracdraw' && d.version === 1 && typeof d.title === 'string' && !!d.items && Array.isArray(d.order) && !!d.settings
}

/** The document inside a file: `.pracdraw.json`, or an SVG that PracDraw exported. */
export function docFromText(text: string): Doc | null {
  let json = text
  if (/^\s*</.test(text)) {
    const m = /<metadata>([\s\S]*?)<\/metadata>/.exec(text)
    if (!m) return null
    json = m[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
  }
  try {
    const value: unknown = JSON.parse(json)
    return looksLikeDoc(value) ? value : null
  } catch {
    return null
  }
}
