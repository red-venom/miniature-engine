// RadioSwitch.tsx — a row of buttons of which one is on: a radio group. The label-mode switch of the top bar, the rows
// of the export dialog and the template filter chips use it. It works as an ARIA radio group: Tab reaches the button
// that is on, and the arrow keys (also Home and End) move to another button and turn it on. A click, Enter or Space
// turns on the button that has the focus.

import { useRef, type KeyboardEvent } from 'react'

export interface RadioOption<T> {
  value: T
  label: string
}

interface Props<T> {
  /** The name of the group, or `labelledBy`: the id of the element that names it. */
  label?: string
  labelledBy?: string
  value: T
  options: readonly RadioOption<T>[]
  onChange(value: T): void
  disabled?: boolean
  /** The class of the group: 'switch', buttons joined in one row, unless given. */
  className?: string
  /** The class of each button. */
  buttonClassName?: string
}

const STEP: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

export function RadioSwitch<T extends string | number>({
  label,
  labelledBy,
  value,
  options,
  onChange,
  disabled,
  className = 'switch',
  buttonClassName,
}: Props<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const on = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const n = options.length
    const to = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : e.key in STEP ? (i + STEP[e.key] + n) % n : -1
    if (to < 0) return
    // The arrow keys belong to the group here: they must not move the selection on the canvas as well.
    e.preventDefault()
    e.stopPropagation()
    buttons.current[to]?.focus()
    if (options[to].value !== value) onChange(options[to].value)
  }
  return (
    <div className={className} role="radiogroup" aria-label={label} aria-labelledby={labelledBy}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => {
            buttons.current[i] = el
          }}
          type="button"
          role="radio"
          className={buttonClassName}
          aria-checked={o.value === value}
          tabIndex={i === on ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
