// skill.test.ts — the Claude skill in .claude/skills/pracdraw (at the root of the repository): its reference files are
// what `npm run gen:skill` writes now, and the examples in SKILL.md and in examples/ use symbols, anchors and presets that exist.

import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SKILL_DIR, skillFiles } from '../scripts/gen-skill'
import { scan } from './kernel/geom'
import { RIM } from './symbols/kit'
import { compileRecipe, presetByName } from './model/recipe'
import { geometry, hasSymbol, SYMBOLS } from './symbols/registry'

const skill = () => readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8')

/** The JSON blocks of SKILL.md: each is a whole recipe. */
const recipes = (): unknown[] => [...skill().matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]))

/** Every id and every kind of an anchor of any symbol. */
const anchorNames = (): Set<string> => {
  const names = new Set<string>()
  for (const d of SYMBOLS) for (const a of geometry(d.id, d.size.w, d.size.h).anchors ?? []) names.add(a.id).add(a.kind)
  return names
}

describe('the skill', () => {
  it('skill-reference-is-current', () => {
    const files = skillFiles()
    expect(Object.keys(files).sort()).toEqual(['reference/lessons.md', 'reference/presets.md', 'reference/symbols.md', 'reference/templates.md'])
    for (const [name, text] of Object.entries(files)) {
      expect(readFileSync(join(SKILL_DIR, name), 'utf8') === text, `${name} differs from what gen-skill writes now: run npm run gen:skill`).toBe(true)
    }
    // A symbol of the registry is in the reference, and the reference names no symbol that does not exist.
    const symbols = files['reference/symbols.md']
    for (const d of SYMBOLS) expect(symbols, d.id).toContain(`| \`${d.id}\` |`)
    for (const m of symbols.matchAll(/^\| `([A-Za-z0-9]+)` \|/gm)) expect(hasSymbol(m[1]), m[1]).toBe(true)

    // Every JSON recipe in SKILL.md compiles with no problem, so every symbol, anchor and preset in it exists.
    const blocks = recipes()
    expect(blocks.length).toBeGreaterThanOrEqual(2)
    for (const recipe of blocks) {
      const r = compileRecipe(recipe)
      expect(r.problems).toEqual([])
      expect(r.doc).not.toBeNull()
    }
    // And so does every other symbol id, anchor and preset that SKILL.md names, in its prose and its tables.
    const text = skill()
    for (const m of text.matchAll(/"symbol": "([^"]+)"/g)) expect(hasSymbol(m[1]), `symbol ${m[1]}`).toBe(true)
    const anchors = anchorNames()
    for (const m of text.matchAll(/"(?:anchor|own)": "([^"]+)"/g)) expect(anchors.has(m[1]), `anchor ${m[1]}`).toBe(true)
    for (const m of text.matchAll(/"preset": "([^"]+)"/g)) expect(presetByName(m[1]), `preset ${m[1]}`).toBeDefined()
  })

  it('has the frontmatter of a skill, and names every example', () => {
    const text = skill()
    const front = /^---\nname: pracdraw\ndescription: (.+)\n---\n/.exec(text)
    expect(front).not.toBeNull()
    for (const word of ['diagram', 'apparatus', 'lab set-up', 'practical', 'worksheet', 'exam']) expect(front![1]).toContain(word)
    const files = readdirSync(join(SKILL_DIR, 'examples')).filter((f) => f.endsWith('.json'))
    expect(files.length).toBeGreaterThanOrEqual(9)
    for (const f of files) expect(text, f).toContain(f)
  })

  it('names every flag of the render command, and the files that it writes, in the skill and in the document for people', () => {
    const flags = [
      '--out',
      '--name',
      '--scale',
      '--labels',
      '--mono',
      '--answer-key',
      '--transparent',
      '--variants',
      '--student',
      '--no-png',
      '--no-svg',
      '--explain',
      '--template',
      '--list',
      '--symbol',
      '--find',
    ]
    const people = readFileSync(resolve(__dirname, '../docs/lesson-pipeline.md'), 'utf8')
    for (const flag of flags) {
      expect(skill(), `SKILL.md: ${flag}`).toContain(flag)
      expect(people, `docs/lesson-pipeline.md: ${flag}`).toContain(flag)
    }
    for (const suffix of ['-blank', '-letters', '-letters-key', '-mono']) {
      expect(skill(), `SKILL.md: ${suffix}`).toContain(suffix)
      expect(people, `docs/lesson-pipeline.md: ${suffix}`).toContain(suffix)
    }
    // The label keys of a recipe, and the exit codes of the render command: all of them in the skill, and those that the
    // document for people explains in the document too (it does not give the whole format).
    // 'blank copy:' is the start of the line under the file line of a blank copy that has a label wider than its line to write on.
    for (const word of ['labels.order', '"end"', '"order"', '"auto": false', 'textAt', '--student', 'Exit codes', 'this render:', 'blank copy:']) {
      expect(skill(), `SKILL.md: ${word}`).toContain(word)
    }
    for (const word of ['labels.order', '"end"', 'textAt', '--student', 'Exit codes', 'this render:', 'blank copy:']) {
      expect(people, `docs/lesson-pipeline.md: ${word}`).toContain(word)
    }
  })

  it('says what the code of the symbols says: the marks of a pipette and a flask, and the stem of a funnel', () => {
    // The fill that reaches a mark: the surface is `amount` of the height of the cavity above its bottom.
    const reach = (symbol: string, mark: (h: number) => number) => {
      const def = SYMBOLS.find((d) => d.id === symbol)!
      const g = geometry(symbol, def.size.w, def.size.h)
      const markPrim = g.prims.find((p) => p.role === 'detail')!
      // The mark is the one horizontal line `M-x y H x`: its y is the second number.
      const y = Number(/^M\S+ (\S+)H/.exec(markPrim.d)![1])
      expect(y, symbol).toBeCloseTo(mark(def.size.h), 6)
      const neck = g.anchors!.find((a) => a.id === 'neck')!
      return { y, amount: (def.size.h - y) / (def.size.h - RIM), neckAbove: neck.y - y }
    }
    const pipette = reach('volumetricPipette', (h) => 0.16 * h)
    expect(pipette.amount).toBeCloseTo(0.845, 2)
    expect(pipette.neckAbove).toBeCloseTo(9.5, 1)
    const flask = reach('volumetricFlask', (h) => 0.2 * h)
    expect(flask.amount).toBeCloseTo(0.806, 2)
    expect(flask.neckAbove).toBeCloseTo(15.6, 1)
    // The funnel: the stem is the lower 55 % of the cavity (an amount of 0.55 reaches the cone).
    const funnel = SYMBOLS.find((d) => d.id === 'filterFunnel')!
    const g = geometry('filterFunnel', funnel.size.w, funnel.size.h)
    const cavity = g.cavities![0].polys
    const width = (amount: number) => {
      const spans = scan(cavity, funnel.size.h - amount * (funnel.size.h - RIM))
      return spans.reduce((w, [a, b]) => w + (b - a), 0)
    }
    expect(width(0.5)).toBeCloseTo(9, 0) // the stem: 2 × 4.5 u
    expect(width(0.7)).toBeGreaterThan(20) // the cone
    expect(width(0.6)).toBeGreaterThan(width(0.5)) // an amount above 0.55 is in the cone
    // And what the skill and the notes of reference/symbols.md say about them.
    expect(skill()).toContain('"amount": 0.845')
    expect(skill()).toContain('"amount": 0.806')
    expect(skill()).toContain('an `amount` up to 0.55 fills only the stem')
    expect(skill()).toContain('"size": { "w": 68 }')
    const symbols = skillFiles()['reference/symbols.md']
    expect(symbols).toContain('in the 84 u filter funnel: size w 68')
    expect(symbols).toContain('amount 0.845 puts the surface on it')
    expect(symbols).toContain('amount 0.806 puts the surface on it')
  })
})
