// skill.test.ts — the Claude skill in .claude/skills/pracdraw (at the root of the repository): its reference files are
// what `npm run gen:skill` writes now, and the examples in SKILL.md and in examples/ use symbols, anchors and presets that exist.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SKILL_DIR, skillFiles } from '../scripts/gen-skill'
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
    expect(Object.keys(files).sort()).toEqual(['reference/presets.md', 'reference/symbols.md', 'reference/templates.md'])
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
    expect(files.length).toBeGreaterThanOrEqual(5)
    for (const f of files) expect(text, f).toContain(f)
  })
})
