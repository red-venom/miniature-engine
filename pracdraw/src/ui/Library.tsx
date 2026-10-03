// Library.tsx — the left panel: Apparatus (search, Recent, one section for each pack) and Templates.

import { useMemo, useState, type DragEvent } from 'react'
import { addPresetAt, addSymbolAt, insertTemplateAt } from '../editor/actions'
import { PACKS, PRESET_GROUP, searchPresets, searchSymbols } from '../editor/search'
import { useEditor } from '../editor/store'
import { CONNECTOR_PRESETS, type ConnectorPreset } from '../model/connectors'
import { SYMBOLS, symbolDef } from '../symbols/registry'
import type { SymbolDef } from '../symbols/types'
import { TEMPLATES } from '../templates'
import type { TemplateDef } from '../templates/types'
import { DocThumbnail, PresetThumbnail, SymbolThumbnail } from './Thumbnail'
import { DRAG_TYPE, PRESET_DRAG_TYPE, SEARCH_ID } from './constants'
import { icons } from './icons'

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

function Apparatus() {
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

function TemplateCard({ tpl }: { tpl: TemplateDef }) {
  const doc = useMemo(() => tpl.build(), [tpl])
  return (
    <button type="button" className="card" onClick={() => insertTemplateAt(tpl)} aria-label={`Insert template: ${tpl.title}`}>
      <DocThumbnail doc={doc} width={232} height={120} />
      <span className="card-title">{tpl.title}</span>
      <span className="muted">{tpl.refs}</span>
    </button>
  )
}

function Templates() {
  return (
    <div className="panel-scroll">
      <div className="cards">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.id} tpl={t} />
        ))}
      </div>
    </div>
  )
}

export function Library({ open, onClose }: { open: boolean; onClose(): void }) {
  const [tab, setTab] = useState<'apparatus' | 'templates'>('apparatus')
  return (
    <aside className={`panel library${open ? ' open' : ''}`} aria-label="Library">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'apparatus'} onClick={() => setTab('apparatus')}>
          Apparatus
        </button>
        <button type="button" role="tab" aria-selected={tab === 'templates'} onClick={() => setTab('templates')}>
          Templates
        </button>
        <button type="button" className="icon-button drawer-close" aria-label="Close library" onClick={onClose}>
          {icons.close}
        </button>
      </div>
      {tab === 'apparatus' ? <Apparatus /> : <Templates />}
    </aside>
  )
}
