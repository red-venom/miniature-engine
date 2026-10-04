import { describe, expect, it } from 'vitest'
import type { Layer } from '../kernel/contents'
import type { GroupNode } from '../kernel/nodes'
import { DocBuilder } from '../model/build'
import { connectorNode, symbolNode } from './render'
import { DEFAULT_SETTINGS } from '../model/types'

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
