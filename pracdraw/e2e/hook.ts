// hook.ts — what the browser tests share: the built file to open, and the type of the test hook window.__pracdraw
// (section 14 of the specification; src/editor/hook.ts installs it).

import { pathToFileURL } from 'node:url'
import type { ExportOptions } from '../src/export/picture.ts'
import type { Doc } from '../src/model/types.ts'

/** The built single file, opened straight from disk: the hardest hosting case. */
export const FILE = pathToFileURL('dist/index.html').href

export interface Hook {
  doc(): Doc
  load(doc: Doc): void
  /** A data: URL of a PNG export; `options` are merged over the default export. */
  png(scale: number, options?: Partial<ExportOptions>): string
  /** An SVG export; `options` are merged over the default export. */
  svg(options?: Partial<ExportOptions>): string
  view(v?: { x?: number; y?: number; zoom?: number }): { x: number; y: number; zoom: number }
  screenRect(): { x: number; y: number; width: number; height: number }
  /** The host the app talks to: 'web', or 'claude' once window.claude.use('downloads') has answered. */
  host(): 'web' | 'claude'
}

declare global {
  interface Window {
    __pracdraw: Hook
  }
}
