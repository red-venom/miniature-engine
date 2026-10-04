// Tile.tsx — the face of a library tile (section 12: "A tile is 76 × 84 px: a thumbnail and the name"), for the tiles
// of the library and the ghost of a tile being dragged. The name shows whole, inside the tile, on at most two lines:
// a long word has soft hyphens (hyphens.ts), so it breaks with a hyphen rather than being cut at the tile's edge, and a
// name that still does not fit at the caption size is set a little smaller, step by step, until it does. The tile's
// `title` and its accessible name are the name as it is.

import { useLayoutEffect, useRef } from 'react'
import { softHyphens } from '../editor/hyphens'
import type { ConnectorPreset } from '../model/connectors'
import type { SymbolDef } from '../symbols/types'
import { PresetThumbnail, SymbolThumbnail } from './Thumbnail'

/** What a tile adds: a symbol, or a "Tubes and lines" preset (section 10). */
export type Part = { kind: 'symbol'; def: SymbolDef } | { kind: 'preset'; preset: ConnectorPreset }

/** The caption sizes below the one in the style sheet (10 px), in px: the first at which the name fits is used. */
const SMALLER = [9.5, 9, 8.5, 8]

/** The name of a tile, in a box two lines high: no word is cut, and no letter is outside it. */
export function TileName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fits = () => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight
    if (el.style.fontSize) el.style.fontSize = ''
    for (const size of SMALLER) {
      if (fits()) return
      el.style.fontSize = `${size}px`
    }
  }, [name])
  return (
    <span ref={ref} className="tile-name">
      {softHyphens(name)}
    </span>
  )
}

export function TileFace({ part }: { part: Part }) {
  return part.kind === 'symbol' ? (
    <>
      <SymbolThumbnail def={part.def} />
      <TileName name={part.def.name} />
    </>
  ) : (
    <>
      <PresetThumbnail preset={part.preset} />
      <TileName name={part.preset.name} />
    </>
  )
}
