// keys.ts — the key table of section 12. Keys do nothing while a text field has the focus. Cmd replaces Ctrl on a Mac.

import type { Host } from '../host/host'
import * as a from './actions'
import { useEditor, type Tool } from './store'

/** The tool keys of section 12 (Label and Text come with phase 6). */
export const TOOL_KEYS: Readonly<Record<string, Tool>> = { v: 'select', u: 'tube', w: 'wire', a: 'line', r: 'rect', e: 'ellipse' }

export interface KeyContext {
  host: Host
  focusSearch(): void
  toggleHelp(): void
  openFile(): void
}

export const isMac = (): boolean => /Mac|iPhone|iPad/.test(navigator.platform) || /Mac OS/.test(navigator.userAgent)

/** True when the event comes from a field that takes text. */
export function inTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/** Handle a key. Returns true when the key did something (the event is then consumed). */
export function handleKey(e: KeyboardEvent, ctx: KeyContext): boolean {
  if (inTextField(e.target)) return false
  const mod = isMac() ? e.metaKey : e.ctrlKey
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
        if (e.shiftKey) void a.copyImage(ctx.host)
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
        void a.saveJson(ctx.host)
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
    case 'Enter':
      // Finish the connector being drawn.
      if (!drawing) return false
      a.draftFinish()
      return true
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
      // Cancel the connector being drawn, or the gesture; else leave a drawing tool; else clear the selection.
      if (drawing) a.draftCancel()
      else if (s.gesture) s.cancelGesture()
      else if (s.tool !== 'select') a.setTool('select')
      else a.clearSelection()
      return true
  }
  return false
}

/** The key table for the help dialog. */
export const KEY_TABLE: [string, string][] = [
  ['V, U, W, A, R, E', 'Tools: Select, Tube, Wire, Line and arrow, Rectangle, Ellipse'],
  ['Double-click or Enter; Backspace', 'Finish a connector; take back its last point'],
  ['Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y', 'Undo, redo'],
  ['Ctrl+C, Ctrl+X, Ctrl+V', 'Copy, cut, paste items'],
  ['Ctrl+D', 'Duplicate'],
  ['Delete or Backspace', 'Delete'],
  ['Ctrl+A', 'Select all'],
  ['Ctrl+G, Ctrl+Shift+G', 'Group, ungroup'],
  ['] and [, Ctrl+] and Ctrl+[', 'Forward and backward, front and back'],
  ['H', 'Flip'],
  ['Arrow keys (Shift: 10 u)', 'Move the selection'],
  ['Ctrl+S, Ctrl+O', 'Save, open'],
  ['Ctrl+Shift+C', 'Copy image'],
  ['+ and −, 0, 1', 'Zoom in and out, 100 %, fit'],
  ['/', 'Search the library'],
  ['Space+drag, middle button, wheel', 'Pan. Ctrl+wheel zooms'],
  ['Escape', 'Cancel the connector being drawn or the gesture, leave a drawing tool, or clear the selection'],
  ['?', 'Help'],
]
