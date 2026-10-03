// scale.ts — instruments with a reading.
// Valid for an item that stands upright (rot = 0, no flip), or upside down (rot = 180) when `upsideDown` is set.
// Upside down is the measuring cylinder that collects a gas over water: the water is at the mouth end,
// and the reading at the water surface is the volume of gas.

import { bounds } from '../kernel/geom'
import type { Geometry } from './types'

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Local y of a value on the symbol's scale. */
export function valueToY(g: Geometry, value: number): number | null {
  const s = g.scale
  return s ? s.y0 + ((value - s.v0) / (s.v1 - s.v0)) * (s.y1 - s.y0) : null
}

/** The layer amount (0–1) that puts the surface of a single layer at this reading. */
export function readingToAmount(g: Geometry, value: number, upsideDown = false): number | null {
  const y = valueToY(g, value)
  const cav = g.cavities?.find((c) => c.id === g.scale?.cavity)
  if (y === null || !cav) return null
  const b = bounds(cav.polys.flat())
  const upright = clamp01((b.y1 - y) / (b.y1 - b.y0))
  return upsideDown ? 1 - upright : upright
}

/** The reading shown by a single layer of this amount. */
export function amountToReading(g: Geometry, amount: number, upsideDown = false): number | null {
  const s = g.scale
  const cav = g.cavities?.find((c) => c.id === s?.cavity)
  if (!s || !cav) return null
  const b = bounds(cav.polys.flat())
  const upright = upsideDown ? 1 - clamp01(amount) : clamp01(amount)
  const y = b.y1 - upright * (b.y1 - b.y0)
  return s.v0 + ((y - s.y0) / (s.y1 - s.y0)) * (s.v1 - s.v0)
}
