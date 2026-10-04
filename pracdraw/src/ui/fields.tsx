// fields.tsx — form controls of the inspector. A typed field is one undo step: it commits on blur or Enter.

import { useId, useState, type ReactNode } from 'react'

interface NumberProps {
  label: string
  /** Null shows an empty field (a reading with nothing to read). */
  value: number | null
  onCommit(value: number): void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  unit?: string
}

export function NumberField({ label, value, onCommit, min, max, step, disabled, unit }: NumberProps) {
  const id = useId()
  const shown = value === null ? '' : String(Math.round(value * 100) / 100)
  const [text, setText] = useState(shown)
  const [was, setWas] = useState(shown)
  if (was !== shown) {
    setWas(shown)
    setText(shown)
  }
  const commit = () => {
    if (text === shown) return // nothing typed: Enter and then blur make one step, not two
    const n = Number(text)
    if (!Number.isFinite(n) || text.trim() === '') {
      setText(shown)
      return
    }
    const v = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
    if (v !== value) onCommit(v)
    // A commit that changes the value shows the new value; one that changes nothing shows the old one again.
    setText(shown)
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="field-input">
        <input
          id={id}
          type="number"
          value={text}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setText(shown)
            e.stopPropagation()
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </div>
  )
}

interface TextProps {
  label: string
  value: string
  onCommit(value: string): void
  multiline?: boolean
}

export function TextField({ label, value, onCommit, multiline }: TextProps) {
  const id = useId()
  const [text, setText] = useState(value)
  const [was, setWas] = useState(value)
  if (was !== value) {
    setWas(value)
    setText(value)
  }
  const commit = () => {
    if (text !== value) onCommit(text)
  }
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(multiline && e.shiftKey)) {
      e.preventDefault()
      commit()
    }
    if (e.key === 'Escape') setText(value)
    e.stopPropagation()
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} value={text} rows={2} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={keys} />
      ) : (
        <input id={id} type="text" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={keys} />
      )}
    </div>
  )
}

export function CheckField({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange(v: boolean): void; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="field check">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange(v: string): void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A titled block of the inspector. With `group`, it is a group named by its title (one block for each cavity). */
export function Section({ title, children, group }: { title: string; children: ReactNode; group?: boolean }) {
  const id = useId()
  return (
    <section className="section" role={group ? 'group' : undefined} aria-labelledby={group ? id : undefined}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  )
}

/** A row of buttons, 8 px apart; `tight`, 4 px apart, for a row that would not fit the panel at 8 px. */
export function Row({ children, tight }: { children: ReactNode; tight?: boolean }) {
  return <div className={tight ? 'row tight' : 'row'}>{children}</div>
}
