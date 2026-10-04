// files.ts — the files of section 13: their names, the saved file's text, and reading a file that is opened.

import { parseDocJson, type ParseResult } from '../model/parse'
import type { Doc } from '../model/types'
import { exportLabelMode, type ExportOptions } from './picture'
import { docFromSvg } from './svg'

/** The characters that a file name may not hold (section 7): each becomes -. So does each control character. */
const FORBIDDEN = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])
const isControl = (code: number) => code < 0x20 || (code >= 0x7f && code < 0xa0)

/**
 * A title as a file name (section 7): each of the characters \ / : * ? " < > | and each control character becomes -,
 * and an empty name becomes "diagram". Spaces at either end are dropped first, so a title of spaces is empty.
 */
export function safeName(title: string): string {
  const name = [...title.trim()].map((c) => (FORBIDDEN.has(c) || isControl(c.codePointAt(0)!) ? '-' : c)).join('')
  return name || 'diagram'
}

/** `<title><ext>`, with the title made safe. */
export const fileName = (title: string, ext: string): string => safeName(title) + ext

/** What Save writes: `<title>.pracdraw.json`. */
export const SAVE_EXT = '.pracdraw.json'
export const saveName = (doc: Doc): string => fileName(doc.title, SAVE_EXT)

/** The saved file: the document as JSON, indented with two spaces (section 7). */
export const saveText = (doc: Doc): string => JSON.stringify(doc, null, 2)

/**
 * The name of an export: `<title>.png`, `<title>-blank.png` or `<title>-letters.png`, and the same with `.svg`, by the
 * label mode that the export draws.
 */
export function exportName(doc: Doc, o: Pick<ExportOptions, 'format' | 'labels'>): string {
  const mode = exportLabelMode(doc, o)
  return fileName(doc.title, `${mode === 'text' ? '' : `-${mode}`}.${o.format}`)
}

/**
 * The document in a file that is opened: a `.pracdraw.json` (any JSON), or an SVG that PracDraw exported. An SVG is
 * known by its name or by its text, which starts with "<".
 */
export function readDocFile(text: string, name = ''): ParseResult {
  if (/\.svg$/i.test(name) || /^\uFEFF?\s*</.test(text)) return docFromSvg(text)
  return parseDocJson(text)
}
