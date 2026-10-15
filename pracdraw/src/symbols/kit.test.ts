import { describe, expect, it } from 'vitest'
import { circle, tinted } from './kit'

describe('tinted', () => {
  it('gives a shape its tint and the hatch that stands in for it on a photocopy, in that order', () => {
    const prims = tinted(circle(0, 0, 10))
    expect(prims.map((p) => p.role)).toEqual(['tint', 'hatch'])
    expect(prims[1].d).toMatch(/^M-?[\d.]+ -?[\d.]+L/)
  })

  it('gives a shape that is too small for a hatch line its tint only', () => {
    expect(tinted(circle(0, 0, 0.6)).map((p) => p.role)).toEqual(['tint'])
  })

  it('passes the pitch on to the hatch', () => {
    const coarse = tinted(circle(0, 0, 10), { pitch: 8 })[1].d.split('M').length
    const fine = tinted(circle(0, 0, 10), { pitch: 2 })[1].d.split('M').length
    expect(fine).toBeGreaterThan(coarse * 2)
  })
})
