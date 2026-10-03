// TextBox.tsx — the text box of a label (section 11): an HTML textarea over the canvas at the label's text anchor, in
// the label's font and size at the zoom, showing the text as typed. Text on the left of its target ends at the anchor,
// so the box grows to the left; text on the right starts at the anchor. Enter commits, Shift+Enter starts a new line,
// Escape cancels. The editor's keys do nothing while the box has the focus (keys.ts ignores text fields). A press on the
// canvas outside the box commits the text (Canvas.tsx), and so does the focus going to another control.

import { useEffect, useRef } from 'react'
import { cancelText, commitText, typeText } from '../editor/actions'
import { typedWidth } from '../editor/measure'
import type { TextEdit, View } from '../editor/store'
import { toScreen } from '../editor/view'
import { P } from '../kernel/geom'
import { FONT } from '../kernel/nodes'
import { labelSize } from '../model/labels'
import type { Doc } from '../model/types'

/** Line height, × the size: the label's own line spacing. */
const LINE = 1.25
/** The baseline of the first line, below the top of the text, × the size: Arial at a line height of 1.25. */
const BASELINE = 0.97
/** Border and padding on each side, in px. */
const PAD = 3

export function TextBox({ edit, view, doc }: { edit: TextEdit; view: View; doc: Doc }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const { label } = edit
  // When the box opens, it takes the focus with its text selected: a symbol's label text is replaced by typing.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus({ preventScroll: true })
    el.select()
  }, [label.id])
  const px = labelSize(doc, label) * view.zoom
  const lines = edit.text.split('\n')
  // Room for the widest line and the caret, and at least three characters.
  const width = Math.ceil(Math.max(px * 3, ...lines.map((l) => typedWidth(l, px))) + px * 0.6) + 2 * PAD
  const height = Math.ceil(lines.length * px * LINE) + 2 * PAD
  const a = toScreen(view, P(label.x, label.y))
  const left = label.side === 'left' ? a.x + PAD - width : a.x - PAD
  const top = a.y - BASELINE * px - PAD
  return (
    <textarea
      ref={ref}
      className="text-box"
      aria-label={label.target ? 'Label text' : 'Plain text'}
      value={edit.text}
      rows={lines.length}
      wrap="off"
      spellCheck={false}
      autoComplete="off"
      style={{ left, top, width, height, fontSize: px, lineHeight: LINE, fontFamily: FONT, textAlign: label.side === 'left' ? 'right' : 'left' }}
      onChange={(e) => typeText(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          commitText()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          cancelText()
        }
      }}
      // The focus going to another control commits; the window losing the focus does not.
      onBlur={() => {
        if (document.hasFocus()) commitText()
      }}
      // The box's own presses select text: they are not presses on the canvas.
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  )
}
