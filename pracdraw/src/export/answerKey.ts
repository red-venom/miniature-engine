// answerKey.ts — the answer key of a worksheet in letters mode (section 11 of the specification): a list under the
// diagram with one line for each letter, "A  conical flask", in draw order, at the label size with 1.25 line spacing.
// It starts 24 u below the diagram and lines up with its left edge. It is render-tree nodes, so the screen, the SVG
// file and the PNG draw the same key. Pure. The export dialog (phase 7) offers it.

import type { Box } from '../kernel/geom'
import type { Node, TextNode } from '../kernel/nodes'
import { parseMarkup, smartChem, type Run } from '../kernel/text'
import { estimateWidth, type Measure } from '../model/bounds'
import type { Doc, LabelItem } from '../model/types'
import { INK, labelLetters } from '../render/render'

/** The key starts this far below the diagram, in units. */
export const KEY_GAP = 24
/** Line spacing, × the label size. */
export const KEY_LINE = 1.25
/** The space between a letter and its text, × the label size: about two spaces of Arial. */
export const KEY_SPACE = 0.6

export interface KeyLine {
  letter: string
  /** The label's text as typed, its lines joined by a space. */
  text: string
  /** Smart text for this label: its own setting, or the document's. */
  smart: boolean
}

/** One line for each label with a leader, in the order of its letter (draw order): the letter and the label's text. */
export function answerKeyLines(doc: Doc): KeyLine[] {
  return [...labelLetters(doc)].map(([id, letter]) => {
    const it = doc.items[id] as LabelItem
    const text = it.text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ')
    return { letter, text, smart: it.smart ?? doc.settings.smartText }
  })
}

export interface AnswerKey {
  /** One group: for each line, the letter at the diagram's left edge and the text in a column to its right. */
  nodes: Node[]
  /** The key's own box, for the bounds of the export. */
  box: Box
  lines: KeyLine[]
}

const textNode = (x: number, y: number, runs: Run[], size: number): TextNode => ({ t: 'text', x, y, runs, size, anchor: 'start', fill: INK })

/**
 * The answer key under a diagram whose drawn box is `diagram` (its bounds without the 16 u margin of the export).
 * The top of the first line is 24 u below the diagram; each further line is 1.25 × the label size lower. The letters
 * are at the diagram's left edge; the texts start one letter width and about two spaces further on, so that they line
 * up. `measure` gives the width of one line of markup as drawn (section 13, "Bounds"). Null when no label has a
 * letter.
 */
export function answerKey(doc: Doc, diagram: Box, measure: Measure = estimateWidth): AnswerKey | null {
  const lines = answerKeyLines(doc)
  if (!lines.length) return null
  const size = doc.settings.labelSize
  const x0 = diagram.x0,
    top = diagram.y1 + KEY_GAP
  const column = x0 + Math.max(...lines.map((l) => measure(l.letter, size))) + KEY_SPACE * size
  const baseline = (i: number) => top + size + i * size * KEY_LINE
  const kids: Node[] = []
  let x1 = column
  lines.forEach((l, i) => {
    const shown = l.smart ? smartChem(l.text) : l.text
    kids.push(textNode(x0, baseline(i), [{ text: l.letter, script: 'normal' }], size))
    kids.push(textNode(column, baseline(i), parseMarkup(shown), size))
    x1 = Math.max(x1, column + measure(shown, size))
  })
  return {
    nodes: [{ t: 'g', key: 'answerKey', kids }],
    box: { x0, y0: top, x1, y1: baseline(lines.length - 1) + 0.3 * size },
    lines,
  }
}
