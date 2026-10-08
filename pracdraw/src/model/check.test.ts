import { describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { TEMPLATES } from '../templates'
import { DocBuilder } from './build'
import { checkDoc, describeDoc } from './check'
import type { Doc, LabelItem } from './types'

/** Templates that have a real fault, each with the reason. A template that is not here must pass every check. */
const ALLOWED: Record<string, string> = {}

const messages = (doc: Doc, measure?: (text: string, size: number) => number) => checkDoc(doc, measure).map((p) => p.message)

/**
 * Two beakers with a label on the right of each. The upper text points at the lower part of the left beaker and the lower
 * text at the upper part of the right one, so that the two leaders cross.
 */
function crossing(swap = false): Doc {
  const b = new DocBuilder('Crossing leaders')
  const left = b.symbol('beaker', { x: 0, y: 0 })
  const right = b.symbol('beaker', { x: 200, y: 0 })
  b.label('left beaker', 320, swap ? 50 : -50, [left, 30, 110], { side: 'right' })
  b.label('right beaker', 320, swap ? -50 : 50, [right, -30, 10], { side: 'right' })
  return b.doc
}

describe('checkDoc', () => {
  it('all-templates-pass-the-checks', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(43)
    for (const t of TEMPLATES) {
      if (ALLOWED[t.id]) continue
      expect(
        checkDoc(t.build()).map((p) => `${t.id}: ${p.message}`),
        t.id,
      ).toEqual([])
    }
    // An allowed template must still be a template, and have the reason written down.
    for (const [id, reason] of Object.entries(ALLOWED)) {
      expect(TEMPLATES.some((t) => t.id === id)).toBe(true)
      expect(reason.length).toBeGreaterThan(10)
    }
  })

  it('check-finds-crossing-leaders', () => {
    const problems = checkDoc(crossing())
    expect(problems).toEqual([
      {
        level: 'warning',
        path: 'label3',
        message: 'The leaders of the labels "left beaker" and "right beaker" cross.',
        hint: 'Swap the heights of the two texts, or put one of them on the other side of the diagram, so that the two lines do not cross.',
      },
    ])
    // The same labels with their heights swapped do not cross.
    expect(checkDoc(crossing(true))).toEqual([])
  })

  it('finds a text that runs into a part other than the one it names', () => {
    const doc = crossing(true)
    const l = Object.values(doc.items).find((it): it is LabelItem => it.type === 'label' && it.text === 'right beaker')!
    // Its text goes over the left beaker: x from -40 to the right, level with its middle.
    doc.items[l.id] = { ...l, x: -40, y: -10, side: 'right' }
    const problems = checkDoc(doc)
    expect(problems.map((p) => p.message)).toContain('The label "right beaker" runs into the part "beaker1" (as text and as the line to write on).')
    const found = problems.find((p) => p.message.includes('runs into'))!
    expect(found.level).toBe('warning')
    expect(found.hint).toContain('textAt')
  })

  it('does not count the part that a label names', () => {
    const b = new DocBuilder('Own part')
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    // The text stands inside the beaker that it names, and nothing else is there.
    b.label('beaker', -30, 0, [beaker, 50, 60], { side: 'right' })
    expect(checkDoc(b.doc)).toEqual([])
  })

  it('finds the line to write on running into a part when the text alone does not', () => {
    const b = new DocBuilder('Blank rule')
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    const other = b.symbol('beaker', { x: 220, y: 0 })
    // "a" is 8 u wide; the 100 u line of blank mode reaches the second beaker, which starts at x = 170.
    b.label('a', 100, 0, [beaker, 50, 60], { side: 'right' })
    expect(checkDoc(b.doc).map((p) => p.message)).toEqual([`The label "a" runs into the part "${other.id}" (as the line to write on).`])
  })

  it('finds two texts that overlap', () => {
    const b = new DocBuilder('Texts')
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    b.label('first text', 100, 0, [beaker, 50, 60], { side: 'right' })
    b.label('second text', 130, 8, [beaker, 50, 40], { side: 'right' })
    expect(messages(b.doc).filter((m) => m.includes('overlap'))).toEqual(['The texts of the labels "first text" and "second text" overlap (as text).'])
  })

  it('measures text with the function it is given', () => {
    const b = new DocBuilder('Measure')
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    b.label('one', 100, 0, [beaker, 50, 60], { side: 'right' })
    b.label('two', 160, 0, [beaker, 50, 40], { side: 'right' })
    expect(messages(b.doc)).toEqual([]) // 3 characters at 15 u: about 25 u wide, so the texts are 35 u apart
    expect(messages(b.doc, () => 80).length).toBeGreaterThan(0) // 80 u wide: they overlap
  })

  it('finds a symbol that failed to build, and a connector that draws nothing', () => {
    const b = new DocBuilder('Faults')
    b.symbol('beaker', { x: 0, y: 0 })
    const doc: Doc = { ...b.doc, items: { ...b.doc.items }, order: [...b.doc.order] }
    doc.items.ghost = { id: 'ghost', type: 'symbol', symbol: 'fromTheFuture', x: 200, y: 0, rot: 0, flip: false, w: 50, h: 50, params: {}, contents: {} }
    doc.items.dot = { id: 'dot', type: 'connector', kind: 'glassTube', points: [P(0, 0), P(0, 0)], startCap: 'none', endCap: 'none' }
    doc.order.push('ghost', 'dot')
    expect(checkDoc(doc)).toEqual([
      {
        level: 'warning',
        path: 'ghost',
        message: 'The part "ghost" has an unknown symbol "fromTheFuture": it is drawn as a dashed box.',
        hint: 'Use a symbol id from the list: npm run render -- --list symbols',
      },
      {
        level: 'warning',
        path: 'dot',
        message: 'The connector "dot" has all its points in one place, so nothing is drawn.',
        hint: 'Give it two points that are apart.',
      },
    ])
  })

  it('finds a leader that ends in empty space', () => {
    const b = new DocBuilder('Empty space')
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    b.label('beaker', 150, 0, [beaker, 150, 60], { side: 'right' }) // 100 u to the right of the beaker, on nothing
    const problems = checkDoc(b.doc)
    expect(problems).toHaveLength(1)
    // 100 u from the wall's middle line, so 99 u from its edge.
    expect(problems[0].message).toBe('The leader of the label "beaker" ends in empty space, 99 u from the nearest drawing.')
    expect(problems[0].hint).toContain('"at"')
  })

  it('finds a clamp that is drawn in front of the vessel it grips', () => {
    const build = (clampFirst: boolean) => {
      const b = new DocBuilder('Clamp')
      const burette = b.symbol('burette', { x: 0, y: 0 })
      const clamp = b.on('bossClamp', 'grip', burette, 'neck', { params: { grip: 18 } })
      if (clampFirst) b.doc.order = [clamp.id, burette.id]
      return { doc: b.doc, clamp, burette }
    }
    const front = build(false)
    expect(checkDoc(front.doc).map((p) => p.message)).toEqual([
      `The clamp "${front.clamp.id}" is drawn in front of "${front.burette.id}", which it grips: its jaws would cross the glass.`,
    ])
    expect(checkDoc(build(true).doc)).toEqual([])
  })
})

describe('describeDoc', () => {
  it('describes the title, the picture, each part, connector and label, and the checks', () => {
    const doc = TEMPLATES.find((t) => t.id === 'rateGasOverWater')!.build()
    const text = describeDoc(doc)
    const lines = text.split('\n')
    expect(lines[0]).toBe('Rate of reaction: gas collected over water')
    expect(lines[1]).toMatch(/^picture \d+ × \d+ u \(x -?\d+\.\.-?\d+, y -?\d+\.\.-?\d+, with a 16 u margin\); labels: text; photocopy-safe: off$/)
    for (const it of Object.values(doc.items)) {
      if (it.type === 'symbol') expect(text, it.id).toContain(`  ${it.id}  ${it.symbol}  `)
    }
    expect(text).toContain('anchors base(')
    expect(text).toContain('connectors (1):')
    expect(text).toMatch(/glassTube, width 7 {2}\(/)
    expect(text).toContain('labels (')
    expect(text).toContain('"trough of water"  leader to trough')
    expect(lines[lines.length - 1]).toBe('checks: no layout faults')
    // A measuring cylinder holds a reading, and the description says it.
    expect(text).toContain('reading 34 cm³')
  })

  it('lists the warnings, and more of each anchor when verbose', () => {
    const doc = crossing()
    const text = describeDoc(doc)
    expect(text).toContain('checks: 1 warning')
    expect(text).toContain('  1. The leaders of the labels "left beaker" and "right beaker" cross.')
    expect(text).toContain('anchors base(0, 60)  mouth(0, -60)  rim(0, -60)')
    const verbose = describeDoc(doc, { verbose: true })
    expect(verbose).toContain('base[base, 90°]@(0, 60)')
    expect(verbose).toContain('mouth[mouth, -90°]@(0, -60)')
  })

  it('gives the same text for the same diagram', () => {
    const doc = TEMPLATES.find((t) => t.id === 'titration')!.build()
    expect(describeDoc(doc)).toBe(describeDoc(JSON.parse(JSON.stringify(doc))))
  })
})
