// types.ts — the diagram document. This is also the saved file format (JSON).
// World units ("u"): 1 u = 1 CSS px at 100 % zoom. y points down. Angles are degrees clockwise.

import type { Layer } from '../kernel/contents'
import type { V } from '../kernel/geom'
import type { ParamValue } from '../symbols/types'

export type Id = string
export type { ParamValue }

export interface Doc {
  app: 'pracdraw'
  /** File format version. Bump it and add a migration when the shape changes. */
  version: 1
  title: string
  items: Record<Id, Item>
  /** Draw order, back to front. Labels are always drawn after every symbol, connector and shape. */
  order: Id[]
  settings: DocSettings
}

export interface DocSettings {
  /** Photocopy-safe rendering: black line only, dashes for liquids. */
  mono: boolean
  /** 'text' = normal labels, 'blank' = a line to write on, 'letters' = A, B, C … */
  labelMode: 'text' | 'blank' | 'letters'
  /** Default label size in units. */
  labelSize: number
  /** Format formulae and units as the user types (see kernel/text.ts). */
  smartText: boolean
}

interface ItemBase {
  id: Id
  locked?: boolean
  /** Items with the same group id select and move together. */
  group?: Id
}

export interface SymbolItem extends ItemBase {
  type: 'symbol'
  /** SymbolDef.id */
  symbol: string
  /** Centre of the nominal box. */
  x: number
  y: number
  rot: number
  flip: boolean
  /** Nominal box. The symbol is redrawn at this size; line thickness never scales. */
  w: number
  h: number
  /** Only values that differ from the symbol's defaults. */
  params: Record<string, ParamValue>
  /** Layers by cavity id, bottom layer first. */
  contents: Record<string, Layer[]>
}

export type ConnectorKind = 'glassTube' | 'rubberTube' | 'wire' | 'line'
export type Cap = 'none' | 'arrow' | 'closed' | 'tick' | 'dot'

export interface ConnectorItem extends ItemBase {
  type: 'connector'
  kind: ConnectorKind
  /** World points. `r` is the bend radius at that point. */
  points: V[]
  /** Tubes: distance between the two wall lines. Default 7 (glass), 10 (rubber). */
  width?: number
  dash?: boolean
  startCap: Cap
  endCap: Cap
}

/** A free point in the world, or a point fixed in an item's local frame (it follows the item). */
export type Target = { x: number; y: number } | { item: Id; lx: number; ly: number }

export interface LabelItem extends ItemBase {
  type: 'label'
  /** Markup: see kernel/text.ts. '\n' starts a new line. */
  text: string
  /** Baseline anchor of the first line. Text on the left of its target ends here; text on the right starts here. */
  x: number
  y: number
  side: 'left' | 'right'
  /** Where the leader line ends. Absent = plain text with no leader. */
  target?: Target
  leaderEnd: 'none' | 'arrow' | 'dot'
  size?: number
  /** Overrides DocSettings.smartText for this label. */
  smart?: boolean
}

export interface ShapeItem extends ItemBase {
  type: 'shape'
  shape: 'rect' | 'ellipse'
  x: number
  y: number
  w: number
  h: number
  rot: number
  fill: 'none' | 'paper' | 'grey'
  dash: boolean
}

export type Item = SymbolItem | ConnectorItem | LabelItem | ShapeItem

export const DEFAULT_SETTINGS: DocSettings = { mono: false, labelMode: 'text', labelSize: 15, smartText: true }

export function newDoc(title = 'Untitled diagram'): Doc {
  return { app: 'pracdraw', version: 1, title, items: {}, order: [], settings: { ...DEFAULT_SETTINGS } }
}
