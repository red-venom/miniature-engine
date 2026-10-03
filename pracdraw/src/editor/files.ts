// files.ts — Save, Open, Copy image, the export dialog's Copy and Download, the fallback dialog and the problem banner
// (section 13). All contact with the outside goes through the host. There is no alert, confirm or prompt: a copy or a
// download that fails opens the fallback dialog, and what Open had to change goes to a banner that does not block.

import { canvasToBlob } from '../export/canvas'
import { exportName, readDocFile, saveName, saveText } from '../export/files'
import { DEFAULT_EXPORT, exportPicture, exportSvg, type ExportOptions, type Picture } from '../export/picture'
import { pngCanvas } from '../export/png'
import type { Host } from '../host/host'
import type { Doc } from '../model/types'
import { fit, loadDoc } from './actions'
import { measureText } from './measure'
import { useEditor, type Fallback } from './store'

const state = () => useEditor.getState()

export type SaveResult = 'saved' | 'cancelled' | 'failed'

// ---------------------------------------------------------------- the default export (Copy image and the test hook)

/** The SVG options of the default export. */
const DEFAULT_SVG: ExportOptions = { ...DEFAULT_EXPORT, format: 'svg' }

/** The picture of the default export: on white, labels and photocopy-safe as shown, text measured as drawn. */
export const defaultPicture = (doc: Doc): Picture => exportPicture(doc, DEFAULT_EXPORT, measureText)

/** A data: URL of the default PNG export at a scale, at once. */
export const pngDataUrl = (doc: Doc, scale: number): string => pngCanvas(doc, DEFAULT_EXPORT, measureText, scale).toDataURL('image/png')

/** The default SVG export, with the document as metadata. */
export const svgText = (doc: Doc): string => exportSvg(doc, DEFAULT_SVG, measureText)

// ---------------------------------------------------------------- the fallback dialog and the banner

export const openFallback = (f: Fallback): void => state().setFallback(f)
export const closeFallback = (): void => state().setFallback(null)
export const closeBanner = (): void => state().setBanner(null)

/** A Blob as a data: URL: the picture of the fallback dialog. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error ?? new Error('FileReader failed'))
    r.readAsDataURL(blob)
  })
}

// ---------------------------------------------------------------- copy

/**
 * Copy a PNG export as an image. The picture is drawn, and the clipboard write starts, inside the click: the promise of
 * the PNG goes to the clipboard before anything is awaited (section 13). When the copy fails, the fallback dialog shows
 * the picture, to copy by hand.
 */
function copyPng(host: Host, doc: Doc, o: ExportOptions): Promise<boolean> {
  let canvas: HTMLCanvasElement
  try {
    canvas = pngCanvas(doc, o, measureText)
  } catch {
    return Promise.resolve(false)
  }
  return host.copyImage(canvasToBlob(canvas)).then((ok) => {
    if (!ok) openFallback({ kind: 'png', why: 'copy', name: exportName(doc, o), url: canvas.toDataURL('image/png') })
    return ok
  })
}

/** Copy image (the top bar, Ctrl+Shift+C): the default export, a PNG at 2× on white as shown, in one click. */
export function copyImage(host: Host): Promise<boolean> {
  return copyPng(host, state().doc, DEFAULT_EXPORT).then((ok) => {
    state().setStatus(ok ? 'Copied' : 'Copy failed')
    return ok
  })
}

/** The export dialog's Copy: a PNG as an image, an SVG as text. When the copy fails, the fallback dialog opens. */
export function copyExport(host: Host, o: ExportOptions): Promise<boolean> {
  const doc = state().doc
  if (o.format === 'png') {
    return copyPng(host, doc, o).then((ok) => {
      state().setStatus(ok ? 'Copied' : 'Copy failed')
      return ok
    })
  }
  const text = exportSvg(doc, o, measureText)
  return host.copyText(text).then((ok) => {
    if (!ok) openFallback({ kind: 'text', why: 'copy', name: exportName(doc, o), text })
    state().setStatus(ok ? 'Copied the SVG as text' : 'Copy failed')
    return ok
  })
}

/** Copy the text of the fallback dialog (an SVG or a saved file) through the host. */
export async function copyFallbackText(host: Host, text: string): Promise<boolean> {
  const ok = await host.copyText(text)
  state().setStatus(ok ? 'Copied as text' : 'Copy failed')
  return ok
}

// ---------------------------------------------------------------- download and save

const said = (result: SaveResult, name: string, what: string) =>
  result === 'saved' ? `Saved ${name}` : result === 'cancelled' ? `${what} cancelled` : `${what} failed`

/**
 * The export dialog's Download. A download that fails opens the fallback dialog. One that is saved gives `retry`: what
 * "Download did not start?" opens, since a web page cannot tell that the browser blocked a download (section 13).
 */
export async function downloadExport(host: Host, o: ExportOptions): Promise<{ result: SaveResult; retry: (() => Promise<Fallback>) | null }> {
  const doc = state().doc
  const name = exportName(doc, o)
  let blob: Blob
  let fallback: () => Promise<Fallback>
  try {
    if (o.format === 'png') {
      const png = await canvasToBlob(pngCanvas(doc, o, measureText))
      blob = png
      fallback = async () => ({ kind: 'png', why: 'download', name, url: await blobToDataUrl(png) })
    } else {
      const text = exportSvg(doc, o, measureText)
      blob = new Blob([text], { type: 'image/svg+xml' })
      fallback = async () => ({ kind: 'text', why: 'download', name, text })
    }
  } catch {
    state().setStatus('Download failed')
    return { result: 'failed', retry: null }
  }
  const result = await host.saveFile(name, blob)
  state().setStatus(said(result, name, 'Download'))
  if (result === 'failed') openFallback(await fallback())
  return { result, retry: result === 'saved' ? fallback : null }
}

/**
 * Save (Ctrl+S): the document as `<title>.pracdraw.json`, indented with two spaces. When it is saved, the status bar
 * offers "Download did not start?"; when it fails, the fallback dialog shows the file's text. Cancelled says so.
 */
export async function save(host: Host): Promise<SaveResult> {
  const doc = state().doc
  const name = saveName(doc),
    text = saveText(doc)
  const fallback: Fallback = { kind: 'text', why: 'download', name, text }
  const result = await host.saveFile(name, new Blob([text], { type: 'application/json' }))
  state().setStatus(said(result, name, 'Save'), result === 'saved' ? fallback : null)
  if (result === 'failed') openFallback(fallback)
  return result
}

// ---------------------------------------------------------------- open

/**
 * Open the text of a file: a `.pracdraw.json`, or an SVG that PracDraw exported. The document replaces the diagram as
 * one undo step, and the view fits it. What `parseDoc` had to leave out or change goes to the banner. A file that
 * cannot be read leaves the diagram as it is, and the banner says why.
 */
export function openText(text: string, name: string): boolean {
  const file = name ? `"${name}"` : 'the file'
  const r = readDocFile(text, name)
  if (!r.ok) {
    state().setBanner({ title: `Could not open ${file}`, problems: r.problems })
    state().setStatus('Open failed')
    return false
  }
  loadDoc(r.doc)
  fit()
  state().setBanner(r.problems.length ? { title: `Opened ${file} with changes`, problems: r.problems } : null)
  state().setStatus(name ? `Opened ${name}` : 'Opened')
  return true
}

/** Open a file from the file chooser or from a drop on the canvas. */
export async function openFile(file: File): Promise<boolean> {
  let text: string
  try {
    text = await file.text()
  } catch {
    state().setBanner({ title: `Could not open "${file.name}"`, problems: ['The file could not be read.'] })
    return false
  }
  return openText(text, file.name)
}
