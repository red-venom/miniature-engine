// hook.ts — the one test hook, window.__pracdraw (section 14). It replaces window.__starter from the kit.

import type { ExportOptions } from '../export/picture'
import { hostName, type HostName } from '../host/current'
import type { Doc } from '../model/types'
import { loadDoc } from './actions'
import { defaultPicture, pngDataUrl, svgText } from './files'
import { useEditor, type View } from './store'
import { screenBox } from './view'

export interface PracdrawHook {
  /** The current document. */
  doc(): Doc
  /** Replace the document as one undo step. */
  load(doc: Doc): void
  /**
   * A data: URL of a PNG export at this scale, at once, cropped to `docBounds`. With no `options` it is the default
   * export: on white, labels and photocopy-safe as shown. `options` are the export dialog's controls (labels, answerKey,
   * mono, background), merged over `DEFAULT_EXPORT`.
   */
  png(scale: number, options?: Partial<ExportOptions>): string
  /** An SVG export, with the document as metadata. With no `options` it is the default export; `options` are merged over it as for `png`. */
  svg(options?: Partial<ExportOptions>): string
  /** The pan and zoom; with an argument, set them. */
  view(v?: Partial<View>): View
  /** Where the exported picture sits on the page, in CSS px, for a screenshot of the same region. */
  screenRect(): { x: number; y: number; width: number; height: number }
  /** The host the app talks to: the web host, or the Claude host once `window.claude.use('downloads')` has answered. */
  host(): HostName
}

declare global {
  interface Window {
    __pracdraw: PracdrawHook
  }
}

export function installHook(canvasRect: () => { left: number; top: number }): void {
  window.__pracdraw = {
    doc: () => useEditor.getState().doc,
    load: (doc) => loadDoc(doc),
    png: (scale, options) => pngDataUrl(useEditor.getState().doc, scale, options),
    svg: (options) => svgText(useEditor.getState().doc, options),
    view: (v) => {
      if (v) useEditor.getState().setView(v)
      return useEditor.getState().view
    },
    screenRect: () => {
      const s = useEditor.getState()
      const p = defaultPicture(s.doc)
      const b = screenBox(s.view, { x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h })
      const r = canvasRect()
      return { x: r.left + b.x0, y: r.top + b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0 }
    },
    host: hostName,
  }
}
