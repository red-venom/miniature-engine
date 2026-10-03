// picture.ts — what an export draws (section 13): the diagram with the export dialog's overrides, the answer key when
// it is on, cropped to `docBounds`. The PNG (png.ts) and the SVG file (`exportSvg`) both draw this picture, so they
// cannot differ. Pure: text width comes from `measure` (canvas measureText in the browser, the estimate in Node).

import { svgDocument, translate, type Node } from '../kernel/nodes'
import { docBounds, drawnBox, estimateWidth, type Measure } from '../model/bounds'
import type { Doc, DocSettings, Item } from '../model/types'
import { itemNode, labelLetters } from '../render/render'
import { answerKey } from './answerKey'

export type ExportFormat = 'png' | 'svg'
export type ExportScale = 1 | 2 | 4
export type ExportBackground = 'white' | 'transparent'
/** 'shown' keeps the document's label mode. */
export type ExportLabels = 'shown' | DocSettings['labelMode']
/** 'shown' keeps the document's photocopy-safe setting. */
export type ExportMono = 'shown' | 'on' | 'off'

/** The controls of the export dialog (section 13). */
export interface ExportOptions {
  format: ExportFormat
  /** PNG only: pixels for each unit. */
  scale: ExportScale
  background: ExportBackground
  labels: ExportLabels
  /** Letters only: the answer key under the diagram. */
  answerKey: boolean
  mono: ExportMono
}

/** The default export: what "Copy image" does in one click. PNG at 2×, on white, as shown. */
export const DEFAULT_EXPORT: ExportOptions = { format: 'png', scale: 2, background: 'white', labels: 'shown', answerKey: false, mono: 'shown' }

/** The colour of a white background. */
export const WHITE = '#ffffff'

/** The label mode that the export draws. */
export const exportLabelMode = (doc: Doc, o: Pick<ExportOptions, 'labels'>): DocSettings['labelMode'] =>
  o.labels === 'shown' ? doc.settings.labelMode : o.labels

/** The document as the export draws it: the dialog's label mode and photocopy-safe setting in place of its own. */
export function exportDoc(doc: Doc, o: Pick<ExportOptions, 'labels' | 'mono'>): Doc {
  const labelMode = exportLabelMode(doc, o)
  const mono = o.mono === 'shown' ? doc.settings.mono : o.mono === 'on'
  if (labelMode === doc.settings.labelMode && mono === doc.settings.mono) return doc
  return { ...doc, settings: { ...doc.settings, labelMode, mono } }
}

/** True when the export draws the answer key: it is on, and the labels are letters. */
export const showsKey = (doc: Doc, o: Pick<ExportOptions, 'labels' | 'answerKey'>): boolean => o.answerKey && exportLabelMode(doc, o) === 'letters'

/**
 * Every item's nodes, back to front, labels last (as `docNodes`). An item that cannot be drawn (the kernel throws, for
 * a file from elsewhere) is drawn as nothing, as on the screen, so that one bad item cannot stop an export.
 */
export function diagramNodes(doc: Doc): Node[] {
  const letters = doc.settings.labelMode === 'letters' ? labelLetters(doc) : undefined
  const items = doc.order.map((id) => doc.items[id]).filter((it): it is Item => !!it)
  return [...items.filter((it) => it.type !== 'label'), ...items.filter((it) => it.type === 'label')].map((it): Node => {
    try {
      return itemNode(doc, it, letters)
    } catch {
      return { t: 'g', key: it.id, kids: [] }
    }
  })
}

/** An export picture: its nodes, moved so that the top-left corner of its box is the origin, and that box in world units. */
export interface Picture {
  nodes: Node[]
  x: number
  y: number
  w: number
  h: number
}

/**
 * The picture of an export: the diagram as the options draw it, and the answer key under it when the key is shown,
 * cropped to `docBounds`. The box is rounded out to whole units, so that a PNG at 100 % lines up with the pixels of the
 * screen.
 */
export function exportPicture(doc: Doc, o: Pick<ExportOptions, 'labels' | 'mono' | 'answerKey'>, measure: Measure = estimateWidth): Picture {
  const d = exportDoc(doc, o)
  const drawn = showsKey(doc, o) ? drawnBox(d, measure) : null
  const key = drawn ? answerKey(d, drawn, measure) : null
  const b = docBounds(d, measure, key?.box ?? null)
  const x = Math.floor(b.x),
    y = Math.floor(b.y)
  const w = Math.max(1, Math.ceil(b.x + b.w) - x),
    h = Math.max(1, Math.ceil(b.y + b.h) - y)
  return { nodes: [{ t: 'g', m: translate(-x, -y), kids: [...diagramNodes(d), ...(key?.nodes ?? [])] }], x, y, w, h }
}

/**
 * The SVG file: plain SVG of the picture, on white or transparent, with the editor's document as JSON in its
 * `<metadata>` — the document itself, without the dialog's overrides — so that the file can be opened again.
 */
export function exportSvg(doc: Doc, o: ExportOptions, measure: Measure = estimateWidth): string {
  const p = exportPicture(doc, o, measure)
  return svgDocument(p.nodes, p.w, p.h, o.background === 'white' ? WHITE : undefined, JSON.stringify(doc))
}
