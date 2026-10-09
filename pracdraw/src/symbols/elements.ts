// elements.ts — the first 36 elements: the data that the atom and periodic table symbols draw from.
// One table, so that every picture of an element agrees. `elements.test.ts` checks it for consistency (shells fill in order, a shell holds
// no more than its capacity, the period is the number of shells, the group follows the outer electrons). The values of `ar` and `a` are from
// memory (rounded standard atomic weights; the most abundant isotope): the tests check that they agree with each other, not with a book.

export interface Element {
  /** Atomic number. */
  z: number
  symbol: string
  name: string
  /** Electrons on each shell of the neutral atom, innermost first (2, 8, 8, 2 for calcium). */
  shells: number[]
  /** Group 1 to 18 (IUPAC). */
  group: number
  /** Relative atomic mass, to one decimal place. */
  ar: number
  /** Mass number of the most abundant isotope. */
  a: number
}

// z, symbol, name, shells, group, ar, a
const ROWS: [number, string, string, number[], number, number, number][] = [
  [1, 'H', 'hydrogen', [1], 1, 1.0, 1],
  [2, 'He', 'helium', [2], 18, 4.0, 4],
  [3, 'Li', 'lithium', [2, 1], 1, 6.9, 7],
  [4, 'Be', 'beryllium', [2, 2], 2, 9.0, 9],
  [5, 'B', 'boron', [2, 3], 13, 10.8, 11],
  [6, 'C', 'carbon', [2, 4], 14, 12.0, 12],
  [7, 'N', 'nitrogen', [2, 5], 15, 14.0, 14],
  [8, 'O', 'oxygen', [2, 6], 16, 16.0, 16],
  [9, 'F', 'fluorine', [2, 7], 17, 19.0, 19],
  [10, 'Ne', 'neon', [2, 8], 18, 20.2, 20],
  [11, 'Na', 'sodium', [2, 8, 1], 1, 23.0, 23],
  [12, 'Mg', 'magnesium', [2, 8, 2], 2, 24.3, 24],
  [13, 'Al', 'aluminium', [2, 8, 3], 13, 27.0, 27],
  [14, 'Si', 'silicon', [2, 8, 4], 14, 28.1, 28],
  [15, 'P', 'phosphorus', [2, 8, 5], 15, 31.0, 31],
  [16, 'S', 'sulfur', [2, 8, 6], 16, 32.1, 32],
  [17, 'Cl', 'chlorine', [2, 8, 7], 17, 35.5, 35],
  [18, 'Ar', 'argon', [2, 8, 8], 18, 39.9, 40],
  [19, 'K', 'potassium', [2, 8, 8, 1], 1, 39.1, 39],
  [20, 'Ca', 'calcium', [2, 8, 8, 2], 2, 40.1, 40],
  [21, 'Sc', 'scandium', [2, 8, 9, 2], 3, 45.0, 45],
  [22, 'Ti', 'titanium', [2, 8, 10, 2], 4, 47.9, 48],
  [23, 'V', 'vanadium', [2, 8, 11, 2], 5, 50.9, 51],
  [24, 'Cr', 'chromium', [2, 8, 13, 1], 6, 52.0, 52],
  [25, 'Mn', 'manganese', [2, 8, 13, 2], 7, 54.9, 55],
  [26, 'Fe', 'iron', [2, 8, 14, 2], 8, 55.8, 56],
  [27, 'Co', 'cobalt', [2, 8, 15, 2], 9, 58.9, 59],
  [28, 'Ni', 'nickel', [2, 8, 16, 2], 10, 58.7, 58],
  [29, 'Cu', 'copper', [2, 8, 18, 1], 11, 63.5, 63],
  [30, 'Zn', 'zinc', [2, 8, 18, 2], 12, 65.4, 64],
  [31, 'Ga', 'gallium', [2, 8, 18, 3], 13, 69.7, 69],
  [32, 'Ge', 'germanium', [2, 8, 18, 4], 14, 72.6, 74],
  [33, 'As', 'arsenic', [2, 8, 18, 5], 15, 74.9, 75],
  [34, 'Se', 'selenium', [2, 8, 18, 6], 16, 79.0, 80],
  [35, 'Br', 'bromine', [2, 8, 18, 7], 17, 79.9, 79],
  [36, 'Kr', 'krypton', [2, 8, 18, 8], 18, 83.8, 84],
]

export const ELEMENTS: readonly Element[] = ROWS.map(([z, symbol, name, shells, group, ar, a]) => ({ z, symbol, name, shells, group, ar, a }))

/** The element with this atomic number, or undefined outside 1 to 36. */
export const element = (z: number): Element | undefined => ELEMENTS[Math.round(z) - 1]

/** The element with this symbol ("Na"), or undefined. */
export const elementBySymbol = (symbol: string): Element | undefined => ELEMENTS.find((e) => e.symbol === symbol)

/** The period: the number of shells of the neutral atom. */
export const period = (e: Element): number => e.shells.length

/**
 * The group as a KS4 course numbers it: 1 to 7 for the main groups, 0 for the noble gases, and undefined for the transition metals.
 * (Groups 1 and 2 are the same in both numberings; groups 13 to 17 are 3 to 7; group 18 is 0.)
 */
export function ks4Group(e: Element): number | undefined {
  if (e.group === 1 || e.group === 2) return e.group
  if (e.group >= 13 && e.group <= 17) return e.group - 10
  if (e.group === 18) return 0
  return undefined
}

/** The electron structure as it is written at KS4, "2,8,1". */
export const shellString = (shells: readonly number[]): string => shells.join(',')

/**
 * The shells of an ion: electrons are removed from, or added to, the outermost shell. A charge of +1 takes one electron from the outer
 * shell; an outer shell that is emptied disappears (sodium 2,8,1 gives Na+ 2,8). A charge of -2 adds two electrons to the outer shell
 * (oxygen 2,6 gives O2- 2,8). Returns undefined when the charge would take more electrons than the atom has, or would put more in
 * the outer shell than a full shell of the period holds (8, or 2 for the first shell).
 */
export function ionShells(e: Element, charge: number): number[] | undefined {
  const shells = [...e.shells]
  let last = shells.length - 1
  if (charge >= 0) {
    let n = charge
    while (n > 0) {
      if (last < 0) return undefined
      const take = Math.min(n, shells[last])
      shells[last] -= take
      n -= take
      if (shells[last] === 0) {
        shells.pop()
        last--
      }
    }
    return shells
  }
  shells[last] += -charge
  const cap = last === 0 ? 2 : 8
  return shells[last] <= cap ? shells : undefined
}
