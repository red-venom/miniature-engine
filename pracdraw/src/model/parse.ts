// parse.ts — read a document from a file or from storage (section 7, rule 5). Every field is checked by hand: there is
// no schema library. A wrong top-level shape fails. An item with a bad field is left out and listed. The problems are
// plain sentences for the banner over the canvas. An unknown symbol id stays (rule 6). The migrations run first
// (rule 7). Pure: no DOM. It never throws.

import type { Layer, LayerKind } from '../kernel/contents'
import { MIGRATIONS, migrate, type Migration } from './migrate'
import {
  DEFAULT_SETTINGS,
  type Cap,
  type ConnectorItem,
  type ConnectorKind,
  type Doc,
  type DocSettings,
  type Id,
  type Item,
  type LabelItem,
  type ParamValue,
  type ShapeItem,
  type SymbolItem,
  type Target,
} from './types'

export type ParseResult = { ok: true; doc: Doc; problems: string[] } | { ok: false; problems: string[] }

/** A colour in a file: # and six hex digits. */
export const COLOUR = /^#[0-9a-fA-F]{6}$/

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Missing, or null (JSON writes NaN and Infinity as null). Only an optional field may be absent. */
const absent = (v: unknown): v is undefined | null => v === undefined || v === null

/** A field that is wrong. Its message names the field and says what it must be. */
class Bad extends Error {}

const LAYER_KINDS: readonly LayerKind[] = ['liquid', 'powder', 'lumps', 'gas']
const BUBBLES: readonly NonNullable<Layer['bubbles']>[] = ['none', 'few', 'many']
const CONNECTOR_KINDS: readonly ConnectorKind[] = ['glassTube', 'rubberTube', 'wire', 'line']
const CAPS: readonly Cap[] = ['none', 'arrow', 'closed', 'tick', 'dot']
const SIDES: readonly LabelItem['side'][] = ['left', 'right']
const LEADER_ENDS: readonly LabelItem['leaderEnd'][] = ['none', 'arrow', 'dot']
const SHAPES: readonly ShapeItem['shape'][] = ['rect', 'ellipse']
const FILLS: readonly ShapeItem['fill'][] = ['none', 'paper', 'grey']
const LABEL_MODES: readonly DocSettings['labelMode'][] = ['text', 'blank', 'letters']

// ---------------------------------------------------------------- one field

type Range = 'any' | 'above0' | 'from0' | 'fraction'
const RANGE_TEXT: Record<Range, string> = { any: 'a number', above0: 'a number above 0', from0: 'a number from 0', fraction: 'a number from 0 to 1' }
const inRange = (v: number, r: Range) => r === 'any' || (r === 'above0' ? v > 0 : r === 'from0' ? v >= 0 : v >= 0 && v <= 1)

/** A finite number in a range. */
function num(o: Obj, key: string, range: Range = 'any'): number {
  const v = o[key]
  if (typeof v !== 'number' || !Number.isFinite(v) || !inRange(v, range)) throw new Bad(`"${key}" must be ${RANGE_TEXT[range]}`)
  return v
}

const above0 = (o: Obj, key: string) => num(o, key, 'above0')

function text(o: Obj, key: string): string {
  const v = o[key]
  if (typeof v !== 'string') throw new Bad(`"${key}" must be text`)
  return v
}

/** An id or a symbol id: text that is not empty. */
function name(o: Obj, key: string): string {
  const v = o[key]
  if (typeof v !== 'string' || !v) throw new Bad(`"${key}" must be a name`)
  return v
}

function flag(o: Obj, key: string): boolean {
  const v = o[key]
  if (typeof v !== 'boolean') throw new Bad(`"${key}" must be true or false`)
  return v
}

function choice<T extends string>(o: Obj, key: string, options: readonly T[]): T {
  const v = o[key]
  if (typeof v !== 'string' || !(options as readonly string[]).includes(v)) throw new Bad(`"${key}" must be ${options.map((s) => `"${s}"`).join(', ')}`)
  return v as T
}

function colour(o: Obj, key: string): string {
  const v = o[key]
  if (typeof v !== 'string' || !COLOUR.test(v)) throw new Bad(`"${key}" must be a colour such as #cfe8f7`)
  return v
}

/** An optional field: absent gives undefined, anything else must pass `read`. */
const opt = <T>(o: Obj, key: string, read: (o: Obj, key: string) => T): T | undefined => (absent(o[key]) ? undefined : read(o, key))

/** Run `read`, and put `where` in front of the message of a bad field. */
function inside<T>(where: string, read: () => T): T {
  try {
    return read()
  } catch (e) {
    if (e instanceof Bad) throw new Bad(`${where}: ${e.message}`)
    throw e
  }
}

/** `base` with the optional fields that are present. An absent field is left out, not set to undefined. */
function withOptional<T extends object>(base: T, extra: Obj): T {
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) (base as Obj)[k] = v
  return base
}

/** The keys of an object from a file. `__proto__` is no name: as a key it would change the object it is put in. */
function entries(o: Obj, what: string): [string, unknown][] {
  const all = Object.entries(o)
  if (all.some(([k]) => k === '__proto__')) throw new Bad(`${what} has an entry named "__proto__"`)
  return all
}

// ---------------------------------------------------------------- items

const common = (o: Obj): Obj => ({ locked: opt(o, 'locked', flag), group: opt(o, 'group', name) })

function readParams(v: unknown): Record<string, ParamValue> {
  if (!isObj(v)) throw new Bad('"params" must be a set of values')
  const out: Record<string, ParamValue> = {}
  for (const [k, p] of entries(v, '"params"')) {
    if (typeof p !== 'boolean' && typeof p !== 'string' && !(typeof p === 'number' && Number.isFinite(p)))
      throw new Bad(`the parameter "${k}" must be a number, text, or true or false`)
    out[k] = p
  }
  return out
}

function readLayer(v: unknown): Layer {
  if (!isObj(v)) throw new Bad('it must be a layer')
  return withOptional<Layer>(
    { kind: choice(v, 'kind', LAYER_KINDS), amount: num(v, 'amount', 'fraction'), colour: colour(v, 'colour') },
    { meniscus: opt(v, 'meniscus', flag), bubbles: opt(v, 'bubbles', (o, k) => choice(o, k, BUBBLES)), cloudy: opt(v, 'cloudy', flag) },
  )
}

/** The layers of each cavity, bottom first. A gas layer that is not last moves to the end; the rest keep their order. */
function readContents(v: unknown): Record<string, Layer[]> {
  if (!isObj(v)) throw new Bad('"contents" must be a set of cavities')
  const out: Record<string, Layer[]> = {}
  for (const [cavity, layers] of entries(v, '"contents"')) {
    if (!Array.isArray(layers)) throw new Bad(`the contents of "${cavity}" must be a list of layers`)
    const read = layers.map((l, i) => inside(`layer ${i + 1} of "${cavity}"`, () => readLayer(l)))
    out[cavity] = [...read.filter((l) => l.kind !== 'gas'), ...read.filter((l) => l.kind === 'gas')]
  }
  return out
}

function readSymbol(id: Id, o: Obj): SymbolItem {
  return withOptional<SymbolItem>(
    {
      id,
      type: 'symbol',
      symbol: name(o, 'symbol'), // an unknown id stays (rule 6): it is drawn as a dashed box
      x: num(o, 'x'),
      y: num(o, 'y'),
      rot: num(o, 'rot'),
      flip: flag(o, 'flip'),
      w: above0(o, 'w'),
      h: above0(o, 'h'),
      params: readParams(o.params),
      contents: readContents(o.contents),
    },
    common(o),
  )
}

function readPoint(v: unknown) {
  if (!isObj(v)) throw new Bad('it must be a point')
  return withOptional({ x: num(v, 'x'), y: num(v, 'y') }, { r: opt(v, 'r', (o, k) => num(o, k, 'from0')) })
}

function readConnector(id: Id, o: Obj): ConnectorItem {
  const kind = choice(o, 'kind', CONNECTOR_KINDS)
  if (!Array.isArray(o.points) || o.points.length < 2) throw new Bad('"points" must be a list of two points or more')
  const points = o.points.map((p, i) => inside(`point ${i + 1}`, () => readPoint(p)))
  return withOptional<ConnectorItem>(
    { id, type: 'connector', kind, points, startCap: choice(o, 'startCap', CAPS), endCap: choice(o, 'endCap', CAPS) },
    { width: opt(o, 'width', above0), dash: opt(o, 'dash', flag), ...common(o) },
  )
}

function readTarget(o: Obj, key: string): Target {
  const t = o[key]
  if (!isObj(t)) throw new Bad(`"${key}" must be a point`)
  return inside(`"${key}"`, () => ('item' in t ? { item: name(t, 'item'), lx: num(t, 'lx'), ly: num(t, 'ly') } : { x: num(t, 'x'), y: num(t, 'y') }))
}

function readLabel(id: Id, o: Obj): LabelItem {
  return withOptional<LabelItem>(
    {
      id,
      type: 'label',
      text: text(o, 'text'),
      x: num(o, 'x'),
      y: num(o, 'y'),
      side: choice(o, 'side', SIDES),
      leaderEnd: choice(o, 'leaderEnd', LEADER_ENDS),
    },
    { target: opt(o, 'target', readTarget), size: opt(o, 'size', above0), smart: opt(o, 'smart', flag), ...common(o) },
  )
}

function readShape(id: Id, o: Obj): ShapeItem {
  return withOptional<ShapeItem>(
    {
      id,
      type: 'shape',
      shape: choice(o, 'shape', SHAPES),
      x: num(o, 'x'),
      y: num(o, 'y'),
      w: above0(o, 'w'),
      h: above0(o, 'h'),
      rot: num(o, 'rot'),
      fill: choice(o, 'fill', FILLS),
      dash: flag(o, 'dash'),
    },
    common(o),
  )
}

function readItem(id: string, v: unknown): Item {
  if (!isObj(v)) throw new Bad('it is not an item')
  if (v.id !== id) throw new Bad(`its "id" must be "${id}", the name it is listed under`)
  switch (v.type) {
    case 'symbol':
      return readSymbol(id, v)
    case 'connector':
      return readConnector(id, v)
    case 'label':
      return readLabel(id, v)
    case 'shape':
      return readShape(id, v)
    default:
      throw new Bad('"type" must be "symbol", "connector", "label" or "shape"')
  }
}

/** A few words of a label's text, for a problem. */
const short = (s: string) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > 30 ? `${one.slice(0, 29)}…` : one
}

/** What an item is, for a problem: its symbol, the text of a label, or its kind. */
function what(v: unknown): string {
  if (!isObj(v)) return 'item'
  if (v.type === 'symbol' && typeof v.symbol === 'string') return v.symbol
  if (v.type === 'label' && typeof v.text === 'string') return `label "${short(v.text)}"`
  if (v.type === 'connector' && typeof v.kind === 'string') return v.kind
  if (v.type === 'shape' && typeof v.shape === 'string') return v.shape
  return 'item'
}

// ---------------------------------------------------------------- the document

function readSettings(s: Obj, problems: string[]): DocSettings {
  const out: DocSettings = { ...DEFAULT_SETTINGS }
  const take = <K extends keyof DocSettings>(key: K, ok: (v: unknown) => boolean, shown: string) => {
    const v = s[key]
    if (ok(v)) out[key] = v as DocSettings[K]
    else problems.push(`The setting "${key}" was ${absent(v) ? 'missing' : 'not valid'}: it is now ${shown}.`)
  }
  take('mono', (v) => typeof v === 'boolean', 'off')
  take('labelMode', (v) => (LABEL_MODES as readonly unknown[]).includes(v), '"text"')
  take('labelSize', (v) => typeof v === 'number' && Number.isFinite(v) && v > 0, String(DEFAULT_SETTINGS.labelSize))
  take('smartText', (v) => typeof v === 'boolean', 'on')
  return out
}

const fail = (problem: string): ParseResult => ({ ok: false, problems: [problem] })

/**
 * Check a value from a file and make it a document: `{ ok: true, doc, problems }`, or `{ ok: false, problems }` when its
 * top-level shape is wrong (not a PracDraw diagram, no valid version, no items, draw order or settings). An item with a
 * bad field is left out and listed. A bad title or setting takes the default and is listed. A label whose leader is
 * fixed to an item that is not a symbol of the document becomes plain text, and is listed. The draw order loses ids of
 * no item and repeats; an item missing from it is drawn on top, and listed. `migrations` is for tests.
 */
export function parseDoc(value: unknown, migrations: Readonly<Record<number, Migration>> = MIGRATIONS, current?: number): ParseResult {
  if (!isObj(value) || value.app !== 'pracdraw') return fail('The file does not hold a PracDraw diagram.')
  const m = current === undefined ? migrate(value, migrations) : migrate(value, migrations, current)
  if (!m.ok) return m
  const raw = m.doc
  const problems = [...m.problems]
  if (!isObj(raw.items) || !Array.isArray(raw.order) || !isObj(raw.settings))
    return fail('The file does not hold a PracDraw diagram: its items, draw order or settings are missing.')

  const title = typeof raw.title === 'string' ? raw.title : 'Untitled diagram'
  if (typeof raw.title !== 'string') problems.push('The diagram had no title: it is now "Untitled diagram".')
  const settings = readSettings(raw.settings, problems)

  const items: Record<Id, Item> = {}
  for (const [id, v] of Object.entries(raw.items)) {
    try {
      if (!id || id === '__proto__') throw new Bad('its id is not a name')
      items[id] = readItem(id, v)
    } catch (e) {
      if (!(e instanceof Bad)) throw e
      problems.push(`Left out item "${id}" (${what(v)}): ${e.message}.`)
    }
  }

  // A leader fixed to an item must end on a symbol of this document: otherwise the label is plain text.
  for (const it of Object.values(items)) {
    if (it.type !== 'label' || !it.target || !('item' in it.target)) continue
    const owner = Object.hasOwn(items, it.target.item) ? items[it.target.item] : undefined
    if (owner?.type === 'symbol') continue
    const rest: LabelItem = { ...it }
    delete rest.target
    items[it.id] = rest
    problems.push(`The leader of the label "${short(it.text)}" ended on a part that is not in the diagram: the label is now plain text.`)
  }

  const order: Id[] = []
  const seen = new Set<Id>()
  for (const id of raw.order) {
    if (typeof id !== 'string' || !Object.hasOwn(items, id) || seen.has(id)) continue
    seen.add(id)
    order.push(id)
  }
  const missing = Object.keys(items).filter((id) => !seen.has(id))
  if (missing.length) {
    order.push(...missing)
    problems.push(
      missing.length === 1
        ? 'One item was missing from the draw order: it is drawn on top.'
        : `${missing.length} items were missing from the draw order: they are drawn on top.`,
    )
  }

  return { ok: true, doc: { app: 'pracdraw', version: 1, title, items, order, settings }, problems }
}

/** Read the text of a `.pracdraw.json` file (or a document in storage): JSON, then `parseDoc`. */
export function parseDocJson(text: string): ParseResult {
  let value: unknown
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return fail('The file does not hold a PracDraw diagram: it is not JSON.')
  }
  return parseDoc(value)
}
