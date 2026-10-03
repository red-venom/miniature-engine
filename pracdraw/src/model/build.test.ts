import { describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { svgDocument } from '../kernel/nodes'
import { demoDoc } from '../demo'
import { docNodes, estimateBounds, labelLetters, letterFor, resolveTarget } from '../render/render'
import { DocBuilder, anchorWorld, moveAnchorTo } from './build'
import { toLocal, toWorld } from './transform'

describe('anchors', () => {
  it('puts an anchor on a world point, for any rotation and flip', () => {
    for (const [rot, flip] of [
      [0, false],
      [90, false],
      [180, true],
      [33, true],
    ] as const) {
      const b = new DocBuilder()
      const it = b.symbol('conicalFlask', { rot, flip })
      moveAnchorTo(it, 'mouth', P(300, 200))
      const w = anchorWorld(it, 'mouth')
      expect(w.x).toBeCloseTo(300, 6)
      expect(w.y).toBeCloseTo(200, 6)
    }
  })
  it('stacks parts: mat, tripod, gauze, beaker', () => {
    const b = new DocBuilder()
    const mat = b.at('heatproofMat', 'under', P(0, 0))
    const tripod = b.on('tripod', 'feet', mat, 'top')
    const gauze = b.on('gauze', 'under', tripod, 'top')
    const beaker = b.on('beaker', 'base', gauze, 'top')
    expect(anchorWorld(beaker, 'base').y).toBeCloseTo(-(8 + 110 + 5), 6)
    expect(beaker.x).toBeCloseTo(0, 6)
  })
  it('puts a symbol that has no anchor near an anchor of another item', () => {
    const b = new DocBuilder()
    const flask = b.at('conicalFlask', 'base', P(100, 300))
    const tube = b.near('testTube', flask, 'mouth', { dx: 80, dy: 10 })
    const mouth = anchorWorld(flask, 'mouth')
    expect([tube.x, tube.y]).toEqual([mouth.x + 80, mouth.y + 10])
  })
  it('converts world ↔ local', () => {
    const b = new DocBuilder()
    const it = b.symbol('beaker', { x: 40, y: -20, rot: 70, flip: true })
    const p = toLocal(it, toWorld(it, P(12, 34)))
    expect(p.x).toBeCloseTo(12, 6)
    expect(p.y).toBeCloseTo(34, 6)
  })
})

describe('labels', () => {
  it('a label attached to an item follows it', () => {
    const b = new DocBuilder()
    const flask = b.symbol('conicalFlask', { x: 100, y: 100 })
    const label = b.label('conical flask', 250, 100, [flask, 20, 75])
    const before = resolveTarget(b.doc, label.target!)!
    flask.x += 30
    const after = resolveTarget(b.doc, label.target!)!
    expect(after.x - before.x).toBeCloseTo(30, 6)
    expect(label.side).toBe('right')
  })
  it('letters labels A, B … Z, AA', () => {
    expect([0, 1, 25, 26, 27].map(letterFor)).toEqual(['A', 'B', 'Z', 'AA', 'AB'])
  })
  it('switches label modes', () => {
    const doc = demoDoc()
    const text = svgDocument(docNodes(doc), 1000, 800)
    expect(text).toContain('delivery tube')
    doc.settings.labelMode = 'blank'
    const blank = svgDocument(docNodes(doc), 1000, 800)
    expect(blank).not.toContain('delivery tube')
    expect(blank).toContain('Cu') // plain text with no leader stays
    doc.settings.labelMode = 'letters'
    const letters = svgDocument(docNodes(doc), 1000, 800)
    expect(letters).toContain('>A<')
    expect(labelLetters(doc).size).toBeGreaterThan(10)
  })
})

describe('connectors and shapes', () => {
  it('draws wires, lines with caps, dashed lines and shapes as plain paths', () => {
    const b = new DocBuilder()
    b.connector('wire', [P(0, 0), P(40, 0), P(40, 30)])
    b.connector('line', [P(0, 50), P(80, 50)], { startCap: 'tick', endCap: 'arrow', dash: true })
    b.connector('line', [P(0, 70), P(80, 70)], { startCap: 'dot', endCap: 'tick' })
    b.connector('glassTube', [P(0, 90), P(60, 90)], { endCap: 'closed' })
    b.doc.items.s1 = { id: 's1', type: 'shape', shape: 'rect', x: 20, y: 120, w: 40, h: 20, rot: 15, fill: 'grey', dash: false }
    b.doc.items.s2 = { id: 's2', type: 'shape', shape: 'ellipse', x: 80, y: 120, w: 40, h: 20, rot: 0, fill: 'none', dash: true }
    b.doc.order.push('s1', 's2')
    const svg = svgDocument(docNodes(b.doc), 100, 140)
    expect(svg).not.toMatch(/NaN|undefined/)
    expect(svg.match(/<path/g)!.length).toBeGreaterThanOrEqual(10)
    expect(svg).toContain('stroke-dasharray="6 4"')
  })
})

describe('bounds', () => {
  it('cover the label as its mode draws it', () => {
    const b = new DocBuilder()
    const mat = b.at('heatproofMat', 'under', P(0, 0))
    b.label('mat', 120, -4, [mat, 80, 4])
    const right = (mode: 'text' | 'blank' | 'letters') => {
      b.doc.settings.labelMode = mode
      const r = estimateBounds(b.doc, 0)
      return r.x + r.w
    }
    expect(right('blank')).toBeCloseTo(120 + 100, 6) // the whole line to write on
    expect(right('text')).toBeLessThan(right('blank'))
    expect(right('letters')).toBeLessThan(right('text'))
    expect(right('letters')).toBeGreaterThan(120)
  })
})

describe('files from elsewhere', () => {
  it('draws an unknown symbol as a dashed box, with bounds', () => {
    const b = new DocBuilder()
    b.symbol('beaker', { x: 0, y: 0 })
    b.doc.items.x1 = { id: 'x1', type: 'symbol', symbol: 'fromTheFuture', x: 200, y: 0, rot: 20, flip: false, w: 80, h: 60, params: {}, contents: { main: [] } }
    b.doc.order.push('x1')
    const svg = svgDocument(docNodes(b.doc), 400, 200)
    expect(svg).toContain('fromTheFuture')
    expect(svg).toContain('stroke-dasharray')
    const r = estimateBounds(b.doc, 0)
    expect(r.x + r.w).toBeGreaterThan(230)
  })
  it('cannot break out of an SVG attribute', () => {
    const b = new DocBuilder()
    b.symbol('beaker', { contents: { main: [{ kind: 'liquid', amount: 0.5, colour: '#fff"/><script>alert(1)</script><path fill="' }] } })
    const svg = svgDocument(docNodes(b.doc), 200, 200, '#fff"><script>')
    expect(svg).not.toContain('<script>')
    expect(svg.match(/<path/g)!.length).toBe(svg.match(/<path [^<>]*\/>/g)!.length) // every path is still one well-formed tag
  })
})

describe('demo document', () => {
  it('fits its page and renders as plain SVG', () => {
    const doc = demoDoc()
    const b = estimateBounds(doc, 0)
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.y).toBeGreaterThanOrEqual(0)
    expect(b.x + b.w).toBeLessThanOrEqual(1000)
    expect(b.y + b.h).toBeLessThanOrEqual(800)
    const svg = svgDocument(docNodes(doc), 1000, 800, '#ffffff')
    expect(svg).not.toMatch(/NaN|undefined/)
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc) // the document is plain JSON
  })
})
