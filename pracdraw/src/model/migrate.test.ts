import { describe, expect, it } from 'vitest'
import { FORMAT_VERSION, MIGRATIONS, migrate, type RawDoc } from './migrate'

describe('migrate', () => {
  it('version 1 is the current format and has no migrations yet', () => {
    expect(FORMAT_VERSION).toBe(1)
    expect(Object.keys(MIGRATIONS)).toEqual([])
    const doc = { app: 'pracdraw', version: 1, title: 'x' }
    const r = migrate(doc)
    expect(r).toEqual({ ok: true, doc, problems: [] })
  })

  it('runs each migration in turn from the version of the file, and sets the version after each', () => {
    const steps: number[] = []
    const migrations = {
      1: (d: RawDoc) => {
        steps.push(d.version as number)
        return { ...d, parts: d.items, items: undefined }
      },
      2: (d: RawDoc) => {
        steps.push(d.version as number)
        return { ...d, items: d.parts, parts: undefined, upgraded: true }
      },
    }
    const r = migrate({ version: 1, items: { a: 1 } }, migrations, 3)
    expect(steps).toEqual([1, 2])
    expect(r).toEqual({ ok: true, doc: { version: 3, items: { a: 1 }, parts: undefined, upgraded: true }, problems: [] })
    // A file already at version 2 takes only the second step.
    steps.length = 0
    expect(migrate({ version: 2, parts: { b: 2 } }, migrations, 3)).toMatchObject({ ok: true, doc: { version: 3, items: { b: 2 } } })
    expect(steps).toEqual([2])
  })

  it('fails without a valid version, without a migration it needs, or when a migration throws', () => {
    for (const version of [undefined, null, 0, -1, 1.5, '1', NaN]) {
      expect(migrate({ version } as RawDoc).ok, String(version)).toBe(false)
    }
    expect(migrate({ version: 1 }, {}, 2)).toEqual({ ok: false, problems: ['The file is in format 1, and this version cannot read format 1.'] })
    const broken = {
      1: () => {
        throw new Error('no')
      },
    }
    expect(migrate({ version: 1 }, broken, 2)).toEqual({ ok: false, problems: ['The file is in format 1, and it could not be brought up to format 2.'] })
  })

  it('reads a file from a newer version as far as it can, and says so', () => {
    const r = migrate({ version: 4, title: 'later' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.doc).toEqual({ version: 1, title: 'later' })
    expect(r.problems).toEqual(['The file was made by a newer version of PracDraw (format 4). Anything that this version does not know is left out.'])
  })
})
