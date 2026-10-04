// canvas.ts — PNG through Canvas 2D. No SVG-image round trip: nothing to load, nothing a content policy can block.

import { toCanvas, type Node } from '../kernel/nodes'

/** Browsers refuse very large canvases. Stay under both limits. */
export const MAX_SIDE = 8192
export const MAX_AREA = 16_000_000

/** Largest scale ≤ `wanted` that keeps a w × h drawing inside the canvas limits. */
export function safeScale(w: number, h: number, wanted: number): number {
  return Math.min(wanted, MAX_SIDE / w, MAX_SIDE / h, Math.sqrt(MAX_AREA / (w * h)))
}

/** @param background  CSS colour, or null for a transparent PNG */
export function renderCanvas(nodes: Node[], w: number, h: number, scale: number, background: string | null): HTMLCanvasElement {
  const k = safeScale(w, h, scale)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * k))
  c.height = Math.max(1, Math.round(h * k))
  const ctx = c.getContext('2d')!
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, c.width, c.height)
  }
  ctx.scale(k, k)
  for (const n of nodes) toCanvas(ctx, n)
  return c
}

export const canvasToBlob = (c: HTMLCanvasElement): Promise<Blob> =>
  new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'))
