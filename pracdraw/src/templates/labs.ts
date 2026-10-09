// labs.ts — templates of the group "Chemistry" for release 1.2: the laboratory set-ups of the diagram inventory (gas tests, the
// carbonate test, the simple cell, rusting tubes and so on). Each one follows its row in spec/templates.json (priority C).
// Copy the pattern of the templates in chemistry.ts: place parts with DocBuilder.at, .on and .near.

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

/** Width of Arial, in thousandths of the size, for the characters of the labels: it centres a text under a part. */
const ARIAL: Record<string, number> = {
  ' ': 278,
  ',': 278,
  '.': 278,
  ':': 278,
  '(': 333,
  ')': 333,
  '-': 333,
  '/': 278,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
}
/** The width of the widest line of a text, in u, at the label size (15). */
function textWidth(text: string, size = 15): number {
  return Math.max(...text.split('\n').map((line) => ([...line].reduce((sum, ch) => sum + (ARIAL[ch] ?? 556), 0) * size) / 1000))
}
/** The x at which a plain text must start so that it is centred on `cx` (the text of a label on its right starts at x). */
const centred = (text: string, cx: number): number => Math.round(cx - textWidth(text) / 2)

/**
 * Stands and clamps stand behind what they hold, so they are made first and placed afterwards.
 * Here a stand made earlier moves so that its rod passes through the clamp's boss and its base is on the bench.
 */
function standUnder(stand: SymbolItem, clamp: SymbolItem, bench: number): void {
  moveAnchorTo(stand, 'rod', anchorWorld(clamp, 'sleeve'))
  moveAnchorTo(stand, 'base', P(anchorWorld(stand, 'base').x, bench))
}

/** Draw a clamp behind what it grips, so that its jaws meet the walls and do not cross the glass. */
function behind(doc: Doc, clamp: SymbolItem, item: SymbolItem): void {
  doc.order = doc.order.filter((id) => id !== clamp.id)
  doc.order.splice(doc.order.indexOf(item.id), 0, clamp.id)
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
    b.label('damp litmus paper', 228, -160, [paper, 7, 5])
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
    // The tubes stand in the outer holes, so that the delivery tube has room to arch between them. The carbonate is in a boiling
    // tube: its 38 u bung has room for two holes, the dropper and the delivery tube.
    const carbonate = b.on('boilingTube', 'bottom', rack, 'slot1', {
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
    caption('calcium chloride\nand a bung:\nno rust', dry)
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
    b.label('carbon electrodes', -90, -150, [left, -4, 40])
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
    b.label('lift the lid briefly\nto let air in', -110, -245, [crucible, -4, -7])
    b.label('magnesium', -110, -170, [ribbon, -9, 5])
    b.label('pipeclay triangle', -110, -118, [triangle, -43, 3])
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
    b.label('graphite electrodes', -100, -225, [left, -4, 66])
    b.label('crucible', -100, -185, [crucible, -30, 12])
    b.label('molten compound', -100, -150, [crucible, -23, 40])
    b.label('pipeclay triangle', -100, -112, [triangle, -43, 3])
    b.label('tripod', -100, -78, [tripod, -58, 50])
    b.label('Bunsen burner', -100, -42, [burner, -7, 85])
    b.label('heatproof mat', -100, 2, [mat, -65, 4])
    b.label('crocodile clip', 130, -285, [clipR, 7, 12])
    b.label('clamp', 130, -190, [clampLow, -clampLow.w / 2 + 1, 20])
    b.label('clamp stand', 130, -120, [stand, -23, 150], { side: 'right' })
    b.label('power supply', -378, 40, [psu, -45, 78], { side: 'right' })
    b.label('do this in a fume cupboard', centred('do this in a fume cupboard', 0), 48)
    return b.doc
  },
}

export const labs: TemplateDef[] = [gasTests, carbonateTest, rustingTubes, simpleCell, conductivityTest, magnesiumInCrucible, electrolysisMolten]

// Used by the templates that follow.
void anchorOf
void toWorld
void WHITE_POWDER
void RUST
void OIL
void ICE
void YELLOW
void BLUE_CRYSTALS
void CLOUDY_YELLOW
void setReading
void powder
void gas
void behind
void standUnder
void WATER
