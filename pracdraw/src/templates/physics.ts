// physics.ts — templates of the group "Physics". Each one follows its row in the Templates tab (spec/templates.json).
// Copy the pattern of heatingBeaker in general.ts: place parts with DocBuilder.at, .on and .near.
//
// Circuit symbols have their terminals `a` (left) and `b` (right) at mid-height. Wires join them terminal to terminal with
// square corners, and a junction dot sits where three or more wires meet.

import { P, v, type Pt } from '../kernel/geom'
import type { Layer } from '../kernel/contents'
import { DocBuilder, anchorOf, anchorWorld } from '../model/build'
import type { SymbolItem } from '../model/types'
import { toWorld } from '../model/transform'
import { geometry } from '../symbols/registry'
import { readingToAmount } from '../symbols/scale'
import type { TemplateDef } from './types'

// Colours: presets from section 9 of the specification, and the thermometer liquid.
const WATER = '#cfe8f7'
const THERMO_RED = '#d33333'
const water = (amount: number, extra: Partial<Layer> = {}): Layer => ({ kind: 'liquid', amount, colour: WATER, ...extra })

/** A wire through the points: straight runs with square corners. */
const wire = (b: DocBuilder, ...pts: Pt[]) => b.connector('wire', pts)
const at = (it: SymbolItem, anchor: string) => anchorWorld(it, anchor)
/** Left end x of plain text (label size 15) centred on cx. Width estimate as in render.ts: 0.56 × the size for each character. */
const centred = (text: string, cx: number) => cx - (text.length * 15 * 0.56) / 2
/** Left edge x of a label column: text on the left ends here. */
const leftOf = (it: SymbolItem, gap: number) => it.x - it.w / 2 - gap
const rightOf = (it: SymbolItem, gap: number) => it.x + it.w / 2 + gap

// ---------------------------------------------------------------- specific heat capacity

const specificHeatCapacity: TemplateDef = {
  id: 'specificHeatCapacity',
  title: 'Specific heat capacity',
  group: 'Physics',
  refs: 'Trilogy RP 14',
  build() {
    const b = new DocBuilder('Specific heat capacity')
    const mat = b.at('heatproofMat', 'under', P(0, 0))
    const block = b.on('metalBlock', 'base', mat, 'top') // insulated by default: the dashed jacket
    // Heater and thermometer stand in their holes, 2 u above the bottom. The holes are 0.78 h and 0.6 h deep (metalBlock recipe).
    const heater = b.on('immersionHeater', 'tip', block, 'heater', { dy: 0.78 * block.h - 2 })
    const thermo = b.on('thermometer', 'bulb', block, 'thermo', { dy: 0.6 * block.h - 2, h: 180 })
    thermo.contents = { main: [{ kind: 'liquid', amount: readingToAmount(geometry('thermometer', 9, 180), 20) ?? 0.25, colour: THERMO_RED }] }

    // The power supply stands on the bench to the left. The joulemeter is above it: its terminals are on its lower edge.
    const psu = b.on('powerSupply', 'base', mat, 'under', { dx: -235 })
    const plus = at(psu, 'plus'),
      minus = at(psu, 'minus'),
      hA = at(heater, 'terminalA'),
      hB = at(heater, 'terminalB')
    // A lead leaves each supply terminal sideways first, so that it does not run through the + or − sign above the terminal.
    const jm = b.at('instrumentBox', 'inA', P(plus.x + 12, hA.y - 42), { params: { title: 'joulemeter', terminals: '4', reading: '0 J' } })
    const inA = at(jm, 'inA'),
      inB = at(jm, 'inB'),
      outA = at(jm, 'outA'),
      outB = at(jm, 'outB')
    const psuTop = psu.y - psu.h / 2,
      jog = (psuTop + inB.y) / 2
    wire(b, plus, P(plus.x + 12, plus.y), inA)
    wire(b, minus, P(minus.x + 12, minus.y), P(minus.x + 12, jog), P(inB.x, jog), inB)
    // Output to the heater: the outer lead turns higher, so that the two never cross.
    wire(b, outA, P(outA.x, hA.y - 16), P(hA.x, hA.y - 16), hA)
    wire(b, outB, P(outB.x, hA.y - 26), P(hB.x, hA.y - 26), hB)

    const L = leftOf(psu, 25),
      R = rightOf(mat, 25)
    b.label('joulemeter', L, jm.y + 5, [jm, -jm.w / 2, jm.h / 2])
    b.label('power supply', L, psu.y + 5, [psu, -psu.w / 2, psu.h / 2])
    b.label('thermometer', R, toWorld(thermo, P(0, 40)).y + 5, [thermo, 4.5, 40])
    b.label('metal block', R, block.y - 55, [block, 40, 30])
    b.label('insulation', R, block.y - 15, [block, block.w / 2, 70])
    b.label('immersion heater', R, block.y + 25, [heater, 6, heater.h - 10])
    b.label('heatproof mat', R, mat.y + 5, [mat, 80, 4])
    return b.doc
  },
}

// ---------------------------------------------------------------- resistance of a wire

const resistanceWire: TemplateDef = {
  id: 'resistanceWire',
  title: 'Resistance of a wire',
  group: 'Physics',
  refs: 'Trilogy RP 15',
  build() {
    const b = new DocBuilder('Resistance of a wire')
    // A metre ruler with the test wire taped along it, just above its scale edge.
    const ruler = b.symbol('ruler', { w: 440, params: { length: '100' } })
    const mark = (cm: number) => toWorld(ruler, P(-ruler.w / 2 + 8 + (cm * (ruler.w - 16)) / 100, 0)) // 8 u margin (ruler recipe)
    const left = toWorld(ruler, P(-ruler.w / 2, 0)),
      right = toWorld(ruler, P(ruler.w / 2, 0)),
      wy = left.y - 12
    wire(b, P(left.x - 10, wy), P(right.x + 10, wy))
    // Crocodile clips on the wire at 0 and 80 cm, jaws down.
    const clip1 = b.at('crocodileClip', 'jaw', P(mark(0).x, wy), { rot: -90 })
    const clip2 = b.at('crocodileClip', 'jaw', P(mark(80).x, wy), { rot: -90 })
    const t1 = at(clip1, 'tail'),
      t2 = at(clip2, 'tail')
    // Battery, switch and ammeter in series along the top; the voltmeter across the clips on the rail below.
    const M = t1.y - 50,
      T = M - 70,
      gap = (t2.x - t1.x - 200) / 4
    const bat = b.at('cBattery', 'a', P(t1.x + gap, T))
    const sw = b.at('cSwitch', 'a', P(at(bat, 'b').x + gap, T))
    const am = b.at('cAmmeter', 'a', P(at(sw, 'b').x + gap, T))
    const vm = b.at('cVoltmeter', 'a', P((t1.x + t2.x) / 2 - 30, M))
    const j1 = P(t1.x, M),
      j2 = P(t2.x, M)
    wire(b, t1, P(t1.x, T), at(bat, 'a'))
    wire(b, at(bat, 'b'), at(sw, 'a'))
    wire(b, at(sw, 'b'), at(am, 'a'))
    wire(b, at(am, 'b'), P(t2.x, T), t2)
    wire(b, j1, at(vm, 'a'))
    wire(b, at(vm, 'b'), j2)
    b.at('cJunction', 'c', j1)
    b.at('cJunction', 'c', j2)

    const L = left.x - 30,
      R = right.x + 30
    b.label('battery', L, T - 40, [bat, -17, 8])
    b.label('crocodile clip', L, wy - 20, [clip1, 6, 0.5])
    b.label('test wire', L, wy + 25, P(left.x - 4, wy))
    b.label('ammeter', R, T - 40, [am, 8.5, 11.5])
    b.label('metre ruler', R, ruler.y + 5, [ruler, ruler.w / 2, 11])
    return b.doc
  },
}

// ---------------------------------------------------------------- resistors in series and in parallel

/**
 * One circuit of resistorNetworks, built round its battery (already placed, terminal `a` at the top rail).
 * Top rail: battery, switch, ammeter. Bottom rail: the two resistors, in series or in parallel, between junctions J1 and J2.
 * The voltmeter is on a branch above them, inside the loop.
 */
function resistorCircuit(b: DocBuilder, bat: SymbolItem, parallel: boolean) {
  const W = 300,
    H = 130,
    gap = (W - 200) / 4
  const a = at(bat, 'a'),
    L = a.x - gap,
    T = a.y,
    R = L + W,
    B = T + H,
    M = B - 55,
    B2 = B + 50,
    cx = L + W / 2
  const sw = b.at('cSwitch', 'a', P(at(bat, 'b').x + gap, T))
  const am = b.at('cAmmeter', 'a', P(at(sw, 'b').x + gap, T))
  const j1 = P(cx - 100, B),
    j2 = P(cx + 100, B)
  const r1 = b.at('cResistor', 'a', P(parallel ? cx - 30 : cx - 75, B))
  const r2 = b.at('cResistor', 'a', parallel ? P(cx - 30, B2) : P(cx + 15, B))
  const vm = b.at('cVoltmeter', 'a', P(cx - 30, M))
  wire(b, a, P(L, T), P(L, B), at(r1, 'a'))
  wire(b, at(bat, 'b'), at(sw, 'a'))
  wire(b, at(sw, 'b'), at(am, 'a'))
  if (parallel) {
    wire(b, at(am, 'b'), P(R, T), P(R, B), at(r1, 'b'))
    wire(b, j1, P(j1.x, B2), at(r2, 'a'))
    wire(b, at(r2, 'b'), P(j2.x, B2), j2)
  } else {
    wire(b, at(am, 'b'), P(R, T), P(R, B), at(r2, 'b'))
    wire(b, at(r1, 'b'), at(r2, 'a'))
  }
  wire(b, j1, P(j1.x, M), at(vm, 'a'))
  wire(b, at(vm, 'b'), P(j2.x, M), j2)
  b.at('cJunction', 'c', j1)
  b.at('cJunction', 'c', j2)
  return { L, R, T, B, B2, cx, am, r1, r2 }
}

const resistorNetworks: TemplateDef = {
  id: 'resistorNetworks',
  title: 'Resistors in series and in parallel',
  group: 'Physics',
  refs: 'Trilogy RP 15',
  build() {
    const b = new DocBuilder('Resistors in series and in parallel')
    const bat1 = b.at('cBattery', 'a', P(0, 0))
    const s = resistorCircuit(b, bat1, false)
    const bat2 = b.on('cBattery', 'a', bat1, 'a', { dx: 440 })
    const p = resistorCircuit(b, bat2, true)
    b.label('battery', s.L - 25, s.T - 40, [bat1, -17, 8])
    b.label('resistor', s.L - 25, s.B + 40, [s.r1, -8, 26])
    b.label('ammeter', p.R + 25, p.T - 40, [p.am, 8.5, 11.5])
    b.label('resistor', p.R + 25, p.B2 + 40, [p.r2, 8, 26])
    b.label('resistors in series', centred('resistors in series', s.cx), p.B2 + 75)
    b.label('resistors in parallel', centred('resistors in parallel', p.cx), p.B2 + 75)
    return b.doc
  },
}

// ---------------------------------------------------------------- I-V characteristic

const ivCharacteristic: TemplateDef = {
  id: 'ivCharacteristic',
  title: 'I-V characteristic',
  group: 'Physics',
  refs: 'Trilogy RP 16',
  build() {
    const b = new DocBuilder('I-V characteristic')
    // Series loop: battery, variable resistor and ammeter along the top, the lamp along the bottom.
    const W = 300,
      H = 130,
      gap = (W - 200) / 4
    const bat = b.at('cBattery', 'a', P(0, 0))
    const a = at(bat, 'a'),
      L = a.x - gap,
      T = a.y,
      R = L + W,
      B = T + H,
      M = B - 55,
      cx = L + W / 2
    const vr = b.at('cVariableResistor', 'a', P(at(bat, 'b').x + gap, T))
    const am = b.at('cAmmeter', 'a', P(at(vr, 'b').x + gap, T))
    const lamp = b.at('cLamp', 'a', P(cx - 30, B))
    // The voltmeter in parallel with the lamp, on a branch above it.
    const vm = b.at('cVoltmeter', 'a', P(cx - 30, M))
    const j1 = P(cx - 70, B),
      j2 = P(cx + 70, B)
    wire(b, a, P(L, T), P(L, B), at(lamp, 'a'))
    wire(b, at(bat, 'b'), at(vr, 'a'))
    wire(b, at(vr, 'b'), at(am, 'a'))
    wire(b, at(am, 'b'), P(R, T), P(R, B), at(lamp, 'b'))
    wire(b, j1, P(j1.x, M), at(vm, 'a'))
    wire(b, at(vm, 'b'), P(j2.x, M), j2)
    b.at('cJunction', 'c', j1)
    b.at('cJunction', 'c', j2)

    b.label('variable resistor', L - 25, T - 80, [vr, -6, 14])
    b.label('battery', L - 25, T - 40, [bat, -17, 8])
    b.label('filament lamp', L - 25, B + 40, [lamp, -8.5, 28.5])
    b.label('ammeter', R + 25, T - 40, [am, 8.5, 11.5])
    return b.doc
  },
}

// ---------------------------------------------------------------- density of an irregular solid

const densityDisplacement: TemplateDef = {
  id: 'densityDisplacement',
  title: 'Density of an irregular solid',
  group: 'Physics',
  refs: 'Trilogy RP 17',
  build() {
    const b = new DocBuilder('Density of an irregular solid')
    const bench = b.at('benchLine', 'top', P(0, 0), { w: 380 })
    // Full to the spout: amount 0.75 (displacementCan recipe).
    const can = b.on('displacementCan', 'base', bench, 'top', { dx: -60, h: 170, contents: { main: [water(0.75)] } })
    // The cylinder stands on the bench with its mouth under the end of the spout.
    const spout = at(can, 'spout')
    const cyl = b.at('measuringCylinder', 'base', P(spout.x + 10, at(bench, 'top').y), { h: 100, contents: { main: [water(0.2)] } })
    // The solid hangs in the water on a thread. The thread goes in first, so that the solid hides its lower end.
    const base = at(can, 'base'),
      sc = P(base.x, base.y - 50),
      canTop = can.y - can.h / 2
    b.connector('line', [sc, P(sc.x, canTop - 45)])
    const solid = b.near('irregularSolid', can, 'base', { dy: -50 })

    const L = leftOf(can, 30),
      R = rightOf(cyl, 30)
    b.label('thread', L, canTop - 20, P(sc.x, canTop - 25))
    b.label('displacement can', L, canTop + 25, [can, -can.w / 2, 30])
    b.label('water', L, canTop + 70, [can, -30, 90])
    b.label('irregular solid', L, canTop + 115, [solid, -14, 17])
    b.label('measuring cylinder', R, cyl.y - 5, [cyl, 18, 40])
    b.label('displaced water', R, cyl.y + 40, [cyl, 8, 84])
    return b.doc
  },
}

// ---------------------------------------------------------------- density of a liquid

const densityLiquid: TemplateDef = {
  id: 'densityLiquid',
  title: 'Density of a liquid',
  group: 'Physics',
  refs: 'Trilogy RP 17',
  build() {
    const b = new DocBuilder('Density of a liquid')
    const balance = b.at('balance', 'base', P(0, 0), { params: { reading: '152.40 g' } })
    const params = { numbers: true }
    const g = geometry('measuringCylinder', 60, 190, params)
    const cyl = b.on('measuringCylinder', 'base', balance, 'pan', {
      params,
      contents: { main: [water(readingToAmount(g, 60) ?? 0.6, { meniscus: true })] },
    })
    const L = leftOf(balance, 20)
    b.label('measuring cylinder', L, cyl.y - 55, [cyl, -18, 40])
    b.label('liquid', L, cyl.y + 50, [cyl, -10, 140])
    b.label('top-pan balance', L, balance.y + 15, [balance, -84, 40])
    return b.doc
  },
}

// ---------------------------------------------------------------- force and extension of a spring

const springExtension: TemplateDef = {
  id: 'springExtension',
  title: 'Force and extension of a spring',
  group: 'Physics',
  refs: 'Trilogy RP 18',
  build() {
    const b = new DocBuilder('Force and extension of a spring')
    const stand = b.at('clampStand', 'base', P(0, 0))
    // A narrow jaw opening, so that the clamp holds the spring's top loop.
    const clamp = b.on('bossClamp', 'sleeve', stand, 'rod', { dy: -145, params: { grip: 14 } })
    const spring = b.on('spring', 'top', clamp, 'grip', { dy: -4 })
    const hanger = b.on('massHanger', 'hook', spring, 'bottom')
    // The ruler stands upright (its 300 u length) on the stand's base plate (9 u thick), between the rod and the spring.
    // Turned 90°, its scale edge faces the spring and 0 cm is at the top.
    const ruler = b.near('ruler', stand, 'base', { rot: 90, dx: -12, dy: -9 - 300 / 2 })
    // The pointer: from the bottom of the spring to the scale edge of the ruler.
    const end = at(spring, 'bottom'),
      scale = toWorld(ruler, P(0, 0)).x
    b.connector('line', [P(end.x - 4, end.y - 4), P(scale, end.y - 4)], { endCap: 'arrow' })

    const L = leftOf(stand, 15),
      R = rightOf(stand, 25)
    b.label('boss and clamp', L, clamp.y + 5, [clamp, -clamp.w / 2, 20])
    b.label('clamp stand', L, stand.y, [stand, -54, 180])
    b.label('spring', R, spring.y + 3, [spring, 13, 57.7]) // a corner of the zigzag (spring recipe, default size)
    b.label('slotted masses', R, hanger.y + 30, [hanger, 18, 85])
    b.label('ruler', R, stand.y + 120, [ruler, 99, 0])
    return b.doc
  },
}

// ---------------------------------------------------------------- force, mass and acceleration

/** The string from a point over the top of a pulley wheel and straight down. Its bend follows the wheel exactly. */
function overPulley(from: Pt, pulley: SymbolItem, downTo: number): Pt[] {
  const side = at(pulley, 'side'),
    top = at(pulley, 'top'),
    r = side.y - top.y,
    c = P(side.x - r, side.y) // wheel centre
  // The upper tangent from `from` to the wheel meets the vertical line x = c.x + r at the bend point.
  const dx = c.x - from.x,
    dy = c.y - from.y,
    phi = Math.atan2(dy, dx) - Math.asin(r / Math.hypot(dx, dy))
  const bend = P(c.x + r, from.y + (c.x + r - from.x) * Math.tan(phi))
  return [from, v(bend.x, bend.y, r), P(side.x, downTo)]
}

const acceleration: TemplateDef = {
  id: 'acceleration',
  title: 'Force, mass and acceleration',
  group: 'Physics',
  refs: 'Trilogy RP 19',
  build() {
    const b = new DocBuilder('Force, mass and acceleration')
    const bench = b.at('benchLine', 'top', P(0, 0), { w: 640 })
    const trolley = b.on('trolley', 'wheels', bench, 'top', { dx: -220, params: { card: true } })
    // The string must be parallel to the bench, so the top of the pulley wheel is level with the trolley's hook. The pulley
    // is clamped to the end of the bench, the bench edge in its slot. At its default size (50 × 70) the inner end of the slot
    // is 21 u left of and 53 u below the top of the wheel (pulley recipe), so the pulley is scaled by hook height / 53.
    const hook = at(trolley, 'front'),
      end = toWorld(bench, P(bench.w / 2, 0)),
      k = (end.y - hook.y) / 53,
      size = (n: number) => Math.round(n * k * 100) / 100
    const pulley = b.at('pulley', 'top', P(end.x + 21 * k, hook.y), { w: size(50), h: size(70) })
    const hanger = b.on('massHanger', 'hook', pulley, 'side', { dy: 60 })
    b.connector('line', overPulley(hook, pulley, at(hanger, 'hook').y))
    // Two light gates astride the track, added after the string so that their frames hide it where it passes through.
    // Their beams are at the height of the card.
    const gate1 = b.on('lightGate', 'base', bench, 'top', { dx: -40 })
    const gate2 = b.on('lightGate', 'base', bench, 'top', { dx: 140 })
    // Data logger above the trolley. The leads leave the gates to the left; the lead from the far gate runs higher.
    const l1 = at(gate1, 'lead'),
      l2 = at(gate2, 'lead')
    const logger = b.at('instrumentBox', 'a', P(trolley.x - 40, l1.y - 75), { params: { title: 'data logger', terminals: '2', reading: '0.00 s' } })
    const la = at(logger, 'a'),
      lb = at(logger, 'b')
    wire(b, l1, P(l1.x - 10, l1.y), P(l1.x - 10, l1.y - 17), P(la.x, l1.y - 17), la)
    wire(b, l2, P(l2.x - 10, l2.y), P(l2.x - 10, l2.y - 42), P(lb.x, l2.y - 42), lb)

    const L = toWorld(bench, P(-bench.w / 2, 0)).x - 15,
      R = rightOf(hanger, 40)
    b.label('data logger', L, logger.y + 5, [logger, -logger.w / 2, logger.h / 2])
    b.label('card', L, trolley.y - 35, [trolley, -15, -13])
    b.label('trolley', L, trolley.y + 5, [trolley, -trolley.w / 2, 13])
    b.label('light gate', R, gate2.y - 55, [gate2, gate2.w / 2, 5])
    const side = at(pulley, 'side'),
      rim = anchorOf(pulley, 'side')
    b.label('pulley', R, side.y + 5, [pulley, rim.x, rim.y])
    b.label('string', R, side.y + 45, P(side.x, side.y + 40))
    b.label('slotted masses', R, hanger.y + 35, [hanger, 18, 85])
    return b.doc
  },
}

// ---------------------------------------------------------------- waves in a ripple tank

const rippleTankWaves: TemplateDef = {
  id: 'rippleTankWaves',
  title: 'Waves in a ripple tank',
  group: 'Physics',
  refs: 'Trilogy RP 20',
  build() {
    const b = new DocBuilder('Waves in a ripple tank')
    // Water to the dipper bar, which touches the surface (rippleTank recipe: tray 26 deep, bar 6 u below its rim).
    const tank = b.at('rippleTank', 'base', P(0, 0), { contents: { main: [water(0.8)] } })
    // The ruler lies beside the screen, in front of it.
    const ruler = b.near('ruler', tank, 'base', { dy: 41 })
    const L = leftOf(tank, 15),
      R = rightOf(tank, 20),
      top = tank.y - tank.h / 2
    b.label('dipper', L, top + 100, [tank, -130, 111])
    b.label('water', L, top + 145, [tank, -120, 126])
    b.label('screen', L, top + tank.h + 16, [tank, -110, tank.h])
    b.label('lamp', R, top + 30, [tank, 9, 25])
    b.label('ripple tank', R, top + 120, [tank, tank.w / 2, 118])
    b.label('ruler', R, ruler.y + 5, [ruler, ruler.w / 2, 11])
    return b.doc
  },
}

// ---------------------------------------------------------------- waves on a string

const wavesOnString: TemplateDef = {
  id: 'wavesOnString',
  title: 'Waves on a string',
  group: 'Physics',
  refs: 'Trilogy RP 20',
  build() {
    const b = new DocBuilder('Waves on a string')
    const bench = b.at('benchLine', 'top', P(0, 0), { w: 560 })
    // The string runs level at the top of the pulley wheel: 53 u above the bench when the bench edge is in the clamp's slot.
    // The generator pin and the bridge apex are made the same height.
    const STRING = 53
    const end = toWorld(bench, P(bench.w / 2, 0))
    const pulley = b.at('pulley', 'top', P(end.x + 21, end.y - STRING))
    const gen = b.on('vibrationGenerator', 'base', bench, 'top', { dx: -200, h: STRING })
    const bridge = b.on('woodenBridge', 'base', bench, 'top', { dx: 170, w: 34, h: STRING })
    const hanger = b.on('massHanger', 'hook', pulley, 'side', { dy: 70 })
    b.connector('line', overPulley(at(gen, 'pin'), pulley, at(hanger, 'hook').y))
    // Signal generator above the vibration generator. Both leads come down onto its front left of the pin, so that neither
    // crosses the string; the second lead then runs above the first terminal to the second.
    const pin = at(gen, 'pin'),
      tA = at(gen, 'terminalA'),
      tB = at(gen, 'terminalB'),
      drop = pin.x - 12
    const sg = b.at('instrumentBox', 'b', P(drop, pin.y - 60), { params: { title: 'signal generator', terminals: '2', reading: '50 Hz' } })
    const sa = at(sg, 'a')
    wire(b, sa, P(sa.x, pin.y - 22), P(tA.x, pin.y - 22), tA)
    wire(b, at(sg, 'b'), P(drop, tA.y - 10), P(tB.x, tA.y - 10), tB)

    const L = leftOf(sg, 25),
      R = rightOf(hanger, 40),
      side = at(pulley, 'side')
    b.label('signal generator', L, sg.y + 5, [sg, -sg.w / 2, sg.h / 2])
    b.label('vibration generator', L, gen.y + 15, [gen, -gen.w / 2, gen.h / 2 + 10])
    b.label('wooden bridge', R, side.y - 70, [bridge, 0, 1])
    b.label('pulley', R, side.y + 5, [pulley, 22, 18])
    b.label('string', R, side.y + 45, P(side.x, side.y + 40))
    b.label('slotted masses', R, hanger.y + 35, [hanger, 18, 85])
    return b.doc
  },
}

// ---------------------------------------------------------------- infrared radiation

const infraredRadiation: TemplateDef = {
  id: 'infraredRadiation',
  title: 'Infrared radiation from surfaces',
  group: 'Physics',
  refs: 'Trilogy RP 21',
  build() {
    const b = new DocBuilder('Infrared radiation from surfaces')
    const mat = b.at('heatproofMat', 'under', P(0, 0))
    const cube = b.on('leslieCube', 'base', mat, 'top', { contents: { main: [water(0.85)] } })
    // The detector points at the right face, below the water surface, a little above the middle of the face.
    const face = toWorld(cube, P(cube.w / 2, 50))
    const det = b.at('infraredDetector', 'sensor', P(face.x + 170, face.y))
    // Ruler on the bench between them. The dimension line runs from the face to the front of the detector, under the
    // detector, so that the tick at the detector end shows; the tick at the face end lies on the face.
    const ruler = b.near('ruler', mat, 'under', { dx: mat.w / 2 + 10 + 120, dy: -11, w: 240 })
    const sensor = at(det, 'sensor'),
      dimY = sensor.y + det.h / 2 + 12
    b.connector('line', [P(face.x, dimY), P(sensor.x, dimY)], { startCap: 'tick', endCap: 'tick' })
    b.label('distance', centred('distance', (face.x + sensor.x) / 2), dimY - 8)

    const L = leftOf(mat, 20),
      R = rightOf(ruler, 20)
    b.label('Leslie cube', L, cube.y - 25, [cube, -cube.w / 2, 30])
    b.label('hot water', L, cube.y + 20, [cube, -35, 70])
    b.label('heatproof mat', L, mat.y + 5, [mat, -80, 4])
    b.label('infrared detector', R, det.y + 8, [det, det.w / 2, 17])
    b.label('ruler', R, ruler.y + 2, [ruler, ruler.w / 2, 11])
    return b.doc
  },
}

export const physics: TemplateDef[] = [
  specificHeatCapacity,
  resistanceWire,
  resistorNetworks,
  ivCharacteristic,
  densityDisplacement,
  densityLiquid,
  springExtension,
  acceleration,
  rippleTankWaves,
  wavesOnString,
  infraredRadiation,
]
