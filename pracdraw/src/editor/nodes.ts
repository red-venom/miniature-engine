// nodes.ts — render nodes memoised on the item object and the settings (the drag budget in section 6).
// A label also depends on its target item and, in letters mode, on its letter.

import type { Node } from '../kernel/nodes'
import { itemNode, labelLetters } from '../render/render'
import type { Doc, DocSettings, Item } from '../model/types'

interface Entry {
  settings: DocSettings
  dep: Item | undefined
  letter: string | undefined
  node: Node
}

const cache = new WeakMap<Item, Entry>()

/** The items in draw order: labels always after every symbol, connector and shape. */
export function drawList(doc: Doc): Item[] {
  const items = doc.order.map((id) => doc.items[id]).filter((it): it is Item => !!it)
  return [...items.filter((it) => it.type !== 'label'), ...items.filter((it) => it.type === 'label')]
}

export function cachedNode(doc: Doc, it: Item, letters: Map<string, string> | undefined): Node {
  const dep = it.type === 'label' && it.target && 'item' in it.target ? doc.items[it.target.item] : undefined
  const letter = letters?.get(it.id)
  const hit = cache.get(it)
  if (hit && hit.settings === doc.settings && hit.dep === dep && hit.letter === letter) return hit.node
  const node = itemNode(doc, it, letters)
  cache.set(it, { settings: doc.settings, dep, letter, node })
  return node
}

/** Every node of the diagram, back to front, from the cache. */
export function cachedNodes(doc: Doc): { id: string; node: Node }[] {
  const letters = doc.settings.labelMode === 'letters' ? labelLetters(doc) : undefined
  return drawList(doc).map((it) => ({ id: it.id, node: cachedNode(doc, it, letters) }))
}
