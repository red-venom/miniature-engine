import { describe, expect, it } from 'vitest'
import { demoDoc } from '../demo'
import { P } from '../kernel/geom'
import { toSvg, type GroupNode, type TextNode } from '../kernel/nodes'
import { docBox, estimateWidth } from '../model/bounds'
import { DocBuilder } from '../model/build'
import { reorderItems, setSettings } from '../model/commands'
import type { Doc } from '../model/types'
import { labelLetters } from '../render/render'
import { KEY_GAP, KEY_LINE, KEY_SPACE, answerKey, answerKeyLines } from './answerKey'

const texts = (nodes: { nodes: unknown[] }) => (nodes.nodes[0] as GroupNode).kids as TextNode[]
const shown = (t: TextNode) => t.runs.map((r) => r.text).join('')

function small(): Doc {
  const b = new DocBuilder('Key')
  const flask = b.symbol('conicalFlask', { x: 100, y: 100 })
  const beaker = b.symbol('beaker', { x: 300, y: 100 })
  b.label('conical flask', 0, 80, [flask, -40, 100])
  b.label('a title', 100, -20) // plain text: no letter
  b.label('250 cm3\n  beaker', 420, 80, [beaker, 50, 60])
  b.label('CO2', 200, 250, P(200, 150), { side: 'right' })
  return setSettings(b.doc, { labelMode: 'letters' })
}

describe('answerKeyLines', () => {
  it('one line for each letter in draw order: the letter and the label text on one line', () => {
    expect(answerKeyLines(small())).toEqual([
      { letter: 'A', text: 'conical flask', smart: true },
      { letter: 'B', text: '250 cm3 beaker', smart: true },
      { letter: 'C', text: 'CO2', smart: true },
    ])
  })
  it('follows the draw order of the labels, which sets their letters', () => {
    const doc = reorderItems(small(), ['label3'], 'back')
    expect(answerKeyLines(doc).map((l) => `${l.letter}  ${l.text}`)).toEqual(['A  conical flask', 'B  250 cm3 beaker', 'C  CO2'])
    const moved = reorderItems(small(), ['label6'], 'back')
    expect(answerKeyLines(moved).map((l) => `${l.letter}  ${l.text}`)).toEqual(['A  CO2', 'B  conical flask', 'C  250 cm3 beaker'])
    expect(answerKeyLines(moved).map((l) => l.letter)).toEqual([...labelLetters(moved).values()])
  })
  it('a label with its own smart-text setting keeps it', () => {
    const doc = small()
    doc.items.label6 = { ...doc.items.label6, smart: false } as Doc['items'][string]
    expect(answerKeyLines(doc)[2].smart).toBe(false)
  })
})

describe('answerKey', () => {
  it('lists the lines at the label size with 1.25 line spacing, 24 u below the diagram, at its left edge', () => {
    const doc = small()
    const diagram = docBox(doc)!
    const key = answerKey(doc, diagram)!
    const kids = texts(key)
    expect(kids).toHaveLength(6)
    const size = doc.settings.labelSize
    const column = diagram.x0 + estimateWidth('A', size) + KEY_SPACE * size
    kids.forEach((t, i) => {
      const line = Math.floor(i / 2)
      expect(t).toMatchObject({ t: 'text', size, anchor: 'start', fill: '#111111' })
      // The top of the first line is 24 u below the diagram: its baseline is one size lower.
      expect(t.y).toBeCloseTo(diagram.y1 + KEY_GAP + size + line * KEY_LINE * size, 9)
      expect(t.x).toBeCloseTo(i % 2 ? column : diagram.x0, 9)
    })
    expect(kids.filter((_, i) => i % 2 === 0).map(shown)).toEqual(['A', 'B', 'C'])
    expect(kids.filter((_, i) => i % 2 === 1).map(shown)).toEqual(['conical flask', '250 cm3 beaker', 'CO2'])
    expect(key.box.x0).toBe(diagram.x0)
    expect(key.box.y0).toBe(diagram.y1 + KEY_GAP)
    expect(key.box.y1).toBeCloseTo(kids[4].y + 0.3 * size, 9)
    // The widest line as drawn: smart text makes "cm3" into cm³, whose 3 is drawn at 0.7 size.
    expect(key.box.x1).toBeCloseTo(column + estimateWidth('250 cm^3 beaker', size), 9)
    expect(estimateWidth('250 cm^3 beaker', size)).toBeCloseTo(13.7 * 0.56 * size, 9)
  })
  it('draws the text as the labels do: smart text adds the markup', () => {
    const kids = texts(answerKey(small(), { x0: 0, y0: 0, x1: 100, y1: 100 })!)
    expect(kids[3].runs).toEqual([
      { text: '250 cm', script: 'normal' },
      { text: '3', script: 'sup' },
      { text: ' beaker', script: 'normal' },
    ])
    expect(kids[5].runs).toEqual([
      { text: 'CO', script: 'normal' },
      { text: '2', script: 'sub' },
    ])
    const plain = texts(answerKey(setSettings(small(), { smartText: false }), { x0: 0, y0: 0, x1: 100, y1: 100 })!)
    expect(plain[5].runs).toEqual([{ text: 'CO2', script: 'normal' }])
  })
  it('follows the label size and the measure it is given', () => {
    const doc = setSettings(small(), { labelSize: 20 })
    const measure = (text: string, size: number) => text.length * size * 0.5
    const key = answerKey(doc, { x0: 10, y0: 0, x1: 300, y1: 200 }, measure)!
    const kids = texts(key)
    expect(kids[0]).toMatchObject({ x: 10, y: 200 + 24 + 20, size: 20 })
    expect(kids[2].y - kids[0].y).toBeCloseTo(25, 9)
    expect(kids[1].x).toBeCloseTo(10 + 10 + 12, 9)
  })
  it('is null when no label has a leader', () => {
    const b = new DocBuilder()
    b.symbol('beaker', { x: 0, y: 0 })
    b.label('just text', 0, 100)
    expect(answerKey(b.doc, { x0: 0, y0: 0, x1: 1, y1: 1 })).toBeNull()
  })
  it('lists every lettered label of the reference picture, in plain SVG', () => {
    const doc = setSettings(demoDoc(), { labelMode: 'letters' })
    const key = answerKey(doc, docBox(doc)!)!
    const letters = labelLetters(doc)
    expect(key.lines.map((l) => l.letter)).toEqual([...letters.values()])
    expect(key.lines[0]).toEqual({ letter: 'A', text: 'dilute HCl(aq)', smart: true })
    // The key sits below everything that is drawn.
    expect(key.box.y0).toBeGreaterThan(docBox(doc)!.y1)
    const svg = toSvg(key.nodes[0])
    expect(svg).not.toMatch(/<(clipPath|mask|pattern|filter|use|style|image|defs)\b/)
    expect((svg.match(/<text /g) ?? []).length).toBe(2 * letters.size)
  })
})
