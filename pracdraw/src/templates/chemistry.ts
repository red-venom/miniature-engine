// chemistry.ts — templates of the group "Chemistry". Each one follows its row in the Templates tab (spec/templates.json).
// Copy the pattern of heatingBeaker in general.ts: place parts with DocBuilder.at, .on and .near.

import { P, v } from '../kernel/geom'
import type { Layer } from '../kernel/contents'
import { DocBuilder, anchorOf, anchorWorld, moveAnchorTo } from '../model/build'
import type { SymbolItem } from '../model/types'
import { geometry } from '../symbols/registry'
import { readingToAmount } from '../symbols/scale'
import type { TemplateDef } from './types'

// Colours are presets from section 9 of the specification.
const WATER = '#cfe8f7'
const COLOURLESS = '#e9f1f5' // Colourless solution
const BLUE = '#7fb8e6' // Blue (copper sulfate)
const CLOUDY_YELLOW = '#f1e9b0' // Cloudy yellow (sulfur): a cloudy liquid
const GRANULES = '#e9e9e9' // Chips or granules
const ICE = '#eaf4fb'
const RED = '#d33333' // the liquid in a thermometer
const NO_TINT = '#ffffff' // a colourless gas

const liquid = (amount: number, colour: string, extra: Partial<Layer> = {}): Layer => ({ kind: 'liquid', amount, colour, ...extra })
const lumps = (amount: number, colour: string): Layer => ({ kind: 'lumps', amount, colour })
/** A gas fills the space above the other layers, so it is always the last layer. Its amount is what is left. */
const gas = (below: number, colour = NO_TINT): Layer => ({ kind: 'gas', amount: Math.round((1 - below) * 100) / 100, colour })

/** Set the red column of an upright thermometer to a reading in °C. */
function setReading(thermo: SymbolItem, celsius: number): void {
  const amount = readingToAmount(geometry('thermometer', thermo.w, thermo.h, thermo.params), celsius) ?? 0.2
  thermo.contents = { main: [liquid(amount, RED)] }
}

/**
 * Stands and clamps stand behind what they hold, so they are made first and placed afterwards.
 * Here a stand made earlier moves so that its rod passes through the clamp's boss and its base is on the bench.
 */
function standUnder(stand: SymbolItem, clamp: SymbolItem, bench: number): void {
  moveAnchorTo(stand, 'rod', anchorWorld(clamp, 'sleeve'))
  moveAnchorTo(stand, 'base', P(anchorWorld(stand, 'base').x, bench))
}

const filtration: TemplateDef = {
  id: 'filtration',
  title: 'Filtration',
  group: 'Chemistry',
  refs: 'Trilogy RP 8',
  build() {
    const b = new DocBuilder('Filtration')
    const flask = b.at('conicalFlask', 'base', P(0, 0), { contents: { main: [liquid(0.15, BLUE)] } })
    // The funnel cone rests on the flask rim, so its stem reaches 80 u down into the flask.
    const funnel = b.on('filterFunnel', 'stem', flask, 'mouth', { dy: 80 })
    // The paper lines the cone, parallel to it, with its apex where the cone meets the stem.
    const paper = b.on('filterPaper', 'apex', funnel, 'rim', { dy: 50, w: 68, params: { residue: true } })
    b.label('filter paper', -80, -160, [paper, -17, 23])
    b.label('residue', -80, -122, [paper, 0, 39])
    b.label('filter funnel', 80, -175, [funnel, 36, 8])
    b.label('conical flask', 80, -60, [flask, 36, 95])
    b.label('filtrate', 80, -15, [flask, 20, 140])
    return b.doc
  },
}

const crystallisation: TemplateDef = {
  id: 'crystallisation',
  title: 'Evaporating a solution',
  group: 'Chemistry',
  refs: 'Trilogy RP 8',
  build() {
    const b = new DocBuilder('Evaporating a solution')
    const mat = b.at('heatproofMat', 'under', P(0, 0))
    const tripod = b.on('tripod', 'feet', mat, 'top')
    const burner = b.on('bunsenBurner', 'base', mat, 'top')
    const gauze = b.on('gauze', 'under', tripod, 'top')
    const bath = b.on('beaker', 'base', gauze, 'top', { contents: { main: [liquid(0.7, WATER)] } })
    // The basin sits in the beaker mouth: its wall rests on the inner edge of the rim, and its foot is 17.5 u down inside the beaker.
    const basin = b.on('evaporatingBasin', 'base', bath, 'rim', { dy: 17.5, contents: { main: [liquid(0.5, BLUE)] } })
    b.label('evaporating basin', 110, -278, [basin, 59.6, 8])
    b.label('copper sulfate solution', 110, -238, [basin, 25, 34])
    b.label('water bath', 110, -185, [bath, 30, 80])
    b.label('gauze', 110, -118, [gauze, 68, 2.5])
    b.label('tripod', 110, -72, [tripod, 55, 50])
    b.label('Bunsen burner', 110, -30, [burner, 10, 94])
    b.label('heatproof mat', 110, 12, [mat, 80, 4])
    return b.doc
  },
}

const electrolysis: TemplateDef = {
  id: 'electrolysis',
  title: 'Electrolysis of a solution',
  group: 'Chemistry',
  refs: 'Trilogy RP 9',
  build() {
    const b = new DocBuilder('Electrolysis of a solution')
    const cell = b.at('electrolysisCell', 'base', P(0, 0), { contents: { main: [liquid(0.7, COLOURLESS)] } })
    // Upside down over each electrode, mouths 14 u below the surface. The hydrogen at the negative electrode is twice the oxygen.
    const hydrogen = b.on('testTube', 'mouth', cell, 'terminalL', { rot: 180, dy: -70, contents: { main: [liquid(0.63, COLOURLESS), gas(0.63)] } })
    const oxygen = b.on('testTube', 'mouth', cell, 'terminalR', { rot: 180, dy: -70, contents: { main: [liquid(0.8, COLOURLESS), gas(0.8)] } })
    const psu = b.on('powerSupply', 'base', cell, 'base', { dx: 260 })
    // The wires leave the terminals under the cell and enter the supply's terminals from below, without crossing.
    const left = anchorWorld(cell, 'terminalL'),
      right = anchorWorld(cell, 'terminalR'),
      plus = anchorWorld(psu, 'plus'),
      minus = anchorWorld(psu, 'minus')
    b.connector('wire', [v(right.x, right.y), v(right.x, right.y + 18), v(plus.x, right.y + 18), v(plus.x, plus.y)])
    b.connector('wire', [v(left.x, left.y), v(left.x, left.y + 30), v(minus.x, left.y + 30), v(minus.x, minus.y)])
    b.label('hydrogen', -90, -180, [hydrogen, 0, 105])
    b.label('sodium sulfate solution', -90, -75, [cell, -50, 60])
    b.label('−', -90, -35, [cell, -32.6, 80])
    b.label('oxygen', 80, -180, [oxygen, 0, 110])
    b.label('+', 80, -35, [cell, 32.6, 80])
    b.label('power supply', 345, -85, [psu, 65, 20])
    return b.doc
  },
}

const electrolysisBeaker: TemplateDef = {
  id: 'electrolysisBeaker',
  title: 'Electrolysis in a beaker',
  group: 'Chemistry',
  refs: 'Trilogy RP 9',
  build() {
    const b = new DocBuilder('Electrolysis in a beaker')
    const beaker = b.at('beaker', 'base', P(0, 0), { contents: { main: [liquid(0.6, BLUE)] } })
    const lid = b.on('lid', 'under', beaker, 'rim', { params: { holes: 2 } })
    // A carbon rod through each hole: its top 30 u above the lid, its tip in the solution.
    const anode = b.on('electrode', 'top', lid, 'hole1', { dy: -30, h: 140 })
    const cathode = b.on('electrode', 'top', lid, 'hole2', { dy: -30, h: 140 })
    // Each clip bites the top of its rod, wire end up.
    const clipA = b.on('crocodileClip', 'jaw', anode, 'top', { rot: -90, dy: 8 })
    const clipC = b.on('crocodileClip', 'jaw', cathode, 'top', { rot: -90, dy: 8 })
    // The power supply above, its negative terminal straight above the cathode's clip.
    const psu = b.on('powerSupply', 'minus', clipC, 'tail', { dy: -60 })
    const a = anchorWorld(clipA, 'tail'),
      c = anchorWorld(clipC, 'tail'),
      plus = anchorWorld(psu, 'plus'),
      minus = anchorWorld(psu, 'minus')
    b.connector('wire', [v(a.x, a.y), v(a.x, a.y - 20), v(plus.x, a.y - 20), v(plus.x, plus.y)])
    b.connector('wire', [v(c.x, c.y), v(minus.x, minus.y)])
    b.label('lid', -100, -140, [lid, -45, 3.5])
    b.label('+', -100, -100, [anode, -4, 60])
    b.label('copper sulfate solution', -100, -40, [beaker, -42, 100])
    b.label('power supply', 100, -230, [psu, 65, 20])
    b.label('crocodile clip', 100, -150, [clipC, 0, 7])
    b.label('−', 100, -100, [cathode, 4, 60])
    return b.doc
  },
}

const temperatureChange: TemplateDef = {
  id: 'temperatureChange',
  title: 'Temperature change in a polystyrene cup',
  group: 'Chemistry',
  refs: 'Trilogy RP 10; A-level RP 2',
  build() {
    const b = new DocBuilder('Temperature change in a polystyrene cup')
    // A low beaker holds the cup steady; the cup rim stands above the beaker rim.
    const beaker = b.at('beaker', 'base', P(0, 0), { h: 90 })
    const cup = b.on('polystyreneCup', 'base', beaker, 'base', { contents: { main: [liquid(0.5, COLOURLESS)] } })
    // Through the lid hole, the bulb near the bottom of the solution.
    const thermo = b.on('thermometer', 'bulb', cup, 'base', { dy: -16, h: 200 })
    setReading(thermo, 20)
    b.label('thermometer', 90, -180, [thermo, 4.5, 40])
    b.label('lid', 90, -128, [cup, 30, -3])
    b.label('polystyrene cup', 90, -85, [cup, 38.1, 30])
    b.label('beaker', 90, -45, [beaker, 50, 50])
    b.label('solution', 90, -5, [cup, 22, 75])
    return b.doc
  },
}

const rateGasSyringe: TemplateDef = {
  id: 'rateGasSyringe',
  title: 'Rate of reaction: gas syringe',
  group: 'Chemistry',
  refs: 'Trilogy RP 11; A-level RP 7',
  build() {
    const b = new DocBuilder('Rate of reaction: gas syringe')
    const flask = b.at('conicalFlask', 'base', P(0, 0), {
      contents: { main: [lumps(0.1, GRANULES), liquid(0.3, COLOURLESS, { bubbles: 'many' })] },
    })
    const bung = b.on('bung', 'plug', flask, 'mouth')
    // The stand is to the right. Its clamp, made before the syringe so that it is drawn behind it,
    // reaches back past the plunger and grips the barrel at its open end.
    const stand = b.on('clampStand', 'base', flask, 'base', { dx: 330, h: 260 })
    const clamp = b.on('bossClamp', 'sleeve', stand, 'rod', { dy: -85, w: 100, flip: true, params: { grip: 38 } })
    const syringe = b.on('gasSyringe', 'neck', clamp, 'grip', { dx: -36, params: { plunger: 0.3 } })
    const hole = anchorWorld(bung, 'hole1'),
      nozzle = anchorWorld(syringe, 'nozzle')
    // From just below the bung, up and across into the nozzle. The tube overlaps the nozzle, so that it hides the nozzle's end.
    b.connector('glassTube', [v(hole.x, hole.y + 32), v(hole.x, nozzle.y, 12), v(nozzle.x + 8, nozzle.y)])
    const watch = b.near('stopwatch', flask, 'base', { dx: 120, dy: -33 })
    b.label('gas syringe', 130, -282, [syringe, -80, 1])
    b.label('clamp', 250, -282, [clamp, 10.8, 9.25])
    b.label('delivery tube', -90, -205, P(-3.5, -190))
    b.label('dilute hydrochloric acid', -90, -60, [flask, -30, 110])
    b.label('marble chips', -90, -20, [flask, -20, 143])
    b.label('stopwatch', 160, -40, [watch, 27, 40])
    return b.doc
  },
}

const rateGasOverWater: TemplateDef = {
  id: 'rateGasOverWater',
  title: 'Rate of reaction: gas collected over water',
  group: 'Chemistry',
  refs: 'Trilogy RP 11; A-level RP 7',
  build() {
    // As the style reference (src/demo.ts), with magnesium ribbon for the chips and the cylinder held by a clamp.
    const b = new DocBuilder('Rate of reaction: gas collected over water')
    // The acid stands at the same level as in the reference picture.
    const flask = b.at('conicalFlask', 'base', P(0, 0), { contents: { main: [liquid(0.34, COLOURLESS, { bubbles: 'few' })] } })
    const ribbon = b.near('magnesiumRibbon', flask, 'base', { dy: -9 })
    const trough = b.on('trough', 'base', flask, 'base', { dx: 310, contents: { main: [liquid(0.62, WATER)] } })
    // The stand stands to the right of the trough. Its clamp is made before the cylinder, so that its jaws are hidden inside it.
    const stand = b.symbol('clampStand', { h: 140 })
    const clamp = b.symbol('bossClamp', { w: 162, flip: true, params: { grip: 36 } })
    // Upside down: the reading at the water surface is the volume of gas collected (34 cm³).
    const cyl = b.on('measuringCylinder', 'mouth', trough, 'base', { rot: 180, h: 170, dx: 35, dy: -22 })
    const full = readingToAmount(geometry('measuringCylinder', cyl.w, cyl.h), 34, true) ?? 0.66
    cyl.contents = { main: [liquid(full, WATER), gas(full)] }
    // The clamp grips the cylinder just above the trough rim.
    const cm = anchorWorld(cyl, 'mouth')
    moveAnchorTo(clamp, 'grip', P(cm.x, cm.y - 96))
    standUnder(stand, clamp, anchorWorld(flask, 'base').y)
    b.on('bung', 'plug', flask, 'mouth')
    const mouth = anchorWorld(flask, 'mouth'),
      floor = anchorWorld(trough, 'base')
    b.connector('glassTube', [
      v(mouth.x, mouth.y + 46),
      v(mouth.x, mouth.y - 62, 14),
      v(floor.x - 90, mouth.y - 62, 14),
      v(floor.x - 90, floor.y - 30, 12),
      v(cm.x, floor.y - 30, 12),
      v(cm.x, cm.y - 36),
    ])
    const watch = b.near('stopwatch', flask, 'base', { dx: 112, dy: -33 })
    b.label('dilute HCl(aq)', -80, -68, [flask, -22, 112])
    b.label('magnesium ribbon', -80, 22, [ribbon, -18, 3.5])
    b.label('delivery tube', 100, -230, P(110, -212), { side: 'right' })
    b.label('100 cm3 measuring cylinder', 400, -215, [cyl, -28, 166])
    b.label('34 cm3 of H2', 400, -175, [cyl, 0, 150])
    b.label('trough of water', 280, 32, [trough, -54, 80], { side: 'right' })
    b.label('stopwatch', 60, 32, [watch, 0, 66])
    return b.doc
  },
}

const disappearingCross: TemplateDef = {
  id: 'disappearingCross',
  title: 'Rate of reaction: disappearing cross',
  group: 'Chemistry',
  refs: 'Trilogy RP 11; A-level RP 3',
  build() {
    const b = new DocBuilder('Rate of reaction: disappearing cross')
    const paper = b.at('crossPaper', 'top', P(0, 0))
    // The flask stands on the paper, so the cross shows in front of its base.
    const flask = b.on('conicalFlask', 'base', paper, 'top', { contents: { main: [liquid(0.35, CLOUDY_YELLOW, { cloudy: true })] } })
    // Leaning on the rim, out of the eye's line of sight, with its bulb in the solution.
    const thermo = b.on('thermometer', 'bulb', flask, 'base', { dx: -15, dy: -15, rot: 11, h: 210 })
    setReading(thermo, 20)
    b.near('eye', flask, 'mouth', { rot: 90, dy: -80 })
    const watch = b.near('stopwatch', paper, 'top', { dx: 135, dy: -16.5 })
    b.label('thermometer', -90, -230, [thermo, -4.5, 40])
    b.label('conical flask', -90, -110, [flask, -36, 95])
    b.label('sodium thiosulfate\nand acid', -90, -60, [flask, -42, 125])
    b.label('cross drawn on paper', 80, 50, [paper, 0, 21.6])
    b.label('stopwatch', 190, -20, [watch, 27, 40])
    return b.doc
  },
}

const paperChromatography: TemplateDef = {
  id: 'paperChromatography',
  title: 'Paper chromatography',
  group: 'Chemistry',
  refs: 'Trilogy RP 12',
  build() {
    const b = new DocBuilder('Paper chromatography')
    const beaker = b.at('beaker', 'base', P(0, 0), { contents: { main: [liquid(0.12, WATER)] } })
    // The paper hangs from the rod, its lower edge 8 u into the solvent and its baseline 10 u above the surface.
    const paper = b.on('chromatographyPaper', 'top', beaker, 'rim', { dy: -3, h: 117 })
    // The rod lies across the rim, in front of the top of the paper.
    const rod = b.near('stirringRod', beaker, 'rim', { rot: 90, dy: -3 })
    b.label('glass rod', -110, -150, [rod, 0, 160])
    b.label('beaker', -110, -90, [beaker, -50, 40])
    b.label('pencil line', -110, -30, [paper, -20, 99])
    b.label('solvent front', 110, -88, [paper, 20, 29.7])
    b.label('chromatography paper', 110, -48, [paper, 25, 75])
    b.label('solvent', 110, 0, [beaker, 30, 113])
    return b.doc
  },
}

const simpleDistillation: TemplateDef = {
  id: 'simpleDistillation',
  title: 'Simple distillation (test tube)',
  group: 'Chemistry',
  refs: 'Trilogy RP 13',
  build() {
    const b = new DocBuilder('Simple distillation (test tube)')
    const mat = b.at('heatproofMat', 'under', P(0, 0))
    const tripod = b.on('tripod', 'feet', mat, 'top')
    const burner = b.on('bunsenBurner', 'base', mat, 'top')
    const gauze = b.on('gauze', 'under', tripod, 'top')
    const flask = b.on('conicalFlask', 'base', gauze, 'top', { contents: { main: [lumps(0.05, GRANULES), liquid(0.3, COLOURLESS)] } })
    const bung = b.on('bung', 'plug', flask, 'mouth', { params: { holes: 2 } })
    // The bulb is just below the bung, level with the delivery-tube inlet, and not in the liquid.
    const thermo = b.on('thermometer', 'bulb', bung, 'hole1', { dy: 40, h: 170 })
    setReading(thermo, 100)
    // An ice bath on the bench beside the mat: ice packed to the surface, with a little water above it.
    const bath = b.on('beaker', 'base', mat, 'under', { dx: 230, h: 100, contents: { main: [lumps(0.55, ICE), liquid(0.05, WATER)] } })
    const tube = b.on('testTube', 'bottom', bath, 'base', { dy: -2, contents: { main: [liquid(0.2, WATER)] } })
    // Made after the bung and the test tube: through the hole, sloping down into the test tube, its end above the liquid.
    const hole = anchorWorld(bung, 'hole2'),
      mouth = anchorWorld(tube, 'mouth')
    b.connector('glassTube', [v(hole.x, hole.y + 34), v(hole.x, hole.y - 28, 14), v(mouth.x, mouth.y - 52, 14), v(mouth.x, mouth.y + 28)])
    b.label('thermometer', -110, -380, [thermo, -4.5, 40])
    b.label('conical flask', -110, -215, [flask, -28.5, 75])
    b.label('salty water', -110, -170, [flask, -30, 130])
    b.label('anti-bumping granules', -110, -130, [flask, -20, 145])
    b.label('Bunsen burner', -110, -40, [burner, -10, 94])
    b.label('delivery tube', 320, -200, [tube, 3.5, -35])
    b.label('test tube', 320, -105, [tube, 12, 15])
    b.label('pure water', 320, -60, [tube, 5, 108])
    b.label('ice and water', 320, -20, [bath, 40, 70])
    return b.doc
  },
}

const distillation: TemplateDef = {
  id: 'distillation',
  title: 'Distillation with a condenser',
  group: 'Chemistry',
  refs: 'Trilogy RP 13; A-level RP 5 and RP 10',
  build() {
    const b = new DocBuilder('Distillation with a condenser')
    // The stand for the flask stands behind the mantle; its clamp grips the neck from the left, its jaws hidden in the neck.
    const neckStand = b.symbol('clampStand', { h: 226 })
    const neckClamp = b.symbol('bossClamp', { w: 72, params: { grip: 34 } })
    const mantle = b.at('heatingMantle', 'base', P(0, 0), { h: 110 })
    const bench = anchorWorld(mantle, 'base').y
    const flask = b.on('roundBottomFlask', 'bottom', mantle, 'cup', { contents: { main: [lumps(0.05, GRANULES), liquid(0.4, COLOURLESS)] } })
    moveAnchorTo(neckClamp, 'grip', anchorWorld(flask, 'neck'))
    standUnder(neckStand, neckClamp, bench)
    const head = b.on('stillHead', 'bottom', flask, 'mouth')
    b.on('thermometerAdaptor', 'plug', head, 'top')
    // The bulb's centre (8 u above its tip) is level with the side arm, 39 u below the socket mouth.
    const thermo = b.on('thermometer', 'bulb', head, 'top', { dy: 47, h: 150 })
    setReading(thermo, 100)
    // The second stand stands behind the condenser; its clamp grips the jacket at the middle.
    const condStand = b.symbol('clampStand', { h: 280 })
    const condClamp = b.symbol('bossClamp', { w: 76, rot: 18, params: { grip: 38 } })
    const condenser = b.on('liebigCondenser', 'socket', head, 'arm', { rot: 18, contents: { jacket: [liquid(1, WATER)] } })
    moveAnchorTo(condClamp, 'grip', P(condenser.x, condenser.y))
    standUnder(condStand, condClamp, bench)
    // The receiving flask is made before the adaptor, so that the outlet shows inside its neck. It has no bung: its mouth is the one opening.
    // It stands on the bench under the outlet; at 95 u high the outlet reaches 20 u down its neck.
    const collect = b.symbol('conicalFlask', { w: 80, h: 95, contents: { main: [liquid(0.15, COLOURLESS)] } })
    const receiver = b.on('receiverAdaptor', 'in', condenser, 'cone')
    moveAnchorTo(collect, 'base', P(anchorWorld(receiver, 'out').x, bench))
    // Water in at the lower port and out at the upper port: an arrow along each port's direction.
    const flow = (port: string, inward: boolean) => {
      const p = anchorWorld(condenser, port),
        a = (((anchorOf(condenser, port).dir ?? 0) + condenser.rot) * Math.PI) / 180
      const ends = [v(p.x + 45 * Math.cos(a), p.y + 45 * Math.sin(a)), v(p.x + 6 * Math.cos(a), p.y + 6 * Math.sin(a))]
      b.connector('line', inward ? ends : ends.reverse(), { endCap: 'arrow' })
    }
    flow('waterIn', true)
    flow('waterOut', false)
    b.label('water in', 245, -92)
    b.label('water out', 130, -318)
    b.label('thermometer', -90, -380, [thermo, -4.5, 40])
    b.label('round-bottomed flask', -90, -140, [flask, -53, 80])
    b.label('anti-bumping granules', -90, -90, [flask, -8, 145])
    b.label('heating mantle', -90, -30, [mantle, -55, 80])
    b.label('Liebig condenser', 300, -290, [condenser, 60, 18])
    b.label('distillate', 480, -30, [collect, 15, 92])
    return b.doc
  },
}

export const chemistry: TemplateDef[] = [
  filtration,
  crystallisation,
  electrolysis,
  electrolysisBeaker,
  temperatureChange,
  rateGasSyringe,
  rateGasOverWater,
  disappearingCross,
  paperChromatography,
  simpleDistillation,
  distillation,
]
