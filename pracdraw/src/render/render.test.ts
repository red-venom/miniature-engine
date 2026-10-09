import { describe, expect, it } from 'vitest'
import type { Layer } from '../kernel/contents'
import type { GroupNode } from '../kernel/nodes'
import { DocBuilder } from '../model/build'
import { connectorNode, symbolNode } from './render'
import { DEFAULT_SETTINGS } from '../model/types'
import { pathPolys } from '../kernel/geom'

describe('the seed of bubbles, dots and lumps', () => {
  const layers: Layer[] = [
    { kind: 'lumps', amount: 0.1, colour: '#e9e9e9' },
    { kind: 'liquid', amount: 0.5, colour: '#cfe8f7', bubbles: 'many', cloudy: true },
  ]
  // The contents are the middle group of a symbol's node, drawn round the item's centre.
  const inside = (n: ReturnType<typeof symbolNode>) => JSON.stringify((n as GroupNode).kids[1])

  it('gives a copy with a new id the same drawing, so a label on a bubble still ends on it after an insert or a paste', () => {
    const b = new DocBuilder()
    const one = b.symbol('boilingTube', { contents: { main: layers } })
    const copy = { ...one, id: 'k3j9x2a1', x: one.x + 300 }
    expect(inside(symbolNode(copy, b.doc.settings))).toBe(inside(symbolNode(one, b.doc.settings)))
  })

  it('keeps the drawing when the item moves, and gives another size another pattern', () => {
    const b = new DocBuilder()
    const one = b.symbol('beaker', { contents: { main: layers } })
    expect(inside(symbolNode({ ...one, x: 40, y: -25 }, b.doc.settings))).toBe(inside(symbolNode(one, b.doc.settings)))
    expect(inside(symbolNode({ ...one, w: 130 }, b.doc.settings))).not.toBe(inside(symbolNode(one, b.doc.settings)))
  })
})

describe('a connector with no length', () => {
  it('draws nothing and never throws, whatever its kind and caps', () => {
    for (const kind of ['glassTube', 'rubberTube', 'wire', 'line'] as const) {
      const it = {
        id: 'c',
        type: 'connector' as const,
        kind,
        points: [
          { x: 5, y: 5 },
          { x: 5, y: 5, r: 12 },
          { x: 5, y: 5 },
        ],
        startCap: 'arrow' as const,
        endCap: 'tick' as const,
      }
      const n = connectorNode(it, DEFAULT_SETTINGS) as GroupNode
      expect(n.kids).toEqual([])
    }
  })
})

describe('photocopy-safe liquid', () => {
  const mono = { ...DEFAULT_SETTINGS, mono: true }
  const water = (amount: number): Layer[] => [{ kind: 'liquid', amount, colour: '#cfe8f7' }]
  /** The path strings of the contents of a symbol: the middle group of its node. */
  const paths = (n: ReturnType<typeof symbolNode>) => ((n as GroupNode).kids[1] as GroupNode).kids.flatMap((k) => (k.t === 'path' ? [k.d] : []))
  /** The lines of the contents that run straight up and down. */
  const upright = (ds: string[]) =>
    ds
      .flatMap((d) => pathPolys(d))
      .filter((poly) => poly.length > 1 && Math.abs(poly[0].x - poly[poly.length - 1].x) < 0.01 && Math.abs(poly[0].y - poly[poly.length - 1].y) > 20)

  it('gives the red thread of a thermometer a line down its centre, so that the reading survives', () => {
    const b = new DocBuilder()
    const t = b.symbol('thermometer', { contents: { main: water(0.6) } })
    expect(upright(paths(symbolNode(t, mono))).length).toBeGreaterThan(0)
  })

  it('gives the liquid of a burette, a measuring cylinder and a magnified scale its level only: no dashes between the ticks', () => {
    for (const id of ['burette', 'measuringCylinder', 'scaleWindow']) {
      const b = new DocBuilder()
      const it = b.symbol(id, { contents: { main: water(0.5) } })
      const ds = paths(symbolNode(it, mono))
      expect(
        ds.some((d) => /h7/.test(d)),
        id,
      ).toBe(false)
      expect(ds.length, id).toBeGreaterThan(0) // the surface line
    }
  })

  it('draws no centre line in the jet of a burette or the stem of a pipette, and keeps the dashes of an ordinary vessel', () => {
    const b = new DocBuilder()
    const burette = b.symbol('burette', { contents: { main: water(0.95) } })
    expect(upright(paths(symbolNode(burette, mono)))).toEqual([])
    const pipette = b.symbol('volumetricPipette', { contents: { main: water(0.9) } })
    expect(upright(paths(symbolNode(pipette, mono)))).toEqual([])
    const beaker = b.symbol('beaker', { contents: { main: water(0.5) } })
    expect(paths(symbolNode(beaker, mono)).some((d) => /h7/.test(d))).toBe(true)
  })
})
