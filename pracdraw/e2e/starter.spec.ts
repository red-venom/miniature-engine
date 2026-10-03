import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// The built single file, opened straight from disk: the hardest hosting case.
const FILE = pathToFileURL('dist/index.html').href

declare global {
  interface Window {
    __starter: { png: (scale: number) => string; svg: () => string }
  }
}

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
  expect(await page.locator('#stage path').count()).toBeGreaterThan(50)
  expect(external).toEqual([])
  expect(errors).toEqual([])
  const html = readFileSync('dist/index.html', 'utf8')
  expect(html).not.toMatch(/(src|href)="https?:/)
  expect(html.length).toBeLessThan(900_000) // the size budget in section 6 of the specification
})

test('the PNG drawn on canvas matches the SVG on screen', async ({ page }) => {
  await page.goto(FILE)
  const shot = await page.locator('#stage').screenshot() // device scale factor 2
  const r = await page.evaluate(async (shotB64) => {
    const load = (src: string) =>
      new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = rej
        i.src = src
      })
    const pngUrl = window.__starter.png(2)
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
  expect(r.size).toEqual([2000, 1600, 2000, 1600])
  expect(r.ink).toBeGreaterThan(20000)
  expect(r.diff / r.ink).toBeLessThan(0.02)
})

test('the SVG export is standalone and plain', async ({ page }) => {
  await page.goto(FILE)
  const svg = await page.evaluate(() => window.__starter.svg())
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  expect(svg).not.toMatch(/<(clipPath|mask|pattern|filter|foreignObject|use|style|image|defs)\b/)
  expect(svg).not.toMatch(/ (class|style)=/)
  // It must also parse and draw as an image.
  const ok = await page.evaluate(
    (s) =>
      new Promise<boolean>((res) => {
        const i = new Image()
        i.onload = () => res(i.naturalWidth === 1000)
        i.onerror = () => res(false)
        i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)
      }),
    svg,
  )
  expect(ok).toBe(true)
})

test('copy puts a PNG on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(FILE)
  await page.bringToFront()
  await page.getByRole('button', { name: 'Copy PNG' }).click()
  await expect(page.getByRole('status')).toHaveText('Copied')
  const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => [...i.types]))
  expect(types).toContain('image/png')
})

test('settings re-render the diagram', async ({ page }) => {
  await page.goto(FILE)
  const colour = await page.evaluate(() => window.__starter.svg())
  await page.getByRole('button', { name: 'Photocopy-safe' }).click()
  const mono = await page.evaluate(() => window.__starter.svg())
  expect(colour).toContain('#cfe8f7')
  expect(mono).not.toContain('#cfe8f7')
  await page.getByRole('button', { name: /Labels/ }).click()
  expect(await page.evaluate(() => window.__starter.svg())).not.toContain('delivery tube')
})
