// TopBar.tsx — title, tools, undo and redo, zoom, snap, photocopy-safe, label mode, files, Copy image, export, help.
// Below FULL_BAR (1540 px) the secondary controls move into a "More" menu. Below 1100 px the panels become drawers.
// Every control has a name, and works from the keyboard: Tab reaches each one, the label-mode switch moves with the
// arrow keys, and the More menu opens with Enter or Space, keeps the focus in order and shuts with Escape.

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useMedia } from './useMedia'
import * as a from '../editor/actions'
import { copyImage, save } from '../editor/files'
import { TOOL_KEYS, modName } from '../editor/keys'
import { useEditor, type Tool } from '../editor/store'
import type { Host } from '../host/host'
import type { DocSettings } from '../model/types'
import { icons } from './icons'
import { RadioSwitch, type RadioOption } from './RadioSwitch'

/** The tools of section 12, in the order of its table. */
const TOOLS: { tool: Tool; label: string; icon: ReactNode }[] = [
  { tool: 'select', label: 'Select', icon: icons.select },
  { tool: 'label', label: 'Label', icon: icons.label },
  { tool: 'text', label: 'Text', icon: icons.text },
  { tool: 'tube', label: 'Tube', icon: icons.tube },
  { tool: 'wire', label: 'Wire', icon: icons.wire },
  { tool: 'line', label: 'Line and arrow', icon: icons.line },
  { tool: 'rect', label: 'Rectangle', icon: icons.rect },
  { tool: 'ellipse', label: 'Ellipse', icon: icons.ellipse },
]

/** A tool's key, for its tooltip. */
const keyOf = (tool: Tool): string => (Object.keys(TOOL_KEYS).find((k) => TOOL_KEYS[k] === tool) ?? '').toUpperCase()

const MODES: RadioOption<DocSettings['labelMode']>[] = [
  { value: 'text', label: 'Text' },
  { value: 'blank', label: 'Blank' },
  { value: 'letters', label: 'Letters' },
]

/**
 * A button that shows and hides a panel of more controls below it (a disclosure). The panel follows the button in the
 * Tab order. Choosing a control in it, a press outside it, the focus leaving it or Escape shuts it; when the focus was
 * in it, the focus goes back to the button.
 */
function Menu({ label, children, align }: { label: string; children: ReactNode; align?: 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useId()
  // A press anywhere else shuts it. The listener captures, so that a press that goes no further (on the card of an
  // empty canvas, in a text box) still shuts it.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close, true)
    return () => window.removeEventListener('pointerdown', close, true)
  }, [open])
  const shut = () => {
    const inside = !!ref.current?.contains(document.activeElement)
    setOpen(false)
    if (inside) button.current?.focus()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      shut()
    }
  }
  const onBlur = (e: FocusEvent) => {
    if (open && e.relatedTarget instanceof Node && !ref.current?.contains(e.relatedTarget)) setOpen(false)
  }
  return (
    <div className="menu" ref={ref} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button ref={button} type="button" aria-expanded={open} aria-controls={open ? panel : undefined} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div id={panel} className={`popover${align === 'right' ? ' right' : ''}`} role="group" aria-label={label} onClick={shut}>
          {children}
        </div>
      )}
    </div>
  )
}

function Title() {
  const title = useEditor((s) => s.doc.title)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(title)
  const commit = () => {
    setEditing(false)
    if (text.trim() && text !== title) a.rename(text.trim())
  }
  if (editing) {
    return (
      <input
        className="title-input"
        aria-label="Title"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
          e.stopPropagation()
        }}
      />
    )
  }
  return (
    <button
      type="button"
      className="title"
      title="Rename"
      aria-label={`Rename: ${title}`}
      onClick={() => {
        setText(title)
        setEditing(true)
      }}
    >
      {title}
    </button>
  )
}

interface Props {
  host: Host
  narrow: boolean
  /** Whether the drawers are open (narrow windows only). */
  libraryOpen: boolean
  inspectorOpen: boolean
  onLibrary(): void
  onInspector(): void
  onHelp(): void
  onOpen(): void
  onExport(): void
}

/**
 * The narrowest window, in CSS px, that shows the whole bar: every control of section 12, with 8 px spacing and a title
 * at least 160 px wide. Below it, the bar keeps the tools, Undo, Redo, Label mode, Copy image and Export, and the More
 * menu holds the rest. Section 12 says 1300 px; with 8 px spacing the whole bar needs 1537 px in Chromium, rounded up
 * to a multiple of 20.
 */
export const FULL_BAR = 1540

export function TopBar({ host, narrow, libraryOpen, inspectorOpen, onLibrary, onInspector, onHelp, onOpen, onExport }: Props) {
  const compact = useMedia(`(max-width: ${FULL_BAR - 1}px)`)
  const tool = useEditor((s) => s.tool)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const zoom = useEditor((s) => s.view.zoom)
  const snap = useEditor((s) => s.prefs.snap)
  const mono = useEditor((s) => s.doc.settings.mono)
  const labelMode = useEditor((s) => s.doc.settings.labelMode)
  const mod = modName()

  const zoomControls = (
    <>
      <button type="button" className="icon-button" aria-label="Zoom out" title="Zoom out (−)" onClick={() => a.zoomStep(-1)}>
        {icons.zoomOut}
      </button>
      <button type="button" className="zoom" aria-label="Zoom to 100%" title="100 % (0)" onClick={a.zoomReset}>
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className="icon-button" aria-label="Zoom in" title="Zoom in (+)" onClick={() => a.zoomStep(1)}>
        {icons.zoomIn}
      </button>
      <button type="button" className="icon-button" aria-label="Fit" title="Fit (1)" onClick={a.fit}>
        {icons.fit}
      </button>
    </>
  )
  const toggles = (
    <>
      <button type="button" aria-pressed={snap} onClick={() => a.prefs({ snap: !snap })}>
        Snap
      </button>
      <button type="button" aria-pressed={mono} onClick={() => a.settings({ mono: !mono })}>
        Photocopy-safe
      </button>
    </>
  )
  const files = (
    <>
      <button type="button" onClick={a.newDiagram}>
        New
      </button>
      <button type="button" onClick={onOpen} title={`Open (${mod}+O)`}>
        Open
      </button>
      <button type="button" onClick={() => void save(host)} title={`Save (${mod}+S)`}>
        Save
      </button>
    </>
  )
  const help = (
    <button type="button" className="icon-button" aria-label="Help" title="Help (?)" onClick={onHelp}>
      {icons.help}
    </button>
  )
  const labelAll = (
    <button type="button" onClick={a.labelAll} title="Add a label for every part that has none">
      Label all
    </button>
  )

  return (
    <header className={compact ? 'topbar' : 'topbar full'}>
      {narrow && (
        <button type="button" className="icon-button" aria-label="Library" aria-expanded={libraryOpen} onClick={onLibrary}>
          {icons.menu}
        </button>
      )}
      <Title />
      <div className="group switch" role="toolbar" aria-label="Tools">
        {TOOLS.map((t) => (
          <button
            key={t.tool}
            type="button"
            className="icon-button"
            aria-label={t.label}
            aria-pressed={tool === t.tool}
            title={`${t.label} (${keyOf(t.tool)})`}
            onClick={() => a.setTool(t.tool)}
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div className="group switch">
        <button type="button" className="icon-button" aria-label="Undo" title={`Undo (${mod}+Z)`} disabled={!canUndo} onClick={a.undo}>
          {icons.undo}
        </button>
        <button type="button" className="icon-button" aria-label="Redo" title={`Redo (${mod}+Shift+Z)`} disabled={!canRedo} onClick={a.redo}>
          {icons.redo}
        </button>
      </div>
      {!compact && <div className="group">{zoomControls}</div>}
      {!compact && <div className="group">{toggles}</div>}
      <RadioSwitch className="group switch" label="Label mode" value={labelMode} options={MODES} onChange={(labelMode) => a.settings({ labelMode })} />
      {!compact && labelAll}
      <span className="spacer" />
      {!compact && <div className="group">{files}</div>}
      <button type="button" className="primary" onClick={() => void copyImage(host)} title={`Copy image: PNG at 2× (${mod}+Shift+C)`}>
        {icons.copy}
        Copy image
      </button>
      <button type="button" onClick={onExport} title="Export a PNG or an SVG">
        Export
      </button>
      {compact ? (
        <Menu label="More" align="right">
          <div className="menu-row">{zoomControls}</div>
          <div className="menu-row">{toggles}</div>
          <div className="menu-row">{labelAll}</div>
          <div className="menu-row">{files}</div>
          <div className="menu-row">{help}</div>
        </Menu>
      ) : (
        help
      )}
      {narrow && (
        <button type="button" className="icon-button" aria-label="Inspector" aria-expanded={inspectorOpen} title="Inspector" onClick={onInspector}>
          {icons.inspector}
        </button>
      )}
    </header>
  )
}
