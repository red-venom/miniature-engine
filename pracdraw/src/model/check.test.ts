import { describe, expect, it } from 'vitest'
import { exportPicture } from '../export/picture'
import { P } from '../kernel/geom'
import { TEMPLATES } from '../templates'
import { estimateWidth, type Measure } from './bounds'
import { DocBuilder } from './build'
import { MAX_LISTED, checkDoc, describeDoc, listed, measuredTexts } from './check'
import type { Doc, SymbolItem } from './types'

/** The part of a message that says a label is wider than the line of blank mode. */
const LONG = 'the line to write on in blank mode is'
const isLong = (message: string): boolean => message.includes(LONG)

/**
 * The templates are slide diagrams: their labels are the textbook names ("round-bottomed flask"), and the line that blank
 * mode draws is 100 u. By the estimate of the unit tests (0.56 × the size for each character) this is how many labels of
 * each template are wider than that line; the render command measures the real text, which is narrower (60 labels in 35
 * templates). The warning is true for a worksheet made from a template, so it stays, and this list pins it: a template
 * that gains or loses a long label, or a new template with one, fails the test until the list says so.
 */
const LONG_LABELS: Record<string, number> = {
  heatingBeaker: 2,
  filtration: 3,
  crystallisation: 4,
  electrolysis: 2,
  electrolysisBeaker: 3,
  temperatureChange: 1,
  rateGasSyringe: 3,
  rateGasOverWater: 5,
  disappearingCross: 3,
  paperChromatography: 2,
  simpleDistillation: 5,
  distillation: 4,
  titration: 2,
  flameTest: 3,
  standardSolution: 2,
  spiritBurnerCalorimetry: 2,
  reflux: 6,
  separatingFunnelUse: 3,
  buchnerFiltration: 3,
  meltingPoint: 4,
  tlc: 1,
  electrochemicalCell: 2,
  phCurve: 1,
  massLoss: 5,
  testTubeReactions: 2,
  thermalDecomposition: 6,
  microscopeParts: 3,
  osmosis: 3,
  foodTestWaterBath: 3,
  enzymes: 4,
  photosynthesis: 2,
  quadratSampling: 2,
  specificHeatCapacity: 3,
  resistanceWire: 1,
  ivCharacteristic: 2,
  densityDisplacement: 4,
  densityLiquid: 2,
  springExtension: 2,
  acceleration: 1,
  wavesOnString: 4,
  infraredRadiation: 2,
}

/**
 * Leaders of the templates that cross another part from side to side, kept as the editor draws them: each reaches a part
 * that stands behind a rod or a rack post (the stand's rod, the end post of a test-tube rack). The real fault is in the
 * template, which the lead owns; the check is right, and these are the only ones.
 */
const LEADER_ACROSS: Record<string, string[]> = {
  testTubeReactions: ['The leader of the label "precipitate" crosses part "testTubeRack1", and the label names "testTube2".'],
  thermalDecomposition: [
    'The leader of the label "clamp" crosses part "clampStand1", and the label names "bossClamp6".',
    'The leader of the label "limewater" crosses part "testTubeRack7", and the label names "testTube8".',
  ],
}

const messages = (doc: Doc, measure?: Measure) => checkDoc(doc, measure).map((p) => p.message)

/**
 * A beaker with two labels on its right. The upper text points at the lower part of the wall and the lower text at the
 * upper part, so that the two leaders cross. Swapped, they do not.
 */
function crossing(swap = false): Doc {
  const b = new DocBuilder('Crossing leaders')
  const beaker = b.symbol('beaker', { x: 0, y: 0 })
  b.label('upper text', 200, swap ? 40 : -40, [beaker, 50, 90], { side: 'right' })
  b.label('lower text', 200, swap ? -40 : 40, [beaker, 50, 30], { side: 'right' })
  return b.doc
}

describe('checkDoc', () => {
  it('all-templates-pass-the-checks', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(43)
    for (const t of TEMPLATES) {
      const found = checkDoc(t.build())
      // A long label is allowed, with the count that the list says; a leader across a part only where the list says.
      expect(found.filter((p) => isLong(p.message)).length, `${t.id}: labels wider than the line`).toBe(LONG_LABELS[t.id] ?? 0)
      const rest = found.filter((p) => !isLong(p.message)).map((p) => p.message)
      expect(rest, t.id).toEqual(LEADER_ACROSS[t.id] ?? [])
    }
    // The lists name templates that exist and are not empty.
    for (const id of [...Object.keys(LONG_LABELS), ...Object.keys(LEADER_ACROSS)])
      expect(
        TEMPLATES.some((t) => t.id === id),
        id,
      ).toBe(true)
    // With the text measured shorter than the line, no template has any fault but those across a part.
    for (const t of TEMPLATES)
      expect(
        messages(t.build(), () => 40),
        t.id,
      ).toEqual(LEADER_ACROSS[t.id] ?? [])
  })

  it('check-finds-crossing-leaders', () => {
    const problems = checkDoc(crossing())
    expect(problems).toEqual([
      {
        level: 'warning',
        path: 'label2',
        message: 'The leaders of the labels "upper text" and "lower text" cross.',
        hint: 'Swap the heights of the two texts, or put one of them on the other side of the diagram, so that the two lines do not cross.',
      },
    ])
    // The same labels with their heights swapped do not cross.
    expect(checkDoc(crossing(true))).toEqual([])
  })

  it('check-finds-leader-crossing-part', () => {
    // A leader from the right to the left beaker runs across the right beaker, from side to side.
    const b = new DocBuilder('Across')
    const left = b.symbol('beaker', { x: 0, y: 0 })
    const right = b.symbol('beaker', { x: 150, y: 0 })
    b.label('beaker', 320, 0, [left, 50, 60], { side: 'right' })
    const found = checkDoc(b.doc)
    expect(found).toEqual([
      {
        level: 'warning',
        path: 'label3',
        message: `The leader of the label "beaker" crosses part "${right.id}", and the label names "${left.id}".`,
        hint: `Put the text on the other side with "labels.side", or end the leader at another point of "${left.id}" with "labels.end", so that the line does not run over "${right.id}". In the editor, drag the round handle at the end of the leader.`,
      },
    ])
    // On the other side of the left beaker it crosses nothing.
    const free = new DocBuilder('Free')
    const l2 = free.symbol('beaker', { x: 0, y: 0 })
    free.symbol('beaker', { x: 150, y: 0 })
    free.label('beaker', -120, 0, [l2, -50, 60], { side: 'left' })
    expect(checkDoc(free.doc)).toEqual([])
    // A leader that ends on a free point is checked as well, and it does not name a part.
    const point = new DocBuilder('Point')
    point.symbol('beaker', { x: 0, y: 0 })
    const other = point.symbol('beaker', { x: 150, y: 0 })
    point.label('place', 320, 0, P(-20, 0), { side: 'right' })
    expect(messages(point.doc)).toEqual([`The leader of the label "place" crosses part "${other.id}".`])
  })

  it('lets a leader reach into the part that holds its end, and touch a part where it ends', () => {
    // A thermometer in a beaker: the leader crosses the wall of the beaker and ends inside it.
    const inBeaker = new DocBuilder('Reach in')
    const beaker = inBeaker.symbol('beaker', { x: 0, y: 0 })
    const thermometer = inBeaker.on('thermometer', 'bulb', beaker, 'base', { dy: -12 })
    inBeaker.label('thermometer', 200, 0, [thermometer, 4.5, 150], { side: 'right' })
    expect(checkDoc(inBeaker.doc)).toEqual([])
  })

  it('does not count a line that a part drawn in front hides', () => {
    // The distillation template: the leader of the granules runs over the rod of the stand, which the heating mantle hides.
    const doc = TEMPLATES.find((t) => t.id === 'distillation')!.build()
    expect(messages(doc, () => 40).filter((m) => m.includes('crosses'))).toEqual([])
    // Bring the stand to the front, and the rod is seen under the leader.
    const firstLabel = doc.order.findIndex((id) => doc.items[id].type === 'label')
    const rest = doc.order.filter((id) => id !== 'clampStand1')
    doc.order = [...rest.slice(0, firstLabel - 1), 'clampStand1', ...rest.slice(firstLabel - 1)]
    expect(messages(doc, () => 40).filter((m) => m.includes('crosses'))).toEqual([
      'The leader of the label "anti-bumping granules" crosses part "clampStand1", and the label names "roundBottomFlask4".',
    ])
  })

  it('check-finds-part-through-part', () => {
    // A beaker, a flask and a test tube drawn through each other.
    const b = new DocBuilder('Through')
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    const flask = b.symbol('conicalFlask', { x: 70, y: 20 })
    const tube = b.symbol('testTube', { x: 40, y: -90 })
    const found = checkDoc(b.doc).filter((p) => p.message.includes('through each other'))
    const through = (a: SymbolItem, c: SymbolItem) =>
      `The part "${a.id}" (${a.symbol}) and the part "${c.id}" (${c.symbol}) are drawn through each other: their outlines cross, and neither stands on the other or holds it in its cavity.`
    expect(found.map((p) => p.message)).toEqual([through(beaker, flask), through(beaker, tube), through(flask, tube)])
    expect(found.every((p) => p.level === 'warning')).toBe(true)
    expect(found[0].hint).toContain('"on"')
    // Apart, they are fine.
    const apart = new DocBuilder('Apart')
    apart.symbol('beaker', { x: 0, y: 0 })
    apart.symbol('conicalFlask', { x: 200, y: 20 })
    apart.symbol('testTube', { x: 400, y: 0 })
    expect(checkDoc(apart.doc).filter((p) => p.message.includes('through each other'))).toEqual([])
  })

  it('does not call a part that stands on another, or inside it, drawn through it', () => {
    // A test tube standing in a beaker of water: its centre is inside the beaker's cavity.
    const inside = new DocBuilder('Inside')
    const beaker = inside.symbol('beaker', { x: 0, y: 0 })
    inside.symbol('testTube', { x: 0, y: 10, params: {} })
    expect(beaker.id).toBeTruthy()
    expect(checkDoc(inside.doc).filter((p) => p.message.includes('through each other'))).toEqual([])
  })

  it('lets glassware that is joined cross at the joint, where the anchors meet', () => {
    // The distillation template joins a still head to a condenser to an adapter: their outlines cross at the joints.
    const joined = TEMPLATES.find((t) => t.id === 'distillation')!.build()
    expect(messages(joined, () => 40).filter((m) => m.includes('through each other'))).toEqual([])
    // Move the condenser a little, so that the anchors no longer meet: now they are drawn through each other.
    const moved = TEMPLATES.find((t) => t.id === 'distillation')!.build()
    const condenser = moved.items.liebigCondenser10
    if (condenser.type !== 'symbol') throw new Error('no condenser')
    condenser.x -= 12
    const found = messages(moved, () => 40).filter((m) => m.includes('through each other'))
    expect(found).toEqual([
      'The part "stillHead5" (stillHead) and the part "liebigCondenser10" (liebigCondenser) are drawn through each other: their outlines cross, and neither stands on the other or holds it in its cavity.',
    ])
  })

  it('finds a text that runs into a part other than the one it names', () => {
    const other = new DocBuilder('Over a part')
    const beaker = other.symbol('beaker', { x: 0, y: 0 })
    const second = other.symbol('beaker', { x: 220, y: 0 })
    // The text of the label starts at x = 200, which is over the second beaker (x from 170), and points at the first.
    other.label('beaker two', 200, -10, [beaker, 50, 50], { side: 'right' })
    const problems = checkDoc(other.doc)
    expect(problems.map((p) => p.message)).toContain(
      `The text of the label "beaker two", or the 100 u line that blank mode draws for it, overlaps the part "${second.id}".`,
    )
    const found = problems.find((p) => p.message.includes('overlaps the part'))!
    expect(found.level).toBe('warning')
    // The hint names the ways out, and says how much room blank mode needs.
    expect(found.hint).toContain('labels.side')
    expect(found.hint).toContain('labels.end')
    expect(found.hint).toContain('labels.skip')
    expect(found.hint).toContain('100 u free beside each leader end')
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
    expect(checkDoc(b.doc).map((p) => p.message)).toEqual([`The 100 u line that blank mode draws for the label "a" overlaps the part "${other.id}".`])
  })

  it('check-finds-label-wider-than-the-line', () => {
    const b = new DocBuilder('Wide')
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    b.label('filtrate (salt solution)', 150, 60, [beaker, 50, 60], { side: 'right' })
    b.label('filtrate', 150, 100, [beaker, 50, 100], { side: 'right' })
    // The width comes from the measure: the browser's real 161 u for the long text, 60 u for the short one.
    const measure: Measure = (text) => (text === 'filtrate (salt solution)' ? 161 : 60)
    const found = checkDoc(b.doc, measure).filter((p) => isLong(p.message))
    expect(found).toEqual([
      {
        level: 'warning',
        path: 'label2',
        message: 'The label "filtrate (salt solution)" is 161 u wide, and the line to write on in blank mode is 100 u: the answer will not fit on its line.',
        hint: 'Shorten the label to one or two words, or give it a shorter text: "labels.text" in a recipe, the text of the label in the editor.',
      },
    ])
    // It is a warning in every mode, because the text may be exported as a blank later; and plain text has no line to write on.
    const text = new DocBuilder('Plain')
    text.label('a very long piece of plain text with no leader', 0, 0)
    expect(checkDoc(text.doc, () => 400)).toEqual([])
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

  it('stays fast on a diagram of 1200 parts', () => {
    const b = new DocBuilder('Big')
    const tubes = []
    for (let i = 0; i < 1200; i++)
      tubes.push(b.symbol(i % 3 === 0 ? 'beaker' : i % 3 === 1 ? 'testTube' : 'conicalFlask', { x: (i % 40) * 150, y: Math.floor(i / 40) * 220 }))
    tubes.forEach((t, i) => b.label(`part ${i}`, (i % 40) * 150 + 90, Math.floor(i / 40) * 220 - 60, [t, 0, 40], { side: 'right' }))
    const started = performance.now()
    const problems = checkDoc(b.doc)
    const text = describeDoc(b.doc, { problems })
    const ms = performance.now() - started
    expect(text.split('\n').length).toBeGreaterThan(1200)
    expect(Array.isArray(problems)).toBe(true)
    // A quadratic check with no boxes in front of it takes minutes here; with them it takes a fraction of a second.
    expect(ms).toBeLessThan(4000)
  })
})

describe('describeDoc', () => {
  it('describes the title, the picture, each part, connector and label, and the checks', () => {
    const doc = TEMPLATES.find((t) => t.id === 'rateGasOverWater')!.build()
    const text = describeDoc(doc, { measure: () => 40 })
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

  it('says what this render makes of the diagram, when it is told', () => {
    const doc = TEMPLATES.find((t) => t.id === 'titration')!.build()
    const header = describeDoc(doc, { render: 'labels blank, photocopy-safe on' }).split('\n')[1]
    expect(header).toMatch(/; labels: text; photocopy-safe: off; this render: labels blank, photocopy-safe on$/)
  })

  it('lists the warnings, and more of each anchor when verbose', () => {
    const doc = crossing()
    const text = describeDoc(doc)
    expect(text).toContain('checks: 1 warning')
    expect(text).toContain('  1. The leaders of the labels "upper text" and "lower text" cross.')
    expect(text).toContain('anchors base(0, 60)  mouth(0, -60)  rim(0, -60)')
    const verbose = describeDoc(doc, { verbose: true })
    expect(verbose).toContain('base[base, 90°]@(0, 60)')
    expect(verbose).toContain('mouth[mouth, -90°]@(0, -60)')
  })

  it('lists at most 25 warnings and counts the rest', () => {
    const many = Array.from({ length: 31 }, (_, i) => ({ level: 'warning' as const, path: `p${i}`, message: `warning number ${i + 1}`, hint: '' }))
    expect(MAX_LISTED).toBe(25)
    expect(listed(many)).toEqual({ shown: many.slice(0, 25), more: 6 })
    expect(listed(many.slice(0, 25)).more).toBe(0)
    const text = describeDoc(crossing(true), { problems: many })
    expect(text).toContain('checks: 31 warnings')
    expect(text).toContain('  25. warning number 25')
    expect(text).not.toContain('26. warning number 26')
    expect(text.split('\n').pop()).toBe('  and 6 more')
  })

  it('gives the same text for the same diagram', () => {
    const doc = TEMPLATES.find((t) => t.id === 'titration')!.build()
    expect(describeDoc(doc)).toBe(describeDoc(JSON.parse(JSON.stringify(doc))))
  })
})

describe('measuredTexts', () => {
  it('lists every text that the checks, the description and an export measure', () => {
    for (const t of TEMPLATES) {
      for (const mode of ['text', 'blank', 'letters'] as const) {
        const built = t.build()
        const doc: Doc = { ...built, settings: { ...built.settings, labelMode: mode } }
        const wanted = new Set(measuredTexts(doc).map((m) => `${m.size} ${m.text}`))
        const seen = new Set<string>()
        const record: Measure = (text, size) => {
          seen.add(`${size} ${text}`)
          return estimateWidth(text, size)
        }
        checkDoc(doc, record)
        describeDoc(doc, { measure: record, problems: [] })
        exportPicture(doc, { labels: 'shown', mono: 'shown', answerKey: true }, record)
        for (const key of seen) expect(wanted.has(key), `${t.id} in ${mode} mode measures "${key}"`).toBe(true)
      }
    }
  })
})
