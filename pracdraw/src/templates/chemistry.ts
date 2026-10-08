// chemistry.ts — templates of the group "Chemistry". Each one follows its row in the Templates tab (spec/templates.json).
// Copy the pattern of heatingBeaker in general.ts: place parts with DocBuilder.at, .on and .near.

import { P, v } from '../kernel/geom'
import type { Layer } from '../kernel/contents'
import { DocBuilder, anchorOf, anchorWorld, moveAnchorTo } from '../model/build'
import { toWorld } from '../model/transform'
import type { Doc, SymbolItem } from '../model/types'
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
    // The stand and its clamp are made first, so that they are drawn behind the syringe and the tube, and placed once those are.
    const stand = b.symbol('clampStand', { w: 100 })
    const clamp = b.symbol('bossClamp', { w: 80, params: { grip: 38 } }) // the jaws touch the 34 u barrel
    const flask = b.at('conicalFlask', 'base', P(0, 0), {
      contents: { main: [lumps(0.1, GRANULES), liquid(0.3, COLOURLESS, { bubbles: 'many' })] },
    })
    const bung = b.on('bung', 'plug', flask, 'mouth')
    const hole = anchorWorld(bung, 'hole1')
    const syringe = b.at('gasSyringe', 'nozzle', P(hole.x + 120, hole.y - 105), { params: { plunger: 0.3 } })
    // The clamp grips the barrel at its closed end, from the nozzle side: its stand rises left of the nozzle, behind the
    // delivery tube, so nothing is in the plunger's path as it moves out.
    moveAnchorTo(clamp, 'grip', toWorld(syringe, P(-78, 18)))
    stand.h = Math.round(-(toWorld(syringe, P(0, 1)).y - 25)) // the bench is at y = 0; the rod ends 25 u above the barrel
    standUnder(stand, clamp, 0)
    const nozzle = anchorWorld(syringe, 'nozzle')
    // From just below the bung, up and across into the nozzle. The tube runs 12 u into the nozzle, so that its white body hides
    // the nozzle's end and the end of the clamp's arm, and the gas path shows open.
    b.connector('glassTube', [v(hole.x, hole.y + 32), v(hole.x, nozzle.y, 12), v(nozzle.x + 12, nozzle.y)])
    const watch = b.near('stopwatch', flask, 'base', { dx: 330, dy: -33 })
    const top = toWorld(syringe, P(0, 1)).y
    b.label('clamp', nozzle.x - 20, top - 40, [clamp, 20, 1]) // the upper jaw, on the barrel's top wall
    b.label('gas syringe', nozzle.x + 110, top - 40, [syringe, -40, 1])
    b.label('clamp stand', nozzle.x + 60, -60, [stand, -26, stand.h * 0.8])
    b.label('delivery tube', -90, -205, P(-3.5, -190))
    b.label('dilute hydrochloric acid', -90, -60, [flask, -30, 110])
    b.label('marble chips', -90, -20, [flask, -20, 143])
    b.label('stopwatch', 400, -40, [watch, 27, 40])
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
    // Water in at the lower port and out at the upper port, labelled as in the reference picture: the "water in" leader ends in an arrow.
    // Left of its port: in blank mode its line (184 to 284) clears the stand's rod (x 171) and the receiving flask.
    b.label('water in', 284, -92, [condenser, 83, 66], { leaderEnd: 'arrow' })
    b.label('water out', 130, -318, [condenser, -83, 4])
    b.label('thermometer', -90, -380, [thermo, -4.5, 40])
    b.label('round-bottomed flask', -90, -140, [flask, -53, 80])
    b.label('anti-bumping granules', -90, -90, [flask, -14.5, 145]) // the centre of the left-hand granule
    b.label('heating mantle', -90, -30, [mantle, -55, 80])
    b.label('Liebig condenser', 300, -290, [condenser, 60, 18])
    b.label('distillate', 480, -30, [collect, 15, 92])
    return b.doc
  },
}

// ---------------------------------------------------------------- the second half of the group

/** Preset colours from section 9 of the specification. */
const c2Preset = {
  water: '#cfe8f7',
  colourless: '#e9f1f5',
  blue: '#7fb8e6',
  paleGreen: '#cfe8c4',
  yellow: '#f5e58a',
  pink: '#f2a7c3',
  oil: '#f3d9a8',
  whitePowder: '#f1f1f1',
  greenPowder: '#9fcfae',
  orangeBrownPrecipitate: '#c9824a',
  granules: '#e9e9e9',
}
/** The liquid in a thermometer (section 9: the Reading field fills a thermometer with it). */
const c2Thread = '#d33333'
/** Height of the base plate of a clamp stand: a part that stands on the plate sits this far above the bench. */
const c2Plate = 9

const c2Liquid = (amount: number, colour: string, extra: Partial<Layer> = {}): Layer => ({ kind: 'liquid', amount, colour, ...extra })
const c2Powder = (amount: number, colour: string): Layer => ({ kind: 'powder', amount, colour })

/** A burette at an exact reading, with a meniscus. */
function c2FillBurette(burette: SymbolItem, reading: number, colour: string): void {
  const amount = readingToAmount(geometry('burette', burette.w, burette.h, burette.params), reading) ?? 0.9
  burette.contents = { main: [c2Liquid(amount, colour, { meniscus: true })] }
}

/**
 * Stand a clamp stand under a clamp: its rod through the boss, its base on the bench at `benchY`.
 * The stand is made first, so that it is drawn behind everything, and placed here once the clamp is.
 */
function c2Stand(stand: SymbolItem, clamp: SymbolItem, benchY: number): void {
  moveAnchorTo(stand, 'rod', anchorWorld(clamp, 'sleeve'))
  moveAnchorTo(stand, 'base', P(anchorWorld(stand, 'base').x, benchY))
}

/** Draw a clamp behind what it grips, so that its jaws meet the walls and do not cross the glass. */
function c2Behind(doc: Doc, clamp: SymbolItem, item: SymbolItem): void {
  doc.order = doc.order.filter((id) => id !== clamp.id)
  doc.order.splice(doc.order.indexOf(item.id), 0, clamp.id)
}

const titration: TemplateDef = {
  id: 'titration',
  title: 'Titration',
  group: 'Chemistry',
  refs: 'A-level RP 1; GCSE Chemistry RP 2',
  build() {
    const b = new DocBuilder('Titration')
    const stand = b.symbol('clampStand', { w: 200, h: 460 })
    const tile = b.at('tile', 'under', P(0, 0))
    const flask = b.on('conicalFlask', 'base', tile, 'top', { contents: { main: [c2Liquid(0.2, c2Preset.pink)] } })
    // The jet is 15 u down the neck, well above the liquid.
    const burette = b.on('burette', 'tip', flask, 'mouth', { dy: 15 })
    c2FillBurette(burette, 0, c2Preset.colourless)
    const clamp = b.on('bossClamp', 'grip', burette, 'neck', { params: { grip: 18 } })
    c2Behind(b.doc, clamp, burette)
    c2Stand(stand, clamp, anchorWorld(tile, 'under').y + c2Plate) // the tile stands on the base plate
    b.label('burette', 120, -423, [burette, 9, 55])
    // The clamp is behind the burette, so its label points at the boss, from the left.
    b.label('clamp', -135, anchorWorld(clamp, 'sleeve').y + 5, [clamp, -55, 20])
    b.label('acid', 120, -298, [burette, 0, 180])
    b.label('clamp stand', -135, -250, [stand, -79, 196])
    b.label('conical flask', 120, -88, [flask, 31, 80])
    b.label('alkali and indicator', 120, -45, [flask, 30, 130])
    b.label('white tile', 120, -5, [tile, 75, 4])
    return b.doc
  },
}

const flameTest: TemplateDef = {
  id: 'flameTest',
  title: 'Flame test',
  group: 'Chemistry',
  refs: 'GCSE Chemistry RP 7',
  build() {
    const b = new DocBuilder('Flame test')
    const mat = b.at('heatproofMat', 'under', P(0, 0), { w: 270 })
    // The burner is drawn 1.75 times its size, so that the loop (a fixed 8 u) is small beside the flame, as it is in the lab.
    const k = 1.75
    const burner = b.on('bunsenBurner', 'base', mat, 'top', { w: 60 * k, h: 124 * k })
    // The loop is held in the left edge of the blue flame: level with the tip of the dark inner cone, between the cone and the edge.
    // The handle is higher than the loop, as a hand holds it.
    const loop = b.on('flameTestLoop', 'loop', burner, 'flame', { w: 170, rot: 8, dx: -4 * k, dy: 20 * k })
    // The leaders end on the circle of the loop (radius 4, 45 degrees up and left of its centre) and on the top edge of the handle (8 u thick).
    const eye = anchorOf(loop, 'loop')
    b.label('nichrome wire loop', -205, -272, [loop, eye.x - 2.8, eye.y - 2.8])
    b.label('handle', -205, -232, [loop, -0.3 * loop.w, eye.y - 4])
    b.label('heatproof mat', -205, -30, [mat, -100, 4])
    b.label('blue flame', 60, -200, [burner, 3.5 * k, 17 * k])
    b.label('Bunsen burner', 60, -160, [burner, 7 * k, 100])
    return b.doc
  },
}

const standardSolution: TemplateDef = {
  id: 'standardSolution',
  title: 'Making a standard solution',
  group: 'Chemistry',
  refs: 'A-level RP 1',
  build() {
    const b = new DocBuilder('Making a standard solution')
    const flask = b.at('volumetricFlask', 'base', P(0, 0), { contents: { main: [c2Liquid(0.36, c2Preset.colourless)] } })
    // The stem ends 25 u down the neck, above the graduation mark.
    const funnel = b.on('filterFunnel', 'stem', flask, 'mouth', { dy: 25 })
    const bottle = b.on('washBottle', 'base', flask, 'base', { dx: 130, contents: { main: [c2Liquid(0.6, c2Preset.water)] } })
    const beaker = b.on('beaker', 'base', flask, 'base', { dx: 255, w: 90, h: 100 })
    b.label('funnel', -100, -270, [funnel, -30, 20])
    b.label('graduation mark', -100, -165, [flask, -9, 42])
    b.label('volumetric flask', -100, -80, [flask, -48, 165])
    b.label('solution', -100, -35, [flask, -20, 190])
    b.label('wash bottle', 350, -125, [bottle, 14, 30])
    b.label('beaker', 350, -50, [beaker, 45, 50])
    return b.doc
  },
}

const spiritBurnerCalorimetry: TemplateDef = {
  id: 'spiritBurnerCalorimetry',
  title: 'Enthalpy of combustion',
  group: 'Chemistry',
  refs: 'A-level RP 2',
  build() {
    const b = new DocBuilder('Enthalpy of combustion')
    // The stand and its clamp are made first, so that they are drawn behind the can, and placed once it is.
    const stand = b.symbol('clampStand', { w: 90 })
    const clamp = b.symbol('bossClamp', { w: 160, params: { grip: 60 } }) // the jaws open as wide as the can
    const mat = b.at('heatproofMat', 'under', P(0, 0), { w: 100 })
    const bench = anchorWorld(mat, 'under').y // the mat and the stand's base plate stand on the bench
    const burner = b.on('spiritBurner', 'base', mat, 'top', { contents: { main: [liquid(0.5, COLOURLESS)] } })
    // The can's base is at the tip of the flame, so the flame touches it.
    const can = b.on('copperCalorimeter', 'base', burner, 'flame', { w: 60, h: 90, contents: { main: [liquid(0.6, WATER)] } })
    // The clamp grips the can's wall near its mouth, from the left. Its jaws are 60 u apart, so their centre is 34 u below the rim:
    // then the upper jaw is inside the can, behind its wall, and does not close the top.
    const mouth = anchorWorld(can, 'mouth')
    moveAnchorTo(clamp, 'grip', P(mouth.x, mouth.y + 34))
    stand.h = Math.round(bench - (anchorWorld(clamp, 'sleeve').y - 40)) // the rod ends 40 u above the clamp
    standUnder(stand, clamp, bench)
    // The bulb is well below the surface, 14 u above the base of the can.
    const thermo = b.on('thermometer', 'bulb', can, 'base', { dx: 12, dy: -14, h: 170 })
    setReading(thermo, 20)
    b.label('thermometer', 90, -195, [thermo, 4.5, 63])
    b.label('copper can', 90, -155, [can, 30, 14])
    b.label('water', 90, -115, [can, 22, 62])
    b.label('flame', 90, -75, [burner, 3, 14])
    b.label('spirit burner', 90, -35, [burner, 36, 56])
    b.label('heatproof mat', 90, 1, [mat, 42, 4])
    // The boss is at the left end of the clamp; the stand's rod is 6 u wide.
    b.label('clamp', -170, -150, [clamp, -clamp.w / 2, 20])
    b.label('clamp stand', -170, -105, [stand, anchorOf(stand, 'rod').x - 3, 100])
    return b.doc
  },
}

const reflux: TemplateDef = {
  id: 'reflux',
  title: 'Heating under reflux',
  group: 'Chemistry',
  refs: 'A-level RP 10',
  build() {
    const b = new DocBuilder('Heating under reflux')
    // The rod stops below the water inlet, so that the "water in" leader passes over it.
    const stand = b.symbol('clampStand', { w: 200, h: 225 })
    const mantle = b.at('heatingMantle', 'base', P(0, 0), { w: 150 })
    const flask = b.on('roundBottomFlask', 'bottom', mantle, 'cup', {
      contents: { main: [{ kind: 'lumps', amount: 0.05, colour: c2Preset.granules }, c2Liquid(0.4, c2Preset.colourless)] },
    })
    // Upright: the cone (the lower end) seats in the flask neck, and the socket at the top is the one opening.
    // With rot 90 the lower water port faces left and the upper one faces right.
    const condenser = b.on('liebigCondenser', 'cone', flask, 'mouth', { rot: 90, contents: { jacket: [c2Liquid(1, c2Preset.water)] } })
    const clamp = b.on('bossClamp', 'grip', flask, 'neck', { w: 120, params: { grip: 34 } })
    c2Behind(b.doc, clamp, flask)
    c2Stand(stand, clamp, anchorWorld(mantle, 'base').y + c2Plate) // the mantle stands on the base plate
    b.label('open to the air:\nthe only opening', 120, -455, [condenser, -145, 35])
    b.label('water out', 120, -384, [condenser, -83, 4])
    b.label('Liebig condenser', 120, -301, [condenser, 0, 18])
    b.label('water in', -130, -240, [condenser, 83, 66], { leaderEnd: 'arrow' })
    b.label('round-bottomed flask', 120, -127, [flask, 35.5, 53])
    b.label('reaction mixture', 120, -90, [flask, 35, 89])
    b.label('anti-bumping granules', 120, -45, [flask, 13, 145]) // the centre of the right-hand granule
    b.label('heating mantle', 120, -5, [mantle, 75, 80])
    return b.doc
  },
}

const separatingFunnelUse: TemplateDef = {
  id: 'separatingFunnelUse',
  title: 'Separating two liquids',
  group: 'Chemistry',
  refs: 'A-level RP 10',
  build() {
    const b = new DocBuilder('Separating two liquids')
    const stand = b.symbol('clampStand', { w: 180, h: 420 })
    const beaker = b.at('beaker', 'base', P(0, 0))
    // The stem ends 20 u below the beaker rim. The aqueous layer is the lower one.
    const funnel = b.on('separatingFunnel', 'stem', beaker, 'mouth', {
      dy: 20,
      params: { stopper: false },
      contents: { main: [c2Liquid(0.35, c2Preset.water), c2Liquid(0.25, c2Preset.oil)] },
    })
    const clamp = b.on('bossClamp', 'grip', funnel, 'neck', { dy: 2, params: { grip: 22 } }) // 2 u down: its upper jaw stays inside the open mouth
    c2Behind(b.doc, clamp, funnel)
    c2Stand(stand, clamp, anchorWorld(beaker, 'base').y + c2Plate) // the beaker stands on the base plate
    // The clamp is behind the funnel, so its label points at the boss, from the left.
    b.label('clamp', -135, anchorWorld(clamp, 'sleeve').y + 5, [clamp, -55, 20])
    b.label('separating funnel', 110, -289, [funnel, 28, 55.6])
    b.label('organic layer', 110, -250, [funnel, 14, 95])
    b.label('aqueous layer', 110, -212, [funnel, 12, 130])
    b.label('tap', 110, -163, [funnel, 24, 182])
    b.label('beaker', 110, -55, [beaker, 50, 60])
    b.label('clamp stand', -135, -250, [stand, -69, 156])
    return b.doc
  },
}

const buchnerFiltration: TemplateDef = {
  id: 'buchnerFiltration',
  title: 'Filtration under reduced pressure',
  group: 'Chemistry',
  refs: 'A-level RP 10',
  build() {
    const b = new DocBuilder('Filtration under reduced pressure')
    const flask = b.at('buchnerFlask', 'base', P(0, 0), { contents: { main: [c2Liquid(0.15, c2Preset.colourless)] } })
    const bung = b.on('bung', 'plug', flask, 'mouth')
    // The stem passes through the bung hole, and the cone rests on the bung.
    const funnel = b.on('buchnerFunnel', 'stem', bung, 'hole1', { dy: 40, contents: { main: [c2Powder(0.25, c2Preset.whitePowder)] } })
    const arm = anchorWorld(flask, 'sideArm')
    b.connector('rubberTube', [v(arm.x - 4, arm.y), v(arm.x + 70, arm.y)])
    b.label('to pump', arm.x + 78, arm.y + 5)
    b.label('Büchner funnel', -100, -250, [funnel, -50, 10])
    b.label('crystals', -100, -210, [funnel, -30, 39])
    b.label('filter paper', -100, -170, [funnel, -48, 42])
    b.label('bung', -100, -130, [bung, -17, 12])
    b.label('Büchner flask', -100, -90, [flask, -40, 90])
    b.label('filtrate', -100, -30, [flask, -20, 140])
    return b.doc
  },
}

const meltingPoint: TemplateDef = {
  id: 'meltingPoint',
  title: 'Measuring a melting point',
  group: 'Chemistry',
  refs: 'A-level RP 10',
  build() {
    const b = new DocBuilder('Measuring a melting point')
    const apparatus = b.at('meltingPointApparatus', 'base', P(0, 0))
    // Both stand at the bottom of their holes in the heating block, 27 u deep.
    const thermo = b.on('thermometer', 'bulb', apparatus, 'thermo', { dy: 27 })
    thermo.contents = { main: [c2Liquid(readingToAmount(geometry('thermometer', thermo.w, thermo.h), 80) ?? 0.7, c2Thread)] }
    const capillary = b.on('capillaryTube', 'tip', apparatus, 'sample', { dy: 27 })
    b.label('thermometer', -110, -245, [thermo, -4.5, 75])
    b.label('magnifying lens', -110, -44, [apparatus, -40.6, 101.5])
    b.label('capillary tube', 110, -170, [capillary, 2.5, 30])
    b.label('heating block', 110, -115, [apparatus, 32.5, 30])
    b.label('melting point apparatus', 110, -55, [apparatus, 65, 90])
    return b.doc
  },
}

const tlc: TemplateDef = {
  id: 'tlc',
  title: 'Thin-layer chromatography',
  group: 'Chemistry',
  refs: 'A-level RP 12',
  build() {
    const b = new DocBuilder('Thin-layer chromatography')
    const beaker = b.at('beaker', 'base', P(0, 0), { contents: { main: [c2Liquid(0.1, c2Preset.colourless)] } })
    // Turned 10 degrees: the lower right corner is on the floor and the upper right corner leans on the wall.
    const plate = b.near('chromatographyPaper', beaker, 'base', { dx: 16.6, dy: -50.2, rot: 10, h: 90, params: { plate: true } })
    const lid = b.on('watchGlass', 'edge', beaker, 'rim')
    b.label('watch glass', 110, -135, [lid, 55, 0])
    b.label('TLC plate', -110, -95, [plate, -25, 10])
    b.label('solvent front', -110, -60, [plate, -25, 22])
    b.label('baseline', -110, -25, [plate, -25, 72])
    b.label('solvent', 110, -5, [beaker, 45, 115])
    b.label('beaker', 110, -60, [beaker, 50, 60])
    return b.doc
  },
}

const electrochemicalCell: TemplateDef = {
  id: 'electrochemicalCell',
  title: 'Electrochemical cell',
  group: 'Chemistry',
  refs: 'A-level RP 8',
  build() {
    const b = new DocBuilder('Electrochemical cell')
    const strip = { kind: 'strip', material: 'metal' }
    const left = b.at('beaker', 'base', P(0, 0), { contents: { main: [c2Liquid(0.6, c2Preset.colourless)] } })
    const right = b.on('beaker', 'base', left, 'base', { dx: 190, contents: { main: [c2Liquid(0.6, c2Preset.blue)] } })
    const zinc = b.on('electrode', 'tip', left, 'base', { dx: -22, dy: -14, h: 150, params: strip })
    const copper = b.on('electrode', 'tip', right, 'base', { dx: 22, dy: -14, h: 150, params: strip })
    // Each end of the bridge dips 25 u into a solution.
    const bridge = b.on('saltBridge', 'endL', left, 'base', { dx: 17, dy: -45, h: 100, contents: { main: [c2Liquid(1, c2Preset.colourless)] } })
    const za = anchorWorld(zinc, 'top'),
      cu = anchorWorld(copper, 'top')
    const meter = b.at('instrumentBox', 'base', P((za.x + cu.x) / 2, za.y - 75), { params: { title: 'voltmeter', reading: '1.10 V', terminals: '2' } })
    const ta = anchorWorld(meter, 'a'),
      tb = anchorWorld(meter, 'b'),
      yw = za.y - 30
    b.connector('wire', [v(za.x, za.y), v(za.x, yw, 10), v(ta.x, yw, 10), v(ta.x, ta.y)])
    b.connector('wire', [v(cu.x, cu.y), v(cu.x, yw, 10), v(tb.x, yw, 10), v(tb.x, tb.y)])
    b.label('zinc', -80, -144, [zinc, -8, 15])
    b.label('zinc sulfate solution', -80, -25, [left, -45, 90])
    // The bridge's top faces the inside of the circuit, so its label sits there: a leader from a side column would cross an electrode or a wire.
    b.label('salt bridge', 55, -165, [bridge, -45, 0])
    b.label('voltmeter', 265, -274, [meter, 65, 40])
    b.label('copper', 265, -144, [copper, 8, 15])
    b.label('copper sulfate solution', 265, -25, [right, 45, 90])
    return b.doc
  },
}

const phCurve: TemplateDef = {
  id: 'phCurve',
  title: 'pH curve',
  group: 'Chemistry',
  refs: 'A-level RP 9',
  build() {
    const b = new DocBuilder('pH curve')
    const stand = b.symbol('clampStand', { w: 200, h: 480 })
    const stirrer = b.at('hotPlate', 'base', P(0, 0), { params: { stirrer: true } })
    const beaker = b.on('beaker', 'base', stirrer, 'top', { contents: { main: [c2Liquid(0.5, c2Preset.colourless)] } })
    const bar = b.near('stirBar', beaker, 'base', { dy: -5 })
    // The jet is 10 u inside the beaker mouth.
    const burette = b.on('burette', 'tip', beaker, 'mouth', { dy: 10 })
    c2FillBurette(burette, 0, c2Preset.colourless)
    const clamp = b.on('bossClamp', 'grip', burette, 'neck', { params: { grip: 18 } })
    c2Behind(b.doc, clamp, burette)
    c2Stand(stand, clamp, anchorWorld(stirrer, 'base').y + c2Plate) // the stirrer stands on the base plate
    // The probe stands clear of the stirrer bar, at the left of the beaker.
    const probe = b.on('probe', 'tip', beaker, 'base', { dx: -28, dy: -16 })
    const meter = b.on('instrumentBox', 'base', stand, 'base', { dx: -190, params: { reading: '2.87' } }) // 0.1 mol/dm3 ethanoic acid, before any alkali
    const pt = anchorWorld(probe, 'top'),
      mb = anchorWorld(meter, 'base'),
      yw = pt.y - 25
    b.connector('wire', [v(pt.x, pt.y), v(pt.x, yw, 12), v(mb.x, yw, 12), v(mb.x, mb.y - meter.h)])
    b.label('burette', 120, -437, [burette, 9, 70])
    // The clamp is behind the burette, so its label points at the boss, from the left.
    b.label('clamp', -300, anchorWorld(clamp, 'sleeve').y + 5, [clamp, -55, 20])
    // This leader passes under the burette jet and over the liquid.
    b.label('pH probe', 120, -143, [probe, 4, 80])
    b.label('acid', 120, -99, [beaker, 30, 78])
    b.label('stirrer bar', 120, -62, [bar, 15, 4])
    b.label('magnetic stirrer', 120, -22, [stirrer, 75, 35])
    b.label('clamp stand', -300, -346, [stand, -79, 120])
    b.label('pH meter', -300, -26, [meter, -65, 40])
    return b.doc
  },
}

const massLoss: TemplateDef = {
  id: 'massLoss',
  title: 'Rate of reaction: loss of mass',
  group: 'Chemistry',
  refs: 'A-level RP 7',
  build() {
    const b = new DocBuilder('Rate of reaction: loss of mass')
    const balance = b.at('balance', 'base', P(0, 0), { params: { reading: '146.38 g' } })
    // The same contents as the gas syringe set-up: chips at the bottom, acid above them, bubbles rising in it.
    const flask = b.on('conicalFlask', 'base', balance, 'pan', { contents: { main: [lumps(0.1, GRANULES), liquid(0.3, COLOURLESS, { bubbles: 'many' })] } })
    // The plug seats in the neck like a bung: 40 % of it above the rim. The gas leaves through it, so the flask is open.
    const plug = b.on('cottonWool', 'plug', flask, 'mouth')
    const watch = b.near('stopwatch', balance, 'base', { dx: 150, dy: -33 })
    b.label('cotton wool plug', -105, -210, [plug, -12, 5]) // inside the upper left bump of the cloud, above the rim
    b.label('conical flask', -105, -170, [flask, -31, 80])
    b.label('dilute hydrochloric acid', -105, -130, [flask, -28, 100])
    b.label('marble chips', -105, -90, [flask, -20, 143])
    b.label('top-pan balance', -105, -45, [balance, -80.5, 22])
    b.label('stopwatch', 230, -20, [watch, 27, 40])
    return b.doc
  },
}

const testTubeReactions: TemplateDef = {
  id: 'testTubeReactions',
  title: 'Test-tube reactions',
  group: 'Chemistry',
  refs: 'A-level RP 4, RP 6 and RP 11; Trilogy RP 3',
  build() {
    const b = new DocBuilder('Test-tube reactions')
    const rack = b.at('testTubeRack', 'base', P(0, 0), { w: 200, params: { holes: 4 } })
    const fills: Layer[][] = [
      [c2Powder(0.12, c2Preset.orangeBrownPrecipitate), c2Liquid(0.3, c2Preset.colourless)],
      [c2Liquid(0.4, c2Preset.blue)],
      [c2Liquid(0.4, c2Preset.paleGreen)],
      [c2Liquid(0.4, c2Preset.yellow)],
    ]
    const tubes = fills.map((main, i) => b.on('testTube', 'bottom', rack, `slot${i + 1}`, { contents: { main } }))
    // The dropper tip is 12 u above the mouth of the last tube.
    const dropper = b.on('dropper', 'tip', tubes[3], 'mouth', { dy: -12, contents: { main: [c2Liquid(0.4, c2Preset.colourless)] } })
    b.label('test tube', -130, -103, [tubes[0], -12, 20])
    b.label('test-tube rack', -130, -63, [rack, -100, 22])
    b.label('precipitate', -130, -11, [tubes[0], -6, 112])
    b.label('dropping pipette', 130, -220, [dropper, 8, 15])
    return b.doc
  },
}

const thermalDecomposition: TemplateDef = {
  id: 'thermalDecomposition',
  title: 'Heating a solid and testing the gas',
  group: 'Chemistry',
  refs: 'General',
  build() {
    const b = new DocBuilder('Heating a solid and testing the gas')
    const stand = b.symbol('clampStand', { w: 150, h: 300 })
    const mat = b.at('heatproofMat', 'under', P(0, 0), { w: 90 })
    const burner = b.on('bunsenBurner', 'base', mat, 'top')
    // Turned 80 degrees: the mouth is 10 degrees higher than the closed end, whose underside is just above the flame.
    const tube = b.on('boilingTube', 'bottom', burner, 'flame', {
      rot: 80,
      h: 180,
      dx: -16.7,
      dy: -17,
      contents: { main: [c2Powder(0.15, c2Preset.greenPowder)] },
    })
    const bung = b.on('bung', 'plug', tube, 'mouth', { rot: 80 })
    // The clamp grips the neck, near the mouth. It is turned with the tube, so its jaws lie along the walls, and it is drawn
    // behind the tube with its stand, as the condenser's clamp in distillation.
    const clamp = b.on('bossClamp', 'grip', tube, 'neck', { w: 76, rot: -10, params: { grip: 38 } })
    c2Behind(b.doc, clamp, tube)
    c2Stand(stand, clamp, anchorWorld(mat, 'under').y)
    // The rack stands on the bench 15 u to the right of the stand's base plate (75 + 15 + 60).
    const rack = b.on('testTubeRack', 'base', stand, 'base', { dx: 150, w: 120, params: { holes: 3 } })
    const limewater = b.on('testTube', 'bottom', rack, 'slot3', { contents: { main: [c2Liquid(0.5, c2Preset.colourless, { bubbles: 'few' })] } })
    // The delivery tube starts just inside the boiling tube, leaves through the bung hole, and ends deep in the limewater.
    const inside = toWorld(bung, P(0, 34)),
      out = toWorld(bung, P(0, -14)),
      lw = anchorWorld(limewater, 'mouth'),
      lb = anchorWorld(limewater, 'bottom')
    b.connector('glassTube', [v(inside.x, inside.y), v(out.x, out.y, 12), v(lw.x, out.y, 12), v(lw.x, lb.y - 6)]) // the outlet is below every bubble: gas leaves it and rises
    b.label('clamp', -80, -270, [clamp, 20, 1]) // the upper jaw
    b.label('boiling tube', -80, -230, [tube, -17, 120])
    b.label('copper carbonate', -80, -190, [tube, 12, 167])
    b.label('Bunsen burner', -80, -52, [burner, -7, 75])
    b.label('heatproof mat', -80, 1, [mat, -45, 4])
    b.label('bung', 370, -200, [bung, -14, 3])
    // A connector cannot hold a label, so this leader ends on a free point: the outer wall of the tube, half-way down to the test tube.
    const wall = P(lw.x + 3.5, (out.y + lw.y) / 2)
    b.label('delivery tube', 370, wall.y + 5, wall)
    b.label('limewater', 370, -53, [limewater, 10, 70])
    b.label('test-tube rack', 370, -15, [rack, 60, 70])
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
  titration,
  flameTest,
  standardSolution,
  spiritBurnerCalorimetry,
  reflux,
  separatingFunnelUse,
  buchnerFiltration,
  meltingPoint,
  tlc,
  electrochemicalCell,
  phCurve,
  massLoss,
  testTubeReactions,
  thermalDecomposition,
]
