// Library.tsx — the left panel: Apparatus (search, Recent, one section for each pack) and Templates.

import { useMemo, useState, type DragEvent } from 'react'
import { addSymbolAt, insertTemplateAt } from '../editor/actions'
import { PACKS, searchSymbols } from '../editor/search'
import { useEditor } from '../editor/store'
import { SYMBOLS, symbolDef } from '../symbols/registry'
import type { SymbolDef } from '../symbols/types'
import { TEMPLATES } from '../templates'
import type { TemplateDef } from '../templates/types'
import { DocThumbnail, SymbolThumbnail } from './Thumbnail'
import { DRAG_TYPE, SEARCH_ID } from './constants'
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

function Tiles({ defs }: { defs: SymbolDef[] }) {
  return (
    <div className="tiles">
      {defs.map((d) => (
        <Tile key={d.id} def={d} />
      ))}
    </div>
  )
}

function Apparatus() {
  const [query, setQuery] = useState('')
  const recent = useEditor((s) => s.prefs.recent)
  const results = useMemo(() => searchSymbols(query), [query])
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
            if (e.key === 'Enter' && results.length) {
              addSymbolAt(results[0].id)
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
          results.length ? (
            <Tiles defs={results} />
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
