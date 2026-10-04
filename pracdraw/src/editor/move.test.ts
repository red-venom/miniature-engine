import { describe, expect, it } from 'vitest'
import { anchorWorld, DocBuilder } from '../model/build'
import { moveSnapped, snap } from '../model/snap'
import type { SymbolItem } from '../model/types'
import { snapping } from './connect'
import { useEditor } from './store'

const s = () => useEditor.getState()
const keys = { ctrlKey: false, metaKey: false }

describe('snapping', () => {
  it('is on unless the Snap preference is off, or Ctrl or Cmd is held during the drag', () => {
    expect(snapping(true, keys)).toBe(true)
    expect(snapping(true, { ...keys, ctrlKey: true })).toBe(false)
    expect(snapping(true, { ...keys, metaKey: true })).toBe(false)
    expect(snapping(false, keys)).toBe(false)
  })
})

describe('a move gesture that snaps', () => {
  /** A drag of the bung in four pointer moves, as the Select tool makes it: each one snaps against the start. */
  function dragBung(ctrl: boolean) {
    const b = new DocBuilder()
    const flask = b.symbol('conicalFlask', { x: 0, y: 0 })
    const bung = b.symbol('bung', { x: 100, y: -200 })
    s().replace(b.doc)
    s().beginGesture('move')
    const base = s().gesture!.base
    const mouth = anchorWorld(flask, 'mouth'),
      plug = anchorWorld(bung, 'plug')
    for (const k of [0.25, 0.5, 0.75, 1]) {
      const dx = Math.round((mouth.x + 3 - plug.x) * k),
        dy = Math.round((mouth.y - 2 - plug.y) * k)
      const r = snap(base, [bung.id], dx, dy, 1, snapping(true, { ...keys, ctrlKey: ctrl }))
      s().preview(moveSnapped(base, [bung.id], r))
      s().updateGesture({ guides: r.guides.length ? r.guides : undefined })
    }
    s().endGesture()
    return { bung, mouth }
  }

  it('the move and the fit rule’s new width are one undo step', () => {
    const { bung, mouth } = dragBung(false)
    expect(s().gesture).toBeNull()
    expect(s().past).toHaveLength(1)
    const it = s().doc.items[bung.id] as SymbolItem
    expect(it.w).toBe(37.2)
    const p = anchorWorld(it, 'plug')
    expect(p.x).toBeCloseTo(mouth.x, 9)
    expect(p.y).toBeCloseTo(mouth.y, 9)
    s().undo()
    expect(s().doc.items[bung.id]).toEqual(bung)
  })

  it('with Ctrl held, the drag goes where the pointer goes', () => {
    const { bung, mouth } = dragBung(true)
    const it = s().doc.items[bung.id] as SymbolItem
    expect(it.w).toBe(38)
    expect(anchorWorld(it, 'plug').x).toBeCloseTo(mouth.x + 3, 9)
  })
})
