import { describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { DOUBLE_TAP_MS, DOUBLE_TAP_PX, HIT_PX, TAP_PX, isDoubleTap, isTap } from './touch'

describe('taps', () => {
  it('a press and release less than 10 px apart is a tap', () => {
    expect(TAP_PX).toBe(10)
    expect(isTap(P(100, 100), P(100, 100))).toBe(true)
    expect(isTap(P(100, 100), P(106, 107))).toBe(true)
    expect(isTap(P(100, 100), P(110, 100))).toBe(false)
  })

  it('two taps within 400 ms and 24 px make a double tap', () => {
    const first = { t: 1000, p: P(200, 200) }
    expect(isDoubleTap(first, { t: 1000 + DOUBLE_TAP_MS, p: P(200, 200) })).toBe(true)
    expect(isDoubleTap(first, { t: 1250, p: P(200 + DOUBLE_TAP_PX, 200) })).toBe(true)
    expect(isDoubleTap(first, { t: 1001 + DOUBLE_TAP_MS, p: P(200, 200) })).toBe(false)
    expect(isDoubleTap(first, { t: 1250, p: P(220, 220) })).toBe(false)
    expect(isDoubleTap(null, { t: 1250, p: P(200, 200) })).toBe(false)
    // A tap from before the first (another pointer's clock) is not a double tap.
    expect(isDoubleTap(first, { t: 900, p: P(200, 200) })).toBe(false)
  })

  it('a handle on a coarse pointer has a hit area 28 px across', () => {
    expect(HIT_PX).toBe(28)
  })
})
