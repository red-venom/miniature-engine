// chemistry2.ts — the second half of the "Chemistry" group, drafted in parallel with chemistry.ts.
// The lead folds this file into chemistry.ts when both are merged. Every top-level name that is not a template starts with c2.

import { P, v } from '../kernel/geom'
import type { Layer } from '../kernel/contents'
import { DocBuilder, anchorWorld, moveAnchorTo } from '../model/build'
import { toWorld } from '../model/transform'
import type { SymbolItem } from '../model/types'
import { geometry } from '../symbols/registry'
import { readingToAmount } from '../symbols/scale'
import type { TemplateDef } from './types'

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
    c2Stand(stand, clamp, anchorWorld(tile, 'under').y + c2Plate) // the tile stands on the base plate
    b.label('burette', 120, -423, [burette, 9, 55])
    b.label('clamp', 120, -383, [clamp, 55, 11])
    b.label('acid', 120, -298, [burette, 0, 180])
    b.label('clamp stand', -135, -250, [stand, -79, 196])
    b.label('conical flask', 120, -88, [flask, 31, 80])
    b.label('alkali and indicator', 120, -45, [flask, 30, 130])
    b.label('white tile', 120, -5, [tile, 75, 4])
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
    // Granules 0.06, not 0.05: a lumps layer under 7.5 u deep draws no lumps, and 0.05 of this flask is 7.4 u.
    const flask = b.on('roundBottomFlask', 'bottom', mantle, 'cup', {
      contents: { main: [{ kind: 'lumps', amount: 0.06, colour: c2Preset.granules }, c2Liquid(0.4, c2Preset.colourless)] },
    })
    // Upright: the cone (the lower end) seats in the flask neck, and the socket at the top is the one opening.
    // With rot 90 the lower water port faces left and the upper one faces right.
    const condenser = b.on('liebigCondenser', 'cone', flask, 'mouth', { rot: 90, contents: { jacket: [c2Liquid(1, c2Preset.water)] } })
    const clamp = b.on('bossClamp', 'grip', flask, 'neck', { w: 120, params: { grip: 34 } })
    c2Stand(stand, clamp, anchorWorld(mantle, 'base').y + c2Plate) // the mantle stands on the base plate
    b.label('open to the air:\nthe only opening', 120, -455, [condenser, -145, 35])
    b.label('water out', 120, -384, [condenser, -83, 4])
    b.label('Liebig condenser', 120, -301, [condenser, 0, 18])
    b.label('water in', -130, -240, [condenser, 83, 66], { leaderEnd: 'arrow' })
    b.label('round-bottomed flask', 120, -127, [flask, 35.5, 53])
    b.label('reaction mixture', 120, -90, [flask, 35, 89])
    b.label('anti-bumping granules', 120, -45, [flask, 5, 145])
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
    const clamp = b.on('bossClamp', 'grip', funnel, 'neck', { params: { grip: 22 } })
    c2Stand(stand, clamp, anchorWorld(beaker, 'base').y + c2Plate) // the beaker stands on the base plate
    b.label('clamp', 110, -344, [clamp, 55, 9])
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
    c2Stand(stand, clamp, anchorWorld(stirrer, 'base').y + c2Plate) // the stirrer stands on the base plate
    // The probe stands clear of the stirrer bar, at the left of the beaker.
    const probe = b.on('probe', 'tip', beaker, 'base', { dx: -28, dy: -16 })
    const meter = b.on('instrumentBox', 'base', stand, 'base', { dx: -190 })
    const pt = anchorWorld(probe, 'top'),
      mb = anchorWorld(meter, 'base'),
      yw = pt.y - 25
    b.connector('wire', [v(pt.x, pt.y), v(pt.x, yw, 12), v(mb.x, yw, 12), v(mb.x, mb.y - meter.h)])
    b.label('burette', 120, -437, [burette, 9, 70])
    b.label('clamp', 120, -396, [clamp, 55, 29])
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
    // The clamp grips the neck, near the mouth, and is drawn in front of the tube; its stand rises behind the tube.
    const clamp = b.on('bossClamp', 'grip', tube, 'neck', { w: 70, params: { grip: 34 } })
    c2Stand(stand, clamp, anchorWorld(mat, 'under').y)
    // The rack stands on the bench 15 u to the right of the stand's base plate (75 + 15 + 60).
    const rack = b.on('testTubeRack', 'base', stand, 'base', { dx: 150, w: 120, params: { holes: 3 } })
    const limewater = b.on('testTube', 'bottom', rack, 'slot3', { contents: { main: [c2Liquid(0.5, c2Preset.colourless, { bubbles: 'few' })] } })
    // The delivery tube starts just inside the boiling tube, leaves through the bung hole, and ends deep in the limewater.
    const inside = toWorld(bung, P(0, 34)),
      out = toWorld(bung, P(0, -14)),
      lw = anchorWorld(limewater, 'mouth'),
      lb = anchorWorld(limewater, 'bottom')
    b.connector('glassTube', [v(inside.x, inside.y), v(out.x, out.y, 12), v(lw.x, out.y, 12), v(lw.x, lb.y - 22)])
    b.label('clamp', -80, -270, [clamp, -26, 11])
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

export const chemistry2: TemplateDef[] = [
  titration,
  standardSolution,
  reflux,
  separatingFunnelUse,
  buchnerFiltration,
  meltingPoint,
  tlc,
  electrochemicalCell,
  phCurve,
  testTubeReactions,
  thermalDecomposition,
]
