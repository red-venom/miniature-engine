// TopBar.tsx — title, tools, undo and redo, zoom, snap, photocopy-safe, label mode, files, Copy image, export, help.
// Below 1300 px the secondary controls move into a "More" menu. Below 1100 px the panels become drawers.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMedia } from './useMedia'
import * as a from '../editor/actions'
import { TOOL_KEYS } from '../editor/keys'
import { useEditor, type Tool } from '../editor/store'
import type { Host } from '../host/host'
import type { DocSettings } from '../model/types'
import { icons } from './icons'

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

const MODES: { value: DocSettings['labelMode']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'blank', label: 'Blank' },
  { value: 'letters', label: 'Letters' },
]

function Menu({ label, icon, children, align }: { label: string; icon?: ReactNode; children: ReactNode; align?: 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="menu" ref={ref}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {icon}
        {label}
      </button>
      {open && (
        <div className={`popover${align === 'right' ? ' right' : ''}`} role="menu" onClick={() => setOpen(false)}>
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
  onLibrary(): void
  onInspector(): void
  onHelp(): void
  onOpen(): void
}

export function TopBar({ host, narrow, onLibrary, onInspector, onHelp, onOpen }: Props) {
  const compact = useMedia('(max-width: 1299px)')
  const tool = useEditor((s) => s.tool)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const zoom = useEditor((s) => s.view.zoom)
  const snap = useEditor((s) => s.prefs.snap)
  const mono = useEditor((s) => s.doc.settings.mono)
  const labelMode = useEditor((s) => s.doc.settings.labelMode)

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
      <button type="button" onClick={onOpen} title="Open (Ctrl+O)">
        Open
      </button>
      <button type="button" onClick={() => void a.saveJson(host)} title="Save (Ctrl+S)">
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
    <header className="topbar">
      {narrow && (
        <button type="button" className="icon-button" aria-label="Library" onClick={onLibrary}>
          {icons.menu}
        </button>
      )}
      <Title />
      <div className="group" role="toolbar" aria-label="Tools">
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
      <div className="group">
        <button type="button" className="icon-button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={a.undo}>
          {icons.undo}
        </button>
        <button type="button" className="icon-button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={a.redo}>
          {icons.redo}
        </button>
      </div>
      {!compact && <div className="group">{zoomControls}</div>}
      {!compact && <div className="group">{toggles}</div>}
      <div className="group switch" role="radiogroup" aria-label="Label mode">
        {MODES.map((m) => (
          <button key={m.value} type="button" role="radio" aria-checked={labelMode === m.value} onClick={() => a.settings({ labelMode: m.value })}>
            {m.label}
          </button>
        ))}
      </div>
      {!compact && labelAll}
      <span className="spacer" />
      {!compact && <div className="group">{files}</div>}
      <button type="button" className="primary" onClick={() => void a.copyImage(host)} title="Copy image (Ctrl+Shift+C)">
        {icons.copy}
        Copy image
      </button>
      <Menu label="Export" align="right">
        <button type="button" role="menuitem" onClick={() => void a.savePng(host)}>
          Download PNG (2×)
        </button>
        <button type="button" role="menuitem" onClick={() => void a.saveSvg(host)}>
          Download SVG
        </button>
      </Menu>
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
        <button type="button" aria-label="Inspector" onClick={onInspector}>
          Inspector
        </button>
      )}
    </header>
  )
}
