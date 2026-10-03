// autosave.ts — 500 ms after the last change, the document and the view preferences go to the host's storage.
// On start they come back. Every storage call is inside the host's try/catch.

import type { Host } from '../host/host'
import { looksLikeDoc } from './actions'
import { DEFAULT_PREFS, useEditor, type Prefs } from './store'

export const AUTOSAVE_KEY = 'pracdraw.autosave.v1'
export const AUTOSAVE_MS = 500

interface Saved {
  doc: unknown
  prefs?: Partial<Prefs>
}

/** Restore the last autosave. Returns true when there was one. */
export function restoreAutosave(host: Host): boolean {
  const text = host.load(AUTOSAVE_KEY)
  if (!text) return false
  try {
    const saved = JSON.parse(text) as Saved
    if (!looksLikeDoc(saved.doc)) return false
    const p = saved.prefs ?? {}
    const prefs: Prefs = {
      snap: typeof p.snap === 'boolean' ? p.snap : DEFAULT_PREFS.snap,
      grid: typeof p.grid === 'boolean' ? p.grid : DEFAULT_PREFS.grid,
      recent: Array.isArray(p.recent) ? p.recent.filter((id): id is string => typeof id === 'string').slice(0, 8) : [],
    }
    useEditor.getState().replace(saved.doc)
    useEditor.getState().setPrefs(prefs)
    return true
  } catch {
    return false
  }
}

/** Watch the store and save. Returns a function that stops watching. */
export function startAutosave(host: Host, delay = AUTOSAVE_MS): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    timer = undefined
    const s = useEditor.getState()
    if (s.gesture) {
      timer = setTimeout(save, delay)
      return
    }
    host.store(AUTOSAVE_KEY, JSON.stringify({ doc: s.doc, prefs: s.prefs }))
  }
  const stop = useEditor.subscribe((s, prev) => {
    if (s.doc === prev.doc && s.prefs === prev.prefs) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(save, delay)
  })
  return () => {
    stop()
    if (timer) clearTimeout(timer)
  }
}
