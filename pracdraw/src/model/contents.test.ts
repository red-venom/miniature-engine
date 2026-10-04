import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Layer } from '../kernel/contents'
import { geometry } from '../symbols/registry'
import { amountToReading, readingToAmount } from '../symbols/scale'
import { addSymbol } from './commands'
import {
  MAX_LAYERS,
  PRESETS,
  THERMOMETER_RED,
  WATER,
  addLayer,
  applyPreset,
  emptyCavity,
  fillWater,
  filledAmount,
  normaliseLayers,
  presetOf,
  readingMode,
  readingOf,
  removeLayer,
  setFilled,
  setLayer,
  setLayers,
  setReading,
  topLayerIndex,
} from './contents'
import { newDoc, type Doc, type SymbolItem } from './types'

const water = (amount: number, extra: Partial<Layer> = {}): Layer => ({ kind: 'liquid', amount, colour: WATER, ...extra })
const powder = (amount: number): Layer => ({ kind: 'powder', amount, colour: '#f1f1f1' })
const gas = (colour = '#e3efc1'): Layer => ({ kind: 'gas', amount: 0, colour })

/** A document with one symbol, id `s`, and a label, id `l`. */
function withSymbol(symbol: string, contents: Record<string, Layer[]> = {}, patch: Partial<SymbolItem> = {}): Doc {
  const doc = addSymbol(newDoc(), symbol, 100, 100, 's')
  const it = { ...(doc.items.s as SymbolItem), contents, ...patch }
  return {
    ...doc,
    items: { ...doc.items, s: it, l: { id: 'l', type: 'label', text: 'beaker', x: 0, y: 0, side: 'left', leaderEnd: 'none' } },
    order: ['s', 'l'],
  }
}
const item = (doc: Doc) => doc.items.s as SymbolItem
const layers = (doc: Doc, cavity = 'main') => item(doc).contents[cavity]

describe('presets', () => {
  it('are the 29 rows of the preset table in section 9, in order', () => {
    const lines = readFileSync(resolve(__dirname, '../../docs/SPEC.md'), 'utf8').split('\n')
    const start = lines.findIndex((l) => l.startsWith('| Preset | Kind | Colour |'))
    expect(start).toBeGreaterThan(0)
    const rows = []
    for (let i = start + 2; lines[i]?.startsWith('|'); i++) {
      const [name, kind, colour] = lines[i]
        .split('|')
        .slice(1, 4)
        .map((c) => c.trim())
      rows.push({ name, kind: kind.split(',')[0].trim(), colour, cloudy: kind.includes('cloudy') ? true : undefined })
    }
    expect(rows).toHaveLength(29)
    expect(PRESETS.map((p) => ({ name: p.name, kind: p.kind, colour: p.colour, cloudy: p.cloudy }))).toEqual(rows)
  })
  it('a layer matches its preset by kind, colour and cloudy flag', () => {
    expect(presetOf(water(0.5))?.name).toBe('Water')
    expect(presetOf({ kind: 'liquid', amount: 0.2, colour: '#e6e6e6', cloudy: true })?.name).toBe('Cloudy')
    expect(presetOf({ kind: 'liquid', amount: 0.2, colour: '#e6e6e6' })).toBeUndefined()
    expect(presetOf({ kind: 'lumps', amount: 0.2, colour: '#7fb8e6' })?.name).toBe('Blue crystals (copper sulfate)')
  })
})

describe('the layer rules', () => {
  it('a gas goes last, and only the last gas stays', () => {
    expect(normaliseLayers([gas(), water(0.3)])).toEqual([water(0.3), gas()])
    expect(normaliseLayers([gas('#e3efc1'), water(0.2), gas('#cfa27a')])).toEqual([water(0.2), gas('#cfa27a')])
  })
  it('the amounts of the other layers add up to at most 1: a layer that would overflow is cut', () => {
    expect(normaliseLayers([water(0.7), powder(0.6), water(0.2)])).toEqual([water(0.7), powder(0.3), water(0)])
    expect(normaliseLayers([water(-1), water(Number.NaN), water(2)])).toEqual([water(0), water(0), water(1)])
    expect(filledAmount([water(0.7), powder(0.6), gas()])).toBe(1)
    expect(topLayerIndex([water(0.7), powder(0.6), gas()])).toBe(1)
    expect(topLayerIndex([gas()])).toBe(-1)
  })
  it('only a liquid keeps meniscus, bubbles and cloudy', () => {
    const odd: Layer = { kind: 'powder', amount: 0.2, colour: '#f1f1f1', meniscus: true, bubbles: 'few', cloudy: true }
    expect(normaliseLayers([odd])).toEqual([powder(0.2)])
    const liquid = water(0.2, { meniscus: true, bubbles: 'few', cloudy: true })
    expect(normaliseLayers([liquid])[0]).toBe(liquid)
  })
  it('keeps at most four layers, and the gas', () => {
    const five = [0.1, 0.1, 0.1, 0.1, 0.1].map((a) => water(a))
    expect(normaliseLayers(five)).toHaveLength(MAX_LAYERS)
    const withGas = normaliseLayers([...five, gas()])
    expect(withGas).toHaveLength(MAX_LAYERS)
    expect(withGas[3]).toEqual(gas())
  })
})

describe('quick buttons', () => {
  it('Water gives one liquid layer, amount 0.5, colour #cfe8f7, in place of what was there', () => {
    const doc = withSymbol('beaker', { main: [powder(0.2), gas()] })
    const next = fillWater(doc, 's', 'main')
    expect(layers(next)).toEqual([{ kind: 'liquid', amount: 0.5, colour: '#cfe8f7' }])
    expect(layers(doc)).toEqual([powder(0.2), gas()])
    expect(next.items.l).toBe(doc.items.l)
    expect(fillWater(next, 's', 'main')).toBe(next)
  })
  it('Empty removes every layer of the cavity', () => {
    const doc = withSymbol('liebigCondenser', { jacket: [water(0.5)], inner: [water(0.2)] })
    const next = emptyCavity(doc, 's', 'jacket')
    expect(item(next).contents).toEqual({ inner: [water(0.2)] })
    expect(emptyCavity(next, 's', 'jacket')).toBe(next)
  })
  it('ignores an item that is missing or is not a symbol', () => {
    const doc = withSymbol('beaker')
    expect(fillWater(doc, 'nothing', 'main')).toBe(doc)
    expect(fillWater(doc, 'l', 'main')).toBe(doc)
    expect(addLayer(doc, 'l', 'main')).toBe(doc)
  })
})

describe('add and remove layers', () => {
  it('Add layer puts water on top of the layers that are not a gas, a quarter full or what room is left', () => {
    expect(layers(addLayer(withSymbol('beaker'), 's', 'main'))).toEqual([water(0.25)])
    expect(layers(addLayer(withSymbol('beaker', { main: [water(0.9)] }), 's', 'main'))).toEqual([water(0.9), water(0.1)])
    expect(layers(addLayer(withSymbol('beaker', { main: [powder(0.3), gas()] }), 's', 'main'))).toEqual([powder(0.3), water(0.25), gas()])
  })
  it('a cavity takes at most four layers', () => {
    const full = withSymbol('beaker', { main: [water(0.1), water(0.1), water(0.1), gas()] })
    expect(addLayer(full, 's', 'main')).toBe(full)
  })
  it('a new gas layer goes last and takes the place of the gas that was there', () => {
    const doc = withSymbol('beaker', { main: [water(0.3), gas('#e3efc1')] })
    expect(layers(addLayer(doc, 's', 'main', { kind: 'gas', colour: '#cfa27a' }))).toEqual([water(0.3), { kind: 'gas', amount: 0.25, colour: '#cfa27a' }])
  })
  it('removes one layer; the last one leaves the cavity empty', () => {
    const doc = withSymbol('beaker', { main: [powder(0.2), water(0.3)] })
    const one = removeLayer(doc, 's', 'main', 0)
    expect(layers(one)).toEqual([water(0.3)])
    expect(item(removeLayer(one, 's', 'main', 0)).contents).toEqual({})
    expect(removeLayer(doc, 's', 'main', 2)).toBe(doc)
    expect(removeLayer(doc, 's', 'main', -1)).toBe(doc)
  })
  it('setLayers replaces the layers and keeps the rules', () => {
    const doc = withSymbol('beaker', { main: [water(0.3)] })
    expect(layers(setLayers(doc, 's', 'main', [gas(), powder(0.4), water(0.8)]))).toEqual([powder(0.4), water(0.6), gas()])
    expect(item(setLayers(doc, 's', 'main', [])).contents).toEqual({})
  })
})

describe('setLayer', () => {
  it('sets kind, colour, amount, bubbles, cloudy and meniscus; undefined removes a field', () => {
    const doc = withSymbol('beaker', { main: [water(0.5)] })
    const next = setLayer(doc, 's', 'main', 0, { colour: '#7fb8e6', amount: 0.4, bubbles: 'many', cloudy: true, meniscus: true })
    expect(layers(next)).toEqual([{ kind: 'liquid', amount: 0.4, colour: '#7fb8e6', bubbles: 'many', cloudy: true, meniscus: true }])
    expect(layers(setLayer(next, 's', 'main', 0, { bubbles: undefined, cloudy: undefined, meniscus: undefined }))).toEqual([water(0.4, { colour: '#7fb8e6' })])
    expect(layers(setLayer(next, 's', 'main', 0, { kind: 'powder' }))).toEqual([{ kind: 'powder', amount: 0.4, colour: '#7fb8e6' }])
  })
  it('a layer takes at most the room that the other layers leave; the others do not change', () => {
    const doc = withSymbol('beaker', { main: [water(0.5), powder(0.3), gas()] })
    expect(layers(setLayer(doc, 's', 'main', 0, { amount: 0.9 }))).toEqual([water(0.7), powder(0.3), gas()])
    expect(layers(setLayer(doc, 's', 'main', 1, { amount: -0.2 }))).toEqual([water(0.5), powder(0), gas()])
  })
  it('a layer that becomes a gas goes last, in place of the gas that was there', () => {
    const doc = withSymbol('beaker', { main: [water(0.5), powder(0.3), gas()] })
    expect(layers(setLayer(doc, 's', 'main', 0, { kind: 'gas' }))).toEqual([powder(0.3), { kind: 'gas', amount: 0.5, colour: WATER }])
    const turned = setLayer(doc, 's', 'main', 2, { kind: 'liquid', amount: 0.4 })
    expect(layers(turned)).toEqual([water(0.5), powder(0.3), { kind: 'liquid', amount: 0.2, colour: '#e3efc1' }])
  })
  it('returns the same document when nothing changes or the layer does not exist', () => {
    const doc = withSymbol('beaker', { main: [water(0.5)] })
    expect(setLayer(doc, 's', 'main', 0, { amount: 0.5 })).toBe(doc)
    expect(setLayer(doc, 's', 'main', 1, { amount: 0.2 })).toBe(doc)
    expect(setLayer(doc, 's', 'jacket', 0, { amount: 0.2 })).toBe(doc)
  })
})

describe('applyPreset', () => {
  const preset = (name: string) => PRESETS.find((p) => p.name === name)!
  it('sets the kind, the colour and the cloudy flag', () => {
    const doc = withSymbol('beaker', { main: [water(0.5, { bubbles: 'few' })] })
    const cloudy = applyPreset(doc, 's', 'main', 0, preset('Cloudy yellow (sulfur)'))
    expect(layers(cloudy)).toEqual([{ kind: 'liquid', amount: 0.5, colour: '#f1e9b0', bubbles: 'few', cloudy: true }])
    expect(layers(applyPreset(cloudy, 's', 'main', 0, preset('Blue (copper sulfate)')))).toEqual([water(0.5, { colour: '#7fb8e6', bubbles: 'few' })])
    expect(layers(applyPreset(cloudy, 's', 'main', 0, preset('Black powder')))).toEqual([{ kind: 'powder', amount: 0.5, colour: '#5a5a5a' }])
  })
  it('a gas preset sends the layer to the top', () => {
    const doc = withSymbol('beaker', { main: [water(0.5), powder(0.2)] })
    expect(layers(applyPreset(doc, 's', 'main', 0, preset('Brown gas')))).toEqual([powder(0.2), { kind: 'gas', amount: 0.5, colour: '#cfa27a' }])
  })
})

describe('setFilled (the level handle)', () => {
  it('moves the top surface: only the top layer that is not a gas changes', () => {
    const doc = withSymbol('beaker', { main: [powder(0.2), water(0.3), gas()] })
    expect(layers(setFilled(doc, 's', 'main', 0.7))).toEqual([powder(0.2), water(0.5), gas()])
    expect(layers(setFilled(doc, 's', 'main', 0.1))).toEqual([powder(0.2), water(0), gas()])
    expect(layers(setFilled(doc, 's', 'main', 3))).toEqual([powder(0.2), water(0.8), gas()])
  })
  it('a cavity with no layer but a gas, or no layer at all, does not change', () => {
    const doc = withSymbol('beaker', { main: [gas()] })
    expect(setFilled(doc, 's', 'main', 0.5)).toBe(doc)
    expect(setFilled(doc, 's', 'jacket', 0.5)).toBe(doc)
  })
})

describe('the Reading field', () => {
  const cylinder = (contents: Record<string, Layer[]> = {}, patch: Partial<SymbolItem> = {}) => withSymbol('measuringCylinder', contents, patch)
  const g = (doc: Doc) => geometry(item(doc).symbol, item(doc).w, item(doc).h, item(doc).params)

  it('shows on a symbol with a scale when it is upright, and on a measuring cylinder upside down', () => {
    expect(readingMode(item(cylinder()))).toEqual({ kind: 'scale', cavity: 'main', unit: 'cm³', upsideDown: false, min: 0, max: 100 })
    expect(readingMode(item(cylinder({}, { params: { capacity: '250' } })))).toMatchObject({ max: 250 })
    expect(readingMode(item(cylinder({}, { rot: 180 })))).toMatchObject({ kind: 'scale', upsideDown: true })
    expect(readingMode(item(cylinder({}, { rot: 30 })))).toBeNull()
    expect(readingMode(item(cylinder({}, { flip: true })))).toBeNull()
    expect(readingMode(item(withSymbol('burette', {}, { rot: 180 })))).toBeNull()
    expect(readingMode(item(withSymbol('thermometer')))).toEqual({ kind: 'scale', cavity: 'main', unit: '°C', upsideDown: false, min: -10, max: 110 })
    expect(readingMode(item(withSymbol('beaker')))).toBeNull()
    expect(readingMode(item(withSymbol('gasSyringe', {}, { rot: 90 })))).toEqual({ kind: 'plunger', unit: 'cm³', min: 0, max: 100 })
  })
  it('puts water in an empty measuring cylinder and its surface at the reading (37)', () => {
    const doc = cylinder()
    expect(readingOf(item(doc))).toBeNull()
    const next = setReading(doc, 's', 37)
    const ls = layers(next)
    expect(ls).toHaveLength(1)
    expect(ls[0]).toMatchObject({ kind: 'liquid', colour: WATER })
    expect(amountToReading(g(next), ls[0].amount)).toBeCloseTo(37, 3)
    expect(readingOf(item(next))).toBeCloseTo(37, 3)
  })
  it('puts red liquid in an empty thermometer', () => {
    const next = setReading(withSymbol('thermometer'), 's', 25)
    expect(layers(next)).toEqual([{ kind: 'liquid', amount: layers(next)[0].amount, colour: THERMOMETER_RED }])
    expect(readingOf(item(next))).toBeCloseTo(25, 3)
  })
  it('sets the top layer that is not a gas to the reading less the layers below it', () => {
    const doc = cylinder({ main: [powder(0.1), water(0.2), gas()] })
    const next = setReading(doc, 's', 50)
    expect(layers(next)).toEqual([powder(0.1), water(readingToAmount(g(doc), 50)! - 0.1), gas()].map((l) => ({ ...l, amount: expect.closeTo(l.amount, 6) })))
    expect(readingOf(item(next))).toBeCloseTo(50, 3)
    const onlyGas = setReading(cylinder({ main: [gas()] }), 's', 40)
    expect(layers(onlyGas).map((l) => l.kind)).toEqual(['liquid', 'gas'])
    expect(readingOf(item(onlyGas))).toBeCloseTo(40, 3)
  })
  it('keeps the amount between 0 and 1', () => {
    const doc = cylinder({ main: [powder(0.3), water(0.2)] })
    expect(layers(setReading(doc, 's', 5))[1].amount).toBe(0)
    expect(filledAmount(layers(setReading(doc, 's', 1000)))).toBeLessThanOrEqual(1)
  })
  it('upside down, the reading is the volume of gas above the water', () => {
    const doc = cylinder({}, { rot: 180 })
    const next = setReading(doc, 's', 37)
    expect(layers(next)[0].amount).toBeCloseTo(readingToAmount(g(doc), 37, true)!, 6)
    expect(layers(next)[0].amount).toBeCloseTo(1 - readingToAmount(g(doc), 37)!, 6)
    expect(readingOf(item(next))).toBeCloseTo(37, 3)
  })
  it('moves the plunger of a gas syringe to the value ÷ 100', () => {
    const doc = withSymbol('gasSyringe')
    expect(readingOf(item(doc))).toBe(30)
    const next = setReading(doc, 's', 37)
    expect(item(next).params).toEqual({ plunger: 0.37 })
    expect(readingOf(item(next))).toBe(37)
    expect(item(setReading(next, 's', 30)).params).toEqual({})
    expect(item(setReading(doc, 's', 150)).params).toEqual({ plunger: 1 })
  })
  it('does nothing for a turned instrument, a symbol with no scale or a value that is not a number', () => {
    const turned = cylinder({}, { rot: 30 })
    expect(setReading(turned, 's', 37)).toBe(turned)
    const beaker = withSymbol('beaker')
    expect(setReading(beaker, 's', 37)).toBe(beaker)
    const doc = cylinder()
    expect(setReading(doc, 's', Number.NaN)).toBe(doc)
    expect(setReading(doc, 'l', 37)).toBe(doc)
  })
})
