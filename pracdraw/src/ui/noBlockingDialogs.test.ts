// noBlockingDialogs.test.ts — sections 12 and 13: the app uses no alert, confirm or prompt (a sandboxed frame can block
// them). Help, export and the fallback are dialogs of its own. This reads every source file of the app.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '..')

function files(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...files(p))
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

/** A call of alert, confirm or prompt, as a name of its own or on window, globalThis or self. */
const BLOCKING = /(^|[^.\w$]|\b(?:window|globalThis|self)\.)(alert|confirm|prompt)\s*\(/

describe('no alert, confirm or prompt', () => {
  const all = [...files(SRC), resolve(SRC, '..', 'index.html')]
  it('finds the source files', () => {
    expect(all.length).toBeGreaterThan(50)
  })
  for (const file of all)
    it(relative(SRC, file), () => {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      expect(code).not.toMatch(BLOCKING)
    })
  it('the pattern finds such a call', () => {
    for (const call of ['alert("x")', 'window.confirm("y")', 'const v = prompt ("z")', 'globalThis.alert(1)']) expect(call).toMatch(BLOCKING)
    for (const word of ['onConfirm(x)', 'this.alert(x)', 'a.prompt(x)', 'promptly(x)']) expect(word).not.toMatch(BLOCKING)
  })
})
