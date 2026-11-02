// molecules.test.ts — the small-molecule library against the textbook. Every expected value below is typed from chemistry (formulae, valencies,
// lone pairs), not computed by the code that is being checked, so a wrong atom, bond or derivation cannot pass by agreeing with itself.

import { describe, expect, it } from 'vitest'
import catalogue from '../../spec/catalogue.json'
import { ELEMENTS } from './elements'
import { MOLECULES, molecule, outerElectrons, type Molecule } from './molecules'

/** The thirteen molecules, in the order of the catalogue row of covalentDotCross. */
const IDS = ['H2', 'Cl2', 'O2', 'N2', 'HCl', 'H2O', 'NH3', 'CH4', 'CO2', 'HF', 'F2', 'C2H4', 'C2H6']

/** The atoms of each molecule, as "symbol count" pairs. */
const ATOMS: Record<string, Record<string, number>> = {
  H2: { H: 2 },
  Cl2: { Cl: 2 },
  O2: { O: 2 },
  N2: { N: 2 },
  HCl: { H: 1, Cl: 1 },
  H2O: { H: 2, O: 1 },
  NH3: { N: 1, H: 3 },
  CH4: { C: 1, H: 4 },
  CO2: { C: 1, O: 2 },
  HF: { H: 1, F: 1 },
  F2: { F: 2 },
  C2H4: { C: 2, H: 4 },
  C2H6: { C: 2, H: 6 },
}

/** The bonds of each molecule as "A-B:order" with the two symbols in alphabetical order, sorted. */
const BONDS: Record<string, string[]> = {
  H2: ['H-H:1'],
  Cl2: ['Cl-Cl:1'],
  O2: ['O-O:2'],
  N2: ['N-N:3'],
  HCl: ['Cl-H:1'],
  H2O: ['H-O:1', 'H-O:1'],
  NH3: ['H-N:1', 'H-N:1', 'H-N:1'],
  CH4: ['C-H:1', 'C-H:1', 'C-H:1', 'C-H:1'],
  CO2: ['C-O:2', 'C-O:2'],
  HF: ['F-H:1'],
  F2: ['F-F:1'],
  C2H4: ['C-C:2', 'C-H:1', 'C-H:1', 'C-H:1', 'C-H:1'],
  C2H6: ['C-C:1', 'C-H:1', 'C-H:1', 'C-H:1', 'C-H:1', 'C-H:1', 'C-H:1'],
}

/** The usual valency: the pairs that an atom shares. */
const VALENCY: Record<string, number> = { H: 1, F: 1, Cl: 1, O: 2, N: 3, C: 4 }

/** The lone pairs of each element in each molecule (the textbook picture: H none, halogens 3, O 2, N 1, C none). */
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

/** The outer electrons of each molecule, added up over its atoms. */
const TOTAL: Record<string, number> = { H2: 2, Cl2: 14, O2: 12, N2: 10, HCl: 8, H2O: 8, NH3: 8, CH4: 8, CO2: 16, HF: 8, F2: 14, C2H4: 12, C2H6: 14 }

const count = (items: string[]): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const s of items) out[s] = (out[s] ?? 0) + 1
  return out
}
const get = (id: string): Molecule => molecule(id)!

describe('the small-molecule library', () => {
  it('holds the thirteen molecules of the catalogue, in its order, each id once', () => {
    expect(MOLECULES.map((m) => m.id)).toEqual(IDS)
    const row = catalogue.symbols.find((s) => s.id === 'covalentDotCross')!
    expect(row.params.find((p) => p.startsWith('molecule:'))).toContain(`[${IDS.join('|')}]`)
    expect(new Set(MOLECULES.map((m) => m.name)).size).toBe(13)
  })

  it('has the right atoms in each molecule (H2O has 2 H and 1 O)', () => {
    for (const id of IDS) expect(count(get(id).atoms.map((a) => a.element.symbol)), id).toEqual(ATOMS[id])
    expect(get('H2O').atoms).toHaveLength(3)
  })

  it('writes the formula, in label markup, with the same atoms as the atom list', () => {
    for (const m of MOLECULES) {
      const fromFormula: Record<string, number> = {}
      for (const [, symbol, n] of m.formula.matchAll(/([A-Z][a-z]?)(?:_\{(\d+)\})?/g)) fromFormula[symbol] = (fromFormula[symbol] ?? 0) + Number(n ?? 1)
      expect(fromFormula, m.id).toEqual(ATOMS[m.id])
      expect(m.formula.replace(/_\{(\d+)\}/g, '$1'), m.id).toBe(m.id)
    }
  })

  it('has the right bonds: H2O has two single bonds, O2 a double bond, N2 a triple bond, CO2 two double bonds, C2H4 one C=C and four C-H', () => {
    for (const id of IDS) {
      const m = get(id)
      const bonds = m.bonds.map((b) => `${[m.atoms[b.a].element.symbol, m.atoms[b.b].element.symbol].sort().join('-')}:${b.order}`).sort()
      expect(bonds, id).toEqual([...BONDS[id]].sort())
    }
    expect(get('H2O').bonds.map((b) => b.order)).toEqual([1, 1])
    expect(get('N2').bonds[0].order).toBe(3)
  })

  it('joins every molecule in one piece with no ring (one bond fewer than atoms), and every bond joins two different atoms', () => {
    for (const m of MOLECULES) {
      expect(m.bonds.length, m.id).toBe(m.atoms.length - 1)
      for (const b of m.bonds) {
        expect(b.a, m.id).not.toBe(b.b)
        for (const i of [b.a, b.b]) expect(i >= 0 && i < m.atoms.length, m.id).toBe(true)
      }
      // Walk the bonds outwards from the centre until nothing new is reached.
      const seen = new Set([m.centre])
      let grew = true
      while (grew) {
        const before = seen.size
        for (const b of m.bonds) {
          if (seen.has(b.a) || seen.has(b.b)) {
            seen.add(b.a)
            seen.add(b.b)
          }
        }
        grew = seen.size > before
      }
      expect(seen.size, `${m.id} is in one piece`).toBe(m.atoms.length)
    }
  })

  it('lists for each atom the atoms it is bonded to', () => {
    const w = get('H2O')
    expect(w.atoms[0].bonded).toEqual([1, 2])
    expect(w.atoms[1].bonded).toEqual([0])
    const e = get('C2H4')
    expect(e.atoms[0].bonded).toEqual([1, 2, 3])
    expect(e.atoms[1].bonded).toEqual([0, 4, 5])
  })

  it('makes every atom share the usual number of pairs: H 1, F 1, Cl 1, O 2, N 3, C 4', () => {
    for (const m of MOLECULES) for (const a of m.atoms) expect(a.shared, `${m.id} ${a.element.symbol}`).toBe(VALENCY[a.element.symbol])
  })

  it('takes the outer electrons from the last shell of the element', () => {
    for (const m of MOLECULES)
      for (const a of m.atoms) {
        const e = ELEMENTS.find((x) => x.symbol === a.element.symbol)!
        expect(a.outer, `${m.id} ${e.symbol}`).toBe(e.shells[e.shells.length - 1])
      }
    expect(get('H2O').atoms.map((a) => a.outer)).toEqual([6, 1, 1])
  })

  it('derives the lone pairs from the outer electrons less the pairs shared (O in water has 2, N in ammonia 1, Cl in HCl 3, H none)', () => {
    for (const m of MOLECULES)
      for (const a of m.atoms) {
        expect(a.lonePairs, `${m.id} ${a.element.symbol}`).toBe(LONE[m.id][a.element.symbol])
        expect(a.unpaired, `${m.id} ${a.element.symbol} has no unpaired electron`).toBe(0)
        expect(a.lonePairs).toBe((a.outer - a.shared) / 2)
      }
  })

  it('gives every atom a full outer shell once the shared pairs are counted: 2 for hydrogen, 8 for the others', () => {
    for (const m of MOLECULES)
      for (const a of m.atoms) {
        const around = 2 * a.lonePairs + a.unpaired + 2 * a.shared
        expect(around, `${m.id} ${a.element.symbol}`).toBe(a.element.symbol === 'H' ? 2 : 8)
      }
  })

  it('adds up the outer electrons of the atoms (8 for H2O, NH3 and CH4) and finds them again as shared and lone pairs', () => {
    for (const m of MOLECULES) {
      expect(outerElectrons(m), m.id).toBe(TOTAL[m.id])
      // Each shared pair is two electrons, one from each atom; each lone pair is two more.
      const pairs = m.bonds.reduce((n, b) => n + b.order, 0) + m.atoms.reduce((n, a) => n + a.lonePairs, 0)
      expect(2 * pairs, m.id).toBe(TOTAL[m.id])
    }
  })

  it('puts the central atom first: oxygen in water, nitrogen in ammonia, carbon in methane and carbon dioxide, hydrogen first in HCl and HF', () => {
    expect(['H2O', 'NH3', 'CH4', 'CO2', 'HCl', 'HF', 'C2H4'].map((id) => get(id).atoms[get(id).centre].element.symbol)).toEqual([
      'O',
      'N',
      'C',
      'C',
      'H',
      'H',
      'C',
    ])
  })

  it('looks a molecule up by id, and returns undefined for one that is not in the library', () => {
    expect(molecule('H2O')?.name).toBe('water')
    expect(molecule('C2H6')?.name).toBe('ethane')
    expect(molecule('H2O2')).toBeUndefined()
    expect(molecule('')).toBeUndefined()
  })
})
