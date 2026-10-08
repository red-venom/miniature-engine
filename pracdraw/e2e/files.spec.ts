// files.spec.ts — phase 7: export and files, the hosts, then the template gallery (sections 12 and 13). The gate tests
// of section 15 have its exact titles.

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { FILE } from './hook.ts'
import { demoDoc } from '../src/demo.ts'
import { docFromSvg } from '../src/export/svg.ts'
import { P } from '../src/kernel/geom.ts'
import { FONT, SCRIPT, type Node } from '../src/kernel/nodes.ts'
import { parseMarkup } from '../src/kernel/text.ts'
import { docBounds, itemsBox, type Measure } from '../src/model/bounds.ts'
import { DocBuilder } from '../src/model/build.ts'
import { setSettings } from '../src/model/commands.ts'
import type { Doc, LabelItem, SymbolItem } from '../src/model/types.ts'
import { docNodes } from '../src/render/render.ts'
import { TEMPLATES } from '../src/templates/index.ts'

/** A document as a file holds it: JSON, so undefined fields are gone. */
const json = <T>(d: T): T => JSON.parse(JSON.stringify(d))

async function open(page: Page) {
  await page.goto(FILE)
  await page.waitForFunction(() => !!window.__pracdraw)
}
const getDoc = (page: Page) => page.evaluate(() => window.__pracdraw.doc())
const load = (page: Page, doc: Doc) => page.evaluate((d) => window.__pracdraw.load(d), doc)

/** A window wide enough for the whole top bar: New, Open and Save are on it, not in the More menu. */
const WIDE = { width: 1800, height: 1000 }

/** Open the export dialog from the top bar. */
async function exportDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export' })
  await expect(dialog).toBeVisible()
  return dialog
}

/** Choose an option in a row of the export dialog. */
const choose = (dialog: Locator, row: string, option: string) =>
  dialog.getByRole('radiogroup', { name: row }).getByRole('radio', { name: option, exact: true }).click()
const checked = (dialog: Locator, row: string, option: string) =>
  expect(dialog.getByRole('radiogroup', { name: row }).getByRole('radio', { name: option, exact: true })).toHaveAttribute('aria-checked', 'true')

/** Do something that downloads a file, and take the file: its name and bytes. */
async function download(page: Page, act: () => Promise<unknown>): Promise<{ name: string; data: Buffer }> {
  const [d] = await Promise.all([page.waitForEvent('download'), act()])
  return { name: d.suggestedFilename(), data: readFileSync((await d.path())!) }
}

/** Open a file through the file chooser of the top bar's Open button. */
async function openThroughChooser(page: Page, info: TestInfo, name: string, data: Buffer | string) {
  const path = info.outputPath(name)
  writeFileSync(path, data)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open', exact: true }).click()])
  await chooser.setFiles(path)
}

/** The width and height of a PNG, from its IHDR chunk. */
const pngSize = (png: Buffer) => {
  expect(png.subarray(1, 4).toString('latin1')).toBe('PNG')
  return { w: png.readUInt32BE(16), h: png.readUInt32BE(20) }
}

/**
 * `docBounds` measures text through `measure`. In the browser that is canvas measureText, with each run of markup at
 * its size and scripts at 0.7 size (src/editor/measure.ts). This measures every text that `docBounds` asks for, the
 * same way, in the page, and answers from that table: the test's own copy of the browser's measure.
 */
async function browserMeasure(page: Page, docs: Doc[]): Promise<Measure> {
  const wanted = new Map<string, { size: number; text: string }>()
  for (const doc of docs)
    docBounds(doc, (text, size) => {
      wanted.set(`${size} ${text}`, { size, text })
      return 0
    })
  const jobs = [...wanted].map(([key, { size, text }]) => ({
    key,
    runs: parseMarkup(text).map((r) => ({ text: r.text, size: r.script === 'normal' ? size : size * SCRIPT.scale })),
  }))
  const widths = await page.evaluate(
    ({ jobs, font }) => {
      const c = document.createElement('canvas').getContext('2d')!
      return jobs.map((j): [string, number] => {
        let w = 0
        for (const r of j.runs) {
          c.font = `${r.size}px ${font}`
          w += c.measureText(r.text).width
        }
        return [j.key, w]
      })
    },
    { jobs, font: FONT },
  )
  const table = new Map(widths)
  return (text, size) => {
    const w = table.get(`${size} ${text}`)
    if (w === undefined) throw new Error(`not measured: ${size} ${text}`)
    return w
  }
}

/** The darkest red value round each point of a PNG (a 5 × 5 px square), read in the page. */
const darkest = (page: Page, png: Buffer, points: { x: number; y: number }[]) =>
  page.evaluate(
    async ({ url, points }) => {
      const img = new Image()
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0)
      return points.map((p) => {
        const d = x.getImageData(Math.round(p.x) - 2, Math.round(p.y) - 2, 5, 5).data
        let min = 255
        for (let i = 0; i < d.length; i += 4) min = Math.min(min, d[i])
        return min
      })
    },
    { url: `data:image/png;base64,${png.toString('base64')}`, points },
  )

// ---------------------------------------------------------------- export

test('png-size-matches-bounds', async ({ page }) => {
  await open(page)
  const demo = demoDoc()
  await load(page, demo)
  const modes = { text: setSettings(demo, { labelMode: 'text' }), blank: setSettings(demo, { labelMode: 'blank' }) }
  const measure = await browserMeasure(page, Object.values(modes))
  const dialog = await exportDialog(page)
  await checked(dialog, 'Format', 'PNG')
  await checked(dialog, 'Size', '2×')
  await checked(dialog, 'Background', 'White')
  const sizes: Record<string, { w: number; h: number }> = {}
  for (const [mode, option] of [
    ['text', 'Text'],
    ['blank', 'Blank'],
  ] as const) {
    await choose(dialog, 'Labels', option)
    const file = await download(page, () => dialog.getByRole('button', { name: 'Download', exact: true }).click())
    expect(file.name).toBe(mode === 'text' ? 'Style reference.png' : 'Style reference-blank.png')
    const size = (sizes[mode] = pngSize(file.data))
    // 2 × the docBounds of that mode. The box is rounded out to whole units, so that a PNG at 100 % lines up with the
    // pixels of the screen: less than 2 u more.
    const b = docBounds(modes[mode], measure)
    const x0 = Math.floor(b.x),
      y0 = Math.floor(b.y)
    expect(size).toEqual({ w: 2 * (Math.ceil(b.x + b.w) - x0), h: 2 * (Math.ceil(b.y + b.h) - y0) })
    expect(size.w - 2 * b.w).toBeGreaterThanOrEqual(0)
    expect(size.w - 2 * b.w).toBeLessThan(4)
    expect(size.h - 2 * b.h).toBeGreaterThanOrEqual(0)
    expect(size.h - 2 * b.h).toBeLessThan(4)
    if (mode !== 'blank') continue
    // In blank mode every 100 u line is inside the picture, and drawn there: at both of its ends and in its middle.
    const lines = modes.blank.order.map((id) => modes.blank.items[id]).filter((it): it is LabelItem => it.type === 'label' && !!it.target)
    expect(lines.length).toBeGreaterThan(10)
    const points = lines.flatMap((l) => {
      const dir = l.side === 'left' ? -1 : 1
      return [1, 50, 99].map((t) => ({ x: (l.x + dir * t - x0) * 2, y: (l.y - y0) * 2 }))
    })
    for (const p of points) {
      expect(p.x).toBeGreaterThan(2)
      expect(p.x).toBeLessThan(size.w - 2)
      expect(p.y).toBeGreaterThan(2)
      expect(p.y).toBeLessThan(size.h - 2)
    }
    for (const v of await darkest(page, file.data, points)) expect(v).toBeLessThan(128)
  }
  // The two modes make two different pictures, each to its own bounds.
  expect(sizes.blank).not.toEqual(sizes.text)
  // The labels were measured as drawn: the estimate of 0.56 × the size for each character gives another width (about
  // 17 u wider for this picture).
  const estimate = docBounds(modes.text)
  expect(Math.abs(estimate.w - docBounds(modes.text, measure).w)).toBeGreaterThan(4)
  expect(2 * (Math.ceil(estimate.x + estimate.w) - Math.floor(estimate.x))).not.toBe(sizes.text.w)
  // The hook's default export is the same picture as the dialog's PNG at 2× as shown (text mode here).
  const hookSize = await page.evaluate(async () => {
    const img = new Image()
    img.src = window.__pracdraw.png(2)
    await img.decode()
    return { w: img.width, h: img.height }
  })
  expect(hookSize).toEqual(sizes.text)
})

test('svg-reopens-equal', async ({ page }, info) => {
  await page.setViewportSize(WIDE)
  await open(page)
  await load(page, demoDoc())
  const editor = await getDoc(page)
  expect(editor.settings).toMatchObject({ labelMode: 'text', mono: false })
  const dialog = await exportDialog(page)
  await choose(dialog, 'Format', 'SVG')
  await choose(dialog, 'Labels', 'Letters')
  await choose(dialog, 'Photocopy-safe', 'On')
  const file = await download(page, () => dialog.getByRole('button', { name: 'Download', exact: true }).click())
  expect(file.name).toBe('Style reference-letters.svg')
  const svg = file.data.toString('utf8')
  // The file draws letters, photocopy-safe: no tints, and no label text.
  const drawing = svg.replace(/<metadata>[\s\S]*?<\/metadata>/, '')
  expect(drawing).toContain('>A</tspan>')
  expect(drawing).not.toContain('#cfe8f7')
  expect(drawing).not.toContain('delivery tube')
  // docFromSvg of the file gives the editor's document, with the editor's own settings: text mode, in colour.
  const r = docFromSvg(svg)
  expect(r).toEqual({ ok: true, doc: editor, problems: [] })
  if (r.ok) expect(r.doc.settings).toEqual(editor.settings)
  expect(await getDoc(page)).toEqual(editor)
  // Reopened in the app after New, through the file chooser: the same document.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'New', exact: true }).click()
  expect((await getDoc(page)).order).toEqual([])
  await openThroughChooser(page, info, file.name, file.data)
  await expect.poll(() => getDoc(page)).toEqual(editor)
  await expect(page.getByRole('region', { name: 'Message' })).toHaveCount(0)
})

// ---------------------------------------------------------------- files

test('save-open-round-trip', async ({ page }, info) => {
  await page.setViewportSize(WIDE)
  await open(page)
  // The reference picture, with a title that a file name cannot hold as it is, in letters mode and photocopy-safe.
  const doc = setSettings({ ...demoDoc(), title: 'Gas: collection / test?' }, { labelMode: 'letters', mono: true })
  await load(page, doc)
  const saved = await getDoc(page)
  // Save through the top bar: <title>.pracdraw.json, each forbidden character made -, indented with two spaces.
  const file = await download(page, () => page.getByRole('button', { name: 'Save', exact: true }).click())
  expect(file.name).toBe('Gas- collection - test-.pracdraw.json')
  const text = file.data.toString('utf8')
  expect(text.split('\n').slice(0, 3)).toEqual(['{', '  "app": "pracdraw",', '  "version": 1,'])
  expect(JSON.parse(text)).toEqual(saved)
  await expect(page.getByRole('status')).toHaveText(`Saved ${file.name}`)
  await expect(page.getByRole('button', { name: 'Download did not start?' })).toBeVisible()
  // New clears the diagram.
  await page.getByRole('button', { name: 'New', exact: true }).click()
  expect((await getDoc(page)).order).toEqual([])
  // Open the file through the file chooser: the document equals the saved one.
  await openThroughChooser(page, info, file.name, file.data)
  await expect.poll(() => getDoc(page)).toEqual(saved)
  await expect(page.getByRole('status')).toHaveText(`Opened ${file.name}`)
  await expect(page.getByRole('region', { name: 'Message' })).toHaveCount(0)
  // Opening is one undo step; New was one too.
  await page.keyboard.press('Control+z')
  expect((await getDoc(page)).order).toEqual([])
  await page.keyboard.press('Control+z')
  expect(await getDoc(page)).toEqual(saved)
  await page.keyboard.press('Control+y')
  await page.keyboard.press('Control+y')
  expect(await getDoc(page)).toEqual(saved)
})

test('unknown-symbol-opens', async ({ page }, info) => {
  await page.setViewportSize(WIDE)
  await open(page)
  // A document that holds an item with the symbol id fromTheFuture, as a file from a newer version could.
  const b = new DocBuilder('From the future')
  b.symbol('beaker', { x: 0, y: 0 })
  b.doc.items.future = {
    id: 'future',
    type: 'symbol',
    symbol: 'fromTheFuture',
    x: 300,
    y: 0,
    rot: 0,
    flip: false,
    w: 120,
    h: 80,
    params: { glow: true },
    contents: {},
  }
  b.doc.order.push('future')
  const doc = json(b.doc)
  await openThroughChooser(page, info, 'future.pracdraw.json', JSON.stringify(doc, null, 2))
  await expect.poll(() => getDoc(page)).toEqual(doc)
  await expect(page.getByRole('region', { name: 'Message' })).toHaveCount(0)
  // The canvas shows a dashed box with that text.
  const item = page.locator('#stage [data-id="future"]')
  await expect(item.locator('text')).toHaveText('fromTheFuture')
  const dashed = item.locator('path[stroke-dasharray]')
  await expect(dashed).toHaveCount(1)
  const zoom = (await page.evaluate(() => window.__pracdraw.view())).zoom
  const box = (await dashed.boundingBox())!
  expect(box.width).toBeCloseTo(120 * zoom, -1)
  expect(box.height).toBeCloseTo(80 * zoom, -1)
  // It moves like any other item: drag it by its text (with Ctrl, so that nothing snaps).
  const t = (await item.locator('text').boundingBox())!
  await page.keyboard.down('Control')
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) await page.mouse.move(t.x + t.width / 2 + 10 * i, t.y + t.height / 2 + 5 * i)
  await page.mouse.up()
  await page.keyboard.up('Control')
  const moved = (await getDoc(page)).items.future as SymbolItem
  expect(moved.x).toBeCloseTo(300 + 60 / zoom, 0)
  expect(moved.y).toBeCloseTo(30 / zoom, 0)
  await expect(page.locator('.statusbar .selected')).toHaveText('fromTheFuture')
  // Save keeps it, with its parameters, where it was moved to.
  const file = await download(page, () => page.getByRole('button', { name: 'Save', exact: true }).click())
  const saved = JSON.parse(file.data.toString('utf8')) as Doc
  expect(saved.items.future).toEqual(moved)
  expect(saved.items.future).toMatchObject({ symbol: 'fromTheFuture', params: { glow: true } })
  // It deletes like any other item, and Undo brings it back.
  await page.keyboard.press('Delete')
  expect((await getDoc(page)).items.future).toBeUndefined()
  await expect(item).toHaveCount(0)
  await page.keyboard.press('Control+z')
  expect((await getDoc(page)).items.future).toEqual(moved)
})

test('open-lists-problems-in-a-banner', async ({ page }, info) => {
  await page.setViewportSize(WIDE)
  await open(page)
  await load(page, demoDoc())
  const before = await getDoc(page)
  // A file that is not a PracDraw diagram: the diagram stays, and the banner says why.
  await openThroughChooser(page, info, 'notes.json', '{"hello": 1}')
  const banner = page.getByRole('region', { name: 'Message' })
  await expect(banner).toContainText('Could not open "notes.json"')
  await expect(banner).toContainText('The file does not hold a PracDraw diagram.')
  expect(await getDoc(page)).toEqual(before)
  // The banner does not block the screen: the canvas and the top bar still work round it.
  await page.getByRole('button', { name: 'Zoom in' }).click()
  // A file with one bad item and a gas layer out of place: it opens; the banner lists the item it left out.
  const doc = json(demoDoc())
  const symbolId = (symbol: string) => doc.order.find((id) => doc.items[id].type === 'symbol' && (doc.items[id] as SymbolItem).symbol === symbol)!
  const bad = symbolId('trough')
  ;(doc.items[bad] as SymbolItem).w = -10
  const flask = symbolId('conicalFlask')
  const layers = (doc.items[flask] as SymbolItem).contents.main
  ;(doc.items[flask] as SymbolItem).contents.main = [{ kind: 'gas', amount: 0, colour: '#e3efc1' }, ...layers]
  await openThroughChooser(page, info, 'damaged.pracdraw.json', JSON.stringify(doc))
  await expect(banner).toContainText('Opened "damaged.pracdraw.json" with changes')
  await expect(banner).toContainText(`Left out item "${bad}"`)
  const opened = await getDoc(page)
  expect(opened.items[bad]).toBeUndefined()
  expect((opened.items[flask] as SymbolItem).contents.main.map((l) => l.kind)).toEqual([...layers.map((l) => l.kind), 'gas'])
  // Close it.
  await banner.getByRole('button', { name: 'Close the message' }).click()
  await expect(banner).toHaveCount(0)
})

test('drop-a-file-on-the-canvas-opens-it', async ({ page }) => {
  await open(page)
  const doc = json(demoDoc())
  const svg = await page.evaluate((d) => {
    window.__pracdraw.load(d)
    return window.__pracdraw.svg()
  }, doc)
  await page.evaluate(() =>
    window.__pracdraw.load({
      app: 'pracdraw',
      version: 1,
      title: 'Empty',
      items: {},
      order: [],
      settings: { mono: false, labelMode: 'text', labelSize: 15, smartText: true },
    }),
  )
  expect((await getDoc(page)).order).toEqual([])
  // Drop the exported SVG on the canvas, as a file from the desktop.
  const transfer = await page.evaluateHandle((text) => {
    const dt = new DataTransfer()
    dt.items.add(new File([text], 'Style reference.svg', { type: 'image/svg+xml' }))
    return dt
  }, svg)
  await page.locator('.canvas').dispatchEvent('drop', { dataTransfer: transfer })
  await expect.poll(() => getDoc(page)).toEqual(doc)
})

// ---------------------------------------------------------------- copy and the fallback dialog

test('copy-fallback-shows-picture', async ({ page }) => {
  await open(page)
  await load(page, demoDoc())
  // The clipboard refuses the write, as a browser or a sandboxed frame can.
  await page.evaluate(() => {
    navigator.clipboard.write = () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'))
  })
  await page.getByRole('button', { name: 'Copy image' }).click()
  const dialog = page.getByRole('dialog', { name: 'Copy by hand' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Right-click the picture and choose Copy image')
  await expect(page.getByRole('status')).toHaveText('Copy failed')
  // The picture is the PNG of the default export: 2×, on white, as shown.
  const img = dialog.getByRole('img', { name: 'The picture: Style reference.png' })
  const src = (await img.getAttribute('src'))!
  expect(src).toMatch(/^data:image\/png;base64,/)
  expect(src).toBe(await page.evaluate(() => window.__pracdraw.png(2)))
  const size = await img.evaluate(async (el: HTMLImageElement) => {
    await el.decode()
    return { w: el.naturalWidth, h: el.naturalHeight }
  })
  expect(size).toEqual(pngSize(Buffer.from(src.split(',')[1], 'base64')))
  expect(size.w).toBeGreaterThan(1000)
  // Escape closes it; the diagram is as it was.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})

test('text-fallback-and-download-did-not-start', async ({ page }) => {
  await page.setViewportSize(WIDE)
  await open(page)
  await load(page, demoDoc())
  // An SVG copies as text. When that fails, the fallback shows the text with Select all.
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'))
  })
  const dialog = await exportDialog(page)
  await choose(dialog, 'Format', 'SVG')
  await dialog.getByRole('button', { name: 'Copy', exact: true }).click()
  const fallback = page.getByRole('dialog', { name: 'Copy by hand' })
  const text = fallback.getByRole('textbox')
  await expect(text).toHaveValue(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
  expect(await text.inputValue()).toBe(await page.evaluate(() => window.__pracdraw.svg()))
  await fallback.getByRole('button', { name: 'Select all' }).click()
  expect(await text.evaluate((t: HTMLTextAreaElement) => [t.selectionStart, t.selectionEnd, t.value.length])).toEqual([
    0,
    (await text.inputValue()).length,
    (await text.inputValue()).length,
  ])
  await page.keyboard.press('Escape')
  await expect(fallback).toHaveCount(0)
  // After a download, "Download did not start?" opens the same file: the PNG as a picture.
  await choose(dialog, 'Format', 'PNG')
  const file = await download(page, () => dialog.getByRole('button', { name: 'Download', exact: true }).click())
  await dialog.getByRole('button', { name: 'Download did not start?' }).click()
  const again = page.getByRole('dialog', { name: 'Download did not start?' })
  await expect(again).toContainText('Right-click the picture and choose Copy image')
  const src = (await again.getByRole('img').getAttribute('src'))!
  expect(Buffer.from(src.split(',')[1], 'base64').equals(file.data)).toBe(true)
  await page.keyboard.press('Escape')
  // And after Save, the status bar offers the same for the saved file: its text.
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  const saved = await download(page, () => page.getByRole('button', { name: 'Save', exact: true }).click())
  await page.getByRole('button', { name: 'Download did not start?' }).click()
  await expect(page.getByRole('dialog', { name: 'Download did not start?' }).getByRole('textbox')).toHaveValue(saved.data.toString('utf8'))
})

// ---------------------------------------------------------------- hosts

interface Fake {
  calls: { filename: string; isBlob: boolean; text: string }[]
  answer: 'accept' | 'decline' | 'fail'
}
const fake = (page: Page) => page.evaluate(() => (window as unknown as { __fake: Fake }).__fake)

test('claude-host-saves', async ({ page }) => {
  // A fake window.claude, as in a Claude artifact: use('downloads') resolves to an object whose save records its
  // argument, then accepts, declines or fails as the test says.
  await page.addInitScript(() => {
    const state: Fake = { calls: [], answer: 'accept' }
    const downloads = {
      async save(request: { filename: string; data: Blob }) {
        state.calls.push({ filename: request.filename, isBlob: request.data instanceof Blob, text: await request.data.text() })
        if (state.answer === 'decline') throw { code: 'declined', message: 'The viewer said no.' }
        if (state.answer === 'fail') throw { code: 'unavailable', message: 'Saves are unusable here.' }
        return { status: 'saved' }
      },
    }
    const w = window as unknown as { __fake: Fake; claude: { use(name: string): Promise<unknown> } }
    w.__fake = state
    w.claude = { use: async (name: string) => (name === 'downloads' ? downloads : null) }
  })
  await page.setViewportSize(WIDE)
  let browserDownloads = 0
  page.on('download', () => browserDownloads++)
  await open(page)
  // The app starts with the web host and switches when use() resolves.
  await expect.poll(() => page.evaluate(() => window.__pracdraw.host())).toBe('claude')
  await load(page, demoDoc())
  const save = page.getByRole('button', { name: 'Save', exact: true })
  // Save calls downloads.save with the file name and the data.
  await save.click()
  await expect(page.getByRole('status')).toHaveText('Saved Style reference.pracdraw.json')
  let f = await fake(page)
  expect(f.calls).toHaveLength(1)
  expect(f.calls[0]).toMatchObject({ filename: 'Style reference.pracdraw.json', isBlob: true })
  expect(f.calls[0].text).toBe(JSON.stringify(await getDoc(page), null, 2))
  // A rejection with the code "declined" reports cancelled, with no error banner and no fallback dialog.
  await page.evaluate(() => ((window as unknown as { __fake: Fake }).__fake.answer = 'decline'))
  await save.click()
  await expect(page.getByRole('status')).toHaveText('Save cancelled')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Message' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Download did not start?' })).toHaveCount(0)
  // Any other code is failed: the fallback dialog gives the file as text.
  await page.evaluate(() => ((window as unknown as { __fake: Fake }).__fake.answer = 'fail'))
  await save.click()
  await expect(page.getByRole('status')).toHaveText('Save failed')
  await expect(page.getByRole('dialog', { name: 'Download did not start?' }).getByRole('textbox')).toHaveValue(f.calls[0].text)
  await page.keyboard.press('Escape')
  // The export dialog's Download goes through the same host.
  await page.evaluate(() => ((window as unknown as { __fake: Fake }).__fake.answer = 'accept'))
  const dialog = await exportDialog(page)
  await choose(dialog, 'Format', 'SVG')
  await dialog.getByRole('button', { name: 'Download', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Download did not start?' })).toBeVisible()
  f = await fake(page)
  expect(f.calls.map((c) => c.filename)).toEqual([
    'Style reference.pracdraw.json',
    'Style reference.pracdraw.json',
    'Style reference.pracdraw.json',
    'Style reference.svg',
  ])
  expect(f.calls[3].text.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  // The browser itself downloaded nothing.
  expect(browserDownloads).toBe(0)
})

// ---------------------------------------------------------------- the template gallery

/** How many path nodes a render tree has: a thumbnail draws each as one path element. */
const pathCount = (nodes: Node[]): number => nodes.reduce((n, node) => n + (node.t === 'path' ? 1 : node.t === 'g' ? pathCount(node.kids) : 0), 0)

test('gallery-inserts-template', async ({ page }) => {
  await open(page)
  await page.getByRole('tab', { name: 'Templates' }).click()
  const library = page.getByRole('complementary', { name: 'Library' })
  // Every template of the plan (the 40 priority A and the 3 priority B) has a card with a thumbnail, its title and its
  // references.
  const plan = (JSON.parse(readFileSync('spec/templates.json', 'utf8')) as { templates: { id: string; priority: string }[] }).templates
  const built = plan.flatMap((p) => TEMPLATES.filter((t) => t.id === p.id))
  expect(built.length).toBe(43)
  for (const t of built) {
    const card = library.getByRole('button', { name: `Insert template: ${t.title}`, exact: true })
    await expect(card).toHaveCount(1)
    await expect(card).toContainText(t.title)
    await expect(card).toContainText(t.refs)
    // The thumbnail draws the template: one path element for each path of its render tree.
    await expect(card.locator('svg.thumb path')).toHaveCount(pathCount(docNodes(t.build())))
  }
  // Filter chips: All, General, Chemistry, Biology, Physics.
  const cards = library.getByRole('button', { name: /^Insert template: / })
  await expect(cards).toHaveCount(TEMPLATES.length)
  for (const group of ['General', 'Chemistry', 'Biology', 'Physics'] as const) {
    await library.getByRole('radio', { name: group, exact: true }).click()
    await expect(cards).toHaveCount(TEMPLATES.filter((t) => t.group === group).length)
  }
  await library.getByRole('radio', { name: 'All', exact: true }).click()
  await expect(cards).toHaveCount(TEMPLATES.length)
  // A click on a card with the diagram empty: the template becomes the diagram, with its ids and its title, and its
  // items are on the canvas.
  const titration = TEMPLATES.find((t) => t.id === 'titration')!
  await library.getByRole('button', { name: `Insert template: ${titration.title}`, exact: true }).click()
  const first = await getDoc(page)
  expect(first).toEqual(json(titration.build()))
  for (const id of first.order) await expect(page.locator(`#stage [data-id="${id}"]`)).toHaveCount(1)
  // A click on another card: its items are added at the centre of the view with new ids, and they become the
  // selection. The title stays.
  const heating = TEMPLATES.find((t) => t.id === 'heatingBeaker')!
  await library.getByRole('button', { name: `Insert template: ${heating.title}`, exact: true }).click()
  const doc = await getDoc(page)
  expect(doc.title).toBe(titration.title)
  const fresh = doc.order.slice(first.order.length)
  expect(fresh).toHaveLength(heating.build().order.length)
  for (const id of fresh) {
    expect(id).toMatch(/^[0-9a-z]{8}$/)
    expect(first.items[id]).toBeUndefined()
    await expect(page.locator(`#stage [data-id="${id}"]`)).toHaveCount(1)
  }
  await expect(page.locator('.statusbar .selected')).toHaveText(`${fresh.length} items`)
  const view = await page.evaluate(() => window.__pracdraw.view())
  const stage = (await page.locator('#stage').boundingBox())!
  const centre = P((stage.width / 2 - view.x) / view.zoom, (stage.height / 2 - view.y) / view.zoom)
  const box = itemsBox(doc, fresh)!
  // (The app measures label text with the canvas; this box uses the estimate, so the centres agree to a few units.)
  expect(Math.abs((box.x0 + box.x1) / 2 - centre.x)).toBeLessThan(25)
  expect(Math.abs((box.y0 + box.y1) / 2 - centre.y)).toBeLessThan(25)
})
