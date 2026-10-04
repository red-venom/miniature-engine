// migrate.ts — the versions of the file format (section 7, rule 7). A change to the format raises `version` in `Doc`
// and adds a function to MIGRATIONS that turns a document of the old version into the new one. `parseDoc` runs the
// migrations before it checks a single field, so the checks only ever see the current format. Pure: no DOM.

/** A document as it comes from a file: plain JSON, not yet checked. */
export type RawDoc = Record<string, unknown>

/** Turns a document of one version into the next version. */
export type Migration = (doc: RawDoc) => RawDoc

/** The version of the format that this build reads and writes. */
export const FORMAT_VERSION = 1

/** MIGRATIONS[v] turns a document of version v into version v + 1. Version 1 is the first format: there are none yet. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {}

export type MigrateResult = { ok: true; doc: RawDoc; problems: string[] } | { ok: false; problems: string[] }

/**
 * Bring a document up to the current version, one migration at a time. A version that is not a whole number from 1
 * fails, and so does a version with no migration from it. A newer version than this build knows is read as far as this
 * build understands it, with a problem that says so: like an unknown symbol (rule 6), a file from a newer version still
 * opens.
 */
export function migrate(doc: RawDoc, migrations: Readonly<Record<number, Migration>> = MIGRATIONS, current = FORMAT_VERSION): MigrateResult {
  const v = doc.version
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, problems: ['The file has no valid format version.'] }
  if (v > current) {
    return {
      ok: true,
      doc: { ...doc, version: current },
      problems: [`The file was made by a newer version of PracDraw (format ${v}). Anything that this version does not know is left out.`],
    }
  }
  let out = doc
  for (let k = v; k < current; k++) {
    const step = migrations[k]
    if (!step) return { ok: false, problems: [`The file is in format ${v}, and this version cannot read format ${k}.`] }
    try {
      out = { ...step(out), version: k + 1 }
    } catch {
      return { ok: false, problems: [`The file is in format ${v}, and it could not be brought up to format ${k + 1}.`] }
    }
  }
  return { ok: true, doc: out, problems: [] }
}
