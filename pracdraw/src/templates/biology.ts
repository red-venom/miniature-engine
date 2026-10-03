// biology.ts — templates of the group "Biology". Each one follows its row in the Templates tab (spec/templates.json).
// Copy the pattern of heatingBeaker in general.ts: place parts with DocBuilder.at, .on and .near.

import { P } from '../kernel/geom'
import type { Layer } from '../kernel/contents'
import { DocBuilder, anchorWorld } from '../model/build'
import { geometry } from '../symbols/registry'
import { readingToAmount } from '../symbols/scale'
import type { TemplateDef } from './types'

// Colours are presets from section 9 of the specification.
const WATER = '#cfe8f7'
const COLOURLESS = '#e9f1f5'
const BLUE = '#7fb8e6'
const THREAD = '#d33333' // the red liquid of a thermometer
const liquid = (colour: string, amount: number, extra: Partial<Layer> = {}): Layer => ({ kind: 'liquid', amount, colour, ...extra })
/** The red thread of a thermometer of height `h`, set to `celsius`. */
const thermometerAt = (h: number, celsius: number): Layer => liquid(THREAD, readingToAmount(geometry('thermometer', 9, h), celsius) ?? 0.3)

/** Light microscope with a slide on the stage, labelled part by part. */
const microscopeParts: TemplateDef = {
  id: 'microscopeParts',
  title: 'Light microscope',
  group: 'Biology',
  refs: 'Trilogy RP 1',
  build() {
    const b = new DocBuilder('Light microscope')
    // At its default size (160 × 250) the microscope's local frame is the world frame here, so each target is a point of its drawing.
    const scope = b.at('microscope', 'base', P(0, 250))
    // The slide lies on the stage, centred under the objective that points down.
    const slide = b.on('microscopeSlide', 'under', scope, 'stage', { w: 80 })
    // Left column: the optical path from the eyepiece down to the lamp.
    b.label('eyepiece', -100, 50, [scope, -61.2, 20.1])
    b.label('objective lenses', -100, 90, [scope, -19, 128])
    b.label('microscope slide', -100, 130, [slide, -30, 3])
    b.label('stage', -100, 170, [scope, -58, 155])
    b.label('lamp', -100, 210, [scope, -21.1, 230.9])
    // Right column: the focus knobs are concentric on the arm. Coarse focus is the outer ring, fine focus the inner one.
    b.label('coarse focus', 90, 170, [scope, 46.4, 183.6])
    b.label('fine focus', 90, 210, [scope, 44.2, 194.2])
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
    const rack = b.at('testTubeRack', 'base', P(0, 0), { w: 250, params: { holes: 5, tube: 'boiling' } })
    // Sucrose solution of five concentrations (Colourless solution), the same volume in each tube.
    const conc = ['0.0', '0.25', '0.50', '0.75', '1.0']
    const tubes = conc.map((_, i) => b.on('boilingTube', 'bottom', rack, `slot${i + 1}`, { contents: { main: [liquid(COLOURLESS, 0.6)] } }))
    // A potato cylinder stands in each tube, covered by the solution, its lower end clear of the round bottom.
    const potatoes = tubes.map((t) => b.near('potatoCylinder', t, 'bottom', { dy: -34 }))
    const balance = b.on('balance', 'base', rack, 'base', { dx: 250 })
    // Tube labels: a staircase above the tubes, each with a vertical leader down to the left rim of its tube.
    // The first tube's label is the highest, so that no leader meets the text of a label further left.
    tubes.forEach((t, i) => {
      const mouth = anchorWorld(t, 'mouth')
      b.label(`${conc[i]} mol/dm3`, mouth.x - 14.5, mouth.y - 32 - 40 * (tubes.length - 1 - i), [t, -19.5, 0])
    })
    // Left column: the parts, labelled on the first tube. The potato leader enters the tube above the rack.
    b.label('boiling tube', -150, -165, [tubes[0], -17, 22])
    b.label('potato cylinder', -150, -125, [potatoes[0], 3, 0])
    b.label('test-tube rack', -150, -85, [rack, -125, 12])
    b.label('balance', 360, -15, [balance, 84.4, 36])
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
    // The test tube stands on the bottom of the beaker. It is longer than the beaker is tall, so its mouth is above the rim,
    // and its blue solution is below the level of the hot water.
    const tube = b.on('testTube', 'bottom', beaker, 'base', { dx: -18, dy: -2, h: 150, contents: { main: [liquid(BLUE, 0.35)] } })
    const thermo = b.on('thermometer', 'bulb', beaker, 'base', { dx: 24, dy: -12, h: 200, contents: { main: [thermometerAt(200, 80)] } })
    b.label('test tube', -100, -250, [tube, -12, 25])
    b.label("Benedict's solution\nand food sample", -100, -210, [tube, -4, 110])
    b.label('thermometer', 105, -290, [thermo, 4.5, 45])
    b.label('beaker', 105, -250, [beaker, 50, 15])
    b.label('hot water', 105, -210, [beaker, 35, 73])
    b.label('gauze', 105, -120, [gauze, 68, 2.5])
    b.label('tripod', 105, -80, [tripod, 54, 38])
    b.label('Bunsen burner', 105, -40, [burner, 10, 95])
    b.label('heatproof mat', 105, 0, [mat, 80, 4])
    return b.doc
  },
}

/** Two test tubes and a thermometer in an electric water bath; a spotting tile of iodine and a dropping pipette beside it. */
const enzymes: TemplateDef = {
  id: 'enzymes',
  title: 'Effect of pH on amylase',
  group: 'Biology',
  refs: 'Trilogy RP 4',
  build() {
    const b = new DocBuilder('Effect of pH on amylase')
    const bath = b.at('waterBath', 'base', P(0, 0), { contents: { main: [liquid(WATER, 0.7)] } })
    // The tank floor is 39 u above the base. The tubes and the thermometer stand on it, in the water, the thermometer between the tubes.
    const starch = b.on('testTube', 'bottom', bath, 'base', { dx: -75, dy: -41, contents: { main: [liquid(COLOURLESS, 0.4)] } })
    const thermo = b.on('thermometer', 'bulb', bath, 'base', { dy: -44, h: 180, contents: { main: [thermometerAt(180, 35)] } })
    const amylase = b.on('testTube', 'bottom', bath, 'base', { dx: 75, dy: -41, contents: { main: [liquid(COLOURLESS, 0.4)] } })
    // Beside the bath: the stopwatch on the left; the spotting tile and the dropping pipette on the right.
    const watch = b.near('stopwatch', bath, 'base', { dx: -190, dy: -33 })
    const tile = b.near('spottingTile', bath, 'base', { dx: 260, dy: -60, params: { iodine: true, blueBlack: 5 } })
    const dropper = b.on('dropper', 'tip', bath, 'base', { dx: 385, dy: -4 })
    // Left column: the bath and what is on its left.
    b.label('starch solution', -240, -145, [starch, -12, 16])
    b.label('water bath', -240, -105, [bath, -130, 25])
    b.label('water', -240, -70, [bath, -110, 60])
    b.label('stopwatch', -240, -30, [watch, -27, 36])
    // Above the tile: the thermometer and the right-hand tube. Each leader passes above the tube between.
    b.label('thermometer', 150, -190, [thermo, 4.5, 36])
    b.label('amylase and pH buffer', 150, -150, [amylase, 12, 16])
    // Right of the dropping pipette.
    b.label('spotting tile', 430, -130, [tile, 77, 0])
    b.label('dropping pipette', 430, -90, [dropper, 8, 12])
    return b.doc
  },
}

/** Pondweed upside down in a boiling tube of water, in a beaker of water; the lamp at a distance measured with a ruler. */
const photosynthesis: TemplateDef = {
  id: 'photosynthesis',
  title: 'Light intensity and photosynthesis',
  group: 'Biology',
  refs: 'Trilogy RP 5',
  build() {
    const b = new DocBuilder('Light intensity and photosynthesis')
    const lamp = b.at('lamp', 'base', P(-250, 0))
    // The ruler lies on the bench from the lamp towards the beaker.
    const ruler = b.near('ruler', lamp, 'base', { dx: 185, dy: -11 })
    const beaker = b.on('beaker', 'base', lamp, 'base', { dx: 400, contents: { main: [liquid(WATER, 0.7)] } })
    const tube = b.on('boilingTube', 'bottom', beaker, 'base', { dy: -2, contents: { main: [liquid(WATER, 0.85, { bubbles: 'many' })] } })
    // Upside down: the cut end of the stem is at the top, just under the water surface, where the bubbles are counted.
    const weed = b.on('pondweed', 'cut', tube, 'mouth', { rot: 180, dy: 30 })
    b.label('lamp', -300, -108, [lamp, 12, 8])
    // The ruler is labelled from the clear space above it: from either column a leader would cross the lamp or the beaker.
    b.label('ruler', -64.7, -60, [ruler, -4.7, 0]) // between the 14 and 15 cm ticks
    b.label('boiling tube', 230, -140, [tube, 17, 12])
    b.label('beaker', 230, -105, [beaker, 50, 15])
    b.label('bubbles of oxygen', 230, -70, [tube, 9.8, 82]) // the right edge of a bubble
    b.label('pondweed', 230, -35, [weed, -2.2, 40]) // a point of the stem
    b.label('water', 230, 0, [beaker, 35, 90])
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
    // 100 cm of tape over 340 u (3.4 u per cm), so that the 170 u quadrat is 50 cm square.
    const tape = b.symbol('ruler', { x: 0, y: 0, w: 356, params: { length: '100', numbers: false } })
    /** Local x of a mark on the tape, in cm from its zero (the scale has an 8 u margin at each end). */
    const mark = (cm: number) => -(tape.w - 16) / 2 + (cm * (tape.w - 16)) / 100
    // Neither symbol has an anchor (both are top views), so the quadrat is placed from the tape:
    // from the 10 cm mark to the 60 cm mark, 8 u from the edge of the tape.
    const quadrat = b.symbol('quadrat', { x: tape.x + mark(35) })
    quadrat.y = tape.y - tape.h / 2 - 8 - quadrat.h / 2
    // Right column, above the free end of the tape. The tape's leader comes straight down between the 66 and 67 cm ticks.
    const col = tape.x + mark(66.5) + 5
    b.label('quadrat', col, -150, [quadrat, 85, 40])
    b.label('grid of 25 squares', col, -110, [quadrat, 48, 95])
    b.label('tape measure', col, -70, [tape, mark(66.5), 0])
    return b.doc
  },
}

export const biology: TemplateDef[] = [microscopeParts, osmosis, foodTestWaterBath, enzymes, photosynthesis, quadratSampling]
