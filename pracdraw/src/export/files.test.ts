import { describe, expect, it } from 'vitest'
import { demoDoc } from '../demo'
import { setSettings } from '../model/commands'
import { newDoc } from '../model/types'
import { SAVE_EXT, exportName, fileName, readDocFile, safeName, saveName, saveText } from './files'
import { DEFAULT_EXPORT, exportSvg } from './picture'

const json = (d: unknown) => JSON.parse(JSON.stringify(d))

describe('file names (section 7)', () => {
  it('each of \\ / : * ? " < > | and each control character becomes -', () => {
    expect(safeName('a\\b/c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j')
    expect(safeName('tab\there\nnew\u0000nul\u001fus\u007fdel\u0085nel')).toBe('tab-here-new-nul-us-del-nel')
    expect(safeName('Rates: 1/2 (fast?)')).toBe('Rates- 1-2 (fast-)')
  })
  it('keeps every other character, and an empty name becomes "diagram"', () => {
    expect(safeName('Électrolyse — CuSO₄ 🧪')).toBe('Électrolyse — CuSO₄ 🧪')
    expect(safeName('')).toBe('diagram')
    expect(safeName('   ')).toBe('diagram')
    expect(safeName('  Titration  ')).toBe('Titration')
    expect(safeName('***')).toBe('---')
  })
  it('Save writes <title>.pracdraw.json', () => {
    expect(SAVE_EXT).toBe('.pracdraw.json')
    expect(saveName(newDoc('Titration'))).toBe('Titration.pracdraw.json')
    expect(saveName(newDoc(''))).toBe('diagram.pracdraw.json')
    expect(saveName(newDoc('a/b'))).toBe('a-b.pracdraw.json')
    expect(fileName('x', '.png')).toBe('x.png')
  })
  it('an export is <title>.png, <title>-blank.png or <title>-letters.png, and the same with .svg', () => {
    const doc = newDoc('Heating: water')
    expect(exportName(doc, { format: 'png', labels: 'shown' })).toBe('Heating- water.png')
    expect(exportName(doc, { format: 'png', labels: 'text' })).toBe('Heating- water.png')
    expect(exportName(doc, { format: 'png', labels: 'blank' })).toBe('Heating- water-blank.png')
    expect(exportName(doc, { format: 'png', labels: 'letters' })).toBe('Heating- water-letters.png')
    expect(exportName(doc, { format: 'svg', labels: 'text' })).toBe('Heating- water.svg')
    expect(exportName(doc, { format: 'svg', labels: 'blank' })).toBe('Heating- water-blank.svg')
    expect(exportName(doc, { format: 'svg', labels: 'letters' })).toBe('Heating- water-letters.svg')
    // As shown: the document's own label mode names the file.
    expect(exportName(setSettings(doc, { labelMode: 'letters' }), { format: 'svg', labels: 'shown' })).toBe('Heating- water-letters.svg')
    expect(exportName(setSettings(doc, { labelMode: 'letters' }), { format: 'png', labels: 'text' })).toBe('Heating- water.png')
    expect(exportName(newDoc(''), { format: 'png', labels: 'blank' })).toBe('diagram-blank.png')
  })
})

describe('the saved file', () => {
  it('is the document as JSON, indented with two spaces', () => {
    const doc = demoDoc()
    const text = saveText(doc)
    const lines = text.split('\n')
    expect(lines[0]).toBe('{')
    expect(lines[1]).toBe('  "app": "pracdraw",')
    expect(lines[2]).toBe('  "version": 1,')
    expect(text).toBe(JSON.stringify(doc, null, 2))
    expect(JSON.parse(text)).toEqual(json(doc))
  })
})

describe('readDocFile', () => {
  it('reads a saved file, and an SVG that PracDraw exported, by its name or its text', () => {
    const doc = demoDoc()
    const want = { ok: true, doc: json(doc), problems: [] }
    expect(readDocFile(saveText(doc), 'Style reference.pracdraw.json')).toEqual(want)
    expect(readDocFile('\uFEFF' + saveText(doc), 'x.json')).toEqual(want)
    const svg = exportSvg(doc, { ...DEFAULT_EXPORT, format: 'svg' })
    expect(readDocFile(svg, 'Style reference.svg')).toEqual(want)
    expect(readDocFile(svg)).toEqual(want)
    expect(readDocFile('\n  ' + svg, 'renamed.json')).toEqual(want)
  })
  it('fails on anything else, with a problem', () => {
    expect(readDocFile('hello', 'notes.txt')).toEqual({ ok: false, problems: ['The file does not hold a PracDraw diagram: it is not JSON.'] })
    expect(readDocFile('{"app":"chemix"}', 'x.json')).toEqual({ ok: false, problems: ['The file does not hold a PracDraw diagram.'] })
    expect(readDocFile('<svg/>', 'x.svg').ok).toBe(false)
    expect(readDocFile(saveText(demoDoc()), 'wrong.svg').ok).toBe(false)
  })
})
