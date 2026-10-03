// label.ts — where the leader line of a label should end on a symbol.

import { P, dist, nearestOnSegment, pathPolys, type Pt } from '../kernel/geom'
import type { Geometry } from './types'

/**
 * The end point of a leader for one side of a symbol, in the symbol's local frame.
 * It is `labelAt` when the symbol gives one. Otherwise it is the point of the drawing that is nearest to the middle
 * of that side of the nominal box: on a beaker the wall, on a conical flask the sloping side, on a clamp stand the rod.
 */
export function labelPoint(g: Geometry, w: number, h: number, side: 'left' | 'right'): Pt {
  if (g.labelAt) return g.labelAt[side]
  const from = P(side === 'left' ? -w / 2 : w / 2, h / 2)
  let best = from,
    bestDist = Infinity
  for (const prim of g.prims) {
    if (prim.role === 'paper') continue // not visible
    for (const poly of pathPolys(prim.d)) {
      for (let i = 0; i < poly.length; i++) {
        const q = i + 1 < poly.length ? nearestOnSegment(poly[i], poly[i + 1], from) : poly[i]
        const d = dist(q, from)
        if (d < bestDist) {
          bestDist = d
          best = q
        }
      }
    }
  }
  return best
}
