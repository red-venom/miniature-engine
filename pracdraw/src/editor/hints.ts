// hints.ts — the status bar's hint for the active tool (section 12). Pure.

import type { Tool } from './store'

const SELECT = 'Click to select. Drag to move; parts snap, Ctrl stops it. Shift+click adds. Alt+drag duplicates. Space+drag or wheel pans, Ctrl+wheel zooms.'
const CONNECTOR_SELECTED = 'Drag a square handle to move a point, or a round handle to add a point. Double-click a point to delete it.'
const LABEL_SELECTED =
  'Drag the label to move its text. Drag the round handle to move the leader end: dropped on a part, it is fixed there. Double-click or Enter edits the text.'
const EDITING = 'Type the text. Enter finishes, Shift+Enter starts a new line, Escape cancels. An empty box deletes the label.'
const CONNECTORS: Partial<Record<Tool, string>> = { tube: 'Tube', wire: 'Wire', line: 'Line and arrow' }

export interface HintState {
  /** A connector has points. */
  drawing?: boolean
  /** The selection is one connector, whose handles the Select tool can drag. */
  connector?: boolean
  /** The selection is one label. */
  label?: boolean
  /** The text box is open. */
  editing?: boolean
}

/** The hint for a tool, and for what is going on. */
export function toolHint(tool: Tool, st: HintState = {}): string {
  if (st.editing) return EDITING
  const name = CONNECTORS[tool]
  if (name) {
    return st.drawing
      ? `${name}: click to add a point. Double-click or Enter finishes. Backspace takes back the last point. Escape cancels. Shift: 45° steps.`
      : `${name}: click to place each point, or drag for a straight one. Points snap to ports, terminals and tips.`
  }
  if (tool === 'label')
    return 'Label: press on the part the leader must point to, drag to where the text goes, release, and type. A click makes plain text. Escape returns to Select.'
  if (tool === 'text') return 'Text: click where the text goes, and type. Escape returns to Select.'
  if (tool === 'rect') return 'Rectangle: drag to draw it. Shift makes a square. Escape returns to Select.'
  if (tool === 'ellipse') return 'Ellipse: drag to draw it. Shift makes a circle. Escape returns to Select.'
  return st.connector ? CONNECTOR_SELECTED : st.label ? LABEL_SELECTED : SELECT
}
