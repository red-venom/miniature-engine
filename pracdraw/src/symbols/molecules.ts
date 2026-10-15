// molecules.ts — the small-molecule library: the thirteen molecules of the KS4 bonding lessons, as plain data.
// An atom is an element of elements.ts. A bond joins two atoms and has an order (1, 2 or 3). The lone pairs of an atom are not typed in: they are
// derived from its outer electrons (the electrons of its last shell) minus the pairs that it shares, so a wrong bond shows up as a wrong count.
// Nothing here is drawn. The dot-and-cross diagram (dotcross.ts) lays the molecules out; the displayed formulae, the ball-and-stick models and
// the balanced-equation pictures of later packs draw from this same library, so that a molecule has one set of atoms and bonds in every picture.
// `molecules.test.ts` checks the library against the textbook.

import { elementBySymbol, type Element } from './elements'

export type BondOrder = 1 | 2 | 3

/** A bond between two atoms of a molecule: indices into `Molecule.atoms`. `order` is the number of electron pairs that the bond shares. */
export interface Bond {
  a: number
  b: number
  order: BondOrder
}

export interface MoleculeAtom {
  element: Element
  /** The outer electrons of the neutral atom: the electrons on its last shell. */
  outer: number
  /** The electron pairs that the atom shares: the sum of the orders of its bonds. */
  shared: number
  /** The pairs that stay on this atom alone: (outer - shared) / 2, rounded down. */
  lonePairs: number
  /** An electron left over when the rest are paired: 0, or 1 for a radical. It is 0 for every molecule of the library. */
  unpaired: number
  /** The atoms that it is bonded to, one entry for each bond, in the order of `Molecule.bonds`. */
  bonded: readonly number[]
}

export interface Molecule {
  /** The formula as plain text, "H2O": the value of the `molecule` parameter. */
  id: string
  /** The name, in lower case: "water". It is the label of a diagram. */
  name: string
  /** The formula in label markup, "H_{2}O". */
  formula: string
  atoms: readonly MoleculeAtom[]
  bonds: readonly Bond[]
  /** The central atom, or the first atom of a molecule of two atoms (and of a hydrogen halide: "HCl" starts with H). */
  centre: number
}

type Raw = [id: string, name: string, formula: string, atoms: string[], bonds: [a: number, b: number, order: BondOrder][]]

// The atoms are listed centre first for H2O (O, H, H); in the order of the formula for the others. A bond is [atom, atom, order].
const RAW: Raw[] = [
  ['H2', 'hydrogen', 'H_{2}', ['H', 'H'], [[0, 1, 1]]],
  ['Cl2', 'chlorine', 'Cl_{2}', ['Cl', 'Cl'], [[0, 1, 1]]],
  ['O2', 'oxygen', 'O_{2}', ['O', 'O'], [[0, 1, 2]]],
  ['N2', 'nitrogen', 'N_{2}', ['N', 'N'], [[0, 1, 3]]],
  ['HCl', 'hydrogen chloride', 'HCl', ['H', 'Cl'], [[0, 1, 1]]],
  [
    'H2O',
    'water',
    'H_{2}O',
    ['O', 'H', 'H'],
    [
      [0, 1, 1],
      [0, 2, 1],
    ],
  ],
  [
    'NH3',
    'ammonia',
    'NH_{3}',
    ['N', 'H', 'H', 'H'],
    [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
    ],
  ],
  [
    'CH4',
    'methane',
    'CH_{4}',
    ['C', 'H', 'H', 'H', 'H'],
    [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
      [0, 4, 1],
    ],
  ],
  [
    'CO2',
    'carbon dioxide',
    'CO_{2}',
    ['C', 'O', 'O'],
    [
      [0, 1, 2],
      [0, 2, 2],
    ],
  ],
  ['HF', 'hydrogen fluoride', 'HF', ['H', 'F'], [[0, 1, 1]]],
  ['F2', 'fluorine', 'F_{2}', ['F', 'F'], [[0, 1, 1]]],
  [
    'C2H4',
    'ethene',
    'C_{2}H_{4}',
    ['C', 'C', 'H', 'H', 'H', 'H'],
    [
      [0, 1, 2],
      [0, 2, 1],
      [0, 3, 1],
      [1, 4, 1],
      [1, 5, 1],
    ],
  ],
  [
    'C2H6',
    'ethane',
    'C_{2}H_{6}',
    ['C', 'C', 'H', 'H', 'H', 'H', 'H', 'H'],
    [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
      [0, 4, 1],
      [1, 5, 1],
      [1, 6, 1],
      [1, 7, 1],
    ],
  ],
]

function make([id, name, formula, symbols, pairs]: Raw): Molecule {
  const bonds: Bond[] = pairs.map(([a, b, order]) => ({ a, b, order }))
  const atoms = symbols.map((symbol, i): MoleculeAtom => {
    // An unknown symbol cannot happen (the table above is fixed); hydrogen stands in rather than a throw when the module loads.
    const element = elementBySymbol(symbol) ?? elementBySymbol('H')!
    const outer = element.shells[element.shells.length - 1]
    const mine = bonds.filter((b) => b.a === i || b.b === i)
    const shared = mine.reduce((n, b) => n + b.order, 0)
    const free = Math.max(0, outer - shared)
    return { element, outer, shared, lonePairs: Math.floor(free / 2), unpaired: free % 2, bonded: mine.map((b) => (b.a === i ? b.b : b.a)) }
  })
  return { id, name, formula, atoms, bonds, centre: 0 }
}

/** The thirteen molecules, in the order of the `molecule` parameter of the dot-and-cross diagram. */
export const MOLECULES: readonly Molecule[] = RAW.map(make)

/** The molecule with this id ("H2O"), or undefined. */
export const molecule = (id: string): Molecule | undefined => MOLECULES.find((m) => m.id === id)

/** The outer electrons of all the atoms of a molecule, added up: 8 for H2O, NH3 and CH4. */
export const outerElectrons = (m: Molecule): number => m.atoms.reduce((n, a) => n + a.outer, 0)
