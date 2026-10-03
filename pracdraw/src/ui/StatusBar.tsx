// StatusBar.tsx — a hint for the active tool and the name of the selected item. An aria-live region.

import { itemName } from '../editor/names'
import { useEditor } from '../editor/store'
import type { Item } from '../model/types'

const HINTS = {
  select: 'Click to select. Drag to move. Shift+click adds. Alt+drag duplicates. Space+drag or wheel pans, Ctrl+wheel zooms.',
}

export function StatusBar() {
  const doc = useEditor((s) => s.doc)
  const selection = useEditor((s) => s.selection)
  const status = useEditor((s) => s.status)
  const items = selection.map((id) => doc.items[id]).filter((it): it is Item => !!it)
  const selected = items.length === 0 ? '' : items.length === 1 ? itemName(items[0]) : `${items.length} items`
  return (
    <footer className="statusbar">
      <span className="hint">{HINTS.select}</span>
      <span className="spacer" />
      <span className="selected" aria-live="polite">
        {selected}
      </span>
      <span className="status" role="status" aria-live="polite">
        {status}
      </span>
    </footer>
  )
}
