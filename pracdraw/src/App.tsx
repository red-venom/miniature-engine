// App.tsx — the editor: top bar, library, canvas, inspector, status bar (section 12 of the specification).

import { useEffect, useRef, useState } from 'react'
import { docFromText, loadDoc } from './editor/actions'
import { restoreAutosave, startAutosave } from './editor/autosave'
import { handleKey } from './editor/keys'
import { useEditor } from './editor/store'
import { webHost } from './host/web'
import { Canvas } from './ui/Canvas'
import { HelpDialog } from './ui/HelpDialog'
import { Inspector } from './ui/Inspector'
import { Library } from './ui/Library'
import { SEARCH_ID } from './ui/constants'
import { StatusBar } from './ui/StatusBar'
import { TopBar } from './ui/TopBar'
import { useMedia } from './ui/useMedia'

const host = webHost

export default function App() {
  const [help, setHelp] = useState(false)
  const [library, setLibrary] = useState(false)
  const [inspector, setInspector] = useState(false)
  const narrow = useMedia('(max-width: 1099px)')
  const file = useRef<HTMLInputElement>(null)
  const helpRef = useRef(help)
  useEffect(() => {
    helpRef.current = help
  }, [help])

  // The autosave: restore on start, then save 500 ms after each change.
  useEffect(() => {
    restoreAutosave(host)
    return startAutosave(host)
  }, [])

  // The keys of section 12.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (helpRef.current) {
        if (e.key === 'Escape') setHelp(false)
        return
      }
      const done = handleKey(e, {
        host,
        focusSearch: () => {
          setLibrary(true)
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

  const onFile = async (f: File | undefined) => {
    if (!f) return
    const doc = docFromText(await f.text())
    if (doc) loadDoc(doc)
    else useEditor.getState().setStatus('Not a PracDraw file')
  }

  return (
    <div className={`app${narrow ? ' narrow' : ''}`}>
      <TopBar
        host={host}
        narrow={narrow}
        onLibrary={() => setLibrary(!library)}
        onInspector={() => setInspector(!inspector)}
        onHelp={() => setHelp(true)}
        onOpen={() => file.current?.click()}
      />
      <Library open={library} onClose={() => setLibrary(false)} />
      <Canvas />
      <Inspector open={inspector} onClose={() => setInspector(false)} />
      <StatusBar />
      {help && <HelpDialog onClose={() => setHelp(false)} />}
      <input
        ref={file}
        type="file"
        accept=".json,.svg,application/json,image/svg+xml"
        hidden
        aria-label="Open file"
        onChange={(e) => {
          void onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
