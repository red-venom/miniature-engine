// tube.ts — a glass or rubber tube drawn as two parallel walls along a centreline.
// Output is plain paths: two open wall lines and one closed body polygon (white fill hides what is behind).

import { P, roundPoly, polyD, dist, type Pt, type V } from './geom'

export interface TubeGeom {
  /** Two open subpaths (left wall, right wall). Stroke only. */
  walls: string
  /** Closed polygon between the walls. Fill only. */
  body: string
  /** Flattened centreline, for hit-testing and bounds. */
  centre: Pt[]
}

export type TubeEnd = 'open' | 'closed'

/**
 * @param points  centreline vertices; `r` is the bend radius at that vertex (0 = sharp)
 * @param width   distance between the wall centre lines
 */
export function tube(points: V[], width: number, ends: [TubeEnd, TubeEnd] = ['open', 'open']): TubeGeom {
  const half = width / 2
  // A bend tighter than the tube's half-width would fold the inner wall over itself. Make such bends sharp.
  const safe = points.map((p, i) => {
    if (!p.r || i === 0 || i === points.length - 1) return { ...p, r: 0 }
    const a = points[i - 1],
      b = points[i + 1]
    const u1 = P(p.x - a.x, p.y - a.y),
      u2 = P(b.x - p.x, b.y - p.y)
    const turn = Math.abs(Math.atan2(u1.x * u2.y - u1.y * u2.x, u1.x * u2.x + u1.y * u2.y))
    if (turn < 1e-3) return { ...p, r: 0 }
    const room = Math.min(dist(a, p), dist(p, b)) * 0.5
    const rMax = room / Math.tan(turn / 2)
    const r = Math.min(Math.max(p.r, half * 1.6), rMax)
    return { ...p, r: r >= half * 1.2 ? r : 0 }
  })
  const raw = roundPoly(safe).polys(0.05)[0]
  const c = raw.filter((p, i) => i === 0 || dist(p, raw[i - 1]) > 1e-6)
  const left: Pt[] = [],
    right: Pt[] = []
  for (let i = 0; i < c.length; i++) {
    const d1 = dir(c[Math.max(0, i - 1)], c[Math.max(1, i)])
    const d2 = dir(c[Math.min(c.length - 2, i)], c[Math.min(c.length - 1, i + 1)])
    let mx = d1.y + d2.y,
      my = -(d1.x + d2.x) // sum of the two left normals
    const ml = Math.hypot(mx, my) || 1
    mx /= ml
    my /= ml
    const cos = mx * d1.y + my * -d1.x // cosine of half the turn
    const k = half / Math.max(cos, 0.5) // mitre, limited
    left.push(P(c[i].x + mx * k, c[i].y + my * k))
    right.push(P(c[i].x - mx * k, c[i].y - my * k))
  }
  let walls = polyD(left, false) + polyD(right, false)
  const cap = (a: Pt, b: Pt) => `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`
  if (ends[0] === 'closed') walls += cap(left[0], right[0])
  if (ends[1] === 'closed') walls += cap(left[left.length - 1], right[right.length - 1])
  return { walls, body: polyD([...left, ...right.reverse()]), centre: c }
}

function dir(a: Pt, b: Pt): Pt {
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1
  return P((b.x - a.x) / l, (b.y - a.y) / l)
}
