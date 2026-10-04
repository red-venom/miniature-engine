// keys.ts — the key table of section 12. Keys do nothing while a text field has the focus. Cmd replaces Ctrl on a Mac.

import type { Host } from '../host/host'
import * as a from './actions'
import { copyImage, save } from './files'
import { useEditor, type Tool } from './store'

/** The tool keys of section 12. */
export const TOOL_KEYS: Readonly<Record<string, Tool>> = { v: 'select', l: 'label', t: 'text', u: 'tube', w: 'wire', a: 'line', r: 'rect', e: 'ellipse' }

export interface KeyContext {
  host: Host
  focusSearch(): void
  toggleHelp(): void
  openFile(): void
}

export const isMac = (): boolean => /Mac|iPhone|iPad/.test(navigator.platform) || /Mac OS/.test(navigator.userAgent)

/** The name of the key that goes with the letter keys: Cmd on a Mac, Ctrl elsewhere. */
export const modName = (mac = isMac()): string => (mac ? 'Cmd' : 'Ctrl')

/**
 * The fields of an event target that the key rules read. Read by name, so that the rules are unit-tested without a DOM.
 * `role` is the ARIA role: an element's `getAttribute('role')`, or a plain field in the tests.
 */
interface KeyTarget {
  tagName?: unknown
  type?: unknown
  isContentEditable?: unknown
  role?: unknown
  getAttribute?: unknown
}

/** The kinds of input that take typed text. */
const TEXT_INPUTS = new Set(['text', 'search', 'number', 'email', 'url', 'tel', 'password', 'date', 'datetime-local', 'month', 'time', 'week'])
/** The kinds of input that Space works. */
const SPACE_INPUTS = new Set(['checkbox', 'radio', 'color', 'button', 'submit', 'reset', 'file'])
const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
/** The ARIA roles whose arrow keys move within a group: the radio buttons of a switch, the tabs of the library. */
const ARROW_ROLES = new Set(['radio', 'tab', 'slider', 'menuitem', 'menuitemradio', 'option'])

const tagOf = (target: EventTarget | null): string => {
  const tag = (target as KeyTarget | null)?.tagName
  return typeof tag === 'string' ? tag.toUpperCase() : ''
}
const roleOf = (target: EventTarget | null): string => {
  const t = target as KeyTarget | null
  const role = typeof t?.getAttribute === 'function' ? (t.getAttribute as (name: string) => unknown).call(t, 'role') : t?.role
  return typeof role === 'string' ? role : ''
}
const inputType = (target: EventTarget | null): string => {
  const type = (target as KeyTarget | null)?.type
  return typeof type === 'string' ? type.toLowerCase() : 'text'
}

/**
 * True when the event comes from a field that takes text: an input for text, numbers, dates and the like, a textarea,
 * or editable content. Keys do nothing there (section 12). A checkbox, a radio button, a slider, a colour input or a
 * select is not a text field: the keys work while one has the focus, apart from the keys it uses itself (`controlKey`).
 */
export function inTextField(target: EventTarget | null): boolean {
  const tag = tagOf(target)
  if (tag === 'TEXTAREA' || (target as KeyTarget | null)?.isContentEditable === true) return true
  return tag === 'INPUT' && TEXT_INPUTS.has(inputType(target))
}

/**
 * True when the control with the focus uses this key (with no Ctrl, Cmd or Alt) itself: Space presses a button, ticks a
 * checkbox or opens a select; the arrow keys move a slider, a radio button (an input, or a button with the role radio,
 * as in the label-mode switch), a tab or a select; Enter presses a button, a radio button or a link, and belongs to
 * whatever has the focus unless that is the page or the canvas (`onPage`). The editor leaves those keys to the control,
 * so that the inspector and the top bar still work from the keyboard.
 */
export function controlKey(target: EventTarget | null, key: string): boolean {
  const tag = tagOf(target)
  if (key === ' ') return tag === 'BUTTON' || tag === 'SELECT' || tag === 'SUMMARY' || (tag === 'INPUT' && SPACE_INPUTS.has(inputType(target)))
  if (ARROW_KEYS.has(key))
    return tag === 'SELECT' || (tag === 'INPUT' && (inputType(target) === 'range' || inputType(target) === 'radio')) || ARROW_ROLES.has(roleOf(target))
  if (key === 'Enter') return !onPage(target)
  return false
}

/**
 * True when the focus is on the page itself or on the canvas, not on a control. Enter is the editor's key (finish a
 * connector, edit the selected label) only there: on a button, a radio button, a select, a link or a field, Enter is
 * the control's own, so that it presses the button.
 */
export function onPage(target: EventTarget | null): boolean {
  const tag = tagOf(target)
  if (tag === '' || tag === 'BODY' || tag === 'HTML') return true
  const classes = (target as { classList?: { contains?: (c: string) => boolean } } | null)?.classList
  return typeof classes?.contains === 'function' && classes.contains('canvas')
}

/** Handle a key. Returns true when the key did something (the event is then consumed). */
export function handleKey(e: KeyboardEvent, ctx: KeyContext): boolean {
  if (inTextField(e.target)) return false
  const mod = isMac() ? e.metaKey : e.ctrlKey
  if (!mod && !e.altKey && controlKey(e.target, e.key)) return false
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const s = useEditor.getState()
  if (mod) {
    switch (key) {
      case 'z':
        if (e.shiftKey) a.redo()
        else a.undo()
        return true
      case 'y':
        a.redo()
        return true
      case 'c':
        if (e.shiftKey) void copyImage(ctx.host)
        else a.copySelection()
        return true
      case 'x':
        a.cutSelection()
        return true
      case 'v':
        a.paste()
        return true
      case 'd':
        a.duplicateSelection()
        return true
      case 'a':
        a.selectAll()
        return true
      case 'g':
        if (e.shiftKey) a.ungroupSelection()
        else a.groupSelection()
        return true
      case ']':
        a.arrange('front')
        return true
      case '[':
        a.arrange('back')
        return true
      case 's':
        void save(ctx.host)
        return true
      case 'o':
        ctx.openFile()
        return true
    }
    return false
  }
  if (e.altKey) return false
  const drawing = !!s.draft?.points.length
  if (Object.hasOwn(TOOL_KEYS, key)) {
    a.setTool(TOOL_KEYS[key])
    return true
  }
  switch (key) {
    case 'Enter': {
      // Finish the connector being drawn, or edit the text of the one selected label.
      if (drawing) {
        a.draftFinish()
        return true
      }
      const one = s.selection.length === 1 ? s.doc.items[s.selection[0]] : undefined
      return s.tool === 'select' && one?.type === 'label' && a.editLabel(one.id)
    }
    case 'Delete':
    case 'Backspace':
      // While a connector is drawn, Backspace takes back its last point.
      if (drawing) a.draftBack()
      else a.deleteSelection()
      return true
    case 'ArrowLeft':
    case 'ArrowRight':
    case 'ArrowUp':
    case 'ArrowDown': {
      if (!s.selection.length) return false
      const step = e.shiftKey ? 10 : 1
      a.nudge(key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0, key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0)
      return true
    }
    case ']':
      a.arrange('forward')
      return true
    case '[':
      a.arrange('backward')
      return true
    case 'h':
      a.flipSelection()
      return true
    case '+':
    case '=':
      a.zoomStep(1)
      return true
    case '-':
    case '_':
      a.zoomStep(-1)
      return true
    case '0':
      a.zoomReset()
      return true
    case '1':
      a.fit()
      return true
    case '/':
      ctx.focusSearch()
      return true
    case '?':
      ctx.toggleHelp()
      return true
    case 'Escape':
      // Cancel the text box, the connector being drawn, or the gesture; else leave a drawing tool; else clear the
      // selection.
      if (s.textEdit) a.cancelText()
      else if (drawing) a.draftCancel()
      else if (s.gesture) s.cancelGesture()
      else if (s.tool !== 'select') a.setTool('select')
      else a.clearSelection()
      return true
  }
  return false
}

/** The key table for the help dialog, as on a PC. `keyTable` gives it for the computer in use. */
export const KEY_TABLE: [string, string][] = [
  ['V, L, T, U, W, A, R, E', 'Tools: Select, Label, Text, Tube, Wire, Line and arrow, Rectangle, Ellipse'],
  ['Double-click or Enter; Backspace', 'Finish a connector; take back its last point'],
  ['Double-click a label, or Enter', 'Edit the text of the label'],
  ['In the text box: Enter, Shift+Enter, Escape', 'Finish the label, start a new line, cancel. An empty box deletes the label'],
  ['Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y', 'Undo, redo'],
  ['Ctrl+C, Ctrl+X, Ctrl+V', 'Copy, cut, paste items'],
  ['Ctrl+D', 'Duplicate'],
  ['Delete or Backspace', 'Delete'],
  ['Ctrl+A', 'Select all'],
  ['Ctrl+G, Ctrl+Shift+G', 'Group, ungroup'],
  ['] and [, Ctrl+] and Ctrl+[', 'Forward and backward, front and back'],
  ['H', 'Flip'],
  ['Arrow keys (Shift: 10 u)', 'Move the selection'],
  ['Ctrl while dragging', 'Move without snapping'],
  ['Ctrl+S, Ctrl+O', 'Save, open'],
  ['Ctrl+Shift+C', 'Copy image'],
  ['+ and −, 0, 1', 'Zoom in and out, 100 %, fit'],
  ['/', 'Search the library'],
  ['Space+drag, middle button, wheel', 'Pan. Ctrl+wheel zooms'],
  ['Two fingers (touch)', 'Pinch to zoom; move them together to pan. A double tap is a double-click'],
  ['Escape', 'Cancel the connector being drawn or the gesture, leave a drawing tool, or clear the selection'],
  ['?', 'Help'],
]

/** The key table with Cmd for Ctrl on a Mac (section 12: on a Mac, Cmd replaces Ctrl). */
export function keyTable(mac = isMac()): [string, string][] {
  if (!mac) return KEY_TABLE
  return KEY_TABLE.map(([key, what]) => [key.replace(/Ctrl/g, 'Cmd'), what.replace(/Ctrl/g, 'Cmd')])
}

/** A part of an entry of the key table's first column: a key (or a press of the pointer), or the words round keys. */
export interface KeyPart {
  text: string
  key: boolean
}

/** The words that join the keys of an entry. */
const JOINS = /(, or |, |; | or | and )/

/**
 * An entry of the key table's first column in parts, for the help dialog: each key as a part of its own, which shows
 * as one chip, and the words between the keys (", ", " or ", " and ", "; "), a context before a colon ("In the text
 * box: ") and a note in brackets or after "while" (" (touch)", " while dragging") as plain text. So a long entry wraps
 * between its chips, never inside one. The texts of the parts, joined, are the entry.
 */
export function keyParts(entry: string): KeyPart[] {
  const out: KeyPart[] = []
  let rest = entry
  const note = /\s(\(.*\)|while .*)$/.exec(rest)
  const after = note ? rest.slice(note.index) : ''
  if (note) rest = rest.slice(0, note.index)
  const context = /^[^()]*?:\s/.exec(rest)
  if (context) {
    out.push({ text: context[0], key: false })
    rest = rest.slice(context[0].length)
  }
  // Split with the joins kept: keys at the even places, joins at the odd ones.
  rest.split(JOINS).forEach((text, i) => {
    if (text) out.push({ text, key: i % 2 === 0 })
  })
  if (after) out.push({ text: after, key: false })
  return out
}
