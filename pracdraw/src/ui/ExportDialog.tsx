// ExportDialog.tsx — one dialog exports the diagram (section 13): Format, Size, Background, Labels, Answer key and
// Photocopy-safe, then Copy or Download. A preview shows the picture as the options draw it. After a download the
// dialog offers "Download did not start?", which opens the fallback dialog with the same file. Each row is a radio
// group: Tab reaches its chosen option, and the arrow keys choose another. The focus stays in the dialog.

import { useId, useMemo, useRef, useState } from 'react'
import { copyExport, downloadExport, openFallback } from '../editor/files'
import { measureText } from '../editor/measure'
import { useEditor, type Fallback } from '../editor/store'
import { exportName } from '../export/files'
import { DEFAULT_EXPORT, exportLabelMode, exportPicture, type ExportOptions, type Picture } from '../export/picture'
import { pngSize } from '../export/png'
import type { Host } from '../host/host'
import { NodeView } from '../render/NodeView'
import { icons } from './icons'
import { RadioSwitch, type RadioOption as Option } from './RadioSwitch'
import { trapTab, useDialogFocus } from './useDialog'

/** One row of the dialog: its name and a switch of options (radio buttons). */
function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  note,
}: {
  label: string
  value: T
  options: Option<T>[]
  onChange(v: T): void
  disabled?: boolean
  note?: string
}) {
  const id = useId()
  return (
    <div className="export-row">
      <span className="export-name" id={id}>
        {label}
      </span>
      <RadioSwitch labelledBy={id} value={value} options={options} onChange={onChange} disabled={disabled} />
      {note && <span className="muted export-note">{note}</span>}
    </div>
  )
}

const FORMATS: Option<ExportOptions['format']>[] = [
  { value: 'png', label: 'PNG' },
  { value: 'svg', label: 'SVG' },
]
const SCALES: Option<ExportOptions['scale']>[] = [
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
]
const BACKGROUNDS: Option<ExportOptions['background']>[] = [
  { value: 'white', label: 'White' },
  { value: 'transparent', label: 'Transparent' },
]
const LABELS: Option<ExportOptions['labels']>[] = [
  { value: 'shown', label: 'As shown' },
  { value: 'text', label: 'Text' },
  { value: 'blank', label: 'Blank' },
  { value: 'letters', label: 'Letters' },
]
const MONOS: Option<ExportOptions['mono']>[] = [
  { value: 'shown', label: 'As shown' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

/** The picture as the options draw it, fitted to the preview box. A transparent background shows as a check. */
function Preview({ p, clear }: { p: Picture; clear: boolean }) {
  return (
    <div className={`export-preview${clear ? ' clear' : ''}`}>
      <svg viewBox={`0 0 ${p.w} ${p.h}`} role="img" aria-label="Preview of the export">
        {p.nodes.map((n, i) => (
          <NodeView key={i} n={n} />
        ))}
      </svg>
    </div>
  )
}

/** What the export will be: the file name, and its size in pixels (PNG) or in units (SVG). */
function summary(name: string, p: Picture, o: ExportOptions): string {
  if (o.format === 'svg') return `${name} · ${p.w} × ${p.h} u`
  const px = pngSize(p, o.scale)
  const reduced = px.scale < o.scale - 1e-9 ? ` (${Math.round(px.scale * 100) / 100}×: the largest the browser can draw)` : ''
  return `${name} · ${px.w} × ${px.h} px${reduced}`
}

interface Done {
  message: string
  /** After a download that was saved: what "Download did not start?" opens. */
  retry: (() => Promise<Fallback>) | null
}

export function ExportDialog({ host, onClose }: { host: Host; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null)
  const doc = useEditor((s) => s.doc)
  const [o, setO] = useState<ExportOptions>(DEFAULT_EXPORT)
  const [done, setDone] = useState<Done | null>(null)
  const [busy, setBusy] = useState(false)
  const picture = useMemo(() => exportPicture(doc, o, measureText), [doc, o])
  const letters = exportLabelMode(doc, o) === 'letters'
  const keyId = useId()
  useDialogFocus(ref)

  const set = (patch: Partial<ExportOptions>) => {
    setO({ ...o, ...patch })
    setDone(null)
  }
  const copy = () => {
    // The copy starts inside the click: nothing is awaited before the clipboard write.
    setDone(null)
    void copyExport(host, o).then((ok) => setDone(ok ? { message: o.format === 'png' ? 'Copied the picture.' : 'Copied the SVG as text.', retry: null } : null))
  }
  const download = async () => {
    setBusy(true)
    setDone(null)
    try {
      const r = await downloadExport(host, o)
      if (r.result === 'saved') setDone({ message: `Saved ${exportName(doc, o)}.`, retry: r.retry })
      else if (r.result === 'cancelled') setDone({ message: 'Download cancelled.', retry: null })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
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
          <h2 id="export-title">Export</h2>
          <button type="button" className="icon-button" aria-label="Close export" onClick={onClose}>
            {icons.close}
          </button>
        </div>
        <Preview p={picture} clear={o.background === 'transparent'} />
        <div className="export-rows">
          <Choice label="Format" value={o.format} options={FORMATS} onChange={(format) => set({ format })} />
          <Choice label="Size" value={o.scale} options={SCALES} onChange={(scale) => set({ scale })} disabled={o.format !== 'png'} note="PNG only" />
          <Choice label="Background" value={o.background} options={BACKGROUNDS} onChange={(background) => set({ background })} />
          <Choice label="Labels" value={o.labels} options={LABELS} onChange={(labels) => set({ labels })} />
          <div className="export-row">
            <span className="export-name" id={keyId}>
              Answer key
            </span>
            <label className="export-check">
              <input
                type="checkbox"
                aria-labelledby={keyId}
                checked={o.answerKey && letters}
                disabled={!letters}
                onChange={(e) => set({ answerKey: e.target.checked })}
              />
              Under the diagram
            </label>
            <span className="muted export-note">Letters only</span>
          </div>
          <Choice label="Photocopy-safe" value={o.mono} options={MONOS} onChange={(mono) => set({ mono })} />
        </div>
        <p className="muted export-summary">{summary(exportName(doc, o), picture, o)}</p>
        <div className="dialog-buttons">
          {done && (
            <span className="export-done" aria-live="polite">
              {done.message}
            </span>
          )}
          {done?.retry && (
            <button type="button" className="link" onClick={() => void done.retry!().then(openFallback)}>
              Download did not start?
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={copy} disabled={busy}>
            {icons.copy}
            Copy
          </button>
          <button type="button" className="primary" onClick={() => void download()} disabled={busy}>
            {icons.download}
            Download
          </button>
        </div>
      </div>
    </div>
  )
}
