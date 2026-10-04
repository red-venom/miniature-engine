// measure.ts — the width of one line of label text as drawn (section 13, "Bounds"): canvas measureText in the browser,
// with subscripts and superscripts at 0.7 size, as `toCanvas` draws them. The editor uses it wherever it needs a
// label's drawn width: the selection box, the marquee, align and distribute, and the snap guides. Without a DOM (unit
// tests in Node) it is the estimate, 0.56 × the size for each character.

import { FONT, SCRIPT } from '../kernel/nodes'
import { parseMarkup } from '../kernel/text'
import { estimateWidth, type Measure } from '../model/bounds'

let ctx: CanvasRenderingContext2D | null | undefined
const widths = new Map<string, number>()
const CACHE_LIMIT = 4000

function context(): CanvasRenderingContext2D | null {
  if (ctx === undefined) ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  return ctx
}

/** The width of a line exactly as typed, markup characters and all, in the label font: the text box shows it so. */
export function typedWidth(text: string, size: number): number {
  const c = context()
  if (!c) return text.length * size * 0.56
  c.font = `${size}px ${FONT}`
  return c.measureText(text).width
}

/** The width of a line of markup (`parseMarkup`) at a size, as drawn. Smart text is applied by the caller. */
export const measureText: Measure = (text, size) => {
  const c = context()
  if (!c) return estimateWidth(text, size)
  const key = `${size} ${text}`
  let w = widths.get(key)
  if (w === undefined) {
    w = 0
    for (const r of parseMarkup(text)) {
      c.font = `${r.script === 'normal' ? size : size * SCRIPT.scale}px ${FONT}`
      w += c.measureText(r.text).width
    }
    if (widths.size >= CACHE_LIMIT) widths.clear()
    widths.set(key, w)
  }
  return w
}
