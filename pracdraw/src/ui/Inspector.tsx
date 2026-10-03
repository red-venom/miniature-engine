// Inspector.tsx — the right panel: the properties of the selection, or the document settings.

import * as a from '../editor/actions'
import { useEditor } from '../editor/store'
import type { ConnectorItem, Doc, DocSettings, Item, LabelItem, ShapeItem, SymbolItem } from '../model/types'
import { hasSymbol, symbolDef } from '../symbols/registry'
import type { ParamDef } from '../symbols/types'
import { ContentsBlocks, ReadingField } from './Contents'
import { CheckField, NumberField, Row, Section, SelectField, TextField } from './fields'
import { icons } from './icons'

function Arrange() {
  return (
    <Section title="Arrange">
      <Row>
        <button type="button" className="small" onClick={() => a.arrange('front')} title="Bring to front (Ctrl+])">
          {icons.front} Front
        </button>
        <button type="button" className="small" onClick={() => a.arrange('forward')} title="Forward (])">
          {icons.forward} Forward
        </button>
        <button type="button" className="small" onClick={() => a.arrange('backward')} title="Backward ([)">
          {icons.backward} Backward
        </button>
        <button type="button" className="small" onClick={() => a.arrange('back')} title="Send to back (Ctrl+[)">
          {icons.back} Back
        </button>
      </Row>
    </Section>
  )
}

function ItemButtons({ items }: { items: Item[] }) {
  const locked = items.every((it) => it.locked)
  return (
    <Section title="Item">
      <Row>
        <button type="button" className="small" onClick={() => a.lockSelection(!locked)} aria-pressed={locked}>
          {icons.lock} Lock
        </button>
        <button type="button" className="small" onClick={() => a.duplicateSelection()} title="Duplicate (Ctrl+D)">
          {icons.duplicate} Duplicate
        </button>
        <button type="button" className="small danger" onClick={() => a.deleteSelection()} title="Delete">
          {icons.trash} Delete
        </button>
      </Row>
    </Section>
  )
}

function Param({ it, def }: { it: SymbolItem; def: ParamDef }) {
  const value = it.params[def.key] ?? def.default
  switch (def.type) {
    case 'boolean':
      return <CheckField label={def.label} checked={value === true} onChange={(v) => a.setParameter(it.id, def.key, v)} />
    case 'number':
      return (
        <NumberField label={def.label} value={Number(value)} min={def.min} max={def.max} step={def.step} onCommit={(v) => a.setParameter(it.id, def.key, v)} />
      )
    case 'choice':
      return <SelectField label={def.label} value={String(value)} options={def.options} onChange={(v) => a.setParameter(it.id, def.key, v)} />
    default:
      return <TextField label={def.label} value={String(value)} onCommit={(v) => a.setParameter(it.id, def.key, v)} />
  }
}

function SymbolFields({ it }: { it: SymbolItem }) {
  const def = hasSymbol(it.symbol) ? symbolDef(it.symbol) : null
  const mode = def?.resize ?? 'free'
  return (
    <>
      <Section title={def?.name ?? it.symbol}>
        <NumberField label="Width" value={it.w} min={1} unit="u" disabled={mode === 'none' || mode === 'height'} onCommit={(v) => a.resizeTyped(it, 'w', v)} />
        <NumberField label="Height" value={it.h} min={1} unit="u" disabled={mode === 'none' || mode === 'width'} onCommit={(v) => a.resizeTyped(it, 'h', v)} />
        <NumberField label="Rotation" value={it.rot} step={1} unit="°" onCommit={(v) => a.rotateTo(it.id, v)} />
        <Row>
          <button type="button" className="small" onClick={() => a.rotateTo(it.id, it.rot - 90)} aria-label="Rotate 90° anticlockwise">
            {icons.rotateLeft} −90°
          </button>
          <button type="button" className="small" onClick={() => a.rotateTo(it.id, it.rot + 90)} aria-label="Rotate 90° clockwise">
            {icons.rotateRight} +90°
          </button>
          <button type="button" className="small" onClick={() => a.flipTo(it.id, !it.flip)} aria-pressed={it.flip} aria-label="Flip">
            {icons.flip} Flip
          </button>
        </Row>
      </Section>
      {def?.params?.length ? (
        <Section title="Parameters">
          {def.params.map((p) => (
            <Param key={p.key} it={it} def={p} />
          ))}
        </Section>
      ) : null}
      <ContentsBlocks it={it} />
      <ReadingField it={it} />
      <Arrange />
      <ItemButtons items={[it]} />
    </>
  )
}

function LabelFields({ it }: { it: LabelItem }) {
  const fixed = !!it.target && 'item' in it.target
  return (
    <>
      <Section title="Label">
        <TextField label="Text" value={it.text} multiline onCommit={(v) => a.patchItem<LabelItem>(it.id, { text: v })} />
        <SelectField
          label="Side"
          value={it.side}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(v) => a.patchItem<LabelItem>(it.id, { side: v as LabelItem['side'] })}
        />
        <p className="muted">{it.target ? (fixed ? 'Fixed to an item' : 'Free leader') : 'Plain text'}</p>
      </Section>
      <ItemButtons items={[it]} />
    </>
  )
}

function ConnectorFields({ it }: { it: ConnectorItem }) {
  return (
    <>
      <Section title="Connector">
        <p className="muted">
          {it.kind}, {it.points.length} points
        </p>
      </Section>
      <Arrange />
      <ItemButtons items={[it]} />
    </>
  )
}

function ShapeFields({ it }: { it: ShapeItem }) {
  return (
    <>
      <Section title={it.shape === 'rect' ? 'Rectangle' : 'Ellipse'}>
        <NumberField label="Width" value={it.w} min={1} unit="u" onCommit={(v) => a.resize(it.id, { w: v, h: it.h })} />
        <NumberField label="Height" value={it.h} min={1} unit="u" onCommit={(v) => a.resize(it.id, { w: it.w, h: v })} />
        <NumberField label="Rotation" value={it.rot} unit="°" onCommit={(v) => a.rotateTo(it.id, v)} />
      </Section>
      <Arrange />
      <ItemButtons items={[it]} />
    </>
  )
}

function SeveralFields({ items }: { items: Item[] }) {
  const grouped = items.every((it) => it.group && it.group === items[0].group)
  return (
    <>
      <Section title={`${items.length} items`}>
        <Row>
          <button type="button" className="small" onClick={a.groupSelection} disabled={grouped} title="Group (Ctrl+G)">
            Group
          </button>
          <button type="button" className="small" onClick={a.ungroupSelection} disabled={!items.some((it) => it.group)} title="Ungroup (Ctrl+Shift+G)">
            Ungroup
          </button>
        </Row>
      </Section>
      <Arrange />
      <ItemButtons items={items} />
    </>
  )
}

const MODES: { value: DocSettings['labelMode']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'blank', label: 'Blank lines' },
  { value: 'letters', label: 'Letters' },
]

function DocumentFields({ doc }: { doc: Doc }) {
  const prefs = useEditor((s) => s.prefs)
  const anyLocked = doc.order.some((id) => doc.items[id]?.locked)
  return (
    <>
      <Section title="Document">
        <TextField label="Title" value={doc.title} onCommit={a.rename} />
        <SelectField
          label="Label mode"
          value={doc.settings.labelMode}
          options={MODES}
          onChange={(v) => a.settings({ labelMode: v as DocSettings['labelMode'] })}
        />
        <NumberField label="Label size" value={doc.settings.labelSize} min={6} max={60} step={1} unit="u" onCommit={(v) => a.settings({ labelSize: v })} />
        <CheckField label="Smart text" checked={doc.settings.smartText} onChange={(v) => a.settings({ smartText: v })} />
        <CheckField label="Photocopy-safe" checked={doc.settings.mono} onChange={(v) => a.settings({ mono: v })} />
        <Row>
          <button type="button" className="small" onClick={a.unlockEverything} disabled={!anyLocked}>
            {icons.lock} Unlock all
          </button>
        </Row>
      </Section>
      <Section title="View">
        <CheckField label="Snap" checked={prefs.snap} onChange={(v) => a.prefs({ snap: v })} />
        <CheckField label="Dot grid" checked={prefs.grid} onChange={(v) => a.prefs({ grid: v })} />
      </Section>
    </>
  )
}

export function Inspector({ open, onClose }: { open: boolean; onClose(): void }) {
  const doc = useEditor((s) => s.doc)
  const selection = useEditor((s) => s.selection)
  const items = selection.map((id) => doc.items[id]).filter((it): it is Item => !!it)
  let body
  if (items.length === 0) body = <DocumentFields doc={doc} />
  else if (items.length > 1) body = <SeveralFields items={items} />
  else {
    const it = items[0]
    body =
      it.type === 'symbol' ? (
        <SymbolFields it={it} />
      ) : it.type === 'label' ? (
        <LabelFields it={it} />
      ) : it.type === 'connector' ? (
        <ConnectorFields it={it} />
      ) : (
        <ShapeFields it={it} />
      )
  }
  return (
    <aside className={`panel inspector${open ? ' open' : ''}`} aria-label="Inspector">
      <div className="tabs">
        <span className="tab-title">{items.length ? 'Selection' : 'Settings'}</span>
        <button type="button" className="icon-button drawer-close" aria-label="Close inspector" onClick={onClose}>
          {icons.close}
        </button>
      </div>
      <div className="panel-scroll">{body}</div>
    </aside>
  )
}
