// FallbackDialog.tsx — when a copy or a download fails (section 13), this dialog gives the file to take by hand: a PNG
// as a picture with the line "Right-click the picture and choose Copy image", an SVG or a saved file as text with a
// Select all button. "Download did not start?" opens it too. The focus stays in it while it is open, and goes back to
// where it was when it closes.

import { useRef } from 'react'
import { closeFallback, copyFallbackText } from '../editor/files'
import { useEditor } from '../editor/store'
import type { Host } from '../host/host'
import { icons } from './icons'
import { trapTab, useDialogFocus } from './useDialog'

export function FallbackDialog({ host }: { host: Host }) {
  const f = useEditor((s) => s.fallback)
  const ref = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLTextAreaElement>(null)
  useDialogFocus(ref, !!f)
  if (!f) return null
  const title = f.why === 'copy' ? 'Copy by hand' : 'Download did not start?'
  const selectAll = () => {
    text.current?.focus()
    text.current?.select()
  }
  return (
    <div className="backdrop fallback-backdrop" onClick={closeFallback}>
      <div
        className="dialog fallback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fallback-title"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeFallback()
          trapTab(e)
          e.stopPropagation()
        }}
      >
        <div className="dialog-head">
          <h2 id="fallback-title">{title}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={closeFallback}>
            {icons.close}
          </button>
        </div>
        {f.kind === 'png' ? (
          <>
            <p>
              <strong>Right-click the picture and choose Copy image.</strong>
              {f.why === 'download' && ' Or choose Save image as, to save it as a file.'}
            </p>
            <div className="fallback-picture">
              <img src={f.url} alt={`The picture: ${f.name}`} />
            </div>
          </>
        ) : (
          <>
            <p>
              {f.why === 'copy'
                ? 'Select all of the text below and copy it.'
                : `Select all of the text below, copy it, and paste it into a new file named ${f.name}.`}
            </p>
            <textarea ref={text} className="fallback-text" readOnly value={f.text} aria-label={`The text of ${f.name}`} spellCheck={false} />
            <div className="dialog-buttons">
              <span className="spacer" />
              <button type="button" onClick={() => void copyFallbackText(host, f.text)}>
                {icons.copy}
                Copy
              </button>
              <button type="button" className="primary" onClick={selectAll}>
                Select all
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
