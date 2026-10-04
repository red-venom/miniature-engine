import { describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { makeSymbol } from '../model/commands'
import { toWorld } from '../model/transform'
import { fromFrame, handleDir, handlePoint, handlesFor, resizeWith, rotatePoint, rotationTo, snapAngle, toFrame } from './handles'

const beaker = (rot = 0, flip = false) => ({ ...makeSymbol('beaker', 100, 100, 'b'), rot, flip })

describe('handles', () => {
  it('lists handles by resize mode', () => {
    expect(handlesFor('free').length).toBe(8)
    expect(handlesFor('uniform')).toEqual(['nw', 'ne', 'se', 'sw'])
    expect(handlesFor('width')).toEqual(['e', 'w'])
    expect(handlesFor('height')).toEqual(['n', 's'])
    expect(handlesFor('none')).toEqual([])
    expect(handleDir('ne')).toEqual({ hx: 1, hy: -1 })
    expect(handleDir('s')).toEqual({ hx: 0, hy: 1 })
  })
  it('frame points agree with the model transform', () => {
    const it = beaker(37, true)
    const p = fromFrame(it, P(10, -20))
    const q = toWorld(it, P(10, it.h / 2 - 20))
    expect(p.x).toBeCloseTo(q.x, 9)
    expect(p.y).toBeCloseTo(q.y, 9)
    const back = toFrame(it, p)
    expect(back.x).toBeCloseTo(10)
    expect(back.y).toBeCloseTo(-20)
    expect(handlePoint(beaker(), 'se')).toEqual({ x: 150, y: 160 })
    expect(rotatePoint(beaker(), 24)).toEqual({ x: 100, y: 16 })
    const turned = rotatePoint(beaker(90), 24)
    expect(turned.x).toBeCloseTo(184)
    expect(turned.y).toBeCloseTo(100)
  })
  it('resizes from a side, keeping the opposite side fixed', () => {
    const it = beaker()
    const r = resizeWith(it, 'free', { w: 40, h: 40 }, 'e', P(200, 0), false)
    expect(r).toMatchObject({ w: 150, h: 120, x: 125, y: 100 })
    const t = resizeWith(it, 'free', { w: 40, h: 40 }, 'n', P(0, 0), false)
    expect(t).toMatchObject({ w: 100, h: 160, x: 100, y: 80 })
  })
  it('never goes below min, and a corner with Shift keeps the aspect', () => {
    const it = beaker()
    const r = resizeWith(it, 'free', { w: 40, h: 40 }, 'w', P(140, 100), false)
    expect(r).toMatchObject({ w: 40, h: 120, x: 130, y: 100 })
    const s = resizeWith(it, 'free', { w: 40, h: 40 }, 'se', P(250, 100), true)
    expect(s.w).toBeCloseTo(200)
    expect(s.h).toBeCloseTo(240)
    const u = resizeWith(it, 'uniform', { w: 40, h: 40 }, 'nw', P(140, 140), false)
    expect(u.w).toBeCloseTo(40)
    expect(u.h).toBeCloseTo(48)
    expect(u.x).toBeCloseTo(130)
    expect(u.y).toBeCloseTo(136)
  })
  it('resizes in the turned frame', () => {
    const it = beaker(90)
    // The frame's east is the world's south: the pointer below the item makes it taller in the frame's x, which is width.
    const r = resizeWith(it, 'free', undefined, 'e', P(100, 200), false)
    expect(r.w).toBeCloseTo(150)
    expect(r.h).toBeCloseTo(120)
    expect(r.x).toBeCloseTo(100)
    expect(r.y).toBeCloseTo(125)
  })
  it('a shape has a frame with no flip: the handles of a free symbol', () => {
    const shape = { x: 100, y: 50, w: 80, h: 40, rot: 90 }
    expect(handlePoint(shape, 'se').x).toBeCloseTo(80)
    expect(handlePoint(shape, 'se').y).toBeCloseTo(90)
    const r = resizeWith({ ...shape, rot: 0 }, 'free', undefined, 'e', P(180, 0), false)
    expect(r).toMatchObject({ w: 120, h: 40, x: 120, y: 50 })
  })
  it('rotation and snapping', () => {
    expect(rotationTo(P(0, 0), P(0, -10))).toBeCloseTo(0)
    expect(rotationTo(P(0, 0), P(10, 0))).toBeCloseTo(90)
    expect(snapAngle(43, false)).toBe(45)
    expect(snapAngle(38, false)).toBe(38)
    expect(snapAngle(38, true)).toBe(45)
    expect(snapAngle(-2, false) + 0).toBe(0)
  })
})
