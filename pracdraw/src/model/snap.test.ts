import { describe, expect, it } from 'vitest'
import { P, type Pt } from '../kernel/geom'
import { itemBox } from './bounds'
import { anchorOf, anchorWorld, DocBuilder } from './build'
import { DIR_WITHIN, SNAP_PX, TIP_REACH, facing, fitWidth, moveSnapped, snap, snapContext, type SnapResult } from './snap'
import type { Doc, SymbolItem } from './types'

/** The drag that takes an anchor of an item to a point, give or take (ex, ey). */
function toward(it: SymbolItem, anchor: string, p: Pt, ex = 0, ey = 0): [number, number] {
  const a = anchorWorld(it, anchor)
  return [p.x - a.x + ex, p.y - a.y + ey]
}

/** Where an anchor of a moving item is after the snapped drag. */
const after = (doc: Doc, id: string, r: SnapResult, anchor: string): Pt => anchorWorld(moveSnapped(doc, [id], r).items[id] as SymbolItem, anchor)

/** The point where two anchors met, or undefined when no anchor snapped. */
const met = (r: SnapResult): Pt | undefined => r.guides.find((g) => g.kind === 'anchor')?.p

function near(a: Pt | undefined, b: Pt, digits = 9): void {
  expect(a).toBeDefined()
  expect(a!.x).toBeCloseTo(b.x, digits)
  expect(a!.y).toBeCloseTo(b.y, digits)
}

describe('the snap table: one test for each row', () => {
  it('base → surface: the base sits on the surface; sideways it snaps to the centre only within T', () => {
    const b = new DocBuilder()
    const gauze = b.symbol('gauze', { x: 0, y: 0 }) // top: a surface 136 wide at (0, −2.5)
    const beaker = b.symbol('beaker', { x: 30, y: -100 })
    const top = anchorWorld(gauze, 'top')
    // 3 u above the surface and 30 u right of its centre: the base comes down onto it and stays 30 u right.
    let [dx, dy] = toward(beaker, 'base', top, 30, -3)
    let r = snap(b.doc, [beaker.id], dx, dy, 1)
    expect(r).toMatchObject({ dx, dy: dy + 3 })
    near(after(b.doc, beaker.id, r, 'base'), P(30, -2.5))
    // The surface shows as a guide line, and a mark where the base sits.
    expect(r.guides[0]).toEqual({ kind: 'line', a: P(-68, -2.5), b: P(68, -2.5) })
    near(met(r), P(30, -2.5))
    // 2 u below the surface and 5 u left of its centre: up onto the surface, and onto its centre.
    ;[dx, dy] = toward(beaker, 'base', top, -5, 2)
    r = snap(b.doc, [beaker.id], dx, dy, 1)
    near(after(b.doc, beaker.id, r, 'base'), top)
    // Out of reach: 9 u above the surface (T = 8 u), or beyond the end of the surface (it is 68 u each side).
    for (const [ex, ey] of [
      [30, -9],
      [69, -3],
    ]) {
      ;[dx, dy] = toward(beaker, 'base', top, ex, ey)
      r = snap(b.doc, [beaker.id], dx, dy, 1)
      expect(met(r)).toBeUndefined()
      expect(r.dx).toBe(dx)
    }
  })

  it('plug ↔ mouth: the two points meet, whichever one moves', () => {
    const b = new DocBuilder()
    const flask = b.symbol('conicalFlask', { x: 0, y: 0 }) // mouth 34 wide at (0, −75)
    const bung = b.symbol('bung', { x: 100, y: -200, w: 37.2 }) // plug 34 wide: the fit rule has nothing to do
    const mouth = anchorWorld(flask, 'mouth'),
      plug = anchorWorld(bung, 'plug')
    const [dx, dy] = toward(bung, 'plug', mouth, 3, -2)
    const r = snap(b.doc, [bung.id], dx, dy, 1)
    expect(r.resize).toBeUndefined()
    near(after(b.doc, bung.id, r, 'plug'), mouth)
    near(met(r), mouth)
    // The reverse: the flask moves, and its mouth comes up to the bung's plug.
    const [fx, fy] = toward(flask, 'mouth', plug, -4, 5)
    const back = snap(b.doc, [flask.id], fx, fy, 1)
    expect(back.resize).toBeUndefined()
    near(after(b.doc, flask.id, back, 'mouth'), plug)
    // 9 u apart is out of reach.
    const [gx, gy] = toward(bung, 'plug', mouth, 9, 0)
    expect(met(snap(b.doc, [bung.id], gx, gy, 1))).toBeUndefined()
  })

  it('round ↔ cup: the two points meet, whichever one moves', () => {
    const b = new DocBuilder()
    const mantle = b.symbol('heatingMantle', { x: 0, y: 0 })
    const flask = b.symbol('roundBottomFlask', { x: 300, y: -200 })
    const cup = anchorWorld(mantle, 'cup'),
      bottom = anchorWorld(flask, 'bottom')
    let [dx, dy] = toward(flask, 'bottom', cup, 4, -4)
    near(after(b.doc, flask.id, snap(b.doc, [flask.id], dx, dy, 1), 'bottom'), cup)
    ;[dx, dy] = toward(mantle, 'cup', bottom, -3, 3)
    near(after(b.doc, mantle.id, snap(b.doc, [mantle.id], dx, dy, 1), 'cup'), bottom)
    ;[dx, dy] = toward(flask, 'bottom', cup, 6, -6) // 8.5 u away
    expect(met(snap(b.doc, [flask.id], dx, dy, 1))).toBeUndefined()
  })

  it('grip ↔ neck: the clamp jaws and the neck meet, whichever one moves', () => {
    const b = new DocBuilder()
    const flask = b.symbol('conicalFlask', { x: 0, y: 0 })
    const clamp = b.symbol('bossClamp', { x: 300, y: -200 })
    const neck = anchorWorld(flask, 'neck'),
      grip = anchorWorld(clamp, 'grip')
    let [dx, dy] = toward(clamp, 'grip', neck, 5, 5)
    near(after(b.doc, clamp.id, snap(b.doc, [clamp.id], dx, dy, 1), 'grip'), neck)
    ;[dx, dy] = toward(flask, 'neck', grip, -7, 0)
    near(after(b.doc, flask.id, snap(b.doc, [flask.id], dx, dy, 1), 'neck'), grip)
  })

  it('sleeve → rod: the sleeve moves onto the rod line and is free along it, from the top of the stand to its base', () => {
    const b = new DocBuilder()
    const stand = b.symbol('clampStand', { x: 0, y: 0 }) // the rod line is x = −51, from y = −190 down to 190
    const clamp = b.symbol('bossClamp', { x: 200, y: 0 })
    const rod = anchorWorld(stand, 'rod')
    expect(rod).toEqual(P(-51, 0))
    for (const y of [-150, 0, 120, 189]) {
      const [dx, dy] = toward(clamp, 'sleeve', P(rod.x, y), 5, 0)
      const r = snap(b.doc, [clamp.id], dx, dy, 1)
      expect(r.dy).toBe(dy) // free in height
      near(after(b.doc, clamp.id, r, 'sleeve'), P(-51, y))
      expect(r.guides[0]).toEqual({ kind: 'line', a: P(-51, -190), b: P(-51, 190) })
    }
    // Above the top of the stand's box, below its base, or 9 u from the line: no snap.
    for (const [x, y] of [
      [-46, -195],
      [-46, 195],
      [-42, 0],
    ]) {
      const [dx, dy] = toward(clamp, 'sleeve', P(x, y))
      expect(met(snap(b.doc, [clamp.id], dx, dy, 1))).toBeUndefined()
    }
  })

  it('tip → mouth: the tip moves onto the centre line only, within 40 u of the mouth along it', () => {
    const b = new DocBuilder()
    const flask = b.symbol('conicalFlask', { x: 0, y: 0 }) // mouth at (0, −75), its centre line upright
    const thermometer = b.symbol('thermometer', { x: 300, y: -200 }) // bulb: a tip
    const mouth = anchorWorld(flask, 'mouth')
    for (const along of [-30, 0, 20, TIP_REACH]) {
      const [dx, dy] = toward(thermometer, 'bulb', P(mouth.x, mouth.y - along), 6, 0)
      const r = snap(b.doc, [thermometer.id], dx, dy, 1)
      expect(r.dy).toBe(dy)
      near(after(b.doc, thermometer.id, r, 'bulb'), P(0, mouth.y - along))
    }
    // 41 u down the line, or 9 u off it: no snap.
    for (const [x, y] of [
      [3, mouth.y + 41],
      [9, mouth.y + 10],
    ]) {
      const [dx, dy] = toward(thermometer, 'bulb', P(x, y))
      expect(met(snap(b.doc, [thermometer.id], dx, dy, 1))).toBeUndefined()
    }
    // Only the tip moves onto a mouth: a mouth that moves to a tip does not snap.
    const bulb = anchorWorld(thermometer, 'bulb')
    const [fx, fy] = toward(flask, 'mouth', P(bulb.x + 3, bulb.y + 10))
    expect(met(snap(b.doc, [flask.id], fx, fy, 1))).toBeUndefined()
  })
})

describe('snap rules', () => {
  it('the direction rule: both directions, as the items stand, opposite within 30°', () => {
    expect(DIR_WITHIN).toBe(30)
    expect(facing(P(0, 1), P(0, -1))).toBe(true)
    expect(facing(P(0, 1), P(1, 0))).toBe(false)
    expect(facing(undefined, P(1, 0))).toBe(true) // a neck has no direction: the rule does not apply
    const tilted = (rot: number) => {
      const b = new DocBuilder()
      const gauze = b.symbol('gauze', { x: 0, y: 0 })
      const beaker = b.symbol('beaker', { x: 0, y: -200, rot })
      const [dx, dy] = toward(beaker, 'base', anchorWorld(gauze, 'top'), 0, -3)
      return met(snap(b.doc, [beaker.id], dx, dy, 1))
    }
    expect(tilted(25)).toBeDefined()
    expect(tilted(330)).toBeDefined()
    expect(tilted(45)).toBeUndefined()
    expect(tilted(180)).toBeUndefined()
    // A flipped boss and clamp faces the same way as the rod: its sleeve does not go on.
    const onRod = (flip: boolean) => {
      const b = new DocBuilder()
      const stand = b.symbol('clampStand', { x: 0, y: 0 })
      const clamp = b.symbol('bossClamp', { x: 200, y: 0, flip })
      const [dx, dy] = toward(clamp, 'sleeve', anchorWorld(stand, 'rod'), 3, 0)
      return met(snap(b.doc, [clamp.id], dx, dy, 1))
    }
    expect(onRod(false)).toBeDefined()
    expect(onRod(true)).toBeUndefined()
  })

  it('the fit rule: a free plug takes the width of the mouth (a bung: the mouth width + 3.2)', () => {
    for (const [vessel, width] of [
      ['conicalFlask', 34],
      ['testTube', 24],
    ] as const) {
      const b = new DocBuilder()
      const v = b.symbol(vessel, { x: 0, y: 0 })
      const bung = b.symbol('bung', { x: 100, y: -200 }) // 38 wide: its plug is 34.8 wide
      const mouth = anchorWorld(v, 'mouth')
      expect(anchorOf(v, 'mouth').width).toBe(width)
      const [dx, dy] = toward(bung, 'plug', mouth, -3, 4)
      const r = snap(b.doc, [bung.id], dx, dy, 1)
      expect(r.resize).toEqual({ id: bung.id, w: width + 3.2 })
      // One document holds the move and the new width: the plug sits on the mouth and is as wide as it.
      const doc = moveSnapped(b.doc, [bung.id], r)
      const fitted = doc.items[bung.id] as SymbolItem
      expect(fitted.w).toBe(width + 3.2)
      expect(fitted.h).toBe(24)
      near(anchorWorld(fitted, 'plug'), mouth)
      expect(anchorOf(fitted, 'plug').width).toBeCloseTo(width, 6)
      near(met(r), mouth)
    }
  })

  it('the fit rule works when the mouth moves, and only for a free plug that is not locked', () => {
    const b = new DocBuilder()
    const tube = b.symbol('testTube', { x: 0, y: 0 })
    const bung = b.symbol('bung', { x: 200, y: -200 })
    const plug = anchorWorld(bung, 'plug')
    const [dx, dy] = toward(tube, 'mouth', plug, 2, 2)
    const r = snap(b.doc, [tube.id], dx, dy, 1)
    expect(r.resize).toEqual({ id: bung.id, w: 27.2 })
    const doc = moveSnapped(b.doc, [tube.id], r)
    near(anchorWorld(doc.items[tube.id] as SymbolItem, 'mouth'), anchorWorld(doc.items[bung.id] as SymbolItem, 'plug'))
    // A locked bung keeps its width; the mouth still snaps to it.
    const locked: Doc = { ...b.doc, items: { ...b.doc.items, [bung.id]: { ...bung, locked: true } } }
    const l = snap(locked, [tube.id], dx, dy, 1)
    expect(l.resize).toBeUndefined()
    near(after(locked, tube.id, l, 'mouth'), plug)
    // A thermometer adaptor cannot be resized: its plug snaps into a test tube with no change of width.
    const c = new DocBuilder()
    const t2 = c.symbol('testTube', { x: 0, y: 0 })
    const adaptor = c.symbol('thermometerAdaptor', { x: 200, y: -200 })
    const [ax, ay] = toward(adaptor, 'plug', anchorWorld(t2, 'mouth'), 1, 1)
    const ar = snap(c.doc, [adaptor.id], ax, ay, 1)
    expect(ar.resize).toBeUndefined()
    near(after(c.doc, adaptor.id, ar, 'plug'), anchorWorld(t2, 'mouth'))
    expect(fitWidth(adaptor, 'plug', 24)).toBeNull()
  })

  it('fitWidth: two secant steps on build, never below the minimum', () => {
    const b = new DocBuilder()
    const bung = b.symbol('bung')
    expect(fitWidth(bung, 'plug', 34)).toBe(37.2)
    expect(fitWidth(bung, 'plug', 50)).toBe(53.2)
    expect(fitWidth(bung, 'plug', 34.8)).toBe(38) // it fits already
    expect(fitWidth(bung, 'plug', 5)).toBe(14) // the bung's minimum width
    expect(fitWidth(bung, 'nothing', 34)).toBeNull()
  })

  it('guides: the centre and edges of the moving bounds snap to the centres and edges of the other bounds', () => {
    const b = new DocBuilder()
    b.symbol('gauze', { x: 0, y: 0 }) // bounds: x −70 to 70, y −2 to 2
    const beaker = b.symbol('beaker', { x: 300, y: 300 }) // bounds: x 240 to 357, y 238 to 362
    // The beaker's left edge 4 u right of the gauze's left edge, far above it: it snaps 4 u left, with a guide line.
    let r = snap(b.doc, [beaker.id], -306, -500, 1)
    expect(r).toEqual({ dx: -310, dy: -500, guides: [{ kind: 'line', a: P(-70, -262), b: P(-70, 2) }] })
    // Centre to centre.
    r = snap(b.doc, [beaker.id], -293, -500, 1)
    expect(r.dx).toBe(-298.5)
    expect(r.guides).toEqual([{ kind: 'line', a: P(0, -262), b: P(0, 2) }])
    // Edge to edge: the bottom of the beaker's bounds comes 3 u above the top of the gauze's, to its right.
    r = snap(b.doc, [beaker.id], -160, -367, 1)
    expect(r.dx).toBe(-160)
    expect(r.dy).toBe(-364)
    expect(r.guides).toEqual([{ kind: 'line', a: P(-70, -2), b: P(197, -2) }])
    // Nothing within T: no guide.
    expect(snap(b.doc, [beaker.id], -100, -100, 1)).toEqual({ dx: -100, dy: -100, guides: [] })
  })

  it('labels take part in the guides, as targets and as moving items, with their text as measured and not their leader', () => {
    const b = new DocBuilder()
    const beaker = b.symbol('beaker', { x: 0, y: 0 })
    const label = b.label('beaker', 300, -200, [beaker, 40, 60]) // its text starts at x = 300; its leader ends on the beaker
    const flask = b.symbol('conicalFlask', { x: 600, y: 300 })
    // In the browser the text is measured as drawn: here 6 u for each character, so the text runs from x 300 to 336.
    const measure = (text: string, size: number) => text.length * size * 0.4
    const fb = itemBox(b.doc, flask)
    // The flask's left edge dragged to 3 u right of the text's left edge: it snaps onto it, with a guide line.
    let r = snap(b.doc, [flask.id], 300 + 3 - fb.x0, 0, 1, true, measure)
    expect(r.dx).toBeCloseTo(300 - fb.x0, 9)
    expect(r.guides).toHaveLength(1)
    // With the estimate the text is wider (0.56 × the size for each character): its right edge is elsewhere.
    r = snap(b.doc, [flask.id], 336 + 2 - fb.x0, 0, 1, true, measure)
    expect(r.dx).toBeCloseTo(336 - fb.x0, 9)
    expect(snap(b.doc, [flask.id], 336 + 2 - fb.x0, 0, 1).dx).toBe(336 + 2 - fb.x0)
    // The label moves: the centre of its text goes to the centre of the flask's bounds when within T.
    const centre = (fb.x0 + fb.x1) / 2
    r = snap(b.doc, [label.id], centre - 318 + 2, 0, 1, true, measure)
    expect(r.dx).toBeCloseTo(centre - 318, 9)
    expect(r.guides.map((g) => g.kind)).toEqual(['line'])
  })

  it('an anchor snap wins over a guide; the nearest candidate wins', () => {
    const b = new DocBuilder()
    const gauze = b.symbol('gauze', { x: 0, y: 0 })
    const beaker = b.symbol('beaker', { x: 300, y: -300 })
    // The base 3 u above the gauze and 20 u right of its centre. The right edges are 7 u apart, which a guide would
    // take; the anchor wins, and the beaker does not move sideways.
    const [dx, dy] = toward(beaker, 'base', anchorWorld(gauze, 'top'), 20, -3)
    const r = snap(b.doc, [beaker.id], dx, dy, 1)
    expect(r.dx).toBe(dx)
    expect(r.dy).toBe(dy + 3)
    expect(r.guides.map((g) => g.kind)).toEqual(['line', 'anchor'])
    // A gauze on a tripod: two surfaces 5 u apart. The nearer one takes the base.
    const c = new DocBuilder()
    const tripod = c.symbol('tripod', { x: 0, y: 0 })
    const g2 = c.on('gauze', 'under', tripod, 'top')
    const b2 = c.symbol('beaker', { x: 0, y: -300 })
    const gTop = anchorWorld(g2, 'top'),
      tTop = anchorWorld(tripod, 'top')
    expect(tTop.y - gTop.y).toBe(5)
    let [ex, ey] = toward(b2, 'base', gTop, 0, -3)
    near(after(c.doc, b2.id, snap(c.doc, [b2.id], ex, ey, 1), 'base'), gTop)
    ;[ex, ey] = toward(b2, 'base', tTop, 0, -1)
    near(after(c.doc, b2.id, snap(c.doc, [b2.id], ex, ey, 1), 'base'), tTop)
  })

  it('only the pairs of the table snap, and a moving item is never a target', () => {
    const b = new DocBuilder()
    const gauze = b.symbol('gauze', { x: 0, y: 0 })
    const flask = b.symbol('conicalFlask', { x: 400, y: 0 })
    const beaker = b.symbol('beaker', { x: 300, y: -300 })
    // A base does not go into a mouth.
    let [dx, dy] = toward(beaker, 'base', anchorWorld(flask, 'mouth'), 2, -2)
    expect(met(snap(b.doc, [beaker.id], dx, dy, 1))).toBeUndefined()
    // A surface that moves up to a base does not snap: only the base snaps onto the surface.
    ;[dx, dy] = toward(gauze, 'top', anchorWorld(beaker, 'base'), 0, 3)
    expect(met(snap(b.doc, [gauze.id], dx, dy, 1))).toBeUndefined()
    // The beaker and the gauze move together: the gauze is not a target, so the beaker's base does not snap to it.
    const c = new DocBuilder()
    const g2 = c.symbol('gauze', { x: 0, y: 0 })
    const b2 = c.on('beaker', 'base', g2, 'top', { dy: -3 })
    expect(snap(c.doc, [b2.id, g2.id], 0, 0, 1)).toEqual({ dx: 0, dy: 0, guides: [] })
    expect(met(snap(c.doc, [b2.id], 0, 0, 1))).toBeDefined()
  })

  it('T is 8 screen px: 8 ÷ zoom units', () => {
    expect(SNAP_PX).toBe(8)
    const b = new DocBuilder()
    const gauze = b.symbol('gauze', { x: 0, y: 0 })
    const beaker = b.symbol('beaker', { x: 0, y: -300 })
    const top = anchorWorld(gauze, 'top')
    const at = (gap: number, zoom: number) => {
      const [dx, dy] = toward(beaker, 'base', top, 0, -gap)
      return met(snap(b.doc, [beaker.id], dx, dy, zoom))
    }
    expect(at(5, 1)).toBeDefined()
    expect(at(5, 2)).toBeUndefined()
    expect(at(3.9, 2)).toBeDefined()
    expect(at(15, 0.5)).toBeDefined()
  })

  it('snapping off (Ctrl or Cmd held, or the Snap preference off): the drag is returned as it is', () => {
    const b = new DocBuilder()
    const flask = b.symbol('conicalFlask', { x: 0, y: 0 })
    const bung = b.symbol('bung', { x: 100, y: -200 })
    const [dx, dy] = toward(bung, 'plug', anchorWorld(flask, 'mouth'), 3, -2)
    expect(snap(b.doc, [bung.id], dx, dy, 1).resize).toBeDefined()
    expect(snap(b.doc, [bung.id], dx, dy, 1, false)).toEqual({ dx, dy, guides: [] })
    expect(snap(b.doc, [], dx, dy, 1)).toEqual({ dx, dy, guides: [] })
  })

  it('works out the anchors and bounds once for each document and set of moving items, and changes nothing', () => {
    const b = new DocBuilder()
    const flask = b.symbol('conicalFlask', { x: 0, y: 0 })
    const bung = b.symbol('bung', { x: 100, y: -200 })
    b.label('flask', 200, 0, [flask, 40, 100])
    const doc = b.doc
    const before = structuredClone(doc)
    const c = snapContext(doc, [bung.id])
    expect(snapContext(doc, [bung.id])).toBe(c)
    expect(snapContext(doc, [flask.id])).not.toBe(c)
    expect(snapContext(structuredClone(doc), [bung.id])).not.toBe(c)
    // The bung's plug takes part (its port does not); the flask's mouth and neck are targets; the flask and the label's
    // text are guide targets.
    expect(c.moving.map((m) => m.a.id)).toEqual(['plug'])
    expect([...c.targets.keys()].sort()).toEqual(['mouth', 'neck'])
    expect(c.boxes).toHaveLength(2)
    expect(snapContext(doc, [bung.id], () => 1)).not.toBe(c)
    const [dx, dy] = toward(bung, 'plug', anchorWorld(flask, 'mouth'))
    moveSnapped(doc, [bung.id], snap(doc, [bung.id], dx, dy, 1))
    expect(doc).toEqual(before)
  })

  it('moveSnapped makes the move and the new width in one document', () => {
    const b = new DocBuilder()
    const bung = b.symbol('bung', { x: 0, y: 0 })
    b.symbol('beaker', { x: 300, y: 0 })
    const doc = moveSnapped(b.doc, [bung.id], { dx: 10, dy: -5, resize: { id: bung.id, w: 30 } })
    expect(doc.items[bung.id]).toMatchObject({ x: 10, y: -5, w: 30, h: 24 })
    expect(moveSnapped(b.doc, [bung.id], { dx: 0, dy: 0 })).toBe(b.doc)
  })
})
