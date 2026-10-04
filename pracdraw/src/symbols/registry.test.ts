// Every symbol in the registry gets these checks. A new symbol needs no test of its own to be covered.

import { describe, expect, it } from 'vitest'
import { bounds, pathBounds } from '../kernel/geom'
import { svgDocument } from '../kernel/nodes'
import { DocBuilder } from '../model/build'
import { docNodes } from '../render/render'
import { CONE_END, NECK } from './kit'
import { labelPoint } from './label'
import { SYMBOLS, defaultParams, geometry, labelText, symbolDef } from './registry'
import { amountToReading, readingToAmount, valueToY } from './scale'
import type { Geometry, ParamValue, SymbolDef } from './types'

const FORBIDDEN = /<(clipPath|mask|pattern|filter|foreignObject|use|style|image|linearGradient|radialGradient|symbol|defs)\b/
const BAD_NUMBER = /NaN|Infinity|undefined|null/

/** How far a drawing may stick out of its nominal box (lips, side arms, scale numbers, tap keys). */
const OVERHANG = 45

/** Every parameter set worth drawing: the defaults, then each parameter alone at each of its values (number: minimum and maximum). */
function variants(def: SymbolDef): Record<string, ParamValue>[] {
  const base = defaultParams(def)
  const out = [base]
  for (const p of def.params ?? []) {
    const values: ParamValue[] =
      p.type === 'boolean'
        ? [true, false]
        : p.type === 'choice'
          ? p.options.map((o) => o.value)
          : p.type === 'number'
            ? [p.min, p.max]
            : ['', 'A long text 123.45']
    for (const value of values) if (value !== p.default) out.push({ ...base, [p.key]: value })
  }
  return out
}

function expectClean(g: Geometry, w: number, h: number): void {
  expect(g.prims.length).toBeGreaterThan(0)
  for (const p of g.prims) {
    expect(p.d.length).toBeGreaterThan(0)
    expect(p.d).not.toMatch(BAD_NUMBER)
    const b = pathBounds(p.d)
    expect(b.x0).toBeGreaterThanOrEqual(-w / 2 - OVERHANG)
    expect(b.x1).toBeLessThanOrEqual(w / 2 + OVERHANG)
    expect(b.y0).toBeGreaterThanOrEqual(-OVERHANG)
    expect(b.y1).toBeLessThanOrEqual(h + OVERHANG)
  }
  for (const t of g.texts ?? []) expect(Number.isFinite(t.x) && Number.isFinite(t.y) && t.size > 0).toBe(true)
  for (const c of g.cavities ?? []) for (const poly of c.polys) for (const q of poly) expect(Number.isFinite(q.x) && Number.isFinite(q.y)).toBe(true)
  for (const a of g.anchors ?? []) expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true)
}

describe('registry', () => {
  it('has unique lowerCamelCase ids', () => {
    const ids = SYMBOLS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z][a-zA-Z0-9]*$/)
  })
})

for (const def of SYMBOLS) {
  describe(def.id, () => {
    const sizes = [
      def.size,
      def.min ?? def.size,
      {
        w: def.size.w * (def.resize === 'height' || def.resize === 'none' ? 1 : 1.5),
        h: def.size.h * (def.resize === 'width' || def.resize === 'none' ? 1 : 1.5),
      },
    ]

    it('has a name and sensible sizes', () => {
      expect(def.name.trim().length).toBeGreaterThan(2)
      expect(def.size.w).toBeGreaterThan(0)
      expect(def.size.h).toBeGreaterThan(0)
      if (def.min) {
        expect(def.min.w).toBeLessThanOrEqual(def.size.w)
        expect(def.min.h).toBeLessThanOrEqual(def.size.h)
      }
    })

    it('builds clean geometry at default, minimum and enlarged sizes, for every parameter value', () => {
      for (const { w, h } of sizes) for (const p of variants(def)) expectClean(def.build({ w, h, p }), w, h)
    })

    it('gives each parameter a label and a sensible default', () => {
      for (const p of def.params ?? []) {
        expect(p.key).toMatch(/^[a-z][a-zA-Z0-9]*$/)
        expect(p.label.trim().length).toBeGreaterThan(1)
        if (p.type === 'number') expect(p.min <= p.default && p.default <= p.max).toBe(true)
        if (p.type === 'choice') expect(p.options.some((o) => o.value === p.default)).toBe(true)
      }
    })

    it('is pure', () => {
      const a = def.build({ ...def.size, p: defaultParams(def) }),
        b = def.build({ ...def.size, p: defaultParams(def) })
      expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    })

    it('has closed cavities inside the box', () => {
      const g = geometry(def.id, def.size.w, def.size.h)
      const ids = (g.cavities ?? []).map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const c of g.cavities ?? []) {
        for (const poly of c.polys) expect(poly.length).toBeGreaterThanOrEqual(4)
        const b = bounds(c.polys.flat())
        expect(b.x0).toBeGreaterThanOrEqual(-def.size.w / 2 - 2)
        expect(b.x1).toBeLessThanOrEqual(def.size.w / 2 + 2)
        expect(b.y0).toBeGreaterThanOrEqual(-2)
        expect(b.y1).toBeLessThanOrEqual(def.size.h + 2)
      }
    })

    it('has unique anchors near the box', () => {
      const g = geometry(def.id, def.size.w, def.size.h)
      const ids = (g.anchors ?? []).map((a) => a.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const a of g.anchors ?? []) {
        expect(Math.abs(a.x)).toBeLessThanOrEqual(def.size.w / 2 + OVERHANG)
        expect(a.y).toBeGreaterThanOrEqual(-OVERHANG)
        expect(a.y).toBeLessThanOrEqual(def.size.h + OVERHANG)
      }
    })

    it('gives a leader an end point on the drawing, for each side', () => {
      const { w, h } = def.size
      const g = geometry(def.id, w, h)
      for (const side of ['left', 'right'] as const) {
        const p = labelPoint(g, w, h, side)
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true)
        expect(Math.abs(p.x)).toBeLessThanOrEqual(w / 2 + OVERHANG)
        expect(p.y).toBeGreaterThanOrEqual(-OVERHANG)
        expect(p.y).toBeLessThanOrEqual(h + OVERHANG)
      }
      expect(labelPoint(g, w, h, 'left').x).toBeLessThanOrEqual(labelPoint(g, w, h, 'right').x)
    })

    it('has a usable scale, if it has one', () => {
      const g = geometry(def.id, def.size.w, def.size.h)
      if (!g.scale) return
      const mid = (g.scale.v0 + g.scale.v1) / 2
      const amount = readingToAmount(g, mid)!
      expect(amount).toBeGreaterThan(0)
      expect(amount).toBeLessThan(1)
      expect(amountToReading(g, amount)).toBeCloseTo(mid, 6)
      expect(valueToY(g, g.scale.v0)).toBeCloseTo(g.scale.y0, 6)
    })

    it('renders to plain SVG, upright and turned, in colour and photocopy-safe', () => {
      for (const mono of [false, true]) {
        for (const rot of [0, 90, 215]) {
          const b = new DocBuilder()
          b.doc.settings.mono = mono
          const g = geometry(def.id, def.size.w, def.size.h)
          b.symbol(def.id, {
            rot,
            flip: rot === 215,
            contents: Object.fromEntries(
              (g.cavities ?? []).map((c) => [c.id, [{ kind: 'liquid' as const, amount: 0.5, colour: '#cfe8f7', bubbles: 'few' as const }]]),
            ),
          })
          const svg = svgDocument(docNodes(b.doc), 10, 10)
          expect(svg).not.toMatch(BAD_NUMBER)
          expect(svg).not.toMatch(FORBIDDEN)
          expect(svg).not.toMatch(/ (class|style)=/)
          if (mono) expect(svg).not.toContain('#cfe8f7')
        }
      }
    })
  })
}

describe('label text', () => {
  it('uses a lower-case first letter, keeps proper nouns, drops brackets', () => {
    expect(labelText(symbolDef('conicalFlask'))).toBe('conical flask')
    expect(labelText(symbolDef('bunsenBurner'))).toBe('Bunsen burner')
    expect(labelText({ ...symbolDef('beaker'), name: 'Petri dish (side view)', label: undefined })).toBe('petri dish')
  })
  it('can depend on the parameters', () => {
    const def: SymbolDef = { ...symbolDef('beaker'), label: (p) => (p.graduations ? 'graduated beaker' : 'beaker') }
    expect(labelText(def)).toBe('beaker')
    expect(labelText(def, { graduations: true })).toBe('graduated beaker')
  })
})

describe('leader end points', () => {
  const at = (id: string, side: 'left' | 'right', w?: number, h?: number) => {
    const s = symbolDef(id).size
    return labelPoint(geometry(id, w ?? s.w, h ?? s.h), w ?? s.w, h ?? s.h, side)
  }
  it('are on the glass of a conical flask, not on its box', () => {
    const p = at('conicalFlask', 'right')
    expect(p.x).toBeGreaterThan(17) // outside the neck
    expect(p.x).toBeLessThan(50) // inside the box edge at 55: on the sloping wall
  })
  it('are on the rod of a clamp stand and on the barrel of a Bunsen burner', () => {
    expect(at('clampStand', 'right').x).toBeCloseTo(-75 + 24 + 3, 1)
    expect(Math.abs(at('bunsenBurner', 'left').x)).toBeLessThanOrEqual(10.5)
  })
  it('follow labelAt when a symbol gives one', () => {
    const g = { ...geometry('beaker', 100, 120), labelAt: { left: { x: -1, y: 2 }, right: { x: 3, y: 4 } } }
    expect(labelPoint(g, 100, 120, 'right')).toEqual({ x: 3, y: 4 })
  })
})

describe('a symbol that cannot be drawn', () => {
  it('becomes a dashed box with its id, and never throws', () => {
    const g = geometry('fromTheFuture', 80, 60)
    expect(g.prims).toHaveLength(1)
    expect(g.prims[0].role).toBe('dashed')
    expect(g.texts?.[0].text).toBe('fromTheFuture')
    expect(g.anchors ?? []).toEqual([])
    expect(() => symbolDef('fromTheFuture')).toThrow()
  })
})

describe('scales', () => {
  it('a measuring cylinder has real divisions only', () => {
    // capacity → [division at default height, division at minimum height]
    const expected: Record<string, [number, number]> = { '10': [0.2, 0.5], '25': [0.5, 1], '50': [1, 2], '100': [2, 5], '250': [5, 10] }
    for (const [capacity, [fine, coarse]] of Object.entries(expected)) {
      for (const [h, step] of [
        [190, fine],
        [80, coarse],
      ]) {
        const g = geometry('measuringCylinder', 60, h, { capacity })
        const ticks = g.prims.find((p) => p.role === 'detail')!.d.split('M').length - 1
        expect(ticks).toBe(Math.round(Number(capacity) / step)) // one tick for each division; the zero line is the inside bottom
      }
    }
    const numbers = geometry('measuringCylinder', 60, 190, { capacity: '25', numbers: true }).texts!.map((t) => t.text)
    expect(numbers).toEqual(['5', '10', '15', '20', '25'])
  })
  it('a thermometer has a number every 20 °C', () => {
    const g = geometry('thermometer', 9, 210, { numbers: true })
    expect(g.texts!.map((t) => t.text)).toEqual(['0', '20', '40', '60', '80', '100'])
    for (const t of g.texts!) expect(t.y - 2.8).toBeCloseTo(valueToY(g, Number(t.text))!, 6)
  })
  it('an upside-down cylinder reads the volume of gas above the water', () => {
    const g = geometry('measuringCylinder', 60, 190)
    const water = readingToAmount(g, 37, true)! // the water is at the mouth end; 37 cm³ of gas is above it
    expect(water).toBeCloseTo(1 - readingToAmount(g, 37)!, 9)
    expect(amountToReading(g, water, true)).toBeCloseTo(37, 6)
    // The surface is where the kernel draws it: `water` of the cavity height, measured from the mouth.
    const ys = g.cavities![0].polys.flat().map((p) => p.y)
    const top = Math.min(...ys),
      bottom = Math.max(...ys)
    expect(top + water * (bottom - top)).toBeCloseTo(valueToY(g, 37)!, 6)
  })
  it('a full burette holds liquid in the jet', () => {
    const g = geometry('burette', 18, 340)
    const ys = g.cavities![0].polys.flat().map((p) => p.y)
    expect(Math.max(...ys)).toBeCloseTo(340, 6)
    expect(amountToReading(g, readingToAmount(g, 23.45)!)).toBeCloseTo(23.45, 6)
  })
})

describe('fits', () => {
  const mouth = (id: string) => geometry(id, ...sizeOf(id)).anchors!.find((a) => a.kind === 'mouth')!.width!
  const sizeOf = (id: string): [number, number] => {
    const s = SYMBOLS.find((d) => d.id === id)!.size
    return [s.w, s.h]
  }
  it('the standard neck is shared', () => {
    for (const id of ['conicalFlask', 'roundBottomFlask', 'boilingTube']) expect(mouth(id)).toBe(NECK)
  })
  it('ground-glass joints share the neck size', () => {
    const lc = geometry('liebigCondenser', ...sizeOf('liebigCondenser')).anchors!
    expect(lc.find((a) => a.id === 'socket')!.width).toBe(NECK)
    expect(lc.find((a) => a.id === 'cone')!.width).toBe(NECK)
    expect(lc.find((a) => a.id === 'tip')!.width).toBe(CONE_END)
    expect(mouth('roundBottomFlask')).toBe(lc.find((a) => a.id === 'cone')!.width)
  })
  it('the default bung plugs the standard neck', () => {
    const plug = geometry('bung', ...sizeOf('bung')).anchors!.find((a) => a.kind === 'plug')!
    expect(Math.abs(plug.width! - NECK)).toBeLessThanOrEqual(1)
  })
  it('a beaker stands on the gauze, the gauze on the tripod, the burner under the tripod', () => {
    expect(sizeOf('beaker')[0]).toBeLessThan(sizeOf('gauze')[0])
    expect(sizeOf('gauze')[0]).toBeGreaterThanOrEqual(sizeOf('tripod')[0])
    expect(sizeOf('bunsenBurner')[1]).toBeLessThan(sizeOf('tripod')[1] + 20) // the flame tip may reach the gauze
    expect(sizeOf('bunsenBurner')[0]).toBeLessThan(sizeOf('tripod')[0] - 20)
  })
})
