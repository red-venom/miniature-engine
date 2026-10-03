// Library.tsx — the left panel: Apparatus (search, Recent, one section for each pack) and Templates. The two tabs
// move with the arrow keys. Enter in the search box adds the first result and gives the focus to the canvas, where the
// arrow keys move the new item at once.

import { useId, useMemo, useState, type DragEvent, type KeyboardEvent } from 'react'
import { addPresetAt, addSymbolAt, insertTemplateAt } from '../editor/actions'
import { PACKS, PRESET_GROUP, searchPresets, searchSymbols } from '../editor/search'
import { useEditor } from '../editor/store'
import { templateDoc } from '../editor/thumbs'
import { CONNECTOR_PRESETS, type ConnectorPreset } from '../model/connectors'
import { SYMBOLS, symbolDef } from '../symbols/registry'
import type { SymbolDef } from '../symbols/types'
import { TEMPLATES } from '../templates'
import type { TemplateDef } from '../templates/types'
import { DocThumbnail, PresetThumbnail, SymbolThumbnail } from './Thumbnail'
import { DRAG_TYPE, PRESET_DRAG_TYPE, SEARCH_ID } from './constants'
import { icons } from './icons'
import { RadioSwitch } from './RadioSwitch'

export type LibraryTab = 'apparatus' | 'templates'

function Tile({ def }: { def: SymbolDef }) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, def.id)
    e.dataTransfer.effectAllowed = 'copy'
  }
  return (
    <button type="button" className="tile" title={def.name} draggable onDragStart={onDragStart} onClick={() => addSymbolAt(def.id)}>
      <SymbolThumbnail def={def} />
      <span className="tile-name">{def.name}</span>
    </button>
  )
}

/** A "Tubes and lines" preset (section 10): a click adds the connector at the centre of the view; a drag, at the pointer. */
function PresetTile({ preset }: { preset: ConnectorPreset }) {
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(PRESET_DRAG_TYPE, preset.id)
    e.dataTransfer.effectAllowed = 'copy'
  }
  return (
    <button type="button" className="tile" title={preset.name} draggable onDragStart={onDragStart} onClick={() => addPresetAt(preset)}>
      <PresetThumbnail preset={preset} />
      <span className="tile-name">{preset.name}</span>
    </button>
  )
}

function Tiles({ defs, presets = [] }: { defs: SymbolDef[]; presets?: readonly ConnectorPreset[] }) {
  return (
    <div className="tiles">
      {defs.map((d) => (
        <Tile key={d.id} def={d} />
      ))}
      {presets.map((p) => (
        <PresetTile key={p.id} preset={p} />
      ))}
    </div>
  )
}

function Apparatus({ onAdded }: { onAdded?(): void }) {
  const [query, setQuery] = useState('')
  const recent = useEditor((s) => s.prefs.recent)
  const results = useMemo(() => searchSymbols(query), [query])
  const presets = useMemo(() => searchPresets(query), [query])
  const searching = query.trim() !== ''
  const recentDefs = recent.filter((id) => SYMBOLS.some((d) => d.id === id)).map((id) => symbolDef(id))
  return (
    <>
      <div className="search">
        {icons.search}
        <input
          id={SEARCH_ID}
          type="search"
          placeholder="Search apparatus"
          aria-label="Search apparatus"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (results.length || presets.length)) {
              if (results.length) addSymbolAt(results[0].id)
              else addPresetAt(presets[0])
              e.preventDefault()
              onAdded?.()
            }
            if (e.key === 'Escape') {
              setQuery('')
              ;(e.target as HTMLInputElement).blur()
            }
            e.stopPropagation()
          }}
        />
      </div>
      <div className="panel-scroll">
        {searching ? (
          results.length || presets.length ? (
            <Tiles defs={results} presets={presets} />
          ) : (
            <p className="muted">Nothing matches "{query}".</p>
          )
        ) : (
          <>
            {recentDefs.length > 0 && (
              <section className="section">
                <h3>Recent</h3>
                <Tiles defs={recentDefs} />
              </section>
            )}
            {PACKS.map((pack) => {
              const defs = SYMBOLS.filter((d) => d.pack === pack.id)
              if (!defs.length) return null
              return (
                <section className="section" key={pack.id}>
                  <h3>{pack.name}</h3>
                  <Tiles defs={defs} />
                </section>
              )
            })}
            <section className="section">
              <h3>{PRESET_GROUP}</h3>
              <Tiles defs={[]} presets={CONNECTOR_PRESETS} />
            </section>
          </>
        )}
      </div>
    </>
  )
}

/**
 * A template card (section 12): a thumbnail, the title and the practical references. A click inserts the template:
 * into an empty diagram it becomes the diagram and gives it its title; otherwise its items are added at the centre of
 * the view with new ids, and they become the selection.
 */
function TemplateCard({ tpl }: { tpl: TemplateDef }) {
  return (
    <button type="button" className="card" onClick={() => insertTemplateAt(tpl)} aria-label={`Insert template: ${tpl.title}`}>
      <DocThumbnail doc={templateDoc(tpl)} width={232} height={120} />
      <span className="card-title">{tpl.title}</span>
      <span className="muted">{tpl.refs}</span>
    </button>
  )
}

/** The filter chips of the gallery. */
type TemplateFilter = 'All' | TemplateDef['group']
const GROUPS = (['All', 'General', 'Chemistry', 'Biology', 'Physics'] as const).map((g) => ({ value: g, label: g }))

function Templates({ group, setGroup }: { group: TemplateFilter; setGroup(g: TemplateFilter): void }) {
  const shown = group === 'All' ? TEMPLATES : TEMPLATES.filter((t) => t.group === group)
  return (
    <>
      <RadioSwitch className="chips" buttonClassName="chip" label="Template group" value={group} options={GROUPS} onChange={setGroup} />
      <div className="panel-scroll">
        {shown.length ? (
          <div className="cards">
            {shown.map((t) => (
              <TemplateCard key={t.id} tpl={t} />
            ))}
          </div>
        ) : (
          <p className="muted">No templates in this group yet.</p>
        )}
      </div>
    </>
  )
}

const TABS: { id: LibraryTab; label: string }[] = [
  { id: 'apparatus', label: 'Apparatus' },
  { id: 'templates', label: 'Templates' },
]

interface Props {
  /** The drawer is open (narrow windows). */
  open: boolean
  /** The drawer is shut and off the screen: nothing in it can take the focus. */
  shut?: boolean
  tab: LibraryTab
  setTab(tab: LibraryTab): void
  onClose(): void
  /** Enter in the search box added the first result. */
  onAdded?(): void
}

/** The library. Its tab lives in the app, so that `/` can open the Apparatus tab before it focuses the search box. */
export function Library({ open, shut, tab, setTab, onClose, onAdded }: Props) {
  const id = useId()
  const [group, setGroup] = useState<TemplateFilter>('All')
  // The ARIA tabs: Tab reaches the chosen tab, and the arrow keys move to the other one.
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step || e.altKey || e.ctrlKey || e.metaKey) return
    e.preventDefault()
    e.stopPropagation()
    const next = TABS[(i + step + TABS.length) % TABS.length].id
    setTab(next)
    document.getElementById(`${id}-${next}`)?.focus()
  }
  return (
    <aside className={`panel library${open ? ' open' : ''}`} aria-label="Library" inert={shut}>
      <div className="tabs" role="tablist" aria-label="Library">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            id={`${id}-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`${id}-panel`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.label}
          </button>
        ))}
        <button type="button" className="icon-button drawer-close" aria-label="Close library" onClick={onClose}>
          {icons.close}
        </button>
      </div>
      <div className="tab-panel" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`}>
        {tab === 'apparatus' ? <Apparatus onAdded={onAdded} /> : <Templates group={group} setGroup={setGroup} />}
      </div>
    </aside>
  )
}
