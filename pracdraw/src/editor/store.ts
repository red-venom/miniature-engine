// store.ts — the one Zustand store of the editor (section 6 of the specification).
// `doc` is immutable and in the undo history. Selection, tool, view and preferences are not.
// A gesture changes `doc` without history until it ends; then the whole gesture is one undo step.

import { create } from 'zustand'
import type { Box, Pt } from '../kernel/geom'
import type { SnapGuide } from '../model/snap'
import { newDoc, type ConnectorKind, type Doc, type Id, type Item, type LabelItem } from '../model/types'

export const HISTORY_LIMIT = 200
/** Changes with the same merge key that are closer than this are one undo step (arrow-key moves). */
export const MERGE_MS = 500
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 8

/** screen = world × zoom + (x, y), in CSS px from the top left of the canvas. */
export interface View {
  x: number
  y: number
  zoom: number
}

export interface Prefs {
  snap: boolean
  grid: boolean
  /** Symbol ids, most recent first, at most 8. */
  recent: string[]
}

export type Tool = 'select' | 'label' | 'text' | 'tube' | 'wire' | 'line' | 'rect' | 'ellipse'

/** The connector kind that each connector tool draws (section 10). The Tube tool draws a glass tube. */
export const CONNECTOR_TOOLS: Partial<Record<Tool, ConnectorKind>> = { tube: 'glassTube', wire: 'wire', line: 'line' }

/**
 * `level` is the level handle on the canvas; `slider` is an amount slider in the inspector; `point` moves or inserts a
 * connector point; `shape` draws a rectangle or an ellipse; `target` drags the leader end of a label. Each drag is one
 * undo step. `label` is the press, drag and release of the Label or Text tool: it changes nothing until the text is
 * typed, and Escape cancels it.
 */
export type GestureKind = 'move' | 'resize' | 'rotate' | 'marquee' | 'pan' | 'level' | 'slider' | 'point' | 'shape' | 'label' | 'target'

export interface Gesture {
  kind: GestureKind
  /** The document when the gesture began. It becomes the undo entry when the gesture ends. */
  base: Doc
  /** The selection when the gesture began. A cancelled gesture brings it back (an Alt+drag selects its copy). */
  selection: Id[]
  /** The marquee rectangle in world units, while one is drawn. */
  marquee?: Box
  /** The port, terminal or tip that a dragged connector point snapped to, in world units. */
  anchor?: Pt
  /** What a move snapped to: guide lines and the points where anchors met, in world units. */
  guides?: SnapGuide[]
  /** The leader that a drag of the Label tool makes: from the press (where it will end) to the pointer, in world units. */
  leader?: { from: Pt; to: Pt }
}

/**
 * The text box over the canvas (section 11): the label whose text is typed. A new label is not in the document until
 * its text is committed, so it is not in the history; an old label is in the document and keeps its text until then.
 */
export interface TextEdit {
  /** The new label, or the old label as it was when the box opened. */
  label: LabelItem
  /** True for a new label: Escape drops it, and an empty box adds nothing. */
  fresh: boolean
  /** The text in the box, as typed. */
  text: string
}

/**
 * The connector that the Tube, Wire or Line tool is drawing (section 10). It is not in the document until it is
 * finished, so it is not in the history, and other actions can run while it is drawn. It exists while a connector tool
 * is the tool; it has no points until the first press.
 */
export interface Draft {
  kind: ConnectorKind
  /** The points placed so far, in world units. */
  points: Pt[]
  /** Where the next point would go: the end of the rubber band. */
  pointer?: Pt
  /** True when `pointer` is on a port, terminal or tip. */
  anchor?: boolean
}

export interface EditorState {
  doc: Doc
  past: Doc[]
  future: Doc[]
  selection: Id[]
  tool: Tool
  view: View
  prefs: Prefs
  gesture: Gesture | null
  /** The connector being drawn, while a connector tool is the tool. */
  draft: Draft | null
  /** The label whose text is being typed in the text box, or null when the box is closed. */
  textEdit: TextEdit | null
  /** Copy, cut and paste use this clipboard in memory, not the system clipboard. */
  clipboard: Item[]
  /** Size of the canvas region in CSS px. The canvas component keeps it current. */
  canvas: { w: number; h: number }
  /** The message in the status bar. */
  status: string
  /** Adds since the view last changed: each one is offset by 20 u. */
  adds: number
  lastCommit: { key: string; at: number } | null

  /** Replace the document as one undo step. `merge` joins it with the last commit of the same key within MERGE_MS. */
  commit(doc: Doc, merge?: string, at?: number): void
  /** Replace the document and clear the history (the autosave restore). */
  replace(doc: Doc): void
  beginGesture(kind: GestureKind): void
  updateGesture(patch: Partial<Gesture>): void
  /** Change the document during a gesture, without history. */
  preview(doc: Doc): void
  endGesture(): void
  cancelGesture(): void
  undo(): void
  redo(): void
  select(ids: Id[]): void
  /** Choose a tool. A connector tool starts an empty draft; a change to another tool drops the draft. The same tool changes nothing. */
  setTool(tool: Tool): void
  setDraft(draft: Draft | null): void
  /** Open the text box, change its text, or close it (null). */
  setTextEdit(edit: TextEdit | null): void
  setView(view: Partial<View>): void
  setPrefs(patch: Partial<Prefs>): void
  setCanvas(w: number, h: number): void
  setStatus(status: string): void
  setClipboard(items: Item[]): void
  /** Count one add at the view centre and give its offset in units. */
  nextAdd(): number
}

export const DEFAULT_PREFS: Prefs = { snap: true, grid: true, recent: [] }

const keep = (doc: Doc, ids: Id[]): Id[] => ids.filter((id) => !!doc.items[id])

export function createEditorStore() {
  return create<EditorState>((set, get) => ({
    doc: newDoc(),
    past: [],
    future: [],
    selection: [],
    tool: 'select',
    view: { x: 0, y: 0, zoom: 1 },
    prefs: { ...DEFAULT_PREFS },
    gesture: null,
    draft: null,
    textEdit: null,
    clipboard: [],
    canvas: { w: 800, h: 600 },
    status: '',
    adds: 0,
    lastCommit: null,

    commit(doc, merge, at = Date.now()) {
      const s = get()
      if (doc === s.doc) return
      const merged = !!merge && !!s.lastCommit && s.lastCommit.key === merge && at - s.lastCommit.at < MERGE_MS
      const past = merged ? s.past : [...s.past, s.doc].slice(-HISTORY_LIMIT)
      set({ doc, past, future: [], selection: keep(doc, s.selection), lastCommit: merge ? { key: merge, at } : null })
    },
    replace(doc) {
      set({ doc, past: [], future: [], selection: [], gesture: null, textEdit: null, lastCommit: null })
    },
    beginGesture(kind) {
      set({ gesture: { kind, base: get().doc, selection: get().selection } })
    },
    updateGesture(patch) {
      const g = get().gesture
      if (g) set({ gesture: { ...g, ...patch } })
    },
    preview(doc) {
      if (get().gesture) set({ doc })
    },
    endGesture() {
      const s = get()
      if (!s.gesture) return
      if (s.doc !== s.gesture.base) {
        set({ gesture: null, past: [...s.past, s.gesture.base].slice(-HISTORY_LIMIT), future: [], selection: keep(s.doc, s.selection), lastCommit: null })
      } else set({ gesture: null })
    },
    cancelGesture() {
      const s = get()
      if (s.gesture) set({ gesture: null, doc: s.gesture.base, selection: keep(s.gesture.base, s.gesture.selection) })
    },
    undo() {
      const s = get()
      if (s.gesture || !s.past.length) return
      const doc = s.past[s.past.length - 1]
      set({ doc, past: s.past.slice(0, -1), future: [...s.future, s.doc], selection: keep(doc, s.selection), lastCommit: null })
    },
    redo() {
      const s = get()
      if (s.gesture || !s.future.length) return
      const doc = s.future[s.future.length - 1]
      set({ doc, future: s.future.slice(0, -1), past: [...s.past, s.doc].slice(-HISTORY_LIMIT), selection: keep(doc, s.selection), lastCommit: null })
    },
    select(ids) {
      set({ selection: keep(get().doc, [...new Set(ids)]) })
    },
    setTool(tool) {
      if (tool === get().tool) return
      const kind = CONNECTOR_TOOLS[tool]
      set({ tool, draft: kind ? { kind, points: [] } : null })
    },
    setDraft(draft) {
      set({ draft })
    },
    setTextEdit(textEdit) {
      set({ textEdit })
    },
    setView(view) {
      const v = { ...get().view, ...view }
      v.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom))
      set({ view: v, adds: 0 })
    },
    setPrefs(patch) {
      set({ prefs: { ...get().prefs, ...patch } })
    },
    setCanvas(w, h) {
      const c = get().canvas
      if (c.w !== w || c.h !== h) set({ canvas: { w, h } })
    },
    setStatus(status) {
      set({ status })
    },
    setClipboard(clipboard) {
      set({ clipboard })
    },
    nextAdd() {
      const n = get().adds
      set({ adds: n + 1 })
      return n * 20
    },
  }))
}

export const useEditor = createEditorStore()
