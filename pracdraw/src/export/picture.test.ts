import { describe, expect, it } from 'vitest'
import { demoDoc } from '../demo'
import { P } from '../kernel/geom'
import type { GroupNode, Node } from '../kernel/nodes'
import { docBounds, drawnBox, estimateWidth, type Measure } from '../model/bounds'
import { DocBuilder } from '../model/build'
import { setSettings } from '../model/commands'
import type { Doc, SymbolItem } from '../model/types'
import { answerKey } from './answerKey'
import { DEFAULT_EXPORT, WHITE, diagramNodes, exportDoc, exportLabelMode, exportPicture, exportSvg, showsKey, type ExportOptions } from './picture'

const opts = (o: Partial<ExportOptions> = {}): ExportOptions => ({ ...DEFAULT_EXPORT, ...o })
const kids = (n: Node) => (n as GroupNode).kids
/** The document JSON in an SVG file, read back with a plain regular expression. */
const metadataOf = (svg: string) =>
  JSON.parse(/<metadata>([\s\S]*)<\/metadata>/.exec(svg)![1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
const drawingOf = (svg: string) => svg.replace(/<metadata>[\s\S]*<\/metadata>/, '')

function keyDoc(): Doc {
  const b = new DocBuilder('Key')
  const flask = b.symbol('conicalFlask', { x: 100, y: 100 })
  b.label('conical flask', 0, 80, [flask, -40, 100])
  b.label('a title', 100, -20)
  return b.doc
}

describe('the export options', () => {
  it('the default is PNG at 2×, on white, labels and photocopy-safe as shown, no answer key', () => {
    expect(DEFAULT_EXPORT).toEqual({ format: 'png', scale: 2, background: 'white', labels: 'shown', answerKey: false, mono: 'shown' })
    expect(WHITE).toBe('#ffffff')
  })

  it("override the document's label mode and photocopy-safe setting; as shown keeps them; the document is not changed", () => {
    const doc = setSettings(demoDoc(), { labelMode: 'blank', mono: true })
    expect(exportDoc(doc, { labels: 'shown', mono: 'shown' })).toBe(doc)
    expect(exportDoc(doc, { labels: 'blank', mono: 'on' })).toBe(doc)
    const over = exportDoc(doc, { labels: 'letters', mono: 'off' })
    expect(over.settings).toEqual({ ...doc.settings, labelMode: 'letters', mono: false })
    expect(over.items).toBe(doc.items)
    expect(doc.settings).toMatchObject({ labelMode: 'blank', mono: true })
    expect(exportLabelMode(doc, { labels: 'shown' })).toBe('blank')
    expect(exportLabelMode(doc, { labels: 'text' })).toBe('text')
  })

  it('the answer key shows only in letters', () => {
    const doc = keyDoc()
    expect(showsKey(doc, { labels: 'letters', answerKey: true })).toBe(true)
    expect(showsKey(doc, { labels: 'letters', answerKey: false })).toBe(false)
    expect(showsKey(doc, { labels: 'blank', answerKey: true })).toBe(false)
    expect(showsKey(doc, { labels: 'shown', answerKey: true })).toBe(false)
    expect(showsKey(setSettings(doc, { labelMode: 'letters' }), { labels: 'shown', answerKey: true })).toBe(true)
  })
})

describe('exportPicture', () => {
  it('is the diagram cropped to docBounds, rounded out to whole units, with its corner at the origin', () => {
    const doc = demoDoc()
    const measure: Measure = (t, s) => estimateWidth(t, s) * 0.9
    for (const labels of ['text', 'blank', 'letters'] as const) {
      const p = exportPicture(doc, opts({ labels }), measure)
      const b = docBounds(exportDoc(doc, { labels, mono: 'shown' }), measure)
      expect(p.x).toBe(Math.floor(b.x))
      expect(p.y).toBe(Math.floor(b.y))
      expect(p.w).toBe(Math.ceil(b.x + b.w) - Math.floor(b.x))
      expect(p.h).toBe(Math.ceil(b.y + b.h) - Math.floor(b.y))
      expect(Number.isInteger(p.w) && Number.isInteger(p.h)).toBe(true)
      expect(p.nodes).toHaveLength(1)
      expect((p.nodes[0] as GroupNode).m).toEqual([1, 0, 0, 1, -p.x, -p.y])
      expect(kids(p.nodes[0])).toEqual(diagramNodes(exportDoc(doc, { labels, mono: 'shown' })))
    }
    // The label mode changes the box: a 100 u line is not as wide as some texts.
    expect(exportPicture(doc, opts({ labels: 'blank' })).w).not.toBe(exportPicture(doc, opts({ labels: 'text' })).w)
  })

  it('an empty diagram is a small blank picture', () => {
    const p = exportPicture(new DocBuilder().doc, DEFAULT_EXPORT)
    expect(p).toMatchObject({ x: -16, y: -16, w: 32, h: 32 })
  })

  it('adds the answer key under the diagram when it is on and the labels are letters, and makes room for it', () => {
    const doc = keyDoc()
    const off = exportPicture(doc, opts({ labels: 'letters' }))
    const on = exportPicture(doc, opts({ labels: 'letters', answerKey: true }))
    const letters = exportDoc(doc, { labels: 'letters', mono: 'shown' })
    const key = answerKey(letters, drawnBox(letters, estimateWidth)!, estimateWidth)!
    expect(kids(on.nodes[0])).toEqual([...diagramNodes(letters), ...key.nodes])
    expect(kids(off.nodes[0])).toEqual(diagramNodes(letters))
    expect(on.y).toBe(off.y)
    expect(on.y + on.h).toBe(Math.ceil(key.box.y1 + 16))
    expect(on.h).toBeGreaterThan(off.h + 24)
    // Not in text or blank mode, even when it is on.
    expect(exportPicture(doc, opts({ labels: 'blank', answerKey: true }))).toEqual(exportPicture(doc, opts({ labels: 'blank' })))
  })

  it('draws an item that cannot be drawn as nothing, and labels after everything else', () => {
    const b = new DocBuilder()
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    b.label('beaker', 100, 0, [beaker, 50, 50])
    b.connector('wire', [P(0, 0), P(10, 0)])
    b.doc.items.bad = { ...beaker, id: 'bad', contents: { main: 'not layers' } } as unknown as SymbolItem
    b.doc.order.push('bad')
    const nodes = diagramNodes(b.doc)
    expect(nodes.map((n) => (n as GroupNode).key)).toEqual(['beaker1', 'wire3', 'bad', 'label2'])
    expect(kids(nodes[2])).toEqual([])
  })
})

describe('exportSvg', () => {
  it("holds the editor's document, without the dialog's overrides, and draws the overrides", () => {
    const doc = demoDoc()
    const svg = exportSvg(doc, opts({ format: 'svg', labels: 'letters', mono: 'on', answerKey: true }))
    expect(metadataOf(svg)).toEqual(JSON.parse(JSON.stringify(doc)))
    expect(metadataOf(svg).settings).toEqual(doc.settings)
    const drawing = drawingOf(svg)
    expect(drawing).toContain('>A</tspan>')
    expect(drawing).not.toContain('#cfe8f7') // photocopy-safe: no tints
    expect(drawing).toContain('dilute HCl(aq)') // the answer key lists the label texts
    expect(drawingOf(exportSvg(doc, opts({ format: 'svg' })))).toContain('#cfe8f7')
  })

  it('is plain SVG at the size of the picture, on white or transparent', () => {
    const doc = demoDoc()
    const p = exportPicture(doc, DEFAULT_EXPORT)
    const white = exportSvg(doc, opts({ format: 'svg' }))
    expect(white.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}" viewBox="0 0 ${p.w} ${p.h}"><metadata>`)).toBe(true)
    expect(white).toContain(`<path d="M0 0H${p.w}V${p.h}H0Z" fill="#ffffff"/>`)
    const clear = exportSvg(doc, opts({ format: 'svg', background: 'transparent' }))
    expect(clear).not.toContain('fill="#ffffff"/><g')
    expect(clear).not.toContain(`H${p.w}V${p.h}H0Z`)
    for (const svg of [white, clear]) {
      expect(svg).not.toMatch(/<(clipPath|mask|pattern|filter|foreignObject|use|style|image|defs)\b/)
      expect(svg).not.toMatch(/ (class|style)=/)
      expect(svg.match(/<metadata>/g)).toHaveLength(1)
    }
  })
})
