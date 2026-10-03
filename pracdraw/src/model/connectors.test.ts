import { describe, expect, it } from 'vitest'
import { P, type Pt } from '../kernel/geom'
import { anchorWorld, DocBuilder } from './build'
import { addSymbol } from './commands'
import {
  ANGLE_SNAP,
  CONNECTOR_PRESETS,
  KIND_DEFAULTS,
  addConnector,
  angleSnap,
  capsFor,
  connectorAnchors,
  connectorRadius,
  connectorWidth,
  deletePoint,
  insertPoint,
  isDrawable,
  isTube,
  makeConnector,
  movePoint,
  nearestAnchor,
  placePoint,
  presetConnector,
  setConnector,
} from './connectors'
import { newDoc, type ConnectorItem, type Doc } from './types'

const con = (doc: Doc, id: string) => doc.items[id] as ConnectorItem
const xy = (it: ConnectorItem) => it.points.map((p) => [p.x, p.y])

/** One glass tube `t`: up 60, across 160, down 90. Three segments, two bends. */
const tubeDoc = (): Doc => addConnector(newDoc(), 'glassTube', [P(0, 0), P(0, -60), P(160, -60), P(160, 30)], {}, 't')
/** One wire `w` with a bend. */
const wireDoc = (): Doc => addConnector(newDoc(), 'wire', [P(0, 0), P(100, 0), P(100, 50)], {}, 'w')

describe('makeConnector and addConnector', () => {
  it('a glass tube is 7 wide with 12 u bends, a rubber tube 10 and 16; the two ends have no bend', () => {
    expect(makeConnector('glassTube', [P(0, 0), P(0, -60), P(100, -60)], {}, 'g')).toEqual({
      id: 'g',
      type: 'connector',
      kind: 'glassTube',
      points: [
        { x: 0, y: 0 },
        { x: 0, y: -60, r: 12 },
        { x: 100, y: -60 },
      ],
      startCap: 'none',
      endCap: 'none',
      width: 7,
    })
    const r = makeConnector('rubberTube', [P(0, 0), P(50, 0), P(100, 30), P(150, 30)])
    expect(r.width).toBe(10)
    expect(r.points.map((p) => p.r)).toEqual([undefined, 16, 16, undefined])
    expect(r.id).toMatch(/^[0-9a-z]{8}$/)
    expect(KIND_DEFAULTS).toEqual({ glassTube: { width: 7, radius: 12 }, rubberTube: { width: 10, radius: 16 }, wire: { radius: 0 }, line: { radius: 0 } })
  })
  it('a wire or a line has no width and sharp bends, and only they can be dashed', () => {
    expect(makeConnector('wire', [P(0, 0), P(10, 0), P(10, 10)], { dash: true }, 'w')).toEqual({
      id: 'w',
      type: 'connector',
      kind: 'wire',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      startCap: 'none',
      endCap: 'none',
      dash: true,
    })
    const line = makeConnector('line', [P(0, 0), P(5, 5)], { width: 9 })
    expect('width' in line).toBe(false)
    expect('dash' in line).toBe(false)
    expect('dash' in makeConnector('glassTube', [P(0, 0), P(10, 0)], { dash: true })).toBe(false)
  })
  it('the options set the width, the bend radius and the caps; a cap the kind cannot have is none', () => {
    const t = makeConnector('glassTube', [P(0, 0), P(10, 0), P(10, 10)], { width: 9, radius: 20, startCap: 'arrow', endCap: 'closed' })
    expect(t).toMatchObject({ width: 9, startCap: 'none', endCap: 'closed' })
    expect(t.points[1].r).toBe(20)
    const l = makeConnector('line', [P(0, 0), P(10, 0)], { startCap: 'closed', endCap: 'arrow' })
    expect([l.startCap, l.endCap]).toEqual(['none', 'arrow'])
    expect(capsFor('glassTube')).toEqual(['none', 'closed'])
    expect(capsFor('rubberTube')).toEqual(['none', 'closed'])
    expect(capsFor('wire')).toEqual(['none', 'arrow', 'dot', 'tick'])
    expect(capsFor('line')).toEqual(['none', 'arrow', 'dot', 'tick'])
    expect([isTube('glassTube'), isTube('rubberTube'), isTube('wire'), isTube('line')]).toEqual([true, true, false, false])
  })
  it('adds the connector on top and needs two points that are not on one spot', () => {
    const doc = addSymbol(newDoc(), 'beaker', 0, 0, 'b')
    const next = addConnector(doc, 'wire', [P(0, 0), P(10, 0)], {}, 'w')
    expect(next.order).toEqual(['b', 'w'])
    expect(next.items.b).toBe(doc.items.b)
    expect(doc.order).toEqual(['b'])
    expect(addConnector(doc, 'wire', [P(0, 0)])).toBe(doc)
    expect(addConnector(doc, 'glassTube', [P(5, 5), P(5, 5), P(5, 5)])).toBe(doc)
    expect([isDrawable([P(0, 0), P(0, 0), P(0, 1)]), isDrawable([P(0, 0), P(0, 0)]), isDrawable([P(0, 0)])]).toEqual([true, false, false])
  })
  it('the width and the bend radius that the inspector shows', () => {
    expect(connectorRadius(con(tubeDoc(), 't'))).toBe(12)
    expect(connectorRadius(con(wireDoc(), 'w'))).toBe(0)
    expect(connectorRadius(makeConnector('rubberTube', [P(0, 0), P(10, 0)]))).toBe(16) // no bend: the kind's default
    expect(connectorWidth(con(tubeDoc(), 't'))).toBe(7)
    expect(connectorWidth({ ...con(tubeDoc(), 't'), width: undefined })).toBe(7) // a template's tube with no width
    expect(connectorWidth(con(wireDoc(), 'w'))).toBeUndefined()
  })
})

describe('points', () => {
  it('movePoint moves one point; it keeps its bend, and the other points are shared', () => {
    const doc = tubeDoc()
    const next = movePoint(doc, 't', 1, P(10, -70))
    expect(con(next, 't').points[1]).toEqual({ x: 10, y: -70, r: 12 })
    expect(con(next, 't').points[0]).toBe(con(doc, 't').points[0])
    expect(con(doc, 't').points[1]).toEqual({ x: 0, y: -60, r: 12 })
    expect(movePoint(doc, 't', 3, P(200, 30)).items.t).toMatchObject({ points: [{}, {}, {}, { x: 200, y: 30 }] })
    expect(movePoint(doc, 't', 1, P(0, -60))).toBe(doc)
    expect(movePoint(doc, 't', 9, P(0, 0))).toBe(doc)
    expect(movePoint(doc, 't', 1, P(NaN, 0))).toBe(doc)
    expect(movePoint(doc, 'nothing', 0, P(1, 1))).toBe(doc)
  })
  it("insertPoint puts a new bend between two points, with the connector's bend radius", () => {
    const doc = tubeDoc()
    expect(con(insertPoint(doc, 't', 2, P(80, -90)), 't').points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: -60, r: 12 },
      { x: 80, y: -90, r: 12 },
      { x: 160, y: -60, r: 12 },
      { x: 160, y: 30 },
    ])
    expect(xy(con(insertPoint(doc, 't', 1, P(-10, -30)), 't'))).toEqual([
      [0, 0],
      [-10, -30],
      [0, -60],
      [160, -60],
      [160, 30],
    ])
    expect(xy(con(insertPoint(doc, 't', 3, P(170, -10)), 't'))[3]).toEqual([170, -10])
    // A wire's new bend is sharp. A straight glass tube's first bend gets the kind's 12 u.
    expect(con(insertPoint(wireDoc(), 'w', 1, P(50, 20)), 'w').points[1]).toEqual({ x: 50, y: 20 })
    const straight = addConnector(newDoc(), 'glassTube', [P(0, 0), P(100, 0)], {}, 's')
    expect(con(insertPoint(straight, 's', 1, P(50, 20)), 's').points[1]).toEqual({ x: 50, y: 20, r: 12 })
    // Only between two points.
    for (const i of [0, 4, 1.5]) expect(insertPoint(doc, 't', i, P(1, 1))).toBe(doc)
  })
  it('a connector never ends up with every point on one spot: the kernel could not draw the tube', () => {
    const two = addConnector(newDoc(), 'glassTube', [P(0, 0), P(10, 0)], {}, 't')
    expect(movePoint(two, 't', 1, P(0, 0))).toBe(two)
    expect(con(movePoint(two, 't', 1, P(0, 1)), 't').points[1]).toEqual({ x: 0, y: 1 })
    const back = addConnector(newDoc(), 'wire', [P(0, 0), P(10, 0), P(0, 0)], {}, 'w')
    expect(deletePoint(back, 'w', 1)).toBe(back)
    expect(xy(con(deletePoint(back, 'w', 0), 'w'))).toEqual([
      [10, 0],
      [0, 0],
    ])
  })
  it('deletePoint takes one point away, and two points always remain', () => {
    const doc = tubeDoc()
    let next = deletePoint(doc, 't', 1)
    expect(xy(con(next, 't'))).toEqual([
      [0, 0],
      [160, -60],
      [160, 30],
    ])
    next = deletePoint(next, 't', 0)
    expect(xy(con(next, 't'))).toEqual([
      [160, -60],
      [160, 30],
    ])
    expect(deletePoint(next, 't', 0)).toBe(next)
    expect(deletePoint(next, 't', 1)).toBe(next)
    expect(deletePoint(doc, 't', 7)).toBe(doc)
    expect(deletePoint(doc, 't', -1)).toBe(doc)
  })
  it('when an end goes, the bend next to it becomes the new end, with no bend radius', () => {
    const doc = tubeDoc()
    expect(con(deletePoint(doc, 't', 0), 't').points).toEqual([
      { x: 0, y: -60 },
      { x: 160, y: -60, r: 12 },
      { x: 160, y: 30 },
    ])
    expect(con(deletePoint(doc, 't', 3), 't').points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: -60, r: 12 },
      { x: 160, y: -60 },
    ])
    // A bend in the middle goes, and the bends on either side keep their radius.
    expect(con(deletePoint(doc, 't', 1), 't').points.map((p) => p.r)).toEqual([undefined, 12, undefined])
  })
  it('the point commands leave other items alone', () => {
    const doc = addSymbol(tubeDoc(), 'beaker', 0, 0, 'b')
    expect(movePoint(doc, 'b', 0, P(5, 5))).toBe(doc)
    expect(insertPoint(doc, 'b', 1, P(5, 5))).toBe(doc)
    expect(deletePoint(doc, 'b', 0)).toBe(doc)
    expect(setConnector(doc, 'b', { kind: 'wire' })).toBe(doc)
  })
})

describe('setConnector', () => {
  it('sets the width of a tube, every bend at once, the dash of a wire or a line, and the caps', () => {
    const doc = tubeDoc()
    expect(con(setConnector(doc, 't', { width: 9 }), 't').width).toBe(9)
    expect(con(setConnector(doc, 't', { radius: 20 }), 't').points.map((p) => p.r)).toEqual([undefined, 20, 20, undefined])
    expect(con(setConnector(doc, 't', { radius: 0 }), 't').points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: -60 },
      { x: 160, y: -60 },
      { x: 160, y: 30 },
    ])
    expect(con(setConnector(doc, 't', { endCap: 'closed' }), 't')).toMatchObject({ startCap: 'none', endCap: 'closed' })
    const w = wireDoc()
    expect(con(setConnector(w, 'w', { dash: true }), 'w').dash).toBe(true)
    expect('dash' in con(setConnector(setConnector(w, 'w', { dash: true }), 'w', { dash: false }), 'w')).toBe(false)
    expect(con(setConnector(w, 'w', { startCap: 'dot', endCap: 'tick' }), 'w')).toMatchObject({ startCap: 'dot', endCap: 'tick' })
  })
  it('a new kind takes its own defaults where the old defaults were, and keeps what the user chose', () => {
    const doc = tubeDoc()
    const rubber = con(setConnector(doc, 't', { kind: 'rubberTube' }), 't')
    expect(rubber.kind).toBe('rubberTube')
    expect(rubber.width).toBe(10)
    expect(rubber.points.map((p) => p.r)).toEqual([undefined, 16, 16, undefined])
    const chosen = setConnector(doc, 't', { width: 9, radius: 20 })
    expect(con(setConnector(chosen, 't', { kind: 'rubberTube' }), 't')).toMatchObject({ width: 9, points: [{}, { r: 20 }, { r: 20 }, {}] })
    // A wire becomes a glass tube: 7 wide with 12 u bends. And back: sharp, with no width.
    const glass = con(setConnector(wireDoc(), 'w', { kind: 'glassTube' }), 'w')
    expect(glass).toMatchObject({
      width: 7,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0, r: 12 },
        { x: 100, y: 50 },
      ],
    })
    const back = con(setConnector(setConnector(wireDoc(), 'w', { kind: 'glassTube' }), 'w', { kind: 'wire' }), 'w')
    expect(back).toEqual(con(wireDoc(), 'w'))
    // A template's tube has no width of its own: it is the default.
    const template = new DocBuilder()
    template.connector('glassTube', [P(0, 0), P(10, 0)])
    expect(con(setConnector(template.doc, 'glassTube1', { kind: 'rubberTube' }), 'glassTube1').width).toBe(10)
  })
  it('drops what the new kind cannot have', () => {
    const line = addConnector(newDoc(), 'line', [P(0, 0), P(50, 0)], { dash: true, startCap: 'tick', endCap: 'arrow' }, 'l')
    const tube = con(setConnector(line, 'l', { kind: 'glassTube' }), 'l')
    expect(tube).toMatchObject({ kind: 'glassTube', startCap: 'none', endCap: 'none', width: 7 })
    expect('dash' in tube).toBe(false)
    const closed = setConnector(tubeDoc(), 't', { endCap: 'closed', width: 9 })
    const wire = con(setConnector(closed, 't', { kind: 'wire' }), 't')
    expect(wire.endCap).toBe('none')
    expect('width' in wire).toBe(false)
    // A cap or a dash that the kind cannot have is not taken.
    expect(setConnector(tubeDoc(), 't', { endCap: 'arrow' }).items.t).toMatchObject({ endCap: 'none' })
    expect('dash' in con(setConnector(tubeDoc(), 't', { dash: true }), 't')).toBe(false)
    expect('width' in con(setConnector(wireDoc(), 'w', { width: 9 }), 'w')).toBe(false)
  })
  it('keeps values in range, ignores bad ones, and gives the same document when nothing changes', () => {
    const doc = tubeDoc()
    expect(con(setConnector(doc, 't', { width: 0.5 }), 't').width).toBe(2)
    expect(con(setConnector(doc, 't', { width: 500 }), 't').width).toBe(40)
    expect(con(setConnector(doc, 't', { radius: -3 }), 't').points[1].r).toBeUndefined()
    expect(con(setConnector(doc, 't', { radius: 900 }), 't').points[1].r).toBe(200)
    expect(setConnector(doc, 't', { width: NaN, radius: Infinity })).toBe(doc)
    expect(setConnector(doc, 't', {})).toBe(doc)
    expect(setConnector(doc, 't', { kind: 'glassTube', width: 7, radius: 12, startCap: 'none' })).toBe(doc)
    expect(setConnector(doc, 'nothing', { width: 9 })).toBe(doc)
    expect(con(doc, 't').width).toBe(7)
  })
})

describe('angleSnap', () => {
  const o = P(0, 0)
  it('a segment within 5° of level or upright becomes exactly level or upright', () => {
    expect(ANGLE_SNAP).toBe(5)
    expect(angleSnap(P(100, 5), [o])).toEqual(P(100, 0)) // 2.9°
    expect(angleSnap(P(100, -8.7), [o])).toEqual(P(100, 0)) // 4.97°
    expect(angleSnap(P(-100, 3), [o])).toEqual(P(-100, 0)) // to the left
    expect(angleSnap(P(-4, -100), [o])).toEqual(P(0, -100)) // upright
    expect(angleSnap(P(6, 120), [P(10, 20)])).toEqual(P(10, 120))
  })
  it('a segment more than 5° away does not snap', () => {
    expect(angleSnap(P(100, 8.8), [o])).toEqual(P(100, 8.8)) // 5.03°
    expect(angleSnap(P(100, 40), [o])).toEqual(P(100, 40))
    expect(angleSnap(P(-12, 100), [o])).toEqual(P(-12, 100)) // 6.8° from upright
  })
  it('with Shift, the nearest 45° step: exact, with whole-unit offsets', () => {
    expect(angleSnap(P(100, 80), [o], true)).toEqual(P(90, 90))
    expect(angleSnap(P(100, 20), [o], true)).toEqual(P(100, 0))
    expect(angleSnap(P(-30, 100), [o], true)).toEqual(P(0, 100))
    expect(angleSnap(P(-50, -62), [P(10, 10)], true)).toEqual(P(-56, -56))
    expect(angleSnap(P(70, -50), [P(10, 10)], true)).toEqual(P(70, -50)) // already at −45°
    expect(angleSnap(P(80, -50), [P(10, 10)], true)).toEqual(P(75, -55))
  })
  it('with two neighbours both segments snap: the point goes to the corner', () => {
    expect(angleSnap(P(3, 98), [o, P(100, 100)])).toEqual(P(0, 100))
    expect(angleSnap(P(97, 4), [o, P(100, 100)])).toEqual(P(100, 0))
    // Only one of the two segments is near an axis: only that one snaps.
    expect(angleSnap(P(50, 3), [o, P(100, 60)])).toEqual(P(50, 0))
    // With Shift, the point where both segments are at 45° steps.
    expect(angleSnap(P(52, 46), [o, P(100, 0)], true)).toEqual(P(50, 50))
  })
  it('two parallel lines, or lines that cross far from the pointer: onto the nearer line', () => {
    // Both segments nearly level, towards heights 0 and 10: the nearer height wins.
    expect(angleSnap(P(200, 4), [o, P(400, 10)])).toEqual(P(200, 0))
    expect(angleSnap(P(200, 6), [o, P(400, 10)])).toEqual(P(200, 10))
    // With Shift: 45° from the left and level from the right cross at the left neighbour, far from the pointer.
    expect(angleSnap(P(90, 40), [o, P(200, 0)], true)).toEqual(P(65, 65))
  })
  it('a point on its neighbour, or with no neighbour, stays where it is', () => {
    expect(angleSnap(P(5, 5), [])).toEqual(P(5, 5))
    expect(angleSnap(P(5, 5), [P(5, 5)])).toEqual(P(5, 5))
    expect(angleSnap(P(5, 5), [P(5, 5)], true)).toEqual(P(5, 5))
  })
  it('keeps the other coordinate exactly, also for anchors that are not on whole units', () => {
    const q = angleSnap(P(300, 101), [P(190.37, 100.42)])
    expect(q).toEqual(P(300, 100.42))
  })
})

describe('the anchor snap', () => {
  function bench() {
    const b = new DocBuilder()
    const bung = b.symbol('bung', { x: 100, y: 100 }) // one hole: a port at the top centre, 12 u above the centre
    b.symbol('beaker', { x: 300, y: 100 }) // a mouth and a base, no port
    const burner = b.symbol('bunsenBurner', { x: 0, y: 300, rot: 90 }) // a gas port, turned with the burner
    const burette = b.symbol('burette', { x: 500, y: 300 }) // a tip
    return { doc: b.doc, bung, burner, burette }
  }
  it('connectorAnchors lists the ports, terminals and tips of every symbol, in the world', () => {
    const { doc, burner, burette } = bench()
    const anchors = connectorAnchors(doc)
    expect(anchors).toHaveLength(3)
    expect(anchors[0]).toEqual(P(100, 88))
    const near = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) < 0.01
    expect(near(anchors[1], anchorWorld(burner, 'gas'))).toBe(true)
    expect(near(anchors[2], anchorWorld(burette, 'tip'))).toBe(true)
    expect(connectorAnchors(addConnector(newDoc(), 'wire', [P(0, 0), P(1, 1)]))).toEqual([])
  })
  it('nearestAnchor: the nearest within reach', () => {
    const anchors = [P(0, 0), P(10, 0)]
    expect(nearestAnchor(anchors, P(6, 1), 8)).toEqual(P(10, 0))
    expect(nearestAnchor(anchors, P(-7, 0), 8)).toEqual(P(0, 0))
    expect(nearestAnchor(anchors, P(-9, 0), 8)).toBeNull()
    expect(nearestAnchor([], P(0, 0), 8)).toBeNull()
  })
  it('placePoint: an anchor within reach wins over the angles; otherwise whole units, snapped', () => {
    const anchors = [P(100.5, 88)]
    const opts = { anchors, reach: 8, step45: false, snap: true }
    expect(placePoint(P(104, 90), [P(0, 0)], opts)).toEqual({ p: P(100.5, 88), anchor: true })
    expect(placePoint(P(150.4, 3.2), [P(0, 0)], opts)).toEqual({ p: P(150, 0), anchor: false })
    expect(placePoint(P(150.4, 30.6), [P(0, 0)], opts)).toEqual({ p: P(150, 31), anchor: false })
    // Snap off (or Ctrl): no anchor, no 5° snap; Shift still gives 45° steps.
    expect(placePoint(P(104, 90), [P(0, 0)], { ...opts, snap: false })).toEqual({ p: P(104, 90), anchor: false })
    expect(placePoint(P(150.4, 3.2), [P(0, 0)], { ...opts, snap: false })).toEqual({ p: P(150, 3), anchor: false })
    expect(placePoint(P(150.4, 3.2), [P(0, 0)], { ...opts, snap: false, step45: true })).toEqual({ p: P(150, 0), anchor: false })
    // The reach is in units: 8 screen px at 200 % is 4 u.
    expect(placePoint(P(105, 88), [], { ...opts, reach: 4 })).toEqual({ p: P(105, 88), anchor: false })
  })
})

describe('presets', () => {
  const at = P(500, 400)
  const preset = (id: string) =>
    presetConnector(
      CONNECTOR_PRESETS.find((p) => p.id === id)!,
      at,
      id,
    )
  const steps = (it: ConnectorItem) => it.points.slice(1).map((p, i) => [p.x - it.points[i].x, p.y - it.points[i].y])
  it('the six presets of section 10, in the library order', () => {
    expect(CONNECTOR_PRESETS.map((p) => p.name)).toEqual(['Delivery tube', 'Right-angle tube', 'Rubber tubing', 'Wire', 'Arrow', 'Dimension line'])
    const delivery = preset('deliveryTube')
    expect(delivery).toMatchObject({ kind: 'glassTube', width: 7, startCap: 'none', endCap: 'none' })
    expect(steps(delivery)).toEqual([
      [0, -60],
      [160, 0],
      [0, 90],
    ])
    expect(delivery.points.map((p) => p.r)).toEqual([undefined, 12, 12, undefined])
    expect(steps(preset('rightAngleTube'))).toEqual([
      [0, -60],
      [100, 0],
    ])
    const rubber = preset('rubberTubing')
    expect(rubber).toMatchObject({ kind: 'rubberTube', width: 10 })
    expect(steps(rubber)).toEqual([
      [50, 0],
      [50, 30],
      [50, 0],
    ])
    expect(preset('wire')).toMatchObject({ kind: 'wire', startCap: 'none', endCap: 'none' })
    expect(steps(preset('wire'))).toEqual([[120, 0]])
    expect(preset('arrow')).toMatchObject({ kind: 'line', startCap: 'none', endCap: 'arrow' })
    expect(steps(preset('arrow'))).toEqual([[80, 0]])
    expect(preset('dimensionLine')).toMatchObject({ kind: 'line', startCap: 'tick', endCap: 'tick' })
    expect(steps(preset('dimensionLine'))).toEqual([[120, 0]])
  })
  it('a preset is centred on the point, on whole units, with a new id unless one is given', () => {
    const d = preset('deliveryTube')
    const xs = d.points.map((p) => p.x),
      ys = d.points.map((p) => p.y)
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBe(500)
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBe(400)
    const odd = presetConnector(CONNECTOR_PRESETS[0], P(10.4, 20.6))
    for (const p of odd.points) expect([Number.isInteger(p.x), Number.isInteger(p.y)]).toEqual([true, true])
    expect(odd.id).toMatch(/^[0-9a-z]{8}$/)
  })
})
