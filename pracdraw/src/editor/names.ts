// names.ts — what an item is called in the status bar and the inspector.

import type { Item } from '../model/types'
import { hasSymbol, symbolDef } from '../symbols/registry'

export function itemName(it: Item): string {
  switch (it.type) {
    case 'symbol':
      return hasSymbol(it.symbol) ? symbolDef(it.symbol).name : it.symbol
    case 'label':
      return `Label "${it.text.split('\n')[0]}"`
    case 'connector':
      return { glassTube: 'Glass tube', rubberTube: 'Rubber tube', wire: 'Wire', line: 'Line' }[it.kind]
    default:
      return it.shape === 'rect' ? 'Rectangle' : 'Ellipse'
  }
}
