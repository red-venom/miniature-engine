// useDialog.ts — the focus in a modal dialog (help, export, fallback). When the dialog opens, the focus moves into it;
// Tab and Shift+Tab go round its controls and never leave it; when it closes, the focus goes back to where it was,
// such as the button that opened it. So the keyboard user never loses their place, and the focus stays where it shows.

import { useEffect, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE = 'button, [href], input:not([type="hidden"]), select, textarea, [tabindex]'

/** The controls of a box that Tab reaches, in order. */
export function tabStops(box: HTMLElement): HTMLElement[] {
  return [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && !el.closest('[inert]') && el.getClientRects().length > 0,
  )
}

/** While `open`, the dialog `ref` has the focus; when it closes, the focus goes back to what had it before. */
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open = true): void {
  useEffect(() => {
    if (!open) return
    const back = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    ref.current?.focus({ preventScroll: true })
    return () => {
      if (back?.isConnected && !back.closest('[inert]')) back.focus({ preventScroll: true })
    }
  }, [open, ref])
}

/** The dialog's own Tab: from its last control to its first, and with Shift from its first (or itself) to its last. */
export function trapTab(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return
  const stops = tabStops(e.currentTarget)
  if (!stops.length) {
    e.preventDefault()
    return
  }
  const first = stops[0],
    last = stops[stops.length - 1],
    at = document.activeElement
  if (e.shiftKey ? at === first || at === e.currentTarget : at === last) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  }
}
