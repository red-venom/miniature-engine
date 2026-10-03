import { describe, expect, it } from 'vitest'
import { P, Path, bounds, clipH, nearestOnSegment, pathBounds, pathPolys, roundPoly, scan, v, xf, type Pt } from './geom'
import { buildContents } from './contents'
import { tube } from './tube'

const area = (poly: Pt[]) =>
  Math.abs(
    poly.reduce((a, p, i) => {
      const q = poly[(i + 1) % poly.length]
      return a + p.x * q.y - q.x * p.y
    }, 0),
  ) / 2
const xy = (d: string) => [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => P(Number(m[1]), Number(m[2])))

describe('paths', () => {
  it('flattens an arc onto its circle', () => {
    const pts = new Path().M(-10, 0).A(10, 10, 0, false).polys(0.05)[0]
    for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeCloseTo(10, 5)
    expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(10, 1) // sweep = false from left to right passes underneath
  })
  it('fillets a right angle with the radius asked for', () => {
    expect(roundPoly([v(0, 0), v(10, 0, 4), v(10, 10)]).d()).toBe('M0 0L6 0A4 4 0 0 1 10 4L10 10')
  })
  it('reduces a radius that does not fit', () => {
    expect(roundPoly([v(0, 0), v(4, 0, 10), v(4, 4)]).d()).toBe('M0 0A4 4 0 0 1 4 4')
  })
  it('measures path bounds, relative commands and arcs included', () => {
    expect(pathBounds('M0 0h10v5H-2Z')).toEqual({ x0: -2, y0: 0, x1: 10, y1: 5 })
    const b = pathBounds('M-10 0A10 10 0 0 0 10 0')
    expect(b.y1).toBeCloseTo(10, 1)
    expect(b.y0).toBeCloseTo(0, 5)
  })
})

describe('measuring a path string', () => {
  it('gives one polyline for each subpath and closes a closed one', () => {
    const polys = pathPolys('M0 0H10V10H0ZM20 0l5 5')
    expect(polys).toHaveLength(2)
    expect(polys[0]).toEqual([P(0, 0), P(10, 0), P(10, 10), P(0, 10), P(0, 0)])
    expect(polys[1]).toEqual([P(20, 0), P(25, 5)])
  })
  it('flattens curves onto the curve, not onto its control points', () => {
    const b = pathBounds('M0 0Q50 100 100 0')
    expect(b.y1).toBeCloseTo(50, 0) // the control point is at 100; the curve reaches 50
    const c = pathBounds('M0 0C0 40 60 40 60 0')
    expect(c.y1).toBeCloseTo(30, 0)
  })
  it('finds the nearest point of a segment', () => {
    expect(nearestOnSegment(P(0, 0), P(10, 0), P(4, 7))).toEqual(P(4, 0))
    expect(nearestOnSegment(P(0, 0), P(10, 0), P(-3, 2))).toEqual(P(0, 0))
  })
})

describe('clipping', () => {
  const U: Pt[] = [P(0, 0), P(0, 100), P(60, 100), P(60, 0), P(40, 0), P(40, 80), P(20, 80), P(20, 0)] // U-tube
  const N: Pt[] = [P(0, 100), P(0, 0), P(60, 0), P(60, 100), P(40, 100), P(40, 20), P(20, 20), P(20, 100)] // two legs joined at the top
  it('U-tube: liquid in both arms and the link', () => {
    expect(area(clipH(U, 50, 'below'))).toBeCloseTo(2 * 20 * 50 + 20 * 20, 5)
    expect(scan([U], 50)).toEqual([
      [0, 20],
      [40, 60],
    ])
  })
  it('two legs: two pools, nothing between them', () => {
    expect(area(clipH(N, 60, 'below'))).toBeCloseTo(2 * 20 * 40, 5)
    expect(scan([N], 60)).toEqual([
      [0, 20],
      [40, 60],
    ])
  })
})

describe('contents', () => {
  // A flask-like cavity: wide body, narrow neck. Local frame, 100 wide × 150 high.
  const cav = [[P(-15, 0), P(-15, 50), P(-50, 150), P(50, 150), P(15, 50), P(15, 0)]]
  const opts = (rot: number, mono = false) => ({ rot, flip: false, pivot: P(0, 75), mono, seed: 7 })
  it('keeps the surface level for every rotation', () => {
    for (const rot of [0, 35, 90, 180, 270]) {
      const surface = buildContents(cav, [{ kind: 'liquid', amount: 0.4, colour: '#cfe8f7' }], opts(rot)).find((p) => p.stroke)!
      const ys = xy(surface.d).map((p) => p.y)
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.011)
    }
  })
  it('puts the level at the right fraction of the rotated extent', () => {
    const b = bounds(cav[0].map((p) => xf(P(p.x, p.y - 75), 35)))
    const surface = buildContents(cav, [{ kind: 'liquid', amount: 0.25, colour: '#cfe8f7' }], opts(35)).find((p) => p.stroke)!
    expect(xy(surface.d)[0].y).toBeCloseTo(b.y1 - 0.25 * (b.y1 - b.y0), 1)
  })
  it('gives the same drawing for the same seed', () => {
    const run = () =>
      JSON.stringify(
        buildContents(
          cav,
          [
            { kind: 'lumps', amount: 0.2, colour: '#eee' },
            { kind: 'liquid', amount: 0.3, colour: '#fff', bubbles: 'many' },
          ],
          opts(0),
        ),
      )
    expect(run()).toBe(run())
  })
  it('fills liquid between lumps, and draws lumps last', () => {
    const prims = buildContents(
      cav,
      [
        { kind: 'lumps', amount: 0.2, colour: '#eee' },
        { kind: 'liquid', amount: 0.3, colour: '#abc' },
      ],
      opts(0),
    )
    const liquid = prims.find((p) => p.fill === '#abc')!
    expect(Math.max(...xy(liquid.d).map((p) => p.y))).toBeCloseTo(75, 1) // reaches the cavity floor (local y = 150)
    expect(prims[prims.length - 1].fill).toBe('#eee')
  })
  it('marks a cloudy liquid with dots, in colour and in photocopy-safe mode', () => {
    for (const mono of [false, true]) {
      const clear = buildContents(cav, [{ kind: 'liquid', amount: 0.5, colour: '#e6e6e6' }], opts(0, mono))
      const cloudy = buildContents(cav, [{ kind: 'liquid', amount: 0.5, colour: '#e6e6e6', cloudy: true }], opts(0, mono))
      expect(cloudy.length).toBe(clear.length + 1)
    }
  })
  it('curves the surface of the top liquid when a gas is above it', () => {
    const layers = [
      { kind: 'liquid' as const, amount: 0.4, colour: '#cfe8f7', meniscus: true },
      { kind: 'gas' as const, amount: 0, colour: '#e3efc1' },
    ]
    expect(buildContents(cav, layers, opts(0)).some((p) => p.stroke && p.d.includes('Q'))).toBe(true)
    expect(buildContents(cav, [{ ...layers[0], meniscus: false }, layers[1]], opts(0)).some((p) => p.stroke && p.d.includes('Q'))).toBe(false)
  })
  it('uses no colour in photocopy-safe mode', () => {
    const prims = buildContents(
      cav,
      [
        { kind: 'liquid', amount: 0.5, colour: '#cfe8f7' },
        { kind: 'gas', amount: 0, colour: '#d8c08a' },
      ],
      opts(0, true),
    )
    expect(JSON.stringify(prims)).not.toMatch(/cfe8f7|d8c08a/)
  })
})

describe('tube', () => {
  it('keeps each wall half a width from the centreline', () => {
    const t = tube([v(0, 0), v(0, -50, 12), v(80, -50, 12), v(80, 20)], 8)
    for (const w of xy(t.walls)) {
      const d = Math.min(...t.centre.map((c) => Math.hypot(c.x - w.x, c.y - w.y)))
      expect(d).toBeGreaterThan(3.9)
      expect(d).toBeLessThan(4.1)
    }
  })
  it('makes a bend sharp when the radius cannot fit', () => {
    const t = tube([v(0, 0), v(0, -6, 12), v(6, -6, 12), v(6, 0)], 8)
    expect(t.walls).not.toMatch(/NaN/)
  })
})
