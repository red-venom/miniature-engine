import type { Doc } from '../model/types'

export interface TemplateDef {
  /** Same id as in spec/templates.json. */
  id: string
  title: string
  group: 'General' | 'Chemistry' | 'Biology' | 'Physics'
  /** Which required practicals it serves, as shown in the gallery. */
  refs: string
  /** A fresh document each call. Place parts by anchors (DocBuilder.at, .on and .near), not by typed coordinates. */
  build(): Doc
}
