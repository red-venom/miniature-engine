import { describe, expect, it } from 'vitest'
import { dist, pathBounds, P } from '../kernel/geom'
import { CROSS_ARM, DOT_R, bracketD, crossD, dotD, electronPrims, pairedPoints, ringPoints } from './electrons'

describe('ringPoints', () => {
  it('puts n points on the circle, evenly spaced, the first at the angle asked for (-90 is the top)', () => {
    const pts = ringPoints(10, 20, 30, 6)
    expect(pts).toHaveLength(6)
    expect(pts[0].x).toBeCloseTo(10, 6)
    expect(pts[0].y).toBeCloseTo(-10, 6)
    for (const p of pts) expect(dist(p, P(10, 20))).toBeCloseTo(30, 6)
    const gap = dist(pts[0], pts[1])
    for (let i = 0; i < 6; i++) expect(dist(pts[i], pts[(i + 1) % 6])).toBeCloseTo(gap, 6)
    expect(ringPoints(0, 0, 10, 0)).toEqual([])
  })
})

describe('pairedPoints', () => {
  it('puts a shell of 8 as four pairs at the top, right, bottom and left, each pair `spacing` apart', () => {
    const pts = pairedPoints(0, 0, 48, 8, 7)
    expect(pts).toHaveLength(8)
    for (const p of pts) expect(dist(p, P(0, 0))).toBeCloseTo(48, 6)
    for (let k = 0; k < 4; k++) expect(dist(pts[2 * k], pts[2 * k + 1])).toBeGreaterThan(6.8)
    expect(dist(pts[0], pts[1])).toBeLessThan(7.1)
    // the middle of the first pair is at the top
    expect((pts[0].x + pts[1].x) / 2).toBeCloseTo(0, 1)
    expect((pts[0].y + pts[1].y) / 2).toBeLessThan(-47)
  })

  it('gives an odd shell a last electron on its own, and keeps all electrons at least `spacing` apart on a ring of 28 u', () => {
    expect(pairedPoints(0, 0, 28, 5, 7)).toHaveLength(5)
    for (let n = 1; n <= 8; n++) {
      const pts = pairedPoints(0, 0, 28, n, 7)
      expect(pts).toHaveLength(n)
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(dist(pts[i], pts[j]), `${n}: ${i}-${j}`).toBeGreaterThan(5.4)
    }
  })
})

describe('the marks', () => {
  it('draw a dot of radius 2.6 and a cross whose arms reach 2.7 u, centred on the point', () => {
    const d = pathBounds(dotD(10, 20))
    expect([d.x0, d.x1, d.y0, d.y1].map((v) => Math.round(v * 100) / 100)).toEqual([10 - DOT_R, 10 + DOT_R, 20 - DOT_R, 20 + DOT_R])
    const c = pathBounds(crossD(10, 20))
    expect([c.x0, c.x1, c.y0, c.y1]).toEqual([10 - CROSS_ARM, 10 + CROSS_ARM, 20 - CROSS_ARM, 20 + CROSS_ARM])
  })

  it('make one prim of dots (role ink) or of crosses (role detail), and none for no electrons', () => {
    const pts = ringPoints(0, 0, 20, 3)
    expect(electronPrims(pts, 'dot')).toEqual([{ d: expect.stringContaining('a'), role: 'ink' }])
    expect(electronPrims(pts, 'cross')).toEqual([{ d: expect.not.stringContaining('a'), role: 'detail' }])
    expect(electronPrims([], 'dot')).toEqual([])
  })

  it('draw a pair of square brackets round a box, open towards each other', () => {
    expect(bracketD(0, 0, 40, 30, 6)).toBe('M6 0H0V30H6M34 0H40V30H34')
  })
})
