// demo.ts — the style reference picture. It uses every pilot symbol and every kernel feature.
// `npm run sheet` writes it to out/reference.png. New symbols must match this look.

import { P, v } from './kernel/geom'
import type { Layer } from './kernel/contents'
import { DocBuilder, anchorWorld } from './model/build'
import type { Doc } from './model/types'
import { geometry } from './symbols/registry'
import { readingToAmount } from './symbols/scale'

// Colours are presets from section 9 of the specification.
const WATER = '#cfe8f7'
const COLOURLESS = '#e9f1f5'
const OIL = '#f3d9a8'
const BLUE_PRECIPITATE = '#8fbfe8'
const water = (amount: number, extra: Partial<Layer> = {}): Layer => ({ kind: 'liquid', amount, colour: WATER, ...extra })

export function demoDoc(): Doc {
  const b = new DocBuilder('Style reference')
  const floor = 330

  // --- 1. Gas collection over water: tube, bung, inverted cylinder, lumps, bubbles ---
  const flask = b.at('conicalFlask', 'base', P(190, floor), {
    contents: {
      main: [
        { kind: 'lumps', amount: 0.1, colour: '#e9e9e9' },
        { kind: 'liquid', amount: 0.24, colour: COLOURLESS, bubbles: 'few' },
      ],
    },
  })
  const trough = b.at('trough', 'base', P(500, floor), { contents: { main: [water(0.62)] } })
  // Upside down: the reading at the water surface is the volume of gas collected (34 cm³).
  const cyl = b.at('measuringCylinder', 'mouth', P(535, floor - 22), { rot: 180, h: 170 })
  cyl.contents = { main: [water(readingToAmount(geometry('measuringCylinder', 60, 170), 34, true) ?? 0.66)] }
  b.on('bung', 'plug', flask, 'mouth')
  const mouth = anchorWorld(flask, 'mouth')
  b.connector('glassTube', [
    v(190, mouth.y + 46),
    v(190, mouth.y - 62, 14),
    v(410, mouth.y - 62, 14),
    v(410, floor - 30, 12),
    v(535, floor - 30, 12),
    v(535, floor - 58),
  ])
  b.label('dilute HCl(aq)', 118, 262, [flask, -22, 112])
  b.label('CaCO3 chips', 104, 352, [flask, -18, 143])
  b.label('delivery tube', 290, 100, P(300, 118), { side: 'right' })
  b.label('34 cm3 of CO2', 600, 195, [cyl, 0, 140])
  b.label('100 cm3 measuring cylinder', 600, 228, [cyl, -18, 80])
  b.label('trough of water', 470, 362, [trough, -54, 80], { side: 'right' })

  // --- 2. Heating water: every part placed by anchors ---
  const mat = b.at('heatproofMat', 'under', P(150, 760))
  const tripod = b.on('tripod', 'feet', mat, 'top')
  const burner = b.on('bunsenBurner', 'base', mat, 'top')
  const gauze = b.on('gauze', 'under', tripod, 'top')
  const beaker = b.on('beaker', 'base', gauze, 'top', { params: { graduations: true }, contents: { main: [water(0.6)] } })
  const thermo = b.on('thermometer', 'bulb', beaker, 'base', { dx: 16, dy: -12, h: 200 })
  thermo.contents = { main: [{ kind: 'liquid', amount: readingToAmount(geometry('thermometer', 9, 200), 60) ?? 0.5, colour: '#d33333' }] }
  b.label('thermometer', 240, 470, [thermo, 4.5, 40])
  b.label('250 cm3\nbeaker', 240, 540, [beaker, 50, 40])
  b.label('gauze', 250, 642, [gauze, 68, 2.5])
  b.label('tripod', 250, 676, [tripod, 56, 50])
  b.label('Bunsen burner', 250, 712, [burner, 10, 94])
  const gas = anchorWorld(burner, 'gas')
  b.connector('rubberTube', [v(gas.x - 4, gas.y), v(gas.x + 70, gas.y, 14), v(gas.x + 92, gas.y + 24, 14), v(gas.x + 150, gas.y + 24)])
  b.label('to gas tap', gas.x + 158, gas.y + 29)

  // --- 3. The surface stays level when a vessel turns ---
  ;[0, 30, 60].forEach((rot, i) => b.symbol('roundBottomFlask', { x: 700 + i * 98, y: 88, rot, w: 84, h: 116, contents: { main: [water(0.36)] } }))

  // --- 4. Layers, powder, scales with a set reading, a second cavity ---
  b.symbol('testTube', { x: 420, y: 500, rot: -40, w: 26, h: 130, contents: { main: [{ kind: 'powder', amount: 0.25, colour: BLUE_PRECIPITATE }] } })
  b.symbol('boilingTube', {
    x: 505,
    y: 495,
    contents: {
      main: [
        { kind: 'liquid', amount: 0.3, colour: WATER }, // the aqueous layer is the lower one
        { kind: 'liquid', amount: 0.3, colour: OIL },
      ],
    },
  })
  b.symbol('filterFunnel', { x: 620, y: 470, contents: { main: [{ kind: 'liquid', amount: 0.7, colour: '#b9d7ee' }] } })
  const lc = b.symbol('liebigCondenser', { x: 560, y: 680, rot: 18, contents: { jacket: [water(1)] } })
  b.label('water out', 440, 598, [lc, -83, 4])
  b.label('water in', 690, 772, [lc, 83, 66], { leaderEnd: 'arrow' })
  const bur = b.symbol('burette', { x: 760, y: 420, h: 330, params: { numbers: true } })
  bur.contents = { main: [water(readingToAmount(geometry('burette', 18, 330, { numbers: true }), 8.5) ?? 0.7, { meniscus: true })] }
  const mc = b.symbol('measuringCylinder', { x: 880, y: 470, w: 100, h: 230, params: { numbers: true, capacity: '50' } })
  mc.contents = { main: [water(readingToAmount(geometry('measuringCylinder', 100, 230, { numbers: true, capacity: '50' }), 32) ?? 0.5, { meniscus: true })] }
  b.label('Cu2+(aq) + 2OH-(aq) -> Cu(OH)2(s)', 330, 410)

  // --- 5. Clamp stand and clamp ---
  const stand = b.at('clampStand', 'base', P(905, 790), { w: 120, h: 170 })
  b.on('bossClamp', 'sleeve', stand, 'rod', { dy: -40, w: 96 })
  return b.doc
}

export const DEMO_SIZE = { w: 1000, h: 800 }
