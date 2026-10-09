// dotcross.science.test.ts — the science of the dot-and-cross diagrams and of the periodic table. Each symbol has a model that dotcross.ts exports;
// these tests check the model against chemistry (shells, valencies, charges, the layout of the table) with numbers typed here, and then read the
// marks back out of `geometry()` to see that the drawing agrees with the model. A test that cannot fail is worth nothing: the report says, for each, the
// break that made it fail.

import { describe, expect, it } from 'vitest'
import { P, dist, type Pt } from '../kernel/geom'
import { METRICS, SYMBOL_SIZE, covalentDiagram, type CovalentDiagram, type CovalentLayout, type MarkKind } from './dotcross'
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
      for (const m of prim.d.matchAll(circles)) out.push({ x: Number(m[1]) + Number(m[3]), y: Number(m[2]), mark: 'ring' })
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
