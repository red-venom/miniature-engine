import { describe, expect, it } from 'vitest'
import { parseMarkup, smartChem } from './text'

// input → expected markup
const CASES: [string, string][] = [
  ['H2O', 'H_{2}O'],
  ['H2SO4', 'H_{2}SO_{4}'],
  ['CO2', 'CO_{2}'],
  ['Ca(OH)2', 'Ca(OH)_{2}'],
  ['Al2(SO4)3', 'Al_{2}(SO_{4})_{3}'],
  ['C6H12O6', 'C_{6}H_{12}O_{6}'],
  ['CuSO4.5H2O', 'CuSO_{4}·5H_{2}O'],
  ['Na+', 'Na^{+}'],
  ['Cl-', 'Cl^{-}'],
  ['Cu2+', 'Cu^{2+}'],
  ['Fe3+', 'Fe^{3+}'],
  ['O2-', 'O^{2-}'],
  ['NH4+', 'NH_{4}^{+}'],
  ['NO3-', 'NO_{3}^{-}'],
  ['MnO4-', 'MnO_{4}^{-}'],
  ['SO42-', 'SO_{4}^{2-}'],
  ['CO32-', 'CO_{3}^{2-}'],
  ['Cr2O72-', 'Cr_{2}O_{7}^{2-}'],
  ['S2O32-', 'S_{2}O_{3}^{2-}'],
  ['OH-', 'OH^{-}'],
  ['I3-', 'I_3^-'],
  ['[Cu(H2O)6]2+', '[Cu(H_{2}O)_{6}]^{2+}'],
  ['[CuCl4]2-', '[CuCl_{4}]^{2-}'],
  ['[Ag(NH3)2]+', '[Ag(NH_{3})_{2}]^{+}'],
  ['2HCl(aq)', '2HCl(aq)'],
  ['H2(g)', 'H_{2}(g)'],
  ['Mg(s) + 2HCl(aq) -> MgCl2(aq) + H2(g)', 'Mg(s) + 2HCl(aq) → MgCl_{2}(aq) + H_{2}(g)'],
  ['N2 + 3H2 <=> 2NH3', 'N_{2} + 3H_{2} ⇌ 2NH_{3}'],
  ['25 cm3', '25 cm^3'],
  ['30cm3', '30 cm^3'],
  ['0.100 mol dm-3', '0.100 mol dm^{-3}'],
  ['4200 J kg-1 K-1', '4200 J kg^{-1} K^{-1}'],
  ['9.8 m s-2', '9.8 m s^{-2}'],
  ['2 m2', '2 m^2'],
  ['volume / cm3', 'volume / cm^3'],
  ['20oC', '20 °C'],
  ['20 degC', '20 °C'],
  ['VO2+', 'VO_{2}^{+}'],
  ['VO^{2+}', 'VO^{2+}'],
  ['Hg22+', 'Hg_{2}^{2+}'],
  ['<- back', '← back'],
  ['50 cm3 of H2SO4 at 20oC', '50 cm^3 of H_{2}SO_{4} at 20 °C'],
  // GCSE unit style with a solidus
  ['kg/m3', 'kg/m^3'],
  ['9.8 m/s2', '9.8 m/s^2'],
  ['cm3/s', 'cm^3/s'],
  ['0.50 mol/dm3', '0.50 mol/dm^3'],
  ['g/dm3', 'g/dm^3'],
  ['N/m2', 'N/m^2'],
  ['rate / s-1', 'rate / s^{-1}'],
  ['min-1', 'min^{-1}'],
  ['J kg-1 °C-1', 'J kg^{-1} °C^{-1}'],
  ['mol dm–3', 'mol dm^{-3}'],
  ['temperature / oC', 'temperature / °C'],
  ['temperature (oC)', 'temperature (°C)'],
  // electrons and elements as molecules
  ['e-', 'e^{-}'],
  ['2H+ + 2e- -> H2', '2H^{+} + 2e^{-} → H_{2}'],
  ['Cl2', 'Cl_{2}'],
  ['O3', 'O_{3}'],
  ['P4', 'P_{4}'],
  ['S8', 'S_{8}'],
  ['Br2(l)', 'Br_{2}(l)'],
  ['S2-', 'S^{2-}'],
  // must stay unchanged
  ['Y7', 'Y7'],
  ['B2', 'B2'],
  ['mass m2', 'mass m2'],
  ['Test tube 2', 'Test tube 2'],
  ['U-tube', 'U-tube'],
  ['pH 7', 'pH 7'],
  ['beaker', 'beaker'],
  ['Bunsen burner', 'Bunsen burner'],
  ['A1', 'A1'],
  ['KS3', 'KS3'],
  ['KS4', 'KS4'],
  ['P1', 'P1'],
  ['P2', 'P2'],
  ['S2', 'S2'],
  ['C1', 'C1'],
  ['km/h', 'km/h'],
  ['octane', 'octane'],
  ['No', 'No'],
  ['He', 'He'],
  ['CO', 'CO'],
  ['NaCl', 'NaCl'],
  ['heat', 'heat'],
  ['H_2O already', 'H_2O already'],
  ['(water)', '(water)'],
  ['copper(II) sulfate', 'copper(II) sulfate'],
]

describe('smartChem', () => {
  for (const [input, expected] of CASES) it(`${input} → ${expected}`, () => expect(smartChem(input)).toBe(expected))
})

describe('parseMarkup', () => {
  it('splits scripts', () => {
    expect(parseMarkup('H_{2}SO_{4}')).toEqual([
      { text: 'H', script: 'normal' },
      { text: '2', script: 'sub' },
      { text: 'SO', script: 'normal' },
      { text: '4', script: 'sub' },
    ])
  })
  it('takes a signed number without braces and uses a true minus in superscripts', () => {
    expect(parseMarkup('dm^-3')).toEqual([
      { text: 'dm', script: 'normal' },
      { text: '−3', script: 'sup' },
    ])
    expect(parseMarkup('Cu^2+')).toEqual([
      { text: 'Cu', script: 'normal' },
      { text: '2+', script: 'sup' },
    ])
  })
  it('keeps escaped characters', () => {
    expect(parseMarkup('a\\_b')).toEqual([{ text: 'a_b', script: 'normal' }])
  })
})
