// StatusBar.tsx — a hint for the active tool and the name of the selected item. An aria-live region. After a download
// from Save, the link "Download did not start?" opens the fallback dialog with the same file (section 13).

import { openFallback } from '../editor/files'
import { toolHint } from '../editor/hints'
import { itemName } from '../editor/names'
import { useEditor } from '../editor/store'
import type { Item } from '../model/types'
import { HINT_ID } from './constants'

export function StatusBar() {
  const doc = useEditor((s) => s.doc)
  const selection = useEditor((s) => s.selection)
  const status = useEditor((s) => s.status)
  const retry = useEditor((s) => s.retry)
  const tool = useEditor((s) => s.tool)
  const drawing = useEditor((s) => !!s.draft?.points.length)
  const editing = useEditor((s) => !!s.textEdit)
  const items = selection.map((id) => doc.items[id]).filter((it): it is Item => !!it)
  const selected = items.length === 0 ? '' : items.length === 1 ? itemName(items[0]) : `${items.length} items`
  const one = items.length === 1 ? items[0].type : null
  return (
    <footer className="statusbar">
      <span className="hint" id={HINT_ID}>
        {toolHint(tool, { drawing, editing, connector: one === 'connector', label: one === 'label' })}
      </span>
      <span className="spacer" />
      <span className="selected" aria-live="polite">
        {selected}
      </span>
      <span className="status" role="status" aria-live="polite">
        {status}
      </span>
      {retry && (
        <button type="button" className="link" onClick={() => openFallback(retry)}>
          Download did not start?
        </button>
      )}
    </footer>
  )
}
