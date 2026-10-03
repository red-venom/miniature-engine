// web.ts — the default host: a plain web page. Downloads through a link, the Clipboard API, localStorage.
// Every storage call is in try/catch: with no storage the app still works and shows no error.

import type { Host } from './host'

export const webHost: Host = {
  async saveFile(name, data) {
    try {
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      return 'saved'
    } catch {
      return 'failed'
    }
  },
  async copyImage(png) {
    try {
      // The promise form keeps the write inside the click (Safari needs this).
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      return true
    } catch {
      return false
    }
  },
  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  },
  load(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  store(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // No storage, or it is full: the app goes on without autosave.
    }
  },
}
