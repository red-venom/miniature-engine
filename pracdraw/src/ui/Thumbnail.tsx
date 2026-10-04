// Thumbnail.tsx — a symbol at its default size, or a template, fitted to a small box with a 1.5 px non-scaling line.

import { useMemo } from 'react'
import { docThumb, presetThumb, symbolThumb } from '../editor/thumbs'
import type { ConnectorPreset } from '../model/connectors'
import type { Doc } from '../model/types'
import { NodeView } from '../render/NodeView'
import type { SymbolDef } from '../symbols/types'

export function SymbolThumbnail({ def, size = 56 }: { def: SymbolDef; size?: number }) {
  const t = symbolThumb(def)
  return (
    <svg className="thumb" width={size} height={size} viewBox={t.viewBox} aria-hidden="true">
      {t.nodes.map((n, i) => (
        <NodeView key={i} n={n} line={1.5} />
      ))}
    </svg>
  )
}

/** A "Tubes and lines" preset. A 1 px line keeps the two walls of a tube apart at this size. */
export function PresetThumbnail({ preset, size = 56 }: { preset: ConnectorPreset; size?: number }) {
  const t = presetThumb(preset)
  return (
    <svg className="thumb" width={size} height={size} viewBox={t.viewBox} aria-hidden="true">
      {t.nodes.map((n, i) => (
        <NodeView key={i} n={n} line={1} />
      ))}
    </svg>
  )
}

export function DocThumbnail({ doc, width, height }: { doc: Doc; width: number; height: number }) {
  const t = useMemo(() => docThumb(doc, width / height), [doc, width, height])
  return (
    <svg className="thumb" width={width} height={height} viewBox={t.viewBox} aria-hidden="true">
      {t.nodes.map((n, i) => (
        <NodeView key={i} n={n} line={1} />
      ))}
    </svg>
  )
}
