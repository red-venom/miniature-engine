// geom.ts — path builder, flattening, half-plane clipping, scanlines.
// Pure functions. No DOM. All angles in degrees at the API surface.

export type Pt = { x: number; y: number }
export const P = (x: number, y: number): Pt => ({ x, y })

/** Number formatter for SVG output: 2 decimal places, no "-0". */
export const f = (n: number): string => {
  const r = Math.round(n * 100) / 100
  return Object.is(r, -0) ? '0' : String(r)
}

const sub = (a: Pt, b: Pt): Pt => P(a.x - b.x, a.y - b.y)
const len = (a: Pt): number => Math.hypot(a.x, a.y)
const unit = (a: Pt): Pt => {
  const l = len(a) || 1
  return P(a.x / l, a.y / l)
}
export const dist = (a: Pt, b: Pt): number => len(sub(a, b))

type Seg =
  | { k: 'M'; p: Pt }
  | { k: 'L'; p: Pt }
  | { k: 'A'; r: number; large: boolean; sweep: boolean; p: Pt }
  | { k: 'Q'; c: Pt; p: Pt }
  | { k: 'C'; c1: Pt; c2: Pt; p: Pt }
  | { k: 'Z' }

/**
 * Path builder. One instance can hold several subpaths.
 * `d()` gives the SVG path data. `polys()` gives each subpath as a polyline.
 * Arcs are circular only (rx = ry), which keeps flattening exact and simple.
 */
export class Path {
  readonly segs: Seg[] = []
  private last: Pt | null = null
  M(x: number, y: number) {
    this.segs.push({ k: 'M', p: (this.last = P(x, y)) })
    return this
  }
  /** Line to (x, y). A zero-length line is dropped. */
  L(x: number, y: number) {
    if (this.last && Math.abs(this.last.x - x) < 1e-9 && Math.abs(this.last.y - y) < 1e-9) return this
    this.segs.push({ k: 'L', p: (this.last = P(x, y)) })
    return this
  }
  /** Circular arc to (x, y). sweep = true is clockwise on screen (SVG y points down). */
  A(r: number, x: number, y: number, sweep = true, large = false) {
    this.segs.push({ k: 'A', r, large, sweep, p: (this.last = P(x, y)) })
    return this
  }
  Q(cx: number, cy: number, x: number, y: number) {
    this.segs.push({ k: 'Q', c: P(cx, cy), p: (this.last = P(x, y)) })
    return this
  }
  C(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.segs.push({ k: 'C', c1: P(c1x, c1y), c2: P(c2x, c2y), p: (this.last = P(x, y)) })
    return this
  }
  Z() {
    this.segs.push({ k: 'Z' })
    this.last = null
    return this
  }
  /** Append another path's segments. */
  add(other: Path) {
    this.segs.push(...other.segs)
    this.last = other.last
    return this
  }

  d(): string {
    return this.segs
      .map((s) => {
        switch (s.k) {
          case 'M':
          case 'L':
            return `${s.k}${f(s.p.x)} ${f(s.p.y)}`
          case 'A':
            return `A${f(s.r)} ${f(s.r)} 0 ${s.large ? 1 : 0} ${s.sweep ? 1 : 0} ${f(s.p.x)} ${f(s.p.y)}`
          case 'Q':
            return `Q${f(s.c.x)} ${f(s.c.y)} ${f(s.p.x)} ${f(s.p.y)}`
          case 'C':
            return `C${f(s.c1.x)} ${f(s.c1.y)} ${f(s.c2.x)} ${f(s.c2.y)} ${f(s.p.x)} ${f(s.p.y)}`
          case 'Z':
            return 'Z'
        }
      })
      .join('')
  }

  /** Flatten to polylines. `tol` is the maximum chord error in units. */
  polys(tol = 0.1): Pt[][] {
    const out: Pt[][] = []
    let cur: Pt[] = []
    let last = P(0, 0)
    for (const s of this.segs) {
      if (s.k === 'M') {
        if (cur.length) out.push(cur)
        cur = [s.p]
        last = s.p
      } else if (s.k === 'L') {
        cur.push(s.p)
        last = s.p
      } else if (s.k === 'Z') {
        if (cur.length) {
          out.push(cur)
          last = cur[0]
          cur = []
        }
      } else if (s.k === 'A') {
        cur.push(...flattenArc(last, s.p, s.r, s.large, s.sweep, tol))
        last = s.p
      } else if (s.k === 'Q') {
        const n = steps(dist(last, s.c) + dist(s.c, s.p), tol)
        for (let i = 1; i <= n; i++) {
          const t = i / n,
            u = 1 - t
          cur.push(P(u * u * last.x + 2 * u * t * s.c.x + t * t * s.p.x, u * u * last.y + 2 * u * t * s.c.y + t * t * s.p.y))
        }
        last = s.p
      } else {
        const n = steps(dist(last, s.c1) + dist(s.c1, s.c2) + dist(s.c2, s.p), tol)
        for (let i = 1; i <= n; i++) {
          const t = i / n,
            u = 1 - t
          cur.push(
            P(
              u * u * u * last.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p.x,
              u * u * u * last.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p.y,
            ),
          )
        }
        last = s.p
      }
    }
    if (cur.length) out.push(cur)
    return out
  }
}

/** Segment count for a Bézier of roughly this length. */
const steps = (approxLen: number, tol: number) => Math.max(4, Math.min(64, Math.ceil(Math.sqrt(approxLen / tol))))

/** SVG endpoint arc → points (excludes the start point, includes the end point). */
function flattenArc(p0: Pt, p1: Pt, r: number, large: boolean, sweep: boolean, tol: number): Pt[] {
  const dx = (p0.x - p1.x) / 2,
    dy = (p0.y - p1.y) / 2
  const d2 = dx * dx + dy * dy
  if (d2 === 0) return []
  if (r * r < d2) r = Math.sqrt(d2) // radius too small: scale up (SVG rule)
  const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, (r * r - d2) / d2))
  const cx = k * dy + (p0.x + p1.x) / 2,
    cy = -k * dx + (p0.y + p1.y) / 2
  const a0 = Math.atan2(p0.y - cy, p0.x - cx)
  let da = Math.atan2(p1.y - cy, p1.x - cx) - a0
  if (sweep && da < 0) da += 2 * Math.PI
  if (!sweep && da > 0) da -= 2 * Math.PI
  const n = Math.max(2, Math.ceil(Math.abs(da) / (2 * Math.acos(Math.max(0, 1 - tol / r)))))
  const pts: Pt[] = []
  for (let i = 1; i < n; i++) pts.push(P(cx + r * Math.cos(a0 + (da * i) / n), cy + r * Math.sin(a0 + (da * i) / n)))
  pts.push(p1)
  return pts
}

/** Vertex with an optional corner radius. */
export type V = Pt & { r?: number }
export const v = (x: number, y: number, r = 0): V => ({ x, y, r })

/**
 * Straight segments with a tangent arc (fillet) at each vertex that has r > 0.
 * The radius is reduced automatically when a neighbouring segment is too short.
 */
export function roundPoly(vs: V[], closed = false, path = new Path()): Path {
  const n = vs.length
  for (let i = 0; i < n; i++) {
    const c = vs[i]
    const corner = (c.r ?? 0) > 0 && (closed || (i > 0 && i < n - 1))
    const to = (x: number, y: number) => {
      if (i === 0) path.M(x, y)
      else path.L(x, y)
    }
    if (!corner) {
      to(c.x, c.y)
      continue
    }
    const a = vs[(i - 1 + n) % n],
      b = vs[(i + 1) % n]
    const u1 = unit(sub(c, a)),
      u2 = unit(sub(b, c))
    const cross = u1.x * u2.y - u1.y * u2.x
    const turn = Math.abs(Math.atan2(cross, u1.x * u2.x + u1.y * u2.y))
    if (turn < 1e-3) {
      to(c.x, c.y)
      continue
    }
    let r = c.r!
    let t = r * Math.tan(turn / 2)
    // A neighbour without its own corner can give its whole segment; otherwise share it half and half.
    const room = (q: V, isEnd: boolean) => dist(q, c) * ((q.r ?? 0) > 0 && !isEnd ? 0.5 : 1)
    const maxT = Math.min(room(a, !closed && i - 1 === 0), room(b, !closed && i + 1 === n - 1))
    if (t > maxT) {
      t = maxT
      r = t / Math.tan(turn / 2)
    }
    const p1 = P(c.x - u1.x * t, c.y - u1.y * t),
      p2 = P(c.x + u2.x * t, c.y + u2.y * t)
    to(p1.x, p1.y)
    path.A(r, p2.x, p2.y, cross > 0)
  }
  if (closed) path.Z()
  return path
}

/** Mirror a right-hand half profile (rim first, base last) into a full open outline: left rim → base → right rim. */
export function mirrorProfile(right: V[]): V[] {
  const left = right.map((q) => ({ ...q, x: -q.x }))
  const rightUp = [...right].reverse()
  if (rightUp[0].x === 0) rightUp.shift() // centre point is shared
  return [...left, ...rightUp]
}

/** Rotate (degrees, clockwise on screen) and optionally flip horizontally first. */
export function xf(p: Pt, rot: number, flip = false): Pt {
  const x = flip ? -p.x : p.x,
    a = (rot * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a)
  return P(x * c - p.y * s, x * s + p.y * c)
}

/** Sutherland–Hodgman against a horizontal line. keep = 'below' keeps y >= level (screen-down). */
export function clipH(poly: Pt[], level: number, keep: 'below' | 'above'): Pt[] {
  const inside = (p: Pt) => (keep === 'below' ? p.y >= level : p.y <= level)
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length]
    const ia = inside(a),
      ib = inside(b)
    if (ia) out.push(a)
    if (ia !== ib) {
      const t = (level - a.y) / (b.y - a.y)
      out.push(P(a.x + t * (b.x - a.x), level))
    }
  }
  return out
}

/** Interior x-intervals of a set of polygons on the horizontal line y (even–odd rule). */
export function scan(polys: Pt[][], y: number): [number, number][] {
  const xs: number[] = []
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length]
      if (a.y <= y !== b.y <= y) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x))
    }
  }
  xs.sort((m, n) => m - n)
  const out: [number, number][] = []
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > 0.01) out.push([xs[i], xs[i + 1]])
  return out
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/**
 * A path string as polylines, one for each subpath. Curves are flattened, and a closed subpath ends on its first point.
 * It reads what the kernel writes: M L H V A Q C Z, absolute or relative, circular arcs.
 * Use it to measure a drawing (bounds, nearest point), not to draw it.
 */
export function pathPolys(d: string, tol = 0.25): Pt[][] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? []
  const out: Pt[][] = []
  let pts: Pt[] = []
  let i = 0,
    cur = P(0, 0),
    start = P(0, 0),
    cmd = ''
  const n = () => Number(tokens[i++])
  const curve = (c: Pt[], end: Pt) => {
    // c = one control point (quadratic) or two (cubic)
    const from = cur,
      count = steps(c.reduce((sum, q, k) => sum + dist(k ? c[k - 1] : from, q), 0) + dist(c[c.length - 1], end), tol)
    for (let k = 1; k <= count; k++) {
      const t = k / count,
        u = 1 - t
      pts.push(
        c.length === 1
          ? P(u * u * from.x + 2 * u * t * c[0].x + t * t * end.x, u * u * from.y + 2 * u * t * c[0].y + t * t * end.y)
          : P(
              u * u * u * from.x + 3 * u * u * t * c[0].x + 3 * u * t * t * c[1].x + t * t * t * end.x,
              u * u * u * from.y + 3 * u * u * t * c[0].y + 3 * u * t * t * c[1].y + t * t * t * end.y,
            ),
      )
    }
    cur = end
  }
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++]
    const rel = cmd === cmd.toLowerCase(),
      ox = rel ? cur.x : 0,
      oy = rel ? cur.y : 0
    switch (cmd.toUpperCase()) {
      case 'M':
        if (pts.length) out.push(pts)
        cur = P(ox + n(), oy + n())
        start = cur
        pts = [cur]
        cmd = rel ? 'l' : 'L'
        break
      case 'L':
        cur = P(ox + n(), oy + n())
        pts.push(cur)
        break
      case 'H':
        cur = P(ox + n(), cur.y)
        pts.push(cur)
        break
      case 'V':
        cur = P(cur.x, oy + n())
        pts.push(cur)
        break
      case 'Q':
        curve([P(ox + n(), oy + n())], P(ox + n(), oy + n()))
        break
      case 'C':
        curve([P(ox + n(), oy + n()), P(ox + n(), oy + n())], P(ox + n(), oy + n()))
        break
      case 'A': {
        const r = n()
        n()
        n()
        const large = n() === 1,
          sweep = n() === 1,
          end = P(ox + n(), oy + n())
        pts.push(...flattenArc(cur, end, r, large, sweep, tol))
        cur = end
        break
      }
      case 'Z':
        if (pts.length) pts.push(start)
        cur = start
        break
      default:
        throw new Error(`pathPolys: unsupported command ${cmd}`)
    }
  }
  if (pts.length) out.push(pts)
  return out
}

/** Bounds of a path string. */
export function pathBounds(d: string): Box {
  return bounds(pathPolys(d).flat())
}

/** The point of the segment a–b that is nearest to p. */
export function nearestOnSegment(a: Pt, b: Pt, p: Pt): Pt {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    l2 = dx * dx + dy * dy
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return P(a.x + t * dx, a.y + t * dy)
}

export const polyD = (poly: Pt[], close = true): string => poly.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('') + (close ? 'Z' : '')

export function bounds(pts: Pt[]): Box {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return { x0, y0, x1, y1 }
}

/** Deterministic pseudo-random generator (mulberry32). Same seed gives the same drawing. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const hash = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
