// contents.ts — the commands for what a cavity holds (section 9 of the specification): layers, presets, the quick
// buttons, the level handle and the Reading field. Each command is pure: (doc, arguments) => doc.
// The commands keep four rules: a gas layer is last, there is at most one gas layer, a cavity holds at most four
// layers, and the amounts of the layers that are not a gas add up to at most 1. The kernel draws the layers
// (src/kernel/contents.ts); nothing here changes how they look.

import type { Layer, LayerKind } from '../kernel/contents'
import { defaultParams, geometry, hasSymbol, symbolDef } from '../symbols/registry'
import { amountToReading, readingToAmount } from '../symbols/scale'
import { setParams } from './commands'
import type { Doc, Id, Item, SymbolItem } from './types'

/** A cavity holds up to four layers. */
export const MAX_LAYERS = 4
/** The Water quick button and the Water preset. */
export const WATER = '#cfe8f7'
/** The liquid that the Reading field puts in an empty thermometer. */
export const THERMOMETER_RED = '#d33333'
/** The gas syringe has no scale: its Reading field moves the plunger (section 9). */
export const GAS_SYRINGE = 'gasSyringe'

export interface Preset {
  name: string
  kind: LayerKind
  colour: string
  cloudy?: boolean
}

/** The preset table of section 9, in its order. A preset sets the kind, the colour and the cloudy flag of a layer. */
export const PRESETS: readonly Preset[] = [
  { name: 'Water', kind: 'liquid', colour: WATER },
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
  { name: "Brick-red precipitate (Benedict's test)", kind: 'powder', colour: '#c8553d' },
  { name: 'Chips or granules', kind: 'lumps', colour: '#e9e9e9' },
  { name: 'Ice', kind: 'lumps', colour: '#eaf4fb' },
  { name: 'Blue crystals (copper sulfate)', kind: 'lumps', colour: '#7fb8e6' },
  { name: 'Pale green gas', kind: 'gas', colour: '#e3efc1' },
  { name: 'Brown gas', kind: 'gas', colour: '#cfa27a' },
]

/** The preset that a layer matches (kind, colour and cloudy flag), if any. */
export const presetOf = (l: Layer): Preset | undefined => PRESETS.find((p) => p.kind === l.kind && p.colour === l.colour && !!p.cloudy === !!l.cloudy)

/** The Water quick button: one liquid layer, half full. */
export const waterLayer = (): Layer => ({ kind: 'liquid', amount: 0.5, colour: WATER })

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
/** Amounts keep six decimal places: a typed reading reads back exactly, and the file stays tidy. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** How full the cavity is, 0 to 1: the sum of the amounts of the layers that are not a gas. */
export const filledAmount = (layers: readonly Layer[]): number =>
  clamp(
    layers.reduce((a, l) => (l.kind === 'gas' ? a : a + Math.max(0, l.amount)), 0),
    0,
    1,
  )

/** The index of the highest layer that is not a gas, or −1. Its surface is the top surface. */
export const topLayerIndex = (layers: readonly Layer[]): number => layers.reduce((a, l, i) => (l.kind === 'gas' ? a : i), -1)

/** A layer that is not a liquid loses the liquid-only fields: meniscus, bubbles, cloudy. */
function tidy(l: Layer): Layer {
  if (l.kind === 'liquid') return l
  const rest: Layer = { kind: l.kind, amount: l.amount, colour: l.colour }
  return Object.keys(rest).length === Object.keys(l).length ? l : rest
}

/**
 * The four rules. The layers that are not a gas keep their order and come first; each amount is 0 to 1 and they add up
 * to at most 1 (a layer that would overflow is cut). Then the gas: only the last gas layer stays. At most four layers
 * stay; when there are more, the highest layers that are not a gas go.
 */
export function normaliseLayers(layers: readonly Layer[]): Layer[] {
  const gas = layers.filter((l) => l.kind === 'gas').at(-1)
  const rest = layers.filter((l) => l.kind !== 'gas').slice(0, gas ? MAX_LAYERS - 1 : MAX_LAYERS)
  const out: Layer[] = []
  let filled = 0
  for (const raw of rest) {
    const l = tidy(raw)
    const amount = clamp(round6(Number.isFinite(l.amount) ? l.amount : 0), 0, round6(1 - filled))
    filled += amount
    out.push(amount === l.amount ? l : { ...l, amount })
  }
  if (gas) {
    const l = tidy(gas)
    const amount = clamp(Number.isFinite(l.amount) ? l.amount : 0, 0, 1)
    out.push(amount === l.amount ? l : { ...l, amount })
  }
  return out
}

const sameLayer = (a: Layer, b: Layer) =>
  a === b || (Object.keys(a).length === Object.keys(b).length && (Object.keys(a) as (keyof Layer)[]).every((k) => a[k] === b[k]))

/** Put layers in a cavity, normalised. An empty list removes the cavity's entry. The same document when nothing changes. */
function withLayers(doc: Doc, id: Id, cavity: string, layers: readonly Layer[]): Doc {
  const it = doc.items[id]
  if (!it || it.type !== 'symbol') return doc
  const next = normaliseLayers(layers)
  const current = it.contents[cavity] ?? []
  if (current.length === next.length && current.every((l, i) => sameLayer(l, next[i])) && (next.length > 0 || !(cavity in it.contents))) return doc
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

/** Replace the layers of a cavity, bottom layer first. An empty list empties the cavity. */
export const setLayers = (doc: Doc, id: Id, cavity: string, layers: readonly Layer[]): Doc => withLayers(doc, id, cavity, layers)

/** The Empty quick button. */
export const emptyCavity = (doc: Doc, id: Id, cavity: string): Doc => withLayers(doc, id, cavity, [])

/** The Water quick button: the cavity holds one liquid layer, amount 0.5, colour #cfe8f7. */
export const fillWater = (doc: Doc, id: Id, cavity: string): Doc => withLayers(doc, id, cavity, [waterLayer()])

/**
 * The Add layer button. The new layer goes on top of the layers that are not a gas, under a gas. By default it is water
 * that takes a quarter of the cavity, or the room that is left. A cavity that holds four layers takes no more.
 */
export function addLayer(doc: Doc, id: Id, cavity: string, layer: Partial<Layer> = {}): Doc {
  const layers = layersOf(doc, id, cavity)
  if (layers.length >= MAX_LAYERS) return doc
  const fresh: Layer = { kind: 'liquid', colour: WATER, amount: round6(Math.min(0.25, 1 - filledAmount(layers))), ...layer }
  if (fresh.kind === 'gas') return withLayers(doc, id, cavity, [...layers, fresh])
  const at = topLayerIndex(layers) + 1
  return withLayers(doc, id, cavity, [...layers.slice(0, at), fresh, ...layers.slice(at)])
}

export function removeLayer(doc: Doc, id: Id, cavity: string, index: number): Doc {
  const layers = layersOf(doc, id, cavity)
  if (!(index >= 0 && index < layers.length)) return doc
  return withLayers(
    doc,
    id,
    cavity,
    layers.filter((_, i) => i !== index),
  )
}

/**
 * Change fields of one layer: kind, colour, amount, bubbles, cloudy, meniscus. A field set to undefined is removed.
 * A layer that becomes a gas goes last and replaces any other gas. A layer that is not a gas takes at most the room
 * that the other layers leave, so the total stops at 1 and no other layer changes.
 */
export function setLayer(doc: Doc, id: Id, cavity: string, index: number, patch: Partial<Layer>): Doc {
  const layers = layersOf(doc, id, cavity)
  if (!(index >= 0 && index < layers.length)) return doc
  const next: Layer = { ...layers[index], ...patch }
  for (const k of Object.keys(next) as (keyof Layer)[]) if (next[k] === undefined) delete next[k]
  const others = layers.filter((_, i) => i !== index)
  if (next.kind === 'gas') return withLayers(doc, id, cavity, [...others, next])
  next.amount = clamp(Number.isFinite(next.amount) ? next.amount : 0, 0, Math.max(0, 1 - filledAmount(others)))
  return withLayers(
    doc,
    id,
    cavity,
    layers.map((l, i) => (i === index ? next : l)),
  )
}

/** A preset sets the kind, the colour and the cloudy flag of one layer. */
export const applyPreset = (doc: Doc, id: Id, cavity: string, index: number, preset: Preset): Doc =>
  setLayer(doc, id, cavity, index, { kind: preset.kind, colour: preset.colour, cloudy: preset.cloudy ? true : undefined })

/**
 * Put the top surface at `filled` (0 to 1 of the cavity's height as it stands): the level handle. It changes only the
 * amount of the top layer that is not a gas; the layers below keep theirs. A cavity with no such layer is unchanged.
 */
export function setFilled(doc: Doc, id: Id, cavity: string, filled: number): Doc {
  const layers = layersOf(doc, id, cavity)
  const top = topLayerIndex(layers)
  if (top < 0 || !Number.isFinite(filled)) return doc
  return setLayer(doc, id, cavity, top, { amount: clamp(filled, 0, 1) - filledAmount(layers.slice(0, top)) })
}

// ---------------------------------------------------------------- the Reading field

export type ReadingMode =
  /** A symbol with a `scale` that stands upright, or a measuring cylinder upside down (a gas collected over water). */
  | { kind: 'scale'; cavity: string; unit: string; upsideDown: boolean; min: number; max: number }
  /** A gas syringe: the reading moves the plunger. */
  | { kind: 'plunger'; unit: string; min: number; max: number }

/** How the Reading field works for an item, or null when the item shows no Reading field (section 9). */
export function readingMode(it: SymbolItem): ReadingMode | null {
  if (it.symbol === GAS_SYRINGE && hasSymbol(GAS_SYRINGE)) return { kind: 'plunger', unit: 'cm³', min: 0, max: 100 }
  const s = geometry(it.symbol, it.w, it.h, it.params).scale
  if (!s) return null
  const upright = it.rot === 0 && !it.flip
  const upsideDown = it.symbol === 'measuringCylinder' && it.rot === 180
  if (!upright && !upsideDown) return null
  return { kind: 'scale', cavity: s.cavity, unit: s.unit, upsideDown, min: Math.min(s.v0, s.v1), max: Math.max(s.v0, s.v1) }
}

/** The reading that the item shows now. Null when it has no Reading field, or when its scale's cavity is empty. */
export function readingOf(it: SymbolItem): number | null {
  const mode = readingMode(it)
  if (!mode) return null
  if (mode.kind === 'plunger') {
    const v = it.params.plunger ?? defaultParams(symbolDef(it.symbol)).plunger
    return typeof v === 'number' ? round6(v * 100) : null
  }
  const layers = it.contents[mode.cavity] ?? []
  if (topLayerIndex(layers) < 0) return null
  return amountToReading(geometry(it.symbol, it.w, it.h, it.params), filledAmount(layers), mode.upsideDown)
}

/**
 * Type a reading (section 9). On a scale, the top surface goes to that reading: an empty cavity first gets one liquid
 * layer (water, or red in a thermometer); then the top layer that is not a gas takes `readingToAmount` minus the
 * amounts of the layers below it, kept between 0 and 1. Upside down, the value is the volume of gas above the water.
 * A gas syringe has no scale: its reading (0 to 100 cm³) sets the `plunger` parameter to the value ÷ 100.
 */
export function setReading(doc: Doc, id: Id, value: number): Doc {
  const it = doc.items[id]
  if (!it || it.type !== 'symbol' || !Number.isFinite(value)) return doc
  const mode = readingMode(it)
  if (!mode) return doc
  if (mode.kind === 'plunger') return setParams(doc, id, { plunger: round6(clamp(value, 0, 100) / 100) })
  const target = readingToAmount(geometry(it.symbol, it.w, it.h, it.params), value, mode.upsideDown)
  if (target === null) return doc
  let layers = it.contents[mode.cavity] ?? []
  if (topLayerIndex(layers) < 0) layers = [{ kind: 'liquid', amount: 0, colour: it.symbol === 'thermometer' ? THERMOMETER_RED : WATER }, ...layers]
  const top = topLayerIndex(layers)
  const amount = clamp(target - filledAmount(layers.slice(0, top)), 0, 1)
  return withLayers(
    doc,
    id,
    mode.cavity,
    layers.map((l, i) => (i === top ? { ...l, amount } : l)),
  )
}
