// render.spec.ts — phase 12: the render command (scripts/render.ts), which turns a recipe into the editor's own pictures. Each
// test runs the command as a subprocess against the built file, as an agent does, and looks at the files it writes.
// The last test is about the test hook, which the command draws with.

import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { crc32 } from 'node:zlib'
import { DEFAULT_EXPORT, exportSvg, type ExportOptions } from '../src/export/picture.ts'
import { docFromSvg } from '../src/export/svg.ts'
import { FONT, SCRIPT } from '../src/kernel/nodes.ts'
import { parseMarkup } from '../src/kernel/text.ts'
import { docBounds, type Measure } from '../src/model/bounds.ts'
import { compileRecipe } from '../src/model/recipe.ts'
import type { Doc, LabelItem } from '../src/model/types.ts'
import { TEMPLATES } from '../src/templates/index.ts'
import { FILE } from './hook.ts'

const EXAMPLES = resolve('../.claude/skills/pracdraw/examples')
const example = (name: string): string => join(EXAMPLES, `${name}.json`)
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))

/** Run `npm run render -- <args>` in the project folder. The proxy is dead, so that a request to the network would fail. */
function render(args: string[]) {
  const dead = 'http://127.0.0.1:1'
  const r = spawnSync('npm', ['run', 'render', '--silent', '--', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, HTTP_PROXY: dead, HTTPS_PROXY: dead, http_proxy: dead, https_proxy: dead, NO_PROXY: '', no_proxy: '' },
    timeout: 100_000,
  })
  return { code: r.status, out: r.stdout, err: r.stderr }
}

/** A folder for the files of one run. */
function folder(info: TestInfo, name: string): string {
  const dir = info.outputPath(name)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** A PNG that is whole: its signature, and every chunk with a good checksum, up to IEND. Its size in pixels. */
function readPng(png: Buffer): { w: number; h: number } {
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  let at = 8
  let last = ''
  while (at < png.length) {
    const length = png.readUInt32BE(at)
    const type = png.subarray(at + 4, at + 8).toString('latin1')
    const data = png.subarray(at + 8, at + 8 + length)
    expect(png.readUInt32BE(at + 8 + length), `the checksum of ${type}`).toBe(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])))
    at += 12 + length
    last = type
  }
  expect(last).toBe('IEND')
  expect(at).toBe(png.length)
  return { w: png.readUInt32BE(16), h: png.readUInt32BE(20) }
}

/** The SVG without its metadata: what is drawn. */
const drawing = (svg: string): string => svg.replace(/<metadata>[\s\S]*?<\/metadata>/, '')

/**
 * The width of each text as this browser draws it (canvas measureText, scripts at 0.7 size), for the texts that `run`
 * measures: the test's own copy of `measureText`, run in the page.
 */
async function browserMeasure(page: Page, run: (measure: Measure) => void): Promise<Measure> {
  const wanted = new Map<string, { size: number; text: string }>()
  run((text, size) => {
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

async function open(page: Page) {
  await page.goto(FILE)
  await page.waitForFunction(() => !!window.__pracdraw)
}

const labelsOf = (doc: Doc): LabelItem[] => Object.values(doc.items).filter((it): it is LabelItem => it.type === 'label' && !!it.target)

test.setTimeout(150_000)

test('render-writes-svg-png-and-source', async ({ page }, info) => {
  await open(page)
  // Three recipes: one with contents and a reading, one with a tube, a clamp and a reading on a turned cylinder, one of wires.
  for (const name of ['heating-beaker', 'gas-over-water', 'circuit']) {
    const out = folder(info, name)
    const r = render([example(name), '--out', out])
    expect(r.err, name).not.toMatch(/error/i)
    expect(r.code, `${name}\n${r.out}`).toBe(0)
    // One line for each file, with its size and its bytes; then the description; and no request to the network.
    expect(r.out).toContain(`${name}.svg`)
    expect(r.out).toMatch(new RegExp(`wrote .*${name}\\.png {2}\\d+ × \\d+ px {2}[\\d,]+ bytes`))
    expect(r.out).toMatch(new RegExp(`wrote .*${name}\\.pracdraw\\.json {2}the document {2}[\\d,]+ bytes`))
    expect(r.out).toContain('network requests: 0')
    expect(r.out).toMatch(/\nchecks: no layout faults\n?$/)
    expect(readdirSync(out).sort()).toEqual([`${name}.pracdraw.json`, `${name}.png`, `${name}.svg`].sort())

    // The document is the compiled recipe.
    const compiled = compileRecipe(readJson(example(name))).doc!
    const saved = JSON.parse(readFileSync(join(out, `${name}.pracdraw.json`), 'utf8')) as Doc
    expect(saved).toEqual(JSON.parse(JSON.stringify(compiled)))

    // The SVG reopens equal through docFromSvg.
    const svg = readFileSync(join(out, `${name}.svg`), 'utf8')
    const reopened = docFromSvg(svg)
    expect(reopened.ok).toBe(true)
    if (reopened.ok) {
      expect(reopened.problems).toEqual([])
      expect(reopened.doc).toEqual(saved)
    }

    // The PNG is whole, and 2 × the docBounds of the diagram (rounded out to whole units) in each direction.
    const png = readFileSync(join(out, `${name}.png`))
    const size = readPng(png)
    await page.evaluate((d) => window.__pracdraw.load(d), saved)
    const measure = await browserMeasure(page, (m) => docBounds(saved, m))
    const b = docBounds(saved, measure)
    const x0 = Math.floor(b.x),
      y0 = Math.floor(b.y)
    expect(size, name).toEqual({ w: 2 * (Math.ceil(b.x + b.w) - x0), h: 2 * (Math.ceil(b.y + b.h) - y0) })
    // The SVG is the same picture at 1 ×.
    const m = /<svg[^>]*width="([\d.]+)" height="([\d.]+)"/.exec(svg)!
    expect([2 * Number(m[1]), 2 * Number(m[2])]).toEqual([size.w, size.h])
  }
  // A recipe with a reading draws the reading: the cylinder's water is 34 cm3 of gas below the scale's top.
  const gas = readFileSync(join(info.outputPath('gas-over-water'), 'gas-over-water.svg'), 'utf8')
  expect(drawing(gas)).toContain('#cfe8f7')
  // A template, and a saved diagram or an SVG as the input, make the same picture.
  const t = folder(info, 'template')
  const first = render(['--template', 'heatingBeaker', '--out', t])
  expect(first.code, first.out + first.err).toBe(0)
  expect(readdirSync(t).sort()).toEqual(['heatingBeaker.pracdraw.json', 'heatingBeaker.png', 'heatingBeaker.svg'].sort())
  for (const input of ['heatingBeaker.pracdraw.json', 'heatingBeaker.svg']) {
    const again = folder(info, `again-${input}`)
    const r = render([join(t, input), '--out', again, '--name', 'heatingBeaker'])
    expect(r.code, r.out + r.err).toBe(0)
    expect(readFileSync(join(again, 'heatingBeaker.png')).equals(readFileSync(join(t, 'heatingBeaker.png'))), input).toBe(true)
    // The drawing is the same, and so is the document in the metadata (the reader of the editor puts its keys in its own order).
    const a = readFileSync(join(again, 'heatingBeaker.svg'), 'utf8'),
      b = readFileSync(join(t, 'heatingBeaker.svg'), 'utf8')
    expect(drawing(a) === drawing(b), `${input}: the same drawing`).toBe(true)
    expect(docFromSvg(a)).toEqual(docFromSvg(b))
  }
})

test('render-variants', async ({ page }, info) => {
  const out = folder(info, 'variants')
  const r = render([example('heating-beaker'), '--out', out, '--variants'])
  expect(r.code, r.out + r.err).toBe(0)
  const name = 'heating-beaker'
  expect(readdirSync(out).sort()).toEqual(
    [
      `${name}.pracdraw.json`,
      `${name}.png`,
      `${name}.svg`,
      `${name}-blank.png`,
      `${name}-blank.svg`,
      `${name}-letters.png`,
      `${name}-letters.svg`,
      `${name}-mono.png`,
      `${name}-mono.svg`,
    ].sort(),
  )
  const doc = JSON.parse(readFileSync(join(out, `${name}.pracdraw.json`), 'utf8')) as Doc
  const texts = labelsOf(doc).map((l) => l.text)
  expect(texts.length).toBeGreaterThanOrEqual(6)
  const read = (file: string) => readFileSync(join(out, file), 'utf8')

  // Text mode draws the label texts; the document in the metadata has them in every file.
  for (const text of texts) expect(drawing(read(`${name}.svg`)), text).toContain(text.split(' ')[0])
  for (const file of ['', '-blank', '-letters', '-mono']) {
    const reopened = docFromSvg(read(`${name}${file}.svg`))
    expect(reopened.ok && reopened.doc).toEqual(doc)
  }
  // Blank mode draws no label text: a line to write on instead.
  const blank = drawing(read(`${name}-blank.svg`))
  for (const text of texts) expect(blank, text).not.toContain(text.split(' ')[0])
  expect(blank).not.toContain('<text')
  // Letters mode draws a letter for each label, and an answer key that lists them.
  const letters = drawing(read(`${name}-letters.svg`))
  const lettered = labelsOf(doc).length
  for (let i = 0; i < lettered; i++) expect(letters, `the letter ${String.fromCharCode(65 + i)}`).toContain(`>${String.fromCharCode(65 + i)}</tspan>`)
  // The key lists the text of each label under its letter: the texts are in the picture now, and not in the blank one.
  for (const text of texts) expect(letters, text).toContain(text.split(' ')[0])
  expect(lettered).toBe(texts.length)
  // The key makes the letters picture taller than the text picture; the mono picture has no colour.
  expect(readPng(readFileSync(join(out, `${name}-letters.png`))).h).toBeGreaterThan(readPng(readFileSync(join(out, `${name}.png`))).h)
  expect(drawing(read(`${name}.svg`))).toContain('#cfe8f7')
  expect(drawing(read(`${name}-mono.svg`))).not.toContain('#cfe8f7')
  for (const file of ['', '-blank', '-letters', '-mono']) readPng(readFileSync(join(out, `${name}${file}.png`)))
  // The flags that choose one picture write that picture.
  const one = folder(info, 'one')
  const s = render([example('titration'), '--out', one, '--labels', 'letters', '--answer-key', '--mono', '--transparent', '--scale', '4', '--no-svg'])
  expect(s.code, s.out + s.err).toBe(0)
  expect(readdirSync(one).sort()).toEqual(['titration-letters-mono.png', 'titration.pracdraw.json'])
  const png = readFileSync(join(one, 'titration-letters-mono.png'))
  expect(readPng(png).w % 4).toBe(0) // 4 pixels for each unit
  const corner = await page.evaluate(
    async (url) => {
      const img = new Image()
      img.src = url
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const x = c.getContext('2d')!
      x.drawImage(img, 0, 0)
      return x.getImageData(2, 2, 1, 1).data[3]
    },
    `data:image/png;base64,${png.toString('base64')}`,
  )
  expect(corner).toBe(0) // transparent, not white
})

test('render-is-deterministic', async ({}, info) => {
  const runs = ['one', 'two'].map((name) => {
    const out = folder(info, name)
    const r = render([example('gas-over-water'), '--out', out, '--variants', '--name', 'gas'])
    expect(r.code, r.out + r.err).toBe(0)
    return out
  })
  const files = readdirSync(runs[0]).sort()
  expect(files.length).toBe(9)
  expect(readdirSync(runs[1]).sort()).toEqual(files)
  for (const f of files) expect(readFileSync(join(runs[0], f)).equals(readFileSync(join(runs[1], f))), `${f} is the same in both runs`).toBe(true)
})

test('render-reports-errors', async ({}, info) => {
  const dir = folder(info, 'bad')
  const recipe = join(dir, 'bad.json')
  writeFileSync(
    recipe,
    JSON.stringify({
      title: 'Bad',
      parts: [
        { id: 'a', symbol: 'beker' },
        { id: 'b', symbol: 'bung', params: { holes: 5 } },
      ],
    }),
  )
  const out = join(dir, 'out')
  const r = render([recipe, '--out', out])
  expect(r.code).toBe(1)
  expect(existsSync(out)).toBe(false) // nothing is written
  // The problems are a numbered list, with the path in the recipe and the hint that names the fix.
  expect(r.err).toContain('bad.json has 2 errors. Nothing was written.')
  expect(r.err).toContain('1. error at parts[0].symbol')
  expect(r.err).toContain('Unknown symbol "beker".')
  expect(r.err).toContain('hint: Nearest symbols: beaker (Beaker).')
  expect(r.err).toContain('2. error at parts[1].params.holes')
  expect(r.err).toContain('hint: holes must be a whole number from 0 to 2.')
  expect(r.out).toBe('')
  // Warnings do not stop it: a part with no placement still gives pictures, and exit code 0.
  const warn = join(dir, 'warn.json')
  writeFileSync(
    warn,
    JSON.stringify({
      title: 'Warn',
      parts: [
        { id: 'a', symbol: 'beaker' },
        { id: 'b', symbol: 'beaker' },
      ],
    }),
  )
  const w = render([warn, '--out', join(dir, 'warn-out')])
  expect(w.code, w.out + w.err).toBe(0)
  expect(w.out).toContain('warnings from the input (1):')
  expect(w.out).toContain('hint: Add "on", "near" or "at"')
  // Bad input of other kinds is an error too, and says what to do.
  const text = join(dir, 'not-json.json')
  writeFileSync(text, '{ "parts": [ ')
  const j = render([text, '--out', join(dir, 'json-out')])
  expect(j.code).toBe(1)
  expect(j.err).toContain('is not valid JSON')
  expect(render(['--template', 'heatingBeakr']).err).toContain('Did you mean "heatingBeaker"?')
  expect(render(['--bogus']).code).toBe(1)
  expect(render([]).code).toBe(1)
})

test('render-lists-and-describes', async () => {
  const templates = render(['--list', 'templates'])
  expect(templates.code).toBe(0)
  expect(templates.out.trim().split('\n')).toHaveLength(TEMPLATES.length)
  expect(templates.out).toContain('titration')
  const symbols = render(['--list', 'symbols'])
  expect(symbols.out).toContain('bossClamp')
  expect(symbols.out).toContain('(retort stand, stand)')
  const one = render(['--symbol', 'beaker'])
  expect(one.code).toBe(0)
  expect(one.out).toContain('size 100 × 120 u; resize: free; minimum 40 × 40')
  expect(one.out).toContain('graduations: boolean, default false')
  expect(one.out).toContain('cavities (contents in a recipe): main')
  expect(one.out).toContain('base: kind base, at (0, 120), points down')
  expect(one.out).toContain('mouth: kind mouth, at (0, 0), points up')
  expect(render(['--symbol', 'measuringCylinder']).out).toContain('scale: in cavity "main", from 0 to 100 cm³')
  const missing = render(['--symbol', 'beker'])
  expect(missing.code).toBe(1)
  expect(missing.err).toContain('Nearest: beaker (Beaker)')
})

test('hook-options-match-exportSvg', async ({ page }) => {
  await open(page)
  const doc = compileRecipe(readJson(example('cooling-curve'))).doc!
  await page.evaluate((d) => window.__pracdraw.load(d), doc)
  const cases: Partial<ExportOptions>[] = [
    {},
    { labels: 'blank' },
    { labels: 'letters', answerKey: true },
    { labels: 'letters' },
    { mono: 'on' },
    { background: 'transparent' },
    { labels: 'text', mono: 'off', background: 'white' },
  ]
  const full = (o: Partial<ExportOptions>): ExportOptions => ({ ...DEFAULT_EXPORT, ...o, format: 'svg' })
  // The widths of every text that these exports measure, as the page draws them.
  const measure = await browserMeasure(page, (m) => {
    for (const o of cases) exportSvg(doc, full(o), m)
  })
  const loaded = await page.evaluate(() => window.__pracdraw.doc())
  expect(loaded).toEqual(JSON.parse(JSON.stringify(doc)))
  for (const o of cases) {
    const fromHook = await page.evaluate((options) => window.__pracdraw.svg(options), o)
    expect(fromHook === exportSvg(doc, full(o), measure), `svg(${JSON.stringify(o)}) is exportSvg with the same options`).toBe(true)
  }
  // With no argument the hook is what it was: the default export.
  expect((await page.evaluate(() => window.__pracdraw.svg())) === exportSvg(doc, full({}), measure)).toBe(true)
  // The options differ: blank has no label text, and a PNG of another mode has its own size.
  const text = await page.evaluate(() => window.__pracdraw.svg())
  const blank = await page.evaluate(() => window.__pracdraw.svg({ labels: 'blank' }))
  expect(drawing(text)).toContain('stearic acid')
  expect(drawing(blank)).not.toContain('stearic acid')
  const sizes = await page.evaluate(async () => {
    const size = async (url: string) => {
      const img = new Image()
      img.src = url
      await img.decode()
      return [img.width, img.height]
    }
    return [
      await size(window.__pracdraw.png(2)),
      await size(window.__pracdraw.png(2, { labels: 'blank' })),
      await size(window.__pracdraw.png(2, { labels: 'letters', answerKey: true })),
      await size(window.__pracdraw.png(4, { labels: 'letters', answerKey: true })),
    ]
  })
  expect(sizes[0]).not.toEqual(sizes[1])
  expect(sizes[2][1]).toBeGreaterThan(sizes[0][1]) // the answer key is under the diagram
  expect(sizes[3]).toEqual([2 * sizes[2][0], 2 * sizes[2][1]]) // 4 pixels for each unit against 2
})
