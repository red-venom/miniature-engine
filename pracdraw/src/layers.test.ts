// layers.test.ts — the import table of section 6: each folder may import only from the folders below it.
// It reads the imports of every file in src and fails when one crosses the line.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname)

/** What each folder may import from. Files at the top of src (demo, App, main, tests) may import anything. */
const ALLOWED: Record<string, string[]> = {
  kernel: [],
  symbols: ['kernel'],
  model: ['kernel', 'symbols'],
  render: ['kernel', 'symbols', 'model'],
  templates: ['kernel', 'symbols', 'model'],
  export: ['kernel', 'model', 'render'],
  host: [],
  editor: ['kernel', 'symbols', 'model', 'render', 'templates', 'export', 'host'],
  ui: ['kernel', 'symbols', 'model', 'render', 'templates', 'export', 'host', 'editor'],
}

function files(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...files(p))
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const isTest = (file: string) => /\.test\.tsx?$/.test(file)

/** The src folder of a file (or of a folder import such as '../templates'), or null for a top-level file. */
function layerOf(file: string): string | null {
  const parts = relative(ROOT, file).split(sep)
  if (parts.length > 1) return parts[0]
  return parts[0] && !parts[0].includes('.') ? parts[0] : null
}

/** Every module specifier a file imports, dynamic imports and re-exports included. */
export function importsOf(source: string): string[] {
  const out: string[] = []
  const re = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
  for (let m = re.exec(source); m; m = re.exec(source)) out.push(m[1] ?? m[2] ?? m[3])
  return out
}

describe('src folders import only what section 6 allows', () => {
  const all = files(ROOT)
  it('finds the source files', () => {
    expect(all.length).toBeGreaterThan(20)
  })
  for (const file of all) {
    const layer = layerOf(file)
    if (!layer || isTest(file)) continue
    it(relative(ROOT, file), () => {
      const allowed = ALLOWED[layer]
      expect(allowed, `${layer} is not a folder in the table`).toBeDefined()
      for (const spec of importsOf(readFileSync(file, 'utf8'))) {
        if (!spec.startsWith('.')) continue
        const target = resolve(file, '..', spec)
        const targetLayer = layerOf(target)
        if (targetLayer === layer) continue
        expect(targetLayer, `${spec} leaves src`).not.toBeNull()
        expect(allowed, `${layer} may not import ${spec}`).toContain(targetLayer)
      }
    })
  }
})

describe('importsOf', () => {
  it('reads static, type, dynamic and side-effect imports and re-exports', () => {
    const src = `import a from './a'\nimport { b } from "../b"\nimport type { C } from './c'\nexport { d } from './d'\nimport './e.css'\nconst f = import('./f')\nexport * from './g'`
    expect(importsOf(src)).toEqual(['./a', '../b', './c', './d', './e.css', './f', './g'])
  })
})
