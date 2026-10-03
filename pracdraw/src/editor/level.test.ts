import { describe, expect, it } from 'vitest'
import type { Layer } from '../kernel/contents'
import { P, nearestOnSegment, dist, type Pt } from '../kernel/geom'
import { makeSymbol } from '../model/commands'
import { WATER } from '../model/contents'
import { toWorld } from '../model/transform'
import type { SymbolItem } from '../model/types'
import { geometry } from '../symbols/registry'
import { filledAt, surfaces } from './level'

const water = (amount: number): Layer => ({ kind: 'liquid', amount, colour: WATER })
const item = (symbol: string, contents: Record<string, Layer[]>, rot = 0, flip = false): SymbolItem => ({
  ...makeSymbol(symbol, 100, 100, 's'),
  contents,
  rot,
  flip,
})

/** The distance from a world point to the outline of the item's cavity, as the item stands. */
function toOutline(it: SymbolItem, cavity: string, p: Pt): number {
  const polys = geometry(it.symbol, it.w, it.h, it.params).cavities!.find((c) => c.id === cavity)!.polys
  let best = Infinity
  for (const poly of polys.map((q) => q.map((v) => toWorld(it, v))))
    for (let i = 0; i < poly.length; i++) best = Math.min(best, dist(p, nearestOnSegment(poly[i], poly[(i + 1) % poly.length], p)))
  return best
}

describe('surfaces', () => {
  it('an upright beaker half full of water: the surface runs from wall to wall', () => {
    const [s] = surfaces(item('beaker', { main: [water(0.5)] }))
    // The cavity is 1.5 u to 120 u of the box (y 41.5 to 160 in the world); half of it is 59.25 u.
    expect(s.cavity).toBe('main')
    expect(s.filled).toBe(0.5)
    expect(s.left.x).toBeCloseTo(50)
    expect(s.right.x).toBeCloseTo(150)
    expect(s.left.y).toBeCloseTo(160 - 59.25)
    expect(s.right.y).toBe(s.left.y)
  })
  it('stays level when the item turns or flips, and its ends are on the walls', () => {
    for (const [rot, flip] of [
      [30, false],
      [30, true],
      [135, false],
      [270, true],
    ] as const) {
      const it = item('beaker', { main: [water(0.4)] }, rot, flip)
      const [s] = surfaces(it)
      expect(s.right.y).toBe(s.left.y)
      expect(s.right.x).toBeGreaterThan(s.left.x + 20)
      expect(toOutline(it, 'main', s.left)).toBeLessThan(0.01)
      expect(toOutline(it, 'main', s.right)).toBeLessThan(0.01)
    }
  })
  it('there is one for each cavity that holds a layer that is not a gas', () => {
    expect(surfaces(item('beaker', {}))).toEqual([])
    expect(surfaces(item('beaker', { main: [{ kind: 'gas', amount: 0, colour: '#e3efc1' }] }))).toEqual([])
    const condenser = surfaces(item('liebigCondenser', { jacket: [water(0.5)], inner: [water(0.25)] }))
    expect(condenser.map((s) => s.cavity)).toEqual(['jacket', 'inner'])
    // Half full, the jacket's level runs through the inner tube: the handle goes to the right edge of the jacket.
    expect(condenser[0].right.x).toBeGreaterThan(100)
  })
})

describe('filledAt', () => {
  it('gives the fraction of the cavity below a world height, 0 to 1', () => {
    const it = item('beaker', { main: [water(0.5)] }, 30)
    const [s] = surfaces(it)
    expect(filledAt(it, 'main', s.right)).toBeCloseTo(0.5)
    expect(filledAt(it, 'main', P(0, -1000))).toBe(1)
    expect(filledAt(it, 'main', P(0, 1000))).toBe(0)
    expect(filledAt(it, 'jacket', s.right)).toBeNull()
  })
})
