// registry.ts — every symbol the app knows: the pilots, then one array for each pack.
// Authors add symbols to their pack file. Nobody needs to edit this file.

import { annotation } from './annotation'
import { biology } from './biology'
import { circuit } from './circuit'
import { containers } from './containers'
import { electrochemistry } from './electrochemistry'
import { filtering } from './filtering'
import { heating } from './heating'
import { measuring } from './measuring'
import { organic } from './organic'
import { physics } from './physics'
import { support } from './support'
import { rect } from './kit'
import { PILOTS } from './pilots'
import type { Geometry, ParamValue, SymbolDef } from './types'

export const SYMBOLS: SymbolDef[] = [
  ...PILOTS,
  ...containers,
  ...measuring,
  ...heating,
  ...support,
  ...filtering,
  ...organic,
  ...electrochemistry,
  ...physics,
  ...biology,
  ...circuit,
  ...annotation,
]

const byId = new Map(SYMBOLS.map((s) => [s.id, s]))
if (byId.size !== SYMBOLS.length) throw new Error('duplicate symbol id')

export const hasSymbol = (id: string): boolean => byId.has(id)

/** The definition of a symbol. Throws for an unknown id: use it where the id comes from code. */
export function symbolDef(id: string): SymbolDef {
  const def = byId.get(id)
  if (!def) throw new Error(`unknown symbol: ${id}`)
  return def
}

export function defaultParams(def: SymbolDef): Record<string, ParamValue> {
  return Object.fromEntries((def.params ?? []).map((p) => [p.key, p.default]))
}

/**
 * Label text for a symbol: its `label`, or its name without a bracketed part and with a lower-case first letter.
 * `params` are the item's own parameters; a `label` function reads them.
 */
export function labelText(def: SymbolDef, params: Record<string, ParamValue> = {}): string {
  if (typeof def.label === 'function') return def.label({ ...defaultParams(def), ...params })
  if (def.label) return def.label
  const name = def.name.replace(/\s*\(.*?\)/g, '').trim()
  return name.charAt(0).toLowerCase() + name.slice(1)
}

/** What stands in for a symbol that cannot be drawn: a dashed box with the id in it. No cavities, no anchors. */
export function placeholder(id: string, w: number, h: number): Geometry {
  return {
    prims: [{ d: rect(-w / 2, 0, w / 2, h), role: 'dashed' }],
    texts: [{ x: 0, y: h / 2 + 4, text: id, size: 10, anchor: 'middle' }],
  }
}

const cache = new Map<string, Geometry>()

/**
 * Geometry for a symbol at a size. Cached: `build` is pure.
 * It never throws. An unknown id (a file from a newer version) or a `build` that fails gives the placeholder.
 */
export function geometry(id: string, w: number, h: number, params: Record<string, ParamValue> = {}): Geometry {
  const key = `${id}|${w}|${h}|${JSON.stringify(params)}`
  let g = cache.get(key)
  if (!g) {
    const def = byId.get(id)
    try {
      g = def ? def.build({ w, h, p: { ...defaultParams(def), ...params } }) : placeholder(id, w, h)
    } catch {
      g = placeholder(id, w, h)
    }
    if (cache.size > 2000) cache.clear()
    cache.set(key, g)
  }
  return g
}
