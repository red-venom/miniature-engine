import { describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { DOUBLE_TAP_MS, DOUBLE_TAP_PX, HIT_PX, TAP_PX, TILE_DRAG_PX, isDoubleTap, isTap, tilePress } from './touch'

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

describe('a press on a library tile', () => {
  it('stays a press (a click or a tap) until it has moved 4 px with a mouse, 8 px with a finger or a pen', () => {
    expect(TILE_DRAG_PX).toEqual({ mouse: 4, touch: 8 })
    expect(tilePress('mouse', 0, 0)).toBe('press')
    expect(tilePress('mouse', 2, -3)).toBe('press')
    expect(tilePress('mouse', 4, 0)).toBe('drag')
    expect(tilePress('touch', 5, 6)).toBe('press')
    expect(tilePress('touch', 8, 0)).toBe('drag')
    expect(tilePress('pen', -7.9, 0)).toBe('press')
  })

  it('a mouse drags the tile in any direction', () => {
    expect(tilePress('mouse', 0, 30)).toBe('drag')
    expect(tilePress('mouse', -3, -30)).toBe('drag')
  })

  it('a finger or a pen drags it only sideways: up or down, the browser scrolls the list', () => {
    expect(tilePress('touch', 20, 5)).toBe('drag')
    expect(tilePress('touch', -12, 11)).toBe('drag')
    expect(tilePress('touch', 5, 20)).toBe('scroll')
    expect(tilePress('touch', 10, -10)).toBe('scroll')
    expect(tilePress('pen', 0, -9)).toBe('scroll')
    expect(tilePress('pen', 30, 0)).toBe('drag')
  })
})
