// png.ts — the PNG of an export (section 13): the export picture drawn on a canvas with `renderCanvas`, at the scale
// that `safeScale` allows. `pngCanvas` needs a DOM; `pngSize` does not.

import type { Measure } from '../model/bounds'
import type { Doc } from '../model/types'
import { renderCanvas, safeScale } from './canvas'
import { WHITE, exportPicture, type ExportOptions, type Picture } from './picture'

/** The size in pixels of a picture at a scale, as `renderCanvas` makes it, and the scale that `safeScale` allows. */
export function pngSize(p: Pick<Picture, 'w' | 'h'>, scale: number): { w: number; h: number; scale: number } {
  const k = safeScale(p.w, p.h, scale)
  return { w: Math.max(1, Math.round(p.w * k)), h: Math.max(1, Math.round(p.h * k)), scale: k }
}

/** The PNG of an export, on a canvas: the picture at the scale of the options (or `scale`), on white or transparent. */
export function pngCanvas(doc: Doc, o: ExportOptions, measure: Measure, scale: number = o.scale): HTMLCanvasElement {
  const p = exportPicture(doc, o, measure)
  return renderCanvas(p.nodes, p.w, p.h, scale, o.background === 'white' ? WHITE : null)
}
