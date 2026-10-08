// render.ts — the hands-free pipeline for lesson diagrams. Run: npm run render -- <recipe.json> [flags]
//
//   npm run render -- <recipe.json | file.pracdraw.json | file.svg> [--out <dir>] [--name <slug>] [--scale 1|2|4]
//                     [--labels shown|text|blank|letters] [--mono] [--answer-key] [--transparent]
//                     [--variants] [--student] [--no-png] [--no-svg] [--explain]
//   npm run render -- --template <id> [same flags]
//   npm run render -- --list templates | symbols
//   npm run render -- --symbol <id>
//   npm run render -- --find <words>
//
// A recipe (src/model/recipe.ts) or a saved diagram is opened in the built editor (dist/index.html, from file://, in
// headless Chromium), and the pictures come from the editor's own test hook, so they are exactly the editor's: the SVG
// with the editable document in its metadata, the PNG, and the document itself.
//
// Exit code 1: the command or its input is wrong (one line on the error output, or the numbered list of the problems of a
// recipe), found before the browser starts, and nothing is written. Exit code 2: the browser or the build failed. Warnings
// do not change the exit code. The same input gives the same bytes. It needs no network: a request to anywhere but the
// built file stops it.
//
// The name of a picture says what is in it: <name>, then -blank, -letters or -letters-key for the labels (text has no
// suffix), then -mono when it is photocopy-safe. --variants writes every label mode; --student writes the copies for
// students only (PNG, no answers).
//
// The checks of the layout are made once, for the picture that the flags ask for. A blank copy has one more fault, a label
// wider than the 100 u line to write on, which a slide has not: it is listed under the file line of each blank picture.

import { execFileSync } from 'node:child_process'
import { accessSync, constants, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Page } from '@playwright/test'
import { answerKey } from '../src/export/answerKey.ts'
import { MAX_AREA, MAX_SIDE, safeScale } from '../src/export/canvas.ts'
import { exportName, saveText } from '../src/export/files.ts'
import { exportDoc, showsKey, type ExportOptions } from '../src/export/picture.ts'
import { docFromSvg, svgMetadata } from '../src/export/svg.ts'
import { FONT, SCRIPT } from '../src/kernel/nodes.ts'
import { parseMarkup } from '../src/kernel/text.ts'
import { docBounds, drawnBox, type Measure, estimateWidth } from '../src/model/bounds.ts'
import { MAX_LISTED, checkBlankCopy, checkLayout, describeDoc, listed, measuredTexts } from '../src/model/check.ts'
import { SYMBOL_SIZE, parseDoc } from '../src/model/parse.ts'
import { compileRecipe, isRecipe, nearestNames, suggestSymbols, type Problem } from '../src/model/recipe.ts'
import type { Doc } from '../src/model/types.ts'
import { SYMBOLS, geometry, hasSymbol, labelText, symbolDef } from '../src/symbols/registry.ts'
import type { SymbolDef } from '../src/symbols/types.ts'
import { TEMPLATES } from '../src/templates/index.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist', 'index.html')
/** Where relative paths on the command line are relative to: the directory `npm run` was started in. */
const CWD = process.env.INIT_CWD ?? process.cwd()

/** The longest name for the files, in characters. */
const NAME_LIMIT = 100
/** A picture wider or taller than this, in units, is not a lesson diagram: it is a wrong number. */
const PICTURE_LIMIT = 4000

const USAGE = `Usage:
  npm run render -- <recipe.json | file.pracdraw.json | file.svg> [flags]
  npm run render -- --template <id> [flags]
  npm run render -- --list templates | symbols
  npm run render -- --symbol <id>
  npm run render -- --find <words>

Flags:
  --out <dir>        where the files go (default ./lesson-diagrams)
  --name <slug>      the file name stem (default: the name of the input file, or the template id; at most ${NAME_LIMIT} characters)
  --scale 1|2|4      PNG pixels for each unit (default 2)
  --labels <mode>    shown (as the diagram is saved, the default), text, blank or letters
  --mono             photocopy-safe: black line only, dashes for liquids (every file of the run, named -mono)
  --answer-key       with --labels letters: the answer key under the diagram (the file is named -letters-key)
  --transparent      a transparent background instead of white
  --variants         every label mode: <name> (text), -blank, -letters (no key), -letters-key (with the key), and -mono
  --student          PNG files for students only: no SVG, no saved diagram (both hold the label texts), no key.
                     With --labels blank or letters, or with --variants (the blank and letters copies)
  --no-png, --no-svg leave that file out
  --explain          also show how each part was placed, and every anchor with its kind and direction
Files: <name>.svg (the editable document is in its metadata), <name>.png and <name>.pracdraw.json, with the suffixes above.
--find <words> lists the symbols and templates that match: npm run render -- --find filter funnel`

/** Something that stops the command: the message goes to the error output (nothing if it is empty) and the exit code is `code`. */
class Failure extends Error {
  code: number
  constructor(message: string, code = 1) {
    super(message)
    this.code = code
  }
}

// A reader that closes the pipe early (`--list symbols | head -3`) is no error.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EPIPE') process.exit(0)
    throw e
  })
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
  student: boolean
  png: boolean
  svg: boolean
  explain: boolean
  template?: string
  list?: string
  symbol?: string
  find?: string[]
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
    student: false,
    png: true,
    svg: true,
    explain: false,
    help: false,
  }
  const rest = [...argv]
  const take = (flag: string, inline: string | undefined): string => {
    const v = inline ?? rest.shift()
    if (v === undefined || v.startsWith('--')) throw new Failure(`${flag} needs a value: npm run render -- --help`)
    return v
  }
  let finding = false
  while (rest.length) {
    const arg = rest.shift()!
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1
    const flag = eq > 0 ? arg.slice(0, eq) : arg
    const inline = eq > 0 ? arg.slice(eq + 1) : undefined
    if (flag !== '--find' && flag.startsWith('-')) finding = false
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
      case '--student':
        a.student = true
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
      case '--find':
        a.find = inline === undefined ? [] : [inline]
        finding = inline === undefined
        break
      case '--help':
      case '-h':
        a.help = true
        break
      default:
        if (finding && !arg.startsWith('-')) {
          a.find!.push(arg)
          break
        }
        if (arg.startsWith('-')) throw new Failure(`Unknown flag ${arg}: the flags are listed by npm run render -- --help`)
        if (a.input !== undefined) throw new Failure(`Only one input file at a time (got ${a.input} and ${arg}).`)
        a.input = arg
    }
  }
  return a
}

/** The usage errors that are known from the flags alone. */
function checkFlags(a: Args): void {
  if (a.student && a.answerKey) throw new Failure('--student never writes the answer key: leave out --answer-key.')
  if (a.student && !a.png) throw new Failure('--student writes PNG files only: leave out --no-png.')
  if (a.student && a.labels === 'text') {
    throw new Failure('--student writes copies with no label text: use --labels blank or --labels letters, or --variants for both.')
  }
  if (a.answerKey && !a.variants && a.labels !== 'letters' && a.labels !== 'shown') throw new Failure('--answer-key goes with letters: add --labels letters.')
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

interface Plan {
  id: string
  title: string
  group: string
  refs: string
  uses: string[]
  notes: string
}

/** The words of an id such as "roundBottomFlask", for a search: "round bottom flask". */
const spaced = (id: string): string => id.replace(/([a-z0-9])([A-Z])/g, '$1 $2')

/**
 * The symbols and the templates that match every word: in the id, the name, the aliases or the pack of a symbol; in the id,
 * the title, the group, the practicals or the set-up note of a template. One line for each hit, best first.
 */
function find(words: readonly string[]): void {
  const wanted = words.map((w) => w.toLowerCase()).filter(Boolean)
  if (!wanted.length) throw new Failure('--find needs words: npm run render -- --find filter funnel')
  const notes = new Map<string, Plan>()
  try {
    const plans = JSON.parse(readFileSync(join(ROOT, 'spec', 'templates.json'), 'utf8')) as { templates: Plan[] }
    for (const p of plans.templates) notes.set(p.id, p)
  } catch {
    // The notes are a help: without them the titles are searched.
  }
  type Hit = { score: number; line: string }
  const hits: Hit[] = []
  for (const d of SYMBOLS) {
    const main = `${spaced(d.id)} ${d.name}`.toLowerCase()
    const aliases = (d.aliases ?? []).join(' ').toLowerCase()
    const all = `${main} ${aliases}`
    if (!wanted.every((w) => all.includes(w))) continue
    const inMain = wanted.filter((w) => main.includes(w)).length
    const alias = (d.aliases ?? []).filter((x) => wanted.some((w) => x.toLowerCase().includes(w)))
    const exact = main.split(' ').includes(wanted.join('')) || d.id.toLowerCase() === wanted.join('')
    hits.push({
      score: (exact ? 100 : 0) + inMain * 10 + (main.startsWith(wanted[0]) ? 5 : 0),
      line: `symbol    ${d.id}  ${d.name}  (${d.pack})${alias.length && inMain < wanted.length ? `  also called: ${alias.join(', ')}` : ''}`,
    })
  }
  for (const t of TEMPLATES) {
    const plan = notes.get(t.id)
    const main = `${spaced(t.id)} ${t.title}`.toLowerCase()
    const all = `${main} ${t.group} ${t.refs} ${plan?.notes ?? ''} ${(plan?.uses ?? []).join(' ')}`.toLowerCase()
    if (!wanted.every((w) => all.includes(w))) continue
    const inMain = wanted.filter((w) => main.includes(w)).length
    hits.push({ score: inMain * 10 - 1, line: `template  ${t.id}  ${t.title}  (${t.group})` })
  }
  hits.sort((x, y) => y.score - x.score || x.line.localeCompare(y.line))
  if (!hits.length) {
    const near = suggestSymbols(wanted.join(' '), 5)
    console.log(`Nothing matches "${wanted.join(' ')}".${near.length ? ` The nearest symbols: ${near.map((d) => `${d.id} (${d.name})`).join(', ')}.` : ''}`)
    console.log('Try one word, or a shorter word: npm run render -- --find funnel. The whole list: npm run render -- --list symbols')
    return
  }
  for (const h of hits.slice(0, 40)) console.log(h.line)
  if (hits.length > 40) console.log(`and ${hits.length - 40} more: use more words`)
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

/** The problems as a numbered list: where, what, and the hint that names the fix. At most 25, and a count of the rest. */
function printProblems(problems: Problem[], to: (s: string) => void): void {
  const { shown, more } = listed(problems)
  shown.forEach((p, i) => {
    to(`  ${i + 1}. ${p.level}${p.path ? ` at ${p.path}` : ''}`)
    to(`     ${p.message}`)
    if (p.hint) to(`     hint: ${p.hint}`)
  })
  if (more) to(`  and ${more} more`)
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

/** A name for files from a name or a path: its last part, without .json or .svg, with only letters, digits, . _ and -. */
function cleanName(raw: string): string {
  const base = basename(raw).replace(/\.(pracdraw\.json|recipe\.json|json|svg)$/i, '')
  return base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '')
}

/** The stem of the file names: --name, or the name of the input; an error when it is empty or too long. */
function stemOf(a: Args, fallback: string): string {
  if (a.name !== undefined) {
    if (a.name === '') throw new Failure('--name must not be empty.')
    const clean = cleanName(a.name)
    if (a.name.length > NAME_LIMIT) throw new Failure(`--name is ${a.name.length} characters, and the most is ${NAME_LIMIT}.`)
    if (!clean) throw new Failure(`--name "${a.name}" has nothing left after cleaning: use letters, digits, . _ or -.`)
    return clean
  }
  if (fallback.length > NAME_LIMIT) throw new Failure(`The name of the input is ${fallback.length} characters, too long for file names: give --name <slug>.`)
  return fallback || 'diagram'
}

const warnings = (messages: string[]): Problem[] => messages.map((message) => ({ level: 'warning', path: '', message, hint: '' }))

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A saved diagram with a part of an impossible size: the editor would crash or take a size of its own, so it is not drawn. */
function sizeProblems(value: unknown): Problem[] {
  const out: Problem[] = []
  const items = isObject(value) && isObject(value.items) ? value.items : {}
  for (const [id, it] of Object.entries(items)) {
    if (!isObject(it) || it.type !== 'symbol') continue
    for (const key of ['w', 'h'] as const) {
      const v = it[key]
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || (v >= SYMBOL_SIZE.min && v <= SYMBOL_SIZE.max)) continue
      out.push({
        level: 'error',
        path: `items.${id}.${key}`,
        message: `The ${key === 'w' ? 'width' : 'height'} of the part "${id}" (${typeof it.symbol === 'string' ? it.symbol : 'symbol'}) is ${v} u.`,
        hint: `A part is from ${SYMBOL_SIZE.min} to ${SYMBOL_SIZE.max} u: a thermometer is about 200 u tall, a beaker 120. Open the file in a text editor and put a number in "${key}" that a part can have.`,
      })
    }
  }
  return out
}

/** The input is a file that can be read: not a folder, not missing, not locked. The text of the file. */
function readInput(file: string, given: string): string {
  if (!existsSync(file)) throw new Failure(`There is no file "${given}".`)
  if (statSync(file).isDirectory())
    throw new Failure(`"${given}" is a folder: give a recipe (.json), a saved diagram (.pracdraw.json) or an SVG that PracDraw wrote.`)
  try {
    return readFileSync(file, 'utf8')
  } catch (e) {
    throw new Failure(`Cannot read "${given}": ${(e as NodeJS.ErrnoException).code ?? 'unreadable'}.`)
  }
}

function rejected(file: string, problems: Problem[]): Failure {
  const errors = problems.filter((p) => p.level === 'error').length
  const rest = problems.length - errors
  const out: string[] = []
  printProblems(problems, (s) => out.push(s))
  return new Failure(
    `${basename(file)} has ${errors} error${errors === 1 ? '' : 's'}${rest ? ` and ${rest} warning${rest === 1 ? '' : 's'}` : ''}. Nothing was written.\n${out.join('\n')}`,
  )
}

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
    return { doc: t.build(), problems: [], explain: [], stem: stemOf(a, t.id) }
  }
  const file = resolve(CWD, a.input!)
  const text = readInput(file, a.input!)
  const stem = stemOf(a, cleanName(file))
  if (/\.svg$/i.test(file) || /^﻿?\s*</.test(text)) {
    const meta = svgMetadata(text)
    if (meta) {
      try {
        const bad = sizeProblems(JSON.parse(meta))
        if (bad.length) throw rejected(file, bad)
      } catch (e) {
        if (e instanceof Failure) throw e
      }
    }
    const r = docFromSvg(text)
    if (!r.ok) throw new Failure(`${a.input} is not a diagram that PracDraw exported: ${r.problems.join(' ')}`)
    return { doc: r.doc, problems: warnings(r.problems), explain: [], stem }
  }
  let value: unknown
  try {
    value = JSON.parse(text.replace(/^﻿/, ''))
  } catch (e) {
    throw new Failure(
      `"${a.input}" is not valid JSON (${(e as Error).message}): a recipe is a JSON file { "parts": [ ... ] }, so check the commas and the double quotes.`,
    )
  }
  if (isRecipe(value)) {
    const r = compileRecipe(value)
    if (!r.doc) throw rejected(file, r.problems)
    return { doc: r.doc, problems: r.problems, explain: r.explain, stem }
  }
  const bad = sizeProblems(value)
  if (bad.length) throw rejected(file, bad)
  const r = parseDoc(value)
  if (!r.ok) {
    throw new Failure(`"${a.input}" is neither a recipe (a JSON object with a list of "parts") nor a PracDraw diagram: ${r.problems.join(' ')}`)
  }
  return { doc: r.doc, problems: warnings(r.problems), explain: [], stem }
}

/** A path as short as it can be: relative to where the command was run, unless that goes up. */
function shown(path: string): string {
  const r = relative(CWD, path)
  return r && !r.startsWith('..') ? r : path
}

/** The folder for the files can be made: no file is in its way, and the nearest folder that exists can be written in. */
function checkOut(out: string): string {
  const full = resolve(CWD, out)
  for (let at = full; ; at = dirname(at)) {
    if (existsSync(at)) {
      if (!statSync(at).isDirectory()) {
        throw new Failure(at === full ? `--out "${out}" is a file, not a folder.` : `--out "${out}" cannot be made: "${shown(at)}" is a file, not a folder.`)
      }
      try {
        accessSync(at, constants.W_OK)
      } catch {
        throw new Failure(`--out "${out}": there is no permission to write in "${shown(at)}".`)
      }
      return full
    }
    if (dirname(at) === at) return full
  }
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

/**
 * Build dist/index.html when it is missing, or older than the source it was built from. `vite build` alone, not
 * `npm run build`: the check of the types in front of it takes ten seconds, and the pictures do not need it.
 */
function ensureBuilt(): void {
  const stale = existsSync(DIST) && newest(join(ROOT, 'src')) > statSync(DIST).mtimeMs + 1000
  if (existsSync(DIST) && !stale) return
  console.log(stale ? 'dist/index.html is older than src/: building it (vite build).' : 'dist/index.html is missing: building it (vite build).')
  try {
    execFileSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' })
  } catch {
    throw new Failure('vite build failed, so there is no editor to draw with: run npm run build in the pracdraw folder to see why.', 2)
  }
}

/**
 * The width of each text as the browser draws it (canvas measureText, scripts at 0.7 size), for the texts that the checks,
 * the description and the export measure. The same sum as `measureText` in src/editor/measure.ts, run in the page.
 */
async function browserMeasure(page: Page, texts: readonly { text: string; size: number }[]): Promise<Measure> {
  const jobs = texts.map(({ text, size }) => ({
    key: `${size} ${text}`,
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

/** What a picture shows: its labels, whether the answer key is under it, and whether it is photocopy-safe. */
interface Pic {
  labels: 'text' | 'blank' | 'letters'
  key: boolean
  mono: boolean
}

interface Planned {
  name: string
  kind: 'svg' | 'png'
  pic: Pic
  options: Partial<ExportOptions>
}

/** The picture that the flags ask for: the labels of the diagram unless --labels says, with the key when it is asked for, photocopy-safe when it is. */
function basePic(doc: Doc, a: Args): Pic {
  const own = a.labels === 'shown' ? doc.settings.labelMode : a.labels
  return { labels: own, key: a.answerKey && own === 'letters', mono: a.mono || doc.settings.mono }
}

/** The pictures of a run. The one the flags ask for; with --variants every label mode; with --student only the copies with no answers. */
function pictures(doc: Doc, a: Args): Pic[] {
  const base = basePic(doc, a)
  const mono = base.mono
  if (a.student)
    return a.variants
      ? [
          { labels: 'blank', key: false, mono },
          { labels: 'letters', key: false, mono },
        ]
      : [base]
  if (!a.variants) return [base]
  const all: Pic[] = [
    { labels: 'text', key: false, mono },
    { labels: 'blank', key: false, mono },
    { labels: 'letters', key: false, mono },
    { labels: 'letters', key: true, mono },
  ]
  // The photocopy-safe copy of the picture as it is shown.
  if (!mono) all.push({ ...base, mono: true })
  return all
}

/** The name of a file: the stem, -blank, -letters or -letters-key for the labels, -mono when it is photocopy-safe. */
function fileNameOf(doc: Doc, stem: string, pic: Pic, kind: 'svg' | 'png'): string {
  const name = exportName({ ...doc, title: stem }, { format: kind, labels: pic.labels })
  return name.replace(/\.(svg|png)$/, `${pic.key ? '-key' : ''}${pic.mono ? '-mono' : ''}.$1`)
}

/** What a picture is for, in a few words: the line that is printed after its name. */
function purposeOf(pic: Pic, kind: 'svg' | 'png'): string {
  const what =
    pic.labels === 'text'
      ? 'the labels as text: has the answers'
      : pic.labels === 'blank'
        ? 'student copy: a line to write on, no answers'
        : pic.key
          ? 'mark scheme: letters with the key under the diagram, has the answers'
          : 'student copy: letters, no answers'
  const mono = pic.mono ? ', photocopy-safe' : ''
  return kind === 'svg' && pic.labels !== 'text' ? `${what}${mono}; the SVG holds the label texts, so give students the PNG` : `${what}${mono}`
}

function plan(doc: Doc, stem: string, a: Args): Planned[] {
  const formats = [...(a.svg && !a.student ? (['svg'] as const) : []), ...(a.png ? (['png'] as const) : [])]
  const out: Planned[] = []
  for (const pic of pictures(doc, a)) {
    for (const kind of formats) {
      const name = fileNameOf(doc, stem, pic, kind)
      if (out.some((p) => p.name === name)) continue
      out.push({
        name,
        kind,
        pic,
        options: { background: a.transparent ? 'transparent' : 'white', labels: pic.labels, answerKey: pic.key, mono: pic.mono ? 'on' : 'off' },
      })
    }
  }
  return out
}

/** The size of a picture in units, as `exportPicture` makes it, without drawing it. */
function pictureSize(doc: Doc, pic: Pic, measure: Measure): { w: number; h: number } {
  const o = { labels: pic.labels, mono: pic.mono ? ('on' as const) : ('off' as const), answerKey: pic.key }
  const d = exportDoc(doc, o)
  const drawn = showsKey(doc, o) ? drawnBox(d, measure) : null
  const key = drawn ? answerKey(d, drawn, measure) : null
  const b = docBounds(d, measure, key?.box ?? null)
  const x = Math.floor(b.x),
    y = Math.floor(b.y)
  return { w: Math.max(1, Math.ceil(b.x + b.w) - x), h: Math.max(1, Math.ceil(b.y + b.h) - y) }
}

const pngSize = (png: Buffer): { w: number; h: number } => ({ w: png.readUInt32BE(16), h: png.readUInt32BE(20) })
const svgSize = (svg: string): string => {
  const m = /<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/.exec(svg)
  return m ? `${m[1]} × ${m[2]} px` : ''
}

/**
 * The lines that go under the file line of a blank copy: each fault of that copy (at most 25, and a count of the rest), then
 * the fix once. A slide has no line to write on, so only a blank copy has them.
 */
function blankCopyLines(problems: readonly Problem[]): string[] {
  const { shown, more } = listed(problems)
  const lower = (s: string): string => s.charAt(0).toLowerCase() + s.slice(1)
  const hints = [...new Set(shown.map((p) => p.hint).filter(Boolean))]
  return [...shown.map((p) => `blank copy: ${lower(p.message)}`), ...(more ? [`and ${more} more`] : []), ...hints.map((h) => `hint: ${h}`)]
}

/** What this render makes of the diagram, for the header of the description. */
function renderNote(a: Args, base: Pic): string {
  const parts = [`labels ${base.labels}${base.key ? ' with the key' : ''}`, `photocopy-safe ${base.mono ? 'on' : 'off'}`]
  if (a.variants) parts.push(a.student ? 'the blank and letters copies' : 'and every other label mode')
  if (a.student) parts.push('student copies')
  return parts.join(', ')
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
  if (a.find !== undefined) return find(a.find)
  if (a.symbol !== undefined) {
    if (hasSymbol(a.symbol)) return describeSymbol(symbolDef(a.symbol))
    const near = suggestSymbols(a.symbol)
    throw new Failure(
      `There is no symbol "${a.symbol}".${near.length ? ` Nearest: ${near.map((d) => `${d.id} (${d.name})`).join(', ')}.` : ''} List them with: npm run render -- --list symbols`,
    )
  }
  if (!a.input && !a.template) throw new Failure('Give a recipe file, a saved diagram, or --template <id>: npm run render -- --help')
  if (a.input && a.template) throw new Failure('Give a file or --template, not both.')
  checkFlags(a)

  // Everything that can be wrong with the command and its input is found here, before the browser starts.
  const dir = checkOut(a.out)
  const loaded = loadInput(a)
  const doc = loaded.doc
  const stem = loaded.stem
  const base = basePic(doc, a)
  if (a.student && !a.variants && base.labels === 'text') {
    throw new Failure('--student writes copies with no label text: use --labels blank or --labels letters, or --variants for both.')
  }
  if (a.answerKey && !a.variants && base.labels !== 'letters') throw new Failure('--answer-key goes with letters: add --labels letters.')
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

    // The text widths as this browser draws them; then the checks, once. The checks of the layout are those of every picture.
    // What only a blank copy has (a label wider than its line) is listed with the file of each blank picture, below.
    const measure = await browserMeasure(page, measuredTexts(doc))
    const checks: Problem[] = checkLayout(doc, measure)
    const blankCopy = checkBlankCopy(doc, measure)
    const size = pictureSize(doc, base, measure)
    if (size.w > PICTURE_LIMIT || size.h > PICTURE_LIMIT) {
      checks.push({
        level: 'warning',
        path: '',
        message: `The picture is ${size.w} × ${size.h} u, larger than ${PICTURE_LIMIT} u on a side: a lesson diagram is rarely more than 1200 u across.`,
        hint: 'Bring the parts closer, or make two diagrams. A number that is 10 times too big (a dx of 3000 for 300) is the usual cause.',
      })
    }

    const files: { name: string; data: Buffer | string; info: string; purpose: string; pic?: Pic; notes?: string[] }[] = []
    const planned = plan(doc, stem, a)
    for (const p of planned) {
      const options = JSON.stringify(p.options)
      if (p.kind === 'svg') {
        const svg = await page.evaluate<string>(`window.__pracdraw.svg(${options})`)
        files.push({ name: p.name, data: svg, info: svgSize(svg), purpose: purposeOf(p.pic, 'svg'), pic: p.pic })
      } else {
        const url = await page.evaluate<string>(`window.__pracdraw.png(${a.scale}, ${options})`)
        const png = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
        const px = pngSize(png)
        files.push({ name: p.name, data: png, info: `${px.w} × ${px.h} px`, purpose: purposeOf(p.pic, 'png'), pic: p.pic })
        // The editor keeps a PNG inside what a browser can draw: a big picture at a big scale is made smaller.
        const unit = pictureSize(doc, p.pic, measure)
        if (safeScale(unit.w, unit.h, a.scale) < a.scale - 1e-9) {
          checks.push({
            level: 'warning',
            path: p.name,
            message: `The PNG ${p.name} is ${px.w} × ${px.h} px, not ${a.scale} × the picture (${unit.w} × ${unit.h} u).`,
            hint: `The editor keeps a PNG to ${MAX_SIDE} px on a side and ${MAX_AREA / 1e6} million pixels in all. Use a smaller --scale, or a smaller diagram.`,
          })
        }
      }
    }
    // The faults of a blank copy go under the last file of each picture that is written as blank (and no other picture has them).
    // When no blank picture is written (--no-png --no-svg) but the picture that the flags ask for is blank, the checks list them.
    const blankPictures = [...new Set(planned.map((p) => p.pic).filter((pic) => pic.labels === 'blank'))]
    if (blankCopy.length) {
      for (const pic of blankPictures) {
        const mine = files.filter((f) => f.pic === pic)
        if (mine.length) mine[mine.length - 1].notes = blankCopyLines(blankCopy)
      }
      if (!blankPictures.length && base.labels === 'blank') checks.push(...blankCopy)
    }
    if (!a.student)
      files.push({
        name: `${stem}.pracdraw.json`,
        data: `${saveText(doc)}\n`,
        info: 'the document',
        purpose: "the diagram, for editing: it holds the label texts, so it is the teacher's copy",
      })
    if (outside.length) throw new Failure(`The editor asked for the network (${[...new Set(outside)].join(', ')}). It must not: nothing was written.`, 2)

    try {
      mkdirSync(dir, { recursive: true })
      for (const f of files) writeFileSync(join(dir, f.name), f.data)
    } catch (e) {
      throw new Failure(`Cannot write the files to "${a.out}": ${(e as NodeJS.ErrnoException).code ?? (e as Error).message}.`)
    }
    for (const f of files) {
      const bytes = typeof f.data === 'string' ? Buffer.byteLength(f.data) : f.data.length
      console.log(`wrote ${join(a.out, f.name)}  ${f.info}  ${bytes.toLocaleString('en-GB')} bytes  ${f.purpose}`)
      for (const note of f.notes ?? []) console.log(`  ${note}`)
    }
    if (a.student) {
      console.log(
        "student copies only: the SVG and the saved diagram (the source) are not written, because they hold the label texts. The teacher's copy comes from a normal run, without --student.",
      )
    } else if (files.some((f) => f.purpose.startsWith('student copy'))) {
      console.log('Give students only the PNG files marked student copy: an SVG or the .pracdraw.json holds the label texts.')
    }
    console.log('network requests: 0')
    console.log('')
    if (a.explain && loaded.explain.length) {
      console.log('placement:')
      for (const line of loaded.explain) console.log(`  ${line}`)
      console.log('')
    }
    console.log(describeDoc(doc, { measure, verbose: a.explain, problems: checks, render: renderNote(a, base) }))
    if (loaded.problems.length) {
      console.log('')
      console.log(`warnings from the input (${loaded.problems.length}):`)
      printProblems(loaded.problems, (s) => console.log(s))
    }
    if (checks.length) {
      console.log('')
      console.log(`layout warnings, with hints${checks.length > MAX_LISTED ? ` (the first ${MAX_LISTED} of ${checks.length})` : ''}:`)
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
