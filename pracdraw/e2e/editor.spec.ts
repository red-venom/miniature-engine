import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { demoDoc } from '../src/demo.ts'
import { P, bounds, dist, scan, type Pt } from '../src/kernel/geom.ts'
import { parseMarkup, smartChem } from '../src/kernel/text.ts'
import { itemBox as boundsOf } from '../src/model/bounds.ts'
import { DocBuilder, anchorOf, anchorWorld } from '../src/model/build.ts'
import { deleteItems } from '../src/model/commands.ts'
import { toWorld } from '../src/model/transform.ts'
import type { ConnectorItem, Doc, LabelItem, ShapeItem, SymbolItem } from '../src/model/types.ts'
import { labelPoint } from '../src/symbols/label.ts'
import { geometry, labelText, symbolDef } from '../src/symbols/registry.ts'
import { amountToReading } from '../src/symbols/scale.ts'

// The built single file, opened straight from disk: the hardest hosting case.
const FILE = pathToFileURL('dist/index.html').href

interface Hook {
  doc(): Doc
  load(doc: Doc): void
  png(scale: number): string
  svg(): string
  view(v?: { x?: number; y?: number; zoom?: number }): { x: number; y: number; zoom: number }
  screenRect(): { x: number; y: number; width: number; height: number }
}
declare global {
  interface Window {
    __pracdraw: Hook
  }
}

const getDoc = (page: Page) => page.evaluate(() => window.__pracdraw.doc())
const getSvg = (page: Page) => page.evaluate(() => window.__pracdraw.svg())
/** The SVG without its metadata (the document JSON), so that a check sees only what is drawn. */
const drawing = (svg: string) => svg.replace(/<metadata>[\s\S]*?<\/metadata>/, '')
const loadDemo = (page: Page) => page.evaluate((d) => window.__pracdraw.load(d), demoDoc())
const symbols = (doc: Doc) => doc.order.map((id) => doc.items[id]).filter((it): it is SymbolItem => it.type === 'symbol')

/** The one symbol on the canvas, as the DOM draws it. */
const itemBox = async (page: Page, id: string) => (await page.locator(`#stage [data-id="${id}"]`).boundingBox())!

async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number, steps = 8) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps)
  await page.mouse.up()
}

/** A world point on the page, in CSS px. */
async function onScreen(page: Page, p: Pt): Promise<Pt> {
  const v = await page.evaluate(() => window.__pracdraw.view())
  const r = (await page.locator('#stage').boundingBox())!
  return { x: r.x + v.x + p.x * v.zoom, y: r.y + v.y + p.y * v.zoom }
}

/** A symbol's cavity in the world, as the item stands, computed with the kernel. */
const worldCavity = (it: SymbolItem, cavity = 'main'): Pt[][] =>
  geometry(it.symbol, it.w, it.h, it.params)
    .cavities!.find((c) => c.id === cavity)!
    .polys.map((poly) => poly.map((p) => toWorld(it, p)))

async function addFromLibrary(page: Page, name: string): Promise<SymbolItem> {
  await page.getByRole('button', { name, exact: true }).click()
  const doc = await getDoc(page)
  return symbols(doc)[symbols(doc).length - 1]
}

// ---------------------------------------------------------------- the five starter tests, ported to the editor

test('the single file runs from file:// with no network requests', async ({ page }) => {
  const external: string[] = [],
    errors: string[] = []
  page.on('request', (r) => {
    if (!/^(file|data|blob):/.test(r.url())) external.push(r.url())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto(FILE)
  await expect(page.locator('#stage')).toBeVisible()
  await loadDemo(page)
  expect(await page.locator('#stage path').count()).toBeGreaterThan(50)
  expect(external).toEqual([])
  expect(errors).toEqual([])
  const html = readFileSync('dist/index.html', 'utf8')
  expect(html).not.toMatch(/(src|href)="https?:/)
  expect(html.length).toBeLessThan(900_000) // the size budget in section 6 of the specification
})

test('the PNG drawn on canvas matches the SVG on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1100 })
  await page.goto(FILE)
  await loadDemo(page)
  await page.getByLabel('Dot grid').uncheck()
  await page.keyboard.press('1') // fit
  await page.keyboard.press('0') // 100 %, on whole pixels
  const rect = await page.evaluate(() => window.__pracdraw.screenRect())
  const shot = await page.screenshot({ clip: rect }) // device scale factor 2
  const r = await page.evaluate(async (shotB64) => {
    const load = (src: string) =>
      new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = rej
        i.src = src
      })
    const pngUrl = window.__pracdraw.png(2)
    const [a, b] = await Promise.all([load(pngUrl), load('data:image/png;base64,' + shotB64)])
    const data = (img: HTMLImageElement) => {
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0)
      return x.getImageData(0, 0, c.width, c.height).data
    }
    const da = data(a),
      db = data(b)
    let diff = 0,
      ink = 0
    for (let i = 0; i < da.length; i += 4) {
      if (da[i] < 128) ink++
      if (Math.abs(da[i] - db[i]) > 96 || Math.abs(da[i + 1] - db[i + 1]) > 96 || Math.abs(da[i + 2] - db[i + 2]) > 96) diff++
    }
    return { size: [a.width, a.height, b.width, b.height], diff, ink, pngUrl }
  }, shot.toString('base64'))
  mkdirSync('out', { recursive: true })
  writeFileSync('out/export.png', Buffer.from(r.pngUrl.split(',')[1], 'base64'))
  expect(r.size).toEqual([rect.width * 2, rect.height * 2, rect.width * 2, rect.height * 2])
  expect(r.ink).toBeGreaterThan(20000)
  expect(r.diff / r.ink).toBeLessThan(0.02)
})

test('the SVG export is standalone and plain', async ({ page }) => {
  await page.goto(FILE)
  await loadDemo(page)
  const svg = await getSvg(page)
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  expect(svg).not.toMatch(/<(clipPath|mask|pattern|filter|foreignObject|use|style|image|defs)\b/)
  expect(svg).not.toMatch(/ (class|style)=/)
  expect(svg).toContain('<metadata>')
  // It must also parse and draw as an image, at the size it declares.
  const width = Number(/width="([\d.]+)"/.exec(svg)![1])
  const ok = await page.evaluate(
    ([s, w]) =>
      new Promise<boolean>((res) => {
        const i = new Image()
        i.onload = () => res(i.naturalWidth === w)
        i.onerror = () => res(false)
        i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s as string)
      }),
    [svg, width] as const,
  )
  expect(ok).toBe(true)
})

test('copy puts a PNG on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(FILE)
  await loadDemo(page)
  await page.bringToFront()
  await page.getByRole('button', { name: 'Copy image' }).click()
  await expect(page.getByRole('status')).toHaveText('Copied')
  const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => [...i.types]))
  expect(types).toContain('image/png')
})

test('settings re-render the diagram', async ({ page }) => {
  await page.goto(FILE)
  await loadDemo(page)
  const colour = drawing(await getSvg(page))
  await page.getByLabel('Photocopy-safe').check()
  const mono = drawing(await getSvg(page))
  expect(colour).toContain('#cfe8f7')
  expect(mono).not.toContain('#cfe8f7')
  await page.getByRole('radio', { name: 'Blank' }).click()
  expect(drawing(await getSvg(page))).not.toContain('delivery tube')
})

// ---------------------------------------------------------------- phase 2 gate tests

test('add-move-undo', async ({ page }) => {
  await page.goto(FILE)
  const beaker = await addFromLibrary(page, 'Beaker')
  expect(beaker.symbol).toBe('beaker')
  const box = await itemBox(page, beaker.id)
  await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 120, 60)
  const moved = (await getDoc(page)).items[beaker.id] as SymbolItem
  expect(moved.x).toBeCloseTo(beaker.x + 120, 0)
  expect(moved.y).toBeCloseTo(beaker.y + 60, 0)
  await page.keyboard.press('Control+z')
  const back = (await getDoc(page)).items[beaker.id] as SymbolItem
  expect(back.x).toBe(beaker.x)
  expect(back.y).toBe(beaker.y)
  await page.keyboard.press('Control+z')
  expect((await getDoc(page)).order).toEqual([])
})

test('resize-keeps-line-width', async ({ page }) => {
  await page.goto(FILE)
  const beaker = await addFromLibrary(page, 'Beaker')
  const handle = (await page.locator('[data-handle="se"]').boundingBox())!
  await drag(page, { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, 60, 40)
  const after = (await getDoc(page)).items[beaker.id] as SymbolItem
  expect(after.w).toBeCloseTo(beaker.w + 60, 0)
  expect(after.h).toBeCloseTo(beaker.h + 40, 0)
  const svg = await getSvg(page)
  const widths = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]))
  expect(widths).toContain(2)
  for (const w of widths) expect([2, 3, 1.25, 4.5]).toContain(w)
})

test('rotate-and-flip', async ({ page }) => {
  await page.goto(FILE)
  const burette = await addFromLibrary(page, 'Burette')
  await page.getByLabel('Scale numbers').check()
  const box = await itemBox(page, burette.id)
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const handle = (await page.locator('[data-handle="rotate"]').boundingBox())!
  // Drag the rotate handle to the right of the centre: 90°, snapped.
  await drag(
    page,
    { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
    centre.x + 150 - handle.x - handle.width / 2,
    centre.y + 3 - handle.y - handle.height / 2,
  )
  await page.getByRole('button', { name: 'Flip' }).click()
  const it = (await getDoc(page)).items[burette.id] as SymbolItem
  expect(it.rot).toBe(90)
  expect(it.flip).toBe(true)
  // The scale numbers are not mirrored: the screen transform of each text keeps a positive determinant.
  const dets = await page.evaluate(
    (id) =>
      [...document.querySelectorAll(`#stage [data-id="${id}"] text`)].map((t) => {
        const m = (t as SVGTextElement).getScreenCTM()!
        return m.a * m.d - m.b * m.c
      }),
    burette.id,
  )
  expect(dets.length).toBeGreaterThan(0)
  for (const d of dets) expect(d).toBeGreaterThan(0)
})

test('parameter-change', async ({ page }) => {
  await page.goto(FILE)
  const beaker = await addFromLibrary(page, 'Beaker')
  const before = await getSvg(page)
  await page.getByLabel('Graduations').check()
  const after = await getSvg(page)
  expect((await getDoc(page)).items[beaker.id]).toMatchObject({ params: { graduations: true } })
  const paths = (s: string) => (s.match(/<path /g) ?? []).length
  expect(paths(after)).toBe(paths(before) + 1)
  expect(after).toContain('stroke-width="1.25"')
  expect(before).not.toContain('stroke-width="1.25"')
})

test('autosave-restores', async ({ page }) => {
  await page.goto(FILE)
  const beaker = await addFromLibrary(page, 'Beaker')
  await page.getByRole('radio', { name: 'Letters' }).click()
  await page.locator('.canvas').click({ position: { x: 10, y: 10 } }) // clear the selection: the inspector shows the settings
  // View preferences: stored beside the document, not in it.
  await page.getByLabel('Dot grid', { exact: true }).uncheck()
  await page.getByLabel('Snap', { exact: true }).uncheck()
  await page.waitForTimeout(800)
  // The one autosave slot holds the document and, beside it, the view preferences.
  const slot = async () => {
    const stored = await page.evaluate(() => localStorage.getItem('pracdraw.autosave.v1'))
    expect(stored).not.toBeNull()
    const saved = JSON.parse(stored!) as { doc: Doc; prefs: { snap: boolean; grid: boolean; recent: string[] } }
    expect(saved.doc.order).toEqual([beaker.id])
    expect(saved.doc.settings.labelMode).toBe('letters')
    expect(saved.prefs).toMatchObject({ grid: false, snap: false, recent: ['beaker'] })
  }
  await slot()
  await page.reload()
  const doc = await getDoc(page)
  expect(doc.order).toEqual([beaker.id])
  expect(doc.items[beaker.id]).toMatchObject({ symbol: 'beaker', x: beaker.x, y: beaker.y })
  expect(doc.settings.labelMode).toBe('letters')
  await expect(page.getByLabel('Dot grid', { exact: true })).not.toBeChecked()
  await expect(page.getByLabel('Snap', { exact: true })).not.toBeChecked()
  // The library's Recent section is back, with the beaker in it.
  const library = page.getByRole('complementary', { name: 'Library' })
  const recent = library.locator('section', { has: page.getByRole('heading', { name: 'Recent', exact: true }) })
  await expect(recent.getByRole('button', { name: 'Beaker', exact: true })).toBeVisible()
  await slot()
})

test('insert-template-twice', async ({ page }) => {
  await page.goto(FILE)
  await page.getByRole('tab', { name: 'Templates' }).click()
  const card = page.getByRole('button', { name: 'Insert template: Heating a liquid in a beaker' })
  await card.click()
  const first = await getDoc(page)
  expect(first.title).toBe('Heating a liquid in a beaker')
  const n = first.order.length
  await card.click()
  const doc = await getDoc(page)
  expect(doc.order.length).toBe(2 * n)
  expect(new Set(doc.order).size).toBe(2 * n)
  expect(Object.keys(doc.items).length).toBe(2 * n)
  const second = new Set(doc.order.slice(n))
  for (const id of second) {
    const it = doc.items[id]
    expect(id).toMatch(/^[0-9a-z]{8}$/)
    if (it.type === 'label') {
      expect(it.target && 'item' in it.target).toBe(true)
      if (it.target && 'item' in it.target) {
        expect(second.has(it.target.item)).toBe(true)
        expect(doc.items[it.target.item].type).toBe('symbol')
      }
    }
  }
  expect(doc.order.slice(n).filter((id) => doc.items[id].type === 'label').length).toBe(7)
})

// ---------------------------------------------------------------- phase 3 gate tests: contents

test('fill-and-turn-stays-level', async ({ page }) => {
  await page.goto(FILE)
  const beaker = await addFromLibrary(page, 'Beaker')
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await inspector.getByRole('group', { name: 'Contents', exact: true }).getByRole('button', { name: 'Water', exact: true }).click()
  const rotation = inspector.getByLabel('Rotation', { exact: true })
  await rotation.fill('30')
  await rotation.press('Enter')
  const it = (await getDoc(page)).items[beaker.id] as SymbolItem
  expect(it.rot).toBe(30)
  expect(it.contents).toEqual({ main: [{ kind: 'liquid', amount: 0.5, colour: '#cfe8f7' }] })
  // What the screen draws, in world coordinates (the view's pan and zoom undone): the turn of the glass, the turn of the
  // liquid, and the two ends of each surface line.
  const drawn = await page.evaluate((id) => {
    const view = document.querySelector('#stage > g') as SVGGElement
    const item = document.querySelector(`#stage [data-id="${id}"]`)!
    const worldOf = (el: SVGGraphicsElement) => view.getCTM()!.inverse().multiply(el.getCTM()!)
    const turn = (m: DOMMatrix) => (Math.atan2(m.b, m.a) * 180) / Math.PI
    const liquid = item.querySelector('path[fill="#cfe8f7"]') as SVGPathElement
    const lines = [...liquid.parentElement!.querySelectorAll('path')].filter((p) => p.getAttribute('fill') === 'none' && p.getAttribute('stroke'))
    return {
      glass: turn(worldOf(item.children[2] as SVGGElement)),
      liquid: turn(worldOf(liquid)),
      lines: lines.map((p) => {
        const m = worldOf(p)
        const a = p.getPointAtLength(0).matrixTransform(m),
          b = p.getPointAtLength(p.getTotalLength()).matrixTransform(m)
        return [a.x, a.y, b.x, b.y]
      }),
    }
  }, beaker.id)
  expect(drawn.glass).toBeCloseTo(30, 3)
  expect(drawn.liquid).toBeCloseTo(0, 6)
  // One surface line, horizontal in the world: both ends at the same height.
  expect(drawn.lines).toHaveLength(1)
  const [x0, y0, x1, y1] = drawn.lines[0]
  expect(Math.abs(y1 - y0)).toBeLessThan(0.01)
  // It is at half the height of the turned cavity and runs from wall to wall (the kernel's own sums, done here).
  const W = worldCavity(it)
  const box = bounds(W.flat())
  const level = box.y1 - 0.5 * (box.y1 - box.y0)
  expect(y0).toBeCloseTo(level, 1)
  const span = scan(W, level + 1e-6)
  expect(span).toHaveLength(1)
  expect(Math.min(x0, x1)).toBeCloseTo(span[0][0], 1)
  expect(Math.max(x0, x1)).toBeCloseTo(span[0][1], 1)
  expect(span[0][1] - span[0][0]).toBeGreaterThan(50)
})

test('set-reading-37', async ({ page }) => {
  await page.goto(FILE)
  const cylinder = await addFromLibrary(page, 'Measuring cylinder')
  expect(cylinder.contents).toEqual({})
  expect(geometry(cylinder.symbol, cylinder.w, cylinder.h, cylinder.params).scale).toMatchObject({ v0: 0, v1: 100 }) // capacity 100 cm³
  const field = page.getByRole('complementary', { name: 'Inspector' }).getByLabel('Reading', { exact: true })
  await field.fill('37')
  await field.press('Enter')
  const it = (await getDoc(page)).items[cylinder.id] as SymbolItem
  expect(it.contents.main).toHaveLength(1)
  expect(it.contents.main[0]).toMatchObject({ kind: 'liquid', colour: '#cfe8f7' })
  const amount = it.contents.main.reduce((sum, l) => sum + l.amount, 0)
  const reading = amountToReading(geometry(it.symbol, it.w, it.h, it.params), amount)!
  expect(Math.abs(reading - 37)).toBeLessThanOrEqual(0.05)
  await expect(field).toHaveValue('37')
})

test('drop-into-beaker-comes-to-front', async ({ page }) => {
  await page.goto(FILE)
  const beaker = await addFromLibrary(page, 'Beaker')
  const thermometer = await addFromLibrary(page, 'Thermometer')
  await page.getByRole('complementary', { name: 'Inspector' }).getByRole('button', { name: 'Back', exact: true }).click()
  expect((await getDoc(page)).order).toEqual([thermometer.id, beaker.id])
  // Behind the beaker only its ends show. Grab the stem below the beaker and drag it clear to the right: no change.
  const stem = { x: thermometer.x, y: thermometer.y + thermometer.h / 2 - 25 }
  expect(stem.y).toBeGreaterThan(beaker.y + beaker.h / 2 + 10)
  await drag(page, await onScreen(page, stem), 150, 0)
  let doc = await getDoc(page)
  const clear = doc.items[thermometer.id] as SymbolItem
  expect(clear.x).toBeGreaterThan(beaker.x + beaker.w)
  expect(doc.order).toEqual([thermometer.id, beaker.id])
  // Drag it back by its middle so that its centre lands inside the beaker's cavity.
  const v = await page.evaluate(() => window.__pracdraw.view())
  await drag(page, await onScreen(page, { x: clear.x, y: clear.y }), (beaker.x + 10 - clear.x) * v.zoom, 0)
  doc = await getDoc(page)
  const dropped = doc.items[thermometer.id] as SymbolItem
  expect(dropped.x).toBeCloseTo(beaker.x + 10, 0)
  const inside = scan(worldCavity(doc.items[beaker.id] as SymbolItem), dropped.y).some(([a, b]) => dropped.x > a && dropped.x < b)
  expect(inside).toBe(true)
  expect(doc.order).toEqual([beaker.id, thermometer.id])
})

// ---------------------------------------------------------------- phase 3: the level handle, the slider and the presets

test('contents-controls', async ({ page }) => {
  await page.goto(FILE)
  const beaker = await addFromLibrary(page, 'Beaker')
  const contents = page.getByRole('complementary', { name: 'Inspector' }).getByRole('group', { name: 'Contents', exact: true })
  await contents.getByRole('button', { name: 'Water', exact: true }).click()
  const layers = async () => ((await getDoc(page)).items[beaker.id] as SymbolItem).contents.main
  // The level handle: a drag of 8 pointer moves is one undo step. The cavity is 118.5 u high.
  const zoom = (await page.evaluate(() => window.__pracdraw.view())).zoom
  const bar = (await page.locator('[data-handle="level"]').boundingBox())!
  await drag(page, { x: bar.x + 4, y: bar.y + bar.height / 2 }, 0, -30)
  expect((await layers())[0].amount).toBeCloseTo(0.5 + 30 / zoom / 118.5, 3)
  await page.keyboard.press('Control+z')
  expect((await layers())[0].amount).toBe(0.5)
  // The amount slider: one drag is one undo step too.
  const slider = (await contents.getByRole('slider', { name: 'Amount' }).boundingBox())!
  await drag(page, { x: slider.x + slider.width / 2, y: slider.y + slider.height / 2 }, slider.width * 0.3, 0)
  expect((await layers())[0].amount).toBeGreaterThan(0.7)
  await contents.getByRole('heading', { name: 'Contents' }).click() // the focus leaves the slider, so that the key undoes
  await page.keyboard.press('Control+z')
  expect((await layers())[0].amount).toBe(0.5)
  // A preset sets the kind, the colour and the cloudy flag.
  await contents.getByRole('button', { name: 'Colour: Water' }).click()
  await contents.getByRole('button', { name: 'Cloudy yellow (sulfur)' }).click()
  expect(await layers()).toEqual([{ kind: 'liquid', amount: 0.5, colour: '#f1e9b0', cloudy: true }])
  await contents.getByRole('button', { name: 'Empty', exact: true }).click()
  expect(await layers()).toBeUndefined()
  await expect(page.locator('[data-handle="level"]')).toHaveCount(0)
})

// ---------------------------------------------------------------- phase 4 gate tests: connectors

/** One path of the SVG export. */
interface SvgPath {
  d: string
  fill: string | null
  stroke: string | null
  sw: string | null
  dash: string | null
}

/** The paths of each item in the SVG export, in draw order. The export has no ids: each item is one group. */
const svgItems = (page: Page): Promise<SvgPath[][]> =>
  page.evaluate(() => {
    const svg = new DOMParser().parseFromString(window.__pracdraw.svg(), 'image/svg+xml')
    const top = svg.documentElement.querySelector(':scope > g')!
    return [...top.children].map((g) =>
      [...g.querySelectorAll('path')].map((p) => ({
        d: p.getAttribute('d')!,
        fill: p.getAttribute('fill'),
        stroke: p.getAttribute('stroke'),
        sw: p.getAttribute('stroke-width'),
        dash: p.getAttribute('stroke-dasharray'),
      })),
    )
  })

/** The points of a path made of M and L commands (and Z). */
function pathPoints(d: string): Pt[] {
  const n = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number)
  const out: Pt[] = []
  for (let i = 0; i + 1 < n.length; i += 2) out.push({ x: n[i], y: n[i + 1] })
  return out
}

const near = (a: Pt, b: Pt, within = 0.02) => Math.hypot(a.x - b.x, a.y - b.y) <= within
const xy = (c: ConnectorItem) => c.points.map((p) => [p.x, p.y])
const pressed = (page: Page, tool: string) =>
  expect(page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: tool, exact: true })).toHaveAttribute('aria-pressed', 'true')

async function centreOf(l: Locator): Promise<Pt> {
  const b = (await l.boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/** Open the app and wait until it listens: the keys and the test hook are set up just after the first render. */
async function open(page: Page) {
  await page.goto(FILE)
  await page.waitForFunction(() => !!window.__pracdraw)
}

async function clickAt(page: Page, p: Pt) {
  const s = await onScreen(page, p)
  await page.mouse.click(s.x, s.y)
}

async function dblclickOn(page: Page, l: Locator) {
  const c = await centreOf(l)
  await page.mouse.dblclick(c.x, c.y)
}

test('draw-tube-four-points', async ({ page }) => {
  await open(page)
  await page.keyboard.press('u')
  await pressed(page, 'Tube')
  // Four clicks, each a few px off level or upright: within the 5° of the snap.
  for (const p of [P(100, 150), P(104, 350), P(300, 346), P(306, 520)]) await clickAt(page, p)
  await page.keyboard.press('Enter')
  const doc = await getDoc(page)
  expect(doc.order).toHaveLength(1)
  const tube = doc.items[doc.order[0]] as ConnectorItem
  expect(tube).toMatchObject({ type: 'connector', kind: 'glassTube', width: 7, startCap: 'none', endCap: 'none' })
  expect(tube.points).toHaveLength(4)
  // Every segment snapped: exactly level or exactly upright. The two bends have the glass tube's 12 u radius.
  for (let i = 1; i < 4; i++) {
    const a = tube.points[i - 1],
      b = tube.points[i]
    expect(a.x === b.x || a.y === b.y).toBe(true)
  }
  expect(xy(tube)).toEqual([
    [100, 150],
    [100, 350],
    [300, 350],
    [300, 520],
  ])
  expect(tube.points.map((p) => p.r)).toEqual([undefined, 12, 12, undefined])
  // The tool is back to Select, and the new tube is the selection.
  await pressed(page, 'Select')
  await expect(page.locator('[data-handle="point"]')).toHaveCount(4)
  // The SVG: the tube's white body, a closed shape, then its two wall lines. Each wall runs the whole tube, 3.5 u
  // beside the centre line: from beside the first point to beside the last.
  const items = await svgItems(page)
  expect(items).toHaveLength(1)
  expect(items[0]).toHaveLength(2)
  const [body, walls] = items[0]
  expect(body).toMatchObject({ fill: '#ffffff', stroke: null })
  expect(body.d.endsWith('Z')).toBe(true)
  expect(walls).toMatchObject({ fill: 'none', stroke: '#111111', sw: '2' })
  const lines = walls.d
    .split('M')
    .filter(Boolean)
    .map((s) => pathPoints(s))
  expect(lines).toHaveLength(2)
  const starts = lines.map((l) => l[0]),
    ends = lines.map((l) => l[l.length - 1])
  expect(starts.map((p) => p.x).sort((a, b) => a - b)).toEqual([96.5, 103.5])
  expect(starts.map((p) => p.y)).toEqual([150, 150])
  expect(ends.map((p) => p.x).sort((a, b) => a - b)).toEqual([296.5, 303.5])
  expect(ends.map((p) => p.y)).toEqual([520, 520])
})

test('edit-connector-point', async ({ page }) => {
  await open(page)
  // A wire: across 200, then down 150.
  const b = new DocBuilder('Wire')
  b.connector('wire', [P(100, 100), P(300, 100), P(300, 250)])
  await page.evaluate((d) => window.__pracdraw.load(d), b.doc)
  const points = async () => xy((await getDoc(page)).items.wire1 as ConnectorItem)
  // Select it by clicking its line.
  await clickAt(page, P(150, 100))
  const handle = (kind: 'point' | 'mid', i: number) => page.locator(`[data-handle="${kind}"][data-index="${i}"]`)
  await expect(page.locator('[data-handle="point"]')).toHaveCount(3)
  await expect(page.locator('[data-handle="mid"]')).toHaveCount(2)
  const zoom = (await page.evaluate(() => window.__pracdraw.view())).zoom
  // Drag the last square handle 60 right and 40 down: the point moves there.
  await drag(page, await centreOf(handle('point', 2)), 60 * zoom, 40 * zoom)
  expect(await points()).toEqual([
    [100, 100],
    [300, 100],
    [360, 290],
  ])
  // Drag the round handle of the first segment 50 up: a point is inserted there.
  await drag(page, await centreOf(handle('mid', 0)), 0, -50 * zoom)
  expect(await points()).toEqual([
    [100, 100],
    [200, 50],
    [300, 100],
    [360, 290],
  ])
  // Double-click the new point: it is deleted.
  await dblclickOn(page, handle('point', 1))
  expect(await points()).toEqual([
    [100, 100],
    [300, 100],
    [360, 290],
  ])
  // Each edit is one undo step.
  await page.keyboard.press('Control+z')
  expect(await points()).toHaveLength(4)
  await page.keyboard.press('Control+z')
  expect(await points()).toEqual([
    [100, 100],
    [300, 100],
    [360, 290],
  ])
  await page.keyboard.press('Control+z')
  expect(await points()).toEqual([
    [100, 100],
    [300, 100],
    [300, 250],
  ])
  // Two points always remain.
  await page.keyboard.press('Control+y')
  await dblclickOn(page, handle('point', 1))
  await dblclickOn(page, handle('point', 1))
  expect(await points()).toEqual([
    [100, 100],
    [360, 290],
  ])

  // A dragged point snaps (section 10): its segment to level or upright within 5°, and the point to a port, terminal
  // or tip within 8 screen px. A wire from (100, 200) to (300, 200), and a bung whose hole is a port at (420, 200).
  const c = new DocBuilder('Wire and bung')
  c.connector('wire', [P(100, 200), P(300, 200)])
  const bung = c.symbol('bung', { x: 420, y: 212 })
  const port = anchorWorld(bung, 'hole1')
  expect(anchorOf(bung, 'hole1').kind).toBe('port')
  expect(port).toEqual(P(420, 200))
  await page.evaluate((d) => window.__pracdraw.load(d), c.doc)
  await clickAt(page, P(200, 200))
  /** Drag the end point so that the pointer lands `px` screen px from the world point `to`. */
  const dragEnd = async (to: Pt, px: Pt = P(0, 0)) => {
    const from = await centreOf(handle('point', 1))
    const target = await onScreen(page, to)
    await drag(page, from, target.x + px.x - from.x, target.y + px.y - from.y)
  }
  // 3.2° off upright: the segment is exactly upright. 6.3° off: it is left as it is.
  await dragEnd(P(110, 380))
  expect(await points()).toEqual([
    [100, 200],
    [100, 380],
  ])
  await dragEnd(P(120, 380))
  expect(await points()).toEqual([
    [100, 200],
    [120, 380],
  ])
  // Within 8 screen px of the port (5 px right and 3 px up): the point is exactly on the port.
  await dragEnd(port, P(5, -3))
  expect(await points()).toEqual([
    [100, 200],
    [420, 200],
  ])
  // 12 screen px from the port: no snap to it. (The segment is level, so the 5° snap keeps it level.)
  await dragEnd(port, P(12, 0))
  expect(await points()).toEqual([
    [100, 200],
    [Math.round(420 + 12 / zoom), 200],
  ])

  // A terminal and a tip catch a point the same way: a wire from (100, 120), a cell whose terminal `a` is at (370, 300),
  // and a burette whose tip is at (250, 565). No segment below is within 5° of level or upright.
  const e = new DocBuilder('Wire, cell and burette')
  e.connector('wire', [P(100, 120), P(200, 120)])
  const cell = e.symbol('cCell', { x: 400, y: 300 })
  const burette = e.at('burette', 'tip', P(250, 565))
  const terminal = anchorWorld(cell, 'a'),
    tip = anchorWorld(burette, 'tip')
  expect(anchorOf(cell, 'a').kind).toBe('terminal')
  expect(anchorOf(burette, 'tip').kind).toBe('tip')
  expect(terminal).toEqual(P(370, 300))
  expect(tip).toEqual(P(250, 565))
  await page.evaluate((d) => window.__pracdraw.load(d), e.doc)
  await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
  await clickAt(page, P(150, 120))
  await expect(page.locator('[data-handle="point"]')).toHaveCount(2)
  const end = async () => (await points())[1]
  // Within 8 screen px (5 right and 4 up, then 4 left and 5 down): exactly on the terminal, then on the tip.
  await dragEnd(terminal, P(5, -4))
  expect(await end()).toEqual([370, 300])
  await dragEnd(tip, P(-4, 5))
  expect(await end()).toEqual([250, 565])
  await dragEnd(terminal, P(-3, 3))
  expect(await end()).toEqual([370, 300])
  // At 200 % zoom the 8 screen px are 4 u: caught at 6 screen px (3 u), not at 10 screen px (5 u), though 5 u would be
  // caught at 100 %. So the reach is in screen px.
  await page.evaluate(() => window.__pracdraw.view({ x: 270 - 2 * 370, y: 400 - 2 * 300, zoom: 2 }))
  await dragEnd(terminal, P(6, 0))
  expect(await end()).toEqual([370, 300])
  await dragEnd(terminal, P(10, 0))
  expect(await end()).toEqual([375, 300])
})

test('arrow-and-dimension-caps', async ({ page }) => {
  await open(page)
  const library = page.getByRole('complementary', { name: 'Library' })
  await library.getByRole('button', { name: 'Arrow', exact: true }).click()
  await library.getByRole('button', { name: 'Dimension line', exact: true }).click()
  let doc = await getDoc(page)
  const [arrow, dim] = doc.order.map((id) => doc.items[id] as ConnectorItem)
  expect(arrow).toMatchObject({ type: 'connector', kind: 'line', startCap: 'none', endCap: 'arrow' })
  expect(dim).toMatchObject({ type: 'connector', kind: 'line', startCap: 'tick', endCap: 'tick' })
  const [a0, a1] = arrow.points,
    [d0, d1] = dim.points
  expect(Math.hypot(a1.x - a0.x, a1.y - a0.y)).toBe(80)
  expect(Math.hypot(d1.x - d0.x, d1.y - d0.y)).toBe(120)
  /** A filled arrow head: its tip on `tip`, its two other corners behind it, towards `from`. */
  const isHead = (p: SvgPath, tip: Pt, from: Pt) => {
    const [c1, t, c2] = pathPoints(p.d)
    const behind = (c: Pt) => (c.x - t.x) * (from.x - tip.x) + (c.y - t.y) * (from.y - tip.y) > 0
    return p.fill === '#111111' && !p.stroke && near(t, tip) && behind(c1) && behind(c2)
  }
  /** A tick: a short stroke across the line, centred on `end`. */
  const isTick = (p: SvgPath, end: Pt, from: Pt) => {
    const [s, e] = pathPoints(p.d)
    const across = Math.abs((e.x - s.x) * (from.x - end.x) + (e.y - s.y) * (from.y - end.y)) < 0.01
    return !!p.stroke && p.fill === 'none' && near({ x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 }, end) && across && Math.hypot(e.x - s.x, e.y - s.y) > 6
  }
  // The SVG: the arrow is its line and a filled head at its end; the dimension line has a tick across each end.
  let items = await svgItems(page)
  expect(items).toHaveLength(2)
  expect(items[0]).toHaveLength(2)
  const [line, head] = items[0]
  expect(line).toMatchObject({ fill: 'none', stroke: '#111111', sw: '1.25' })
  expect(isHead(head, a1, a0)).toBe(true)
  expect(items[1]).toHaveLength(3)
  expect(isTick(items[1][1], d0, d1)).toBe(true)
  expect(isTick(items[1][2], d1, d0)).toBe(true)
  // Change a cap in the inspector: the dimension line (the selection) gets an arrow head at its start.
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await inspector.getByLabel('Start cap', { exact: true }).selectOption('arrow')
  doc = await getDoc(page)
  expect(doc.items[dim.id]).toMatchObject({ startCap: 'arrow', endCap: 'tick' })
  items = await svgItems(page)
  expect(items[1]).toHaveLength(3)
  expect(isHead(items[1][1], d0, d1)).toBe(true)
  expect(isTick(items[1][2], d1, d0)).toBe(true)
  // Select the arrow and give it a dot instead of its head.
  await clickAt(page, P((a0.x + a1.x) / 2 - 20, a0.y))
  await inspector.getByLabel('End cap', { exact: true }).selectOption('dot')
  expect((await getDoc(page)).items[arrow.id]).toMatchObject({ endCap: 'dot' })
  items = await svgItems(page)
  expect(items[0]).toHaveLength(2)
  expect(items[0][1]).toMatchObject({ fill: '#111111', stroke: null })
  expect(items[0][1].d).toContain('a2.5 2.5')
})

// ---------------------------------------------------------------- phase 4: the tools at work

test('connector-tools', async ({ page }) => {
  await open(page)
  // Wire: a press, drag and release makes a two-point wire in one gesture. It snaps level.
  await page.keyboard.press('w')
  await drag(page, await onScreen(page, P(100, 100)), 200, 4)
  let doc = await getDoc(page)
  const wire = doc.items[doc.order[0]] as ConnectorItem
  expect(wire.kind).toBe('wire')
  expect(xy(wire)).toEqual([
    [100, 100],
    [300, 100],
  ])
  await pressed(page, 'Select')
  // Line and arrow: Backspace takes back the last point; Escape cancels the line and keeps the tool.
  await page.keyboard.press('a')
  await pressed(page, 'Line and arrow')
  await clickAt(page, P(100, 200))
  await clickAt(page, P(200, 260))
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Escape')
  expect((await getDoc(page)).order).toEqual([wire.id])
  await pressed(page, 'Line and arrow')
  // Shift gives 45° steps. A double-click finishes, and places its point once: also here, where the 5° snap puts the
  // point of its first click level, 8 u above the pointer, so that its second click does not land on that point.
  await clickAt(page, P(100, 200))
  await page.keyboard.down('Shift')
  await clickAt(page, P(190, 285))
  await page.keyboard.up('Shift')
  const end = await onScreen(page, P(300, 296))
  await page.mouse.dblclick(end.x, end.y)
  doc = await getDoc(page)
  expect(doc.order).toHaveLength(2)
  const line = doc.items[doc.order[1]] as ConnectorItem
  expect(line.kind).toBe('line')
  expect(xy(line)).toEqual([
    [100, 200],
    [188, 288],
    [300, 288],
  ])
  await pressed(page, 'Select')
  // A connector moves like any item: the arrow keys, a drag, duplicate, delete and the marquee. The drag holds Ctrl, so
  // that it does not snap: the wire's bounds are 1 u from the line's, which a guide would take (section 12).
  await page.keyboard.press('ArrowRight')
  expect(xy((await getDoc(page)).items[line.id] as ConnectorItem)[0]).toEqual([101, 200])
  await page.keyboard.down('Control')
  await drag(page, await onScreen(page, P(200, 100)), 0, 30)
  await page.keyboard.up('Control')
  expect(xy((await getDoc(page)).items[wire.id] as ConnectorItem)).toEqual([
    [100, 130],
    [300, 130],
  ])
  await page.keyboard.press('Control+d')
  doc = await getDoc(page)
  expect(doc.order).toHaveLength(3)
  expect(xy(doc.items[doc.order[2]] as ConnectorItem)).toEqual([
    [120, 150],
    [320, 150],
  ])
  await page.keyboard.press('Delete')
  expect((await getDoc(page)).order).toEqual([wire.id, line.id])
  await drag(page, await onScreen(page, P(80, 180)), 250, 130)
  await expect(page.locator('[data-handle="point"]')).toHaveCount(3)
})

test('shape-tools', async ({ page }) => {
  await open(page)
  // Rectangle: a drag draws it, with no fill and no dash, and it becomes the selection.
  await page.keyboard.press('r')
  await drag(page, await onScreen(page, P(100, 100)), 120, 60)
  let doc = await getDoc(page)
  const rect = doc.items[doc.order[0]] as ShapeItem
  expect(rect).toMatchObject({ type: 'shape', shape: 'rect', x: 160, y: 130, w: 120, h: 60, rot: 0, fill: 'none', dash: false })
  await pressed(page, 'Select')
  // It has the handles of a free symbol: eight to resize and one to rotate.
  for (const h of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw', 'rotate']) await expect(page.locator(`[data-handle="${h}"]`)).toHaveCount(1)
  const zoom = (await page.evaluate(() => window.__pracdraw.view())).zoom
  await drag(page, await centreOf(page.locator('[data-handle="se"]')), 40 * zoom, 20 * zoom)
  expect((await getDoc(page)).items[rect.id]).toMatchObject({ x: 180, y: 140, w: 160, h: 80 })
  // The inspector: fill and dash.
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await inspector.getByLabel('Fill', { exact: true }).selectOption('grey')
  await inspector.getByLabel('Dashed', { exact: true }).check()
  expect((await getDoc(page)).items[rect.id]).toMatchObject({ fill: 'grey', dash: true })
  expect((await svgItems(page))[0][0]).toMatchObject({ fill: '#c9c9c9', stroke: '#111111', sw: '2', dash: '6 4' })
  // Ellipse with Shift: a circle. Each shape is one undo step. (The focus is in the inspector, where keys do nothing:
  // the tool comes from its button.)
  await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Ellipse', exact: true }).click()
  await pressed(page, 'Ellipse')
  await page.keyboard.down('Shift')
  await drag(page, await onScreen(page, P(300, 300)), 80, 50)
  await page.keyboard.up('Shift')
  doc = await getDoc(page)
  expect(doc.items[doc.order[1]]).toMatchObject({ shape: 'ellipse', w: 80, h: 80 })
  await page.keyboard.press('Control+z')
  expect((await getDoc(page)).order).toEqual([rect.id])
  // A click with a shape tool draws nothing, and the tool stays.
  await page.keyboard.press('e')
  await clickAt(page, P(400, 400))
  expect((await getDoc(page)).order).toEqual([rect.id])
  await pressed(page, 'Ellipse')
})

// ---------------------------------------------------------------- phase 5 gate tests: snapping

/** Drag an item, grabbed at the world point `grab`, so that its world point `from` goes to the world point `to`. */
async function dragTo(page: Page, grab: Pt, from: Pt, to: Pt) {
  const zoom = (await page.evaluate(() => window.__pracdraw.view())).zoom
  await drag(page, await onScreen(page, grab), (to.x - from.x) * zoom, (to.y - from.y) * zoom)
}

function expectNear(a: Pt, b: Pt, digits = 6) {
  expect(a.x).toBeCloseTo(b.x, digits)
  expect(a.y).toBeCloseTo(b.y, digits)
}

/** A point on the bung's rubber, beside its hole, in its local frame: something to grab it by. */
const RUBBER = P(-12, 6)

test('bung-snaps-and-fits', async ({ page }) => {
  await open(page)
  const flask = await addFromLibrary(page, 'Conical flask')
  const bung = await addFromLibrary(page, 'Bung')
  // The flask's mouth is 34 u wide inside; the bung's plug is 34.8 u wide. They differ, so the bung must change.
  expect(anchorOf(flask, 'mouth').width).toBe(34)
  expect(anchorOf(bung, 'plug').width).toBe(34.8)
  const mouth = anchorWorld(flask, 'mouth'),
    plug = anchorWorld(bung, 'plug')
  // Drag the bung until its plug is 3 u right of the mouth and 2 u above it.
  await dragTo(page, toWorld(bung, RUBBER), plug, P(mouth.x + 3, mouth.y - 2))
  let it = (await getDoc(page)).items[bung.id] as SymbolItem
  // The plug anchor lands on the mouth. The bung is the mouth width + 3.2 wide, so that its plug is as wide as the mouth.
  expectNear(anchorWorld(it, 'plug'), mouth)
  expect(it.w).toBeCloseTo(34 + 3.2, 6)
  expect(it.h).toBe(bung.h)
  expect(anchorOf(it, 'plug').width).toBeCloseTo(34, 6)
  // The move and the new width are one undo step.
  await page.keyboard.press('Control+z')
  expect((await getDoc(page)).items[bung.id]).toMatchObject({ x: bung.x, y: bung.y, w: bung.w })
  // A narrower mouth: a test tube's is 24 u.
  const tube = await addFromLibrary(page, 'Test tube')
  expect(anchorOf(tube, 'mouth').width).toBe(24)
  const tubeMouth = anchorWorld(tube, 'mouth')
  await dragTo(page, toWorld(bung, RUBBER), plug, P(tubeMouth.x - 2, tubeMouth.y + 3))
  it = (await getDoc(page)).items[bung.id] as SymbolItem
  expectNear(anchorWorld(it, 'plug'), tubeMouth)
  expect(it.w).toBeCloseTo(24 + 3.2, 6)
  expect(anchorOf(it, 'plug').width).toBeCloseTo(24, 6)
})

test('beaker-stands-on-gauze', async ({ page }) => {
  await open(page)
  const gauze = await addFromLibrary(page, 'Gauze')
  const beaker = await addFromLibrary(page, 'Beaker')
  const top = anchorWorld(gauze, 'top')
  const zoom = (await page.evaluate(() => window.__pracdraw.view())).zoom
  // Drag the beaker by its middle until its base is 3 px above the gauze, 30 u right of the gauze's centre.
  await dragTo(page, P(beaker.x, beaker.y), anchorWorld(beaker, 'base'), P(top.x + 30, top.y - 3 / zoom))
  let it = (await getDoc(page)).items[beaker.id] as SymbolItem
  // The base sits exactly on the gauze's surface. Sideways it stays where it was put: 30 u is more than 8 px.
  let base = anchorWorld(it, 'base')
  expect(base.y).toBeCloseTo(top.y, 9)
  expect(base.x).toBeCloseTo(top.x + 30, 0)
  // As drawn on the screen: the lowest point of the beaker's outline is on the gauze's surface.
  const lowest = await page.evaluate((id) => {
    const view = document.querySelector('#stage > g') as SVGGElement
    const path = document.querySelector(`#stage [data-id="${id}"] path[stroke]`) as SVGPathElement
    const m = view.getCTM()!.inverse().multiply(path.getCTM()!)
    const n = path.getTotalLength()
    let y = -Infinity
    for (let i = 0; i <= 400; i++) y = Math.max(y, path.getPointAtLength((n * i) / 400).matrixTransform(m).y)
    return y
  }, beaker.id)
  expect(lowest).toBeCloseTo(top.y, 1)
  // Within 8 px of the centre, the base also goes to the centre of the surface.
  await dragTo(page, P(it.x, it.y), base, P(top.x + 4, top.y - 2))
  it = (await getDoc(page)).items[beaker.id] as SymbolItem
  base = anchorWorld(it, 'base')
  expectNear(base, top, 9)
})

test('clamp-on-rod', async ({ page }) => {
  await open(page)
  const stand = await addFromLibrary(page, 'Clamp stand')
  const clamp = await addFromLibrary(page, 'Boss and clamp')
  const rod = anchorWorld(stand, 'rod') // the middle of the rod; its centre line is upright through it
  /** The middle of the clamp's arm, to grab it by. */
  const arm = (it: SymbolItem) => toWorld(it, P(0, it.h / 2))
  // Drag the clamp until its sleeve is 4 u right of the rod, 60 u above the middle of the rod.
  await dragTo(page, arm(clamp), anchorWorld(clamp, 'sleeve'), P(rod.x + 4, rod.y - 60))
  let it = (await getDoc(page)).items[clamp.id] as SymbolItem
  let sleeve = anchorWorld(it, 'sleeve')
  // The sleeve is on the rod's line, at the height it was dragged to.
  expect(sleeve.x).toBeCloseTo(rod.x, 9)
  expect(sleeve.y).toBeCloseTo(rod.y - 60, 0)
  // It is free in height: drag it 100 u down the rod and 3 u to the left of it. It stays on the line, 100 u lower.
  await dragTo(page, arm(it), sleeve, P(rod.x - 3, rod.y + 40))
  it = (await getDoc(page)).items[clamp.id] as SymbolItem
  sleeve = anchorWorld(it, 'sleeve')
  expect(sleeve.x).toBeCloseTo(rod.x, 9)
  expect(sleeve.y).toBeCloseTo(rod.y + 40, 0)
})

// ---------------------------------------------------------------- phase 5: snapping off, guides, several items

test('snap-off-and-guides', async ({ page }) => {
  await open(page)
  const flask = await addFromLibrary(page, 'Conical flask')
  const bung = await addFromLibrary(page, 'Bung')
  const mouth = anchorWorld(flask, 'mouth'),
    plug = anchorWorld(bung, 'plug')
  const near = P(mouth.x + 3, mouth.y - 2)
  // Ctrl held: the drag does not snap. The bung goes where it is dragged and keeps its width.
  await page.keyboard.down('Control')
  await dragTo(page, toWorld(bung, RUBBER), plug, near)
  await page.keyboard.up('Control')
  let it = (await getDoc(page)).items[bung.id] as SymbolItem
  expectNear(anchorWorld(it, 'plug'), near, 0)
  expect(it.w).toBe(bung.w)
  await page.keyboard.press('Control+z')
  // The Snap view preference off: no snap either.
  await page.locator('.canvas').click({ position: { x: 5, y: 5 } })
  await page.getByLabel('Snap', { exact: true }).uncheck()
  await dragTo(page, toWorld(bung, RUBBER), plug, near)
  it = (await getDoc(page)).items[bung.id] as SymbolItem
  expectNear(anchorWorld(it, 'plug'), near, 0)
  expect(it.w).toBe(bung.w)
  await page.locator('.canvas').click({ position: { x: 5, y: 5 } })
  await page.getByLabel('Snap', { exact: true }).check()
  // Guides: a test tube, high above a flask, dragged until the centre of its bounds is 4 u from the centre of the
  // flask's (their edges are far apart) lines up with it, and a guide line shows while the pointer is down.
  const b = new DocBuilder('Guides')
  const f2 = b.symbol('conicalFlask', { x: 200, y: 300 })
  const tube = b.symbol('testTube', { x: 420, y: 100 })
  await page.evaluate((d) => window.__pracdraw.load(d), b.doc)
  const centreX = (box: { x0: number; x1: number }) => (box.x0 + box.x1) / 2
  const flaskX = centreX(boundsOf(b.doc, f2)),
    tubeX = centreX(boundsOf(b.doc, tube))
  const zoom = (await page.evaluate(() => window.__pracdraw.view())).zoom
  const start = await onScreen(page, P(tube.x, tube.y))
  const dx = (flaskX + 4 - tubeX) * zoom
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(start.x + (dx * i) / 8, start.y)
  await expect(page.locator('.overlay .guide-line')).toHaveCount(1)
  await page.mouse.up()
  await expect(page.locator('.overlay .guide-line')).toHaveCount(0)
  const doc = await getDoc(page)
  expect(centreX(boundsOf(doc, doc.items[tube.id]))).toBeCloseTo(flaskX, 6)
  expect((doc.items[tube.id] as SymbolItem).y).toBe(tube.y)
})

test('arrange-several-items', async ({ page }) => {
  await open(page)
  const b = new DocBuilder('Arrange')
  b.symbol('beaker', { x: 100, y: 150 })
  b.symbol('conicalFlask', { x: 250, y: 420 })
  b.symbol('testTube', { x: 440, y: 260 })
  await page.evaluate((d) => window.__pracdraw.load(d), b.doc)
  const ids = b.doc.order
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  const heading = (name: string) => expect(inspector.getByRole('heading', { name, exact: true })).toBeVisible()
  const boxes = (doc: Doc) => ids.map((id) => boundsOf(doc, doc.items[id]))
  await page.keyboard.press('Control+a')
  await heading('3 items')
  // Align the tops of their drawn bounds, then distribute them across with equal gaps.
  await inspector.getByRole('button', { name: 'Align top' }).click()
  let doc = await getDoc(page)
  for (const box of boxes(doc)) expect(box.y0).toBeCloseTo(boxes(doc)[0].y0, 6)
  await inspector.getByRole('button', { name: 'Distribute across' }).click()
  doc = await getDoc(page)
  const [a, c, t] = boxes(doc)
  expect(c.x0 - a.x1).toBeCloseTo(t.x0 - c.x1, 6)
  // Group (Ctrl+G): a click on one of them selects all three.
  await page.keyboard.press('Control+g')
  doc = await getDoc(page)
  const group = doc.items[ids[0]].group
  expect(group).toBeTruthy()
  for (const id of ids) expect(doc.items[id].group).toBe(group)
  const first = doc.items[ids[0]] as SymbolItem
  const at = await onScreen(page, P(first.x, first.y))
  await page.locator('.canvas').click({ position: { x: 5, y: 5 } })
  await heading('Document')
  await page.mouse.click(at.x, at.y)
  await heading('3 items')
  // Lock: a locked item cannot be selected on the canvas. Unlock all is in the document settings.
  await inspector.getByRole('button', { name: 'Lock', exact: true }).click()
  await page.mouse.click(at.x, at.y)
  await heading('Document')
  expect(ids.every((id) => doc.items[id])).toBe(true)
  await inspector.getByRole('button', { name: 'Unlock all' }).click()
  await page.mouse.click(at.x, at.y)
  await heading('3 items')
  // Ungroup (Ctrl+Shift+G): a click selects one item again.
  await page.keyboard.press('Control+Shift+g')
  await page.locator('.canvas').click({ position: { x: 5, y: 5 } })
  await page.mouse.click(at.x, at.y)
  await heading('Beaker')
})

test('keys-work-after-a-checkbox', async ({ page }) => {
  // Keys stop only while a text field has the focus (section 12): a ticked checkbox keeps the focus, and Delete works.
  await open(page)
  await addFromLibrary(page, 'Beaker')
  const graduations = page.getByRole('complementary', { name: 'Inspector' }).getByLabel('Graduations')
  await graduations.check()
  await expect(graduations).toBeFocused()
  await page.keyboard.press('Delete')
  expect((await getDoc(page)).order).toEqual([])
})

// ---------------------------------------------------------------- phase 6 gate tests: labels

/** The SVG export, item by item in draw order: each item's path data and texts. Labels are the last items. */
const svgDrawing = (page: Page): Promise<{ d: string[]; texts: string[] }[]> =>
  page.evaluate(() => {
    const svg = new DOMParser().parseFromString(window.__pracdraw.svg(), 'image/svg+xml')
    const top = svg.documentElement.querySelector(':scope > g')!
    return [...top.children].map((g) => ({
      d: [...g.querySelectorAll('path')].map((p) => p.getAttribute('d')!),
      texts: [...g.querySelectorAll('text')].map((t) => t.textContent ?? ''),
    }))
  })

/** The leader of each of the last `n` items of the SVG export (labels), as drawn: its first path, in world units. */
async function svgLeaders(page: Page, n: number): Promise<Pt[][]> {
  const items = await svgDrawing(page)
  return items.slice(-n).map((it) => pathPoints(it.d[0] ?? ''))
}

/** True when two segments cross at a point inside both. The test's own sums, not the app's. */
function crosses([a, b]: Pt[], [c, d]: Pt[]): boolean {
  const side = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0
}

/** The lines of a label as text mode draws them: smart text applied and the markup gone. */
const shownLines = (l: LabelItem) =>
  l.text.split('\n').map((line) =>
    parseMarkup(smartChem(line))
      .map((r) => r.text)
      .join(''),
  )

const labelsOf = (doc: Doc) => doc.order.map((id) => doc.items[id]).filter((it): it is LabelItem => it.type === 'label')

/** Label all: in the top bar, or in its More menu when the window is narrower than 1300 px. */
async function labelAll(page: Page) {
  const more = page.getByRole('button', { name: 'More' })
  if (await more.isVisible()) await more.click()
  await page.getByRole('button', { name: 'Label all' }).click()
}

test('label-follows-item', async ({ page }) => {
  await open(page)
  const beaker = await addFromLibrary(page, 'Beaker')
  // The Label tool: press on the beaker's right-hand wall, where the leader must end; drag to where the text goes.
  const g = geometry(beaker.symbol, beaker.w, beaker.h, beaker.params)
  const wall = labelPoint(g, beaker.w, beaker.h, 'right')
  await page.keyboard.press('l')
  await pressed(page, 'Label')
  await drag(page, await onScreen(page, toWorld(beaker, wall)), 160, -30)
  // The text box opens at the release point. It holds the beaker's label text, selected.
  const box = page.getByRole('textbox', { name: 'Label text' })
  await expect(box).toBeFocused()
  await expect(box).toHaveValue('beaker')
  expect(await box.evaluate((t: HTMLTextAreaElement) => [t.selectionStart, t.selectionEnd])).toEqual([0, 6])
  await page.keyboard.press('Enter')
  await pressed(page, 'Select')
  let doc = await getDoc(page)
  expect(doc.order).toHaveLength(2)
  const label = doc.items[doc.order[1]] as LabelItem
  expect(label).toMatchObject({ type: 'label', text: 'beaker', side: 'right', leaderEnd: 'none', target: { item: beaker.id } })
  const fixed = label.target as { item: string; lx: number; ly: number }
  expect(fixed.lx).toBeCloseTo(wall.x, 0)
  expect(fixed.ly).toBeCloseTo(wall.y, 0)
  /** The end of the label's leader as the SVG export draws it. The label is the last item drawn. */
  const leaderEnd = async (): Promise<Pt> => (await svgLeaders(page, 1))[0][1]
  const before = await leaderEnd()
  expectNear(before, toWorld(beaker, P(fixed.lx, fixed.ly)), 1)
  // Drag the beaker by its middle: the leader end moves with it, by the same amount. The label itself is unchanged.
  await drag(page, await onScreen(page, P(beaker.x - 20, beaker.y + 30)), 90, 60)
  doc = await getDoc(page)
  const moved = doc.items[beaker.id] as SymbolItem
  expect(moved.x - beaker.x).toBeGreaterThan(40)
  expect(moved.y - beaker.y).toBeGreaterThan(25)
  expect(doc.items[label.id]).toEqual(label)
  const after = await leaderEnd()
  expect(after.x - before.x).toBeCloseTo(moved.x - beaker.x, 1)
  expect(after.y - before.y).toBeCloseTo(moved.y - beaker.y, 1)
  // Resize the beaker with a corner handle: the target scales with the box, so it stays on the wall.
  await drag(page, await centreOf(page.locator('[data-handle="se"]')), 60, 40)
  doc = await getDoc(page)
  const resized = doc.items[beaker.id] as SymbolItem
  expect(resized.w).toBeGreaterThan(moved.w + 30)
  expect(resized.h).toBeGreaterThan(moved.h + 20)
  const scaled = (doc.items[label.id] as LabelItem).target as { item: string; lx: number; ly: number }
  expect(scaled.item).toBe(beaker.id)
  expect(scaled.lx).toBeCloseTo((fixed.lx * resized.w) / moved.w, 6)
  expect(scaled.ly).toBeCloseTo((fixed.ly * resized.h) / moved.h, 6)
  expectNear(await leaderEnd(), toWorld(resized, P(scaled.lx, scaled.ly)), 1)
  const wall2 = labelPoint(geometry(resized.symbol, resized.w, resized.h, resized.params), resized.w, resized.h, 'right')
  expect(scaled.lx).toBeCloseTo(wall2.x, 0)
  expect(scaled.ly).toBeCloseTo(wall2.y, 0)
})

test('blank-mode-has-no-label-text', async ({ page }) => {
  await open(page)
  await loadDemo(page)
  const labels = labelsOf(await getDoc(page))
  const leaders = labels.filter((l) => l.target),
    plain = labels.filter((l) => !l.target)
  expect(leaders.length).toBeGreaterThan(10)
  expect(plain.length).toBe(2)
  // Text mode: the SVG holds every label's text.
  let items = await svgDrawing(page)
  let texts = items.flatMap((it) => it.texts)
  for (const l of labels) for (const line of shownLines(l)) expect(texts).toContain(line)
  // One click on the label-mode switch: blank.
  await page.getByRole('radio', { name: 'Blank' }).click()
  expect((await getDoc(page)).settings.labelMode).toBe('blank')
  items = await svgDrawing(page)
  texts = items.flatMap((it) => it.texts)
  // None of the texts of the labels with a leader is in the SVG, as drawn or as typed...
  const svg = drawing(await getSvg(page))
  for (const l of leaders) {
    for (const line of shownLines(l)) expect(texts).not.toContain(line)
    for (const line of l.text.split('\n')) expect(svg).not.toContain(`>${line}<`)
  }
  // ...but plain text stays.
  for (const l of plain) for (const line of shownLines(l)) expect(texts).toContain(line)
  // A 100 u line to write on for each label with a leader: level, from its text anchor, away from its target. The
  // labels are the last items drawn; only they are searched.
  const rules = items
    .slice(-labels.length)
    .flatMap((it) => it.d.map(pathPoints))
    .filter((p) => p.length === 2 && p[0].y === p[1].y && Math.abs(Math.abs(p[1].x - p[0].x) - 100) < 1e-6)
  expect(rules).toHaveLength(leaders.length)
  for (const l of leaders) {
    const end = P(l.side === 'left' ? l.x - 100 : l.x + 100, l.y)
    expect(rules.some(([a, b]) => near(a, P(l.x, l.y)) && near(b, end))).toBe(true)
  }
})

test('label-all-no-crossing', async ({ page }) => {
  await open(page)
  // demoDoc with its labels deleted.
  const demo = demoDoc()
  const bare = deleteItems(
    demo,
    demo.order.filter((id) => demo.items[id].type === 'label'),
  )
  await page.evaluate((d) => window.__pracdraw.load(d), bare)
  await labelAll(page)
  const doc = await getDoc(page)
  const fresh = doc.order.slice(bare.order.length).map((id) => doc.items[id] as LabelItem)
  // A label for every symbol, fixed to it, with its label text.
  const parts = symbols(bare)
  expect(fresh).toHaveLength(parts.length)
  const owners = fresh.map((l) => (l.target && 'item' in l.target ? l.target.item : ''))
  expect(new Set(owners)).toEqual(new Set(parts.map((s) => s.id)))
  for (const [i, l] of fresh.entries()) {
    const owner = bare.items[owners[i]] as SymbolItem
    expect(l.text).toBe(labelText(symbolDef(owner.symbol), owner.params))
  }
  // No two leader lines cross, as the SVG export draws them (the labels are the last items drawn).
  const leaders = await svgLeaders(page, fresh.length)
  for (const [i, l] of fresh.entries()) {
    expect(leaders[i]).toHaveLength(2)
    expectNear(leaders[i][0], P(l.x + (l.side === 'left' ? 5 : -5), l.y - 0.33 * doc.settings.labelSize), 1)
  }
  for (let i = 0; i < leaders.length; i++)
    for (let j = i + 1; j < leaders.length; j++) expect(crosses(leaders[i], leaders[j]), `${fresh[i].text} and ${fresh[j].text}`).toBe(false)
  // On each side, no two text anchors are closer than 1.4 × the label size.
  const gap = 1.4 * doc.settings.labelSize
  for (const side of ['left', 'right'] as const) {
    const column = fresh.filter((l) => l.side === side)
    expect(column.length).toBeGreaterThan(3)
    for (let i = 0; i < column.length; i++) for (let j = i + 1; j < column.length; j++) expect(dist(column[i], column[j])).toBeGreaterThanOrEqual(gap - 1e-6)
  }
  // Label all is one undo step.
  await page.keyboard.press('Control+z')
  expect((await getDoc(page)).order).toEqual(bare.order)
})

// ---------------------------------------------------------------- phase 6: the tools, editing, the inspector

test('label-and-text-tools', async ({ page }) => {
  await open(page)
  const b = new DocBuilder('Tools')
  const flask = b.symbol('conicalFlask', { x: 300, y: 300 })
  await page.evaluate((d) => window.__pracdraw.load(d), b.doc)
  await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
  const g = geometry(flask.symbol, flask.w, flask.h, flask.params)
  const side = toWorld(flask, labelPoint(g, flask.w, flask.h, 'left'))
  const box = page.getByRole('textbox', { name: 'Label text' })
  // Keys do nothing while the box has the focus: they type. Escape drops a new label, and the tool returns to Select.
  await page.keyboard.press('l')
  await drag(page, await onScreen(page, side), -150, 20)
  await expect(box).toHaveValue('conical flask')
  await page.keyboard.press('v')
  await page.keyboard.press('Delete')
  await expect(box).toHaveValue('v')
  await pressed(page, 'Label')
  await page.keyboard.press('Escape')
  await expect(box).toHaveCount(0)
  expect((await getDoc(page)).order).toEqual([flask.id])
  await pressed(page, 'Select')
  // Released left of the press: the text is on the left of its target, and ends at the release point.
  await page.keyboard.press('l')
  await drag(page, await onScreen(page, side), -150, 20)
  await page.keyboard.press('Enter')
  let doc = await getDoc(page)
  const left = doc.items[doc.order[1]] as LabelItem
  expect(left).toMatchObject({ text: 'conical flask', side: 'left', x: Math.round(side.x - 150), y: Math.round(side.y + 20), target: { item: flask.id } })
  // As drawn, the text ends at the text anchor.
  const textBox = (await page.locator(`#stage [data-id="${left.id}"] text`).boundingBox())!
  const anchor = await onScreen(page, P(left.x, left.y))
  expect(Math.abs(textBox.x + textBox.width - anchor.x)).toBeLessThan(3)
  // A drag from empty canvas: a free leader end on whole units, and an empty box.
  await page.keyboard.press('l')
  await drag(page, await onScreen(page, P(420, 150)), 60, 0)
  await expect(box).toHaveValue('')
  await page.keyboard.type('H2SO4')
  await page.keyboard.press('Enter')
  doc = await getDoc(page)
  expect(doc.items[doc.order[2]]).toMatchObject({ text: 'H2SO4', side: 'right', x: 480, y: 150, target: { x: 420, y: 150 } })
  // Smart text draws it as H₂SO₄; the stored text stays as typed.
  const drawn = await svgDrawing(page)
  expect(drawn[drawn.length - 1].texts).toEqual(['H2SO4'])
  expect(drawing(await getSvg(page))).toMatch(/<tspan[^>]*font-size="10.5"[^>]*>2<\/tspan>/)
  // The Text tool: a click makes plain text. Shift+Enter starts a new line.
  await page.keyboard.press('t')
  await pressed(page, 'Text')
  await clickAt(page, P(60, 520))
  const plain = page.getByRole('textbox', { name: 'Plain text' })
  await expect(plain).toBeFocused()
  await page.keyboard.type('Method')
  await page.keyboard.press('Shift+Enter')
  await page.keyboard.type('step 1')
  await page.keyboard.press('Enter')
  doc = await getDoc(page)
  const note = doc.items[doc.order[3]] as LabelItem
  expect(note).toMatchObject({ type: 'label', text: 'Method\nstep 1', x: 60, y: 520, side: 'right' })
  expect(note.target).toBeUndefined()
  await pressed(page, 'Select')
  // A click with the Label tool makes plain text too, even on a symbol. An empty box adds nothing.
  await page.keyboard.press('l')
  await clickAt(page, P(flask.x, flask.y + 40))
  await expect(plain).toHaveValue('')
  await page.keyboard.press('Enter')
  expect((await getDoc(page)).order).toHaveLength(4)
  await pressed(page, 'Select')
  // Each label was one undo step.
  await page.keyboard.press('Control+z')
  expect((await getDoc(page)).order).toHaveLength(3)
})

test('edit-label-text', async ({ page }) => {
  await open(page)
  const b = new DocBuilder('Edit')
  const beaker = b.symbol('beaker', { x: 150, y: 300 })
  const made = b.label('beaker', 260, 260, [beaker, 50, 60])
  await page.evaluate((d) => window.__pracdraw.load(d), b.doc)
  await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
  const text = async () => ((await getDoc(page)).items[made.id] as LabelItem | undefined)?.text
  const box = page.getByRole('textbox', { name: 'Label text' })
  const on = await onScreen(page, P(280, 255)) // on the text
  // A double-click on the label opens the box with its text, selected. Escape: the label keeps its text.
  await page.mouse.dblclick(on.x, on.y)
  await expect(box).toHaveValue('beaker')
  await expect(page.locator(`#stage [data-id="${made.id}"]`)).toHaveCount(0) // the box shows the text instead
  await page.keyboard.type('glass')
  await page.keyboard.press('Escape')
  await expect(box).toHaveCount(0)
  expect(await text()).toBe('beaker')
  // Double-click, type and Enter: one undo step.
  await page.mouse.dblclick(on.x, on.y)
  await page.keyboard.type('250 cm3 beaker')
  await page.keyboard.press('Enter')
  expect(await text()).toBe('250 cm3 beaker')
  expect(drawing(await getSvg(page))).toMatch(/<tspan[^>]*font-size="10.5"[^>]*>3<\/tspan>/) // cm³
  // Enter on the selected label edits it too. An empty box deletes the label; undo brings it back.
  await page.keyboard.press('Enter')
  await expect(box).toHaveValue('250 cm3 beaker')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Enter')
  expect(await text()).toBeUndefined()
  await page.keyboard.press('Control+z')
  expect(await text()).toBe('250 cm3 beaker')
  await page.keyboard.press('Control+z')
  expect(await text()).toBe('beaker')
})

test('label-inspector', async ({ page }) => {
  await open(page)
  const b = new DocBuilder('Inspector')
  const beaker = b.symbol('beaker', { x: 150, y: 300 })
  const made = b.label('CO2 gas', 260, 260, [beaker, 50, 60])
  await page.evaluate((d) => window.__pracdraw.load(d), b.doc)
  await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
  const label = async () => (await getDoc(page)).items[made.id] as LabelItem
  await clickAt(page, P(280, 255))
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await expect(inspector.getByRole('heading', { name: 'Label', exact: true })).toBeVisible()
  await expect(inspector.getByText('Fixed to Beaker')).toBeVisible()
  // Size, side, leader end and smart text: one undo step each.
  const size = inspector.getByLabel('Size', { exact: true })
  await size.fill('20')
  await size.press('Enter')
  await inspector.getByLabel('Side', { exact: true }).selectOption('left')
  await inspector.getByLabel('Leader end', { exact: true }).selectOption('arrow')
  await inspector.getByLabel('Smart text', { exact: true }).uncheck()
  expect(await label()).toMatchObject({ size: 20, side: 'left', leaderEnd: 'arrow', smart: false })
  // Smart text off: the text is drawn as typed, with no subscript.
  const items = await svgDrawing(page)
  const last = items[items.length - 1]
  expect(last.texts).toEqual(['CO2 gas'])
  expect(drawing(await getSvg(page))).not.toMatch(/font-size="14">2</)
  // The arrow head: a second path, whose tip is the leader end.
  const target = toWorld(beaker, P(50, 60))
  expect(last.d).toHaveLength(2)
  expect(pathPoints(last.d[1]).some((p) => near(p, target))).toBe(true)
  for (let i = 0; i < 4; i++) await page.keyboard.press('Control+z')
  expect(await label()).toEqual(made)
  // Free the leader end: it stays where it is, and no longer follows the beaker.
  await clickAt(page, P(280, 255))
  await inspector.getByRole('button', { name: 'Free the leader end' }).click()
  expect((await label()).target).toEqual({ x: target.x, y: target.y })
  await expect(inspector.getByText('A free point')).toBeVisible()
  await drag(page, await onScreen(page, P(beaker.x - 20, beaker.y + 30)), 40, 0)
  expect((await label()).target).toEqual({ x: target.x, y: target.y })
  // An empty text deletes the label.
  await clickAt(page, P(280, 255))
  const field = inspector.getByLabel('Text', { exact: true })
  await field.fill('')
  await field.press('Enter')
  expect((await getDoc(page)).items[made.id]).toBeUndefined()
})

test('label-leader-end-handle', async ({ page }) => {
  await open(page)
  const b = new DocBuilder('Handle')
  const beaker = b.symbol('beaker', { x: 120, y: 300 })
  const flask = b.symbol('conicalFlask', { x: 380, y: 300 })
  const made = b.label('beaker', 220, 160, [beaker, 50, 60])
  await page.evaluate((d) => window.__pracdraw.load(d), b.doc)
  await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
  const label = async () => (await getDoc(page)).items[made.id] as LabelItem
  await clickAt(page, P(240, 155))
  const handle = page.locator('[data-handle="target"]')
  await expect(handle).toHaveCount(1)
  // Drop the leader end on the flask's wall: it is fixed to the flask there, and follows it.
  const wall = toWorld(flask, labelPoint(geometry(flask.symbol, flask.w, flask.h, flask.params), flask.w, flask.h, 'left'))
  const to = await onScreen(page, wall)
  const from = await centreOf(handle)
  await drag(page, from, to.x - from.x, to.y - from.y)
  const fixed = (await label()).target as { item: string; lx: number; ly: number }
  expect(fixed.item).toBe(flask.id)
  expectNear(toWorld(flask, P(fixed.lx, fixed.ly)), wall, 0)
  // Drop it on empty canvas: a free point. Each drag is one undo step.
  const from2 = await centreOf(handle)
  const empty = await onScreen(page, P(250, 520))
  await drag(page, from2, empty.x - from2.x, empty.y - from2.y)
  expect((await label()).target).toEqual({ x: 250, y: 520 })
  await page.keyboard.press('Control+z')
  expect((await label()).target).toEqual(fixed)
  await page.keyboard.press('Control+z')
  expect(await label()).toEqual(made)
})

test('alt-drag-selects-the-copy', async ({ page }) => {
  // Section 12: a selected item is never a snap target. The copy that an Alt+drag moves is the selection from the start.
  await open(page)
  const b = new DocBuilder('Copy')
  const beaker = b.symbol('beaker', { x: 150, y: 300 })
  await page.evaluate((d) => window.__pracdraw.load(d), b.doc)
  await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
  const start = await onScreen(page, P(beaker.x, beaker.y + 30))
  await clickAt(page, P(beaker.x, beaker.y + 30))
  const before = (await page.locator('.overlay .selection').boundingBox())!
  await page.keyboard.down('Alt')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) await page.mouse.move(start.x + (200 * i) / 8, start.y)
  // While the button is down, the selection box is round the copy, 200 px on.
  const during = (await page.locator('.overlay .selection').boundingBox())!
  expect(during.x - before.x).toBeCloseTo(200, 0)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  const doc = await getDoc(page)
  expect(doc.order).toHaveLength(2)
  const copy = doc.items[doc.order[1]] as SymbolItem
  expect(copy.x).toBe(beaker.x + 200)
  expect(doc.items[beaker.id]).toEqual(beaker)
  // The copy is the selection: Delete removes it and leaves the original.
  await page.keyboard.press('Delete')
  expect((await getDoc(page)).order).toEqual([beaker.id])
})

test('labels-move-like-items', async ({ page }) => {
  await open(page)
  const b = new DocBuilder('Move')
  const beaker = b.symbol('beaker', { x: 150, y: 300 })
  const made = b.label('beaker', 260, 260, [beaker, 50, 60])
  await page.evaluate((d) => window.__pracdraw.load(d), b.doc)
  await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
  const label = async (id = made.id) => (await getDoc(page)).items[id] as LabelItem
  // Drag the label by its text (Ctrl: no snapping): its text anchor moves; its fixed target stays on the beaker.
  await page.keyboard.down('Control')
  await drag(page, await onScreen(page, P(280, 255)), 40, 30)
  await page.keyboard.up('Control')
  expect(await label()).toEqual({ ...made, x: 300, y: 290 })
  // Ctrl+D: a copy 20 u on, with a new id, its leader still fixed to the beaker.
  await page.keyboard.press('Control+d')
  let doc = await getDoc(page)
  expect(doc.order).toHaveLength(3)
  const copy = doc.items[doc.order[2]] as LabelItem
  expect(copy).toEqual({ ...made, id: copy.id, x: 320, y: 310 })
  expect(copy.id).not.toBe(made.id)
  // Delete the beaker: each leader end stays where it was, as a free point.
  await clickAt(page, P(beaker.x - 20, beaker.y + 30))
  await page.keyboard.press('Delete')
  const end = toWorld(beaker, P(50, 60))
  expect((await label()).target).toEqual({ x: end.x, y: end.y })
  expect((await label(copy.id)).target).toEqual({ x: end.x, y: end.y })
  // Undo, one step at a time.
  await page.keyboard.press('Control+z')
  expect((await label()).target).toEqual(made.target)
  await page.keyboard.press('Control+z')
  doc = await getDoc(page)
  expect(doc.order).toHaveLength(2)
  await page.keyboard.press('Control+z')
  expect(await label()).toEqual(made)
})

test('letters-mode', async ({ page }) => {
  await open(page)
  await loadDemo(page)
  const labels = labelsOf(await getDoc(page))
  await page.getByRole('radio', { name: 'Letters' }).click()
  expect((await getDoc(page)).settings.labelMode).toBe('letters')
  // A label with a leader is drawn as its leader and a letter, A, B, C … in draw order. Plain text stays as it is.
  const items = (await svgDrawing(page)).slice(-labels.length)
  let n = 0
  for (const [i, l] of labels.entries()) {
    if (l.target) {
      expect(items[i].texts).toEqual([String.fromCharCode(65 + n++)])
      expect(pathPoints(items[i].d[0])).toHaveLength(2)
    } else expect(items[i].texts).toEqual(shownLines(l))
  }
  expect(n).toBeGreaterThan(10)
})

test('align-and-guides-measure-label-text', async ({ page }) => {
  // A label counts as its text is drawn (canvas measureText), not as the estimate of 0.56 × the size for each character.
  await open(page)
  const b = new DocBuilder('Measure')
  const beaker = b.symbol('beaker', { x: 150, y: 300 })
  const made = b.label('conical flask', 240, 120)
  await page.evaluate((d) => window.__pracdraw.load(d), b.doc)
  await page.evaluate(() => window.__pracdraw.view({ x: 0, y: 0, zoom: 1 }))
  const box = boundsOf(b.doc, beaker)
  /** The label's text as the screen draws it, in world units (the view is at 100 %, from the origin). */
  const drawn = async () => {
    const r = (await page.locator(`#stage [data-id="${made.id}"] text`).boundingBox())!
    const o = (await page.locator('#stage').boundingBox())!
    return { x0: r.x - o.x, x1: r.x - o.x + r.width }
  }
  const width = (await drawn()).x1 - (await drawn()).x0
  expect(width).toBeLessThan(13 * 15 * 0.56 - 15) // well short of the estimate
  // Align right: the right edge of the beaker's bounds goes to the end of the text as drawn (the text is further right).
  const beakerBox = async () => boundsOf(await getDoc(page), (await getDoc(page)).items[beaker.id])
  await page.keyboard.press('Control+a')
  const inspector = page.getByRole('complementary', { name: 'Inspector' })
  await inspector.getByRole('button', { name: 'Align right' }).click()
  // (The screen box of SVG text is good to about half a pixel; the estimate would be 27 u out.)
  expect(Math.abs((await beakerBox()).x1 - (await drawn()).x1)).toBeLessThan(1.5)
  // Align centre: the middle of the text as drawn and the middle of the beaker's bounds line up.
  await inspector.getByRole('button', { name: 'Align centre' }).click()
  const c = await drawn(),
    bb = await beakerBox()
  expect(Math.abs((c.x0 + c.x1) / 2 - (bb.x0 + bb.x1) / 2)).toBeLessThan(1.5)
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  expect((await getDoc(page)).items[made.id]).toEqual(made)
  // Guides: the label dragged until its text starts 4 u right of the beaker's left edge snaps onto that edge.
  await page.locator('.canvas').click({ position: { x: 5, y: 5 } })
  await dragTo(page, P(260, 115), P(made.x, made.y), P(box.x0 + 4, made.y))
  expect((await getDoc(page)).items[made.id]).toMatchObject({ x: box.x0, y: made.y })
})
