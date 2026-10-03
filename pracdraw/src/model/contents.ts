// contents.ts — commands for what a cavity holds (section 9): layers, presets, the quick buttons and the reading
// field. Pure: (doc, arguments) => doc. The commands keep a gas layer last and the total amount at most 1.
// The drawing itself is the kernel's business (src/kernel/contents.ts).

import type { Layer, LayerKind } from '../kernel/contents'
import { geometry, hasSymbol, symbolDef } from '../symbols/registry'
import { amountToReading, readingToAmount } from '../symbols/scale'
import { setParams } from './commands'
import type { Doc, Id, Item, SymbolItem } from './types'

export const MAX_LAYERS = 4
export const WATER_COLOUR = '#cfe8f7'
/** The liquid in a thermometer. */
export const THERMOMETER_COLOUR = '#d33333'

export interface Preset {
  name: string
  kind: LayerKind
  colour: string
  cloudy?: boolean
}

/** The preset table of section 9. A preset sets the kind, the colour and the cloudy flag. */
export const PRESETS: readonly Preset[] = [
  { name: 'Water', kind: 'liquid', colour: '#cfe8f7' },
  { name: 'Colourless solution', kind: 'liquid', colour: '#e9f1f5' },
  { name: 'Blue (copper sulfate)', kind: 'liquid', colour: '#7fb8e6' },
  { name: 'Pale green', kind: 'liquid', colour: '#cfe8c4' },
  { name: 'Green (neutral indicator)', kind: 'liquid', colour: '#8fce8a' },
  { name: 'Yellow', kind: 'liquid', colour: '#f5e58a' },
  { name: 'Orange', kind: 'liquid', colour: '#f2b56b' },
  { name: 'Pink', kind: 'liquid', colour: '#f2a7c3' },
  { name: 'Red', kind: 'liquid', colour: '#e98a8a' },
  { name: 'Purple', kind: 'liquid', colour: '#b497d6' },
  { name: 'Brown (iodine solution)', kind: 'liquid', colour: '#b98556' },
  { name: 'Blue-black (starch and iodine)', kind: 'liquid', colour: '#3b4a6b' },
  { name: 'Oil or organic layer', kind: 'liquid', colour: '#f3d9a8' },
  { name: 'Cloudy', kind: 'liquid', colour: '#e6e6e6', cloudy: true },
  { name: 'Cloudy yellow (sulfur)', kind: 'liquid', colour: '#f1e9b0', cloudy: true },
  { name: 'White powder or precipitate', kind: 'powder', colour: '#f1f1f1' },
  { name: 'Grey powder', kind: 'powder', colour: '#d8d8d8' },
  { name: 'Black powder', kind: 'powder', colour: '#5a5a5a' },
  { name: 'Green powder (copper carbonate)', kind: 'powder', colour: '#9fcfae' },
  { name: 'Blue precipitate (copper(II) hydroxide)', kind: 'powder', colour: '#8fbfe8' },
  { name: 'Orange-brown precipitate (iron(III) hydroxide)', kind: 'powder', colour: '#c9824a' },
  { name: 'Cream precipitate (silver bromide)', kind: 'powder', colour: '#f3ecd0' },
  { name: 'Yellow precipitate (silver iodide)', kind: 'powder', colour: '#f2e26b' },
  { name: 'Brick-red precipitate (Benedict’s test)', kind: 'powder', colour: '#c8553d' },
  { name: 'Chips or granules', kind: 'lumps', colour: '#e9e9e9' },
  { name: 'Ice', kind: 'lumps', colour: '#eaf4fb' },
  { name: 'Blue crystals (copper sulfate)', kind: 'lumps', colour: '#7fb8e6' },
  { name: 'Pale green gas', kind: 'gas', colour: '#e3efc1' },
  { name: 'Brown gas', kind: 'gas', colour: '#cfa27a' },
]

/** The Water quick button: one liquid layer, half full. */
export const waterLayer = (): Layer => ({ kind: 'liquid', amount: 0.5, colour: WATER_COLOUR })

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round4 = (n: number) => Math.round(n * 1e4) / 1e4

/** Sum of the amounts of the layers that are not a gas: how full the cavity is, 0 to 1. */
export const filledAmount = (layers: readonly Layer[]): number => clamp(layers.reduce((a, l) => (l.kind === 'gas' ? a : a + Math.max(0, l.amount)), 0), 0, 1)

/** The index of the highest layer that is not a gas, or −1. */
export const topLayerIndex = (layers: readonly Layer[]): number => layers.reduce((a, l, i) => (l.kind === 'gas' ? a : i), -1)

/** Strip the liquid-only flags from a layer that is not a liquid. */
function tidy(l: Layer): Layer {
  if (l.kind === 'liquid') return l
  const { meniscus: _m, bubbles: _b, cloudy: _c, ...rest } = l
  return rest
}

/**
 * The invariants of section 9: every gas layer goes last, every amount is 0 to 1, and the amounts of the layers that
 * are not a gas add up to at most 1 (a layer that would overflow is cut). Amounts are kept to 4 decimal places.
 */
export function normaliseLayers(layers: readonly Layer[]): Layer[] {
  const out: Layer[] = []
  let filled = 0
  for (const raw of layers) {
    if (raw.kind === 'gas') continue
    const l = tidy(raw)
    const amount = clamp(round4(Number.isFinite(l.amount) ? l.amount : 0), 0, Math.max(0, round4(1 - filled)))
    filled += amount
    out.push(amount === l.amount ? l : { ...l, amount })
  }
  for (const raw of layers) if (raw.kind === 'gas') out.push(tidy(raw))
  return out
}

const sameLayers = (a: readonly Layer[], b: readonly Layer[]) =>
  a.length === b.length && a.every((l, i) => l === b[i] || (Object.keys(l).length === Object.keys(b[i]).length && Object.entries(l).every(([k, v]) => b[i][k as keyof Layer] === v)))

function withLayers(doc: Doc, id: Id, cavity: string, layers: readonly Layer[]): Doc {
  const it = doc.items[id]
  if (!it || it.type !== 'symbol') return doc
  const next = normaliseLayers(layers)
  const current = it.contents[cavity]
  if (current ? sameLayers(current, next) : next.length === 0) return doc
  const contents = { ...it.contents }
  if (next.length) contents[cavity] = next
  else delete contents[cavity]
  const item: Item = { ...it, contents }
  return { ...doc, items: { ...doc.items, [id]: item } }
}

const layersOf = (doc: Doc, id: Id, cavity: string): readonly Layer[] => {
  const it = doc.items[id]
  return it?.type === 'symbol' ? (it.contents[cavity] ?? []) : []
}

// ---------------------------------------------------------------- layers

/** Replace the layers of a cavity. An empty list empties the cavity. */
export const setLayers = (doc: Doc, id: Id, cavity: string, layers: readonly Layer[]): Doc => withLayers(doc, id, cavity, layers)

export const emptyCavity = (doc: Doc, id: Id, cavity: string): Doc => withLayers(doc, id, cavity, [])

/** The Water quick button. */
export const fillWater = (doc: Doc, id: Id, cavity: string): Doc => withLayers(doc, id, cavity, [waterLayer()])

/**
 * Add a layer on top of the layers that are not a gas (a gas stays last). The default is a layer of water that takes
 * a quarter of the cavity, or what is left. A cavity holds at most MAX_LAYERS layers.
 */
export function addLayer(doc: Doc, id: Id, cavity: string, layer?: Partial<Layer>): Doc {
  const layers = layersOf(doc, id, cavity)
  if (layers.length >= MAX_LAYERS) return doc
  const room = Math.max(0, 1 - filledAmount(layers))
  const fresh: Layer = { kind: 'liquid', colour: WATER_COLOUR, amount: Math.min(0.25, room), ...layer }
  if (fresh.kind === 'gas') return withLayers(doc, id, cavity, [...layers, fresh])
  const at = topLayerIndex(layers) + 1
  return withLayers(doc, id, cavity, [...layers.slice(0, at), fresh, ...layers.slice(at)])
}

export function removeLayer(doc: Doc, id: Id, cavity: string, index: number): Doc {
  const layers = layersOf(doc, id, cavity)
  if (index < 0 || index >= layers.length) return doc
  return withLayers(doc, id, cavity, layers.filter((_, i) => i !== index))
}

/** Change fields of one layer: kind, colour, amount, bubbles, cloudy, meniscus. A layer that becomes a gas moves last. */
export function setLayer(doc: Doc, id: Id, cavity: string, index: number, patch: Partial<Layer>): Doc {
  const layers = layersOf(doc, id, cavity)
  if (index < 0 || index >= layers.length) return doc
  const next: Layer = { ...layers[index], ...patch }
  for (const k of Object.keys(next) as (keyof Layer)[]) if (next[k] === undefined) delete next[k]
  return withLayers(
    doc,
    id,
    cavity,
    layers.map((l, i) => (i === index ? next : l)),
  )
}

/** A preset sets the kind, the colour and the cloudy flag of one layer. */
export function applyPreset(doc: Doc, id: Id, cavity: string, index: number, preset: Preset): Doc {
  return setLayer(doc, id, cavity, index, { kind: preset.kind, colour: preset.colour, cloudy: preset.cloudy ? true : undefined })
}

/**
 * Put the top surface at `filled` (0 to 1 of the cavity): the level handle. It sets the amount of the top layer that
 * is not a gas; the layers below it keep theirs. Nothing happens when every layer is a gas.
 */
export function setFilled(doc: Doc, id: Id, cavity: string, filled: number): Doc {
  const layers = layersOf(doc, id, cavity)
  const top = topLayerIndex(layers)
  if (top < 0) return doc
  const below = filledAmount(layers.slice(0, top))
  return setLayer(doc, id, cavity, top, { amount: clamp(round4(clamp(filled, 0, 1) - below), 0, 1) })
}

// ---------------------------------------------------------------- the reading field

export type ReadingMode =
  /** A symbol with a `scale`, upright, or a measuring cylinder upside down (collecting a gas over water). */
  | { kind: 'scale'; cavity: string; unit: string; upsideDown: boolean; min: number; max: number }
  /** A gas syringe: the reading moves the plunger. */
  | { kind: 'plunger'; unit: string; min: number; max: number }

const syringe = (it: SymbolItem) => hasSymbol(it.symbol) && symbolDef(it.symbol).params?.some((p) => p.key === 'plunger' && p.type === 'number')

/** How the Reading field works for this item, or null when it has none (section 9). */
export function readingMode(it: SymbolItem): ReadingMode | null {
  const g = geometry(it.symbol, it.w, it.h, it.params)
  if (!g.scale) return syringe(it) ? { kind: 'plunger', unit: 'cm³', min: 0, max: 100 } : null
  const upright = it.rot === 0 && !it.flip
  const upsideDown = !upright && it.symbol === 'measuringCylinder' && it.rot === 180
  if (!upright && !upsideDown) return null
  const lo = Math.min(g.scale.v0, g.scale.v1),
    hi = Math.max(g.scale.v0, g.scale.v1)
  return { kind: 'scale', cavity: g.scale.cavity, unit: g.scale.unit, upsideDown, min: lo, max: hi }
}

/** The reading the item shows now, or null when it has no Reading field. */
export function readingOf(it: SymbolItem): number | null {
  const mode = readingMode(it)
  if (!mode) return null
  if (mode.kind === 'plunger') {
    const def = symbolDef(it.symbol).params!.find((p) => p.key === 'plunger')!
    const v = it.params.plunger ?? def.default
    return (typeof v === 'number' ? v : 0) * 100
  }
  const g = geometry(it.symbol, it.w, it.h, it.params)
  return amountToReading(g, filledAmount(it.contents[mode.cavity] ?? []), mode.upsideDown)
}

/**
 * Put the top surface at a reading. An empty cavity first gets one liquid layer (water, or red in a thermometer).
 * Then the top layer that is not a gas takes `readingToAmount` minus the amounts below it, kept between 0 and 1.
 * A gas syringe has no scale: its reading (0 to 100 cm³) sets the `plunger` parameter to the value ÷ 100.
 */
export function setReading(doc: Doc, id: Id, value: number): Doc {
  const it = doc.items[id]
  if (!it || it.type !== 'symbol' || !Number.isFinite(value)) return doc
  const mode = readingMode(it)
  if (!mode) return doc
  if (mode.kind === 'plunger') return setParams(doc, id, { plunger: round4(clamp(value, 0, 100) / 100) })
  const g = geometry(it.symbol, it.w, it.h, it.params)
  const target = readingToAmount(g, value, mode.upsideDown)
  if (target === null) return doc
  let layers = it.contents[mode.cavity] ?? []
  if (topLayerIndex(layers) < 0) {
    layers = [...layers.filter((l) => l.kind !== 'gas'), { kind: 'liquid', amount: 0, colour: it.symbol === 'thermometer' ? THERMOMETER_COLOUR : WATER_COLOUR }, ...layers.filter((l) => l.kind === 'gas')]
  }
  const top = topLayerIndex(layers)
  const below = filledAmount(layers.slice(0, top))
  const amount = clamp(round4(target - below), 0, 1)
  return withLayers(
    doc,
    id,
    mode.cavity,
    layers.map((l, i) => (i === top ? { ...l, amount } : l)),
  )
}
