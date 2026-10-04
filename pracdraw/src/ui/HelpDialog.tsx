// HelpDialog.tsx — the Help button and `?` (section 12): six lines on how to start, and the key table, with Cmd for
// Ctrl on a Mac. A modal dialog: the focus stays in it, Escape or Close shuts it, and the focus goes back.

import { Fragment, useRef } from 'react'
import { isMac, keyParts, keyTable, modName } from '../editor/keys'
import { icons } from './icons'
import { trapTab, useDialogFocus } from './useDialog'

/** How to start: six lines. */
const start = (mod: string): string[] => [
  'Pick a template: on the card of an empty canvas, or in the Templates tab of the library. Or add apparatus from the Apparatus tab: click a part, or drag it to the canvas.',
  'Press / to search the apparatus. Enter adds the first result at the centre of the view; the arrow keys then move it.',
  `Drag a part to move it: parts snap together (hold ${mod} to stop it). The handles resize and turn the selected part.`,
  'The inspector on the right shows the selection: size, turn, contents, reading. With nothing selected it shows the document settings.',
  'Label all labels every part. The label-mode switch turns the labels into blank lines or letters, for a worksheet.',
  'Copy image puts a PNG on the clipboard. Export makes a PNG or an SVG. Save keeps the diagram as a file; Open reads it, or an exported SVG, again.',
]

export function HelpDialog({ onClose }: { onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialogFocus(ref)
  const mac = isMac()
  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          trapTab(e)
          e.stopPropagation()
        }}
      >
        <div className="dialog-head">
          <h2 id="help-title">Help</h2>
          <button type="button" className="icon-button" aria-label="Close help" onClick={onClose}>
            {icons.close}
          </button>
        </div>
        <h3>How to start</h3>
        <ol>
          {start(modName(mac)).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <h3>Keys</h3>
        <table className="keys">
          <tbody>
            {keyTable(mac).map(([key, what]) => (
              <tr key={key}>
                {/* One chip for each key: a long entry wraps between its chips, never inside one. */}
                <td>{keyParts(key).map((part, i) => (part.key ? <kbd key={i}>{part.text}</kbd> : <Fragment key={i}>{part.text}</Fragment>))}</td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
