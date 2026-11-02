// search.ts — the library's search and pack order (section 12). Pure.

import { CONNECTOR_PRESETS, type ConnectorPreset } from '../model/connectors'
import { SYMBOLS } from '../symbols/registry'
import type { PackId, SymbolDef } from '../symbols/types'

export const PACKS: { id: PackId; name: string }[] = [
  { id: 'containers', name: 'Containers' },
  { id: 'measuring', name: 'Measuring' },
  { id: 'heating', name: 'Heating' },
  { id: 'support', name: 'Support' },
  { id: 'filtering', name: 'Filtering' },
  { id: 'organic', name: 'Organic' },
  { id: 'electrochemistry', name: 'Electrochemistry' },
  { id: 'physics', name: 'Physics' },
  { id: 'biology', name: 'Biology' },
  { id: 'circuit', name: 'Circuit symbols' },
  { id: 'annotation', name: 'Annotation' },
  { id: 'atoms', name: 'Atoms and ions' },
  { id: 'matter', name: 'Particles' },
  { id: 'energy', name: 'Energy' },
  { id: 'structures', name: 'Structures' },
]

/** The library group after the packs: the connector presets of section 10. */
export const PRESET_GROUP = 'Tubes and lines'

/** Every typed word must appear in the name or an alias, ignoring case. Names that start with the query come first. */
export function searchSymbols(query: string, defs: SymbolDef[] = SYMBOLS): SymbolDef[] {
  return search<SymbolDef, SymbolDef[]>(query, defs)
}

/** The "Tubes and lines" presets that match, by the same rule. */
export function searchPresets(query: string, presets: readonly ConnectorPreset[] = CONNECTOR_PRESETS): readonly ConnectorPreset[] {
  return search<ConnectorPreset, readonly ConnectorPreset[]>(query, presets)
}

/** Everything (the same array) for an empty query. */
function search<T extends { name: string; aliases?: string[] }, L extends readonly T[]>(query: string, defs: L): T[] | L {
  const q = query.trim().toLowerCase()
  if (!q) return defs
  const words = q.split(/\s+/)
  const hits = defs.filter((d) => {
    const names = [d.name, ...(d.aliases ?? [])].map((n) => n.toLowerCase())
    return words.every((w) => names.some((n) => n.includes(w)))
  })
  const starts = (d: T) => [d.name, ...(d.aliases ?? [])].some((n) => n.toLowerCase().startsWith(q))
  return [...hits.filter(starts), ...hits.filter((d) => !starts(d))]
}
