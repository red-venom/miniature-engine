// types.ts — what a symbol is. A symbol is code: a pure function from size and parameters to geometry.
//
// LOCAL FRAME (every symbol): x = 0 is the centre line of the nominal box, y = 0 is its top, y = h is its bottom.
// So the box is x ∈ [-w/2, w/2], y ∈ [0, h]. Small parts may stick out of the box (lips, side arms, scale numbers).

import type { Pt } from '../kernel/geom'

export type ParamValue = number | string | boolean

/** How a path is painted. The renderer maps roles to colours and widths. A symbol names a colour only as a `tint`. */
export type Role =
  | 'outline' // main line, 2 u, no fill
  | 'heavy' // 3 u, no fill (tripod top, clamp jaws)
  | 'detail' // 1.25 u, no fill (graduations, small features)
  | 'dashed' // 1.25 u dashed, no fill (filter paper, light beams, insulation, a solvent front)
  | 'paper' // white fill, no line: hides what is behind (use for solid glass parts that are not a cavity)
  | 'solid' // main line + white fill (metal and wood parts)
  | 'rubber' // main line + grey fill (bungs, mats, tubing ends)
  | 'tint' // main line + light-grey fill (particles and regions that a key tells apart); photocopy-safe: white fill, so pair it with a 'hatch' prim
  | 'hatch' // detail-weight parallel lines inside a tinted shape, drawn in photocopy-safe mode only (see kernel/hatch.ts)
  | 'ink' // solid ink fill, no line (electron dots, small markers); the same in both modes
  | 'dark' // main line + dark fill (carbon rods, weights)
  | 'flame' // flame outer cone: pale blue, or its tint
  | 'flameCore' // flame inner cone: blue, or its tint
  | 'mesh' // gauze

export interface Prim {
  d: string
  role: Role
  /** Fill colour for this part in colour mode (roles with a fill only). Photocopy-safe mode ignores it. */
  tint?: string
}

/** Text that belongs to the symbol (scale numbers, meter letters, display readings). Never mirrored. */
export interface SymbolText {
  x: number
  y: number
  text: string
  size: number
  anchor: 'start' | 'middle' | 'end'
}

/**
 * A closed region that can hold contents. It is also painted white first, so it hides items behind it.
 * For an open vessel the top edge of the polygon lies 1.5 u below the rim.
 */
export interface Cavity {
  id: string
  polys: Pt[][]
  /**
   * A thread: a cavity so thin that its liquid is a line (the red thread of a thermometer). In photocopy-safe mode its
   * liquid is a line down its centre, so that the reading survives. No other cavity gets such a line: in a jet or a stem
   * it would read as a third wall.
   */
  thread?: boolean
}

export type AnchorKind =
  | 'base' // flat underside that rests on a surface
  | 'surface' // flat top that things rest on
  | 'mouth' // opening that takes a plug
  | 'plug' // bung, stopper or cone that goes in a mouth
  | 'port' // tube connection: side arm, bung hole, burner inlet, water port
  | 'tip' // outlet or lower end: burette jet, funnel stem, thermometer bulb
  | 'neck' // where a clamp grips
  | 'grip' // clamp jaws
  | 'rod' // clamp-stand rod (a vertical line: y is free)
  | 'sleeve' // boss that slides on a rod
  | 'round' // round bottom (rests in a cork ring or mantle)
  | 'cup' // recess that takes a round bottom
  | 'terminal' // electrical connection
  | 'heat' // top of a flame or hot surface

export interface Anchor {
  id: string
  kind: AnchorKind
  x: number
  y: number
  /** Outward direction, degrees clockwise from +x. 90 = down, -90 = up. */
  dir?: number
  /** Width of the mouth, plug, base or surface. */
  width?: number
}

/** A linear scale on an instrument, tied to a cavity so that "set reading" can place the liquid level. */
export interface ScaleDef {
  cavity: string
  unit: string
  /** Value at local y = y0, and value at local y = y1. */
  v0: number
  y0: number
  v1: number
  y1: number
}

export interface Geometry {
  /** Back to front. */
  prims: Prim[]
  texts?: SymbolText[]
  cavities?: Cavity[]
  anchors?: Anchor[]
  scale?: ScaleDef
  /** Good places for a leader line to end, one for each side. Default: the middle of each side of the box. */
  labelAt?: { left: Pt; right: Pt }
}

export type ParamDef =
  | { key: string; label: string; type: 'boolean'; default: boolean }
  | { key: string; label: string; type: 'number'; default: number; min: number; max: number; step?: number }
  | { key: string; label: string; type: 'choice'; default: string; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'text'; default: string }

export type PackId =
  | 'containers'
  | 'measuring'
  | 'heating'
  | 'support'
  | 'filtering'
  | 'organic'
  | 'electrochemistry'
  | 'physics'
  | 'biology'
  | 'circuit'
  | 'annotation'
  | 'atoms'
  | 'matter'
  | 'energy'

export type ResizeMode = 'free' | 'uniform' | 'width' | 'height' | 'none'

export interface BuildArgs {
  w: number
  h: number
  /** Defaults already merged in. */
  p: Record<string, ParamValue>
}

export interface SymbolDef {
  /** lowerCamelCase. Stable for ever: saved files refer to it. */
  id: string
  /** Shown in the library and used as the automatic label text (lower case in labels). */
  name: string
  /** Extra search words: other names for the same apparatus. */
  aliases?: string[]
  /**
   * Text for an automatic label, when the default is wrong (a proper noun, an abbreviation). See `labelText`.
   * A function gets the item's parameters (defaults merged in), for a symbol whose name depends on them.
   */
  label?: string | ((p: Record<string, ParamValue>) => string)
  /** false = "Label all" skips this symbol (bench line, arrows, circuit symbols). */
  autoLabel?: boolean
  pack: PackId
  /** Default nominal box. */
  size: { w: number; h: number }
  resize: ResizeMode
  min?: { w: number; h: number }
  params?: ParamDef[]
  /** Pure. Same input, same output. No randomness, no DOM, no dates. */
  build(a: BuildArgs): Geometry
}
