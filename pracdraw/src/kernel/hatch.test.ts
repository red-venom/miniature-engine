import { describe, expect, it } from 'vitest'
import { dist, pathPolys, P } from './geom'
import { hatchD } from './hatch'

/** The segments of a hatch path: one M and one L each. */
const segments = (d: string) => pathPolys(d).map((poly) => ({ a: poly[0], b: poly[poly.length - 1] }))
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`

describe('hatchD', () => {
  it('draws level lines across a square, one pitch apart and half a pitch in from the edge of the grid', () => {
    const d = hatchD('M0 0H20V20H0Z', { pitch: 4, angle: 0 })
    expect(segments(d).map((s) => [s.a.x, s.a.y, s.b.x, s.b.y])).toEqual([2, 6, 10, 14, 18].map((y) => [0, y, 20, y]))
  })

  it('runs its lines at the angle asked for, and never outside the shape', () => {
    const r = 12
    for (const angle of [-45, 45, 0, 90, 30]) {
      const segs = segments(hatchD(circle(5, -3, r), { pitch: 3, angle }))
      expect(segs.length).toBeGreaterThan(4)
      for (const { a, b } of segs) {
        // each end lies on the circle (the circle is flattened to within 0.25 u), and the line has the direction asked for
        for (const p of [a, b]) expect(Math.abs(dist(p, P(5, -3)) - r)).toBeLessThan(0.3)
        const dir = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
        const diff = (((dir - angle) % 180) + 180) % 180
        expect(Math.min(diff, 180 - diff)).toBeLessThan(0.5)
      }
    }
  })

  it('keeps a hole empty (even–odd) and leaves out slivers', () => {
    const ring = circle(0, 0, 20) + circle(0, 0, 10)
    const segs = segments(hatchD(ring, { pitch: 2, angle: 0 }))
    for (const { a, b } of segs) {
      // no line has a point inside the hole: a line at |y| < 10 is two pieces, and each piece stays outside the inner circle
      for (const t of [0, 0.25, 0.5, 0.75, 1]) expect(dist(P(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)), P(0, 0))).toBeGreaterThan(9.7)
    }
    expect(segments(hatchD('M0 0H0.5V30H0Z', { pitch: 4, angle: 0 }))).toEqual([])
  })

  it('returns an empty string for a line, for nothing and for a pitch that is not positive; and gives the same answer twice', () => {
    expect(hatchD('M0 0L10 10')).toBe('')
    expect(hatchD('')).toBe('')
    expect(hatchD('M0 0H10V10H0Z', { pitch: 0 })).toBe('')
    const d = circle(0, 0, 9)
    expect(hatchD(d)).toBe(hatchD(d))
  })

  it('lays the lines on a fixed grid, so that shapes of one symbol are hatched alike', () => {
    // two squares at different heights: where they overlap in y, the lines are on the same levels
    const a = segments(hatchD('M0 0H10V20H0Z', { pitch: 4, angle: 0 })).map((s) => s.a.y)
    const b = segments(hatchD('M0 8H10V28H0Z', { pitch: 4, angle: 0 })).map((s) => s.a.y)
    expect(a.filter((y) => b.includes(y)).length).toBeGreaterThanOrEqual(2)
  })
})
