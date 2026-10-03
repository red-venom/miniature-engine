import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../templates'
import { docThumb, templateDoc } from './thumbs'

describe('templateDoc', () => {
  it("builds a template's document once, for its thumbnails in the gallery and on the card of an empty canvas", () => {
    const tpl = TEMPLATES.find((t) => t.id === 'titration')!
    const doc = templateDoc(tpl)
    expect(templateDoc(tpl)).toBe(doc)
    expect(doc).toEqual(tpl.build())
    expect(templateDoc(TEMPLATES.find((t) => t.id === 'heatingBeaker')!)).not.toBe(doc)
  })

  it('a thumbnail of it has the aspect asked for and draws every item', () => {
    const doc = templateDoc(TEMPLATES.find((t) => t.id === 'rateGasOverWater')!)
    const t = docThumb(doc, 120 / 84)
    const [, , w, h] = t.viewBox.split(' ').map(Number)
    expect(w / h).toBeCloseTo(120 / 84, 9)
    expect(t.nodes).toHaveLength(doc.order.length)
  })
})
