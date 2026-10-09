// atoms.ts — atoms and ions: Bohr atoms, models of the atom, nuclide notation, isotopes, alpha scattering (release 1.2).
// The symbols are in the plan in spec/catalogue.json (priority C).
//
// Each picture is made from a data model that this file exports (bohrModel, atomModel, nuclide, isotopeModel, alphaModel). The drawing reads
// the model and nothing else, so that atoms.science.test.ts can test the science on the model (electrons = Z minus the charge, the shells fill
// 2, 8, 8, 2, neutrons = A minus Z, no alpha path enters a nucleus) and then check that the geometry agrees with it (it counts the marks).
//
// BOX SIZE OF A BOHR ATOM. The atom fills its box: the outermost shell has radius w / 2 − 8 u (a further 18 u less for an ion, which has its
// brackets in that room), and the shells are evenly spaced between the nucleus (14 u) and that circle. A recipe should therefore size the box
// by the number of shells that are drawn: width = height = 38 + 44 × shells, which is 82, 126, 170 and 214 u for one to four shells. The shells
// are then 19 to 21 u apart. In a smaller box the atom keeps its shells 9 u apart at least and so grows beyond the box (never by 45 u).

import { P, dist, f, rng, type Pt } from '../kernel/geom'
import { hatchD } from '../kernel/hatch'
import { SCRIPT } from '../kernel/nodes'
import { parseMarkup } from '../kernel/text'
import { CROSS_ARM, DOT_R, bracketD, electronPrims, ringPoints } from './electrons'
import { element, ionShells, shellString, type Element } from './elements'
import { bool, circle, num, str } from './kit'
import type { ParamValue, Prim, SymbolDef, SymbolText } from './types'

// ---------------------------------------------------------------- shared helpers

const deg = (a: number): number => (a * Math.PI) / 180
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
/** A whole number from a parameter. A file can hold anything: a value that is not a finite number becomes `fallback`. */
const int = (n: number, fallback = 0): number => (Number.isFinite(n) ? Math.round(n) : fallback)
/** The element for an atomic number that a parameter gave (1 to 36; anything else is moved into the table). */
const elementOf = (z: number): Element => element(clamp(int(z, 1), 1, 36))!

/**
 * The widths of Arial in thousandths of an em (the rule S11 font), for the few places where a drawing needs to know how wide its text is:
 * a charge placed after a symbol, a block of lines centred under a picture. The renderer measures nothing, so this is the stand-in.
 */
const ARIAL = new Map<string, number>(
  (
    'A667 B667 C722 D722 E667 F611 G778 H722 I278 J500 K667 L556 M833 N722 O778 P667 Q778 R722 S667 T611 U722 V667 W944 X667 Y667 Z611 ' +
    'a556 b556 c500 d556 e556 f278 g556 h556 i222 j222 k500 l222 m833 n556 o556 p556 q556 r333 s500 t278 u556 v500 w722 x500 y500 z500'
  )
    .split(' ')
    .map((s) => [s[0], Number(s.slice(1))]),
)
function glyphWidth(ch: string): number {
  if (/\d/.test(ch)) return 0.556
  if (ch === '+' || ch === '−') return 0.584
  if (ch === '-') return 0.333
  if (ch === ' ') return 0.278
  return (ARIAL.get(ch) ?? 556) / 1000
}
/** The width of a line of text in the label markup, as the renderer draws it (a superscript or a subscript is drawn at 0.7 size). */
export function textWidth(markup: string, size: number): number {
  return parseMarkup(markup).reduce((w, r) => w + [...r.text].reduce((s, ch) => s + glyphWidth(ch), 0) * size * (r.script === 'normal' ? 1 : SCRIPT.scale), 0)
}

/** How far the cap height of Arial reaches above the baseline, and half of it: text is centred on a point by dropping its baseline this far. */
const CAP = 0.716

/**
 * The mark of an electron. The Bohr atom has dots and crosses (rule S6: the marks tell the electrons of two atoms apart). The models of the
 * atom before Bohr's also have a minus sign: an electron that is a small circle with a minus sign in it, white, so that it hides the ring or the
 * hatch that it sits on.
 */
export type Mark = 'dot' | 'cross' | 'minus'
/** The circle of an electron with a minus sign, and the arm of the sign inside it, in u. */
export const MINUS_R = 4.6
export const MINUS_ARM = 2.4

/** An electron as drawn: where it is, its angle on its ring (degrees clockwise from +x, -90 at the top) and its mark. */
export interface Electron {
  x: number
  y: number
  angle: number
  mark: Mark
}

/** Half the length, in u, of the gap that a mark needs in a ring that passes through it. A dot and a circled minus sign cover the ring themselves. */
const MARK_GAP: Record<Mark, number> = { dot: 0, cross: CROSS_ARM * Math.SQRT2 + 1.8, minus: 0 }

/**
 * A ring of radius r about (cx, cy) as one path. A cross that sits on the ring would be lost in its line, so the ring is broken round each
 * such mark (`gaps`: the angle of the mark and the half length of the gap). With no gap it is a whole circle.
 */
function ringD(cx: number, cy: number, r: number, gaps: readonly { angle: number; half: number }[]): string {
  if (!gaps.length) return circle(cx, cy, r)
  const g = gaps.map(({ angle, half }) => ({ a: ((angle % 360) + 360) % 360, d: (half / r) * (180 / Math.PI) })).sort((p, q) => p.a - q.a)
  const at = (a: number) => `${f(cx + r * Math.cos(deg(a)))} ${f(cy + r * Math.sin(deg(a)))}`
  let d = ''
  g.forEach((gap, i) => {
    const next = g[(i + 1) % g.length]
    const from = gap.a + gap.d
    const to = (i + 1 < g.length ? next.a : next.a + 360) - next.d
    if (to - from >= 1) d += `M${at(from)}A${f(r)} ${f(r)} 0 ${to - from > 180 ? 1 : 0} 1 ${at(to)}`
  })
  return d
}

/** The gaps that a ring needs for the electrons on it. */
const gapsOf = (es: readonly Electron[]): { angle: number; half: number }[] =>
  es.filter((e) => MARK_GAP[e.mark] > 0).map((e) => ({ angle: e.angle, half: MARK_GAP[e.mark] }))

const minusD = (x: number, y: number): string => `M${f(x - MINUS_ARM)} ${f(y)}H${f(x + MINUS_ARM)}`

/** The prims of a set of electron marks: dots (role ink), crosses (role detail), and circles with a minus sign in them (role solid, then detail). */
function markPrims(es: readonly Electron[]): Prim[] {
  const at = (m: Mark): Pt[] => es.filter((e) => e.mark === m).map((e) => P(e.x, e.y))
  const minus = at('minus')
  const prims = [...electronPrims(at('dot'), 'dot'), ...electronPrims(at('cross'), 'cross')]
  if (minus.length)
    prims.push({ d: minus.map((p) => circle(p.x, p.y, MINUS_R)).join(''), role: 'solid' }, { d: minus.map((p) => minusD(p.x, p.y)).join(''), role: 'detail' })
  return prims
}

/** `count` electrons evenly spaced on a ring, the first at the top, all with the same mark. */
function ringElectrons(cx: number, cy: number, r: number, count: number, mark: Mark): Electron[] {
  return ringPoints(cx, cy, r, count).map((p, i) => ({ x: p.x, y: p.y, angle: -90 + (360 * i) / count, mark }))
}

/** A plus sign centred on (x, y), arm u to each side. */
const plusD = (x: number, y: number, arm: number): string => `M${f(x - arm)} ${f(y)}H${f(x + arm)}M${f(x)} ${f(y - arm)}V${f(y + arm)}`

/**
 * A tint with the hatch that stands in for it on a photocopy (what `tinted` makes), with the hatch left out inside `holes` (closed shapes):
 * for a mark that is drawn on the tint and would be lost among the hatch lines.
 */
function tintedClear(d: string, holes: string): Prim[] {
  const hatch = hatchD(d + holes)
  return hatch
    ? [
        { d, role: 'tint' },
        { d: hatch, role: 'hatch' },
      ]
    : [{ d, role: 'tint' }]
}

// ---------------------------------------------------------------- the Bohr atom

/** The sizes of a Bohr atom, in u. They are marks and text: they do not scale with the box (rule S3). */
export const BOHR = {
  /** The nucleus, and the radius from which the shells are spaced. */
  nucleusR: 14,
  /** A nucleus that holds two lines of numbers is larger, so that they fit; the shells stay where they are. */
  numbersR: 19,
  /** The room between the outermost shell and the edge of the box, and the 18 u more that an ion needs for its brackets. */
  margin: 8,
  ionRoom: 18,
  /** The brackets stand this far outside the outermost shell, and their arms reach this far in. */
  bracketGap: 10,
  bracketArm: 8,
  /** The least distance between two shells (dots 5.2 u across): a box that is too small makes the atom larger, not crowded. */
  minGap: 9,
  /** The first shell is at least this far outside a nucleus that is larger than 14 u (the nucleus of the numbers). */
  nucleusGap: 6,
  /** Text sizes: the element symbol, the numbers of protons and neutrons, the charge (its superscript is drawn at 0.7 of this: 12.6 u), the electron structure. */
  symbolSize: 16,
  numbersSize: 12,
  chargeSize: 18,
  structureSize: 12,
  /** The electron structure is written under the atom, and the atom is this much smaller (in diameter) to make room. */
  structureRoom: 14,
} as const

export interface BohrOptions {
  /** The box. */
  w: number
  h: number
  nucleus: 'symbol' | 'numbers' | 'blank'
  mark: 'dot' | 'cross'
  /** Draw only the outermost shell and its electrons. */
  outerOnly: boolean
  /** The last k electrons of the outermost shell get the other mark. */
  otherMarks: number
  /** Write the electron structure (2,8,1) under the atom. */
  structure: boolean
}

export interface BohrShell {
  radius: number
  electrons: Electron[]
}

export interface PlacedText {
  text: string
  x: number
  y: number
  size: number
}

export interface BohrModel {
  z: number
  symbol: string
  name: string
  /** The charge that was asked for, and the charge that is drawn: 0 when the element cannot have the one asked for (`ionShells` refuses it). */
  asked: number
  charge: number
  /** The electrons on each shell of the atom or ion, innermost first: `ionShells`, never typed. */
  structure: number[]
  /** The centre of the atom, in the symbol's frame. */
  cx: number
  cy: number
  nucleus: { r: number; texts: PlacedText[] }
  /** The shells that are drawn: all of them, or only the outermost one. */
  shells: BohrShell[]
  /** Every electron mark that is drawn, shell by shell. */
  electrons: Electron[]
  /** The square brackets of an ion. */
  bracket: null | { x0: number; y0: number; x1: number; y1: number; arm: number }
  /** The charge at the top right of the brackets, in the label markup (`^{2+}`). */
  chargeText: null | PlacedText
  /** The electron structure under the atom. */
  structureText: null | PlacedText
}

/** The charge as a superscript in the label markup: `^{+}`, `^{2+}`, `^{-}`, `^{3-}` (a hyphen in a superscript is drawn as a true minus sign). */
export const chargeMarkup = (charge: number): string => `^{${Math.abs(charge) > 1 ? Math.abs(charge) : ''}${charge > 0 ? '+' : '-'}}`

/** The names of the simple negative ions of the first 36 elements ("chloride", not "chlorine ion"). */
const ANION: Record<string, string> = {
  H: 'hydride',
  B: 'boride',
  C: 'carbide',
  N: 'nitride',
  O: 'oxide',
  F: 'fluoride',
  Si: 'silicide',
  P: 'phosphide',
  S: 'sulfide',
  Cl: 'chloride',
  As: 'arsenide',
  Se: 'selenide',
  Br: 'bromide',
}

/** "sodium atom", "sodium ion", "chloride ion". A charge that the element cannot have is a neutral atom. */
export function bohrLabel(z: number, charge: number): string {
  const e = elementOf(z)
  const c = int(charge)
  if (!c || !ionShells(e, c)) return `${e.name} atom`
  return `${c < 0 ? (ANION[e.symbol] ?? e.name) : e.name} ion`
}

/**
 * The model of a Bohr atom or ion: which shells, which electrons on them and where, which mark each has, what is written in the nucleus, and
 * the brackets and the charge. Positions are in the symbol's frame (x = 0 on the centre line, y = 0 at the top of the box).
 */
export function bohrModel(zIn: number, chargeIn: number, o: Partial<BohrOptions> = {}): BohrModel {
  const opt: BohrOptions = { w: 170, h: 170, nucleus: 'symbol', mark: 'dot', outerOnly: false, otherMarks: 0, structure: false, ...o }
  const e = elementOf(zIn)
  const asked = int(chargeIn)
  const ion = ionShells(e, asked)
  const charge = ion ? asked : 0
  const structure = ion ?? [...e.shells]
  const n = structure.length
  const nuclearR = opt.nucleus === 'numbers' ? BOHR.numbersR : BOHR.nucleusR
  const half = Math.min(opt.w, opt.h) / 2
  const shrink = opt.structure ? BOHR.structureRoom : 0
  // The outermost shell, and the centre. A box that is too small does not crowd the shells: the atom grows instead.
  const drawn = opt.outerOnly ? Math.min(1, n) : n
  const spacing = Math.max(BOHR.minGap, nuclearR - BOHR.nucleusR + BOHR.nucleusGap)
  const R = Math.max(half - BOHR.margin - (charge ? BOHR.ionRoom : 0) - shrink / 2, BOHR.nucleusR + spacing * drawn, nuclearR + 4)
  const cx = 0,
    cy = opt.h / 2 - shrink / 2
  const other: Mark = opt.mark === 'dot' ? 'cross' : 'dot'
  const swap = clamp(int(opt.otherMarks), 0, 8)
  const shells: BohrShell[] = []
  structure.forEach((count, i) => {
    if (opt.outerOnly && i < n - 1) return
    const radius = BOHR.nucleusR + ((i + 1) * (R - BOHR.nucleusR)) / n
    const electrons = ringElectrons(cx, cy, radius, count, opt.mark)
    // The electrons that moved when the ion formed are the last of the outermost shell.
    if (i === n - 1) for (let k = Math.max(0, count - swap); k < count; k++) electrons[k].mark = other
    shells.push({ radius, electrons })
  })
  const texts: PlacedText[] = []
  if (opt.nucleus === 'symbol') texts.push({ text: e.symbol, x: cx, y: cy + (CAP / 2) * BOHR.symbolSize, size: BOHR.symbolSize })
  if (opt.nucleus === 'numbers') {
    // 'Z p' over 'N n': the protons are the atomic number, the neutrons make up the mass number of the commonest isotope.
    const s = BOHR.numbersSize,
      pitch = s + 2,
      top = cy - (pitch - CAP * s) / 2
    texts.push({ text: `${e.z} p`, x: cx, y: top, size: s }, { text: `${e.a - e.z} n`, x: cx, y: top + pitch, size: s })
  }
  const B = R + BOHR.bracketGap
  const bracket = charge ? { x0: cx - B, y0: cy - B, x1: cx + B, y1: cy + B, arm: BOHR.bracketArm } : null
  const chargeText = bracket ? { text: chargeMarkup(charge), x: bracket.x1 + 4.5, y: bracket.y0 + 4, size: BOHR.chargeSize } : null
  const below = bracket ? B + 1.5 : R + DOT_R
  const structureText =
    opt.structure && n ? { text: shellString(structure), x: cx, y: cy + below + 5 + CAP * BOHR.structureSize, size: BOHR.structureSize } : null
  return {
    z: e.z,
    symbol: e.symbol,
    name: e.name,
    asked,
    charge,
    structure,
    cx,
    cy,
    nucleus: { r: nuclearR, texts },
    shells,
    electrons: shells.flatMap((s) => s.electrons),
    bracket,
    chargeText,
    structureText,
  }
}

const asText = (t: PlacedText, anchor: SymbolText['anchor']): SymbolText => ({ x: t.x, y: t.y, text: t.text, size: t.size, anchor })

/** The geometry of a Bohr model. Back to front: the shells, the nucleus, the brackets, the electrons. */
function bohrPrims(m: BohrModel): Prim[] {
  const prims: Prim[] = []
  const rings = m.shells.map((s) => ringD(m.cx, m.cy, s.radius, gapsOf(s.electrons))).join('')
  if (rings) prims.push({ d: rings, role: 'detail' })
  prims.push({ d: circle(m.cx, m.cy, m.nucleus.r), role: 'solid' })
  if (m.bracket) prims.push({ d: bracketD(m.bracket.x0, m.bracket.y0, m.bracket.x1, m.bracket.y1, m.bracket.arm), role: 'outline' })
  prims.push(...markPrims(m.electrons))
  return prims
}

const bohrAtom: SymbolDef = {
  id: 'bohrAtom',
  name: 'Bohr atom',
  aliases: ['atom', 'electron shells', 'electronic structure', 'shell diagram', 'ion', 'Bohr model', 'electron configuration'],
  label: (p) => bohrLabel(num(p.z, 11), num(p.charge, 0)),
  pack: 'atoms',
  size: { w: 170, h: 170 },
  resize: 'uniform',
  min: { w: 82, h: 82 },
  params: [
    { key: 'z', label: 'Atomic number', type: 'number', default: 11, min: 1, max: 36, step: 1 },
    { key: 'charge', label: 'Charge', type: 'number', default: 0, min: -3, max: 3, step: 1 },
    {
      key: 'nucleus',
      label: 'Nucleus',
      type: 'choice',
      default: 'symbol',
      options: [
        { value: 'symbol', label: 'Element symbol' },
        { value: 'numbers', label: 'Protons and neutrons' },
        { value: 'blank', label: 'Empty' },
      ],
    },
    {
      key: 'mark',
      label: 'Electron mark',
      type: 'choice',
      default: 'dot',
      options: [
        { value: 'dot', label: 'Dot' },
        { value: 'cross', label: 'Cross' },
      ],
    },
    { key: 'outerOnly', label: 'Outer shell only', type: 'boolean', default: false },
    { key: 'otherMarks', label: 'Electrons with the other mark', type: 'number', default: 0, min: 0, max: 8, step: 1 },
    { key: 'structure', label: 'Electron structure', type: 'boolean', default: false },
  ],
  build({ w, h, p }) {
    const m = bohrModel(num(p.z, 11), num(p.charge, 0), {
      w,
      h,
      nucleus: str(p.nucleus, 'symbol') === 'numbers' ? 'numbers' : str(p.nucleus, 'symbol') === 'blank' ? 'blank' : 'symbol',
      mark: str(p.mark, 'dot') === 'cross' ? 'cross' : 'dot',
      outerOnly: bool(p.outerOnly, false),
      otherMarks: num(p.otherMarks, 0),
      structure: bool(p.structure, false),
    })
    const texts: SymbolText[] = m.nucleus.texts.map((t) => asText(t, 'middle'))
    if (m.chargeText) texts.push(asText(m.chargeText, 'start'))
    if (m.structureText) texts.push(asText(m.structureText, 'middle'))
    return { prims: bohrPrims(m), texts }
  },
}

// ---------------------------------------------------------------- models of the atom

export type ModelKind = 'plumPudding' | 'nuclear' | 'shell'

/** The sizes of the models of the atom. The nucleus of the nuclear and shell models is a dot (4 u) in an atom 120 to 140 u across. */
export const MODELS = {
  nucleusR: 4,
  /** The ring of the nuclear model, as a fraction of the box. */
  ring: 0.42,
  /** Room between the pudding or the outermost shell and the edge of the box. */
  margin: 8,
  /** The marks of the electrons of a plum pudding stay this far inside its edge (to their centres). */
  edge: 13,
  /** The hatch of a plum pudding in photocopy-safe mode is left out for this radius round a dot or a cross, so that the mark can be seen. */
  clear: 5.5,
} as const

export interface AtomModel {
  kind: ModelKind
  /** The electrons that were asked for, and the mark of each. */
  count: number
  mark: Mark
  cx: number
  cy: number
  /** The radius of the atom: the pudding, or the outermost ring. */
  radius: number
  /** The nucleus. The plum pudding has none: its positive charge is spread through the ball. */
  nucleus: null | { r: number; plus: Pt }
  /** The rings of the nuclear and shell models, each with its electrons. The plum pudding has none. */
  rings: BohrShell[]
  /** Every electron. */
  electrons: Electron[]
}

/**
 * Ten places for the electrons of a plum pudding, in the unit disc: spread evenly over it (a golden-angle spiral, each place moved a little by a
 * fixed random number, so that they look scattered) and put in an order in which the first few are already spread: after the first, each is the
 * one farthest from those before it. So the pudding of four electrons is the first four of the ten, and one more electron never moves the others.
 */
const PUDDING: readonly Pt[] = (() => {
  const next = rng(1904) // the year of Thomson's model
  const spiral = Array.from({ length: 10 }, (_, i) => {
    const r = 0.92 * Math.sqrt((i + 0.5) / 10),
      a = i * 2.399963 + 0.5
    return P(r * Math.cos(a) + (next() - 0.5) * 0.12, r * Math.sin(a) + (next() - 0.5) * 0.12)
  })
  const out: Pt[] = [spiral.reduce((p, q) => (Math.hypot(q.x, q.y) < Math.hypot(p.x, p.y) ? q : p))]
  while (out.length < spiral.length) {
    const rest = spiral.filter((q) => !out.includes(q))
    const gap = (q: Pt) => Math.min(...out.map((o) => Math.hypot(o.x - q.x, o.y - q.y)))
    out.push(rest.reduce((p, q) => (gap(q) > gap(p) ? q : p)))
  }
  return out
})()

/** The model of the atom that was asked for, in a box of side `size`. */
export function atomModel(kind: ModelKind, countIn: number, mark: Mark, size: number): AtomModel {
  const count = clamp(int(countIn, 1), 1, 10)
  const cx = 0,
    cy = size / 2
  const nucleus = { r: MODELS.nucleusR, plus: P(cx + 8, cy - 8) }
  if (kind === 'plumPudding') {
    const radius = size / 2 - MODELS.margin,
      u = radius - MODELS.edge
    const electrons = PUDDING.slice(0, count).map((q) => ({ x: cx + q.x * u, y: cy + q.y * u, angle: 0, mark }))
    return { kind, count, mark, cx, cy, radius, nucleus: null, rings: [], electrons }
  }
  if (kind === 'nuclear') {
    const radius = MODELS.ring * size
    const electrons = ringElectrons(cx, cy, radius, count, mark)
    return { kind, count, mark, cx, cy, radius, nucleus, rings: [{ radius, electrons }], electrons }
  }
  // The shell model: the shells of the neutral atom that has this many electrons (2, then the rest), spaced like those of a Bohr atom.
  const shells = elementOf(count).shells
  const radius = size / 2 - MODELS.margin
  const rings = shells.map((n, i) => {
    const r = MODELS.nucleusR + ((i + 1) * (radius - MODELS.nucleusR)) / shells.length
    return { radius: r, electrons: ringElectrons(cx, cy, r, n, mark) }
  })
  return { kind, count, mark, cx, cy, radius, nucleus, rings, electrons: rings.flatMap((r) => r.electrons) }
}

function modelPrims(m: AtomModel): Prim[] {
  const prims: Prim[] = []
  if (m.kind === 'plumPudding') {
    // A tint with its hatch; the hatch leaves a clearing round each dot and cross (a circled minus sign has its own white).
    const holes = m.electrons.filter((e) => e.mark !== 'minus').map((e) => circle(e.x, e.y, MODELS.clear))
    prims.push(...tintedClear(circle(m.cx, m.cy, m.radius), holes.join('')))
  } else {
    const rings = m.rings.map((r) => ringD(m.cx, m.cy, r.radius, gapsOf(r.electrons))).join('')
    if (rings) prims.push({ d: rings, role: 'detail' })
    if (m.nucleus) prims.push({ d: circle(m.cx, m.cy, m.nucleus.r), role: 'dark' }, { d: plusD(m.nucleus.plus.x, m.nucleus.plus.y, 3.5), role: 'detail' })
  }
  prims.push(...markPrims(m.electrons))
  return prims
}

const MODEL_NAMES: Record<ModelKind, string> = { plumPudding: 'plum pudding model', nuclear: 'nuclear model', shell: 'shell model' }
const kindOf = (v: ParamValue | undefined): ModelKind => (v === 'nuclear' || v === 'shell' ? v : 'plumPudding')
const markOf = (v: ParamValue | undefined): Mark => (v === 'dot' || v === 'cross' ? v : 'minus')

const atomModels: SymbolDef = {
  id: 'atomModels',
  name: 'Models of the atom',
  aliases: ['plum pudding', 'nuclear model', 'Rutherford model', 'Thomson model', 'atom model'],
  label: (p) => MODEL_NAMES[kindOf(p.model)],
  pack: 'atoms',
  size: { w: 150, h: 150 },
  resize: 'uniform',
  min: { w: 110, h: 110 },
  params: [
    {
      key: 'model',
      label: 'Model',
      type: 'choice',
      default: 'plumPudding',
      options: [
        { value: 'plumPudding', label: 'Plum pudding' },
        { value: 'nuclear', label: 'Nuclear' },
        { value: 'shell', label: 'Shell' },
      ],
    },
    { key: 'electrons', label: 'Electrons', type: 'number', default: 4, min: 1, max: 10, step: 1 },
    {
      key: 'mark',
      label: 'Electron mark',
      type: 'choice',
      default: 'minus',
      options: [
        { value: 'minus', label: 'Minus sign' },
        { value: 'dot', label: 'Dot' },
        { value: 'cross', label: 'Cross' },
      ],
    },
  ],
  build({ w, h, p }) {
    const m = atomModel(kindOf(p.model), num(p.electrons, 4), markOf(p.mark), Math.min(w, h))
    return { prims: modelPrims(m) }
  },
}

// ---------------------------------------------------------------- nuclide notation

export interface Nuclide {
  z: number
  /** The mass number: the number that was asked for, raised to the atomic number if smaller, or the commonest isotope's when it is 0. */
  a: number
  /** The charge that is drawn: the one asked for, or 0 when the element cannot have it (`ionShells` refuses it). */
  charge: number
  symbol: string
  name: string
  protons: number
  neutrons: number
  electrons: number
}

/** The nuclide with atomic number z and mass number a (0 = the commonest isotope of the element), with a charge. */
export function nuclide(zIn: number, aIn: number, chargeIn = 0): Nuclide {
  const e = elementOf(zIn)
  const asked = int(aIn)
  const a = asked <= 0 ? e.a : Math.max(asked, e.z)
  const c = int(chargeIn)
  const charge = ionShells(e, c) ? c : 0
  return { z: e.z, a, charge, symbol: e.symbol, name: e.name, protons: e.z, neutrons: a - e.z, electrons: e.z - charge }
}

/** "sodium-23". */
export const nuclideLabel = (n: Nuclide): string => `${n.name}-${n.a}`

/** Sizes of the text of the notation, in u: the symbol, the two numbers beside it, the lines of counts and the distance between their baselines. */
export const NOTATION = { symbol: 24, numbers: 16, counts: 12, countPitch: 14, numberGap: 3, countsGap: 8 } as const

export interface NotationLayout {
  texts: SymbolText[]
  /** The box of the notation without its counts, and the box of everything. */
  notation: { x0: number; y0: number; x1: number; y1: number }
  all: { x0: number; y0: number; x1: number; y1: number }
  /** The baseline of the first line of counts, or null when there are none. */
  countsAt: number | null
}

/** "1 proton", "12 neutrons". */
const countWord = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** The lines of counts: the particles of a nucleus, or of the atom. */
export function countLines(n: Nuclide, kind: 'nucleus' | 'atom'): string[] {
  const lines = [countWord(n.protons, 'proton'), countWord(n.neutrons, 'neutron')]
  if (kind === 'atom') lines.push(countWord(n.electrons, 'electron'))
  return lines
}

/** The lines of counts as text: left-aligned in a block that is centred on `cx`, the first baseline at `first`. */
export function countTexts(n: Nuclide, kind: 'nucleus' | 'atom', cx: number, first: number): { texts: SymbolText[]; x0: number; x1: number; y1: number } {
  const { counts: C, countPitch } = NOTATION
  const lines = countLines(n, kind)
  const width = Math.max(...lines.map((l) => textWidth(l, C)))
  const x0 = cx - width / 2
  return {
    texts: lines.map((l, i) => ({ x: x0, y: first + i * countPitch, text: l, size: C, anchor: 'start' as const })),
    x0,
    x1: x0 + width,
    y1: first + (lines.length - 1) * countPitch + 0.21 * C,
  }
}

/**
 * The text of a nuclide notation, centred on `cx`, with the baseline of the symbol at `baseline`: the symbol (24 u), the mass number above
 * the atomic number at its left (16 u, right-aligned with each other and centred on the height of the capital letters of the symbol), and the
 * charge as a superscript. With `counts`, the lines of counts (12 u) under it. nuclideNotation and isotopeNuclei both draw it with this.
 */
export function notationLayout(n: Nuclide, cx: number, baseline: number, counts: 'none' | 'nucleus' | 'atom' = 'none'): NotationLayout {
  const { symbol: S, numbers: N, counts: C, numberGap, countsGap } = NOTATION
  const body = n.charge ? `${n.symbol}${chargeMarkup(n.charge)}` : n.symbol
  const numW = Math.max(textWidth(String(n.a), N), textWidth(String(n.z), N))
  const bodyW = textWidth(body, S)
  const x0 = cx - (numW + numberGap + bodyW) / 2
  const mid = baseline - (CAP * S) / 2 // the middle of the capital letters of the symbol
  const stack = (CAP * N + 3) / 2 + (CAP * N) / 2 // from the middle of the two numbers to the baseline of the lower one
  const upper = mid - stack + CAP * N,
    lower = mid + stack
  const texts: SymbolText[] = [
    { x: x0 + numW, y: upper, text: String(n.a), size: N, anchor: 'end' },
    { x: x0 + numW, y: lower, text: String(n.z), size: N, anchor: 'end' },
    { x: x0 + numW + numberGap, y: baseline, text: body, size: S, anchor: 'start' },
  ]
  const notation = { x0, y0: upper - CAP * N, x1: x0 + numW + numberGap + bodyW, y1: Math.max(lower, baseline) }
  let all = { ...notation }
  let countsAt: number | null = null
  if (counts !== 'none') {
    countsAt = notation.y1 + countsGap + CAP * C
    const c = countTexts(n, counts, cx, countsAt)
    texts.push(...c.texts)
    all = { x0: Math.min(notation.x0, c.x0), y0: notation.y0, x1: Math.max(notation.x1, c.x1), y1: c.y1 }
  }
  return { texts, notation, all, countsAt }
}

const nuclideNotation: SymbolDef = {
  id: 'nuclideNotation',
  name: 'Nuclide notation',
  aliases: ['isotope notation', 'mass number and atomic number', 'nuclide symbol'],
  label: (p) => nuclideLabel(nuclide(num(p.z, 11), num(p.a, 0), num(p.charge, 0))),
  pack: 'atoms',
  size: { w: 96, h: 50 },
  resize: 'none',
  params: [
    { key: 'z', label: 'Atomic number', type: 'number', default: 11, min: 1, max: 36, step: 1 },
    { key: 'a', label: 'Mass number (0 for the commonest)', type: 'number', default: 0, min: 0, max: 80, step: 1 },
    { key: 'charge', label: 'Charge', type: 'number', default: 0, min: -3, max: 3, step: 1 },
    { key: 'counts', label: 'Particle counts', type: 'boolean', default: false },
  ],
  build({ h, p }) {
    const n = nuclide(num(p.z, 11), num(p.a, 0), num(p.charge, 0))
    // The notation is centred in the nominal box. Its counts, when they are on, hang below the box.
    const lay = notationLayout(n, 0, h / 2 + (CAP * NOTATION.symbol) / 2, bool(p.counts, false) ? 'atom' : 'none')
    const b = lay.all,
      mid = (lay.notation.y0 + lay.notation.y1) / 2
    // The symbol is text only: a white box under it stands for its drawing (it hides what is behind the text), and gives it a size to select.
    const pad = 3
    return {
      prims: [{ d: `M${f(b.x0 - pad)} ${f(b.y0 - pad)}H${f(b.x1 + pad)}V${f(b.y1 + pad)}H${f(b.x0 - pad)}Z`, role: 'paper' }],
      texts: lay.texts,
      labelAt: { left: P(b.x0 - pad, mid), right: P(b.x1 + pad, mid) },
    }
  },
}

// ---------------------------------------------------------------- isotopes drawn as nuclei

/** A proton or a neutron is a circle of this radius, and the circles of a cluster touch: their centres are twice this far apart. */
export const NUCLEON_R = 5

export interface Nucleon {
  x: number
  y: number
  proton: boolean
}

export interface Cluster {
  /** The mass number: the number of circles. */
  a: number
  protons: number
  neutrons: number
  /** Where the middle of the cluster is, and its circles (absolute, in the symbol's frame). */
  cx: number
  cy: number
  circles: Nucleon[]
  /** The width and the height of its drawing, to the outside of the outermost circles. */
  width: number
  height: number
}

const SQ3 = Math.sqrt(3)
const sum = (a: readonly number[]): number => a.reduce((n, m) => n + m, 0)

/**
 * The circles of a nucleus with `protons` protons and mass number `a`, centred on (0, 0): a tight hexagonal cluster, laid out from the middle
 * outwards. Of the three places for the middle (on a circle, between two, in the gap between three) it takes the one that gives the most compact
 * cluster. Protons and neutrons are mixed evenly through it, so that both kinds can be seen in every ring.
 */
export function clusterCircles(protons: number, a: number): Nucleon[] {
  const D = 2 * NUCLEON_R
  const lattice: Pt[] = []
  const reach = Math.ceil(Math.sqrt(a)) + 3
  for (let q = -reach; q <= reach; q++) for (let r = -reach; r <= reach; r++) lattice.push(P(D * (q + r / 2), D * (SQ3 / 2) * r))
  const origins = [P(0, 0), P(D / 2, 0), P(D / 2, (D * SQ3) / 6)]
  let best: Pt[] = [],
    middle = origins[0],
    bestSpread = Infinity
  for (const o of origins) {
    // Nearest first. Sites that are equally near are taken in opposite pairs, so that a part-filled ring is as even as it can be.
    const key = (p: Pt) => {
      const ang = (Math.atan2(p.y - o.y, p.x - o.x) * 180) / Math.PI
      return { d: Math.hypot(p.x - o.x, p.y - o.y), m: ((ang % 180) + 180) % 180, ang }
    }
    const sites = [...lattice].sort((p, q) => {
      const kp = key(p),
        kq = key(q)
      if (Math.abs(kp.d - kq.d) > 1e-6) return kp.d - kq.d
      if (Math.abs(kp.m - kq.m) > 1e-6) return kp.m - kq.m
      return kp.ang - kq.ang
    })
    const take = sites.slice(0, a)
    const mx = take.reduce((s, p) => s + p.x, 0) / a,
      my = take.reduce((s, p) => s + p.y, 0) / a
    const spread = take.reduce((s, p) => s + (p.x - mx) ** 2 + (p.y - my) ** 2, 0)
    if (spread < bestSpread - 1e-6) {
      bestSpread = spread
      best = take
      middle = o
    }
  }
  const flags = mixture(best, middle, protons)
  // Centre the box of the circles on (0, 0).
  const xs = best.map((p) => p.x),
    ys = best.map((p) => p.y)
  const ox = (Math.min(...xs) + Math.max(...xs)) / 2,
    oy = (Math.min(...ys) + Math.max(...ys)) / 2
  return best.map((p, i) => ({ x: p.x - ox, y: p.y - oy, proton: flags[i] }))
}

/**
 * Which of the circles are protons. The circles lie in rings round the middle of the cluster (each ring all equally far from it). Each ring gets
 * its share of the protons (z in a, the rounding going to the rings with the most left over), and the protons of a ring are spread evenly round it,
 * each ring turned so that the protons stay centred on the cluster. So both kinds are seen all through it, in the middle and at the rim, and
 * neither is collected on one side.
 */
function mixture(sites: readonly Pt[], middle: Pt, protons: number): boolean[] {
  const a = sites.length
  const away = (p: Pt) => Math.hypot(p.x - middle.x, p.y - middle.y)
  // The rings: runs of sites that are equally far from the middle (the sites are in order of distance).
  const rings: number[][] = []
  sites.forEach((p, i) => {
    if (i && Math.abs(away(p) - away(sites[i - 1])) < 1e-6) rings[rings.length - 1].push(i)
    else rings.push([i])
  })
  // Each ring's share: the whole part of its quota, and the rest to the rings with the largest fractions (the inner ring first when they are equal).
  const quota = rings.map((r) => (protons * r.length) / a)
  const share = quota.map((q) => Math.floor(q + 1e-9))
  let left = protons - sum(share)
  const order = quota.map((_, i) => i).sort((i, j) => quota[j] - Math.floor(quota[j]) - (quota[i] - Math.floor(quota[i])) || i - j)
  for (const i of order) {
    if (left <= 0) break
    if (share[i] < rings[i].length) {
      share[i]++
      left--
    }
  }
  const flags: boolean[] = sites.map(() => false)
  // The protons of a ring are spread evenly round it, turned to the place that keeps the protons of the whole cluster centred on its middle.
  let sx = 0,
    sy = 0
  rings.forEach((ring, k) => {
    const n = ring.length,
      count = share[k]
    if (!count) return
    const byAngle = [...ring].sort(
      (i, j) => Math.atan2(sites[i].y - middle.y, sites[i].x - middle.x) - Math.atan2(sites[j].y - middle.y, sites[j].x - middle.x),
    )
    const pattern = Array.from({ length: count }, (_, j) => Math.floor(((j + 0.5) * n) / count))
    let bestTurn: number[] = [],
      bestOff = Infinity
    for (let turn = 0; turn < n; turn++) {
      const chosen = pattern.map((i) => byAngle[(i + turn) % n])
      const off = Math.hypot(sx + sum(chosen.map((i) => sites[i].x - middle.x)), sy + sum(chosen.map((i) => sites[i].y - middle.y)))
      if (off < bestOff - 1e-9) {
        bestOff = off
        bestTurn = chosen
      }
    }
    for (const i of bestTurn) {
      flags[i] = true
      sx += sites[i].x - middle.x
      sy += sites[i].y - middle.y
    }
  })
  return flags
}

export interface IsotopeModel {
  z: number
  symbol: string
  name: string
  clusters: (Cluster & { nuclide: Nuclide; baseline: number })[]
  /** The baseline of the first line of counts, or null. */
  countsAt: number | null
  notation: boolean
  counts: boolean
}

export interface IsotopeOptions {
  w: number
  h: number
  notation: boolean
  counts: boolean
}

/**
 * One to three isotopes of the element z side by side. `masses` are the three mass numbers a1, a2 and a3: one that is 0 (a2 or a3) is left
 * out, and one below z is raised to z. The clusters are spread over the width of the box and the whole picture is centred in its height.
 */
export function isotopeModel(zIn: number, masses: readonly number[], o: Partial<IsotopeOptions> = {}): IsotopeModel {
  const opt: IsotopeOptions = { w: 300, h: 150, notation: true, counts: false, ...o }
  const e = elementOf(zIn)
  const as = masses.map((m, i) => (i > 0 && int(m) <= 0 ? 0 : Math.max(int(m), e.z))).filter((m, i) => i === 0 || m > 0)
  const shapes = as.map((a) => clusterCircles(e.z, a))
  const boxes = shapes.map((cs) => {
    const xs = cs.map((c) => c.x),
      ys = cs.map((c) => c.y)
    return { width: Math.max(...xs) - Math.min(...xs) + 2 * NUCLEON_R + 2, height: Math.max(...ys) - Math.min(...ys) + 2 * NUCLEON_R + 2 }
  })
  const tall = Math.max(...boxes.map((b) => b.height)),
    gap = 14
  // What the notation takes up above and below the baseline of its symbol is measured from the layout itself.
  const probe = notationLayout(nuclide(e.z, as[0]), 0, 0)
  // Top to bottom: the clusters, the notation, the counts. Measured from the top of the clusters.
  let baseline = tall + gap - probe.notation.y0
  let bottom = tall
  let countsAt: number | null = null
  if (opt.notation) bottom = baseline + probe.notation.y1
  if (opt.counts) {
    countsAt = (opt.notation ? bottom + NOTATION.countsGap : tall + gap) + CAP * NOTATION.counts
    bottom = countTexts(nuclide(e.z, as[0]), 'nucleus', 0, countsAt).y1
  }
  const top = Math.max(6, (opt.h - bottom) / 2)
  baseline += top
  if (countsAt !== null) countsAt += top
  const yc = top + tall / 2
  const count = as.length
  const clusters = as.map((a, i) => {
    const cx = ((i + 0.5) / count - 0.5) * opt.w
    return {
      a,
      protons: e.z,
      neutrons: a - e.z,
      cx,
      cy: yc,
      circles: shapes[i].map((c) => ({ x: cx + c.x, y: yc + c.y, proton: c.proton })),
      width: boxes[i].width,
      height: boxes[i].height,
      nuclide: nuclide(e.z, a, 0),
      baseline,
    }
  })
  return { z: e.z, symbol: e.symbol, name: e.name, clusters, countsAt, notation: opt.notation, counts: opt.counts }
}

const isotopeNuclei: SymbolDef = {
  id: 'isotopeNuclei',
  name: 'Isotopes (nuclei)',
  aliases: ['isotopes', 'nucleus', 'protons and neutrons', 'nuclei'],
  label: (p) => `${elementOf(num(p.z, 17)).name} isotopes`,
  pack: 'atoms',
  size: { w: 300, h: 150 },
  resize: 'uniform',
  min: { w: 240, h: 120 },
  params: [
    { key: 'z', label: 'Atomic number', type: 'number', default: 17, min: 1, max: 18, step: 1 },
    { key: 'a1', label: 'First mass number', type: 'number', default: 35, min: 1, max: 40, step: 1 },
    { key: 'a2', label: 'Second mass number (0 for none)', type: 'number', default: 37, min: 0, max: 40, step: 1 },
    { key: 'a3', label: 'Third mass number (0 for none)', type: 'number', default: 0, min: 0, max: 40, step: 1 },
    { key: 'notation', label: 'Notation', type: 'boolean', default: true },
    { key: 'counts', label: 'Particle counts', type: 'boolean', default: false },
  ],
  build({ w, h, p }) {
    const m = isotopeModel(num(p.z, 17), [num(p.a1, 35), num(p.a2, 37), num(p.a3, 0)], {
      w,
      h,
      notation: bool(p.notation, true),
      counts: bool(p.counts, false),
    })
    const neutrons: string[] = [],
      protons: string[] = [],
      plus: string[] = [],
      clear: string[] = []
    const texts: SymbolText[] = []
    for (const c of m.clusters) {
      for (const n of c.circles) (n.proton ? protons : neutrons).push(circle(n.x, n.y, NUCLEON_R))
      for (const n of c.circles) {
        if (!n.proton) continue
        plus.push(plusD(n.x, n.y, 2.4))
        clear.push(circle(n.x, n.y, 3.2))
      }
      // The notation of nuclideNotation, with its counts under it; or the counts alone under the cluster.
      if (m.notation) texts.push(...notationLayout(c.nuclide, c.cx, c.baseline, m.counts ? 'nucleus' : 'none').texts)
      else if (m.countsAt !== null) texts.push(...countTexts(c.nuclide, 'nucleus', c.cx, m.countsAt).texts)
    }
    const prims: Prim[] = []
    if (neutrons.length) prims.push({ d: neutrons.join(''), role: 'solid' })
    // The hatch of a proton leaves its plus sign clear.
    if (protons.length) prims.push(...tintedClear(protons.join(''), clear.join('')))
    if (plus.length) prims.push({ d: plus.join(''), role: 'detail' })
    return { prims, texts }
  },
}

// ---------------------------------------------------------------- alpha-particle scattering

/**
 * The sizes of the alpha-scattering picture, in u. The atoms of the foil touch (their centres are `pitch` apart), and a nucleus is a dot in
 * each. The picture is a diagram, not a scale drawing: a real nucleus is ten thousand times smaller than its atom.
 */
export const ALPHA = {
  atomR: 6,
  pitch: 12,
  nucleusR: 1.5,
  /** A path that passes a nucleus no closer than this is not bent. */
  straight: 4,
  /** The path that is turned back passes this close to its nucleus, and is turned through this many degrees. */
  reverseB: 2.4,
  reverseAngle: 135,
  /** A path that passes further out is bent less: the bend falls by a factor e in this distance. */
  lambda: 0.5,
  /** The lead block: its width, the thickness of its back wall (the alpha source is behind it) and of the two arms that stand above and below the slit. */
  blockW: 46,
  back: 16,
  arm: 24,
  /** How far from its nucleus a bent path starts to bend (the path is straight further out). */
  reach: 70,
  /** The length of an arrow head, and its half angle. */
  arrow: 8,
  spread: 0.42,
} as const

/**
 * How far an alpha particle that passes a nucleus at distance b (u) is turned (degrees), however it passes: 0 when it passes at 4 u or more,
 * and more and more the closer it comes, to 135° at 2.4 u. The nucleus is 1.5 u across, so no path is turned into it.
 */
export function deflection(b: number): number {
  if (b >= ALPHA.straight) return 0
  return ALPHA.reverseAngle * Math.exp(-(Math.max(b, ALPHA.reverseB) - ALPHA.reverseB) / ALPHA.lambda)
}

/** The paths that bend a little, for the number of paths: one of five or six, two of seven to ten, three of eleven or twelve. Most paths are straight. */
const bentCount = (paths: number): number => Math.floor((paths + 1) / 4)
/** How far above their nuclei the paths that bend upwards pass (the turned-back path passes at `reverseB`), and how far below its nucleus the path that bends down passes. */
const UP = [3.2, 3.6]
const DOWN = 3.4

export interface PathSlot {
  /** The nucleus the path passes, as its place in the column (0 is the middle of the foil, negative is above it). */
  k: number
  /** Where the incident line is, from that nucleus: negative above it, positive below it (u). */
  s: number
}

/**
 * Where the `paths` incident lines pass the nuclei of the foil, from the top. A fixed pattern for each number of paths: the closest pass is the
 * path that is turned back, at the top of the beam, so that it cannot cross another path; below it the paths that bend up (the closer, the
 * more), then the straight paths between two nuclei, 6 u from each, and last the path that bends down. Paths that bend away from each other
 * never cross, and every path is at least 9 u from the next.
 */
export function alphaPattern(paths: number): PathSlot[] {
  const count = clamp(int(paths, 8), 5, 12)
  const bent = bentCount(count)
  const up = bent >= 3 ? 2 : 1
  const straight = count - 1 - bent
  const out: PathSlot[] = [{ k: 0, s: -ALPHA.reverseB }]
  for (let i = 0; i < up; i++) out.push({ k: i + 1, s: -UP[i] })
  for (let i = 0; i < straight; i++) out.push({ k: up + i, s: ALPHA.pitch / 2 })
  if (bent > up) out.push({ k: up + straight, s: DOWN })
  // Centre the beam on the middle of the foil.
  const shift = -Math.round((up + straight) / 2)
  return out.map((q) => ({ k: q.k + shift, s: q.s }))
}

/**
 * The path of an alpha particle that passes a nucleus and is repelled by it: a hyperbola with the nucleus at its focus (Rutherford's), for the
 * particle that comes along +x at distance b above the nucleus and is turned through `theta`. In a frame with the nucleus at (0, 0) and Y up.
 * It runs from where it is `reach` u from the nucleus on the way in to where it is `reach` u away on the way out.
 */
function hyperbola(b: number, theta: number, reach: number, steps: number): Pt[] {
  const half = theta / 2
  const k = b * Math.tan(half) // half the distance of closest approach of a head-on path
  const e = 1 / Math.sin(half) // the eccentricity
  const p = (b * b) / k // r = p / (e cos(phi) - 1), phi from the axis that points at the nearest point of the path
  const axis = P(-Math.sin(half), Math.cos(half)),
    side = P(Math.cos(half), Math.sin(half))
  const phiEnd = Math.acos(Math.min(1, (1 + p / reach) / e))
  const out: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const t = -1 + (2 * i) / steps
    // Closer together near the axis, where the path turns.
    const phi = phiEnd * Math.sign(t) * Math.abs(t) ** 1.8
    const r = p / (e * Math.cos(phi) - 1)
    out.push(P(r * (Math.cos(phi) * axis.x + Math.sin(phi) * side.x), r * (Math.cos(phi) * axis.y + Math.sin(phi) * side.y)))
  }
  return out
}

export interface AlphaPath {
  /** 'straight' (not bent), 'bent' (bent a little) or 'reversed' (turned back). */
  kind: 'straight' | 'bent' | 'reversed'
  /** The nucleus it passes (an index into `nuclei`) and the signed distance of its incident line from it. */
  nucleus: number
  s: number
  /** The angle it is turned through, in degrees, from the incident line; positive is downwards on the page. */
  turn: number
  /** The line, from the lead block to the foot of the arrow head. */
  points: Pt[]
  /** The tip of the arrow head at the end of the path, and the direction it points, in degrees clockwise from +x. */
  tip: Pt
  heading: number
  /** The tip of the arrow head on the beam, half way between the block and the foil: it points along +x. */
  beam: Pt
}

export interface AlphaModel {
  w: number
  h: number
  /** The middle of the foil, and the radius of the detector screen (0.45 of the height). */
  cx: number
  cy: number
  screen: number
  /** The atoms of the foil, from the top: the centre of each. Each has a nucleus at its centre. */
  nuclei: Pt[]
  paths: AlphaPath[]
  /** Whether the nuclei are drawn. */
  showNuclei: boolean
  /** The detector screen is a circle round the foil, open where the beam comes in: the opening is this many degrees to each side of the beam line. */
  gap: number
  /** The lead block: a box that is open on the side of the foil. `slit` is the half height of its opening, `outer` that of the block. */
  block: { x0: number; x1: number; back: number; slit: number; outer: number }
}

/** A polyline without its last `length` u, measured along it. */
function trimEnd(pts: readonly Pt[], length: number): Pt[] {
  const out = [...pts]
  let left = length
  while (out.length > 1) {
    const a = out[out.length - 2],
      b = out[out.length - 1]
    const seg = dist(a, b)
    if (seg > left) {
      out[out.length - 1] = P(b.x - ((b.x - a.x) * left) / seg, b.y - ((b.y - a.y) * left) / seg)
      break
    }
    left -= seg
    out.pop()
  }
  return out
}

/** The model of the picture: the nuclei, the paths of the alpha particles and the screen, in a box w × h. */
export function alphaModel(pathsIn: number, showNuclei: boolean, w = 380, h = 230): AlphaModel {
  const slots = alphaPattern(pathsIn)
  // The foil is a little to the right of the middle, so that the block, the beam and the screen are spread over the box.
  const cx = 0.1 * w,
    cy = h / 2,
    screen = 0.45 * h
  // The column of atoms: tall enough for the beam, with one atom spare at each end, and at least a third of the height.
  const used = Math.max(...slots.map((q) => Math.abs(q.k)), ...slots.map((q) => Math.abs(q.k + 1)))
  const half = Math.max(used + 1, Math.floor((0.3 * h) / ALPHA.pitch), 3)
  const nuclei = Array.from({ length: 2 * half + 1 }, (_, i) => P(cx, cy + (i - half) * ALPHA.pitch))
  const x0 = -w / 2 + 6,
    xs = x0 + ALPHA.back + 3 // the paths start at the back wall of the block
  const paths: AlphaPath[] = slots.map(({ k, s }) => {
    const index = half + k,
      N = nuclei[index]
    const b = Math.abs(s),
      turn = deflection(b)
    const up = s < 0 // the path passes above its nucleus, so it is pushed up
    let pts: Pt[], apex: number
    if (turn === 0) {
      pts = [P(xs, N.y + s), P(cx, N.y + s), P(cx + 4 * w, N.y + s)]
      apex = 1
    } else {
      const curve = hyperbola(b, deg(turn), ALPHA.reach, 80).map((q) => P(N.x + q.x, N.y - (up ? 1 : -1) * q.y))
      const last = curve[curve.length - 1],
        before = curve[curve.length - 2]
      const len = Math.hypot(last.x - before.x, last.y - before.y)
      const far = P(last.x + (4 * w * (last.x - before.x)) / len, last.y + (4 * w * (last.y - before.y)) / len)
      pts = [P(xs, curve[0].y), ...curve, far]
      apex = 1 + curve.length / 2
    }
    // The path ends where it meets the detector screen: the tip of its arrow head is on the screen, and the line stops at the foot of the head.
    const C = P(cx, cy)
    let tip = pts[pts.length - 1],
      cut = pts.length - 1
    for (let i = Math.floor(apex); i + 1 < pts.length; i++) {
      const a = pts[i],
        c = pts[i + 1]
      if (Math.hypot(c.x - C.x, c.y - C.y) >= screen && Math.hypot(a.x - C.x, a.y - C.y) < screen) {
        const dx = c.x - a.x,
          dy = c.y - a.y
        const bq = dx * (a.x - C.x) + dy * (a.y - C.y),
          aq = dx * dx + dy * dy,
          cq = (a.x - C.x) ** 2 + (a.y - C.y) ** 2 - screen * screen
        const t = (-bq + Math.sqrt(bq * bq - aq * cq)) / aq
        tip = P(a.x + t * dx, a.y + t * dy)
        cut = i
        break
      }
    }
    const heading = (Math.atan2(tip.y - pts[cut].y, tip.x - pts[cut].x) * 180) / Math.PI
    const points = trimEnd([...pts.slice(0, cut + 1), tip], ALPHA.arrow - 1)
    // The arrow head on the beam is at the middle of the level part of the path.
    const beam = P((xs + (N.x - ALPHA.reach)) / 2 + ALPHA.arrow / 2, points[0].y)
    return { kind: turn === 0 ? 'straight' : turn > 90 ? 'reversed' : 'bent', nucleus: index, s, turn: up ? -turn : turn, points, tip, heading, beam }
  })
  // The opening of the block and of the screen is as wide as the beam, with a little room.
  const beam = Math.max(...paths.map((q) => Math.abs(q.points[0].y - cy)))
  const slit = beam + 7
  const outer = Math.min(slit + ALPHA.arm, h / 2 - 4)
  const gap = (Math.asin(Math.min(1, (beam + 8) / screen)) * 180) / Math.PI
  return {
    w,
    h,
    cx,
    cy,
    screen,
    nuclei,
    paths,
    showNuclei,
    gap,
    block: { x0, x1: x0 + ALPHA.blockW, back: ALPHA.back, slit, outer },
  }
}

const polyline = (pts: readonly Pt[]): string => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('')
/** An arrow head with its tip at `tip`, pointing along `heading` (degrees clockwise from +x). */
function arrowD(tip: Pt, heading: number): string {
  const a = deg(heading)
  const wing = (s: number) => P(tip.x - ALPHA.arrow * Math.cos(a + s * ALPHA.spread), tip.y - ALPHA.arrow * Math.sin(a + s * ALPHA.spread))
  const p1 = wing(-1),
    p2 = wing(1)
  return `M${f(p1.x)} ${f(p1.y)}L${f(tip.x)} ${f(tip.y)}L${f(p2.x)} ${f(p2.y)}Z`
}

function alphaPrims(m: AlphaModel): Prim[] {
  const prims: Prim[] = []
  // The detector screen: a dashed circle round the foil, open where the beam comes in.
  const r = m.screen,
    a = deg(180 - m.gap)
  const at = (t: number) => `${f(m.cx + r * Math.cos(t))} ${f(m.cy + r * Math.sin(t))}`
  prims.push({ d: `M${at(-a)}A${f(r)} ${f(r)} 0 1 1 ${at(a)}`, role: 'dashed' })
  // The lead block: one piece, a box with its back wall on the left and its opening (the slit) on the side of the foil.
  const b = m.block
  const [top, bottom, inner] = [m.cy - b.outer, m.cy + b.outer, b.x0 + b.back]
  prims.push({
    d: `M${f(b.x0)} ${f(top)}H${f(b.x1)}V${f(m.cy - b.slit)}H${f(inner)}V${f(m.cy + b.slit)}H${f(b.x1)}V${f(bottom)}H${f(b.x0)}Z`,
    role: 'solid',
  })
  // The foil: a column of touching atoms, a nucleus in each.
  prims.push({ d: m.nuclei.map((n) => circle(n.x, n.y, ALPHA.atomR)).join(''), role: 'detail' })
  if (m.showNuclei) prims.push({ d: m.nuclei.map((n) => circle(n.x, n.y, ALPHA.nucleusR)).join(''), role: 'ink' })
  prims.push({ d: m.paths.map((q) => polyline(q.points)).join(''), role: 'detail' })
  // An arrow head at the end of each path, and one on the beam before the foil.
  prims.push({ d: m.paths.map((q) => arrowD(q.tip, q.heading) + arrowD(q.beam, 0)).join(''), role: 'ink' })
  return prims
}

const alphaScattering: SymbolDef = {
  id: 'alphaScattering',
  name: 'Alpha particle scattering',
  aliases: ['Rutherford scattering', 'gold foil experiment', 'Geiger-Marsden'],
  pack: 'atoms',
  size: { w: 380, h: 230 },
  resize: 'free',
  min: { w: 300, h: 200 },
  params: [
    { key: 'paths', label: 'Alpha paths', type: 'number', default: 8, min: 5, max: 12, step: 1 },
    { key: 'nuclei', label: 'Nuclei', type: 'boolean', default: true },
  ],
  build({ w, h, p }) {
    return { prims: alphaPrims(alphaModel(num(p.paths, 8), bool(p.nuclei, true), w, h)) }
  },
}

export const atoms: SymbolDef[] = [bohrAtom, atomModels, nuclideNotation, isotopeNuclei, alphaScattering]
