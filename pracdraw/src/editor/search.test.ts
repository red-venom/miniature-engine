import { describe, expect, it } from 'vitest'
import { CONNECTOR_PRESETS } from '../model/connectors'
import { SYMBOLS } from '../symbols/registry'
import { PACKS, PRESET_GROUP, searchPresets, searchSymbols } from './search'

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

describe('searchPresets', () => {
  it('finds the "Tubes and lines" presets by name and alias, by the same rule', () => {
    expect(PRESET_GROUP).toBe('Tubes and lines')
    expect(searchPresets('')).toBe(CONNECTOR_PRESETS)
    expect(searchPresets('tube').map((p) => p.id)).toEqual(['deliveryTube', 'rightAngleTube', 'rubberTubing'])
    expect(searchPresets('RUBBER').map((p) => p.id)).toEqual(['rubberTubing'])
    expect(searchPresets('glass tube').map((p) => p.id)).toEqual(['deliveryTube', 'rightAngleTube'])
    expect(searchPresets('dimension').map((p) => p.id)).toEqual(['dimensionLine'])
    expect(searchPresets('arrow').map((p) => p.id)).toEqual(['arrow'])
    expect(searchPresets('beaker')).toEqual([])
  })
})
