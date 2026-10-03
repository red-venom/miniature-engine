// EmptyState.tsx — the card on the canvas of an empty diagram (section 12, "First run"): "Pick a template or add
// apparatus", with a button for each of three templates. A click makes the template the diagram, with its title, and
// the view fits it. The card shows while the Select tool is chosen: with a drawing tool, a press belongs to the tool.
// A press on the card is not a press on the canvas.

import { useId } from 'react'
import { insertTemplateAt } from '../editor/actions'
import { useEditor } from '../editor/store'
import { templateDoc } from '../editor/thumbs'
import { TEMPLATES } from '../templates'
import { DocThumbnail } from './Thumbnail'

/** The templates on the card, in this order. */
const STARTERS = ['heatingBeaker', 'titration', 'rateGasOverWater'].flatMap((id) => TEMPLATES.filter((t) => t.id === id))

export function EmptyState() {
  const id = useId()
  const show = useEditor((s) => s.doc.order.length === 0 && s.tool === 'select')
  if (!show) return null
  return (
    <section className="empty-card" aria-labelledby={id} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <h2 id={id}>Pick a template or add apparatus</h2>
      <div className="empty-templates">
        {STARTERS.map((t) => (
          <button key={t.id} type="button" className="empty-template" onClick={() => insertTemplateAt(t)}>
            <DocThumbnail doc={templateDoc(t)} width={120} height={84} />
            <span>{t.title}</span>
          </button>
        ))}
      </div>
      <p className="muted">
        Or add apparatus from the library: click a part, or drag it here.{' '}
        <span className="nowrap">
          Press <kbd>/</kbd> to search.
        </span>
      </p>
    </section>
  )
}
