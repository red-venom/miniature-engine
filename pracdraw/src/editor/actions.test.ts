import { beforeEach, describe, expect, it } from 'vitest'
import { itemBox } from '../model/bounds'
import { DocBuilder } from '../model/build'
import { WATER } from '../model/contents'
import { makeLabel } from '../model/labels'
import type { Doc, LabelItem, SymbolItem } from '../model/types'
import {
  addSymbolAt,
  alignSelection,
  amountSlider,
  cancelText,
  cavityWater,
  commitText,
  distributeSelection,
  editLabel,
  freeLabel,
  groupSelection,
  labelAll,
  labelFields,
  loadDoc,
  nudge,
  reading,
  select,
  startLabel,
  typeText,
  undo,
} from './actions'
import { measureText } from './measure'
import { useEditor } from './store'

const s = () => useEditor.getState()
const amount = (id: string) => (s().doc.items[id] as SymbolItem).contents.main?.[0]?.amount

function start(doc: Doc): void {
  s().replace(doc)
}

beforeEach(() => {
  const b = new DocBuilder()
  b.symbol('beaker', { x: 0, y: 0, contents: { main: [{ kind: 'liquid', amount: 0.5, colour: WATER }] } })
  start(b.doc)
})

describe('the amount slider', () => {
  it('a drag is one undo step', () => {
    amountSlider.start()
    for (const a of [0.55, 0.6, 0.7, 0.8]) amountSlider.set('beaker1', 'main', 0, a)
    expect(s().past).toHaveLength(0)
    amountSlider.end()
    expect(s().gesture).toBeNull()
    expect(s().past).toHaveLength(1)
    expect(amount('beaker1')).toBe(0.8)
    undo()
    expect(amount('beaker1')).toBe(0.5)
  })
  it('a change with no drag (a key) commits at once, and quick repeats join', () => {
    amountSlider.set('beaker1', 'main', 0, 0.51)
    amountSlider.set('beaker1', 'main', 0, 0.52)
    expect(s().gesture).toBeNull()
    expect(s().past).toHaveLength(1)
    expect(amount('beaker1')).toBe(0.52)
    amountSlider.end()
    expect(s().past).toHaveLength(1)
  })
})

describe('contents actions', () => {
  it('the Water button and a typed reading are one step each', () => {
    const id = addSymbolAt('measuringCylinder')
    const steps = s().past.length
    reading(id, 37)
    cavityWater(id, 'main')
    expect(s().past.length).toBe(steps + 2)
    expect(amount(id)).toBe(0.5)
    undo()
    expect(amount(id)).not.toBe(0.5)
    undo()
    expect(amount(id)).toBeUndefined()
  })
})

describe('several items: group, lock, align, distribute', () => {
  function three(): Doc {
    const b = new DocBuilder()
    b.symbol('beaker', { x: 0, y: 0 })
    b.symbol('tripod', { x: 300, y: 50 })
    b.symbol('bunsenBurner', { x: 500, y: 100 })
    return b.doc
  }
  it('items that share a group select as one; a locked item is never selected, not even with its group', () => {
    start(three())
    select(['beaker1', 'tripod2'])
    groupSelection()
    select(['tripod2'])
    expect(s().selection).toEqual(['beaker1', 'tripod2'])
    s().commit({ ...s().doc, items: { ...s().doc.items, beaker1: { ...s().doc.items.beaker1, locked: true } } })
    select(['tripod2'])
    expect(s().selection).toEqual(['tripod2'])
    select(['beaker1'])
    expect(s().selection).toEqual([])
  })
  it('align and distribute are one undo step each', () => {
    start(three())
    select(['beaker1', 'tripod2', 'bunsenBurner3'])
    alignSelection('top')
    const tops = s().selection.map((id) => itemBox(s().doc, s().doc.items[id]).y0)
    expect(tops[1]).toBeCloseTo(tops[0], 9)
    expect(tops[2]).toBeCloseTo(tops[0], 9)
    distributeSelection('across')
    expect(s().past).toHaveLength(2)
    undo()
    undo()
    expect(s().doc).toEqual(three())
  })
})

describe('labels and text (section 11)', () => {
  function sample(): Doc {
    const b = new DocBuilder()
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    b.label('beaker', 100, 0, [beaker, 50, 60])
    return b.doc
  }
  const fresh = () => makeLabel({ x: 200, y: 50, side: 'right', target: { item: 'beaker1', lx: 50, ly: 60 }, text: 'beaker' }, 'new1')

  it('a new label goes into the document when its text is committed: one undo step, then the Select tool', () => {
    start(sample())
    s().setTool('label')
    startLabel(fresh())
    expect(s().textEdit).toEqual({ label: fresh(), fresh: true, text: 'beaker' })
    expect(s().doc.items.new1).toBeUndefined()
    typeText('250 cm3 beaker')
    expect(s().past).toHaveLength(0)
    commitText()
    expect(s().textEdit).toBeNull()
    expect(s().tool).toBe('select')
    expect(s().selection).toEqual(['new1'])
    expect(s().doc.items.new1).toEqual({ ...fresh(), text: '250 cm3 beaker' })
    expect(s().past).toHaveLength(1)
    commitText() // nothing is open: nothing happens
    expect(s().past).toHaveLength(1)
    undo()
    expect(s().doc.items.new1).toBeUndefined()
  })

  it('Escape drops a new label; an empty box adds nothing', () => {
    start(sample())
    s().setTool('label')
    startLabel(fresh())
    cancelText()
    expect(s().textEdit).toBeNull()
    expect(s().tool).toBe('select')
    expect(s().doc).toEqual(sample())
    startLabel(fresh())
    typeText('   ')
    commitText()
    expect(s().doc.order).toEqual(['beaker1', 'label2'])
    expect(s().past).toHaveLength(0)
  })

  it('an old label takes the typed text, keeps its text on Escape, and is deleted by an empty box', () => {
    start(sample())
    expect(editLabel('label2')).toBe(true)
    expect(s().selection).toEqual(['label2'])
    typeText('glass')
    cancelText()
    expect((s().doc.items.label2 as LabelItem).text).toBe('beaker')
    editLabel('label2')
    typeText('glass beaker')
    commitText()
    expect((s().doc.items.label2 as LabelItem).text).toBe('glass beaker')
    editLabel('label2')
    typeText('')
    commitText()
    expect(s().doc.items.label2).toBeUndefined()
    expect(s().status).toBe('Label deleted')
    undo()
    expect((s().doc.items.label2 as LabelItem).text).toBe('glass beaker')
    // A symbol, a missing item and a locked label have no text box.
    expect(editLabel('beaker1')).toBe(false)
    expect(editLabel('nothing')).toBe(false)
    s().commit({ ...s().doc, items: { ...s().doc.items, label2: { ...s().doc.items.label2, locked: true } } })
    expect(editLabel('label2')).toBe(false)
    expect(s().textEdit).toBeNull()
  })

  it('Label all is one undo step; the new labels become the selection', () => {
    const b = new DocBuilder()
    b.symbol('beaker', { x: 0, y: 0 })
    b.symbol('tripod', { x: 300, y: 50 })
    start(b.doc)
    labelAll()
    expect(s().past).toHaveLength(1)
    expect(s().selection).toHaveLength(2)
    expect(
      s()
        .selection.map((id) => (s().doc.items[id] as LabelItem).text)
        .sort(),
    ).toEqual(['beaker', 'tripod'])
    expect(s().status).toBe('2 labels added')
    labelAll()
    expect(s().past).toHaveLength(1)
    expect(s().status).toBe('Every part has a label')
    undo()
    expect(s().doc).toEqual(b.doc)
  })

  it('the label inspector: fields, and freeing the leader end, one undo step each', () => {
    start(sample())
    labelFields('label2', { size: 20, side: 'left' })
    freeLabel('label2')
    expect(s().doc.items.label2).toMatchObject({ size: 20, side: 'left', target: { x: 50, y: 0 } })
    expect(s().past).toHaveLength(2)
  })

  it('loading a document closes the text box', () => {
    start(sample())
    startLabel(fresh())
    loadDoc(sample())
    expect(s().textEdit).toBeNull()
  })
})

describe('measureText', () => {
  it('is the estimate without a DOM: 0.56 × the size for each character drawn, scripts at 0.7', () => {
    expect(measureText('abcd', 15)).toBeCloseTo(4 * 15 * 0.56, 9)
    expect(measureText('CO_{2}', 10)).toBeCloseTo((2 + 0.7) * 10 * 0.56, 9)
  })
})

describe('the order rule in the move actions', () => {
  it('an arrow-key move into a beaker brings the thermometer to just above it', () => {
    const b = new DocBuilder()
    b.symbol('thermometer', { x: 200, y: 100 })
    b.symbol('beaker', { x: 100, y: 120 })
    start(b.doc)
    s().select(['thermometer1'])
    nudge(-10, 0)
    expect(s().doc.order).toEqual(['thermometer1', 'beaker2'])
    nudge(-100, 0)
    expect(s().doc.order).toEqual(['beaker2', 'thermometer1'])
  })
})
