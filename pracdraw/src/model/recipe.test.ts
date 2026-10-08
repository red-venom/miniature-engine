import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Pt } from '../kernel/geom'
import { geometry } from '../symbols/registry'
import { amountToReading } from '../symbols/scale'
import { TEMPLATES } from '../templates'
import { LABEL_SPACING, autoLabels, segmentsCross } from './autoLabel'
import { labelTarget } from './bounds'
import { anchorWorld } from './build'
import { filledAmount, normaliseLayers, PRESETS } from './contents'
import { isFixed, leaderOf } from './labels'
import { parseDoc } from './parse'
import { RECIPE_PRESETS, compileRecipe, isRecipe, nearestNames, suggestSymbols, type Problem, type Recipe } from './recipe'
import type { ConnectorItem, Doc, LabelItem, SymbolItem } from './types'

/** The recipes of the skill: every one must compile with no error and no warning. */
const EXAMPLES = resolve(__dirname, '../../../.claude/skills/pracdraw/examples')
const examples = (): [string, unknown][] =>
  readdirSync(EXAMPLES)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => [f, JSON.parse(readFileSync(resolve(EXAMPLES, f), 'utf8'))])

const errorsOf = (recipe: unknown): Problem[] => compileRecipe(recipe).problems.filter((p) => p.level === 'error')

/** A recipe that compiles. */
function make(recipe: unknown): Doc {
  const r = compileRecipe(recipe)
  expect(r.problems.filter((p) => p.level === 'error')).toEqual([])
  expect(r.doc).not.toBeNull()
  return r.doc!
}

const symbols = (doc: Doc): SymbolItem[] => doc.order.map((id) => doc.items[id]).filter((it): it is SymbolItem => it.type === 'symbol')
const labels = (doc: Doc): LabelItem[] => doc.order.map((id) => doc.items[id]).filter((it): it is LabelItem => it.type === 'label')
const connectors = (doc: Doc): ConnectorItem[] => doc.order.map((id) => doc.items[id]).filter((it): it is ConnectorItem => it.type === 'connector')
const part = (doc: Doc, id: string): SymbolItem => doc.items[id] as SymbolItem
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) < tol

/** The heatingBeaker template, as a recipe. */
const HEATING_BEAKER: Recipe = {
  title: 'Heating a liquid in a beaker',
  parts: [
    { id: 'mat', symbol: 'heatproofMat', at: { x: 0, y: 0, anchor: 'under' } },
    { id: 'tripod', symbol: 'tripod', on: { part: 'mat', anchor: 'surface', own: 'base' } },
    { id: 'burner', symbol: 'bunsenBurner', on: { part: 'mat', anchor: 'top', own: 'base' } },
    { id: 'gauze', symbol: 'gauze', on: { part: 'tripod', anchor: 'top', own: 'under' } },
    { id: 'beaker', symbol: 'beaker', on: { part: 'gauze', anchor: 'top', own: 'base' }, contents: { main: [{ preset: 'Water', amount: 0.6 }] } },
    {
      id: 'thermometer',
      symbol: 'thermometer',
      size: { h: 200 },
      on: { part: 'beaker', anchor: 'base', own: 'bulb', dx: 16, dy: -12 },
      contents: { main: [{ reading: 20 }] },
    },
  ],
  labels: { extra: [{ text: 'water', part: 'beaker', at: [30, 90] }] },
}

describe('recipe: the heatingBeaker template', () => {
  it('recipe-compiles-heatingBeaker', () => {
    const r = compileRecipe(HEATING_BEAKER)
    expect(r.problems).toEqual([])
    const doc = r.doc!
    const template = TEMPLATES.find((t) => t.id === 'heatingBeaker')!.build()
    expect(doc.title).toBe(template.title)
    expect(doc.settings).toEqual(template.settings)

    // The same symbols, in the same order, with the same size, parameters, turn and contents.
    const mine = symbols(doc),
      theirs = symbols(template)
    expect(mine.map((s) => s.symbol)).toEqual(theirs.map((s) => s.symbol))
    mine.forEach((s, i) => {
      const t = theirs[i]
      expect([s.rot, s.flip, s.w, s.h, s.params], s.id).toEqual([t.rot, t.flip, t.w, t.h, t.params])
      expect(Object.keys(s.contents), s.id).toEqual(Object.keys(t.contents))
      for (const cavity of Object.keys(t.contents)) {
        expect(s.contents[cavity].length).toBe(t.contents[cavity].length)
        s.contents[cavity].forEach((layer, k) => {
          const want = t.contents[cavity][k]
          expect([layer.kind, layer.colour, layer.meniscus, layer.bubbles, layer.cloudy]).toEqual([
            want.kind,
            want.colour,
            want.meniscus,
            want.bubbles,
            want.cloudy,
          ])
          expect(Math.abs(layer.amount - want.amount)).toBeLessThan(1e-6)
        })
      }
      // The same place in the world: the centre, and every anchor.
      expect(near(s.x, t.x), `${s.id} x ${s.x} ${t.x}`).toBe(true)
      expect(near(s.y, t.y), `${s.id} y ${s.y} ${t.y}`).toBe(true)
      for (const a of geometry(s.symbol, s.w, s.h, s.params).anchors ?? []) {
        const p = anchorWorld(s, a.id),
          q = anchorWorld(t, a.id)
        expect(near(p.x, q.x) && near(p.y, q.y), `${s.id}.${a.id}`).toBe(true)
      }
    })

    // The labels are fixed to the same parts, with the same texts (the template's labels are by hand, so not at the same places).
    const pairs = (d: Doc, ids: string[]) =>
      labels(d)
        .map((l) => [l.text, l.target && 'item' in l.target ? ids.indexOf(l.target.item) : -1] as const)
        .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    expect(
      pairs(
        doc,
        mine.map((s) => s.id),
      ),
    ).toEqual(
      pairs(
        template,
        theirs.map((s) => s.id),
      ),
    )
    expect(labels(doc).every(isFixed)).toBe(true)
  })

  it('draws the parts in list order, then the connectors, then the labels', () => {
    const doc = make(HEATING_BEAKER)
    expect(doc.order).toEqual(['mat', 'tripod', 'burner', 'gauze', 'beaker', 'thermometer', ...labels(doc).map((l) => l.id)])
    expect(Object.keys(doc.items).sort()).toEqual([...doc.order].sort())
  })

  it('explains how each part was placed', () => {
    const r = compileRecipe(HEATING_BEAKER)
    expect(r.explain).toEqual([
      'mat: its under at (0, 0) -> centre (0, -4), 180 × 8',
      'tripod: its feet on mat.top -> centre (0, -63), 120 × 110',
      'burner: its base on mat.top -> centre (0, -70), 60 × 124',
      'gauze: its under on tripod.top -> centre (0, -120.5), 136 × 5',
      'beaker: its base on gauze.top -> centre (0, -183), 100 × 120',
      'thermometer: its bulb on beaker.base -> centre (16, -235), 9 × 200',
    ])
  })
})

describe('recipe: the output is a document', () => {
  it('recipe-output-passes-parseDoc', () => {
    const recipes: [string, unknown][] = [['heatingBeaker', HEATING_BEAKER], ...examples()]
    expect(recipes.length).toBeGreaterThanOrEqual(6)
    for (const [name, recipe] of recipes) {
      const r = compileRecipe(recipe)
      expect(r.problems, name).toEqual([])
      const saved = JSON.parse(JSON.stringify(r.doc))
      const parsed = parseDoc(saved)
      expect(parsed.ok, name).toBe(true)
      if (!parsed.ok) continue
      expect(parsed.problems, name).toEqual([])
      expect(parsed.doc, name).toEqual(saved)
    }
  })

  it('gives the same document every time', () => {
    for (const [name, recipe] of examples()) expect(JSON.stringify(compileRecipe(recipe).doc), name).toBe(JSON.stringify(compileRecipe(recipe).doc))
  })

  it('every example of the skill compiles with no problem at all', () => {
    for (const [name, recipe] of examples()) {
      const r = compileRecipe(recipe)
      expect(r.problems, name).toEqual([])
      expect(r.doc, name).not.toBeNull()
    }
  })

  it('every label of an example has a leader, and a leader that ends on a part is fixed to it', () => {
    for (const [name, recipe] of examples()) {
      const doc = make(recipe)
      for (const l of labels(doc)) {
        expect(l.target, `${name}: ${l.text}`).toBeDefined()
        expect(labelTarget(doc, l), `${name}: ${l.text}`).not.toBeNull()
      }
      // Only a label on a tube or on a place has a free end; the others are fixed to their part.
      expect(labels(doc).filter((l) => !isFixed(l)).length, name).toBeLessThanOrEqual(1)
    }
  })
})

/** The Problem of one error, with its path, its message and its hint. */
const error = (path: string, message: string, hint: string): Problem => ({ level: 'error', path, message, hint })

const ALL_PRESET_NAMES = [...PRESETS, ...RECIPE_PRESETS].map((p) => p.name).join('; ')
const LIST_SYMBOLS = 'The whole list is in reference/symbols.md, or run: npm run render -- --list symbols'
const ANCHOR_KIND = 'A kind such as "surface" also works when only one anchor has that kind.'
const CIRCLE =
  'A part can only refer to parts that do not depend on it, so moving one of them in the list does not help. Break the circle: give one of them an "at" (a point of the world) or a plain number for its "size", and list each part after the parts it refers to.'

describe('recipe: problems name the fix', () => {
  it('recipe-errors-name-the-fix', () => {
    const cases: [string, unknown, Problem[]][] = [
      [
        'an unknown symbol lists the nearest ids',
        { title: 't', parts: [{ id: 'a', symbol: 'beker' }] },
        [error('parts[0].symbol', 'Unknown symbol "beker".', `Nearest symbols: beaker (Beaker). ${LIST_SYMBOLS}`)],
      ],
      [
        'an unknown symbol is found by its aliases',
        { title: 't', parts: [{ id: 'a', symbol: 'retort stand' }] },
        [error('parts[0].symbol', 'Unknown symbol "retort stand".', `Nearest symbols: clampStand (Clamp stand). ${LIST_SYMBOLS}`)],
      ],
      [
        'a symbol that nothing is near says so',
        { title: 't', parts: [{ id: 'a', symbol: 'zzzz' }] },
        [error('parts[0].symbol', 'Unknown symbol "zzzz".', `No symbol is close to that. ${LIST_SYMBOLS}`)],
      ],
      [
        'an unknown anchor lists the anchors with their kinds',
        {
          title: 't',
          parts: [
            { id: 'mat', symbol: 'heatproofMat' },
            { id: 'beaker', symbol: 'beaker', on: { part: 'mat', anchor: 'middle', own: 'base' } },
          ],
        },
        [error('parts[1].on.anchor', 'The part "mat" (heatproofMat) has no anchor "middle".', `Its anchors are: top (surface), under (base). ${ANCHOR_KIND}`)],
      ],
      [
        'an anchor of the part itself is checked too',
        {
          title: 't',
          parts: [
            { id: 'mat', symbol: 'heatproofMat' },
            { id: 'beaker', symbol: 'beaker', on: { part: 'mat', anchor: 'top', own: 'feet' } },
          ],
        },
        [
          error(
            'parts[1].on.own',
            'The part "beaker" (beaker) has no anchor "feet".',
            `Its anchors are: base (base), mouth (mouth), rim (surface). ${ANCHOR_KIND}`,
          ),
        ],
      ],
      [
        'a kind that several anchors have does not say which',
        {
          title: 't',
          parts: [
            { id: 'rack', symbol: 'testTubeRack' },
            { id: 'tube', symbol: 'testTube', on: { part: 'rack', anchor: 'cup', own: 'bottom' } },
          ],
        },
        [
          error(
            'parts[1].on.anchor',
            '"cup" is the kind of 6 anchors (slot1, slot2, slot3, slot4, slot5, slot6), so it does not say which one.',
            'Use the id of one of them. The anchors of "rack" (testTubeRack) are: slot1 (cup), slot2 (cup), slot3 (cup), slot4 (cup), slot5 (cup), slot6 (cup), base (base).',
          ),
        ],
      ],
      [
        'an unknown preset lists the presets',
        { title: 't', parts: [{ id: 'a', symbol: 'beaker', contents: { main: [{ preset: 'Pnk', amount: 0.5 }] } }] },
        [error('parts[0].contents.main[0].preset', 'Unknown preset "Pnk".', `Did you mean "Pink"? The presets are: ${ALL_PRESET_NAMES}.`)],
      ],
      [
        'a parameter out of range gives its range',
        { title: 't', parts: [{ id: 'a', symbol: 'bung', params: { holes: 5 } }] },
        [error('parts[0].params.holes', 'The parameter "holes" of bung cannot be 5.', 'holes must be a whole number from 0 to 2.')],
      ],
      [
        'a parameter that does not exist lists the parameters',
        { title: 't', parts: [{ id: 'a', symbol: 'bung', params: { hole: 1 } }] },
        [error('parts[0].params.hole', 'bung has no parameter "hole".', 'Its parameters are: holes (0..2). Did you mean "holes"?')],
      ],
      [
        'a parameter of the wrong type says what it must be',
        { title: 't', parts: [{ id: 'a', symbol: 'beaker', params: { spout: 'yes' } }] },
        [error('parts[0].params.spout', 'The parameter "spout" of beaker cannot be "yes".', 'spout must be true or false.')],
      ],
      [
        'a contents key that is not a cavity lists the cavities',
        { title: 't', parts: [{ id: 'a', symbol: 'beaker', contents: { jacket: [{ preset: 'Water', amount: 0.5 }] } }] },
        [error('parts[0].contents.jacket', '"jacket" is not a cavity of beaker.', 'The cavities of beaker are: "main".')],
      ],
      [
        'contents on a symbol with no cavity say so',
        { title: 't', parts: [{ id: 'a', symbol: 'tripod', contents: { main: [{ preset: 'Water', amount: 0.5 }] } }] },
        [error('parts[0].contents.main', '"main" is not a cavity of tripod.', 'tripod has no cavities, so it holds no contents: remove "contents".')],
      ],
      [
        'a reading on a symbol with no scale says so',
        { title: 't', parts: [{ id: 'a', symbol: 'beaker', contents: { main: [{ preset: 'Water', reading: 20 }] } }] },
        [
          error(
            'parts[0].contents.main[0].reading',
            'beaker has no scale, so "reading" cannot be used.',
            'Use "amount" (a fraction from 0 to 1) instead. The symbols with a scale are: measuringCylinder (0..100 cm³), burette (0..50 cm³), thermometer (-10..110 °C), scaleWindow (20..21 cm³).',
          ),
        ],
      ],
      [
        'a reading on a turned symbol says that it must stand upright',
        { title: 't', parts: [{ id: 'a', symbol: 'measuringCylinder', rot: 90, contents: { main: [{ preset: 'Water', reading: 20 }] } }] },
        [
          error(
            'parts[0].contents.main[0].reading',
            'measuringCylinder has a scale, but a reading works only when it stands upright.',
            'Remove "rot" and "flip" (a measuringCylinder turned by 180 degrees also takes a reading: the volume of gas collected), or use "amount".',
          ),
        ],
      ],
      [
        'a reading off the scale gives the scale',
        { title: 't', parts: [{ id: 'a', symbol: 'measuringCylinder', contents: { main: [{ preset: 'Water', reading: 120 }] } }] },
        [error('parts[0].contents.main[0].reading', 'The reading 120 is outside the scale of measuringCylinder.', 'The scale runs from 0 to 100 cm³.')],
      ],
      [
        'a labels.text key that is not a part lists the part ids',
        { title: 't', parts: [{ id: 'beaker', symbol: 'beaker' }], labels: { text: { beker: 'x' } } },
        [error('labels.text.beker', '"labels.text" names "beker", which is not a part.', 'The part ids are: "beaker". Did you mean "beaker"?')],
      ],
      [
        'a labels.skip entry that is not a part lists the part ids',
        { title: 't', parts: [{ id: 'beaker', symbol: 'beaker' }], labels: { skip: ['mat'] } },
        [error('labels.skip[0]', '"labels.skip" names "mat", which is not a part.', 'The part ids are: "beaker".')],
      ],
      [
        'a reference to a part that comes later says which',
        {
          title: 't',
          parts: [
            {
              id: 'stand',
              symbol: 'clampStand',
              alignX: { part: 'clamp', anchor: 'sleeve', own: 'rod' },
              alignY: { part: 'clamp', anchor: 'sleeve', own: 'base' },
            },
            { id: 'clamp', symbol: 'bossClamp', at: { x: 0, y: 0 } },
          ],
        },
        [
          error(
            'parts[0].alignX.part',
            'This reference names "clamp", which comes later in the list than "stand".',
            'A part is placed on parts that are listed before it: move "clamp" above "stand" in the list. If "stand" must be drawn behind "clamp" (a stand behind its clamp), list "stand" after "clamp" and add "behind": "clamp" to "stand" (or "back": true to draw it behind everything).',
          ),
        ],
      ],
      [
        'a cycle says which parts are in it',
        {
          title: 't',
          parts: [
            { id: 'a', symbol: 'beaker', behind: 'b' },
            { id: 'b', symbol: 'beaker', near: { part: 'a', anchor: 'base' }, behind: 'a' },
          ],
        },
        [error('parts[0].behind', 'The "behind" keys form a cycle: a -> b -> a.', 'Remove one of the "behind" keys in the cycle.')],
      ],
      [
        'placements that go round in a circle say which parts are in it, not only that one comes later',
        {
          title: 't',
          parts: [
            { id: 'a', symbol: 'beaker', on: { part: 'c', anchor: 'base', own: 'base' } },
            { id: 'b', symbol: 'beaker', on: { part: 'a', anchor: 'base', own: 'base' } },
            { id: 'c', symbol: 'beaker', on: { part: 'b', anchor: 'base', own: 'base' } },
          ],
        },
        [error('parts[0].on.part', 'The placements go round in a circle: "a" -> "c" -> "b" -> "a".', CIRCLE)],
      ],
      [
        'a stand sized from its clamp, with the clamp placed on the stand, is a circle too',
        {
          title: 't',
          parts: [
            {
              id: 'stand',
              symbol: 'clampStand',
              at: { x: 0, y: 0, anchor: 'base' },
              size: {
                h: {
                  between: [
                    { part: 'clamp', anchor: 'sleeve', dy: -40 },
                    { part: 'clamp', anchor: 'sleeve' },
                  ],
                },
              },
            },
            { id: 'clamp', symbol: 'bossClamp', on: { part: 'stand', anchor: 'rod', own: 'sleeve' } },
          ],
        },
        [
          error('parts[0].size.h.between[0].part', 'The placements go round in a circle: "stand" -> "clamp" -> "stand".', CIRCLE),
          error('parts[0].size.h.between[1].part', 'The placements go round in a circle: "stand" -> "clamp" -> "stand".', CIRCLE),
        ],
      ],
    ]
    for (const [what, recipe, expected] of cases) {
      const r = compileRecipe(recipe)
      expect(
        r.problems.filter((p) => p.level === 'error'),
        what,
      ).toEqual(expected)
      expect(r.doc, `${what}: a recipe with an error gives no document`).toBeNull()
    }
  })

  it('collects every problem, not only the first', () => {
    const r = compileRecipe({
      parts: [
        { id: 'a', symbol: 'beker' },
        { id: 'b', symbol: 'bung', params: { holes: 9 } },
        { id: 'c', symbol: 'beaker', contents: { jacket: [{ preset: 'Water', amount: 0.5 }] } },
      ],
      labels: { text: { x: 'y' } },
    })
    expect(r.doc).toBeNull()
    expect(r.problems.map((p) => `${p.level} ${p.path}`)).toEqual([
      'warning title',
      'error parts[0].symbol',
      'error parts[1].params.holes',
      'error parts[2].contents.jacket',
      'error labels.text.x',
    ])
    for (const p of r.problems) expect(p.hint.length, p.path).toBeGreaterThan(0)
  })

  it('does not report a part again for a part that is broken already', () => {
    const r = compileRecipe({
      title: 't',
      parts: [
        { id: 'mat', symbol: 'heatprofMat' },
        { id: 'beaker', symbol: 'beaker', on: { part: 'mat', anchor: 'top', own: 'base' } },
      ],
      connectors: [
        {
          kind: 'wire',
          points: [
            { part: 'mat', anchor: 'top' },
            { x: 5, y: 5 },
          ],
        },
      ],
    })
    expect(r.problems.map((p) => p.path)).toEqual(['parts[0].symbol'])
  })

  it('reports a key that it does not know, with the keys that it does', () => {
    expect(errorsOf({ title: 't', part: [], parts: [{ id: 'a', symbol: 'beaker' }] })).toEqual([
      error('part', 'Unknown key "part" in the recipe.', 'The keys here are: title, settings, parts, connectors, labels, note. Did you mean "parts"?'),
    ])
    expect(errorsOf({ title: 't', parts: [{ id: 'a', symbol: 'beaker', rotation: 90 }] })).toEqual([
      error(
        'parts[0].rotation',
        'Unknown key "rotation" in part 1.',
        'The keys here are: id, symbol, on, near, at, alignX, alignY, rot, flip, size, params, contents, behind, back, note.',
      ),
    ])
  })

  it('checks the ids and the shape of the recipe', () => {
    expect(errorsOf(5)).toEqual([error('', 'The recipe must be an object { ... }.', 'Write it as { "key": value, ... }.')])
    expect(errorsOf({ title: 't' })).toEqual([
      error('parts', 'The recipe needs a list of "parts": at least one.', 'Each part is { "id": "beaker", "symbol": "beaker" }.'),
    ])
    expect(
      errorsOf({
        title: 't',
        parts: [{ id: 'a', symbol: 'beaker' }, { id: 'a', symbol: 'beaker' }, { id: '1b', symbol: 'beaker' }, { symbol: 'beaker' }, 'text'],
      }).map((p) => [p.path, p.message]),
    ).toEqual([
      ['parts[1].id', 'The id "a" is used twice.'],
      ['parts[2].id', 'The id "1b" is not allowed.'],
      ['parts[3].id', 'Part 4 has no "id".'],
      ['parts[4]', 'Part 5 must be an object { "id": ..., "symbol": ... }.'],
    ])
  })

  it('warns about a part with no placement, and about a recipe with no title', () => {
    const r = compileRecipe({
      parts: [
        { id: 'a', symbol: 'beaker' },
        { id: 'b', symbol: 'beaker' },
      ],
    })
    expect(r.doc).not.toBeNull()
    expect(r.problems).toEqual([
      {
        level: 'warning',
        path: 'title',
        message: 'The recipe has no "title", so the diagram is called "Untitled diagram".',
        hint: 'Add "title": "..." (it names the diagram in the editor).',
      },
      {
        level: 'warning',
        path: 'parts[1]',
        message: 'The part "b" has no placement, so its centre is at the origin (0, 0).',
        hint: 'Add "on", "near" or "at" so that it does not sit on the other parts.',
      },
    ])
  })

  it('reports a placement that is given twice, and an align that repeats a coordinate', () => {
    const base = [{ id: 'a', symbol: 'beaker' }]
    expect(errorsOf({ title: 't', parts: [...base, { id: 'b', symbol: 'beaker', near: { part: 'a', anchor: 'base' }, at: { x: 0, y: 0 } }] })).toEqual([
      error(
        'parts[1].at',
        'A part is placed with one of "on", "near" and "at", and this one has "near", "at".',
        'Keep one. "alignX" and "alignY" fix one coordinate each.',
      ),
    ])
    expect(
      errorsOf({
        title: 't',
        parts: [...base, { id: 'b', symbol: 'beaker', near: { part: 'a', anchor: 'base' }, alignX: { part: 'a', anchor: 'base', own: 'base' } }],
      }),
    ).toEqual([
      error('parts[1].alignX', '"near" already fixes both coordinates of the part.', 'Use "alignX" with "alignY" without it, or drop "alignX" and "alignY".'),
    ])
    expect(errorsOf({ title: 't', parts: [...base, { id: 'b', symbol: 'beaker', alignX: { part: 'a', anchor: 'base', own: 'base', dy: 5 } }] })).toEqual([
      error('parts[1].alignX.dy', '"alignX" fixes x only, so it has no "dy".', 'Use "dx" to shift it.'),
    ])
  })

  it('checks the size against the resize mode and the minimum', () => {
    const size = (symbol: string, s: unknown) => errorsOf({ title: 't', parts: [{ id: 'a', symbol, size: s }] })
    expect(size('burette', { w: 50 })).toEqual([error('parts[0].size.w', 'burette can only change its height (its width stays 18).', 'Give "h" only.')])
    expect(size('gauze', { h: 50 })).toEqual([error('parts[0].size.h', 'gauze can only change its width (its height stays 5).', 'Give "w" only.')])
    expect(size('cCell', { w: 50 })).toEqual([error('parts[0].size.w', 'cCell cannot be resized.', 'Remove "size".')])
    expect(size('beaker', { w: 10 })).toEqual([
      error('parts[0].size.w', 'The width 10 of beaker is below its minimum.', 'Use at least 40 (its smallest size is 40 × 40).'),
    ])
    expect(size('bunsenBurner', { w: 60, h: 300 })[0]?.message).toBe('bunsenBurner keeps its shape (width ÷ height = 0.484).')
    expect(size('beaker', { w: -4 })[0]?.message).toBe('The width -4 is not allowed.')
    expect(size('beaker', { depth: 4 })[0]?.message).toBe('Unknown key "depth" in the size.')
  })
})

describe('recipe: placing parts', () => {
  const two = (b: object): Doc =>
    make({
      title: 't',
      parts: [
        { id: 'a', symbol: 'bung', at: { x: 100, y: 50, anchor: 'plug' } },
        { id: 'b', symbol: 'beaker', ...b },
      ],
    })

  it('puts the own anchor of a part on a point with "at", and the centre when there is no anchor', () => {
    const doc = make({
      title: 't',
      parts: [
        { id: 'a', symbol: 'beaker', at: { x: 10, y: 20, anchor: 'base' } },
        { id: 'b', symbol: 'beaker', at: { x: 300, y: 400 } },
      ],
    })
    const p = anchorWorld(part(doc, 'a'), 'base')
    expect([p.x, p.y]).toEqual([10, 20])
    expect([part(doc, 'b').x, part(doc, 'b').y]).toEqual([300, 400])
  })

  it('puts the own anchor on an anchor of an earlier part, as DocBuilder.on does, turned and flipped too', () => {
    const doc = two({ rot: 90, flip: true, on: { part: 'a', anchor: 'plug', own: 'mouth', dx: 3, dy: -4 } })
    const p = anchorWorld(part(doc, 'b'), 'mouth')
    expect(near(p.x, 103) && near(p.y, 46)).toBe(true)
    expect(part(doc, 'b').rot).toBe(90)
    expect(part(doc, 'b').flip).toBe(true)
  })

  it('puts the centre near an anchor with "near"', () => {
    const doc = two({ near: { part: 'a', anchor: 'plug', dx: 7, dy: 9 } })
    expect([part(doc, 'b').x, part(doc, 'b').y]).toEqual([107, 59])
  })

  it('moves a point along the direction of an anchor with "out", as the part is turned', () => {
    // hole1 of a bung points up (-90 degrees). out 20 is 20 up; turned a quarter turn clockwise it is 20 to the right.
    const up = make({
      title: 't',
      parts: [
        { id: 'a', symbol: 'bung', at: { x: 0, y: 0, anchor: 'hole1' } },
        { id: 'b', symbol: 'stopwatch', near: { part: 'a', anchor: 'hole1', out: 20 } },
      ],
    })
    expect([part(up, 'b').x, part(up, 'b').y]).toEqual([0, -20])
    const turned = make({
      title: 't',
      parts: [
        { id: 'a', symbol: 'bung', rot: 90, at: { x: 0, y: 0, anchor: 'hole1' } },
        { id: 'b', symbol: 'stopwatch', near: { part: 'a', anchor: 'hole1', out: 20 } },
      ],
    })
    expect(near(part(turned, 'b').x, 20) && near(part(turned, 'b').y, 0)).toBe(true)
  })

  it('fixes one coordinate with alignX and alignY, each with its own anchor', () => {
    // A stand: its rod under the sleeve of a clamp, its base on the bench at y = 0 (the mat's under).
    const doc = make({
      title: 't',
      parts: [
        { id: 'mat', symbol: 'heatproofMat', at: { x: 0, y: 0, anchor: 'under' } },
        { id: 'clamp', symbol: 'bossClamp', at: { x: 200, y: -150, anchor: 'sleeve' } },
        {
          id: 'stand',
          symbol: 'clampStand',
          alignX: { part: 'clamp', anchor: 'sleeve', own: 'rod' },
          alignY: { part: 'mat', anchor: 'under', own: 'base', dy: 9 },
        },
      ],
    })
    const rod = anchorWorld(part(doc, 'stand'), 'rod'),
      base = anchorWorld(part(doc, 'stand'), 'base')
    expect(near(rod.x, 200)).toBe(true)
    expect(near(base.y, 9)).toBe(true)
  })

  it('makes a size from the distance between two anchors', () => {
    const doc = make({
      title: 't',
      parts: [
        { id: 'mat', symbol: 'heatproofMat', at: { x: 0, y: 0, anchor: 'under' } },
        { id: 'clamp', symbol: 'bossClamp', at: { x: 200, y: -150, anchor: 'sleeve' } },
        {
          id: 'stand',
          symbol: 'clampStand',
          size: {
            w: 100,
            h: {
              between: [
                { part: 'mat', anchor: 'under' },
                { part: 'clamp', anchor: 'sleeve', dy: -40 },
              ],
            },
          },
          alignX: { part: 'clamp', anchor: 'sleeve', own: 'rod' },
          alignY: { part: 'mat', anchor: 'under', own: 'base' },
        },
      ],
    })
    expect(part(doc, 'stand').h).toBe(190)
    expect(part(doc, 'stand').w).toBe(100)
    expect(errorsOf({ title: 't', parts: [{ id: 'a', symbol: 'clampStand', size: { h: { between: [{ part: 'a', anchor: 'rod' }] } } }] })[0].message).toBe(
      'The "between" of a size must be a list of two points.',
    )
  })

  it('draws a uniform symbol at the shape it has: one size gives the other', () => {
    const doc = make({ title: 't', parts: [{ id: 'a', symbol: 'bunsenBurner', size: { h: 248 } }] })
    expect([part(doc, 'a').w, part(doc, 'a').h]).toEqual([120, 248])
  })

  it('keeps only the parameters that differ from the defaults', () => {
    const doc = make({
      title: 't',
      parts: [
        { id: 'a', symbol: 'beaker', params: { graduations: true, spout: true } },
        { id: 'b', symbol: 'measuringCylinder', params: { capacity: 50 } },
      ],
    })
    expect(part(doc, 'a').params).toEqual({ graduations: true })
    expect(part(doc, 'b').params).toEqual({ capacity: '50' })
  })

  it('reads an anchor by its kind when only one anchor has it', () => {
    const doc = make({
      title: 't',
      parts: [
        { id: 'mat', symbol: 'heatproofMat', at: { x: 0, y: 0, anchor: 'base' } },
        { id: 'tripod', symbol: 'tripod', on: { part: 'mat', anchor: 'surface', own: 'base' } },
      ],
    })
    const feet = anchorWorld(part(doc, 'tripod'), 'feet'),
      top = anchorWorld(part(doc, 'mat'), 'top')
    expect(near(feet.y, top.y)).toBe(true)
  })
})

describe('recipe: contents', () => {
  const cylinder = (layers: unknown, extra: object = {}) =>
    make({ title: 't', parts: [{ id: 'c', symbol: 'measuringCylinder', ...extra, contents: { main: layers } }] })

  it('puts the surface of a layer at a reading on the scale', () => {
    const doc = cylinder([{ preset: 'Pink', reading: 37 }])
    const c = part(doc, 'c')
    expect(c.contents.main).toEqual([{ kind: 'liquid', amount: expect.any(Number), colour: '#f2a7c3' }])
    const g = geometry('measuringCylinder', c.w, c.h, c.params)
    expect(Math.abs(amountToReading(g, c.contents.main[0].amount)! - 37)).toBeLessThan(0.05)
  })

  it('puts the surface of each layer at its reading, above the layers under it', () => {
    const doc = cylinder([
      { preset: 'Water', reading: 20 },
      { preset: 'Oil or organic layer', reading: 50 },
    ])
    const c = part(doc, 'c')
    const g = geometry('measuringCylinder', c.w, c.h, c.params)
    const [water, oil] = c.contents.main
    expect(Math.abs(amountToReading(g, water.amount)! - 20)).toBeLessThan(0.05)
    expect(Math.abs(amountToReading(g, water.amount + oil.amount)! - 50)).toBeLessThan(0.05)
  })

  it('reads the volume of gas on a cylinder that is upside down, and leaves the rest to the gas', () => {
    const doc = cylinder([{ preset: 'Water', reading: 34 }, { preset: 'Colourless gas' }], { rot: 180, size: { h: 170 } })
    const c = part(doc, 'c')
    const g = geometry('measuringCylinder', c.w, c.h, c.params)
    const [water, gas] = c.contents.main
    expect(Math.abs(amountToReading(g, water.amount, true)! - 34)).toBeLessThan(0.05)
    expect(gas.kind).toBe('gas')
    expect(Math.abs(gas.amount - (1 - water.amount))).toBeLessThan(1e-6)
  })

  it('fills a thermometer with its red thread, and anything else with water, when no preset is named', () => {
    const doc = make({
      title: 't',
      parts: [
        { id: 't', symbol: 'thermometer', contents: { main: [{ reading: 20 }] } },
        { id: 'b', symbol: 'beaker', at: { x: 200, y: 0 }, contents: { main: [{ amount: 0.5 }] } },
      ],
    })
    expect(part(doc, 't').contents.main[0].colour).toBe('#d33333')
    expect(part(doc, 'b').contents.main).toEqual([{ kind: 'liquid', amount: 0.5, colour: '#cfe8f7' }])
  })

  it('finds a preset by its short name, in any case', () => {
    const doc = make({
      title: 't',
      parts: [
        {
          id: 'b',
          symbol: 'beaker',
          contents: {
            main: [
              { preset: 'blue', amount: 0.2 },
              { preset: 'Cloudy yellow', amount: 0.2 },
              { colour: '#112233', amount: 0.1 },
            ],
          },
        },
      ],
    })
    expect(part(doc, 'b').contents.main).toEqual([
      { kind: 'liquid', amount: 0.2, colour: '#7fb8e6' },
      { kind: 'liquid', amount: 0.2, colour: '#f1e9b0', cloudy: true },
      { kind: 'liquid', amount: 0.1, colour: '#112233' },
    ])
  })

  it('keeps the layer rules of the editor, so that its own normalising changes nothing', () => {
    const layers = [
      { preset: 'Chips or granules', amount: 0.1 },
      { preset: 'Water', amount: 0.3, bubbles: 'many', meniscus: true },
      { preset: 'Oil or organic layer', amount: 0.2 },
      { preset: 'Brown gas' },
    ]
    const c = part(make({ title: 't', parts: [{ id: 'c', symbol: 'beaker', contents: { main: layers } }] }), 'c')
    expect(normaliseLayers(c.contents.main)).toEqual(c.contents.main)
    expect(filledAmount(c.contents.main)).toBeCloseTo(0.6, 6)
    expect(c.contents.main.map((l) => l.kind)).toEqual(['lumps', 'liquid', 'liquid', 'gas'])
    expect(c.contents.main[3].amount).toBeCloseTo(0.4, 6)
  })

  it('reports each broken layer rule', () => {
    const rule = (layers: unknown) =>
      errorsOf({ title: 't', parts: [{ id: 'a', symbol: 'beaker', contents: { main: layers } }] }).map((p) => [p.path, p.message, p.hint])
    expect(rule(Array.from({ length: 5 }, () => ({ preset: 'Water', amount: 0.1 })))).toEqual([
      ['parts[0].contents.main', '"main" has 5 layers, and a cavity holds at most 4.', 'Remove 1 of them.'],
    ])
    expect(rule([{ preset: 'Pale green gas' }, { preset: 'Brown gas' }])).toEqual([
      ['parts[0].contents.main[1]', 'A cavity holds at most one gas layer.', 'Remove one of them.'],
    ])
    expect(rule([{ preset: 'Pale green gas' }, { preset: 'Water', amount: 0.2 }])).toEqual([
      ['parts[0].contents.main[1]', 'A gas layer must be the last layer.', 'Put the gas layer after all the others.'],
    ])
    expect(
      rule([
        { preset: 'Water', amount: 0.2 },
        { preset: 'Chips or granules', amount: 0.1 },
      ]),
    ).toEqual([
      [
        'parts[0].contents.main[1]',
        'Lumps lie at the bottom of a cavity.',
        'Put the lumps layer first (draw ice only when it is packed up to the surface: lumps, then a thin liquid).',
      ],
    ])
    expect(
      rule([
        { preset: 'Water', amount: 0.7 },
        { preset: 'Oil or organic layer', amount: 0.5 },
      ]),
    ).toEqual([
      [
        'parts[0].contents.main',
        'The layers of "main" add up to 1.2, and a cavity holds at most 1.',
        'Lower the amounts so that they add up to 1 or less (a gas is not counted).',
      ],
    ])
    expect(rule([{ preset: 'Pale green gas', amount: 0.3 }])).toEqual([
      [
        'parts[0].contents.main[0]',
        'A gas layer has no amount and no reading.',
        'A gas fills the space above the other layers: remove "amount" and "reading".',
      ],
    ])
    expect(rule([{ preset: 'Water' }])).toEqual([
      ['parts[0].contents.main[0]', 'A layer needs an "amount" or a "reading".', 'For example { "preset": "Water", "amount": 0.5 }.'],
    ])
    expect(rule([{ preset: 'Water', amount: 0.5, reading: 20 }])[0][1]).toBe('A layer has an "amount" or a "reading", not both.')
    expect(rule([{ preset: 'Water', amount: 1.5 }])[0][1]).toBe('The amount 1.5 is outside 0 to 1.')
    expect(rule([{ preset: 'Chips or granules', amount: 0.2, bubbles: 'few' }])[0][1]).toBe(
      'A layer of kind "lumps" cannot have a meniscus, bubbles or cloudiness.',
    )
    expect(rule([{ kind: 'powder', amount: 0.2 }])[0][1]).toBe('A layer of kind "powder" needs a "colour".')
    expect(rule([{ preset: 'Water', kind: 'liquid', amount: 0.2 }])[0][1]).toBe('A layer has a "preset" or a "kind" and "colour", not both.')
  })

  it('warns about a meniscus that is not on the top liquid', () => {
    const r = compileRecipe({
      title: 't',
      parts: [
        {
          id: 'a',
          symbol: 'beaker',
          contents: {
            main: [
              { preset: 'Water', amount: 0.2, meniscus: true },
              { preset: 'Oil or organic layer', amount: 0.2 },
            ],
          },
        },
      ],
    })
    expect(r.doc).not.toBeNull()
    expect(r.problems).toEqual([
      {
        level: 'warning',
        path: 'parts[0].contents.main[0].meniscus',
        message: 'Only the top liquid layer has a meniscus: this layer is drawn flat.',
        hint: 'Remove "meniscus" from this layer.',
      },
    ])
  })
})

describe('recipe: connectors', () => {
  const base = [
    { id: 'flask', symbol: 'conicalFlask', at: { x: 0, y: 0, anchor: 'base' } },
    { id: 'trough', symbol: 'trough', on: { part: 'flask', anchor: 'base', own: 'base', dx: 300 } },
  ]
  const tube = (c: object): ConnectorItem => connectors(make({ title: 't', parts: base, connectors: [c] }))[0]

  it('goes through anchors, steps and points of the world', () => {
    const c = tube({ kind: 'glassTube', points: [{ part: 'flask', anchor: 'mouth' }, { dy: -60 }, { dx: 120 }, { x: 500, y: -250 }] })
    expect(c.kind).toBe('glassTube')
    expect(c.points.map((p) => [p.x, p.y])).toEqual([
      [0, -150],
      [0, -210],
      [120, -210],
      [500, -250],
    ])
  })

  it('goes upright or level to an anchor or a number, from the point before', () => {
    const c = tube({
      kind: 'glassTube',
      points: [
        { part: 'flask', anchor: 'mouth', dy: 46 },
        { y: { part: 'flask', anchor: 'mouth', dy: -62 } },
        { x: { part: 'trough', anchor: 'base', dx: -90 } },
        { y: -30 },
        { x: 300 },
      ],
    })
    expect(c.points.map((p) => [p.x, p.y])).toEqual([
      [0, -104],
      [0, -212],
      [210, -212],
      [210, -30],
      [300, -30],
    ])
  })

  it('bends with the radius of its kind, of the connector, or of one point', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]
    expect(tube({ kind: 'glassTube', points }).points.map((p) => p.r)).toEqual([undefined, 12, 12, undefined])
    expect(tube({ kind: 'rubberTube', points }).points.map((p) => p.r)).toEqual([undefined, 16, 16, undefined])
    expect(tube({ kind: 'wire', points }).points.map((p) => p.r)).toEqual([undefined, undefined, undefined, undefined])
    expect(tube({ kind: 'glassTube', radius: 20, points }).points.map((p) => p.r)).toEqual([undefined, 20, 20, undefined])
    expect(tube({ kind: 'glassTube', points: [points[0], { ...points[1], r: 30 }, { ...points[2], r: 0 }, points[3]] }).points.map((p) => p.r)).toEqual([
      undefined,
      30,
      undefined,
      undefined,
    ])
  })

  it('has the caps, width and dashes of its kind, and a name of its own', () => {
    const t = tube({
      kind: 'glassTube',
      id: 'delivery',
      width: 9,
      endCap: 'closed',
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
    })
    expect([t.id, t.width, t.endCap, t.startCap]).toEqual(['delivery', 9, 'closed', 'none'])
    const w = tube({
      kind: 'wire',
      dash: true,
      startCap: 'dot',
      endCap: 'arrow',
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
    })
    expect([w.dash, w.startCap, w.endCap, w.width]).toEqual([true, 'dot', 'arrow', undefined])
    // Without an id a connector is named by its kind and its number, whatever the parts are called.
    const named = connectors(
      make({
        title: 't',
        parts: [{ id: 'glassTube1', symbol: 'beaker' }],
        connectors: [
          {
            kind: 'glassTube',
            points: [
              { x: 0, y: 0 },
              { x: 5, y: 5 },
            ],
          },
          {
            kind: 'wire',
            points: [
              { x: 0, y: 0 },
              { x: 5, y: 5 },
            ],
          },
        ],
      }),
    )
    expect(named.map((c) => c.id)).toEqual(['glassTube2', 'wire2'])
  })

  it('reports each connector fault with the fix', () => {
    const faults = (c: object) => errorsOf({ title: 't', parts: base, connectors: [c] }).map((p) => [p.path, p.message, p.hint])
    expect(
      faults({
        kind: 'pipe',
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      }),
    ).toEqual([['connectors[0].kind', 'The connector "kind" is "pipe", which is not allowed.', 'It is one of "glassTube", "rubberTube", "wire", "line".']])
    expect(faults({ kind: 'wire', points: [{ x: 0, y: 0 }] })[0][1]).toBe('A connector needs a list of at least two points.')
    expect(faults({ kind: 'wire', points: [{ dx: 5 }, { x: 5, y: 5 }] })[0][1]).toBe(
      'The first point of a connector cannot be a step { "dx", "dy" }: no point comes before it.',
    )
    expect(faults({ kind: 'wire', points: [{ y: 5 }, { x: 5, y: 5 }] })[0][1]).toBe('The first point of a connector needs both "x" and "y".')
    expect(
      faults({
        kind: 'wire',
        points: [
          { x: 0, y: 0 },
          { part: 'flask', anchor: 'nope' },
        ],
      }),
    ).toEqual([
      [
        'connectors[0].points[1].anchor',
        'The part "flask" (conicalFlask) has no anchor "nope".',
        `Its anchors are: base (base), mouth (mouth), neck (neck). ${ANCHOR_KIND}`,
      ],
    ])
    expect(
      faults({
        kind: 'wire',
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      })[0][1],
    ).toBe('All the points of this connector are in one place, so nothing would be drawn.')
    expect(
      faults({
        kind: 'wire',
        width: 5,
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      })[0][1],
    ).toBe('A wire has no width.')
    expect(
      faults({
        kind: 'glassTube',
        dash: true,
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      })[0][1],
    ).toBe('A glassTube cannot be dashed.')
    expect(
      faults({
        kind: 'glassTube',
        endCap: 'arrow',
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      }),
    ).toEqual([['connectors[0].endCap', 'The endCap is "arrow", which a glassTube cannot have.', 'The ends of a glassTube are: "none", "closed".']])
    expect(
      faults({
        kind: 'glassTube',
        width: 99,
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
      })[0][1],
    ).toBe('The width 99 is outside 2 to 40.')
  })

  it('moves a point along an anchor that has a direction, and refuses one that has none', () => {
    const parts = [{ id: 'gen', symbol: 'vibrationGenerator', at: { x: 0, y: 0, anchor: 'base' } }]
    const faults = (points: object[]) => errorsOf({ title: 't', parts, connectors: [{ kind: 'wire', points }] }).map((p) => [p.path, p.message, p.hint])
    // The pin of the generator points up: 30 out of it is 30 up.
    const ok = connectors(
      make({
        title: 't',
        parts,
        connectors: [
          {
            kind: 'wire',
            points: [
              { part: 'gen', anchor: 'pin' },
              { part: 'gen', anchor: 'pin', out: 30 },
            ],
          },
        ],
      }),
    )[0]
    expect(ok.points[1].x - ok.points[0].x).toBeCloseTo(0, 9)
    expect(ok.points[1].y - ok.points[0].y).toBeCloseTo(-30, 9)
    expect(
      faults([
        { x: 0, y: 0 },
        { part: 'gen', anchor: 'terminalA', out: 5 },
      ]),
    ).toEqual([
      [
        'connectors[0].points[1].out',
        'The anchor "terminalA" of "gen" has no direction, so "out" cannot be used.',
        'Use "dx" and "dy" (world units, y down) instead.',
      ],
    ])
  })
})

describe('recipe: the draw order', () => {
  const parts = (extra: Record<string, object>) => [
    { id: 'tile', symbol: 'tile', at: { x: 0, y: 0, anchor: 'under' }, ...extra.tile },
    { id: 'flask', symbol: 'conicalFlask', on: { part: 'tile', anchor: 'top', own: 'base' }, ...extra.flask },
    { id: 'burette', symbol: 'burette', on: { part: 'flask', anchor: 'mouth', own: 'tip', dy: 15 }, ...extra.burette },
    { id: 'clamp', symbol: 'bossClamp', on: { part: 'burette', anchor: 'neck', own: 'grip' }, ...extra.clamp },
    {
      id: 'stand',
      symbol: 'clampStand',
      alignX: { part: 'clamp', anchor: 'sleeve', own: 'rod' },
      alignY: { part: 'tile', anchor: 'under', own: 'base' },
      ...extra.stand,
    },
  ]
  const order = (extra: Record<string, object>, more: object = {}) =>
    make({ title: 't', parts: parts(extra), ...more }).order.filter((id) => !id.startsWith('label'))

  it('is the list order, and then the connectors', () => {
    expect(
      order(
        {},
        {
          connectors: [
            {
              id: 'tube',
              kind: 'wire',
              points: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
              ],
            },
          ],
        },
      ),
    ).toEqual(['tile', 'flask', 'burette', 'clamp', 'stand', 'tube'])
  })

  it('puts a part just behind another with "behind", and behind everything with "back"', () => {
    expect(order({ clamp: { behind: 'burette' } })).toEqual(['tile', 'flask', 'clamp', 'burette', 'stand'])
    expect(order({ clamp: { behind: 'burette' }, stand: { back: true } })).toEqual(['stand', 'tile', 'flask', 'clamp', 'burette'])
    // A stand behind its clamp, which is behind the vessel: the chain comes out in order, whatever the list order.
    expect(order({ clamp: { behind: 'burette' }, stand: { behind: 'clamp' } })).toEqual(['tile', 'flask', 'stand', 'clamp', 'burette'])
  })

  it('puts a connector behind a part when it says so', () => {
    const c = {
      id: 'wire',
      kind: 'wire',
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
      behind: 'flask',
    }
    expect(order({}, { connectors: [c] })).toEqual(['tile', 'wire', 'flask', 'burette', 'clamp', 'stand'])
  })

  it('reports a part that is behind a part that is not there, or behind itself, or both ways', () => {
    expect(errorsOf({ title: 't', parts: parts({ clamp: { behind: 'burete' } }) }).map((p) => [p.path, p.message, p.hint])).toEqual([
      [
        'parts[3].behind',
        '"behind" names "burete", which is not a part.',
        'The part ids are: "tile", "flask", "burette", "clamp", "stand". Did you mean "burette"?',
      ],
    ])
    expect(errorsOf({ title: 't', parts: parts({ clamp: { behind: 'clamp' } }) })[0].message).toBe('An item cannot be drawn behind itself.')
    expect(errorsOf({ title: 't', parts: parts({ clamp: { behind: 'burette', back: true } }) })[0].message).toBe(
      'An item is drawn "behind" another part or at the "back", not both.',
    )
  })
})

describe('recipe: labels', () => {
  const beakers = {
    title: 't',
    parts: [
      { id: 'mat', symbol: 'heatproofMat', at: { x: 0, y: 0, anchor: 'under' } },
      { id: 'left', symbol: 'beaker', on: { part: 'mat', anchor: 'top', own: 'base', dx: -150 } },
      { id: 'right', symbol: 'beaker', on: { part: 'mat', anchor: 'top', own: 'base', dx: 150 }, contents: { main: [{ preset: 'Water', amount: 0.5 }] } },
      { id: 'thermometer', symbol: 'thermometer', on: { part: 'right', anchor: 'base', own: 'bulb', dy: -10 } },
    ],
  }
  const withLabels = (l: object) => make({ ...beakers, labels: l })

  /** The spacing and crossing rules of Label all, on the labels of a column. */
  function expectColumns(doc: Doc) {
    const size = doc.settings.labelSize
    for (const side of ['left', 'right'] as const) {
      const column = labels(doc).filter((l) => l.side === side && l.target && labelTarget(doc, l) && Math.abs(l.x) > 100)
      for (let i = 0; i < column.length; i++) {
        for (let j = i + 1; j < column.length; j++) {
          const a = column[i],
            b = column[j]
          expect(Math.abs(a.y - b.y), `${a.text} and ${b.text}`).toBeGreaterThanOrEqual(LABEL_SPACING * size - 1e-6)
          const la = leaderOf(doc, a)!,
            lb = leaderOf(doc, b)!
          expect(segmentsCross(la[0], la[1], lb[0], lb[1]), `the leaders of ${a.text} and ${b.text} cross`).toBe(false)
        }
      }
    }
  }

  it('is Label all by default: the labels that autoLabels makes, fixed to the parts', () => {
    const doc = withLabels({})
    const bare = make({ ...beakers, labels: { auto: false } })
    expect(labels(bare)).toEqual([])
    let n = 0
    const want = autoLabels(bare, () => `label${++n}`)
    expect(labels(doc).map((l) => ({ ...l, id: '' }))).toEqual(
      want
        .map((l) => ({ ...l, id: '' }))
        .map((l) => ({ ...l, x: Math.round(l.x * 1000) / 1000, y: Math.round(l.y * 1000) / 1000 }))
        .map((l) => ({
          ...l,
          target:
            l.target && 'item' in l.target ? { ...l.target, lx: Math.round(l.target.lx * 1000) / 1000, ly: Math.round(l.target.ly * 1000) / 1000 } : l.target,
        })),
    )
    expect(
      labels(doc)
        .map((l) => l.text)
        .sort(),
    ).toEqual(['beaker', 'beaker', 'heatproof mat', 'thermometer'])
    expect(labels(doc).every(isFixed)).toBe(true)
    expectColumns(doc)
  })

  it('changes the text of a part, and leaves parts out', () => {
    const doc = withLabels({ text: { left: '250 cm3 beaker' }, skip: ['mat', 'thermometer'] })
    expect(labels(doc).map((l) => [l.text, (l.target as { item: string }).item])).toEqual([
      ['250 cm3 beaker', 'left'],
      ['beaker', 'right'],
    ])
  })

  it('puts the text of a part on the side that the recipe says', () => {
    const doc = withLabels({ side: { left: 'right', right: 'left' } })
    const of = (id: string) => labels(doc).find((l) => isFixed(l) && l.target.item === id)!
    expect(of('left').side).toBe('right')
    expect(of('right').side).toBe('left')
    expect(of('mat').side).toBe(of('mat').x < 0 ? 'left' : 'right')
    expect(labels(doc)).toHaveLength(4)
    expectColumns(doc)
  })

  it('adds an extra label to a part, at a point of its frame or at an anchor, in the column with the others', () => {
    const doc = withLabels({
      extra: [
        { text: 'water', part: 'right', at: [30, 90] },
        { text: 'the mouth', part: 'left', anchor: 'mouth', end: 'dot' },
      ],
    })
    const water = labels(doc).find((l) => l.text === 'water')!
    expect(water.target).toEqual({ item: 'right', lx: 30, ly: 90 })
    const mouth = labels(doc).find((l) => l.text === 'the mouth')!
    expect(mouth.target).toEqual({ item: 'left', lx: 0, ly: 0 })
    expect(mouth.leaderEnd).toBe('dot')
    expect(labels(doc)).toHaveLength(6)
    expectColumns(doc)
    // The leader of "water" ends where it says, in the world: x = 0 is the centre line of the part, y = 0 its top.
    const p = labelTarget(doc, water)!
    expect(near(p.x, part(doc, 'right').x + 30) && near(p.y, part(doc, 'right').y - 60 + 90)).toBe(true)
  })

  it('places a text at an offset from where its leader ends, on the side of the offset', () => {
    const doc = withLabels({
      auto: false,
      extra: [
        { text: 'a', part: 'right', at: [50, 60], textAt: [40, -30] },
        { text: 'b', part: 'left', at: [0, 60], textAt: [-40, -30] },
        { text: 'c', part: 'left', at: [0, 60], textAt: [20, 50], side: 'left' },
      ],
    })
    const [a, b, c] = ['a', 'b', 'c'].map((t) => labels(doc).find((l) => l.text === t)!)
    const end = (l: LabelItem): Pt => labelTarget(doc, l)!
    expect([a.side, a.x - end(a).x, a.y - end(a).y]).toEqual(['right', 40, -30])
    expect([b.side, b.x - end(b).x, b.y - end(b).y]).toEqual(['left', -40, -30])
    expect(c.side).toBe('left')
  })

  it('puts the text of a label on a tube next to the tube', () => {
    const run = (extra: object, points: object[]) =>
      make({ ...beakers, labels: { auto: false, extra: [extra] }, connectors: [{ id: 'tube', kind: 'glassTube', points }] })
    const level = run({ text: 'delivery tube', connector: 'tube', along: 0.5 }, [
      { x: -100, y: -300 },
      { x: 100, y: -300 },
    ])
    const l = labels(level)[0]
    expect([l.side, l.x, l.y, l.target]).toEqual(['right', -12, -324, { x: 0, y: -300 }])
    const upright = run({ text: 'delivery tube', connector: 'tube' }, [
      { x: -300, y: 0 },
      { x: -300, y: -100 },
    ])
    const u = labels(upright)[0]
    expect([u.side, u.x, u.y, u.target]).toEqual(['left', -330, -45, { x: -300, y: -50 }])
    // Its own side and offset win.
    const own = labels(
      run({ text: 't', connector: 'tube', side: 'left', textAt: [-5, 20] }, [
        { x: -100, y: -300 },
        { x: 100, y: -300 },
      ]),
    )[0]
    expect([own.side, own.x, own.y]).toEqual(['left', -5, -280])
  })

  it('adds a label that points at a place, and plain text with no leader', () => {
    const doc = withLabels({
      auto: false,
      extra: [
        { text: 'here', point: { x: 5, y: -300 }, textAt: [30, -10] },
        { text: 'to the pump', near: { part: 'right', anchor: 'mouth', dx: 20, dy: -10 } },
      ],
    })
    expect(labels(doc).map((l) => [l.text, l.target, l.side])).toEqual([
      ['here', { x: 5, y: -300 }, 'right'],
      ['to the pump', undefined, 'right'],
    ])
  })

  it('reports each label fault with the fix', () => {
    const faults = (extra: unknown) => errorsOf({ ...beakers, labels: { extra } }).map((p) => [p.path, p.message])
    expect(faults([{ text: 'x' }])).toEqual([['labels.extra[0]', 'This label points at nothing.']])
    expect(faults([{ text: 'x', part: 'zz' }])).toEqual([['labels.extra[0].part', 'This label names "zz", which is not a part.']])
    expect(faults([{ text: 'x', connector: 'c' }])).toEqual([['labels.extra[0].connector', 'This label names "c", which is not a connector.']])
    expect(faults([{ text: 'x', part: 'left', anchor: 'nope' }])[0]).toEqual(['labels.extra[0].anchor', 'The part "left" (beaker) has no anchor "nope".'])
    expect(faults([{ text: 'x', part: 'left', side: 'up' }])).toEqual([['labels.extra[0].side', 'The "side" of a label is "up".']])
    expect(faults([{ text: 'x', part: 'left', at: [1] }])[0]).toEqual(['labels.extra[0].at', 'The "at" of a label must be [lx, ly].'])
    expect(faults([{ text: 'x', part: 'left', textAt: 5 }])[0]).toEqual(['labels.extra[0].textAt', 'The "textAt" of a label must be [dx, dy].'])
    expect(faults([{ text: 'x', part: 'left', end: 'star' }])[0][0]).toBe('labels.extra[0].end')
    expect(faults('x')).toEqual([['labels.extra', 'The "extra" labels must be a list [ ... ].']])
    expect(errorsOf({ ...beakers, labels: { side: { left: 'up', zz: 'left' } } }).map((p) => p.path)).toEqual(['labels.side.left', 'labels.side.zz'])
    expect(errorsOf({ ...beakers, labels: { skip: ['left'], side: { left: 'left' } } }).map((p) => p.message)).toEqual([
      '"left" is in "labels.skip" and in "labels.side".',
    ])
  })
})

describe('recipe: settings and the files', () => {
  it('takes the settings of the document, with the editor defaults', () => {
    expect(make({ title: 't', parts: [{ id: 'a', symbol: 'beaker' }] }).settings).toEqual({ mono: false, labelMode: 'text', labelSize: 15, smartText: true })
    const doc = make({ title: 't', settings: { labelMode: 'letters', mono: true, labelSize: 18, smartText: false }, parts: [{ id: 'a', symbol: 'beaker' }] })
    expect(doc.settings).toEqual({ mono: true, labelMode: 'letters', labelSize: 18, smartText: false })
    expect(doc.title).toBe('t')
  })

  it('reports a setting that is not allowed', () => {
    expect(
      errorsOf({ title: 't', settings: { labelMode: 'letter', labelSize: 100, mono: 'no', size: 1 }, parts: [{ id: 'a', symbol: 'beaker' }] }).map(
        (p) => p.path,
      ),
    ).toEqual(['settings.size', 'settings.labelMode', 'settings.mono', 'settings.labelSize'])
  })

  it('tells a recipe from a saved document', () => {
    expect(isRecipe(HEATING_BEAKER)).toBe(true)
    expect(isRecipe(TEMPLATES[0].build())).toBe(false)
    expect(isRecipe(null)).toBe(false)
    expect(isRecipe({ parts: 'no' })).toBe(false)
  })
})

describe('recipe: the names that it suggests', () => {
  it('finds the nearest names by edit distance', () => {
    expect(nearestNames('beker', ['beaker', 'burette', 'trough'])).toEqual(['beaker'])
    expect(nearestNames('Pnk', ['Pink', 'Red', 'Purple'])).toEqual(['Pink'])
    expect(nearestNames('zzzz', ['beaker', 'burette'])).toEqual([])
    expect(nearestNames('', ['beaker'])).toEqual([])
  })

  it('finds a symbol by a word of its name or of its aliases, or by its id with the spaces left out', () => {
    expect(suggestSymbols('retort stand').map((d) => d.id)[0]).toBe('clampStand')
    expect(suggestSymbols('Erlenmeyer').map((d) => d.id)).toContain('conicalFlask')
    expect(suggestSymbols('bunsen burner').map((d) => d.id)[0]).toBe('bunsenBurner')
    expect(suggestSymbols('measuring cylinder').map((d) => d.id)).toContain('measuringCylinder')
    expect(suggestSymbols('zzzz')).toEqual([])
    expect(suggestSymbols('cylinder').length).toBeLessThanOrEqual(5)
  })
})
