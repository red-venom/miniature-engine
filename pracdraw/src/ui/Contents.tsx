// Contents.tsx — the inspector blocks of section 9: one for each cavity of the selected symbol (Contents, Jacket,
// Inner tube), the quick buttons, one row for each layer, the preset list with a free colour picker, and the
// Reading field. A slider drag is one undo step; a typed reading commits on Enter or blur.

import { useEffect, useId, useRef, useState } from 'react'
import type { Layer, LayerKind } from '../kernel/contents'
import * as a from '../editor/actions'
import { useEditor } from '../editor/store'
import { MAX_LAYERS, PRESETS, readingMode, readingOf, setLayer, topLayerIndex, type Preset } from '../model/contents'
import type { SymbolItem } from '../model/types'
import { geometry } from '../symbols/registry'
import { CheckField, NumberField, Row, SelectField, Section } from './fields'
import { icons } from './icons'

const TITLES: Record<string, string> = { main: 'Contents', jacket: 'Jacket', inner: 'Inner tube' }
const KINDS: { value: LayerKind; label: string }[] = [
  { value: 'liquid', label: 'Liquid' },
  { value: 'powder', label: 'Powder' },
  { value: 'lumps', label: 'Lumps' },
  { value: 'gas', label: 'Gas' },
]
const BUBBLES: { value: NonNullable<Layer['bubbles']>; label: string }[] = [
  { value: 'none', label: 'No bubbles' },
  { value: 'few', label: 'A few bubbles' },
  { value: 'many', label: 'Many bubbles' },
]

const cavityTitle = (id: string) => TITLES[id] ?? id.charAt(0).toUpperCase() + id.slice(1)

/** The colour swatch. It opens the preset list and a free colour picker. */
function ColourMenu({ layer, onPreset, onColour }: { layer: Layer; onPreset(p: Preset): void; onColour(c: string): void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])
  const preset = PRESETS.find((p) => p.kind === layer.kind && p.colour === layer.colour && !!p.cloudy === !!layer.cloudy)
  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="swatch"
        aria-label={`Colour ${layer.colour}${preset ? `, ${preset.name}` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={preset?.name ?? layer.colour}
        onClick={() => setOpen(!open)}
      >
        <span className="swatch-chip" style={{ background: layer.colour }} />
      </button>
      {open && (
        <div className="popover presets" role="menu" aria-label="Presets">
          {PRESETS.map((p) => (
            <button
              type="button"
              role="menuitem"
              key={p.name}
              className="small preset"
              aria-pressed={p === preset}
              onClick={() => {
                onPreset(p)
                setOpen(false)
              }}
            >
              <span className="swatch-chip" style={{ background: p.colour }} />
              {p.name}
              <span className="muted kind">{p.kind}</span>
            </button>
          ))}
          <label className="colour-pick">
            Other colour
            <input type="color" value={layer.colour} aria-label="Pick a colour" onChange={(e) => onColour(e.target.value)} />
          </label>
        </div>
      )}
    </div>
  )
}

/** The amount slider, 0 to 100 %. The whole drag is one undo step. */
function AmountSlider({ it, cavity, index, layer }: { it: SymbolItem; cavity: string; index: number; layer: Layer }) {
  const id = useId()
  const value = Math.round(layer.amount * 100)
  const move = (v: number) => {
    a.slider.start()
    a.slider.move(setLayer(useEditor.getState().doc, it.id, cavity, index, { amount: v / 100 }))
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
          onPointerDown={a.slider.start}
          onPointerUp={a.slider.end}
          onPointerCancel={a.slider.end}
          onKeyUp={a.slider.end}
          onBlur={a.slider.end}
          onChange={(e) => move(Number(e.target.value))}
        />
        <span className="unit wide">{value} %</span>
      </span>
    </div>
  )
}

function LayerRow({ it, cavity, index, layer, top }: { it: SymbolItem; cavity: string; index: number; layer: Layer; top: boolean }) {
  const liquid = layer.kind === 'liquid'
  const set = (patch: Partial<Layer>) => a.layerSet(it.id, cavity, index, patch)
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
      {layer.kind !== 'gas' && <AmountSlider it={it} cavity={cavity} index={index} layer={layer} />}
      {liquid && (
        <>
          <SelectField label="Bubbles" value={layer.bubbles ?? 'none'} options={BUBBLES} onChange={(v) => set({ bubbles: v === 'none' ? undefined : (v as Layer['bubbles']) })} />
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
  return (
    <Section title={cavityTitle(cavity)}>
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
      {layers.map((layer, i) => (
        <LayerRow key={i} it={it} cavity={cavity} index={i} layer={layer} top={i === top} />
      ))}
    </Section>
  )
}

/** The Reading field: puts the top surface at a reading on the scale, or moves a gas syringe's plunger. */
export function ReadingField({ it }: { it: SymbolItem }) {
  const mode = readingMode(it)
  if (!mode) return null
  const value = readingOf(it) ?? 0
  return (
    <Section title="Reading">
      <NumberField label="Reading" value={value} min={mode.min} max={mode.max} step={0.1} unit={mode.unit} onCommit={(v) => a.reading(it.id, v)} />
      {mode.kind === 'scale' && mode.upsideDown && <p className="muted">Upside down: the volume of gas above the water.</p>}
    </Section>
  )
}

/** One block for each cavity of the symbol. A symbol with no cavity shows nothing. */
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
