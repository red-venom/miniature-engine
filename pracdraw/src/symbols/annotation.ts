// annotation.ts — the "Annotation" pack: every symbol of this pack that is not a pilot.
// One author owns this file. Each symbol follows its row in the Symbol catalogue (spec/catalogue.json). Copy the nearest pilot.

import { P, Path, f, roundPoly, v, type Pt, type V } from '../kernel/geom'
import { SCRIPT } from '../kernel/nodes'
import { parseMarkup } from '../kernel/text'
import { bool, circle, closed, num, rect, str } from './kit'
import { luminousFlame } from './support'
import type { ParamValue, Prim, SymbolDef, SymbolText } from './types'

/** Side view of an eye that looks to the right. Turn the item to make it look another way. */
const eye: SymbolDef = {
  id: 'eye',
  name: 'Eye',
  aliases: ['observer', 'eye level'],
  autoLabel: false,
  pack: 'annotation',
  size: { w: 46, h: 26 },
  resize: 'uniform',
  min: { w: 23, h: 13 },
  build({ h }) {
    const k = h / 26,
      s = (n: number) => n * k,
      W = 46,
      H = 26,
      back = -W / 2,
      xf = 0.3 * W, // where the lids meet the front arc
      ym = H / 2
    // Front arc through (xf, 0), (W/2, ym) and (xf, H): sagitta W/2 - xf on a chord H.
    const sag = W / 2 - xf,
      r = (sag * sag + ym * ym) / (2 * sag),
      cx = W / 2 - r
    const lids = new Path().M(s(back), s(ym)).L(s(xf), 0).M(s(back), s(ym)).L(s(xf), s(H))
    const front = new Path().M(s(xf), 0).A(s(r), s(xf), s(H))
    // Iris: a concentric arc 4 u inside the front, over 120 degrees.
    const ri = r - 4,
      a = Math.PI / 3
    const iris = new Path().M(s(cx + ri * Math.cos(a)), s(ym - ri * Math.sin(a))).A(s(ri), s(cx + ri * Math.cos(a)), s(ym + ri * Math.sin(a)))
    // Pupil: a lens 4 wide and 10 high, on the iris at the middle of the front.
    const px = cx + ri - 0.5,
      ph = 5,
      rp = (2 * 2 + ph * ph) / (2 * 2) // circular arcs with a sagitta of 2 on a chord of 2·ph
    const pupil = new Path()
      .M(s(px), s(ym - ph))
      .A(s(rp), s(px), s(ym + ph))
      .A(s(rp), s(px), s(ym - ph))
      .Z()
    return {
      prims: [
        { d: lids.d() + front.d(), role: 'outline' },
        { d: iris.d(), role: 'detail' },
        { d: pupil.d(), role: 'dark' },
      ],
    }
  },
}

/**
 * A flame on its own: the luminous (safety) flame of the Bunsen burner and the burning splint, drawn the same way, `h` high.
 * Its flat foot is the bottom edge of the box: stand it on a burner, a wick or a candle.
 */
const flame: SymbolDef = {
  id: 'flame',
  name: 'Flame',
  autoLabel: false,
  pack: 'annotation',
  size: { w: 26, h: 44 },
  resize: 'uniform',
  min: { w: 13, h: 22 },
  build({ h }) {
    const k = h / 38 // the flame of the pilot is 14 u wide at its foot and 38 u high
    return {
      prims: [luminousFlame(0, h, h, 14 * k)],
      anchors: [{ id: 'base', kind: 'base', x: 0, y: h, dir: 90, width: 14 * k }],
    }
  },
}

/** A teardrop `height` high and 0.7 `height` wide, point up, with its tip at (0, top): a circle with two straight sides to the tip. */
function teardrop(top: number, height: number): string {
  const r = 0.35 * height,
    d = height - r, // from the tip to the centre of the round end
    a = Math.acos(r / d), // the sides touch the circle where the tangent from the tip leaves it
    tx = r * Math.sin(a),
    ty = top + d - r * Math.cos(a)
  return new Path().M(0, top).L(tx, ty).A(r, -tx, ty, true, true).Z().d()
}

const drops: SymbolDef = {
  id: 'drops',
  name: 'Drops',
  aliases: ['drip', 'droplets'],
  autoLabel: false,
  pack: 'annotation',
  size: { w: 12, h: 44 },
  resize: 'height',
  min: { w: 12, h: 36 },
  params: [{ key: 'count', label: 'Count', type: 'number', default: 2, min: 1, max: 4, step: 1 }],
  build({ h, p }) {
    const n = Math.max(1, Math.round(num(p.count, 2))),
      gap = 4, // least distance from the bottom of one drop to the tip of the next: 2 u of clear paper between the lines
      size = Math.max(1, Math.min(10, (h - (n - 1) * gap) / n)), // 10 u high; a little smaller when four must fit the default box
      pitch = n > 1 ? (h - size) / (n - 1) : 0, // the first drop at the top, the last at the bottom
      top = n > 1 ? 0 : (h - size) / 2
    let d = ''
    for (let i = 0; i < n; i++) d += teardrop(top + i * pitch, size)
    return { prims: [{ d, role: 'solid' }] }
  },
}

/** The liquid presets of section 9 of the specification, by colour name. */
const PAPER_TINT: Record<string, string> = {
  red: '#e98a8a',
  blue: '#7fb8e6',
  green: '#8fce8a',
  orange: '#f2b56b',
  yellow: '#f5e58a',
  purple: '#b497d6',
}

const indicatorPaper: SymbolDef = {
  id: 'indicatorPaper',
  name: 'Indicator paper',
  aliases: ['litmus paper', 'pH paper', 'universal indicator paper'],
  pack: 'annotation',
  size: { w: 14, h: 60 },
  resize: 'free',
  min: { w: 6, h: 10 },
  params: [
    {
      key: 'colour',
      label: 'Colour',
      type: 'choice',
      default: 'red',
      options: Object.keys(PAPER_TINT).map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
    },
  ],
  build({ w, h, p }) {
    return { prims: [{ d: rect(-w / 2, 0, w / 2, h), role: 'solid', tint: PAPER_TINT[str(p.colour, 'red')] ?? PAPER_TINT.red }] }
  },
}

const flameTestLoop: SymbolDef = {
  id: 'flameTestLoop',
  name: 'Flame test wire',
  aliases: ['nichrome wire', 'wire loop'],
  pack: 'annotation',
  size: { w: 180, h: 12 },
  resize: 'width',
  min: { w: 100, h: 12 },
  build({ w, h }) {
    const x = w / 2,
      y = h / 2,
      r = 4, // the loop at the right end
      hx = -x + 0.45 * w // the handle ends here
    return {
      prims: [
        // The wire starts inside the handle, which hides its end.
        { d: `M${f(hx - 4)} ${f(y)}H${f(x - 2 * r)}` + circle(x - r, y, r), role: 'detail' },
        { d: closed([v(-x, y - 4, 2), v(hx, y - 4, 2), v(hx, y + 4, 2), v(-x, y + 4, 2)]).d(), role: 'solid' },
      ],
      anchors: [{ id: 'loop', kind: 'tip', x: x - r, y, dir: 0 }],
    }
  },
}

/** A thin strip in side view: three shallow arcs, drawn as two parallel outlines 3 u apart. */
const magnesiumRibbon: SymbolDef = {
  id: 'magnesiumRibbon',
  name: 'Metal ribbon',
  aliases: ['magnesium ribbon', 'magnesium strip'],
  label: 'magnesium ribbon',
  pack: 'annotation',
  size: { w: 60, h: 12 },
  resize: 'free',
  min: { w: 24, h: 8 },
  build({ w, h }) {
    const n = 3,
      t = 1.5, // half the thickness of the strip
      ym = h / 2,
      sag = 0.22 * h, // of each arc, above or below the middle line
      c = (w - 2) / n, // chord of each arc: the tilted end caps stay inside the box
      r = (sag * sag + (c * c) / 4) / (2 * sag),
      x0 = -w / 2 + 1
    // Arc i bulges up when i is even. Its centre is r - sag below (up) or above (down) the middle line.
    const centre = (i: number) => ({ x: x0 + (i + 0.5) * c, y: ym + (i % 2 === 0 ? 1 : -1) * (r - sag) })
    // The point of the upper (side = -1) or lower (+1) outline at the chord end x, on arc i.
    const at = (i: number, x: number, side: number) => {
      const o = centre(i),
        dx = x - o.x,
        dy = ym - o.y,
        d = Math.hypot(dx, dy),
        k = (d - side * (i % 2 === 0 ? 1 : -1) * t) / d // the outline farther from the centre is t outside the arc
      return { x: o.x + dx * k, y: o.y + dy * k }
    }
    const radius = (i: number, side: number) => r + (i % 2 === 0 ? -side : side) * t
    const p0 = at(0, x0, -1)
    const path = new Path().M(p0.x, p0.y)
    for (let i = 0; i < n; i++) {
      const q = at(i, x0 + (i + 1) * c, -1)
      path.A(radius(i, -1), q.x, q.y, i % 2 === 0)
    }
    const end = at(n - 1, x0 + n * c, 1)
    path.L(end.x, end.y)
    for (let i = n - 1; i >= 0; i--) {
      const q = at(i, x0 + i * c, 1)
      path.A(radius(i, 1), q.x, q.y, i % 2 !== 0)
    }
    return { prims: [{ d: path.Z().d(), role: 'solid' }] }
  },
}

// ================================================================ release 1.2: the pH scale, the formula triangle and the hazard symbol
// Each of the three has a data model that this file exports (the bands of the pH scale, the quantities of a formula triangle, the nine hazards).
// The drawing is made from the model, and `annotation.science.test.ts` tests the model and checks that the drawing agrees with it.

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

/** Arial advance widths of the characters 32 (space) to 126 (~), in thousandths of an em: the Helvetica metrics, which Arial matches. */
const ADVANCE: readonly number[] = [
  // space ! " # $ % & ' ( ) * + , - . /
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  // 0 to 9
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
  // : ; < = > ? @
  278, 278, 584, 584, 584, 556, 1015,
  // A to Z
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
  // [ \ ] ^ _ `
  278, 278, 278, 469, 556, 333,
  // a to z
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500,
  // { | } ~
  334, 260, 334, 584,
]

/**
 * The width of one line of symbol text in u at a size, as the renderer draws it: the markup of a label (`M_r`, `cm^3`) is read, and a subscript or
 * superscript is 0.7 of the size. Text may not scale with the symbol (rule S3), so a symbol measures its text to see whether it fits.
 */
export function textWidth(text: string, size: number): number {
  return parseMarkup(text).reduce((w, run) => {
    let em = 0
    for (const ch of run.text) {
      const c = ch.charCodeAt(0)
      em += c >= 32 && c <= 126 ? ADVANCE[c - 32] / 1000 : 0.56
    }
    return w + em * size * (run.script === 'normal' ? 1 : SCRIPT.scale)
  }, 0)
}

/** Arial: the height of a capital letter or a digit, and how far the middle of one lies above the baseline, as fractions of the size. */
const CAP = 0.716,
  MIDDLE = 0.358

// ---------------------------------------------------------------- pH scale

/** The colours of universal indicator, in the order of the scale. */
export type PhColour = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple'
export const PH_COLOURS: readonly PhColour[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']

/** The test colour of each band: the liquid presets of section 9 of the specification, the same tints as the indicator paper. */
export const PH_TINT: Readonly<Record<PhColour, string>> = {
  red: PAPER_TINT.red,
  orange: PAPER_TINT.orange,
  yellow: PAPER_TINT.yellow,
  green: PAPER_TINT.green,
  blue: PAPER_TINT.blue,
  purple: PAPER_TINT.purple,
}

/** The ends of the scale, and the pH of pure water: below it is acidic, above it is alkaline. */
export const PH_LOW = 0,
  PH_HIGH = 14,
  PH_NEUTRAL = 7

/** How strongly acidic or alkaline a pH is, in the words of the course. */
export type PhStrength = 'strong acid' | 'weak acid' | 'neutral' | 'weak alkali' | 'strong alkali'

/**
 * The band edges: the one table that says which test colour goes with which pH, and how strong that is. Sources put the edges in different places
 * (strong acid is pH 0 to 2 in one and 1 to 3 in another); the specification takes 0 to 2, and this table is the only place to change that.
 * Every pH lies in exactly one band, and the bands follow each other from red to purple.
 */
export const PH_BANDS: readonly { colour: PhColour; strength: PhStrength; from: number; to: number }[] = [
  { colour: 'red', strength: 'strong acid', from: 0, to: 2 },
  { colour: 'orange', strength: 'weak acid', from: 3, to: 4 },
  { colour: 'yellow', strength: 'weak acid', from: 5, to: 6 },
  { colour: 'green', strength: 'neutral', from: 7, to: 7 },
  { colour: 'blue', strength: 'weak alkali', from: 8, to: 11 },
  { colour: 'purple', strength: 'strong alkali', from: 12, to: 14 },
]

export type PhKind = 'acid' | 'neutral' | 'alkali'
export const phKind = (ph: number): PhKind => (ph < PH_NEUTRAL ? 'acid' : ph > PH_NEUTRAL ? 'alkali' : 'neutral')

/** One cell of the strip. */
export interface PhCell {
  ph: number
  colour: PhColour
  tint: string
  kind: PhKind
}

/** The 15 cells in order, from pH 0 to pH 14: each with the colour of the band that holds its pH. */
export const PH_CELLS: readonly PhCell[] = Array.from({ length: PH_HIGH - PH_LOW + 1 }, (_, i) => {
  const ph = PH_LOW + i,
    band = PH_BANDS.find((b) => ph >= b.from && ph <= b.to)
  if (!band) throw new Error(`pH ${ph} is in no band of PH_BANDS`)
  return { ph, colour: band.colour, tint: PH_TINT[band.colour], kind: phKind(ph) }
})

/** A bracket over some cells with its word: acidic below 7, neutral at 7, alkaline above 7. */
export interface PhBracket {
  word: string
  kind: PhKind
  from: number
  to: number
}
export const PH_BRACKETS: readonly PhBracket[] = [
  { word: 'acidic', kind: 'acid', from: PH_LOW, to: PH_NEUTRAL - 1 },
  { word: 'neutral', kind: 'neutral', from: PH_NEUTRAL, to: PH_NEUTRAL },
  { word: 'alkaline', kind: 'alkali', from: PH_NEUTRAL + 1, to: PH_HIGH },
]

/** A substance written under (or beside) the strip, at its pH. */
export interface PhExample {
  name: string
  ph: number
}
export const PH_EXAMPLES: readonly PhExample[] = [
  { name: 'lemon juice', ph: 2 },
  { name: 'water', ph: 7 },
  { name: 'soap', ph: 10 },
  { name: 'bleach', ph: 13 },
]

/** What a pH scale shows for a set of parameters. The drawing is made from this, and nothing else. */
export interface PhScaleModel {
  orientation: 'horizontal' | 'vertical'
  /** All 15 cells, in order. */
  cells: readonly PhCell[]
  /** Whether each cell carries its number: the numbers are what keep a photocopy readable. */
  numbers: boolean
  brackets: readonly PhBracket[]
  examples: readonly PhExample[]
}

export function phScaleModel(p: Record<string, ParamValue>): PhScaleModel {
  return {
    orientation: str(p.orientation, 'horizontal') === 'vertical' ? 'vertical' : 'horizontal',
    cells: PH_CELLS,
    numbers: bool(p.numbers, true),
    brackets: bool(p.brackets, true) ? PH_BRACKETS : [],
    examples: bool(p.examples, false) ? PH_EXAMPLES : [],
  }
}

/** Text sizes of the pH scale, in u (rule S11 as relaxed: 12 to 18). */
const PH_NUMBER = 16,
  PH_WORD = 12
/** Across the strip, at the default height: the room for the brackets above it, and for the example substances below it. */
const PH_ABOVE = 22,
  PH_BELOW = 20

/**
 * The pH scale: a strip of 15 cells, each with its test colour and its number, and the brackets and example substances over and under it.
 * Horizontal, the strip is as long as the box is wide and as high as the box leaves room for (22 u above it for the brackets, 20 u below for the
 * examples), so the default box makes square cells of 28 u. Vertical, it runs down the height of the box with pH 0 at the top, on the centre line,
 * with the brackets on its left and the examples on its right; it needs a box that is tall (a cell needs 12 u for its number: 180 u at least) and
 * wide enough for the words (about 170 u). The text is upright either way.
 */
const phScale: SymbolDef = {
  id: 'phScale',
  name: 'pH scale',
  aliases: ['pH colours', 'universal indicator colours', 'acid alkali scale'],
  label: 'pH scale',
  pack: 'annotation',
  size: { w: 420, h: 70 },
  resize: 'free',
  min: { w: 360, h: 62 },
  params: [
    {
      key: 'orientation',
      label: 'Orientation',
      type: 'choice',
      default: 'horizontal',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
      ],
    },
    { key: 'numbers', label: 'Numbers', type: 'boolean', default: true },
    { key: 'brackets', label: 'Brackets', type: 'boolean', default: true },
    { key: 'examples', label: 'Examples', type: 'boolean', default: false },
  ],
  build({ w, h, p }) {
    const m = phScaleModel(p),
      vertical = m.orientation === 'vertical',
      pitch = (vertical ? h : w) / m.cells.length, // the length of one cell along the strip
      thick = vertical ? clamp(pitch, 20, 56) : Math.max(20, h - PH_ABOVE - PH_BELOW), // and its width across the strip
      near = vertical ? -thick / 2 : PH_ABOVE, // the edge of the strip that the brackets face (y from the top of the box, or x from the centre line)
      far = near + thick,
      mid = (near + far) / 2
    // A point `a` along the strip from its start (the left or the top) and `c` across it.
    const at = (a: number, c: number): Pt => (vertical ? P(c, a) : P(a - w / 2, c))
    const prims: Prim[] = [],
      texts: SymbolText[] = []

    // The cells: one closed shape each, with its test colour in colour mode. Photocopy-safe mode draws them white, with their outlines.
    m.cells.forEach((cell, i) => {
      const a = at(i * pitch, near),
        b = at((i + 1) * pitch, far)
      prims.push({ d: rect(a.x, a.y, b.x, b.y), role: 'solid', tint: cell.tint })
    })

    // The numbers, in the middle of their cells: as large as the cell allows, up to 16 u.
    if (m.numbers) {
      const size = clamp(Math.min(((vertical ? thick : pitch) - 4) / 1.112, ((vertical ? pitch : thick) - 6) / CAP), 12, PH_NUMBER)
      m.cells.forEach((cell, i) => {
        const q = at((i + 0.5) * pitch, mid)
        texts.push({ x: q.x, y: q.y + MIDDLE * size, text: String(cell.ph), size, anchor: 'middle' })
      })
    }

    // The brackets face the strip, with their words on the far side of them; 2 u are left between neighbours.
    if (m.brackets.length) {
      const line = near - 8
      let d = ''
      for (const b of m.brackets) {
        const a0 = b.from * pitch + 2,
          a1 = (b.to + 1) * pitch - 2
        d += [at(a0, line + 5), at(a0, line), at(a1, line), at(a1, line + 5)].map((q, i) => `${i ? 'L' : 'M'}${f(q.x)} ${f(q.y)}`).join('')
        const q = at((a0 + a1) / 2, line - 5)
        texts.push(
          vertical
            ? { x: q.x, y: q.y + MIDDLE * PH_WORD, text: b.word, size: PH_WORD, anchor: 'end' }
            : { x: q.x, y: q.y, text: b.word, size: PH_WORD, anchor: 'middle' },
        )
      }
      prims.push({ d, role: 'detail' })
    }

    // The example substances: a short tick from the cell, and the name beyond it.
    if (m.examples.length) {
      let d = ''
      for (const e of m.examples) {
        const a = (e.ph - PH_LOW + 0.5) * pitch,
          q0 = at(a, far + 2),
          q1 = at(a, far + 6.5),
          q = at(a, far + (vertical ? 10 : 17))
        d += `M${f(q0.x)} ${f(q0.y)}L${f(q1.x)} ${f(q1.y)}`
        texts.push(
          vertical
            ? { x: q.x, y: q.y + MIDDLE * PH_WORD, text: e.name, size: PH_WORD, anchor: 'start' }
            : { x: q.x, y: q.y, text: e.name, size: PH_WORD, anchor: 'middle' },
        )
      }
      prims.push({ d, role: 'detail' })
    }
    return { prims, texts }
  },
}

// ---------------------------------------------------------------- formula triangle

/** The three parts of a formula triangle: one quantity at the top, two at the bottom. */
export type TrianglePart = 'top' | 'left' | 'right'
export const TRIANGLE_PARTS: readonly TrianglePart[] = ['top', 'left', 'right']

/** A unit as exponents of the base units: grams (g), moles (mol) and cubic decimetres (dm3). Grams per mole is `{ g: 1, mol: -1 }`. */
export type Units = Readonly<Record<string, number>>

/** The units of a product of two quantities: the exponents add, and a unit whose exponent is 0 is left out. */
export function unitsOfProduct(a: Units, b: Units): Units {
  const out: Record<string, number> = { ...a }
  for (const [unit, e] of Object.entries(b)) out[unit] = (out[unit] ?? 0) + e
  return Object.fromEntries(Object.entries(out).filter(([, e]) => e !== 0))
}

/** One quantity of a formula triangle. */
export interface TriangleQuantity {
  /** In words. */
  name: string
  /** As the triangle shows it: label markup, so `M_r` is M with a subscript r. */
  text: string
  units: Units
  /** A number out of 100: a product that has one is 100 times too big. */
  percent: boolean
}

/** A formula triangle: `top` is the product of `left` and `right`. */
export interface TrianglePreset {
  top: TriangleQuantity
  left: TriangleQuantity
  right: TriangleQuantity
  /** A worked example: one number for each quantity, in its own units. */
  example: Readonly<Record<TrianglePart, number>>
}

const quantity = (name: string, text: string, units: Units, percent = false): TriangleQuantity => ({ name, text, units, percent })

export const TRIANGLE_PRESETS = {
  // mass (g) = amount (mol) × relative formula mass (g/mol): 2 mol of water, Mr 18, is 36 g
  moles: {
    top: quantity('mass', 'm', { g: 1 }),
    left: quantity('amount of substance', 'n', { mol: 1 }),
    right: quantity('relative formula mass', 'M_r', { g: 1, mol: -1 }),
    example: { top: 36, left: 2, right: 18 },
  },
  // amount (mol) = concentration (mol/dm3) × volume (dm3)
  concentration: {
    top: quantity('amount of substance', 'n', { mol: 1 }),
    left: quantity('concentration', 'c', { mol: 1, dm3: -1 }),
    right: quantity('volume', 'V', { dm3: 1 }),
    example: { top: 0.1, left: 0.5, right: 0.2 },
  },
  // volume of a gas (dm3) = amount (mol) × the molar volume, 24 dm3/mol at room temperature and pressure
  gasVolume: {
    top: quantity('volume of gas', 'V', { dm3: 1 }),
    left: quantity('amount of substance', 'n', { mol: 1 }),
    right: quantity('molar volume of a gas', '24', { dm3: 1, mol: -1 }),
    example: { top: 48, left: 2, right: 24 },
  },
  // actual yield (g) = percentage yield (out of 100) × theoretical yield (g). The words do not fit a triangle of 120 u at 12 to 18 u, so it says
  // "actual", "%" and "max" (the maximum, theoretical, yield).
  yield: {
    top: quantity('actual yield', 'actual', { g: 1 }),
    left: quantity('percentage yield', '%', {}, true),
    right: quantity('theoretical yield', 'max', { g: 1 }),
    example: { top: 20, left: 80, right: 25 },
  },
} as const satisfies Record<string, TrianglePreset>
export type TrianglePresetId = keyof typeof TRIANGLE_PRESETS

/** How many times the product of the two bottom quantities is the top quantity: 100 when one of them is a percentage. */
export function triangleFactor(preset: TrianglePreset): number {
  const n = (q: TriangleQuantity) => (q.percent ? 1 : 0)
  return 100 ** (n(preset.left) + n(preset.right) - n(preset.top))
}

/** What covering a part shows: the top is the product of the bottom two; a bottom part is the top divided by the other bottom part. */
export interface CoverRule {
  shows: TrianglePart
  op: 'product' | 'quotient'
  /** The two quantities that the rule uses, the numerator first for a quotient. */
  of: readonly [TrianglePart, TrianglePart]
}
export function coverRule(covered: TrianglePart): CoverRule {
  if (covered === 'top') return { shows: 'top', op: 'product', of: ['left', 'right'] }
  return { shows: covered, op: 'quotient', of: ['top', covered === 'left' ? 'right' : 'left'] }
}

/** The number that covering a part gives, from the other two (the worked example, unless given). */
export function coverValue(preset: TrianglePreset, covered: TrianglePart, v: Readonly<Record<TrianglePart, number>> = preset.example): number {
  const factor = triangleFactor(preset)
  if (covered === 'top') return (v.left * v.right) / factor
  return (v.top * factor) / (covered === 'left' ? v.right : v.left)
}

/** What a formula triangle shows for a set of parameters. The drawing is made from this, and nothing else. */
export interface TriangleModel {
  preset: TrianglePresetId | 'custom'
  /** The text of each part, as set by the preset or, for a custom triangle, by the parameters. */
  texts: Readonly<Record<TrianglePart, string>>
  /** The part that is left empty (a worksheet), or null. */
  hidden: TrianglePart | null
  /** The parts whose text is drawn: every part but the hidden one. */
  shown: readonly TrianglePart[]
}

export function triangleModel(p: Record<string, ParamValue>): TriangleModel {
  const id = str(p.preset, 'moles'),
    preset = Object.hasOwn(TRIANGLE_PRESETS, id) ? TRIANGLE_PRESETS[id as TrianglePresetId] : null,
    hide = str(p.hide, 'none'),
    hidden = hide === 'top' || hide === 'left' || hide === 'right' ? hide : null
  return {
    preset: preset ? (id as TrianglePresetId) : 'custom',
    texts: preset
      ? { top: preset.top.text, left: preset.left.text, right: preset.right.text }
      : { top: str(p.top, 'm'), left: str(p.left, 'n'), right: str(p.right, 'Mr') },
    hidden,
    shown: TRIANGLE_PARTS.filter((part) => part !== hidden),
  }
}

/** The size of the text of a formula triangle at its default size, in u (rule S11 as relaxed: 12 to 18). */
const TRIANGLE_TEXT = 16
/** From the middle of a line to the text beside it: half the line and 3.5 u of clear paper. */
const TEXT_GAP = 4.5

/** Where the lines and the three parts of a formula triangle lie, at a height of the box. The triangle fills the box, less half its line. */
export interface TriangleLayout {
  /** The scale: the height over the default height of 110 u. */
  k: number
  apexY: number
  baseY: number
  /** Half the width of the base. */
  half: number
  /** The height of the horizontal line. */
  y: number
  /** Half the width of the triangle at a height. */
  halfAt(y: number): number
  /** Each part as a polygon, to the middle of the lines. */
  parts: Readonly<Record<TrianglePart, Pt[]>>
}

export function triangleLayout(h: number): TriangleLayout {
  const k = h / 110,
    apexY = 1,
    baseY = h - 1,
    half = 60 * k - 1,
    y = apexY + 0.59 * (baseY - apexY),
    halfAt = (yy: number) => (half * (yy - apexY)) / (baseY - apexY),
    e = halfAt(y)
  return {
    k,
    apexY,
    baseY,
    half,
    y,
    halfAt,
    parts: {
      top: [P(0, apexY), P(-e, y), P(e, y)],
      left: [P(-e, y), P(0, y), P(0, baseY), P(-half, baseY)],
      right: [P(e, y), P(half, baseY), P(0, baseY), P(0, y)],
    },
  }
}

/** The size and the places of the three texts: `at` is the middle of the text on its baseline. */
export interface TriangleTexts {
  size: number
  at: Readonly<Record<TrianglePart, Pt>>
  /** False when even the smallest size (12 u) is too big for a part: a long custom text runs over its lines. */
  fits: boolean
}

/**
 * The largest size, from 16 u (less and more as the triangle is smaller and larger, but 12 to 18) down to 12 u, at which each text sits inside its part
 * with `TEXT_GAP` to every line. All three texts count, whichever is hidden, so that a worksheet and its answer sheet are set alike.
 * The top text sits low in its part, as low as the width of the text needs; the bottom texts sit in the middle of theirs.
 */
export function triangleTexts(texts: Readonly<Record<TrianglePart, string>>, L: TriangleLayout): TriangleTexts {
  const place = (size: number): TriangleTexts => {
    const cap = CAP * size,
      width = (part: TrianglePart) => textWidth(texts[part], size)
    // The top text: its upper corners must lie inside the two sloping sides.
    const wanted = L.apexY + 0.7 * (L.y - L.apexY) + MIDDLE * size,
      needed = L.apexY + ((width('top') / 2 + TEXT_GAP) * (L.baseY - L.apexY)) / L.half + cap,
      lowest = L.y - TEXT_GAP
    // The bottom texts: the sloping side is nearest at the upper corner, and the vertical line on the other side.
    const base = (L.y + L.baseY) / 2 + MIDDLE * size,
      edge = L.halfAt(base - cap)
    const fits = Math.max(wanted, needed) <= lowest && width('left') <= edge - 2 * TEXT_GAP && width('right') <= edge - 2 * TEXT_GAP
    return { size, at: { top: P(0, Math.min(lowest, Math.max(wanted, needed))), left: P(-edge / 2, base), right: P(edge / 2, base) }, fits }
  }
  for (let size = clamp(TRIANGLE_TEXT * L.k, 12, 18); size > 12; size -= 0.5) {
    const t = place(size)
    if (t.fits) return t
  }
  return place(12)
}

const formulaTriangle: SymbolDef = {
  id: 'formulaTriangle',
  name: 'Formula triangle',
  aliases: ['formula triangle', 'magic triangle', 'moles triangle'],
  pack: 'annotation',
  size: { w: 120, h: 110 },
  resize: 'uniform',
  min: { w: 96, h: 88 },
  params: [
    {
      key: 'preset',
      label: 'Preset',
      type: 'choice',
      default: 'moles',
      options: [
        { value: 'moles', label: 'Moles' },
        { value: 'concentration', label: 'Concentration' },
        { value: 'gasVolume', label: 'Gas volume' },
        { value: 'yield', label: 'Yield' },
        { value: 'custom', label: 'Custom' },
      ],
    },
    { key: 'top', label: 'Top (custom)', type: 'text', default: 'm' },
    { key: 'left', label: 'Left (custom)', type: 'text', default: 'n' },
    { key: 'right', label: 'Right (custom)', type: 'text', default: 'Mr' },
    {
      key: 'hide',
      label: 'Hide',
      type: 'choice',
      default: 'none',
      options: [
        { value: 'none', label: 'None' },
        { value: 'top', label: 'Top' },
        { value: 'left', label: 'Left' },
        { value: 'right', label: 'Right' },
      ],
    },
  ],
  build({ h, p }) {
    const m = triangleModel(p),
      L = triangleLayout(h),
      r = 3 * L.k,
      e = L.halfAt(L.y)
    // The outline, then the horizontal line across it and the vertical line from it to the base: one main line.
    const d = closed([v(0, L.apexY, r), v(L.half, L.baseY, r), v(-L.half, L.baseY, r)]).d() + `M${f(-e)} ${f(L.y)}H${f(e)}M0 ${f(L.y)}V${f(L.baseY)}`
    const t = triangleTexts(m.texts, L)
    const texts: SymbolText[] = m.shown
      .filter((part) => m.texts[part] !== '')
      .map((part) => ({ x: t.at[part].x, y: t.at[part].y, text: m.texts[part], size: t.size, anchor: 'middle' }))
    return { prims: [{ d, role: 'outline' }], texts }
  },
}

// ---------------------------------------------------------------- hazard symbol

export type HazardId = 'explosive' | 'flammable' | 'oxidising' | 'gasUnderPressure' | 'corrosive' | 'toxic' | 'harmful' | 'health' | 'environment'

/** One of the nine GHS pictograms. */
export interface Hazard {
  id: HazardId
  /** The code of the pictogram in the Globally Harmonized System: GHS01 to GHS09. */
  ghs: string
  /** The name that goes under the diamond. */
  name: string
  /** What the picture shows. */
  shows: string
}

/** The nine pictograms, in the order of their GHS codes. */
export const HAZARDS: readonly Hazard[] = [
  { id: 'explosive', ghs: 'GHS01', name: 'explosive', shows: 'an exploding bomb' },
  { id: 'flammable', ghs: 'GHS02', name: 'flammable', shows: 'a flame' },
  { id: 'oxidising', ghs: 'GHS03', name: 'oxidising', shows: 'a flame over a circle' },
  { id: 'gasUnderPressure', ghs: 'GHS04', name: 'gas under pressure', shows: 'a gas cylinder' },
  { id: 'corrosive', ghs: 'GHS05', name: 'corrosive', shows: 'liquid dripping on a hand and a metal bar' },
  { id: 'toxic', ghs: 'GHS06', name: 'toxic', shows: 'a skull and crossbones' },
  { id: 'harmful', ghs: 'GHS07', name: 'harmful or irritant', shows: 'an exclamation mark' },
  { id: 'health', ghs: 'GHS08', name: 'health hazard', shows: 'a figure with a star on the chest' },
  { id: 'environment', ghs: 'GHS09', name: 'environmental hazard', shows: 'a dead tree and a fish' },
]

/** What a hazard symbol shows for a set of parameters. The drawing is made from this, and nothing else. */
export interface HazardModel {
  hazard: Hazard
  /** Whether the name is written under the diamond. */
  showName: boolean
}

export function hazardModel(p: Record<string, ParamValue>): HazardModel {
  const id = str(p.hazard, 'flammable')
  return { hazard: HAZARDS.find((q) => q.id === id) ?? HAZARDS[1], showName: bool(p.name, false) }
}

/**
 * A path drawn in the design frame of a pictogram: the origin is the middle of the diamond, y points down, and one unit is `k` u at the symbol's
 * size. `frame` moves and scales the frame, so that one shape can be drawn at more than one place and size. A solid runs clockwise on the screen and
 * a hole counter-clockwise: the pictures are `ink`, which is filled with the non-zero rule, so a hole is a shape inside a solid that runs the other way.
 */
class Pen {
  private readonly path = new Path()
  private readonly k: number
  private readonly cy: number
  private ox = 0
  private oy = 0
  private s = 1
  constructor(k: number, cy: number) {
    this.k = k
    this.cy = cy
  }
  frame(ox = 0, oy = 0, s = 1): this {
    this.ox = ox
    this.oy = oy
    this.s = s
    return this
  }
  private X(x: number): number {
    return (this.ox + x * this.s) * this.k
  }
  private Y(y: number): number {
    return this.cy + (this.oy + y * this.s) * this.k
  }
  M(x: number, y: number): this {
    this.path.M(this.X(x), this.Y(y))
    return this
  }
  L(x: number, y: number): this {
    this.path.L(this.X(x), this.Y(y))
    return this
  }
  /** A circular arc to (x, y); `sweep` is clockwise on the screen. */
  A(r: number, x: number, y: number, sweep = true, large = false): this {
    this.path.A(r * this.s * this.k, this.X(x), this.Y(y), sweep, large)
    return this
  }
  C(x1: number, y1: number, x2: number, y2: number, x: number, y: number): this {
    this.path.C(this.X(x1), this.Y(y1), this.X(x2), this.Y(y2), this.X(x), this.Y(y))
    return this
  }
  Z(): this {
    this.path.Z()
    return this
  }
  d(): string {
    return this.path.d()
  }
  /** A closed shape from points, turned to run the way a solid or a hole must. */
  poly(pts: readonly Pt[], hole = false): this {
    let sum = 0
    pts.forEach((q, i) => {
      const n = pts[(i + 1) % pts.length]
      sum += q.x * n.y - n.x * q.y
    })
    // On the screen a positive sum runs clockwise.
    const list = sum > 0 === !hole ? pts : [...pts].reverse()
    list.forEach((q, i) => (i ? this.L(q.x, q.y) : this.M(q.x, q.y)))
    return this.Z()
  }
  /** A closed shape with rounded corners (`r` of each vertex), turned to run the way a solid or a hole must. */
  round(vs: readonly V[], hole = false): this {
    let sum = 0
    vs.forEach((q, i) => {
      const n = vs[(i + 1) % vs.length]
      sum += q.x * n.y - n.x * q.y
    })
    const list = sum > 0 === !hole ? vs : [...vs].reverse()
    roundPoly(
      list.map((q) => ({ x: this.X(q.x), y: this.Y(q.y), r: (q.r ?? 0) * this.s * this.k })),
      true,
      this.path,
    )
    return this
  }
  disc(cx: number, cy: number, r: number, hole = false): this {
    return this.M(cx - r, cy)
      .A(r, cx + r, cy, !hole)
      .A(r, cx - r, cy, !hole)
      .Z()
  }
  /** A star with `n` points: the points on a circle of radius `ro`, the notches between them on one of radius `ri`, the first point `start` degrees clockwise from +x. */
  star(cx: number, cy: number, ro: number, ri: number, n: number, hole = false, start = -90): this {
    const pts: Pt[] = []
    for (let i = 0; i < 2 * n; i++) {
      const a = ((start + (180 * i) / n) * Math.PI) / 180,
        r = i % 2 ? ri : ro
      pts.push(P(cx + r * Math.cos(a), cy + r * Math.sin(a)))
    }
    return this.poly(pts, hole)
  }
}

/** A flame of the design frame, about 33 u high and 21 wide, with a small teardrop cut out of it. */
function flameShape(pen: Pen, cx: number, cy: number, s: number): void {
  pen
    .frame(cx, cy, s)
    .M(1.5, -17)
    .C(3, -10, 10.5, -5.5, 10.5, 3)
    .C(10.5, 10, 5.6, 15.5, 0, 15.5)
    .C(-5.6, 15.5, -10.5, 10.5, -10.5, 4)
    .C(-10.5, -1, -7.5, -4.5, -5.5, -8.5)
    .C(-5, -5.5, -3.8, -4, -2.4, -3.4)
    .C(-3, -9, -1.2, -13.5, 1.5, -17)
    .Z()
    // the inner flame, counter-clockwise
    .M(0.3, 2.2)
    .C(-1.5, 4.6, -3.6, 6.2, -3.6, 9)
    .C(-3.6, 11.4, -1.9, 12.8, 0.3, 12.8)
    .C(2.5, 12.8, 4.2, 11.4, 4.2, 9)
    .C(4.2, 6.2, 2, 4.6, 0.3, 2.2)
    .Z()
    .frame()
}

/** A teardrop, point up, `height` high and 0.7 of that wide, its tip at (x, top). */
function dropShape(pen: Pen, x: number, top: number, height: number): void {
  const r = 0.35 * height,
    d = height - r,
    a = Math.acos(r / d),
    tx = r * Math.sin(a),
    ty = top + d - r * Math.cos(a)
  pen
    .M(x, top)
    .L(x + tx, ty)
    .A(r, x - tx, ty, true, true)
    .Z()
}

type Picture = (pen: () => Pen) => Prim[]
const ink = (d: string): Prim => ({ d, role: 'ink' })
const stroke = (d: string): Prim => ({ d, role: 'outline' })

/** The parts of a line from a to b (as distances along it) that lie outside every one of the shapes: a circle {cx, cy, r} or a box {x0, y0, x1, y1}. */
function outside(
  a: Pt,
  b: Pt,
  shapes: readonly ({ cx: number; cy: number; r: number } | { x0: number; y0: number; x1: number; y1: number })[],
): [number, number][] {
  const len = Math.hypot(b.x - a.x, b.y - a.y),
    dx = (b.x - a.x) / len,
    dy = (b.y - a.y) / len
  const hidden: [number, number][] = []
  for (const s of shapes) {
    if ('r' in s) {
      // |a + t d - c|^2 = r^2
      const ex = a.x - s.cx,
        ey = a.y - s.cy,
        bq = ex * dx + ey * dy,
        disc = bq * bq - (ex * ex + ey * ey - s.r * s.r)
      if (disc > 0) hidden.push([-bq - Math.sqrt(disc), -bq + Math.sqrt(disc)])
    } else {
      let lo = -Infinity,
        hi = Infinity
      for (const [p, d, min, max] of [
        [a.x, dx, s.x0, s.x1],
        [a.y, dy, s.y0, s.y1],
      ]) {
        if (Math.abs(d) < 1e-9) {
          if (p < min || p > max) hi = -Infinity
        } else {
          const t0 = (min - p) / d,
            t1 = (max - p) / d
          lo = Math.max(lo, Math.min(t0, t1))
          hi = Math.min(hi, Math.max(t0, t1))
        }
      }
      if (hi > lo) hidden.push([lo, hi])
    }
  }
  hidden.sort((m, n) => m[0] - n[0])
  const out: [number, number][] = []
  let at = 0
  for (const [lo, hi] of hidden) {
    if (lo > at) out.push([at, Math.min(lo, len)])
    at = Math.max(at, hi)
  }
  if (at < len) out.push([at, len])
  return out.filter(([lo, hi]) => hi - lo > 0.5)
}

/** The nine pictures, drawn in the design frame: they stay inside |x| + |y| <= 28, which leaves clear paper round them inside the diamond. */
const PICTURES: Record<HazardId, Picture> = {
  explosive: (pen) => {
    // A round bomb with a cap and a fuse, and the fuse ends in a burst.
    const c = P(-6.5, 8.5),
      r = 9,
      burst = P(7.5, -9.5),
      len = Math.hypot(burst.x - c.x, burst.y - c.y),
      dir = P((burst.x - c.x) / len, (burst.y - c.y) / len)
    const at = (t: number, s: number) => P(c.x + dir.x * (r + t) - dir.y * s, c.y + dir.y * (r + t) + dir.x * s)
    const cap = [at(-1.5, -2.6), at(3.2, -2.6), at(3.2, 2.6), at(-1.5, 2.6)]
    const bomb = pen().disc(c.x, c.y, r).poly(cap).d()
    const spark = pen().star(burst.x, burst.y, 8, 3.4, 10, false, -72).d()
    // The fuse runs from the cap to the notch of the burst that faces it.
    const from = at(3.2, 0),
      to = P(burst.x - dir.x * 3.4, burst.y - dir.y * 3.4)
    const fuse = pen()
      .M(from.x, from.y)
      .C(from.x + dir.x * 2.2 + dir.y * 1.6, from.y + dir.y * 2.2 - dir.x * 1.6, to.x - dir.x * 1.8 + dir.y * 1.6, to.y - dir.y * 1.8 - dir.x * 1.6, to.x, to.y)
      .d()
    return [ink(bomb + spark), stroke(fuse)]
  },
  flammable: (pen) => {
    const p = pen()
    flameShape(p, 0, -1, 1.25)
    return [ink(p.d())]
  },
  oxidising: (pen) => {
    // A flame above a ring: the foot of the flame is in the top of the ring.
    const p = pen()
    flameShape(p, 0, -10.5, 0.7)
    const ring = pen().disc(0, 11, 12).disc(0, 11, 8.4, true).d()
    return [ink(p.d() + ring)]
  },
  gasUnderPressure: (pen) => {
    // A gas cylinder, tall and slim: the body with its rounded shoulders, the neck and the valve, and a light stripe down the body.
    const body = pen()
      .round([v(-6.5, -15, 6.5), v(6.5, -15, 6.5), v(6.5, 20, 2.2), v(-6.5, 20, 2.2)])
      .d()
    const neck = pen()
      .poly([P(-2.4, -19.5), P(2.4, -19.5), P(2.4, -14), P(-2.4, -14)])
      .d()
    const valve = pen()
      .round([v(-4.8, -22.5, 1.2), v(4.8, -22.5, 1.2), v(4.8, -18, 1.2), v(-4.8, -18, 1.2)])
      .d()
    const stripe = pen()
      .poly([P(-4.4, -6), P(-3, -6), P(-3, 16), P(-4.4, 16)], true)
      .d()
    return [ink(body + neck + valve + stripe)]
  },
  corrosive: (pen) => {
    // Two test tubes that lean together, their mouths down: a drop falls from each, one on a hand and one on a metal bar.
    const tube = (sign: number) => {
      const m = P(sign * 12.4, -7.8),
        e = P(sign * 6.4, -16),
        len = Math.hypot(e.x - m.x, e.y - m.y),
        ax = (e.x - m.x) / len,
        ay = (e.y - m.y) / len,
        w = 3
      const at = (t: number, s: number) => P(m.x + ax * t - ay * s, m.y + ay * t + ax * s)
      return pen()
        .round([
          { ...at(0, -w), r: 0.6 },
          { ...at(0, w), r: 0.6 },
          { ...at(len, w), r: 2.9 },
          { ...at(len, -w), r: 2.9 },
        ])
        .d()
    }
    const drops = pen()
    dropShape(drops, -12.4, -5.4, 5.6)
    dropShape(drops, 12.4, -5.4, 5.6)
    // The bar: a slab whose top edge is eaten away where the drop falls.
    const bar = pen()
      .M(3.5, 6.5)
      .L(9.4, 6.5)
      .L(10.8, 8.8)
      .L(12.2, 7.2)
      .L(13.6, 9.4)
      .L(15, 7.4)
      .L(15.8, 6.5)
      .L(17.2, 6.5)
      .L(17.2, 8)
      .A(4, 13.2, 12)
      .L(3.5, 12)
      .Z()
      .d()
    // The hand, fingers up: a palm that narrows to the wrist, four fingers (the middle one longest) and a thumb.
    const hand = pen()
    const xc = -10.2
    hand.round([v(xc - 7, 7.5, 1.2), v(xc + 7, 7.5, 1.2), v(xc + 4.4, 12.5, 1.5), v(xc - 4.4, 12.5, 1.5)])
    ;[2.4, 0.6, 2, 4.2].forEach((top, i) => {
      const x = xc - 7.1 + i * 3.8
      hand.round([v(x, top, 1.4), v(x + 2.9, top, 1.4), v(x + 2.9, 9, 0), v(x, 9, 0)])
    })
    hand.round([v(xc - 5.4, 10, 1.3), v(xc - 7.6, 11, 1.3), v(xc - 10.2, 6.6, 1.3), v(xc - 8, 5.2, 1.3)])
    return [stroke(tube(-1) + tube(1)), ink(drops.d() + bar + hand.d())]
  },
  toxic: (pen) => {
    // The skull, then the crossbones behind it: each bone stops where it meets the skull, with a gap.
    const oy = -1.5 // the skull is drawn this far above the middle of the diamond
    const skull = pen()
      .frame(0, oy)
      .round([v(-9.2, -14, 9), v(9.2, -14, 9), v(9.2, -3, 4), v(5.2, 2, 1.2), v(5.2, 9, 1.5), v(-5.2, 9, 1.5), v(-5.2, 2, 1.2), v(-9.2, -3, 4)])
      .disc(-3.9, -4.2, 3, true)
      .disc(3.9, -4.2, 3, true)
      .poly([P(0, -0.2), P(-1.8, 3.2), P(1.8, 3.2)], true)
      .poly([P(-2.3, 5.4), P(-1.2, 5.4), P(-1.2, 8), P(-2.3, 8)], true)
      .poly([P(1.2, 5.4), P(2.3, 5.4), P(2.3, 8), P(1.2, 8)], true)
      .d()
    // Where the skull is (the round cranium and the narrower jaw), and 1.5 u beyond it: the bones do not come in here.
    const gap = 1.5,
      halo = [
        { cx: 0, cy: oy - 5, r: 9.2 + gap },
        { x0: -5.2 - gap, y0: oy + 1 - gap, x1: 5.2 + gap, y1: oy + 9 + gap },
      ]
    const bones = pen()
    for (const [a, b] of [
      [P(-15.5, -10), P(13, 12)],
      [P(15.5, -10), P(-13, 12)],
    ]) {
      const len = Math.hypot(b.x - a.x, b.y - a.y),
        dx = (b.x - a.x) / len,
        dy = (b.y - a.y) / len,
        w = 1.7
      const p = (t: number, s: number) => P(a.x + dx * t - dy * s, a.y + dy * t + dx * s)
      for (const [t0, t1] of outside(a, b, halo)) bones.poly([p(t0, -w), p(t1, -w), p(t1, w), p(t0, w)])
      // Two knobs at each end of the bone.
      for (const t of [0, len]) for (const s of [-2, 2]) bones.disc(p(t, s).x, p(t, s).y, 2.1)
    }
    return [ink(bones.d() + skull)]
  },
  harmful: (pen) => {
    // An exclamation mark: a bar that is wider at the top, and a dot.
    const bar = pen().frame(0, -1, 1.25).M(-4.6, -14).A(4.6, 4.6, -14).L(2.6, 4).A(2.6, -2.6, 4).Z().d()
    const dot = pen().frame(0, -1, 1.25).disc(0, 13, 3.8).d()
    return [ink(bar + dot)]
  },
  health: (pen) => {
    // A figure, head and shoulders, with a star on the chest.
    const head = pen().disc(0, -14.5, 5.8).d()
    const body = pen()
      .round([v(-12.5, -6.5, 7.5), v(12.5, -6.5, 7.5), v(10, 17, 2), v(-10, 17, 2)])
      .star(0, 5.5, 7.5, 3.2, 8, true)
      .d()
    return [ink(head + body)]
  },
  environment: (pen) => {
    // A dead tree and a fish.
    const tree = pen()
    const branch = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number) => {
      const len = Math.hypot(x1 - x0, y1 - y0),
        nx = -(y1 - y0) / len,
        ny = (x1 - x0) / len
      tree.poly([
        P(x0 + (nx * w0) / 2, y0 + (ny * w0) / 2),
        P(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2),
        P(x1 - (nx * w1) / 2, y1 - (ny * w1) / 2),
        P(x0 - (nx * w0) / 2, y0 - (ny * w0) / 2),
      ])
    }
    branch(-10, 16, -9.8, -4, 4, 2.6)
    branch(-9.9, 5, -17, -2, 2.4, 1.5)
    branch(-13.4, 1.4, -16.8, 4.2, 1.5, 1.1)
    branch(-9.9, 1, -3, -6.5, 2.4, 1.5)
    branch(-9.8, -4, -14.5, -12, 2.2, 1.3)
    branch(-9.8, -4, -5, -13, 2.2, 1.3)
    branch(-9.8, -4, -9, -17, 2.4, 1.3)
    const fish = pen()
      .M(2, 3)
      .C(5.5, -3, 13.5, -3, 16.5, 3)
      .C(13.5, 9, 5.5, 9, 2, 3)
      .Z()
      .poly([P(15.5, 3), P(20, -1.5), P(20, 7.5)])
      .poly([P(6.2, -1.8), P(9.6, -5.6), P(12.8, -1.2)])
      .disc(5.6, 1.6, 1.3, true)
      .d()
    return [ink(tree.d() + fish)]
  },
}

const hazardSymbol: SymbolDef = {
  id: 'hazardSymbol',
  name: 'Hazard symbol',
  aliases: ['hazard', 'warning symbol', 'GHS pictogram', 'hazard pictogram'],
  label: 'hazard symbol',
  pack: 'annotation',
  size: { w: 70, h: 70 },
  resize: 'uniform',
  min: { w: 56, h: 56 },
  params: [
    {
      key: 'hazard',
      label: 'Hazard',
      type: 'choice',
      default: 'flammable',
      options: HAZARDS.map((q) => ({ value: q.id, label: q.name.charAt(0).toUpperCase() + q.name.slice(1) })),
    },
    { key: 'name', label: 'Name', type: 'boolean', default: false },
  ],
  build({ h, p }) {
    const m = hazardModel(p),
      k = h / 70
    // A square set on its corner, filling the box less half the line: the same for every hazard.
    const diamond = new Path()
      .M(0, 1)
      .L(h / 2 - 1, h / 2)
      .L(0, h - 1)
      .L(1 - h / 2, h / 2)
      .Z()
      .d()
    const prims: Prim[] = [{ d: diamond, role: 'outline' }, ...PICTURES[m.hazard.id](() => new Pen(k, h / 2))]
    const texts: SymbolText[] = m.showName ? [{ x: 0, y: h + 13, text: m.hazard.name, size: 12, anchor: 'middle' }] : []
    return { prims, texts }
  },
}

export const annotation: SymbolDef[] = [eye, flame, drops, indicatorPaper, flameTestLoop, magnesiumRibbon, phScale, formulaTriangle, hazardSymbol]
