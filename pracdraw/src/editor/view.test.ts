import { describe, expect, it } from 'vitest'
import { P, type Pt } from '../kernel/geom'
import { ZOOM_MAX, ZOOM_MIN, type View } from './store'
import { fitView, pinchView, toScreen, toWorld, zoom100, zoomAt } from './view'

const near = (a: Pt, b: Pt) => {
  expect(a.x).toBeCloseTo(b.x, 9)
  expect(a.y).toBeCloseTo(b.y, 9)
}

describe('zoomAt and zoom100', () => {
  it('keep the world point under the pointer where it is', () => {
    const v: View = { x: 30, y: -20, zoom: 1.5 }
    const at = P(200, 150)
    const w = toWorld(v, at)
    const z = zoomAt(v, 3, at)
    expect(z.zoom).toBe(3)
    near(toScreen(z, w), at)
    expect(zoomAt(v, 100, at).zoom).toBe(ZOOM_MAX)
    expect(zoomAt(v, 0.001, at).zoom).toBe(ZOOM_MIN)
    const one = zoom100({ x: 13.3, y: 7.7, zoom: 2 }, { w: 500, h: 400 })
    expect(one.zoom).toBe(1)
    expect(Number.isInteger(one.x) && Number.isInteger(one.y)).toBe(true)
  })

  it('fitView shows the whole box with a 40 px margin', () => {
    const v = fitView({ x0: 0, y0: 0, x1: 400, y1: 200 }, { w: 880, h: 600 })
    expect(v.zoom).toBe(2) // (880 − 80) ÷ 400
    near(toScreen(v, P(200, 100)), P(440, 300))
    expect(fitView(null, { w: 800, h: 600 })).toEqual({ x: 400, y: 300, zoom: 1 })
  })
})

describe('pinchView', () => {
  const v0: View = { x: 50, y: 20, zoom: 1 }

  it('zooms about the centre of the pinch: the world point under it stays under it', () => {
    const c = P(300, 200)
    const from: [Pt, Pt] = [P(250, 200), P(350, 200)]
    const to: [Pt, Pt] = [P(200, 200), P(400, 200)] // twice as far apart, same centre
    const v = pinchView(v0, from, to)
    expect(v.zoom).toBe(2)
    near(toScreen(v, toWorld(v0, c)), c)
    // Closer together: it zooms out.
    expect(pinchView(v0, from, [P(275, 200), P(325, 200)]).zoom).toBe(0.5)
    // The direction of the two fingers does not matter, only their distance.
    expect(pinchView(v0, from, [P(300, 100), P(300, 300)]).zoom).toBe(2)
  })

  it('pans when the two fingers move together', () => {
    const from: [Pt, Pt] = [P(100, 100), P(200, 150)]
    const v = pinchView(v0, from, [P(160, 140), P(260, 190)])
    expect(v).toEqual({ x: v0.x + 60, y: v0.y + 40, zoom: 1 })
  })

  it('zooms and pans at once: the world point under the first centre goes to the new centre', () => {
    const from: [Pt, Pt] = [P(100, 100), P(140, 100)]
    const to: [Pt, Pt] = [P(300, 250), P(300, 370)] // three times as far apart, centre moved
    const v = pinchView({ x: -40, y: 10, zoom: 0.5 }, from, to)
    expect(v.zoom).toBeCloseTo(1.5, 12)
    near(toScreen(v, toWorld({ x: -40, y: 10, zoom: 0.5 }, P(120, 100))), P(300, 310))
  })

  it('keeps the zoom within 10 % to 800 %, and ignores fingers on the same spot', () => {
    expect(pinchView(v0, [P(0, 0), P(10, 0)], [P(0, 0), P(1000, 0)]).zoom).toBe(ZOOM_MAX)
    expect(pinchView(v0, [P(0, 0), P(1000, 0)], [P(0, 0), P(1, 0)]).zoom).toBe(ZOOM_MIN)
    expect(pinchView(v0, [P(5, 5), P(5, 5)], [P(10, 5), P(30, 5)]).zoom).toBe(1)
    expect(pinchView(v0, [P(0, 0), P(10, 0)], [P(7, 7), P(7, 7)]).zoom).toBe(1)
  })
})
