// Contents.tsx — the inspector blocks of section 9. One block for each cavity of the selected symbol ("Contents",
// "Jacket", "Inner tube") with the quick buttons Empty, Water and Add layer, and one row for each layer, top layer
// first: colour swatch, kind, remove, amount slider, bubbles, cloudy and meniscus. The swatch opens the presets and a
// free colour picker. Then the Reading field. A slider drag is one undo step; a typed reading commits on Enter or blur.

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { Layer, LayerKind } from '../kernel/contents'
import * as a from '../editor/actions'
import { MAX_LAYERS, PRESETS, presetOf, readingMode, readingOf, topLayerIndex, type Preset } from '../model/contents'
import type { SymbolItem } from '../model/types'
import { geometry } from '../symbols/registry'
import { CheckField, NumberField, Row, Section, SelectField } from './fields'
import { icons } from './icons'

const TITLES: Record<string, string> = { main: 'Contents', jacket: 'Jacket', inner: 'Inner tube' }
const cavityTitle = (id: string) => TITLES[id] ?? id.charAt(0).toUpperCase() + id.slice(1)

const KINDS: { value: LayerKind; label: string; group: string }[] = [
  { value: 'liquid', label: 'Liquid', group: 'Liquids' },
  { value: 'powder', label: 'Powder', group: 'Powders and precipitates' },
  { value: 'lumps', label: 'Lumps', group: 'Lumps' },
  { value: 'gas', label: 'Gas', group: 'Gases' },
]

const BUBBLES: { value: NonNullable<Layer['bubbles']>; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'few', label: 'Few' },
  { value: 'many', label: 'Many' },
]

/** The colour swatch of a layer. It opens the presets, grouped by kind, and a free colour picker. */
function ColourMenu({ layer, onPreset, onColour }: { layer: Layer; onPreset(p: Preset): void; onColour(colour: string): void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const popup = useId()
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  const close = () => {
    setOpen(false)
    button.current?.focus()
  }
  // Escape closes the list and goes no further: it must not clear the selection as well.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      close()
    }
  }
  const current = presetOf(layer)
  return (
    <div className="menu" ref={box} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className="swatch"
        aria-label={`Colour: ${current?.name ?? layer.colour}`}
        aria-expanded={open}
        aria-controls={open ? popup : undefined}
        title={current?.name ?? layer.colour}
        onClick={() => setOpen(!open)}
      >
        <span className="swatch-chip" style={{ background: layer.colour }} />
      </button>
      {open && (
        <div id={popup} className="popover presets" role="group" aria-label="Colour presets">
          {KINDS.map((k) => (
            <div key={k.value} className="preset-group">
              <h4>{k.group}</h4>
              {PRESETS.filter((p) => p.kind === k.value).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="preset"
                  aria-pressed={p === current}
                  onClick={() => {
                    onPreset(p)
                    close()
                  }}
                >
                  <span className="swatch-chip" style={{ background: p.colour }} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          ))}
          <label className="colour-pick">
            Other colour
            <input type="color" value={layer.colour} onChange={(e) => onColour(e.target.value)} />
          </label>
        </div>
      )}
    </div>
  )
}

/** The amount slider, 0 to 100 %. A drag is one undo step: it ends when the pointer is released anywhere. */
function AmountSlider({ it, cavity, index, layer }: { it: SymbolItem; cavity: string; index: number; layer: Layer }) {
  const id = useId()
  const value = Math.round(layer.amount * 100)
  const start = () => {
    a.amountSlider.start()
    const end = () => {
      a.amountSlider.end()
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }
  return (
    <div className="field">
      <label htmlFor={id}>Amount</label>
      <span className="field-input">
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          aria-valuetext={`${value} %`}
          onPointerDown={start}
          onChange={(e) => a.amountSlider.set(it.id, cavity, index, Number(e.target.value) / 100)}
          onBlur={a.amountSlider.end}
        />
        <span className="unit wide">{value} %</span>
      </span>
    </div>
  )
}

function LayerRow({ it, cavity, index, layer, top }: { it: SymbolItem; cavity: string; index: number; layer: Layer; top: boolean }) {
  const set = (patch: Partial<Layer>) => a.layerSet(it.id, cavity, index, patch)
  const liquid = layer.kind === 'liquid'
  return (
    <div className="layer" role="group" aria-label={`Layer ${index + 1}`}>
      <div className="layer-head">
        <ColourMenu
          layer={layer}
          onPreset={(p) => a.layerPreset(it.id, cavity, index, p)}
          onColour={(c) => a.layerSet(it.id, cavity, index, { colour: c }, `colour:${it.id}:${cavity}:${index}`)}
        />
        <select aria-label="Kind" value={layer.kind} onChange={(e) => set({ kind: e.target.value as LayerKind })}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <button type="button" className="icon-button small" aria-label="Remove layer" title="Remove layer" onClick={() => a.layerRemove(it.id, cavity, index)}>
          {icons.close}
        </button>
      </div>
      {layer.kind === 'gas' ? (
        <p className="muted">Fills the space above the other layers.</p>
      ) : (
        <AmountSlider it={it} cavity={cavity} index={index} layer={layer} />
      )}
      {liquid && (
        <>
          <SelectField
            label="Bubbles"
            value={layer.bubbles ?? 'none'}
            options={BUBBLES}
            onChange={(v) => set({ bubbles: v === 'none' ? undefined : (v as Layer['bubbles']) })}
          />
          <CheckField label="Cloudy" checked={!!layer.cloudy} onChange={(v) => set({ cloudy: v || undefined })} />
          {top && <CheckField label="Meniscus" checked={!!layer.meniscus} onChange={(v) => set({ meniscus: v || undefined })} />}
        </>
      )}
    </div>
  )
}

function CavityBlock({ it, cavity }: { it: SymbolItem; cavity: string }) {
  const layers = it.contents[cavity] ?? []
  const top = topLayerIndex(layers)
  // Top layer first, as the layers stand in the vessel.
  const rows = layers
    .map((layer, i) => <LayerRow key={i} it={it} cavity={cavity} index={i} layer={layer} top={i === top && layer.kind === 'liquid'} />)
    .reverse()
  return (
    <Section title={cavityTitle(cavity)} group>
      <Row>
        <button type="button" className="small" onClick={() => a.cavityEmpty(it.id, cavity)} disabled={!layers.length}>
          Empty
        </button>
        <button type="button" className="small" onClick={() => a.cavityWater(it.id, cavity)}>
          Water
        </button>
        <button type="button" className="small" onClick={() => a.layerAdd(it.id, cavity)} disabled={layers.length >= MAX_LAYERS}>
          {icons.plus} Add layer
        </button>
      </Row>
      {rows}
    </Section>
  )
}

/** One block for each cavity of the symbol. A symbol with no cavity shows none. */
export function ContentsBlocks({ it }: { it: SymbolItem }) {
  const cavities = geometry(it.symbol, it.w, it.h, it.params).cavities ?? []
  return (
    <>
      {cavities.map((c) => (
        <CavityBlock key={c.id} it={it} cavity={c.id} />
      ))}
    </>
  )
}

/** The Reading field: the top surface at a reading on the scale, or the plunger of a gas syringe. */
export function ReadingField({ it }: { it: SymbolItem }) {
  const mode = readingMode(it)
  if (!mode) {
    if (!geometry(it.symbol, it.w, it.h, it.params).scale) return null
    return (
      <Section title="Scale">
        <p className="muted">Set the rotation to 0° and turn off Flip to type a reading.</p>
      </Section>
    )
  }
  return (
    <Section title="Scale">
      <NumberField label="Reading" value={readingOf(it)} min={mode.min} max={mode.max} step={0.1} unit={mode.unit} onCommit={(v) => a.reading(it.id, v)} />
      {mode.kind === 'scale' && mode.upsideDown && <p className="muted">Upside down: the reading is the volume of gas above the water.</p>}
    </Section>
  )
}
