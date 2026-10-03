import { beforeEach, describe, expect, it } from 'vitest'
import type { Host } from '../host/host'
import { DocBuilder } from '../model/build'
import type { SymbolItem } from '../model/types'
import { controlKey, handleKey, inTextField, type KeyContext } from './keys'
import { useEditor } from './store'

const s = () => useEditor.getState()

/** A stand-in for an element with the focus: the key rules read only its tag, its type and whether it is editable. */
const el = (tagName: string, more: Record<string, unknown> = {}) => ({ tagName, ...more }) as unknown as EventTarget

const ctx: KeyContext = { host: {} as Host, focusSearch() {}, toggleHelp() {}, openFile() {} }

/** A key press with no Ctrl, Cmd, Alt or Shift, unless given. */
const press = (key: string, target: EventTarget | null, mods: Partial<KeyboardEvent> = {}) =>
  handleKey({ key, target, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods } as KeyboardEvent, ctx)

describe('inTextField', () => {
  it('is true for fields that take text, and false for checkboxes, radio buttons, sliders, colours and selects', () => {
    for (const type of ['text', 'number', 'search', 'email', 'url', 'tel', 'password', 'date', 'time']) expect(inTextField(el('INPUT', { type }))).toBe(true)
    expect(inTextField(el('INPUT'))).toBe(true) // an input with no type takes text
    expect(inTextField(el('TEXTAREA'))).toBe(true)
    expect(inTextField(el('DIV', { isContentEditable: true }))).toBe(true)
    for (const type of ['checkbox', 'radio', 'range', 'color', 'button', 'file']) expect(inTextField(el('INPUT', { type }))).toBe(false)
    expect(inTextField(el('SELECT', { type: 'select-one' }))).toBe(false)
    expect(inTextField(el('BUTTON', { type: 'button' }))).toBe(false)
    expect(inTextField(el('DIV', { isContentEditable: false }))).toBe(false)
    expect(inTextField(null)).toBe(false)
  })
})

describe('controlKey', () => {
  it('leaves Space to buttons, checkboxes and selects, and the arrow keys to sliders, radio buttons and selects', () => {
    expect(controlKey(el('BUTTON'), ' ')).toBe(true)
    expect(controlKey(el('INPUT', { type: 'checkbox' }), ' ')).toBe(true)
    expect(controlKey(el('SELECT'), ' ')).toBe(true)
    expect(controlKey(el('INPUT', { type: 'range' }), 'ArrowLeft')).toBe(true)
    expect(controlKey(el('INPUT', { type: 'radio' }), 'ArrowDown')).toBe(true)
    expect(controlKey(el('SELECT'), 'ArrowUp')).toBe(true)
    expect(controlKey(el('INPUT', { type: 'checkbox' }), 'ArrowRight')).toBe(false)
    expect(controlKey(el('INPUT', { type: 'checkbox' }), 'Delete')).toBe(false)
    expect(controlKey(el('SELECT'), 'Delete')).toBe(false)
    expect(controlKey(el('BODY'), ' ')).toBe(false)
    expect(controlKey(null, 'ArrowLeft')).toBe(false)
  })
})

describe('handleKey', () => {
  beforeEach(() => {
    const b = new DocBuilder()
    b.symbol('beaker', { x: 0, y: 0 })
    s().replace(b.doc)
    s().setTool('select')
    s().select(['beaker1'])
  })
  const x = () => (s().doc.items.beaker1 as SymbolItem | undefined)?.x

  it('keys work while a checkbox or a select has the focus (section 12: they stop only in a text field)', () => {
    expect(press('ArrowRight', el('INPUT', { type: 'checkbox' }))).toBe(true)
    expect(x()).toBe(1)
    expect(press('z', el('SELECT'), { ctrlKey: true })).toBe(true)
    expect(x()).toBe(0)
    expect(press('Delete', el('INPUT', { type: 'checkbox' }))).toBe(true)
    expect(s().doc.order).toEqual([])
  })

  it('keys do nothing in a text field, and a control keeps the keys it uses', () => {
    expect(press('Delete', el('INPUT', { type: 'text' }))).toBe(false)
    expect(press('Delete', el('TEXTAREA'))).toBe(false)
    expect(press('ArrowRight', el('INPUT', { type: 'range' }))).toBe(false)
    expect(press('ArrowDown', el('SELECT'))).toBe(false)
    expect(s().doc.order).toEqual(['beaker1'])
    expect(x()).toBe(0)
    // With Ctrl, the key is the editor's, whatever has the focus, unless it is a text field.
    expect(press('a', el('INPUT', { type: 'range' }), { ctrlKey: true })).toBe(true)
    expect(press('a', el('INPUT', { type: 'number' }), { ctrlKey: true })).toBe(false)
  })

  it('L and T choose the Label and Text tools; Enter edits the one selected label; Escape closes the text box', () => {
    const body = el('BODY')
    expect(press('l', body)).toBe(true)
    expect(s().tool).toBe('label')
    expect(press('t', body)).toBe(true)
    expect(s().tool).toBe('text')
    expect(press('v', body)).toBe(true)
    // Enter does nothing with a symbol selected; with one label selected it opens the text box on it.
    expect(press('Enter', body)).toBe(false)
    const b = new DocBuilder()
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    b.label('beaker', 100, 0, [beaker, 50, 60])
    s().replace(b.doc)
    s().select(['label2'])
    expect(press('Enter', body)).toBe(true)
    expect(s().textEdit).toMatchObject({ fresh: false, text: 'beaker', label: { id: 'label2' } })
    // In the box itself (a text field) the keys do nothing; Escape elsewhere closes it, and the label keeps its text.
    expect(press('Escape', el('TEXTAREA'))).toBe(false)
    expect(s().textEdit).not.toBeNull()
    expect(press('Escape', body)).toBe(true)
    expect(s().textEdit).toBeNull()
    expect((s().doc.items.label2 as { text: string }).text).toBe('beaker')
  })

  it("Enter on a focused button, radio button, select or link is the control's: it opens no text box", () => {
    const b = new DocBuilder()
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    b.label('beaker', 100, 0, [beaker, 50, 60])
    s().replace(b.doc)
    s().select(['label2'])
    const controls = [
      el('BUTTON', { type: 'button' }), // Copy image, the inspector's Back
      el('BUTTON', { type: 'button', role: 'radio' }), // a label-mode radio
      el('INPUT', { type: 'radio' }),
      el('INPUT', { type: 'checkbox' }),
      el('SELECT', { type: 'select-one' }),
      el('A'),
      el('SUMMARY'),
    ]
    for (const target of controls) {
      expect(controlKey(target, 'Enter')).toBe(true)
      expect(press('Enter', target)).toBe(false)
      expect(s().textEdit).toBeNull()
    }
    // On the page or the canvas, Enter edits the selected label.
    expect(controlKey(el('BODY'), 'Enter')).toBe(false)
    expect(controlKey(el('DIV', { classList: { contains: (c: string) => c === 'canvas' } }), 'Enter')).toBe(false)
    expect(controlKey(null, 'Enter')).toBe(false)
    expect(press('Enter', el('DIV', { classList: { contains: (c: string) => c === 'canvas' } }))).toBe(true)
    expect(s().textEdit).toMatchObject({ label: { id: 'label2' } })
  })
})
