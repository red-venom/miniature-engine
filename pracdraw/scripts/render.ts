// render.ts — the hands-free pipeline for lesson diagrams. Run: npm run render -- <recipe.json> [flags]
//
//   npm run render -- <recipe.json | file.pracdraw.json | file.svg> [--out <dir>] [--name <slug>] [--scale 1|2|4]
//                     [--labels shown|text|blank|letters] [--mono] [--answer-key] [--transparent]
//                     [--variants] [--no-png] [--no-svg] [--explain]
//   npm run render -- --template <id> [same flags]
//   npm run render -- --list templates | symbols
//   npm run render -- --symbol <id>
//
// A recipe (src/model/recipe.ts) or a saved diagram is opened in the built editor (dist/index.html, from file://, in
// headless Chromium), and the pictures come from the editor's own test hook, so they are exactly the editor's: the SVG
// with the editable document in its metadata, the PNG, and the document itself. Exit code 1: the input has an error
// (nothing is written). Exit code 2: the browser or the build failed. Warnings do not change the exit code. The same
// input gives the same bytes. It needs no network: a request to anywhere but the built file stops it.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Page } from '@playwright/test'
import { exportName, saveText } from '../src/export/files.ts'
import type { ExportOptions } from '../src/export/picture.ts'
import { docFromSvg } from '../src/export/svg.ts'
import { FONT, SCRIPT } from '../src/kernel/nodes.ts'
import { parseMarkup } from '../src/kernel/text.ts'
import { estimateWidth, type Measure } from '../src/model/bounds.ts'
import { checkDoc, describeDoc } from '../src/model/check.ts'
import { parseDoc } from '../src/model/parse.ts'
import { compileRecipe, isRecipe, nearestNames, suggestSymbols, type Problem } from '../src/model/recipe.ts'
import type { Doc } from '../src/model/types.ts'
import { SYMBOLS, geometry, hasSymbol, labelText, symbolDef } from '../src/symbols/registry.ts'
import type { SymbolDef } from '../src/symbols/types.ts'
import { TEMPLATES } from '../src/templates/index.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist', 'index.html')
/** Where relative paths on the command line are relative to: the directory `npm run` was started in. */
const CWD = process.env.INIT_CWD ?? process.cwd()

const USAGE = `Usage:
  npm run render -- <recipe.json | file.pracdraw.json | file.svg> [flags]
  npm run render -- --template <id> [flags]
  npm run render -- --list templates | symbols
  npm run render -- --symbol <id>

Flags:
  --out <dir>        where the files go (default ./lesson-diagrams)
  --name <slug>      the file name stem (default: the name of the input file, or the template id)
  --scale 1|2|4      PNG pixels for each unit (default 2)
  --labels <mode>    shown (as the diagram is saved, the default), text, blank or letters
  --mono             photocopy-safe: black line only, dashes for liquids
  --answer-key       with --labels letters: the answer key under the diagram
  --transparent      a transparent background instead of white
  --variants         also write the text, blank, letters (with the answer key) and photocopy-safe versions
  --no-png, --no-svg leave that file out
  --explain          also show how each part was placed, and every anchor with its kind and direction
Files: <name>.svg (the editable document is in its metadata), <name>.png and <name>.pracdraw.json.`

/** Something that stops the command: the message goes to the error output (nothing if it is empty) and the exit code is `code`. */
class Failure extends Error {
  code: number
  constructor(message: string, code = 1) {
    super(message)
    this.code = code
  }
}

// ---------------------------------------------------------------- the command line

interface Args {
  input?: string
  out: string
  name?: string
  scale: 1 | 2 | 4
  labels: ExportOptions['labels']
  mono: boolean
  answerKey: boolean
  transparent: boolean
  variants: boolean
  png: boolean
  svg: boolean
  explain: boolean
  template?: string
  list?: string
  symbol?: string
  help: boolean
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    out: 'lesson-diagrams',
    scale: 2,
    labels: 'shown',
    mono: false,
    answerKey: false,
    transparent: false,
    variants: false,
    png: true,
    svg: true,
    explain: false,
    help: false,
  }
  const rest = [...argv]
  const take = (flag: string, inline: string | undefined): string => {
    const v = inline ?? rest.shift()
    if (v === undefined || v.startsWith('--')) throw new Failure(`${flag} needs a value.\n\n${USAGE}`)
    return v
  }
  while (rest.length) {
    const arg = rest.shift()!
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1
    const flag = eq > 0 ? arg.slice(0, eq) : arg
    const inline = eq > 0 ? arg.slice(eq + 1) : undefined
    switch (flag) {
      case '--out':
        a.out = take(flag, inline)
        break
      case '--name':
        a.name = take(flag, inline)
        break
      case '--scale': {
        const s = Number(take(flag, inline))
        if (s !== 1 && s !== 2 && s !== 4) throw new Failure('--scale must be 1, 2 or 4.')
        a.scale = s
        break
      }
      case '--labels': {
        const m = take(flag, inline)
        if (m !== 'shown' && m !== 'text' && m !== 'blank' && m !== 'letters') throw new Failure('--labels must be shown, text, blank or letters.')
        a.labels = m
        break
      }
      case '--mono':
        a.mono = true
        break
      case '--answer-key':
        a.answerKey = true
        break
      case '--transparent':
        a.transparent = true
        break
      case '--variants':
        a.variants = true
        break
      case '--no-png':
        a.png = false
        break
      case '--no-svg':
        a.svg = false
        break
      case '--explain':
        a.explain = true
        break
      case '--template':
        a.template = take(flag, inline)
        break
      case '--list':
        a.list = take(flag, inline)
        break
      case '--symbol':
        a.symbol = take(flag, inline)
        break
      case '--help':
      case '-h':
        a.help = true
        break
      default:
        if (arg.startsWith('-')) throw new Failure(`Unknown flag ${arg}.\n\n${USAGE}`)
        if (a.input !== undefined) throw new Failure(`Only one input file at a time (got ${a.input} and ${arg}).`)
        a.input = arg
    }
  }
  return a
}

// ---------------------------------------------------------------- listings

function listTemplates(): void {
  const w = Math.max(...TEMPLATES.map((t) => t.id.length))
  for (const t of TEMPLATES) console.log(`${t.id.padEnd(w)}  ${t.group.padEnd(9)}  ${t.title}  (${t.refs})`)
}

function listSymbols(): void {
  const w = Math.max(...SYMBOLS.map((s) => s.id.length))
  for (const pack of [...new Set(SYMBOLS.map((s) => s.pack))]) {
    console.log(`\n${pack}`)
    for (const s of SYMBOLS.filter((d) => d.pack === pack)) {
      console.log(`  ${s.id.padEnd(w)}  ${s.name}  ${s.size.w}x${s.size.h}  ${s.resize}${s.aliases?.length ? `  (${s.aliases.join(', ')})` : ''}`)
    }
  }
}

const directionText = (dir: number): string => ({ '-90': 'up', '90': 'down', '0': 'right', '180': 'left' })[String(dir)] ?? `${dir} degrees`
const round1 = (n: number): number => Math.round(n * 10) / 10

function describeSymbol(def: SymbolDef): void {
  const g = geometry(def.id, def.size.w, def.size.h)
  console.log(`${def.id}: ${def.name} (pack ${def.pack})`)
  if (def.aliases?.length) console.log(`aliases: ${def.aliases.join(', ')}`)
  console.log(`size ${def.size.w} × ${def.size.h} u; resize: ${def.resize}${def.min ? `; minimum ${def.min.w} × ${def.min.h}` : ''}`)
  console.log(`label text: "${labelText(def)}"; Label all ${def.autoLabel === false ? 'does not label it' : 'labels it'}`)
  console.log('parameters (params in a recipe):')
  if (!def.params?.length) console.log('  none')
  for (const p of def.params ?? []) {
    const range =
      p.type === 'number'
        ? `${p.min} to ${p.max}${p.step ? `, step ${p.step}` : ''}`
        : p.type === 'choice'
          ? p.options.map((o) => `"${o.value}"`).join(' | ')
          : ''
    console.log(`  ${p.key}: ${p.type}, default ${JSON.stringify(p.default)}${range ? `, ${range}` : ''}  (${p.label})`)
  }
  console.log(`cavities (contents in a recipe): ${(g.cavities ?? []).map((c) => c.id).join(', ') || 'none'}`)
  if (g.scale)
    console.log(`scale: in cavity "${g.scale.cavity}", from ${g.scale.v0} to ${g.scale.v1} ${g.scale.unit} ("reading" works when the symbol stands upright)`)
  console.log(`anchors, in the frame of the symbol at its default size (x = 0 is the centre line, y = 0 the top, y = ${def.size.h} the bottom):`)
  if (!g.anchors?.length) console.log('  none')
  for (const a of g.anchors ?? []) {
    console.log(
      `  ${a.id}: kind ${a.kind}, at (${round1(a.x)}, ${round1(a.y)})${a.dir !== undefined ? `, points ${directionText(a.dir)}` : ''}${a.width ? `, width ${round1(a.width)}` : ''}`,
    )
  }
}

// ---------------------------------------------------------------- problems

function printProblems(problems: Problem[], to: (s: string) => void): void {
  problems.forEach((p, i) => {
    to(`  ${i + 1}. ${p.level}${p.path ? ` at ${p.path}` : ''}`)
    to(`     ${p.message}`)
    if (p.hint) to(`     hint: ${p.hint}`)
  })
}

// ---------------------------------------------------------------- the input

interface Loaded {
  doc: Doc
  /** Warnings about the input (from the recipe compiler, or from reading a saved diagram). */
  problems: Problem[]
  /** How the parts of a recipe were placed. */
  explain: string[]
  /** The name of the input, for the file names. */
  stem: string
}

function stemOf(file: string): string {
  const base = basename(file).replace(/\.(pracdraw\.json|recipe\.json|json|svg)$/i, '')
  return base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'diagram'
}

const warnings = (messages: string[]): Problem[] => messages.map((message) => ({ level: 'warning', path: '', message, hint: '' }))

function loadInput(a: Args): Loaded {
  if (a.template) {
    const t = TEMPLATES.find((x) => x.id === a.template)
    if (!t) {
      const near = nearestNames(
        a.template,
        TEMPLATES.map((x) => x.id),
      )
      throw new Failure(
        `There is no template "${a.template}".${near.length ? ` Did you mean ${near.map((n) => `"${n}"`).join(', ')}?` : ''} List them with: npm run render -- --list templates`,
      )
    }
    return { doc: t.build(), problems: [], explain: [], stem: t.id }
  }
  const file = resolve(CWD, a.input!)
  if (!existsSync(file)) throw new Failure(`There is no file ${file}.`)
  const text = readFileSync(file, 'utf8')
  const stem = stemOf(file)
  if (/\.svg$/i.test(file) || /^﻿?\s*</.test(text)) {
    const r = docFromSvg(text)
    if (!r.ok) throw new Failure(`${file} is not a diagram that PracDraw exported:\n${r.problems.map((p) => `  ${p}`).join('\n')}`)
    return { doc: r.doc, problems: warnings(r.problems), explain: [], stem }
  }
  let value: unknown
  try {
    value = JSON.parse(text.replace(/^﻿/, ''))
  } catch (e) {
    throw new Failure(
      `${file} is not valid JSON: ${(e as Error).message}\nA recipe is a JSON file { "parts": [ ... ] }. Check the commas and the double quotes.`,
    )
  }
  if (isRecipe(value)) {
    const r = compileRecipe(value)
    if (!r.doc) {
      const errors = r.problems.filter((p) => p.level === 'error').length
      const rest = r.problems.length - errors
      const out: string[] = []
      printProblems(r.problems, (s) => out.push(s))
      throw new Failure(
        `${basename(file)} has ${errors} error${errors === 1 ? '' : 's'}${rest ? ` and ${rest} warning${rest === 1 ? '' : 's'}` : ''}. Nothing was written.\n${out.join('\n')}`,
      )
    }
    return { doc: r.doc, problems: r.problems, explain: r.explain, stem }
  }
  const r = parseDoc(value)
  if (!r.ok)
    throw new Failure(
      `${file} is neither a recipe (a JSON object with a list of "parts") nor a PracDraw diagram:\n${r.problems.map((p) => `  ${p}`).join('\n')}`,
    )
  return { doc: r.doc, problems: warnings(r.problems), explain: [], stem }
}

// ---------------------------------------------------------------- the browser

/** The newest modification time of the files in a folder, tests left out. */
function newest(dir: string): number {
  let t = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) t = Math.max(t, newest(p))
    else if (!/\.test\.tsx?$/.test(name)) t = Math.max(t, statSync(p).mtimeMs)
  }
  return t
}

/** Build dist/index.html when it is missing, or older than the source it was built from. */
function ensureBuilt(): void {
  const stale = existsSync(DIST) && newest(join(ROOT, 'src')) > statSync(DIST).mtimeMs + 1000
  if (existsSync(DIST) && !stale) return
  console.log(stale ? 'dist/index.html is older than src/: building it (npm run build).' : 'dist/index.html is missing: building it (npm run build).')
  try {
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })
  } catch {
    throw new Failure('npm run build failed, so there is no editor to draw with.', 2)
  }
}

/**
 * The width of each text as the browser draws it (canvas measureText, scripts at 0.7 size), for the texts that `run`
 * asks for. The same sum as `measureText` in src/editor/measure.ts, run in the page.
 */
async function browserMeasure(page: Page, run: (measure: Measure) => void): Promise<Measure> {
  const wanted = new Map<string, { size: number; text: string }>()
  run((text, size) => {
    wanted.set(`${size} ${text}`, { size, text })
    return estimateWidth(text, size)
  })
  const jobs = [...wanted].map(([key, { size, text }]) => ({
    key,
    runs: parseMarkup(text).map((r) => ({ text: r.text, size: r.script === 'normal' ? size : size * SCRIPT.scale })),
  }))
  const script = `(() => {
    const c = document.createElement('canvas').getContext('2d')
    return ${JSON.stringify(jobs)}.map((j) => {
      let w = 0
      for (const r of j.runs) { c.font = r.size + 'px ' + ${JSON.stringify(FONT)}; w += c.measureText(r.text).width }
      return [j.key, w]
    })
  })()`
  const table = new Map(await page.evaluate<[string, number][]>(script))
  return (text, size) => table.get(`${size} ${text}`) ?? estimateWidth(text, size)
}

// ---------------------------------------------------------------- the files

interface Planned {
  name: string
  kind: 'svg' | 'png'
  options: Partial<ExportOptions>
}

/** The pictures to make: the one the flags ask for, then the variants. A file name is used once. */
function plan(doc: Doc, stem: string, a: Args): Planned[] {
  const base: Partial<ExportOptions> = { background: a.transparent ? 'transparent' : 'white' }
  const titled = { ...doc, title: stem }
  const formats = [...(a.svg ? (['svg'] as const) : []), ...(a.png ? (['png'] as const) : [])]
  const out: Planned[] = []
  const add = (options: Partial<ExportOptions>, suffix = ''): void => {
    for (const kind of formats) {
      const name = exportName(titled, { format: kind, labels: options.labels ?? 'shown' }).replace(/\.(svg|png)$/, `${suffix}.${kind}`)
      if (!out.some((p) => p.name === name)) out.push({ name, kind, options: { ...base, ...options } })
    }
  }
  add({ labels: a.labels, mono: a.mono ? 'on' : 'shown', answerKey: a.answerKey }, a.mono ? '-mono' : '')
  if (a.variants) {
    add({ labels: 'text' })
    add({ labels: 'blank' })
    add({ labels: 'letters', answerKey: true })
    if (!doc.settings.mono) add({ labels: 'text', mono: 'on' }, '-mono')
  }
  return out
}

const pngSize = (png: Buffer): string => `${png.readUInt32BE(16)} × ${png.readUInt32BE(20)} px`
const svgSize = (svg: string): string => {
  const m = /<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/.exec(svg)
  return m ? `${m[1]} × ${m[2]} px` : ''
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2))
  if (a.help) return console.log(USAGE)
  if (a.list !== undefined) {
    if (a.list === 'templates') return listTemplates()
    if (a.list === 'symbols') return listSymbols()
    throw new Failure('--list takes "templates" or "symbols".')
  }
  if (a.symbol !== undefined) {
    if (hasSymbol(a.symbol)) return describeSymbol(symbolDef(a.symbol))
    const near = suggestSymbols(a.symbol)
    throw new Failure(
      `There is no symbol "${a.symbol}".${near.length ? ` Nearest: ${near.map((d) => `${d.id} (${d.name})`).join(', ')}.` : ''} List them with: npm run render -- --list symbols`,
    )
  }
  if (!a.input && !a.template) throw new Failure(`Give a recipe file, a saved diagram, or --template <id>.\n\n${USAGE}`)
  if (a.input && a.template) throw new Failure('Give a file or --template, not both.')

  const loaded = loadInput(a)
  const doc = loaded.doc
  const stem = a.name ? stemOf(a.name) : loaded.stem
  ensureBuilt()

  let chromium: typeof import('@playwright/test').chromium
  try {
    ;({ chromium } = await import('@playwright/test'))
  } catch (e) {
    throw new Failure(`Playwright is not installed (${(e as Error).message.split('\n')[0]}). Run npm ci in the pracdraw folder.`, 2)
  }
  const local = '/opt/pw-browsers/chromium'
  const browser = await chromium.launch(existsSync(local) ? { executablePath: local } : {}).catch((e: Error) => {
    throw new Failure(`The browser did not start: ${e.message.split('\n')[0]}\nInstall it with: npx playwright install chromium`, 2)
  })
  try {
    const context = await browser.newContext()
    // The editor makes no request. Anything but the built file, data: and blob: is refused and stops the run.
    const outside: string[] = []
    await context.route(/^(https?|wss?|ftp):/, (route) => {
      outside.push(route.request().url())
      return route.abort()
    })
    const page = await context.newPage()
    page.on('request', (r) => {
      if (!/^(file|data|blob|about):/.test(r.url())) outside.push(r.url())
    })
    await page.goto(pathToFileURL(DIST).href)
    await page.waitForFunction('!!window.__pracdraw')
    // A build from before the hook took export options would draw every variant the same.
    if ((await page.evaluate<number>('window.__pracdraw.svg.length')) < 1)
      throw new Failure('dist/index.html is out of date (its test hook takes no options). Run: npm run build', 2)
    await page.evaluate(`window.__pracdraw.load(${JSON.stringify(doc)})`)

    // The checks and the description, with the widths of the texts as this browser draws them.
    const describe = (measure: Measure, verbose: boolean) => describeDoc(doc, { measure, verbose, problems: checkDoc(doc, measure) })
    const measure = await browserMeasure(page, (m) => describe(m, a.explain))
    const checks = checkDoc(doc, measure)

    const files: { name: string; data: Buffer | string; info: string }[] = []
    for (const p of plan(doc, stem, a)) {
      const options = JSON.stringify(p.options)
      if (p.kind === 'svg') {
        const svg = await page.evaluate<string>(`window.__pracdraw.svg(${options})`)
        files.push({ name: p.name, data: svg, info: svgSize(svg) })
      } else {
        const url = await page.evaluate<string>(`window.__pracdraw.png(${a.scale}, ${options})`)
        const png = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
        files.push({ name: p.name, data: png, info: pngSize(png) })
      }
    }
    files.push({ name: `${stem}.pracdraw.json`, data: `${saveText(doc)}\n`, info: 'the document' })
    if (outside.length) throw new Failure(`The editor asked for the network (${[...new Set(outside)].join(', ')}). It must not: nothing was written.`, 2)

    const dir = resolve(CWD, a.out)
    mkdirSync(dir, { recursive: true })
    for (const f of files) writeFileSync(join(dir, f.name), f.data)
    for (const f of files) {
      const bytes = typeof f.data === 'string' ? Buffer.byteLength(f.data) : f.data.length
      console.log(`wrote ${join(a.out, f.name)}  ${f.info}  ${bytes.toLocaleString('en-GB')} bytes`)
    }
    console.log('network requests: 0')
    console.log('')
    if (a.explain && loaded.explain.length) {
      console.log('placement:')
      for (const line of loaded.explain) console.log(`  ${line}`)
      console.log('')
    }
    console.log(describe(measure, a.explain))
    if (loaded.problems.length) {
      console.log('')
      console.log(`warnings from the input (${loaded.problems.length}):`)
      printProblems(loaded.problems, (s) => console.log(s))
    }
    if (checks.length) {
      console.log('')
      console.log('layout warnings, with hints:')
      printProblems(checks, (s) => console.log(s))
    }
  } finally {
    await browser.close()
  }
}

main().catch((e: unknown) => {
  if (e instanceof Failure) {
    if (e.message) console.error(e.message)
    process.exit(e.code)
  }
  console.error(e instanceof Error ? (e.stack ?? e.message) : String(e))
  process.exit(2)
})
