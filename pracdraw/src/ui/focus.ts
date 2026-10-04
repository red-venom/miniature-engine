// focus.ts — the focus never drops to the page, where no ring shows it (section 12, "Access"). When the control that
// has the focus goes away (Delete in the inspector deletes the item and its fields, a text box closes, a menu shuts)
// or is turned off or hidden, the canvas takes the focus: the keys work there, and a ring shows it.

import { useEditor } from '../editor/store'

/** Watch the focus. `canvas` gives the element that takes it. Returns a function that stops watching. */
export function keepFocus(canvas: () => HTMLElement | null): () => void {
  let last: Element | null = null
  let frame = 0
  const onFocusIn = (e: FocusEvent) => {
    last = e.target instanceof Element ? e.target : null
  }
  const check = () => {
    frame = 0
    const at = document.activeElement
    if ((at && at !== document.body) || !last || !document.hasFocus()) return
    const gone = !last.isConnected || (last as HTMLButtonElement).disabled === true || !!last.closest('[inert]')
    if (gone) canvas()?.focus({ preventScroll: true })
  }
  // A change of the editor's state is what removes or turns off a control; the check runs once React has drawn it.
  const later = () => {
    if (!frame) frame = requestAnimationFrame(check)
  }
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', later)
  const stop = useEditor.subscribe(later)
  return () => {
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', later)
    stop()
    if (frame) cancelAnimationFrame(frame)
  }
}
