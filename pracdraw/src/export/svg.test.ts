import { describe, expect, it } from 'vitest'
import { demoDoc } from '../demo'
import { P } from '../kernel/geom'
import { svgDocument } from '../kernel/nodes'
import { DocBuilder } from '../model/build'
import { setSettings } from '../model/commands'
import { TEMPLATES } from '../templates'
import { DEFAULT_EXPORT, exportSvg, type ExportOptions } from './picture'
import { decodeEntities, docFromSvg, svgMetadata } from './svg'

const json = (d: unknown) => JSON.parse(JSON.stringify(d))

describe('decodeEntities', () => {
  it('turns the five XML references and numeric references back into characters, in one pass', () => {
    expect(decodeEntities('&lt;&gt;&amp;&quot;&apos;')).toBe(`<>&"'`)
    expect(decodeEntities('&amp;lt;')).toBe('&lt;')
    expect(decodeEntities('&#38;&#x26;&#x1F9EA;&#176;')).toBe('&&🧪°')
    expect(decodeEntities('a & b; &nbsp; &#x110000; &;')).toBe('a & b; &nbsp; &#x110000; &;')
    expect(decodeEntities('no references')).toBe('no references')
  })
})

describe('svgMetadata', () => {
  it('is the text of the first <metadata> element, found by string search', () => {
    expect(svgMetadata('<svg><metadata>{&quot;a&quot;:1}</metadata><metadata>2</metadata></svg>')).toBe('{"a":1}')
    expect(svgMetadata('<svg><metadata id="m1" >x &lt; y</metadata></svg>')).toBe('x < y')
    expect(svgMetadata('<svg>\n<metadata\n>multi\nline</metadata>')).toBe('multi\nline')
    expect(svgMetadata('<svg><metadata><![CDATA[a &lt; <b>]]> &amp; c</metadata></svg>')).toBe('a &lt; <b> & c')
    expect(svgMetadata('<svg><metadataX>1</metadataX></svg>')).toBeNull()
    expect(svgMetadata('<svg><metadata/></svg>')).toBe('')
    expect(svgMetadata('<svg><metadata>open')).toBeNull()
    expect(svgMetadata('<svg><path d="M0 0"/></svg>')).toBeNull()
  })
})

describe('docFromSvg', () => {
  it('runs without a DOM: no DOMParser here', () => {
    expect(typeof (globalThis as { DOMParser?: unknown }).DOMParser).toBe('undefined')
  })

  it("gives back the editor's document with its own settings, whatever the export drew", () => {
    const doc = setSettings(demoDoc(), { labelSize: 14, smartText: false })
    const all: Partial<ExportOptions>[] = [
      {},
      { labels: 'letters', mono: 'on', answerKey: true },
      { labels: 'blank', mono: 'off', background: 'transparent' },
      { labels: 'text', mono: 'on' },
    ]
    for (const o of all) {
      const r = docFromSvg(exportSvg(doc, { ...DEFAULT_EXPORT, format: 'svg', ...o }))
      expect(r).toEqual({ ok: true, doc: json(doc), problems: [] })
    }
  })

  it('every template comes back equal', () => {
    for (const t of TEMPLATES) {
      const doc = t.build()
      expect(docFromSvg(exportSvg(doc, { ...DEFAULT_EXPORT, format: 'svg' })), t.id).toEqual({ ok: true, doc: json(doc), problems: [] })
    }
  })

  it('keeps text that XML must escape, exactly', () => {
    const b = new DocBuilder('A < B & "C" > \'D\'')
    b.label('Fe^{3+} & SCN^- <=> [FeSCN]^{2+}', 0, 0, P(10, 10))
    b.label('</metadata> is safe', 0, 40)
    const r = docFromSvg(exportSvg(b.doc, { ...DEFAULT_EXPORT, format: 'svg' }))
    expect(r).toEqual({ ok: true, doc: json(b.doc), problems: [] })
  })

  it('lists the problems of what it reads, as parseDoc does', () => {
    const doc = json(demoDoc())
    doc.items[doc.order[0]].w = -1
    const r = docFromSvg(svgDocument([], 10, 10, undefined, JSON.stringify(doc)))
    expect(r.ok).toBe(true)
    expect(r.problems[0]).toBe(`Left out item "${doc.order[0]}" (${doc.items[doc.order[0]].symbol}): "w" must be a number above 0.`)
  })

  it('fails on an SVG that PracDraw did not make, or whose data is damaged', () => {
    expect(docFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>')).toEqual({
      ok: false,
      problems: ['The SVG file holds no PracDraw diagram: only an SVG that PracDraw exported can be opened.'],
    })
    expect(docFromSvg('<svg><metadata></metadata></svg>').ok).toBe(false)
    expect(docFromSvg('<svg><metadata>{"app":"pracdraw",</metadata></svg>')).toEqual({
      ok: false,
      problems: ['The PracDraw diagram in the SVG file is damaged.'],
    })
    expect(docFromSvg('<svg><metadata><rdf:RDF/></metadata></svg>').ok).toBe(false)
    expect(docFromSvg(svgDocument([], 10, 10, undefined, '{"app":"other"}'))).toEqual({ ok: false, problems: ['The file does not hold a PracDraw diagram.'] })
  })
})
