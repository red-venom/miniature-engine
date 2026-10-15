// progress.ts — what is built against the plan. Run: npm run progress
import { readFileSync } from 'node:fs'
import { SYMBOLS } from '../src/symbols/registry.ts'
import { TEMPLATES } from '../src/templates/index.ts'

const catalogue = JSON.parse(readFileSync('spec/catalogue.json', 'utf8')) as { symbols: { id: string; pack: string; priority: string }[] }
const plan = JSON.parse(readFileSync('spec/templates.json', 'utf8')) as { templates: { id: string; priority: string }[] }
const built = new Set(SYMBOLS.map((s) => s.id)),
  made = new Set(TEMPLATES.map((t) => t.id))

const packs = [...new Set(catalogue.symbols.map((s) => s.pack))]
console.log('Symbols         A built/planned   B built/planned   C built/planned')
for (const pack of packs) {
  const count = (pri: string) => {
    const rows = catalogue.symbols.filter((s) => s.pack === pack && s.priority === pri)
    return `${rows.filter((s) => built.has(s.id)).length}/${rows.length}`
  }
  console.log(`  ${pack.padEnd(18)}${count('A').padEnd(18)}${count('B').padEnd(18)}${count('C')}`)
}
const total = (pri: string) => {
  const rows = catalogue.symbols.filter((s) => s.priority === pri)
  return `${rows.filter((s) => built.has(s.id)).length}/${rows.length}`
}
console.log(`  ${'TOTAL'.padEnd(18)}${total('A').padEnd(18)}${total('B').padEnd(18)}${total('C')}`)
const tcount = (pri: string) => {
  const rows = plan.templates.filter((t) => t.priority === pri)
  return `${rows.filter((t) => made.has(t.id)).length}/${rows.length}`
}
console.log(`Templates       A ${tcount('A')}   B ${tcount('B')}   C ${tcount('C')}`)
const next = catalogue.symbols.filter((s) => s.priority === 'A' && !built.has(s.id)).map((s) => s.id)
console.log(`Next (priority A, not built): ${next.join(', ') || 'none'}`)
const strays = SYMBOLS.filter((s) => !catalogue.symbols.some((c) => c.id === s.id)).map((s) => s.id)
if (strays.length) console.log(`Not in the catalogue: ${strays.join(', ')}`)
