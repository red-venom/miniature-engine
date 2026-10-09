// labs.ts — templates of the group "Chemistry" for release 1.2: the laboratory set-ups of the diagram inventory (gas tests, the
// carbonate test, the simple cell, rusting tubes and so on). Each one follows its row in spec/templates.json (priority C).
// Copy the pattern of the templates in chemistry.ts: place parts with DocBuilder.at, .on and .near.

import { P, v } from '../kernel/geom'
import type { Layer } from '../kernel/contents'
import { DocBuilder, anchorWorld, moveAnchorTo } from '../model/build'
import { toWorld } from '../model/transform'
import type { SymbolItem } from '../model/types'
import { geometry } from '../symbols/registry'
import { readingToAmount } from '../symbols/scale'
import type { TemplateDef } from './types'

// Colours are presets from section 9 of the specification.
const WATER = '#cfe8f7'
const COLOURLESS = '#e9f1f5' // Colourless solution
const CLOUDY = '#e6e6e6' // Cloudy: limewater that has turned cloudy (a cloudy liquid)
const CLOUDY_YELLOW = '#f1e9b0' // Cloudy yellow (sulfur): sugar solution and yeast
const OIL = '#f3d9a8' // Oil or organic layer
const WHITE_POWDER = '#f1f1f1' // White powder or precipitate
const RUST = '#c9824a' // Orange-brown precipitate (iron(III) hydroxide): the colour of rust
const GRANULES = '#e9e9e9' // Chips or granules
const ICE = '#eaf4fb'
const YELLOW = '#f5e58a' // Yellow: a molten compound
const BLUE_CRYSTALS = '#7fb8e6' // Blue crystals (copper sulfate)
const PALE_GREEN_GAS = '#e3efc1' // Pale green gas: chlorine
const THERMOMETER_RED = '#d33333' // the liquid in a thermometer
const NO_TINT = '#ffffff' // a colourless gas

const liquid = (amount: number, colour: string, extra: Partial<Layer> = {}): Layer => ({ kind: 'liquid', amount, colour, ...extra })
const powder = (amount: number, colour: string): Layer => ({ kind: 'powder', amount, colour })
const lumps = (amount: number, colour: string): Layer => ({ kind: 'lumps', amount, colour })
/** A gas fills the space above the other layers, so it is always the last layer. Its amount is what is left. */
const gas = (below: number, colour = NO_TINT): Layer => ({ kind: 'gas', amount: Math.round((1 - below) * 100) / 100, colour })

/** Set the red column of an upright thermometer to a reading in °C. */
function setReading(thermo: SymbolItem, celsius: number): void {
  const amount = readingToAmount(geometry('thermometer', thermo.w, thermo.h, thermo.params), celsius) ?? 0.2
  thermo.contents = { main: [liquid(amount, THERMOMETER_RED)] }
}

/** Width of Arial for each character of the labels, in thousandths of the size ("_" is the space): it centres a text under a part. */
const ARIAL = Object.fromEntries(
  '_278 ,278 .278 :278 (333 )333 -333 /278 a556 b556 c500 d556 e556 f278 g556 h556 i222 j222 k500 l222 m833 n556 o556 p556 q556 r333 s500 t278 u556 v500 w722 x500 y500 z500'
    .split(' ')
    .map((entry) => [entry[0] === '_' ? ' ' : entry[0], Number(entry.slice(1))]),
) as Record<string, number>
/** The width of the widest line of a text, in u, at the label size (15). */
function textWidth(text: string, size = 15): number {
  return Math.max(...text.split('\n').map((line) => ([...line].reduce((sum, ch) => sum + (ARIAL[ch] ?? 556), 0) * size) / 1000))
}
/** The x at which a plain text must start so that it is centred on `cx` (the text of a label on its right starts at x). */
const centred = (text: string, cx: number): number => Math.round(cx - textWidth(text) / 2)

/**
 * The width of a boss clamp whose jaws (opening `grip`) and whose boss are `distance` apart: the boss is 9 u from its end and the
 * centre of the jaws 0.45 × the opening from the other end (bossClamp recipe).
 */
const clampWidth = (distance: number, grip: number): number => Math.round(distance + 9 + 0.45 * grip)

/**
 * Stands and clamps stand behind what they hold, so they are made first and placed afterwards.
 * Here a stand made earlier moves so that its rod passes through the clamp's boss and its base is on the bench.
 */
function standUnder(stand: SymbolItem, clamp: SymbolItem, bench: number): void {
  moveAnchorTo(stand, 'rod', anchorWorld(clamp, 'sleeve'))
  moveAnchorTo(stand, 'base', P(anchorWorld(stand, 'base').x, bench))
}

// ---------------------------------------------------------------- tests for gases

const gasTests: TemplateDef = {
  id: 'gasTests',
  title: 'Tests for common gases',
  group: 'Chemistry',
  refs: 'GCSE 4.8.2; Trilogy 5.8.2',
  build() {
    const b = new DocBuilder('Tests for common gases')
    // Five tubes in one rack, 100 u apart: hydrogen, oxygen, the carbon dioxide tube and its limewater, chlorine.
    const rack = b.at('testTubeRack', 'base', P(0, 0), { w: 516, params: { holes: 5 } })
    const tube = (slot: number, main?: Layer[]) => b.on('testTube', 'bottom', rack, `slot${slot}`, main ? { contents: { main } } : {})
    const hydrogen = tube(1)
    const oxygen = tube(2)
    // Carbon dioxide from marble chips and acid: the bung's tube is the only opening.
    const source = tube(3, [lumps(0.08, GRANULES), liquid(0.3, COLOURLESS, { bubbles: 'few' })])
    const limewater = tube(4, [liquid(0.45, CLOUDY, { cloudy: true, bubbles: 'few' })])
    const chlorine = tube(5, [gas(0, PALE_GREEN_GAS)])
    // The lit splint is held level over the mouth of the hydrogen tube, its flame over the middle of the mouth.
    const lit = b.on('splint', 'tip', hydrogen, 'mouth', { w: 100, dx: 6, dy: -12 })
    // The glowing splint hangs in the oxygen tube, its glowing end 55 u below the mouth.
    const glowing = b.on('splint', 'tip', oxygen, 'mouth', { w: 100, rot: 90, dy: 55, params: { state: 'glowing' } })
    // A bung (27 u: it seats in a 24 u tube) closes the source tube; the tube leaves the bung hole and dips into the limewater.
    const bung = b.on('bung', 'plug', source, 'mouth', { w: 27.2 })
    const paper = b.near('indicatorPaper', chlorine, 'mouth', { dy: -10, params: { colour: 'blue' } })
    const hole = anchorWorld(bung, 'hole1'),
      lw = anchorWorld(limewater, 'mouth'),
      lb = anchorWorld(limewater, 'bottom')
    b.connector('glassTube', [v(hole.x, hole.y + 30), v(hole.x, hole.y - 32, 12), v(lw.x, hole.y - 32, 12), v(lw.x, lb.y - 8)])
    // The result under each picture, as plain text: it stays when the labels are blanked for a worksheet.
    const caption = (text: string, cx: number) => b.label(text, centred(text, cx), 36)
    caption('hydrogen\nsqueaky pop', anchorWorld(hydrogen, 'bottom').x)
    caption('oxygen\nrelights', anchorWorld(oxygen, 'bottom').x)
    caption('carbon dioxide\nturns cloudy', (anchorWorld(source, 'bottom').x + anchorWorld(limewater, 'bottom').x) / 2)
    caption('chlorine\nbleached', anchorWorld(chlorine, 'bottom').x)
    // The names of the test materials stand over their parts, so that no leader crosses another leader or a text.
    b.label('lit splint', -310, -137, [lit, -48, 4])
    b.label('glowing splint', -108, -192, [glowing, -45, 4])
    b.label('delivery tube', 48, -202, P(60, hole.y - 32 - 3.5))
    b.label('limewater', 144, -202, [limewater, 9, 75])
    b.label('damp litmus\npaper', 228, -160, [paper, 7, 5])
    return b.doc
  },
}

// ---------------------------------------------------------------- test for a carbonate

const carbonateTest: TemplateDef = {
  id: 'carbonateTest',
  title: 'Test for a carbonate',
  group: 'Chemistry',
  refs: 'GCSE 4.8.2; A-level RP 4',
  build() {
    const b = new DocBuilder('Test for a carbonate')
    const rack = b.at('testTubeRack', 'base', P(0, 0), { w: 240, params: { holes: 3, tube: 'boiling' } })
    // The tubes stand in the outer holes, so that the delivery tube has room to arch between them. The carbonate is in a wide
    // test tube (34 u), so that the standard 38 u bung has room for two holes: the dropper and the delivery tube.
    const carbonate = b.on('testTube', 'bottom', rack, 'slot1', {
      w: 34,
      h: 150,
      contents: { main: [powder(0.1, WHITE_POWDER), liquid(0.4, COLOURLESS, { bubbles: 'few' })] },
    })
    const limewater = b.on('testTube', 'bottom', rack, 'slot3', { h: 150, contents: { main: [liquid(0.55, CLOUDY, { cloudy: true, bubbles: 'few' })] } })
    // The dropper passes through the left hole of the bung, so that the acid is added without opening the tube; the delivery tube
    // leaves by the right hole, the only opening.
    const bung = b.on('bung', 'plug', carbonate, 'mouth', { params: { holes: 2 } })
    const dropper = b.on('dropper', 'tip', bung, 'hole1', { dy: 42, contents: { main: [liquid(0.9, COLOURLESS)] } })
    const out = anchorWorld(bung, 'hole2'),
      lw = anchorWorld(limewater, 'mouth'),
      lb = anchorWorld(limewater, 'bottom')
    b.connector('glassTube', [v(out.x, out.y + 30), v(out.x, out.y - 30, 12), v(lw.x, out.y - 30, 12), v(lw.x, lb.y - 8)])
    b.label('acid', -190, -190, [dropper, 0, 48])
    b.label('bung', -190, -150, [bung, -17, 12])
    b.label('carbonate', -190, -110, [carbonate, -17, 70])
    b.label('delivery tube', 10, -230, P(30, out.y - 30 - 3.5))
    b.label('limewater', 130, -150, [limewater, 9, 80])
    return b.doc
  },
}

// ---------------------------------------------------------------- rusting

const rustingTubes: TemplateDef = {
  id: 'rustingTubes',
  title: 'Rusting experiment',
  group: 'Chemistry',
  refs: 'GCSE 4.10',
  build() {
    const b = new DocBuilder('Rusting experiment')
    const rack = b.at('testTubeRack', 'base', P(0, 0), { w: 464, params: { holes: 4 } })
    // Tall test tubes (150 u): the liquid and the heads of the nails stand above the top bar of the rack, where a leader can reach them.
    // Rust is not drawn on a nail: a thin layer of orange-brown powder at the foot of the tubes where it forms stands for it.
    const tap = b.on('testTube', 'bottom', rack, 'slot1', { h: 150, contents: { main: [powder(0.04, RUST), liquid(0.58, WATER)] } })
    const boiled = b.on('testTube', 'bottom', rack, 'slot2', { h: 150, contents: { main: [liquid(0.58, WATER), liquid(0.1, OIL)] } })
    const dry = b.on('testTube', 'bottom', rack, 'slot3', { h: 150, contents: { main: [lumps(0.2, GRANULES)] } })
    const salt = b.on('testTube', 'bottom', rack, 'slot4', { h: 150, contents: { main: [powder(0.08, RUST), liquid(0.54, COLOURLESS)] } })
    // Each nail stands on the bottom of its tube, or in the granules, its head under the surface.
    const nail = (tube: SymbolItem, sunk: number) => b.near('nail', tube, 'bottom', { h: 60, dy: -(30 + sunk) })
    const nail1 = nail(tap, 3)
    nail(boiled, 1)
    nail(dry, 7)
    nail(salt, 3)
    const bung = b.on('bung', 'plug', dry, 'mouth', { w: 27.2, params: { holes: 0 } })
    const caption = (text: string, tube: SymbolItem) => b.label(text, centred(text, anchorWorld(tube, 'bottom').x), 36)
    caption('tap water\nand air:\nrusts', tap)
    caption('boiled water\nand oil:\nno rust', boiled)
    caption('calcium\nchloride\nand a bung:\nno rust', dry)
    caption('salt solution\nand air:\nrusts faster', salt)
    b.label('iron nail', -280, -125, [nail1, -6, 4])
    b.label('oil', -40, -215, [boiled, 6, 60])
    b.label('bung', 70, -215, [bung, 12, 3])
    // A layer of powder is no nail, so a note says what it is. It is plain text: a worksheet keeps it.
    b.label('the orange-brown layer is rust', centred('the orange-brown layer is rust', 0), 118)
    return b.doc
  },
}

// ---------------------------------------------------------------- a simple cell

const simpleCell: TemplateDef = {
  id: 'simpleCell',
  title: 'Simple cell',
  group: 'Chemistry',
  refs: 'GCSE 4.5.2.1',
  build() {
    const b = new DocBuilder('Simple cell')
    const strip = { kind: 'strip', material: 'metal' }
    const beaker = b.at('beaker', 'base', P(0, 0), { contents: { main: [liquid(0.6, COLOURLESS)] } })
    // Two different metals, 28 u apart, so that they do not touch. Each tip is 14 u above the bottom, well under the surface.
    const zinc = b.on('electrode', 'tip', beaker, 'base', { dx: -22, dy: -14, h: 140, params: strip })
    const copper = b.on('electrode', 'tip', beaker, 'base', { dx: 22, dy: -14, h: 140, params: strip })
    // A crocodile clip bites the top of each strip, its wire stub up.
    const clipZ = b.on('crocodileClip', 'jaw', zinc, 'top', { rot: -90, dy: 8 })
    const clipC = b.on('crocodileClip', 'jaw', copper, 'top', { rot: -90, dy: 8 })
    const z = anchorWorld(clipZ, 'tail'),
      c = anchorWorld(clipC, 'tail')
    const meter = b.at('instrumentBox', 'base', P((z.x + c.x) / 2, z.y - 75), { params: { title: 'voltmeter', reading: '1.0 V', terminals: '2' } })
    const ta = anchorWorld(meter, 'a'),
      tb = anchorWorld(meter, 'b'),
      yw = z.y - 30
    // The wires fan out to the terminals without crossing: the left strip to the left terminal, the right strip to the right.
    b.connector('wire', [v(z.x, z.y), v(z.x, yw, 10), v(ta.x, yw, 10), v(ta.x, ta.y)])
    b.connector('wire', [v(c.x, c.y), v(c.x, yw, 10), v(tb.x, yw, 10), v(tb.x, tb.y)])
    // The more reactive metal, zinc, is the negative terminal. The signs point at the strips inside the beaker, from the side.
    b.label('zinc', -90, -165, [zinc, -8, 26])
    b.label('\u2212', -90, -100, [zinc, -8, 62])
    b.label('electrolyte', -90, -40, [beaker, -40, 100])
    b.label('crocodile clip', 90, -190, [clipC, 7, 12])
    b.label('copper', 90, -150, [copper, 8, 26])
    b.label('+', 90, -100, [copper, 8, 62])
    b.label('voltmeter', 160, -283, [meter, 65, 40])
    return b.doc
  },
}

// ---------------------------------------------------------------- does it conduct?

const conductivityTest: TemplateDef = {
  id: 'conductivityTest',
  title: 'Testing a substance for conduction',
  group: 'Chemistry',
  refs: 'GCSE 4.2.2',
  build() {
    const b = new DocBuilder('Testing a substance for conduction')
    const beaker = b.at('beaker', 'base', P(0, 0), { contents: { main: [liquid(0.6, COLOURLESS)] } })
    // Two carbon rods, 44 u apart, so that they do not touch; each tip is 14 u above the bottom, well under the surface.
    const left = b.on('electrode', 'tip', beaker, 'base', { dx: -22, dy: -14, h: 140 })
    const right = b.on('electrode', 'tip', beaker, 'base', { dx: 22, dy: -14, h: 140 })
    const clipL = b.on('crocodileClip', 'jaw', left, 'top', { rot: -90, dy: 8 })
    const clipR = b.on('crocodileClip', 'jaw', right, 'top', { rot: -90, dy: 8 })
    const tl = anchorWorld(clipL, 'tail'),
      tr = anchorWorld(clipR, 'tail')
    // The circuit above the beaker: cell and lamp in series with the two rods, square corners as in every circuit.
    const rail = tl.y - 75,
      jog = tl.y - 30
    const cell = b.at('cCell', 'a', P(-100, rail))
    const lamp = b.at('cLamp', 'a', P(40, rail))
    const [ca, cb, la, lb] = [anchorWorld(cell, 'a'), anchorWorld(cell, 'b'), anchorWorld(lamp, 'a'), anchorWorld(lamp, 'b')]
    b.connector('wire', [v(tl.x, tl.y), v(tl.x, jog), v(ca.x, jog), v(ca.x, ca.y)])
    b.connector('wire', [v(cb.x, cb.y), v(la.x, la.y)])
    b.connector('wire', [v(lb.x, lb.y), v(lb.x, jog), v(tr.x, jog), v(tr.x, tr.y)])
    b.label('cell', -150, rail + 5, [cell, -3, 8])
    b.label('carbon\nelectrodes', -90, -150, [left, -4, 40])
    b.label('solution', -90, -40, [beaker, -40, 100])
    b.label('lamp', 150, rail - 30, [lamp, 8, 10])
    b.label('crocodile clip', 66, -150, [clipR, 7, 12])
    b.label('the lamp lights if the solution conducts', centred('the lamp lights if the solution conducts', 0), 40)
    return b.doc
  },
}

// ---------------------------------------------------------------- heating magnesium

const magnesiumInCrucible: TemplateDef = {
  id: 'magnesiumInCrucible',
  title: 'Heating magnesium in a crucible',
  group: 'Chemistry',
  refs: 'GCSE 4.3.1; Trilogy RP 1',
  build() {
    const b = new DocBuilder('Heating magnesium in a crucible')
    const mat = b.at('heatproofMat', 'under', P(0, 0), { w: 150 })
    const tripod = b.on('tripod', 'feet', mat, 'top')
    const burner = b.on('bunsenBurner', 'base', mat, 'top')
    // The crucible stands on the pipeclay triangle on the tripod, not on a gauze, and the blue flame touches its base.
    const triangle = b.on('pipeclayTriangle', 'under', tripod, 'top')
    const crucible = b.on('crucible', 'base', triangle, 'top', { params: { lid: true } })
    // The ribbon lies in the bottom of the crucible, out of the lid's way.
    const ribbon = b.near('magnesiumRibbon', crucible, 'base', { dy: -9, w: 24, h: 10 })
    b.label('lift the lid\nbriefly to\nlet air in', -110, -245, [crucible, -4, -7])
    b.label('magnesium', -110, -170, [ribbon, -9, 5])
    b.label('pipeclay\ntriangle', -110, -122, [triangle, -43, 3])
    b.label('Bunsen burner', -110, -50, [burner, -7, 85])
    b.label('lid', 110, -205, [crucible, 22, -3])
    b.label('crucible', 110, -165, [crucible, 24, 30])
    b.label('tripod', 110, -80, [tripod, 56, 50])
    b.label('heatproof mat', 110, 5, [mat, 70, 4])
    return b.doc
  },
}

// ---------------------------------------------------------------- electrolysis of a molten compound

const electrolysisMolten: TemplateDef = {
  id: 'electrolysisMolten',
  title: 'Electrolysis of a molten compound',
  group: 'Chemistry',
  refs: 'GCSE 4.4.3.2',
  build() {
    const b = new DocBuilder('Electrolysis of a molten compound')
    // The stand and its two clamps stand behind everything, so they are made first and placed once the electrodes are.
    const stand = b.symbol('clampStand', { w: 100 })
    const clampLow = b.symbol('bossClamp', { flip: true, params: { grip: 14 } })
    const clampHigh = b.symbol('bossClamp', { flip: true, params: { grip: 14 } })
    const mat = b.at('heatproofMat', 'under', P(0, 0), { w: 150 })
    const tripod = b.on('tripod', 'feet', mat, 'top')
    const burner = b.on('bunsenBurner', 'base', mat, 'top')
    const triangle = b.on('pipeclayTriangle', 'under', tripod, 'top')
    // A deep crucible, so that there is room in the melt for both rods beside each other.
    const crucible = b.on('crucible', 'base', triangle, 'top', { w: 70, h: 70, contents: { main: [liquid(0.5, YELLOW)] } })
    // Two graphite rods, 28 u apart, each tip 12 u above the bottom and 22 u under the surface.
    const left = b.on('electrode', 'tip', crucible, 'base', { dx: -14, dy: -12, h: 160 })
    const right = b.on('electrode', 'tip', crucible, 'base', { dx: 14, dy: -12, h: 160 })
    // One stand, on the right, holds both: the lower clamp grips the right rod; the upper clamp has a longer arm, which passes
    // behind the right rod, and grips the left one.
    const bench = anchorWorld(mat, 'under').y
    const gripLow = anchorWorld(right, 'tip'),
      gripHigh = anchorWorld(left, 'tip')
    moveAnchorTo(clampLow, 'grip', P(gripLow.x, bench - 215))
    clampHigh.w = Math.round(anchorWorld(clampLow, 'sleeve').x - gripHigh.x + 15.3)
    moveAnchorTo(clampHigh, 'grip', P(gripHigh.x, bench - 255))
    standUnder(stand, clampLow, bench)
    stand.h = Math.round(bench - (anchorWorld(clampHigh, 'sleeve').y - 35))
    standUnder(stand, clampLow, bench)
    // A clip on the top of each rod, its wire stub up.
    const clipL = b.on('crocodileClip', 'jaw', left, 'top', { rot: -90, dy: 8 })
    const clipR = b.on('crocodileClip', 'jaw', right, 'top', { rot: -90, dy: 8 })
    // The power supply stands on the bench to the left. The right rod goes to the farther terminal, by the higher wire, so that
    // the two wires do not cross.
    const psu = b.on('powerSupply', 'base', mat, 'under', { dx: -330 })
    const tl = anchorWorld(clipL, 'tail'),
      tr = anchorWorld(clipR, 'tail'),
      plus = anchorWorld(psu, 'plus'),
      minus = anchorWorld(psu, 'minus')
    b.connector('wire', [v(tl.x, tl.y), v(tl.x, tl.y - 18), v(minus.x, tl.y - 18), v(minus.x, minus.y)])
    b.connector('wire', [v(tr.x, tr.y), v(tr.x, tr.y - 36), v(plus.x, tr.y - 36), v(plus.x, plus.y)])
    b.label('graphite\nelectrodes', -100, -236, [left, -4, 66])
    b.label('crucible', -100, -194, [crucible, -30, 12])
    b.label('molten\ncompound', -100, -166, [crucible, -23, 40])
    b.label('pipeclay\ntriangle', -100, -124, [triangle, -43, 3])
    b.label('tripod', -100, -82, [tripod, -58, 50])
    b.label('Bunsen burner', -100, -46, [burner, -7, 85])
    b.label('heatproof mat', -100, 2, [mat, -65, 4])
    b.label('crocodile clip', 130, -285, [clipR, 7, 12])
    b.label('clamp', 130, -190, [clampLow, -clampLow.w / 2 + 1, 20])
    b.label('clamp stand', 130, -120, [stand, -23, 150], { side: 'right' })
    b.label('power supply', -378, 40, [psu, -45, 78], { side: 'right' })
    b.label('do this in a fume cupboard', centred('do this in a fume cupboard', 0), 48)
    return b.doc
  },
}

// ---------------------------------------------------------------- a Group 1 metal in water

const groupOneWater: TemplateDef = {
  id: 'groupOneWater',
  title: 'Group 1 metal in water',
  group: 'Chemistry',
  refs: 'GCSE 4.1.2.4',
  build() {
    const b = new DocBuilder('Group 1 metal in water')
    // A narrow trough, so that the few bubbles of the layer stay near the piece of metal.
    const trough = b.at('trough', 'base', P(0, 0), { w: 190, contents: { main: [liquid(0.6, WATER, { bubbles: 'few' })] } })
    // The piece floats: its lower edge is just under the surface, which is 56 u above the floor of the trough.
    const metal = b.near('irregularSolid', trough, 'base', { dx: -30, dy: -63, w: 26, h: 20 })
    // A burning splint is held over the bubbles, its flame over the piece.
    const splint = b.at('splint', 'tip', P(metal.x - 6, metal.y - 62), { flip: true, w: 100 })
    b.label('lithium', -120, -125, [metal, -9, 8])
    b.label('water', -120, -40, [trough, -60, 80])
    b.label('burning splint', 120, -125, [splint, -40, 4])
    b.label('hydrogen', 130, -60, [trough, -8, 63.6])
    return b.doc
  },
}

// ---------------------------------------------------------------- fermentation

const fermentationApparatus: TemplateDef = {
  id: 'fermentationApparatus',
  title: 'Fermentation of a sugar solution',
  group: 'Chemistry',
  refs: 'GCSE 4.7.2.2',
  build() {
    const b = new DocBuilder('Fermentation of a sugar solution')
    // The warm water bath is a wide beaker, so that the flask stands in it. Its water is a little higher than the solution.
    const bath = b.at('beaker', 'base', P(0, 0), { w: 150, h: 110, contents: { main: [liquid(0.62, WATER)] } })
    const flask = b.on('conicalFlask', 'base', bath, 'base', {
      dy: -2,
      contents: { main: [liquid(0.4, CLOUDY_YELLOW, { cloudy: true, bubbles: 'few' })] },
    })
    // The thermometer stands in the bath beside the flask, its bulb 14 u above the bottom, at 35 degrees.
    const thermo = b.on('thermometer', 'bulb', bath, 'base', { dx: -64, dy: -14, h: 180 })
    setReading(thermo, 35)
    const bung = b.on('bung', 'plug', flask, 'mouth')
    // The tube of limewater stands in a small beaker, to keep it upright.
    const holder = b.on('beaker', 'base', bath, 'base', { dx: 330, w: 70, h: 90 })
    const limewater = b.on('testTube', 'bottom', holder, 'base', {
      dy: -2,
      h: 130,
      contents: { main: [liquid(0.5, CLOUDY, { cloudy: true, bubbles: 'few' })] },
    })
    // The bung's tube is the only opening: it leaves the flask, arches over and dips into the limewater.
    const hole = anchorWorld(bung, 'hole1'),
      lw = anchorWorld(limewater, 'mouth'),
      lb = anchorWorld(limewater, 'bottom')
    b.connector('glassTube', [v(hole.x, hole.y + 30), v(hole.x, hole.y - 52, 12), v(lw.x, hole.y - 52, 12), v(lw.x, lb.y - 8)])
    b.label('thermometer', -110, -190, [thermo, -4.5, 40])
    b.label('bung', 95, -165, [bung, 17, 12])
    b.label('conical flask', 95, -120, [flask, 28, 52])
    b.label('yeast and\nsugar solution', 95, -70, [flask, 24, 125])
    b.label('warm water', 95, -22, [bath, 62, 95])
    b.label('delivery tube', 110, -260, P(hole.x + 60, hole.y - 52 - 3.5))
    b.label('limewater', 390, -80, [limewater, 9, 90])
    return b.doc
  },
}

// ---------------------------------------------------------------- collecting a gas by delivery

const gasCollection: TemplateDef = {
  id: 'gasCollection',
  title: 'Collecting a gas by delivery',
  group: 'Chemistry',
  refs: 'GCSE 4.8.2',
  build() {
    const b = new DocBuilder('Collecting a gas by delivery')
    const generator = { lumps: lumps(0.1, GRANULES), solution: liquid(0.3, COLOURLESS, { bubbles: 'few' }) }
    // Downward delivery: the tube reaches the bottom of an upright jar, and the gas, which is denser than air, fills it from there.
    const flask1 = b.at('conicalFlask', 'base', P(0, 0), { contents: { main: [generator.lumps, generator.solution] } })
    const bung1 = b.on('bung', 'plug', flask1, 'mouth')
    const jar1 = b.on('gasJar', 'base', flask1, 'base', { dx: 200 })
    const hole1 = anchorWorld(bung1, 'hole1'),
      floor1 = anchorWorld(jar1, 'base')
    b.connector('glassTube', [v(hole1.x, hole1.y + 30), v(hole1.x, hole1.y - 50, 12), v(floor1.x, hole1.y - 50, 12), v(floor1.x, floor1.y - 14)])
    // Upward delivery: an upside-down jar stands on a lid on the bung, and the tube reaches the top of the jar. The gas, which is
    // lighter than air, collects at the top and pushes the air out of the open mouth below.
    const flask2 = b.on('conicalFlask', 'base', flask1, 'base', { dx: 430, contents: { main: [generator.lumps, generator.solution] } })
    const bung2 = b.on('bung', 'plug', flask2, 'mouth')
    const lid = b.on('lid', 'under', bung2, 'hole1', { w: 100, params: { holes: 1 } })
    const jar2 = b.on('gasJar', 'mouth', lid, 'hole1', { rot: 180 })
    const hole2 = anchorWorld(bung2, 'hole1'),
      top2 = anchorWorld(jar2, 'base')
    b.connector('glassTube', [v(hole2.x, hole2.y + 30), v(hole2.x, top2.y + 14)])
    // The gas that each method collects is named in the jar; the notes under the pictures say why.
    b.label('bung', -95, -165, [bung1, -17, 12])
    b.label('conical flask', -95, -70, [flask1, -35, 100])
    b.label('delivery tube', 40, -265, P(60, hole1.y - 50 - 3.5))
    b.label('gas jar', 262, -140, [jar1, 36, 60])
    b.label('carbon dioxide', 262, -90, [jar1, 28, 110])
    // The second jar is turned over, so the right-hand wall is at x = -36 in its own frame, and the closed end is at y = 170.
    b.label('hydrogen', 530, -265, [jar2, -28, 140])
    b.label('inverted\ngas jar', 530, -215, [jar2, -36, 100])
    b.label('lid', 530, -130, [lid, 48, 4])
    b.label('bung', 530, -90, [bung2, 17, 12])
    b.label('conical flask', 530, -40, [flask2, 30, 100])
    const note = (text: string, cx: number) => b.label(text, centred(text, cx), 50)
    note('downward delivery:\nfor a gas denser than air', 90)
    note('upward delivery:\nfor a gas less dense than air', 430)
    return b.doc
  },
}

// ---------------------------------------------------------------- cracking

const crackingApparatus: TemplateDef = {
  id: 'crackingApparatus',
  title: 'Cracking a hydrocarbon in the laboratory',
  group: 'Chemistry',
  refs: 'GCSE 4.7.1.2',
  build() {
    const b = new DocBuilder('Cracking a hydrocarbon in the laboratory')
    // The stands and clamps stand behind everything, so they are made first and placed once the tubes are.
    const stand = b.symbol('clampStand', { w: 100, flip: true })
    const clamp = b.symbol('bossClamp', { params: { grip: 38 } })
    const standT = b.symbol('clampStand', { w: 110 })
    const clampT = b.symbol('bossClamp', { flip: true, params: { grip: 26 } })
    const mat = b.at('heatproofMat', 'under', P(17, 0), { w: 100 })
    const burner = b.on('bunsenBurner', 'base', mat, 'top')
    // The boiling tube lies level, 4 u over the tip of the flame, closed end to the left. The catalyst is a thin row of chips
    // along its lower wall.
    const tube = b.on('boilingTube', 'bottom', burner, 'flame', { rot: 90, dx: -92, dy: -21, contents: { main: [lumps(0.18, GRANULES)] } })
    // The mineral wool, soaked in paraffin, plugs the closed end.
    const wool = b.near('cottonWool', tube, 'bottom', { rot: 90, w: 28, h: 28, dx: 22 })
    const bung = b.on('bung', 'plug', tube, 'mouth', { rot: 90 })
    // The clamp grips the neck, near the mouth. Its arm runs back behind the tube to the stand at the closed end.
    const bench = anchorWorld(mat, 'under').y
    moveAnchorTo(clamp, 'grip', anchorWorld(tube, 'neck'))
    const rodX = anchorWorld(tube, 'bottom').x - 30
    clamp.w = clampWidth(anchorWorld(tube, 'neck').x - rodX, 38)
    moveAnchorTo(clamp, 'grip', anchorWorld(tube, 'neck'))
    stand.h = Math.round(bench - (anchorWorld(clamp, 'sleeve').y - 36))
    standUnder(stand, clamp, bench)
    // The trough stands on the bench to the right. The delivery tube runs along its floor into the mouth of an upside-down test
    // tube that is full of water, 14 u above the floor.
    const trough = b.on('trough', 'base', mat, 'under', { dx: 275, w: 210, contents: { main: [liquid(0.6, WATER)] } })
    const gasTube = b.on('testTube', 'mouth', trough, 'base', { rot: 180, h: 120, dx: 20, dy: -14, contents: { main: [liquid(1, WATER)] } })
    // The test tube is clamped above the rim of the trough, from a stand on the right of the trough, clear of its wall.
    const gm = anchorWorld(gasTube, 'mouth')
    const rodT = anchorWorld(trough, 'base').x + 105 + 40
    clampT.w = clampWidth(rodT - gm.x, 26)
    moveAnchorTo(clampT, 'grip', P(gm.x, gm.y - 94))
    standT.h = Math.round(bench - (anchorWorld(clampT, 'sleeve').y - 36))
    standUnder(standT, clampT, bench)
    const inside = toWorld(bung, P(0, 34)),
      out = toWorld(bung, P(0, -14)),
      floor = anchorWorld(trough, 'base').y
    b.connector('glassTube', [
      v(inside.x, inside.y),
      v(out.x, out.y, 12),
      v(gm.x - 115, out.y, 12),
      v(gm.x - 115, floor - 6, 12),
      v(gm.x, floor - 6, 12),
      v(gm.x, gm.y - 24),
    ])
    // The labels of the tube stand in a staircase over it, each text to the right of its leader, so that no leader crosses
    // another leader or a text.
    b.label('clamp stand', -122, -150, [stand, -26, 40], { side: 'left' })
    b.label('mineral wool\nsoaked in\nparaffin', -20, -294, [wool, -13, 14], { side: 'right' })
    b.label('catalyst', 30, -232, [tube, 14, 60], { side: 'right' })
    b.label('boiling tube', 70, -207, [tube, -17, 53], { side: 'right' })
    b.label('bung', 105, -182, [bung, -13, 2], { side: 'right' })
    b.label('delivery tube', 215, -170, P(185, out.y - 3.5), { side: 'right' })
    b.label('Bunsen\nburner', 70, -62, [burner, 14, 50])
    b.label('heatproof mat', -30, 42, [mat, -35, 6])
    b.label('trough of\nwater', 160, 42, [trough, -50, 95])
    b.label('test tube\nfull of\nwater', 340, -160, [gasTube, -12, 108])
    b.label(
      'take the delivery tube out of the water before stopping the heating',
      centred('take the delivery tube out of the water before stopping the heating', 150),
      94,
    )
    return b.doc
  },
}

// ---------------------------------------------------------------- the products of burning a fuel

const combustionProducts: TemplateDef = {
  id: 'combustionProducts',
  title: 'Products of burning a fuel',
  group: 'Chemistry',
  refs: 'GCSE 4.7.1; Trilogy 5.7.1',
  build() {
    const b = new DocBuilder('Products of burning a fuel')
    // The stand and its clamp stand behind everything, so they are made first and placed once the funnel is.
    const stand = b.symbol('clampStand', { w: 100, flip: true })
    const clamp = b.symbol('bossClamp', { params: { grip: 14 } })
    const burner = b.at('spiritBurner', 'base', P(0, 0), { contents: { main: [liquid(0.5, COLOURLESS)] } })
    // An upside-down funnel over the flame takes the gases from it into its stem.
    const funnel = b.on('filterFunnel', 'rim', burner, 'flame', { rot: 180, dy: -14 })
    // The clamp grips the stem, from the stand on the left.
    const stem = anchorWorld(funnel, 'stem')
    const bench = anchorWorld(burner, 'base').y
    moveAnchorTo(clamp, 'grip', P(stem.x, stem.y + 38))
    clamp.w = clampWidth(110, 14)
    moveAnchorTo(clamp, 'grip', P(stem.x, stem.y + 38))
    stand.h = Math.round(bench - (anchorWorld(clamp, 'sleeve').y - 35))
    standUnder(stand, clamp, bench)
    // The ice bath: a beaker of ice and a little water, with the U-tube standing in it.
    const ice = b.on('beaker', 'base', burner, 'base', { dx: 260, w: 140, h: 110, contents: { main: [lumps(0.55, ICE), liquid(0.05, WATER)] } })
    const utube = b.near('uTube', ice, 'base', { dy: -77, contents: { main: [liquid(0.12, WATER)] } })
    const bungL = b.on('bung', 'plug', utube, 'mouthL', { w: 27.2 })
    const bungR = b.on('bung', 'plug', utube, 'mouthR', { w: 27.2 })
    // The limewater: a wide test tube (34 u, so that the standard two-hole bung fits) stands in a small beaker, to keep it upright.
    const holder = b.on('beaker', 'base', ice, 'base', { dx: 190, w: 70, h: 90 })
    const limewater = b.on('testTube', 'bottom', holder, 'base', { dy: -2, w: 34, h: 130, contents: { main: [liquid(0.5, CLOUDY, { cloudy: true })] } })
    const bung = b.on('bung', 'plug', limewater, 'mouth', { params: { holes: 2 } })
    // Glass tubes pass through the bungs and rubber tubing joins them: the gases go from the funnel down the left arm of the U-tube
    // (the cold glass in the ice makes the water vapour condense), up the right arm, and down to the bottom of the limewater, and
    // the pump draws them on through the second tube of the bung.
    const top = (it: SymbolItem, hole: string) => anchorWorld(it, hole)
    const hL = top(bungL, 'hole1'),
      hR = top(bungR, 'hole1'),
      hIn = top(bung, 'hole1'),
      hOut = top(bung, 'hole2'),
      lb = anchorWorld(limewater, 'bottom')
    const glass = (x: number, y0: number, y1: number) => b.connector('glassTube', [v(x, y0), v(x, y1)])
    glass(hL.x, hL.y + 30, hL.y - 24)
    glass(hR.x, hR.y + 30, hR.y - 24)
    glass(hIn.x, lb.y - 10, hIn.y - 24)
    glass(hOut.x, hOut.y + 24, hOut.y - 24)
    // The rubber tubing slips 10 u over the top of each glass tube.
    const arch = hL.y - 56
    b.connector('rubberTube', [v(stem.x, stem.y + 15), v(stem.x, arch, 16), v(hL.x, arch, 16), v(hL.x, hL.y - 14)])
    b.connector('rubberTube', [v(hR.x, hR.y - 14), v(hR.x, arch, 16), v(hIn.x, arch, 16), v(hIn.x, hIn.y - 14)])
    b.connector('rubberTube', [v(hOut.x, hOut.y - 14), v(hOut.x, hOut.y - 60, 16), v(hOut.x + 80, hOut.y - 60)])
    b.label('to pump', hOut.x + 88, hOut.y - 55)
    // The labels stand in the space between the burner and the ice bath, and beyond the limewater.
    b.label('funnel', 70, -125, [funnel, -27, 20], { side: 'right' })
    b.label('fuel', 70, -55, [burner, 35, 64], { side: 'right' })
    b.label('ice', 150, -35, [ice, -63, 65], { side: 'left' })
    b.label('condensate', 150, -5, [utube, -35, 138], { side: 'left' })
    b.label('limewater', 500, -60, [limewater, 8, 90], { side: 'right' })
    b.label('clamp stand', -122, -130, [stand, -26, 80], { side: 'left' })
    return b.doc
  },
}

// ---------------------------------------------------------------- fractional distillation

const fractionalDistillationLab: TemplateDef = {
  id: 'fractionalDistillationLab',
  title: 'Fractional distillation in the laboratory',
  group: 'Chemistry',
  refs: 'GCSE 4.7.1.1; Trilogy 5.7.1',
  build() {
    const b = new DocBuilder('Fractional distillation in the laboratory')
    // As the distillation template. The column raises the still head, so the flask, the mantle and the column are a little smaller
    // than there: then the receiver adaptor still reaches the neck of a collecting flask that stands on the bench.
    // The neck stand is on the right of the flask, so that the labels of the flask, the column and the mantle have the left side.
    const neckStand = b.symbol('clampStand', { w: 100, h: 200 })
    const neckClamp = b.symbol('bossClamp', { w: 72, flip: true, params: { grip: 34 } })
    const mantle = b.at('heatingMantle', 'base', P(0, 0), { w: 150, h: 90 })
    const bench = anchorWorld(mantle, 'base').y
    const flask = b.on('roundBottomFlask', 'bottom', mantle, 'cup', { w: 100, h: 125, contents: { main: [lumps(0.05, GRANULES), liquid(0.4, COLOURLESS)] } })
    moveAnchorTo(neckClamp, 'grip', anchorWorld(flask, 'neck'))
    standUnder(neckStand, neckClamp, bench)
    // The column stands on the flask, with its cone in the neck; the still head stands on the column.
    const column = b.on('fractionatingColumn', 'bottom', flask, 'mouth', { h: 124 })
    const head = b.on('stillHead', 'bottom', column, 'top')
    b.on('thermometerAdaptor', 'plug', head, 'top')
    // The bulb's centre is level with the side arm. The thermometer shows the boiling point of ethanol.
    const thermo = b.on('thermometer', 'bulb', head, 'top', { dy: 47, h: 150 })
    setReading(thermo, 78)
    const condStand = b.symbol('clampStand', { h: 280 })
    const condClamp = b.symbol('bossClamp', { w: 76, rot: 18, params: { grip: 38 } })
    const condenser = b.on('liebigCondenser', 'socket', head, 'arm', { rot: 18, contents: { jacket: [liquid(1, WATER)] } })
    moveAnchorTo(condClamp, 'grip', P(condenser.x, condenser.y))
    condStand.h = Math.round(bench - (anchorWorld(condClamp, 'sleeve').y - 40))
    standUnder(condStand, condClamp, bench)
    // The collecting flask has no bung: its mouth is the one opening, with the outlet of the adaptor in its neck.
    const collect = b.symbol('conicalFlask', { w: 80, h: 140, contents: { main: [liquid(0.12, COLOURLESS)] } })
    const receiver = b.on('receiverAdaptor', 'in', condenser, 'cone')
    moveAnchorTo(collect, 'base', P(anchorWorld(receiver, 'out').x, bench))
    b.label('thermometer', -50, -430, [thermo, -4.5, 30])
    b.label('fractionating\ncolumn', -50, -225, [column, -17, 90])
    b.label('round-\nbottomed flask', -70, -125, [flask, -50, 60])
    b.label('heating mantle', -90, -30, [mantle, -75, 60])
    b.label('water out', 130, -350, [condenser, -83, 4], { side: 'right' })
    b.label('Liebig\ncondenser', 300, -330, [condenser, 60, 18], { side: 'right' })
    b.label('water in', 292, -125, [condenser, 83, 66], { side: 'left', leaderEnd: 'arrow' })
    b.label('collected liquid', 470, -40, [collect, 15, 125], { side: 'right' })
    return b.doc
  },
}

// ---------------------------------------------------------------- hydrated copper sulfate

const reversibleHeating: TemplateDef = {
  id: 'reversibleHeating',
  title: 'Heating hydrated copper sulfate',
  group: 'Chemistry',
  refs: 'GCSE 4.6.2',
  build() {
    const b = new DocBuilder('Heating hydrated copper sulfate')
    const tilt = 4 // degrees: the mouth is lower than the closed end, so that the water that condenses runs out
    const rad = (tilt * Math.PI) / 180
    // The holders stand behind their tubes, so they are made first and placed once the tubes are.
    const holderHot = b.symbol('testTubeHolder', { w: 110, rot: 90 + tilt })
    const holderCold = b.symbol('testTubeHolder', { w: 110, rot: 180 })
    // Left: heating. The tube is nearly level, its mouth to the right and lower; the crystals lie on the lower wall, which is
    // lowest at the mouth, and the flame is under them.
    const mat = b.at('heatproofMat', 'under', P(31, 0), { w: 110 })
    const burner = b.on('bunsenBurner', 'base', mat, 'top')
    const back = 106 // the flame is this far from the closed end, along the tube: under the middle of the crystals
    const hot = b.on('boilingTube', 'bottom', burner, 'flame', {
      rot: 90 + tilt,
      dx: -back * Math.cos(rad),
      dy: -21 - back * Math.sin(rad),
      contents: { main: [lumps(0.2, BLUE_CRYSTALS)] },
    })
    // The holder grips the tube near its closed end, well away from the flame, and stands up from it at a right angle.
    const bottom = anchorWorld(hot, 'bottom')
    moveAnchorTo(holderHot, 'grip', P(bottom.x + 30 * Math.cos(rad), bottom.y + 30 * Math.sin(rad)))
    // Droplets of water leave the tube at the mouth.
    const mouth = anchorWorld(hot, 'mouth')
    const wet = b.symbol('drops', { x: mouth.x + 4, y: mouth.y + 40, h: 36, params: { count: 2 } })
    // Right: the tube with the anhydrous (white) powder, upright in a holder, with a dropper above it adding water.
    const cold = b.at('boilingTube', 'bottom', P(mouth.x + 190, -40), { contents: { main: [powder(0.12, WHITE_POWDER)] } })
    moveAnchorTo(holderCold, 'grip', anchorWorld(cold, 'neck'))
    const pour = b.on('dropper', 'tip', cold, 'mouth', { dy: -14, contents: { main: [liquid(0.8, WATER)] } })
    const falling = b.near('drops', pour, 'tip', { dy: 26, h: 40, params: { count: 2 } })
    b.label('hydrated\ncopper sulfate', 110, -222, [hot, 12, 60], { side: 'right' })
    b.label('water', 100, -95, [wet, 0, 12], { side: 'right' })
    b.label('boiling tube', -92, -150, [hot, 0, 148], { side: 'left' })
    b.label('test-tube\nholder', -80, -225, [holderHot, -35, 6], { side: 'left' })
    b.label('Bunsen burner', -70, -60, [burner, -14, 80], { side: 'left' })
    b.label('anhydrous\ncopper sulfate', 300, -75, [cold, 8, 142], { side: 'right' })
    b.label('dropper', 300, -265, [pour, 4, 55], { side: 'right' })
    b.label('water', 300, -215, [falling, 0, 8], { side: 'right' })
    return b.doc
  },
}

export const labs: TemplateDef[] = [
  gasTests,
  carbonateTest,
  simpleCell,
  rustingTubes,
  conductivityTest,
  electrolysisMolten,
  groupOneWater,
  magnesiumInCrucible,
  reversibleHeating,
  crackingApparatus,
  fermentationApparatus,
  combustionProducts,
  fractionalDistillationLab,
  gasCollection,
]
