// hints.ts — the status bar's hint for the active tool (section 12). Pure.

import type { Tool } from './store'

const SELECT = 'Click to select. Drag to move; parts snap, Ctrl stops it. Shift+click adds. Alt+drag duplicates. Space+drag or wheel pans, Ctrl+wheel zooms.'
const CONNECTOR_SELECTED = 'Drag a square handle to move a point, or a round handle to add a point. Double-click a point to delete it.'
const CONNECTORS: Partial<Record<Tool, string>> = { tube: 'Tube', wire: 'Wire', line: 'Line and arrow' }

/**
 * The hint for a tool. `drawing` is true while a connector has points; `connector` is true when the selection is one
 * connector, whose handles the Select tool can drag.
 */
export function toolHint(tool: Tool, drawing = false, connector = false): string {
  const name = CONNECTORS[tool]
  if (name) {
    return drawing
      ? `${name}: click to add a point. Double-click or Enter finishes. Backspace takes back the last point. Escape cancels. Shift: 45° steps.`
      : `${name}: click to place each point, or drag for a straight one. Points snap to ports, terminals and tips.`
  }
  if (tool === 'rect') return 'Rectangle: drag to draw it. Shift makes a square. Escape returns to Select.'
  if (tool === 'ellipse') return 'Ellipse: drag to draw it. Shift makes a circle. Escape returns to Select.'
  return connector ? CONNECTOR_SELECTED : SELECT
}
