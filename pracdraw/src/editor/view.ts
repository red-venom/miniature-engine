// view.ts — pan and zoom arithmetic. Pure.

import { P, dist, type Box, type Pt } from '../kernel/geom'
import { ZOOM_MAX, ZOOM_MIN, type View } from './store'

export const FIT_MARGIN = 40

export const toScreen = (v: View, p: Pt): Pt => P(p.x * v.zoom + v.x, p.y * v.zoom + v.y)
export const toWorld = (v: View, p: Pt): Pt => P((p.x - v.x) / v.zoom, (p.y - v.y) / v.zoom)

/** The world point at the centre of the canvas. */
export const viewCentre = (v: View, canvas: { w: number; h: number }): Pt => toWorld(v, P(canvas.w / 2, canvas.h / 2))

export const clampZoom = (z: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

/** Zoom so that the world point under `at` (screen px) stays where it is. */
export function zoomAt(v: View, zoom: number, at: Pt): View {
  const z = clampZoom(zoom)
  const w = toWorld(v, at)
  return { zoom: z, x: at.x - w.x * z, y: at.y - w.y * z }
}

/**
 * Two fingers on the canvas (section 12, "Touch"). `from` is where they came down, `to` is where they are now, in screen
 * px. The world point that was under the middle of the two fingers stays under their middle, and the zoom changes by
 * the change in the distance between them. So a pinch zooms about its centre, and two fingers that move together pan.
 */
export function pinchView(v0: View, from: readonly [Pt, Pt], to: readonly [Pt, Pt]): View {
  const mid = (a: Pt, b: Pt): Pt => P((a.x + b.x) / 2, (a.y + b.y) / 2)
  const d0 = dist(from[0], from[1]),
    d1 = dist(to[0], to[1])
  const zoom = clampZoom(d0 > 0 && d1 > 0 ? (v0.zoom * d1) / d0 : v0.zoom)
  const w = toWorld(v0, mid(from[0], from[1])),
    c = mid(to[0], to[1])
  return { zoom, x: c.x - w.x * zoom, y: c.y - w.y * zoom }
}

/** Show the whole box with a margin, as large as the canvas allows within the zoom limits. */
export function fitView(box: Box | null, canvas: { w: number; h: number }, margin = FIT_MARGIN): View {
  if (!box || box.x1 <= box.x0 || box.y1 <= box.y0) return { x: Math.round(canvas.w / 2), y: Math.round(canvas.h / 2), zoom: 1 }
  const z = clampZoom(Math.min((canvas.w - 2 * margin) / (box.x1 - box.x0), (canvas.h - 2 * margin) / (box.y1 - box.y0)))
  return { zoom: z, x: canvas.w / 2 - ((box.x0 + box.x1) / 2) * z, y: canvas.h / 2 - ((box.y0 + box.y1) / 2) * z }
}

/** 100 % about the canvas centre, with whole-pixel offsets so that the drawing sits on the pixel grid. */
export function zoom100(v: View, canvas: { w: number; h: number }): View {
  const z = zoomAt(v, 1, P(canvas.w / 2, canvas.h / 2))
  return { zoom: 1, x: Math.round(z.x), y: Math.round(z.y) }
}

/** A world box as a screen rectangle (CSS px from the canvas origin). */
export function screenBox(v: View, b: Box): Box {
  const a = toScreen(v, P(b.x0, b.y0)),
    c = toScreen(v, P(b.x1, b.y1))
  return { x0: a.x, y0: a.y, x1: c.x, y1: c.y }
}
