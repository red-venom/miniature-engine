// HelpDialog.tsx — the key table and how to start. Phase 10 completes it.

import { useEffect, useRef } from 'react'
import { KEY_TABLE } from '../editor/keys'
import { icons } from './icons'

const START = [
  'Pick a template from the Templates tab, or add apparatus from the Apparatus tab.',
  'Press / to search. Enter adds the first result at the centre of the view.',
  'Drag items to move them: parts snap together (hold Ctrl to stop it). Use the handles to resize and turn them.',
  'The inspector on the right shows the properties of the selection.',
  'With nothing selected, the inspector shows the document settings: label mode, photocopy-safe.',
  'Copy image puts a PNG on the clipboard. Export downloads a PNG or an SVG.',
]

export function HelpDialog({ onClose }: { onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => ref.current?.focus(), [])
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
          {START.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
        <h3>Keys</h3>
        <table className="keys">
          <tbody>
            {KEY_TABLE.map(([key, what]) => (
              <tr key={key}>
                <td>
                  <kbd>{key}</kbd>
                </td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
