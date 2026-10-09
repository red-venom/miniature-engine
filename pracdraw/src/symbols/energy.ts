// energy.ts — energy diagrams: the reaction profile (release 1.2).
//
// The picture is drawn from a model. `profileModel(w, h, params)` is a pure function that returns the energies of the levels, where each
// is drawn, the two curves (as cubic Bézier segments), the two arrows and the labels. `energy.science.test.ts` tests the model (the products
// are below the reactants for an exothermic reaction and above for an endothermic one, the peak is above both, a catalyst lowers the peak and
// leaves the ends alone, the curve has no kink) and checks that the drawing agrees with it.

import { Path, f, type Pt } from '../kernel/geom'
import { bool, str } from './kit'
import type { Prim, SymbolDef, SymbolText } from './types'

export type ProfileType = 'exothermic' | 'endothermic'
export type LevelLabels = 'words' | 'formulae' | 'blank'

export interface ProfileParams {
  type: ProfileType
  catalyst: boolean
  activation: boolean
  change: boolean
  levels: LevelLabels
}

/** A cubic Bézier segment. */
export interface Bezier {
  p0: Pt
  c1: Pt
  c2: Pt
  p1: Pt
}

/** A vertical arrow from (x, from) to (x, to). `both` puts a head at each end; otherwise the head is at `to`. */
export interface VArrow {
  x: number
  from: number
  to: number
  both: boolean
}

export interface LevelLabel {
  /** What is written, in label markup. Empty when the label is a line to write on. */
  text: string
  /** The end of the text that is fixed. For a line to write on, the line starts or ends here. */
  x: number
  y: number
  anchor: 'start' | 'end'
}

export interface ProfileModel {
  w: number
  h: number
  params: ProfileParams
  /** The energies in arbitrary units, up the page. The axis is 0. */
  energy: { reactants: number; products: number; peak: number; catalysed: number }
  /** Where each level is drawn: y in the symbol's frame (down the page). */
  y: { axis: number; reactants: number; products: number; peak: number; catalysed: number }
  /** The axes: the corner, the tip of the vertical axis and the tip of the horizontal axis. */
  axes: { origin: Pt; top: Pt; right: Pt }
  /** The curve: a flat reactants level from the vertical axis to `rise.p0`, the rise, the fall, and a flat products level to `end`. */
  curve: { start: Pt; rise: Bezier; fall: Bezier; end: Pt }
  /** The dashed curve of the catalysed route: the same ends, a lower peak. */
  catalysed: { rise: Bezier; fall: Bezier } | null
  /** The dashed line that carries the reactants level across to the arrows. */
  levelLine: { x0: number; x1: number; y: number }
  activation: VArrow | null
  change: VArrow | null
  labels: { reactants: LevelLabel; products: LevelLabel }
}

/** The energies (arbitrary units) of the two kinds of reaction. The peak is the same, so that the two pictures are alike. */
const ENERGY: Record<ProfileType, { reactants: number; products: number; peak: number }> = {
  exothermic: { reactants: 68, products: 36, peak: 100 },
  endothermic: { reactants: 36, products: 68, peak: 100 },
}
/** How far up between the higher level and the peak the catalysed route climbs. */
const CATALYST = 0.5

/** The formulae that label the levels, for a reaction of each kind: methane burns, and calcium carbonate is heated. */
export const FORMULAE: Record<ProfileType, { reactants: string; products: string }> = {
  exothermic: { reactants: 'CH_4 + 2O_2', products: 'CO_2 + 2H_2O' },
  endothermic: { reactants: 'CaCO_3', products: 'CaO + CO_2' },
}

/** The size of text in the picture, and of the arrowheads: marks do not scale with the symbol (rule S3). */
const TEXT = 14
const AXIS_HEAD = { length: 9, half: 3.7 }
const ARROW_HEAD = { length: 7.5, half: 3 }
/** The length of the line to write on, in u. */
const RULE = 80

/** A filled arrowhead (a closed triangle for the role `ink`) with its tip at (x, y), pointing along the unit vector (ux, uy). */
export function arrowHeadD(x: number, y: number, ux: number, uy: number, length: number, half: number): string {
  const bx = x - ux * length,
    by = y - uy * length
  return `M${f(x)} ${f(y)}L${f(bx - uy * half)} ${f(by + ux * half)}L${f(bx + uy * half)} ${f(by - ux * half)}Z`
}

/** The point of a Bézier segment at t from 0 to 1. */
export function bezierAt(b: Bezier, t: number): Pt {
  const u = 1 - t,
    a = u * u * u,
    c = 3 * u * u * t,
    d = 3 * u * t * t,
    e = t * t * t
  return { x: a * b.p0.x + c * b.c1.x + d * b.c2.x + e * b.p1.x, y: a * b.p0.y + c * b.c1.y + d * b.c2.y + e * b.p1.y }
}

/**
 * A hill from (x0, y0) to (x1, y1) as a Bézier segment. Both ends are level: the tangent is horizontal there, so the segments of the curve
 * join without a kink. `lead` is how much of the run the control point at the foot takes, and `crown` how much the one at the other end
 * takes; a smaller `crown` makes the top rounder.
 */
const hill = (x0: number, y0: number, x1: number, y1: number, lead: number, crown: number): Bezier => ({
  p0: { x: x0, y: y0 },
  c1: { x: x0 + (x1 - x0) * lead, y: y0 },
  c2: { x: x1 - (x1 - x0) * crown, y: y1 },
  p1: { x: x1, y: y1 },
})

export function profileModel(w: number, h: number, params: ProfileParams): ProfileModel {
  const e = ENERGY[params.type]
  const left = -w / 2 + 30,
    right = w / 2 - 8,
    axis = h - 32,
    top = 28
  const scale = (axis - top - 16) / 100 // u for each unit of energy
  const y = (energy: number) => axis - energy * scale
  const higher = Math.max(e.reactants, e.products)
  const energies = { ...e, catalysed: higher + CATALYST * (e.peak - higher) }
  const span = right - 14 - left
  // The hill has the proportions of the picture, and never gets narrower than the labels need.
  const x1 = left + Math.max(0.17 * span, 36),
    xp = x1 + Math.max(0.19 * span, 38),
    x2 = xp + Math.max(0.22 * span, 46),
    end = left + span - 2
  const yy = { axis, reactants: y(e.reactants), products: y(e.products), peak: y(e.peak), catalysed: y(energies.catalysed) }
  const route = (peak: number) => ({
    rise: hill(x1, yy.reactants, xp, peak, 0.5, 0.35),
    fall: hill(xp, peak, x2, yy.products, 0.35, 0.5),
  })
  const exo = params.type === 'exothermic'
  const xc = end - 14
  const label = (kind: 'reactants' | 'products'): LevelLabel => {
    const words = params.levels === 'formulae' ? FORMULAE[params.type][kind] : kind
    // Below its level, except the products of an endothermic reaction (the higher level), which are above it.
    const above = kind === 'products' && !exo
    return {
      text: params.levels === 'blank' ? '' : words,
      x: kind === 'reactants' ? left + 10 : end,
      y: yy[kind] + (above ? -9 : 17),
      anchor: kind === 'reactants' ? 'start' : 'end',
    }
  }
  return {
    w,
    h,
    params,
    energy: energies,
    y: yy,
    axes: { origin: { x: left, y: axis }, top: { x: left, y: top }, right: { x: right, y: axis } },
    curve: { start: { x: left, y: yy.reactants }, ...route(yy.peak), end: { x: end, y: yy.products } },
    catalysed: params.catalyst ? route(yy.catalysed) : null,
    levelLine: { x0: x1, x1: xc + 6, y: yy.reactants },
    activation: params.activation ? { x: xp, from: yy.reactants, to: yy.peak, both: true } : null,
    change: params.change ? { x: xc, from: yy.reactants, to: yy.products, both: false } : null,
    labels: { reactants: label('reactants'), products: label('products') },
  }
}

// ---------------------------------------------------------------- the picture

/** A vertical arrow: the shaft in `shaft` and the head or heads in `heads`. The shaft stops at the foot of each head. */
function verticalArrow(a: VArrow): { shaft: string; heads: string } {
  const dir = Math.sign(a.to - a.from) || 1
  const foot = a.to - dir * ARROW_HEAD.length * 0.9
  const start = a.both ? a.from + dir * ARROW_HEAD.length * 0.9 : a.from
  return {
    shaft: `M${f(a.x)} ${f(start)}L${f(a.x)} ${f(foot)}`,
    heads:
      arrowHeadD(a.x, a.to, 0, dir, ARROW_HEAD.length, ARROW_HEAD.half) + (a.both ? arrowHeadD(a.x, a.from, 0, -dir, ARROW_HEAD.length, ARROW_HEAD.half) : ''),
  }
}

function bezierPath(path: Path, b: Bezier): Path {
  return path.C(b.c1.x, b.c1.y, b.c2.x, b.c2.y, b.p1.x, b.p1.y)
}

export function profilePrims(m: ProfileModel): { prims: Prim[]; texts: SymbolText[] } {
  const { origin, top, right } = m.axes
  // The axes stop at the foot of their heads.
  const prims: Prim[] = [
    { d: `M${f(origin.x)} ${f(top.y + AXIS_HEAD.length * 0.9)}V${f(origin.y)}H${f(right.x - AXIS_HEAD.length * 0.9)}`, role: 'outline' },
    {
      d: arrowHeadD(top.x, top.y, 0, -1, AXIS_HEAD.length, AXIS_HEAD.half) + arrowHeadD(right.x, right.y, 1, 0, AXIS_HEAD.length, AXIS_HEAD.half),
      role: 'ink',
    },
  ]
  const c = m.curve
  prims.push({
    d: bezierPath(bezierPath(new Path().M(c.start.x, c.start.y).L(c.rise.p0.x, c.rise.p0.y), c.rise), c.fall)
      .L(c.end.x, c.end.y)
      .d(),
    role: 'outline',
  })
  const lv = m.levelLine
  prims.push({ d: `M${f(lv.x0)} ${f(lv.y)}H${f(lv.x1)}`, role: 'dashed' })
  if (m.catalysed)
    prims.push({
      d: bezierPath(bezierPath(new Path().M(m.catalysed.rise.p0.x, m.catalysed.rise.p0.y), m.catalysed.rise), m.catalysed.fall).d(),
      role: 'dashed',
    })
  const shafts: string[] = [],
    heads: string[] = []
  for (const a of [m.activation, m.change]) {
    if (!a) continue
    const arrow = verticalArrow(a)
    shafts.push(arrow.shaft)
    heads.push(arrow.heads)
  }
  if (shafts.length) prims.push({ d: shafts.join(''), role: 'detail' }, { d: heads.join(''), role: 'ink' })
  const texts: SymbolText[] = [
    { x: origin.x, y: top.y - 12, text: 'Energy', size: TEXT, anchor: 'middle' },
    { x: (origin.x + right.x) / 2, y: m.h - 8, text: 'Progress of reaction', size: TEXT, anchor: 'middle' },
  ]
  const rules: string[] = []
  for (const l of [m.labels.reactants, m.labels.products]) {
    if (l.text) texts.push({ x: l.x, y: l.y, text: l.text, size: TEXT, anchor: l.anchor })
    else rules.push(`M${f(l.x)} ${f(l.y)}h${l.anchor === 'start' ? RULE : -RULE}`)
  }
  if (rules.length) prims.push({ d: rules.join(''), role: 'detail' })
  return { prims, texts }
}

export const reactionProfile: SymbolDef = {
  id: 'reactionProfile',
  name: 'Reaction profile',
  aliases: ['energy level diagram', 'energy profile', 'exothermic endothermic diagram'],
  pack: 'energy',
  size: { w: 260, h: 170 },
  resize: 'free',
  min: { w: 230, h: 160 },
  params: [
    {
      key: 'type',
      label: 'Type',
      type: 'choice',
      default: 'exothermic',
      options: [
        { value: 'exothermic', label: 'Exothermic' },
        { value: 'endothermic', label: 'Endothermic' },
      ],
    },
    { key: 'catalyst', label: 'Catalyst', type: 'boolean', default: false },
    { key: 'activation', label: 'Activation energy arrow', type: 'boolean', default: true },
    { key: 'change', label: 'Overall energy change arrow', type: 'boolean', default: true },
    {
      key: 'levels',
      label: 'Level labels',
      type: 'choice',
      default: 'words',
      options: [
        { value: 'words', label: 'Words' },
        { value: 'formulae', label: 'Formulae' },
        { value: 'blank', label: 'Blank lines' },
      ],
    },
  ],
  build({ w, h, p }) {
    const m = profileModel(w, h, {
      type: str(p.type, 'exothermic') as ProfileType,
      catalyst: bool(p.catalyst, false),
      activation: bool(p.activation, true),
      change: bool(p.change, true),
      levels: str(p.levels, 'words') as LevelLabels,
    })
    return profilePrims(m)
  },
}

export const energy: SymbolDef[] = [reactionProfile]
