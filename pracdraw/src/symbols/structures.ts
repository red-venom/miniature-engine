// structures.ts — giant structures drawn in the oblique projection of rule S14: ionic lattices, diamond, graphite, fullerenes (release 1.2).
// The pack is split over files so that authors never share one: lattices.ts and cages.ts. The symbols are in the plan in
// spec/catalogue.json (priority C). Shared projection: oblique.ts.

import { cages } from './cages'
import { lattices } from './lattices'
import type { SymbolDef } from './types'

export const structures: SymbolDef[] = [...lattices, ...cages]
