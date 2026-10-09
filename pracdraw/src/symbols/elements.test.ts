import { describe, expect, it } from 'vitest'
import { ELEMENTS, element, elementBySymbol, ionShells, ks4Group, period, shellString } from './elements'

const sum = (a: readonly number[]) => a.reduce((n, m) => n + m, 0)

/** The IUPAC group of element z from the layout of the periodic table, not from the data. */
function expectedGroup(z: number): number {
  if (z === 1) return 1
  if (z === 2) return 18
  if (z <= 4) return z - 2
  if (z <= 10) return z + 8
  if (z <= 12) return z - 10
  if (z <= 18) return z
  if (z <= 20) return z - 18
  if (z <= 30) return z - 18
  return z - 18
}

describe('the first 36 elements', () => {
  it('run from 1 to 36 with a symbol and a lower-case name each, none twice', () => {
    expect(ELEMENTS.map((e) => e.z)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1))
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(36)
    expect(new Set(ELEMENTS.map((e) => e.name)).size).toBe(36)
    for (const e of ELEMENTS) {
      expect(e.symbol).toMatch(/^[A-Z][a-z]?$/)
      expect(e.name).toMatch(/^[a-z]+$/)
    }
  })

  it('put as many electrons on the shells as the atomic number says, and no shell over its capacity (2, 8, 18, 32)', () => {
    for (const e of ELEMENTS) {
      expect(sum(e.shells), e.symbol).toBe(e.z)
      e.shells.forEach((n, i) => {
        expect(n, `${e.symbol} shell ${i + 1}`).toBeGreaterThan(0)
        expect(n, `${e.symbol} shell ${i + 1}`).toBeLessThanOrEqual(2 * (i + 1) ** 2)
      })
    }
  })

  it('fill the shells 2, 8, 8, 2 for the first twenty: an outer shell has electrons only when the shell inside it is full', () => {
    for (const e of ELEMENTS.filter((x) => x.z <= 20)) {
      e.shells.slice(0, -1).forEach((n, i) => expect(n, `${e.symbol} shell ${i + 1}`).toBe([2, 8, 8][i]))
    }
    expect(shellString(element(11)!.shells)).toBe('2,8,1')
    expect(shellString(element(20)!.shells)).toBe('2,8,8,2')
  })

  it('give the period as the number of shells, and the group as the layout of the table has it', () => {
    const periodOf = (z: number) => (z <= 2 ? 1 : z <= 10 ? 2 : z <= 18 ? 3 : 4)
    for (const e of ELEMENTS) {
      expect(period(e), e.symbol).toBe(periodOf(e.z))
      expect(e.group, e.symbol).toBe(expectedGroup(e.z))
    }
  })

  it('number the main groups 1 to 7 and 0 as a KS4 course does, and the group is the number of outer electrons (the first twenty)', () => {
    for (const e of ELEMENTS.filter((x) => x.z <= 20 || x.group >= 13 || x.group <= 2)) {
      const outer = e.shells[e.shells.length - 1]
      const g = ks4Group(e)
      expect(g, e.symbol).toBeDefined()
      if (g === 0) expect([2, 8], e.symbol).toContain(outer)
      else expect(g, e.symbol).toBe(e.z <= 20 ? outer : (g as number))
    }
    expect(ks4Group(element(26)!)).toBeUndefined() // iron: a transition metal has no group at KS4
    expect([2, 10, 18, 36].map((z) => ks4Group(element(z)!))).toEqual([0, 0, 0, 0])
  })

  it('keep the relative atomic mass and the mass number of the commonest isotope consistent', () => {
    for (const e of ELEMENTS) {
      expect(e.a, e.symbol).toBeGreaterThanOrEqual(e.z)
      expect(Math.abs(e.a - e.ar), e.symbol).toBeLessThanOrEqual(1.5)
    }
  })

  it('look up by number and by symbol', () => {
    expect(element(0)).toBeUndefined()
    expect(element(37)).toBeUndefined()
    expect(elementBySymbol('Cl')?.z).toBe(17)
    expect(elementBySymbol('Xx')).toBeUndefined()
  })
})

describe('ionShells', () => {
  it('conserves electrons: the shells of an ion hold the atomic number minus the charge', () => {
    let tried = 0
    for (const e of ELEMENTS) {
      for (let charge = -3; charge <= 4; charge++) {
        const s = ionShells(e, charge)
        if (!s) continue
        tried++
        expect(sum(s), `${e.symbol} ${charge}`).toBe(e.z - charge)
      }
    }
    expect(tried).toBeGreaterThan(150)
  })

  it('gives the simple ions the electron structure of the nearest noble gas (He 2, Ne 2,8, Ar 2,8,8)', () => {
    const noble: Record<string, number[]> = { He: [2], Ne: [2, 8], Ar: [2, 8, 8] }
    const cases: [string, number, string][] = [
      ['Li', 1, 'He'],
      ['Be', 2, 'He'],
      ['Na', 1, 'Ne'],
      ['Mg', 2, 'Ne'],
      ['Al', 3, 'Ne'],
      ['N', -3, 'Ne'],
      ['O', -2, 'Ne'],
      ['F', -1, 'Ne'],
      ['K', 1, 'Ar'],
      ['Ca', 2, 'Ar'],
      ['P', -3, 'Ar'],
      ['S', -2, 'Ar'],
      ['Cl', -1, 'Ar'],
    ]
    for (const [sym, charge, gas] of cases) expect(ionShells(elementBySymbol(sym)!, charge), `${sym} ${charge}`).toEqual(noble[gas])
  })

  it('refuses a charge that takes more electrons than there are, or overfills the outer shell', () => {
    expect(ionShells(element(1)!, 2)).toBeUndefined()
    expect(ionShells(element(2)!, -1)).toBeUndefined()
    expect(ionShells(element(8)!, -3)).toBeUndefined()
    expect(ionShells(element(1)!, 1)).toEqual([])
  })
})
