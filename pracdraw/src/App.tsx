// App.tsx — the editor: top bar, library, canvas, inspector, status bar (section 12 of the specification), and the
// dialogs and banner of section 13. The host starts as the web host and becomes the Claude host when it answers.

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { restoreAutosave, startAutosave } from './editor/autosave'
import { closeFallback, openFile } from './editor/files'
import { handleKey } from './editor/keys'
import { useEditor } from './editor/store'
import { connectHost, host } from './host/current'
import { Banner } from './ui/Banner'
import { Canvas } from './ui/Canvas'
import { ExportDialog } from './ui/ExportDialog'
import { FallbackDialog } from './ui/FallbackDialog'
import { keepFocus } from './ui/focus'
import { HelpDialog } from './ui/HelpDialog'
import { Inspector } from './ui/Inspector'
import { Library, type LibraryTab } from './ui/Library'
import { CANVAS_ID, SEARCH_ID } from './ui/constants'
import { StatusBar } from './ui/StatusBar'
import { TopBar } from './ui/TopBar'
import { useMedia } from './ui/useMedia'

const canvas = () => document.getElementById(CANVAS_ID)

export default function App() {
  const [help, setHelp] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [library, setLibrary] = useState(false)
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('apparatus')
  const [inspector, setInspector] = useState(false)
  const fallback = useEditor((s) => s.fallback)
  const narrow = useMedia('(max-width: 1099px)')
  const file = useRef<HTMLInputElement>(null)
  /** What Escape closes while a dialog is open (the one on top), or null when none is open. */
  const dialog = useRef<(() => void) | null>(null)
  useEffect(() => {
    dialog.current = fallback ? closeFallback : exporting ? () => setExporting(false) : help ? () => setHelp(false) : null
  }, [fallback, exporting, help])

  // The autosave: restore on start, then save 500 ms after each change. The Claude host, if it answers. The focus never
  // drops to the page: when the control that has it goes away, the canvas takes it.
  useEffect(() => {
    restoreAutosave(host)
    void connectHost()
    const stopSaving = startAutosave(host)
    const stopFocus = keepFocus(canvas)
    return () => {
      stopSaving()
      stopFocus()
    }
  }, [])

  // The keys of section 12. While a dialog is open, only Escape, which closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog.current) {
        if (e.key === 'Escape') dialog.current()
        return
      }
      const done = handleKey(e, {
        host,
        // `/`: the Apparatus tab of the library (its drawer opens in a narrow window), then the focus in its search box.
        focusSearch: () => {
          flushSync(() => {
            setLibrary(true)
            setLibraryTab('apparatus')
          })
          const el = document.getElementById(SEARCH_ID) as HTMLInputElement | null
          el?.focus()
          el?.select()
        },
        toggleHelp: () => setHelp((h) => !h),
        openFile: () => file.current?.click(),
      })
      if (done) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={`app${narrow ? ' narrow' : ''}`}>
      <TopBar
        host={host}
        narrow={narrow}
        libraryOpen={library}
        inspectorOpen={inspector}
        onLibrary={() => setLibrary(!library)}
        onInspector={() => setInspector(!inspector)}
        onHelp={() => setHelp(true)}
        onOpen={() => file.current?.click()}
        onExport={() => setExporting(true)}
      />
      <Library
        open={library}
        shut={narrow && !library}
        tab={libraryTab}
        setTab={setLibraryTab}
        onClose={() => setLibrary(false)}
        // Enter in the search box added a part: the canvas takes the focus, so that the arrow keys move the new part.
        onAdded={() => {
          canvas()?.focus({ preventScroll: true })
          setLibrary(false)
        }}
      />
      <Canvas />
      <Banner />
      <Inspector open={inspector} shut={narrow && !inspector} onClose={() => setInspector(false)} />
      <StatusBar />
      {help && <HelpDialog onClose={() => setHelp(false)} />}
      {exporting && <ExportDialog host={host} onClose={() => setExporting(false)} />}
      <FallbackDialog host={host} />
      <input
        ref={file}
        type="file"
        accept=".json,.svg,application/json,image/svg+xml"
        hidden
        aria-label="Open file"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void openFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
