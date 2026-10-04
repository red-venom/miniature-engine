// text.ts — label markup (subscript and superscript) and the smart chemistry formatter.

export type Script = 'normal' | 'sub' | 'sup'
export interface Run {
  text: string
  script: Script
}

/**
 * Markup: `_x` or `_{...}` is subscript, `^x` or `^{...}` is superscript, `\_` and `\^` are literal.
 * Without braces the script takes a signed number (`^2+`, `^-1`, `_10`) or one character.
 * A hyphen in a superscript becomes a true minus sign.
 */
export function parseMarkup(s: string): Run[] {
  const runs: Run[] = []
  const push = (text: string, script: Script) => {
    if (!text) return
    const last = runs[runs.length - 1]
    if (last && last.script === script) last.text += text
    else runs.push({ text, script })
  }
  let i = 0,
    buf = ''
  while (i < s.length) {
    const ch = s[i]
    if (ch === '\\' && i + 1 < s.length) {
      buf += s[i + 1]
      i += 2
      continue
    }
    if (ch === '_' || ch === '^') {
      const script: Script = ch === '_' ? 'sub' : 'sup'
      let body = ''
      if (s[i + 1] === '{') {
        const end = s.indexOf('}', i + 2)
        if (end < 0) {
          buf += ch
          i++
          continue
        }
        body = s.slice(i + 2, end)
        i = end + 1
      } else {
        const m = /^(?:[+\-−]?\d+[+\-−]?|[+\-−]|[^\s])/.exec(s.slice(i + 1))
        if (!m) {
          buf += ch
          i++
          continue
        }
        body = m[0]
        i += 1 + body.length
      }
      push(buf, 'normal')
      buf = ''
      push(script === 'sup' ? body.replace(/-/g, '−') : body, script)
      continue
    }
    buf += ch
    i++
  }
  push(buf, 'normal')
  return runs
}

const ELEMENTS = new Set(
  (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
    'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu ' +
    'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr'
  ).split(' '),
)

/** The only single-element tokens that format without a charge. Stops "Y7", "B2", "P1" and "S2" being formatted. */
const MOLECULES = new Set(['H2', 'N2', 'O2', 'O3', 'F2', 'Cl2', 'Br2', 'I2', 'P4', 'S8'])
/** Tokens that parse as a formula but are school abbreviations. */
const NOT_FORMULA = new Set(['KS1', 'KS2', 'KS3', 'KS4', 'KS5'])
const SPECIAL: Record<string, string> = { 'I3-': 'I_3^-' }
const UNIT = '(?:mol|min|kg|km|cm|dm|mm|Pa|°C|m|s|g|h|N|J|W|V|A|C|K)'
const UNIT_POW = /^(mm|cm|dm|km)([23])$/
const UNIT_POW_AMBIGUOUS = /^m([23])$/ // "m2" can be a mass label, so it needs a number before it
const UNIT_NEG = new RegExp(`^(${UNIT})[-–−]([123])$`) // a hyphen, an en dash or a true minus sign
const UNIT_PER = new RegExp(`^(${UNIT})([23])?/(${UNIT})([23])?$`) // "kg/m3", "m/s2", "cm3/s"
const ELECTRONS = /^(\d*)e-$/ // "e-", "2e-"

/** Parse a formula body (no charge). Returns markup, or null when it is not a formula. */
function formulaBody(s: string): { markup: string; atoms: number; kinds: Set<string>; brackets: boolean; digits: boolean } | null {
  let i = 0,
    markup = '',
    atoms = 0,
    depth = 0,
    brackets = false,
    digits = false
  const kinds = new Set<string>()
  const stack: string[] = []
  let canCount = false
  while (i < s.length) {
    const two = s.slice(i, i + 2),
      one = s[i]
    if (/[A-Z]/.test(one)) {
      const sym = /^[A-Z][a-z]$/.test(two) && ELEMENTS.has(two) ? two : ELEMENTS.has(one) ? one : null
      if (!sym) return null
      markup += sym
      i += sym.length
      atoms++
      kinds.add(sym)
      canCount = true
    } else if (one === '(' || one === '[') {
      stack.push(one)
      depth++
      brackets = true
      markup += one
      i++
      canCount = false
    } else if (one === ')' || one === ']') {
      const open = stack.pop()
      if (!open || (open === '(') !== (one === ')')) return null
      depth--
      markup += one
      i++
      canCount = true
    } else if (/\d/.test(one)) {
      if (!canCount) return null
      const m = /^\d+/.exec(s.slice(i))![0]
      markup += `_{${m}}`
      i += m.length
      digits = true
      canCount = false
    } else return null
  }
  if (depth !== 0 || atoms === 0) return null
  return { markup, atoms, kinds, brackets, digits }
}

/** Format one token that might be a formula. Returns null when it should be left alone. */
function formulaToken(tok: string): string | null {
  if (SPECIAL[tok]) return SPECIAL[tok]
  if (NOT_FORMULA.has(tok)) return null
  // Hydrates: CuSO4.5H2O
  const hyd = /^([A-Za-z0-9()[\]]+)\.(\d*)([A-Za-z0-9()]+)$/.exec(tok)
  if (hyd) {
    const a = formulaBody(hyd[1]),
      b = formulaBody(hyd[3])
    return a && b && (a.digits || b.digits) ? `${a.markup}·${hyd[2]}${b.markup}` : null
  }
  let body = tok,
    charge = ''
  const sign = /[+-]$/.exec(tok)
  if (sign) {
    body = tok.slice(0, -1)
    const trail = /\d+$/.exec(body)?.[0] ?? ''
    const stem = body.slice(0, body.length - trail.length)
    const monatomic = ELEMENTS.has(stem)
    if (trail.length >= 2) {
      charge = trail.slice(-1) + sign[0]
      body = body.slice(0, -1)
    } else if (trail.length === 1 && (monatomic || stem.endsWith(']'))) {
      charge = trail + sign[0]
      body = stem
    } else charge = sign[0]
  }
  const fb = formulaBody(body)
  if (!fb) return null
  if (!charge && !fb.digits) return null // nothing to format
  const single = fb.kinds.size === 1 && !fb.brackets
  if (!charge && single && !MOLECULES.has(body)) return null // "Y7", "B2", "S2"
  return fb.markup + (charge ? `^{${charge}}` : '')
}

/**
 * Plain typing → markup. Deterministic. Explicit markup in the input is left untouched.
 * "50 cm3 of H2SO4" → "50 cm^3 of H_{2}SO_{4}".
 */
export function smartChem(input: string): string {
  let s = input
    .replace(/<->|<=>/g, '⇌')
    .replace(/->/g, '→')
    .replace(/<-/g, '←')
  s = s.replace(/(\d)\s?(?:oC|degC)\b/g, '$1 °C').replace(/(^|[\s(/])(?:oC|degC)\b/g, '$1°C')
  const parts = s.split(/(\s+)/)
  let prevNumeric = false,
    prevUnit = false
  return parts
    .map((part) => {
      if (/^\s*$/.test(part)) return part
      if (/[_^\\]/.test(part)) {
        prevNumeric = prevUnit = false
        return part
      }
      // Split off leading/trailing punctuation and a state symbol.
      const m = /^([([]?)(.*?)(\((?:s|l|g|aq)\))?([.,;:)\]]*)$/.exec(part)!
      let [, lead, core, state = '', trail] = m
      // A leading "(" or "[" that belongs to the formula itself (complex ions, bracketed groups).
      if (lead && formulaToken(lead + core + (trail.startsWith(')') || trail.startsWith(']') ? trail[0] : ''))) {
        const t = trail.startsWith(')') || trail.startsWith(']') ? trail[0] : ''
        core = lead + core + t
        lead = ''
        trail = trail.slice(t.length)
      }
      let out: string | null = null
      const numUnit = /^(\d+(?:\.\d+)?)([A-Za-z].*)$/.exec(core) // "30cm3"
      const unitCore = numUnit ? numUnit[2] : core
      const u1 = UNIT_POW.exec(unitCore),
        u2 = UNIT_NEG.exec(unitCore),
        u3 = UNIT_POW_AMBIGUOUS.exec(unitCore),
        u4 = UNIT_PER.exec(unitCore),
        el = ELECTRONS.exec(core)
      const pow = (unit: string, p?: string) => (p ? `${unit}^${p}` : unit)
      if (u1) out = `${u1[1]}^${u1[2]}`
      else if (u2) out = `${u2[1]}^{-${u2[2]}}`
      else if (u3 && (prevNumeric || prevUnit || numUnit)) out = `m^${u3[1]}`
      else if (u4 && (u4[2] || u4[4])) out = `${pow(u4[1], u4[2])}/${pow(u4[3], u4[4])}`
      else if (el) out = `${el[1]}e^{-}`
      const isUnit = out !== null
      if (out !== null && numUnit && !el) out = `${numUnit[1]} ${out}`
      if (out === null) {
        const coef = /^(\d+)(.+)$/.exec(core) // "2HCl"
        const f = formulaToken(coef ? coef[2] : core)
        if (f) out = (coef ? coef[1] : '') + f
      }
      prevNumeric = /^\d+(\.\d+)?$/.test(core)
      prevUnit = isUnit
      return lead + (out ?? core) + state + trail
    })
    .join('')
}
