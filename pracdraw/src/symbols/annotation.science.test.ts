// annotation.science.test.ts — the science of the pH scale, the formula triangle and the hazard symbol.
// Each symbol has a data model that annotation.ts exports. These tests check the model against the science (the order of the colours, the product
// in a formula triangle, the nine hazards) and check that the drawing agrees with the model (they count and place the marks of the geometry, and
// look at what the renderer makes of them).

import { describe, expect, it } from 'vitest'
import { bounds, pathBounds, pathPolys, type Pt } from '../kernel/geom'
import { svgDocument, type Node as RenderNode, type PathNode, type TextNode } from '../kernel/nodes'
import { DocBuilder } from '../model/build'
import { INK, docNodes } from '../render/render'
import {
  HAZARDS,
  PH_BANDS,
  PH_BRACKETS,
  PH_CELLS,
  PH_COLOURS,
  PH_EXAMPLES,
  PH_HIGH,
  PH_LOW,
  PH_NEUTRAL,
  PH_TINT,
  TRIANGLE_PARTS,
  TRIANGLE_PRESETS,
  coverRule,
  coverValue,
  hazardModel,
  phKind,
  phScaleModel,
  textWidth,
  triangleFactor,
  triangleLayout,
  triangleModel,
  triangleTexts,
  unitsOfProduct,
  type TrianglePart,
  type TrianglePreset,
  type TrianglePresetId,
} from './annotation'
import { geometry, symbolDef } from './registry'
import type { Geometry, ParamValue, SymbolText } from './types'

const range = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i)
/** Consecutive repeats become one: red red red orange orange → red orange. */
const collapse = <T>(xs: readonly T[]): T[] => xs.filter((x, i) => i === 0 || x !== xs[i - 1])
/** The leaves of a render tree, back to front. */
type Leaf = PathNode | TextNode
const leaves = (nodes: readonly RenderNode[]): Leaf[] => nodes.flatMap((n) => (n.t === 'g' ? leaves(n.kids) : [n]))
/** What the renderer makes of one symbol at its default size, in colour or photocopy-safe. */
function rendered(symbol: string, params: Record<string, ParamValue>, mono: boolean): { leaves: Leaf[]; svg: string } {
  const b = new DocBuilder()
  b.doc.settings.mono = mono
  b.symbol(symbol, { params })
  const nodes = docNodes(b.doc)
  return { leaves: leaves(nodes), svg: svgDocument(nodes, 10, 10) }
}
const textOf = (n: TextNode): string => n.runs.map((r) => r.text).join('')
/** The number of separate shapes (subpaths) in some path data. */
const shapes = (d: string): number => pathPolys(d).length
/** Where the middle of a piece of text lies, and the box that it fills: its width from the Arial table, a capital's height above the baseline. */
const textBox = (t: SymbolText) => {
  const w = textWidth(t.text, t.size),
    x0 = t.anchor === 'middle' ? t.x - w / 2 : t.anchor === 'start' ? t.x : t.x - w
  return { x0, x1: x0 + w, y0: t.y - 0.716 * t.size, y1: t.y }
}

// ================================================================ the pH scale

const phGeometry = (params: Record<string, ParamValue> = {}, w = 420, h = 70): Geometry => geometry('phScale', w, h, params)
/** The cells as drawn: the shapes that have a test colour, in the order that they are drawn. */
const cellsOf = (g: Geometry) => g.prims.filter((p) => p.role === 'solid' && p.tint).map((p) => ({ box: pathBounds(p.d), tint: p.tint! }))
/** The numbers as drawn: the texts that are only digits. */
const numbersOf = (g: Geometry): SymbolText[] => (g.texts ?? []).filter((t) => /^\d+$/.test(t.text))

/** The hue of a colour in degrees, from its hex code. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b),
    d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}
/** Where the hue of each test colour lies on the colour wheel (red, orange, yellow, green, blue, purple). */
const HUES: Record<string, [number, number]> = { red: [-15, 15], orange: [20, 45], yellow: [46, 70], green: [90, 150], blue: [190, 230], purple: [250, 290] }
const hueIs = (colour: string, deg: number): boolean => {
  const [lo, hi] = HUES[colour]
  return (deg >= lo && deg <= hi) || (deg - 360 >= lo && deg - 360 <= hi)
}

describe('pH scale: the cells', () => {
  it('has 15 cells numbered 0 to 14, in order', () => {
    expect(PH_CELLS.map((c) => c.ph)).toEqual(range(0, 14))
    expect([PH_LOW, PH_HIGH]).toEqual([0, 14])
    expect(phScaleModel({}).cells.map((c) => c.ph)).toEqual(range(0, 14))
    for (const [orientation, w, h] of [
      ['horizontal', 420, 70],
      ['horizontal', 360, 62],
      ['vertical', 420, 420],
      ['vertical', 360, 300],
    ] as const) {
      const vertical = orientation === 'vertical',
        g = phGeometry({ orientation }, w, h),
        cells = cellsOf(g),
        pitch = (vertical ? h : w) / 15,
        start = vertical ? 0 : -w / 2
      expect(cells, `${orientation} ${w}x${h}`).toHaveLength(15)
      // Side by side along the strip, each one pitch long, the first at the start of the box and the last at its end.
      cells.forEach((c, i) => {
        expect(vertical ? c.box.y0 : c.box.x0, `cell ${i}`).toBeCloseTo(start + i * pitch, 6)
        expect(vertical ? c.box.y1 : c.box.x1, `cell ${i}`).toBeCloseTo(start + (i + 1) * pitch, 6)
      })
      // The numbers are 0 to 14 in the order of the strip, and number i is inside cell i, clear of its outline.
      const numbers = numbersOf(g)
      expect(
        numbers.map((t) => Number(t.text)),
        `${orientation} ${w}x${h}`,
      ).toEqual(range(0, 14))
      numbers.forEach((t, i) => {
        const b = textBox(t),
          c = cells[i].box
        expect(b.x0, `number ${i}`).toBeGreaterThan(c.x0 + 1)
        expect(b.x1, `number ${i}`).toBeLessThan(c.x1 - 1)
        expect(b.y0, `number ${i}`).toBeGreaterThan(c.y0 + 1)
        expect(b.y1, `number ${i}`).toBeLessThan(c.y1 - 1)
      })
    }
  })

  it('runs red, orange, yellow, green, blue, purple, with green at 7 and nowhere else', () => {
    expect(collapse(PH_CELLS.map((c) => c.colour))).toEqual(['red', 'orange', 'yellow', 'green', 'blue', 'purple'])
    expect([...PH_COLOURS]).toEqual(['red', 'orange', 'yellow', 'green', 'blue', 'purple'])
    expect(PH_CELLS.filter((c) => c.colour === 'green').map((c) => c.ph)).toEqual([PH_NEUTRAL])
    expect([PH_CELLS[0].colour, PH_CELLS[14].colour]).toEqual(['red', 'purple'])
  })

  it('has one table of band edges: the bands follow each other and hold every pH once, and strong acid is pH 0 to 2', () => {
    expect(PH_BANDS.map((b) => b.colour)).toEqual(['red', 'orange', 'yellow', 'green', 'blue', 'purple'])
    expect(PH_BANDS[0]).toEqual({ colour: 'red', from: 0, to: 2 })
    expect(PH_BANDS.flatMap((b) => range(b.from, b.to))).toEqual(range(0, 14))
    for (const b of PH_BANDS) for (const ph of range(b.from, b.to)) expect(PH_CELLS[ph].colour).toBe(b.colour)
  })

  it('draws each cell in the colour that the model gives it, and the colours are the colours they are called', () => {
    const cells = cellsOf(phGeometry())
    expect(cells.map((c) => c.tint)).toEqual(PH_CELLS.map((c) => c.tint))
    // The tint of a cell is the tint of its colour name, and six names have six different tints.
    for (const c of PH_CELLS) expect(c.tint).toBe(PH_TINT[c.colour])
    expect(new Set(Object.values(PH_TINT)).size).toBe(6)
    // What is drawn really is red, orange, yellow, green, blue and purple: the hue of each cell is in the range of its colour, and rises along the strip.
    for (const c of PH_CELLS) expect(hueIs(c.colour, hue(c.tint)), `pH ${c.ph} is ${c.colour}: hue ${hue(c.tint).toFixed(0)}`).toBe(true)
    const hues = collapse(cells.map((c) => c.tint)).map((t) => (hue(t) + 15) % 360) // red sits across 0, so turn the wheel by 15 degrees
    expect([...hues].sort((a, b) => a - b)).toEqual(hues)
  })
})

describe('pH scale: acidic, neutral and alkaline', () => {
  it('is acidic below 7, alkaline above 7 and neutral at 7', () => {
    expect(PH_NEUTRAL).toBe(7)
    for (const ph of range(0, 14)) {
      const want = ph < 7 ? 'acid' : ph > 7 ? 'alkali' : 'neutral'
      expect(phKind(ph), `pH ${ph}`).toBe(want)
      expect(PH_CELLS[ph].kind, `pH ${ph}`).toBe(want)
    }
  })

  it('has three brackets that cover every cell once: acidic 0 to 6, neutral 7, alkaline 8 to 14', () => {
    expect(PH_BRACKETS.map((b) => [b.word, b.from, b.to])).toEqual([
      ['acidic', 0, 6],
      ['neutral', 7, 7],
      ['alkaline', 8, 14],
    ])
    expect(PH_BRACKETS.flatMap((b) => range(b.from, b.to))).toEqual(range(0, 14))
    for (const b of PH_BRACKETS) for (const ph of range(b.from, b.to)) expect(PH_CELLS[ph].kind, `${b.word}: pH ${ph}`).toBe(b.kind)
  })

  it('draws each bracket and its word over its own cells', () => {
    for (const [orientation, w, h] of [
      ['horizontal', 420, 70],
      ['vertical', 420, 420],
    ] as const) {
      const vertical = orientation === 'vertical',
        g = phGeometry({ orientation }, w, h),
        cells = cellsOf(g),
        along = (b: { x0: number; x1: number; y0: number; y1: number }) => (vertical ? [b.y0, b.y1] : [b.x0, b.x1])
      const lines = g.prims.find((p) => p.role === 'detail')!
      const drawn = pathPolys(lines.d).map((poly) => along(bounds(poly)))
      expect(drawn, orientation).toHaveLength(3)
      PH_BRACKETS.forEach((b, i) => {
        const lo = along(cells[b.from].box)[0],
          hi = along(cells[b.to].box)[1]
        // The bracket lies inside its cells, and does not reach the next bracket.
        expect(drawn[i][0], `${orientation} ${b.word}`).toBeGreaterThanOrEqual(lo)
        expect(drawn[i][1], `${orientation} ${b.word}`).toBeLessThanOrEqual(hi)
        expect(drawn[i][1] - drawn[i][0], `${orientation} ${b.word}`).toBeGreaterThan((hi - lo) * 0.8)
        // The word is over the middle of it.
        const word = g.texts!.filter((t) => t.text === b.word)
        expect(word, `${orientation} ${b.word}`).toHaveLength(1)
        const at = vertical ? word[0].y - 0.358 * word[0].size : word[0].x
        expect(at, `${orientation} ${b.word}`).toBeGreaterThan(lo)
        expect(at, `${orientation} ${b.word}`).toBeLessThan(hi)
      })
    }
  })

  it('writes the four example substances at their pH: lemon juice 2, water 7, soap 10, bleach 13', () => {
    expect(PH_EXAMPLES.map((e) => [e.name, e.ph])).toEqual([
      ['lemon juice', 2],
      ['water', 7],
      ['soap', 10],
      ['bleach', 13],
    ])
    // Lemon juice is acidic, water neutral, soap and bleach alkaline.
    expect(PH_EXAMPLES.map((e) => phKind(e.ph))).toEqual(['acid', 'neutral', 'alkali', 'alkali'])
    for (const [orientation, w, h] of [
      ['horizontal', 420, 70],
      ['vertical', 420, 420],
    ] as const) {
      const vertical = orientation === 'vertical',
        g = phGeometry({ orientation, examples: true }, w, h),
        cells = cellsOf(g)
      for (const e of PH_EXAMPLES) {
        const t = g.texts!.filter((q) => q.text === e.name)
        expect(t, `${orientation} ${e.name}`).toHaveLength(1)
        const c = cells[e.ph].box,
          b = textBox(t[0])
        if (vertical) {
          // beside its cell, on the far side from the brackets: right of the strip, level with the cell
          expect(b.x0, e.name).toBeGreaterThan(c.x1)
          expect((b.y0 + b.y1) / 2, e.name).toBeGreaterThan(c.y0)
          expect((b.y0 + b.y1) / 2, e.name).toBeLessThan(c.y1)
        } else {
          // under its cell, in the middle of it
          expect(b.y0, e.name).toBeGreaterThan(c.y1)
          expect((b.x0 + b.x1) / 2, e.name).toBeGreaterThan(c.x0)
          expect((b.x0 + b.x1) / 2, e.name).toBeLessThan(c.x1)
        }
      }
    }
  })
})

describe('pH scale: the photocopy', () => {
  it('has every cell carry its number and keep its outline in photocopy-safe mode, with no colour left', () => {
    for (const params of [{}, { examples: true }, { orientation: 'vertical' }] as Record<string, ParamValue>[]) {
      const mono = rendered('phScale', params, true),
        colour = rendered('phScale', params, false)
      // Each cell is a white shape with its 2 u outline; the numbers 0 to 14 are all drawn, once each.
      const cells = mono.leaves.filter((n): n is PathNode => n.t === 'path').slice(0, 15)
      for (const n of cells) {
        expect(n.fill, JSON.stringify(params)).toBe('#ffffff')
        expect(n.stroke, JSON.stringify(params)).toBe(INK)
        expect(n.sw, JSON.stringify(params)).toBe(2)
      }
      const numbers = mono.leaves
        .filter((n): n is TextNode => n.t === 'text')
        .map(textOf)
        .filter((s) => /^\d+$/.test(s))
      expect(numbers, JSON.stringify(params)).toEqual(range(0, 14).map(String))
      for (const tint of Object.values(PH_TINT)) expect(mono.svg).not.toContain(tint)
      // In colour the same cells have their test colours.
      const coloured = colour.leaves.filter((n): n is PathNode => n.t === 'path').slice(0, 15)
      expect(coloured.map((n) => n.fill)).toEqual(PH_CELLS.map((c) => c.tint))
    }
  })

  it('draws the numbers only when they are on', () => {
    expect(numbersOf(phGeometry({ numbers: false }))).toHaveLength(0)
    expect(rendered('phScale', { numbers: false }, true).leaves.filter((n) => n.t === 'text' && /^\d+$/.test(textOf(n)))).toHaveLength(0)
  })
})

describe('pH scale: the drawing agrees with the model', () => {
  it('has as many cells, numbers, brackets, words and examples as the model says, for every set of parameters', () => {
    let tried = 0
    for (const orientation of ['horizontal', 'vertical'])
      for (const numbers of [true, false])
        for (const brackets of [true, false])
          for (const examples of [true, false]) {
            const p = { orientation, numbers, brackets, examples },
              m = phScaleModel(p),
              g = phGeometry(p, 420, orientation === 'vertical' ? 420 : 70),
              label = JSON.stringify(p)
            tried++
            expect(m.cells, label).toHaveLength(15)
            expect(cellsOf(g), label).toHaveLength(m.cells.length)
            expect(numbersOf(g), label).toHaveLength(m.numbers ? 15 : 0)
            expect(m.brackets, label).toHaveLength(brackets ? 3 : 0)
            expect(m.examples, label).toHaveLength(examples ? 4 : 0)
            const words = new Set([...m.brackets.map((b) => b.word), ...m.examples.map((e) => e.name)])
            expect(
              g
                .texts!.filter((t) => !/^\d+$/.test(t.text))
                .map((t) => t.text)
                .sort(),
              label,
            ).toEqual([...words].sort())
            // One line for all the brackets and one for all the ticks: nothing is drawn that the model does not have.
            const lines = g.prims.filter((p2) => p2.role === 'detail')
            expect(
              lines.reduce((n, l) => n + shapes(l.d), 0),
              label,
            ).toBe(m.brackets.length + m.examples.length)
            expect(m.orientation).toBe(orientation)
          }
    expect(tried).toBe(16)
  })
})

// ================================================================ the formula triangle

const triangleGeometry = (params: Record<string, ParamValue> = {}, h = 110): Geometry => geometry('formulaTriangle', (h * 120) / 110, h, params)
const PRESET_IDS: TrianglePresetId[] = ['moles', 'concentration', 'gasVolume', 'yield']
const presetOf = (id: TrianglePresetId): TrianglePreset => TRIANGLE_PRESETS[id]
/** What each preset shows, as the specification gives it. */
const SHOWN: Record<TrianglePresetId, Record<TrianglePart, string>> = {
  moles: { top: 'm', left: 'n', right: 'M_r' },
  concentration: { top: 'n', left: 'c', right: 'V' },
  gasVolume: { top: 'V', left: 'n', right: '24' },
  yield: { top: 'actual', left: '%', right: 'max' },
}
const NAMES: Record<TrianglePresetId, Record<TrianglePart, string>> = {
  moles: { top: 'mass', left: 'amount of substance', right: 'relative formula mass' },
  concentration: { top: 'amount of substance', left: 'concentration', right: 'volume' },
  gasVolume: { top: 'volume of gas', left: 'amount of substance', right: 'molar volume of a gas' },
  yield: { top: 'actual yield', left: 'percentage yield', right: 'theoretical yield' },
}
const without0 = (u: Record<string, number>) => Object.fromEntries(Object.entries(u).filter(([, e]) => e !== 0))

describe('formula triangle: the quantities', () => {
  it('has the presets moles, concentration, gas volume and yield', () => {
    expect(Object.keys(TRIANGLE_PRESETS)).toEqual(PRESET_IDS)
    for (const id of PRESET_IDS) {
      expect(
        TRIANGLE_PARTS.map((part) => presetOf(id)[part].text),
        id,
      ).toEqual(TRIANGLE_PARTS.map((part) => SHOWN[id][part]))
      expect(
        TRIANGLE_PARTS.map((part) => presetOf(id)[part].name),
        id,
      ).toEqual(TRIANGLE_PARTS.map((part) => NAMES[id][part]))
    }
  })

  it('has the top quantity as the product of the two at the bottom, for every preset', () => {
    for (const id of PRESET_IDS) {
      const p = presetOf(id)
      // The units multiply: grams = moles × grams per mole, moles = (moles per dm3) × dm3, dm3 = moles × (dm3 per mole), grams = per cent × grams.
      expect(unitsOfProduct(p.left.units, p.right.units), id).toEqual(without0(p.top.units))
      // The worked example multiplies out: 36 g = 2 mol × 18 g/mol, 0.1 mol = 0.5 mol/dm3 × 0.2 dm3, 48 dm3 = 2 mol × 24 dm3/mol, 20 g = 80 % × 25 g.
      expect((p.example.left * p.example.right) / triangleFactor(p), id).toBeCloseTo(p.example.top, 9)
    }
    // A percentage is a number out of 100, so only the yield triangle carries the 100.
    expect(PRESET_IDS.map((id) => triangleFactor(presetOf(id)))).toEqual([1, 1, 1, 100])
    expect(presetOf('yield').left.percent).toBe(true)
    for (const id of PRESET_IDS)
      for (const part of TRIANGLE_PARTS) if (!(id === 'yield' && part === 'left')) expect(presetOf(id)[part].percent, `${id} ${part}`).toBe(false)
  })

  it('has three different quantities in each triangle, drawn as three different texts', () => {
    for (const id of PRESET_IDS) {
      const p = presetOf(id)
      expect(new Set(TRIANGLE_PARTS.map((part) => p[part].name)).size, id).toBe(3)
      expect(new Set(TRIANGLE_PARTS.map((part) => p[part].text)).size, id).toBe(3)
    }
  })

  it('shows, on covering a part, a product for the top and the top divided by the other bottom part for a bottom part', () => {
    expect(coverRule('top')).toEqual({ shows: 'top', op: 'product', of: ['left', 'right'] })
    expect(coverRule('left')).toEqual({ shows: 'left', op: 'quotient', of: ['top', 'right'] })
    expect(coverRule('right')).toEqual({ shows: 'right', op: 'quotient', of: ['top', 'left'] })
    // And the numbers agree: covering any part of the worked example gives that part back.
    for (const id of PRESET_IDS) {
      const p = presetOf(id)
      for (const part of TRIANGLE_PARTS) expect(coverValue(p, part), `${id}: cover ${part}`).toBeCloseTo(p.example[part], 9)
    }
    // Another set of numbers: 3 mol of a substance of Mr 44 is 132 g, and 66 g is 1.5 mol of it.
    const moles = presetOf('moles')
    expect(coverValue(moles, 'top', { top: 0, left: 3, right: 44 })).toBe(132)
    expect(coverValue(moles, 'left', { top: 66, left: 0, right: 44 })).toBe(1.5)
    expect(coverValue(moles, 'right', { top: 66, left: 1.5, right: 0 })).toBe(44)
    // For a yield of 80 % of 25 g: 20 g; and 20 g out of 25 g is 80 %.
    const yld = presetOf('yield')
    expect(coverValue(yld, 'top', { top: 0, left: 80, right: 25 })).toBe(20)
    expect(coverValue(yld, 'left', { top: 20, left: 0, right: 25 })).toBe(80)
  })
})

describe('formula triangle: the drawing', () => {
  it('splits the triangle by a horizontal line and a vertical line into three parts', () => {
    for (const h of [99, 110, 165]) {
      const g = triangleGeometry({}, h),
        L = triangleLayout(h),
        polys = pathPolys(g.prims[0].d)
      expect(g.prims, `h ${h}`).toHaveLength(1)
      expect(g.prims[0].role).toBe('outline')
      expect(polys, `h ${h}`).toHaveLength(3) // the outline, the horizontal line, the vertical line
      const [, across, down] = polys
      // The horizontal line runs from side to side, level, across the middle of the triangle.
      expect(across[0].y, `h ${h}`).toBeCloseTo(across[1].y, 1)
      expect(across[0].x, `h ${h}`).toBeCloseTo(-across[1].x, 1)
      expect(across[1].x, `h ${h}`).toBeCloseTo(L.halfAt(across[0].y), 1)
      expect(across[0].y, `h ${h}`).toBeGreaterThan(L.apexY + 0.3 * (L.baseY - L.apexY))
      expect(across[0].y, `h ${h}`).toBeLessThan(L.apexY + 0.7 * (L.baseY - L.apexY))
      // The vertical line goes from the middle of the horizontal one down to the base, on the centre line.
      expect(down[0].x, `h ${h}`).toBeCloseTo(0, 1)
      expect(down[1].x, `h ${h}`).toBeCloseTo(0, 1)
      expect(down[0].y, `h ${h}`).toBeCloseTo(across[0].y, 1)
      expect(down[1].y, `h ${h}`).toBeCloseTo(L.baseY, 1)
      // The three parts are the top (a triangle) and two halves of the rest, and they are the whole triangle between them.
      const area = (poly: Pt[]) => Math.abs(poly.reduce((s, q, i) => s + (q.x * poly[(i + 1) % poly.length].y - poly[(i + 1) % poly.length].x * q.y), 0)) / 2
      const whole = area([
        { x: 0, y: L.apexY },
        { x: L.half, y: L.baseY },
        { x: -L.half, y: L.baseY },
      ])
      expect(
        TRIANGLE_PARTS.reduce((s, part) => s + area(L.parts[part]), 0),
        `h ${h}`,
      ).toBeCloseTo(whole, 6)
      expect(area(L.parts.left), `h ${h}`).toBeCloseTo(area(L.parts.right), 6)
    }
  })

  it('shows the quantities of each preset: the top one above the horizontal line, the other two on either side of the vertical one', () => {
    for (const id of PRESET_IDS) {
      const g = triangleGeometry({ preset: id }),
        L = triangleLayout(110),
        t = Object.fromEntries((g.texts ?? []).map((q) => [q.text, q]))
      expect(Object.keys(t).sort(), id).toEqual([...TRIANGLE_PARTS.map((part) => SHOWN[id][part])].sort())
      const top = t[SHOWN[id].top],
        left = t[SHOWN[id].left],
        right = t[SHOWN[id].right]
      expect(top.y, id).toBeLessThan(L.y)
      expect(top.x, id).toBeCloseTo(0, 6)
      expect(left.y, id).toBeGreaterThan(L.y)
      expect(right.y, id).toBeGreaterThan(L.y)
      expect(left.x, id).toBeLessThan(0)
      expect(right.x, id).toBeGreaterThan(0)
      // One size for all three, from 12 to 18 u, and 16 u when it is all as big as it can be at the default size.
      expect(new Set((g.texts ?? []).map((q) => q.size)).size, id).toBe(1)
      expect(top.size, id).toBeGreaterThanOrEqual(12)
      expect(top.size, id).toBeLessThanOrEqual(16)
    }
    for (const id of ['moles', 'concentration', 'gasVolume'] as const) expect(triangleGeometry({ preset: id }).texts![0].size, id).toBe(16)
  })

  it('keeps every text inside its own part, clear of the lines, at the smallest size, the default size and a larger one', () => {
    for (const id of PRESET_IDS) {
      for (const h of [99, 110, 165]) {
        const m = triangleModel({ preset: id }),
          L = triangleLayout(h),
          g = triangleGeometry({ preset: id }, h)
        expect(triangleTexts(m.texts, L).fits, `${id} ${h}`).toBe(true)
        for (const part of TRIANGLE_PARTS) {
          const t = g.texts!.find((q) => q.text === m.texts[part])!,
            b = textBox(t),
            poly = L.parts[part]
          // The four corners of the text are inside the part, by 3 u: a point is inside a convex part when it is on the same side of every edge.
          for (const [x, y] of [
            [b.x0, b.y0],
            [b.x1, b.y0],
            [b.x0, b.y1],
            [b.x1, b.y1],
          ]) {
            for (let i = 0; i < poly.length; i++) {
              const p = poly[i],
                q = poly[(i + 1) % poly.length],
                len = Math.hypot(q.x - p.x, q.y - p.y),
                side = ((q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x)) / len
              // Which side is the inside: where the middle of the part lies.
              const mid = poly.reduce((s, r) => ({ x: s.x + r.x / poly.length, y: s.y + r.y / poly.length }), { x: 0, y: 0 }),
                inside = ((q.x - p.x) * (mid.y - p.y) - (q.y - p.y) * (mid.x - p.x)) / len
              expect(side * Math.sign(inside), `${id} ${h} ${part} edge ${i}`).toBeGreaterThan(3)
            }
          }
        }
      }
    }
  })

  it('uses the texts of the parameters for a custom triangle, and the preset ignores them', () => {
    const custom = triangleGeometry({ preset: 'custom', top: 'F', left: 'm', right: 'a' })
    expect(custom.texts!.map((t) => t.text)).toEqual(['F', 'm', 'a'])
    expect(triangleModel({ preset: 'custom', top: 'V', left: 'I', right: 'R' }).texts).toEqual({ top: 'V', left: 'I', right: 'R' })
    // The preset sets the three texts itself.
    expect(triangleModel({ preset: 'concentration', top: 'F', left: 'm', right: 'a' }).texts).toEqual(SHOWN.concentration)
    // The default is the moles triangle.
    expect(triangleModel({}).texts).toEqual(SHOWN.moles)
    expect(triangleModel({}).preset).toBe('moles')
  })
})

describe('formula triangle: hiding a part', () => {
  it('hides exactly the text of that part, and leaves the others where they were and as big as they were', () => {
    for (const id of [...PRESET_IDS, 'custom'] as const) {
      const base: Record<string, ParamValue> = id === 'custom' ? { preset: 'custom', top: 'F', left: 'm', right: 'a' } : { preset: id },
        full = triangleGeometry(base).texts!
      expect(full, id).toHaveLength(3)
      for (const part of TRIANGLE_PARTS) {
        const m = triangleModel({ ...base, hide: part }),
          hidden = full.find((t) => t.text === m.texts[part])!,
          g = triangleGeometry({ ...base, hide: part })
        expect(m.hidden, `${id} hide ${part}`).toBe(part)
        expect(m.shown, `${id} hide ${part}`).toEqual(TRIANGLE_PARTS.filter((q) => q !== part))
        // Two texts are left, the two that are not hidden: the same words in the same places at the same size.
        expect(g.texts, `${id} hide ${part}`).toEqual(full.filter((t) => t !== hidden))
        expect(
          g.texts!.map((t) => t.text),
          `${id} hide ${part}`,
        ).not.toContain(hidden.text)
        // The lines are the same: the empty part is still a part.
        expect(g.prims, `${id} hide ${part}`).toEqual(triangleGeometry(base).prims)
      }
      expect(triangleGeometry({ ...base, hide: 'none' }).texts, id).toEqual(full)
    }
    expect(triangleModel({}).hidden).toBeNull()
    expect(triangleModel({ hide: 'none' }).shown).toEqual(['top', 'left', 'right'])
  })

  it('sets the worksheet like the answer sheet: the size follows all three texts, whichever is hidden', () => {
    // 'actual' is the widest text of the yield triangle: hiding it must not let the other two grow.
    const full = triangleGeometry({ preset: 'yield' }).texts!,
      noTop = triangleGeometry({ preset: 'yield', hide: 'top' }).texts!
    expect(new Set(full.map((t) => t.size)).size).toBe(1)
    expect(full[0].size).toBeLessThan(16)
    expect(noTop.map((t) => t.size)).toEqual([full[0].size, full[0].size])
  })
})

describe('formula triangle: the width of text', () => {
  it('measures text as Arial sets it, with a subscript or superscript at 0.7 of the size', () => {
    // Widths in thousandths of an em from the Arial (Helvetica) metrics: M 833, W 944, i 222, 0 556, space 278, m 833, r 333.
    expect(textWidth('M', 1000)).toBeCloseTo(833, 6)
    expect(textWidth('W', 1000)).toBeCloseTo(944, 6)
    expect(textWidth('iii', 1000)).toBeCloseTo(666, 6)
    expect(textWidth('24', 1000)).toBeCloseTo(1112, 6)
    expect(textWidth('a b', 1000)).toBeCloseTo(556 + 278 + 556, 6)
    expect(textWidth('Mr', 1000)).toBeCloseTo(833 + 333, 6)
    expect(textWidth('M_r', 1000)).toBeCloseTo(833 + 0.7 * 333, 6)
    expect(textWidth('', 16)).toBe(0)
    expect(textWidth('m', 16)).toBeCloseTo(0.833 * 16, 6)
  })
})

// ================================================================ the hazard symbol

const IDS = ['explosive', 'flammable', 'oxidising', 'gasUnderPressure', 'corrosive', 'toxic', 'harmful', 'health', 'environment'] as const
/** The name under each diamond, as the specification gives it. */
const NAME: Record<(typeof IDS)[number], string> = {
  explosive: 'explosive',
  flammable: 'flammable',
  oxidising: 'oxidising',
  gasUnderPressure: 'gas under pressure',
  corrosive: 'corrosive',
  toxic: 'toxic',
  harmful: 'harmful or irritant',
  health: 'health hazard',
  environment: 'environmental hazard',
}
const hazardGeometry = (hazard: string, size = 70, name = false): Geometry => geometry('hazardSymbol', size, size, { hazard, name })
/** The picture is everything after the diamond. */
const pictureOf = (g: Geometry) => g.prims.slice(1)
/** A line of what a picture is made of: the role of each part and how many separate shapes it has. */
const fingerprint = (g: Geometry): string =>
  pictureOf(g)
    .map((p) => `${p.role}:${shapes(p.d)}`)
    .join(' ')
/** What each picture is made of at the default size: a picture that turns into another one's, or loses a part, changes its line. */
const MADE_OF: Record<(typeof IDS)[number], string> = {
  explosive: 'ink:3 outline:1', // the bomb, its cap and the burst; the fuse
  flammable: 'ink:2', // the flame and the small flame cut out of it
  oxidising: 'ink:4', // the flame and its cut-out, the ring and its hole
  gasUnderPressure: 'ink:4', // the body, the neck, the valve, the stripe cut out of the body
  corrosive: 'outline:2 ink:9', // the two tubes; two drops, the bar, the palm, four fingers and the thumb
  toxic: 'ink:18', // eight knobs and the four pieces of bone that show outside the skull; the skull and its five holes (two eyes, the nose, two gaps between teeth)
  harmful: 'ink:2', // the bar and the dot
  health: 'ink:3', // the head, the body and the star cut out of it
  environment: 'ink:11', // the trunk and six branches (one is a twig); the fish, its tail, its fin and its eye
}

describe('hazard symbol: the nine pictograms', () => {
  it('has nine hazards, in the order of their GHS codes, and the parameter offers exactly those', () => {
    expect(HAZARDS).toHaveLength(9)
    expect(HAZARDS.map((h) => h.id)).toEqual([...IDS])
    expect(HAZARDS.map((h) => h.ghs)).toEqual(range(1, 9).map((n) => `GHS0${n}`))
    expect(new Set(HAZARDS.map((h) => h.id)).size).toBe(9)
    const param = symbolDef('hazardSymbol').params!.find((p) => p.key === 'hazard')!
    expect(param.type === 'choice' && param.options.map((o) => o.value)).toEqual([...IDS])
    expect(param.type === 'choice' && param.options).toHaveLength(9)
  })

  it('draws every hazard with the same diamond: a square set on its corner, filling the box', () => {
    for (const size of [56, 70, 105]) {
      const diamonds = IDS.map((id) => hazardGeometry(id, size).prims[0])
      expect(new Set(diamonds.map((d) => d.d)).size, `size ${size}`).toBe(1)
      expect(diamonds[0].role).toBe('outline')
      // The corners: top, right, bottom and left, half a line inside the box; the four sides are as long as each other and at 45 degrees.
      const [poly] = pathPolys(diamonds[0].d)
      const h = size / 2 - 1
      expect(poly.slice(0, 4).map((q) => [q.x, q.y])).toEqual([
        [0, 1],
        [h, size / 2],
        [0, size - 1],
        [-h, size / 2],
      ])
      for (let i = 0; i < 4; i++) {
        const a = poly[i],
          b = poly[i + 1]
        expect(Math.abs(b.x - a.x), `size ${size} side ${i}`).toBeCloseTo(Math.abs(b.y - a.y), 6)
        expect(Math.hypot(b.x - a.x, b.y - a.y), `size ${size} side ${i}`).toBeCloseTo(h * Math.SQRT2, 6)
      }
    }
  })

  it('draws a different picture for each hazard, in line (outline and ink only, no tint)', () => {
    for (const size of [56, 70, 105]) {
      const pictures = IDS.map((id) =>
        pictureOf(hazardGeometry(id, size))
          .map((p) => `${p.role} ${p.d}`)
          .join('|'),
      )
      expect(new Set(pictures).size, `size ${size}`).toBe(9)
    }
    for (const id of IDS) {
      const g = hazardGeometry(id)
      expect(pictureOf(g).length, id).toBeGreaterThan(0)
      for (const p of g.prims) {
        expect(['outline', 'ink', 'detail'], `${id}: ${p.role}`).toContain(p.role)
        expect(p.tint, id).toBeUndefined()
      }
      expect(
        pictureOf(g).some((p) => p.role === 'ink'),
        id,
      ).toBe(true)
    }
  })

  it('makes each picture of the parts that it shows: the bomb, the flame, the flame over a ring, the cylinder, the hand and bar, the skull, the mark ...', () => {
    for (const id of IDS) expect(fingerprint(hazardGeometry(id)), id).toBe(MADE_OF[id])
    // The shapes are what the names say: an exclamation mark is a tall thin bar over a dot; a gas cylinder is tall and slim; a flame is taller than wide.
    const box = (id: (typeof IDS)[number]) => {
      const b = pictureOf(hazardGeometry(id)).map((p) => pathBounds(p.d))
      return { w: Math.max(...b.map((q) => q.x1)) - Math.min(...b.map((q) => q.x0)), h: Math.max(...b.map((q) => q.y1)) - Math.min(...b.map((q) => q.y0)) }
    }
    expect(box('harmful').h / box('harmful').w).toBeGreaterThan(3)
    expect(box('gasUnderPressure').h / box('gasUnderPressure').w).toBeGreaterThan(2.5)
    expect(box('flammable').h / box('flammable').w).toBeGreaterThan(1.3)
    expect(box('oxidising').h).toBeGreaterThan(box('flammable').h)
    expect(box('toxic').w).toBeGreaterThan(box('toxic').h)
    expect(box('corrosive').w).toBeGreaterThan(box('corrosive').h)
  })

  it('keeps every picture inside the diamond with clear paper round it, at the smallest size, the default size and a larger one', () => {
    for (const size of [56, 70, 105]) {
      for (const id of IDS) {
        // The inner edge of the diamond's line is half a line (1 u, 1.41 u along an axis) inside the line through the corners.
        const inner = size / 2 - 1 - Math.SQRT2
        let far = 0
        for (const p of pictureOf(hazardGeometry(id, size))) {
          const pad = p.role === 'outline' ? 1 : p.role === 'detail' ? 0.625 : 0
          for (const poly of pathPolys(p.d, 0.05)) for (const q of poly) far = Math.max(far, Math.abs(q.x) + Math.abs(q.y - size / 2) + pad * Math.SQRT2)
        }
        // Clear paper between the picture and the line is 1.2 u or more (measured across, so divide the distance along an axis by the square root of 2).
        expect((inner - far) / Math.SQRT2, `${id} at ${size}`).toBeGreaterThan(1.2)
      }
    }
  })
})

describe('hazard symbol: the name', () => {
  it('writes the name of the hazard under the diamond, when the name is on, and nothing when it is off', () => {
    for (const id of IDS) {
      const on = hazardGeometry(id, 70, true),
        off = hazardGeometry(id, 70, false)
      expect(off.texts ?? [], id).toEqual([])
      expect(on.texts, id).toHaveLength(1)
      const t = on.texts![0]
      expect(t.text, id).toBe(NAME[id])
      expect(t.size, id).toBe(12)
      expect(t.anchor, id).toBe('middle')
      expect(t.x, id).toBe(0)
      expect(t.y - 0.716 * t.size, id).toBeGreaterThan(70) // the capitals are all below the diamond
      // The name does not change the picture.
      expect(on.prims, id).toEqual(off.prims)
    }
    expect(HAZARDS.map((h) => h.name)).toEqual(IDS.map((id) => NAME[id]))
    expect(new Set(HAZARDS.map((h) => h.name)).size).toBe(9)
  })

  it('matches the name to the picture: what the picture shows is what the name says', () => {
    // Each hazard says what it shows, in the words of the specification, and the name goes with that picture (not with another).
    const shows: Record<(typeof IDS)[number], RegExp> = {
      explosive: /bomb/,
      flammable: /^a flame$/,
      oxidising: /flame over a circle/,
      gasUnderPressure: /gas cylinder/,
      corrosive: /hand.*bar/,
      toxic: /skull and crossbones/,
      harmful: /exclamation mark/,
      health: /star on the chest/,
      environment: /tree.*fish/,
    }
    for (const id of IDS) {
      expect(HAZARDS.find((h) => h.id === id)!.shows, id).toMatch(shows[id])
      expect(hazardModel({ hazard: id }).hazard.id, id).toBe(id)
      expect(hazardModel({ hazard: id, name: true }).showName, id).toBe(true)
    }
    expect(hazardModel({}).hazard.id).toBe('flammable')
    expect(hazardModel({}).showName).toBe(false)
  })

  it('draws what the model says for every hazard: the diamond, its picture, and the name if it is on', () => {
    for (const id of IDS)
      for (const name of [true, false]) {
        const m = hazardModel({ hazard: id, name }),
          g = hazardGeometry(id, 70, name)
        expect(m.hazard.id).toBe(id)
        expect(g.prims.length).toBeGreaterThanOrEqual(2)
        expect((g.texts ?? []).map((t) => t.text)).toEqual(m.showName ? [m.hazard.name] : [])
      }
  })
})

// ================================================================ the text of all three

describe('annotation symbols: the size of their text (rule S11 as relaxed: 12 to 18 u)', () => {
  it('keeps every text between 12 and 18 u, at every size and for every parameter, and never turns it', () => {
    const sizes = (symbol: string, boxes: [number, number][], variants: Record<string, ParamValue>[]) => {
      const out: number[] = []
      for (const [w, h] of boxes)
        for (const params of variants) {
          const texts = geometry(symbol, w, h, params).texts ?? []
          for (const t of texts) {
            out.push(t.size)
            expect(t.size, `${symbol} ${w}x${h} ${JSON.stringify(params)}: "${t.text}"`).toBeGreaterThanOrEqual(12)
            expect(t.size, `${symbol} ${w}x${h} ${JSON.stringify(params)}: "${t.text}"`).toBeLessThanOrEqual(18)
            expect(Object.keys(t).sort(), `${symbol} ${w}x${h}`).toEqual(['anchor', 'size', 'text', 'x', 'y']) // a text has no turn
          }
        }
      return out
    }
    const long = 'A long text 123.45'
    const pH = sizes(
      'phScale',
      [
        [420, 70],
        [360, 62],
        [630, 105],
        [420, 420],
        [360, 300],
      ],
      [{}, { examples: true }, { orientation: 'vertical', examples: true }, { orientation: 'vertical' }],
    )
    const triangle = sizes(
      'formulaTriangle',
      [
        [120, 110],
        [108, 99],
        [180, 165],
      ],
      [
        ...PRESET_IDS.map((preset) => ({ preset })),
        { preset: 'custom', top: long, left: long, right: long },
        { preset: 'custom', top: '', left: 'x', right: 'y' },
      ],
    )
    const hazards = sizes(
      'hazardSymbol',
      [
        [70, 70],
        [56, 56],
        [105, 105],
      ],
      IDS.map((hazard) => ({ hazard, name: true })),
    )
    // The sizes that are used are the ones the design says: 12 u for the words and the names, up to 16 u in a cell and in a triangle of the default size.
    expect(Math.max(...pH)).toBe(16)
    expect(Math.min(...pH)).toBe(12)
    expect(Math.max(...triangle)).toBe(18)
    expect(Math.min(...triangle)).toBe(12)
    expect(new Set(hazards)).toEqual(new Set([12]))
  })
})
