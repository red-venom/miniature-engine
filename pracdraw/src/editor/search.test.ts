import { describe, expect, it } from 'vitest'
import { SYMBOLS } from '../symbols/registry'
import { PACKS, searchSymbols } from './search'

describe('searchSymbols', () => {
  it('returns everything for an empty query', () => {
    expect(searchSymbols('')).toBe(SYMBOLS)
    expect(searchSymbols('   ')).toBe(SYMBOLS)
  })
  it('matches every typed word against names and aliases, ignoring case', () => {
    expect(searchSymbols('ERLENMEYER').map((d) => d.id)).toEqual(['conicalFlask'])
    expect(searchSymbols('round flask').map((d) => d.id)).toEqual(['roundBottomFlask'])
    expect(searchSymbols('round tube')).toEqual([])
  })
  it('puts names that start with the query first', () => {
    const ids = searchSymbols('tube').map((d) => d.id)
    expect(ids.length).toBeGreaterThan(1)
    expect(
      SYMBOLS.find((d) => d.id === ids[0])!
        .name.toLowerCase()
        .startsWith('tube'),
    ).toBe(false)
    const b = searchSymbols('b')
    const starts = (d: (typeof b)[number]) => [d.name, ...(d.aliases ?? [])].some((n) => n.toLowerCase().startsWith('b'))
    const firstNotStarting = b.findIndex((d) => !starts(d))
    const lastStarting = b.map(starts).lastIndexOf(true)
    expect(firstNotStarting === -1 || lastStarting < firstNotStarting).toBe(true)
    expect(b[0].name).toBe('Beaker')
  })
  it('lists the eleven packs in the order of section 12', () => {
    expect(PACKS.map((p) => p.id)).toEqual([
      'containers',
      'measuring',
      'heating',
      'support',
      'filtering',
      'organic',
      'electrochemistry',
      'physics',
      'biology',
      'circuit',
      'annotation',
    ])
  })
})
