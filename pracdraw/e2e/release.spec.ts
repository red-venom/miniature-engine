// release.spec.ts — phase 10, release 1.0: the five jobs of section 2, the budgets of section 6, and the first run,
// help, the library's tiles (their names, a drag to the canvas), touch and access of section 12. The gate tests of
// section 15 have its exact titles: job-1 to job-5, drag-budget, keyboard-only and controls-have-names. The window is
// the Playwright default of the config, 1100 × 900, narrower than the whole top bar (FULL_BAR, 1540 px): New, Open,
// Save, Label all and Help are in the More menu.

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { FILE } from './hook.ts'
import { demoDoc } from '../src/demo.ts'
import { docFromSvg } from '../src/export/svg.ts'
import type { Layer } from '../src/kernel/contents.ts'
import { P, type Pt } from '../src/kernel/geom.ts'
import { parseMarkup, smartChem } from '../src/kernel/text.ts'
import { docBox, itemBox } from '../src/model/bounds.ts'
import { DocBuilder, anchorOf, anchorWorld } from '../src/model/build.ts'
import { CONNECTOR_PRESETS } from '../src/model/connectors.ts'
import { snap } from '../src/model/snap.ts'
import type { ConnectorItem, Doc, LabelItem, ShapeItem, SymbolItem } from '../src/model/types.ts'
import { SYMBOLS, geometry, symbolDef } from '../src/symbols/registry.ts'
import { amountToReading } from '../src/symbols/scale.ts'
import { TEMPLATES } from '../src/templates/index.ts'

// ---------------------------------------------------------------- helpers

/** A document as a file holds it: JSON, so undefined fields are gone. */
const json = <T>(d: T): T => JSON.parse(JSON.stringify(d))

async function open(page: Page) {
  await page.goto(FILE)
  await page.waitForFunction(() => !!window.__pracdraw)
}
const getDoc = (page: Page) => page.evaluate(() => window.__pracdraw.doc())
const load = (page: Page, doc: Doc) => page.evaluate((d) => window.__pracdraw.load(d), doc)
const zoomOf = async (page: Page) => (await page.evaluate(() => window.__pracdraw.view())).zoom
const template = (id: string) => TEMPLATES.find((t) => t.id === id)!
const labelsOf = (doc: Doc) => doc.order.map((id) => doc.items[id]).filter((it): it is LabelItem => it.type === 'label')

/** The card on the canvas of an empty diagram (section 12, "First run"). */
const emptyCard = (page: Page) => page.getByRole('region', { name: 'Pick a template or add apparatus' })
const labelMode = (page: Page, mode: 'Text' | 'Blank' | 'Letters') => page.getByRole('radiogroup', { name: 'Label mode' }).getByRole('radio', { name: mode })

/**
 * What a test must not see the page do: open an alert, a confirm or a prompt (section 13), or make a network request
 * at run time (D2 and the budgets of section 6: the single file loads from file://, and data: and blob: URLs are its
 * own). `quiet` checks that nothing was seen.
 */
function watch(page: Page) {
  const seen = { dialogs: [] as string[], requests: [] as string[] }
  page.on('dialog', (d) => {
    seen.dialogs.push(`${d.type()}: ${d.message()}`)
    void d.dismiss()
  })
  page.on('request', (r) => {
    if (!/^(file|data|blob):/.test(r.url())) seen.requests.push(r.url())
  })
  return seen
}
const quiet = (seen: ReturnType<typeof watch>) => expect(seen).toEqual({ dialogs: [], requests: [] })

/** A control of the More menu, which holds the secondary controls of the top bar at this window width. */
async function more(page: Page, name: string) {
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await page.getByRole('group', { name: 'More' }).getByRole('button', { name, exact: true }).click()
}

/** Do something that downloads a file, and take the file: its name and bytes. */
async function download(page: Page, act: () => Promise<unknown>): Promise<{ name: string; data: Buffer }> {
  const [d] = await Promise.all([page.waitForEvent('download'), act()])
  return { name: d.suggestedFilename(), data: readFileSync((await d.path())!) }
}

/** Open a file through the file chooser of Open (in the More menu). */
async function openThroughChooser(page: Page, info: TestInfo, name: string, data: Buffer | string) {
  const path = info.outputPath(name)
  writeFileSync(path, data)
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), more(page, 'Open')])
  await chooser.setFiles(path)
}

async function exportDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Export' })
  await expect(dialog).toBeVisible()
  return dialog
}
const choose = (dialog: Locator, row: string, option: string) =>
  dialog.getByRole('radiogroup', { name: row }).getByRole('radio', { name: option, exact: true }).click()

/** The SVG that the export dialog downloads, with its options as they are but the format SVG. */
async function exportSvgFile(page: Page): Promise<{ name: string; data: Buffer }> {
  const dialog = await exportDialog(page)
  await choose(dialog, 'Format', 'SVG')
  const file = await download(page, () => dialog.getByRole('button', { name: 'Download', exact: true }).click())
  await dialog.getByRole('button', { name: 'Close export' }).click()
  await expect(dialog).toHaveCount(0)
  return file
}

/** An SVG without its metadata (the document, which Open reads back): only what is drawn. */
const drawing = (svg: string) => svg.replace(/<metadata>[\s\S]*?<\/metadata>/, '')
/** The text of each text element that an SVG draws, its runs joined. */
const textsOf = (svg: string) =>
  [...drawing(svg).matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((m) =>
    m[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&'),
  )
/** The lines of a label as text mode draws them: smart text applied and the markup gone. */
const shownLines = (l: LabelItem) =>
  l.text.split('\n').map((line) =>
    parseMarkup(smartChem(line))
      .map((r) => r.text)
      .join(''),
  )

/**
 * A page point on an item where a press hits that item first: no other item, and no handle, is on top of it there.
 * The points of a grid over the item are tried from its middle outwards.
 */
async function grabPoint(page: Page, id: string): Promise<Pt> {
  const p = await page.evaluate((id) => {
    const el = document.querySelector(`#stage [data-id="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const grid: { x: number; y: number; d: number }[] = []
    for (let i = 0; i <= 24; i++)
      for (let j = 0; j <= 24; j++) grid.push({ x: r.x + (r.width * i) / 24, y: r.y + (r.height * j) / 24, d: Math.hypot(i - 12, j - 12) })
    grid.sort((a, b) => a.d - b.d)
    for (const q of grid) if (document.elementFromPoint(q.x, q.y)?.closest('[data-id]')?.getAttribute('data-id') === id) return { x: q.x, y: q.y }
    return null
  }, id)
  if (!p) throw new Error(`no point of item ${id} to press`)
  return p
}

async function centreOf(l: Locator): Promise<Pt> {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/** The world point under a page point. */
async function worldAt(page: Page, p: Pt): Promise<Pt> {
  const v = await page.evaluate(() => window.__pracdraw.view())
  const r = (await page.locator('#stage').boundingBox())!
  return P((p.x - r.x - v.x) / v.zoom, (p.y - r.y - v.y) / v.zoom)
}

/**
 * Fingers on a touch screen, through the DevTools protocol: `touch` sends one touch event with the fingers at these
 * page points; `drag` puts one finger down at `from`, moves it through `via` and on to `to` in `steps` moves, and lifts
 * it unless `hold`.
 */
async function fingers(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Pt[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) })
  const drag = async (from: Pt, to: Pt, { via = [] as Pt[], steps = 8, hold = false } = {}) => {
    await touch('touchStart', [from])
    let at = from
    for (const next of [...via, to]) {
      for (let i = 1; i <= steps; i++) await touch('touchMove', [P(at.x + ((next.x - at.x) * i) / steps, at.y + ((next.y - at.y) * i) / steps)])
      at = next
    }
    if (!hold) await touch('touchEnd', [])
  }
  return { touch, drag }
}

/**
 * Drag item `id` with the mouse so that its world point `from` (an anchor) goes `off` screen px from the world point
 * `to`, in ten pointer moves. Before the release, the snap must show: the ring where two anchors met, or for a part
 * with no anchor to snap with, a guide line where its bounds line up with another part's.
 */
async function dragUntilItSnaps(page: Page, id: string, from: Pt, to: Pt, off: Pt, shows: 'ring' | 'guide' = 'ring') {
  const zoom = await zoomOf(page)
  const g = await grabPoint(page, id)
  const dx = (to.x - from.x) * zoom + off.x,
    dy = (to.y - from.y) * zoom + off.y
  await page.mouse.move(g.x, g.y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(g.x + (dx * i) / 10, g.y + (dy * i) / 10)
  if (shows === 'ring') await expect(page.locator('.overlay circle.guide')).toHaveCount(1)
  else await expect(page.locator('.overlay .guide-line')).not.toHaveCount(0)
  await page.mouse.up()
}

function expectNear(a: Pt, b: Pt, digits = 9) {
  expect(a.x).toBeCloseTo(b.x, digits)
  expect(a.y).toBeCloseTo(b.y, digits)
}

/** Press Tab (or `key`) until `target` has the focus: it is reachable from the keyboard. Returns the presses. */
async function tabTo(page: Page, target: Locator, key = 'Tab', max = 250): Promise<number> {
  for (let n = 1; n <= max; n++) {
    await page.keyboard.press(key)
    if (await target.evaluate((el) => el === document.activeElement)) return n
  }
  throw new Error(`${key} did not reach the control in ${max} presses`)
}

/** The types of what the clipboard holds. */
const clipboardTypes = (page: Page) => page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => [...i.types]))

/** Record a budget in the report of the test and on the console. */
function budget(info: TestInfo, text: string) {
  info.annotations.push({ type: 'budget', description: text })
  console.log(`budget: ${text}`)
}

// ---------------------------------------------------------------- the five jobs of section 2

test('job-1', async ({ page, context }) => {
  // Standard set-up: insert a template and copy the picture (target: 3 clicks, under 15 s). From the empty state it
  // takes 2 clicks: the titration card, then Copy image.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const seen = watch(page)
  await open(page)
  await page.bringToFront()
  expect((await getDoc(page)).order).toEqual([])
  const card = emptyCard(page)
  await expect(card).toBeVisible()
  const titration = template('titration')
  const t0 = Date.now()
  await card.getByRole('button', { name: titration.title, exact: true }).click()
  await page.getByRole('button', { name: 'Copy image' }).click()
  await expect(page.getByRole('status')).toHaveText('Copied')
  const seconds = (Date.now() - t0) / 1000
  // The template became the diagram, with its ids and its title, and the card went.
  expect(await getDoc(page)).toEqual(json(titration.build()))
  await expect(page.getByRole('button', { name: 'Rename: Titration' })).toBeVisible()
  await expect(card).toHaveCount(0)
  // The clipboard holds a PNG: the default export of the titration, at 2× on white.
  const png = await page.evaluate(async () => {
    const item = (await navigator.clipboard.read()).find((i) => i.types.includes('image/png'))
    if (!item) return null
    const blob = await item.getType('image/png')
    const bitmap = await createImageBitmap(blob)
    return { signature: [...new Uint8Array(await blob.arrayBuffer()).slice(0, 8)], w: bitmap.width, h: bitmap.height }
  })
  expect(png).not.toBeNull()
  expect(png!.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const expected = await page.evaluate(async () => {
    const img = new Image()
    img.src = window.__pracdraw.png(2)
    await img.decode()
    return { w: img.width, h: img.height }
  })
  expect({ w: png!.w, h: png!.h }).toEqual(expected)
  expect(expected.w).toBeGreaterThan(400)
  expect(seconds).toBeLessThan(15)
  quiet(seen)
})

test('job-2', async ({ page }) => {
  // Own set-up: 6 parts with labels (target: under 3 minutes). Each part is added by `/`, its name and Enter, then
  // dragged with the mouse until it snaps, the heatproof mat being the base the others stand on; then Label all.
  const t0 = Date.now()
  const seen = watch(page)
  await open(page)
  const PARTS = [
    ['heatproof mat', 'heatproofMat'],
    ['tripod', 'tripod'],
    ['gauze', 'gauze'],
    ['beaker', 'beaker'],
    ['bunsen burner', 'bunsenBurner'],
    ['thermometer', 'thermometer'],
  ] as const
  const id: Record<string, string> = {}
  for (const [query, symbol] of PARTS) {
    await page.keyboard.press('/')
    await expect(page.getByRole('searchbox', { name: 'Search apparatus' })).toBeFocused()
    await page.keyboard.type(query)
    await page.keyboard.press('Enter')
    const doc = await getDoc(page)
    const it = doc.items[doc.order[doc.order.length - 1]] as SymbolItem
    expect(it.symbol).toBe(symbol)
    id[symbol] = it.id
  }
  expect((await getDoc(page)).order).toHaveLength(6)
  const item = async (symbol: string) => (await getDoc(page)).items[id[symbol]] as SymbolItem
  // The mat, the base of the set-up, has no anchor to snap with. It is dragged out of the pile, 180 u to the left, and
  // down until its bottom edge is 3 px above the bottom of the thermometer: it snaps onto that line (a guide shows).
  // Then each other part is dragged until its anchor is a few px from where it fits, and snaps there.
  const before = await getDoc(page)
  const mat0 = before.items[id.heatproofMat] as SymbolItem
  const bottom = itemBox(before, before.items[id.thermometer]).y1
  const below = itemBox(before, mat0).y1 - mat0.y // from the mat's centre to its bottom edge
  await dragUntilItSnaps(page, id.heatproofMat, P(mat0.x, mat0.y), P(mat0.x - 180, bottom - below), P(0, -3), 'guide')
  const mat = await item('heatproofMat')
  expect(itemBox(await getDoc(page), mat).y1).toBeCloseTo(bottom, 6)
  expect(mat.x).toBe(mat0.x - 180)
  // The tripod's feet onto the mat; the burner onto the mat, under the tripod.
  await dragUntilItSnaps(page, id.tripod, anchorWorld(await item('tripod'), 'feet'), anchorWorld(mat, 'top'), P(2, -3))
  expectNear(anchorWorld(await item('tripod'), 'feet'), anchorWorld(mat, 'top'))
  await dragUntilItSnaps(page, id.bunsenBurner, anchorWorld(await item('bunsenBurner'), 'base'), anchorWorld(mat, 'top'), P(-3, -2))
  expectNear(anchorWorld(await item('bunsenBurner'), 'base'), anchorWorld(mat, 'top'))
  // The gauze onto the tripod; the beaker onto the gauze.
  const tripod = await item('tripod')
  await dragUntilItSnaps(page, id.gauze, anchorWorld(await item('gauze'), 'under'), anchorWorld(tripod, 'top'), P(3, -2))
  expectNear(anchorWorld(await item('gauze'), 'under'), anchorWorld(tripod, 'top'))
  const gauze = await item('gauze')
  await dragUntilItSnaps(page, id.beaker, anchorWorld(await item('beaker'), 'base'), anchorWorld(gauze, 'top'), P(-2, -3))
  // The thermometer into the beaker: its bulb onto the centre line of the beaker's mouth, 30 u down inside it.
  const mouth = anchorWorld(await item('beaker'), 'mouth')
  await dragUntilItSnaps(page, id.thermometer, anchorWorld(await item('thermometer'), 'bulb'), P(mouth.x, mouth.y + 30), P(3, 0))
  const bulb = anchorWorld(await item('thermometer'), 'bulb')
  expect(bulb.x).toBeCloseTo(mouth.x, 9)
  expect(bulb.y).toBeCloseTo(mouth.y + 30, 0)
  // Label all, in the More menu at this window width: one undo step.
  await more(page, 'Label all')
  const doc = await getDoc(page)
  // The beaker base is on the gauze: on its surface, inside its width.
  const beaker = doc.items[id.beaker] as SymbolItem,
    onGauze = doc.items[id.gauze] as SymbolItem
  const base = anchorWorld(beaker, 'base'),
    top = anchorWorld(onGauze, 'top')
  expect(base.y).toBeCloseTo(top.y, 9)
  expect(Math.abs(base.x - top.x)).toBeLessThanOrEqual(anchorOf(onGauze, 'top').width! / 2)
  // The diagram has 6 labels, each fixed to one of the six parts.
  const labels = labelsOf(doc)
  expect(labels).toHaveLength(6)
  const owners = labels.map((l) => (l.target && 'item' in l.target ? l.target.item : null))
  expect(new Set(owners)).toEqual(new Set(Object.values(id)))
  expect((Date.now() - t0) / 1000).toBeLessThan(180)
  quiet(seen)
})

test('job-3', async ({ page }) => {
  // Worksheet version: the same diagram with blank label lines (target: 1 click).
  const seen = watch(page)
  await open(page)
  const titration = template('titration')
  await emptyCard(page).getByRole('button', { name: titration.title, exact: true }).click()
  const doc = await getDoc(page)
  expect(doc).toEqual(json(titration.build()))
  expect(doc.settings.labelMode).toBe('text')
  const labels = labelsOf(doc)
  expect(labels.length).toBeGreaterThan(5)
  for (const l of labels) expect(l.target).toBeTruthy()
  // In text mode the SVG export draws the text of every label.
  const before = await page.evaluate(() => window.__pracdraw.svg())
  for (const l of labels) for (const line of shownLines(l)) expect(textsOf(before)).toContain(line)
  // One click on the label-mode switch gives blank mode.
  await labelMode(page, 'Blank').click()
  expect((await getDoc(page)).settings.labelMode).toBe('blank')
  // The SVG export (the export dialog's file) then holds no label text: none as drawn, none as typed. Each label is
  // its leader and a 100 u line to write on. (The metadata is the document, which Open reads back; it is not drawn.)
  const file = await exportSvgFile(page)
  expect(file.name).toBe('Titration-blank.svg')
  const svg = file.data.toString('utf8')
  const texts = textsOf(svg)
  for (const l of labels) {
    for (const line of shownLines(l)) expect(texts).not.toContain(line)
    for (const line of l.text.split('\n')) expect(drawing(svg)).not.toContain(`>${line}<`)
  }
  const rules = [...drawing(svg).matchAll(/d="M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)"/g)].filter(
    (m) => m[2] === m[4] && Math.abs(Math.abs(Number(m[3]) - Number(m[1])) - 100) < 1e-6,
  )
  expect(rules).toHaveLength(labels.length)
  const r = docFromSvg(svg)
  expect(r.ok && r.doc.settings.labelMode).toBe('blank')
  quiet(seen)
})

test('job-4', async ({ page }) => {
  // Scale-reading question: an exact reading on a burette (target: type one number).
  const seen = watch(page)
  await open(page)
  await page.getByRole('complementary', { name: 'Library' }).getByRole('button', { name: 'Burette', exact: true }).click()
  const added = await getDoc(page)
  const burette = added.items[added.order[0]] as SymbolItem
  expect(burette.symbol).toBe('burette')
  expect(burette.contents).toEqual({})
  const field = page.getByRole('complementary', { name: 'Inspector' }).getByLabel('Reading', { exact: true })
  await field.fill('23.45')
  await field.press('Enter')
  const it = (await getDoc(page)).items[burette.id] as SymbolItem
  const g = geometry(it.symbol, it.w, it.h, it.params)
  const layers: Layer[] = it.contents[g.scale!.cavity]
  expect(layers).toHaveLength(1)
  const amount = layers.filter((l) => l.kind !== 'gas').reduce((sum, l) => sum + l.amount, 0)
  const reading = amountToReading(g, amount)!
  expect(Math.abs(reading - 23.45)).toBeLessThanOrEqual(0.05)
  await expect(field).toHaveValue('23.45')
  quiet(seen)
})

test('job-5', async ({ page }, info) => {
  // Reuse: open a saved diagram, or an exported SVG, and edit it. Save, New and Open are in the More menu here.
  const seen = watch(page)
  await open(page)
  await emptyCard(page)
    .getByRole('button', { name: template('rateGasOverWater').title, exact: true })
    .click()
  await labelMode(page, 'Letters').click() // a change, so that the diagram is not the template as built
  const saved = await getDoc(page)
  // Save, then New.
  const file = await download(page, () => more(page, 'Save'))
  expect(file.name).toBe('Rate of reaction- gas collected over water.pracdraw.json')
  expect(JSON.parse(file.data.toString('utf8'))).toEqual(saved)
  await more(page, 'New')
  expect((await getDoc(page)).order).toEqual([])
  await expect(emptyCard(page)).toBeVisible()
  // Open the saved file through the file chooser: the document equals the saved one.
  await openThroughChooser(page, info, file.name, file.data)
  await expect.poll(() => getDoc(page)).toEqual(saved)
  await expect(page.getByRole('region', { name: 'Message' })).toHaveCount(0)
  // The same with an exported SVG.
  const svg = await exportSvgFile(page)
  expect(svg.name).toBe('Rate of reaction- gas collected over water-letters.svg')
  await more(page, 'New')
  expect((await getDoc(page)).order).toEqual([])
  await openThroughChooser(page, info, svg.name, svg.data)
  await expect.poll(() => getDoc(page)).toEqual(saved)
  await expect(page.getByRole('region', { name: 'Message' })).toHaveCount(0)
  // It can be edited: Ctrl+A and an arrow key move everything, as one undo step.
  await page.keyboard.press('Control+a')
  await page.keyboard.press('ArrowRight')
  const moved = await getDoc(page)
  const first = saved.order.map((id) => saved.items[id]).find((it): it is SymbolItem => it.type === 'symbol')!
  expect((moved.items[first.id] as SymbolItem).x).toBe(first.x + 1)
  await page.keyboard.press('Control+z')
  expect(await getDoc(page)).toEqual(saved)
  quiet(seen)
})

// ---------------------------------------------------------------- the budgets of section 6

test('drag-budget', async ({ page }, info) => {
  // 150 symbols with contents. One is dragged 300 px in 60 pointer moves; the mean time between animation frames must
  // be under 20 ms in the Playwright Chromium. The moves go out as a hand sends them: at a steady 60 Hz, each at its
  // own time on a fixed schedule, not waiting for the page to handle the one before (page.mouse.move waits, so a slow
  // page would only get idle frames between its moves). Each frame is timed with performance.now() in its
  // requestAnimationFrame callback, when it really ran (the callback's own argument is the time the frame began,
  // which a slow page does not delay). A page that takes too long over a move misses frames, and the mean gap grows.
  await open(page)
  const KINDS = [
    'beaker',
    'conicalFlask',
    'roundBottomFlask',
    'testTube',
    'boilingTube',
    'measuringCylinder',
    'volumetricFlask',
    'buchnerFlask',
    'polystyreneCup',
    'washBottle',
  ]
  const b = new DocBuilder('Drag budget')
  for (let i = 0; i < 150; i++) {
    const symbol = KINDS[i % KINDS.length]
    const { w, h } = symbolDef(symbol).size
    const cavity = geometry(symbol, w, h).cavities![0].id
    const contents: Record<string, Layer[]> = {
      [cavity]: [
        { kind: 'powder', amount: 0.15, colour: '#f1f1f1' },
        { kind: 'liquid', amount: 0.45, colour: '#7fb8e6', bubbles: 'few', meniscus: true },
      ],
    }
    b.symbol(symbol, { x: (i % 15) * 130, y: Math.floor(i / 15) * 230, contents })
  }
  await load(page, b.doc)
  // The whole diagram on the canvas, at the zoom where 300 px is 1300 u: ten columns of parts. The part dragged ends
  // where no snap pulls it (the snap itself is checked below), so it must move the full 300 px; on its way most moves
  // do snap to the parts it passes, as in use.
  const stage = (await page.locator('#stage').boundingBox())!
  const box = docBox(json(b.doc))!
  const zoom = 300 / 1300
  await page.evaluate((v) => window.__pracdraw.view(v), {
    zoom,
    x: stage.width / 2 - ((box.x0 + box.x1) / 2) * zoom,
    y: stage.height / 2 - ((box.y0 + box.y1) / 2) * zoom,
  })
  expect(await zoomOf(page)).toBe(zoom)
  await expect(page.locator('#stage [data-id]')).toHaveCount(150)
  expect(await page.locator('#stage path[fill="#7fb8e6"]').count()).toBeGreaterThanOrEqual(150)
  for (const it of await page.locator('#stage > g > [data-id]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(it.left).toBeGreaterThanOrEqual(stage.x)
    expect(it.right).toBeLessThanOrEqual(stage.x + stage.width)
  }
  const id = b.doc.order[67]
  const before = b.doc.items[id] as SymbolItem
  const g = await grabPoint(page, id)
  // The press, then the frame timer and a record of each pointer move as the page gets it.
  const cdp = await page.context().newCDPSession(page)
  const mouse = (type: 'mouseMoved' | 'mousePressed' | 'mouseReleased', x: number, buttons: number) =>
    cdp.send('Input.dispatchMouseEvent', { type, x, y: g.y, button: 'left', buttons, clickCount: 1 })
  await mouse('mouseMoved', g.x, 0)
  await mouse('mousePressed', g.x, 1)
  await page.evaluate(() => {
    const w = window as unknown as { __drag: { frames: number[]; moves: { t: number; x: number }[]; timing: boolean } }
    w.__drag = { frames: [], moves: [], timing: true }
    const frame = () => {
      w.__drag.frames.push(performance.now())
      if (w.__drag.timing) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
    addEventListener('pointermove', (e) => w.__drag.moves.push({ t: performance.now(), x: e.clientX }), true)
  })
  // The 60 moves of 5 px, on a schedule of absolute times 1/60 s apart. No send waits for the one before.
  const sent: Promise<unknown>[] = []
  const start = performance.now() + 20
  for (let i = 1; i <= 60; i++) {
    const wait = start + ((i - 1) * 1000) / 60 - performance.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    sent.push(mouse('mouseMoved', g.x + 5 * i, 1))
  }
  const late = performance.now() - (start + (59 * 1000) / 60) // how late the last move went out, ms
  await Promise.all(sent)
  await mouse('mouseReleased', g.x + 300, 0)
  // One frame after the release, the timer stops.
  const { frames, moves } = await page.evaluate(
    () =>
      new Promise<{ frames: number[]; moves: { t: number; x: number }[] }>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const w = window as unknown as { __drag: { frames: number[]; moves: { t: number; x: number }[]; timing: boolean } }
            w.__drag.timing = false
            resolve(w.__drag)
          }),
        ),
      ),
  )
  // The moves reached the page, the last one at the end of the 300 px.
  expect(moves.length).toBeGreaterThan(0)
  expect(moves[moves.length - 1].x).toBeCloseTo(g.x + 300, 1)
  // The frames from the last one before the first move to the first one after the last move.
  const first = moves[0].t,
    last = moves[moves.length - 1].t
  const from = frames.findLastIndex((t) => t <= first)
  const to = frames.findIndex((t) => t > last)
  expect(from).toBeGreaterThanOrEqual(0)
  expect(to).toBeGreaterThan(from)
  const timed = frames.slice(from, to + 1)
  const gaps = timed.slice(1).map((t, i) => t - timed[i])
  const mean = (timed[timed.length - 1] - timed[0]) / gaps.length
  budget(
    info,
    `drag: mean frame gap ${mean.toFixed(2)} ms over ${gaps.length} frames, longest ${Math.max(...gaps).toFixed(1)} ms, ` +
      `${moves.length} pointer moves handled over ${(last - first).toFixed(0)} ms (150 symbols with contents, 60 moves sent at 60 Hz, ` +
      `the last ${late.toFixed(1)} ms late)`,
  )
  // The part moved the full 300 px: 1300 u, which the snap leaves as it is. So the moves were handled, the last too.
  const dx = Math.round(300 / zoom)
  expect(snap(json(b.doc), [id], dx, 0, zoom)).toMatchObject({ dx, dy: 0 })
  const after = (await getDoc(page)).items[id] as SymbolItem
  expect(after.x - before.x).toBe(dx)
  expect(after.y).toBe(before.y)
  // The moves came in steadily over the second they took to send, not in a heap at the end.
  expect(last - first).toBeGreaterThan(900)
  expect(mean).toBeLessThan(20)
})

test('open-to-first-paint', async ({ browser }, info) => {
  // Open the single file from file:// in a fresh page, three times. Its first paint, and its first contentful paint
  // (the editor itself: the body holds nothing else to paint), must each come under 1 s after the navigation starts.
  const runs: { fp: number; fcp: number }[] = []
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 })
    const page = await context.newPage()
    await page.goto(FILE)
    const paint = await page.evaluate(
      () =>
        new Promise<Record<string, number>>((resolve) => {
          const seen: Record<string, number> = {}
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) seen[e.name] = e.startTime
            if ('first-paint' in seen && 'first-contentful-paint' in seen) resolve(seen)
          }).observe({ type: 'paint', buffered: true })
          setTimeout(() => resolve(seen), 5000)
        }),
    )
    await expect(page.getByRole('button', { name: 'Copy image' })).toBeVisible()
    runs.push({ fp: paint['first-paint'], fcp: paint['first-contentful-paint'] })
    await context.close()
  }
  budget(info, `open to first paint from file://: ${runs.map((r) => `${Math.round(r.fp)} ms (first contentful ${Math.round(r.fcp)} ms)`).join(', ')}`)
  for (const r of runs) {
    expect(r.fp).toBeLessThan(1000)
    expect(r.fcp).toBeLessThan(1000)
  }
})

// ---------------------------------------------------------------- access (section 12)

test('keyboard-only', async ({ page, context }) => {
  // With no pointer: `/`, "beaker" and Enter add a beaker; the arrow keys move it; Delete deletes it; the label-mode
  // switch and Copy image work from the keyboard, and so do the controls of the More menu.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const seen = watch(page)
  await page.addInitScript(() => {
    const w = window as unknown as { __pointer: string[] }
    w.__pointer = []
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'wheel'])
      window.addEventListener(type, () => w.__pointer.push(type), true)
  })
  await open(page)
  await page.bringToFront()
  const canvas = page.getByRole('application', { name: 'Canvas' })

  // Add: `/` focuses the search box; Enter adds the first result at the centre of the view, selected, and the canvas
  // takes the focus.
  await page.keyboard.press('/')
  await expect(page.getByRole('searchbox', { name: 'Search apparatus' })).toBeFocused()
  await page.keyboard.type('beaker')
  await page.keyboard.press('Enter')
  let doc = await getDoc(page)
  expect(doc.order).toHaveLength(1)
  const beaker = doc.items[doc.order[0]] as SymbolItem
  expect(beaker.symbol).toBe('beaker')
  await expect(page.locator('.statusbar .selected')).toHaveText('Beaker')
  await expect(canvas).toBeFocused()

  // Move: the arrow keys move the selection 1 u, and 10 u with Shift.
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'Shift+ArrowLeft']) await page.keyboard.press(key)
  doc = await getDoc(page)
  expect(doc.items[beaker.id]).toMatchObject({ x: beaker.x - 7, y: beaker.y + 2 })

  // Delete deletes it; Ctrl+Z brings it back, and Ctrl+A selects it again.
  await page.keyboard.press('Delete')
  expect((await getDoc(page)).order).toEqual([])
  await page.keyboard.press('Control+z')
  expect((await getDoc(page)).order).toEqual([beaker.id])
  await page.keyboard.press('Control+a')
  await expect(page.locator('.statusbar .selected')).toHaveText('Beaker')

  // The label-mode switch: Tab reaches it (the mode that is on), and the arrow keys change the mode. They do not move
  // the selection while the switch has the focus.
  const at = (await getDoc(page)).items[beaker.id] as SymbolItem
  await tabTo(page, labelMode(page, 'Text'))
  await page.keyboard.press('ArrowRight')
  expect((await getDoc(page)).settings.labelMode).toBe('blank')
  await expect(labelMode(page, 'Blank')).toBeFocused()
  await expect(labelMode(page, 'Blank')).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('ArrowRight')
  expect((await getDoc(page)).settings.labelMode).toBe('letters')
  await page.keyboard.press('ArrowLeft')
  expect((await getDoc(page)).settings.labelMode).toBe('blank')
  expect((await getDoc(page)).items[beaker.id]).toEqual(at)

  // Copy image: a button that Tab reaches; Enter copies a PNG.
  await tabTo(page, page.getByRole('button', { name: 'Copy image' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toHaveText('Copied')
  expect(await clipboardTypes(page)).toContain('image/png')

  // The More menu: Tab reaches it, Enter opens it, and Tab goes through each of its controls in order. Tab past the
  // last one shuts it; Shift+Tab comes back to More.
  const moreButton = page.getByRole('button', { name: 'More', exact: true })
  await tabTo(page, moreButton)
  await page.keyboard.press('Enter')
  await expect(moreButton).toHaveAttribute('aria-expanded', 'true')
  const menu = page.getByRole('group', { name: 'More' })
  const items = menu.getByRole('button')
  const names = await items.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent))
  expect(names).toEqual(['Zoom out', 'Zoom to 100%', 'Zoom in', 'Fit', 'Snap', 'Photocopy-safe', 'Label all', 'New', 'Open', 'Save', 'Help'])
  for (let i = 0; i < names.length; i++) {
    await page.keyboard.press('Tab')
    await expect(items.nth(i)).toBeFocused()
  }
  await page.keyboard.press('Tab')
  await expect(menu).toHaveCount(0)
  await page.keyboard.press('Shift+Tab')
  await expect(moreButton).toBeFocused()
  // Space opens it; Photocopy-safe with Space: it turns on, the menu shuts and the focus is back on More.
  await page.keyboard.press('Space')
  for (let i = 0; i < names.indexOf('Photocopy-safe') + 1; i++) await page.keyboard.press('Tab')
  await expect(menu.getByRole('button', { name: 'Photocopy-safe' })).toBeFocused()
  await page.keyboard.press('Space')
  expect((await getDoc(page)).settings.mono).toBe(true)
  await expect(menu).toHaveCount(0)
  await expect(moreButton).toBeFocused()
  // Label all with Enter: the beaker gets its label.
  await page.keyboard.press('Enter')
  for (let i = 0; i < names.indexOf('Label all') + 1; i++) await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  doc = await getDoc(page)
  expect(labelsOf(doc).map((l) => [l.text, l.target && 'item' in l.target && l.target.item])).toEqual([['beaker', beaker.id]])
  await expect(moreButton).toBeFocused()
  // Escape shuts the menu and leaves the selection (the new label) as it is.
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(moreButton).toBeFocused()
  await expect(page.locator('.statusbar .selected')).toHaveText('Label "beaker"')

  // No pointer was used at any point.
  expect(await page.evaluate(() => (window as unknown as { __pointer: string[] }).__pointer)).toEqual([])
  quiet(seen)
})

/** Every control a user can operate: buttons, fields, selects, sliders, radio buttons, tabs, and whatever Tab reaches. */
const CONTROLS =
  'button, input:not([type="hidden"]), select, textarea, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="slider"], [role="textbox"], [role="searchbox"], [role="combobox"], [role="menuitem"], [role="spinbutton"], [tabindex]:not([tabindex="-1"])'

test('controls-have-names', async ({ page, context }, info) => {
  // Every button, switch and field has an accessible name, in each of the main states of the editor, the More menu and
  // the dialogs included. A control that two states share (the same element, the same attributes and text) is checked
  // once.
  test.setTimeout(90_000)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page)
  const checked = new Set<string>()
  const states: string[] = []
  const check = async (state: string) => {
    const controls = page.locator(CONTROLS).filter({ visible: true })
    const keys = await controls.evaluateAll((els) =>
      els.map((el) =>
        el.closest('[inert]')
          ? null
          : [
              el.tagName,
              el.getAttribute('role'),
              el.getAttribute('type'),
              el.id,
              el.getAttribute('aria-label'),
              el.getAttribute('aria-labelledby'),
              el.getAttribute('title'),
              (el.textContent ?? '').trim().slice(0, 80),
            ].join('|'),
      ),
    )
    let fresh = 0
    for (const [i, key] of keys.entries()) {
      if (key === null || checked.has(key)) continue
      checked.add(key)
      fresh++
      await expect(controls.nth(i), `${state}: ${key}`).toHaveAccessibleName(/\S/)
    }
    states.push(`${state}: ${keys.length} controls, ${fresh} new`)
    expect(keys.length).toBeGreaterThan(0)
  }

  // The empty diagram: the top bar, the library, the card on the canvas, the inspector's document settings.
  await expect(emptyCard(page)).toBeVisible()
  await check('empty diagram')
  // Tool buttons say which tool is on.
  const tools = page.getByRole('toolbar', { name: 'Tools' }).getByRole('button')
  await expect(tools).toHaveCount(8)
  for (const t of await tools.all()) await expect(t).toHaveAttribute('aria-pressed', /^(true|false)$/)
  await expect(page.getByRole('toolbar', { name: 'Tools' }).locator('[aria-pressed="true"]')).toHaveCount(1)
  // The More menu.
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await check('More menu')
  await page.keyboard.press('Escape')
  // Renaming the title.
  await page.getByRole('button', { name: /^Rename: / }).click()
  await check('title')
  await page.keyboard.press('Escape')
  // The Templates tab of the library.
  await page.getByRole('tab', { name: 'Templates' }).click()
  await check('templates')
  await page.getByRole('tab', { name: 'Apparatus' }).click()
  // Help.
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Help' })).toBeVisible()
  await check('help')
  await page.keyboard.press('Escape')

  // A diagram with every kind of item: a beaker with water, a measuring cylinder (a Reading field), a label, a wire
  // and a rectangle.
  const b = new DocBuilder('Names')
  const beaker = b.symbol('beaker', { x: 120, y: 200, contents: { main: [{ kind: 'liquid', amount: 0.5, colour: '#cfe8f7' }] } })
  const cylinder = b.symbol('measuringCylinder', { x: 300, y: 240 })
  const wire = b.connector('wire', [P(60, 420), P(260, 420)])
  const label = b.label('beaker', 220, 120, [beaker, 50, 60])
  const shape: ShapeItem = { id: 'rect1', type: 'shape', shape: 'rect', x: 420, y: 420, w: 100, h: 60, rot: 0, fill: 'none', dash: false }
  b.doc.items[shape.id] = shape
  b.doc.order.push(shape.id)
  await load(page, b.doc)
  await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
  const pick = async (id: string) => {
    const g = await grabPoint(page, id)
    await page.mouse.click(g.x, g.y)
  }
  await pick(beaker.id)
  await check('a beaker with water')
  await page
    .getByRole('complementary', { name: 'Inspector' })
    .getByRole('button', { name: /^Colour: / })
    .click()
  await check('the colour presets')
  await page.keyboard.press('Escape')
  await pick(cylinder.id)
  await check('a measuring cylinder')
  await pick(label.id)
  await check('a label')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: 'Label text' })).toBeFocused()
  await check('the text box')
  await page.keyboard.press('Escape')
  await pick(wire.id)
  await check('a wire')
  await pick(shape.id)
  await check('a rectangle')
  await page.keyboard.press('Control+a')
  await check('several items')

  // The export dialog, with letters (the answer key can be chosen).
  const dialog = await exportDialog(page)
  await choose(dialog, 'Labels', 'Letters')
  await check('export')
  await page.keyboard.press('Escape')
  // The fallback dialog: a copy that fails, as a picture and as text.
  await page.evaluate(() => {
    navigator.clipboard.write = () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'))
    navigator.clipboard.writeText = () => Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'))
  })
  await page.getByRole('button', { name: 'Copy image' }).click()
  await expect(page.getByRole('dialog', { name: 'Copy by hand' })).toBeVisible()
  await check('copy by hand: picture')
  await page.keyboard.press('Escape')
  const svgDialog = await exportDialog(page)
  await choose(svgDialog, 'Format', 'SVG')
  await svgDialog.getByRole('button', { name: 'Copy', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Copy by hand' }).getByRole('textbox')).toBeVisible()
  await check('copy by hand: text')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  // The status bar after Save, and the banner after a file that cannot be opened.
  await download(page, () => more(page, 'Save'))
  await expect(page.getByRole('button', { name: 'Download did not start?' })).toBeVisible()
  await check('saved')
  await openThroughChooser(page, info, 'notes.json', '{"hello": 1}')
  await expect(page.getByRole('region', { name: 'Message' })).toBeVisible()
  await check('banner')

  // A window wide enough for the whole top bar, and one so narrow that the panels are drawers.
  await page.setViewportSize({ width: 1600, height: 900 })
  await expect(page.getByRole('button', { name: 'More', exact: true })).toHaveCount(0)
  await check('wide window')
  await page.setViewportSize({ width: 1000, height: 800 })
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await page.getByRole('button', { name: 'Inspector', exact: true }).click()
  await check('narrow window, drawers open')
  console.log(states.join('\n'))
  expect(checked.size).toBeGreaterThan(200)
})

/**
 * The focus ring of the control that has the focus, or null when the page itself has it. `cut` names each side of the
 * ring (outside the control by its offset, 2 px wide) that a box round it hides: a list that scrolls, a panel, the
 * window; it is empty when the whole ring shows. `edge` is how far the control is from the nearer end of the list
 * that it scrolls in, or null when it is in none: when Tab scrolls a control into view, it comes to rest 8 px from the
 * end (the list's scroll-padding).
 */
const focusRing = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    const cs = getComputedStyle(el)
    const out = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth)
    const r = el.getBoundingClientRect()
    const ring = { left: r.left - out, top: r.top - out, right: r.right + out, bottom: r.bottom + out }
    const cut: string[] = []
    let edge: number | null = null
    const inside = (name: string, box: { left: number; top: number; right: number; bottom: number }, x: boolean, y: boolean) => {
      if (x && ring.left < box.left - 0.5) cut.push(`left by ${name}`)
      if (x && ring.right > box.right + 0.5) cut.push(`right by ${name}`)
      if (y && ring.top < box.top - 0.5) cut.push(`top by ${name}`)
      if (y && ring.bottom > box.bottom + 0.5) cut.push(`bottom by ${name}`)
    }
    for (let a = el.parentElement; a; a = a.parentElement) {
      const s = getComputedStyle(a)
      const x = s.overflowX !== 'visible',
        y = s.overflowY !== 'visible'
      if (!x && !y) continue
      // What a box hides is outside its padding box: inside its borders.
      const b = a.getBoundingClientRect()
      const box = {
        left: b.left + a.clientLeft,
        top: b.top + a.clientTop,
        right: b.left + a.clientLeft + a.clientWidth,
        bottom: b.top + a.clientTop + a.clientHeight,
      }
      inside(`${a.tagName.toLowerCase()}.${a.className}`, box, x, y)
      if (edge === null && /auto|scroll/.test(s.overflowY) && a.scrollHeight > a.clientHeight) edge = Math.min(r.top - box.top, box.bottom - r.bottom)
    }
    inside('the window', { left: 0, top: 0, right: innerWidth, bottom: innerHeight }, true, true)
    return {
      what: `${el.tagName} ${el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 30)}`,
      tile: el.classList.contains('tile'),
      style: cs.outlineStyle,
      width: parseFloat(cs.outlineWidth),
      colour: cs.outlineColor,
      cut: cut.join(', '),
      edge,
    }
  })

/**
 * The sides of the focus ring that something paints over, found by their pixels: a box round the ring is taken from
 * the screen, and along the middle half of each side, the middle of the 2 px band must be the focus colour. This
 * finds what `focusRing` cannot: a neighbour drawn on top of the ring, such as the next of a list of touching buttons.
 * Empty when all four sides show.
 */
async function ringHidden(page: Page): Promise<string> {
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const cs = getComputedStyle(el)
    const out = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth)
    const r = el.getBoundingClientRect()
    return { x: r.left - out, y: r.top - out, width: r.width + 2 * out, height: r.height + 2 * out, band: parseFloat(cs.outlineWidth) }
  })
  const x0 = Math.floor(ring.x),
    y0 = Math.floor(ring.y)
  const clip = { x: x0, y: y0, width: Math.ceil(ring.x + ring.width) - x0, height: Math.ceil(ring.y + ring.height) - y0 }
  const shot = await page.screenshot({ clip })
  return page.evaluate(
    async ({ png, ring, clip }) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + png
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const k = img.width / clip.width // screen pixels to one CSS pixel
      /** Whether the page point (x, y) shows the focus colour, #1d4fc4. */
      const ink = (x: number, y: number) => {
        const d = g.getImageData(Math.floor((x - clip.x) * k), Math.floor((y - clip.y) * k), 1, 1).data
        return Math.abs(d[0] - 29) + Math.abs(d[1] - 79) + Math.abs(d[2] - 196) < 48
      }
      const h = ring.band / 2
      const sides: [string, (t: number) => [number, number]][] = [
        ['top', (t) => [ring.x + ring.width * t, ring.y + h]],
        ['bottom', (t) => [ring.x + ring.width * t, ring.y + ring.height - h]],
        ['left', (t) => [ring.x + h, ring.y + ring.height * t]],
        ['right', (t) => [ring.x + ring.width - h, ring.y + ring.height * t]],
      ]
      const hidden: string[] = []
      for (const [side, at] of sides) {
        let shown = 0
        for (let i = 0; i <= 10; i++) if (ink(...at(0.25 + i * 0.05))) shown++
        if (shown < 9) hidden.push(side)
      }
      return hidden.join(', ')
    },
    { png: shot.toString('base64'), ring, clip },
  )
}

test('focus-is-always-visible', async ({ page }) => {
  // Section 12: focus is always visible. Tab goes once round the whole editor with a part selected (its inspector
  // fields shown), then round the More menu and the export dialog: every control that takes the focus shows a ring
  // 2 px wide in the focus colour, and the whole ring shows: no list, panel or window hides a side of it, and nothing
  // paints over it (its pixels are checked). That holds too for a control that Tab scrolls into view at the end of its
  // list: a tile of the library, a template card, a colour preset.
  test.setTimeout(90_000) // it takes a picture of the ring at every stop
  await open(page)
  const b = new DocBuilder('Focus')
  b.symbol('beaker', { x: 150, y: 200, contents: { main: [{ kind: 'liquid', amount: 0.5, colour: '#cfe8f7' }] } })
  await load(page, b.doc)
  await page.keyboard.press('Control+a')
  const RING = { style: 'solid', width: 2, colour: 'rgb(29, 79, 196)' }
  const seen: string[] = []
  /** The tiles that Tab scrolled into view at the end of the list (8 px from it), by name. */
  const tilesAtEnd: string[] = []
  let pageStops = 0
  for (let i = 0; i < 400 && pageStops < 2; i++) {
    await page.keyboard.press('Tab')
    const r = await focusRing(page)
    if (!r) {
      pageStops++
      continue
    }
    if (pageStops === 1) seen.push(r.what)
    expect({ style: r.style, width: r.width, colour: r.colour }, r.what).toEqual(RING)
    expect(r.cut, r.what).toBe('')
    expect(await ringHidden(page), r.what).toBe('')
    if (r.tile && r.edge !== null && r.edge <= 8.5) tilesAtEnd.push(r.what)
  }
  expect(pageStops).toBe(2)
  expect(seen.length).toBeGreaterThan(120)
  expect(seen).toContain('DIV Canvas')
  expect(seen).toContain('BUTTON Copy image')
  expect(tilesAtEnd.length).toBeGreaterThan(20)
  // The More menu.
  await tabTo(page, page.getByRole('button', { name: 'More', exact: true }))
  await page.keyboard.press('Enter')
  for (let i = 0; i < 11; i++) {
    await page.keyboard.press('Tab')
    const r = (await focusRing(page))!
    expect(r.what).not.toMatch(/^BODY/)
    expect({ style: r.style, width: r.width, colour: r.colour }, r.what).toEqual(RING)
    expect(await ringHidden(page), r.what).toBe('')
  }
  await page.keyboard.press('Escape')
  // The export dialog: the dialog itself when it opens, then round its controls (Tab stays inside it).
  await tabTo(page, page.getByRole('button', { name: 'Export', exact: true }))
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Export' })
  await expect(dialog).toBeFocused()
  expect((await focusRing(page))!.style).toBe('solid')
  // Its Tab stops: Close, the chosen option of each of its five rows of options, Copy and Download.
  const inDialog: string[] = []
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab')
    const r = (await focusRing(page))!
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
    expect({ style: r.style, width: r.width, colour: r.colour }, r.what).toEqual(RING)
    expect(await ringHidden(page), r.what).toBe('')
    inDialog.push(r.what)
  }
  expect(inDialog.slice(0, 8)).toEqual(inDialog.slice(8, 16))
  expect(inDialog.slice(0, 8)).toEqual([
    'BUTTON Close export',
    'BUTTON PNG',
    'BUTTON 2×',
    'BUTTON White',
    'BUTTON As shown',
    'BUTTON As shown',
    'BUTTON Copy',
    'BUTTON Download',
  ])
  // Escape closes it; the focus goes back to Export.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeFocused()

  // The template cards: Tab from the Templates tab goes down the list of cards, each scrolled into view in turn.
  const library = page.getByRole('complementary', { name: 'Library' })
  await library.getByRole('tab', { name: 'Templates' }).click()
  const cards = library.getByRole('button', { name: /^Insert template: / })
  const cardsAtEnd: string[] = []
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab')
    const r = (await focusRing(page))!
    if (!(await library.evaluate((el) => el.contains(document.activeElement)))) break
    expect({ style: r.style, width: r.width, colour: r.colour }, r.what).toEqual(RING)
    expect(r.cut, r.what).toBe('')
    expect(await ringHidden(page), r.what).toBe('')
    if (r.what.includes('Insert template') && r.edge !== null && r.edge <= 8.5) cardsAtEnd.push(r.what)
  }
  await expect(cards.last()).toBeInViewport()
  expect(cardsAtEnd.length).toBeGreaterThan(10)

  // The colour presets of the beaker's liquid: a list that scrolls, in the inspector, which scrolls too.
  const swatch = page.getByRole('complementary', { name: 'Inspector' }).getByRole('button', { name: /^Colour: / })
  await tabTo(page, swatch)
  await page.keyboard.press('Enter')
  const presets = page.getByRole('group', { name: 'Colour presets' })
  const count = await presets.getByRole('button').count()
  const presetsAtEnd: string[] = []
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab')
    const r = (await focusRing(page))!
    expect(await presets.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    expect({ style: r.style, width: r.width, colour: r.colour }, r.what).toEqual(RING)
    expect(r.cut, r.what).toBe('')
    expect(await ringHidden(page), r.what).toBe('')
    if (r.edge !== null && r.edge <= 8.5) presetsAtEnd.push(r.what)
  }
  expect(presetsAtEnd.length).toBeGreaterThan(3)
  await page.keyboard.press('Escape')
  await expect(swatch).toBeFocused()
})

/** The text on the page whose contrast with its background is below 4.5:1, the lowest ratio, and how many were measured. */
const contrast = (page: Page) =>
  page.evaluate(() => {
    type C = [number, number, number, number]
    const parse = (s: string): C | null => {
      const m = /rgba?\(([^)]+)\)/.exec(s)
      if (!m) return null
      const v = m[1]
        .split(/[\s,/]+/)
        .filter(Boolean)
        .map(Number)
      return [v[0], v[1], v[2], v[3] ?? 1]
    }
    const over = (top: C, under: C): C => {
      const a = top[3] + under[3] * (1 - top[3])
      const mix = (i: number) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a
      return [mix(0), mix(1), mix(2), a]
    }
    /** The colour behind an element: its own background and those of its parents, down to the first opaque one. */
    const behind = (el: Element): C => {
      const layers: C[] = []
      for (let e: Element | null = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor)
        if (c && c[3] > 0) {
          layers.push(c)
          if (c[3] >= 1) break
        }
      }
      let bg: C = [255, 255, 255, 1]
      for (const c of layers.reverse()) bg = over(c, bg)
      return bg
    }
    const lum = (c: C) => {
      const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }
    const ratio = (a: C, b: C) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }
    const low: string[] = []
    let min = Infinity,
      measured = 0
    const measure = (el: Element, colour: string, what: string) => {
      const bg = behind(el)
      const r = ratio(over(parse(colour)!, bg), bg)
      measured++
      min = Math.min(min, r)
      if (r < 4.5) low.push(`${what}: ${r.toFixed(2)}, ${colour} on rgb(${bg.slice(0, 3).map(Math.round).join(', ')})`)
    }
    // Under a modal dialog only the dialog counts: the page behind it is shaded and out of use.
    const scope = document.querySelector('[aria-modal="true"]') ?? document.body
    const FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), select, textarea'
    for (const el of scope.querySelectorAll('*')) {
      // The drawing is the diagram's own content (black on white); a control that is turned off needs no contrast.
      if (el.closest('svg, option, [inert], :disabled, [aria-disabled="true"]')) continue
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue
      const text = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '')
      const field = el.matches(FIELD) ? (el as HTMLInputElement) : null
      if (text || (field && field.value !== ''))
        measure(el, getComputedStyle(el).color, `${el.tagName} "${(el.textContent || field?.value || '').trim().slice(0, 40)}"`)
      if (field?.placeholder && field.value === '') measure(el, getComputedStyle(el, '::placeholder').color, `placeholder "${field.placeholder}"`)
    }
    return { low, min, measured }
  })

test('text-contrast', async ({ page, context }, info) => {
  // Section 12: text contrast 4.5:1 or more against its background, in the main states of the editor.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await open(page)
  const results: string[] = []
  const check = async (state: string) => {
    const r = await contrast(page)
    results.push(`${state}: ${r.measured} texts, lowest ${r.min.toFixed(2)}`)
    expect(r.low, state).toEqual([])
    expect(r.measured).toBeGreaterThan(0)
    return r.min
  }
  let lowest = await check('empty diagram')
  await page.getByRole('button', { name: 'More', exact: true }).click()
  lowest = Math.min(lowest, await check('More menu'))
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Templates' }).click()
  lowest = Math.min(lowest, await check('templates'))
  await page.getByRole('tab', { name: 'Apparatus' }).click()
  const b = new DocBuilder('Contrast')
  b.symbol('beaker', { x: 150, y: 200, contents: { main: [{ kind: 'liquid', amount: 0.5, colour: '#cfe8f7' }] } })
  await load(page, b.doc)
  await page.keyboard.press('Control+a')
  await page
    .getByRole('complementary', { name: 'Inspector' })
    .getByRole('button', { name: /^Colour: / })
    .click()
  lowest = Math.min(lowest, await check('a beaker with its colour presets'))
  await page.keyboard.press('Escape')
  await page.keyboard.press('?')
  lowest = Math.min(lowest, await check('help'))
  await page.keyboard.press('Escape')
  await (await exportDialog(page)).getByRole('radio', { name: 'Letters' }).click()
  lowest = Math.min(lowest, await check('export'))
  await page.keyboard.press('Escape')
  await load(page, demoDoc())
  await download(page, () => more(page, 'Save'))
  await openThroughChooser(page, info, 'notes.json', '{"hello": 1}')
  await expect(page.getByRole('region', { name: 'Message' })).toBeVisible()
  lowest = Math.min(lowest, await check('banner and status bar'))
  budget(info, `text contrast: lowest ratio ${lowest.toFixed(2)} (${results.join('; ')})`)
})

// ---------------------------------------------------------------- first run and help (section 12)

test('empty-state-card', async ({ page }) => {
  // An empty diagram shows a card with "Pick a template or add apparatus" and three templates. A click on one makes it
  // the diagram, with its title. New brings the card back. A drawing tool hides it: a press then belongs to the tool.
  const seen = watch(page)
  await open(page)
  const card = emptyCard(page)
  await expect(card).toBeVisible()
  await expect(card.getByRole('heading')).toHaveText('Pick a template or add apparatus')
  const buttons = card.getByRole('button')
  const ids = ['heatingBeaker', 'titration', 'rateGasOverWater']
  await expect(buttons).toHaveCount(3)
  // Each button is named by its title, and shows a thumbnail of the template.
  for (const [i, id] of ids.entries()) {
    await expect(buttons.nth(i)).toHaveAccessibleName(template(id).title)
    expect(await buttons.nth(i).locator('svg.thumb path').count()).toBeGreaterThan(20)
  }
  await page.keyboard.press('u')
  await expect(card).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(card).toBeVisible()
  for (const id of ids) {
    const tpl = template(id)
    await card.getByRole('button', { name: tpl.title, exact: true }).click()
    expect(await getDoc(page)).toEqual(json(tpl.build()))
    await expect(page.getByRole('button', { name: `Rename: ${tpl.title}` })).toBeVisible()
    await expect(card).toHaveCount(0)
    // The view fits the template: every part of it is on the canvas.
    const stage = (await page.locator('#stage').boundingBox())!
    const drawn = (await page.locator('#stage > g').boundingBox())!
    expect(drawn.x).toBeGreaterThanOrEqual(stage.x)
    expect(drawn.x + drawn.width).toBeLessThanOrEqual(stage.x + stage.width + 1)
    await more(page, 'New')
    await expect(card).toBeVisible()
  }
  // A part from the library: the card goes.
  await page.getByRole('complementary', { name: 'Library' }).getByRole('button', { name: 'Beaker', exact: true }).click()
  await expect(card).toHaveCount(0)
  quiet(seen)
})

test('help-dialog', async ({ page }) => {
  // Help (`?` and the Help button): a dialog with six lines on how to start and the key table. No alert, confirm or
  // prompt. The focus stays in the dialog, Escape closes it, and the focus goes back.
  const seen = watch(page)
  await open(page)
  await page.keyboard.press('?')
  const help = page.getByRole('dialog', { name: 'Help' })
  await expect(help).toBeVisible()
  await expect(help).toBeFocused()
  await expect(help.getByRole('listitem')).toHaveCount(6)
  const rows = help.getByRole('row')
  expect(await rows.count()).toBeGreaterThanOrEqual(20)
  for (const key of ['Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y', 'Ctrl+Shift+C', '/', '?', 'Delete or Backspace', 'Arrow keys (Shift: 10 u)'])
    await expect(help.getByText(key, { exact: true })).toBeVisible()
  // Tab stays in the dialog: its one control is Close.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab')
    await expect(help.getByRole('button', { name: 'Close help' })).toBeFocused()
  }
  // While it is open the editor's keys do nothing.
  await page.keyboard.press('u')
  await expect(page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Select', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(help).toHaveCount(0)
  // The Help button, in the More menu here: the focus goes back to More when the dialog closes.
  await more(page, 'Help')
  await expect(help).toBeVisible()
  await help.getByRole('button', { name: 'Close help' }).click()
  await expect(help).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'More', exact: true })).toBeFocused()
  quiet(seen)
})

test('narrow-window-keyboard', async ({ page }) => {
  // Below 1100 px the library and the inspector are drawers. A shut drawer is out of the way of the focus (inert), so
  // the focus never goes off the screen. `/` opens the library at its search box, from either tab; Enter adds the part,
  // shuts the drawer and gives the focus to the canvas, where the arrow keys move the part.
  const seen = watch(page)
  await page.setViewportSize({ width: 1000, height: 760 })
  await open(page)
  const library = page.getByRole('complementary', { name: 'Library' })
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await expect(library).toHaveAttribute('inert', '')
  await expect(inspector).toHaveAttribute('inert', '')
  // Once round the page with Tab: the focus never enters a shut drawer.
  let stops = 0
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab')
    const where = await page.evaluate(() => (document.activeElement === document.body ? 'page' : document.activeElement?.closest('aside') ? 'drawer' : 'bar'))
    if (where === 'page' && stops > 0) break
    if (where !== 'page') stops++
    expect(where).not.toBe('drawer')
  }
  expect(stops).toBeGreaterThan(10)
  // The Templates tab, then `/`: the Apparatus tab, and the search box has the focus.
  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await expect(library).not.toHaveAttribute('inert')
  await library.getByRole('tab', { name: 'Templates' }).click()
  await page.keyboard.press('/')
  const search = page.getByRole('searchbox', { name: 'Search apparatus' })
  await expect(search).toBeFocused()
  await expect(library.getByRole('tab', { name: 'Apparatus' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.type('conical')
  await page.keyboard.press('Enter')
  const doc = await getDoc(page)
  const flask = doc.items[doc.order[0]] as SymbolItem
  expect(flask.symbol).toBe('conicalFlask')
  await expect(page.getByRole('application', { name: 'Canvas' })).toBeFocused()
  await expect(library).toHaveAttribute('inert', '')
  await page.keyboard.press('ArrowLeft')
  expect((await getDoc(page)).items[flask.id]).toMatchObject({ x: flask.x - 1, y: flask.y })
  // The inspector drawer opens from its button; its fields take the focus.
  await page.getByRole('button', { name: 'Inspector', exact: true }).click()
  await expect(inspector).not.toHaveAttribute('inert')
  await inspector.getByLabel('Rotation', { exact: true }).focus()
  await expect(inspector.getByLabel('Rotation', { exact: true })).toBeFocused()
  quiet(seen)
})

// ---------------------------------------------------------------- the library (section 12)

test('tile-names-fit', async ({ page }) => {
  // "A tile is 76 × 84 px: a thumbnail and the name." Every symbol tile and every "Tubes and lines" tile shows its
  // whole name inside the tile, on at most two lines: the name's box is inside the tile, every line of it is inside
  // that box (no letter outside, no word cut at the edge), and nothing of it is hidden. A long word may break only at
  // a soft hyphen, which then shows. The title and the accessible name are the name as it is.
  await open(page)
  const names = [...SYMBOLS.map((d) => d.name), ...CONNECTOR_PRESETS.map((p) => p.name)]
  const tiles = page.getByRole('complementary', { name: 'Library' }).locator('.tile')
  await expect(tiles).toHaveCount(names.length)
  const drawn = await tiles.evaluateAll((els) =>
    els.map((tile) => {
      const name = tile.querySelector<HTMLElement>('.tile-name')!
      const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
      const range = document.createRange()
      range.selectNodeContents(name)
      const lines = [...range.getClientRects()].filter((r) => r.width > 0).map(box)
      return {
        title: tile.getAttribute('title') ?? '',
        label: tile.getAttribute('aria-label') ?? '',
        text: (name.textContent ?? '').replaceAll('\u00ad', ''),
        tile: box(tile.getBoundingClientRect()),
        name: box(name.getBoundingClientRect()),
        lines,
        rows: new Set(lines.map((r) => Math.round(r.top))).size,
        hidden: name.scrollWidth > name.clientWidth || name.scrollHeight > name.clientHeight,
        size: parseFloat(getComputedStyle(name).fontSize),
      }
    }),
  )
  const inside = (a: { left: number; top: number; right: number; bottom: number }, b: typeof a) =>
    a.left >= b.left - 0.5 && a.top >= b.top - 0.5 && a.right <= b.right + 0.5 && a.bottom <= b.bottom + 0.5
  expect(new Set(drawn.map((t) => t.title))).toEqual(new Set(names))
  for (const t of drawn) {
    expect(t.label, t.title).toBe(t.title)
    expect(t.text, t.title).toBe(t.title)
    expect(Math.round(t.tile.right - t.tile.left), t.title).toBe(76)
    expect(Math.round(t.tile.bottom - t.tile.top), t.title).toBe(84)
    expect(inside(t.name, t.tile), `${t.title}: the name's box is inside the tile`).toBe(true)
    expect(t.rows, `${t.title}: at most two lines`).toBeLessThanOrEqual(2)
    for (const line of t.lines) expect(inside(line, t.name), `${t.title}: a line is inside the name's box`).toBe(true)
    expect(t.hidden, `${t.title}: nothing of the name is hidden`).toBe(false)
    expect(t.size, t.title).toBeGreaterThanOrEqual(8)
  }
  // Most names are at the caption size, 10 px; the few that need it are smaller.
  const small = drawn.filter((t) => t.size < 10).map((t) => `${t.title} (${t.size} px)`)
  test.info().annotations.push({
    type: 'tile names',
    description: `${drawn.length} tiles, ${drawn.filter((t) => t.rows === 2).length} on two lines; smaller than 10 px: ${small.join(', ') || 'none'}`,
  })
  expect(small.length).toBeLessThan(5)
})

// ---------------------------------------------------------------- the library: drag a tile to the canvas (section 12)

test('library-drag-adds-at-the-pointer', async ({ page }) => {
  // "Drag a tile to the canvas: the symbol is added at the pointer." A tile is dragged with pointer events, the mouse
  // as a finger: a ghost of the tile follows the pointer, and the release adds the part there, as the selection. A
  // "Tubes and lines" tile adds its connector with the middle of its box there. A release anywhere but the canvas,
  // or Escape, adds nothing; a click still adds at the centre of the view. In a narrow window the library is a
  // drawer: a drag that leaves it shuts it, so that the whole canvas takes the drop.
  const seen = watch(page)
  await open(page)
  const library = page.getByRole('complementary', { name: 'Library' })
  const ghost = page.locator('.tile-ghost')
  const count = async () => (await getDoc(page)).order.length
  /** Press on a tile, move to `to` in 8 moves (the ghost under the pointer), and release unless `hold`. */
  const drag = async (tile: Locator, to: Pt, hold = false) => {
    await tile.scrollIntoViewIfNeeded()
    const from = await centreOf(tile)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8)
    await expect(ghost).toBeVisible()
    expectNear(await centreOf(ghost), to, 0)
    if (!hold) await page.mouse.up()
  }
  const stage = (await page.locator('#stage').boundingBox())!

  // A beaker dropped on the canvas: the beaker is there, selected, and the canvas has the focus. One part is added:
  // the release is not also a click of the tile.
  const at = P(stage.x + stage.width * 0.3, stage.y + stage.height * 0.65)
  await drag(library.getByRole('button', { name: 'Beaker', exact: true }), at)
  await expect(ghost).toHaveCount(0)
  let doc = await getDoc(page)
  expect(doc.order).toHaveLength(1)
  const w = await worldAt(page, at)
  expect(doc.items[doc.order[0]]).toMatchObject({ type: 'symbol', symbol: 'beaker', x: Math.round(w.x), y: Math.round(w.y) })
  await expect(page.locator('.statusbar .selected')).toHaveText('Beaker')
  await expect(page.getByRole('application', { name: 'Canvas' })).toBeFocused()

  // A "Tubes and lines" tile: a delivery tube, the middle of its points' box at the pointer.
  const at2 = P(stage.x + stage.width * 0.6, stage.y + stage.height * 0.3)
  await drag(library.getByRole('button', { name: 'Delivery tube', exact: true }), at2)
  doc = await getDoc(page)
  expect(doc.order).toHaveLength(2)
  const tube = doc.items[doc.order[1]] as ConnectorItem
  expect(tube.kind).toBe('glassTube')
  const xs = tube.points.map((p) => p.x),
    ys = tube.points.map((p) => p.y)
  const w2 = await worldAt(page, at2)
  expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - w2.x)).toBeLessThanOrEqual(0.5)
  expect(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - w2.y)).toBeLessThanOrEqual(0.5)
  await expect(page.locator('.statusbar .selected')).toHaveText('Glass tube')

  // Released over the inspector: nothing is added. Escape during a drag: nothing either, and the selection stays.
  const flask = library.getByRole('button', { name: 'Conical flask', exact: true })
  await drag(flask, await centreOf(page.getByRole('complementary', { name: 'Inspector' })))
  await expect(ghost).toHaveCount(0)
  expect(await count()).toBe(2)
  await drag(flask, at, true)
  await page.keyboard.press('Escape')
  await expect(ghost).toHaveCount(0)
  await page.mouse.up()
  expect(await count()).toBe(2)
  await expect(page.locator('.statusbar .selected')).toHaveText('Glass tube')
  // A click adds at the centre of the view.
  await flask.click()
  doc = await getDoc(page)
  expect(doc.order).toHaveLength(3)
  const centre = await worldAt(page, P(stage.x + stage.width / 2, stage.y + stage.height / 2))
  expect(doc.items[doc.order[2]]).toMatchObject({ symbol: 'conicalFlask', x: Math.round(centre.x), y: Math.round(centre.y) })

  // A narrow window: the library is a drawer over the canvas. A drag that leaves it shuts it; dropped where the
  // drawer was, the part lands on the canvas there.
  await page.setViewportSize({ width: 1000, height: 800 })
  const libraryButton = page.getByRole('button', { name: 'Library', exact: true })
  await libraryButton.click()
  await expect.poll(async () => (await library.boundingBox())!.x).toBe(0)
  const testTube = library.getByRole('button', { name: 'Test tube', exact: true })
  await testTube.scrollIntoViewIfNeeded()
  const from = await centreOf(testTube)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + 50 * i, from.y)
  await expect(libraryButton).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(async () => (await library.boundingBox())!.x + (await library.boundingBox())!.width).toBeLessThanOrEqual(0)
  const back = P(160, from.y + 40)
  for (let i = 1; i <= 8; i++) await page.mouse.move(from.x + 400 + ((back.x - from.x - 400) * i) / 8, from.y + ((back.y - from.y) * i) / 8)
  await page.mouse.up()
  doc = await getDoc(page)
  expect(doc.order).toHaveLength(4)
  const w4 = await worldAt(page, back)
  expect(doc.items[doc.order[3]]).toMatchObject({ symbol: 'testTube', x: Math.round(w4.x), y: Math.round(w4.y) })
  await expect(library).toHaveAttribute('inert', '')
  quiet(seen)
})

// ---------------------------------------------------------------- touch (section 12)

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true })

  test('touch-pinch-pan-and-handles', async ({ page }) => {
    // Pointer events everywhere: a tap selects, a finger drags a handle through its 28 px hit area, two fingers pinch
    // to zoom about their centre and pan, and a double tap edits a label.
    await open(page)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    await expect(page.locator('.canvas')).toHaveCSS('touch-action', 'none')
    const b = new DocBuilder('Touch')
    const beaker = b.symbol('beaker', { x: 150, y: 300, contents: { main: [{ kind: 'liquid', amount: 0.5, colour: '#cfe8f7' }] } })
    const label = b.label('beaker', 300, 220, [beaker, 50, 60])
    await load(page, b.doc)
    await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
    const { touch } = await fingers(page)

    // A tap selects the beaker. Each of its handles (8 to resize, 1 to turn, 1 for the level) has a hit area 28 px
    // across.
    const g = await grabPoint(page, beaker.id)
    await page.touchscreen.tap(g.x, g.y)
    await expect(page.locator('.statusbar .selected')).toHaveText('Beaker')
    const hits = page.locator('.overlay .handle-hit')
    await expect(hits).toHaveCount(10)
    for (const r of await hits.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
      expect(r.width).toBeCloseTo(28, 0)
      expect(r.height).toBeCloseTo(28, 0)
    }
    // A finger 11 px from the corner handle (outside its 8 px square, inside its hit area) drags the corner 30 and 20 px
    // further out. The corner keeps its place under the finger: it does not jump.
    const se = await centreOf(page.locator('rect.handle[data-handle="se"]'))
    const from = P(se.x + 8, se.y + 7.5)
    await touch('touchStart', [from])
    for (let i = 1; i <= 5; i++) await touch('touchMove', [P(from.x + 6 * i, from.y + 4 * i)])
    await touch('touchEnd', [])
    const resized = (await getDoc(page)).items[beaker.id] as SymbolItem
    expect(resized.w).toBeCloseTo(beaker.w + 30, 0)
    expect(resized.h).toBeCloseTo(beaker.h + 20, 0)
    const doc = await getDoc(page)

    // Two fingers 100 px apart spread to 200 px about a fixed centre, well away from the centre of the canvas (a zoom
    // about the centre of the canvas would move what is under the fingers by over 200 px): the zoom doubles, and the
    // world point under the pinch centre stays under it, within 0.5 px.
    const stage = (await page.locator('#stage').boundingBox())!
    const c = P(stage.x + stage.width / 2, stage.y + stage.height / 2)
    const q = P(stage.x + 110, stage.y + stage.height / 2 + 160)
    expect(Math.hypot(q.x - c.x, q.y - c.y)).toBeGreaterThan(200)
    const v0 = await page.evaluate(() => window.__pracdraw.view())
    const world = await worldAt(page, q)
    await touch('touchStart', [P(q.x - 50, q.y), P(q.x + 50, q.y)])
    for (let i = 1; i <= 5; i++) await touch('touchMove', [P(q.x - 50 - 10 * i, q.y), P(q.x + 50 + 10 * i, q.y)])
    await touch('touchEnd', [])
    const v1 = await page.evaluate(() => window.__pracdraw.view())
    expect(v1.zoom).toBeCloseTo(2 * v0.zoom, 3)
    expect(Math.abs(stage.x + v1.x + world.x * v1.zoom - q.x)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(stage.y + v1.y + world.y * v1.zoom - q.y)).toBeLessThanOrEqual(0.5)
    // Two fingers that move together pan: 60 px right and 30 px down, at the same zoom.
    await touch('touchStart', [P(c.x - 40, c.y), P(c.x + 40, c.y)])
    for (let i = 1; i <= 5; i++) await touch('touchMove', [P(c.x - 40 + 12 * i, c.y + 6 * i), P(c.x + 40 + 12 * i, c.y + 6 * i)])
    await touch('touchEnd', [])
    const v2 = await page.evaluate(() => window.__pracdraw.view())
    expect(v2.zoom).toBeCloseTo(v1.zoom, 6)
    expect(v2.x - v1.x).toBeCloseTo(60, 0)
    expect(v2.y - v1.y).toBeCloseTo(30, 0)
    // Neither changed the diagram.
    expect(await getDoc(page)).toEqual(doc)

    // A double tap on the label opens its text box. (The pinch took the label off the canvas: the view comes back.)
    await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
    const t = await centreOf(page.locator(`#stage [data-id="${label.id}"] text`))
    await page.touchscreen.tap(t.x, t.y)
    await page.touchscreen.tap(t.x, t.y)
    const box = page.getByRole('textbox', { name: 'Label text' })
    await expect(box).toBeFocused()
    await expect(box).toHaveValue('beaker')
  })

  test('touch-drag-tile-to-canvas', async ({ page }) => {
    // A finger drags a tile of the library to the canvas with pointer events, as the mouse does: a symbol, and a "Tubes
    // and lines" preset. The drag starts when the finger moves sideways; a ghost of the tile is under the finger; the
    // part is added where the finger is lifted. A tap on a tile still adds the part at the centre of the view. In a
    // narrow window the drag shuts the library's drawer when it leaves it, and the canvas takes the drop.
    const seen = watch(page)
    await open(page)
    const { drag, touch } = await fingers(page)
    const library = page.getByRole('complementary', { name: 'Library' })
    const ghost = page.locator('.tile-ghost')
    const stage = (await page.locator('#stage').boundingBox())!

    // A beaker: 40 px sideways, then on to the drop point, with the ghost under the finger; then the finger comes up.
    const from = await centreOf(library.getByRole('button', { name: 'Beaker', exact: true }))
    const at = P(stage.x + stage.width * 0.4, stage.y + stage.height * 0.7)
    await drag(from, at, { via: [P(from.x + 40, from.y)], hold: true })
    await expect(ghost).toBeVisible()
    expectNear(await centreOf(ghost), at, 0)
    await touch('touchEnd', [])
    await expect(ghost).toHaveCount(0)
    let doc = await getDoc(page)
    expect(doc.order).toHaveLength(1)
    const w = await worldAt(page, at)
    expect(doc.items[doc.order[0]]).toMatchObject({ symbol: 'beaker', x: Math.round(w.x), y: Math.round(w.y) })
    await expect(page.locator('.statusbar .selected')).toHaveText('Beaker')

    // A wire, from "Tubes and lines" at the end of the list: the middle of its points' box where the finger came up.
    const wire = library.getByRole('button', { name: 'Wire', exact: true })
    await wire.scrollIntoViewIfNeeded()
    const from2 = await centreOf(wire)
    const at2 = P(stage.x + stage.width * 0.7, stage.y + stage.height * 0.25)
    await drag(from2, at2, { via: [P(from2.x + 40, from2.y)] })
    doc = await getDoc(page)
    expect(doc.order).toHaveLength(2)
    const added = doc.items[doc.order[1]] as ConnectorItem
    expect(added.kind).toBe('wire')
    const w2 = await worldAt(page, at2)
    const xs = added.points.map((p) => p.x),
      ys = added.points.map((p) => p.y)
    expect(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - w2.x)).toBeLessThanOrEqual(0.5)
    expect(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - w2.y)).toBeLessThanOrEqual(0.5)

    // A tap still adds at the centre of the view.
    const flask = library.getByRole('button', { name: 'Conical flask', exact: true })
    await flask.scrollIntoViewIfNeeded()
    const f = await centreOf(flask)
    await page.touchscreen.tap(f.x, f.y)
    doc = await getDoc(page)
    expect(doc.order).toHaveLength(3)
    const centre = await worldAt(page, P(stage.x + stage.width / 2, stage.y + stage.height / 2))
    expect(doc.items[doc.order[2]]).toMatchObject({ symbol: 'conicalFlask', x: Math.round(centre.x), y: Math.round(centre.y) })

    // A narrow window: the library is a drawer. The finger drags a test tube out of it: the drawer shuts, and the test
    // tube lands where the finger comes up, on the canvas where the drawer was.
    await page.setViewportSize({ width: 1000, height: 800 })
    const libraryButton = page.getByRole('button', { name: 'Library', exact: true })
    const lb = await centreOf(libraryButton)
    await page.touchscreen.tap(lb.x, lb.y)
    await expect.poll(async () => (await library.boundingBox())!.x).toBe(0)
    const tube = library.getByRole('button', { name: 'Test tube', exact: true })
    await tube.scrollIntoViewIfNeeded()
    const from3 = await centreOf(tube)
    const out = P(600, from3.y)
    await drag(from3, out, { via: [P(from3.x + 40, from3.y)], hold: true })
    await expect(libraryButton).toHaveAttribute('aria-expanded', 'false')
    await expect
      .poll(async () => {
        const b = (await library.boundingBox())!
        return b.x + b.width
      })
      .toBeLessThanOrEqual(0)
    const back = P(160, from3.y + 40)
    for (let i = 1; i <= 8; i++) await touch('touchMove', [P(out.x + ((back.x - out.x) * i) / 8, out.y + ((back.y - out.y) * i) / 8)])
    expectNear(await centreOf(ghost), back, 0)
    await touch('touchEnd', [])
    doc = await getDoc(page)
    expect(doc.order).toHaveLength(4)
    const w3 = await worldAt(page, back)
    expect(doc.items[doc.order[3]]).toMatchObject({ symbol: 'testTube', x: Math.round(w3.x), y: Math.round(w3.y) })
    await expect(library).toHaveAttribute('inert', '')
    quiet(seen)
  })

  test('touch-library-swipe-scrolls', async ({ page }) => {
    // A finger that swipes up or down on the library scrolls the list, on a tile as anywhere, and adds nothing: only a
    // move that is mostly sideways drags a tile. The list lets a finger pan it only up and down.
    const seen = watch(page)
    await open(page)
    const { drag } = await fingers(page)
    const library = page.getByRole('complementary', { name: 'Library' })
    const list = library.locator('.panel-scroll')
    await expect(list).toHaveCSS('touch-action', 'pan-y pinch-zoom')
    expect(await list.evaluate((el) => el.scrollTop)).toBe(0)
    const tile = await centreOf(library.getByRole('button', { name: 'Conical flask', exact: true }))
    await drag(tile, P(tile.x + 20, tile.y - 300), { steps: 10 })
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeGreaterThan(100)
    // And down again, from beside the tiles (20 px in from the list's edge, clear of its scroll bar).
    const scrolled = await list.evaluate((el) => el.scrollTop)
    const gap = await list.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.right - 20, y: r.top + 100 }
    })
    expect(await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.closest('.tile'), gap)).toBeNull()
    await drag(gap, P(gap.x - 10, gap.y + 200), { steps: 10 })
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBeLessThan(scrolled)
    await expect(page.locator('.tile-ghost')).toHaveCount(0)
    expect((await getDoc(page)).order).toEqual([])
    quiet(seen)
  })

  test('touch-swipes-keep-the-app', async ({ page }) => {
    // A one-finger swipe to the right that nothing scrolls must not take the browser back (to about:blank), which
    // would lose the app: on the empty-state card, the top bar, the inspector, the status bar, the library and a dialog.
    // The page gives its overscroll to nothing, and no panel, list or dialog that scrolls passes its overscroll on.
    await open(page)
    const url = page.url()
    expect(url).toBe(FILE)
    const { drag } = await fingers(page)
    const swipe = async (what: string, from: Pt, dx = 300) => {
      const navigated = page.waitForEvent('framenavigated', { timeout: 1000 }).then(
        () => true,
        () => false,
      )
      await drag(from, P(from.x + dx, from.y), { steps: 10 })
      expect(await navigated, what).toBe(false)
      expect(page.url(), what).toBe(url)
    }
    /** Every element that scrolls, with its overscroll behaviour unless that is 'none' on both axes. */
    const leaks = () =>
      page.evaluate(() =>
        [document.documentElement, document.body, ...document.querySelectorAll('body *')]
          .filter((el) => el === document.documentElement || el === document.body || /auto|scroll/.test(getComputedStyle(el).overflow))
          .map((el) => [el.tagName, el.className, getComputedStyle(el).overscrollBehaviorX, getComputedStyle(el).overscrollBehaviorY].join(' '))
          .filter((s) => !s.endsWith(' none none')),
      )
    await swipe('the empty-state card', await centreOf(emptyCard(page).getByRole('heading')))
    await swipe('the top bar', await centreOf(page.locator('.topbar .spacer')))
    const inspector = (await page.getByRole('complementary', { name: 'Inspector' }).boundingBox())!
    await swipe('the inspector', P(inspector.x + 20, inspector.y + 200), 250)
    await swipe('the status bar', await centreOf(page.locator('.statusbar .hint')))
    const library = page.getByRole('complementary', { name: 'Library' })
    await swipe('a heading of the library', await centreOf(library.locator('h3').first()))
    expect(await leaks()).toEqual([])
    // The help dialog.
    await page.keyboard.press('?')
    await expect(page.getByRole('dialog', { name: 'Help' })).toBeVisible()
    expect(await leaks()).toEqual([])
    await swipe('the help dialog', await centreOf(page.getByRole('dialog', { name: 'Help' }).locator('ol')), 250)
    await page.keyboard.press('Escape')
    // The export dialog.
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Export' })).toBeVisible()
    expect(await leaks()).toEqual([])
    await page.keyboard.press('Escape')
    // On a tile, a sideways swipe drags the tile: the part is added where the finger came up, and the page stays.
    await swipe('a tile of the library', await centreOf(library.getByRole('button', { name: 'Beaker', exact: true })))
    expect((await getDoc(page)).order).toHaveLength(1)
    // The colour presets of the beaker's water: a list that scrolls in the inspector.
    const panel = page.getByRole('complementary', { name: 'Inspector' })
    await panel.getByRole('button', { name: 'Water', exact: true }).click()
    await panel.getByRole('button', { name: /^Colour: / }).click()
    const presets = panel.getByRole('group', { name: 'Colour presets' })
    await expect(presets).toBeVisible()
    expect(await presets.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    expect(await leaks()).toEqual([])
    await swipe('the colour presets', await centreOf(presets.locator('h4').first()), 150)
    await expect(page.getByRole('button', { name: 'Copy image' })).toBeVisible()
  })
})
