// StatusBar.tsx — a hint for the active tool and the name of the selected item. An aria-live region.

import { toolHint } from '../editor/hints'
import { itemName } from '../editor/names'
import { useEditor } from '../editor/store'
import type { Item } from '../model/types'

export function StatusBar() {
  const doc = useEditor((s) => s.doc)
  const selection = useEditor((s) => s.selection)
  const status = useEditor((s) => s.status)
  const tool = useEditor((s) => s.tool)
  const drawing = useEditor((s) => !!s.draft?.points.length)
  const editing = useEditor((s) => !!s.textEdit)
  const items = selection.map((id) => doc.items[id]).filter((it): it is Item => !!it)
  const selected = items.length === 0 ? '' : items.length === 1 ? itemName(items[0]) : `${items.length} items`
  const one = items.length === 1 ? items[0].type : null
  return (
    <footer className="statusbar">
      <span className="hint">{toolHint(tool, { drawing, editing, connector: one === 'connector', label: one === 'label' })}</span>
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
