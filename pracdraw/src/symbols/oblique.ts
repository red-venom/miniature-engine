// oblique.ts — the oblique projection of rule S14, shared by every structure symbol so that they all look at their object the same way.
// Cabinet projection: the front (x right, y up) keeps its true shape; the depth axis (z, away from the viewer) is drawn at 45° up
// and to the right, at half its true length. The symbol's own frame has y pointing down, so the result is flipped.

import { P, type Pt } from '../kernel/geom'

/** The depth axis is drawn at this fraction of its length (cabinet projection). */
export const DEPTH = 0.5
const C = Math.SQRT1_2 // cos 45° = sin 45°

/** The point of the model (x right, y up, z away from the viewer, all in u) as a point of the symbol's frame (y down). */
export function oblique(x: number, y: number, z: number): Pt {
  return P(x + DEPTH * C * z, -(y + DEPTH * C * z))
}

/** The drawn offset of one unit of depth: how far a point moves, in x and in y of the frame, when z grows by 1. */
export const DEPTH_STEP: Pt = P(DEPTH * C, -DEPTH * C)

/**
 * The 12 edges of a box of the model x 0..a, y 0..b, z 0..c, as pairs of corners (each corner is [0|1, 0|1, 0|1] along x, y, z), and
 * whether the edge is hidden: an edge is hidden when it meets the one vertex of the box that touches none of the three faces that
 * face the viewer (the front, the top and the right) in this projection: the corner at x = 0, y = 0, z = c. Its three edges are the
 * hidden ones, and rule S14 draws them dashed.
 */
export type Corner = readonly [0 | 1, 0 | 1, 0 | 1]
export interface BoxEdge {
  from: Corner
  to: Corner
  hidden: boolean
}
export function boxEdges(): BoxEdge[] {
  const corners: Corner[] = []
  for (const x of [0, 1] as const) for (const y of [0, 1] as const) for (const z of [0, 1] as const) corners.push([x, y, z])
  const edges: BoxEdge[] = []
  for (const a of corners)
    for (const b of corners) {
      const diff = (a[0] !== b[0] ? 1 : 0) + (a[1] !== b[1] ? 1 : 0) + (a[2] !== b[2] ? 1 : 0)
      if (diff !== 1 || a.join() > b.join()) continue
      const touchesHidden = (c: Corner) => c[0] === 0 && c[1] === 0 && c[2] === 1
      edges.push({ from: a, to: b, hidden: touchesHidden(a) || touchesHidden(b) })
    }
  return edges
}
