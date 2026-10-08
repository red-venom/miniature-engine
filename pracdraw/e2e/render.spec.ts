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
import { DocBuilder } from '../src/model/build.ts'
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

/** The files of a folder, sorted. */
const filesOf = (dir: string): string[] => readdirSync(dir).sort()

/** Every name of a set of pictures: each in the formats that are given, and the saved diagram when it is wanted. */
const names = (stem: string, suffixes: string[], formats: string[] = ['png', 'svg'], json = true): string[] =>
  [...suffixes.flatMap((s) => formats.map((f) => `${stem}${s}.${f}`)), ...(json ? [`${stem}.pracdraw.json`] : [])].sort()

test('render-variants', async ({ page }, info) => {
  // A recipe whose labels are text: the variants are every label mode, with the answer key in its own file, and a photocopy-safe copy.
  const out = folder(info, 'variants')
  const r = render([example('heating-beaker'), '--out', out, '--variants'])
  expect(r.code, r.out + r.err).toBe(0)
  const name = 'heating-beaker'
  expect(filesOf(out)).toEqual(names(name, ['', '-blank', '-letters', '-letters-key', '-mono']))
  const doc = JSON.parse(readFileSync(join(out, `${name}.pracdraw.json`), 'utf8')) as Doc
  const texts = labelsOf(doc).map((l) => l.text)
  expect(texts.length).toBeGreaterThanOrEqual(6)
  const read = (file: string) => readFileSync(join(out, file), 'utf8')

  // Text mode draws the label texts; the document in the metadata has them in every file.
  for (const text of texts) expect(drawing(read(`${name}.svg`)), text).toContain(text.split(' ')[0])
  for (const file of ['', '-blank', '-letters', '-letters-key', '-mono']) {
    const reopened = docFromSvg(read(`${name}${file}.svg`))
    expect(reopened.ok && reopened.doc).toEqual(doc)
  }
  // Blank mode draws no label text: a line to write on instead.
  const blank = drawing(read(`${name}-blank.svg`))
  for (const text of texts) expect(blank, text).not.toContain(text.split(' ')[0])
  expect(blank).not.toContain('<text')
  // Letters mode draws a letter for each label and NO key: it is the copy for students, and nothing in it names a part.
  const letters = drawing(read(`${name}-letters.svg`))
  const lettered = labelsOf(doc).length
  for (let i = 0; i < lettered; i++) expect(letters, `the letter ${String.fromCharCode(65 + i)}`).toContain(`>${String.fromCharCode(65 + i)}</tspan>`)
  for (const text of texts) expect(letters, text).not.toContain(text.split(' ')[0])
  // The file with the key has the key under the diagram: the texts, listed under their letters, and a taller picture.
  const keyed = drawing(read(`${name}-letters-key.svg`))
  for (const text of texts) expect(keyed, text).toContain(text.split(' ')[0])
  expect(lettered).toBe(texts.length)
  const height = (file: string) => readPng(readFileSync(join(out, file))).h
  expect(height(`${name}-letters-key.png`)).toBeGreaterThan(height(`${name}-letters.png`))
  expect(height(`${name}-letters.png`)).toBe(height(`${name}.png`))
  // The mono picture has no colour.
  expect(drawing(read(`${name}.svg`))).toContain('#cfe8f7')
  expect(drawing(read(`${name}-mono.svg`))).not.toContain('#cfe8f7')
  for (const file of names(name, ['', '-blank', '-letters', '-letters-key', '-mono'], ['png'], false)) readPng(readFileSync(join(out, file)))
  // The output says what each file is for: which can go to students, and which has the answers.
  const line = (file: string) => r.out.split('\n').find((l) => l.startsWith('wrote ') && l.includes(`${file}  `)) ?? ''
  expect(line(`${name}-letters.png`)).toContain('student copy: letters, no answers')
  expect(line(`${name}-blank.png`)).toContain('student copy: a line to write on, no answers')
  expect(line(`${name}-letters-key.png`)).toContain('mark scheme: letters with the key under the diagram, has the answers')
  expect(line(`${name}.png`)).toContain('the labels as text: has the answers')
  expect(line(`${name}-mono.png`)).toContain('photocopy-safe')
  expect(line(`${name}-letters-key.svg`)).toContain('give students the PNG')
  expect(r.out).toContain('Give students only the PNG files marked student copy')

  // A recipe whose own labels are letters: the set is the same, and the key is not lost. This is the file that used to be missing.
  const exam = folder(info, 'exam')
  const examRecipe = join(exam, 'exam.json')
  writeFileSync(examRecipe, JSON.stringify({ ...(readJson(example('heating-beaker')) as object), settings: { labelMode: 'letters' } }))
  const e = render([examRecipe, '--out', join(exam, 'out'), '--variants'])
  expect(e.code, e.out + e.err).toBe(0)
  const ex = join(exam, 'out')
  expect(filesOf(ex)).toEqual(names('exam', ['', '-blank', '-letters', '-letters-key', '-letters-mono']))
  const h = (file: string) => readPng(readFileSync(join(ex, file))).h
  expect(h('exam-letters-key.png')).toBeGreaterThan(h('exam-letters.png')) // the key is under the diagram, and only there
  const withKey = drawing(readFileSync(join(ex, 'exam-letters-key.svg'), 'utf8'))
  const noKey = drawing(readFileSync(join(ex, 'exam-letters.svg'), 'utf8'))
  for (const text of texts) {
    expect(withKey, text).toContain(text.split(' ')[0])
    expect(noKey, text).not.toContain(text.split(' ')[0])
  }
  // The photocopy-safe copy is a picture of its own, not the plain letters copy again.
  expect(readFileSync(join(ex, 'exam-letters.png')).equals(readFileSync(join(ex, 'exam-letters-mono.png')))).toBe(false)
  // A key that is asked for goes in a file that says so, and only that.
  const asked = folder(info, 'asked')
  const k = render([example('titration'), '--out', asked, '--labels', 'letters', '--answer-key', '--no-svg'])
  expect(k.code, k.out + k.err).toBe(0)
  expect(filesOf(asked)).toEqual(['titration-letters-key.png', 'titration.pracdraw.json'])

  // --student writes the copies for students and nothing else: PNG files only, no SVG and no saved diagram (both hold the label
  // texts), and no file with the key.
  const student = folder(info, 'student')
  const s = render([example('heating-beaker'), '--out', student, '--student', '--variants'])
  expect(s.code, s.out + s.err).toBe(0)
  expect(filesOf(student)).toEqual([`${name}-blank.png`, `${name}-letters.png`])
  expect(s.out).toContain('student copies only: the SVG and the saved diagram (the source) are not written')
  expect(s.out).toContain("The teacher's copy comes from a normal run, without --student.")
  expect(s.out).toContain('student copy: letters, no answers')
  expect(s.out).not.toContain('has the answers')
  expect(s.err).toBe('')
  // One student copy; the flags that make no sense with it are errors, found before the browser starts.
  const one = folder(info, 'student-one')
  expect(render([example('heating-beaker'), '--out', one, '--student', '--labels', 'blank', '--mono']).code).toBe(0)
  expect(filesOf(one)).toEqual([`${name}-blank-mono.png`])
  for (const args of [
    ['--student'],
    ['--student', '--labels', 'text'],
    ['--student', '--answer-key', '--labels', 'letters'],
    ['--student', '--no-png', '--variants'],
  ]) {
    const bad = render([example('heating-beaker'), '--out', join(info.outputPath('student-bad')), ...args])
    expect(bad.code, args.join(' ')).toBe(1)
    expect(bad.err.trim().split('\n'), args.join(' ')).toHaveLength(1)
    expect(existsSync(info.outputPath('student-bad'))).toBe(false)
  }

  // --mono applies to every file of the run, and every file is named for it.
  const mono = folder(info, 'mono')
  const m = render([example('heating-beaker'), '--out', mono, '--variants', '--mono'])
  expect(m.code, m.out + m.err).toBe(0)
  expect(filesOf(mono)).toEqual(names(name, ['-mono', '-blank-mono', '-letters-mono', '-letters-key-mono']))
  for (const f of filesOf(mono).filter((x) => x.endsWith('.svg'))) expect(drawing(readFileSync(join(mono, f), 'utf8')), f).not.toContain('#cfe8f7')
  // Blank and mono for a printed worksheet, with and without --variants, with names that follow from the flags.
  const sheet = folder(info, 'sheet')
  expect(render([example('heating-beaker'), '--out', sheet, '--labels', 'blank', '--mono']).code).toBe(0)
  expect(filesOf(sheet)).toEqual(names(name, ['-blank-mono']))
  const sheets = folder(info, 'sheets')
  expect(render([example('heating-beaker'), '--out', sheets, '--labels', 'blank', '--mono', '--variants', '--no-svg']).code).toBe(0)
  expect(filesOf(sheets)).toEqual(names(name, ['-mono', '-blank-mono', '-letters-mono', '-letters-key-mono'], ['png']))

  // The flags that choose one picture write that picture.
  const single = folder(info, 'one')
  const t = render([example('titration'), '--out', single, '--labels', 'letters', '--answer-key', '--mono', '--transparent', '--scale', '4', '--no-svg'])
  expect(t.code, t.out + t.err).toBe(0)
  expect(filesOf(single)).toEqual(['titration-letters-key-mono.png', 'titration.pracdraw.json'])
  const png = readFileSync(join(single, 'titration-letters-key-mono.png'))
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

test('render-is-deterministic', () => {
  const info = test.info()
  const runs = ['one', 'two'].map((name) => {
    const out = folder(info, name)
    const r = render([example('gas-over-water'), '--out', out, '--variants', '--name', 'gas'])
    expect(r.code, r.out + r.err).toBe(0)
    return out
  })
  const files = readdirSync(runs[0]).sort()
  expect(files.length).toBe(11)
  expect(readdirSync(runs[1]).sort()).toEqual(files)
  for (const f of files) expect(readFileSync(join(runs[0], f)).equals(readFileSync(join(runs[1], f))), `${f} is the same in both runs`).toBe(true)
})

test('render-reports-errors', () => {
  const info = test.info()
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

/** A usage error is one line on the error output, exit code 1, no output, nothing written, and no stack of the program. */
function expectUsageError(args: string[], says: RegExp, written?: string): void {
  const r = render(args)
  const what = args.join(' ')
  expect(r.code, `${what}: ${r.out}${r.err}`).toBe(1)
  expect(r.out, what).toBe('')
  expect(r.err.trim().split('\n'), `${what}: ${r.err}`).toHaveLength(1)
  expect(r.err.trim(), what).toMatch(says)
  expect(r.err, what).not.toMatch(/\bat .*:\d+:\d+|node:internal|ENOENT|EPIPE|Error:/)
  if (written) expect(existsSync(written), `${what} writes nothing`).toBe(false)
}

test('render-rejects-bad-usage', () => {
  const info = test.info()
  const dir = folder(info, 'usage')
  const recipe = example('heating-beaker')
  const file = join(dir, 'a-file')
  writeFileSync(file, 'not a folder')
  const out = join(dir, 'out')
  const started = Date.now()
  // The folder for the files is a file, or has a file in its path.
  expectUsageError([recipe, '--out', file], /^--out ".*a-file" is a file, not a folder\.$/)
  expectUsageError([recipe, '--out', join(file, 'inside', 'deeper')], /^--out ".*deeper" cannot be made: ".*a-file" is a file, not a folder\.$/)
  // The input is a folder, or is not there.
  expectUsageError([dir, '--out', out], /^".*usage" is a folder: give a recipe/, out)
  expectUsageError([join(dir, 'nothing.json'), '--out', out], /^There is no file ".*nothing\.json"\.$/, out)
  // The name for the files: too long, empty, or nothing left after cleaning.
  expectUsageError([recipe, '--out', out, '--name', 'x'.repeat(101)], /^--name is 101 characters, and the most is 100\.$/, out)
  expectUsageError([recipe, '--out', out, '--name', ''], /^--name must not be empty\.$/, out)
  expectUsageError([recipe, '--out', out, '--name', '///'], /^--name "\/\/\/" has nothing left after cleaning/, out)
  expect(render([recipe, '--out', join(dir, 'long-name'), '--name', 'x'.repeat(100), '--no-png', '--no-svg']).code).toBe(0) // 100 is allowed
  // The flags: one that is not there, one without its value, a value that is not allowed, two inputs, two ways that cannot be.
  expectUsageError([recipe, '--bogus'], /^Unknown flag --bogus: the flags are listed by npm run render -- --help$/)
  expectUsageError([recipe, '--out'], /^--out needs a value/)
  expectUsageError([recipe, '--scale', '3'], /^--scale must be 1, 2 or 4\.$/)
  expectUsageError([recipe, recipe], /^Only one input file at a time/)
  expectUsageError([recipe, '--template', 'titration'], /^Give a file or --template, not both\.$/)
  expectUsageError([recipe, '--student', '--answer-key'], /^--student never writes the answer key/)
  expectUsageError([recipe, '--answer-key'], /^--answer-key goes with letters: add --labels letters\.$/)
  expectUsageError([], /^Give a recipe file, a saved diagram, or --template <id>/)
  // A saved diagram with a part of an impossible size is an error with the limit in its hint, before the browser starts. A
  // thermometer of 1e9 u took the browser two minutes to draw and then crashed it.
  const bad = new DocBuilder('Absurd')
  bad.symbol('thermometer', { x: 0, y: 0, h: 1e9 })
  const saved = join(dir, 'absurd.pracdraw.json')
  writeFileSync(saved, JSON.stringify(bad.doc))
  const absurd = render([saved, '--out', out])
  expect(absurd.code).toBe(1)
  expect(absurd.err).toContain('absurd.pracdraw.json has 1 error. Nothing was written.')
  expect(absurd.err).toContain('1. error at items.thermometer1.h')
  expect(absurd.err).toContain('The height of the part "thermometer1" (thermometer) is 1000000000 u.')
  expect(absurd.err).toContain('hint: A part is from 1 to 5000 u')
  expect(existsSync(out)).toBe(false)
  // The same diagram in an SVG file.
  const svg = join(dir, 'absurd.svg')
  writeFileSync(svg, `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><metadata>${JSON.stringify(bad.doc)}</metadata></svg>`)
  const absurdSvg = render([svg, '--out', out])
  expect(absurdSvg.code).toBe(1)
  expect(absurdSvg.err).toContain('absurd.svg has 1 error. Nothing was written.')
  expect(absurdSvg.err).toContain('items.thermometer1.h')
  // A recipe with a part that is too big, or too far, is an error of the recipe, with its path and its hint.
  const big = join(dir, 'big.json')
  writeFileSync(
    big,
    JSON.stringify({
      title: 'Big',
      parts: [
        { id: 'a', symbol: 'thermometer', size: { h: 1e9 } },
        { id: 'b', symbol: 'beaker', at: { x: 90000, y: 0 } },
      ],
    }),
  )
  const bigRun = render([big, '--out', out])
  expect(bigRun.code).toBe(1)
  expect(bigRun.err).toContain('2. error at parts[1]')
  expect(bigRun.err).toContain('beyond the 5000 u that a diagram may reach from the origin')
  expect(existsSync(out)).toBe(false)
  // Nothing of this started the browser or built the editor: it was quick.
  expect(Date.now() - started).toBeLessThan(60_000)
  // A reader that closes the pipe early is no error: the command stops quietly.
  const piped = spawnSync('sh', ['-c', 'npm run render --silent -- --list symbols | head -1'], { cwd: process.cwd(), encoding: 'utf8' })
  expect(piped.status).toBe(0)
  expect(piped.stdout.trim().split('\n')).toHaveLength(1)
  expect(piped.stderr).toBe('')
  const piped2 = spawnSync('sh', ['-c', 'npm run render --silent -- --list templates | head -2'], { cwd: process.cwd(), encoding: 'utf8' })
  expect(piped2.stderr).toBe('')
  expect(piped2.stdout.trim().split('\n')).toHaveLength(2)
})

test('render-warns-about-a-big-picture', () => {
  const info = test.info()
  const dir = folder(info, 'wide')
  const wide = join(dir, 'wide.json')
  // Two beakers 4900 u apart: a picture of about 5000 u, which no slide shows, and a PNG that is too wide at 4 pixels for each unit.
  writeFileSync(
    wide,
    JSON.stringify({
      title: 'Wide',
      parts: [
        { id: 'a', symbol: 'beaker', at: { x: -2450, y: 0, anchor: 'base' } },
        { id: 'b', symbol: 'beaker', at: { x: 2450, y: 0, anchor: 'base' } },
      ],
      labels: { auto: false },
    }),
  )
  const r = render([wide, '--out', join(dir, 'out'), '--scale', '4', '--no-svg'])
  expect(r.code, r.out + r.err).toBe(0)
  expect(r.out).toMatch(/The picture is \d{4} × \d+ u, larger than 4000 u on a side/)
  expect(r.out).toMatch(/The PNG wide\.png is 8192 × \d+ px, not 4 × the picture \(\d{4} × \d+ u\)\./)
  expect(r.out).toContain('hint: The editor keeps a PNG to 8192 px on a side and 16 million pixels in all.')
  expect(readPng(readFileSync(join(dir, 'out', 'wide.png'))).w).toBe(8192)
  // A scale that fits gives no such warning.
  const ok = render([wide, '--out', join(dir, 'ok'), '--scale', '1', '--no-svg'])
  expect(ok.out).not.toContain('The PNG')
  expect(ok.out).toContain('larger than 4000 u on a side')
})

test('render-examples-are-clean', () => {
  // Every recipe of the skill is an example to copy: it draws with no warning, as this browser measures the text.
  const info = test.info()
  const files = readdirSync(EXAMPLES)
    .filter((f) => f.endsWith('.json'))
    .sort()
  expect(files.length).toBeGreaterThanOrEqual(9)
  for (const file of files) {
    const r = render([join(EXAMPLES, file), '--out', folder(info, 'clean'), '--no-png', '--no-svg'])
    expect(r.code, `${file}\n${r.out}${r.err}`).toBe(0)
    expect(r.out, file).toMatch(/\nchecks: no layout faults\n?$/)
  }
})

test('render-finds-symbols-and-templates', () => {
  const find = (words: string[]) => render(['--find', ...words])
  const funnel = find(['filter', 'funnel'])
  expect(funnel.code).toBe(0)
  expect(funnel.out.split('\n')[0]).toMatch(/^symbol {4}filterFunnel {2}Filter funnel {2}\(filtering\)/)
  expect(funnel.out).toMatch(/^template {2}filtration {2}Filtration {2}\(Chemistry\)$/m)
  // An alias, and a word of the set-up note of a template.
  expect(find(['retort', 'stand']).out).toMatch(/^symbol {4}clampStand {2}Clamp stand {2}\(support\) {2}also called: retort stand, stand$/m)
  expect(find(['immersion']).out).toMatch(/symbol {4}immersionHeater/)
  // Nothing found says so, and the nearest symbols.
  const none = find(['beker'])
  expect(none.code).toBe(0)
  expect(none.out).toContain('Nothing matches "beker". The nearest symbols: beaker (Beaker)')
  expect(render(['--find']).err).toBe('--find needs words: npm run render -- --find filter funnel\n')
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
