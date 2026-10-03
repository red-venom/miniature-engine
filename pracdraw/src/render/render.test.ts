import { describe, expect, it } from 'vitest'
import type { Layer } from '../kernel/contents'
import type { GroupNode } from '../kernel/nodes'
import { DocBuilder } from '../model/build'
import { symbolNode } from './render'

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
