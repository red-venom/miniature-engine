// biology.ts — templates of the group "Biology". Each one follows its row in the Templates tab (spec/templates.json).
// Copy the pattern of heatingBeaker in general.ts: place parts with DocBuilder.at, .on and .near.

import { P } from '../kernel/geom'
import type { Layer } from '../kernel/contents'
import { DocBuilder } from '../model/build'
import { geometry } from '../symbols/registry'
import { readingToAmount } from '../symbols/scale'
import type { TemplateDef } from './types'

// Colours are presets from section 9 of the specification.
const WATER = '#cfe8f7'
const COLOURLESS = '#e9f1f5'
const BLUE = '#7fb8e6'
const MERCURY = '#d33333'
const liquid = (colour: string, amount: number, extra: Partial<Layer> = {}): Layer => ({ kind: 'liquid', amount, colour, ...extra })
/** The red thread of a thermometer of height `h`, set to `celsius`. */
const thermometerAt = (h: number, celsius: number): Layer => liquid(MERCURY, readingToAmount(geometry('thermometer', 9, h), celsius) ?? 0.3)

/** Light microscope with a slide on the stage, labelled part by part. The microscope's local frame is the world frame here. */
const microscopeParts: TemplateDef = {
  id: 'microscopeParts',
  title: 'Light microscope',
  group: 'Biology',
  refs: 'Trilogy RP 1',
  build() {
    const b = new DocBuilder('Light microscope')
    const scope = b.at('microscope', 'base', P(0, 250))
    const slide = b.on('microscopeSlide', 'under', scope, 'stage', { w: 80 })
    // Left column: the optical path from the eyepiece down to the lamp. Targets are points of the drawing at 160 × 250.
    b.label('eyepiece', -110, 30, [scope, -60, 30])
    b.label('objective lenses', -110, 110, [scope, -19, 138])
    b.label('microscope slide', -110, 150, [slide, -40, 3])
    b.label('stage', -110, 190, [scope, -58, 156])
    b.label('lamp', -110, 233, [scope, -23, 233])
    // Right column: the two focus knobs are concentric on the arm. The coarse knob is the outer ring, the fine knob the inner one.
    b.label('coarse focus', 110, 175, [scope, 46.4, 183.6])
    b.label('fine focus', 110, 215, [scope, 44.2, 194.2])
    return b.doc
  },
}

/** Five boiling tubes of sucrose solution in a rack, a potato cylinder in each, and the balance beside the rack. */
const osmosis: TemplateDef = {
  id: 'osmosis',
  title: 'Osmosis in plant tissue',
  group: 'Biology',
  refs: 'Trilogy RP 2',
  build() {
    const b = new DocBuilder('Osmosis in plant tissue')
    const rack = b.at('testTubeRack', 'base', P(0, 300), { w: 250, params: { holes: 5, tube: 'boiling' } })
    const tubes = [1, 2, 3, 4, 5].map((i) => b.on('boilingTube', 'bottom', rack, `slot${i}`, { contents: { main: [liquid(WATER, 0.6)] } }))
    // A potato cylinder stands in each tube, its lower end just above the round bottom.
    const potatoes = tubes.map((t) => b.near('potatoCylinder', t, 'bottom', { dy: -31 }))
    const balance = b.on('balance', 'base', rack, 'base', { dx: 245 })
    // Tube labels: the leaders end on the outer rim tip of each tube, from well above so that they clear the neighbouring tubes.
    b.label('0.25 mol/dm3', -200, -40, [tubes[1], -19.5, 0])
    b.label('0.0 mol/dm3', -200, 0, [tubes[0], -19.5, 0])
    b.label('0.50 mol/dm3', 200, -60, [tubes[2], 19.5, 0])
    b.label('0.75 mol/dm3', 200, -20, [tubes[3], 19.5, 0])
    b.label('1.0 mol/dm3', 200, 20, [tubes[4], 19.5, 0])
    // The parts, in the left column below the tube labels.
    b.label('boiling tube', -200, 40, [tubes[0], -17, 23])
    b.label('potato cylinder', -200, 80, [potatoes[0], -4, 0])
    b.label('test-tube rack', -200, 130, [rack, -121, 25])
    b.label('balance', 360, 275, [balance, 90, 40])
    return b.doc
  },
}

/** A test tube of food sample and Benedict's solution standing in a beaker of hot water over a Bunsen burner. */
const foodTestWaterBath: TemplateDef = {
  id: 'foodTestWaterBath',
  title: 'Food test in a water bath',
  group: 'Biology',
  refs: 'Trilogy RP 3',
  build() {
    const b = new DocBuilder('Food test in a water bath')
    const mat = b.at('heatproofMat', 'under', P(0, 0))
    const tripod = b.on('tripod', 'feet', mat, 'top')
    const burner = b.on('bunsenBurner', 'base', mat, 'top')
    const gauze = b.on('gauze', 'under', tripod, 'top')
    const beaker = b.on('beaker', 'base', gauze, 'top', { contents: { main: [liquid(WATER, 0.6)] } })
    // The test tube stands on the bottom of the beaker; its solution is below the water level of the bath.
    const tube = b.on('testTube', 'bottom', beaker, 'base', { dx: -14, dy: -2, contents: { main: [liquid(BLUE, 0.35)] } })
    const thermo = b.on('thermometer', 'bulb', beaker, 'base', { dx: 24, dy: -12, h: 200, contents: { main: [thermometerAt(200, 80)] } })
    b.label('test tube', -110, -290, [tube, -12, 20])
    b.label("Benedict's solution\nand food sample", -110, -210, [tube, -8, 95])
    b.label('thermometer', 110, -330, [thermo, 4.5, 30])
    b.label('beaker', 110, -250, [beaker, 50, 30])
    b.label('hot water', 110, -200, [beaker, 35, 85])
    b.label('gauze', 110, -150, [gauze, 68, 2.5])
    b.label('tripod', 110, -100, [tripod, 56, 50])
    b.label('Bunsen burner', 110, -50, [burner, 10, 94])
    b.label('heatproof mat', 110, -10, [mat, 80, 4])
    return b.doc
  },
}

/** Two test tubes and a thermometer in an electric water bath; a spotting tile of iodine and a dropper beside it. */
const enzymes: TemplateDef = {
  id: 'enzymes',
  title: 'Effect of pH on amylase',
  group: 'Biology',
  refs: 'Trilogy RP 4',
  build() {
    const b = new DocBuilder('Effect of pH on amylase')
    const bath = b.at('waterBath', 'base', P(0, 0), { contents: { main: [liquid(WATER, 0.7)] } })
    // The tank floor is 39 u above the base. Tubes and thermometer stand on it, in the water.
    const tubeA = b.on('testTube', 'bottom', bath, 'base', { dx: -45, dy: -41, contents: { main: [liquid(COLOURLESS, 0.4)] } })
    b.on('testTube', 'bottom', bath, 'base', { dx: 5, dy: -41, contents: { main: [liquid(COLOURLESS, 0.4)] } })
    const thermo = b.on('thermometer', 'bulb', bath, 'base', { dx: 55, dy: -44, h: 180, contents: { main: [thermometerAt(180, 35)] } })
    const tile = b.near('spottingTile', bath, 'base', { dx: 275, dy: -60, params: { iodine: true, blueBlack: 5 } })
    const dropper = b.on('dropper', 'tip', bath, 'base', { dx: 385, dy: -2 })
    const watch = b.near('stopwatch', bath, 'base', { dx: -187, dy: -33 })
    b.label('test tubes', -250, -210, [tubeA, -12, 25])
    b.label('water bath', -250, -160, [bath, -125, 10])
    b.label('starch and amylase\nsolutions', -250, -100, [tubeA, -8, 95])
    b.label('stopwatch', -250, -30, [watch, -27, 40])
    b.label('thermometer', 440, -230, [thermo, 4.5, 30])
    b.label('spotting tile', 440, -190, [tile, 80, 2])
    b.label('dropping pipette\n(iodine solution)', 440, -140, [dropper, 4, 50])
    return b.doc
  },
}

/** Pondweed upside down in a boiling tube of water, in a beaker of water; the lamp at a measured distance. */
const photosynthesis: TemplateDef = {
  id: 'photosynthesis',
  title: 'Light intensity and photosynthesis',
  group: 'Biology',
  refs: 'Trilogy RP 5',
  build() {
    const b = new DocBuilder('Light intensity and photosynthesis')
    const lamp = b.at('lamp', 'base', P(-250, 0))
    // The ruler lies on the bench from the lamp to the beaker, and the beaker stands at its far end.
    const ruler = b.near('ruler', lamp, 'base', { dx: 185, dy: -11 })
    const beaker = b.on('beaker', 'base', lamp, 'base', { dx: 400, contents: { main: [liquid(WATER, 0.7)] } })
    const tube = b.on('boilingTube', 'bottom', beaker, 'base', { dy: -2, contents: { main: [liquid(WATER, 0.85, { bubbles: 'many' })] } })
    // Upside down: the cut end of the stem is at the top, just under the water surface, so that the bubbles can be counted.
    const weed = b.on('pondweed', 'cut', tube, 'mouth', { rot: 180, dy: 30 })
    b.label('lamp', -320, -100, [lamp, -14, 24])
    // The ruler is labelled in the clear space above it: a leader from either column would cross the lamp or the beaker.
    b.label('ruler', 40, -50, [ruler, 125, 0])
    b.label('boiling tube', 260, -230, [tube, 17, 40])
    b.label('pondweed', 260, -180, [weed, 0, 55])
    b.label('bubbles of oxygen', 260, -130, [tube, -10, 120])
    b.label('water', 260, -80, [beaker, 42, 70])
    b.label('beaker', 260, -30, [beaker, 50, 110])
    return b.doc
  },
}

/** A quadrat laid beside a tape measure that marks the transect line (top view). */
const quadratSampling: TemplateDef = {
  id: 'quadratSampling',
  title: 'Sampling with a quadrat',
  group: 'Biology',
  refs: 'Trilogy RP 7',
  build() {
    const b = new DocBuilder('Sampling with a quadrat')
    // Neither symbol has an anchor (both are top views), so the quadrat is placed by its centre beside the tape.
    const tape = b.symbol('ruler', { x: 0, y: 0, w: 420, params: { length: '100', numbers: false } })
    const quadrat = b.symbol('quadrat', { x: -60, y: -100 })
    b.label('quadrat', -220, -150, [quadrat, -85, 50])
    b.label('grid', -220, -80, [quadrat, -48, 160])
    b.label('tape measure', -220, -20, [tape, -210, 11])
    b.label('transect line', 270, -40, [tape, 200, 0])
    return b.doc
  },
}

export const biology: TemplateDef[] = [microscopeParts, osmosis, foodTestWaterBath, enzymes, photosynthesis, quadratSampling]
