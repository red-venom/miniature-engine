import { describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { labelNode } from '../render/render'
import { labelTarget } from './bounds'
import { DocBuilder } from './build'
import { deleteItems, duplicateItems, moveItems, setSize } from './commands'
import {
  addLabel,
  freeTarget,
  gestureLabel,
  isBlankText,
  isFixed,
  labelSize,
  leaderOf,
  leaderStart,
  makeLabel,
  setLabel,
  setLabelText,
  setTargetAt,
  symbolLabelText,
} from './labels'
import { toWorld } from './transform'
import type { Doc, LabelItem, SymbolItem } from './types'

function sample(): Doc {
  const b = new DocBuilder('Labels')
  const beaker = b.symbol('beaker', { x: 100, y: 100 })
  b.symbol('hotPlate', { x: 400, y: 100, params: { stirrer: true } })
  b.label('beaker', 220, 90, [beaker, 50, 60])
  b.label('free', 300, 300, P(250, 250), { side: 'left' })
  b.label('plain', 20, 400)
  return b.doc
}

const lab = (doc: Doc, id: string) => doc.items[id] as LabelItem
const sym = (doc: Doc, id: string) => doc.items[id] as SymbolItem

describe('leaderStart and leaderOf', () => {
  it('start where the renderer draws the leader: 5 u outside the text, a third of the size up', () => {
    const doc = sample()
    for (const id of ['label3', 'label4']) {
      const it = lab(doc, id)
      const node = labelNode(doc, it)
      const leader = node.t === 'g' ? node.kids[0] : null
      const s = leaderStart(it, labelSize(doc, it))
      expect(leader?.t === 'path' && leader.d.startsWith(`M${Math.round(s.x * 100) / 100} ${Math.round(s.y * 100) / 100}L`)).toBe(true)
    }
    expect(leaderStart({ x: 10, y: 20, side: 'left' }, 15)).toEqual(P(15, 20 - 4.95))
    expect(leaderStart({ x: 10, y: 20, side: 'right' }, 15)).toEqual(P(5, 20 - 4.95))
  })
  it('a fixed target is the point in its item, a free one is itself, plain text has none', () => {
    const doc = sample()
    expect(labelTarget(doc, lab(doc, 'label3'))).toEqual(toWorld(sym(doc, 'beaker1'), P(50, 60)))
    expect(labelTarget(doc, lab(doc, 'label4'))).toEqual(P(250, 250))
    expect(labelTarget(doc, lab(doc, 'label5'))).toBeNull()
    expect(leaderOf(doc, lab(doc, 'label5'))).toBeNull()
    expect(leaderOf(doc, lab(doc, 'label4'))).toEqual([P(305, 300 - 4.95), P(250, 250)])
    expect(isFixed(lab(doc, 'label3'))).toBe(true)
    expect(isFixed(lab(doc, 'label4'))).toBe(false)
  })
  it('a label has its own size, or the document label size', () => {
    const doc = sample()
    expect(labelSize(doc, lab(doc, 'label3'))).toBe(15)
    expect(labelSize(doc, { size: 22 })).toBe(22)
  })
})

describe('gestureLabel', () => {
  const doc = sample()
  const beaker = sym(doc, 'beaker1')
  it('a drag from a symbol fixes the target in its local frame and takes its label text', () => {
    const press = toWorld(beaker, P(48, 70))
    const it = gestureLabel(doc, press, P(260.4, 140.6), true, 'beaker1', 'n1')
    expect(it).toEqual({
      id: 'n1',
      type: 'label',
      text: 'beaker',
      x: 260,
      y: 141,
      side: 'right',
      target: { item: 'beaker1', lx: 48, ly: 70 },
      leaderEnd: 'none',
    })
    expect(labelTarget(doc, it)).toEqual(press)
  })
  it('the text is on the left when the release point is left of the press point', () => {
    const it = gestureLabel(doc, toWorld(beaker, P(-48, 70)), P(-20, 80), true, 'beaker1')
    expect(it.side).toBe('left')
    expect(it.id).toMatch(/^[0-9a-z]{8}$/)
  })
  it('on a turned and flipped symbol the target is still the pressed point, and it follows the symbol', () => {
    const turned = { ...beaker, rot: 30, flip: true }
    const d = { ...doc, items: { ...doc.items, beaker1: turned } }
    const press = toWorld(turned, P(30, 100))
    const it = gestureLabel(d, press, P(300, 300), true, 'beaker1')
    expect(it.target).toEqual({ item: 'beaker1', lx: 30, ly: 100 })
    const back = labelTarget(d, it)!
    expect(back.x).toBeCloseTo(press.x, 9)
    expect(back.y).toBeCloseTo(press.y, 9)
  })
  it('the label text follows the parameters of the symbol', () => {
    expect(gestureLabel(doc, P(400, 100), P(500, 50), true, 'hotPlate2').text).toBe('magnetic stirrer')
    expect(symbolLabelText(doc, 'hotPlate2')).toBe('magnetic stirrer')
    expect(symbolLabelText(doc, 'label3')).toBe('')
  })
  it('a drag from anything that is not a symbol gives a free target on whole units and no text', () => {
    const it = gestureLabel(doc, P(10.3, 20.7), P(100, 20), true, null)
    expect(it).toMatchObject({ text: '', side: 'right', target: { x: 10, y: 21 } })
    expect(gestureLabel(doc, P(10, 20), P(-100, 20), true, 'label3').target).toEqual({ x: 10, y: 20 })
  })
  it('a click makes plain text with no leader, even on a symbol', () => {
    const it = gestureLabel(doc, toWorld(beaker, P(0, 60)), P(101, 99.6), false, 'beaker1', 'n2')
    expect(it).toEqual({ id: 'n2', type: 'label', text: '', x: 101, y: 100, side: 'right', leaderEnd: 'none' })
    expect('target' in it).toBe(false)
  })
})

describe('text', () => {
  it('a new label goes on top with its typed text; an empty text adds nothing', () => {
    const doc = sample()
    const it = makeLabel({ x: 0, y: 0, side: 'right' }, 'n1')
    const next = addLabel(doc, it, 'H2O')
    expect(next.order).toEqual([...doc.order, 'n1'])
    expect(lab(next, 'n1').text).toBe('H2O')
    expect(addLabel(doc, it, '')).toBe(doc)
    expect(addLabel(doc, it, ' \n ')).toBe(doc)
    expect(isBlankText(' x ')).toBe(false)
  })
  it('setLabelText changes the text, and an empty text deletes the label', () => {
    const doc = sample()
    expect(lab(setLabelText(doc, 'label3', '250 cm3\nbeaker'), 'label3').text).toBe('250 cm3\nbeaker')
    expect(setLabelText(doc, 'label3', 'beaker')).toBe(doc)
    const gone = setLabelText(doc, 'label3', '  ')
    expect(gone.items.label3).toBeUndefined()
    expect(gone.order).not.toContain('label3')
    expect(setLabelText(doc, 'beaker1', 'x')).toBe(doc)
  })
})

describe('setLabel', () => {
  it('sets the side, the leader end, the size and smart text', () => {
    const doc = sample()
    const next = setLabel(doc, 'label3', { side: 'left', leaderEnd: 'arrow', size: 20, smart: false })
    expect(lab(next, 'label3')).toMatchObject({ side: 'left', leaderEnd: 'arrow', size: 20, smart: false, text: 'beaker' })
    expect(lab(setLabel(next, 'label3', { leaderEnd: 'dot' }), 'label3').leaderEnd).toBe('dot')
    // The input is unchanged.
    expect(lab(doc, 'label3')).toEqual(lab(sample(), 'label3'))
  })
  it('a size or smart flag equal to the document setting is not stored; a size is kept in its range', () => {
    const doc = sample()
    const big = setLabel(doc, 'label3', { size: 20, smart: false })
    const back = setLabel(big, 'label3', { size: 15, smart: true })
    expect('size' in lab(back, 'label3')).toBe(false)
    expect('smart' in lab(back, 'label3')).toBe(false)
    expect(lab(setLabel(doc, 'label3', { size: 500 }), 'label3').size).toBe(60)
    expect(lab(setLabel(doc, 'label3', { size: 1 }), 'label3').size).toBe(6)
    expect(lab(setLabel(big, 'label3', { size: undefined }), 'label3').size).toBeUndefined()
  })
  it('ignores bad values, gives the same document when nothing changes, and an empty text deletes', () => {
    const doc = sample()
    expect(setLabel(doc, 'label3', { side: 'up' as LabelItem['side'], leaderEnd: 'tick' as LabelItem['leaderEnd'], size: NaN })).toBe(doc)
    expect(setLabel(doc, 'label3', { text: 'beaker', side: 'right' })).toBe(doc)
    expect(setLabel(doc, 'label3', { text: '' }).items.label3).toBeUndefined()
    expect(setLabel(doc, 'beaker1', { side: 'left' })).toBe(doc)
  })
})

describe('setTargetAt', () => {
  it('moves the leader end: fixed to a symbol at a point of its local frame, or a free point on whole units', () => {
    const doc = sample()
    const plate = sym(doc, 'hotPlate2')
    const on = toWorld(plate, P(40, 10))
    const fixed = setTargetAt(doc, 'label4', on, 'hotPlate2')
    expect(lab(fixed, 'label4').target).toEqual({ item: 'hotPlate2', lx: 40, ly: 10 })
    expect(lab(fixed, 'label4')).toMatchObject({ text: 'free', x: 300, y: 300, side: 'left' })
    const free = setTargetAt(fixed, 'label4', P(10.4, 19.6))
    expect(lab(free, 'label4').target).toEqual({ x: 10, y: 20 })
    // Dropped on something that is not a symbol (a label, nothing): a free point.
    expect(lab(setTargetAt(doc, 'label3', P(5, 5), 'label5'), 'label3').target).toEqual({ x: 5, y: 5 })
  })
  it('leaves plain text, bad points and an unchanged end alone', () => {
    const doc = sample()
    expect(setTargetAt(doc, 'label5', P(0, 0))).toBe(doc)
    expect(setTargetAt(doc, 'label4', P(NaN, 0))).toBe(doc)
    expect(setTargetAt(doc, 'label4', P(250, 250))).toBe(doc)
    expect(setTargetAt(doc, 'label3', toWorld(sym(doc, 'beaker1'), P(50, 60)), 'beaker1')).toBe(doc)
    expect(setTargetAt(doc, 'beaker1', P(0, 0))).toBe(doc)
  })
})

describe('freeTarget', () => {
  it('a fixed target becomes the world point where it is; it stops following the item', () => {
    const doc = sample()
    const at = toWorld(sym(doc, 'beaker1'), P(50, 60))
    const free = freeTarget(doc, 'label3')
    expect(lab(free, 'label3').target).toEqual({ x: at.x, y: at.y })
    const moved = moveItems(free, ['beaker1'], 30, 0)
    expect(labelTarget(moved, lab(moved, 'label3'))).toEqual(at)
  })
  it('leaves a free target, plain text and a missing item alone', () => {
    const doc = sample()
    expect(freeTarget(doc, 'label4')).toBe(doc)
    expect(freeTarget(doc, 'label5')).toBe(doc)
    const orphan = { ...doc, items: { ...doc.items, label3: { ...lab(doc, 'label3'), target: { item: 'nothing', lx: 0, ly: 0 } } } }
    expect(freeTarget(orphan, 'label3')).toBe(orphan)
  })
})

describe('labels move, duplicate, resize and delete like other items', () => {
  it('a moved label moves its text anchor; a fixed target follows its item', () => {
    const doc = sample()
    const before = labelTarget(doc, lab(doc, 'label3'))!
    const moved = moveItems(doc, ['label3'], 10, -5)
    expect(lab(moved, 'label3')).toMatchObject({ x: 230, y: 85, target: { item: 'beaker1', lx: 50, ly: 60 } })
    expect(labelTarget(moved, lab(moved, 'label3'))).toEqual(before)
    const withItem = moveItems(doc, ['beaker1'], 10, -5)
    expect(labelTarget(withItem, lab(withItem, 'label3'))).toEqual(P(before.x + 10, before.y - 5))
  })
  it('a resized symbol scales the targets fixed to it, so that each stays on its part', () => {
    const doc = sample()
    const next = setSize(doc, 'beaker1', { w: 150, h: 60 })
    expect(lab(next, 'label3').target).toEqual({ item: 'beaker1', lx: 75, ly: 30 })
  })
  it('a duplicated label keeps its target item; a deleted item leaves a free target where it was', () => {
    const doc = sample()
    const dup = duplicateItems(doc, ['label3'], 20, 20, () => 'copy')
    expect(lab(dup, 'copy')).toMatchObject({ x: 240, y: 110, target: { item: 'beaker1', lx: 50, ly: 60 } })
    const at = labelTarget(doc, lab(doc, 'label3'))!
    const gone = deleteItems(doc, ['beaker1'])
    expect(lab(gone, 'label3').target).toEqual({ x: at.x, y: at.y })
  })
})
