import { beforeEach, describe, expect, it } from 'vitest'
import { P } from '../kernel/geom'
import { DocBuilder } from '../model/build'
import { CONNECTOR_PRESETS } from '../model/connectors'
import type { ConnectorItem } from '../model/types'
import { addPresetAt, addSymbolAt, draftAdd, draftBack, draftCancel, draftFinish, draftHover, setTool, toolDone, undo } from './actions'
import { CLICK_PX, SNAP_PX, anchorsOf, pointFor } from './connect'
import { toolHint } from './hints'
import { useEditor } from './store'

const s = () => useEditor.getState()
const keys = { shiftKey: false, ctrlKey: false, metaKey: false }
const preset = (id: string) => CONNECTOR_PRESETS.find((p) => p.id === id)!

beforeEach(() => {
  s().replace(new DocBuilder().doc)
  s().setTool('select')
  s().setCanvas(800, 600)
  s().setView({ x: 0, y: 0, zoom: 1 })
})

describe('pointFor', () => {
  /** A bung with one hole: a port 12 u above its centre, at (100, 88). */
  const bungDoc = () => {
    const b = new DocBuilder()
    b.symbol('bung', { x: 100, y: 100 })
    return b.doc
  }
  it('a port, terminal or tip within 8 screen px catches the point, at any zoom', () => {
    expect([SNAP_PX, CLICK_PX]).toEqual([8, 4])
    const doc = bungDoc()
    expect(pointFor(doc, P(106, 90), [], 1, true, keys)).toEqual({ p: P(100, 88), anchor: true })
    // At 200 % the 8 px are 4 u.
    expect(pointFor(doc, P(106, 90), [], 2, true, keys)).toEqual({ p: P(106, 90), anchor: false })
    expect(pointFor(doc, P(103, 90), [], 2, true, keys)).toEqual({ p: P(100, 88), anchor: true })
  })
  it('Ctrl, Cmd or Snap off turn snapping off; Shift still gives 45° steps', () => {
    const doc = bungDoc()
    expect(pointFor(doc, P(106, 90), [], 1, true, { ...keys, ctrlKey: true }).anchor).toBe(false)
    expect(pointFor(doc, P(106, 90), [], 1, true, { ...keys, metaKey: true }).anchor).toBe(false)
    expect(pointFor(doc, P(106, 90), [], 1, false, keys).anchor).toBe(false)
    expect(pointFor(doc, P(300, 103), [P(200, 100)], 1, true, keys).p).toEqual(P(300, 100))
    expect(pointFor(doc, P(300, 103), [P(200, 100)], 1, false, keys).p).toEqual(P(300, 103))
    expect(pointFor(doc, P(300, 190), [P(200, 100)], 1, false, { ...keys, shiftKey: true }).p).toEqual(P(295, 195))
  })
  it('works out the anchors once for each document', () => {
    const doc = bungDoc()
    expect(anchorsOf(doc)).toBe(anchorsOf(doc))
    expect(anchorsOf(doc)).toEqual([P(100, 88)])
    expect(anchorsOf(new DocBuilder().doc)).toEqual([])
  })
})

describe('drawing a connector', () => {
  it('a connector tool has a draft with no points; another tool has none', () => {
    setTool('tube')
    expect(s().draft).toEqual({ kind: 'glassTube', points: [] })
    setTool('wire')
    expect(s().draft).toEqual({ kind: 'wire', points: [] })
    setTool('line')
    expect(s().draft).toEqual({ kind: 'line', points: [] })
    setTool('rect')
    expect(s().draft).toBeNull()
  })
  it('places points, never the last one again, and finishes as one undo step', () => {
    setTool('tube')
    expect(draftAdd(P(0, 0))).toBe(true)
    expect(draftAdd(P(2, 2), 4)).toBe(false) // the second click of a double-click
    expect(draftAdd(P(0, 0))).toBe(false)
    expect(draftAdd(P(0, 100), 4)).toBe(true)
    expect(draftAdd(P(100, 100), 4)).toBe(true)
    expect(s().draft?.points).toEqual([P(0, 0), P(0, 100), P(100, 100)])
    expect(s().doc.order).toEqual([]) // not in the document until it is finished
    const id = draftFinish()!
    expect(s().past).toHaveLength(1)
    expect(s().doc.items[id]).toEqual({
      id,
      type: 'connector',
      kind: 'glassTube',
      points: [
        { x: 0, y: 0 },
        { x: 0, y: 100, r: 12 },
        { x: 100, y: 100 },
      ],
      startCap: 'none',
      endCap: 'none',
      width: 7,
    })
    // The tool returns to Select, and the new connector is the selection.
    expect(s().tool).toBe('select')
    expect(s().draft).toBeNull()
    expect(s().selection).toEqual([id])
    undo()
    expect(s().doc.order).toEqual([])
  })
  it('a double-click adds its point once, also when its second click placed a point', () => {
    setTool('line')
    draftAdd(P(0, 0))
    // The first click, 8 u below level: the snap put its point level with the first one.
    draftAdd(P(100, 0), 4)
    // The second click lands on the pointer, 8 u from that point, so it places one too. The double-click takes it back.
    expect(draftAdd(P(100, 8), 4)).toBe(true)
    const id = draftFinish(true)!
    expect((s().doc.items[id] as ConnectorItem).points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ])
    expect(s().past).toHaveLength(1)
    expect(s().tool).toBe('select')
  })
  it('Backspace takes back the last point; Escape drops the connector and keeps the tool', () => {
    setTool('wire')
    draftAdd(P(0, 0))
    draftAdd(P(50, 0))
    draftBack()
    expect(s().draft?.points).toEqual([P(0, 0)])
    draftCancel()
    expect(s().draft).toMatchObject({ kind: 'wire', points: [] })
    expect(s().tool).toBe('wire')
    // One point makes no connector.
    draftAdd(P(0, 0))
    expect(draftFinish()).toBeNull()
    expect(s().draft?.points).toEqual([])
    expect(draftFinish()).toBeNull()
    expect(s().doc.order).toEqual([])
    expect(s().past).toHaveLength(0)
  })
  it('the rubber band follows the pointer', () => {
    setTool('line')
    draftHover(P(5, 5), true)
    expect(s().draft).toMatchObject({ pointer: P(5, 5), anchor: true })
    const d = s().draft
    draftHover(P(5, 5), true)
    expect(s().draft).toBe(d)
    draftHover(undefined)
    expect(s().draft?.pointer).toBeUndefined()
  })
  it('another tool drops a half-drawn connector; the same tool keeps it', () => {
    setTool('tube')
    draftAdd(P(0, 0))
    setTool('tube')
    expect(s().draft?.points).toHaveLength(1)
    setTool('select')
    expect(s().draft).toBeNull()
  })
  it('after a shape too, the tool returns to Select with the new item selected', () => {
    const b = new DocBuilder()
    b.symbol('beaker')
    s().replace(b.doc)
    setTool('rect')
    toolDone('beaker1')
    expect(s().tool).toBe('select')
    expect(s().selection).toEqual(['beaker1'])
  })
})

describe('the "Tubes and lines" presets', () => {
  it('each adds its connector at the centre of the view, the next 20 u further on, selected, one undo step each', () => {
    const a = addPresetAt(preset('arrow'))
    const b = addPresetAt(preset('arrow'))
    expect((s().doc.items[a] as ConnectorItem).points).toEqual([
      { x: 360, y: 300 },
      { x: 440, y: 300 },
    ])
    expect((s().doc.items[b] as ConnectorItem).points).toEqual([
      { x: 380, y: 320 },
      { x: 460, y: 320 },
    ])
    expect(s().doc.items[b]).toMatchObject({ kind: 'line', endCap: 'arrow' })
    expect(s().selection).toEqual([b])
    expect(s().past).toHaveLength(2)
    // A drop puts it at the pointer.
    const c = addPresetAt(preset('wire'), P(0, 0))
    expect((s().doc.items[c] as ConnectorItem).points).toEqual([
      { x: -60, y: 0 },
      { x: 60, y: 0 },
    ])
  })
  it('an add from the library returns to Select, unless a connector is half drawn', () => {
    setTool('rect')
    addSymbolAt('beaker')
    expect(s().tool).toBe('select')
    setTool('tube')
    addPresetAt(preset('wire'))
    expect(s().tool).toBe('select')
    setTool('tube')
    draftAdd(P(0, 0))
    addSymbolAt('beaker')
    expect(s().tool).toBe('tube')
    expect(s().draft?.points).toEqual([P(0, 0)])
  })
})

describe('toolHint', () => {
  it('has a hint for each tool, one for a selected connector or label, and one for the text box', () => {
    expect(toolHint('select')).toMatch(/^Click to select/)
    expect(toolHint('select', { connector: true })).toMatch(/square handle/)
    expect(toolHint('select', { label: true })).toMatch(/leader end/)
    expect(toolHint('tube')).toMatch(/^Tube: click to place each point/)
    expect(toolHint('tube', { drawing: true })).toMatch(/Double-click or Enter finishes/)
    expect(toolHint('wire', { drawing: true })).toMatch(/^Wire: /)
    expect(toolHint('line')).toMatch(/^Line and arrow: /)
    expect(toolHint('rect')).toMatch(/^Rectangle: drag/)
    expect(toolHint('ellipse')).toMatch(/^Ellipse: drag/)
    expect(toolHint('label')).toMatch(/^Label: press on the part/)
    expect(toolHint('text')).toMatch(/^Text: click/)
    expect(toolHint('label', { editing: true })).toMatch(/Enter finishes, Shift\+Enter starts a new line, Escape cancels/)
  })
})
