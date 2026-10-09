// dotcross.science.test.ts — the science of the dot-and-cross diagrams and of the periodic table. Each symbol has a model that dotcross.ts exports;
// these tests check the model against chemistry (shells, valencies, charges, the layout of the table) with numbers typed here, and then read the
// marks back out of `geometry()` to see that the drawing agrees with the model. A test that cannot fail is worth nothing: the report says, for each, the
// break that made it fail.

import { describe, expect, it } from 'vitest'
import { P, dist, type Pt } from '../kernel/geom'
import {
  METALS,
  METRICS,
  NON_METALS,
  INNER_SYMBOL_SIZE,
  SYMBOL_SIZE,
  arrangement,
  chargeText,
  compoundName,
  covalentDiagram,
  ionicDiagram,
  ionicModel,
  type CovalentDiagram,
  type CovalentLayout,
  type IonicDiagram,
  type MarkKind,
} from './dotcross'
import { MOLECULES, molecule } from './molecules'
import { geometry, labelText, symbolDef } from './registry'
import type { Geometry } from './types'

// ---------------------------------------------------------------- reading marks back out of a drawing

interface DrawnMark {
  x: number
  y: number
  mark: MarkKind
}

/** Every electron mark in a drawing, read from the path data alone: dots are `ink` circles, crosses are pairs of strokes, rings are `detail` circles. */
function drawnMarks(g: Geometry): DrawnMark[] {
  const out: DrawnMark[] = []
  const num = '(-?[\\d.]+)'
  const circles = new RegExp(`M${num} ${num}a${num} ${num} 0 1 0 ${num} 0a${num} ${num} 0 1 0 ${num} 0Z`, 'g')
  const crosses = new RegExp(`M${num} ${num}L${num} ${num}M${num} ${num}L${num} ${num}`, 'g')
  for (const prim of g.prims) {
    if (prim.role === 'ink') for (const m of prim.d.matchAll(circles)) out.push({ x: Number(m[1]) + Number(m[3]), y: Number(m[2]), mark: 'dot' })
    if (prim.role === 'detail') {
      // A small circle is an open ring; a large one is the plain circle of an inner shell.
      for (const m of prim.d.matchAll(circles)) if (Number(m[3]) < 4) out.push({ x: Number(m[1]) + Number(m[3]), y: Number(m[2]), mark: 'ring' })
      for (const m of prim.d.matchAll(crosses)) out.push({ x: (Number(m[1]) + Number(m[3])) / 2, y: (Number(m[2]) + Number(m[4])) / 2, mark: 'cross' })
    }
  }
  return out
}

/** Marks sorted by position, so that two lists of marks can be compared whatever order they were made in. */
const sorted = <T extends { x: number; y: number; mark: MarkKind }>(marks: T[]): T[] =>
  [...marks].sort((a, b) => a.mark.localeCompare(b.mark) || Math.round(a.x * 10) - Math.round(b.x * 10) || Math.round(a.y * 10) - Math.round(b.y * 10))

// ---------------------------------------------------------------- covalent

const LAYOUTS: CovalentLayout[] = ['overlap', 'apart']
const MARKS = ['default', 'swapped', 'ring'] as const
/** The usual valency: the pairs that an atom shares. */
const VALENCY: Record<string, number> = { H: 1, F: 1, Cl: 1, O: 2, N: 3, C: 4 }
/** The outer electrons of each molecule, added up over its atoms (8 for water, ammonia and methane). */
const TOTAL: Record<string, number> = { H2: 2, Cl2: 14, O2: 12, N2: 10, HCl: 8, H2O: 8, NH3: 8, CH4: 8, CO2: 16, HF: 8, F2: 14, C2H4: 12, C2H6: 14 }
/** The lone pairs of each element in each molecule. */
const LONE: Record<string, Record<string, number>> = {
  H2: { H: 0 },
  Cl2: { Cl: 3 },
  O2: { O: 2 },
  N2: { N: 1 },
  HCl: { H: 0, Cl: 3 },
  H2O: { H: 0, O: 2 },
  NH3: { N: 1, H: 0 },
  CH4: { C: 0, H: 0 },
  CO2: { C: 0, O: 2 },
  HF: { H: 0, F: 3 },
  F2: { F: 3 },
  C2H4: { C: 0, H: 0 },
  C2H6: { C: 0, H: 0 },
}

const def = symbolDef('covalentDotCross')
const SIZES = [def.size, def.min ?? def.size, { w: def.size.w * 1.5, h: def.size.h * 1.5 }]
const sizeName = (s: { w: number; h: number }) => `${s.w}x${s.h}`

/** Every covalent diagram worth checking: each molecule in each layout at default, minimum and 1.5 times the size. */
function* covalentCases(marks = 'default') {
  for (const m of MOLECULES)
    for (const layout of LAYOUTS)
      for (const s of SIZES) yield { m, layout, size: s, label: `${m.id} ${layout} ${sizeName(s)}`, d: covalentDiagram(m.id, layout, marks, s.w, s.h) }
}

/** The electrons around atom `i` once the shared pairs are counted: its own lone pairs and every mark of every bond that it is in. */
function around(d: CovalentDiagram, i: number): number {
  const bonds = new Set(d.molecule.bonds.flatMap((b, bi) => (b.a === i || b.b === i ? [bi] : [])))
  return d.marks.filter((q) => (q.bond === null && q.atom === i) || (q.bond !== null && bonds.has(q.bond))).length
}

describe('covalent dot-and-cross: the model', () => {
  it('gives every atom a full outer shell: 2 electrons for hydrogen, 8 for the others', () => {
    for (const { label, d } of covalentCases()) d.atoms.forEach((a, i) => expect(around(d, i), `${label} ${a.symbol}${i}`).toBe(a.symbol === 'H' ? 2 : 8))
  })

  it('shares the usual number of pairs: H 1, F 1, Cl 1, O 2, N 3, C 4', () => {
    for (const { label, d } of covalentCases()) {
      d.atoms.forEach((a, i) => {
        // Each shared pair has one electron from each atom, so the pairs an atom shares are the bond marks that it owns.
        const shared = d.marks.filter((q) => q.atom === i && q.bond !== null).length
        expect(shared, `${label} ${a.symbol}${i}`).toBe(VALENCY[a.symbol])
      })
    }
  })

  it('draws the outer electrons of every atom and no others: the total is the sum over the atoms (8 for H2O, NH3 and CH4)', () => {
    for (const { m, label, d } of covalentCases()) {
      expect(d.marks.length, label).toBe(TOTAL[m.id])
      d.atoms.forEach((_, i) => expect(d.marks.filter((q) => q.atom === i).length, `${label} atom ${i}`).toBe(m.atoms[i].outer))
    }
    expect([...covalentCases('default')].filter((c) => ['H2O', 'NH3', 'CH4'].includes(c.m.id)).every((c) => c.d.marks.length === 8)).toBe(true)
  })

  it('gives each shared pair one mark of each kind: a bond of order n has n marks of one atom and n of the other, and the two atoms use different marks', () => {
    for (const choice of MARKS)
      for (const { label, d } of covalentCases(choice)) {
        d.molecule.bonds.forEach((b, bi) => {
          const marks = d.marks.filter((q) => q.bond === bi)
          expect(marks.length, `${label} ${choice} bond ${bi}`).toBe(2 * b.order)
          const ofA = marks.filter((q) => q.atom === b.a),
            ofB = marks.filter((q) => q.atom === b.b)
          expect([ofA.length, ofB.length], `${label} ${choice} bond ${bi}`).toEqual([b.order, b.order])
          expect(new Set(ofA.map((q) => q.mark)).size, label).toBe(1)
          expect(new Set(ofB.map((q) => q.mark)).size, label).toBe(1)
          expect(ofA[0].mark, `${label} ${choice} bond ${bi}: the two atoms must use different marks`).not.toBe(ofB[0].mark)
        })
      }
  })

  it('draws the lone pairs, each as two marks side by side, and no lone electron on its own', () => {
    for (const { m, label, d } of covalentCases()) {
      d.atoms.forEach((a, i) => {
        const lone = d.marks.filter((q) => q.atom === i && q.bond === null)
        expect(lone.length, `${label} ${a.symbol}${i}`).toBe(2 * LONE[m.id][a.symbol])
        // Every lone mark has exactly one partner next to it (PAIR apart), and the pairs are far from each other.
        for (const q of lone) {
          const near = lone.filter((r) => r !== q && dist(r, q) < 12)
          expect(near.length, `${label} ${a.symbol}${i}`).toBe(1)
          expect(dist(near[0], q), `${label} ${a.symbol}${i}`).toBeGreaterThan(7.5)
        }
      })
    }
  })

  it('gives the first atom (the central atom) crosses and the atoms bonded to it dots; two identical atoms use one of each', () => {
    const kinds = (id: string, choice: string) => covalentDiagram(id, 'overlap', choice, 220, 160).atoms.map((a) => a.mark)
    expect(kinds('H2O', 'default')).toEqual(['cross', 'dot', 'dot']) // O in the middle, the two H bonded to it
    expect(kinds('NH3', 'default')).toEqual(['cross', 'dot', 'dot', 'dot'])
    expect(kinds('CH4', 'default')).toEqual(['cross', 'dot', 'dot', 'dot', 'dot'])
    expect(kinds('CO2', 'default')).toEqual(['cross', 'dot', 'dot'])
    expect(kinds('HCl', 'default')).toEqual(['cross', 'dot']) // H is the first atom of the formula
    for (const id of ['H2', 'Cl2', 'O2', 'N2', 'F2']) expect(kinds(id, 'default'), id).toEqual(['cross', 'dot'])
    // Ethene: the carbon atoms are bonded to each other, so one has crosses and one dots; each hydrogen has the mark that the carbon beside it does not.
    expect(kinds('C2H4', 'default')).toEqual(['cross', 'dot', 'dot', 'dot', 'cross', 'cross'])
    expect(kinds('H2O', 'swapped')).toEqual(['dot', 'cross', 'cross'])
    expect(kinds('H2O', 'ring')).toEqual(['ring', 'dot', 'dot'])
  })

  it('uses the same two marks in every picture of one choice, and only dots, crosses and rings, never a colour', () => {
    for (const choice of MARKS) {
      const used = new Set<string>()
      for (const { d } of covalentCases(choice)) for (const q of d.marks) used.add(q.mark)
      expect([...used].sort(), choice).toEqual(choice === 'default' ? ['cross', 'dot'] : choice === 'swapped' ? ['cross', 'dot'] : ['dot', 'ring'])
    }
    for (const { label } of covalentCases()) {
      const g = geometry('covalentDotCross', 220, 160, { molecule: label.split(' ')[0] })
      for (const p of g.prims) {
        expect(p.tint, label).toBeUndefined()
        expect(['outline', 'ink', 'detail'], label).toContain(p.role)
      }
    }
  })
})

describe('covalent dot-and-cross: the picture agrees with the model', () => {
  it('draws every mark of the model, of the same kind in the same place, and no other', () => {
    for (const choice of MARKS)
      for (const { m, layout, size, label, d } of covalentCases(choice)) {
        const g = geometry('covalentDotCross', size.w, size.h, { molecule: m.id, layout, marks: choice })
        const drawn = sorted(drawnMarks(g)),
          model = sorted(d.marks)
        expect(drawn.length, `${label} ${choice}`).toBe(model.length)
        drawn.forEach((q, i) => {
          expect(q.mark, `${label} ${choice} mark ${i}`).toBe(model[i].mark)
          expect(Math.abs(q.x - model[i].x), `${label} ${choice} mark ${i}`).toBeLessThan(0.02)
          expect(Math.abs(q.y - model[i].y), `${label} ${choice} mark ${i}`).toBeLessThan(0.02)
        })
      }
  })

  it('counts the outer electrons in the drawing: 8 for water, 8 for ammonia, 8 for methane, and the sum over the atoms for every molecule', () => {
    for (const m of MOLECULES)
      for (const layout of LAYOUTS) {
        const g = geometry('covalentDotCross', 220, 160, { molecule: m.id, layout })
        expect(drawnMarks(g).length, `${m.id} ${layout}`).toBe(TOTAL[m.id])
      }
    for (const id of ['H2O', 'NH3', 'CH4']) expect(drawnMarks(geometry('covalentDotCross', 220, 160, { molecule: id })).length, id).toBe(8)
  })

  it('draws one circle for each atom and writes its element symbol in the middle of it', () => {
    for (const { m, layout, size, label, d } of covalentCases()) {
      const g = geometry('covalentDotCross', size.w, size.h, { molecule: m.id, layout })
      expect(g.prims.filter((p) => p.role === 'outline').length, label).toBe(m.atoms.length)
      expect(
        g.texts?.map((t) => t.text),
        label,
      ).toEqual(m.atoms.map((a) => a.element.symbol))
      g.texts?.forEach((t, i) => {
        expect(t.x, label).toBeCloseTo(d.atoms[i].x, 6)
        expect(t.size, label).toBe(SYMBOL_SIZE)
        expect(Math.abs(t.y - SYMBOL_SIZE * 0.36 - d.atoms[i].y), label).toBeLessThan(1e-6)
      })
    }
  })

  it('shows the shared pairs in the overlap (overlapping circles) or between the circles (circles apart), and the lone pairs on the circle of their atom', () => {
    for (const { label, layout, d } of covalentCases()) {
      for (const q of d.marks) {
        if (q.bond === null) {
          const a = d.atoms[q.atom]
          expect(dist(q, a), `${label} lone pair of atom ${q.atom}`).toBeCloseTo(a.r, 6)
          d.atoms.forEach((o, j) => {
            if (j !== q.atom) expect(dist(q, o), `${label} lone pair of atom ${q.atom} against circle ${j}`).toBeGreaterThan(o.r + 4)
          })
          continue
        }
        const { a, b } = d.molecule.bonds[q.bond]
        for (const i of [a, b]) {
          const c = d.atoms[i]
          if (layout === 'overlap') expect(dist(q, c), `${label} shared mark inside circle ${i}`).toBeLessThan(c.r - 4)
          else expect(dist(q, c), `${label} shared mark outside circle ${i}`).toBeGreaterThan(c.r + 4)
        }
      }
    }
  })
})

describe('covalent dot-and-cross: the picture is clean', () => {
  it('has no two marks touching, and no mark touching a circle that it does not sit on', () => {
    for (const { label, d } of covalentCases()) {
      d.marks.forEach((q, i) => {
        for (let j = i + 1; j < d.marks.length; j++) expect(dist(q, d.marks[j]), `${label} marks ${i} and ${j}`).toBeGreaterThan(7.5)
        d.atoms.forEach((a, j) => {
          if (q.bond === null && q.atom === j) return // a lone pair sits on its own circle, in a gap of the line
          expect(Math.abs(dist(q, a) - a.r), `${label} mark ${i} against the circle of atom ${j}`).toBeGreaterThan(4)
        })
      })
    }
  })

  it('keeps every element symbol clear of every circle line', () => {
    // Advance widths of Arial, in em, for the letters of the first 36 elements that the molecules use.
    const advance: Record<string, number> = { H: 0.722, C: 0.722, N: 0.722, O: 0.778, F: 0.611, l: 0.222 }
    for (const { label, d } of covalentCases()) {
      d.atoms.forEach((a, i) => {
        const half = ([...a.symbol].reduce((n, c) => n + advance[c], 0) * SYMBOL_SIZE) / 2,
          up = 0.358 * SYMBOL_SIZE
        // Walk round the edge of the box of the letter.
        const edge: Pt[] = []
        for (let t = 0; t <= 10; t++) {
          const x = -half + (2 * half * t) / 10,
            y = -up + (2 * up * t) / 10
          edge.push(P(a.x + x, a.y - up), P(a.x + x, a.y + up), P(a.x - half, a.y + y), P(a.x + half, a.y + y))
        }
        d.atoms.forEach((c, j) => {
          for (const p of edge) expect(Math.abs(dist(p, c) - c.r), `${label}: the symbol of atom ${i} against the circle of atom ${j}`).toBeGreaterThan(1.8)
        })
      })
    }
  })

  it('keeps every circle inside the box, at the default size and larger', () => {
    for (const { label, size, d } of covalentCases()) {
      if (size === def.min && size !== def.size) continue // the smallest box is checked below
      for (const a of d.atoms) {
        expect(a.x - a.r, label).toBeGreaterThanOrEqual(-size.w / 2)
        expect(a.x + a.r, label).toBeLessThanOrEqual(size.w / 2)
        expect(a.y - a.r, label).toBeGreaterThanOrEqual(0)
        expect(a.y + a.r, label).toBeLessThanOrEqual(size.h)
      }
    }
  })

  it('still fits the box at the smallest size that the symbol allows, with the circles at their natural size or larger', () => {
    const min = def.min!
    for (const m of MOLECULES)
      for (const layout of LAYOUTS) {
        const d = covalentDiagram(m.id, layout, 'default', min.w, min.h)
        expect(d.k, `${m.id} ${layout}`).toBeGreaterThanOrEqual(0.85)
        for (const a of d.atoms) {
          expect(a.x - a.r, `${m.id} ${layout}`).toBeGreaterThanOrEqual(-min.w / 2)
          expect(a.x + a.r, `${m.id} ${layout}`).toBeLessThanOrEqual(min.w / 2)
          expect(a.y - a.r, `${m.id} ${layout}`).toBeGreaterThanOrEqual(0)
          expect(a.y + a.r, `${m.id} ${layout}`).toBeLessThanOrEqual(min.h)
        }
      }
  })

  it('draws the circle of hydrogen smaller than the circle of every other atom, and every atom of one kind the same size', () => {
    for (const layout of LAYOUTS) expect(METRICS[layout].hydrogen).toBeLessThan(METRICS[layout].atom)
    for (const { label, d } of covalentCases()) {
      const hydrogen = new Set(d.atoms.filter((a) => a.symbol === 'H').map((a) => a.r)),
        others = new Set(d.atoms.filter((a) => a.symbol !== 'H').map((a) => a.r))
      expect(hydrogen.size, label).toBeLessThanOrEqual(1)
      expect(others.size, label).toBeLessThanOrEqual(1)
      if (hydrogen.size && others.size) expect([...hydrogen][0], label).toBeLessThan([...others][0])
    }
  })
})

describe('covalent dot-and-cross: parameters and the symbol row', () => {
  it('labels the diagram with the name of the molecule', () => {
    expect(labelText(def)).toBe('water')
    for (const m of MOLECULES) expect(labelText(def, { molecule: m.id }), m.id).toBe(m.name)
    expect(labelText(def, { molecule: 'nonsense' })).toBe('water')
  })

  it('draws something sensible for a molecule, layout or marks that it does not know, and never throws', () => {
    const water = JSON.stringify(geometry('covalentDotCross', 220, 160, { molecule: 'H2O' }))
    expect(JSON.stringify(geometry('covalentDotCross', 220, 160, { molecule: 'XeF4' }))).toBe(water)
    expect(JSON.stringify(geometry('covalentDotCross', 220, 160, { layout: 'sideways' }))).toBe(water)
    expect(JSON.stringify(geometry('covalentDotCross', 220, 160, { marks: 'purple' }))).toBe(water)
    expect(JSON.stringify(geometry('covalentDotCross', 220, 160, { molecule: 42 as unknown as string }))).toBe(water)
    for (const [w, h] of [
      [1, 1],
      [0, 0],
      [20, 600],
      [900, 30],
    ]) {
      for (const m of MOLECULES) {
        const g = geometry('covalentDotCross', w, h, { molecule: m.id, layout: 'apart' })
        expect(g.prims[0].role, `${m.id} ${w}x${h}`).not.toBe('dashed') // not the placeholder of a symbol that failed
        for (const p of g.prims) expect(p.d).not.toMatch(/NaN|Infinity/)
      }
    }
  })

  it('offers the thirteen molecules, two layouts and three marks, with the first as the default', () => {
    expect(def.params?.map((p) => p.key)).toEqual(['molecule', 'layout', 'marks'])
    const molecules = def.params![0]
    expect(molecules.type === 'choice' && molecules.options.map((o) => o.value)).toEqual(MOLECULES.map((m) => m.id))
    expect(molecule('H2O')).toBeDefined()
  })
})

// ---------------------------------------------------------------- ionic

/** The charge of the ion that each element makes, from its group (group 1 +1, group 2 +2, group 3 +3, group 5 -3, group 6 -2, group 7 -1). */
const CHARGE: Record<string, number> = { Li: 1, Na: 1, K: 1, Mg: 2, Ca: 2, Al: 3, N: -3, O: -2, F: -1, S: -2, Cl: -1, Br: -1 }
/** The electron structure of each ion: that of the nearest noble gas (He 2; Ne 2,8; Ar 2,8,8; Kr 2,8,18,8). */
const ION_SHELLS: Record<string, number[]> = {
  Li: [2],
  Na: [2, 8],
  K: [2, 8, 8],
  Mg: [2, 8],
  Ca: [2, 8, 8],
  Al: [2, 8],
  N: [2, 8],
  O: [2, 8],
  F: [2, 8],
  S: [2, 8, 8],
  Cl: [2, 8, 8],
  Br: [2, 8, 18, 8],
}
const NOBLE_GASES = [[2], [2, 8], [2, 8, 8], [2, 8, 18, 8]]
/** Some compounds with the numbers of metal ions and non-metal ions that make them neutral (typed from the formulae). */
const RATIOS: [string, string, number, number, string][] = [
  ['Na', 'Cl', 1, 1, 'sodium chloride'],
  ['Mg', 'Cl', 1, 2, 'magnesium chloride'],
  ['Na', 'O', 2, 1, 'sodium oxide'],
  ['Al', 'O', 2, 3, 'aluminium oxide'],
  ['Mg', 'O', 1, 1, 'magnesium oxide'],
  ['Ca', 'Br', 1, 2, 'calcium bromide'],
  ['K', 'S', 2, 1, 'potassium sulfide'],
  ['Li', 'F', 1, 1, 'lithium fluoride'],
  ['Mg', 'N', 3, 2, 'magnesium nitride'],
  ['Al', 'Cl', 1, 3, 'aluminium chloride'],
  ['Li', 'N', 3, 1, 'lithium nitride'],
  ['Al', 'S', 2, 3, 'aluminium sulfide'],
  ['Al', 'N', 1, 1, 'aluminium nitride'],
  ['Ca', 'O', 1, 1, 'calcium oxide'],
]

const ionicDef = symbolDef('ionicDotCross')
const ION_SIZES = [ionicDef.size, ionicDef.min ?? ionicDef.size, { w: ionicDef.size.w * 1.5, h: ionicDef.size.h * 1.5 }]

/** Every ionic diagram worth checking: each metal with each non-metal, both stages, inner shells on and off, at default, minimum and 1.5 times the size. */
function* ionicCases(marks = 'default') {
  for (const metal of METALS)
    for (const nonMetal of NON_METALS)
      for (const stage of ['transfer', 'ions'])
        for (const inner of [false, true])
          for (const size of ION_SIZES)
            yield {
              metal,
              nonMetal,
              stage,
              inner,
              size,
              label: `${metal}${nonMetal} ${stage}${inner ? ' inner' : ''} ${sizeName(size)}`,
              params: { metal, nonMetal, stage, inner, marks },
              d: ionicDiagram(metal, nonMetal, stage, inner, marks, size.w, size.h),
            }
}

const num = '(-?[\\d.]+)'
/** The curved arrows of a drawing: the shafts are quadratic curves in a `detail` prim, the heads triangles in an `ink` prim. */
function drawnArrows(g: Geometry) {
  const shafts = g.prims
    .filter((p) => p.role === 'detail')
    .flatMap((p) => [...p.d.matchAll(new RegExp(`M${num} ${num}Q${num} ${num} ${num} ${num}`, 'g'))])
    .map((m) => ({ start: P(+m[1], +m[2]), via: P(+m[3], +m[4]), end: P(+m[5], +m[6]) }))
  const heads = g.prims
    .filter((p) => p.role === 'ink')
    .flatMap((p) => [...p.d.matchAll(new RegExp(`M${num} ${num}L${num} ${num}L${num} ${num}Z`, 'g'))])
    .map((m) => ({ tip: P(+m[1], +m[2]), a: P(+m[3], +m[4]), b: P(+m[5], +m[6]) }))
  return { shafts, heads }
}

/** The pairs of square brackets of a drawing: `[ ]` as one path, with its box. */
function drawnBrackets(g: Geometry) {
  const re = new RegExp(`^M${num} ${num}H${num}V${num}H${num}M${num} ${num}H${num}V${num}H${num}$`)
  return g.prims.flatMap((p) => {
    const m = re.exec(p.d)
    return p.role === 'outline' && m ? [{ x0: +m[3], y0: +m[2], x1: +m[8], y1: +m[9] }] : []
  })
}

/** Points along a quadratic curve. */
const along = (a: Pt, c: Pt, b: Pt, n = 24): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n,
      u = 1 - t
    return P(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y)
  })

/** Do the segments p-q and r-s cross? */
function crosses(p: Pt, q: Pt, r: Pt, s: Pt): boolean {
  const side = (a: Pt, b: Pt, c: Pt) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
  return side(p, q, r) !== side(p, q, s) && side(r, s, p) !== side(r, s, q)
}

describe('ionic dot-and-cross: the model', () => {
  it('makes the charge follow the group: group 1 +1, group 2 +2, group 3 +3, group 5 -3, group 6 -2, group 7 -1', () => {
    for (const metal of METALS)
      for (const nonMetal of NON_METALS) {
        const m = ionicModel(metal, nonMetal)
        expect(m.metalCharge, metal).toBe(CHARGE[metal])
        expect(m.nonMetalCharge, nonMetal).toBe(CHARGE[nonMetal])
      }
  })

  it('has the metal lose as many electrons as the non-metal gains, and the numbers of ions give a neutral compound', () => {
    for (const metal of METALS)
      for (const nonMetal of NON_METALS) {
        const m = ionicModel(metal, nonMetal)
        const lost = m.nMetal * CHARGE[metal],
          gained = m.nNonMetal * -CHARGE[nonMetal]
        expect(lost, `${metal}${nonMetal}`).toBe(gained)
        expect(m.nMetal * m.metalCharge + m.nNonMetal * m.nonMetalCharge, `${metal}${nonMetal}`).toBe(0)
        // The smallest numbers that do it: no common factor.
        const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
        expect(gcd(m.nMetal, m.nNonMetal), `${metal}${nonMetal}`).toBe(1)
      }
  })

  it('gives the ratio of ions of the compounds that the lessons use: MgCl2 1 to 2, Na2O 2 to 1, Al2O3 2 to 3', () => {
    for (const [metal, nonMetal, nMetal, nNonMetal] of RATIOS) {
      const m = ionicModel(metal, nonMetal)
      expect([m.nMetal, m.nNonMetal], `${metal}${nonMetal}`).toEqual([nMetal, nNonMetal])
    }
  })

  it('gives every ion the electron structure of a noble gas, with the electrons of the atom less the charge', () => {
    for (const metal of METALS)
      for (const nonMetal of NON_METALS) {
        const m = ionicModel(metal, nonMetal)
        for (const [el, shells, charge] of [
          [m.metal, m.metalShells, m.metalCharge],
          [m.nonMetal, m.nonMetalShells, m.nonMetalCharge],
        ] as const) {
          expect(NOBLE_GASES, `${el.symbol}`).toContainEqual(shells)
          expect(shells, el.symbol).toEqual(ION_SHELLS[el.symbol])
          expect(
            shells.reduce((n, s) => n + s, 0),
            el.symbol,
          ).toBe(el.z - charge)
        }
      }
  })

  it('names the compound: the metal, then the non-metal with its ending (sodium chloride, magnesium oxide)', () => {
    for (const [metal, nonMetal, , , name] of RATIOS) expect(compoundName(ionicModel(metal, nonMetal)), `${metal}${nonMetal}`).toBe(name)
    for (const metal of METALS) for (const nonMetal of NON_METALS) expect(compoundName(ionicModel(metal, nonMetal))).toMatch(/^[a-z]+ [a-z]+ide$/)
    expect(labelText(ionicDef)).toBe('sodium chloride')
    expect(labelText(ionicDef, { metal: 'Al', nonMetal: 'O' })).toBe('aluminium oxide')
  })

  it('stands the ions in a row with the two kinds alternating, or one ion in the middle of three others', () => {
    for (const [, , nMetal, nNonMetal] of RATIOS) {
      const cells = arrangement(nMetal, nNonMetal)
      expect(cells.filter((c) => c.kind === 'metal').length).toBe(nMetal)
      expect(cells.filter((c) => c.kind === 'nonMetal').length).toBe(nNonMetal)
      if (Math.abs(nMetal - nNonMetal) <= 1) {
        expect(new Set(cells.map((c) => c.row)).size).toBe(1)
        cells.forEach((c, i) => i && expect(c.kind, `${nMetal}:${nNonMetal} ion ${i}`).not.toBe(cells[i - 1].kind))
      } else {
        expect(cells[0]).toMatchObject({ col: 0, row: 0 })
        expect(cells.slice(1).map((c) => [c.col, c.row])).toEqual([
          [-1, 0],
          [1, 0],
          [0, -1],
        ])
      }
    }
  })

  it('writes a charge as a superscript: + and - for 1, then 2+, 3+, 2-, 3-', () => {
    expect([1, 2, 3, -1, -2, -3].map(chargeText)).toEqual(['^{+}', '^{2+}', '^{3+}', '^{-}', '^{2-}', '^{3-}'])
  })
})

describe('ionic dot-and-cross: the drawing keeps the electrons', () => {
  it('transfer stage: the metal shows the electrons it loses, the non-metal its own, and an arrow takes each electron to an empty place', () => {
    for (const { metal, nonMetal, stage, label, d } of ionicCases()) {
      if (stage !== 'transfer') continue
      const m = d.model
      expect(d.marks.filter((q) => q.from === 'metal').length, label).toBe(m.nMetal * CHARGE[metal])
      expect(d.marks.filter((q) => q.from === 'nonMetal').length, label).toBe(m.nNonMetal * (8 + CHARGE[nonMetal]))
      expect(d.arrows.length, label).toBe(m.nMetal * CHARGE[metal])
      // Every metal electron is on a metal, every own electron of a non-metal on a non-metal, and each ion shows its outer electrons only.
      d.ions.forEach((ion, i) => {
        const here = d.marks.filter((q) => q.ion === i)
        expect(here.length, `${label} ion ${i}`).toBe(ion.kind === 'metal' ? CHARGE[metal] : 8 + CHARGE[nonMetal])
        expect(
          here.every((q) => q.from === ion.kind),
          label,
        ).toBe(true)
        // Each non-metal receives as many arrows as it needs electrons; each metal sends as many as it has.
        expect(d.arrows.filter((a) => a.toIon === i).length, label).toBe(ion.kind === 'nonMetal' ? -CHARGE[nonMetal] : 0)
        expect(d.arrows.filter((a) => a.fromIon === i).length, label).toBe(ion.kind === 'metal' ? CHARGE[metal] : 0)
      })
      for (const a of d.arrows) {
        const leaves = d.marks[a.mark]
        expect(leaves.from, label).toBe('metal')
        expect(d.ions[a.fromIon].kind, label).toBe('metal')
        expect(d.ions[a.toIon].kind, label).toBe('nonMetal')
        expect(leaves.ion, label).toBe(a.fromIon)
        // It points at a place on the circle of the non-metal where no electron is.
        const to = d.ions[a.toIon]
        expect(dist(a.slot, to), label).toBeCloseTo(to.r, 6)
        for (const q of d.marks) expect(dist(a.slot, q), `${label}: an arrow must point at an empty place`).toBeGreaterThan(7.5)
        expect(dist(a.tip, a.slot), label).toBeLessThan(6)
        expect(dist(a.start, leaves), label).toBeLessThan(6)
      }
    }
  })

  it('ions stage: the metal ion shows no outer electrons, the non-metal ion a full shell of 8 (its own and the metal electrons), each in square brackets with its charge', () => {
    for (const { metal, nonMetal, stage, label, d } of ionicCases()) {
      if (stage !== 'ions') continue
      const m = d.model
      expect(d.arrows, label).toEqual([])
      d.ions.forEach((ion, i) => {
        const here = d.marks.filter((q) => q.ion === i)
        if (ion.kind === 'metal') {
          expect(here.length, `${label} metal ion ${i}`).toBe(0)
          expect(ion.charge, label).toBe(CHARGE[metal])
        } else {
          expect(here.length, `${label} non-metal ion ${i}`).toBe(8)
          expect(here.filter((q) => q.from === 'nonMetal').length, label).toBe(8 + CHARGE[nonMetal])
          expect(here.filter((q) => q.from === 'metal').length, label).toBe(-CHARGE[nonMetal])
          expect(ion.charge, label).toBe(CHARGE[nonMetal])
        }
        expect(ion.bracket, label).not.toBeNull()
        // The electrons of the shells of the ion are those of a noble gas.
        expect(ion.shells, label).toEqual(ION_SHELLS[ion.symbol])
      })
      // The electrons that left the metals are the metal-coloured marks on the non-metals.
      expect(d.marks.filter((q) => q.from === 'metal').length, label).toBe(m.nMetal * CHARGE[metal])
      expect(d.ions.filter((i) => i.kind === 'metal').length, label).toBe(m.nMetal)
      expect(d.ions.filter((i) => i.kind === 'nonMetal').length, label).toBe(m.nNonMetal)
    }
  })

  it('shows the inner shells as plain circles, one for each shell inside the outer one, and only when `inner` is on', () => {
    for (const { metal, nonMetal, stage, inner, label, d } of ionicCases()) {
      const atom = (s: string) => ionicModel(metal, nonMetal)[s === metal ? 'metal' : 'nonMetal'].shells.length
      d.ions.forEach((ion) => {
        if (!inner) expect(ion.inner, label).toEqual([])
        else {
          const shells = atom(ion.symbol) - (stage === 'ions' && ion.kind === 'metal' ? 1 : 0)
          expect(ion.inner.length, `${label} ${ion.symbol}`).toBe(shells - 1)
          const radii = [ion.r, ...ion.inner]
          radii.forEach((r, i) => i && expect(r, `${label} ${ion.symbol}`).toBeLessThan(radii[i - 1] - 3))
        }
      })
    }
  })

  it('draws the marks of the model, of the same kind in the same place, the arrows, the brackets, and the symbols and charges as text', () => {
    for (const choice of MARKS)
      for (const { label, params, size, stage, inner, d } of ionicCases(choice)) {
        const g = geometry('ionicDotCross', size.w, size.h, params)
        const drawn = sorted(drawnMarks(g)),
          model = sorted(d.marks)
        expect(drawn.length, `${label} ${choice}`).toBe(model.length)
        drawn.forEach((q, i) => {
          expect(q.mark, `${label} ${choice} mark ${i}`).toBe(model[i].mark)
          expect(Math.abs(q.x - model[i].x), `${label} ${choice} mark ${i}`).toBeLessThan(0.02)
          expect(Math.abs(q.y - model[i].y), `${label} ${choice} mark ${i}`).toBeLessThan(0.02)
        })
        const { shafts, heads } = drawnArrows(g)
        expect(shafts.length, label).toBe(d.arrows.length)
        expect(heads.length, label).toBe(d.arrows.length)
        expect(drawnBrackets(g).length, label).toBe(stage === 'ions' ? d.ions.length : 0)
        const symbols = g.texts?.filter((t) => !t.text.startsWith('^')) ?? [],
          charges = g.texts?.filter((t) => t.text.startsWith('^')) ?? []
        expect(
          symbols.map((t) => t.text),
          label,
        ).toEqual(d.ions.map((i) => i.symbol))
        for (const t of symbols) expect(t.size, label).toBe(inner ? INNER_SYMBOL_SIZE : SYMBOL_SIZE)
        expect(
          charges.map((t) => t.text),
          label,
        ).toEqual(stage === 'ions' ? d.ions.map((i) => chargeText(i.charge)) : [])
      }
  })

  it('uses a mark for the metal and another for the non-metal: dots and crosses, crosses and dots, or dots and rings, never a colour', () => {
    const expected: Record<string, [MarkKind, MarkKind]> = { default: ['dot', 'cross'], swapped: ['cross', 'dot'], ring: ['dot', 'ring'] }
    for (const choice of MARKS)
      for (const { label, d } of ionicCases(choice)) {
        for (const q of d.marks) expect(q.mark, `${label} ${choice}`).toBe(expected[choice][q.from === 'metal' ? 0 : 1])
      }
    const g = geometry('ionicDotCross', 420, 150, { metal: 'Mg', nonMetal: 'Cl', stage: 'transfer' })
    for (const p of g.prims) {
      expect(p.tint).toBeUndefined()
      expect(['outline', 'ink', 'detail']).toContain(p.role)
    }
  })

  it('shows the ratio of the ions: one circle or bracket for each ion, MgCl2 with three, Na2O with three, Al2O3 with five', () => {
    const count = (metal: string, nonMetal: string, stage: string) =>
      geometry('ionicDotCross', 420, 150, { metal, nonMetal, stage }).prims.filter((p) => p.role === 'outline' && !drawnBrackets({ prims: [p] }).length).length
    expect([count('Mg', 'Cl', 'transfer'), count('Na', 'O', 'ions'), count('Al', 'O', 'ions'), count('Na', 'Cl', 'ions')]).toEqual([3, 3, 5, 2])
    expect(drawnBrackets(geometry('ionicDotCross', 420, 150, { metal: 'Al', nonMetal: 'O' })).length).toBe(5)
  })
})

describe('ionic dot-and-cross: the picture is clean', () => {
  const advance: Record<string, number> = {
    L: 0.556,
    i: 0.222,
    N: 0.722,
    a: 0.556,
    K: 0.667,
    M: 0.833,
    g: 0.556,
    C: 0.722,
    A: 0.667,
    l: 0.222,
    O: 0.778,
    F: 0.611,
    S: 0.667,
    B: 0.667,
    r: 0.333,
  }
  const circlesOf = (d: IonicDiagram) => d.ions.flatMap((ion) => [ion.r, ...ion.inner].map((r) => ({ x: ion.x, y: ion.y, r })))

  it('has no two marks touching, and no mark touching a circle line that it is not on', () => {
    for (const { label, d } of ionicCases()) {
      const circles = circlesOf(d)
      d.marks.forEach((q, i) => {
        for (let j = i + 1; j < d.marks.length; j++) expect(dist(q, d.marks[j]), `${label} marks ${i} and ${j}`).toBeGreaterThan(7.5)
        circles.forEach((c, j) => {
          // A mark sits on the outermost circle of its own ion, in a gap of the line.
          if (Math.abs(dist(q, d.ions[q.ion]) - d.ions[q.ion].r) < 1e-6 && Math.abs(c.r - d.ions[q.ion].r) < 1e-6 && dist(c, d.ions[q.ion]) < 1e-6) return
          expect(Math.abs(dist(q, c) - c.r), `${label} mark ${i} against circle ${j}`).toBeGreaterThan(4)
        })
      })
    }
  })

  it('keeps every element symbol clear of every circle of its own ion', () => {
    for (const { label, d } of ionicCases()) {
      d.ions.forEach((ion, i) => {
        const half = ([...ion.symbol].reduce((n, c) => n + advance[c], 0) * d.symbolSize) / 2,
          up = 0.358 * d.symbolSize
        for (let t = 0; t <= 10; t++) {
          const x = -half + (2 * half * t) / 10,
            y = -up + (2 * up * t) / 10
          for (const p of [P(ion.x + x, ion.y - up), P(ion.x + x, ion.y + up), P(ion.x - half, ion.y + y), P(ion.x + half, ion.y + y)])
            for (const r of [ion.r, ...ion.inner])
              expect(Math.abs(dist(p, ion) - r), `${label}: ${ion.symbol} (ion ${i}) against a circle of radius ${r.toFixed(1)}`).toBeGreaterThan(1.5)
        }
      })
    }
  })

  it('keeps each circle inside its bracket, each charge clear of the next bracket, and the brackets apart', () => {
    for (const { label, stage, d } of ionicCases()) {
      if (stage !== 'ions') continue
      const brackets = d.ions.map((ion) => ion.bracket!)
      d.ions.forEach((ion, i) => {
        const b = brackets[i]
        expect(ion.x - ion.r - b.x0, label).toBeGreaterThan(5)
        expect(b.x1 - (ion.x + ion.r), label).toBeGreaterThan(5)
        expect(ion.y - ion.r - b.y0, label).toBeGreaterThan(5)
        expect(b.y1 - (ion.y + ion.r), label).toBeGreaterThan(5)
        // The charge stands to the right of the bracket (a little above its top) and must not touch any other bracket.
        const width = (Math.abs(ion.charge) > 1 ? 2 : 1) * 0.58 * 18 * 0.7
        const text = { x0: b.x1 + 3, x1: b.x1 + 3 + width, y0: b.y0 - 6, y1: b.y0 + 8 }
        brackets.forEach((o, j) => {
          if (j === i) return
          const apart = o.x0 - text.x1 > 1.5 || text.x0 - o.x1 > 1.5 || o.y0 - text.y1 > 1.5 || text.y0 - o.y1 > 1.5
          expect(apart, `${label}: the charge of ion ${i} against the bracket of ion ${j}`).toBe(true)
          const clear = o.x0 - b.x1 > 1 || b.x0 - o.x1 > 1 || o.y0 - b.y1 > 1 || b.y0 - o.y1 > 1
          expect(clear, `${label}: bracket ${i} against bracket ${j}`).toBe(true)
        })
      })
    }
  })

  it('draws arrows that do not cross each other and keep clear of the circles between their ends', () => {
    for (const { label, stage, d } of ionicCases()) {
      if (stage !== 'transfer') continue
      const lines = d.arrows.map((a) => along(a.start, a.via, a.end))
      lines.forEach((p, i) => {
        for (let j = i + 1; j < lines.length; j++)
          for (let s = 0; s + 1 < p.length; s++)
            for (let t = 0; t + 1 < lines[j].length; t++)
              expect(crosses(p[s], p[s + 1], lines[j][t], lines[j][t + 1]), `${label}: arrows ${i} and ${j}`).toBe(false)
        // The middle of the curve is clear of every circle line.
        for (const q of p.slice(4, -4)) for (const c of circlesOf(d)) expect(Math.abs(dist(q, c) - c.r), `${label}: arrow ${i}`).toBeGreaterThan(2)
      })
    }
  })

  it('keeps every ion inside the box at the default size and larger, and the whole drawing within 1.5 times the nominal box at the smallest', () => {
    for (const { label, size, stage, d } of ionicCases()) {
      for (const ion of d.ions) {
        const b = ion.bracket ?? { x0: ion.x - ion.r, x1: ion.x + ion.r, y0: ion.y - ion.r, y1: ion.y + ion.r }
        const slack = size === ionicDef.min && size !== ionicDef.size ? 0 : 0
        expect(b.x0, `${label} ${stage}`).toBeGreaterThanOrEqual(-size.w / 2 - slack)
        expect(b.x1, `${label} ${stage}`).toBeLessThanOrEqual(size.w / 2 + slack)
        expect(b.y0, `${label} ${stage}`).toBeGreaterThanOrEqual(-slack)
        expect(b.y1, `${label} ${stage}`).toBeLessThanOrEqual(size.h + slack)
      }
    }
  })
})

describe('ionic dot-and-cross: parameters and the symbol row', () => {
  it('draws something sensible for a metal, non-metal, stage or marks that it does not know, and never throws', () => {
    const base = JSON.stringify(geometry('ionicDotCross', 420, 150, {}))
    expect(JSON.stringify(geometry('ionicDotCross', 420, 150, { metal: 'Fe' }))).toBe(base)
    expect(JSON.stringify(geometry('ionicDotCross', 420, 150, { nonMetal: 'Na' }))).toBe(base)
    expect(JSON.stringify(geometry('ionicDotCross', 420, 150, { stage: 'later' }))).toBe(base)
    expect(JSON.stringify(geometry('ionicDotCross', 420, 150, { marks: 'purple' }))).toBe(base)
    expect(JSON.stringify(geometry('ionicDotCross', 420, 150, { metal: 7 as unknown as string }))).toBe(base)
    for (const [w, h] of [
      [1, 1],
      [0, 0],
      [40, 600],
      [900, 30],
    ])
      for (const stage of ['transfer', 'ions']) {
        const g = geometry('ionicDotCross', w, h, { metal: 'Al', nonMetal: 'O', stage, inner: true })
        expect(g.prims[0].role, `${w}x${h}`).not.toBe('dashed')
        for (const p of g.prims) expect(p.d).not.toMatch(/NaN|Infinity/)
      }
  })

  it('offers six metals and six non-metals, two stages, inner shells off, and three pairs of marks', () => {
    expect(ionicDef.params?.map((p) => p.key)).toEqual(['metal', 'nonMetal', 'stage', 'inner', 'marks'])
    const options = (key: string) => {
      const p = ionicDef.params!.find((q) => q.key === key)!
      return p.type === 'choice' ? p.options.map((o) => o.value) : []
    }
    expect(options('metal')).toEqual(METALS)
    expect(options('nonMetal')).toEqual(NON_METALS)
    expect(ionicDef.params!.find((p) => p.key === 'inner')).toMatchObject({ type: 'boolean', default: false })
  })
})
