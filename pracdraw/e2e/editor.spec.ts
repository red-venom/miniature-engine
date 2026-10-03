import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { demoDoc } from '../src/demo.ts'
import { P, bounds, scan, type Pt } from '../src/kernel/geom.ts'
import { DocBuilder } from '../src/model/build.ts'
import { toWorld } from '../src/model/transform.ts'
import type { ConnectorItem, Doc, ShapeItem, SymbolItem } from '../src/model/types.ts'
import { geometry } from '../src/symbols/registry.ts'
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
  // A connector moves like any item: the arrow keys, a drag, duplicate, delete and the marquee.
  await page.keyboard.press('ArrowRight')
  expect(xy((await getDoc(page)).items[line.id] as ConnectorItem)[0]).toEqual([101, 200])
  await drag(page, await onScreen(page, P(200, 100)), 0, 30)
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
