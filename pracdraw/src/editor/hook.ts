// hook.ts — the one test hook, window.__pracdraw (section 14). It replaces window.__starter from the kit.

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
  /** A data: URL of the default PNG export at this scale, at once: on white, as shown, cropped to `docBounds`. */
  png(scale: number): string
  /** The default SVG export, with the document as metadata. */
  svg(): string
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
    png: (scale) => pngDataUrl(useEditor.getState().doc, scale),
    svg: () => svgText(useEditor.getState().doc),
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
