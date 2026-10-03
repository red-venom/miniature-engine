// sheet.ts — pictures for visual review. Run: npm run sheet [pack | templates]
// Writes to out/, as SVG and PNG:
//   reference                      the style reference (src/demo.ts)
//   sheet-<pack>-plain             each symbol at its default size, with its nominal box and centre line
//   sheet-<pack>-filled            the same, with every cavity half full
//   sheet-<pack>-mono-turned       photocopy-safe, turned 30° and flipped, scale numbers on
//   sheet-<pack>-anchors           each anchor: a dot, its direction and its id
//   template-<id>-<label mode>     each template as a teacher exports it (text, blank)
// Review rule: open every PNG and check each symbol against the checklist in section 5 of the specification.
// The script fails when it cannot write the PNG files, because a review needs them.

import { mkdirSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { svgDocument, translate, type Node } from '../src/kernel/nodes.ts'
import { demoDoc, DEMO_SIZE } from '../src/demo.ts'
import { DocBuilder } from '../src/model/build.ts'
import { docNodes, estimateBounds, textNodes } from '../src/render/render.ts'
import { SYMBOLS, geometry } from '../src/symbols/registry.ts'
import type { SymbolDef } from '../src/symbols/types.ts'
import { TEMPLATES } from '../src/templates/index.ts'

const CELL = { w: 240, h: 300, pad: 22, cols: 5 }
const VARIANTS = ['plain', 'filled', 'mono-turned', 'anchors'] as const
type Variant = (typeof VARIANTS)[number]
const MARK = '#d6249f'

function cell(def: SymbolDef, variant: Variant): Node[] {
  const turned = variant === 'mono-turned'
  const b = new DocBuilder()
  b.doc.settings.mono = turned
  const g = geometry(def.id, def.size.w, def.size.h)
  const contents =
    variant === 'filled' || turned
      ? Object.fromEntries((g.cavities ?? []).map((c) => [c.id, [{ kind: 'liquid' as const, amount: 0.5, colour: '#cfe8f7' }]]))
      : {}
  // The turned sheet shows scale numbers, so that mirrored text would be seen.
  const params: Record<string, boolean> = turned && def.params?.some((p) => p.key === 'numbers' && p.type === 'boolean') ? { numbers: true } : {}
  b.symbol(def.id, { x: 0, y: 0, rot: turned ? 30 : 0, flip: turned, contents, params })
  // Fit the symbol in the cell. Small symbols are shown at 100 %, never enlarged.
  const box = Math.max(def.size.w, def.size.h) * (turned ? 1.25 : 1) + 60
  const k = Math.min(1, (Math.min(CELL.w, CELL.h - 40) - CELL.pad) / box)
  const cx = CELL.w / 2,
    cy = (CELL.h - 40) / 2 + 6
  // Faint nominal box and centre line, so that a symbol that is off-centre or outside its box shows up at once.
  const { w, h } = def.size
  const guide: Node = {
    t: 'path',
    stroke: '#e58a8a',
    sw: 0.75 / k,
    dash: [3 / k, 3 / k],
    d: turned ? '' : `M${-w / 2} ${-h / 2}H${w / 2}V${h / 2}H${-w / 2}ZM0 ${-h / 2 - 8}V${h / 2 + 8}`,
  }
  const marks: Node[] = []
  if (variant === 'anchors') {
    const placed: { x: number; y: number }[] = [] // anchors close together: stack their names
    for (const a of g.anchors ?? []) {
      const n = placed.filter((q) => Math.abs(q.x - a.x) < 40 / k && Math.abs(q.y - a.y) < 12 / k).length
      placed.push(a)
      const x = a.x,
        y = a.y - h / 2,
        r = 2.5 / k
      let d = `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
      if (a.dir !== undefined) {
        const t = (a.dir * Math.PI) / 180
        d += `M${x} ${y}L${x + (12 / k) * Math.cos(t)} ${y + (12 / k) * Math.sin(t)}`
      }
      if (a.width) d += `M${x - a.width / 2} ${y}H${x + a.width / 2}` // drawn level: right for anchors that face up or down
      marks.push({ t: 'path', d, fill: MARK, stroke: MARK, sw: 1 / k })
      marks.push({
        t: 'text',
        x: x + 4 / k,
        y: y - (4 + 10 * n) / k,
        size: 9 / k,
        anchor: 'start',
        fill: MARK,
        runs: [{ text: `${a.id}:${a.kind}`, script: 'normal' }],
      })
    }
  }
  return [
    { t: 'g', m: [k, 0, 0, k, cx, cy], kids: [guide, ...docNodes(b.doc), ...marks] },
    ...textNodes(cx, CELL.h - 24, def.id, 13, 'middle', false),
    ...textNodes(cx, CELL.h - 9, `${w} × ${h}  ·  ${def.resize}${k < 1 ? `  ·  shown at ${Math.round(k * 100)} %` : ''}`, 10, 'middle', false),
  ]
}

function sheet(defs: SymbolDef[], variant: Variant): { svg: string; w: number; h: number } {
  const rows = Math.ceil(defs.length / CELL.cols),
    w = CELL.cols * CELL.w,
    h = rows * CELL.h
  const nodes: Node[] = defs.map((def, i) => ({ t: 'g', m: translate((i % CELL.cols) * CELL.w, Math.floor(i / CELL.cols) * CELL.h), kids: cell(def, variant) }))
  let grid = ''
  for (let c = 1; c < CELL.cols; c++) grid += `M${c * CELL.w} 0V${h}`
  for (let r = 1; r < rows; r++) grid += `M0 ${r * CELL.h}H${w}`
  nodes.unshift({ t: 'path', d: grid, stroke: '#dddddd', sw: 1 })
  return { svg: svgDocument(nodes, w, h, '#ffffff'), w, h }
}

const packs = [...new Set(SYMBOLS.map((s) => s.pack))]
const only = process.argv[2] // optional: one pack, or "templates"
if (only && only !== 'templates' && !packs.includes(only as SymbolDef['pack'])) {
  console.error(`"${only}" has no symbols yet. Use one of: ${packs.join(', ')}, templates.`)
  process.exit(1)
}

// Remove old pictures first, so that a stale PNG is never reviewed in place of a new one.
mkdirSync('out', { recursive: true })
for (const name of readdirSync('out')) if (/^(reference|sheet-|template-).*\.(svg|png)$/.test(name)) rmSync(`out/${name}`)

const files: { name: string; svg: string; w: number; h: number }[] = []
files.push({ name: 'reference', svg: svgDocument(docNodes(demoDoc()), DEMO_SIZE.w, DEMO_SIZE.h, '#ffffff'), ...DEMO_SIZE })
for (const pack of packs) {
  if (only && only !== pack) continue
  const defs = SYMBOLS.filter((s) => s.pack === pack)
  for (const variant of VARIANTS) files.push({ name: `sheet-${pack}-${variant}`, ...sheet(defs, variant) })
}
// One picture per template, in each label mode that a teacher exports. The bounds follow the mode: the blank lines are wider than short labels.
for (const t of TEMPLATES) {
  if (only && only !== 'templates') continue
  const doc = t.build()
  for (const mode of ['text', 'blank'] as const) {
    doc.settings.labelMode = mode
    const b = estimateBounds(doc, 20)
    files.push({
      name: `template-${t.id}-${mode}`,
      svg: svgDocument([{ t: 'g', m: translate(-b.x, -b.y), kids: docNodes(doc) }], b.w, b.h, '#ffffff'),
      w: b.w,
      h: b.h,
    })
  }
}
for (const file of files) writeFileSync(`out/${file.name}.svg`, file.svg)

// PNG copies, so that an agent (or a person) can look at them.
try {
  const { chromium } = await import('@playwright/test')
  const local = '/opt/pw-browsers/chromium'
  const browser = await chromium.launch(existsSync(local) ? { executablePath: local } : {})
  const page = await browser.newPage({ deviceScaleFactor: 2 })
  for (const file of files) {
    await page.setViewportSize({ width: Math.ceil(file.w), height: Math.ceil(file.h) })
    await page.setContent(`<body style="margin:0">${file.svg}</body>`)
    await page.screenshot({ path: `out/${file.name}.png` })
  }
  await browser.close()
  console.log(`wrote ${files.length} SVG + PNG files to out/`)
} catch (e) {
  console.error(`wrote ${files.length} SVG files to out/, but no PNG: ${(e as Error).message.split('\n')[0]}`)
  console.error('Install the browser with: npx playwright install chromium')
  process.exit(1)
}
