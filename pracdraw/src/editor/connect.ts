// connect.ts — where a connector point goes for a pointer (section 10), with the thresholds in screen px: an anchor
// within 8 px snaps, and a pointer that moves less than 4 px between press and release is a click. Pure apart from a
// cache of each document's anchors.

import type { Pt } from '../kernel/geom'
import { connectorAnchors, placePoint } from '../model/connectors'
import { SNAP_PX } from '../model/snap'
import type { Doc } from '../model/types'

/** A port, terminal or tip this near, in screen px, catches a connector point: the same 8 px as every snap. */
export { SNAP_PX }
/** A pointer that moves less than this, in screen px, between press and release is a click. */
export const CLICK_PX = 4

const anchorCache = new WeakMap<Doc, Pt[]>()

/** The ports, terminals and tips of a document in the world, worked out once for each document object. */
export function anchorsOf(doc: Doc): Pt[] {
  let a = anchorCache.get(doc)
  if (!a) {
    a = connectorAnchors(doc)
    anchorCache.set(doc, a)
  }
  return a
}

/** The modifier keys that change where a point goes: Shift gives 45° steps; Ctrl or Cmd turns snapping off. */
export interface PointKeys {
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

/** Snapping is on unless the Snap view preference is off, or Ctrl or Cmd is held during the drag (section 12). */
export const snapping = (pref: boolean, keys: Pick<PointKeys, 'ctrlKey' | 'metaKey'>): boolean => pref && !keys.ctrlKey && !keys.metaKey

/**
 * Where a connector point goes for a pointer at world point `p`, next to `neighbours` on the connector: onto a port,
 * terminal or tip within 8 screen px, or snapped to the angles. With Snap off, or Ctrl or Cmd held, only Shift's 45°
 * steps apply.
 */
export function pointFor(doc: Doc, p: Pt, neighbours: readonly Pt[], zoom: number, snap: boolean, keys: PointKeys): { p: Pt; anchor: boolean } {
  return placePoint(p, neighbours, { anchors: anchorsOf(doc), reach: SNAP_PX / zoom, step45: keys.shiftKey, snap: snapping(snap, keys) })
}
