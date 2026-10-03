import { describe, expect, it } from 'vitest'
import { MAX_AREA, MAX_SIDE } from './canvas'
import { pngSize } from './png'

describe('pngSize', () => {
  it('is the picture at its scale, in whole pixels', () => {
    expect(pngSize({ w: 100, h: 50 }, 2)).toEqual({ w: 200, h: 100, scale: 2 })
    expect(pngSize({ w: 333, h: 101 }, 4)).toEqual({ w: 1332, h: 404, scale: 4 })
    expect(pngSize({ w: 1, h: 1 }, 1)).toEqual({ w: 1, h: 1, scale: 1 })
  })
  it('keeps the canvas under 8192 px a side and 16 million pixels, as safeScale does', () => {
    const long = pngSize({ w: 5000, h: 100 }, 4)
    expect(long.w).toBe(MAX_SIDE)
    expect(long.scale).toBeCloseTo(MAX_SIDE / 5000, 9)
    const big = pngSize({ w: 3000, h: 3000 }, 4)
    expect(big.w * big.h).toBeLessThanOrEqual(MAX_AREA + 2 * big.w)
    expect(big.scale).toBeCloseTo(Math.sqrt(MAX_AREA / 9e6), 9)
  })
})
