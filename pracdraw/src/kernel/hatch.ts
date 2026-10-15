// hatch.ts — parallel lines that fill a shape: the photocopy-safe stand-in for a grey tint.
// The SVG may hold no pattern (specification D6), so a hatch is plain geometry: one path of straight lines.

import { P, f, pathPolys, scan, type Pt } from './geom'

export interface HatchOpts {
  /** Distance between the lines, in u. */
  pitch?: number
  /** Direction of the lines in degrees, clockwise from +x on the screen. -45 runs from lower left to upper right. */
  angle?: number
  /** A line shorter than this is left out (a sliver at a corner). */
  minLength?: number
}

/**
 * Hatch lines across the inside of the closed subpaths of `d` (even–odd rule, so a hole stays empty), as one path string.
 * The lines lie on a fixed grid in the symbol's own frame, so two shapes of one symbol are hatched alike.
 * It returns '' when there is nothing to hatch.
 */
export function hatchD(d: string, { pitch = 4, angle = -45, minLength = 1.5 }: HatchOpts = {}): string {
  const a = (angle * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a)
  // Turn the shape so that the lines become horizontal, scan it, and turn each line back.
  const polys: Pt[][] = pathPolys(d).map((poly) => poly.map((p) => P(p.x * c + p.y * s, -p.x * s + p.y * c)))
  const ys = polys.flat().map((p) => p.y)
  if (!ys.length || !(pitch > 0)) return ''
  const y0 = Math.min(...ys),
    y1 = Math.max(...ys)
  let out = ''
  for (let k = Math.ceil(y0 / pitch - 0.5); (k + 0.5) * pitch <= y1; k++) {
    const y = (k + 0.5) * pitch
    for (const [xa, xb] of scan(polys, y)) {
      if (xb - xa < minLength) continue
      const p = P(xa * c - y * s, xa * s + y * c),
        q = P(xb * c - y * s, xb * s + y * c)
      out += `M${f(p.x)} ${f(p.y)}L${f(q.x)} ${f(q.y)}`
    }
  }
  return out
}
