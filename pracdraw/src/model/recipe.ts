// recipe.ts — a recipe is a short JSON description of a diagram. `compileRecipe` turns it into a `Doc` with the editor's
// own maths: parts are placed by anchors (`moveAnchorTo` and `anchorWorld`, as `DocBuilder.at`, `.on` and `.near` do),
// contents follow the layer rules of section 9 (with `readingToAmount` for a reading), connectors are the kinds of
// section 10, and the labels are "Label all" (`autoLabels`, section 11) plus the manual labels of the recipe.
// Pure: no DOM. Every mistake is a `Problem` with the path where it is and a hint that names the fix; all of them are
// collected, not only the first. A recipe with an error gives no document.
//
// The format in one screen (the skill .claude/skills/pracdraw/SKILL.md has worked examples):
//
//   { "title": "...", "settings": { "labelMode": "text", "mono": false, "labelSize": 15, "smartText": true },
//     "parts": [ { "id": "mat", "symbol": "heatproofMat", "at": { "x": 0, "y": 0, "anchor": "under" } },
//                { "id": "beaker", "symbol": "beaker", "on": { "part": "gauze", "anchor": "top", "own": "base" },
//                  "size": { "w": 100 }, "params": {}, "contents": { "main": [{ "preset": "Water", "amount": 0.6 }] } } ],
//     "connectors": [ { "kind": "glassTube", "points": [{ "part": "bung", "anchor": "hole1", "out": -30 }, { "dy": -60 }, { "dx": 120 }] } ],
//     "labels": { "auto": true, "text": { "beaker": "250 cm3 beaker" }, "skip": ["mat"], "extra": [{ "text": "water", "part": "beaker", "at": [10, 90] }] } }
//
// Parts are placed in list order, each on parts listed before it (a reference to a part that comes later is an error),
// and drawn in list order (back to front) unless a part says `"behind": "<id>"` (just behind that part) or `"back": true`
// (behind all the others). Connectors are drawn after all the parts unless they say `"behind"` or `"back"` too.
// A part is placed by `on` (its anchor `own` on an anchor), `near` (its centre near an anchor), `at` (a point of the world),
// and `alignX` / `alignY` (one coordinate each, from different anchors). A size can be `{ "between": [point, point] }`.
// A connector point is an anchor, a step `{ dx, dy }`, a point `{ x, y }`, or an axis run `{ y: <anchor> }` (upright or level
// from the point before). `labels.side` moves one automatic label to the other side; `labels.extra` adds labels by hand.

import { P, type Pt, type V } from '../kernel/geom'
import type { Layer, LayerKind } from '../kernel/contents'
import { labelPoint } from '../symbols/label'
import { SYMBOLS, defaultParams, geometry, hasSymbol, labelText, symbolDef } from '../symbols/registry'
import { readingToAmount } from '../symbols/scale'
import type { Anchor, Geometry, ParamDef, SymbolDef } from '../symbols/types'
import { LABEL_GAP, autoLabels, spaceColumn, uncrossColumn, type Placed } from './autoLabel'
import { itemsBox, labelTarget } from './bounds'
import { anchorWorld, moveAnchorTo } from './build'
import { normRot } from './commands'
import { KIND_DEFAULTS, RADIUS_RANGE, WIDTH_RANGE, capsFor, isDrawable, isTube, makeConnector } from './connectors'
import { MAX_LAYERS, PRESETS, THERMOMETER_RED, WATER, readingMode, type Preset } from './contents'
import { LABEL_SIZE_RANGE, LEADER_ENDS, makeLabel } from './labels'
import { COLOUR, parseDoc } from './parse'
import { toWorld, worldMatrix } from './transform'
import {
  DEFAULT_SETTINGS,
  newDoc,
  type Cap,
  type ConnectorItem,
  type ConnectorKind,
  type Doc,
  type DocSettings,
  type Id,
  type LabelItem,
  type ParamValue,
  type SymbolItem,
  type Target,
} from './types'

// ---------------------------------------------------------------- the types

/** One thing wrong with a recipe (or, from `checkDoc`, with a document). */
export interface Problem {
  level: 'error' | 'warning'
  /** Where, as a path into the recipe: `parts[2].symbol`. For a document check, the id of the item. */
  path: string
  message: string
  /** What to do about it. */
  hint: string
}

/** A point on a part: one of its anchors, moved by (dx, dy) in the world, and by `out` along the anchor's direction. */
export interface AnchorRef {
  part: string
  anchor: string
  dx?: number
  dy?: number
  /** Along the anchor's outward direction, as the part is turned; negative goes back into the part. */
  out?: number
}
/** The anchor `own` of the part that is being placed goes on the point. */
export interface OnSpec extends AnchorRef {
  own: string
}
export interface AtSpec {
  x: number
  y: number
  /** The part's own anchor that goes on (x, y); without it, the centre of the part does. */
  anchor?: string
}
/** A size: a number, or the distance between two points (a clamp stand as tall as from the bench to above its clamp). */
export type SizeSpec = number | { between: [AnchorRef, AnchorRef] }
/** A coordinate of a point: a number, or the same coordinate of an anchor (with its shifts). */
export type CoordinateSpec = number | AnchorRef
/**
 * A point of a connector: an anchor of a part, or x and y (each a number or an anchor; with one of them left out, the
 * point goes level or upright from the point before), or a step (dx, dy) from the point before. `r` is the bend radius.
 */
export type PointSpec = ({ r?: number } & AnchorRef) | { x?: CoordinateSpec; y?: CoordinateSpec; r?: number } | { dx?: number; dy?: number; r?: number }

export interface LayerSpec {
  preset?: string
  kind?: LayerKind
  colour?: string
  /** A fraction from 0 to 1 of the cavity's height. */
  amount?: number
  /** A value on the scale of the symbol: the surface of this layer goes there. */
  reading?: number
  meniscus?: boolean
  bubbles?: 'none' | 'few' | 'many'
  cloudy?: boolean
}

export interface PartSpec {
  id: string
  symbol: string
  on?: OnSpec
  near?: AnchorRef
  at?: AtSpec
  alignX?: OnSpec
  alignY?: OnSpec
  rot?: number
  flip?: boolean
  /** `w` and `h` are numbers, or { "between": [point, point] }: the distance between two anchors. */
  size?: { w?: SizeSpec; h?: SizeSpec }
  params?: Record<string, ParamValue>
  contents?: Record<string, LayerSpec[]>
  /** Draw this part just behind another part (a clamp behind the vessel it grips). */
  behind?: string
  /** Draw this part behind all the others (a clamp stand). */
  back?: boolean
  note?: string
}

export interface ConnectorSpec {
  id?: string
  kind: ConnectorKind
  points: PointSpec[]
  width?: number
  radius?: number
  dash?: boolean
  startCap?: Cap
  endCap?: Cap
  /** Connectors are drawn after all the parts; this one is drawn just behind a part instead. */
  behind?: string
  back?: boolean
  note?: string
}

export interface ExtraLabelSpec {
  text: string
  /** The leader ends on this part ... */
  part?: string
  /** ... at one of its anchors, or at a point [lx, ly] of its own frame; with neither, at the usual leader point of Label all. */
  anchor?: string
  at?: [number, number]
  /** ... or on this connector (it needs an "id"), a fraction `along` (0 to 1, default 0.5) of the way along it ... */
  connector?: string
  along?: number
  /** ... or at a point of the world. */
  point?: { x: number; y: number }
  /** Plain text with no leader, at this point. */
  near?: AnchorRef
  side?: 'left' | 'right'
  /** Where the text starts, as an offset from where the leader ends. Without it the text goes in a column with the others. */
  textAt?: [number, number]
  end?: LabelItem['leaderEnd']
  size?: number
  note?: string
}

export interface LabelsSpec {
  auto?: boolean
  text?: Record<string, string>
  skip?: string[]
  extra?: ExtraLabelSpec[]
}

export interface Recipe {
  title?: string
  settings?: Partial<DocSettings>
  parts: PartSpec[]
  connectors?: ConnectorSpec[]
  labels?: LabelsSpec
  note?: string
}

export interface RecipeResult {
  doc: Doc | null
  problems: Problem[]
  /** One line for each part: how it was placed. */
  explain: string[]
}

/** The presets that a recipe has besides the table of section 9. */
export const RECIPE_PRESETS: readonly Preset[] = [
  { name: 'Thermometer red', kind: 'liquid', colour: THERMOMETER_RED },
  { name: 'Colourless gas', kind: 'gas', colour: '#ffffff' },
]

// ---------------------------------------------------------------- small helpers

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** True when a JSON value looks like a recipe (it has a list of parts) and not like a saved document. */
export const isRecipe = (value: unknown): boolean => isObj(value) && Array.isArray(value.parts)

const r3 = (n: number) => Math.round(n * 1000) / 1000
const r6 = (n: number) => Math.round(n * 1e6) / 1e6
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const quote = (s: string) => `"${s}"`
const list = (items: readonly string[]) => items.map(quote).join(', ')
/** A number as the messages show it: no more than 3 decimals. */
const show = (n: number) => String(r3(n))
const join = (path: string, key: string) => (path ? `${path}.${key}` : key)

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length]
}

/** The names nearest to a wrong one by edit distance, best first. Names that are no near match are left out. */
export function nearestNames(wanted: string, names: readonly string[], max = 3): string[] {
  const w = squash(wanted)
  if (!w) return []
  const reach = Math.max(1, Math.floor(w.length / 3))
  return names
    .map((name) => {
      const n = squash(name)
      const d = n && (n.includes(w) || w.includes(n)) ? Math.abs(n.length - w.length) / 2 : distance(w, n)
      return { name, d }
    })
    .filter((x) => x.d <= reach)
    .sort((a, b) => a.d - b.d || a.name.localeCompare(b.name))
    .slice(0, max)
    .map((x) => x.name)
}

/**
 * The symbols that a wrong symbol id may have meant: the nearest ids by edit distance, and the symbols found by alias
 * search (every word of the wrong id is in the id, the name or an alias of the symbol).
 */
export function suggestSymbols(wanted: string, max = 5): SymbolDef[] {
  const words = wanted
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s_\-.]+/)
    .filter(Boolean)
  const alias = words.length
    ? SYMBOLS.filter((d) => {
        const names = [d.id, d.name, ...(d.aliases ?? [])].map((n) => n.toLowerCase())
        return words.every((w) => names.some((n) => n.includes(w)))
      })
    : []
  const near = nearestNames(
    wanted,
    SYMBOLS.map((d) => d.id),
  ).map((id) => symbolDef(id))
  const out: SymbolDef[] = []
  for (const d of [...near.slice(0, 2), ...alias.slice(0, 3), ...near.slice(2)]) if (!out.includes(d)) out.push(d)
  return out.slice(0, max)
}

const didYouMean = (wanted: string, names: readonly string[]): string => {
  const near = nearestNames(wanted, names, 1)
  return near.length ? ` Did you mean ${quote(near[0])}?` : ''
}

/** "top (surface), under (base)": the anchors of a drawing with their kinds. */
const anchorList = (g: Geometry): string => (g.anchors ?? []).map((a) => `${a.id} (${a.kind})`).join(', ') || 'none'

// ---------------------------------------------------------------- the context of one compile

class Ctx {
  problems: Problem[] = []
  error(path: string, message: string, hint = ''): void {
    this.problems.push({ level: 'error', path, message, hint })
  }
  warn(path: string, message: string, hint = ''): void {
    this.problems.push({ level: 'warning', path, message, hint })
  }
  /** True when an error has been recorded since the problem count `from`. */
  failedSince(from: number): boolean {
    return this.problems.slice(from).some((p) => p.level === 'error')
  }
}

/** An object whose keys are known. An unknown key is an error: a misspelt key would otherwise change nothing, silently. */
function readObject(ctx: Ctx, path: string, v: unknown, keys: readonly string[], what: string): Obj | null {
  if (!isObj(v)) {
    ctx.error(path, `${what[0].toUpperCase()}${what.slice(1)} must be an object { ... }.`, 'Write it as { "key": value, ... }.')
    return null
  }
  for (const k of Object.keys(v)) {
    if (!keys.includes(k)) ctx.error(join(path, k), `Unknown key ${quote(k)} in ${what}.`, `The keys here are: ${keys.join(', ')}.${didYouMean(k, keys)}`)
  }
  return v
}

function readString(ctx: Ctx, path: string, v: unknown, what: string): string | undefined {
  if (typeof v === 'string' && v !== '') return v
  ctx.error(path, `${what} must be text.`, 'Write it in double quotes, for example "beaker".')
  return undefined
}

function readNumber(ctx: Ctx, path: string, v: unknown, what: string): number | undefined {
  if (isNum(v)) return v
  ctx.error(path, `${what} must be a number.`, 'Write a plain number such as 12 or 0.5, with no quotes.')
  return undefined
}

function readBool(ctx: Ctx, path: string, v: unknown, what: string): boolean | undefined {
  if (typeof v === 'boolean') return v
  ctx.error(path, `${what} must be true or false.`, 'Write true or false, with no quotes.')
  return undefined
}

// ---------------------------------------------------------------- presets

const ALL_PRESETS: readonly Preset[] = [...PRESETS, ...RECIPE_PRESETS]
const shortName = (p: Preset) => p.name.replace(/\s*\(.*?\)\s*$/, '').trim()

/** A preset by name: the whole name, or the name without its bracketed part ("Blue" for "Blue (copper sulfate)"), ignoring case. */
export function presetByName(name: string): Preset | undefined {
  const w = name.trim().toLowerCase()
  const whole = ALL_PRESETS.find((p) => p.name.toLowerCase() === w)
  if (whole) return whole
  const short = ALL_PRESETS.filter((p) => shortName(p).toLowerCase() === w)
  return short.length === 1 ? short[0] : undefined
}

// ---------------------------------------------------------------- anchors

/** An anchor of a drawing by id, or by kind when only one anchor has that kind. A string says why not ('' = no such anchor). */
function findAnchor(g: Geometry, name: string): Anchor | string {
  const anchors = g.anchors ?? []
  const byId = anchors.find((a) => a.id === name)
  if (byId) return byId
  const byKind = anchors.filter((a) => a.kind === name)
  if (byKind.length === 1) return byKind[0]
  if (byKind.length > 1) return `${quote(name)} is the kind of ${byKind.length} anchors (${byKind.map((a) => a.id).join(', ')}), so it does not say which one`
  return ''
}

/** The outward direction of an anchor in the world, as a unit vector, or null when the anchor has no direction. */
function anchorDirection(it: SymbolItem, a: Anchor): Pt | null {
  if (a.dir === undefined) return null
  const t = (a.dir * Math.PI) / 180
  const m = worldMatrix(it)
  const ux = Math.cos(t),
    uy = Math.sin(t)
  return P(m[0] * ux + m[2] * uy, m[1] * ux + m[3] * uy)
}

interface PartRec {
  id: string
  index: number
  item: SymbolItem
  def: SymbolDef
}

interface PartState {
  ctx: Ctx
  /** The id of each part by its place in the list ('' when the id is not valid). */
  ids: string[]
  /** The valid ids, in list order, for the hints. */
  names: string[]
  index: Map<string, number>
  /** The parts that were built, by id, in list order. */
  built: Map<string, PartRec>
  /** The ids of the parts that each part is placed by or sized from (its "on", "near", "alignX", "alignY" and "size"). */
  deps: Map<string, string[]>
}

const idList = (st: PartState): string => (st.names.length ? list(st.names) : 'none')

/** The ids of the parts that the placement and the size of a part refer to: every "part" in `on`, `near`, `alignX`, `alignY` and `size`. */
function placementRefs(o: Obj): string[] {
  const found: string[] = []
  const scan = (v: unknown, depth: number): void => {
    if (depth > 6) return
    if (Array.isArray(v)) for (const x of v) scan(x, depth + 1)
    else if (isObj(v)) {
      for (const [k, x] of Object.entries(v)) {
        if (k === 'part' && typeof x === 'string') found.push(x)
        else scan(x, depth + 1)
      }
    }
  }
  for (const key of ['on', 'near', 'alignX', 'alignY', 'size']) scan(o[key], 0)
  return found
}

/**
 * The placements that go round in a circle, when `me` names `first` and `first` depends on `me` (through any other
 * parts): `[me, first, ..., me]`. Null when `first` does not depend on `me`.
 */
function placementCycle(st: PartState, me: string, first: string): string[] | null {
  const seen = new Set<string>()
  const walk = (id: string, trail: string[]): string[] | null => {
    if (id === me) return [...trail, id]
    if (seen.has(id)) return null
    seen.add(id)
    for (const next of st.deps.get(id) ?? []) {
      const found = walk(next, [...trail, id])
      if (found) return found
    }
    return null
  }
  const path = walk(first, [])
  return path ? [me, ...path] : null
}

/** The anchor of a part that a name stands for, or null with a problem recorded. */
function refAnchor(ctx: Ctx, path: string, p: PartRec, name: string): Anchor | null {
  const g = geometry(p.item.symbol, p.item.w, p.item.h, p.item.params)
  const a = findAnchor(g, name)
  if (typeof a !== 'string') return a
  if (a)
    ctx.error(path, `${a[0].toUpperCase()}${a.slice(1)}.`, `Use the id of one of them. The anchors of ${quote(p.id)} (${p.item.symbol}) are: ${anchorList(g)}.`)
  else {
    ctx.error(
      path,
      `The part ${quote(p.id)} (${p.item.symbol}) has no anchor ${quote(name)}.`,
      `Its anchors are: ${anchorList(g)}.${didYouMean(
        name,
        (g.anchors ?? []).map((x) => x.id),
      )} A kind such as "surface" also works when only one anchor has that kind.`,
    )
  }
  return null
}

/**
 * The part that a reference names, when it is a built part that comes before `current` in the list (`current` = the
 * length of the list when a connector or a label refers to it: any part). Null when there is none; a problem is
 * recorded unless the part is broken already.
 */
function refPart(st: PartState, path: string, id: string, current: number, what: string): PartRec | null {
  const at = st.index.get(id)
  if (at === undefined) {
    st.ctx.error(path, `${what} names ${quote(id)}, which is not a part.`, `The part ids are: ${idList(st)}.${didYouMean(id, st.names)}`)
    return null
  }
  const me = st.ids[current]
  if (at === current) {
    st.ctx.error(path, `${what} names the part itself.`, 'A part is placed on another part: name one that is listed before it.')
    return null
  }
  if (at > current) {
    const cycle = placementCycle(st, me, id)
    if (cycle) {
      st.ctx.error(
        path,
        `The placements go round in a circle: ${cycle.map(quote).join(' -> ')}.`,
        'A part can only refer to parts that do not depend on it, so moving one of them in the list does not help. Break the circle: give one of them an "at" (a point of the world) or a plain number for its "size", and list each part after the parts it refers to.',
      )
      return null
    }
    st.ctx.error(
      path,
      `${what} names ${quote(id)}, which comes later in the list than ${quote(me)}.`,
      `A part is placed on parts that are listed before it: move ${quote(id)} above ${quote(me)} in the list. If ${quote(me)} must be drawn behind ${quote(id)} (a stand behind its clamp), list ${quote(me)} after ${quote(id)} and add "behind": ${quote(id)} to ${quote(me)} (or "back": true to draw it behind everything).`,
    )
    return null
  }
  return st.built.get(id) ?? null
}

interface ResolvedRef {
  part: PartRec
  anchor: Anchor
  /** The point in the world: the anchor, moved by `out`, `dx` and `dy`. */
  point: Pt
  /** The `own` anchor, when the reference has one. */
  own?: string
}

/** Any part may be named (a connector, a label). */
const ANY_PART = Number.MAX_SAFE_INTEGER
const REF_KEYS = ['part', 'anchor', 'dx', 'dy', 'out']

/**
 * An anchor reference { part, anchor, dx?, dy?, out? }, with `own` when `own` is true. Null when it is wrong, with the
 * problems recorded. `extra` adds keys that the object may hold besides (a connector point's `r`).
 */
function readRef(st: PartState, path: string, v: unknown, current: number, own: boolean, extra: readonly string[] = []): ResolvedRef | null {
  const ctx = st.ctx
  const o = readObject(ctx, path, v, [...REF_KEYS, ...(own ? ['own'] : []), ...extra], own ? 'this placement' : 'this point')
  if (!o) return null
  const from = ctx.problems.length
  const pid = readString(ctx, join(path, 'part'), o.part, 'The "part" of a reference')
  const aid = readString(ctx, join(path, 'anchor'), o.anchor, 'The "anchor" of a reference')
  const num = (key: 'dx' | 'dy' | 'out'): number => (o[key] === undefined ? 0 : (readNumber(ctx, join(path, key), o[key], `The "${key}" of a reference`) ?? 0))
  const dx = num('dx'),
    dy = num('dy'),
    out = num('out')
  const ownId = own ? readString(ctx, join(path, 'own'), o.own, 'The "own" anchor (an anchor of the part that is being placed)') : undefined
  if (!pid || !aid || (own && !ownId) || ctx.failedSince(from)) return null
  const part = refPart(st, join(path, 'part'), pid, current, 'This reference')
  if (!part) return null
  const anchor = refAnchor(ctx, join(path, 'anchor'), part, aid)
  if (!anchor) return null
  let point = toWorld(part.item, P(anchor.x, anchor.y))
  if (out) {
    const dir = anchorDirection(part.item, anchor)
    if (!dir) {
      ctx.error(
        join(path, 'out'),
        `The anchor ${quote(anchor.id)} of ${quote(part.id)} has no direction, so "out" cannot be used.`,
        'Use "dx" and "dy" (world units, y down) instead.',
      )
      return null
    }
    point = P(point.x + dir.x * out, point.y + dir.y * out)
  }
  return { part, anchor, point: P(point.x + dx, point.y + dy), own: ownId }
}

// ---------------------------------------------------------------- parameters, size, contents

const PART_KEYS = ['id', 'symbol', 'on', 'near', 'at', 'alignX', 'alignY', 'rot', 'flip', 'size', 'params', 'contents', 'behind', 'back', 'note']

function paramRange(p: ParamDef): string {
  if (p.type === 'number') return `${p.step === 1 ? 'a whole number' : 'a number'} from ${p.min} to ${p.max}`
  if (p.type === 'choice') return `one of ${p.options.map((o) => quote(o.value)).join(', ')}`
  if (p.type === 'boolean') return 'true or false'
  return 'text'
}

const paramList = (def: SymbolDef): string =>
  (def.params ?? [])
    .map((p) => `${p.key} (${p.type === 'number' ? `${p.min}..${p.max}` : p.type === 'choice' ? p.options.map((o) => o.value).join('|') : p.type})`)
    .join(', ')

/** The parameters of a part, checked against the symbol's definition. A value equal to the default is not stored. */
function readParams(ctx: Ctx, path: string, def: SymbolDef, v: unknown): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  if (!isObj(v)) {
    ctx.error(
      path,
      'The "params" of a part must be an object { ... }.',
      `Write it as { "key": value }.${def.params?.length ? ` ${def.id} has: ${paramList(def)}.` : ''}`,
    )
    return out
  }
  const defaults = defaultParams(def)
  for (const [key, raw] of Object.entries(v)) {
    const p = def.params?.find((q) => q.key === key)
    const at = join(path, key)
    if (!p) {
      ctx.error(
        at,
        `${def.id} has no parameter ${quote(key)}.`,
        def.params?.length
          ? `Its parameters are: ${paramList(def)}.${didYouMean(
              key,
              def.params.map((q) => q.key),
            )}`
          : `${def.id} has no parameters at all: remove "params".`,
      )
      continue
    }
    let value: ParamValue | undefined
    if (p.type === 'boolean') {
      if (typeof raw === 'boolean') value = raw
    } else if (p.type === 'number') {
      if (isNum(raw) && raw >= p.min && raw <= p.max && (p.step !== 1 || Number.isInteger(raw))) value = raw
    } else if (p.type === 'choice') {
      const s = typeof raw === 'number' ? String(raw) : raw
      if (typeof s === 'string' && p.options.some((o) => o.value === s)) value = s
    } else if (typeof raw === 'string' || isNum(raw)) value = String(raw)
    if (value === undefined) {
      const shown = typeof raw === 'string' ? quote(raw) : isNum(raw) || typeof raw === 'boolean' ? String(raw) : 'that value'
      ctx.error(at, `The parameter ${quote(key)} of ${def.id} cannot be ${shown}.`, `${key} must be ${paramRange(p)}.`)
      continue
    }
    if (value !== defaults[key]) out[key] = value
  }
  return out
}

/** The size of a part: its own, or what the recipe asks for, within what its resize mode allows. */
function readSize(st: PartState, current: number, path: string, def: SymbolDef, v: unknown): { w: number; h: number } {
  const ctx = st.ctx
  const size = { w: def.size.w, h: def.size.h }
  const o = readObject(ctx, path, v, ['w', 'h'], 'the size')
  if (!o) return size
  /** A number, or { "between": [point, point] }: the distance between two anchors, across (w) or up and down (h). */
  const read = (axis: 'w' | 'h'): number | undefined => {
    const value = o[axis]
    if (value === undefined) return undefined
    const at = join(path, axis)
    if (!isObj(value)) return readNumber(ctx, at, value, axis === 'w' ? 'The width "w"' : 'The height "h"')
    readObject(ctx, at, value, ['between'], 'this size')
    const pair = value.between
    if (!Array.isArray(pair) || pair.length !== 2) {
      ctx.error(
        join(at, 'between'),
        'The "between" of a size must be a list of two points.',
        'For example [{ "part": "mat", "anchor": "under" }, { "part": "clamp", "anchor": "sleeve", "dy": -40 }].',
      )
      return undefined
    }
    const [a, b] = pair.map((p, k) => readRef(st, `${at}.between[${k}]`, p, current, false))
    if (!a || !b) return undefined
    return Math.abs(axis === 'w' ? a.point.x - b.point.x : a.point.y - b.point.y)
  }
  let w = read('w')
  let h = read('h')
  if (w !== undefined && !(w > 0 && w <= 4000)) {
    ctx.error(
      join(path, 'w'),
      `The width ${show(w)} is not allowed.`,
      'A size is a number above 0 and at most 4000 (world units: 1 unit is one pixel at 100 % zoom).',
    )
    w = undefined
  }
  if (h !== undefined && !(h > 0 && h <= 4000)) {
    ctx.error(
      join(path, 'h'),
      `The height ${show(h)} is not allowed.`,
      'A size is a number above 0 and at most 4000 (world units: 1 unit is one pixel at 100 % zoom).',
    )
    h = undefined
  }
  const aspect = def.size.w / def.size.h
  const refuse = (key: 'w' | 'h', why: string, fix: string) => ctx.error(join(path, key), `${def.id} ${why}.`, fix)
  switch (def.resize) {
    case 'none':
      if (w !== undefined) refuse('w', 'cannot be resized', 'Remove "size".')
      if (h !== undefined) refuse('h', 'cannot be resized', 'Remove "size".')
      break
    case 'width':
      if (h !== undefined && h !== def.size.h) refuse('h', `can only change its width (its height stays ${def.size.h})`, 'Give "w" only.')
      if (w !== undefined) size.w = w
      break
    case 'height':
      if (w !== undefined && w !== def.size.w) refuse('w', `can only change its height (its width stays ${def.size.w})`, 'Give "h" only.')
      if (h !== undefined) size.h = h
      break
    case 'uniform':
      if (w !== undefined && h !== undefined) {
        if (Math.abs(w / h - aspect) > 0.02 * aspect)
          refuse('h', `keeps its shape (width ÷ height = ${show(aspect)})`, 'Give "w" or "h", not both: the other follows.')
        size.w = w
        size.h = h
      } else if (w !== undefined) {
        size.w = w
        size.h = w / aspect
      } else if (h !== undefined) {
        size.h = h
        size.w = h * aspect
      }
      break
    default:
      if (w !== undefined) size.w = w
      if (h !== undefined) size.h = h
  }
  if (def.min) {
    if (size.w < def.min.w - 1e-9) {
      ctx.error(
        join(path, 'w'),
        `The width ${show(size.w)} of ${def.id} is below its minimum.`,
        `Use at least ${def.min.w} (its smallest size is ${def.min.w} × ${def.min.h}).`,
      )
      size.w = def.min.w
    }
    if (size.h < def.min.h - 1e-9) {
      ctx.error(
        join(path, 'h'),
        `The height ${show(size.h)} of ${def.id} is below its minimum.`,
        `Use at least ${def.min.h} (its smallest size is ${def.min.w} × ${def.min.h}).`,
      )
      size.h = def.min.h
    }
  }
  return size
}

const LAYER_KEYS = ['preset', 'kind', 'colour', 'amount', 'reading', 'meniscus', 'bubbles', 'cloudy']
const LAYER_KINDS: readonly LayerKind[] = ['liquid', 'powder', 'lumps', 'gas']
const BUBBLES: readonly NonNullable<Layer['bubbles']>[] = ['none', 'few', 'many']

/** The symbols that have a scale, for a hint: "measuringCylinder (0..100 cm³)". */
function scaleSymbols(): string {
  return SYMBOLS.flatMap((d) => {
    const s = geometry(d.id, d.size.w, d.size.h).scale
    return s ? [`${d.id} (${s.v0}..${s.v1} ${s.unit})`] : []
  }).join(', ')
}

/** The layers of one cavity, bottom first. Null when something is wrong (the problems are recorded). */
function readLayers(ctx: Ctx, path: string, it: SymbolItem, cavity: string, v: unknown): Layer[] | null {
  if (!Array.isArray(v) || v.length === 0) {
    ctx.error(
      path,
      `The contents of ${quote(cavity)} must be a list of layers [ ... ], bottom layer first.`,
      'For example [{ "preset": "Water", "amount": 0.5 }].',
    )
    return null
  }
  if (v.length > MAX_LAYERS) {
    ctx.error(path, `${quote(cavity)} has ${v.length} layers, and a cavity holds at most ${MAX_LAYERS}.`, `Remove ${v.length - MAX_LAYERS} of them.`)
    return null
  }
  const mode = readingMode(it)
  let bad = false
  let filled = 0
  let sawGas = false
  const layers: Layer[] = []
  v.forEach((raw, i) => {
    const at = `${path}[${i}]`
    const o = readObject(ctx, at, raw, LAYER_KEYS, 'this layer')
    if (!o) {
      bad = true
      return
    }
    const fail = (p: string, message: string, hint: string) => {
      ctx.error(p, message, hint)
      bad = true
    }
    // The kind and the colour: a preset, or a kind with a colour, or a colour alone (a liquid), or nothing (water; the red thread of a thermometer).
    let kind: LayerKind = 'liquid'
    let colour = it.symbol === 'thermometer' ? THERMOMETER_RED : WATER
    let cloudy: boolean | undefined
    if (o.preset !== undefined) {
      if (o.kind !== undefined || o.colour !== undefined)
        fail(at, 'A layer has a "preset" or a "kind" and "colour", not both.', 'Remove "kind" and "colour", or remove "preset".')
      const name = readString(ctx, join(at, 'preset'), o.preset, 'The "preset"')
      if (name === undefined) bad = true
      else {
        const p = presetByName(name)
        if (!p) {
          fail(
            join(at, 'preset'),
            `Unknown preset ${quote(name)}.`,
            `${didYouMean(
              name,
              ALL_PRESETS.map((q) => q.name),
            ).trim()} The presets are: ${ALL_PRESETS.map((q) => q.name).join('; ')}.`.trim(),
          )
        } else {
          kind = p.kind
          colour = p.colour
          cloudy = p.cloudy
        }
      }
    } else {
      if (o.kind !== undefined) {
        if (typeof o.kind === 'string' && (LAYER_KINDS as readonly string[]).includes(o.kind)) kind = o.kind as LayerKind
        else fail(join(at, 'kind'), 'The layer "kind" is not allowed.', `It is one of ${list(LAYER_KINDS)}.`)
      }
      if (o.colour !== undefined) {
        if (typeof o.colour === 'string' && COLOUR.test(o.colour)) colour = o.colour
        else fail(join(at, 'colour'), 'The layer "colour" must be a colour such as "#cfe8f7".', 'Write # and six hex digits, or use a "preset".')
      } else if (o.kind !== undefined && kind !== 'liquid')
        fail(at, `A layer of kind ${quote(kind)} needs a "colour".`, 'Add "colour": "#rrggbb", or use a "preset" (see reference/presets.md).')
    }
    if (o.cloudy !== undefined) cloudy = readBool(ctx, join(at, 'cloudy'), o.cloudy, 'The "cloudy" flag')
    const meniscus = o.meniscus === undefined ? undefined : readBool(ctx, join(at, 'meniscus'), o.meniscus, 'The "meniscus" flag')
    let bubbles: Layer['bubbles']
    if (o.bubbles !== undefined) {
      if (typeof o.bubbles === 'string' && (BUBBLES as readonly string[]).includes(o.bubbles)) bubbles = o.bubbles as Layer['bubbles']
      else fail(join(at, 'bubbles'), 'The "bubbles" of a layer are not allowed.', `They are one of ${list(BUBBLES)}.`)
    }
    if (kind !== 'liquid' && (o.meniscus !== undefined || o.bubbles !== undefined || o.cloudy !== undefined)) {
      fail(at, `A layer of kind ${quote(kind)} cannot have a meniscus, bubbles or cloudiness.`, 'Those are for liquids only: remove them.')
    }
    // The amount.
    let amount = 0
    if (kind === 'gas') {
      if (o.amount !== undefined || o.reading !== undefined)
        fail(at, 'A gas layer has no amount and no reading.', 'A gas fills the space above the other layers: remove "amount" and "reading".')
      if (sawGas) fail(at, 'A cavity holds at most one gas layer.', 'Remove one of them.')
      sawGas = true
    } else {
      if (o.amount !== undefined && o.reading !== undefined) fail(at, 'A layer has an "amount" or a "reading", not both.', 'Remove one of them.')
      if (sawGas) fail(at, 'A gas layer must be the last layer.', 'Put the gas layer after all the others.')
      if (kind === 'lumps' && layers.some((l) => l.kind !== 'lumps')) {
        fail(
          at,
          'Lumps lie at the bottom of a cavity.',
          'Put the lumps layer first (draw ice only when it is packed up to the surface: lumps, then a thin liquid).',
        )
      }
      if (o.reading !== undefined) {
        const value = readNumber(ctx, join(at, 'reading'), o.reading, 'The "reading"')
        const g = geometry(it.symbol, it.w, it.h, it.params)
        if (value === undefined) bad = true
        else if (!g.scale) {
          fail(
            join(at, 'reading'),
            `${it.symbol} has no scale, so "reading" cannot be used.`,
            `Use "amount" (a fraction from 0 to 1) instead. The symbols with a scale are: ${scaleSymbols()}.`,
          )
        } else if (!mode || mode.kind !== 'scale') {
          fail(
            join(at, 'reading'),
            `${it.symbol} has a scale, but a reading works only when it stands upright.`,
            'Remove "rot" and "flip" (a measuringCylinder turned by 180 degrees also takes a reading: the volume of gas collected), or use "amount".',
          )
        } else if (mode.cavity !== cavity) {
          fail(
            join(at, 'reading'),
            `The scale of ${it.symbol} belongs to the cavity ${quote(mode.cavity)}, not ${quote(cavity)}.`,
            `Put the layers with a "reading" under ${quote(mode.cavity)}.`,
          )
        } else if (value < mode.min - 1e-9 || value > mode.max + 1e-9) {
          fail(
            join(at, 'reading'),
            `The reading ${show(value)} is outside the scale of ${it.symbol}.`,
            `The scale runs from ${mode.min} to ${mode.max} ${mode.unit}.`,
          )
        } else {
          const target = readingToAmount(g, value, mode.upsideDown)
          if (target === null) fail(join(at, 'reading'), `The reading ${show(value)} cannot be placed on ${it.symbol}.`, 'Use "amount" instead.')
          else if (target - filled < -1e-9) {
            fail(
              join(at, 'reading'),
              `The reading ${show(value)} is below the layers under it.`,
              'A layer ends higher than the one under it: raise this reading or lower the layers below.',
            )
          } else amount = r6(clamp(target - filled, 0, 1))
        }
      } else if (o.amount !== undefined) {
        const a = readNumber(ctx, join(at, 'amount'), o.amount, 'The "amount"')
        if (a === undefined) bad = true
        else if (a < 0 || a > 1)
          fail(join(at, 'amount'), `The amount ${show(a)} is outside 0 to 1.`, 'An amount is a fraction of the height of the cavity: 0.5 is half full.')
        else amount = a
      } else fail(at, 'A layer needs an "amount" or a "reading".', 'For example { "preset": "Water", "amount": 0.5 }.')
      filled += amount
    }
    const layer: Layer = { kind, amount, colour }
    if (kind === 'liquid') {
      if (meniscus) layer.meniscus = true
      if (bubbles && bubbles !== 'none') layer.bubbles = bubbles
      if (cloudy) layer.cloudy = true
    }
    layers.push(layer)
  })
  if (bad) return null
  if (filled > 1 + 1e-9) {
    ctx.error(
      path,
      `The layers of ${quote(cavity)} add up to ${show(filled)}, and a cavity holds at most 1.`,
      'Lower the amounts so that they add up to 1 or less (a gas is not counted).',
    )
    return null
  }
  // A gas fills what the other layers leave.
  const gas = layers.find((l) => l.kind === 'gas')
  if (gas) gas.amount = r6(Math.max(0, 1 - filled))
  const top = layers.reduce((a, l, i) => (l.kind === 'gas' ? a : i), -1)
  layers.forEach((l, i) => {
    if (l.meniscus && i !== top)
      ctx.warn(join(`${path}[${i}]`, 'meniscus'), 'Only the top liquid layer has a meniscus: this layer is drawn flat.', 'Remove "meniscus" from this layer.')
  })
  return layers
}

function readContents(ctx: Ctx, path: string, it: SymbolItem, v: unknown): Record<string, Layer[]> {
  const out: Record<string, Layer[]> = {}
  if (!isObj(v)) {
    ctx.error(path, 'The "contents" of a part must be an object { "cavity": [layers] }.', 'For example { "main": [{ "preset": "Water", "amount": 0.5 }] }.')
    return out
  }
  const cavities = (geometry(it.symbol, it.w, it.h, it.params).cavities ?? []).map((c) => c.id)
  for (const [cavity, layers] of Object.entries(v)) {
    const at = join(path, cavity)
    if (!cavities.includes(cavity)) {
      ctx.error(
        at,
        `${quote(cavity)} is not a cavity of ${it.symbol}.`,
        cavities.length
          ? `The cavities of ${it.symbol} are: ${list(cavities)}.${didYouMean(cavity, cavities)}`
          : `${it.symbol} has no cavities, so it holds no contents: remove "contents".`,
      )
      continue
    }
    const read = readLayers(ctx, at, it, cavity, layers)
    if (read) out[cavity] = read
  }
  return out
}

// ---------------------------------------------------------------- one part

/** Build one part: its item at the origin, with size, parameters and contents; the placement is next. Null when it is broken. */
function readPart(st: PartState, i: number, raw: unknown): PartRec | null {
  const ctx = st.ctx
  const path = `parts[${i}]`
  const o = readObject(ctx, path, raw, PART_KEYS, `part ${i + 1}`)
  const id = st.ids[i]
  if (!o || !id) return null
  const from = ctx.problems.length
  const symbol = readString(ctx, join(path, 'symbol'), o.symbol, 'The "symbol" of a part')
  if (symbol === undefined) return null
  if (!hasSymbol(symbol)) {
    const near = suggestSymbols(symbol)
    const all = 'The whole list is in reference/symbols.md, or run: npm run render -- --list symbols'
    ctx.error(
      join(path, 'symbol'),
      `Unknown symbol ${quote(symbol)}.`,
      near.length ? `Nearest symbols: ${near.map((d) => `${d.id} (${d.name})`).join(', ')}. ${all}` : `No symbol is close to that. ${all}`,
    )
    return null
  }
  const def = symbolDef(symbol)
  const item: SymbolItem = { id, type: 'symbol', symbol, x: 0, y: 0, rot: 0, flip: false, w: def.size.w, h: def.size.h, params: {}, contents: {} }
  if (o.rot !== undefined) {
    const rot = readNumber(ctx, join(path, 'rot'), o.rot, 'The rotation "rot"')
    if (rot !== undefined) item.rot = normRot(rot)
  }
  if (o.flip !== undefined) item.flip = readBool(ctx, join(path, 'flip'), o.flip, 'The "flip"') ?? false
  if (o.size !== undefined) {
    const size = readSize(st, i, join(path, 'size'), def, o.size)
    item.w = size.w
    item.h = size.h
  }
  if (o.params !== undefined) item.params = readParams(ctx, join(path, 'params'), def, o.params)
  if (o.contents !== undefined) item.contents = readContents(ctx, join(path, 'contents'), item, o.contents)
  return ctx.failedSince(from) ? null : { id, index: i, item, def }
}

/** How a part is placed, as one line of the explanation. */
const placeLine = (id: string, how: string, item: SymbolItem): string =>
  `${id}: ${how} -> centre (${show(item.x)}, ${show(item.y)}), ${show(item.w)} × ${show(item.h)}${item.rot ? `, turned ${item.rot}°` : ''}${item.flip ? ', flipped' : ''}`

const refText = (r: ResolvedRef) => `${r.part.id}.${r.anchor.id}`

/** Place a part with `on`, `near`, `at`, `alignX` and `alignY`. Each coordinate is fixed by at most one of them; what none fixes stays 0. */
function placePart(st: PartState, rec: PartRec, o: Obj, explain: string[]): boolean {
  const ctx = st.ctx
  const path = `parts[${rec.index}]`
  const it = rec.item
  const both = ['on', 'near', 'at'].filter((k) => o[k] !== undefined)
  if (both.length > 1) {
    ctx.error(
      join(path, both[1]),
      `A part is placed with one of "on", "near" and "at", and this one has ${list(both)}.`,
      'Keep one. "alignX" and "alignY" fix one coordinate each.',
    )
    return false
  }
  if (both.length === 1 && (o.alignX !== undefined || o.alignY !== undefined)) {
    ctx.error(
      join(path, o.alignX !== undefined ? 'alignX' : 'alignY'),
      `"${both[0]}" already fixes both coordinates of the part.`,
      'Use "alignX" with "alignY" without it, or drop "alignX" and "alignY".',
    )
    return false
  }
  /** An anchor of the part that is being placed. */
  const own = (p: string, name: string): Anchor | null => refAnchor(ctx, p, rec, name)
  const notes: string[] = []
  if (o.on !== undefined) {
    const r = readRef(st, join(path, 'on'), o.on, rec.index, true)
    const a = r && own(join(path, 'on.own'), r.own!)
    if (!r || !a) return false
    moveAnchorTo(it, a.id, r.point)
    notes.push(`its ${a.id} on ${refText(r)}`)
  } else if (o.near !== undefined) {
    const r = readRef(st, join(path, 'near'), o.near, rec.index, false)
    if (!r) return false
    it.x = r.point.x
    it.y = r.point.y
    notes.push(`centre near ${refText(r)}`)
  } else if (o.at !== undefined) {
    const a = readObject(ctx, join(path, 'at'), o.at, ['x', 'y', 'anchor'], 'this placement')
    if (!a) return false
    const x = readNumber(ctx, join(path, 'at.x'), a.x, 'The "x" of "at"')
    const y = readNumber(ctx, join(path, 'at.y'), a.y, 'The "y" of "at"')
    const name = a.anchor === undefined ? undefined : readString(ctx, join(path, 'at.anchor'), a.anchor, 'The "anchor" of "at"')
    const mine = name === undefined ? undefined : own(join(path, 'at.anchor'), name)
    if (x === undefined || y === undefined || mine === null || (a.anchor !== undefined && name === undefined)) return false
    if (mine) moveAnchorTo(it, mine.id, P(x, y))
    else {
      it.x = x
      it.y = y
    }
    notes.push(`${mine ? `its ${mine.id}` : 'centre'} at (${show(x)}, ${show(y)})`)
  }
  for (const axis of ['alignX', 'alignY'] as const) {
    if (o[axis] === undefined) continue
    const at = join(path, axis)
    const other = axis === 'alignX' ? 'dy' : 'dx'
    if (isObj(o[axis]) && o[axis][other] !== undefined) {
      ctx.error(
        join(at, other),
        `"${axis}" fixes ${axis === 'alignX' ? 'x' : 'y'} only, so it has no "${other}".`,
        `Use "${axis === 'alignX' ? 'dx' : 'dy'}" to shift it.`,
      )
      return false
    }
    const r = readRef(st, at, o[axis], rec.index, true)
    const a = r && own(join(at, 'own'), r.own!)
    if (!r || !a) return false
    const here = anchorWorld(it, a.id)
    if (axis === 'alignX') it.x += r.point.x - here.x
    else it.y += r.point.y - here.y
    notes.push(`${axis === 'alignX' ? 'x' : 'y'} of its ${a.id} on ${refText(r)}`)
  }
  if (!notes.length) {
    if (rec.index > 0)
      ctx.warn(
        path,
        `The part ${quote(rec.id)} has no placement, so its centre is at the origin (0, 0).`,
        'Add "on", "near" or "at" so that it does not sit on the other parts.',
      )
    notes.push('centre at the origin')
  }
  explain.push(placeLine(rec.id, notes.join(', '), it))
  return true
}

// ---------------------------------------------------------------- connectors

const CONNECTOR_KEYS = ['id', 'kind', 'points', 'width', 'radius', 'dash', 'startCap', 'endCap', 'behind', 'back', 'note']
const POINT_KEYS = ['part', 'anchor', 'dx', 'dy', 'out', 'x', 'y', 'r']
const CONNECTOR_KINDS: readonly ConnectorKind[] = ['glassTube', 'rubberTube', 'wire', 'line']
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/
const ID_HINT = 'An id starts with a letter and holds letters, digits, _ and -, at most 40 characters: "beaker", "stand-1".'

/** The points of a connector in the world, with their bend radii. Null when one is wrong. */
function readPoints(st: PartState, path: string, v: unknown): V[] | null {
  const ctx = st.ctx
  if (!Array.isArray(v) || v.length < 2) {
    ctx.error(
      path,
      'A connector needs a list of at least two points.',
      'Each point is { "part": "flask", "anchor": "mouth" }, { "x": 0, "y": 0 } or a step { "dx": 0, "dy": -60 } from the point before.',
    )
    return null
  }
  const pts: V[] = []
  let bad = false
  v.forEach((raw, i) => {
    const at = `${path}[${i}]`
    if (!isObj(raw)) {
      ctx.error(at, 'A point must be an object.', 'Write { "part": "flask", "anchor": "mouth" }, { "x": 0, "y": 0 } or { "dx": 0, "dy": -60 }.')
      bad = true
      return
    }
    let r: number | undefined
    if (raw.r !== undefined) {
      r = readNumber(ctx, join(at, 'r'), raw.r, 'The bend radius "r"')
      if (r !== undefined && (r < RADIUS_RANGE.min || r > RADIUS_RANGE.max)) {
        ctx.error(join(at, 'r'), `The bend radius ${show(r)} is outside ${RADIUS_RANGE.min} to ${RADIUS_RANGE.max}.`, 'Use 0 for a sharp bend.')
        r = undefined
      }
      if (r === undefined) bad = true
    }
    let p: Pt | null = null
    if (raw.part !== undefined) {
      const ref = readRef(st, at, raw, ANY_PART, false, ['r'])
      if (ref) p = ref.point
    } else if (raw.x !== undefined || raw.y !== undefined) {
      // A point with x and y; with only one of them, a run that goes level or upright from the point before.
      readObject(ctx, at, raw, ['x', 'y', 'r'], 'this point')
      const prev = pts[pts.length - 1]
      const coordinate = (axis: 'x' | 'y'): number | undefined => {
        const v = raw[axis]
        if (v === undefined) {
          if (!prev)
            ctx.error(
              at,
              'The first point of a connector needs both "x" and "y".',
              'Only a later point can leave one of them out: it keeps that coordinate of the point before.',
            )
          return prev?.[axis]
        }
        if (isObj(v)) return readRef(st, join(at, axis), v, ANY_PART, false)?.point[axis]
        return readNumber(ctx, join(at, axis), v, `The "${axis}" of a point`)
      }
      const x = coordinate('x'),
        y = coordinate('y')
      if (x !== undefined && y !== undefined) p = P(x, y)
    } else if (raw.dx !== undefined || raw.dy !== undefined) {
      readObject(ctx, at, raw, ['dx', 'dy', 'r'], 'this step')
      const prev = pts[pts.length - 1]
      const dx = raw.dx === undefined ? 0 : readNumber(ctx, join(at, 'dx'), raw.dx, 'The "dx" of a step')
      const dy = raw.dy === undefined ? 0 : readNumber(ctx, join(at, 'dy'), raw.dy, 'The "dy" of a step')
      if (!prev)
        ctx.error(
          at,
          'The first point of a connector cannot be a step { "dx", "dy" }: no point comes before it.',
          'Start with { "x": 0, "y": 0 } or { "part": "...", "anchor": "..." }.',
        )
      else if (dx !== undefined && dy !== undefined) p = P(prev.x + dx, prev.y + dy)
    } else {
      readObject(ctx, at, raw, POINT_KEYS, 'this point')
      ctx.error(
        at,
        'This point says nothing.',
        'Write { "part": "flask", "anchor": "mouth" }, { "x": 0, "y": 0 }, a step { "dx": 0, "dy": -60 } from the point before, or { "y": 0 } to go upright to there.',
      )
    }
    if (!p) {
      bad = true
      return
    }
    pts.push(r === undefined ? { x: p.x, y: p.y } : { x: p.x, y: p.y, r })
  })
  return bad ? null : pts
}

function readConnector(st: PartState, i: number, raw: unknown, made: ConnectorItem[]): ConnectorItem | null {
  const ctx = st.ctx
  const path = `connectors[${i}]`
  const o = readObject(ctx, path, raw, CONNECTOR_KEYS, `connector ${i + 1}`)
  if (!o) return null
  const from = ctx.problems.length
  let kind: ConnectorKind | undefined
  if (typeof o.kind === 'string' && (CONNECTOR_KINDS as readonly string[]).includes(o.kind)) kind = o.kind as ConnectorKind
  else {
    ctx.error(
      join(path, 'kind'),
      `The connector "kind" is ${typeof o.kind === 'string' ? quote(o.kind) : 'missing'}, which is not allowed.`,
      `It is one of ${list(CONNECTOR_KINDS)}.${typeof o.kind === 'string' ? didYouMean(o.kind, CONNECTOR_KINDS) : ''}`,
    )
  }
  const pts = readPoints(st, join(path, 'points'), o.points)
  let id: string | undefined
  if (o.id !== undefined) {
    id = readString(ctx, join(path, 'id'), o.id, 'The "id" of a connector')
    if (id !== undefined && !ID.test(id)) {
      ctx.error(join(path, 'id'), `The id ${quote(id)} is not allowed.`, ID_HINT)
      id = undefined
    } else if (id !== undefined && (st.index.has(id) || made.some((c) => c.id === id))) {
      ctx.error(join(path, 'id'), `The id ${quote(id)} is used twice.`, 'Every part and every connector has its own id.')
      id = undefined
    }
  }
  let width: number | undefined, radius: number | undefined, dash: boolean | undefined, startCap: Cap | undefined, endCap: Cap | undefined
  if (kind) {
    if (o.width !== undefined) {
      width = readNumber(ctx, join(path, 'width'), o.width, 'The "width"')
      if (!isTube(kind)) ctx.error(join(path, 'width'), `A ${kind} has no width.`, 'Only tubes (glassTube, rubberTube) have a width: remove it.')
      else if (width !== undefined && (width < WIDTH_RANGE.min || width > WIDTH_RANGE.max)) {
        ctx.error(
          join(path, 'width'),
          `The width ${show(width)} is outside ${WIDTH_RANGE.min} to ${WIDTH_RANGE.max}.`,
          `A glass tube is ${KIND_DEFAULTS.glassTube.width} wide, a rubber tube ${KIND_DEFAULTS.rubberTube.width}.`,
        )
      }
    }
    if (o.radius !== undefined) {
      radius = readNumber(ctx, join(path, 'radius'), o.radius, 'The "radius"')
      if (radius !== undefined && (radius < RADIUS_RANGE.min || radius > RADIUS_RANGE.max)) {
        ctx.error(join(path, 'radius'), `The bend radius ${show(radius)} is outside ${RADIUS_RANGE.min} to ${RADIUS_RANGE.max}.`, 'Use 0 for sharp bends.')
      }
    }
    if (o.dash !== undefined) {
      dash = readBool(ctx, join(path, 'dash'), o.dash, 'The "dash" flag')
      if (dash && isTube(kind)) ctx.error(join(path, 'dash'), `A ${kind} cannot be dashed.`, 'Only a wire or a line can be dashed.')
    }
    for (const key of ['startCap', 'endCap'] as const) {
      const cap = o[key]
      if (cap === undefined) continue
      const caps = capsFor(kind)
      if (typeof cap === 'string' && (caps as readonly string[]).includes(cap)) {
        if (key === 'startCap') startCap = cap as Cap
        else endCap = cap as Cap
      } else
        ctx.error(
          join(path, key),
          `The ${key} is ${typeof cap === 'string' ? quote(cap) : 'not text'}, which a ${kind} cannot have.`,
          `The ends of a ${kind} are: ${list(caps)}.`,
        )
    }
  }
  if (ctx.failedSince(from) || !kind || !pts) return null
  if (!isDrawable(pts)) {
    ctx.error(join(path, 'points'), 'All the points of this connector are in one place, so nothing would be drawn.', 'Move a point away from the others.')
    return null
  }
  let n = made.length + 1
  const taken = (s: string) => st.index.has(s) || made.some((c) => c.id === s)
  let final = id ?? `${kind}${n}`
  while (!id && taken(final)) final = `${kind}${++n}`
  const item = makeConnector(kind, pts, { width, radius, dash, startCap, endCap }, final)
  // The bend radius of one point wins over that of the connector.
  item.points = item.points.map((p, k) => {
    const given = pts[k].r
    if (given === undefined || k === 0 || k === item.points.length - 1) return p
    return given > 0 ? { x: p.x, y: p.y, r: given } : { x: p.x, y: p.y }
  })
  return item
}

// ---------------------------------------------------------------- the draw order

interface Behind {
  target: Id
  path: string
}

/** The `behind` and `back` keys of a part or a connector: where in the draw order it goes. */
function readDraw(st: PartState, path: string, o: Obj, id: Id, behind: Map<Id, Behind>, back: Set<Id>): void {
  const ctx = st.ctx
  if (o.back !== undefined && o.behind !== undefined) {
    ctx.error(join(path, 'back'), 'An item is drawn "behind" another part or at the "back", not both.', 'Remove one of them.')
    return
  }
  if (o.back !== undefined) {
    if (readBool(ctx, join(path, 'back'), o.back, 'The "back" flag')) back.add(id)
    return
  }
  if (o.behind === undefined) return
  const target = readString(ctx, join(path, 'behind'), o.behind, 'The "behind" of a part')
  if (target === undefined) return
  if (target === id) ctx.error(join(path, 'behind'), 'An item cannot be drawn behind itself.', 'Name another part.')
  else if (!st.index.has(target)) {
    ctx.error(join(path, 'behind'), `"behind" names ${quote(target)}, which is not a part.`, `The part ids are: ${idList(st)}.${didYouMean(target, st.names)}`)
  } else behind.set(id, { target, path: join(path, 'behind') })
}

/**
 * Back to front. The order given (the parts, then the connectors) with the `back` items first; then each `behind` takes
 * its item to just before its target, so a stand that is behind a clamp that is behind a vessel comes out right.
 */
function drawOrder(ctx: Ctx, given: Id[], behind: Map<Id, Behind>, back: Set<Id>): Id[] {
  const order = [...given.filter((id) => back.has(id)), ...given.filter((id) => !back.has(id))]
  const done = new Set<Id>()
  const visiting: Id[] = []
  const settle = (id: Id): void => {
    if (done.has(id)) return
    if (visiting.includes(id)) {
      const cycle = [...visiting.slice(visiting.indexOf(id)), id]
      ctx.error(behind.get(id)!.path, `The "behind" keys form a cycle: ${cycle.join(' -> ')}.`, 'Remove one of the "behind" keys in the cycle.')
      return
    }
    const b = behind.get(id)
    if (b && order.includes(b.target)) {
      visiting.push(id)
      settle(b.target)
      visiting.pop()
      order.splice(order.indexOf(id), 1)
      order.splice(order.indexOf(b.target), 0, id)
    }
    done.add(id)
  }
  for (const id of given) settle(id)
  return order
}

// ---------------------------------------------------------------- labels

const LABELS_KEYS = ['auto', 'text', 'skip', 'side', 'extra']
const EXTRA_KEYS = ['text', 'part', 'anchor', 'at', 'connector', 'along', 'point', 'near', 'side', 'textAt', 'end', 'size', 'note']

/** The point at a fraction of the way along a polyline, and whether the run it is on is more level than upright. */
function along(points: readonly Pt[], t: number): { at: Pt; level: boolean } {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y))
  let left = lengths.reduce((a, b) => a + b, 0) * clamp(t, 0, 1)
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const k = lengths[i] ? left / lengths[i] : 0
      const dx = points[i + 1].x - points[i].x,
        dy = points[i + 1].y - points[i].y
      return { at: P(points[i].x + dx * k, points[i].y + dy * k), level: Math.abs(dx) >= Math.abs(dy) }
    }
    left -= lengths[i]
  }
  return { at: points[0], level: true }
}

/** Where the text of a label on a connector goes when the recipe does not say: just above a level run, or beside an upright one. */
const ABOVE = { dx: 12, dy: -24 },
  BESIDE = { dx: 30, dy: 5 }

/** A label without the optional fields that are not set (a clean object, whatever the JSON round trip does). */
function newLabel(fields: Pick<LabelItem, 'x' | 'y' | 'side' | 'text'> & Partial<LabelItem>): LabelItem {
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as typeof fields
  return makeLabel(clean, 'label')
}

interface LabelState {
  st: PartState
  doc: Doc
  connectors: Map<string, ConnectorItem>
}

interface ExtraOut {
  centre: number
  /** Text anchors in a column beside the diagram, laid out with the labels of Label all. */
  columned: Placed[]
  /** Labels whose text is placed by the recipe. */
  placed: LabelItem[]
  /** Plain text. */
  plain: LabelItem[]
}

function readExtra(ctx: Ctx, ls: LabelState, path: string, raw: unknown, out: ExtraOut, B: ReturnType<typeof itemsBox>): void {
  const { st, doc } = ls
  const o = readObject(ctx, path, raw, EXTRA_KEYS, 'this label')
  if (!o) return
  const from = ctx.problems.length
  const text = readString(ctx, join(path, 'text'), o.text, 'The "text" of a label')
  const kinds = ['part', 'connector', 'point', 'near'].filter((k) => o[k] !== undefined)
  if (kinds.length !== 1) {
    ctx.error(
      path,
      kinds.length ? `A label points at one thing, and this one has ${list(kinds)}.` : 'This label points at nothing.',
      'Give "part" (with "anchor" or "at"), or "connector", or "point": the thing its leader ends on. For plain text with no leader give "near".',
    )
    return
  }
  let side: 'left' | 'right' | undefined
  if (o.side !== undefined) {
    if (o.side === 'left' || o.side === 'right') side = o.side
    else
      ctx.error(
        join(path, 'side'),
        `The "side" of a label is ${typeof o.side === 'string' ? quote(o.side) : 'not text'}.`,
        'It is "left" or "right": the side of the leader end on which the text stands.',
      )
  }
  let leaderEnd: LabelItem['leaderEnd'] | undefined
  if (o.end !== undefined) {
    if (typeof o.end === 'string' && (LEADER_ENDS as readonly string[]).includes(o.end)) leaderEnd = o.end as LabelItem['leaderEnd']
    else
      ctx.error(
        join(path, 'end'),
        `The "end" of a label is ${typeof o.end === 'string' ? quote(o.end) : 'not text'}.`,
        `It is one of ${list(LEADER_ENDS)}: how the leader line ends.`,
      )
  }
  let size: number | undefined
  if (o.size !== undefined) {
    size = readNumber(ctx, join(path, 'size'), o.size, 'The "size" of a label')
    if (size !== undefined && (size < LABEL_SIZE_RANGE.min || size > LABEL_SIZE_RANGE.max)) {
      ctx.error(
        join(path, 'size'),
        `The label size ${show(size)} is outside ${LABEL_SIZE_RANGE.min} to ${LABEL_SIZE_RANGE.max}.`,
        `The label size of the document is ${doc.settings.labelSize}.`,
      )
      size = undefined
    }
  }
  let textAt: Pt | undefined
  if (o.textAt !== undefined) {
    if (Array.isArray(o.textAt) && o.textAt.length === 2 && o.textAt.every(isNum)) textAt = P(o.textAt[0] as number, o.textAt[1] as number)
    else
      ctx.error(
        join(path, 'textAt'),
        'The "textAt" of a label must be [dx, dy].',
        'Two numbers: where the text starts, as an offset from where the leader ends (world units, y down).',
      )
  }

  // Plain text: no leader.
  if (o.near !== undefined) {
    if (o.at !== undefined || o.anchor !== undefined || o.along !== undefined || o.textAt !== undefined || o.end !== undefined) {
      ctx.error(
        path,
        'Plain text (with "near") has no leader, so it takes no "at", "anchor", "along", "textAt" or "end".',
        'Remove them, or point the label at a part, a connector or a point.',
      )
      return
    }
    const r = readRef(st, join(path, 'near'), o.near, ANY_PART, false)
    if (!r || text === undefined || ctx.failedSince(from)) return
    out.plain.push(newLabel({ x: r3(r.point.x), y: r3(r.point.y), side: side ?? 'right', text, size }))
    return
  }

  // What the leader ends on: where it is (for a side of the text) and the target to store.
  let centreX = out.centre
  let end: ((s: 'left' | 'right') => { world: Pt; target: Target }) | undefined
  if (o.part !== undefined) {
    const id = readString(ctx, join(path, 'part'), o.part, 'The "part" of a label')
    const rec = id === undefined ? undefined : st.built.get(id)
    if (id !== undefined && !st.index.has(id)) {
      ctx.error(join(path, 'part'), `This label names ${quote(id)}, which is not a part.`, `The part ids are: ${idList(st)}.${didYouMean(id, st.names)}`)
    }
    if (o.anchor !== undefined && o.at !== undefined)
      ctx.error(path, 'A label that points at a part has an "anchor" or an "at", not both.', 'Remove one of them.')
    else if (rec) {
      const it = rec.item
      const g = geometry(it.symbol, it.w, it.h, it.params)
      let local: Pt | undefined
      if (o.anchor !== undefined) {
        const name = readString(ctx, join(path, 'anchor'), o.anchor, 'The "anchor" of a label')
        const a = name === undefined ? null : refAnchor(ctx, join(path, 'anchor'), rec, name)
        if (a) local = P(a.x, a.y)
      } else if (o.at !== undefined) {
        if (Array.isArray(o.at) && o.at.length === 2 && o.at.every(isNum)) local = P(o.at[0] as number, o.at[1] as number)
        else
          ctx.error(
            join(path, 'at'),
            'The "at" of a label must be [lx, ly].',
            'Two numbers: a point in the frame of the part (x = 0 is its centre line, y = 0 its top, y = its height its bottom).',
          )
      }
      centreX = it.x
      end = (s) => {
        // Without a point of its own, the leader ends where Label all would end it: of the two leader points of the part,
        // the one that lies further towards the side of the text, as the part stands in the world.
        const left = labelPoint(g, it.w, it.h, 'left'),
          right = labelPoint(g, it.w, it.h, 'right')
        const useLeft = s === 'left' ? toWorld(it, left).x <= toWorld(it, right).x : toWorld(it, left).x > toWorld(it, right).x
        const p = local ?? (useLeft ? left : right)
        return { world: toWorld(it, p), target: { item: rec.id, lx: r3(p.x), ly: r3(p.y) } }
      }
    }
  } else if (o.connector !== undefined) {
    const id = readString(ctx, join(path, 'connector'), o.connector, 'The "connector" of a label')
    const c = id === undefined ? undefined : ls.connectors.get(id)
    if (id !== undefined && !c) {
      const ids = [...ls.connectors.keys()]
      ctx.error(
        join(path, 'connector'),
        `This label names ${quote(id)}, which is not a connector.`,
        ids.length
          ? `The connector ids are: ${list(ids)}.${didYouMean(id, ids)}`
          : 'A connector has an id only when the recipe gives it one: add "id" to the connector.',
      )
    }
    let t = 0.5
    if (o.along !== undefined) {
      const n = readNumber(ctx, join(path, 'along'), o.along, 'The "along" of a label')
      if (n !== undefined && (n < 0 || n > 1))
        ctx.error(
          join(path, 'along'),
          `The "along" of a label is ${show(n)}, outside 0 to 1.`,
          '0 is the first point of the connector, 1 the last, 0.5 the middle.',
        )
      else if (n !== undefined) t = n
    }
    if (c) {
      const { at: p, level } = along(c.points, t)
      centreX = p.x
      end = () => ({ world: p, target: { x: r3(p.x), y: r3(p.y) } })
      // A tube runs through the middle of the diagram: its text goes next to it, not in a column far away.
      if (!textAt) {
        const s = side ?? (level ? 'right' : p.x < out.centre ? 'left' : 'right')
        textAt = level ? P(s === 'right' ? -ABOVE.dx : ABOVE.dx, ABOVE.dy) : P(s === 'left' ? -BESIDE.dx : BESIDE.dx, BESIDE.dy)
        side = s
      }
    }
  } else if (o.point !== undefined) {
    const p = readObject(ctx, join(path, 'point'), o.point, ['x', 'y'], 'this point')
    const x = p && readNumber(ctx, join(path, 'point.x'), p.x, 'The "x" of the point'),
      y = p && readNumber(ctx, join(path, 'point.y'), p.y, 'The "y" of the point')
    if (x !== undefined && x !== null && y !== undefined && y !== null && p) {
      centreX = x
      end = () => ({ world: P(x, y), target: { x: r3(x), y: r3(y) } })
    }
  }
  if (o.along !== undefined && o.connector === undefined)
    ctx.error(join(path, 'along'), '"along" belongs to a label that points at a connector.', 'Remove it, or point the label at a "connector".')
  if (text === undefined || !end || ctx.failedSince(from)) return
  const s = side ?? (textAt ? (textAt.x < 0 ? 'left' : 'right') : centreX < out.centre ? 'left' : 'right')
  const { world, target } = end(s)
  if (textAt) {
    out.placed.push(newLabel({ x: r3(world.x + textAt.x), y: r3(world.y + textAt.y), side: s, target, text, leaderEnd, size }))
    return
  }
  // In a column: the text anchor is 40 u outside the diagram on its side, at the height of the target (step 6 of section 11).
  const x = B ? (s === 'left' ? B.x0 - LABEL_GAP : B.x1 + LABEL_GAP) : world.x
  out.columned.push({ label: newLabel({ x, y: world.y, side: s, target, text, leaderEnd, size }), target: world })
}

/** The labels of a recipe, in the order they are drawn: the left column, the right column, the placed ones, plain text. */
function makeLabels(ctx: Ctx, ls: LabelState, raw: unknown): LabelItem[] {
  const { doc, st } = ls
  const o = readObject(ctx, 'labels', raw, LABELS_KEYS, 'the "labels"')
  const auto = o?.auto === undefined ? true : (readBool(ctx, 'labels.auto', o.auto, 'The flag "auto"') ?? true)
  const texts = new Map<string, string>()
  const skip = new Set<string>()
  if (o?.text !== undefined) {
    if (!isObj(o.text))
      ctx.error('labels.text', 'The "text" of the labels must be an object { "partId": "label text" }.', 'For example { "beaker": "250 cm3 beaker" }.')
    else {
      for (const [id, t] of Object.entries(o.text)) {
        if (!st.index.has(id))
          ctx.error(
            join('labels.text', id),
            `"labels.text" names ${quote(id)}, which is not a part.`,
            `The part ids are: ${idList(st)}.${didYouMean(id, st.names)}`,
          )
        else if (typeof t !== 'string' || t === '')
          ctx.error(join('labels.text', id), `The label text of ${quote(id)} must be text.`, 'Write it in double quotes.')
        else texts.set(id, t)
      }
    }
  }
  if (o?.skip !== undefined) {
    if (!Array.isArray(o.skip)) ctx.error('labels.skip', 'The "skip" of the labels must be a list of part ids.', 'For example ["mat", "stand"].')
    else {
      o.skip.forEach((id, i) => {
        if (typeof id !== 'string' || !st.index.has(id)) {
          ctx.error(
            `labels.skip[${i}]`,
            `"labels.skip" names ${quote(String(id))}, which is not a part.`,
            `The part ids are: ${idList(st)}.${typeof id === 'string' ? didYouMean(id, st.names) : ''}`,
          )
        } else skip.add(id)
      })
    }
  }

  // The parts whose label is on the side that the recipe says, not the side that Label all chooses.
  const sides = new Map<string, 'left' | 'right'>()
  if (o?.side !== undefined) {
    if (!isObj(o.side)) ctx.error('labels.side', 'The "side" of the labels must be an object { "partId": "left" }.', 'For example { "stand": "left" }.')
    else {
      for (const [id, s] of Object.entries(o.side)) {
        if (!st.index.has(id))
          ctx.error(
            join('labels.side', id),
            `"labels.side" names ${quote(id)}, which is not a part.`,
            `The part ids are: ${idList(st)}.${didYouMean(id, st.names)}`,
          )
        else if (s !== 'left' && s !== 'right')
          ctx.error(join('labels.side', id), `The side of ${quote(id)} must be "left" or "right".`, 'It is the side of the diagram on which the text stands.')
        else if (skip.has(id)) ctx.error(join('labels.side', id), `${quote(id)} is in "labels.skip" and in "labels.side".`, 'Keep it in one of them.')
        else {
          sides.set(id, s)
          skip.add(id)
        }
      }
    }
  }

  // Label all, for the parts that are not skipped. A skipped part gets a dummy label fixed to it, so that Label all leaves it
  // alone; the columns are laid out beside the same bounds, because a label is no part of them.
  let count = 0
  let base: LabelItem[] = []
  if (auto) {
    const items = { ...doc.items }
    const order = [...doc.order]
    for (const id of skip) {
      const dummy = makeLabel({ x: 0, y: 0, side: 'left', target: { item: id, lx: 0, ly: 0 }, text: 'skipped' }, `skipped-${id}`)
      items[dummy.id] = dummy
      order.push(dummy.id)
    }
    base = autoLabels({ ...doc, items, order }, () => `auto${++count}`)
    for (const l of base) {
      const part = l.target && 'item' in l.target ? l.target.item : undefined
      if (part && texts.has(part)) l.text = texts.get(part)!
    }
  }

  // The labels of "side", then the extra labels.
  const out: ExtraOut = { centre: 0, columned: [], placed: [], plain: [] }
  const B = itemsBox(
    doc,
    doc.order.filter((id) => doc.items[id]?.type !== 'label'),
  )
  out.centre = B ? (B.x0 + B.x1) / 2 : 0
  for (const [id, side] of sides) {
    const rec = st.built.get(id)
    if (rec) readExtra(ctx, ls, join('labels.side', id), { text: texts.get(id) ?? labelText(rec.def, rec.item.params), part: id, side }, out, B)
  }
  if (o?.extra !== undefined) {
    if (!Array.isArray(o.extra))
      ctx.error('labels.extra', 'The "extra" labels must be a list [ ... ].', 'For example [{ "text": "water", "part": "beaker", "at": [10, 90] }].')
    else o.extra.forEach((e, i) => readExtra(ctx, ls, `labels.extra[${i}]`, e, out, B))
  }
  let columns = base
  if (out.columned.length) {
    // The labels in the columns are laid out with those of Label all: each text anchor goes back to the height of its
    // target (step 6 of section 11), and each column is spaced and uncrossed (steps 7 and 8).
    const size = doc.settings.labelSize
    const all: Placed[] = [
      ...base.map((l) => {
        const target = labelTarget(doc, l) ?? P(l.x, l.y)
        return { label: { ...l, y: target.y }, target }
      }),
      ...out.columned,
    ]
    columns = (['left', 'right'] as const).flatMap((side) => {
      const column = all.filter((p) => p.label.side === side)
      spaceColumn(column, size)
      uncrossColumn(column, size)
      return column.map((p) => p.label).sort((a, b) => a.y - b.y)
    })
  }
  return [...columns, ...out.placed, ...out.plain]
}

// ---------------------------------------------------------------- compileRecipe

const ROOT_KEYS = ['title', 'settings', 'parts', 'connectors', 'labels', 'note']
const SETTINGS_KEYS = ['labelMode', 'mono', 'labelSize', 'smartText']

function readSettings(ctx: Ctx, v: unknown): DocSettings {
  const s: DocSettings = { ...DEFAULT_SETTINGS }
  const o = readObject(ctx, 'settings', v, SETTINGS_KEYS, 'the "settings"')
  if (!o) return s
  if (o.labelMode !== undefined) {
    if (o.labelMode === 'text' || o.labelMode === 'blank' || o.labelMode === 'letters') s.labelMode = o.labelMode
    else {
      ctx.error(
        'settings.labelMode',
        `The "labelMode" is ${typeof o.labelMode === 'string' ? quote(o.labelMode) : 'not text'}.`,
        'It is "text" (a slide), "blank" (a line to write on) or "letters" (A, B, C for an exam question).',
      )
    }
  }
  if (o.mono !== undefined) s.mono = readBool(ctx, 'settings.mono', o.mono, 'The "mono" setting (photocopy-safe)') ?? s.mono
  if (o.smartText !== undefined) s.smartText = readBool(ctx, 'settings.smartText', o.smartText, 'The "smartText" setting') ?? s.smartText
  if (o.labelSize !== undefined) {
    const n = readNumber(ctx, 'settings.labelSize', o.labelSize, 'The "labelSize"')
    if (n !== undefined && (n < LABEL_SIZE_RANGE.min || n > LABEL_SIZE_RANGE.max)) {
      ctx.error(
        'settings.labelSize',
        `The "labelSize" ${show(n)} is outside ${LABEL_SIZE_RANGE.min} to ${LABEL_SIZE_RANGE.max}.`,
        `The default is ${DEFAULT_SETTINGS.labelSize}.`,
      )
    } else if (n !== undefined) s.labelSize = n
  }
  return s
}

/**
 * Turn a recipe into a document. `doc` is null when the recipe has an error. `problems` holds every error and warning,
 * and `explain` one line for each part about how it was placed. The document passes `parseDoc` unchanged.
 */
export function compileRecipe(recipe: unknown): RecipeResult {
  const ctx = new Ctx()
  const explain: string[] = []
  const fail = (): RecipeResult => ({ doc: null, problems: ctx.problems, explain })
  const root = readObject(ctx, '', recipe, ROOT_KEYS, 'the recipe')
  if (!root) return fail()
  if (root.title === undefined)
    ctx.warn('title', 'The recipe has no "title", so the diagram is called "Untitled diagram".', 'Add "title": "..." (it names the diagram in the editor).')
  const title = root.title === undefined ? 'Untitled diagram' : (readString(ctx, 'title', root.title, 'The "title"') ?? 'Untitled diagram')
  const settings = root.settings === undefined ? { ...DEFAULT_SETTINGS } : readSettings(ctx, root.settings)
  if (!Array.isArray(root.parts) || root.parts.length === 0) {
    ctx.error('parts', 'The recipe needs a list of "parts": at least one.', 'Each part is { "id": "beaker", "symbol": "beaker" }.')
    return fail()
  }

  // The ids first, so that a reference can be told from a mistake, and a part that comes later from one that is missing.
  const st: PartState = { ctx, ids: [], names: [], index: new Map(), built: new Map(), deps: new Map() }
  root.parts.forEach((p, i) => {
    const id = isObj(p) ? p.id : undefined
    let ok = false
    if (!isObj(p))
      ctx.error(`parts[${i}]`, `Part ${i + 1} must be an object { "id": ..., "symbol": ... }.`, 'Each part is { "id": "beaker", "symbol": "beaker" }.')
    else if (typeof id !== 'string' || !ID.test(id)) {
      ctx.error(
        `parts[${i}].id`,
        id === undefined ? `Part ${i + 1} has no "id".` : `The id ${typeof id === 'string' ? quote(id) : String(id)} is not allowed.`,
        ID_HINT,
      )
    } else if (st.index.has(id))
      ctx.error(`parts[${i}].id`, `The id ${quote(id)} is used twice.`, `Every part has its own id. ${quote(id)} is also part ${st.index.get(id)! + 1}.`)
    else ok = true
    if (ok) {
      st.index.set(id as string, i)
      st.names.push(id as string)
      st.deps.set(id as string, placementRefs(p as Obj))
    }
    st.ids.push(ok ? (id as string) : '')
  })

  // Build and place the parts, in list order.
  const doc = newDoc(title)
  doc.settings = settings
  const behind = new Map<Id, Behind>()
  const back = new Set<Id>()
  root.parts.forEach((raw, i) => {
    if (!st.ids[i]) return
    const rec = readPart(st, i, raw)
    if (!rec || !placePart(st, rec, raw as Obj, explain)) return
    st.built.set(rec.id, rec)
    readDraw(st, `parts[${i}]`, raw as Obj, rec.id, behind, back)
  })
  for (const rec of st.built.values()) {
    doc.items[rec.id] = rec.item
    doc.order.push(rec.id)
  }

  // The connectors, after all the parts.
  const connectors = new Map<string, ConnectorItem>()
  if (root.connectors !== undefined) {
    if (!Array.isArray(root.connectors))
      ctx.error('connectors', 'The "connectors" must be a list [ ... ].', 'Each connector is { "kind": "glassTube", "points": [ ... ] }.')
    else {
      const made: ConnectorItem[] = []
      root.connectors.forEach((raw, i) => {
        const c = readConnector(st, i, raw, made)
        if (!c) return
        made.push(c)
        connectors.set(c.id, c)
        doc.items[c.id] = c
        doc.order.push(c.id)
        readDraw(st, `connectors[${i}]`, raw as Obj, c.id, behind, back)
      })
    }
  }
  doc.order = drawOrder(ctx, doc.order, behind, back)

  // The labels, last of all.
  const labels = makeLabels(ctx, { st, doc, connectors }, root.labels === undefined ? {} : root.labels)
  const used = new Set(Object.keys(doc.items))
  let k = 0
  for (const l of labels) {
    let id: string
    do id = `label${++k}`
    while (used.has(id))
    used.add(id)
    doc.items[id] = { ...l, id }
    doc.order.push(id)
  }
  if (ctx.problems.some((p) => p.level === 'error')) return fail()

  // Tidy numbers, then the last check: the document must pass the reader of the editor unchanged.
  for (const it of Object.values(doc.items)) {
    if (it.type === 'symbol') {
      it.x = r3(it.x)
      it.y = r3(it.y)
      it.w = r3(it.w)
      it.h = r3(it.h)
    } else if (it.type === 'connector') it.points = it.points.map((p) => ({ ...p, x: r3(p.x), y: r3(p.y) }))
    else if (it.type === 'label') {
      it.x = r3(it.x)
      it.y = r3(it.y)
      if (it.target)
        it.target = 'item' in it.target ? { item: it.target.item, lx: r3(it.target.lx), ly: r3(it.target.ly) } : { x: r3(it.target.x), y: r3(it.target.y) }
    }
  }
  const parsed = parseDoc(JSON.parse(JSON.stringify(doc)))
  if (!parsed.ok || parsed.problems.length) {
    for (const message of parsed.problems)
      ctx.error('', `The compiled document does not pass parseDoc: ${message}`, 'This is a fault in the recipe compiler, not in the recipe. Report it.')
    return fail()
  }
  return { doc, problems: ctx.problems, explain }
}
