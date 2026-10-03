import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { demoDoc } from '../src/demo.ts'
import type { Doc, SymbolItem } from '../src/model/types.ts'

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
  await page.getByLabel('Dot grid').uncheck() // a view preference: stored beside the document, not in it
  await page.waitForTimeout(800)
  const stored = await page.evaluate(() => localStorage.getItem('pracdraw.autosave.v1'))
  expect(stored).not.toBeNull()
  const saved = JSON.parse(stored!) as { doc: Doc; prefs: { snap: boolean; grid: boolean; recent: string[] } }
  expect(saved.doc.order).toEqual([beaker.id])
  expect(saved.prefs).toMatchObject({ grid: false, snap: true, recent: ['beaker'] })
  await page.reload()
  const doc = await getDoc(page)
  expect(doc.order).toEqual([beaker.id])
  expect(doc.items[beaker.id]).toMatchObject({ symbol: 'beaker', x: beaker.x, y: beaker.y })
  expect(doc.settings.labelMode).toBe('letters')
  await expect(page.getByLabel('Dot grid')).not.toBeChecked()
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
