// hyphens.ts — where a long word in the name of a library tile may break: soft hyphens (U+00AD) between its syllables.
// A tile is 76 px wide (section 12), so a word too wide for one line of its name would be cut at its edge. With soft
// hyphens it breaks instead, at the last break that fits, and shows a hyphen there; where it does not break, nothing
// shows. Only long words get them: a shorter word fits a line of a tile. The syllables come from a few plain rules of
// English hyphenation, enough for the names of apparatus. Pure.

export const SOFT_HYPHEN = '\u00ad'
/** A word gets break points when it has this many letters or more. */
export const LONG_WORD = 12
/** A break leaves at least this many letters on each side of it. */
export const MIN_PART = 4

/** A vowel; `y` is one too, except as the first letter of a word. */
const vowel = (w: string, i: number): boolean => /[aeiouäëïöüáéíóúàèìòùâêîôû]/i.test(w[i]) || (i > 0 && /y/i.test(w[i]))
/** Two consonants that sound as one and can begin a syllable: a break goes before them (-phy, -ther). */
const HEADS = ['ch', 'ph', 'sh', 'th', 'wh', 'qu']
/** Two consonants that sound as one and end a syllable: a break goes after them (brack-et). */
const TAILS = ['ck', 'gh']
/** Groups of consonants that can begin a syllable: before a vowel they stay together. */
const ONSETS = new Set([
  ...HEADS,
  ...['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'wr'],
  ...['chr', 'phr', 'sch', 'scr', 'shr', 'spl', 'spr', 'str', 'thr'],
])

/**
 * The places where a word of letters may break, as indexes: a break at `i` comes before letter `i`. Between two vowels,
 * one consonant goes with the next syllable (Chro-ma); of several consonants, the next syllable takes as many as can
 * begin one (Chromato-graphy, Elec-trolysis). A pair of consonants that sounds as one is never split (-phy, brack-).
 * No break leaves fewer than MIN_PART letters on a side.
 */
export function breaks(word: string): number[] {
  const out: number[] = []
  const pair = (at: number) => word.slice(at - 1, at + 1).toLowerCase()
  let i = 0
  while (i < word.length && !vowel(word, i)) i++ // the consonants before the first vowel
  while (i < word.length) {
    while (i < word.length && vowel(word, i)) i++
    const start = i // the consonants after a vowel
    while (i < word.length && !vowel(word, i)) i++
    if (i >= word.length) break // no vowel follows: the end of the word
    const run = word.slice(start, i).toLowerCase()
    let onset = 1
    for (let n = Math.min(3, run.length); n > 1; n--)
      if (ONSETS.has(run.slice(run.length - n))) {
        onset = n
        break
      }
    let at = i - onset
    if (at > start && TAILS.includes(pair(at))) at++
    else if (at > start && HEADS.includes(pair(at))) at--
    if (at >= MIN_PART && word.length - at >= MIN_PART) out.push(at)
  }
  return out
}

/** The name with soft hyphens at the breaks of each long word. Without them, it is the name again. */
export function softHyphens(name: string): string {
  return name.replace(/\p{L}+/gu, (word) => {
    if (word.length < LONG_WORD) return word
    let out = ''
    let from = 0
    for (const at of breaks(word)) {
      out += word.slice(from, at) + SOFT_HYPHEN
      from = at
    }
    return out + word.slice(from)
  })
}
