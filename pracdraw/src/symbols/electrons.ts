// electrons.ts — the marks of an electron diagram, shared by the atom and dot-and-cross symbols so that every one draws them alike.
// Electrons are dots (role `ink`) or crosses (role `detail`); a dot-and-cross diagram gives the two atoms different marks (rule S6).

import { P, f, type Pt } from '../kernel/geom'
import { circle } from './kit'
import type { Prim } from './types'

/** Radius of an electron dot, and half the arm of an electron cross, in u. They do not scale with the symbol (rule S3). */
export const DOT_R = 2.6
export const CROSS_ARM = 2.7

/** `n` points evenly spaced on a circle of radius `r` about (cx, cy). The first is at `startDeg`, clockwise from +x on the screen (-90 is the top). */
export function ringPoints(cx: number, cy: number, r: number, n: number, startDeg = -90): Pt[] {
  return Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => {
    const a = ((startDeg + (360 * i) / n) * Math.PI) / 180
    return P(cx + r * Math.cos(a), cy + r * Math.sin(a))
  })
}

/**
 * `n` electrons as pairs on a circle: ceil(n / 2) places evenly spaced, each holding two electrons `spacing` u apart along the ring
 * (the last holds one when n is odd). A shell of 8 is four pairs at the top, right, bottom and left. Electrons are listed in place order,
 * so a place fills before the next, as the electrons of a shell do when they are shown paired.
 */
export function pairedPoints(cx: number, cy: number, r: number, n: number, spacing = 7, startDeg = -90): Pt[] {
  const count = Math.max(0, Math.floor(n))
  const places = Math.ceil(count / 2)
  const out: Pt[] = []
  for (let k = 0; k < places; k++) {
    const mid = startDeg + (360 * k) / places
    const half = ((spacing / 2 / r) * 180) / Math.PI
    const angles = count - 2 * k >= 2 ? [mid - half, mid + half] : [mid]
    for (const deg of angles) out.push(P(cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)))
  }
  return out
}

/** The path of a dot at (x, y). */
export const dotD = (x: number, y: number, r = DOT_R): string => circle(x, y, r)

/** The path of a cross at (x, y): two strokes, `arm` u from the centre in each direction. */
export const crossD = (x: number, y: number, arm = CROSS_ARM): string =>
  `M${f(x - arm)} ${f(y - arm)}L${f(x + arm)} ${f(y + arm)}M${f(x - arm)} ${f(y + arm)}L${f(x + arm)} ${f(y - arm)}`

/** One prim for a set of electrons: solid dots (role `ink`) or crosses (role `detail`). Empty list: no prim. */
export function electronPrims(points: readonly Pt[], mark: 'dot' | 'cross'): Prim[] {
  if (!points.length) return []
  return mark === 'dot'
    ? [{ d: points.map((p) => dotD(p.x, p.y)).join(''), role: 'ink' }]
    : [{ d: points.map((p) => crossD(p.x, p.y)).join(''), role: 'detail' }]
}

/** A pair of square brackets round the box x0..x1, y0..y1, open towards each other: `[ ]`. `arm` is how far the ends reach in. */
export function bracketD(x0: number, y0: number, x1: number, y1: number, arm = 6): string {
  return `M${f(x0 + arm)} ${f(y0)}H${f(x0)}V${f(y1)}H${f(x0 + arm)}M${f(x1 - arm)} ${f(y0)}H${f(x1)}V${f(y1)}H${f(x1 - arm)}`
}
