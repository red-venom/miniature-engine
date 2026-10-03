// App.tsx — starter shell only. It shows the style reference and proves the three render back-ends.
// Phase 2 replaces this file with the editor.

import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { demoDoc, DEMO_SIZE } from './demo'
import { canvasToBlob, renderCanvas } from './export/canvas'
import { svgDocument } from './kernel/nodes'
import type { Doc, DocSettings } from './model/types'
import { NodeView } from './render/NodeView'
import { docNodes } from './render/render'

interface Store {
  doc: Doc
  set: (patch: Partial<DocSettings>) => void
}
const useStore = create<Store>((set) => ({
  doc: demoDoc(),
  set: (patch) => set((s) => ({ doc: { ...s.doc, settings: { ...s.doc.settings, ...patch } } })),
}))

declare global {
  interface Window {
    __starter: { png: (scale: number) => string; svg: () => string }
  }
}

const MODES: DocSettings['labelMode'][] = ['text', 'blank', 'letters']
const { w, h } = DEMO_SIZE

export default function App() {
  const doc = useStore((s) => s.doc)
  const set = useStore((s) => s.set)
  const [msg, setMsg] = useState('')
  const nodes = useMemo(() => docNodes(doc), [doc])

  // Test hooks for e2e/starter.spec.ts.
  useEffect(() => {
    window.__starter = { png: (scale) => renderCanvas(nodes, w, h, scale, '#ffffff').toDataURL('image/png'), svg: () => svgDocument(nodes, w, h, '#ffffff') }
  }, [nodes])

  const copy = async () => {
    try {
      // Give ClipboardItem a promise, so that the write starts inside the click (Safari needs this).
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(renderCanvas(nodes, w, h, 2, '#ffffff')) })])
      setMsg('Copied')
    } catch (e) {
      setMsg('Copy failed: ' + (e as Error).message)
    }
  }

  return (
    <>
      <div className="bar">
        <strong>PracDraw starter</strong>
        <button onClick={() => set({ mono: !doc.settings.mono })}>{doc.settings.mono ? 'Colour' : 'Photocopy-safe'}</button>
        <button onClick={() => set({ labelMode: MODES[(MODES.indexOf(doc.settings.labelMode) + 1) % 3] })}>Labels: {doc.settings.labelMode}</button>
        <button onClick={copy}>Copy PNG</button>
        <span role="status">{msg}</span>
      </div>
      <svg id="stage" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {nodes.map((n, i) => (
          <NodeView key={n.t === 'g' && n.key ? n.key : i} n={n} />
        ))}
      </svg>
    </>
  )
}
