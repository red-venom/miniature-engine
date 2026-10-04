// Inspector.tsx — the right panel: the properties of the selection, or the document settings.

import type { ReactNode } from 'react'
import * as a from '../editor/actions'
import { itemName } from '../editor/names'
import { useEditor } from '../editor/store'
import type { Align } from '../model/commands'
import { RADIUS_RANGE, WIDTH_RANGE, capsFor, connectorRadius, connectorWidth, isTube, type ConnectorPatch } from '../model/connectors'
import { LABEL_SIZE_RANGE, LEADER_ENDS, isFixed, labelSize, type LabelPatch } from '../model/labels'
import { SHAPE_FILLS, type ShapeFill, type ShapePatch } from '../model/shapes'
import type { Cap, ConnectorItem, ConnectorKind, Doc, DocSettings, Item, LabelItem, ShapeItem, SymbolItem } from '../model/types'
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

/** Lock, Duplicate and Delete. A connector and a shape have Delete only (section 12). */
function ItemButtons({ items, deleteOnly }: { items: Item[]; deleteOnly?: boolean }) {
  const locked = items.every((it) => it.locked)
  return (
    <Section title="Item">
      <Row>
        {!deleteOnly && (
          <button type="button" className="small" onClick={() => a.lockSelection(!locked)} aria-pressed={locked}>
            {icons.lock} Lock
          </button>
        )}
        {!deleteOnly && (
          <button type="button" className="small" onClick={() => a.duplicateSelection()} title="Duplicate (Ctrl+D)">
            {icons.duplicate} Duplicate
          </button>
        )}
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

const SIDES: { value: LabelItem['side']; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
]

const LEADER_END_NAMES: Record<LabelItem['leaderEnd'], string> = { none: 'None', arrow: 'Arrow', dot: 'Dot' }
const LEADER_END_OPTIONS = LEADER_ENDS.map((v) => ({ value: v, label: LEADER_END_NAMES[v] }))

/**
 * Section 12: text (Enter commits, Shift+Enter starts a new line, an empty text deletes the label), size, side, leader
 * end, smart text, and what the leader end is on: fixed to an item, with a button to free it, or a free point. Plain
 * text has no leader. Then Arrange (the draw order sets the letters) and Delete.
 */
function LabelFields({ it, doc }: { it: LabelItem; doc: Doc }) {
  const set = (patch: LabelPatch) => a.labelFields(it.id, patch)
  const owner = isFixed(it) ? doc.items[it.target.item] : undefined
  return (
    <>
      <Section title={it.target ? 'Label' : 'Text'}>
        <TextField label="Text" value={it.text} multiline onCommit={(v) => set({ text: v })} />
        <NumberField
          label="Size"
          value={labelSize(doc, it)}
          min={LABEL_SIZE_RANGE.min}
          max={LABEL_SIZE_RANGE.max}
          step={1}
          unit="u"
          onCommit={(v) => set({ size: v })}
        />
        <SelectField label="Side" value={it.side} options={SIDES} onChange={(v) => set({ side: v as LabelItem['side'] })} />
        <SelectField
          label="Leader end"
          value={it.leaderEnd}
          options={LEADER_END_OPTIONS}
          disabled={!it.target}
          onChange={(v) => set({ leaderEnd: v as LabelItem['leaderEnd'] })}
        />
        <CheckField label="Smart text" checked={it.smart ?? doc.settings.smartText} onChange={(v) => set({ smart: v })} />
      </Section>
      <Section title="Leader">
        <p className="muted">{owner ? `Fixed to ${itemName(owner)}: it follows the item.` : it.target ? 'A free point.' : 'None: plain text.'}</p>
        {owner && (
          <Row>
            <button type="button" className="small" onClick={() => a.freeLabel(it.id)} title="The leader end stays where it is, and no longer follows the item">
              Free the leader end
            </button>
          </Row>
        )}
      </Section>
      <Arrange />
      <ItemButtons items={[it]} deleteOnly />
    </>
  )
}

const KINDS: { value: ConnectorKind; label: string }[] = [
  { value: 'glassTube', label: 'Glass tube' },
  { value: 'rubberTube', label: 'Rubber tube' },
  { value: 'wire', label: 'Wire' },
  { value: 'line', label: 'Line' },
]

const CAP_NAMES: Record<Cap, string> = { none: 'None', arrow: 'Arrow', dot: 'Dot', tick: 'Tick', closed: 'Closed' }

/** The caps a kind can have. A tube's end with no cap is open. */
const capOptions = (kind: ConnectorKind) => capsFor(kind).map((c) => ({ value: c, label: c === 'none' && isTube(kind) ? 'Open' : CAP_NAMES[c] }))

/** Section 10: kind, width (tubes), bend radius (every bend at once), dash (wires and lines), the two caps. */
function ConnectorFields({ it }: { it: ConnectorItem }) {
  const tube = isTube(it.kind)
  const caps = capOptions(it.kind)
  const set = (patch: ConnectorPatch) => a.connectorFields(it.id, patch)
  return (
    <>
      <Section title={itemName(it)}>
        <SelectField label="Kind" value={it.kind} options={KINDS} onChange={(v) => set({ kind: v as ConnectorKind })} />
        {tube && (
          <NumberField
            label="Width"
            value={connectorWidth(it) ?? 0}
            min={WIDTH_RANGE.min}
            max={WIDTH_RANGE.max}
            step={1}
            unit="u"
            onCommit={(v) => set({ width: v })}
          />
        )}
        <NumberField
          label="Bend radius"
          value={connectorRadius(it)}
          min={RADIUS_RANGE.min}
          max={RADIUS_RANGE.max}
          step={1}
          unit="u"
          disabled={it.points.length < 3}
          onCommit={(v) => set({ radius: v })}
        />
        {!tube && <CheckField label="Dashed" checked={!!it.dash} onChange={(v) => set({ dash: v })} />}
        <SelectField label="Start cap" value={it.startCap} options={caps} onChange={(v) => set({ startCap: v as Cap })} />
        <SelectField label="End cap" value={it.endCap} options={caps} onChange={(v) => set({ endCap: v as Cap })} />
        <p className="muted">{it.points.length} points</p>
      </Section>
      <Arrange />
      <ItemButtons items={[it]} deleteOnly />
    </>
  )
}

const FILL_NAMES: Record<ShapeFill, string> = { none: 'None', paper: 'Paper (white)', grey: 'Grey' }
const FILLS = SHAPE_FILLS.map((f) => ({ value: f, label: FILL_NAMES[f] }))

/** Section 12: fill, dash, width, height, rotation. */
function ShapeFields({ it }: { it: ShapeItem }) {
  const set = (patch: ShapePatch) => a.shapeFields(it.id, patch)
  return (
    <>
      <Section title={itemName(it)}>
        <SelectField label="Fill" value={it.fill} options={FILLS} onChange={(v) => set({ fill: v as ShapeFill })} />
        <CheckField label="Dashed" checked={it.dash} onChange={(v) => set({ dash: v })} />
        <NumberField label="Width" value={it.w} min={1} unit="u" onCommit={(v) => set({ w: v })} />
        <NumberField label="Height" value={it.h} min={1} unit="u" onCommit={(v) => set({ h: v })} />
        <NumberField label="Rotation" value={it.rot} step={1} unit="°" onCommit={(v) => set({ rot: v })} />
      </Section>
      <Arrange />
      <ItemButtons items={[it]} deleteOnly />
    </>
  )
}

interface AlignButton {
  how: Align
  label: string
  icon: ReactNode
}

const ALIGN_ACROSS: AlignButton[] = [
  { how: 'left', label: 'Left', icon: icons.alignLeft },
  { how: 'centre', label: 'Centre', icon: icons.alignCentre },
  { how: 'right', label: 'Right', icon: icons.alignRight },
]
const ALIGN_DOWN: AlignButton[] = [
  { how: 'top', label: 'Top', icon: icons.alignTop },
  { how: 'middle', label: 'Middle', icon: icons.alignMiddle },
  { how: 'bottom', label: 'Bottom', icon: icons.alignBottom },
]

/**
 * One row of align buttons. Aligning takes two units or more. Top, Middle and Bottom need 267 px 8 px apart, and the
 * inspector has 263 px: that row is `tight`, so that it stays on one line.
 */
function AlignRow({ buttons, disabled, tight }: { buttons: AlignButton[]; disabled: boolean; tight?: boolean }) {
  return (
    <Row tight={tight}>
      {buttons.map((x) => (
        <button
          key={x.how}
          type="button"
          className="small"
          onClick={() => a.alignSelection(x.how)}
          disabled={disabled}
          aria-label={`Align ${x.label.toLowerCase()}`}
        >
          {x.icon} {x.label}
        </button>
      ))}
    </Row>
  )
}

/**
 * Section 12: align, distribute, group and ungroup, arrange, lock, duplicate, delete. A group aligns and distributes as
 * one unit, so the buttons count units, not items.
 */
function SeveralFields({ items }: { items: Item[] }) {
  const grouped = items.every((it) => it.group && it.group === items[0].group)
  const units = new Set(items.map((it) => (it.group ? `group ${it.group}` : `item ${it.id}`))).size
  return (
    <>
      <Section title={`${items.length} items`}>
        <Row>
          <button type="button" className="small" onClick={a.groupSelection} disabled={grouped} title="Group (Ctrl+G)">
            {icons.group} Group
          </button>
          <button type="button" className="small" onClick={a.ungroupSelection} disabled={!items.some((it) => it.group)} title="Ungroup (Ctrl+Shift+G)">
            Ungroup
          </button>
        </Row>
      </Section>
      <Section title="Align">
        <AlignRow buttons={ALIGN_ACROSS} disabled={units < 2} />
        <AlignRow buttons={ALIGN_DOWN} disabled={units < 2} tight />
      </Section>
      <Section title="Distribute">
        <Row>
          <button type="button" className="small" onClick={() => a.distributeSelection('across')} disabled={units < 3} aria-label="Distribute across">
            {icons.distributeAcross} Across
          </button>
          <button type="button" className="small" onClick={() => a.distributeSelection('down')} disabled={units < 3} aria-label="Distribute down">
            {icons.distributeDown} Down
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

/** `shut`: the drawer is shut and off the screen (narrow windows), so nothing in it can take the focus. */
export function Inspector({ open, shut, onClose }: { open: boolean; shut?: boolean; onClose(): void }) {
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
        <LabelFields it={it} doc={doc} />
      ) : it.type === 'connector' ? (
        <ConnectorFields it={it} />
      ) : (
        <ShapeFields it={it} />
      )
  }
  return (
    <aside className={`panel inspector${open ? ' open' : ''}`} aria-label="Inspector" inert={shut}>
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
