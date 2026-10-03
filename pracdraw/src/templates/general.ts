// general.ts — templates of the group "General". heatingBeaker is the worked example: copy its pattern.

import { P } from '../kernel/geom'
import { DocBuilder } from '../model/build'
import { geometry } from '../symbols/registry'
import { readingToAmount } from '../symbols/scale'
import type { TemplateDef } from './types'

const heatingBeaker: TemplateDef = {
  id: 'heatingBeaker',
  title: 'Heating a liquid in a beaker',
  group: 'General',
  refs: 'General; Trilogy RP 8',
  build() {
    const b = new DocBuilder('Heating a liquid in a beaker')
    const mat = b.at('heatproofMat', 'under', P(0, 0))
    const tripod = b.on('tripod', 'feet', mat, 'top')
    const burner = b.on('bunsenBurner', 'base', mat, 'top')
    const gauze = b.on('gauze', 'under', tripod, 'top')
    const beaker = b.on('beaker', 'base', gauze, 'top', { contents: { main: [{ kind: 'liquid', amount: 0.6, colour: '#cfe8f7' }] } })
    const thermo = b.on('thermometer', 'bulb', beaker, 'base', { dx: 16, dy: -12, h: 200 })
    thermo.contents = { main: [{ kind: 'liquid', amount: readingToAmount(geometry('thermometer', 9, 200), 20) ?? 0.2, colour: '#d33333' }] }
    // Labels: text to the right, each leader fixed to its item so that it follows when the item moves.
    b.label('thermometer', 110, -330, [thermo, 4.5, 30])
    b.label('beaker', 110, -200, [beaker, 50, 50])
    b.label('water', 110, -165, [beaker, 30, 90])
    b.label('gauze', 110, -118, [gauze, 68, 2.5])
    b.label('tripod', 110, -70, [tripod, 56, 50])
    b.label('Bunsen burner', 110, -30, [burner, 10, 94])
    b.label('heatproof mat', 110, 14, [mat, 80, 4])
    return b.doc
  },
}

export const general: TemplateDef[] = [heatingBeaker]
