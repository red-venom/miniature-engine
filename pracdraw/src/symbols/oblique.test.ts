import { describe, expect, it } from 'vitest'
import { dist, P } from '../kernel/geom'
import { DEPTH, DEPTH_STEP, boxEdges, oblique } from './oblique'

describe('oblique (rule S14)', () => {
  it('keeps the front true to shape: with no depth, x is x and y is up (so the frame y is minus y)', () => {
    expect(oblique(10, 20, 0)).toEqual(P(10, -20))
    expect(oblique(-5, 0, 0)).toEqual(P(-5, -0))
  })

  it('draws depth at 45° up and to the right, at half its length', () => {
    const o = oblique(0, 0, 0),
      d = oblique(0, 0, 100)
    expect(d.x - o.x).toBeCloseTo(-(d.y - o.y), 9)
    expect(d.x - o.x).toBeGreaterThan(0)
    expect(dist(o, d)).toBeCloseTo(100 * DEPTH, 9)
    expect(DEPTH_STEP.x).toBeCloseTo(oblique(0, 0, 1).x, 12)
    expect(DEPTH_STEP.y).toBeCloseTo(oblique(0, 0, 1).y, 12)
  })

  it('moves a point by the same offset for the same depth wherever it is on the front', () => {
    const a = oblique(3, 4, 0),
      b = oblique(3, 4, 40),
      c = oblique(-9, 7, 0),
      d = oblique(-9, 7, 40)
    expect(b.x - a.x).toBeCloseTo(d.x - c.x, 9)
    expect(b.y - a.y).toBeCloseTo(d.y - c.y, 9)
  })
})

describe('boxEdges', () => {
  it('lists the 12 edges of a box once each, and 3 of them are hidden: the ones that meet the back, bottom, left corner', () => {
    const edges = boxEdges()
    expect(edges).toHaveLength(12)
    expect(new Set(edges.map((e) => `${e.from}|${e.to}`)).size).toBe(12)
    const hidden = edges.filter((e) => e.hidden)
    expect(hidden).toHaveLength(3)
    // every hidden edge has the corner x = 0, y = 0, z = 1 at one end
    for (const e of hidden) expect([e.from, e.to].some((c) => c[0] === 0 && c[1] === 0 && c[2] === 1)).toBe(true)
  })

  it('has each corner on 3 edges, and the hidden corner is on 3 hidden ones', () => {
    const edges = boxEdges()
    const count = new Map<string, number>()
    for (const e of edges) for (const c of [e.from, e.to]) count.set(c.join(), (count.get(c.join()) ?? 0) + 1)
    expect([...count.values()].every((n) => n === 3)).toBe(true)
  })
})
