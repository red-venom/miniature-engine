import { describe, expect, it } from 'vitest'
import { CONNECTOR_PRESETS } from '../model/connectors'
import { SYMBOLS } from '../symbols/registry'
import { LONG_WORD, MIN_PART, SOFT_HYPHEN, breaks, softHyphens } from './hyphens'

/** A word with a middle dot at each break. */
const shown = (word: string) => {
  let out = ''
  let from = 0
  for (const at of breaks(word)) {
    out += `${word.slice(from, at)}·`
    from = at
  }
  return out + word.slice(from)
}

describe('breaks', () => {
  it('puts one consonant between two vowels with the next syllable', () => {
    expect(shown('Chromatography')).toBe('Chro·ma·to·graphy')
    expect(shown('Separating')).toBe('Sepa·ra·ting')
  })

  it('gives the next syllable the consonants that can begin one', () => {
    expect(shown('Electrolysis')).toBe('Elec·tro·lysis')
    expect(shown('Polystyrene')).toBe('Poly·sty·rene')
    expect(shown('Microscope')).toBe('Micro·scope')
  })

  it('never splits two consonants that sound as one', () => {
    expect(shown('Photosynthesis')).toBe('Photo·syn·thesis')
    expect(shown('Stretching')).toBe('Stret·ching')
    expect(shown('Bracketing')).toBe('Brack·e·ting')
  })

  it(`leaves at least ${MIN_PART} letters on each side`, () => {
    expect(shown('Chromatography')).not.toContain('·phy')
    expect(shown('Evaporating')).toBe('Evapo·ra·ting')
    expect(breaks('bottomed')).toEqual([])
    expect(breaks('Quadrat')).toEqual([])
    for (const word of ['Displacement', 'Thermometer', 'Spectrophotometer'])
      for (const at of breaks(word)) {
        expect(at).toBeGreaterThanOrEqual(MIN_PART)
        expect(word.length - at).toBeGreaterThanOrEqual(MIN_PART)
      }
  })
})

describe('softHyphens', () => {
  it(`puts soft hyphens only in words of ${LONG_WORD} letters or more`, () => {
    expect(softHyphens('Chromatography paper')).toBe(`Chro${SOFT_HYPHEN}ma${SOFT_HYPHEN}to${SOFT_HYPHEN}graphy paper`)
    expect(softHyphens('Displacement can')).toBe(`Displa${SOFT_HYPHEN}ce${SOFT_HYPHEN}ment can`)
    expect(softHyphens('Thermometer adaptor')).toBe('Thermometer adaptor')
    expect(softHyphens('Round-bottomed flask')).toBe('Round-bottomed flask')
    expect(softHyphens('Water bath (electric)')).toBe('Water bath (electric)')
  })

  it('changes nothing else in the name of any symbol or preset', () => {
    for (const name of [...SYMBOLS.map((d) => d.name), ...CONNECTOR_PRESETS.map((p) => p.name)]) {
      expect(softHyphens(name).replaceAll(SOFT_HYPHEN, '')).toBe(name)
      for (const word of softHyphens(name).split(/[\s-]+/))
        if (word.includes(SOFT_HYPHEN)) expect(word.replaceAll(SOFT_HYPHEN, '').length).toBeGreaterThanOrEqual(LONG_WORD)
    }
  })
})
