// kit.ts — shared sizes and helpers for symbol authors. Use these so that parts fit each other.

import { Path, f, roundPoly, type V } from '../kernel/geom'
import type { ParamValue } from './types'

/** Standard neck / mouth width: flasks, boiling tubes and the default bung all use it. */
export const NECK = 34
/**
 * Ground-glass joints. A socket is NECK wide at its mouth. A cone is NECK wide at its shoulder and narrows to CONE_END over CONE_LEN.
 * So a cone seats in any flask neck and in any socket, with no gap at the rim.
 */
export const CONE_END = 28
export const CONE_LEN = 24
/** Glass tube: distance between wall lines. Also the default delivery-tube width. */
export const BORE = 7
/** Half-width of a hole in a bung. A glass tube (7 u) and a thermometer (9 u) both pass through. */
export const HOLE = 4.5
/** How far below the rim the top edge of a cavity lies. */
export const RIM = 1.5

/** Closed rounded polygon. */
export const closed = (vs: V[]): Path => roundPoly(vs, true)

/** Copy of a path whose leading M is an L, so that it can continue another path. */
export function joinTo(p: Path): Path {
  const q = new Path()
  p.segs.forEach((s, i) => q.segs.push(i === 0 && s.k === 'M' ? { k: 'L', p: s.p } : s))
  return q
}

export const num = (v: ParamValue | undefined, fallback: number): number => (typeof v === 'number' ? v : fallback)
export const bool = (v: ParamValue | undefined, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)
export const str = (v: ParamValue | undefined, fallback: string): string => (typeof v === 'string' ? v : fallback)

/** Horizontal tick marks: one path. `len(i)` > 0 draws to the right of x, < 0 to the left. */
export function ticks(x: number, y0: number, y1: number, count: number, len: (i: number) => number): string {
  let d = ''
  for (let i = 0; i <= count; i++) {
    const l = len(i)
    if (l) d += `M${f(x)} ${f(y0 + (i * (y1 - y0)) / count)}h${f(l)}`
  }
  return d
}

export const rect = (x0: number, y0: number, x1: number, y1: number): string => `M${f(x0)} ${f(y0)}H${f(x1)}V${f(y1)}H${f(x0)}Z`
export const circle = (cx: number, cy: number, r: number): string =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`
